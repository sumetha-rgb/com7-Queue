import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listQueueSourceSheets } from "@/lib/google-drive";
import { downloadGoogleSheet, mapSheetCandidate, parseInterviewDate } from "@/lib/google-sheet-sync";
import { z } from "zod";

const inputSchema = z.object({ fileId: z.string().optional(), sheetName: z.string().trim().min(1).max(100).default("ผู้สมัคร") });
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]); const input = inputSchema.parse(await request.json().catch(() => ({}))); const admin = createSupabaseAdminClient(); const allFiles = await listQueueSourceSheets(); const files = input.fileId ? allFiles.filter((file) => file.id === input.fileId) : allFiles; if (input.fileId && !files.length) return NextResponse.json({ message: "ไม่พบไฟล์ที่เลือกในโฟลเดอร์" }, { status: 404 }); const results: { name: string; status: string }[] = [];
    for (const file of files) {
      const { data: connected } = await admin.from("google_sheet_connections").select("event_id").eq("drive_file_id", file.id).maybeSingle();
      if (connected) { results.push({ name: file.name, status: "already_connected" }); continue; }
      const { rows } = await downloadGoogleSheet(file.url, input.sheetName);
      const eventDate = parseInterviewDate(rows[0]?.Interview_Date);
      if (!eventDate) { results.push({ name: file.name, status: "needs_date_review" }); continue; }
      const { data: event, error: eventError } = await admin.from("events").insert({ name: file.name, event_date: eventDate, status: "draft" }).select("id").single();
      if (eventError || !event) { results.push({ name: file.name, status: "failed" }); continue; }
      const { error: connectionError } = await admin.from("google_sheet_connections").insert({ event_id: event.id, drive_file_id: file.id, sheet_url: file.url, sheet_name: input.sheetName, last_sync_status: "pending" });
      if (connectionError) { results.push({ name: file.name, status: "connection_failed" }); continue; }
      let importErrors = 0;
      for (const row of rows) { try { const { error: upsertError } = await admin.from("candidates").upsert(mapSheetCandidate(row, event.id), { onConflict: "interview_id" }); if (upsertError) throw upsertError; } catch { importErrors++; } }
      await admin.from("google_sheet_connections").update({ last_synced_at: new Date().toISOString(), last_sync_status: importErrors ? "completed_with_errors" : "success", last_sync_error: importErrors ? `${importErrors} records could not be imported` : null }).eq("event_id", event.id);
      results.push({ name: file.name, status: importErrors ? "created_draft_with_errors" : "created_draft" });
    }
    return NextResponse.json({ results });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถค้นหา Event จาก Drive ได้"); }
}