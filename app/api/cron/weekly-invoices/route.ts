import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

type Provider = {
  name: string;
  email: string;
  street: string;
  zip: string;
  city: string;
};

function buildPdf(inv: {
  invoice_no: number;
  amount_chf: number;
  period_start: string;
  period_end: string;
  due_at: string;
  provider: Provider;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.fontSize(18).text(process.env.CREDITOR_NAME!, 50, 50);
    pdf
      .fontSize(10)
      .text(
        `${process.env.CREDITOR_ADDRESS}, ${process.env.CREDITOR_ZIP} ${process.env.CREDITOR_CITY}`
      );
    pdf.moveDown(2);
    pdf
      .text(inv.provider.name)
      .text(inv.provider.street)
      .text(`${inv.provider.zip} ${inv.provider.city}`);
    pdf.moveDown(2);
    pdf.fontSize(14).text(`Rechnung Nr. ${inv.invoice_no}`);
    pdf
      .fontSize(10)
      .moveDown()
      .text(`Provision Vacanto, ${inv.period_start} bis ${inv.period_end}`);
    pdf.text(`Betrag: CHF ${inv.amount_chf.toFixed(2)}`);
    pdf.text(`Zahlbar bis: ${inv.due_at}`);

    const qr = new SwissQRBill({
      amount: inv.amount_chf,
      currency: "CHF",
      creditor: {
        account: process.env.CREDITOR_IBAN!,
        name: process.env.CREDITOR_NAME!,
        address: process.env.CREDITOR_ADDRESS!,
        zip: Number(process.env.CREDITOR_ZIP),
        city: process.env.CREDITOR_CITY!,
        country: "CH",
      },
      debtor: {
        name: inv.provider.name,
        address: inv.provider.street,
        zip: Number(inv.provider.zip),
        city: inv.provider.city,
        country: "CH",
      },
      additionalInformation: `Rechnung ${inv.invoice_no}`,
    });
    qr.attachTo(pdf);
    pdf.end();
  });
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

    const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY",
    "COMMISSION_RATE", "MIN_INVOICE_CHF", "CREDITOR_NAME", "CREDITOR_ADDRESS",
    "CREDITOR_ZIP", "CREDITOR_CITY", "CREDITOR_IBAN",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: "missing env variables", missing }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  const rate = Number(process.env.COMMISSION_RATE);
  const min = Number(process.env.MIN_INVOICE_CHF);

  // Vorwoche: Montag 00:00 bis Sonntag 23:59 (UTC)
  const now = new Date();
  const thisMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  thisMonday.setUTCDate(thisMonday.getUTCDate() - ((thisMonday.getUTCDay() + 6) % 7));
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // ANNAHME: bookings(provider_id, price, status, starts_at); status 'attended' = erschienen
    const { data: bookings, error } = await supabase
    .from("billable_bookings")
    .select("provider_id, price")
    .gte("starts_at", lastMonday.toISOString())
    .lt("starts_at", thisMonday.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Map<string, number>();
  for (const b of bookings ?? []) {
    totals.set(b.provider_id, (totals.get(b.provider_id) ?? 0) + Number(b.price));
  }

  const results: string[] = [];

  for (const [providerId, sum] of totals) {
    const amount = Math.round(sum * rate * 100) / 100;
    if (amount < min) continue;

    const due = new Date(thisMonday);
    due.setUTCDate(due.getUTCDate() + 10);

    const { data: inv, error: insErr } = await supabase
      .from("invoices")
      .insert({
        provider_id: providerId,
        period_start: iso(lastMonday),
        period_end: iso(lastSunday),
        amount_chf: amount,
        due_at: iso(due),
      })
      .select()
      .single();
    if (insErr || !inv) continue; // unique-Constraint verhindert Doppelrechnungen

    // ANNAHME: providers(id, name, email, street, zip, city)
          const { data: p } = await supabase
      .from("providers")
      .select("name, street, plz, city")
      .eq("id", providerId)
      .single();
    if (!p) continue;
    const { data: userRes } = await supabase.auth.admin.getUserById(providerId);
    const email = userRes?.user?.email;
    if (!email) continue;
    const provider = { name: p.name, email, street: p.street, zip: p.plz, city: p.city };

    await resend.emails.send({
      from: "Vacanto <rechnung@vacanto.ch>",
      to: provider.email,
      subject: `Rechnung ${inv.invoice_no}: Provision ${iso(lastMonday)} bis ${iso(lastSunday)}`,
      text: `Guten Tag\n\nAnbei die Provisionsrechnung über CHF ${amount.toFixed(2)}. Zahlbar bis ${iso(due)}.\n\nFreundliche Grüsse\nVacanto`,
      attachments: [{ filename: `Rechnung-${inv.invoice_no}.pdf`, content: pdf }],
    });

    await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", inv.id);
    results.push(`${providerId}: CHF ${amount}`);
  }

  return NextResponse.json({ ok: true, invoices: results });
}
