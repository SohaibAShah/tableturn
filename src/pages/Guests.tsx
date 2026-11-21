import { useState } from 'react';
import { Link } from 'react-router-dom';
import { actions, guestStats, useStore } from '../store/store';
import { computeTotals } from '../lib/pricing';
import { useMoney } from '../components/useMoney';
import { Field, Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { cx, initials, uid } from '../lib/util';
import type { Guest } from '../lib/types';

const TAGS = ['VIP', 'Regular', 'Corporate', 'Allergy', 'Blacklist'];
type Sort = 'spend' | 'visits' | 'recent' | 'name';

export default function Guests() {
  const money = useMoney();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('spend');
  const [editing, setEditing] = useState<Guest | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const rows = useStore((s) => s.guests.map((g) => ({ g, ...guestStats(s, g.id) })));
  const needle = q.trim().toLowerCase();
  const filtered = rows
    .filter((r) => (!tag || r.g.tags.includes(tag)) && (!needle || r.g.name.toLowerCase().includes(needle) || r.g.phone.replace(/\s/g, '').includes(needle.replace(/\s/g, ''))))
    .sort((a, b) => (sort === 'spend' ? b.spend - a.spend : sort === 'visits' ? b.visits - a.visits : sort === 'recent' ? (b.last ?? 0) - (a.last ?? 0) : a.g.name.localeCompare(b.g.name)));

  return (
    <>
      <div className="page-head">
        <h1>Guests</h1>
        <div className="chips">
          <button className={cx('chip', !tag && 'active')} onClick={() => setTag(null)}>All</button>
          {TAGS.map((t) => <button key={t} className={cx('chip', tag === t && 'active')} onClick={() => setTag(t)}>{t}</button>)}
        </div>
        <div className="spacer" />
        <input className="input search" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="spend">Top spend</option>
          <option value="visits">Most visits</option>
          <option value="recent">Recent</option>
          <option value="name">Name</option>
        </select>
        <button className="btn primary" onClick={() => setEditing({ id: uid('g'), name: '', phone: '', tags: [], createdAt: Date.now() })}>+ Guest</button>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Guest</th><th>Tags</th><th>Visits</th><th>Last visit</th><th style={{ textAlign: 'right' }}>Lifetime spend</th></tr></thead>
          <tbody>
            {filtered.map(({ g, visits, spend, last }) => (
              <tr key={g.id} className="clickable" onClick={() => setViewing(g.id)}>
                <td>
                  <div className="row-flex">
                    <span className="avatar">{initials(g.name)}</span>
                    <div><div style={{ fontWeight: 500 }}>{g.name}</div><div className="small muted">{g.phone}</div></div>
                  </div>
                </td>
                <td><div className="chips">{g.tags.map((t) => <span key={t} className={cx('pill', t === 'VIP' ? 'warn' : t === 'Blacklist' ? 'err' : 'neutral')}>{t}</span>)}</div></td>
                <td className="num">{visits}</td>
                <td className="muted">{last ? new Date(last).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—'}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No guests match.</div>}
      </div>

      {viewing && <GuestProfile id={viewing} onClose={() => setViewing(null)} onEdit={(g) => { setViewing(null); setEditing(g); }} />}
      {editing && <GuestForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function GuestProfile({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (g: Guest) => void }) {
  const money = useMoney();
  const data = useStore((s) => {
    const g = s.guests.find((x) => x.id === id);
    if (!g) return null;
    const orders = s.orders.filter((o) => o.guestId === id && o.status === 'paid').sort((a, b) => b.openedAt - a.openedAt);
    const favs = new Map<string, number>();
    orders.forEach((o) => o.lines.forEach((l) => favs.set(l.name, (favs.get(l.name) ?? 0) + l.qty)));
    return {
      g,
      stats: guestStats(s, id),
      orders: orders.slice(0, 8).map((o) => ({ o, total: computeTotals(o, s.settings).total })),
      favs: [...favs].sort((a, b) => b[1] - a[1]).slice(0, 4),
      bookings: s.reservations.filter((r) => r.guestId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    };
  });
  if (!data) return null;
  const { g, stats } = data;
  return (
    <Modal title={g.name} onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn primary" onClick={() => onEdit(g)}>Edit guest</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row-flex" style={{ flexWrap: 'wrap' }}>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(g.name)}</span>
          <div style={{ flex: 1 }}>
            <div>{g.phone}{g.email ? ` · ${g.email}` : ''}</div>
            <div className="chips" style={{ marginTop: 4 }}>{g.tags.map((t) => <span key={t} className="pill neutral">{t}</span>)}</div>
          </div>
        </div>
        <div className="grid kpis">
          <div className="card kpi"><div className="kpi-label">Visits</div><div className="kpi-value">{stats.visits}</div></div>
          <div className="card kpi"><div className="kpi-label">Lifetime spend</div><div className="kpi-value">{money(stats.spend)}</div></div>
          <div className="card kpi"><div className="kpi-label">Avg. spend</div><div className="kpi-value">{money(stats.visits ? Math.round(stats.spend / stats.visits) : 0)}</div></div>
        </div>
        {g.notes && <div className="card card-pad" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>⚑ {g.notes}</div>}
        {data.favs.length > 0 && <div><h3 style={{ marginBottom: 6 }}>Usually orders</h3><div className="chips">{data.favs.map(([n, c]) => <span key={n} className="pill info">{n} ×{c}</span>)}</div></div>}
        <div>
          <h3 style={{ marginBottom: 6 }}>Recent orders</h3>
          {data.orders.length === 0 ? <p className="muted">No orders yet.</p> : (
            <table className="table">
              <tbody>
                {data.orders.map(({ o, total }) => (
                  <tr key={o.id}>
                    <td><Link to={`/pos/${o.id}`}>#{o.number}</Link></td>
                    <td className="muted">{new Date(o.openedAt).toLocaleDateString()}</td>
                    <td className="muted">{o.lines.length} lines</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data.bookings.length > 0 && (
          <div>
            <h3 style={{ marginBottom: 6 }}>Bookings</h3>
            {data.bookings.map((r) => <div key={r.id} className="small">{r.date} {r.time} · {r.partySize} pax · <span className="pill neutral">{r.status}</span></div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

function GuestForm({ initial, onClose }: { initial: Guest; onClose: () => void }) {
  const exists = useStore((s) => s.guests.some((g) => g.id === initial.id));
  const [g, setG] = useState(initial);
  const valid = g.name.trim() && g.phone.trim();
  const toggleTag = (t: string) => setG({ ...g, tags: g.tags.includes(t) ? g.tags.filter((x) => x !== t) : [...g.tags, t] });
  return (
    <Modal
      title={exists ? 'Edit guest' : 'New guest'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={() => { actions.upsertGuest({ ...g, name: g.name.trim(), phone: g.phone.trim() }); toast('Guest saved'); onClose(); }}>Save</button></>}
    >
      <div className="form-grid">
        <Field label="Name"><input className="input" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoFocus /></Field>
        <Field label="Phone"><input className="input" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" /></Field>
        <div className="full"><Field label="Email (optional)"><input className="input" type="email" value={g.email ?? ''} onChange={(e) => setG({ ...g, email: e.target.value || undefined })} /></Field></div>
        <div className="full">
          <Field label="Tags">
            <div className="chips">{TAGS.map((t) => <button type="button" key={t} className={cx('chip', g.tags.includes(t) && 'active')} onClick={() => toggleTag(t)}>{t}</button>)}</div>
          </Field>
        </div>
        <div className="full"><Field label="Notes" hint="Shown to servers when this guest is attached to an order"><textarea className="input" rows={3} value={g.notes ?? ''} onChange={(e) => setG({ ...g, notes: e.target.value || undefined })} /></Field></div>
      </div>
    </Modal>
  );
}
