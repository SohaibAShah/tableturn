import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actions, openOrderForTable, tableStatus, useStore } from '../store/store';
import { computeTotals } from '../lib/pricing';
import { useMoney } from '../components/useMoney';
import { Field, Modal } from '../components/Modal';
import { cx, minutesSince } from '../lib/util';
import type { Table } from '../lib/types';

const STATUS_COLORS: Record<string, string> = {
  free: 'var(--ok)', seated: 'var(--info)', ordered: 'var(--brand)', paying: 'var(--violet)', reserved: 'var(--warn)',
};

export default function FloorPlan() {
  const money = useMoney();
  const nav = useNavigate();
  const [zone, setZone] = useState('All');
  const [seating, setSeating] = useState<Table | null>(null);
  const [covers, setCovers] = useState(2);

  const tables = useStore((s) =>
    s.tables.map((t) => {
      const order = openOrderForTable(s, t.id);
      return { t, status: tableStatus(s, t.id), order, total: order ? computeTotals(order, s.settings).total : 0 };
    }),
  );
  const zones = ['All', ...new Set(tables.map((x) => x.t.zone))];
  const visible = tables.filter((x) => zone === 'All' || x.t.zone === zone);
  const counts = tables.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.status]: (acc[x.status] ?? 0) + 1 }), {});

  function onTable(x: (typeof tables)[number]) {
    if (x.order) nav(`/pos/${x.order.id}`);
    else {
      setCovers(Math.min(2, x.t.seats));
      setSeating(x.t);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Floor plan</h1>
        <div className="chips">
          {zones.map((z) => (
            <button key={z} className={cx('chip', zone === z && 'active')} onClick={() => setZone(z)}>{z}</button>
          ))}
        </div>
        <div className="spacer" />
        <div className="legend">
          {Object.entries(STATUS_COLORS).map(([k, c]) => (
            <span key={k} style={{ textTransform: 'capitalize' }}><span className="dot" style={{ background: c }} />{k} ({counts[k] ?? 0})</span>
          ))}
        </div>
      </div>

      <div className="floor">
        {visible.map((x) => {
          const size = 70 + x.t.seats * 6;
          return (
            <button
              key={x.t.id}
              className={cx('tbl', x.t.shape, x.status)}
              style={{ left: `calc(${x.t.x}% )`, top: `calc(${x.t.y}% )`, width: size, height: x.t.shape === 'round' ? size : size * 0.8 }}
              onClick={() => onTable(x)}
              aria-label={`Table ${x.t.label}, ${x.t.seats} seats, ${x.status}`}
            >
              {x.t.label}
              <small>{x.t.seats} seats</small>
              {x.order && <small className="num">{money(x.total)} · {minutesSince(x.order.openedAt)}m</small>}
              {x.status === 'reserved' && <small>Reserved</small>}
            </button>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Click a free table to seat guests, or an occupied table to open its order.</p>

      {seating && (
        <Modal
          title={`Seat table ${seating.label}`}
          onClose={() => setSeating(null)}
          footer={
            <>
              <button className="btn" onClick={() => setSeating(null)}>Cancel</button>
              <button
                className="btn primary"
                onClick={() => {
                  const id = actions.openOrder('dine-in', { tableId: seating.id, covers });
                  nav(`/pos/${id}`);
                }}
              >
                Seat & start order
              </button>
            </>
          }
        >
          <Field label="Covers (guests)" hint={`Table seats ${seating.seats}`}>
            <div className="chips">
              {Array.from({ length: Math.max(seating.seats, 2) }, (_, i) => i + 1).map((n) => (
                <button key={n} className={cx('chip', covers === n && 'active')} onClick={() => setCovers(n)}>{n}</button>
              ))}
            </div>
          </Field>
        </Modal>
      )}
    </>
  );
}
