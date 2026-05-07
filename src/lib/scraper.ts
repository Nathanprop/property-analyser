/**
 * Property Analyser — Listing Scraper v2
 * Met ScrapingBee integratie voor Immoweb/Zimmo/Realo
 */

import { fetchWithScrapingBee } from "./fetch-with-scrapingbee";

export interface PropertyListing {
  source: "immoweb" | "zimmo" | "realo" | "unknown";
  url: string;
  listingId: string | null;
  price: number | null;
  currency: string;
  street: string | null;
  houseNumber: string | null;
  municipality: string | null;
  postalCode: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  transactionType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: number | null;
  totalArea: number | null;
  buildYear: number | null;
  floors: number | null;
  condition: string | null;
  epcLabel: string | null;
  epcScore: number | null;
  epcReference: string | null;
  heatingType: string | null;
  solarPanels: boolean | null;
  doubleGlazing: boolean | null;
  garden: boolean | null;
  gardenArea: number | null;
  garage: boolean | null;
  terrace: boolean | null;
  terraceArea: number | null;
  elevator: boolean | null;
  pool: boolean | null;
  furnished: boolean | null;
  publishedAt: string | null;
  expiresAt: string | null;
  agencyName: string | null;
  agencyPhone: string | null;
  description: string | null;
  images: string[];
  rawData: Record<string, unknown>;
  fetchedAt: string;
  parseMethod: "json-ld" | "css-selectors" | "mixed";
  warnings: string[];
}

function detectSource(url: string): PropertyListing["source"] {
  if (url.includes("immoweb.be")) return "immoweb";
  if (url.includes("zimmo.be")) return "zimmo";
  if (url.includes("realo.be")) return "realo";
  return "unknown";
}

function extractListingId(url: string, source: PropertyListing["source"]): string | null {
  try {
    if (source === "immoweb") {
      const match = url.match(/\/(\d{7,10})(?:\?|$)/);
      return match?.[1] ?? null;
    }
    if (source === "zimmo") {
      const match = url.match(/\/(\d{4,8})\/?(?:\?|$)/);
      return match?.[1] ?? null;
    }
    if (source === "realo") {
      const match = url.match(/\/(\d{6,10})(?:\?|$)/);
      return match?.[1] ?? null;
    }
  } catch {}
  return null;
}

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
    if (["yes","true","ja","1"].includes(v.toLowerCase())) return true;
    if (["no","false","nee","0"].includes(v.toLowerCase())) return false;
  }
  if (typeof v === "number") return v > 0;
  return null;
}

function toString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function extractEpcFromText(text: string | null): { label: string | null; score: number | null } {
  if (!text) return { label: null, score: null };
  const match = text.match(/EPC(?:\s*-?\s*label)?[:\s]+([A-G][+]?)\s*(?:\((\d+)\))?/i);
  if (!match) return { label: null, score: null };
  return { label: match[1].toUpperCase(), score: match[2] ? parseInt(match[2], 10) : null };
}

