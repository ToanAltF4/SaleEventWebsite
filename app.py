import os
import re
import json as json_lib
import requests
from datetime import timedelta
from curl_cffi import requests as cffi_requests
from urllib.parse import urlparse, quote, parse_qs, urlencode, urlunparse, unquote
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from dotenv import load_dotenv
from openai import OpenAI
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import string
import random
from database import (
    init_db, get_setting, set_setting, add_history, get_history,
    verify_user, cleanup_old_history, cleanup_old_short_links,
    create_short_link, get_short_link, find_short_link_by_target,
    increment_click, get_admin_short_links, update_short_link_created_by,
)

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "kimngan-sale-secret-2026")
app.permanent_session_lifetime = timedelta(days=30)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Rate limiter — dùng IP từ header X-Forwarded-For (cho tunnel/proxy)
def get_real_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr).split(",")[0].strip()

limiter = Limiter(
    key_func=get_real_ip,
    app=app,
    storage_uri="memory://",
    default_limits=[],
)

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
    if "vn.shp.ee" in parsed.netloc:
        return True
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
#  SHORT URL
# ============================================================

SHORT_DOMAIN = "kimngan.site"


def generate_short_code(length=8):
    chars = string.ascii_letters + string.digits
    while True:
        code = "".join(random.choices(chars, k=length))
        if not get_short_link(code):
            return code


def create_short_url(target_url, created_by=None):
    existing = find_short_link_by_target(target_url)
    if existing:
        # Nếu admin convert link mà trước đó public user đã tạo (created_by=NULL),
        # cập nhật created_by để link xuất hiện trong báo cáo click của admin
        if created_by and not existing.get("created_by"):
            update_short_link_created_by(existing["short_code"], created_by)
        return f"https://{SHORT_DOMAIN}/s/{existing['short_code']}"
    code = generate_short_code()
    create_short_link(code, target_url, created_by=created_by)
    return f"https://{SHORT_DOMAIN}/s/{code}"


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
        session.permanent = True
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


@app.route("/admin/click-report")
@login_required
def admin_click_report():
    affiliate_id = get_setting("affiliate_id", "")
    search = request.args.get("q", "")
    date_from = request.args.get("from", "")
    date_to = request.args.get("to", "")
    links = get_admin_short_links(search=search, date_from=date_from, date_to=date_to)
    total_clicks = sum(l["click_count"] for l in links)
    return render_template(
        "admin.html",
        page="click-report",
        affiliate_id=affiliate_id,
        user=session.get("user"),
        report_links=links,
        total_clicks=total_clicks,
        total_links=len(links),
        search=search,
        date_from=date_from,
        date_to=date_to,
        short_domain=SHORT_DOMAIN,
    )


@app.route("/s/<short_code>")
def short_redirect(short_code):
    link = get_short_link(short_code)
    if not link:
        return "Link không tồn tại", 404
    increment_click(short_code)
    return redirect(link["target_url"])


# ============================================================
#  API
# ============================================================

@app.route("/api/save-cookie", methods=["POST"])
@login_required
def save_cookie():
    data = request.json
    cookie = data.get("cookie", "").strip()
    if not cookie:
        return jsonify({"error": "Cookie không được để trống"}), 400
    set_setting("shopee_cookie", cookie)
    return jsonify({"success": True})


@app.route("/api/get-cookie", methods=["GET"])
@login_required
def get_cookie():
    cookie = get_setting("shopee_cookie", "")
    return jsonify({"cookie": cookie})


@app.route("/api/save-affiliate", methods=["POST"])
@login_required
def save_affiliate():
    data = request.json
    affiliate_id = data.get("affiliate_id", "").strip()
    if not affiliate_id:
        return jsonify({"error": "Affiliate ID không được để trống"}), 400
    set_setting("affiliate_id", affiliate_id)
    return jsonify({"success": True, "affiliate_id": affiliate_id})


