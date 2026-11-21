import { useRef, useSyncExternalStore } from 'react';
import type { AppState, Guest, MenuItem, Order, OrderType, Payment, Reservation, Settings, Table, TableStatus, Ticket, TicketStatus } from '../lib/types';
import { createSeed, STATE_VERSION } from '../lib/seed';
import { computeTotals } from '../lib/pricing';
import { todayISO, uid } from '../lib/util';

const KEY = 'tableturn:state';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed */
  }
  return createSeed();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — app keeps working in memory */
  }
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

// Live sync between tabs: e.g. POS on one screen, Kitchen Display on another.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = JSON.parse(e.newValue);
      listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Select a slice of state. The result is memoised per state snapshot, so selectors
 * may safely return derived arrays/objects without causing render loops.
 */
export function useStore<T>(selector: (s: AppState) => T): T {
  const ref = useRef<{ s: AppState; v: T } | null>(null);
  // Re-run the selector on every render too, since it may close over props.
  ref.current = null;
  const getSnapshot = () => {
    if (!ref.current || ref.current.s !== state) ref.current = { s: state, v: selector(state) };
    return ref.current.v;
  };
  return useSyncExternalStore(subscribe, getSnapshot);
}

export const getState = () => state;

const patchOrder = (id: string, fn: (o: Order) => Order) =>
  set((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? fn(o) : o)) }));

export const actions = {
  // ---------- Orders ----------
  openOrder(type: OrderType, opts: { tableId?: string; covers?: number; guestId?: string } = {}): string {
    const existing = opts.tableId && state.orders.find((o) => o.tableId === opts.tableId && o.status === 'open');
    if (existing) return existing.id;
    const id = uid('o');
    set((s) => ({
      ...s,
      nextOrderNumber: s.nextOrderNumber + 1,
      orders: [
        ...s.orders,
        { id, number: s.nextOrderNumber, type, tableId: opts.tableId, guestId: opts.guestId, covers: opts.covers ?? 2, lines: [], discountPct: 0, status: 'open', openedAt: Date.now(), payments: [] },
      ],
    }));
    return id;
  },

  addItem(orderId: string, item: MenuItem) {
    patchOrder(orderId, (o) => {
      const unsent = o.lines.find((l) => l.itemId === item.id && !l.sentAt && !l.note);
      if (unsent) return { ...o, lines: o.lines.map((l) => (l === unsent ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...o, lines: [...o.lines, { id: uid('l'), itemId: item.id, name: item.name, unitPrice: item.price, qty: 1 }] };
    });
  },

  setQty(orderId: string, lineId: string, qty: number) {
    patchOrder(orderId, (o) => ({
      ...o,
      lines: qty <= 0 ? o.lines.filter((l) => l.id !== lineId || l.sentAt) : o.lines.map((l) => (l.id === lineId && !l.sentAt ? { ...l, qty } : l)),
    }));
  },

  setLineNote(orderId: string, lineId: string, note: string) {
    patchOrder(orderId, (o) => ({ ...o, lines: o.lines.map((l) => (l.id === lineId && !l.sentAt ? { ...l, note: note || undefined } : l)) }));
  },

  updateOrder(orderId: string, patch: Partial<Pick<Order, 'covers' | 'discountPct' | 'guestId' | 'tableId' | 'type'>>) {
    patchOrder(orderId, (o) => ({ ...o, ...patch }));
  },

  /** Fire unsent lines to the kitchen/bar as tickets, split by station. */
  sendToKitchen(orderId: string): number {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return 0;
    const unsent = order.lines.filter((l) => !l.sentAt);
    if (!unsent.length) return 0;
    const now = Date.now();
    const table = state.tables.find((t) => t.id === order.tableId);
    const label = table ? `Table ${table.label}` : order.type === 'takeaway' ? 'Takeaway' : 'Delivery';
    const byStation = new Map<'kitchen' | 'bar', Ticket['lines']>();
    for (const l of unsent) {
      const station = state.menu.find((m) => m.id === l.itemId)?.station ?? 'kitchen';
      byStation.set(station, [...(byStation.get(station) ?? []), { name: l.name, qty: l.qty, note: l.note }]);
    }
    const tickets: Ticket[] = [...byStation].map(([station, lines]) => ({
      id: uid('k'), orderId, orderNumber: order.number, label, station, lines, status: 'new', createdAt: now, updatedAt: now,
    }));
    set((s) => ({
      ...s,
      tickets: [...s.tickets, ...tickets],
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, lines: o.lines.map((l) => (l.sentAt ? l : { ...l, sentAt: now })) } : o)),
    }));
    return unsent.length;
  },

  addPayment(orderId: string, p: Omit<Payment, 'at'>) {
    patchOrder(orderId, (o) => {
      const next = { ...o, payments: [...o.payments, { ...p, at: Date.now() }] };
      const t = computeTotals(next, state.settings);
      return t.due === 0 ? { ...next, status: 'paid', closedAt: Date.now() } : next;
    });
  },

  voidOrder(orderId: string) {
    set((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: 'void', closedAt: Date.now() } : o)),
      tickets: s.tickets.map((t) => (t.orderId === orderId && t.status !== 'done' ? { ...t, status: 'done', updatedAt: Date.now() } : t)),
    }));
  },

  // ---------- Kitchen ----------
  setTicketStatus(id: string, status: TicketStatus) {
    set((s) => ({ ...s, tickets: s.tickets.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)) }));
  },

  // ---------- Menu ----------
  upsertMenuItem(item: MenuItem) {
    set((s) => ({ ...s, menu: s.menu.some((m) => m.id === item.id) ? s.menu.map((m) => (m.id === item.id ? item : m)) : [...s.menu, item] }));
  },
  deleteMenuItem(id: string) {
    set((s) => ({ ...s, menu: s.menu.filter((m) => m.id !== id) }));
  },
  toggleAvailable(id: string) {
    set((s) => ({ ...s, menu: s.menu.map((m) => (m.id === id ? { ...m, available: !m.available } : m)) }));
  },
  addCategory(name: string) {
    set((s) => ({ ...s, categories: [...s.categories, { id: uid('c'), name }] }));
  },

  // ---------- Guests ----------
  upsertGuest(g: Guest) {
    set((s) => ({ ...s, guests: s.guests.some((x) => x.id === g.id) ? s.guests.map((x) => (x.id === g.id ? g : x)) : [...s.guests, g] }));
  },

  // ---------- Reservations ----------
  upsertReservation(r: Reservation) {
    set((s) => ({ ...s, reservations: s.reservations.some((x) => x.id === r.id) ? s.reservations.map((x) => (x.id === r.id ? r : x)) : [...s.reservations, r] }));
  },
  seatReservation(id: string): string | undefined {
    const r = state.reservations.find((x) => x.id === id);
    if (!r) return;
    const tableId = r.tableId ?? findFreeTable(r.partySize);
    if (!tableId) return;
    set((s) => ({ ...s, reservations: s.reservations.map((x) => (x.id === id ? { ...x, status: 'seated', tableId } : x)) }));
    return actions.openOrder('dine-in', { tableId, covers: r.partySize, guestId: r.guestId });
  },

  // ---------- Tables / settings ----------
  updateTable(t: Table) {
    set((s) => ({ ...s, tables: s.tables.map((x) => (x.id === t.id ? t : x)) }));
  },
  updateSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  resetDemo() {
    set(() => createSeed());
  },
  importState(next: AppState) {
    if (next?.version !== STATE_VERSION || !Array.isArray(next.orders)) throw new Error('Unsupported backup file');
    set(() => next);
  },
};

