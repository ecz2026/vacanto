"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";

const fmt = (t: string) =>
  new Date(t).toLocaleString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Home() {
  const [plz, setPlz] = useState("");
  const [cat, setCat] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [info, setInfo] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    let q = supabase.from("providers").select("id,name,category,street,plz,city").eq("paused", false);
    if (plz.trim()) q = q.eq("plz", plz.trim());
    if (cat) q = q.eq("category", cat);
    const { data } = await q.order("name").limit(50);
    const rows: any[] = data ?? [];
    setList(rows);
    const meta: Record<string, any> = {};
    if (rows.length) {
      const { data: sl } = await supabase
        .from("open_slots")
        .select("provider_id,starts_at,is_last_minute,discount_pct")
        .in("provider_id", rows.map((r) => r.id))
        .order("starts_at");
      (sl ?? []).forEach((s: any) => {
        const m = (meta[s.provider_id] ??= { next: s.starts_at, lm: 0, disc: 0 });
        if (s.is_last_minute) { m.lm += 1; m.disc = Math.max(m.disc, s.discount_pct); }
      });
    }
    setInfo(meta);
    setBusy(false);
  }
  useEffect(() => { search(); }, []);
  useEffect(() => {
    supabase.from("open_slots").select("id", { count: "exact", head: true }).then(({ count }) => setCount(count ?? 0));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          {count > 0 && <span className="pill"><span className="dot" />{count} freie Termine aktuell buchbar</span>}
          <h1>Freie Termine. Last Minute.</h1>
          <p>Friseure, Barbiere und mehr mit freien Plätzen, kurzfristig oft günstiger.</p>
          <form onSubmit={search} className="searchcard">
            <input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="PLZ, z. B. 9000" inputMode="numeric" maxLength={4} style={{ maxWidth: 170 }} />
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit">{busy ? "Suche ..." : "Suchen"}</button>
          </form>
          <ul className="trust">
            <li>Kostenlos für Kunden</li>
            <li>Jeder Termin wird vom Anbieter bestätigt</li>
            <li>Preis und Rabatt vor dem Buchen sichtbar</li>
          </ul>
        </div>
      </section>

      <main>
        {!busy && list.length === 0 && <p>Keine Anbieter gefunden. Probiere nur die PLZ oder eine andere Kategorie.</p>}

        {list.map((r) => {
          const m = info[r.id];
          return (
            <Link key={r.id} href={`/p/${r.id}`} style={{ display: "block", padding: 14, margin: "10px 0", textDecoration: "none", color: "inherit" }}>
              <b style={{ fontSize: 18, color: "var(--ink)" }}>{r.name}</b>
              <div style={{ color: "var(--mut)" }}>{r.category} · {r.street}, {r.plz} {r.city}</div>
              <div style={{ marginTop: 8 }}>
                {m?.next ? <>Nächster freier Termin: <b>{fmt(m.next)}</b></> : <span style={{ color: "var(--mut)" }}>Aktuell keine freien Termine</span>}
                {m?.lm > 0 && <span className="deal">Last Minute bis -{m.disc}%</span>}
              </div>
            </Link>
          );
        })}

        <h2>So funktioniert es</h2>
        <div className="steps">
          <div className="step"><span className="n">1</span><b>Termin finden</b><p>Suche nach PLZ und Kategorie und sieh freie Termine mit Last-Minute-Rabatt.</p></div>
          <div className="step"><span className="n">2</span><b>Leistungen wählen</b><p>Wähle, was gemacht werden soll. Der Preis wird sofort berechnet.</p></div>
          <div className="step"><span className="n">3</span><b>Anbieter bestätigt</b><p>Die Bestätigung siehst du unter Meine Termine.</p></div>
        </div>
      </main>
    </>
  );
}