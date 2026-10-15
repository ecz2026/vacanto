"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [f, setF] = useState({ email: "", password: "", name: "" });
  const next = () => new URLSearchParams(location.search).get("next") || "/";

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
    if (error) return alert(error.message);
    location.href = next();
  }
  async function signUp() {
    if (!f.name) return alert("Bitte Namen eingeben.");
    const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name } } });
    if (error) return alert(error.message);
    alert("Registriert. Falls E-Mail-Bestätigung aktiv ist: bitte E-Mail bestätigen, dann einloggen.");
    await signIn();
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: 20, display: "grid", gap: 8 }}>
      <h1>Login</h1>
      <input placeholder="Name (nur Registrierung)" value={f.name} onChange={set("name")} />
      <input placeholder="E-Mail" type="email" value={f.email} onChange={set("email")} />
      <input placeholder="Passwort" type="password" value={f.password} onChange={set("password")} />
      <button onClick={signIn}>Einloggen</button>
      <button onClick={signUp}>Neu registrieren</button>
    </main>
  );
}
