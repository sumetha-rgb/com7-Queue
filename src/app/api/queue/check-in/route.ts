import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { checkInSchema } from "@/lib/validation";
import { sendQueueTicketEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = checkInSchema.parse(await request.json());
    const { supabase, user } = await requireRole(["admin"]);
    const { data, error } = await supabase.rpc("check_in_candidate", { p_candidate_id: body.candidateId, p_admin_id: user.id });
    if (error) return NextResponse.json({ message: error.message }, { status: error.code === "42501" ? 403 : 409 });
    const ticket = (Array.isArray(data) ? data[0] : data) as { id: string; queue_no: number };
    const { data: details } = await supabase.from("queue_tickets").select("candidates(full_name,email,position_applied,interview_period,interview_date),events(name,event_date)").eq("id", ticket.id).single();
    // These are many-to-one relations from a ticket, so PostgREST returns
    // objects (not arrays). Treating them as arrays silently skipped email.
    const candidate = details?.candidates as unknown as { full_name: string; email: string | null; position_applied: string | null; interview_period: string | null; interview_date: string | null } | null;
    const event = details?.events as unknown as { name: string; event_date: string } | null;
    let emailStatus: "sent" | "failed" | "pending" = "pending";
    if (candidate?.email && event) {
      try {
        await sendQueueTicketEmail({ to: candidate.email, fullName: candidate.full_name, queueNo: ticket.queue_no, position: candidate.position_applied, period: candidate.interview_period, date: candidate.interview_date ?? event.event_date, eventName: event.name });
        emailStatus = "sent";
        await supabase.from("queue_tickets").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", ticket.id);
        await supabase.from("audit_logs").insert({ actor_id: user.id, action: "send_email", entity_type: "queue_ticket", entity_id: ticket.id });
      } catch (emailError) {
        emailStatus = "failed";
        const message = emailError instanceof Error ? emailError.message : "ส่งอีเมลไม่สำเร็จ";
        await supabase.from("queue_tickets").update({ email_status: "failed", email_error: message }).eq("id", ticket.id);
      }
    }
    const { data: latestTicket, error: latestTicketError } = await supabase.from("queue_tickets").select("*").eq("id", ticket.id).single();
    if (latestTicketError) throw latestTicketError;
    const { data: checker } = latestTicket.checked_in_by ? await supabase.from("profiles").select("full_name").eq("id", latestTicket.checked_in_by).maybeSingle() : { data: null };
    return NextResponse.json({ ticket: { ...latestTicket, checked_in_by_name: checker?.full_name ?? null }, emailStatus });
  } catch (error) {
    return toErrorResponse(error, "ข้อมูลไม่ถูกต้อง");
  }
}
