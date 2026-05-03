/**
 * POST /api/analyse
 * Body: { url: string }
 * Returns: PropertyListing (genormaliseerde listing data)
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeListing } from "@/lib/scraper";

const ALLOWED_DOMAINS = [
  "immoweb.be",
  "www.immoweb.be",
  "zimmo.be",
  "www.zimmo.be",
  "realo.be",
  "www.realo.be",
  "era.be",
  "www.era.be",
  "logic-immo.be",
  "www.logic-immo.be",
];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ALLOWED_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// Simpele in-memory rate limiter (vervang door Redis/Upstash in productie)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuut
  const maxRequests = 5;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Te veel aanvragen. Wacht even en probeer opnieuw." },
      { status: 429 }
    );
  }

  // Parse body
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON body" }, { status: 400 });
  }

  const { url } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Geen URL meegegeven" }, { status: 400 });
  }

  // Trim & valideer URL
  const cleanUrl = url.trim();
  if (!isAllowedUrl(cleanUrl)) {
    return NextResponse.json(
      {
        error:
          "Ongeldige URL. Plak een link van Immoweb, Zimmo of Realo.",
        allowedDomains: ALLOWED_DOMAINS,
      },
      { status: 422 }
    );
  }

  try {
    const listing = await scrapeListing(cleanUrl);

    // Geef een 206 terug als data onvolledig is maar niet gefaald
    const hasMinimumData = listing.price !== null || listing.municipality !== null;
    const statusCode = hasMinimumData ? 200 : 206;

    return NextResponse.json(listing, { status: statusCode });
  } catch (err) {
    console.error("[/api/analyse] Fout:", err);
    return NextResponse.json(
      { error: "Interne fout bij het ophalen van de listing." },
      { status: 500 }
    );
  }
}

// GET voor health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    supportedSources: ["immoweb", "zimmo", "realo"],
    version: "1.0.0",
  });
}