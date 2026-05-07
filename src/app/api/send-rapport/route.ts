import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const LEAD_INBOX = "nathan@thynk-agency.com";

function fmt(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function oordeelKleur(kleur: string) {
  if (kleur === "groen") return { bg: "#dcfce7", text: "#166534", label: "✅ Goede prijs" };
  if (kleur === "rood")  return { bg: "#fee2e2", text: "#991b1b", label: "🔴 Overgewaardeerd" };
  return { bg: "#fef9c3", text: "#854d0e", label: "🟡 Licht overgewaardeerd" };
}

function buildEmail(email: string, listing: Record<string, unknown>, prijs: Record<string, unknown>) {
  const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || "Onbekend adres";
  const gemeente = (prijs.gemeente as string) || (listing.municipality as string) || "";
  const kleur = oordeelKleur(prijs.oordeelKleur as string);
  const bidPrijs = Math.round(Math.min(prijs.vraagprijs as number, prijs.marktconformePrijs as number) * 0.965 / 1000) * 1000;
  const epc = (listing.epcLabel as string | null) ?? null;

  const html = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5fb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5fb;padding:32px 16px">
    <tr><td>
      <table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">

        <!-- Header -->
        <tr><td style="background:linear-gradient(160deg,#0f1d45 0%,#1a3366 100%);border-radius:16px 16px 0 0;padding:28px 32px">
          <p style="margin:0;font-size:20px;font-weight:800;color:#fff">Property Analyser</p>
          <p style="margin:4px 0 0;font-size:13px;color:#93afd4">Uw gratis vastgoedanalyse</p>
        </td></tr>

        <!-- Verdict -->
        <tr><td style="background:${kleur.bg};padding:28px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase">${(listing.propertyType as string || "PAND").toUpperCase()} IN ${gemeente.toUpperCase()}</p>
          <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:${kleur.text}">${kleur.label}</p>
          <p style="margin:0;font-size:14px;color:#374151">${prijs.advies}</p>
        </td></tr>

        <!-- Stats -->
        <tr><td style="background:#fff;padding:24px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 8px 0 0;width:33%">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Vraagprijs</p>
                <p style="margin:0;font-size:20px;font-weight:800;color:#0f172a">${fmt(prijs.vraagprijs as number)}</p>
              </td>
              <td style="padding:0 8px;width:33%">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Marktwaarde</p>
                <p style="margin:0;font-size:20px;font-weight:800;color:#0f172a">${fmt(prijs.marktconformePrijs as number)}</p>
                <p style="margin:2px 0 0;font-size:11px;color:#64748b">${fmt(prijs.minimumPrijs as number)} – ${fmt(prijs.maximumPrijs as number)}</p>
              </td>
              <td style="padding:0 0 0 8px;width:33%">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Verschil</p>
                <p style="margin:0;font-size:20px;font-weight:800;color:${kleur.text}">${(prijs.verschilPercent as number) > 0 ? "+" : ""}${prijs.verschilPercent}%</p>
                <p style="margin:2px 0 0;font-size:11px;color:#64748b">${fmt(Math.abs(prijs.verschilBedrag as number))} ${(prijs.verschilBedrag as number) > 0 ? "te duur" : "te goedkoop"}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Bod tip -->
        <tr><td style="background:linear-gradient(160deg,#0f1d45 0%,#1a3366 100%);padding:24px 32px;border-left:1px solid #1a3366;border-right:1px solid #1a3366">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#fff">🤝 Onderhandelingstip</p>
          <p style="margin:0 0 10px;font-size:12px;color:#93afd4">Op basis van onze marktanalyse adviseren wij om te bieden:</p>
          <p style="margin:0;font-size:32px;font-weight:800;color:#60a5fa">€ ${bidPrijs.toLocaleString("nl-BE")}</p>
        </td></tr>

        ${epc && ["E", "F"].includes(epc.toUpperCase()) ? `
        <!-- Renovatieplicht -->
        <tr><td style="background:#fffbeb;padding:18px 32px;border-left:1px solid #fde68a;border-right:1px solid #fde68a">
          <p style="margin:0;font-size:13px;color:#92400e">⚠️ <strong>Renovatieplicht:</strong> EPC ${epc.toUpperCase()} vereist renovatie naar label D voor ${new Date().getFullYear() + 6} (Vlaamse VEKA-regelgeving).</p>
        </td></tr>` : ""}

        <!-- CTA -->
        <tr><td style="background:#fff;padding:28px 32px;text-align:center;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a">Wil je een volledige analyse?</p>
          <p style="margin:0 0 20px;font-size:13px;color:#64748b">Renovatiekosten, rentabiliteit, hypotheek en onderhandelingsadvies op maat.</p>
          <a href="https://property-analyser-dun.vercel.app" style="display:inline-block;padding:14px 36px;background:linear-gradient(160deg,#0f1d45,#1a3366);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px">Open Property Analyser →</a>
          <p style="margin:20px 0 0;font-size:11px;color:#94a3b8">Property Analyser · Vastgoed Lead Factory · nathan@thynk-agency.com</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { adres, gemeente, html };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, listing, prijs } = body;

    if (!email || !listing || !prijs) {
      return NextResponse.json({ error: "Ontbrekende velden" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY ?? "");
    const { adres, gemeente, html } = buildEmail(email, listing, prijs);
    const subject = `Uw property analyse — ${adres}, ${gemeente}`;

    await resend.emails.send({
      from: "Property Analyser <analyse@thynk-agency.com>",
      to: email,
      subject,
      html,
    });

    await resend.emails.send({
      from: "Property Analyser <analyse@thynk-agency.com>",
      to: LEAD_INBOX,
      subject: `🔔 Nieuwe lead: ${email} — ${adres}, ${gemeente}`,
      html: `<p><strong>Lead email:</strong> ${email}</p><p><strong>Pand:</strong> ${adres}, ${gemeente}</p><p><strong>Vraagprijs:</strong> ${fmt(prijs.vraagprijs)}</p><p><strong>Oordeel:</strong> ${prijs.oordeelLabel} (${prijs.verschilPercent > 0 ? "+" : ""}${prijs.verschilPercent}%)</p>` + html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email fout:", err);
    return NextResponse.json({ error: "Email kon niet worden verzonden" }, { status: 500 });
  }
}
