'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    const check = async (u: any) => {
      setUser(u);
      if (!u) return setIsProvider(false);
      const { data } = await supabase.from('providers').select('id').eq('id', u.id).maybeSingle();
      setIsProvider(!!data);
    };
    supabase.auth.getUser().then(({ data }) => check(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => check(session?.user ?? null), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const nav = { color: 'var(--fg)', textDecoration: 'none', fontWeight: 600 } as const;

  return (
    <header style={{ borderBottom: '1px solid #e7e2da', background: '#fff' }}>
      <nav style={{ maxWidth: 720, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1, color: 'var(--fg)', textDecoration: 'none' }}>
          Vacanto<span style={{ color: 'var(--ac)' }}>.</span>
        </Link>
        <span style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <>
              <Link href="/meine-termine" style={nav}>Meine Termine</Link>
              <Link href="/dashboard" style={nav}>{isProvider ? 'Dashboard' : 'Für Anbieter'}</Link>
              <button onClick={logout}>Abmelden</button>
            </>
          ) : (
            <>
              <Link href="/login?next=/dashboard" style={nav}>Für Anbieter</Link>
              <Link href="/login" style={nav}>Anmelden</Link>
            </>
          )}
        </span>
      </nav>
    </header>
  );
}
