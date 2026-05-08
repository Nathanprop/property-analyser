import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ms = (...args: object[]): any => Object.assign({}, ...args);

const NAVY = "#0D1B3E";
const NAVY2 = "#1a3366";
const GOLD = "#E8A020";
const BLUE = "#4A90D9";
const GRAY = "#64748b";
const LIGHTGRAY = "#f1f5fb";
const WHITE = "#ffffff";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#1e293b", backgroundColor: WHITE, paddingBottom: 50 },
  header: { backgroundColor: NAVY, padding: "24 36 20 36", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.5 },
  headerSub: { fontSize: 9, color: "#93afd4", marginTop: 2 },
  headerRight: { fontSize: 9, color: "#93afd4", textAlign: "right" },
  body: { padding: "24 36" },
  footer: { position: "absolute", bottom: 16, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 8, color: "#94a3b8" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 6 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 10, marginTop: 18 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 6 },
  label: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  valueSm: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  text: { fontSize: 9.5, color: "#374151", lineHeight: 1.6 },
  textSm: { fontSize: 8.5, color: GRAY, lineHeight: 1.5 },
  row: { flexDirection: "row", gap: 12, marginBottom: 10 },
  card: { backgroundColor: LIGHTGRAY, borderRadius: 8, padding: "12 14", flex: 1 },
  cardWhite: { backgroundColor: WHITE, borderRadius: 8, padding: "12 14", flex: 1, borderWidth: 1, borderColor: "#e2e8f0" },
  verdictGreen: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: "16 20", borderWidth: 2, borderColor: "#86efac" },
  verdictOrange: { backgroundColor: "#fffbeb", borderRadius: 10, padding: "16 20", borderWidth: 2, borderColor: "#fde68a" },
  verdictRed: { backgroundColor: "#fef2f2", borderRadius: 10, padding: "16 20", borderWidth: 2, borderColor: "#fecaca" },
  goldBox: { backgroundColor: NAVY, borderRadius: 8, padding: "12 16" },
  divider: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginVertical: 12 },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", padding: "8 12" },
  tableRowLast: { flexDirection: "row", padding: "8 12" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", padding: "8 12", backgroundColor: LIGHTGRAY },
  tableCell: { flex: 1, fontSize: 9, color: "#374151" },
  tableCellBold: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY },
  chip: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  epcA: { backgroundColor: "#166534", color: WHITE },
  epcB: { backgroundColor: "#15803d", color: WHITE },
  epcC: { backgroundColor: "#65a30d", color: WHITE },
  epcD: { backgroundColor: "#ca8a04", color: WHITE },
  epcE: { backgroundColor: "#ea580c", color: WHITE },
  epcF: { backgroundColor: "#dc2626", color: WHITE },
  epcG: { backgroundColor: "#7f1d1d", color: WHITE },
  bulletRow: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 14, fontSize: 9, color: GOLD },
  bulletText: { flex: 1, fontSize: 9, color: "#374151", lineHeight: 1.5 },
  checkRow: { flexDirection: "row", marginBottom: 6 },
  checkBox: { width: 14, height: 10, borderWidth: 1, borderColor: NAVY, borderRadius: 2, marginRight: 6, marginTop: 1 },
});

function fmt(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function calcMonthly(principal: number, annualRate: number, years: number) {
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcNotary(price: number): number {
  let fee = 0;
  const brackets = [[7500, 0.0456], [10000, 0.0285], [12500, 0.0228], [15495, 0.0171], [18600, 0.0114], [Infinity, 0.0057]];
  let remaining = price;
  let prev = 0;
  for (const [limit, rate] of brackets) {
    const slice = Math.min(remaining, (limit as number) - prev);
    fee += slice * (rate as number);
    remaining -= slice;
    prev = limit as number;
    if (remaining <= 0) break;
  }
  return Math.max(fee, 1000) + 1200;
}

function epcStyle(label: string | null) {
  const l = (label ?? "").toUpperCase().charAt(0);
  return (s as Record<string, object>)[`epc${l}`] ?? s.epcG;
}

function isVlaanderen(pc: string | null) {
  if (!pc) return false;
  const n = parseInt(pc, 10);
  return (n >= 1500 && n <= 3999) || (n >= 8000 && n <= 9999);
}

function verdictStyle(kleur: string) {
  if (kleur === "groen") return s.verdictGreen;
  if (kleur === "rood") return s.verdictRed;
  return s.verdictOrange;
}

function verdictColor(kleur: string) {
  if (kleur === "groen") return "#166534";
  if (kleur === "rood") return "#dc2626";
  return "#b45309";
}

interface Lead { voornaam: string; achternaam: string; email: string; telefoon: string; }

interface Listing {
  source: string; municipality: string | null; postalCode: string | null;
  price: number | null; livingArea: number | null; bedrooms: number | null;
  bathrooms: number | null; epcLabel: string | null; epcScore: number | null;
  propertyType: string | null; street: string | null; houseNumber: string | null;
  buildYear: number | null; garden: boolean | null; gardenArea: number | null;
  garage: boolean | null; terrace: boolean | null; terraceArea: number | null;
  agencyName: string | null; agencyPhone: string | null; heatingType: string | null;
  solarPanels: boolean | null; doubleGlazing: boolean | null; images: string[];
  warnings: string[];
}

interface Prijs {
  oordeel: string; oordeelLabel: string; oordeelKleur: "groen" | "oranje" | "rood";
  verschilPercent: number; verschilBedrag: number;
  vraagprijs: number; marktconformePrijs: number; minimumPrijs: number; maximumPrijs: number;
  prijsPerM2: number | null; marktPrijsPerM2: number;
  gemeente: string; betrouwbaarheid: string;
  epcLabel: string | null; epcImpact: number; epcBedrag: number;
  factoren: { naam: string; impact: string; beschrijving: string; correctie: number }[];
  advies: string; biedingsadvies: string | null;
  biedingsbandbreedte: { min: number; max: number } | null;
}

export interface PDFProps { lead: Lead; listing: Listing; prijs: Prijs; url: string; }

function Header({ adres, pagina }: { adres: string; pagina: string }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerTitle}>Property Analyser</Text>
        <Text style={s.headerSub}>{adres}</Text>
      </View>
      <View>
        <Text style={s.headerRight}>{pagina}</Text>
        <Text style={s.headerRight}>{new Date().toLocaleDateString("nl-BE")}</Text>
      </View>
    </View>
  );
}

