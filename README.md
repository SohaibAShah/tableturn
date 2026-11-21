# TableTurn — Restaurant Operations Suite

A restaurant / hospitality operations app built with **React 18 + TypeScript + Vite**. It covers the full front-of-house loop: seating guests, taking orders, firing tickets to the kitchen, taking payment, and remembering the guest for next time.

> Built as a portfolio project for restaurant & hospitality SaaS (POS, bookings, CRM).

## Features

| Module | What it does |
| --- | --- |
| **Dashboard** | Revenue today / 7 days with week-over-week deltas, avg. ticket, covers, peak hour, 14-day revenue chart, sales mix (dine-in / takeaway / delivery), top sellers, upcoming bookings |
| **Floor plan** | Live table map by zone with colour-coded status (free, seated, ordered, paying, reserved), running bill and time-seated per table |
| **POS** | Category + search menu grid, quantity editing, per-line kitchen notes (allergies, "no onions"), discounts, service charge & tax, guest attach with allergy/notes banner |
| **Payments** | Cash (with change), card, wallet (JazzCash / Easypaisa); split bill evenly N ways with exact-cent splitting; partial payments; tips |
| **Kitchen display (KDS)** | Tickets auto-split by station (kitchen / bar), new → cooking → ready → bumped, late-ticket alerts after 15 min, recall. **Syncs live across browser tabs** — run POS on one screen and KDS on another |
| **Bookings** | Day timeline, create/edit, new-guest-on-the-fly, table suggestions by party size, confirm, seat (auto-opens order on best-fit free table), no-show, cancel |
| **Guests (CRM)** | Tags (VIP, Regular, Corporate…), lifetime spend, visits, last visit, favourite dishes, order & booking history |
| **Orders** | Full history with filters, search, CSV export |
| **Menu** | CRUD items & categories, prep station routing, one-tap "86" (mark unavailable) |
| **Settings** | Name, currency (any ISO code), tax %, service charge %, JSON backup / restore, reset demo data |

Fully responsive (tablet POS, phone), automatic dark mode, keyboard accessible modals.

## Engineering notes

- **Money is integer minor units everywhere** — no floating-point drift. Pricing logic (`src/lib/pricing.ts`) is pure and unit tested: discount → service charge → tax, each rounded once.
- **State**: a small typed store on `useSyncExternalStore` (`src/store/store.ts`) — no Redux needed. Actions are plain functions; selectors are memoised per snapshot. State persists to `localStorage` and is broadcast to other tabs via the `storage` event.
- **Domain derivations** (table status, guest stats) are selectors, not duplicated state, so they can't drift.
- Versioned persisted state with safe fallback to seed data if storage is corrupt or unavailable.
- Zero runtime dependencies beyond React + React Router.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build into dist/
```

## Deploy (free, ~2 minutes)

It's a static single-page app, so any static host works. SPA rewrites are already configured.

**Vercel** — push this folder to a GitHub repo → vercel.com → *Add New Project* → import the repo → Deploy. (`vercel.json` included; framework auto-detected as Vite.)

**Netlify** — *Add new site → Import from Git* (`netlify.toml` included), or drag-and-drop the `dist/` folder after `npm run build`.

**Cloudflare Pages** — build command `npm run build`, output directory `dist`.

## Roadmap

- Backend (Supabase / Postgres) for multi-device sync and staff logins with roles
- Online booking widget for the restaurant's website
- Receipt printer (ESC/POS) and FBR / tax-authority invoice integration
- Inventory & recipe costing
