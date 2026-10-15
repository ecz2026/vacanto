'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Service = { id: string; name: string; price: number };

export default function BookingForm({
  slotId,
  services,
  discountPct,
  onDone,
}: {
  slotId: string;
  services: Service[];
  discountPct: number;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { full, total } = useMemo(() => {
    const chosen = services.filter((s) => selected.includes(s.id));
    const full = chosen.reduce((sum, s) => sum + Number(s.price), 0);
    const total = chosen.reduce(
      (sum, s) => sum + Math.round(Number(s.price) * (100 - discountPct)) / 100,
      0
    );
    return { full, total };
  }, [selected, services, discountPct]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const book = async () => {
    setError(null);
    setBusy(true);
    const { error } = await supabase.rpc('create_booking', {
      p_slot_id: slotId,
      p_service_ids: selected,
    });
    setBusy(false);
    if (error) {
      setError(error.message.includes('nicht mehr frei') ? 'Leider gerade vergeben.' : error.message);
    } else {
      onDone();
    }
  };

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {services.map((s) => (
        <label
          key={s.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 10,
            cursor: 'pointer',
            background: '#fff',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            {s.name}
          </span>
          <span>CHF {Number(s.price).toFixed(2)}</span>
        </label>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 12 }}>
        {discountPct > 0 && full > 0 && (
          <span style={{ textDecoration: 'line-through', color: '#999' }}>
            CHF {full.toFixed(2)}
          </span>
        )}
        <span style={{ fontSize: 24, fontWeight: 700 }}>CHF {total.toFixed(2)}</span>
      </div>

      {error && <p style={{ color: 'crimson', margin: 0 }}>{error}</p>}

      <button onClick={book} disabled={selected.length === 0 || busy}>
        {busy ? 'Sende ...' : 'Termin anfragen'}
      </button>
    </div>
  );
}
