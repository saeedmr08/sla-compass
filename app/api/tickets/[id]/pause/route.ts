import { NextResponse } from "next/server";
import { listTickets, pausePersistedTicket } from "@/lib/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let reason = "waiting on customer";
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { reason?: string };
      if (body.reason) reason = body.reason;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const ticket = pausePersistedTicket(id, reason);
    return NextResponse.json({ ticket, ...listTickets() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pause failed" },
      { status: 400 },
    );
  }
}
