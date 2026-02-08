import os
import re
import requests
from urllib.parse import urlparse, quote, parse_qs, urlencode, urlunparse, unquote
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from dotenv import load_dotenv
from openai import OpenAI
from database import (
    init_db, get_setting, set_setting, add_history, get_history,
    verify_user, cleanup_old_history,
)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "kimngan-sale-secret-2026")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_FILE = os.path.join(SCRIPT_DIR, "verify_prompt.txt")


# ============================================================
#  AUTH
# ============================================================

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated


# ============================================================
#  URL PROCESSING
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


def is_affiliate_redirect(url):
    parsed = urlparse(url)
    return "s.shopee.vn" in parsed.netloc and "/an_redir" in url


def is_shopee_url(url):
    parsed = urlparse(url)
    return "shopee.vn" in parsed.netloc


# Params thuộc về affiliate/tracking của người khác, cần loại bỏ
TRACKING_PARAMS = {
    "mmp_pid", "uls_trackid", "utm_campaign", "utm_content",
    "utm_medium", "utm_source", "utm_term", "affiliate_id",
    "sub_id", "smtt", "sp_atk", "xptdk",
}


def clean_shopee_url(url):
    """Loại bỏ tất cả tracking/affiliate params của người khác khỏi URL Shopee."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    cleaned = {k: v for k, v in params.items() if k.lower() not in TRACKING_PARAMS}
    clean_query = urlencode(cleaned, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, clean_query, parsed.fragment))


def extract_origin_from_redirect(url):
    """Nếu URL là s.shopee.vn/an_redir, trích xuất origin_link gốc và làm sạch."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    origin_link = params.get("origin_link", [None])[0]
    if origin_link:
        return clean_shopee_url(unquote(origin_link))
    return None


def build_sub_id(sub_id1="Knsansale", sub_id2="KnSaleMxh", sub_id3="", sub_id4="", sub_id5=""):
    return f"{sub_id1}-{sub_id2}-{sub_id3}-{sub_id4}-{sub_id5}"


def build_affiliate_url_product(shop_id, item_id, affiliate_id):
    origin = f"https://shopee.vn/product/{shop_id}/{item_id}"
    return (
        f"https://s.shopee.vn/an_redir?"
        f"origin_link={quote(origin, safe='')}"
        f"&affiliate_id={affiliate_id}"
        f"&sub_id={build_sub_id()}"
    )


def build_affiliate_url_raw(raw_url, affiliate_id):
    return (
        f"https://s.shopee.vn/an_redir?"
        f"origin_link={quote(raw_url, safe='')}"
        f"&affiliate_id={affiliate_id}"
        f"&sub_id={build_sub_id()}"
    )


def process_single_url(url, affiliate_id):
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    original_url = url

    # Nếu là link affiliate redirect của người khác, trích xuất origin gốc
    if is_affiliate_redirect(url):
        origin = extract_origin_from_redirect(url)
        if origin:
            url = origin
        else:
            return None, original_url

    if is_short_url(url):
        expanded = expand_short_url(url)
        if not expanded:
            return None, original_url
        url = expanded
        # Sau khi expand, kiểm tra nếu nó redirect tới an_redir
        if is_affiliate_redirect(url):
            origin = extract_origin_from_redirect(url)
            if origin:
                url = origin
            else:
                return None, original_url

    if not is_shopee_url(url):
        return None, original_url

    # Làm sạch tracking params còn sót trong URL
    url = clean_shopee_url(url)

    shop_id, item_id = extract_shop_item_id(url)
    if shop_id and item_id:
        aff_url = build_affiliate_url_product(shop_id, item_id, affiliate_id)
    else:
        aff_url = build_affiliate_url_raw(url, affiliate_id)

    return aff_url, original_url


def extract_urls_from_text(text):
    pattern = r'https?://[^\s<>\"\')\]}]+'
    return re.findall(pattern, text)


def load_verify_prompt():
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
#  PAGES
# ============================================================

@app.route("/")
def home():
    return render_template("home.html", user=session.get("user"))


@app.route("/login", methods=["GET"])
def login_page():
    if "user" in session:
        return redirect(url_for("admin_dashboard"))
    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login_submit():
    data = request.form
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if verify_user(username, password):
        session["user"] = username
        return redirect(url_for("admin_dashboard"))
    return render_template("login.html", error="Sai tài khoản hoặc mật khẩu")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("home"))


