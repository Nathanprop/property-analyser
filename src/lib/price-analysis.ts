/**
 * Property Analyser — Prijsanalyse engine
 *
 * Neemt een PropertyListing en geeft een volledig prijsoordeel terug:
 * - Is de prijs correct, te hoog of te laag?
 * - Hoeveel % verschil met de markt?
 * - Wat is de marktconforme prijs?
 * - Welke factoren beïnvloeden de prijs?
 */

import { PropertyListing } from "./scraper";
import { getMarketData, getRelevantPricePerSqm, EPC_CORRECTION } from "./market-data";

// ── Types ─────────────────────────────────────────────────────────

export type PrijsOordeel = "sterk_ondergewaardeerd" | "ondergewaardeerd" | "marktconform" | "licht_overgewaardeerd" | "overgewaardeerd" | "sterk_overgewaardeerd";

export interface PrijsFactor {
  naam: string;
  impact: "positief" | "negatief" | "neutraal";
  beschrijving: string;
  correctie: number; // % bijstelling
}

export interface PrijsAnalyse {
  // Kernresultaat
  oordeel: PrijsOordeel;
  oordeelLabel: string;          // Leesbare tekst
  oordeelKleur: "groen" | "oranje" | "rood";
  verschilPercent: number;       // + = te duur, - = te goedkoop
  verschilBedrag: number;        // in €

  // Prijzen
  vraagprijs: number;
  marktconformePrijs: number;    // onze schatting
  minimumPrijs: number;          // ondergrens bandbreedte
  maximumPrijs: number;          // bovengrens bandbreedte
  prijsPerM2: number | null;     // vraagprijs/m²
  marktPrijsPerM2: number;       // marktgemiddelde €/m²

  // Context
  gemeente: string;
  betrouwbaarheid: "hoog" | "midden" | "laag";
  aantalTransacties: number;

  // EPC impact
  epcLabel: string | null;
  epcImpact: number;             // % prijsimpact van EPC
  epcBedrag: number;             // € impact van EPC

  // Factoren
  factoren: PrijsFactor[];

