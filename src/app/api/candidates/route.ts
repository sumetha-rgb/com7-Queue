import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";

type TicketRow = {
  candidate_id: string;
  check_in_status: string;
  interview_status: string;
  email_status: string;
  [key: string]: unknown;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]);
    const url = new URL(request.url); const page = Math.max(Number(url.searchParams.get("page")) || 1, 1); const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
    const search = url.searchParams.get("search")?.trim(); const eventId = url.searchParams.get("eventId"); const eventIds = (url.searchParams.get("eventIds") ?? eventId ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)); const category = url.searchParams.get("category"); const checkInStatus = url.searchParams.get("checkInStatus"); const emailStatus = url.searchParams.get("emailStatus");
    const includeHidden = url.searchParams.get("includeHidden") === "1";
    // Load candidates and tickets independently. This deliberately avoids a
    // nested PostgREST relation: a stale relationship cache can otherwise
    // return an empty queue_tickets array even when the ticket exists.
    let query = supabase.from("candidates").select("id,interview_id,full_name,phone_number,email,position_applied,employee_category,interview_date,interview_period,event_id,is_visible", { count: "exact" });
    if (!includeHidden) query = query.eq("is_visible", true);
    if (eventIds.length === 1) query = query.eq("event_id", eventIds[0]);
    else if (eventIds.length > 1) query = query.in("event_id", eventIds);
    if (category === "พนักงานหน้าร้าน" || category === "ออฟฟิศ") query = query.eq("employee_category", category);
    if (search) query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,position_applied.ilike.%${search}%,interview_id.ilike.%${search}%`);
    const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    const candidateIds = (data ?? []).map((candidate) => candidate.id);
    const { data: tickets, error: ticketsError } = candidateIds.length
      ? await supabase
          .from("queue_tickets")
          .select("*")
          .in("candidate_id", candidateIds)
          .order("queue_date", { ascending: false })
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (ticketsError) throw ticketsError;
    const checkerIds = [...new Set(
      (tickets ?? [])
        .map((ticket) => ticket.checked_in_by)
        .filter((id): id is string => Boolean(id)),
    )];
    const { data: checkers, error: checkersError } = checkerIds.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", checkerIds)
      : { data: [], error: null };
    if (checkersError) throw checkersError;
    const checkerNames = new Map(
      (checkers ?? []).map((profile) => [
        profile.id,
        profile.full_name || profile.email || "ผู้ใช้ระบบ",
      ]),
    );
    const ticketsByCandidate = new Map<string, TicketRow[]>();
    for (const ticket of (tickets ?? []) as TicketRow[]) {
      const list = ticketsByCandidate.get(ticket.candidate_id) ?? [];
      list.push(ticket);
      ticketsByCandidate.set(ticket.candidate_id, list);
    }
    let candidates = (data ?? []).map((candidate) => ({
      ...candidate,
      // The first item is always the latest queue record for this candidate.
      queue_tickets: (ticketsByCandidate.get(candidate.id) ?? [])
        .slice(0, 1)
        .map((ticket) => ({
          ...ticket,
          checked_in_by_name: ticket.checked_in_by
            ? checkerNames.get(ticket.checked_in_by) ?? null
            : null,
        })),
    }));
    if (checkInStatus === "no_queue") candidates = candidates.filter((candidate) => candidate.queue_tickets.length === 0);
    if (checkInStatus === "checked_in") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.check_in_status === "เช็คชื่อแล้ว");
    if (checkInStatus === "not_checked_in") candidates = candidates.filter((candidate) => candidate.queue_tickets.length === 0 || candidate.queue_tickets[0]?.check_in_status === "ยังไม่เช็คชื่อ");
    if (checkInStatus === "not_interviewed") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.interview_status === "ยังไม่สัมภาษณ์");
    if (checkInStatus === "interviewed") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.interview_status === "สัมภาษณ์แล้ว");
    if (checkInStatus === "no_show") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.interview_status === "ไม่เข้าร่วม");
    if (emailStatus === "pending") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.email_status !== "sent");
    if (emailStatus === "sent") candidates = candidates.filter((candidate) => candidate.queue_tickets[0]?.email_status === "sent");
    return NextResponse.json({ candidates, pagination: { page, limit, total: count ?? 0 } });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถดึงรายชื่อได้"); }
}
