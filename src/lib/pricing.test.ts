import { describe, expect, it } from 'vitest';
import { computeTotals, parseMoney, splitEvenly } from './pricing';

const settings = { taxPct: 16, serviceChargePct: 5 };

describe('computeTotals', () => {
  it('applies discount, then service, then tax', () => {
    const t = computeTotals(
      { lines: [{ id: '1', itemId: 'a', name: 'A', unitPrice: 100000, qty: 2 }], discountPct: 10, payments: [] },
      settings,
    );
    expect(t.subtotal).toBe(200000);
    expect(t.discount).toBe(20000);
    expect(t.service).toBe(9000);
    expect(t.tax).toBe(30240);
    expect(t.total).toBe(219240);
    expect(t.due).toBe(219240);
  });

  it('tracks partial payments and never shows negative due', () => {
    const t = computeTotals(
      { lines: [{ id: '1', itemId: 'a', name: 'A', unitPrice: 1000, qty: 1 }], discountPct: 0, payments: [{ method: 'cash', amount: 5000, tip: 200, at: 0 }] },
      { taxPct: 0, serviceChargePct: 0 },
    );
    expect(t.paid).toBe(5000);
    expect(t.tips).toBe(200);
    expect(t.due).toBe(0);
  });

  it('clamps out-of-range discounts', () => {
    const t = computeTotals({ lines: [{ id: '1', itemId: 'a', name: 'A', unitPrice: 1000, qty: 1 }], discountPct: 150, payments: [] }, settings);
    expect(t.total).toBe(0);
  });
});

describe('splitEvenly', () => {
  it('sums exactly to the original amount', () => {
    const parts = splitEvenly(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});

describe('parseMoney', () => {
  it('parses valid inputs and rejects garbage', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('1,250')).toBe(125000);
    expect(parseMoney('abc')).toBeNaN();
    expect(parseMoney('-3')).toBeNaN();
  });
});
