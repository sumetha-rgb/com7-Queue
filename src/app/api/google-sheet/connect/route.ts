import { NextResponse } from "next/server";
import { requireRole, toErrorResponse, AppError } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  sheetUrl: z.string().min(1),
  sheetName: z.string().trim().max(100).optional(),
  eventName: z.string().trim().max(200).optional(),
});

/**
 * "Paste a link, get data immediately" — the whole point is to skip the
 * separate "create/pick an Event first" step. Given just a Google Sheet URL:
 *  - if this exact Sheet was already connected before, reuse its Event
 *    (and flip it to active if it was still a draft) so re-pasting the same
 *    link just refreshes the data instead of duplicating an Event;
 *  - otherwise create a new Event on the fly, named from the Sheet (or the
 *    optional eventName) and dated from the first row's Interview_Date,
 *    falling back to today if that column is missing/unparseable so a badly
 *    formatted sheet never blocks loading;
 * then imports/updates every candidate row and returns the Event id so the
 * dashboard can switch straight to it.
 */
export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const input = inputSchema.parse(await request.json());
    const sheetId = sheetIdFromUrl(input.sheetUrl);
    if (!sheetId)
      return NextResponse.json(
        {
          message:
            "ลิงก์ Google Sheet ไม่ถูกต้อง กรุณาวางลิงก์แบบ https://docs.google.com/spreadsheets/d/...",
        },
        { status: 400 },
      );

    const { rows } = await downloadGoogleSheet(
      input.sheetUrl,
      input.sheetName,
    ).catch((error: unknown) => {
      // Bubble up the specific reason (wrong tab name, no access, etc.) instead
      // of the generic fallback message, since this is an admin-only screen
      // and the specific reason is exactly what they need to fix it.
      throw new AppError(
        error instanceof Error
          ? error.message
          : "ไม่สามารถอ่าน Google Sheet ได้",
        400,
      );
    });
    const admin = createSupabaseAdminClient();

    const { data: allConnections } = await admin
      .from("google_sheet_connections")
      .select("id, event_id, sheet_url, drive_file_id");
    const existing = (allConnections ?? []).find(
      (connection) =>
        connection.drive_file_id === sheetId ||
        sheetIdFromUrl(connection.sheet_url) === sheetId,
    );

    let eventId: string;
    let eventName: string;
    if (existing) {
      eventId = existing.event_id;
      await admin
        .from("google_sheet_connections")
        .update({
          sheet_url: input.sheetUrl,
          sheet_name: input.sheetName || null,
          drive_file_id: sheetId,
        })
        .eq("id", existing.id);
      await admin
        .from("events")
        .update({ status: "active" })
        .eq("id", eventId)
        .eq("status", "draft");
      const { data: event } = await admin
        .from("events")
        .select("name")
        .eq("id", eventId)
        .single();
      eventName = event?.name ?? "Event";
    } else {
      const eventDate =
        parseInterviewDate(rows[0]?.Interview_Date) ??
        new Date().toISOString().slice(0, 10);
      eventName =
        input.eventName?.trim() ||
        rows[0]?.Event_Name?.trim() ||
        `Event จาก Google Sheet ${eventDate}`;
      const { data: event, error: eventError } = await admin
        .from("events")
        .insert({ name: eventName, event_date: eventDate, status: "active" })
        .select("id")
        .single();
      if (eventError || !event)
        throw eventError ?? new Error("สร้าง Event ไม่สำเร็จ");
      eventId = event.id;
      const { error: connectionError } = await admin
        .from("google_sheet_connections")
        .insert({
          event_id: eventId,
          sheet_url: input.sheetUrl,
          sheet_name: input.sheetName || null,
          drive_file_id: sheetId,
          last_sync_status: "pending",
        });
      if (connectionError) {
        // A unique Sheet id can reject this insert. Remove the just-created,
        // empty Event so it never appears as a duplicate Event with 0 rows.
        await admin.from("events").delete().eq("id", eventId);
        throw connectionError;
      }
    }

    const mappingRejected: Array<{
      interviewId: string;
      fullName: string;
      reason: string;
    }> = [];
    const candidates = rows.flatMap((row) => {
      try {
        return [mapSheetCandidate(row, eventId)];
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
      .eq("event_id", eventId);

    return NextResponse.json({
      eventId,
      eventName,
      imported,
      errors,
      rejected,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json(
        { message: `เชื่อมต่อไม่สำเร็จ: ${error.message}` },
        { status: error instanceof AppError ? error.status : 400 },
      );
    }
    return toErrorResponse(
      error,
      "เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาตรวจสอบลิงก์และสิทธิ์การเข้าถึง",
    );
  }
}
