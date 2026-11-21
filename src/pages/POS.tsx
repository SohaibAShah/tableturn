import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { actions, useStore } from '../store/store';
import { computeTotals, parseMoney, splitEvenly } from '../lib/pricing';
import { useMoney } from '../components/useMoney';
import { Field, Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { cx, minutesSince } from '../lib/util';
import type { Order, OrderType, Payment } from '../lib/types';

export default function POS() {
  const { orderId } = useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  if (!orderId) return <OrderPicker />;
  if (!order) return <div className="empty">Order not found. <Link to="/pos">Back to POS</Link></div>;
  return <OrderScreen order={order} />;
}

function OrderPicker() {
  const money = useMoney();
  const nav = useNavigate();
  const open = useStore((s) =>
    s.orders
      .filter((o) => o.status === 'open')
      .map((o) => ({ o, table: s.tables.find((t) => t.id === o.tableId)?.label, total: computeTotals(o, s.settings).total }))
      .sort((a, b) => b.o.openedAt - a.o.openedAt),
  );
  const start = (type: OrderType) => nav(`/pos/${actions.openOrder(type, { covers: 1 })}`);

  return (
    <>
      <div className="page-head">
        <h1>Point of sale</h1>
        <div className="spacer" />
        <Link className="btn" to="/floor">Dine-in (pick table)</Link>
        <button className="btn" onClick={() => start('delivery')}>+ Delivery</button>
        <button className="btn primary" onClick={() => start('takeaway')}>+ Takeaway</button>
      </div>
      <div className="card">
        <div className="card-head"><h2>Open orders</h2><span className="muted small">{open.length} open</span></div>
        {open.length === 0 ? (
          <div className="empty">No open orders. Start a takeaway or seat a table from the floor plan.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Type</th><th>Table</th><th>Items</th><th>Open for</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {open.map(({ o, table, total }) => (
                  <tr key={o.id} className="clickable" onClick={() => nav(`/pos/${o.id}`)}>
                    <td className="num" style={{ fontWeight: 700 }}>{o.number}</td>
                    <td><TypePill type={o.type} /></td>
                    <td>{table ?? '—'}</td>
                    <td className="muted">{o.lines.reduce((a, l) => a + l.qty, 0)}</td>
                    <td className="muted">{minutesSince(o.openedAt)} min</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function TypePill({ type }: { type: OrderType }) {
  return <span className={cx('pill', type === 'dine-in' ? 'info' : type === 'takeaway' ? 'violet' : 'warn')}>{type}</span>;
}

function OrderScreen({ order }: { order: Order }) {
  const money = useMoney();
  const nav = useNavigate();
  const { categories, menu, settings, tables, guests } = useStore((s) => ({ categories: s.categories, menu: s.menu, settings: s.settings, tables: s.tables, guests: s.guests }));
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const totals = computeTotals(order, settings);
  const table = tables.find((t) => t.id === order.tableId);
  const guest = guests.find((g) => g.id === order.guestId);
  const unsent = order.lines.filter((l) => !l.sentAt).length;
  const items = useMemo(
    () => menu.filter((m) => (cat === 'all' || m.categoryId === cat) && m.name.toLowerCase().includes(q.trim().toLowerCase())),
    [menu, cat, q],
  );
  const locked = order.status !== 'open';

  return (
    <>
      <div className="page-head">
        <button className="icon-btn" aria-label="Back" onClick={() => nav(table ? '/floor' : '/pos')}>←</button>
        <div>
          <h1>Order #{order.number} {table && <span className="muted">· Table {table.label}</span>}</h1>
          <div className="row-flex small muted" style={{ marginTop: 4 }}>
            <TypePill type={order.type} />
            <span>{order.covers} cover(s)</span>
            <span>· opened {minutesSince(order.openedAt)} min ago</span>
            {order.status !== 'open' && <span className={cx('pill', order.status === 'paid' ? 'ok' : 'err')}>{order.status}</span>}
          </div>
        </div>
        <div className="spacer" />
        <select
          className="input"
          style={{ width: 200 }}
          value={order.guestId ?? ''}
          disabled={locked}
          onChange={(e) => actions.updateOrder(order.id, { guestId: e.target.value || undefined })}
          aria-label="Attach guest"
        >
          <option value="">No guest attached</option>
          {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="pos">
        <section>
          <div className="row-flex" style={{ flexWrap: 'wrap' }}>
            <div className="chips" style={{ flex: 1 }}>
              <button className={cx('chip', cat === 'all' && 'active')} onClick={() => setCat('all')}>All</button>
              {categories.map((c) => (
                <button key={c.id} className={cx('chip', cat === c.id && 'active')} onClick={() => setCat(c.id)}>{c.name}</button>
              ))}
            </div>
            <input className="input search" placeholder="Search menu…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {guest?.notes && <div className="card card-pad small" style={{ marginTop: 12, background: 'var(--warn-soft)', borderColor: 'transparent' }}>⚑ <strong>{guest.name}:</strong> {guest.notes}</div>}
          <div className="menu-grid">
            {items.map((m) => (
              <button key={m.id} className="item-tile" disabled={!m.available || locked} onClick={() => actions.addItem(order.id, m)}>
                <strong>{m.name}</strong>
                {!m.available && <span className="pill err">86'd</span>}
                <span className="price">{money(m.price)}</span>
              </button>
            ))}
            {items.length === 0 && <div className="empty">No items match.</div>}
          </div>
        </section>

        <aside className="card ticket">
          <div className="card-head">
            <h2>Ticket</h2>
            <span className="muted small">{order.lines.reduce((a, l) => a + l.qty, 0)} items</span>
          </div>
          <div className="ticket-lines">
            {order.lines.length === 0 && <div className="empty">Tap menu items to add them.</div>}
            {order.lines.map((l) => (
              <div key={l.id} className={cx('line', l.sentAt && 'sent')}>
                <div>
                  <div style={{ fontWeight: 500 }}>{l.name}</div>
                  <div className="small muted num">{money(l.unitPrice)} {l.sentAt ? '· sent ✓' : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {l.sentAt || locked ? (
                    <span className="num">{l.qty}×</span>
                  ) : (
                    <span className="qty">
                      <button aria-label="Decrease" onClick={() => actions.setQty(order.id, l.id, l.qty - 1)}>−</button>
                      <span className="num">{l.qty}</span>
                      <button aria-label="Increase" onClick={() => actions.setQty(order.id, l.id, l.qty + 1)}>+</button>
                    </span>
                  )}
                  <div className="num small" style={{ marginTop: 4 }}>{money(l.unitPrice * l.qty)}</div>
                </div>
                {l.note && <div className="line-note">↳ {l.note}</div>}
                {!l.sentAt && !locked && (
                  <button className="btn ghost sm" style={{ justifySelf: 'start', padding: 0 }} onClick={() => setNoteFor(l.id)}>
                    {l.note ? 'Edit note' : '+ Add note'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="totals small">
            <div className="row"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="row up"><span>Discount ({order.discountPct}%)</span><span>−{money(totals.discount)}</span></div>}
            <div className="row muted"><span>Service ({settings.serviceChargePct}%)</span><span>{money(totals.service)}</span></div>
            <div className="row muted"><span>Tax ({settings.taxPct}%)</span><span>{money(totals.tax)}</span></div>
            {totals.paid > 0 && <div className="row up"><span>Paid</span><span>−{money(totals.paid)}</span></div>}
            <div className="row grand"><span>{totals.paid > 0 ? 'Balance due' : 'Total'}</span><span>{money(totals.due)}</span></div>
          </div>
          {!locked && (
            <div className="ticket-actions">
              <select className="input" value={order.discountPct} onChange={(e) => actions.updateOrder(order.id, { discountPct: Number(e.target.value) })} aria-label="Discount">
                {[0, 5, 10, 15, 20, 50, 100].map((d) => <option key={d} value={d}>{d === 0 ? 'No discount' : `${d}% off`}</option>)}
              </select>
              <button className="btn danger" onClick={() => setConfirmVoid(true)}>Void</button>
              <button
                className="btn"
                disabled={!unsent}
                onClick={() => {
                  const n = actions.sendToKitchen(order.id);
                  toast(`Fired ${n} item(s) to kitchen`);
                }}
              >
                Send {unsent ? `(${unsent})` : ''}
              </button>
              <button className="btn primary" disabled={!order.lines.length} onClick={() => setPaying(true)}>Pay {money(totals.due)}</button>
            </div>
          )}
          {locked && (
            <div className="ticket-actions">
              <button className="btn" onClick={() => window.print()}>Print receipt</button>
              <Link className="btn primary" to="/pos">Done</Link>
            </div>
          )}
        </aside>
      </div>

      {paying && (
        <PayModal
          due={totals.due}
          covers={order.covers}
          onClose={() => setPaying(false)}
          onPay={(p) => {
            if (unsent) actions.sendToKitchen(order.id);
            actions.addPayment(order.id, p);
            const remaining = totals.due - p.amount;
            const change = (p.tendered ?? p.amount) - p.amount;
            if (remaining <= 0) {
              toast(`Order #${order.number} paid${change > 0 ? ` — change ${money(change)}` : ''}`);
              setPaying(false);
            } else {
              toast(`Partial payment received. ${money(remaining)} left.`);
            }
          }}
        />
      )}
      {noteFor && (
        <NoteModal
          initial={order.lines.find((l) => l.id === noteFor)?.note ?? ''}
          onClose={() => setNoteFor(null)}
          onSave={(n) => {
            actions.setLineNote(order.id, noteFor, n);
            setNoteFor(null);
          }}
        />
      )}
      {confirmVoid && (
        <Modal
          title={`Void order #${order.number}?`}
          onClose={() => setConfirmVoid(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmVoid(false)}>Keep order</button>
              <button className="btn primary" style={{ background: 'var(--err)', borderColor: 'var(--err)' }} onClick={() => { actions.voidOrder(order.id); toast(`Order #${order.number} voided`, 'err'); nav('/pos'); }}>Void order</button>
            </>
          }
        >
          <p style={{ margin: 0 }}>The order will be closed without payment and any open kitchen tickets will be cleared. It stays in order history as voided.</p>
        </Modal>
      )}
    </>
  );
}

function PayModal({ due, covers, onClose, onPay }: { due: number; covers: number; onClose: () => void; onPay: (p: Omit<Payment, 'at'>) => void }) {
  const money = useMoney();
  const [method, setMethod] = useState<Payment['method']>('cash');
  const [split, setSplit] = useState(1);
  const parts = splitEvenly(due, split);
  const [amount, setAmount] = useState((due / 100).toString());
  const [tip, setTip] = useState('0');
  const amt = parseMoney(amount);
  const tipAmt = parseMoney(tip || '0');
  const valid = amt > 0 && !Number.isNaN(tipAmt) && (method === 'cash' || amt <= due);

  return (
    <Modal
      title={`Take payment · ${money(due)} due`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary lg" disabled={!valid} onClick={() => onPay({ method, amount: Math.min(amt, due), tip: tipAmt, tendered: amt })}>
            Charge {Number.isNaN(amt) ? '' : money(amt)}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Method">
          <div className="pay-methods">
            {(['cash', 'card', 'wallet'] as const).map((m) => (
              <button key={m} className={cx('btn', method === m && 'primary')} onClick={() => setMethod(m)} style={{ textTransform: 'capitalize' }}>{m === 'wallet' ? 'JazzCash / Easypaisa' : m}</button>
            ))}
          </div>
        </Field>
        <Field label="Split bill">
          <div className="chips">
            {[1, 2, 3, 4, covers].filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b).map((n) => (
              <button key={n} className={cx('chip', split === n && 'active')} onClick={() => { setSplit(n); setAmount((splitEvenly(due, n)[0]! / 100).toString()); }}>
                {n === 1 ? 'Full' : `${n} ways`}
              </button>
            ))}
          </div>
          {split > 1 && <small>Each guest pays {parts.map((p) => money(p)).join(' / ')}</small>}
        </Field>
        <div className="form-grid">
          <Field label="Amount received" hint={method === 'cash' ? 'Over-payment is returned as change' : 'Cannot exceed balance'}>
            <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tip">
            <input className="input num" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
          </Field>
        </div>
        {method === 'cash' && amt > due && <div className="pill ok" style={{ fontSize: 13 }}>Change due: {money(amt - due)}</div>}
      </div>
    </Modal>
  );
}

function NoteModal({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (n: string) => void }) {
  const [v, setV] = useState(initial);
  const quick = ['No onions', 'Extra spicy', 'Mild', 'No nuts — allergy', 'Well done', 'On the side'];
  return (
    <Modal title="Kitchen note" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(v.trim())}>Save note</button></>}>
      <div className="stack">
        <div className="chips">{quick.map((q) => <button key={q} className="chip" onClick={() => setV((x) => (x ? `${x}, ${q}` : q))}>{q}</button>)}</div>
        <textarea className="input" rows={3} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      </div>
    </Modal>
  );
}
