import { Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { computeTotals } from '../lib/pricing';
import { useMoney } from '../components/useMoney';
import { todayISO } from '../lib/util';

export default function Dashboard() {
  const money = useMoney();
  const data = useStore((s) => {
    const now = new Date();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      return todayISO(d);
    });
    const byDay = new Map(days.map((d) => [d, { revenue: 0, orders: 0, covers: 0 }]));
    const itemCounts = new Map<string, { name: string; qty: number; revenue: number }>();
    const byType = { 'dine-in': 0, takeaway: 0, delivery: 0 } as Record<string, number>;
    const byHour = new Array(24).fill(0) as number[];

    for (const o of s.orders) {
      if (o.status !== 'paid') continue;
      const day = todayISO(new Date(o.closedAt ?? o.openedAt));
      const bucket = byDay.get(day);
      if (!bucket) continue;
      const total = computeTotals(o, s.settings).total;
      bucket.revenue += total;
      bucket.orders += 1;
      bucket.covers += o.type === 'dine-in' ? o.covers : 0;
      byType[o.type] = (byType[o.type] ?? 0) + total;
      byHour[new Date(o.openedAt).getHours()]! += 1;
      for (const l of o.lines) {
        const c = itemCounts.get(l.itemId) ?? { name: l.name, qty: 0, revenue: 0 };
        c.qty += l.qty;
        c.revenue += l.qty * l.unitPrice;
        itemCounts.set(l.itemId, c);
      }
    }
    const series = days.map((d) => ({ day: d, ...byDay.get(d)! }));
    const today = series[13]!;
    const lastWeekSameDay = series[6]!;
    const week = series.slice(7).reduce((a, b) => a + b.revenue, 0);
    const prevWeek = series.slice(0, 7).reduce((a, b) => a + b.revenue, 0);
    const weekOrders = series.slice(7).reduce((a, b) => a + b.orders, 0);
    const open = s.orders.filter((o) => o.status === 'open');
    const todayRes = s.reservations.filter((r) => r.date === todayISO() && (r.status === 'booked' || r.status === 'confirmed'));
    return {
      series, today, lastWeekSameDay, week, prevWeek,
      avgTicket: weekOrders ? Math.round(week / weekOrders) : 0,
      top: [...itemCounts.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      byType,
      peakHour: byHour.indexOf(Math.max(...byHour)),
      openOrders: open.length,
      openValue: open.reduce((sum, o) => sum + computeTotals(o, s.settings).total, 0),
      upcoming: todayRes.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5).map((r) => ({ ...r, guest: s.guests.find((g) => g.id === r.guestId)?.name ?? 'Guest' })),
      unavailable: s.menu.filter((m) => !m.available).length,
    };
  });

  const max = Math.max(1, ...data.series.map((d) => d.revenue));
  const typeTotal = Object.values(data.byType).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good {greeting()} 👋</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Here's how service is going.</p>
        </div>
        <div className="spacer" />
        <Link to="/floor" className="btn">Open floor plan</Link>
        <Link to="/pos" className="btn primary">+ New order</Link>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Revenue today" value={money(data.today.revenue)} delta={pct(data.today.revenue, data.lastWeekSameDay.revenue)} note="vs same day last week" />
        <Kpi label="Revenue (7 days)" value={money(data.week)} delta={pct(data.week, data.prevWeek)} note="vs previous 7 days" />
        <Kpi label="Avg. ticket" value={money(data.avgTicket)} note="last 7 days" />
        <Kpi label="Open orders" value={String(data.openOrders)} note={`${money(data.openValue)} in progress`} />
        <Kpi label="Covers today" value={String(data.today.covers)} note={`Busiest hour: ${fmtHour(data.peakHour)}`} />
      </div>

      <div className="grid two-col">
        <div className="card">
          <div className="card-head">
            <h2>Revenue — last 14 days</h2>
            <span className="muted small">Hover a bar for details</span>
          </div>
          <div className="bars" role="img" aria-label="Daily revenue bar chart">
            {data.series.map((d, i) => (
              <div className="bar-col" key={d.day}>
                <div className="bar-track">
                  <div
                    className={i === 13 ? 'bar today' : 'bar'}
                    style={{ height: `${(d.revenue / max) * 100}%` }}
                    data-tip={`${new Date(d.day + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}: ${money(d.revenue)} · ${d.orders} orders`}
                  />
                </div>
                <span className="bar-label">{new Date(d.day + 'T00:00').toLocaleDateString([], { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 style={{ marginBottom: 10 }}>Sales mix</h3>
            <div className="stack">
              {Object.entries(data.byType).map(([k, v]) => (
                <div key={k}>
                  <div className="row-flex small" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ textTransform: 'capitalize' }}>{k}</span>
                    <span className="num muted">{money(v)} · {Math.round((v / typeTotal) * 100)}%</span>
                  </div>
                  <div className="meter"><div style={{ width: `${(v / typeTotal) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Upcoming bookings</h2>
              <Link to="/reservations" className="small">View all</Link>
            </div>
            {data.upcoming.length === 0 ? (
              <div className="empty">No more bookings today.</div>
            ) : (
              <table className="table">
                <tbody>
                  {data.upcoming.map((r) => (
                    <tr key={r.id}>
                      <td className="num" style={{ fontWeight: 700 }}>{r.time}</td>
                      <td>{r.guest}</td>
                      <td className="muted">{r.partySize} pax</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Top sellers</h2>
              {data.unavailable > 0 && <Link to="/menu" className="pill err">{data.unavailable} item(s) 86'd</Link>}
            </div>
            <table className="table">
              <tbody>
                {data.top.map((t, i) => (
                  <tr key={t.name}>
                    <td className="muted num" style={{ width: 24 }}>{i + 1}</td>
                    <td>{t.name}</td>
                    <td className="num muted">{t.qty}×</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, delta, note }: { label: string; value: string; delta?: number | null; note?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-delta muted">
        {delta != null && <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% </span>}
        {note}
      </div>
    </div>
  );
}

function pct(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
function fmtHour(h: number) {
  const d = new Date();
  d.setHours(h, 0);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}