function findFreeTable(partySize: number): string | undefined {
  const fits = state.tables.filter((t) => t.seats >= partySize && tableStatus(state, t.id) === 'free').sort((a, b) => a.seats - b.seats);
  return fits[0]?.id;
}

// ---------- Derived selectors ----------
export function openOrderForTable(s: AppState, tableId: string) {
  return s.orders.find((o) => o.tableId === tableId && o.status === 'open');
}

export function tableStatus(s: AppState, tableId: string, now = Date.now()): TableStatus {
  const order = openOrderForTable(s, tableId);
  if (order) {
    if (order.payments.length) return 'paying';
    return order.lines.length ? 'ordered' : 'seated';
  }
  const today = todayISO(new Date(now));
  const soon = s.reservations.some((r) => {
    if (r.tableId !== tableId || r.date !== today || (r.status !== 'booked' && r.status !== 'confirmed')) return false;
    const [h, m] = r.time.split(':').map(Number);
    const at = new Date(now);
    at.setHours(h!, m!, 0, 0);
    const diff = at.getTime() - now;
    return diff > -30 * 60000 && diff < 90 * 60000;
  });
  return soon ? 'reserved' : 'free';
}

export function guestStats(s: AppState, guestId: string) {
  const orders = s.orders.filter((o) => o.guestId === guestId && o.status === 'paid');
  const spend = orders.reduce((sum, o) => sum + computeTotals(o, s.settings).total, 0);
  const last = orders.reduce((max, o) => Math.max(max, o.closedAt ?? o.openedAt), 0);
  return { visits: orders.length, spend, last: last || undefined };
}
