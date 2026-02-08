import os
import re
import requests
from urllib.parse import urlparse, quote
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI
from database import init_db, get_setting, set_setting, add_history, get_history

load_dotenv()

app = Flask(__name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_FILE = os.path.join(SCRIPT_DIR, "verify_prompt.txt")


# ============================================================
#  URL PROCESSING (from expand_url.py)
# ============================================================

def expand_short_url(short_url):
    try:
        resp = requests.get(short_url, allow_redirects=True, timeout=10)
        return resp.url
    except requests.RequestException:
        return None


def extract_shop_item_id(url):
    parsed = urlparse(url)
    path = parsed.path

    m = re.search(r"/product/(\d+)/(\d+)", path)
    if m:
        return m.group(1), m.group(2)

    m = re.search(r"-i\.(\d+)\.(\d+)", path)
    if m:
        return m.group(1), m.group(2)

    m = re.search(r"/[^/]+/(\d{5,})/(\d{5,})", path)
    if m:
        return m.group(1), m.group(2)

    return None, None


def is_short_url(url):
    parsed = urlparse(url)
    return "s.shopee.vn" in parsed.netloc and "/an_redir" not in url


def is_shopee_url(url):
    parsed = urlparse(url)
    return "shopee.vn" in parsed.netloc


def build_affiliate_url_product(shop_id, item_id, affiliate_id, sub_id1="Knsansale", sub_id2="KnSaleMxh"):
    origin = f"https://shopee.vn/product/{shop_id}/{item_id}"
    return (
        f"https://s.shopee.vn/an_redir?"
        f"origin_link={quote(origin, safe='')}"
        f"&affiliate_id={affiliate_id}"
        f"&sub_id={sub_id1}-{sub_id2}"
    )


def build_affiliate_url_raw(raw_url, affiliate_id, sub_id1="Knsansale", sub_id2="KnSaleMxh"):
    """Wrap any Shopee URL into affiliate redirect format."""
    return (
        f"https://s.shopee.vn/an_redir?"
        f"origin_link={quote(raw_url, safe='')}"
        f"&affiliate_id={affiliate_id}"
        f"&sub_id={sub_id1}-{sub_id2}"
    )


def process_single_url(url, affiliate_id):
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    original_url = url

    # Expand short URL (s.shopee.vn/xxx)
    if is_short_url(url):
        expanded = expand_short_url(url)
        if not expanded:
            return None, original_url
        url = expanded

    # Only process shopee.vn links
    if not is_shopee_url(url):
        return None, original_url

    # Try to extract product IDs for clean product URL
    shop_id, item_id = extract_shop_item_id(url)
    if shop_id and item_id:
        aff_url = build_affiliate_url_product(shop_id, item_id, affiliate_id)
    else:
        # Non-product Shopee link (shop page, category, etc.) -> wrap as-is
        aff_url = build_affiliate_url_raw(url, affiliate_id)

    return aff_url, original_url


def extract_urls_from_text(text):
    pattern = r'https?://[^\s<>\"\')\]}]+'
    return re.findall(pattern, text)


def load_verify_prompt():
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
#  ROUTES
# ============================================================

@app.route("/")
def index():
    affiliate_id = get_setting("affiliate_id", "")
    history = get_history(20)
    return render_template("index.html", affiliate_id=affiliate_id, history=history)


@app.route("/api/save-affiliate", methods=["POST"])
def save_affiliate():
    data = request.json
    affiliate_id = data.get("affiliate_id", "").strip()
    if not affiliate_id:
        return jsonify({"error": "Affiliate ID không được để trống"}), 400
    set_setting("affiliate_id", affiliate_id)
    return jsonify({"success": True, "affiliate_id": affiliate_id})


@app.route("/api/convert", methods=["POST"])
def convert():
    data = request.json
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Vui lòng nhập nội dung tin nhắn"}), 400

    affiliate_id = get_setting("affiliate_id", "")
    if not affiliate_id:
        return jsonify({"error": "Vui lòng cài đặt Affiliate ID trước"}), 400

    # Extract all URLs from message
    urls = extract_urls_from_text(message)
    if not urls:
        return jsonify({"error": "Không tìm thấy link nào trong tin nhắn"}), 400

    # Process each URL
    link_mapping = {}
    for url in urls:
        aff_url, original = process_single_url(url, affiliate_id)
        if aff_url:
            link_mapping[url] = aff_url

    if not link_mapping:
        return jsonify({"error": "Không thể chuyển đổi link nào (không tìm thấy link Shopee sản phẩm)"}), 400

    # Build mapping text for prompt
    mapping_text = "\n".join(
        f"- {orig} -> {aff}" for orig, aff in link_mapping.items()
    )

    # Load verify prompt and call OpenAI
    prompt_template = load_verify_prompt()
    prompt = prompt_template.replace("{original_message}", message).replace(
        "{link_mapping}", mapping_text
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        converted = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"Lỗi OpenAI: {str(e)}"}), 500

    # Save to history
    add_history(message, converted)

    return jsonify({
        "success": True,
        "original": message,
        "converted": converted,
        "links_found": len(urls),
        "links_converted": len(link_mapping),
        "mapping": link_mapping,
    })


@app.route("/api/history")
def history_api():
    history = get_history(20)
    return jsonify(history)


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
