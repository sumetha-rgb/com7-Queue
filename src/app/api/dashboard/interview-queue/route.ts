import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]); const params = new URL(request.url).searchParams; const eventId = params.get("eventId"); const eventIds = (params.get("eventIds") ?? eventId ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    let candidates = supabase.from("candidates").select("id", { count: "exact" }).eq("is_visible", true); if (eventIds.length === 1) candidates = candidates.eq("event_id", eventIds[0]); else if (eventIds.length > 1) candidates = candidates.in("event_id", eventIds);
    const { count, error } = await candidates; if (error) throw error;
    let ticketsQuery = supabase.from("queue_tickets").select("candidate_id,check_in_status,interview_status,email_status,queue_date,created_at");
    if (eventIds.length === 1) ticketsQuery = ticketsQuery.eq("event_id", eventIds[0]); else if (eventIds.length > 1) ticketsQuery = ticketsQuery.in("event_id", eventIds);
    ticketsQuery = ticketsQuery
      .order("queue_date", { ascending: false })
      .order("created_at", { ascending: false });
    const { data: tickets, error: ticketsError } = await ticketsQuery;
    if (ticketsError) throw ticketsError;
    const latestTickets = new Map<string, (typeof tickets)[number]>();
    for (const ticket of tickets ?? []) {
      if (!latestTickets.has(ticket.candidate_id)) {
        latestTickets.set(ticket.candidate_id, ticket);
      }
    }
    const currentTickets = [...latestTickets.values()];
    return NextResponse.json({ total: count ?? 0, checkedIn: currentTickets.filter((x) => x.check_in_status === "เช็คชื่อแล้ว").length, pending: Math.max(0, (count ?? 0) - currentTickets.length), interviewed: currentTickets.filter((x) => x.interview_status === "สัมภาษณ์แล้ว").length, noShow: currentTickets.filter((x) => x.interview_status === "ไม่เข้าร่วม").length, emailSent: currentTickets.filter((x) => x.email_status === "sent").length });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถโหลดสรุปข้อมูลได้"); }
}
