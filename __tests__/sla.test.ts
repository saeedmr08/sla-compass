import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOURS,
  DEFAULT_POLICIES,
  businessMinutesBetween,
  createTicket,
  evaluateSla,
  formatCountdown,
  pauseTicket,
  resolveTicket,
  resumeTicket,
} from "@/lib/sla";

/** Monday 2024-01-01 09:00 UTC */
const MON_9AM = Date.UTC(2024, 0, 1, 9, 0, 0);

describe("businessMinutesBetween", () => {
  it("counts only business hours on workdays", () => {
    const from = MON_9AM;
    const to = MON_9AM + 2 * 60 * 60 * 1000; // 11:00
    expect(businessMinutesBetween(from, to, DEFAULT_HOURS)).toBe(120);
  });

  it("skips overnight / weekend gaps", () => {
    // Friday 16:00 → Monday 10:00
    const fri4 = Date.UTC(2024, 0, 5, 16, 0, 0);
    const mon10 = Date.UTC(2024, 0, 8, 10, 0, 0);
    // Fri 16–17 = 60m, Mon 9–10 = 60m → 120
    expect(businessMinutesBetween(fri4, mon10, DEFAULT_HOURS)).toBe(120);
  });

  it("excludes pause windows", () => {
    const from = MON_9AM;
    const to = MON_9AM + 3 * 60 * 60 * 1000;
    const pauses = [
      { start: MON_9AM + 60 * 60 * 1000, end: MON_9AM + 2 * 60 * 60 * 1000, reason: "waiting" },
    ];
    expect(businessMinutesBetween(from, to, DEFAULT_HOURS, pauses)).toBe(120);
  });
});

describe("evaluateSla", () => {
  it("reports on-track early in window", () => {
    const ticket = createTicket("t1", "Outage", "p2", MON_9AM);
    const snap = evaluateSla(ticket, MON_9AM + 30 * 60 * 1000);
    expect(snap.state).toBe("on-track");
    expect(snap.elapsedBusinessMin).toBe(30);
    expect(snap.remainingBusinessMin).toBe(DEFAULT_POLICIES.p2.targetMinutes - 30);
    expect(snap.shouldEscalate).toBe(false);
  });

  it("flags breach when past target", () => {
    const ticket = createTicket("t2", "Slow", "p1", MON_9AM);
    // p1 target 60m
    const snap = evaluateSla(ticket, MON_9AM + 90 * 60 * 1000);
    expect(snap.state).toBe("breached");
    expect(snap.remainingBusinessMin).toBeLessThan(0);
  });

  it("escalation threshold independent of full breach", () => {
    const ticket = createTicket("t3", "Noise", "p1", MON_9AM);
    const snap = evaluateSla(ticket, MON_9AM + 35 * 60 * 1000);
    expect(snap.shouldEscalate).toBe(true);
    expect(snap.state).toBe("on-track");
  });

  it("paused tickets report paused state", () => {
    let ticket = createTicket("t4", "Hold", "p3", MON_9AM);
    ticket = pauseTicket(ticket, MON_9AM + 10 * 60 * 1000, "customer");
    const snap = evaluateSla(ticket, MON_9AM + 40 * 60 * 1000);
    expect(snap.state).toBe("paused");
    expect(snap.elapsedBusinessMin).toBe(10);
  });

  it("resolved within SLA is resolved not breached", () => {
    let ticket = createTicket("t5", "Quick", "p1", MON_9AM);
    ticket = resolveTicket(ticket, MON_9AM + 20 * 60 * 1000);
    const snap = evaluateSla(ticket, MON_9AM + 200 * 60 * 1000);
    expect(snap.state).toBe("resolved");
  });

  it("resume closes pause window", () => {
    let ticket = createTicket("t6", "Resume", "p2", MON_9AM);
    ticket = pauseTicket(ticket, MON_9AM + 10 * 60 * 1000, "wait");
    ticket = resumeTicket(ticket, MON_9AM + 40 * 60 * 1000);
    const snap = evaluateSla(ticket, MON_9AM + 70 * 60 * 1000);
    // 10m active + 30m after resume = 40
    expect(snap.elapsedBusinessMin).toBe(40);
    expect(snap.state).toBe("on-track");
  });
});

describe("formatCountdown", () => {
  it("formats hours and minutes", () => {
    expect(formatCountdown(0)).toBe("0m");
    expect(formatCountdown(45)).toBe("45m");
    expect(formatCountdown(125)).toBe("2h 5m");
  });
});
