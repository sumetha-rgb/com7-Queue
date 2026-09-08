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
    const ticket = data as { id: string; queue_no: number };
    const { data: details } = await supabase.from("queue_tickets").select("candidates(full_name,email,position_applied,interview_period),events(name)").eq("id", ticket.id).single();
    const candidate = (details?.candidates as unknown as { full_name: string; email: string | null; position_applied: string | null; interview_period: string | null }[] | undefined)?.[0] ?? null;
    const event = (details?.events as unknown as { name: string }[] | undefined)?.[0] ?? null;
    let emailStatus: "sent" | "failed" | "pending" = "pending";
    if (candidate?.email && event) {
      try {
        await sendQueueTicketEmail({ to: candidate.email, fullName: candidate.full_name, queueNo: ticket.queue_no, position: candidate.position_applied, period: candidate.interview_period, eventName: event.name });
        emailStatus = "sent";
        await supabase.from("queue_tickets").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", ticket.id);
        await supabase.from("audit_logs").insert({ actor_id: user.id, action: "send_email", entity_type: "queue_ticket", entity_id: ticket.id });
      } catch (emailError) {
        emailStatus = "failed";
        const message = emailError instanceof Error ? emailError.message : "ส่งอีเมลไม่สำเร็จ";
        await supabase.from("queue_tickets").update({ email_status: "failed", email_error: message }).eq("id", ticket.id);
      }
    }
    return NextResponse.json({ ticket: data, emailStatus });
  } catch (error) {
    return toErrorResponse(error, "ข้อมูลไม่ถูกต้อง");
  }
}