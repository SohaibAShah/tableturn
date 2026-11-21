import { useEffect, useState } from 'react';

type ToastMsg = { id: number; text: string; tone: 'ok' | 'err' };
let push: ((m: ToastMsg) => void) | null = null;
let n = 0;

export function toast(text: string, tone: 'ok' | 'err' = 'ok') {
  push?.({ id: ++n, text, tone });
}

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    push = (m) => {
      setItems((xs) => [...xs, m]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== m.id)), 2800);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>
      ))}
    </div>
  );
}
