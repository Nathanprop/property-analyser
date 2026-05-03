"use client";
import { useState } from "react";

interface PrijsAnalyse {
  oordeel: string;
  oordeelLabel: string;
  oordeelKleur: "groen" | "oranje" | "rood";
  verschilPercent: number;
  verschilBedrag: number;
  vraagprijs: number;
  marktconformePrijs: number;
  minimumPrijs: number;
  maximumPrijs: number;
  prijsPerM2: number | null;
  marktPrijsPerM2: number;
  gemeente: string;
  betrouwbaarheid: "hoog" | "midden" | "laag";
  epcLabel: string | null;
  epcImpact: number;
  epcBedrag: number;
  factoren: { naam: string; impact: string; beschrijving: string; correctie: number }[];
  advies: string;
  biedingsadvies: string | null;
  biedingsbandbreedte: { min: number; max: number } | null;
}

interface AnalyseResult {
  listing: { source: string; municipality: string | null; postalCode: string | null; price: number | null; livingArea: number | null; bedrooms: number | null; epcLabel: string | null; propertyType: string | null; warnings: string[]; };
  analyse: { prijs: PrijsAnalyse | null };
  meta: { dataKwaliteit: string; waarschuwingen: string[] };
}

function fmt(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyseer() {
    if (!url.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Onbekende fout");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Er ging iets mis"); }
    finally { setLoading(false); }
  }

  const prijs = result?.analyse?.prijs;
  const listing = result?.listing;
  const kleurMap = {
    groen: { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
    oranje: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", badge: "#fef3c7" },
    rood: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2" },
  };
  const kleur = prijs ? kleurMap[prijs.oordeelKleur] : null;

  return (
    <main style={{ minHeight: "100vh", background: "#0D1B3E", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0D1B3E", borderBottom: "3px solid #E8A020", padding: "20px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#fff" }}>Property Analyser</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Eerlijke vastgoedanalyse</div>
          </div>
          <div style={{ fontSize: 11, color: "#E8A020", background: "#1e3a5f", padding: "4px 10px", borderRadius: 20 }}>BETA</div>
        </div>
      </div>

      <div style={{ background: "#0D1B3E", padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: "#fff", marginBottom: 8 }}>Weet wat het echt waard is.</div>
          <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: 28 }}>Plak een link van Immoweb, Zimmo of Realo — eerlijke analyse in seconden.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && analyseer()} placeholder="https://www.immoweb.be/nl/zoekertje/..." style={{ flex: 1, padding: "14px 16px", fontSize: 14, background: "#1e3a5f", border: "1px solid #2d4f7c", borderRadius: 10, color: "#fff", outline: "none" }} />
            <button onClick={analyseer} disabled={loading || !url.trim()} style={{ padding: "14px 24px", fontSize: 14, fontWeight: 500, background: loading ? "#2d4f7c" : "#E8A020", color: loading ? "#94a3b8" : "#0D1B3E", border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Analyseren..." : "Analyseer →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 8, fontSize: 13, color: "#991b1b" }}>{error}</div>}
        </div>
      </div>

      {result && prijs && listing && (
        <div style={{ background: "#f8fafc", minHeight: "60vh", padding: "32px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ background: kleur!.bg, border: `1.5px solid ${kleur!.border}`, borderRadius: 14, padding: "24px 28px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>{listing.propertyType ?? "Pand"} in {prijs.gemeente} {listing.postalCode ? `(${listing.postalCode})` : ""}</div>
                  <div style={{ fontSize: 26, fontWeight: 500, color: kleur!.text, marginBottom: 4 }}>{prijs.oordeelLabel}</div>
                  <div style={{ fontSize: 14, color: "#475569" }}>{prijs.advies}</div>
                </div>
                <div style={{ background: kleur!.badge, border: `1px solid ${kleur!.border}`, borderRadius: 10, padding: "12px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 500, color: kleur!.text }}>{prijs.verschilPercent > 0 ? "+" : ""}{prijs.verschilPercent}%</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>vs. markt</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Vraagprijs", value: fmt(prijs.vraagprijs), sub: null },
                { label: "Marktwaarde", value: fmt(prijs.marktconformePrijs), sub: `${fmt(prijs.minimumPrijs)} – ${fmt(prijs.maximumPrijs)}` },
                { label: "Verschil", value: fmt(Math.abs(prijs.verschilBedrag)), sub: prijs.verschilBedrag > 0 ? "te duur" : "te goedkoop" },
                ...(prijs.prijsPerM2 ? [{ label: "Prijs per m²", value: `€${prijs.prijsPerM2.toLocaleString("nl-BE")}`, sub: `markt: €${prijs.marktPrijsPerM2.toLocaleString("nl-BE")}` }] : []),
              ].map((item, i) => (
                <div key={i} style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: "#0f172a" }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.sub}</div>}
                </div>
              ))}
            </div>

            {prijs.biedingsadvies && prijs.biedingsbandbreedte && (
              <div style={{ background: "#0D1B3E", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#E8A020", marginBottom: 6 }}>Biedingsadvies</div>
                <div style={{ fontSize: 15, color: "#fff", marginBottom: 4 }}>{prijs.biedingsadvies}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Bandbreedte: {fmt(prijs.biedingsbandbreedte.min)} – {fmt(prijs.biedingsbandbreedte.max)}</div>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", paddingTop: 8 }}>
              Betrouwbaarheid: {prijs.betrouwbaarheid} — indicatief, niet bindend
            </div>
          </div>
        </div>
      )}

      {loading && <div style={{ background: "#f8fafc", padding: "60px 24px", textAlign: "center" }}><div style={{ fontSize: 15, color: "#64748b" }}>Analyseren...</div></div>}

      {!result && !loading && (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#475569" }}>Ondersteunt Immoweb · Zimmo · Realo · ERA</div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 8 }}>Een initiatief van Vastgoed Lead Factory · nathan@thynk-agency.com</div>
        </div>
      )}
    </main>
  );
}
