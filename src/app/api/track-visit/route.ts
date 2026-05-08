import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { url, gemeente, vraagprijs, oordeelKleur } = await req.json();
    await supabase.from("bezoeken").insert({ url, gemeente, vraagprijs, oordeel_kleur: oordeelKleur });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
