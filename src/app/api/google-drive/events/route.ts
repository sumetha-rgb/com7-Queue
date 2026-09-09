import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listQueueSourceSheets } from "@/lib/google-drive";
import {
  downloadGoogleSheet,
  mapSheetCandidate,
  parseInterviewDate,
  saveCandidatesBatchWithoutReplacingTickets,
  sheetIdFromUrl,
  sheetRowsHash,
} from "@/lib/google-sheet-sync";
import { z } from "zod";

const inputSchema = z.object({
  fileId: z.string().optional(),
  sheetName: z.string().trim().min(1).max(100).default("ผู้สมัคร"),
  activate: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireRole(["admin", "interviewer", "viewer"]);
    const admin = createSupabaseAdminClient();
    const files = await listQueueSourceSheets();
    const { data: connections } = await admin
      .from("google_sheet_connections")
      .select("sheet_url, event_id, events(id,name,event_date,status)");
    const byFileId = new Map(
      (connections ?? []).map((connection) => [
        sheetIdFromUrl(connection.sheet_url),
        connection,
      ]),
    );
    return NextResponse.json({
      connected: true,
      fileCount: files.length,
      items: files.map((file) => {
        const event = byFileId.get(file.id)?.events as
          | { id: string; name: string; event_date: string; status: string }
          | null
          | undefined;
        return {
          fileId: file.id,
          fileName: file.name,
          modifiedTime: file.modifiedTime,
          url: file.url,
          eventId: event?.id ?? null,
          eventName: event?.name ?? null,
          eventDate: event?.event_date ?? null,
          eventStatus: event?.status ?? null,
        };
      }),
    });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถอ่านโฟลเดอร์ Drive ได้");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const input = inputSchema.parse(await request.json().catch(() => ({})));
    const admin = createSupabaseAdminClient();
    const files = await listQueueSourceSheets();
    const file = files.find((item) => item.id === input.fileId);
    if (!file)
      return NextResponse.json(
        { message: "ไม่พบไฟล์ที่เลือกในโฟลเดอร์" },
        { status: 404 },
      );
    const { data: connections } = await admin
      .from("google_sheet_connections")
      .select("sheet_url,event_id,drive_file_id");
    const connection = (connections ?? []).find(
      (item) =>
        item.drive_file_id === file.id ||
        sheetIdFromUrl(item.sheet_url) === file.id,
    );
    if (connection) {
      if (input.activate)
        await admin
          .from("events")
          .update({ status: "active" })
          .eq("id", connection.event_id);
      return NextResponse.json({
        eventId: connection.event_id,
        imported: 0,
        eventName: file.name,
      });
    }
    const { rows } = await downloadGoogleSheet(file.url, input.sheetName);
    const eventDate =
      parseInterviewDate(rows[0]?.Interview_Date) ??
      new Date().toISOString().slice(0, 10);
    const { data: event, error: eventError } = await admin
      .from("events")
      .insert({
        name: file.name,
        event_date: eventDate,
        status: input.activate ? "active" : "draft",
      })
      .select("id")
      .single();
    if (eventError || !event)
      throw eventError ?? new Error("สร้าง Event ไม่สำเร็จ");
    const { error: connectionError } = await admin
      .from("google_sheet_connections")
      .insert({
        event_id: event.id,
        sheet_url: file.url,
        sheet_name: input.sheetName,
        drive_file_id: file.id,
        last_sync_status: "pending",
      });
    if (connectionError) {
      await admin.from("events").delete().eq("id", event.id);
      throw connectionError;
    }
    const mappingRejected: Array<{ interviewId: string; fullName: string; reason: string }> = [];
    const candidates = rows.flatMap((row) => {
      try {
        return [mapSheetCandidate(row, event.id)];
      } catch (error) {
        mappingRejected.push({
          interviewId: row.Interview_Id?.trim() ?? "",
          fullName: row.Fullname?.trim() || "ไม่ระบุชื่อ",
          reason: error instanceof Error ? error.message : "ข้อมูลไม่ครบถ้วน",
        });
        return [];
      }
    });
    const result = await saveCandidatesBatchWithoutReplacingTickets(
      admin,
      candidates,
    );
    const imported = result.imported;
    const rejected = [...mappingRejected, ...result.rejected];
    const errors = rejected.length;
    await admin
      .from("google_sheet_connections")
      .update({
        source_hash: errors ? null : sheetRowsHash(rows),
        last_synced_at: new Date().toISOString(),
        last_sync_status: errors ? "completed_with_errors" : "success",
        last_sync_error: errors
            ? `${errors} records could not be imported: ${rejected.map((row) => `${row.fullName} (${row.reason})`).join(", ")}`
          : null,
      })
      .eq("event_id", event.id);
    return NextResponse.json({
      eventId: event.id,
      eventName: file.name,
      imported,
      errors,
      rejected,
    });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถนำเข้า Google Sheet จาก Drive ได้");
  }
}