@app.route("/admin")
@login_required
def admin_dashboard():
    return redirect(url_for("admin_convert_link"))


@app.route("/admin/convert-link")
@login_required
def admin_convert_link():
    affiliate_id = get_setting("affiliate_id", "")
    return render_template("admin.html", page="convert-link", affiliate_id=affiliate_id, user=session.get("user"))


@app.route("/admin/ai-content")
@login_required
def admin_ai_content():
    affiliate_id = get_setting("affiliate_id", "")
    history = get_history(20)
    return render_template("admin.html", page="ai-content", affiliate_id=affiliate_id, history=history, user=session.get("user"))


# ============================================================
#  API
# ============================================================

@app.route("/api/save-affiliate", methods=["POST"])
@login_required
def save_affiliate():
    data = request.json
    affiliate_id = data.get("affiliate_id", "").strip()
    if not affiliate_id:
        return jsonify({"error": "Affiliate ID không được để trống"}), 400
    set_setting("affiliate_id", affiliate_id)
    return jsonify({"success": True, "affiliate_id": affiliate_id})


@app.route("/api/public-convert-link", methods=["POST"])
def public_convert_link():
    data = request.json
    raw_urls = data.get("urls", "").strip()
    if not raw_urls:
        return jsonify({"error": "Vui lòng nhập ít nhất 1 link"}), 400

    affiliate_id = get_setting("affiliate_id", "")
    if not affiliate_id:
        return jsonify({"error": "Hệ thống chưa được cấu hình. Vui lòng liên hệ admin."}), 400

    lines = raw_urls.splitlines()
    results = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        found = extract_urls_from_text(line)
        if found:
            for url in found:
                aff_url, _ = process_single_url(url, affiliate_id)
                results.append({"original": url, "affiliate": aff_url or "Không hỗ trợ"})
        elif line.startswith(("http", "s.shopee", "shopee")):
            if not line.startswith("http"):
                line = "https://" + line
            aff_url, _ = process_single_url(line, affiliate_id)
            results.append({"original": line, "affiliate": aff_url or "Không hỗ trợ"})

    if not results:
        return jsonify({"error": "Không tìm thấy link hợp lệ"}), 400

    return jsonify({"success": True, "results": results})


@app.route("/api/convert-link", methods=["POST"])
@login_required
def convert_link():
    data = request.json
    raw_urls = data.get("urls", "").strip()
    if not raw_urls:
        return jsonify({"error": "Vui lòng nhập ít nhất 1 link"}), 400

    affiliate_id = get_setting("affiliate_id", "")
    if not affiliate_id:
        return jsonify({"error": "Vui lòng cài đặt Affiliate ID trước"}), 400

    lines = raw_urls.splitlines()
    results = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        found = extract_urls_from_text(line)
        if found:
            for url in found:
                aff_url, _ = process_single_url(url, affiliate_id)
                results.append({"original": url, "affiliate": aff_url or "Không hỗ trợ"})
        elif line.startswith(("http", "s.shopee", "shopee")):
            if not line.startswith("http"):
                line = "https://" + line
            aff_url, _ = process_single_url(line, affiliate_id)
            results.append({"original": line, "affiliate": aff_url or "Không hỗ trợ"})

    if not results:
        return jsonify({"error": "Không tìm thấy link hợp lệ"}), 400

    return jsonify({"success": True, "results": results})


@app.route("/api/convert", methods=["POST"])
@login_required
def convert():
    data = request.json
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Vui lòng nhập nội dung tin nhắn"}), 400

    affiliate_id = get_setting("affiliate_id", "")
    if not affiliate_id:
        return jsonify({"error": "Vui lòng cài đặt Affiliate ID trước"}), 400

    urls = extract_urls_from_text(message)

    link_mapping = {}
    for url in urls:
        aff_url, original = process_single_url(url, affiliate_id)
        if aff_url:
            link_mapping[url] = aff_url

    if link_mapping:
        mapping_text = "\n".join(
            f"- {orig} -> {aff}" for orig, aff in link_mapping.items()
        )
    else:
        mapping_text = "(Không có link Shopee cần chuyển đổi. Giữ nguyên tất cả link trong tin nhắn.)"

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
@login_required
def history_api():
    history = get_history(20)
    return jsonify(history)


if __name__ == "__main__":
    init_db()
    cleanup_old_history(14)
    app.run(debug=True, port=5000)
