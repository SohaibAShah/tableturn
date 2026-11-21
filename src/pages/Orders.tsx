import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { computeTotals } from '../lib/pricing';
import { useMoney } from '../components/useMoney';
import { TypePill } from './POS';
import { cx, timeOf } from '../lib/util';

type Filter = 'all' | 'open' | 'paid' | 'void';

export default function Orders() {
  const money = useMoney();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const rows = useStore((s) =>
    s.orders
      .slice()
      .sort((a, b) => b.openedAt - a.openedAt)
      .map((o) => ({
        o,
        total: computeTotals(o, s.settings).total,
        table: s.tables.find((t) => t.id === o.tableId)?.label,
        guest: s.guests.find((g) => g.id === o.guestId)?.name,
      })),
  );
  const filtered = rows.filter(
    (r) =>
      (filter === 'all' || r.o.status === filter) &&
      (!q || String(r.o.number).includes(q) || r.guest?.toLowerCase().includes(q.toLowerCase())),
  );

  function exportCsv() {
    const header = ['number', 'date', 'type', 'table', 'guest', 'status', 'items', 'total'];
    const lines = filtered.map((r) => [r.o.number, new Date(r.o.openedAt).toISOString(), r.o.type, r.table ?? '', r.guest ?? '', r.o.status, r.o.lines.reduce((a, l) => a + l.qty, 0), (r.total / 100).toFixed(2)]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <div className="chips">
          {(['all', 'open', 'paid', 'void'] as const).map((f) => (
            <button key={f} className={cx('chip', filter === f && 'active')} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
        <div className="spacer" />
        <input className="input search" placeholder="Order # or guest…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>#</th><th>When</th><th>Type</th><th>Table</th><th>Guest</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            {filtered.slice(0, limit).map(({ o, total, table, guest }) => (
              <tr key={o.id} className="clickable" onClick={() => nav(`/pos/${o.id}`)}>
                <td className="num" style={{ fontWeight: 700 }}>{o.number}</td>
                <td className="muted">{new Date(o.openedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} {timeOf(o.openedAt)}</td>
                <td><TypePill type={o.type} /></td>
                <td>{table ?? '—'}</td>
                <td>{guest ?? <span className="muted">Walk-in</span>}</td>
                <td><span className={cx('pill', o.status === 'paid' ? 'ok' : o.status === 'open' ? 'warn' : 'err')}>{o.status}</span></td>
                <td className="num" style={{ textAlign: 'right' }}>{money(total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No orders match.</div>}
        {filtered.length > limit && (
          <div className="card-pad" style={{ textAlign: 'center' }}>
            <button className="btn" onClick={() => setLimit((l) => l + 50)}>Show more ({filtered.length - limit} left)</button>
          </div>
        )}
      </div>
    </>
  );
}
