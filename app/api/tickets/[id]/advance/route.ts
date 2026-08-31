import { NextResponse } from "next/server";
import { advancePersistedTicket, listTickets } from "@/lib/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: { action?: "escalate" | "resolve" | "resume" } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const ticket = advancePersistedTicket(id, body.action);
    return NextResponse.json({ ticket, ...listTickets() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Advance failed" },
      { status: 400 },
    );
  }
}
