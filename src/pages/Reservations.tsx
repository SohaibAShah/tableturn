import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actions, useStore } from '../store/store';
import { Field, Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { cx, initials, todayISO, uid } from '../lib/util';
import type { Reservation, ReservationStatus } from '../lib/types';

const STATUS_TONE: Record<ReservationStatus, string> = { booked: 'info', confirmed: 'violet', seated: 'ok', 'no-show': 'err', cancelled: 'neutral' };

export default function Reservations() {
  const nav = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<Reservation | null>(null);
  const { reservations, guests, tables } = useStore((s) => ({ reservations: s.reservations, guests: s.guests, tables: s.tables }));
  const day = reservations.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const covers = day.filter((r) => r.status !== 'cancelled' && r.status !== 'no-show').reduce((a, r) => a + r.partySize, 0);

  const shift = (n: number) => {
    const d = new Date(date + 'T00:00');
    d.setDate(d.getDate() + n);
    setDate(todayISO(d));
  };
  const blank = (): Reservation => ({ id: uid('r'), guestId: guests[0]?.id ?? '', date, time: '19:00', partySize: 2, status: 'booked' });

  const groups = new Map<string, Reservation[]>();
  day.forEach((r) => groups.set(r.time, [...(groups.get(r.time) ?? []), r]));

  return (
    <>
      <div className="page-head">
        <h1>Bookings</h1>
        <div className="row-flex">
          <button className="icon-btn" aria-label="Previous day" onClick={() => shift(-1)}>‹</button>
          <input type="date" className="input" style={{ width: 160 }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="icon-btn" aria-label="Next day" onClick={() => shift(1)}>›</button>
          {date !== todayISO() && <button className="btn sm ghost" onClick={() => setDate(todayISO())}>Today</button>}
        </div>
        <div className="spacer" />
        <span className="muted">{day.length} bookings · {covers} covers</span>
        <button className="btn primary" onClick={() => setEditing(blank())}>+ New booking</button>
      </div>

      {day.length === 0 ? (
        <div className="card empty">No bookings for this day.</div>
      ) : (
        <div className="timeline">
          {[...groups].map(([time, list]) => (
            <div className="slot" key={time}>
              <div className="slot-time">{time}</div>
              <div className="stack">
                {list.map((r) => {
                  const g = guests.find((x) => x.id === r.guestId);
                  const t = tables.find((x) => x.id === r.tableId);
                  const active = r.status === 'booked' || r.status === 'confirmed';
                  return (
                    <div key={r.id} className="card res-card">
                      <span className="avatar">{initials(g?.name ?? '?')}</span>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div className="row-flex">
                          <strong>{g?.name ?? 'Unknown guest'}</strong>
                          {g?.tags.includes('VIP') && <span className="pill warn">VIP</span>}
                        </div>
                        <div className="small muted">{r.partySize} guests · {t ? `Table ${t.label}` : 'No table yet'}{r.notes ? ` · ${r.notes}` : ''}</div>
                      </div>
                      <span className={cx('pill', STATUS_TONE[r.status])}>{r.status}</span>
                      <div className="row-flex">
                        {r.status === 'booked' && <button className="btn sm" onClick={() => actions.upsertReservation({ ...r, status: 'confirmed' })}>Confirm</button>}
                        {active && (
                          <button
                            className="btn sm primary"
                            onClick={() => {
                              const orderId = actions.seatReservation(r.id);
                              if (orderId) {
                                toast(`${g?.name ?? 'Guest'} seated`);
                                nav(`/pos/${orderId}`);
                              } else toast(`No free table for ${r.partySize} right now`, 'err');
                            }}
                          >
                            Seat
                          </button>
                        )}
                        {active && <button className="btn sm ghost" onClick={() => actions.upsertReservation({ ...r, status: 'no-show' })}>No-show</button>}
                        <button className="btn sm ghost" onClick={() => setEditing(r)}>Edit</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <ReservationForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ReservationForm({ initial, onClose }: { initial: Reservation; onClose: () => void }) {
  const { guests, tables, isExisting } = useStore((s) => ({ guests: s.guests, tables: s.tables, isExisting: s.reservations.some((x) => x.id === initial.id) }));
  const [r, setR] = useState(initial);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '' });
  const isNewGuest = r.guestId === '__new';
  const fit = tables.filter((t) => t.seats >= r.partySize);
  const valid = r.partySize > 0 && r.time && r.date && (isNewGuest ? newGuest.name.trim() && newGuest.phone.trim() : r.guestId);
  const set = <K extends keyof Reservation>(k: K, v: Reservation[K]) => setR((x) => ({ ...x, [k]: v }));

  function save() {
    let guestId = r.guestId;
    if (isNewGuest) {
      guestId = uid('g');
      actions.upsertGuest({ id: guestId, name: newGuest.name.trim(), phone: newGuest.phone.trim(), tags: [], createdAt: Date.now() });
    }
    actions.upsertReservation({ ...r, guestId });
    toast('Booking saved');
    onClose();
  }

  return (
    <Modal
      title={isExisting ? 'Edit booking' : 'New booking'}
      onClose={onClose}
      footer={
        <>
          {isExisting && r.status !== 'cancelled' && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { actions.upsertReservation({ ...r, status: 'cancelled' }); onClose(); }}>Cancel booking</button>}
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={!valid} onClick={save}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Guest">
          <select className="input" value={r.guestId} onChange={(e) => set('guestId', e.target.value)}>
            <option value="__new">+ New guest…</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.phone}</option>)}
          </select>
        </Field>
        <Field label="Party size">
          <input className="input" type="number" min={1} max={30} value={r.partySize} onChange={(e) => set('partySize', Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        {isNewGuest && (
          <>
            <Field label="Guest name"><input className="input" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} autoFocus /></Field>
            <Field label="Phone"><input className="input" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" /></Field>
          </>
        )}
        <Field label="Date"><input className="input" type="date" value={r.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Time"><input className="input" type="time" step={900} value={r.time} onChange={(e) => set('time', e.target.value)} /></Field>
        <Field label="Table" hint={`${fit.length} table(s) fit ${r.partySize} guests`}>
          <select className="input" value={r.tableId ?? ''} onChange={(e) => set('tableId', e.target.value || undefined)}>
            <option value="">Assign on arrival</option>
            {fit.map((t) => <option key={t.id} value={t.id}>{t.label} · {t.seats} seats · {t.zone}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={r.status} onChange={(e) => set('status', e.target.value as ReservationStatus)}>
            {(['booked', 'confirmed', 'seated', 'no-show', 'cancelled'] as const).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="full"><Field label="Notes"><input className="input" value={r.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} placeholder="Occasion, seating preference, allergies…" /></Field></div>
      </div>
    </Modal>
  );
}
