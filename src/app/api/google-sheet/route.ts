import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { sheetIdFromUrl } from "@/lib/google-sheet-sync";
import { z } from "zod";

const connectionSchema = z.object({ eventId: z.string().uuid(), sheetUrl: z.string().url(), sheetName: z.string().trim().max(100).optional() });
export async function POST(request: Request) {
  try { const input = connectionSchema.parse(await request.json()); if (!sheetIdFromUrl(input.sheetUrl)) return NextResponse.json({ message: "ลิงก์ Google Sheet ไม่ถูกต้อง" }, { status: 400 }); const { supabase, user } = await requireRole(["admin"]); const { data, error } = await supabase.from("google_sheet_connections").upsert({ event_id: input.eventId, sheet_url: input.sheetUrl, sheet_name: input.sheetName || null, created_by: user.id }, { onConflict: "event_id" }).select().single(); if (error) throw error; return NextResponse.json({ connection: data }); }
  catch (error) { return toErrorResponse(error, "บันทึกการเชื่อมต่อไม่สำเร็จ"); }
}