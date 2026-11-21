import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/store';
import { ToastHost } from './components/Toast';
import Dashboard from './pages/Dashboard';
import FloorPlan from './pages/FloorPlan';
import POS from './pages/POS';
import Kitchen from './pages/Kitchen';
import Reservations from './pages/Reservations';
import MenuManager from './pages/MenuManager';
import Guests from './pages/Guests';
import Orders from './pages/Orders';
import SettingsPage from './pages/Settings';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/floor', label: 'Floor', icon: '▦' },
  { to: '/pos', label: 'POS', icon: '⊞' },
  { to: '/kitchen', label: 'Kitchen', icon: '♨' },
  { to: '/reservations', label: 'Bookings', icon: '◷' },
  { to: '/orders', label: 'Orders', icon: '≡' },
  { to: '/menu', label: 'Menu', icon: '☰' },
  { to: '/guests', label: 'Guests', icon: '☺' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const name = useStore((s) => s.settings.restaurantName);
  const activeTickets = useStore((s) => s.tickets.filter((t) => t.status === 'new' || t.status === 'cooking').length);
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setNavOpen(false), [loc.pathname]);

  return (
    <div className="shell">
      <aside className={navOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="logo" aria-hidden>◉</span>
          <div>
            <strong>TableTurn</strong>
            <small>{name}</small>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
              <span className="nav-icon" aria-hidden>{n.icon}</span>
              {n.label}
              {n.to === '/kitchen' && activeTickets > 0 && <span className="badge">{activeTickets}</span>}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-foot">Data is saved in this browser. Open Kitchen in a second tab — it updates live.</p>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setNavOpen(true)}>☰</button>
          <span className="topbar-title">{NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)))?.label ?? 'TableTurn'}</span>
          <Clock />
        </header>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/floor" element={<FloorPlan />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/pos/:orderId" element={<POS />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/menu" element={<MenuManager />} />
            <Route path="/guests" element={<Guests />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <ToastHost />
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return <span className="clock">{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
}
