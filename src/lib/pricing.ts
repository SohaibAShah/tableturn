import type { Order, Settings } from './types';

export interface Totals {
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
  paid: number;
  tips: number;
  due: number;
}

/** All money is integer minor units; rounding happens once per component. */
export function computeTotals(order: Pick<Order, 'lines' | 'discountPct' | 'payments'>, s: Pick<Settings, 'taxPct' | 'serviceChargePct'>): Totals {
  const subtotal = order.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const discount = Math.round((subtotal * clampPct(order.discountPct)) / 100);
  const net = subtotal - discount;
  const service = Math.round((net * clampPct(s.serviceChargePct)) / 100);
  const tax = Math.round(((net + service) * clampPct(s.taxPct)) / 100);
  const total = net + service + tax;
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const tips = order.payments.reduce((sum, p) => sum + p.tip, 0);
  return { subtotal, discount, service, tax, total, paid, tips, due: Math.max(0, total - paid) };
}

/** Split an amount into n parts that sum exactly to the amount (remainder goes to the first parts). */
export function splitEvenly(amount: number, n: number): number[] {
  if (n < 1) return [];
  const base = Math.floor(amount / n);
  const rem = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

export function formatMoney(minor: number, currency: string) {
  const value = minor / 100;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: currency === 'PKR' ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Parse "12.50" / "1,250" into minor units. Returns NaN for invalid input. */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  return Math.round(parseFloat(cleaned) * 100);
}
