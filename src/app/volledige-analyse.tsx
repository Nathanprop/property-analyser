"use client";
import React, { useState } from "react";
import { useIsMobile } from "@/lib/use-is-mobile";

type Doel = "wonen" | "verhuren" | "meerwaarde";

interface ListingProps {
  price: number | null;
  municipality: string | null;
  postalCode: string | null;
  livingArea: number | null;
  bedrooms: number | null;
  epcLabel: string | null;
  propertyType: string | null;
}

function isVlaanderen(postalCode: string | null): boolean {
  if (!postalCode) return false;
  const pc = parseInt(postalCode, 10);
  return (pc >= 1500 && pc <= 3999) || (pc >= 8000 && pc <= 9999);
}

interface PrijsProps {
  vraagprijs: number;
  marktconformePrijs: number;
  marktPrijsPerM2: number;
  gemeente: string;
  verschilPercent: number;
}

function maandlast(lening: number, rentePct: number, jaren: number): number {
  const r = rentePct / 100 / 12;
  const n = jaren * 12;
  return r === 0 ? lening / n : (lening * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const EPC_RENOVATIE: Record<string, { min: number; max: number; besparing: number; werken: string[]; subsidie: string }> = {
  "A+": { min: 0,     max: 0,      besparing: 0,    werken: [], subsidie: "" },
  "A":  { min: 0,     max: 0,      besparing: 0,    werken: [], subsidie: "" },
  "B":  { min: 5000,  max: 15000,  besparing: 700,  werken: ["Kleine isolatieaanpassingen", "Ventilatie D plaatsen"], subsidie: "Tot 30% via Mijn VerbouwPremie" },
  "C":  { min: 15000, max: 32000,  besparing: 1500, werken: ["Dakisolatie", "Dubbel glas vernieuwen", "Condensatieketel"], subsidie: "Tot 30% via Mijn VerbouwPremie" },
  "D":  { min: 28000, max: 55000,  besparing: 2600, werken: ["Dak + gevelisolatie", "Driedubbel glas", "Warmtepomp lucht/water"], subsidie: "Tot 40% via Mijn VerbouwPremie" },
  "E":  { min: 45000, max: 75000,  besparing: 3800, werken: ["Volledige isolatie (dak/gevel/vloer)", "Warmtepomp", "Zonnepanelen 6 kWp", "Vloerverwarming"], subsidie: "Tot 50% via Mijn VerbouwPremie" },
  "F":  { min: 60000, max: 100000, besparing: 5200, werken: ["Diepe renovatie alle schillen", "Warmtepomp + PV 8 kWp + batterij", "Ventilatie D", "Nieuwe elektriciteit"], subsidie: "Tot 50% + extra renovatiesteun" },
  "G":  { min: 80000, max: 160000, besparing: 7000, werken: ["Totaalrenovatie naar bijna-passiefstandaard", "Warmtepomp + PV 10 kWp + batterij + ventilatie D", "Nieuwe elektriciteit & sanitair"], subsidie: "Tot 50% + verhoogd tarief" },
};

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "28px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "0.5px solid #e8eaf0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#0D1B3E" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? "#0f172a", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function InfoBox({ color, children }: { color: "blue" | "yellow" | "green"; children: React.ReactNode }) {
  const c = { blue: { bg: "#eff6ff", text: "#1e40af" }, yellow: { bg: "#fffbeb", text: "#92400e" }, green: { bg: "#f0fdf4", text: "#166534" } }[color];
  return <div style={{ padding: "13px 16px", background: c.bg, borderRadius: 10, fontSize: 12, color: c.text, lineHeight: 1.6 }}>{children}</div>;
}

export function VolleAnalyse({ listing, prijs }: { listing: ListingProps; prijs: PrijsProps }) {
  const isMobile = useIsMobile();
  const [selectedDoel, setSelectedDoel] = useState<Doel | null>(null);
  const [doel, setDoel] = useState<Doel | null>(null);
  const [epcOverride, setEpcOverride] = useState<string | null>(null);
  const [eigenInbrengPct, setEigenInbrengPct] = useState(20);
  const [looptijd, setLooptijd] = useState(25);
  const [metMakelaar, setMetMakelaar] = useState(false);

  const koopprijs = prijs.vraagprijs;
  const eigenInbreng = Math.round(koopprijs * eigenInbrengPct / 100);
  const lening = koopprijs - eigenInbreng;

  const maandhuurMarkt = Math.round(koopprijs * 0.042 / 12 / 50) * 50;
  const maandhuurMin   = Math.round(maandhuurMarkt * 0.88 / 50) * 50;
  const maandhuurMax   = Math.round(maandhuurMarkt * 1.12 / 50) * 50;
  const huurPerM2      = listing.livingArea ? Math.round(maandhuurMarkt / listing.livingArea) : null;
  const kostenPct      = metMakelaar ? 0.24 : 0.15;
  const nettoJaarhuur  = maandhuurMarkt * 12 * (1 - kostenPct);
  const brutoyieldPct  = Math.round((maandhuurMarkt * 12 / koopprijs) * 1000) / 10;
  const nettoyieldPct  = Math.round((nettoJaarhuur / koopprijs) * 1000) / 10;
  const groei = 0.025;

  const rendementProjecties = [5, 10, 15].map(j => ({
    jaar: j,
    huur:   Math.round(nettoJaarhuur * j / 1000) * 1000,
    waarde: Math.round(koopprijs * Math.pow(1 + groei, j) / 1000) * 1000,
    totaal: Math.round((nettoJaarhuur * j + koopprijs * (Math.pow(1 + groei, j) - 1)) / 1000) * 1000,
  }));

  const epcKey  = (epcOverride ?? listing.epcLabel)?.toUpperCase().trim() ?? "D";
  const epcInfo = EPC_RENOVATIE[epcKey] ?? EPC_RENOVATIE["D"];
  const paybackJaar = epcInfo.besparing > 0 ? Math.ceil(((epcInfo.min + epcInfo.max) / 2 * 0.65) / epcInfo.besparing) : null;
  const subsidieGem = Math.round((epcInfo.min + epcInfo.max) / 2 * 0.35 / 1000) * 1000;

  const hypotheekScenarios = [3.5, 4.0, 4.5].map(r => {
    const maand  = Math.round(maandlast(lening, r, looptijd));
    const totaal = maand * looptijd * 12;
    return { rente: r, maand, totaal, intrest: totaal - lening };
  });

  const waardeProjecties = [5, 10, 15, 20].map(j => ({
    jaar:   j,
    waarde: Math.round(koopprijs * Math.pow(1 + groei, j) / 1000) * 1000,
    winst:  Math.round(koopprijs * (Math.pow(1 + groei, j) - 1) / 1000) * 1000,
  }));

  // Exploitatiekosten verhuur
  const onderhoud = Math.round(koopprijs * 0.005 / 100) * 100;
  const syndicus  = listing.propertyType?.toLowerCase().includes("apart") ? 1200 : 0;
  const overheff  = Math.round(koopprijs * 0.0025 / 100) * 100;
  const verzek    = 600;

  // Doel selectie scherm
  if (!doel) {
    return (
      <div style={{ background: "#f4f5f8", padding: isMobile ? "24px 12px" : "48px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: isMobile ? 24 : 34, fontWeight: 800, color: "#0D1B3E", marginBottom: 12, letterSpacing: "-0.5px" }}>
              Wat is uw doel met deze aankoop?
            </div>
            <div style={{ fontSize: 15, color: "#64748b" }}>We passen de analyse volledig aan op uw situatie</div>
          </div>

          {/* Keuzekaarten */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {([
              { key: "wonen"      as const, icon: "🏠", label: "Zelf inwonen",  sub: "Energiezuinigheid, renovatiekosten & subsidies" },
              { key: "verhuren"   as const, icon: "📈", label: "Verhuren",      sub: "Huurprijs, rendement & exploitatiekosten" },
              { key: "meerwaarde" as const, icon: "💹", label: "Meerwaarde",    sub: "Waardestijging & ROI op lange termijn" },
            ]).map(opt => (
              <button key={opt.key} onClick={() => setSelectedDoel(opt.key)}
                style={{
                  padding: isMobile ? "18px 16px" : "28px 20px", background: "#fff", cursor: "pointer", textAlign: isMobile ? "left" : "center",
                  borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                  border: selectedDoel === opt.key ? "2.5px solid #3b82f6" : "1.5px solid #e2e8f0",
                  outline: "none", display: isMobile ? "flex" : "block", alignItems: "center", gap: 14,
                }}>
                <div style={{ fontSize: isMobile ? 28 : 42, marginBottom: isMobile ? 0 : 14, flexShrink: 0 }}>{opt.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1B3E", marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* EPC selector */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "0.5px solid #e8eaf0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>🏷️ EPC-label (optioneel):</span>
              <div style={{ display: "flex", gap: 8 }}>
                {["A", "B", "C", "D", "E", "F"].map(label => (
                  <button key={label}
                    onClick={() => setEpcOverride(epcOverride === label ? null : label)}
                    style={{
                      width: 42, height: 42, borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", color: "#0D1B3E",
                      border: epcOverride === label ? "2.5px solid #3b82f6" : "1.5px solid #e2e8f0",
                      background: epcOverride === label ? "#eff6ff" : "#f8fafc",
                      outline: "none",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>Betere data → nauwkeurigere analyse</span>
            </div>
          </div>

          {/* Genereer knop */}
          <button
            onClick={() => selectedDoel && setDoel(selectedDoel)}
            disabled={!selectedDoel}
            style={{
              width: "100%", padding: "18px", fontSize: 16, fontWeight: 800,
              background: selectedDoel ? "#3b82f6" : "#e2e8f0",
              color: selectedDoel ? "#0D1B3E" : "#94a3b8",
              border: "none", borderRadius: 14, cursor: selectedDoel ? "pointer" : "not-allowed",
            }}>
            ⚡ Genereer volledige analyse
          </button>
        </div>
      </div>
    );
  }

  // Volledige analyse
  return (
    <div style={{ background: "#f4f5f8", padding: isMobile ? "16px 12px" : "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1B3E" }}>
            {doel === "wonen" ? "🏠 Eigen bewoning" : doel === "verhuren" ? "📈 Verhuur" : "💹 Meerwaarde lange termijn"}
          </div>
          <button onClick={() => { setDoel(null); setSelectedDoel(null); }}
            style={{ fontSize: 12, color: "#64748b", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
            ← Doel wijzigen
          </button>
        </div>

        {/* ── HYPOTHEEK (altijd) ── */}
        <SectionCard icon="🏦" title="Hypotheekanalyse">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Eigen inbreng</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1B3E", marginBottom: 10 }}>{eigenInbrengPct}% ({fmt(eigenInbreng)})</div>
              <input type="range" min={10} max={50} value={eigenInbrengPct}
                onChange={e => setEigenInbrengPct(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Looptijd</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1B3E", marginBottom: 10 }}>{looptijd} jaar</div>
              <input type="range" min={10} max={30} step={5} value={looptijd}
                onChange={e => setLooptijd(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {hypotheekScenarios.map((s, i) => (
              <div key={i} style={{ background: i === 1 ? "#0D1B3E" : "#f8fafc", borderRadius: 14, padding: "18px 14px", textAlign: "center", border: i === 1 ? "none" : "0.5px solid #e8eaf0" }}>
                <div style={{ fontSize: 12, color: i === 1 ? "#3b82f6" : "#94a3b8", marginBottom: 8, fontWeight: 600 }}>{s.rente}% rente</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: i === 1 ? "#fff" : "#0f172a" }}>
                  {fmt(s.maand)}<span style={{ fontSize: 13, fontWeight: 400 }}>/mnd</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Totaal: {fmt(s.totaal)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Intrest: {fmt(s.intrest)}</div>
              </div>
            ))}
          </div>
          <InfoBox color="blue">
            💡 <strong>Goedkope kredietverstrekkers:</strong> Vergelijk via <strong>Immotheker Finotheker</strong> of <strong>Hypotheekwinkel</strong>. Online spelers: Keytrade Bank, Belfius Online, Hello Bank. Klassieke banken (ING, BNP, KBC) liggen doorgaans 0,2–0,5% hoger.
          </InfoBox>
        </SectionCard>

        {/* ── EIGEN BEWONING: Energieanalyse ── */}
        {doel === "wonen" && (
          <SectionCard icon="⚡" title={`Energiezuinigheid — EPC ${epcKey}`}>
            {epcInfo.min === 0 ? (
              <InfoBox color="green">✅ Uitstekend EPC-label — geen grote renovatiewerken vereist.</InfoBox>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
                  <MetricCard label="Geraamde renovatiekost" value={`${fmt(epcInfo.min)}–${fmt(epcInfo.max)}`} color="#0D1B3E" />
                  {subsidieGem > 0 && <MetricCard label="Verwachte subsidie" value={fmt(subsidieGem)} sub={epcInfo.subsidie} color="#1e40af" />}
                  {subsidieGem > 0 && <MetricCard label="Netto kost (na subsidie)" value={`${fmt(Math.round(epcInfo.min * 0.65 / 1000) * 1000)}–${fmt(Math.round(epcInfo.max * 0.65 / 1000) * 1000)}`} color="#166534" />}
                  <MetricCard label="Jaarlijkse besparing" value={`${fmt(epcInfo.besparing)}/jr`} color="#166534" />
                  {paybackJaar && <MetricCard label="Terugverdientijd (na subsidie)" value={`${paybackJaar} jaar`} color="#d97706" />}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>Aanbevolen werken:</div>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {epcInfo.werken.map((w, i) => (
                      <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 6, lineHeight: 1.5 }}>{w}</li>
                    ))}
                  </ol>
                </div>
                {["E", "F", "G"].includes(epcKey) && isVlaanderen(listing.postalCode) && (
                  <div style={{ marginBottom: 12 }}>
                    <InfoBox color="yellow">⚠️ <strong>Renovatieplicht Vlaanderen:</strong> EPC {epcKey} verplicht renovatie naar minimum label D voor <strong>{new Date().getFullYear() + 6}</strong> (6 jaar na aankoop — VEKA-regelgeving).</InfoBox>
                  </div>
                )}
                <InfoBox color="blue">
                  🔧 <strong>Erkende partners:</strong> Vraag altijd 3 offertes via erkende aannemers. Aanbevolen: <strong>ENCON Energiediensten</strong>, <strong>Luminus EnergyAssist</strong>. Subsidieaanvraag via <strong>mijnverbouwpremie.be</strong>.
                </InfoBox>
              </>
            )}
          </SectionCard>
        )}

        {/* ── VERHUREN ── */}
        {doel === "verhuren" && (
          <>
            <SectionCard icon="📋" title="Verhuuranalyse">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                <MetricCard label="Geschatte huurprijs" value={`${fmt(maandhuurMarkt)}/mnd`} color="#3b82f6" sub={`${fmt(maandhuurMin)} – ${fmt(maandhuurMax)}`} />
                <MetricCard label="Bruto huurrendement" value={`${brutoyieldPct}%`} color="#166534" />
                <MetricCard label={metMakelaar ? "Netto (+ makelaar)" : "Netto rendement"} value={`${nettoyieldPct}%`} color="#1e40af" sub="na exploitatiekosten" />
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Exploitatiekosten (jaarlijks):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {[
                  { icon: "🔧", label: "Onderhoud & herstellingen", waarde: onderhoud },
                  { icon: "🏢", label: "Syndicus / beheer",         waarde: syndicus  },
                  { icon: "🏛",  label: "Onroerende voorheffing",    waarde: overheff  },
                  { icon: "🛡",  label: "Verzekering",               waarde: verzek    },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{k.icon} {k.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1B3E" }}>{fmt(k.waarde)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, marginBottom: 14, cursor: "pointer" }}
                onClick={() => setMetMakelaar(!metMakelaar)}>
                <input type="checkbox" checked={metMakelaar} onChange={() => setMetMakelaar(!metMakelaar)} style={{ accentColor: "#3b82f6" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>
                  <strong>Verhuur via makelaar</strong> — ±9% beheer ({fmt(maandhuurMarkt * 0.09 * 12)}/jaar)
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>Tips om de huurprijs te verhogen:</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {[
                  `EPC verbeteren naar A/B — 5–15% hogere huur${huurPerM2 ? ` (huidig: €${huurPerM2}/m²/mnd)` : ""}`,
                  "Keuken of badkamer renoveren — ROI 80–120%",
                  "Gemeubeld verhuren — 15–25% hogere huur",
                  "Schilderen + opfrissing — lage kost, grote impact bij bezichtiging",
                ].map((t, i) => <li key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{t}</li>)}
              </ul>
            </SectionCard>

            <SectionCard icon="📊" title="Rendementsprognose">
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {rendementProjecties.map((p, i) => (
                  <div key={i} style={{ background: i === 1 ? "#0D1B3E" : "#f8fafc", borderRadius: 14, padding: "20px 14px", textAlign: "center", border: i === 1 ? "none" : "0.5px solid #e8eaf0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: i === 1 ? "#3b82f6" : "#64748b", marginBottom: 10 }}>Na {p.jaar} jaar</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Netto huurinkomsten</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: i === 1 ? "#fff" : "#0f172a" }}>{fmt(p.huur)}</div>
                    <div style={{ height: 1, background: i === 1 ? "#1e3a5f" : "#e2e8f0", margin: "10px 0" }} />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Vastgoedwaarde</div>
                    <div style={{ fontSize: 14, color: i === 1 ? "#e2e8f0" : "#475569" }}>{fmt(p.waarde)}</div>
                    <div style={{ height: 1, background: i === 1 ? "#1e3a5f" : "#e2e8f0", margin: "10px 0" }} />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Totaal return</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: i === 1 ? "#3b82f6" : "#0369a1" }}>{fmt(p.totaal)}</div>
                  </div>
                ))}
              </div>
              <InfoBox color="blue">
                💡 <strong>Aanbevolen houdperiode: minimum 7–10 jaar.</strong> Aankoopkosten bedragen ±15–17% (12% registratierechten voor investering + notaris). Na gemiddeld 7–8 jaar bent u break-even.
              </InfoBox>
            </SectionCard>
          </>
        )}

        {/* ── MEERWAARDE ── */}
        {doel === "meerwaarde" && (
          <SectionCard icon="📈" title="Waardestijgingsanalyse">
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 18, lineHeight: 1.6 }}>
              Belgisch vastgoed stijgt historisch gemiddeld <strong>2,5% per jaar</strong>. Goed gelegen panden in stedelijk gebied halen 3–4%.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
              {waardeProjecties.map((p, i) => (
                <div key={i} style={{ background: i === 1 ? "#0D1B3E" : "#f8fafc", borderRadius: 12, padding: "16px 10px", textAlign: "center", border: i === 1 ? "none" : "0.5px solid #e8eaf0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: i === 1 ? "#3b82f6" : "#94a3b8", marginBottom: 6 }}>Na {p.jaar} jaar</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: i === 1 ? "#fff" : "#0f172a" }}>{fmt(p.waarde)}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>+{fmt(p.winst)}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <InfoBox color="yellow">
                ⚠️ <strong>Break-even bij doorverkoop: ca. {Math.ceil(Math.log(1.06) / Math.log(1 + groei))} jaar.</strong> Door aankoopkosten (±6% eigen woning) duurt het gemiddeld die periode voor de waardestijging de transactiekosten compenseert.
              </InfoBox>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Factoren die de meerwaarde verhogen:</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {[
                "Locatie: stadsrand, nabij openbaar vervoer of grote werkgevers",
                "EPC-label A of B — energiezuinige panden stijgen sneller",
                "Uitbreidingsmogelijkheden: groot perceel of verbouwbare ruimtes",
                "Recente renovatie keuken/badkamer met kwaliteitsmateriaal",
                "Rustige straat in buurt met groeiend dienstenaanbod",
              ].map((f, i) => <li key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5 }}>{f}</li>)}
            </ul>
          </SectionCard>
        )}

        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", paddingTop: 4 }}>
          Alle cijfers zijn indicatief op basis van Belgische marktgemiddelden. Geen financieel, fiscaal of juridisch advies.
        </div>
      </div>
    </div>
  );
}
