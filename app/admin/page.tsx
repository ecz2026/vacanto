"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Admin() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.push("/login?next=/admin"); return; }
    const { data: admin } = await supabase.rpc("is_admin");
    if (!admin) { setOk(false); return; }
    const { data } = await supabase.from("admin_providers").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    setOk(true);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function toggle(r: any) {
    const text = r.paused
      ? `${r.name} wieder aktivieren?`
      : `${r.name} pausieren? Der Anbieter ist dann für Kunden nicht mehr sichtbar und nicht mehr buchbar.`;
    if (!confirm(text)) return;
    const { error } = await supabase.rpc("admin_set_paused", { p_provider_id: r.id, p_paused: !r.paused });
    if (error) alert(error.message);
    load();
  }

  if (ok === null) return <main>Lädt ...</main>;
  if (!ok) return <main><h1>Kein Zugriff</h1></main>;

  return (
    <main>
      <h1>Admin: Anbieter</h1>
      <p>{rows.length} Anbieter, {rows.filter((r) => r.paused).length} pausiert.</p>
      {rows.map((r) => (
        <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, margin: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <b>{r.name}</b>{" "}
            {r.paused && <span style={{ background: "crimson", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 700 }}>pausiert</span>}
            <div style={{ color: "var(--mut)" }}>{r.category} · {r.plz} {r.city}</div>
            <div style={{ color: "var(--mut)" }}>{r.email} · {r.upcoming_slots} kommende Termine</div>
          </div>
          <button onClick={() => toggle(r)}>{r.paused ? "Aktivieren" : "Pausieren"}</button>
        </div>
      ))}
    </main>
  );
}
