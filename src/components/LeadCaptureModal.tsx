"use client";
import { useState } from "react";

interface Props {
  onClose: () => void;
  onSuccess: (lead: { voornaam: string; achternaam: string; email: string; telefoon: string }) => void;
  loading: boolean;
}

export function LeadCaptureModal({ onClose, onSuccess, loading }: Props) {
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!voornaam.trim()) e.voornaam = "Verplicht";
    if (!achternaam.trim()) e.achternaam = "Verplicht";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Geldig e-mailadres vereist";
    if (!telefoon.trim()) e.telefoon = "Verplicht";
    return e;
  }

  function submit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSuccess({ voornaam: voornaam.trim(), achternaam: achternaam.trim(), email: email.trim(), telefoon: telefoon.trim() });
  }

  const inp = (err?: string): React.CSSProperties => ({
    width: "100%", padding: "12px 14px", fontSize: 14, borderRadius: 10,
    border: `1.5px solid ${err ? "#ef4444" : "#cbd5e1"}`, outline: "none",
    color: "#0f172a", background: "#fff", boxSizing: "border-box",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />

      {/* Modal */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(160deg, #0D1B3E 0%, #1a3366 100%)", padding: "28px 32px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#E8A020", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Gratis rapport</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>Download uw PDF analyse</div>
          <div style={{ fontSize: 13, color: "#93afd4", marginTop: 6 }}>Volledig rapport van 10 pagina&apos;s — direct in uw mailbox.</div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5, display: "block" }}>Voornaam</label>
              <input value={voornaam} onChange={e => { setVoornaam(e.target.value); setErrors(p => ({ ...p, voornaam: "" })); }}
                placeholder="Jan" style={inp(errors.voornaam)} />
              {errors.voornaam && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.voornaam}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5, display: "block" }}>Achternaam</label>
              <input value={achternaam} onChange={e => { setAchternaam(e.target.value); setErrors(p => ({ ...p, achternaam: "" })); }}
                placeholder="Janssen" style={inp(errors.achternaam)} />
              {errors.achternaam && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.achternaam}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5, display: "block" }}>E-mailadres</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="jan@voorbeeld.be" style={inp(errors.email)} />
            {errors.email && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.email}</div>}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5, display: "block" }}>Telefoonnummer</label>
            <input type="tel" value={telefoon} onChange={e => { setTelefoon(e.target.value); setErrors(p => ({ ...p, telefoon: "" })); }}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="0470 12 34 56" style={inp(errors.telefoon)} />
            {errors.telefoon && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.telefoon}</div>}
          </div>

          <button onClick={submit} disabled={loading}
            style={{ width: "100%", padding: "15px", fontSize: 15, fontWeight: 700, background: loading ? "#94a3b8" : "#E8A020", color: "#fff", border: "none", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.01em" }}>
            {loading ? "Rapport wordt gegenereerd..." : "Download PDF Rapport →"}
          </button>

          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            Uw gegevens worden vertrouwelijk behandeld en niet gedeeld met derden.
          </div>
        </div>
      </div>
    </div>
  );
}
