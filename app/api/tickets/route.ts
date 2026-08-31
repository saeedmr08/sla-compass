import { NextResponse } from "next/server";
import type { Priority } from "@/lib/sla";
import {
  createPersistedTicket,
  listTickets,
  setSimulatedNow,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listTickets());
}

export async function POST(request: Request) {
  let body: {
    title?: string;
    priority?: Priority;
    simulateOffsetMin?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.simulateOffsetMin === "number") {
    setSimulatedNow(body.simulateOffsetMin);
    return NextResponse.json(listTickets());
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const ticket = createPersistedTicket(
    body.title.trim(),
    body.priority ?? "p3",
  );
  return NextResponse.json({ ticket, ...listTickets() }, { status: 201 });
}
