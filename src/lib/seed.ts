import type { AppState, MenuItem, Order, Guest, Reservation, Table } from './types';
import { uid, todayISO } from './util';

export const STATE_VERSION = 1;

export function createSeed(now = Date.now()): AppState {
  const categories = [
    { id: 'c-starters', name: 'Starters' },
    { id: 'c-bbq', name: 'BBQ & Grill' },
    { id: 'c-mains', name: 'Mains' },
    { id: 'c-breads', name: 'Breads & Rice' },
    { id: 'c-desserts', name: 'Desserts' },
    { id: 'c-drinks', name: 'Drinks' },
  ];

  const m = (id: string, name: string, categoryId: string, pkr: number, station: MenuItem['station'] = 'kitchen', description?: string): MenuItem => ({
    id, name, categoryId, price: pkr * 100, available: true, station, description,
  });

  const menu: MenuItem[] = [
    m('m-samosa', 'Vegetable Samosa (2)', 'c-starters', 350, 'kitchen', 'Crisp pastry, spiced potato & peas'),
    m('m-chaat', 'Papri Chaat', 'c-starters', 550),
    m('m-soup', 'Chicken Corn Soup', 'c-starters', 650),
    m('m-tikka', 'Chicken Tikka', 'c-bbq', 1250, 'kitchen', 'Charcoal-grilled quarter, mint chutney'),
    m('m-seekh', 'Beef Seekh Kebab (4)', 'c-bbq', 1450),
    m('m-malai', 'Malai Boti', 'c-bbq', 1550),
    m('m-karahi', 'Chicken Karahi (Half)', 'c-mains', 1850, 'kitchen', 'Tomato, green chilli, ginger'),
    m('m-nihari', 'Beef Nihari', 'c-mains', 1650),
    m('m-daal', 'Daal Makhani', 'c-mains', 950),
    m('m-haleem', 'Haleem', 'c-mains', 1100),
    m('m-naan', 'Butter Naan', 'c-breads', 150),
    m('m-garlic', 'Garlic Naan', 'c-breads', 220),
    m('m-biryani', 'Chicken Biryani', 'c-breads', 1050),
    m('m-pulao', 'Kabuli Pulao', 'c-breads', 1350),
    m('m-kheer', 'Kheer', 'c-desserts', 450),
    m('m-gulab', 'Gulab Jamun (3)', 'c-desserts', 400),
    m('m-lassi', 'Sweet Lassi', 'c-drinks', 380, 'bar'),
    m('m-mint', 'Mint Margarita', 'c-drinks', 450, 'bar'),
    m('m-chai', 'Doodh Patti Chai', 'c-drinks', 220, 'bar'),
    m('m-water', 'Mineral Water', 'c-drinks', 150, 'bar'),
  ];

  const tables: Table[] = [
    { id: 't-1', label: 'T1', seats: 2, x: 8, y: 12, shape: 'round', zone: 'Main' },
    { id: 't-2', label: 'T2', seats: 2, x: 26, y: 12, shape: 'round', zone: 'Main' },
    { id: 't-3', label: 'T3', seats: 4, x: 44, y: 12, shape: 'square', zone: 'Main' },
    { id: 't-4', label: 'T4', seats: 4, x: 62, y: 12, shape: 'square', zone: 'Main' },
    { id: 't-5', label: 'T5', seats: 6, x: 8, y: 50, shape: 'square', zone: 'Main' },
    { id: 't-6', label: 'T6', seats: 6, x: 30, y: 50, shape: 'square', zone: 'Main' },
    { id: 't-7', label: 'T7', seats: 8, x: 54, y: 50, shape: 'square', zone: 'Family' },
    { id: 't-8', label: 'P1', seats: 4, x: 82, y: 12, shape: 'round', zone: 'Patio' },
    { id: 't-9', label: 'P2', seats: 4, x: 82, y: 50, shape: 'round', zone: 'Patio' },
    { id: 't-10', label: 'P3', seats: 2, x: 82, y: 82, shape: 'round', zone: 'Patio' },
  ];

  const g = (name: string, phone: string, tags: string[] = [], notes?: string, daysAgo = 60): Guest => ({
    id: uid('g'), name, phone, tags, notes, createdAt: now - daysAgo * 86400000,
  });
  const guests: Guest[] = [
    g('Ayesha Khan', '+92 300 1234567', ['VIP', 'Regular'], 'Prefers window seat. Nut allergy.', 220),
    g('Bilal Ahmed', '+92 321 7654321', ['Regular'], undefined, 150),
    g('Fatima Raza', '+92 333 1112233', [], 'Celebrating anniversary in December.', 40),
    g('Hamza Siddiqui', '+92 345 9988776', ['Corporate'], 'Invoices to company account.', 95),
    g('Zainab Ali', '+92 302 5566778', [], undefined, 12),
    g('Usman Tariq', '+92 311 4433221', ['VIP'], 'Always orders extra raita.', 300),
  ];

  // Historical paid orders for the last 14 days so the dashboard has data.
  const orders: Order[] = [];
  let number = 1001;
  let rng = 7;
  const rand = () => {
    rng = (rng * 16807) % 2147483647;
    return rng / 2147483647;
  };
  for (let d = 13; d >= 0; d--) {
    const count = 8 + Math.floor(rand() * 10) + (d % 7 === 1 || d % 7 === 2 ? 6 : 0);
    for (let i = 0; i < count; i++) {
      const day = new Date(now - d * 86400000);
      day.setHours(12 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0);
      const opened = day.getTime();
      if (opened > now) continue;
      const nLines = 2 + Math.floor(rand() * 4);
      const lines = Array.from({ length: nLines }, () => {
        const item = menu[Math.floor(rand() * menu.length)];
        return { id: uid('l'), itemId: item.id, name: item.name, unitPrice: item.price, qty: 1 + Math.floor(rand() * 2), sentAt: opened };
      });
      const sub = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      const total = Math.round(sub * 1.05 * 1.16);
      const guest = rand() < 0.4 ? guests[Math.floor(rand() * guests.length)] : undefined;
      const type = rand() < 0.7 ? 'dine-in' : rand() < 0.5 ? 'takeaway' : 'delivery';
      orders.push({
        id: uid('o'),
        number: number++,
        type,
        tableId: type === 'dine-in' ? tables[Math.floor(rand() * tables.length)].id : undefined,
        guestId: guest?.id,
        covers: 1 + Math.floor(rand() * 4),
        lines,
        discountPct: 0,
        status: 'paid',
        openedAt: opened,
        closedAt: opened + 45 * 60000,
        payments: [{ method: rand() < 0.5 ? 'cash' : rand() < 0.7 ? 'card' : 'wallet', amount: total, tip: rand() < 0.3 ? 20000 : 0, at: opened + 45 * 60000 }],
      });
    }
  }

  const today = todayISO(new Date(now));
  const reservations: Reservation[] = [
    { id: uid('r'), guestId: guests[0].id, date: today, time: '19:30', partySize: 2, tableId: 't-1', status: 'confirmed', notes: 'Window seat' },
    { id: uid('r'), guestId: guests[3].id, date: today, time: '20:00', partySize: 6, tableId: 't-5', status: 'booked', notes: 'Client dinner' },
    { id: uid('r'), guestId: guests[2].id, date: today, time: '21:00', partySize: 2, status: 'booked' },
    { id: uid('r'), guestId: guests[5].id, date: todayISO(new Date(now + 86400000)), time: '13:00', partySize: 8, tableId: 't-7', status: 'confirmed', notes: 'Family lunch, high chair' },
  ];

  return {
    version: STATE_VERSION,
    settings: { restaurantName: 'Karachi Kitchen', currency: 'PKR', taxPct: 16, serviceChargePct: 5 },
    categories,
    menu,
    tables,
    orders,
    tickets: [],
    guests,
    reservations,
    nextOrderNumber: number,
  };
}
