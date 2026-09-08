import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]);
    const url = new URL(request.url); const page = Math.max(Number(url.searchParams.get("page")) || 1, 1); const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
    const search = url.searchParams.get("search")?.trim(); const eventId = url.searchParams.get("eventId"); const category = url.searchParams.get("category");
    const includeHidden = url.searchParams.get("includeHidden") === "1";
    let query = supabase.from("candidates").select("id,interview_id,full_name,phone_number,email,position_applied,employee_category,interview_date,interview_period,event_id,is_visible,queue_tickets(*)", { count: "exact" });
    if (!includeHidden) query = query.eq("is_visible", true);
    if (eventId) query = query.eq("event_id", eventId);
    if (category === "พนักงานหน้าร้าน" || category === "ออฟฟิศ") query = query.eq("employee_category", category);
    if (search) query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,position_applied.ilike.%${search}%,interview_id.ilike.%${search}%`);
    const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    return NextResponse.json({ candidates: data, pagination: { page, limit, total: count ?? 0 } });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถดึงรายชื่อได้"); }
}