function parseImmoweb(html: string, url: string): Partial<PropertyListing> {
  const warnings: string[] = [];
  const jsonLdBlocks = extractJsonLd(html);

  let classified: Record<string, unknown> | null = null;
  const classifiedMatch = html.match(/window\.classified\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
  if (classifiedMatch) {
    try { classified = JSON.parse(classifiedMatch[1]); } catch {}
  }

  let nextData: Record<string, unknown> | null = null;
  const nextMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try { nextData = JSON.parse(nextMatch[1]); } catch {}
  }

  const ldListing = jsonLdBlocks.find(
    (b) => b["@type"] === "RealEstateListing" || b["@type"] === "Apartment" || b["@type"] === "House"
  );

  const src = classified ?? nextData ?? ldListing ?? {};
  const price = toNum(dig(src, "price.mainValue", "price.amount")) ?? toNum(dig(ldListing, "offers.price")) ?? null;
  const location = (dig(src, "property.location", "location") ?? {}) as Record<string, unknown>;
  const municipality = toString(dig(location, "locality", "municipality")) ?? toString(dig(ldListing, "address.addressLocality")) ?? null;
  const postalCode = toString(dig(location, "postalCode", "zip")) ?? toString(dig(ldListing, "address.postalCode")) ?? null;
  const street = toString(dig(location, "street", "streetName")) ?? null;
  const houseNumber = toString(dig(location, "number", "houseNumber")) ?? null;
  const lat = toNum(dig(location, "latitude", "lat")) ?? null;
  const lng = toNum(dig(location, "longitude", "lng", "lon")) ?? null;
  const propertyRaw = (dig(src, "property") ?? {}) as Record<string, unknown>;
  const livingArea = toNum(dig(propertyRaw, "netHabitableSurface", "livingArea", "surface")) ?? null;
  const totalArea = toNum(dig(propertyRaw, "land.surface", "landSurface")) ?? null;
  const bedrooms = toNum(dig(propertyRaw, "bedroomCount", "bedrooms")) ?? null;
  const bathrooms = toNum(dig(propertyRaw, "bathroomCount", "bathrooms")) ?? null;
  const buildYear = toNum(dig(propertyRaw, "building.constructionYear", "buildYear")) ?? null;
  const floors = toNum(dig(propertyRaw, "building.floorCount", "floor")) ?? null;
  const subtype = toString(dig(src, "property.subtype", "property.type", "type")) ?? null;
  const txType = toString(dig(src, "transaction.type", "transactionType")) ?? null;
  const description = toString(dig(src, "property.description", "description")) ?? null;
  const energy = (dig(src, "property.energy", "energy") ?? {}) as Record<string, unknown>;
  const epcFromDesc = extractEpcFromText(description);
  const epcLabel = toString(dig(energy, "epcScore", "label", "energyClass")) ?? epcFromDesc.label ?? null;
  const epcScore = toNum(dig(energy, "primaryEnergyConsumptionPerSqm", "score")) ?? epcFromDesc.score ?? null;
  const epcRef = toString(dig(energy, "epcReference", "reference")) ?? null;
  const heatingType = toString(dig(energy, "heatingType")) ?? null;
  const solar = toBool(dig(energy, "hasPhotovoltaicPanels")) ?? null;
  const glazing = toBool(dig(propertyRaw, "hasDoubleGlazing")) ?? null;
  const garden = toBool(dig(propertyRaw, "hasGarden")) ?? null;
  const gardenArea = toNum(dig(propertyRaw, "gardenSurface")) ?? null;
  const garage = toBool(dig(propertyRaw, "parkingCountIndoor", "hasGarage")) ?? null;
  const terrace = toBool(dig(propertyRaw, "hasTerrace")) ?? null;
  const terraceArea = toNum(dig(propertyRaw, "terraceSurface")) ?? null;
  const elevator = toBool(dig(propertyRaw, "hasLift")) ?? null;
  const pool = toBool(dig(propertyRaw, "hasSwimmingPool")) ?? null;
  const furnished = toBool(dig(src, "transaction.furnished")) ?? null;
  const agency = (dig(src, "customers.0", "agency") ?? {}) as Record<string, unknown>;
  const agencyName = toString(dig(agency, "name")) ?? toString(dig(src, "customers.0.name")) ?? null;
  const agencyPhone = toString(dig(agency, "phone")) ?? null;
  const publishedAt = toString(dig(src, "publication.publicationDate")) ?? null;
  const expiresAt = toString(dig(src, "publication.expirationDate")) ?? null;
  const mediaRaw = dig(src, "media.pictures", "photos");
  const images: string[] = [];
  if (Array.isArray(mediaRaw)) {
    for (const img of mediaRaw.slice(0, 10)) {
      const imgUrl = toString(dig(img, "largeUrl", "mediumUrl", "url"));
      if (imgUrl) images.push(imgUrl);
    }
  }

  if (!price) warnings.push("Prijs niet gevonden");
  if (!municipality) warnings.push("Gemeente niet gevonden");
  if (!livingArea) warnings.push("Oppervlakte niet gevonden");

  return {
    price, currency: "EUR", street, houseNumber, municipality, postalCode, province: null,
    latitude: lat, longitude: lng,
    propertyType: subtype,
    transactionType: txType?.toLowerCase().includes("sale") || txType?.toLowerCase().includes("koop") ? "sale" : "rent",
    bedrooms, bathrooms, livingArea, totalArea, buildYear, floors, condition: null,
    epcLabel, epcScore, epcReference: epcRef, heatingType, solarPanels: solar, doubleGlazing: glazing,
    garden, gardenArea, garage, terrace, terraceArea, elevator, pool, furnished,
    publishedAt, expiresAt, agencyName, agencyPhone, description, images,
    rawData: src as Record<string, unknown>,
    parseMethod: classified ? "json-ld" : "css-selectors",
    warnings,
  };
}

