"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_POLICIES,
  type Priority,
  type SlaSnapshot,
  type Ticket,
  formatCountdown,
} from "@/lib/sla";
import { DEMO_NOW } from "@/lib/demo-now";
import styles from "./page.module.css";

export default function HomePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [snapshots, setSnapshots] = useState<SlaSnapshot[]>([]);
  const [now, setNow] = useState(DEMO_NOW);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("p3");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = (data: {
    tickets?: Ticket[];
    snapshots?: SlaSnapshot[];
    now?: number;
  }) => {
    if (data.tickets) setTickets(data.tickets);
    if (data.snapshots) setSnapshots(data.snapshots);
    if (typeof data.now === "number") setNow(data.now);
  };

  const refresh = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/tickets");
      if (!res.ok) {
        setError("Failed to load tickets");
        return;
      }
      apply((await res.json()) as {
        tickets: Ticket[];
        snapshots: SlaSnapshot[];
        now: number;
      });
    } catch {
      setError("Network error loading tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTicket = async () => {
    if (!title.trim()) {
      setError("Enter a ticket title first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), priority }),
      });
      const data = (await res.json()) as {
        tickets?: Ticket[];
        snapshots?: SlaSnapshot[];
        now?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      apply(data);
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  const setOffset = async (offsetMin: number) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateOffsetMin: offsetMin }),
      });
      if (!res.ok) {
        setError("Failed to simulate time");
        return;
      }
      apply((await res.json()) as {
        tickets: Ticket[];
        snapshots: SlaSnapshot[];
        now: number;
      });
    } finally {
      setBusy(false);
    }
  };

  const pause = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/pause`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Pause failed");
        return;
      }
      apply((await res.json()) as {
        tickets: Ticket[];
        snapshots: SlaSnapshot[];
        now: number;
      });
    } finally {
      setBusy(false);
    }
  };

  const advance = async (
    id: string,
    action?: "escalate" | "resolve" | "resume",
  ) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tickets/${encodeURIComponent(id)}/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action ? { action } : {}),
        },
      );
      if (!res.ok) {
        setError("Advance failed");
        return;
      }
      apply((await res.json()) as {
        tickets: Ticket[];
        snapshots: SlaSnapshot[];
        now: number;
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.shell}>
        <p className={styles.empty}>Loading SLA compass…</p>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.rose} aria-hidden>
          <span>N</span>
          <span>E</span>
          <span>S</span>
          <span>W</span>
        </div>
        <div>
          <p className={styles.eyebrow}>BUSINESS-HOURS CLOCK · PERSISTED</p>
          <h1>SLA Compass</h1>
          <p className={styles.lede}>
            Steer tickets by priority bearing. Pauses stop the clock; escalation
            fires before full breach. Tickets live in data/tickets.json.
          </p>
        </div>
      </header>

      <section className={styles.policies} aria-label="Priority policies">
        <div className={styles.policyHead}>
          <strong>Policy</strong>
          <span>Target</span>
          <span>Escalate after</span>
        </div>
        {(Object.keys(DEFAULT_POLICIES) as Priority[]).map((p) => {
          const pol = DEFAULT_POLICIES[p];
          return (
            <div key={p}>
              <strong>{p.toUpperCase()}</strong>
              <span>{pol.targetMinutes}m</span>
              <span>{pol.escalateAfterMinutes}m</span>
            </div>
          );
        })}
      </section>

      {error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.toolbar}>
        <label>
          Simulate now (+min)
          <input
            type="number"
            value={Math.round((now - DEMO_NOW) / 60_000)}
            disabled={busy}
            onChange={(e) => void setOffset(Number(e.target.value))}
          />
        </label>
        <label>
          New ticket
          <input
            value={title}
            placeholder="Describe the issue"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {(["p1", "p2", "p3", "p4"] as Priority[]).map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void addTicket()}
        >
          Open ticket
        </button>
      </section>

      <section className={styles.list}>
        {tickets.length === 0 ? (
          <p className={styles.empty}>
            No open tickets — create one above to start the SLA clock.
          </p>
        ) : (
          tickets.map((ticket) => {
            const snap = snapshots.find((s) => s.ticketId === ticket.id);
            if (!snap) return null;
            return (
              <article
                key={ticket.id}
                className={styles.card}
                data-state={snap.state}
              >
                <header>
                  <div>
                    <p className={styles.id}>{ticket.id}</p>
                    <h2>{ticket.title}</h2>
                  </div>
                  <div className={styles.bearing}>
                    <span>{ticket.priority.toUpperCase()}</span>
                    <strong data-state={snap.state}>{snap.state}</strong>
                  </div>
                </header>

                <div className={styles.clock}>
                  <div>
                    <span>Elapsed</span>
                    <strong>{formatCountdown(snap.elapsedBusinessMin)}</strong>
                  </div>
                  <div>
                    <span>Remaining</span>
                    <strong>
                      {snap.remainingBusinessMin < 0
                        ? `+${formatCountdown(-snap.remainingBusinessMin)} over`
                        : formatCountdown(snap.remainingBusinessMin)}
                    </strong>
                  </div>
                  <div>
                    <span>Escalation</span>
                    <strong>
                      {snap.shouldEscalate
                        ? "DUE"
                        : snap.nextEscalationInMin == null
                          ? "—"
                          : formatCountdown(snap.nextEscalationInMin)}
                    </strong>
                  </div>
                </div>

                <div className={styles.actions}>
                  {ticket.status === "open" || ticket.status === "escalated" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void pause(ticket.id)}
                    >
                      Pause
                    </button>
                  ) : null}
                  {ticket.status === "paused" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void advance(ticket.id, "resume")}
                    >
                      Resume
                    </button>
                  ) : null}
                  {ticket.status !== "resolved" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void advance(ticket.id, "escalate")}
                      >
                        Escalate
                      </button>
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={busy}
                        onClick={() => void advance(ticket.id, "resolve")}
                      >
                        Resolve
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      <footer className={styles.foot}>
        Saeed Rumaneh · SLA Compass · /api/tickets · Mon–Fri 09:00–17:00 UTC
      </footer>
    </main>
  );
}
