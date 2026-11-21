import { useEffect, useState } from 'react';
import { actions, useStore } from '../store/store';
import { cx, minutesSince, timeOf } from '../lib/util';
import type { Ticket, TicketStatus } from '../lib/types';

const LATE_MIN = 15;
const NEXT: Record<TicketStatus, TicketStatus | null> = { new: 'cooking', cooking: 'ready', ready: 'done', done: null };
const LABEL: Record<TicketStatus, string> = { new: 'Start', cooking: 'Mark ready', ready: 'Bump (served)', done: '' };

export default function Kitchen() {
  const [station, setStation] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [showDone, setShowDone] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const tickets = useStore((s) => s.tickets);
  const visible = tickets
    .filter((t) => (station === 'all' || t.station === station) && (showDone ? t.status === 'done' : t.status !== 'done'))
    .sort((a, b) => (showDone ? b.updatedAt - a.updatedAt : a.createdAt - b.createdAt))
    .slice(0, showDone ? 30 : undefined);
  const counts = { new: 0, cooking: 0, ready: 0 } as Record<string, number>;
  tickets.forEach((t) => t.status !== 'done' && (counts[t.status] = (counts[t.status] ?? 0) + 1));

  return (
    <>
      <div className="page-head">
        <h1>Kitchen display</h1>
        <div className="chips">
          {(['all', 'kitchen', 'bar'] as const).map((s) => (
            <button key={s} className={cx('chip', station === s && 'active')} onClick={() => setStation(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
        <div className="spacer" />
        <span className="pill info">{counts.new} new</span>
        <span className="pill warn">{counts.cooking} cooking</span>
        <span className="pill ok">{counts.ready} ready</span>
        <button className="btn sm" onClick={() => setShowDone((v) => !v)}>{showDone ? 'Show active' : 'Recently bumped'}</button>
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          {showDone ? 'Nothing bumped yet.' : 'All clear 🎉 — tickets appear here when servers press “Send” on the POS.'}
        </div>
      ) : (
        <div className="kds">
          {visible.map((t) => <TicketCard key={t.id} t={t} />)}
        </div>
      )}
    </>
  );
}

function TicketCard({ t }: { t: Ticket }) {
  const age = minutesSince(t.createdAt);
  const late = t.status !== 'done' && t.status !== 'ready' && age >= LATE_MIN;
  const next = NEXT[t.status];
  return (
    <div className={cx('card kds-card', t.status, late && 'late')}>
      <div className="card-head">
        <div>
          <h2>{t.label}</h2>
          <div className="small muted">#{t.orderNumber} · {t.station} · {timeOf(t.createdAt)}</div>
        </div>
        <span className={cx('timer', late && 'late')}>{age}m</span>
      </div>
      <ul>
        {t.lines.map((l, i) => (
          <li key={i}>
            <strong>{l.qty}×</strong> {l.name}
            {l.note && <span className="note">⚑ {l.note}</span>}
          </li>
        ))}
      </ul>
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
        {next ? (
          <button className={cx('btn block', t.status === 'ready' ? '' : 'primary')} onClick={() => actions.setTicketStatus(t.id, next)}>{LABEL[t.status]}</button>
        ) : (
          <button className="btn block" onClick={() => actions.setTicketStatus(t.id, 'ready')}>Recall</button>
        )}
      </div>
    </div>
  );
}
