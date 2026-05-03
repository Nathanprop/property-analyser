/**
 * Property Analyser — Listing Scraper
 * Supports: Immoweb, Zimmo, Realo
 *
 * Strategie:
 *  1. Fetch HTML met spoofed browser headers
 *  2. Extract JSON-LD structured data (snel & clean)
 *  3. Fallback: CSS-selector parsing van de HTML
 *  4. Normaliseer naar één PropertyListing interface
 */

export interface PropertyListing {
  // Bron
  source: "immoweb" | "zimmo" | "realo" | "unknown";
  url: string;
  listingId: string | null;

  // Prijs
  price: number | null;
  currency: string;

  // Locatie
  street: string | null;
  houseNumber: string | null;
  municipality: string | null;
  postalCode: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;

  // Pand
  propertyType: string | null; // "house" | "apartment" | "land" | ...
  transactionType: string | null; // "sale" | "rent"
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: number | null; // m²
  totalArea: number | null; // m² (perceel)
  buildYear: number | null;
  floors: number | null;
  condition: string | null;

  // Energie
  epcLabel: string | null; // A, B, C, D, E, F, G
  epcScore: number | null; // kWh/m²/jaar
  epcReference: string | null;
  heatingType: string | null;
  solarPanels: boolean | null;
  doubleGlazing: boolean | null;

  // Extra
  garden: boolean | null;
  gardenArea: number | null;
  garage: boolean | null;
  terrace: boolean | null;
  terraceArea: number | null;
  elevator: boolean | null;
  pool: boolean | null;
  furnished: boolean | null;

  // Publicatie
  publishedAt: string | null;
  expiresAt: string | null;
  agencyName: string | null;
  agencyPhone: string | null;
  description: string | null;
  images: string[];

  // Intern
  rawData: Record<string, unknown>;
  fetchedAt: string;
  parseMethod: "json-ld" | "css-selectors" | "mixed";
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────

function detectSource(url: string): PropertyListing["source"] {
  if (url.includes("immoweb.be")) return "immoweb";
  if (url.includes("zimmo.be")) return "zimmo";
  if (url.includes("realo.be")) return "realo";
  return "unknown";
}

function extractListingId(url: string, source: PropertyListing["source"]): string | null {
  try {
    if (source === "immoweb") {
      // https://www.immoweb.be/nl/zoekertje/appartement/te-koop/gent/9000/12345678
      const match = url.match(/\/(\d{7,10})(?:\?|$)/);
      return match?.[1] ?? null;
    }
    if (source === "zimmo") {
      // https://www.zimmo.be/nl/gent-9000/te-koop/appartement/12345/
      const match = url.match(/\/(\d{4,8})\/?(?:\?|$)/);
      return match?.[1] ?? null;
    }
    if (source === "realo") {
      // https://realo.be/nl/te-koop/.../12345678
      const match = url.match(/\/(\d{6,10})(?:\?|$)/);
      return match?.[1] ?? null;
    }
  } catch {}
  return null;
}

/** Geeft een set van browser-achtige headers terug */
function getBrowserHeaders(): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8,fr;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Referer": "https://www.google.be/",
  };
}

/** Extraheer alle JSON-LD blokken uit HTML */
function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch {}
  }
  return results;
}

/** Zoek een waarde in een genest object via dot-path */
function dig(obj: unknown, ...paths: string[]): unknown {
  for (const path of paths) {
    let current: unknown = obj;
    for (const key of path.split(".")) {
      if (current == null || typeof current !== "object") { current = undefined; break; }
      current = (current as Record<string, unknown>)[key];
    }
    if (current !== undefined && current !== null) return current;
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.,]/g, "").replace(",", ".")) : Number(v);
  return isNaN(n) ? null : n;
}

function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const l = v.toLowerCase();
    if (["yes", "true", "ja", "1", "aanwezig"].includes(l)) return true;
    if (["no", "false", "nee", "0", "niet aanwezig"].includes(l)) return false;
  }
  return null;
}

function toString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

// ─── Immoweb parser ───────────────────────────────────────────────