  // Advies
  advies: string;
  biedingsadvies: string | null; // concreet biedingsbedrag
  biedingsbandbreedte: {
    min: number;
    max: number;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────

function getOordeel(verschilPct: number): {
  oordeel: PrijsOordeel;
  label: string;
  kleur: "groen" | "oranje" | "rood";
} {
  if (verschilPct <= -15) return { oordeel: "sterk_ondergewaardeerd", label: "Sterk ondergewaardeerd — uitstekende koopkans", kleur: "groen" };
  if (verschilPct <= -5)  return { oordeel: "ondergewaardeerd",       label: "Ondergewaardeerd — goeie deal",                  kleur: "groen" };
  if (verschilPct <= 5)   return { oordeel: "marktconform",           label: "Marktconform geprijsd",                          kleur: "groen" };
  if (verschilPct <= 15)  return { oordeel: "licht_overgewaardeerd",  label: "Licht overgewaardeerd — onderhandelen loont",    kleur: "oranje" };
  if (verschilPct <= 25)  return { oordeel: "overgewaardeerd",        label: "Overgewaardeerd — prijs is te hoog",             kleur: "rood" };
  return                          { oordeel: "sterk_overgewaardeerd", label: "Sterk overgewaardeerd — niet betalen",           kleur: "rood" };
}

function round(n: number, decimals = 0): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function roundTo1000(n: number): number {
  return Math.round(n / 1000) * 1000;
}

// ── Hoofd analyse functie ─────────────────────────────────────────

export function analyseerPrijs(listing: PropertyListing): PrijsAnalyse | null {
  // We hebben minstens prijs en gemeente nodig
  if (!listing.price || listing.price < 10000) return null;

  // 1. Marktdata ophalen
  const markt = getMarketData(listing.postalCode, listing.municipality, listing.province);
  const marktPrijsPerM2 = getRelevantPricePerSqm(markt, listing.propertyType);

  // 2. Basisprijsbepaling
  const factoren: PrijsFactor[] = [];
  let correctieFactor = 1.0;

  // Factor: EPC
  const epcLabel = listing.epcLabel?.toUpperCase().replace(/[^A-G+]/g, "") ?? null;
  const epcCorrectie = epcLabel ? (EPC_CORRECTION[epcLabel] ?? 0) : 0;
  if (epcLabel) {
    factoren.push({
      naam: `EPC ${epcLabel}`,
      impact: epcCorrectie >= 0 ? "positief" : "negatief",
      beschrijving: epcCorrectie >= 0
        ? `Goede energiescore — verhoogt de marktwaarde met ca. ${Math.abs(round(epcCorrectie * 100, 0))}%`
        : `Slechte energiescore — verlaagt de marktwaarde met ca. ${Math.abs(round(epcCorrectie * 100, 0))}% (renovatieplicht!)`,
      correctie: round(epcCorrectie * 100, 1),
    });
    correctieFactor += epcCorrectie;
  }

  // Factor: Tuin
  if (listing.garden && listing.gardenArea) {
    const tuinBonus = listing.gardenArea > 500 ? 0.05 : listing.gardenArea > 200 ? 0.03 : 0.01;
    factoren.push({
      naam: `Tuin (${listing.gardenArea} m²)`,
      impact: "positief",
      beschrijving: `Tuin van ${listing.gardenArea} m² verhoogt de waarde`,
      correctie: round(tuinBonus * 100, 1),
    });
    correctieFactor += tuinBonus;
  }

  // Factor: Bouwjaar
  if (listing.buildYear) {
    const leeftijd = new Date().getFullYear() - listing.buildYear;
    if (leeftijd > 40) {
      factoren.push({
        naam: `Bouwjaar ${listing.buildYear}`,
        impact: "negatief",
        beschrijving: `Woning is ${leeftijd} jaar oud — mogelijke renovatiekosten`,
        correctie: -3,
      });
      correctieFactor -= 0.03;
    } else if (leeftijd < 10) {
      factoren.push({
        naam: `Nieuwbouw (${listing.buildYear})`,
        impact: "positief",
        beschrijving: "Recent gebouwd — lagere onderhoudskosten",
        correctie: 5,
      });
      correctieFactor += 0.05;
    }
  }

  // Factor: Garage
  if (listing.garage) {
    factoren.push({
      naam: "Garage aanwezig",
      impact: "positief",
      beschrijving: "Garage verhoogt de waarde en verhuurbaarheid",
      correctie: 2,
    });
    correctieFactor += 0.02;
  }

  // Factor: Verdieping (appartementen)
  if (listing.floors && listing.floors > 5) {
    factoren.push({
      naam: `Verdieping ${listing.floors}`,
      impact: "positief",
      beschrijving: "Hoge verdieping = meer licht en uitzicht",
      correctie: 2,
    });
    correctieFactor += 0.02;
  }

  // 3. Marktconforme prijs berekenen
  let marktconformePrijs: number;

  if (listing.livingArea && listing.livingArea > 0) {
    // We hebben oppervlakte: gebruik €/m² berekening
    const basisPrijs = listing.livingArea * marktPrijsPerM2;
    marktconformePrijs = round(basisPrijs * correctieFactor, 0);
  } else {
    // Geen oppervlakte: gebruik gemiddelde transactieprijzen als referentie
    // Vlaanderen gemiddelde transactieprijzen
    const gemPrijzen: Record<string, number> = {
      "appartement": 265000,
      "apartment": 265000,
      "flat": 240000,
      "studio": 195000,
      "huis": 380000,
      "house": 380000,
      "villa": 650000,
      "woning": 380000,
    };
    const type = (listing.propertyType ?? "huis").toLowerCase();
    const gemPrijs = Object.entries(gemPrijzen).find(([k]) => type.includes(k))?.[1] ?? 350000;
    marktconformePrijs = round(gemPrijs * correctieFactor, 0);
  }

  // 4. Bandbreedte (±10% voor onzekerheid)
  const bandbreedte = markt.betrouwbaarheid === "hoog" ? 0.08 : markt.betrouwbaarheid === "midden" ? 0.12 : 0.18;
  const minimumPrijs = roundTo1000(marktconformePrijs * (1 - bandbreedte));
  const maximumPrijs = roundTo1000(marktconformePrijs * (1 + bandbreedte));

  // 5. Verschil berekenen
  const verschilBedrag = listing.price - marktconformePrijs;
  const verschilPercent = round((verschilBedrag / marktconformePrijs) * 100, 1);

  // 6. Oordeel
  const { oordeel, label, kleur } = getOordeel(verschilPercent);

  // 7. Prijs per m²
  const prijsPerM2 = listing.livingArea ? round(listing.price / listing.livingArea, 0) : null;

  // 8. EPC impact in €
  const epcImpact = epcCorrectie;
  const epcBedrag = roundTo1000(marktconformePrijs * Math.abs(epcImpact));

  // 9. Biedingsadvies
  let biedingsadvies: string | null = null;
  let biedingsbandbreedte = null;

  if (verschilPercent > 5) {
    // Te duur: adviseer om lager te bieden
    const biedMin = roundTo1000(marktconformePrijs * 0.96);
    const biedMax = roundTo1000(marktconformePrijs * 1.02);
    biedingsadvies = `Bod uitbrengen tussen €${biedMin.toLocaleString("nl-BE")} en €${biedMax.toLocaleString("nl-BE")}`;
    biedingsbandbreedte = { min: biedMin, max: biedMax };
  } else if (verschilPercent < -10) {
    // Koopkans: snel handelen
    biedingsadvies = `Koopkans — vraagprijs is acceptabel, snel handelen`;
  }

  // 10. Advies tekst
  let advies: string;
  if (oordeel === "marktconform") {
    advies = `De vraagprijs van €${listing.price.toLocaleString("nl-BE")} ligt in lijn met de markt in ${markt.gemeente}. Op basis van vergelijkbare panden en de beschikbare kenmerken is dit een eerlijke prijs.`;
  } else if (oordeel.includes("over")) {
    advies = `De vraagprijs van €${listing.price.toLocaleString("nl-BE")} ligt ${Math.abs(verschilPercent)}% boven de marktwaarde in ${markt.gemeente}. ${verschilPercent > 15 ? "Dit is significant. " : ""}Onderhandelen is zeker mogelijk — onze schatting is €${marktconformePrijs.toLocaleString("nl-BE")}.`;
  } else {
    advies = `De vraagprijs van €${listing.price.toLocaleString("nl-BE")} ligt ${Math.abs(verschilPercent)}% onder de marktwaarde in ${markt.gemeente}. Dit is een aantrekkelijke opportuniteit — vergelijkbare panden worden voor meer verkocht.`;
  }

  return {
    oordeel,
    oordeelLabel: label,
    oordeelKleur: kleur,
    verschilPercent,
    verschilBedrag: roundTo1000(verschilBedrag),
    vraagprijs: listing.price,
    marktconformePrijs: roundTo1000(marktconformePrijs),
    minimumPrijs,
    maximumPrijs,
    prijsPerM2,
    marktPrijsPerM2,
    gemeente: markt.gemeente,
    betrouwbaarheid: markt.betrouwbaarheid,
    aantalTransacties: markt.aantalTransacties,
    epcLabel,
    epcImpact: round(epcImpact * 100, 1),
    epcBedrag,
    factoren,
    advies,
    biedingsadvies,
    biedingsbandbreedte,
  };
}