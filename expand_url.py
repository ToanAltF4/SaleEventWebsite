import requests
import re
import sys
import json
import os
from urllib.parse import urlparse, quote

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "affiliate_config.json")


# ============================================================
#  CONFIG
# ============================================================

def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_config(config):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# ============================================================
#  URL PROCESSING
# ============================================================

def expand_short_url(short_url):
    """Expand link rut gon Shopee"""
    try:
        resp = requests.get(short_url, allow_redirects=True, timeout=10)
        return resp.url
    except requests.RequestException as e:
        print(f"  [!] Loi expand URL: {e}")
        return None


def extract_shop_item_id(url):
    """
    Extract shop_id, item_id tu cac dang URL:
      /product/shopid/itemid
      -i.shopid.itemid
      /slug/shopid/itemid
    """
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


# ============================================================
#  MAIN
# ============================================================

def process_url(url, affiliate_id):
    """Parse URL bat ky -> tra ve affiliate URL"""

    # Step 1: Expand neu la short URL
    if is_short_url(url):
        print(f"  Expanding short URL...")
        url = expand_short_url(url)
        if not url:
            return None
        print(f"  -> {url}")

    # Step 2: Extract shop_id, item_id
    shop_id, item_id = extract_shop_item_id(url)
    if not shop_id or not item_id:
        print("  [!] Khong the extract Shop ID / Item ID.")
        return None

    print(f"  Shop ID : {shop_id}")
    print(f"  Item ID : {item_id}")

    # Step 3: Build affiliate URL
    origin = f"https://shopee.vn/product/{shop_id}/{item_id}"
    affiliate_url = (
        f"https://s.shopee.vn/an_redir?"
        f"origin_link={quote(origin, safe='')}"
        f"&affiliate_id={affiliate_id}"
    )

    return affiliate_url


def process_batch(urls, affiliate_id):
    """Xu ly nhieu URLs"""
    results = []
    for url in urls:
        url = url.strip()
        if not url:
            continue
        if not url.startswith("http"):
            url = "https://" + url

        aff_url = process_url(url, affiliate_id)
        if aff_url:
            results.append(aff_url)

    return results


def setup_config():
    config = load_config()
    print("\n--- Setup ---\n")
    aff_id = input(f"Affiliate ID [{config.get('affiliate_id', '')}]: ").strip()
    if aff_id:
        config["affiliate_id"] = aff_id
    save_config(config)
    print(f"Da luu: {CONFIG_FILE}")
    return config


if __name__ == "__main__":
    print("=== Shopee Affiliate Link Generator ===")

    config = load_config()

    if "--setup" in sys.argv:
        setup_config()
        sys.exit(0)

    if "--batch" in sys.argv:
        aff_id = config.get("affiliate_id", "")
        if not aff_id:
            config = setup_config()
            aff_id = config["affiliate_id"]

        idx = sys.argv.index("--batch")
        if idx + 1 < len(sys.argv):
            with open(sys.argv[idx + 1], "r", encoding="utf-8") as f:
                urls = f.readlines()
        else:
            print("Nhap URLs (1 URL/dong, Enter 2 lan de ket thuc):")
            urls = []
            while True:
                line = input()
                if not line:
                    break
                urls.append(line)

        results = process_batch(urls, aff_id)
        print(f"\n{'='*60}")
        for r in results:
            print(r)
        print(f"{'='*60}")
        print(f"Tong: {len(results)} link(s)")
        sys.exit(0)

    # Interactive single URL
    aff_id = config.get("affiliate_id", "")
    if not aff_id:
        config = setup_config()
        aff_id = config["affiliate_id"]

    url = input("\nShopee URL: ").strip()
    if not url:
        print("Vui long nhap URL.")
        sys.exit(1)
    if not url.startswith("http"):
        url = "https://" + url

    result = process_url(url, aff_id)
    if result:
        print(f"\nAffiliate URL:\n{result}")