export type ID = string;

export interface Category {
  id: ID;
  name: string;
}

export interface MenuItem {
  id: ID;
  name: string;
  categoryId: ID;
  price: number; // in minor units (paisa / cents)
  description?: string;
  available: boolean; // false = "86'd"
  station: 'kitchen' | 'bar';
}

export type TableStatus = 'free' | 'seated' | 'ordered' | 'paying' | 'reserved';

export interface Table {
  id: ID;
  label: string;
  seats: number;
  x: number; // grid position 0..100
  y: number;
  shape: 'round' | 'square';
  zone: string;
}

export interface OrderLine {
  id: ID;
  itemId: ID;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
  sentAt?: number; // when fired to kitchen
}

export type OrderStatus = 'open' | 'paid' | 'void';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface Payment {
  method: 'cash' | 'card' | 'wallet';
  amount: number; // amount applied to the bill
  tendered?: number; // cash handed over (amount + change)
  tip: number;
  at: number;
}

export interface Order {
  id: ID;
  number: number;
  type: OrderType;
  tableId?: ID;
  guestId?: ID;
  covers: number;
  lines: OrderLine[];
  discountPct: number;
  status: OrderStatus;
  openedAt: number;
  closedAt?: number;
  payments: Payment[];
}

export type TicketStatus = 'new' | 'cooking' | 'ready' | 'done';

export interface Ticket {
  id: ID;
  orderId: ID;
  orderNumber: number;
  label: string;
  station: 'kitchen' | 'bar';
  lines: { name: string; qty: number; note?: string }[];
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Guest {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  notes?: string;
  createdAt: number;
}

export type ReservationStatus = 'booked' | 'confirmed' | 'seated' | 'no-show' | 'cancelled';

export interface Reservation {
  id: ID;
  guestId: ID;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  partySize: number;
  tableId?: ID;
  status: ReservationStatus;
  notes?: string;
}

export interface Settings {
  restaurantName: string;
  currency: string;
  taxPct: number;
  serviceChargePct: number;
}

export interface AppState {
  version: number;
  settings: Settings;
  categories: Category[];
  menu: MenuItem[];
  tables: Table[];
  orders: Order[];
  tickets: Ticket[];
  guests: Guest[];
  reservations: Reservation[];
  nextOrderNumber: number;
}