function Footer({ page, total }: { page: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Property Analyser · Indicatieve analyse · nathan@thynk-agency.com</Text>
      <Text style={s.footerText}>{page} / {total}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bullet}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

// PAGE 1 — COVER
function CoverPage({ lead, listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Onbekend adres";
  const gemeente = listing.municipality ?? prijs.gemeente;
  const pc = listing.postalCode ? ` (${listing.postalCode})` : "";
  return (
    <Page size="A4" style={s.page}>
      <View style={{ backgroundColor: NAVY, minHeight: 320, padding: "48 36 40 36", justifyContent: "flex-end" }}>
        <Text style={{ fontSize: 11, color: "#93afd4", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Vastgoedanalyse Rapport</Text>
        <Text style={{ fontSize: 30, fontFamily: "Helvetica-Bold", color: WHITE, lineHeight: 1.25, marginBottom: 8 }}>Property{"\n"}Analyser</Text>
        <View style={{ width: 48, height: 4, backgroundColor: GOLD, borderRadius: 2, marginBottom: 24 }} />
        <Text style={{ fontSize: 14, color: WHITE, fontFamily: "Helvetica-Bold" }}>{adres}</Text>
        <Text style={{ fontSize: 11, color: "#93afd4", marginTop: 4 }}>{gemeente}{pc}</Text>
      </View>

      <View style={{ padding: "36 36 0 36", flex: 1 }}>
        <View style={ms(s.row, { marginBottom: 20 })}>
          <View style={s.card}>
            <Text style={s.label}>Opgesteld voor</Text>
            <Text style={s.valueSm}>{lead.voornaam} {lead.achternaam}</Text>
            <Text style={ms(s.textSm, { marginTop: 2 })}>{lead.email}</Text>
            {lead.telefoon ? <Text style={ms(s.textSm, { marginTop: 1 })}>{lead.telefoon}</Text> : null}
          </View>
          <View style={s.card}>
            <Text style={s.label}>Datum analyse</Text>
            <Text style={s.valueSm}>{new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}</Text>
            <Text style={ms(s.textSm, { marginTop: 2 })}>via {listing.source}</Text>
          </View>
        </View>

        <View style={ms(verdictStyle(prijs.oordeelKleur), { marginBottom: 20 })}>
          <Text style={ms(s.label, { marginBottom: 6 })}>Oordeel</Text>
          <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: verdictColor(prijs.oordeelKleur), marginBottom: 6 }}>{prijs.oordeelLabel}</Text>
          <Text style={s.text}>{prijs.advies}</Text>
        </View>

        <View style={s.row}>
          <View style={s.cardWhite}>
            <Text style={s.label}>Vraagprijs</Text>
            <Text style={s.value}>{fmt(prijs.vraagprijs)}</Text>
          </View>
          <View style={s.cardWhite}>
            <Text style={s.label}>Marktwaarde</Text>
            <Text style={s.value}>{fmt(prijs.marktconformePrijs)}</Text>
          </View>
          <View style={s.cardWhite}>
            <Text style={s.label}>Verschil</Text>
            <Text style={ms(s.value, { color: verdictColor(prijs.oordeelKleur) })}>{prijs.verschilPercent > 0 ? "+" : ""}{prijs.verschilPercent}%</Text>
          </View>
        </View>
      </View>

      <Footer page={1} total={10} />
    </Page>
  );
}

// PAGE 2 — SAMENVATTING
function SamenvattingPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const positief = prijs.factoren.filter(f => f.correctie <= 0).slice(0, 3);
  const negatief = prijs.factoren.filter(f => f.correctie > 0).slice(0, 3);
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Samenvatting" />
      <View style={s.body}>
        <Text style={s.h1}>Samenvatting</Text>

        <View style={ms(verdictStyle(prijs.oordeelKleur), { marginBottom: 16 })}>
          <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: verdictColor(prijs.oordeelKleur), marginBottom: 8 }}>{prijs.oordeelLabel}</Text>
          <Text style={s.text}>{prijs.advies}</Text>
        </View>

        <View style={s.row}>
          <View style={s.cardWhite}><Text style={s.label}>Vraagprijs</Text><Text style={s.value}>{fmt(prijs.vraagprijs)}</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Marktwaarde</Text><Text style={s.value}>{fmt(prijs.marktconformePrijs)}</Text><Text style={s.textSm}>{fmt(prijs.minimumPrijs)} – {fmt(prijs.maximumPrijs)}</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Verschil</Text><Text style={ms(s.value, { color: verdictColor(prijs.oordeelKleur) })}>{prijs.verschilPercent > 0 ? "+" : ""}{prijs.verschilPercent}%</Text><Text style={s.textSm}>{fmt(Math.abs(prijs.verschilBedrag))} {prijs.verschilBedrag > 0 ? "te duur" : "te goedkoop"}</Text></View>
        </View>

        {positief.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={ms(s.h3, { color: "#166534" })}>Sterke punten</Text>
            {positief.map((f, i) => <Bullet key={i} text={`${f.naam}: ${f.beschrijving}`} />)}
          </View>
        )}

        {negatief.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={ms(s.h3, { color: "#dc2626" })}>Aandachtspunten</Text>
            {negatief.map((f, i) => <Bullet key={i} text={`${f.naam}: ${f.beschrijving}`} />)}
          </View>
        )}

        <View style={s.divider} />
        <Text style={s.h3}>Alle prijsfactoren</Text>
        <View style={s.table}>
          {prijs.factoren.map((f, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={ms(s.tableCell, { flex: 2 })}>{f.naam}</Text>
              <Text style={s.tableCell}>{f.impact}</Text>
              <Text style={ms(s.tableCellBold, { color: f.correctie > 0 ? "#dc2626" : f.correctie < 0 ? "#166534" : NAVY })}>{f.correctie > 0 ? "+" : ""}{f.correctie}%</Text>
            </View>
          ))}
        </View>
      </View>
      <Footer page={2} total={10} />
    </Page>
  );
}

