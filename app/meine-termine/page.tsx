"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const dayLabel = (t: string) => new Date(t).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
const tm = (t: string) => new Date(t).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
const chf = (n: number) => `CHF ${Number(n).toFixed(2)}`;
const att = (v: string | null) => (v === "attended" ? "war da" : v === "no_show" ? "nicht erschienen" : "noch offen");
const statusText: Record<string, string> = {
  pending: "Angefragt, wartet auf Bestätigung",
  confirmed: "Bestätigt",
  declined: "Abgelehnt",
};

export default function MyBookings() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.push("/login?next=/meine-termine"); return; }
    const { data } = await supabase.from("my_bookings").select("*").order("starts_at");
    setRows(data ?? []);
    setReady(true);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function cancel(id: string) {
    if (!confirm("Termin wirklich stornieren?")) return;
    const { data } = await supabase.from("bookings").delete().eq("id", id).select();
    if (!data?.length) alert("Stornierung nicht mehr möglich (weniger als 2 Std. vor Beginn).");
    load();
  }
  async function setAtt(id: string, attended: boolean) {
    const { error } = await supabase.rpc("set_attendance", { p_booking_id: id, p_as: "customer", p_attended: attended });
    if (error) alert(error.message);
    load();
  }

  if (!ready) return <main>Lädt ...</main>;

  const now = Date.now();
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const ended = (r: any) => new Date(r.ends_at).getTime() < now;
  const needsAtt = (r: any) => r.status === "confirmed" && r.customer_attendance == null && ended(r);
  const visible = rows.filter((r) => new Date(r.starts_at) >= startToday || needsAtt(r));

  return (
    <main>
      <h1>Meine Termine</h1>
      {visible.length === 0 && <p>Du hast keine anstehenden Termine. <Link href="/">Termine suchen</Link></p>}
      {visible.map((r) => {
        const mismatch = r.provider_attendance && r.customer_attendance && r.provider_attendance !== r.customer_attendance;
        return (
          <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, margin: "10px 0" }}>
            <b>{dayLabel(r.starts_at)}, {tm(r.starts_at)} - {tm(r.ends_at)}</b>
            <div>{r.provider_name} · {r.street}, {r.plz} {r.city}{r.phone ? ` · ${r.phone}` : ""}</div>
            <div style={{ marginTop: 4 }}>{r.services_text ?? "keine Leistungen"} · <b>{chf(r.total_chf)}</b></div>
            <div style={{ marginTop: 4, fontWeight: 600, color: r.status === "confirmed" ? "#15803d" : r.status === "declined" ? "#b91c1c" : "#a16207" }}>{statusText[r.status] ?? r.status}</div>

            {(r.status === "pending" || r.status === "confirmed") && !ended(r) && (
              <div style={{ marginTop: 8 }}><button onClick={() => cancel(r.id)}>Stornieren</button></div>
            )}

            {r.status === "confirmed" && ended(r) && (
              <div style={{ marginTop: 8 }}>
                {r.customer_attendance == null ? (
                  <span>
                    Warst du beim Termin?{" "}
                    <button onClick={() => setAtt(r.id, true)}>Ja, ich war da</button>{" "}
                    <button onClick={() => setAtt(r.id, false)}>Nein, nicht erschienen</button>
                  </span>
                ) : (
                  <span>Deine Angabe: <b>{att(r.customer_attendance)}</b></span>
                )}
                <div style={{ marginTop: 4, color: "var(--mut)" }}>Angabe des Anbieters: {att(r.provider_attendance)}</div>
                {mismatch && <div style={{ marginTop: 4, color: "crimson" }}>Unterschiedliche Angaben, bitte klärt das direkt miteinander.</div>}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