function parseImmoweb(html: string, url: string): Partial<PropertyListing> {
  const warnings: string[] = [];
  const jsonLdBlocks = extractJsonLd(html);

  // Immoweb embeds een groot "window.classified" object in een <script> tag
  // Dit is rijker dan JSON-LD
  let classified: Record<string, unknown> | null = null;
  const classifiedMatch = html.match(/window\.classified\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
  if (classifiedMatch) {
    try { classified = JSON.parse(classifiedMatch[1]); } catch {}
  }

  // Fallback: zoek in een __NEXT_DATA__ of dataLayer
  let nextData: Record<string, unknown> | null = null;
  const nextMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try { nextData = JSON.parse(nextMatch[1]); } catch {}
  }

  // Probeer het JSON-LD RealEstateListing object
  const ldListing = jsonLdBlocks.find(
    (b) => b["@type"] === "RealEstateListing" || b["@type"] === "Apartment" || b["@type"] === "House"
  );

  // Combineer alle bronnen, meest specifiek eerst
  const src = classified ?? nextData ?? ldListing ?? {};

  // Prijs
  const price =
    toNum(dig(src, "price", "mainValue", "price.amount", "offers.price")) ??
    toNum(dig(ldListing, "offers.price", "price"));

  // Locatie
  const location = (dig(src, "property.location", "location") ?? {}) as Record<string, unknown>;
  const municipality =
    toString(dig(location, "locality", "municipality")) ??
    toString(dig(src, "property.location.locality"));
  const postalCode =
    toString(dig(location, "postalCode", "zip")) ??
    toString(dig(src, "property.location.postalCode"));
  const street = toString(dig(location, "street", "streetName")) ?? null;
  const houseNumber = toString(dig(location, "number", "houseNumber")) ?? null;
  const lat = toNum(dig(location, "latitude", "lat")) ?? toNum(dig(src, "latitude"));
  const lng = toNum(dig(location, "longitude", "lng", "lon")) ?? toNum(dig(src, "longitude"));

  // Pand details
  const propertyRaw = (dig(src, "property") ?? {}) as Record<string, unknown>;
  const livingArea =
    toNum(dig(propertyRaw, "netHabitableSurface", "livingArea", "surface")) ??
    toNum(dig(src, "property.netHabitableSurface"));
  const totalArea = toNum(dig(propertyRaw, "land.surface", "landSurface", "totalArea")) ?? null;
  const bedrooms = toNum(dig(propertyRaw, "bedroomCount", "bedrooms")) ?? null;
  const bathrooms = toNum(dig(propertyRaw, "bathroomCount", "bathrooms")) ?? null;
  const buildYear = toNum(dig(propertyRaw, "building.constructionYear", "buildYear", "constructionYear")) ?? null;
  const floors = toNum(dig(propertyRaw, "building.floorCount", "floor", "floors")) ?? null;

  // Type
  const subtype = toString(dig(src, "property.subtype", "property.type", "type")) ?? null;
  const txType = toString(dig(src, "transaction.type", "transactionType")) ?? null;

  // Energie
  const energy = (dig(src, "property.energy", "energy") ?? {}) as Record<string, unknown>;
  const epcLabel = toString(dig(energy, "epcScore", "label", "energyClass")) ?? null;
  const epcScore = toNum(dig(energy, "primaryEnergyConsumptionPerSqm", "score", "value")) ?? null;
  const epcRef = toString(dig(energy, "epcReference", "reference")) ?? null;
  const heatingType = toString(dig(energy, "heatingType")) ?? null;
  const solar = toBool(dig(energy, "hasPhotovoltaicPanels", "solarPanels")) ?? null;
  const glazing = toBool(dig(propertyRaw, "hasDoubleGlazing", "doubleGlazing")) ?? null;

  // Extra
  const garden = toBool(dig(propertyRaw, "hasGarden", "garden")) ?? null;
  const gardenArea = toNum(dig(propertyRaw, "gardenSurface", "gardenArea")) ?? null;
  const garage = toBool(dig(propertyRaw, "parkingCountIndoor", "hasGarage", "garage")) ?? null;
  const terrace = toBool(dig(propertyRaw, "hasTerrace", "terrace")) ?? null;
  const terraceArea = toNum(dig(propertyRaw, "terraceSurface", "terraceArea")) ?? null;
  const elevator = toBool(dig(propertyRaw, "hasLift", "elevator", "lift")) ?? null;
  const pool = toBool(dig(propertyRaw, "hasSwimmingPool", "pool")) ?? null;
  const furnished = toBool(dig(src, "transaction.furnished", "furnished")) ?? null;

  // Agency
  const agency = (dig(src, "customers.0", "agency") ?? {}) as Record<string, unknown>;
  const agencyName = toString(dig(agency, "name")) ?? toString(dig(src, "customers.0.name")) ?? null;
  const agencyPhone = toString(dig(agency, "phone")) ?? null;

  // Publicatie
  const publishedAt = toString(dig(src, "publication.publicationDate", "publishedAt")) ?? null;
  const expiresAt = toString(dig(src, "publication.expirationDate", "expiresAt")) ?? null;

  // Beschrijving
  const description = toString(dig(src, "property.description", "description")) ?? null;

  // Afbeeldingen
  const mediaRaw = dig(src, "media.pictures", "photos", "images");
  const images: string[] = [];
  if (Array.isArray(mediaRaw)) {
    for (const img of mediaRaw.slice(0, 10)) {
      const imgUrl = toString(dig(img, "largeUrl", "mediumUrl", "smallUrl", "url", "src"));
      if (imgUrl) images.push(imgUrl);
    }
  }

  if (!price) warnings.push("Prijs niet gevonden");
  if (!municipality) warnings.push("Gemeente niet gevonden");
  if (!livingArea) warnings.push("Bewoonbare oppervlakte niet gevonden");

  return {
    price,
    currency: "EUR",
    street,
    houseNumber,
    municipality,
    postalCode,
    province: null,
    latitude: lat,
    longitude: lng,
    propertyType: subtype,
    transactionType: txType?.toLowerCase().includes("sale") || txType?.toLowerCase().includes("koop") ? "sale" : txType?.toLowerCase().includes("rent") || txType?.toLowerCase().includes("huur") ? "rent" : null,
    bedrooms,
    bathrooms,
    livingArea,
    totalArea,
    buildYear,
    floors,
    condition: null,
    epcLabel,
    epcScore,
    epcReference: epcRef,
    heatingType,
    solarPanels: solar,
    doubleGlazing: glazing,
    garden,
    gardenArea,
    garage,
    terrace,
    terraceArea,
    elevator,
    pool,
    furnished,
    publishedAt,
    expiresAt,
    agencyName,
    agencyPhone,
    description,
    images,
    rawData: src,
    parseMethod: classified ? "json-ld" : "css-selectors",
    warnings,
  };
}