// PAGE 3 — PRIJSANALYSE
function PrijsPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const bidPrijs = Math.round(Math.min(prijs.vraagprijs, prijs.marktconformePrijs) * 0.965 / 1000) * 1000;
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Prijsanalyse" />
      <View style={s.body}>
        <Text style={s.h1}>Prijsanalyse</Text>

        <View style={s.row}>
          <View style={s.cardWhite}><Text style={s.label}>Vraagprijs</Text><Text style={s.value}>{fmt(prijs.vraagprijs)}</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Min. marktwaarde</Text><Text style={s.value}>{fmt(prijs.minimumPrijs)}</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Max. marktwaarde</Text><Text style={s.value}>{fmt(prijs.maximumPrijs)}</Text></View>
        </View>

        {prijs.prijsPerM2 && (
          <View style={s.row}>
            <View style={s.card}><Text style={s.label}>Prijs/m² (pand)</Text><Text style={s.value}>€ {prijs.prijsPerM2.toLocaleString("nl-BE")}</Text></View>
            <View style={s.card}><Text style={s.label}>Marktgemiddelde/m²</Text><Text style={s.value}>€ {prijs.marktPrijsPerM2.toLocaleString("nl-BE")}</Text></View>
            <View style={s.card}><Text style={s.label}>Verschil/m²</Text><Text style={ms(s.value, { color: verdictColor(prijs.oordeelKleur) })}>€ {(prijs.prijsPerM2 - prijs.marktPrijsPerM2).toLocaleString("nl-BE")}</Text></View>
          </View>
        )}

        <View style={ms(s.goldBox, { marginBottom: 16 })}>
          <Text style={{ fontSize: 10, color: "#93afd4", marginBottom: 6 }}>🤝 Onderhandelingstip — aanbevolen bod</Text>
          <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", color: "#60a5fa", marginBottom: 6 }}>€ {bidPrijs.toLocaleString("nl-BE")}</Text>
          <Text style={{ fontSize: 9, color: "#93afd4" }}>
            {prijs.verschilPercent > 5
              ? `Op basis van overwaardering +${prijs.verschilPercent}% is er duidelijke onderhandelingsruimte.`
              : prijs.verschilPercent > 0
              ? `Op basis van lichte overwaardering is er beperkte onderhandelingsruimte.`
              : `Op basis van marktconforme prijs. Bieden onder vraagprijs is mogelijk maar beperkt.`}
          </Text>
        </View>

        {prijs.biedingsbandbreedte && (
          <View style={s.card}>
            <Text style={s.label}>Aanbevolen biedingsbandbreedte</Text>
            <Text style={s.text}>{fmt(prijs.biedingsbandbreedte.min)} – {fmt(prijs.biedingsbandbreedte.max)}</Text>
          </View>
        )}

        <Text style={s.h2}>Betrouwbaarheid</Text>
        <View style={s.cardWhite}>
          <Text style={s.text}>Deze analyse heeft een <Text style={{ fontFamily: "Helvetica-Bold" }}>{prijs.betrouwbaarheid}</Text> betrouwbaarheid op basis van beschikbare marktdata voor {prijs.gemeente}. De marktconforme prijs is een indicatie op basis van recente transacties, EPC-impact en pandkenmerken.</Text>
        </View>
      </View>
      <Footer page={3} total={10} />
    </Page>
  );
}

