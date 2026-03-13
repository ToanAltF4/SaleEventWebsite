import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { spawn } from "child_process";
import path from "path";
import {
  isAffiliateRedirect, extractOriginFromRedirect,
  isShortUrl, expandShortUrl, isShopeeUrl,
  cleanShopeeUrl, extractShopItemId,
} from "@/lib/url-processing";

function callShopeeHelper(cookie: string, payload: object): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const scriptPath = path.join(process.cwd(), "shopee_helper.py");
    const proc = spawn(pythonCmd, [scriptPath]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python helper exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(`Invalid JSON: ${stdout.substring(0, 200)}`));
        }
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn python: ${err.message}`));
    });

    proc.stdin.write(JSON.stringify({ cookie, payload }));
    proc.stdin.end();

    setTimeout(() => { proc.kill(); reject(new Error("Timeout")); }, 20000);
  });
}

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
    const result = await callShopeeHelper(cookie, payload) as {
      data?: { batchCustomLink?: Array<{ failCode: number | string; shortLink?: string }> };
      error?: string;
    };

    console.log("[public-custom-link] Shopee response:", JSON.stringify(result).substring(0, 500));

    if (result.error && !result.data) {
      return NextResponse.json({ error: `Lỗi Shopee: ${result.error}` }, { status: 400 });
    }

    if (result?.data?.batchCustomLink?.length && result.data.batchCustomLink.length > 0) {
      const item = result.data.batchCustomLink[0];
      if ((item.failCode === 0 || item.failCode === "0") && item.shortLink) {
        return NextResponse.json({ success: true, short_link: item.shortLink });
      }
      console.error("[public-custom-link] failCode:", item.failCode);
      return NextResponse.json({ error: `Shopee API failCode: ${item.failCode}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Response không đúng format" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[public-custom-link] Exception:", msg);
    return NextResponse.json({ error: `Lỗi kết nối Shopee: ${msg}` }, { status: 500 });
  }
}
