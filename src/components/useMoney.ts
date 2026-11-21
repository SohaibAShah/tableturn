import { useCallback } from 'react';
import { formatMoney } from '../lib/pricing';
import { useStore } from '../store/store';

export function useMoney() {
  const currency = useStore((s) => s.settings.currency);
  return useCallback((minor: number) => formatMoney(minor, currency), [currency]);
}
