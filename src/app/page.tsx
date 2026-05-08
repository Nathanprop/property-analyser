"use client";
import { useState } from "react";
import { VolleAnalyse } from "./volledige-analyse";
import { useIsMobile } from "@/lib/use-is-mobile";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";

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

function isVlaanderen(postalCode: string | null): boolean {
  if (!postalCode) return false;
  const pc = parseInt(postalCode, 10);
  return (pc >= 1500 && pc <= 3999) || (pc >= 8000 && pc <= 9999);
}

const KLEUREN = {
  groen:  { bar: "#22c55e", text: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  oranje: { bar: "#f59e0b", text: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  rood:   { bar: "#ef4444", text: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showVolleAnalyse, setShowVolleAnalyse] = useState(false);
  const isMobile = useIsMobile();
  const [showModal, setShowModal] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("property-analyse.pdf");
  const [reportError, setReportError] = useState<string | null>(null);

  async function analyseer() {
    if (!url.trim()) return;
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    setLoading(true); setError(null); setResult(null); setShowVolleAnalyse(false); setShowModal(false); setReportSent(false); setReportEmail(""); setReportError(null);
    try {
      const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Onbekende fout");
      setResult(data);
      if (data?.analyse?.prijs) {
        fetch("/api/track-visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), gemeente: data.analyse.prijs.gemeente, vraagprijs: data.analyse.prijs.vraagprijs, oordeelKleur: data.analyse.prijs.oordeelKleur }),
        }).catch(() => {});
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Er ging iets mis"); }
    finally { setLoading(false); }
  }

  async function handleLeadSubmit(lead: { voornaam: string; achternaam: string; email: string; telefoon: string }) {
    if (!result?.analyse?.prijs || !result?.listing) return;
    setReportSending(true);
    setReportError(null);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, listing: result.listing, prijs: result.analyse.prijs, url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setReportError(data.error ?? `Server fout (${res.status})`);
      } else if (data.pdf) {
        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
        setPdfFilename(data.filename ?? "property-analyse.pdf");
      } else {
        setReportError("PDF werd niet teruggestuurd door de server.");
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Netwerk fout bij PDF generatie");
    }
    setReportSending(false);
    setReportEmail(lead.email);
    setReportSent(true);
    setShowModal(false);
    setShowVolleAnalyse(true);
  }

  const prijs = result?.analyse?.prijs;
  const listing = result?.listing;
  const kleur = prijs ? KLEUREN[prijs.oordeelKleur] : null;

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5fb", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#0f1d45", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "18px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>Property Analyser</div>
            <div style={{ fontSize: 12, color: "#93afd4", marginTop: 2 }}>Eerlijke vastgoedanalyse</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: 20, letterSpacing: "0.07em", border: "1px solid rgba(255,255,255,0.15)" }}>BETA</div>
        </div>
      </div>

      {/* Input zone */}
      <div style={{ background: "linear-gradient(160deg, #0f1d45 0%, #1a3366 100%)", padding: isMobile ? "36px 16px 32px" : "56px 24px 48px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.5px", lineHeight: 1.2 }}>Weet wat het echt waard is.</div>
          <div style={{ fontSize: isMobile ? 14 : 15, color: "#93afd4", marginBottom: 24 }}>Plak een link van Immoweb, Zimmo of Realo — eerlijke analyse in seconden.</div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
            <input
              type="text" value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyseer()}
              placeholder="https://www.immoweb.be/nl/zoekertje/..."
              style={{ flex: 1, padding: "15px 18px", fontSize: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, color: "#fff", outline: "none" }}
            />
            <button onClick={analyseer} disabled={loading || !url.trim()}
              style={{ padding: "15px 28px", fontSize: 14, fontWeight: 700, background: loading ? "rgba(255,255,255,0.08)" : "#fff", color: loading ? "#64748b" : "#0f1d45", border: "none", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
              {loading ? "Analyseren..." : "Analyseer →"}
            </button>
          </div>
          {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 8, fontSize: 13, color: "#991b1b" }}>{error}</div>}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ background: "#f4f5f8", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: "#64748b" }}>Analyseren... even geduld</div>
        </div>
      )}

      {/* Error: geen analyse mogelijk */}
      {result && !prijs && listing && (
        <div style={{ background: "#f4f5f8", padding: "32px 24px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 16, padding: "28px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>Analyse niet mogelijk</div>
              <div style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 12 }}>De pagina werd geladen maar de nodige data kon niet worden uitgelezen.</div>
              <ul style={{ fontSize: 13, color: "#991b1b", paddingLeft: 20, margin: "0 0 16px" }}>
                {listing.warnings.length > 0
                  ? listing.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)
                  : <li>Onbekende fout bij het uitlezen van de listing</li>}
              </ul>
              <div style={{ fontSize: 12, color: "#64748b" }}>Probeer een andere listing of controleer of de URL correct is.</div>
            </div>
          </div>
        </div>
      )}

      {/* Analyseresultaten */}
      {result && prijs && listing && kleur && (
        <div style={{ background: "#f4f5f8", padding: isMobile ? "16px 12px" : "32px 24px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>

            {/* Verdict card */}
            <div style={{ background: kleur.bg, border: `2px solid ${kleur.border}`, borderRadius: 20, padding: isMobile ? "20px 16px" : "28px 32px", marginBottom: 14, position: "relative" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                {(listing.propertyType ?? "Pand").toUpperCase()} IN {prijs.gemeente.toUpperCase()}{listing.postalCode ? ` (${listing.postalCode})` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: kleur.text, marginBottom: 10, letterSpacing: "-0.5px" }}>{prijs.oordeelLabel}</div>
                  <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.65 }}>{prijs.advies}</div>
                </div>
                <div style={{ width: isMobile ? 68 : 84, height: isMobile ? 68 : 84, borderRadius: "50%", border: `3px solid ${kleur.text}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800, color: kleur.text, lineHeight: 1 }}>{prijs.verschilPercent > 0 ? "+" : ""}{prijs.verschilPercent}%</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>vs. markt</div>
                </div>
              </div>
              {/* Price range bar */}
              {(() => {
                const range = prijs.maximumPrijs - prijs.minimumPrijs;
                const pct = range > 0 ? Math.min(93, Math.max(7, ((prijs.vraagprijs - prijs.minimumPrijs) / range) * 100)) : 50;
                return (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                      <span>Min. {fmt(prijs.minimumPrijs)}</span>
                      <span style={{ fontWeight: 700, color: kleur.text }}>Vraagprijs {fmt(prijs.vraagprijs)}</span>
                      <span>Max. {fmt(prijs.maximumPrijs)}</span>
                    </div>
                    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "#e2e8f0" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: kleur.bar, borderRadius: 4 }} />
                      <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", border: `3px solid ${kleur.text}`, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4 stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
              {[
                { icon: "💰", label: "VRAAGPRIJS",   value: fmt(prijs.vraagprijs),             sub: null },
                { icon: "📊", label: "MARKTWAARDE",  value: fmt(prijs.marktconformePrijs),      sub: `${fmt(prijs.minimumPrijs)} – ${fmt(prijs.maximumPrijs)}` },
                { icon: "↕",  label: "VERSCHIL",     value: fmt(Math.abs(prijs.verschilBedrag)), sub: prijs.verschilBedrag > 0 ? "te duur" : "te goedkoop" },
                ...(prijs.prijsPerM2 ? [{ icon: "📐", label: "PRIJS/M²", value: `€ ${prijs.prijsPerM2.toLocaleString("nl-BE")}`, sub: `markt: €${prijs.marktPrijsPerM2.toLocaleString("nl-BE")}` }] : []),
              ].map((item, i) => (
                <div key={i} style={{ background: "#fff", border: "0.5px solid #e8eaf0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", marginBottom: 6 }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{item.sub}</div>}
                </div>
              ))}
            </div>

            {/* Betrouwbaarheid */}
            <div style={{ background: "#fff", border: "0.5px solid #e8eaf0", borderRadius: 12, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < (prijs.betrouwbaarheid === "hoog" ? 3 : prijs.betrouwbaarheid === "midden" ? 2 : 1) ? kleur.text : "#e2e8f0" }} />
                ))}
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Betrouwbaarheid: <strong style={{ color: "#374151" }}>{prijs.betrouwbaarheid}</strong> — indicatief, niet bindend
              </div>
            </div>

            {/* Wettelijke Check */}
            {(() => {
              const epc = (listing.epcLabel ?? prijs.epcLabel ?? "").toUpperCase().trim();
              if (!["E", "F"].includes(epc) || !isVlaanderen(listing.postalCode)) return null;
              const deadline = new Date().getFullYear() + 6;
              return (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "16px 20px", marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Wettelijke renovatieplicht (Vlaanderen)</div>
                    <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
                      Let op: Voor dit pand (EPC {epc}) geldt een renovatieplicht tot minimaal label D voor <strong>{deadline}</strong>. U heeft 6 jaar na aankoop om te renoveren — verplicht door VEKA.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Onderhandelingstip */}
            {(() => {
              const bidPrijs = Math.round(Math.min(prijs.vraagprijs, prijs.marktconformePrijs) * 0.965 / 1000) * 1000;
              const tekst = prijs.verschilPercent > 5
                ? `Op basis van de overwaardering van +${prijs.verschilPercent}% is er duidelijke onderhandelingsruimte. Bied:`
                : prijs.verschilPercent > 0
                ? `Op basis van de lichte overwaardering is er beperkte onderhandelingsruimte. Bied:`
                : `Op basis van de marktafwijking van ${prijs.verschilPercent}% is er beperkte ruimte om te onderhandelen. Bied:`;
              return (
                <div style={{ background: "#0D1B3E", borderRadius: 16, padding: isMobile ? "20px 16px" : "24px 28px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>🤝</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Onderhandelingstip</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>{tekst}</div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#60a5fa" }}>€ {bidPrijs.toLocaleString("nl-BE")}</div>
                </div>
              );
            })()}

            {/* CTA — PDF Rapport */}
            <div style={{ background: "linear-gradient(160deg, #0D1B3E 0%, #1a3366 100%)", borderRadius: 16, padding: isMobile ? "24px 16px" : "30px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#E8A020", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Gratis PDF rapport</div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Download uw volledige analyse</div>
              <div style={{ fontSize: 14, color: "#93afd4", marginBottom: 22 }}>10 pagina&apos;s: hypotheek, verhuur, renovatie, aankoopkosten — direct in uw mailbox.</div>

              {!reportSent && (
                <button onClick={() => setShowModal(true)}
                  style={{ padding: "15px 40px", fontSize: 15, fontWeight: 700, background: "#E8A020", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 14px rgba(232,160,32,0.4)" }}>
                  Download PDF Rapport →
                </button>
              )}

              {reportSent && !reportError && (
                <div style={{ fontSize: 14, color: "#93afd4" }}>
                  ✅ PDF rapport verstuurd naar <strong style={{ color: "#fff" }}>{reportEmail}</strong>
                </div>
              )}

              {reportError && (
                <div style={{ background: "#fee2e2", borderRadius: 10, padding: "12px 16px", maxWidth: 480, margin: "0 auto" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 4 }}>Fout bij PDF generatie</div>
                  <div style={{ fontSize: 12, color: "#7f1d1d" }}>{reportError}</div>
                  <button onClick={() => { setReportSent(false); setReportError(null); setShowModal(true); }}
                    style={{ marginTop: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, background: "#991b1b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    Opnieuw proberen
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfBlobUrl && (
        <div style={{ background: "#f4f5f8", padding: isMobile ? "12px" : "24px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              {/* Toolbar */}
              <div style={{ background: "#0D1B3E", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Uw PDF Rapport</div>
                  <div style={{ fontSize: 11, color: "#93afd4", marginTop: 2 }}>verstuurd naar {reportEmail}</div>
                </div>
                <a href={pdfBlobUrl} download={pdfFilename}
                  style={{ padding: "9px 18px", background: "#E8A020", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                  ⬇ Download PDF
                </a>
              </div>
              {/* Iframe viewer */}
              {!isMobile ? (
                <iframe src={pdfBlobUrl} style={{ width: "100%", height: 800, border: "none", display: "block" }} title="PDF Rapport" />
              ) : (
                <div style={{ padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>PDF is verstuurd naar uw mailbox. Op mobiel kan u de PDF downloaden via onderstaande knop.</div>
                  <a href={pdfBlobUrl} download={pdfFilename}
                    style={{ display: "inline-block", padding: "14px 28px", background: "#E8A020", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                    ⬇ Download PDF Rapport
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Volledige analyse */}
      {result && prijs && listing && showVolleAnalyse && (
        <VolleAnalyse listing={listing} prijs={prijs} />
      )}

      {/* Lead capture modal */}
      {showModal && (
        <LeadCaptureModal
          onClose={() => setShowModal(false)}
          onSuccess={handleLeadSubmit}
          loading={reportSending}
        />
      )}

      {/* Footer */}
      {!result && !loading && (
        <div style={{ padding: "48px 24px", textAlign: "center", borderTop: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>Ondersteunt Immoweb · Zimmo · Realo</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Een initiatief van Vastgoed Lead Factory · nathan@thynk-agency.com</div>
        </div>
      )}
    </main>
  );
}
