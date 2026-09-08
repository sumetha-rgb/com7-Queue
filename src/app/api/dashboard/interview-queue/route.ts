import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]); const eventId = new URL(request.url).searchParams.get("eventId");
    let candidates = supabase.from("candidates").select("id, queue_tickets(*)", { count: "exact" }).eq("is_visible", true); if (eventId) candidates = candidates.eq("event_id", eventId);
    const { data, count, error } = await candidates; if (error) throw error;
    const tickets = (data ?? []).flatMap((row) => row.queue_tickets as { check_in_status: string; interview_status: string; email_status: string }[]);
    return NextResponse.json({ total: count ?? 0, checkedIn: tickets.filter((x) => x.check_in_status === "เช็คชื่อแล้ว").length, pending: (count ?? 0) - tickets.length, interviewed: tickets.filter((x) => x.interview_status === "สัมภาษณ์แล้ว").length, noShow: tickets.filter((x) => x.interview_status === "ไม่เข้าร่วม").length, emailSent: tickets.filter((x) => x.email_status === "sent").length });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถโหลดสรุปข้อมูลได้"); }
}