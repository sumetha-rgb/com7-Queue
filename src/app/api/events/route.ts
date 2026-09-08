import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { createEventSchema } from "@/lib/validation";
export async function GET(request: Request) {
  try { const { supabase } = await requireRole(["admin", "interviewer", "viewer"]); const month = new URL(request.url).searchParams.get("month"); let query = supabase.from("events").select("*").order("event_date", { ascending: true }); if (month && /^\d{4}-\d{2}$/.test(month)) { const start = `${month}-01`; const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10); query = query.gte("event_date", start).lt("event_date", end); } const { data, error } = await query; if (error) throw error; return NextResponse.json({ events: data }); }
  catch (error) { return toErrorResponse(error, "ไม่สามารถโหลดรายการ Event ได้"); }
}
export async function POST(request: Request) {
  try {
    const input = createEventSchema.parse(await request.json());
    const { supabase } = await requireRole(["admin"]);
    const { data, error } = await supabase.from("events").insert({ name: input.name, event_date: input.event_date, location: input.location || null, status: input.status }).select().single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถสร้าง Event ได้"); }
}