// ─── Zimmo parser ─────────────────────────────────────────────────

function parseZimmo(html: string, _url: string): Partial<PropertyListing> {
  const warnings: string[] = [];
  const jsonLdBlocks = extractJsonLd(html);

  // Zimmo gebruikt JSON-LD + een __NEXT_DATA__ block
  let nextData: Record<string, unknown> | null = null;
  const nextMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try { nextData = JSON.parse(nextMatch[1]); } catch {}
  }

  const ldListing = jsonLdBlocks.find((b) =>
    ["RealEstateListing", "Apartment", "House", "SingleFamilyResidence"].includes(String(b["@type"]))
  );

  // Probeer de pageProps te bereiken via nextData
  const props = (dig(nextData, "props.pageProps.listing", "props.pageProps.property") ?? {}) as Record<string, unknown>;
  const src = Object.keys(props).length > 0 ? props : ldListing ?? {};

  const price =
    toNum(dig(src, "price", "askingPrice", "offers.price")) ??
    toNum(dig(ldListing, "offers.price")) ?? null;

  const municipality =
    toString(dig(src, "city", "municipality", "location.city")) ??
    toString(dig(ldListing, "address.addressLocality")) ?? null;
  const postalCode =
    toString(dig(src, "zip", "postalCode", "location.zip")) ??
    toString(dig(ldListing, "address.postalCode")) ?? null;
  const street =
    toString(dig(src, "street", "streetName", "location.street")) ??
    toString(dig(ldListing, "address.streetAddress")) ?? null;

  const livingArea = toNum(dig(src, "area", "livingArea", "netHabitableSurface")) ?? null;
  const totalArea = toNum(dig(src, "landArea", "plotArea", "land.area")) ?? null;
  const bedrooms = toNum(dig(src, "bedrooms", "bedroomCount")) ?? null;
  const buildYear = toNum(dig(src, "constructionYear", "buildYear")) ?? null;
  const epcLabel = toString(dig(src, "energyLabel", "epcLabel", "epc")) ?? null;
  const epcScore = toNum(dig(src, "epcScore", "energyScore", "primaryEnergy")) ?? null;

  const images: string[] = [];
  const imgs = dig(src, "images", "photos", "media");
  if (Array.isArray(imgs)) {
    for (const img of imgs.slice(0, 10)) {
      const u = toString(dig(img, "url", "src", "large", "medium"));
      if (u) images.push(u);
    }
  }

  if (!price) warnings.push("Prijs niet gevonden");
  if (!municipality) warnings.push("Gemeente niet gevonden");

  return {
    price, currency: "EUR",
    street, houseNumber: null, municipality, postalCode, province: null,
    latitude: toNum(dig(src, "lat", "latitude")) ?? null,
    longitude: toNum(dig(src, "lng", "lon", "longitude")) ?? null,
    propertyType: toString(dig(src, "type", "propertyType")) ?? null,
    transactionType: null,
    bedrooms, bathrooms: null, livingArea, totalArea, buildYear, floors: null, condition: null,
    epcLabel, epcScore, epcReference: null, heatingType: null, solarPanels: null, doubleGlazing: null,
    garden: null, gardenArea: null, garage: null, terrace: null, terraceArea: null,
    elevator: null, pool: null, furnished: null,
    publishedAt: null, expiresAt: null,
    agencyName: toString(dig(src, "agency.name", "agencyName")) ?? null,
    agencyPhone: null, description: toString(dig(src, "description")) ?? null,
    images, rawData: src as Record<string, unknown>,
    parseMethod: nextData ? "json-ld" : "css-selectors",
    warnings,
  };
}