// PAGE 4 — PAND DETAILS
function PandDetailsPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const details: [string, string][] = [
    ["Type", listing.propertyType ?? "Onbekend"],
    ["Adres", adres + (listing.postalCode ? ` ${listing.postalCode}` : "")],
    ["Gemeente", listing.municipality ?? prijs.gemeente],
    ["Bewoonbare oppervlakte", listing.livingArea ? `${listing.livingArea} m²` : "Onbekend"],
    ["Slaapkamers", listing.bedrooms ? `${listing.bedrooms}` : "Onbekend"],
    ["Badkamers", listing.bathrooms ? `${listing.bathrooms}` : "Onbekend"],
    ["Bouwjaar", listing.buildYear ? `${listing.buildYear}` : "Onbekend"],
    ["Tuin", listing.garden === true ? (listing.gardenArea ? `Ja (${listing.gardenArea} m²)` : "Ja") : listing.garden === false ? "Nee" : "Onbekend"],
    ["Terras", listing.terrace === true ? (listing.terraceArea ? `Ja (${listing.terraceArea} m²)` : "Ja") : listing.terrace === false ? "Nee" : "Onbekend"],
    ["Garage", listing.garage === true ? "Ja" : listing.garage === false ? "Nee" : "Onbekend"],
    ["Verwarming", listing.heatingType ?? "Onbekend"],
    ["Zonnepanelen", listing.solarPanels === true ? "Ja" : listing.solarPanels === false ? "Nee" : "Onbekend"],
    ["Dubbel glas", listing.doubleGlazing === true ? "Ja" : listing.doubleGlazing === false ? "Nee" : "Onbekend"],
    ["Makelaar", listing.agencyName ?? "Onbekend"],
  ];
  const epc = listing.epcLabel ?? prijs.epcLabel;
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Panddetails" />
      <View style={s.body}>
        <Text style={s.h1}>Panddetails</Text>
        {epc && (
          <View style={ms(s.row, { marginBottom: 14 })}>
            <View style={s.card}>
              <Text style={s.label}>EPC Label</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={ms(s.chip, epcStyle(epc), { padding: "4 12" })}>
                  <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold" }}>{epc.toUpperCase()}</Text>
                </View>
                {listing.epcScore && <Text style={s.text}>{listing.epcScore} kWh/m²jaar</Text>}
              </View>
            </View>
            {prijs.epcBedrag > 0 && (
              <View style={s.card}>
                <Text style={s.label}>EPC-impact op prijs</Text>
                <Text style={ms(s.value, { color: "#dc2626" })}>- {fmt(prijs.epcBedrag)}</Text>
                <Text style={s.textSm}>verdisconteerd in marktwaarde</Text>
              </View>
            )}
          </View>
        )}
        <View style={s.table}>
          {details.map(([k, v], i) => (
            <View key={i} style={i === details.length - 1 ? s.tableRowLast : i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={ms(s.tableCell, { flex: 1.4, fontFamily: "Helvetica-Bold", color: NAVY })}>{k}</Text>
              <Text style={ms(s.tableCell, { flex: 2 })}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
      <Footer page={4} total={10} />
    </Page>
  );
}

// PAGE 5 — ENERGIE & RENOVATIE
function EnergiePage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const epc = (listing.epcLabel ?? prijs.epcLabel ?? "").toUpperCase().trim();
  const vlaan = isVlaanderen(listing.postalCode);
  const deadline = new Date().getFullYear() + 6;
  const renovatieKosten = [
    ["Dakisolatie", "€ 8.000 – € 18.000", "Sterkste energiewinst, hoog prioriteit"],
    ["Spouwmuurisolatie", "€ 3.000 – € 8.000", "Snel terugverdiend via lagere verwarmingskosten"],
    ["Vloerisolatie", "€ 4.000 – € 10.000", "Kruipkelder of betonnen vloer"],
    ["Warmtepomp", "€ 10.000 – € 20.000", "Vervangt gasketel, premie tot € 4.500 beschikbaar"],
    ["Zonnepanelen (6 kW)", "€ 6.000 – € 14.000", "Terugverdientijd 5–8 jaar, prosumentsvergoeding"],
    ["Dubbel/driedubbel glas", "€ 5.000 – € 12.000", "Comfort + energiebesparing"],
  ];
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Energie & Renovatie" />
      <View style={s.body}>
        <Text style={s.h1}>Energie & Renovatie</Text>

        {epc && (
          <View style={ms(s.row, { marginBottom: 12 })}>
            {["A", "B", "C", "D", "E", "F", "G"].map(l => (
              <View key={l} style={ms(s.chip, epcStyle(l), { flex: 1, alignItems: "center", padding: "6 0", opacity: l === epc.charAt(0) ? 1 : 0.3 })}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE }}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {vlaan && ["E", "F"].includes(epc.charAt(0)) && (
          <View style={{ backgroundColor: "#fffbeb", borderRadius: 8, padding: "12 14", borderWidth: 1.5, borderColor: "#fde68a", marginBottom: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#92400e", marginBottom: 4 }}>⚠ Wettelijke renovatieplicht (Vlaanderen)</Text>
            <Text style={ms(s.text, { color: "#78350f" })}>
              Dit pand (EPC {epc.charAt(0)}) valt onder de Vlaamse renovatieplicht. Na aankoop heeft u 6 jaar om te renoveren tot minimum label D (deadline: {deadline}). Verplichting opgelegd door VEKA.
            </Text>
          </View>
        )}

        <Text style={s.h2}>Geschatte renovatiekosten</Text>
        <View style={s.table}>
          <View style={s.tableRow}>
            <Text style={ms(s.tableCellBold, { flex: 1.5 })}>Ingreep</Text>
            <Text style={s.tableCellBold}>Kost</Text>
            <Text style={ms(s.tableCellBold, { flex: 2 })}>Toelichting</Text>
          </View>
          {renovatieKosten.map(([ingreep, kost, info], i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRowAlt : s.tableRow}>
              <Text style={ms(s.tableCell, { flex: 1.5 })}>{ingreep}</Text>
              <Text style={s.tableCell}>{kost}</Text>
              <Text style={ms(s.tableCell, { flex: 2 })}>{info}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Beschikbare subsidies (Vlaanderen)</Text>
        <View style={s.table}>
          {[
            ["Mijn VerbouwPremie (VEKA)", "Dakisolatie, glas, muren, warmtepomp — tot 50% van kost"],
            ["Fluvius netbeheerpremie", "Zonnepanelen, warmtepomp, slimme meter"],
            ["Energielening (EPC < D)", "Renteloze lening tot € 60.000 via Energiehuis"],
            ["Belastingvermindering", "Federaal: 30–45% aftrek bepaalde werken"],
          ].map(([naam, info], i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={ms(s.tableCellBold, { flex: 1.5 })}>{naam}</Text>
              <Text style={ms(s.tableCell, { flex: 2.5 })}>{info}</Text>
            </View>
          ))}
        </View>
      </View>
      <Footer page={5} total={10} />
    </Page>
  );
}

// PAGE 6 — AANKOOPKOSTEN
function AankoopkostenPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const prijs1 = prijs.vraagprijs;
  const vlaan = isVlaanderen(listing.postalCode);
  const regEnige = Math.round(prijs1 * 0.03);
  const regInvest = Math.round(prijs1 * (vlaan ? 0.12 : 0.125));
  const notaris = Math.round(calcNotary(prijs1));
  const akte = 1500;
  const totaalEnige = prijs1 + regEnige + notaris + akte;
  const totaalInvest = prijs1 + regInvest + notaris + akte;
  const eigenInbrengEnige = Math.round(totaalEnige * 0.1);
  const eigenInbrengInvest = Math.round(totaalInvest * 0.2);
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Aankoopkosten" />
      <View style={s.body}>
        <Text style={s.h1}>Aankoopkosten</Text>
        <Text style={ms(s.text, { marginBottom: 14 })}>Overzicht van alle kosten bij aankoop in {vlaan ? "Vlaanderen" : "België"}. Twee scenario's naargelang of het uw enige woning betreft.</Text>

        <View style={s.row}>
          <View style={ms(s.cardWhite, { flex: 1 })}>
            <Text style={ms(s.h3, { color: "#166534" })}>Als enige woning</Text>
            <Text style={s.label}>Registratierechten ({vlaan ? "3%" : "12.5%"})</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(regEnige)}</Text>
            <Text style={s.label}>Notariskosten (geschat)</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(notaris)}</Text>
            <Text style={s.label}>Aktekosten</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(akte)}</Text>
            <View style={ms(s.divider, { marginVertical: 8 })} />
            <Text style={s.label}>Totale aankoopkost</Text>
            <Text style={s.value}>{fmt(totaalEnige)}</Text>
            <Text style={ms(s.textSm, { marginTop: 4 })}>Eigen inbreng (10%): {fmt(eigenInbrengEnige)}</Text>
          </View>
          <View style={ms(s.cardWhite, { flex: 1 })}>
            <Text style={ms(s.h3, { color: "#b45309" })}>Als investering/2e woning</Text>
            <Text style={s.label}>Registratierechten ({vlaan ? "12%" : "12.5%"})</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(regInvest)}</Text>
            <Text style={s.label}>Notariskosten (geschat)</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(notaris)}</Text>
            <Text style={s.label}>Aktekosten</Text>
            <Text style={ms(s.valueSm, { marginBottom: 8 })}>{fmt(akte)}</Text>
            <View style={ms(s.divider, { marginVertical: 8 })} />
            <Text style={s.label}>Totale aankoopkost</Text>
            <Text style={s.value}>{fmt(totaalInvest)}</Text>
            <Text style={ms(s.textSm, { marginTop: 4 })}>Eigen inbreng (20%): {fmt(eigenInbrengInvest)}</Text>
          </View>
        </View>

        <View style={ms(s.card, { marginTop: 4 })}>
          <Text style={ms(s.textSm, { fontFamily: "Helvetica-Bold", marginBottom: 4 })}>Belangrijke noot</Text>
          <Text style={s.textSm}>In Vlaanderen geldt het verlaagd tarief van 3% voor de enige eigen woning (verlaagd in 2022). Bij aankoop met abattement op de eerste €220.000 kan dit nog lager uitvallen. Notariskosten zijn een schatting op basis van de officiële Belgische notaristarieven. Laat u informeren door uw notaris voor exacte bedragen.</Text>
        </View>
      </View>
      <Footer page={6} total={10} />
    </Page>
  );
}

