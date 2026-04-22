import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeFileName(rawName) {
  const baseName = String(rawName || "RTC_CLEARANCE")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  const normalized = baseName || "RTC_CLEARANCE";
  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}

export async function POST(request) {
  let browser;

  try {
    const requestUrl = new URL(request.url);
    const fileName = getSafeFileName(requestUrl.searchParams.get("fileName"));
    const html = await request.text();

    if (!html || !String(html).trim()) {
      return new NextResponse("Missing HTML payload for PDF export.", { status: 400 });
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(String(html), {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 30_000
    });

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      }
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("[PDF export] Server PDF generation failed:", error);
    return new NextResponse("Failed to generate PDF on server.", { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
