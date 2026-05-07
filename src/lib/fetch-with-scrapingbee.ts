const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SCRAPINGBEE_BASE = "https://app.scrapingbee.com/api/v1/";

// Immoweb vereist JS-rendering; Zimmo en Realo ook.
const JS_RENDER_DOMAINS = ["immoweb.be", "zimmo.be", "realo.be"];

function needsJsRender(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return JS_RENDER_DOMAINS.includes(hostname);
  } catch {
    return false;
  }
}

export async function fetchWithScrapingBee(url: string): Promise<string> {
  if (!SCRAPINGBEE_API_KEY) {
    throw new Error("SCRAPINGBEE_API_KEY is niet ingesteld in .env.local");
  }

  const params = new URLSearchParams({
    api_key: SCRAPINGBEE_API_KEY,
    url,
    render_js: needsJsRender(url) ? "true" : "false",
    premium_proxy: "true",   // Immoweb/Zimmo blokkeren gewone proxies
    country_code: "be",
    wait: "2000",            // wacht 2s zodat JS volledig laadt
  });

  const response = await fetch(`${SCRAPINGBEE_BASE}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee fout ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.text();
}
