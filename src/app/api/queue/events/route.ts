import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]);
    const [{ data: events, error: eventsError }, { data: connections, error: connectionsError }, { data: candidates, error: candidatesError }, { data: tickets, error: ticketsError }] = await Promise.all([
      supabase.from("events").select("id,name,event_date,status").eq("status", "active").order("event_date", { ascending: false }),
      supabase.from("google_sheet_connections").select("event_id,sheet_url,sheet_name"),
      supabase.from("candidates").select("id,event_id"),
      supabase.from("queue_tickets").select("id,candidate_id,event_id,queue_no,queue_date,check_in_status,interview_status,email_status"),
    ]);
    if (eventsError) throw eventsError;
    if (connectionsError) throw connectionsError;
    if (candidatesError) throw candidatesError;
    if (ticketsError) throw ticketsError;
    const connectionByEvent = new Map((connections ?? []).map((connection) => [connection.event_id, connection]));
    const countByEvent = new Map<string, number>();
    for (const ticket of tickets ?? []) {
      countByEvent.set(ticket.event_id, (countByEvent.get(ticket.event_id) ?? 0) + 1);
    }
    return NextResponse.json({ events: (events ?? []).filter((event) => countByEvent.has(event.id)).map((event) => ({ ...event, ticketCount: countByEvent.get(event.id) ?? 0, sheet: connectionByEvent.get(event.id) ?? null })) });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถโหลด Event ที่มีบัตรคิวได้"); }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireRole(["admin"]);
    const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ message: "ไม่พบ Event" }, { status: 400 });
    const { error: closeError } = await supabase
      .from("events")
      .update({ status: "closed" })
      .eq("id", eventId);
    if (closeError) throw closeError;
    await supabase.from("google_sheet_connections").delete().eq("event_id", eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถลบ Event ออกจากประวัติได้");
  }
}