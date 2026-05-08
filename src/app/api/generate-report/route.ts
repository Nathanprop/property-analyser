import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead, listing, prijs, url } = body;

    if (!lead?.email || !listing || !prijs) {
      return NextResponse.json({ error: "Ontbrekende velden" }, { status: 400 });
    }

    // Dynamic import to avoid build-time issues with react-pdf
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PropertyPDFDocument } = await import("@/lib/property-pdf");
    const React = await import("react");

    const doc = React.createElement(PropertyPDFDocument, { lead, listing, prijs, url: url ?? "" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(doc as any);
    const pdfBase64 = pdfBuffer.toString("base64");

    const adres = [listing.street, listing.houseNumber].filter(Boolean).join(" ") || listing.municipality || "Onbekend adres";
    const gemeente = prijs.gemeente || listing.municipality || "";

    const resend = new Resend(process.env.RESEND_API_KEY ?? "");

    const htmlEmail = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5fb;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5fb;padding:32px 16px">
    <tr><td>
      <table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
        <tr><td style="background:linear-gradient(160deg,#0D1B3E 0%,#1a3366 100%);border-radius:16px 16px 0 0;padding:28px 32px">
          <p style="margin:0;font-size:20px;font-weight:800;color:#fff">Property Analyser</p>
          <p style="margin:4px 0 0;font-size:13px;color:#93afd4">Uw vastgoedrapport</p>
        </td></tr>
        <tr><td style="background:#fff;padding:28px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a">Beste ${lead.voornaam},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6">
            In bijlage vindt u uw persoonlijk Property Analyser rapport voor <strong>${adres}, ${gemeente}</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px;width:100%;margin-bottom:16px">
            <tr><td style="padding:4px 0"><span style="font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase">Vraagprijs</span></td>
                <td style="text-align:right"><span style="font-size:13px;font-weight:700;color:#0f172a">€ ${prijs.vraagprijs.toLocaleString("nl-BE")}</span></td></tr>
            <tr><td style="padding:4px 0"><span style="font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase">Marktwaarde</span></td>
                <td style="text-align:right"><span style="font-size:13px;font-weight:700;color:#0f172a">€ ${prijs.marktconformePrijs.toLocaleString("nl-BE")}</span></td></tr>
            <tr><td style="padding:4px 0"><span style="font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase">Oordeel</span></td>
                <td style="text-align:right"><span style="font-size:13px;font-weight:700;color:#0f172a">${prijs.oordeelLabel}</span></td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.6">
            Het rapport bevat een volledige analyse inclusief hypotheeksimulatie, verhuurpotentieel, aankoopkosten, energieanalyse en onderhandelingstips.
          </p>
          <a href="https://property-analyser-dun.vercel.app" style="display:inline-block;padding:14px 28px;background:linear-gradient(160deg,#0D1B3E,#1a3366);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px">Open Property Analyser →</a>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;text-align:center">
          <p style="margin:0;font-size:11px;color:#94a3b8">Property Analyser · Vastgoed Lead Factory · nathan@thynk-agency.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const filename = `property-analyse-${gemeente.toLowerCase().replace(/\s+/g, "-")}.pdf`;

    // Fire-and-forget: email + Supabase don't block the PDF response
    Promise.all([
      resend.emails.send({
        from: "Property Analyser <analyse@thynk-agency.com>",
        to: lead.email,
        subject: `Uw Property Analyser rapport — ${adres}, ${gemeente}`,
        html: htmlEmail,
        attachments: [{ filename, content: pdfBase64 }],
      }),
      resend.emails.send({
        from: "Property Analyser <analyse@thynk-agency.com>",
        to: "nathan@thynk-agency.com",
        subject: `🔔 Nieuwe lead: ${lead.voornaam} ${lead.achternaam} — ${adres}, ${gemeente}`,
        html: `<p><strong>Naam:</strong> ${lead.voornaam} ${lead.achternaam}</p><p><strong>Email:</strong> ${lead.email}</p><p><strong>Telefoon:</strong> ${lead.telefoon}</p><p><strong>Pand:</strong> ${adres}, ${gemeente}</p><p><strong>Vraagprijs:</strong> € ${prijs.vraagprijs.toLocaleString("nl-BE")}</p><p><strong>Oordeel:</strong> ${prijs.oordeelLabel} (${prijs.verschilPercent > 0 ? "+" : ""}${prijs.verschilPercent}%)</p>`,
        attachments: [{ filename, content: pdfBase64 }],
      }),
      supabase.from("leads").insert({
        email: lead.email,
        telefoon: lead.telefoon,
        voornaam: lead.voornaam,
        achternaam: lead.achternaam,
        adres,
        gemeente,
        vraagprijs: prijs.vraagprijs,
        marktwaarde: prijs.marktconformePrijs,
        oordeel: prijs.oordeelLabel,
        oordeel_kleur: prijs.oordeelKleur,
        verschil_percent: prijs.verschilPercent,
        url: url ?? null,
      }),
    ]).catch(err => console.error("Email/Supabase fout (niet-blokkerend):", err));

    // Return PDF directly so browser can display it immediately
    return NextResponse.json({ ok: true, pdf: pdfBase64, filename });
  } catch (err) {
    console.error("generate-report fout:", err);
    return NextResponse.json({ error: "Rapport kon niet worden gegenereerd" }, { status: 500 });
  }
}
