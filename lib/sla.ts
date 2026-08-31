/**
 * SLA Compass — ticket SLA clocks with business hours, pauses, and escalation.
 */

export type Priority = "p1" | "p2" | "p3" | "p4";

export type TicketStatus = "open" | "paused" | "resolved" | "escalated";

export interface BusinessHours {
  /** 0=Sun … 6=Sat */
  workdays: number[];
  startHour: number;
  endHour: number;
  /** IANA-less fixed offset minutes from UTC for demo */
  utcOffsetMin: number;
}

export interface SlaPolicy {
  priority: Priority;
  /** Response / resolve target in business minutes */
  targetMinutes: number;
  escalateAfterMinutes: number;
}

export interface PauseWindow {
  start: number;
  end?: number;
  reason: string;
}

export interface Ticket {
  id: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: number;
  resolvedAt?: number;
  pauses: PauseWindow[];
}

export type TrackState = "on-track" | "at-risk" | "breached" | "paused" | "resolved";

export interface SlaSnapshot {
  ticketId: string;
  priority: Priority;
  targetMinutes: number;
  elapsedBusinessMin: number;
  remainingBusinessMin: number;
  state: TrackState;
  shouldEscalate: boolean;
  nextEscalationInMin: number | null;
}

export const DEFAULT_HOURS: BusinessHours = {
  workdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 17,
  utcOffsetMin: 0,
};

export const DEFAULT_POLICIES: Record<Priority, SlaPolicy> = {
  p1: { priority: "p1", targetMinutes: 60, escalateAfterMinutes: 30 },
  p2: { priority: "p2", targetMinutes: 240, escalateAfterMinutes: 120 },
  p3: { priority: "p3", targetMinutes: 480, escalateAfterMinutes: 360 },
  p4: { priority: "p4", targetMinutes: 1440, escalateAfterMinutes: 960 },
};

const MIN = 60_000;
const HOUR = 60;

function localParts(ts: number, offsetMin: number): {
  day: number;
  hour: number;
  minute: number;
  msIntoDay: number;
} {
  const shifted = new Date(ts + offsetMin * MIN);
  const day = shifted.getUTCDay();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const second = shifted.getUTCSeconds();
  const ms = shifted.getUTCMilliseconds();
  const msIntoDay =
    ((hour * 60 + minute) * 60 + second) * 1000 + ms;
  return { day, hour, minute, msIntoDay };
}

function isWorkday(day: number, hours: BusinessHours): boolean {
  return hours.workdays.includes(day);
}

function workWindowMs(hours: BusinessHours): { start: number; end: number } {
  return {
    start: hours.startHour * 60 * MIN,
    end: hours.endHour * 60 * MIN,
  };
}

/** Business minutes between two instants given hours + pause windows. */
export function businessMinutesBetween(
  from: number,
  to: number,
  hours: BusinessHours = DEFAULT_HOURS,
  pauses: PauseWindow[] = [],
): number {
  if (to <= from) return 0;

  const activePauses = pauses.filter((p) => p.end === undefined || p.end > from);
  let totalMs = 0;
  let cursor = from;
  const step = MIN; // 1-minute granularity

  while (cursor < to) {
    const next = Math.min(cursor + step, to);
    const mid = cursor + (next - cursor) / 2;
    const paused = activePauses.some(
      (p) => mid >= p.start && (p.end === undefined || mid < p.end),
    );
    if (!paused) {
      const { day, msIntoDay } = localParts(mid, hours.utcOffsetMin);
      const { start, end } = workWindowMs(hours);
      if (isWorkday(day, hours) && msIntoDay >= start && msIntoDay < end) {
        totalMs += next - cursor;
      }
    }
    cursor = next;
  }

  return totalMs / MIN;
}

export function createTicket(
  id: string,
  title: string,
  priority: Priority,
  createdAt: number,
): Ticket {
  return {
    id,
    title,
    priority,
    status: "open",
    createdAt,
    pauses: [],
  };
}

export function pauseTicket(
  ticket: Ticket,
  at: number,
  reason: string,
): Ticket {
  if (ticket.status === "resolved") {
    throw new Error("Cannot pause a resolved ticket");
  }
  const openPause = ticket.pauses.find((p) => p.end === undefined);
  if (openPause) throw new Error("Ticket already paused");
  return {
    ...ticket,
    status: "paused",
    pauses: [...ticket.pauses, { start: at, reason }],
  };
}

export function resumeTicket(ticket: Ticket, at: number): Ticket {
  const idx = ticket.pauses.findIndex((p) => p.end === undefined);
  if (idx < 0) throw new Error("Ticket is not paused");
  const pauses = ticket.pauses.map((p, i) =>
    i === idx ? { ...p, end: at } : { ...p },
  );
  return { ...ticket, status: "open", pauses };
}

export function resolveTicket(ticket: Ticket, at: number): Ticket {
  let t = ticket;
  if (t.status === "paused") t = resumeTicket(t, at);
  return { ...t, status: "resolved", resolvedAt: at };
}

export function escalateTicket(ticket: Ticket): Ticket {
  if (ticket.status === "resolved") {
    throw new Error("Cannot escalate a resolved ticket");
  }
  return { ...ticket, status: "escalated" };
}

export function evaluateSla(
  ticket: Ticket,
  now: number,
  policies: Record<Priority, SlaPolicy> = DEFAULT_POLICIES,
  hours: BusinessHours = DEFAULT_HOURS,
): SlaSnapshot {
  const policy = policies[ticket.priority];
  const end = ticket.resolvedAt ?? now;
  const elapsed = businessMinutesBetween(
    ticket.createdAt,
    end,
    hours,
    ticket.pauses,
  );
  const remaining = policy.targetMinutes - elapsed;
  const escalateDue = elapsed >= policy.escalateAfterMinutes;

  let state: TrackState;
  if (ticket.status === "resolved") {
    state = elapsed > policy.targetMinutes ? "breached" : "resolved";
  } else if (ticket.status === "paused") {
    state = "paused";
  } else if (elapsed > policy.targetMinutes) {
    state = "breached";
  } else if (remaining <= policy.targetMinutes * 0.2) {
    state = "at-risk";
  } else {
    state = "on-track";
  }

  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    targetMinutes: policy.targetMinutes,
    elapsedBusinessMin: Math.round(elapsed * 100) / 100,
    remainingBusinessMin: Math.round(remaining * 100) / 100,
    state,
    shouldEscalate: ticket.status !== "resolved" && escalateDue,
    nextEscalationInMin:
      ticket.status === "resolved" || escalateDue
        ? null
        : Math.max(0, Math.round((policy.escalateAfterMinutes - elapsed) * 100) / 100),
  };
}

export function formatCountdown(remainingMin: number): string {
  if (remainingMin <= 0) return "0m";
  const h = Math.floor(remainingMin / HOUR);
  const m = Math.round(remainingMin % HOUR);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
