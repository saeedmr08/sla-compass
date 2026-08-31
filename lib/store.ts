import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createTicket,
  escalateTicket,
  evaluateSla,
  pauseTicket,
  resolveTicket,
  resumeTicket,
  type Priority,
  type SlaSnapshot,
  type Ticket,
} from "./sla";
import { DEMO_NOW } from "./demo-now";

export { DEMO_NOW };

const DATA_FILE = path.join(process.cwd(), "data", "tickets.json");

type TicketFile = {
  tickets: Ticket[];
  now: number;
};

function seedTickets(): Ticket[] {
  const base = Date.UTC(2024, 0, 1, 9, 0, 0);
  return [
    createTicket("T-100", "Payment webhook stall", "p1", base),
    createTicket("T-214", "Report export delay", "p2", base + 30 * 60_000),
    createTicket("T-308", "UI copy tweak", "p4", base + 60 * 60_000),
  ];
}

function readFile(): TicketFile {
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as TicketFile;
    return {
      tickets: Array.isArray(raw.tickets) ? raw.tickets : seedTickets(),
      now: typeof raw.now === "number" ? raw.now : DEMO_NOW,
    };
  } catch {
    const seeded: TicketFile = { tickets: seedTickets(), now: DEMO_NOW };
    writeFile(seeded);
    return seeded;
  }
}

function writeFile(data: TicketFile): void {
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

export function listTickets(): {
  tickets: Ticket[];
  now: number;
  snapshots: SlaSnapshot[];
} {
  const data = readFile();
  return {
    ...data,
    snapshots: data.tickets.map((t) => evaluateSla(t, data.now)),
  };
}

export function createPersistedTicket(
  title: string,
  priority: Priority,
): Ticket {
  const data = readFile();
  const id = `T-${400 + data.tickets.length}`;
  const ticket = createTicket(id, title, priority, data.now - 5 * 60_000);
  data.tickets.push(ticket);
  writeFile(data);
  return ticket;
}

export function setSimulatedNow(offsetMin: number): number {
  const data = readFile();
  data.now = DEMO_NOW + offsetMin * 60_000;
  writeFile(data);
  return data.now;
}

function updateTicket(
  id: string,
  fn: (t: Ticket, now: number) => Ticket,
): Ticket {
  const data = readFile();
  const idx = data.tickets.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error(`Ticket ${id} not found`);
  const updated = fn(data.tickets[idx], data.now);
  data.tickets[idx] = updated;
  writeFile(data);
  return updated;
}

export function pausePersistedTicket(id: string, reason = "waiting on customer"): Ticket {
  return updateTicket(id, (t, now) => {
    if (t.status === "paused") return resumeTicket(t, now);
    return pauseTicket(t, now, reason);
  });
}

/** Advance workflow: escalate open tickets; resolve escalated ones. */
export function advancePersistedTicket(
  id: string,
  action?: "escalate" | "resolve" | "resume",
): Ticket {
  return updateTicket(id, (t, now) => {
    if (action === "resolve") return resolveTicket(t, now);
    if (action === "resume") return resumeTicket(t, now);
    if (action === "escalate") return escalateTicket(t);
    if (t.status === "paused") return resumeTicket(t, now);
    if (t.status === "escalated") return resolveTicket(t, now);
    return escalateTicket(t);
  });
}
