import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isAffiliateRedirect, extractOriginFromRedirect,
  isShortUrl, expandShortUrl, isShopeeUrl,
  cleanShopeeUrl, extractShopItemId,
} from "@/lib/url-processing";

export async function POST(req: NextRequest) {
  // Rate limit unless logged in
  const user = await requireAuth();
  if (!user) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Bạn đã tạo quá nhiều link. Vui lòng thử lại sau 1 giờ." },
        { status: 429 }
      );
    }
  }

  const { url: rawUrlInput } = await req.json();
  if (!rawUrlInput?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập link" }, { status: 400 });
  }

  const cookie = await getSetting("shopee_cookie", "");
  if (!cookie) {
    return NextResponse.json({ error: "Chưa cấu hình cookie" }, { status: 400 });
  }

  let url = rawUrlInput.trim();
  if (!url.startsWith("http")) url = "https://" + url;

  if (isAffiliateRedirect(url)) {
    const origin = extractOriginFromRedirect(url);
    if (origin) url = origin;
  }

  if (isShortUrl(url)) {
    const expanded = await expandShortUrl(url);
    if (expanded) {
      url = expanded;
      if (isAffiliateRedirect(url)) {
        const origin = extractOriginFromRedirect(url);
        if (origin) url = origin;
      }
    }
  }

  if (!isShopeeUrl(url)) {
    return NextResponse.json({ error: "Không phải link Shopee" }, { status: 400 });
  }

  url = cleanShopeeUrl(url);

  const [shopId, itemId] = extractShopItemId(url);
  const originalLink = shopId && itemId
    ? `https://shopee.vn/product/${shopId}/${itemId}`
    : url;

  const payload = {
    operationName: "batchGetCustomLink",
    query: `
      query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
        batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
          shortLink
          longLink
          failCode
        }
      }
    `,
    variables: {
      linkParams: [{ originalLink, advancedLinkParams: {} }],
      sourceCaller: "CUSTOM_LINK_CALLER",
    },
  };

  try {
    const resp = await fetch("https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "affiliate-program-type": "1",
        "x-sz-sdk-version": "1.12.21",
        "cookie": cookie,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const result = await resp.json();

    if (
      result?.data?.batchCustomLink?.length > 0
    ) {
      const item = result.data.batchCustomLink[0];
      if (item.failCode === 0 && item.shortLink) {
        return NextResponse.json({ success: true, short_link: item.shortLink });
      }
      return NextResponse.json({ error: `Shopee API failCode: ${item.failCode}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Response không đúng format" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Lỗi kết nối Shopee: ${msg}` }, { status: 500 });
  }
}