function parseZimmo(html: string, _url: string): Partial<PropertyListing> {
  const warnings: string[] = [];
  const jsonLdBlocks = extractJsonLd(html);
  let nextData: Record<string, unknown> | null = null;
  const nextMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) { try { nextData = JSON.parse(nextMatch[1]); } catch {} }
  const ldListing = jsonLdBlocks.find((b) => ["RealEstateListing","Apartment","House","SingleFamilyResidence"].includes(String(b["@type"])));
  const props = (dig(nextData, "props.pageProps.listing", "props.pageProps.property") ?? {}) as Record<string, unknown>;
  const src = Object.keys(props).length > 0 ? props : ldListing ?? {};
  const price = toNum(dig(src, "price", "askingPrice")) ?? toNum(dig(ldListing, "offers.price")) ?? null;
  const municipality = toString(dig(src, "city", "municipality")) ?? toString(dig(ldListing, "address.addressLocality")) ?? null;
  const postalCode = toString(dig(src, "zip", "postalCode")) ?? toString(dig(ldListing, "address.postalCode")) ?? null;
  const livingArea = toNum(dig(src, "area", "livingArea")) ?? null;
  const bedrooms = toNum(dig(src, "bedrooms", "bedroomCount")) ?? null;
  const buildYear = toNum(dig(src, "constructionYear", "buildYear")) ?? null;
  const epcLabel = toString(dig(src, "energyLabel", "epcLabel")) ?? null;
  const epcScore = toNum(dig(src, "epcScore", "primaryEnergy")) ?? null;
  if (!price) warnings.push("Prijs niet gevonden");
  if (!municipality) warnings.push("Gemeente niet gevonden");
  return {
    price, currency: "EUR", street: null, houseNumber: null, municipality, postalCode, province: null,
    latitude: toNum(dig(src, "lat", "latitude")) ?? null,
    longitude: toNum(dig(src, "lng", "longitude")) ?? null,
    propertyType: toString(dig(src, "type", "propertyType")) ?? null,
    transactionType: null, bedrooms, bathrooms: null, livingArea, totalArea: null,
    buildYear, floors: null, condition: null, epcLabel, epcScore, epcReference: null,
    heatingType: null, solarPanels: null, doubleGlazing: null, garden: null, gardenArea: null,
    garage: null, terrace: null, terraceArea: null, elevator: null, pool: null, furnished: null,
    publishedAt: null, expiresAt: null,
    agencyName: toString(dig(src, "agency.name")) ?? null,
    agencyPhone: null, description: toString(dig(src, "description")) ?? null,
    images: [], rawData: src as Record<string, unknown>,
    parseMethod: nextData ? "json-ld" : "css-selectors", warnings,
  };
}

export async function scrapeListing(url: string): Promise<PropertyListing> {
  const source = detectSource(url);
  const listingId = extractListingId(url, source);
  const fetchedAt = new Date().toISOString();

  let html = "";
  let fetchError: string | null = null;

  try {
    // Gebruik ScrapingBee wrapper — werkt voor Immoweb, Zimmo, Realo
    html = await fetchWithScrapingBee(url);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  if (fetchError || html.length < 1000) {
    return {
      source, url, listingId, price: null, currency: "EUR",
      street: null, houseNumber: null, municipality: null, postalCode: null,
      province: null, latitude: null, longitude: null, propertyType: null, transactionType: null,
      bedrooms: null, bathrooms: null, livingArea: null, totalArea: null, buildYear: null,
      floors: null, condition: null, epcLabel: null, epcScore: null, epcReference: null,
      heatingType: null, solarPanels: null, doubleGlazing: null, garden: null, gardenArea: null,
      garage: null, terrace: null, terraceArea: null, elevator: null, pool: null, furnished: null,
      publishedAt: null, expiresAt: null, agencyName: null, agencyPhone: null, description: null,
      images: [], rawData: {}, fetchedAt, parseMethod: "json-ld",
      warnings: [fetchError ?? "HTML te kort — mogelijk geblokkeerd"],
    };
  }

  let parsed: Partial<PropertyListing>;
  switch (source) {
    case "immoweb": parsed = parseImmoweb(html, url); break;
    case "zimmo":   parsed = parseZimmo(html, url);   break;
    default:
      const blocks = extractJsonLd(html);
      const ld = blocks.find((b) => ["RealEstateListing","Apartment","House"].includes(String(b["@type"])));
      parsed = {
        price: toNum(dig(ld, "offers.price")) ?? null,
        municipality: toString(dig(ld, "address.addressLocality")) ?? null,
        postalCode: toString(dig(ld, "address.postalCode")) ?? null,
        rawData: ld ?? {}, parseMethod: "json-ld",
        warnings: ["Onbekende bron — beperkte data"],
      };
  }

  return {
    source, url, listingId, fetchedAt,
    price: null, currency: "EUR", street: null, houseNumber: null, municipality: null,
    postalCode: null, province: null, latitude: null, longitude: null, propertyType: null,
    transactionType: null, bedrooms: null, bathrooms: null, livingArea: null, totalArea: null,
    buildYear: null, floors: null, condition: null, epcLabel: null, epcScore: null,
    epcReference: null, heatingType: null, solarPanels: null, doubleGlazing: null, garden: null,
    gardenArea: null, garage: null, terrace: null, terraceArea: null, elevator: null, pool: null,
    furnished: null, publishedAt: null, expiresAt: null, agencyName: null, agencyPhone: null,
    description: null, images: [], rawData: {}, parseMethod: "json-ld", warnings: [],
    ...parsed,
  };
}