@app.route("/api/public-custom-link", methods=["POST"])
@limiter.limit("50 per hour", exempt_when=lambda: "user" in session)
def public_custom_link():
    """Gọi Shopee Custom Link API với cookie đã lưu. Dùng cho trang chủ."""
    data = request.json
    raw_url = data.get("url", "").strip()
    if not raw_url:
        return jsonify({"error": "Vui lòng nhập link"}), 400

    cookie = get_setting("shopee_cookie", "")
    if not cookie:
        return jsonify({"error": "Chưa cấu hình cookie"}), 400

    # Xử lý URL: expand short URL, extract từ affiliate redirect, clean tracking params
    if not raw_url.startswith("http"):
        raw_url = "https://" + raw_url

    url = raw_url
    if is_affiliate_redirect(url):
        origin = extract_origin_from_redirect(url)
        if origin:
            url = origin

    if is_short_url(url):
        expanded = expand_short_url(url)
        if expanded:
            url = expanded
            if is_affiliate_redirect(url):
                origin = extract_origin_from_redirect(url)
                if origin:
                    url = origin

    if not is_shopee_url(url):
        return jsonify({"error": "Không phải link Shopee"}), 400

    url = clean_shopee_url(url)

    # Chuẩn hoá thành dạng product URL nếu có shop_id/item_id
    shop_id, item_id = extract_shop_item_id(url)
    if shop_id and item_id:
        original_link = f"https://shopee.vn/product/{shop_id}/{item_id}"
    else:
        original_link = url

    # Gọi Shopee Custom Link API
    payload = {
        "operationName": "batchGetCustomLink",
        "query": """
    query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
        shortLink
        longLink
        failCode
      }
    }
    """,
        "variables": {
            "linkParams": [
                {"originalLink": original_link, "advancedLinkParams": {}}
            ],
            "sourceCaller": "CUSTOM_LINK_CALLER",
        },
    }

    headers = {
        "content-type": "application/json; charset=UTF-8",
        "affiliate-program-type": "1",
        "x-sz-sdk-version": "1.12.21",
        "cookie": cookie,
    }

    try:
        resp = cffi_requests.post(
            "https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink",
            data=json_lib.dumps(payload),
            headers=headers,
            timeout=15,
            impersonate="chrome",
        )
        result = resp.json()

        # Parse kết quả
        if (result.get("data")
                and result["data"].get("batchCustomLink")
                and len(result["data"]["batchCustomLink"]) > 0):
            item = result["data"]["batchCustomLink"][0]
            if item.get("failCode") == 0 and item.get("shortLink"):
                return jsonify({"success": True, "short_link": item["shortLink"]})
            else:
                return jsonify({"error": f"Shopee API failCode: {item.get('failCode')}"}), 400
        else:
            return jsonify({"error": "Response không đúng format"}), 400
    except Exception as e:
        return jsonify({"error": f"Lỗi kết nối Shopee: {str(e)}"}), 500


@app.route("/api/public-convert-link", methods=["POST"])
@limiter.limit("50 per hour", exempt_when=lambda: "user" in session)
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
                display_url = aff_url if aff_url else "Không hỗ trợ"
                results.append({"original": url, "affiliate": display_url})
        elif line.startswith(("http", "s.shopee", "shopee")):
            if not line.startswith("http"):
                line = "https://" + line
            aff_url, _ = process_single_url(line, affiliate_id)
            display_url = aff_url if aff_url else "Không hỗ trợ"
            results.append({"original": line, "affiliate": display_url})

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

    user = session.get("user")
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
                display_url = create_short_url(aff_url, created_by=user) if aff_url else "Không hỗ trợ"
                results.append({"original": url, "affiliate": display_url})
        elif line.startswith(("http", "s.shopee", "shopee")):
            if not line.startswith("http"):
                line = "https://" + line
            aff_url, _ = process_single_url(line, affiliate_id)
            display_url = create_short_url(aff_url, created_by=user) if aff_url else "Không hỗ trợ"
            results.append({"original": line, "affiliate": display_url})

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

    # Thay thế tất cả link affiliate dài trong converted bằng short URL
    user = session.get("user")
    short_mapping = {}
    for orig, aff in link_mapping.items():
        short_url = create_short_url(aff, created_by=user)
        short_mapping[orig] = short_url
        converted = converted.replace(aff, short_url)

    add_history(message, converted)

    return jsonify({
        "success": True,
        "original": message,
        "converted": converted,
        "links_found": len(urls),
        "links_converted": len(link_mapping),
        "mapping": short_mapping,
    })


@app.route("/api/history")
@login_required
def history_api():
    history = get_history(20)
    return jsonify(history)


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Bạn đã tạo quá nhiều link. Vui lòng thử lại sau 1 giờ."}), 429


if __name__ == "__main__":
    init_db()
    cleanup_old_history(14)
    cleanup_old_short_links(30)
    app.run(debug=True, port=5000)
