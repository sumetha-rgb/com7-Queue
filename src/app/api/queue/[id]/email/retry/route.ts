import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { interviewStatusSchema, uuidSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; uuidSchema.parse(id);
    const { status } = interviewStatusSchema.parse(await request.json());
    const { supabase, user } = await requireRole(["admin", "interviewer"]);
    const { data, error } = await supabase.from("queue_tickets").update({ interview_status: status }).eq("id", id).select().single();
    if (error) return NextResponse.json({ message: "ไม่สามารถปรับสถานะได้" }, { status: 400 });
    await supabase.from("audit_logs").insert({ actor_id: user.id, action: "change_interview_status", entity_type: "queue_ticket", entity_id: id, new_value: data });
    return NextResponse.json({ ticket: data });
  } catch (error) { return toErrorResponse(error, "ไม่มีสิทธิ์หรือข้อมูลไม่ถูกต้อง"); }
}