// PAGE 7 — HYPOTHEEK
function HypotheekPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const rate = 0.035;
  const eigen = Math.round(prijs.vraagprijs * 0.2);
  const lening = prijs.vraagprijs - eigen;
  const scenarios = [20, 25, 30].map(jaar => {
    const maand = calcMonthly(lening, rate, jaar);
    const totaal = maand * jaar * 12;
    const interest = totaal - lening;
    return { jaar, maand, totaal, interest };
  });
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Hypotheeksimulatie" />
      <View style={s.body}>
        <Text style={s.h1}>Hypotheeksimulatie</Text>
        <Text style={ms(s.text, { marginBottom: 14 })}>Simulatie op basis van een eigen inbreng van 20% ({fmt(eigen)}) en een rentevoet van 3,5% (actuele marktrente). Leningsbedrag: {fmt(lening)}.</Text>

        <View style={s.row}>
          {scenarios.map(sc => (
            <View key={sc.jaar} style={ms(s.cardWhite, { flex: 1, alignItems: "center" })}>
              <Text style={ms(s.label, { marginBottom: 6 })}>{sc.jaar} jaar</Text>
              <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>€ {Math.round(sc.maand).toLocaleString("nl-BE")}</Text>
              <Text style={ms(s.textSm, { marginBottom: 2 })}>per maand</Text>
              <View style={s.divider} />
              <Text style={s.label}>Totaal betaald</Text>
              <Text style={s.valueSm}>{fmt(sc.totaal)}</Text>
              <Text style={ms(s.textSm, { marginTop: 2 })}>Interest: {fmt(sc.interest)}</Text>
            </View>
          ))}
        </View>

        <View style={ms(s.goldBox, { marginTop: 4 })}>
          <Text style={{ fontSize: 9, color: "#93afd4", marginBottom: 6 }}>Aanbeveling</Text>
          <Text style={{ fontSize: 9.5, color: WHITE, lineHeight: 1.6 }}>
            Een looptijd van 25 jaar biedt een goede balans tussen maandelijkse last en totale interestkosten.
            Bij 20 jaar betaalt u minder interest maar hogere maandlasten.
            Bij 30 jaar zijn de maandlasten het laagst maar de totale kost het hoogst.
            Herfinancieren is altijd mogelijk als de rentevoeten dalen.
          </Text>
        </View>

        <View style={ms(s.card, { marginTop: 12 })}>
          <Text style={ms(s.textSm, { fontFamily: "Helvetica-Bold", marginBottom: 3 })}>Let op</Text>
          <Text style={s.textSm}>Banken vereisen doorgaans een debt-service ratio onder 40–45% van uw netto-inkomen. Een woonkrediet vraagt ook een schuldsaldoverzekering. Vergelijk aanbiedingen bij meerdere banken of via een kredietmakelaar.</Text>
        </View>
      </View>
      <Footer page={7} total={10} />
    </Page>
  );
}

