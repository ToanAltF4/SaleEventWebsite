import { getShortLink, createShortLink, findShortLinkByTarget, updateShortLinkCreatedBy } from "./db";

const SHORT_DOMAIN = "kimngan.site";

const TRACKING_PARAMS = new Set([
  "mmp_pid", "uls_trackid", "utm_campaign", "utm_content",
  "utm_medium", "utm_source", "utm_term", "affiliate_id",
  "sub_id", "smtt", "sp_atk", "xptdk",
]);

export function extractShopItemId(url: string): [string | null, string | null] {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    let m = path.match(/\/product\/(\d+)\/(\d+)/);
    if (m) return [m[1], m[2]];

    m = path.match(/-i\.(\d+)\.(\d+)/);
    if (m) return [m[1], m[2]];

    m = path.match(/\/[^/]+\/(\d{5,})\/(\d{5,})/);
    if (m) return [m[1], m[2]];
  } catch {}
  return [null, null];
}

export function isShortUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("vn.shp.ee")) return true;
    return parsed.hostname.includes("s.shopee.vn") && !url.includes("/an_redir");
  } catch {
    return false;
  }
}

export function isAffiliateRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("s.shopee.vn") && url.includes("/an_redir");
  } catch {
    return false;
  }
}

export function isShopeeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("shopee.vn");
  } catch {
    return false;
  }
}

export function cleanShopeeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const newParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        newParams.set(key, value);
      }
    });
    parsed.search = newParams.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

export function extractOriginFromRedirect(url: string): string | null {
  try {
    const parsed = new URL(url);
    const originLink = parsed.searchParams.get("origin_link");
    if (originLink) {
      return cleanShopeeUrl(decodeURIComponent(originLink));
    }
  } catch {}
  return null;
}

export async function expandShortUrl(shortUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(shortUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    const location = resp.headers.get("location");
    if (location) {
      // Handle relative redirects
      if (location.startsWith("/")) {
        const parsed = new URL(shortUrl);
        return `${parsed.protocol}//${parsed.host}${location}`;
      }
      return location;
    }
    return null;
  } catch {
    return null;
  }
}

function buildSubId(s1 = "Knsansale", s2 = "KnSaleMxh", s3 = "", s4 = "", s5 = ""): string {
  return `${s1}-${s2}-${s3}-${s4}-${s5}`;
}

function buildAffiliateUrlProduct(shopId: string, itemId: string, affiliateId: string): string {
  const origin = `https://shopee.vn/product/${shopId}/${itemId}`;
  return `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(origin)}&affiliate_id=${affiliateId}&sub_id=${buildSubId()}`;
}

function buildAffiliateUrlRaw(rawUrl: string, affiliateId: string): string {
  return `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(rawUrl)}&affiliate_id=${affiliateId}&sub_id=${buildSubId()}`;
}

export async function processSingleUrl(url: string, affiliateId: string): Promise<[string | null, string]> {
  url = url.trim();
  if (!url.startsWith("http")) url = "https://" + url;
  const originalUrl = url;

  // Extract from affiliate redirect
  if (isAffiliateRedirect(url)) {
    const origin = extractOriginFromRedirect(url);
    if (origin) url = origin;
    else return [null, originalUrl];
  }

  if (isShortUrl(url)) {
    const expanded = await expandShortUrl(url);
    if (!expanded) return [null, originalUrl];
    url = expanded;
    if (isAffiliateRedirect(url)) {
      const origin = extractOriginFromRedirect(url);
      if (origin) url = origin;
      else return [null, originalUrl];
    }
  }

  if (!isShopeeUrl(url)) return [null, originalUrl];

  url = cleanShopeeUrl(url);

  const [shopId, itemId] = extractShopItemId(url);
  const affUrl = shopId && itemId
    ? buildAffiliateUrlProduct(shopId, itemId, affiliateId)
    : buildAffiliateUrlRaw(url, affiliateId);

  return [affUrl, originalUrl];
}

export function extractUrlsFromText(text: string): string[] {
  const pattern = /https?:\/\/[^\s<>"')\]}]+/g;
  return text.match(pattern) || [];
}

// ============================================================
//  SHORT URL
// ============================================================

function generateShortCodeString(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function generateShortCode(length = 8): Promise<string> {
  while (true) {
    const code = generateShortCodeString(length);
    const existing = await getShortLink(code);
    if (!existing) return code;
  }
}

export async function createShortUrl(targetUrl: string, createdBy: string | null = null): Promise<string> {
  const existing = await findShortLinkByTarget(targetUrl);
  if (existing) {
    if (createdBy && !existing.created_by) {
      await updateShortLinkCreatedBy(existing.short_code, createdBy);
    }
    return `https://${SHORT_DOMAIN}/s/${existing.short_code}`;
  }
  const code = await generateShortCode();
  await createShortLink(code, targetUrl, createdBy);
  return `https://${SHORT_DOMAIN}/s/${code}`;
}

export { SHORT_DOMAIN };
