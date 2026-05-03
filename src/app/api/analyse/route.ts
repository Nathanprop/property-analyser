import { NextRequest, NextResponse } from "next/server";
import { scrapeListing } from "@/lib/scraper";
import { analyseerPrijs } from "@/lib/price-analysis";

const ALLOWED_DOMAINS = ["immoweb.be","www.immoweb.be","zimmo.be","www.zimmo.be","realo.be","www.realo.be"];

function isAllowedUrl(raw: string): boolean {
  try { const u = new URL(raw); return ALLOWED_DOMAINS.some((d) => u.hostname === d); } catch { return false; }
}

const rl = new Map<string, { count: number; resetAt: number }>();
function checkRL(ip: string): boolean {
  const now = Date.now(); const e = rl.get(ip);
  if (!e || now > e.resetAt) { rl.set(ip, { count: 1, resetAt: now + 60000 }); return true; }
  if (e.count >= 10) return false; e.count++; return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRL(ip)) return NextResponse.json({ error: "Te veel aanvragen." }, { status: 429 });
  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ongeldige body" }, { status: 400 }); }
  const { url } = body;
  if (!url) return NextResponse.json({ error: "Geen URL" }, { status: 400 });
  if (!isAllowedUrl(url.trim())) return NextResponse.json({ error: "Ongeldige URL" }, { status: 422 });
  try {
    const listing = await scrapeListing(url.trim());
    const prijsAnalyse = analyseerPrijs(listing);
    return NextResponse.json({ listing, analyse: { prijs: prijsAnalyse }, meta: { analyseVersie: "1.1.0", analyseTimestamp: new Date().toISOString() } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Interne fout." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", supportedSources: ["immoweb","zimmo","realo"], modules: ["scraper","prijsanalyse"], version: "1.1.0" });
}