// ─── Realo parser ─────────────────────────────────────────────────

function parseRealo(html: string, _url: string): Partial<PropertyListing> {
  const warnings: string[] = [];
  const jsonLdBlocks = extractJsonLd(html);

  const ldListing = jsonLdBlocks.find((b) =>
    ["RealEstateListing", "Apartment", "House"].includes(String(b["@type"]))
  );

  let appState: Record<string, unknown> | null = null;
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
  if (stateMatch) {
    try { appState = JSON.parse(stateMatch[1]); } catch {}
  }

  const src = appState ?? ldListing ?? {};

  const price =
    toNum(dig(src, "listing.price", "property.price", "offers.price")) ??
    toNum(dig(ldListing, "offers.price")) ?? null;

  const municipality =
    toString(dig(src, "listing.municipality", "property.location.municipality")) ??
    toString(dig(ldListing, "address.addressLocality")) ?? null;
  const postalCode =
    toString(dig(src, "listing.postalCode", "property.location.postalCode")) ??
    toString(dig(ldListing, "address.postalCode")) ?? null;

  const livingArea = toNum(dig(src, "listing.livingArea", "property.area")) ?? null;
  const bedrooms = toNum(dig(src, "listing.bedrooms", "property.bedrooms")) ?? null;
  const epcLabel = toString(dig(src, "listing.epcLabel", "property.epc")) ?? null;

  if (!price) warnings.push("Prijs niet gevonden");
  if (!municipality) warnings.push("Gemeente niet gevonden");

  return {
    price, currency: "EUR",
    street: null, houseNumber: null, municipality, postalCode, province: null,
    latitude: null, longitude: null,
    propertyType: toString(dig(src, "listing.type", "property.type")) ?? null,
    transactionType: null,
    bedrooms, bathrooms: null, livingArea, totalArea: null, buildYear: null,
    floors: null, condition: null,
    epcLabel, epcScore: null, epcReference: null, heatingType: null,
    solarPanels: null, doubleGlazing: null,
    garden: null, gardenArea: null, garage: null, terrace: null, terraceArea: null,
    elevator: null, pool: null, furnished: null,
    publishedAt: null, expiresAt: null,
    agencyName: null, agencyPhone: null,
    description: toString(dig(src, "listing.description")) ?? null,
    images: [], rawData: src as Record<string, unknown>,
    parseMethod: appState ? "mixed" : "json-ld",
    warnings,
  };
}

