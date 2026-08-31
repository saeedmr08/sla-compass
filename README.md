# SLA Compass

Ticket SLA compass by **Saeed Rumaneh**. Priority policies, business-hours clocks, pause/resume, countdown, and escalation cues — with clear **on-track vs breached** evaluation. Tickets persist to `data/tickets.json` via Next.js API routes.

## Features

- P1–P4 policies (target + escalate-after minutes)
- Mon–Fri 09:00–17:00 UTC business minutes (configurable in lib)
- Pause windows excluded from elapsed time
- UI countdown and escalation due flags
- JSON persistence + fetch-wired console

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tickets` | List tickets + SLA snapshots |
| POST | `/api/tickets` | Create ticket or set `simulateOffsetMin` |
| POST | `/api/tickets/:id/pause` | Pause / resume toggle |
| POST | `/api/tickets/:id/advance` | Escalate / resolve / resume |

## Stack

Next.js 15 · React 19 · TypeScript · Vitest

## Scripts

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## Library

Core logic: [`lib/sla.ts`](lib/sla.ts) · Persistence: [`lib/store.ts`](lib/store.ts) · Tests: [`__tests__/sla.test.ts`](__tests__/sla.test.ts)

Runtime data under `data/` is gitignored.

## Complete product flows

1. Open a ticket with a P1–P4 priority — it appears with elapsed / remaining / escalation clocks.
2. Pause (clock stops), advance time with **Simulate now (+min)**, then Resume or Escalate.
3. Resolve the ticket — state persists in `data/tickets.json` across reloads.

## License

MIT © 2026 Saeed Rumaneh
