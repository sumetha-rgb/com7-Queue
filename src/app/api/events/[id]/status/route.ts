import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { z } from "zod";
const input = z.object({ status: z.enum(["draft", "active", "closed"]) });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const { status } = input.parse(await request.json()); const { supabase } = await requireRole(["admin"]); const { data, error } = await supabase.from("events").update({ status }).eq("id", id).select().single(); if (error) throw error; return NextResponse.json({ event: data }); }
  catch (error) { return toErrorResponse(error, "เปลี่ยนสถานะ Event ไม่สำเร็จ"); }
}