// ─── Hoofd scraper functie ────────────────────────────────────────

export async function scrapeListing(url: string): Promise<PropertyListing> {
  const source = detectSource(url);
  const listingId = extractListingId(url, source);
  const fetchedAt = new Date().toISOString();

  let html = "";
  let fetchError: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: getBrowserHeaders(),
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      fetchError = `HTTP ${response.status}: ${response.statusText}`;
    } else {
      html = await response.text();
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  if (fetchError || html.length < 1000) {
    return {
      source, url, listingId,
      price: null, currency: "EUR",
      street: null, houseNumber: null, municipality: null, postalCode: null,
      province: null, latitude: null, longitude: null,
      propertyType: null, transactionType: null,
      bedrooms: null, bathrooms: null, livingArea: null, totalArea: null,
      buildYear: null, floors: null, condition: null,
      epcLabel: null, epcScore: null, epcReference: null, heatingType: null,
      solarPanels: null, doubleGlazing: null,
      garden: null, gardenArea: null, garage: null, terrace: null, terraceArea: null,
      elevator: null, pool: null, furnished: null,
      publishedAt: null, expiresAt: null,
      agencyName: null, agencyPhone: null, description: null, images: [],
      rawData: {}, fetchedAt, parseMethod: "json-ld",
      warnings: [fetchError ?? "HTML te kort — mogelijk geblokkeerd"],
    };
  }

  let parsed: Partial<PropertyListing>;

  switch (source) {
    case "immoweb": parsed = parseImmoweb(html, url); break;
    case "zimmo":   parsed = parseZimmo(html, url);   break;
    case "realo":   parsed = parseRealo(html, url);   break;
    default:
      // Generic fallback: probeer JSON-LD
      const blocks = extractJsonLd(html);
      const ld = blocks.find((b) => ["RealEstateListing","Apartment","House"].includes(String(b["@type"])));
      parsed = {
        price: toNum(dig(ld, "offers.price")) ?? null,
        municipality: toString(dig(ld, "address.addressLocality")) ?? null,
        postalCode: toString(dig(ld, "address.postalCode")) ?? null,
        rawData: ld ?? {},
        parseMethod: "json-ld",
        warnings: ["Onbekende bron — beperkte data"],
      };
  }

  return {
    source, url, listingId, fetchedAt,
    // Defaults
    price: null, currency: "EUR",
    street: null, houseNumber: null, municipality: null, postalCode: null,
    province: null, latitude: null, longitude: null,
    propertyType: null, transactionType: null,
    bedrooms: null, bathrooms: null, livingArea: null, totalArea: null,
    buildYear: null, floors: null, condition: null,
    epcLabel: null, epcScore: null, epcReference: null, heatingType: null,
    solarPanels: null, doubleGlazing: null,
    garden: null, gardenArea: null, garage: null, terrace: null, terraceArea: null,
    elevator: null, pool: null, furnished: null,
    publishedAt: null, expiresAt: null,
    agencyName: null, agencyPhone: null, description: null, images: [],
    rawData: {}, parseMethod: "json-ld", warnings: [],
    // Override met geparsede data
    ...parsed,
  };
}