// PAGE 8 — VERHUURPOTENTIEEL
function VerhuurPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const m2 = listing.livingArea ?? 100;
  const huurPerM2 = prijs.marktPrijsPerM2 / 200;
  const maandHuur = Math.round(m2 * Math.max(huurPerM2, 7) / 50) * 50;
  const jaarHuur = maandHuur * 12;
  const brutoBruto = (jaarHuur / prijs.vraagprijs) * 100;
  const kosten = jaarHuur * 0.22;
  const nettoHuur = jaarHuur - kosten;
  const nettoRendement = (nettoHuur / prijs.vraagprijs) * 100;
  const breakEven = Math.round(prijs.vraagprijs / nettoHuur);
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Verhuurpotentieel" />
      <View style={s.body}>
        <Text style={s.h1}>Verhuurpotentieel</Text>
        <Text style={ms(s.text, { marginBottom: 14 })}>Schatting op basis van de marktconforme huurprijs voor dit type pand in {prijs.gemeente} ({m2} m²).</Text>

        <View style={s.row}>
          <View style={s.cardWhite}><Text style={s.label}>Geschatte huurprijs</Text><Text style={s.value}>{fmt(maandHuur)}/mnd</Text><Text style={s.textSm}>{fmt(jaarHuur)} per jaar</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Bruto huurrendement</Text><Text style={ms(s.value, { color: brutoBruto >= 4 ? "#166534" : "#b45309" })}>{brutoBruto.toFixed(1)}%</Text></View>
          <View style={s.cardWhite}><Text style={s.label}>Netto huurrendement</Text><Text style={ms(s.value, { color: nettoRendement >= 3 ? "#166534" : "#b45309" })}>{nettoRendement.toFixed(1)}%</Text><Text style={s.textSm}>na kosten (~22%)</Text></View>
        </View>

        <View style={s.row}>
          <View style={s.card}><Text style={s.label}>Jaarlijkse cashflow</Text><Text style={ms(s.valueSm, { color: nettoHuur > 0 ? "#166534" : "#dc2626" })}>{fmt(nettoHuur)}</Text></View>
          <View style={s.card}><Text style={s.label}>Break-even punt</Text><Text style={s.valueSm}>{breakEven} jaar</Text><Text style={s.textSm}>enkel huurinkomsten</Text></View>
          <View style={s.card}><Text style={s.label}>Maandelijkse kosten</Text><Text style={s.valueSm}>{fmt(Math.round(kosten / 12))}</Text><Text style={s.textSm}>syndic, verzekering, leegstand</Text></View>
        </View>

        <Text style={s.h2}>Zelf bewonen vs. verhuren</Text>
        <View style={s.table}>
          {[
            ["", "Zelf bewonen", "Verhuren"],
            ["Maandlast (hypotheek)", fmt(Math.round(calcMonthly(prijs.vraagprijs * 0.8, 0.035, 25))), fmt(maandHuur) + " inkomst"],
            ["Jaarlijkse kost", fmt(Math.round(calcMonthly(prijs.vraagprijs * 0.8, 0.035, 25) * 12)), fmt(kosten) + " kosten"],
            ["Voordeel", "Woonzekerheid, geen huur", fmt(nettoHuur) + " cashflow/jaar"],
          ].map(([a, b, c], i) => (
            <View key={i} style={i === 0 ? s.tableRow : i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={ms(i === 0 ? s.tableCellBold : s.tableCell, { flex: 1.5 })}>{a}</Text>
              <Text style={ms(i === 0 ? s.tableCellBold : s.tableCell, { flex: 2 })}>{b}</Text>
              <Text style={ms(i === 0 ? s.tableCellBold : s.tableCell, { flex: 2 })}>{c}</Text>
            </View>
          ))}
        </View>

        <View style={ms(s.textSm, { marginTop: 10 })}>
          <Text style={s.textSm}>Kosten inbegrepen in de berekening: onroerende voorheffing, verzekeringen, leegstandrisico (5%), klein onderhoud, syndic (bij appartement).</Text>
        </View>
      </View>
      <Footer page={8} total={10} />
    </Page>
  );
}

