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
    return NextResponse.json({ error: "Vui long nhap noi dung tin nhan" }, { status: 400 });
  }

  const affiliateId = await getSetting("affiliate_id", "");
  if (!affiliateId) {
    return NextResponse.json({ error: "Vui long cai dat Affiliate ID truoc" }, { status: 400 });
  }

  const urls = extractUrlsFromText(message);

  const linkMapping: Record<string, string> = {};
  for (const url of urls) {
    const [affUrl] = await processSingleUrl(url, affiliateId);
    if (affUrl) linkMapping[url] = affUrl;
  }

  const mappingText = Object.keys(linkMapping).length > 0
    ? Object.entries(linkMapping).map(([orig, aff]) => `- ${orig} -> ${aff}`).join("\n")
    : "(Khong co link Shopee can chuyen doi. Giu nguyen tat ca link trong tin nhan.)";

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

    let converted = response.choices[0].message.content?.trim() || "";

    // Replace affiliate URLs with short URLs
    const shortMapping: Record<string, string> = {};
    for (const [orig, aff] of Object.entries(linkMapping)) {
      const shortUrl = await createShortUrl(aff, user);
      shortMapping[orig] = shortUrl;
      converted = converted.split(aff).join(shortUrl);
    }

    await addHistory(message, converted);

    return NextResponse.json({
      success: true,
      original: message,
      converted,
      links_found: urls.length,
      links_converted: Object.keys(linkMapping).length,
      mapping: shortMapping,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Loi OpenAI: ${msg}` }, { status: 500 });
  }
}
