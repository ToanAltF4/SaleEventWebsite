import { NextRequest, NextResponse } from "next/server";
import { getSetting, addHistory } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { extractUrlsFromText, processSingleUrl, createShortUrl } from "@/lib/url-processing";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadVerifyPrompt(): string {
  const promptPath = path.join(process.cwd(), "verify_prompt.txt");
  return fs.readFileSync(promptPath, "utf-8");
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập nội dung tin nhắn" }, { status: 400 });
  }

  const affiliateId = await getSetting("affiliate_id", "");
  if (!affiliateId) {
    return NextResponse.json({ error: "Vui lòng cài đặt Affiliate ID trước" }, { status: 400 });
  }

  const urls = extractUrlsFromText(message);

  // Tạo affiliate URL → short URL TRƯỚC khi gửi cho AI
  const shortMapping: Record<string, string> = {};
  for (const url of urls) {
    const [affUrl] = await processSingleUrl(url, affiliateId);
    if (affUrl) {
      const shortUrl = await createShortUrl(affUrl, user);
      shortMapping[url] = shortUrl;
    }
  }

  const mappingText = Object.keys(shortMapping).length > 0
    ? Object.entries(shortMapping).map(([orig, short]) => `- ${orig} -> ${short}`).join("\n")
    : "(Không có link Shopee cần chuyển đổi. Giữ nguyên tất cả link trong tin nhắn.)";

  const promptTemplate = loadVerifyPrompt();
  const prompt = promptTemplate
    .replace("{original_message}", message)
    .replace("{link_mapping}", mappingText);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const converted = response.choices[0].message.content?.trim() || "";

    await addHistory(message, converted);

    return NextResponse.json({
      success: true,
      original: message,
      converted,
      links_found: urls.length,
      links_converted: Object.keys(shortMapping).length,
      mapping: shortMapping,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Lỗi OpenAI: ${msg}` }, { status: 500 });
  }
}
