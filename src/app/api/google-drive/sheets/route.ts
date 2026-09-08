import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { listQueueSourceSheets } from "@/lib/google-drive";

export async function GET() {
  try { await requireRole(["admin"]); return NextResponse.json({ files: await listQueueSourceSheets() }); }
  catch (error) { return toErrorResponse(error, "ไม่สามารถอ่านโฟลเดอร์ได้"); }
}