// PAGE 9 — WAARDEONTWIKKELING
function WaardePage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  const basis = prijs.marktconformePrijs;
  const groei = [0.025, 0.035, 0.045];
  const jaren = [5, 10, 15, 20];
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Waardeontwikkeling" />
      <View style={s.body}>
        <Text style={s.h1}>Waardeontwikkeling</Text>
        <Text style={ms(s.text, { marginBottom: 14 })}>Projectie van de marktwaarde ({fmt(basis)}) over 20 jaar bij drie groeiscenario&apos;s. Belgisch vastgoed steeg historisch ~3,5% per jaar (Notarisbarometer).</Text>

        <View style={s.table}>
          <View style={s.tableRow}>
            <Text style={ms(s.tableCellBold, { flex: 1 })}>Jaar</Text>
            <Text style={s.tableCellBold}>Conservatief 2,5%</Text>
            <Text style={s.tableCellBold}>Neutraal 3,5%</Text>
            <Text style={s.tableCellBold}>Optimistisch 4,5%</Text>
          </View>
          {jaren.map((j, i) => (
            <View key={j} style={i % 2 === 0 ? s.tableRowAlt : s.tableRow}>
              <Text style={ms(s.tableCellBold, { flex: 1 })}>+{j} jaar</Text>
              {groei.map((g, gi) => {
                const val = Math.round(basis * Math.pow(1 + g, j) / 1000) * 1000;
                const winst = val - basis;
                return (
                  <View key={gi} style={{ flex: 1 }}>
                    <Text style={s.tableCell}>{fmt(val)}</Text>
                    <Text style={ms(s.textSm, { color: "#166534" })}>+{fmt(winst)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={ms(s.goldBox, { marginTop: 14 })}>
          <Text style={{ fontSize: 9, color: "#93afd4", marginBottom: 6 }}>Wanneer verkopen voor maximale meerwaarde?</Text>
          <Text style={{ fontSize: 9.5, color: WHITE, lineHeight: 1.6 }}>
            In België is meerwaarde op een eigen woning belastingvrij bij doorverkoop na 5 jaar (of bij voortdurend eigen gebruik). Voor investeringsvastgoed geldt 16,5% meerwaardebelasting bij verkoop binnen 5 jaar. Houd de Vlaamse schenkings- en erfenisplanningregels in het oog voor optimalisatie.
          </Text>
        </View>

        <View style={ms(s.card, { marginTop: 12 })}>
          <Text style={ms(s.textSm, { fontFamily: "Helvetica-Bold", marginBottom: 3 })}>Databronnen</Text>
          <Text style={s.textSm}>Historische vastgoedprijzen: Notarisbarometer, Statbel, FOD Economie. Prognoses zijn indicatief op basis van lineaire extrapolatie. Vastgoedprijzen kunnen dalen. Dit is geen beleggingsadvies.</Text>
        </View>
      </View>
      <Footer page={9} total={10} />
    </Page>
  );
}

// PAGE 10 — CHECKLIST & DISCLAIMER
function ChecklistPage({ listing, prijs }: PDFProps) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Pand";
  return (
    <Page size="A4" style={s.page}>
      <Header adres={adres} pagina="Checklist & Disclaimer" />
      <View style={s.body}>
        <Text style={s.h1}>Checklist voor de koper</Text>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>10 vragen aan de makelaar</Text>
            {[
              "Waarom verkoopt de eigenaar?",
              "Hoe lang staat het pand te koop?",
              "Zijn er lopende betwistingen of erfdienstbaarheden?",
              "Zijn er stedenbouwkundige overtredingen of vergunningstekorten?",
              "Wat is de hoogte van de syndic-kosten? (bij appartement)",
              "Zijn er verborgen gebreken gekend?",
              "Is er asbestinventaris en zijn er actiepunten?",
              "Zijn alle nutsleidingen conform? Keuringsattest elektriciteit?",
              "Welke roerende goederen zijn inbegrepen?",
              "Wat is de onderhandelingsruimte op de vraagprijs?",
            ].map((q, i) => (
              <View key={i} style={s.checkRow}>
                <View style={s.checkBox} />
                <Text style={s.bulletText}>{q}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>Bij het bezoek controleren</Text>
            {[
              "Vochtplekken (muren, kelders, dak)",
              "Staat van dak en dakgoten",
              "Ramen: condensatie of tocht?",
              "Elektrische installatie: zekeringkast, aardelektrode",
              "Verwarmingsinstallatie: leeftijd, onderhoud",
              "Rioleringen: aansluiting, ouderdom",
              "Buren en omgeving: lawaai, industrie",
            ].map((q, i) => (
              <View key={i} style={s.checkRow}>
                <View style={s.checkBox} />
                <Text style={s.bulletText}>{q}</Text>
              </View>
            ))}
            <Text style={ms(s.h3, { marginTop: 10 })}>Juridisch</Text>
            {[
              "Vraag het stedenbouwkundig uittreksel op",
              "Controleer bodemattesten (OVAM)",
              "Nakijken: erfdienstbaarheden, rooilijnen",
              "Laat de compromis nakijken door uw notaris",
            ].map((q, i) => (
              <View key={i} style={s.checkRow}>
                <View style={s.checkBox} />
                <Text style={s.bulletText}>{q}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.divider} />
        <Text style={s.h2}>Disclaimer & Methodologie</Text>
        <Text style={ms(s.textSm, { marginBottom: 6 })}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Indicatief karakter: </Text>
          Dit rapport is een geautomatiseerde analyse op basis van publiek beschikbare marktdata. De marktwaarde is een schatting en geen officiële waardebepaling. De analyse vervangt geen notarieel of bouwkundig advies.
        </Text>
        <Text style={ms(s.textSm, { marginBottom: 6 })}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Databronnen: </Text>
          Statbel transactieprijzen, Notarisbarometer, CIB marktdata, gemeente-gemiddeldes per type woning. EPC-impact gebaseerd op actuariële analyse van energielabelcorrecties.
        </Text>
        <Text style={ms(s.textSm, { marginBottom: 10 })}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Gemeente {prijs.gemeente}: </Text>
          Marktprijs/m² {fmt(prijs.marktPrijsPerM2)}, betrouwbaarheid analyse: {prijs.betrouwbaarheid}.
        </Text>
        <View style={{ backgroundColor: NAVY, borderRadius: 8, padding: "10 14" }}>
          <Text style={{ fontSize: 9, color: WHITE, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Property Analyser · Vastgoed Lead Factory</Text>
          <Text style={{ fontSize: 8.5, color: "#93afd4" }}>nathan@thynk-agency.com · property-analyser-dun.vercel.app</Text>
          <Text style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>© {new Date().getFullYear()} — Dit rapport is persoonlijk en vertrouwelijk opgesteld voor de aanvrager.</Text>
        </View>
      </View>
      <Footer page={10} total={10} />
    </Page>
  );
}

export function PropertyPDFDocument(props: PDFProps) {
  return (
    <Document title={`Property Analyser — ${props.prijs.gemeente}`} author="Property Analyser" creator="Property Analyser">
      <CoverPage {...props} />
      <SamenvattingPage {...props} />
      <PrijsPage {...props} />
      <PandDetailsPage {...props} />
      <EnergiePage {...props} />
      <AankoopkostenPage {...props} />
      <HypotheekPage {...props} />
      <VerhuurPage {...props} />
      <WaardePage {...props} />
      <ChecklistPage {...props} />
    </Document>
  );
}
