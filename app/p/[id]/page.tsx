"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BookingForm from "@/components/BookingForm";

const day = (t: string) => new Date(t).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
const time = (t: string) => new Date(t).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

export default function Provider() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [mine, setMine] = useState<Record<string, any>>({});
  const [user, setUser] = useState<any>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setUser(u.user);
    const { data: pr } = await supabase.from("providers").select("*").eq("id", id).single();
    setP(pr);
    const { data: sv } = await supabase.from("services").select("*").eq("provider_id", id).eq("active", true).order("created_at");
    setServices(sv ?? []);
    const { data: s } = await supabase.from("slots_board").select("*").eq("provider_id", id).order("starts_at");
    setSlots(s ?? []);
    if (u.user) {
      const { data: b } = await supabase.from("my_bookings").select("id,slot_id,status,total_chf,services_text")
        .eq("provider_id", id).in("status", ["pending", "confirmed"]);
      setMine(Object.fromEntries((b ?? []).map((x: any) => [x.slot_id, { id: x.id, status: x.status, total: x.total_chf, services: x.services_text }])));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function openBooking(slotId: string) {
    if (!user) return router.push(`/login?next=/p/${id}`);
    setOpenSlot(openSlot === slotId ? null : slotId);
  }
  async function cancel(bookingId: string) {
    if (!confirm("Termin wirklich stornieren?")) return;
    const { data } = await supabase.from("bookings").delete().eq("id", bookingId).select();
    if (!data?.length) alert("Stornierung nicht mehr möglich (weniger als 2 Std. vor Beginn).");
    load();
  }

  if (!p) return <main style={{ padding: 20 }}>Lädt ...</main>; if (p.paused) return <main style={{ padding: 20 }}><h1>{p.name}</h1><p>Dieser Anbieter ist derzeit nicht verfügbar.</p></main>;
  const days: Record<string, any[]> = {};
  slots.forEach((s) => (days[day(s.starts_at)] ??= []).push(s));

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
      <h1>{p.name}</h1>
      <p>{p.category}<br />{p.street}, {p.plz} {p.city}{p.phone && <><br />{p.phone}</>}</p>
      {services.length > 0 && (
        <>
          <h2>Preise</h2>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            {services.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>{x.name}</span><b>{x.price} CHF</b>
              </div>
            ))}
          </div>
        </>
      )}
      <h2>Kalender</h2>
      {Object.keys(days).length === 0 && <p>Keine freien Termine eingetragen.</p>}
      {Object.entries(days).map(([d, list]) => (
        <div key={d} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, margin: "10px 0" }}>
          <b>{d}</b>
          {list.map((s) => (
            <div key={s.id} style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {time(s.starts_at)} - {time(s.ends_at)}
                  {s.discount_pct > 0 && !s.booked && (
                    <span style={{ marginLeft: 8, background: "#e8590c", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 700 }}>
                      Last Minute -{s.discount_pct}%
                    </span>
                  )}
                </span>
                {mine[s.id] ? (
                  <span>
                    {mine[s.id].status === "confirmed" ? "Dein Termin" : "Angefragt"}{" "}
                    <button onClick={() => cancel(mine[s.id].id)}>Stornieren</button>
                  </span>
                ) : s.booked ? (
                  <span style={{ color: "#999" }}>besetzt</span>
                ) : (
                  <button onClick={() => openBooking(s.id)}>{openSlot === s.id ? "Schliessen" : "Buchen"}</button>
                )}
              </div>
              {mine[s.id] && (
                <div style={{ marginTop: 4, color: "var(--mut)" }}>
                  {mine[s.id].services ?? "keine Leistungen"} · <b style={{ color: "var(--fg)" }}>CHF {Number(mine[s.id].total).toFixed(2)}</b>
                </div>
              )}
              {openSlot === s.id && !mine[s.id] && !s.booked && (
                <BookingForm
                  slotId={s.id}
                  services={services}
                  discountPct={s.discount_pct}
                  onDone={() => { setOpenSlot(null); load(); }}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
