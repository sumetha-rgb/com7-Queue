import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  downloadGoogleSheet,
  mapSheetCandidate,
  saveCandidatesBatchWithoutReplacingTickets,
  sheetRowsHash,
} from "@/lib/google-sheet-sync";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { z } from "zod";

async function sync(eventId?: string, connectionId?: string) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("google_sheet_connections").select("*");
  if (eventId) query = query.eq("event_id", eventId);
  if (connectionId) query = query.eq("id", connectionId);
  const { data: connections, error } = await query;
  if (error) throw error;
  const results: {
    id: string;
    imported: number;
    errors: number;
    changed: boolean;
    rejected?: unknown[];
  }[] = [];
  for (const connection of connections ?? []) {
    let lockAcquired = false;
    try {
      const { data: locked, error: lockError } = await admin.rpc(
        "try_lock_sheet_sync",
        { p_connection_id: connection.id, p_lock_seconds: 60 },
      );
      if (lockError) throw lockError;
      if (!locked) continue;
      lockAcquired = true;
      const { rows } = await downloadGoogleSheet(
        connection.sheet_url,
        connection.sheet_name ?? undefined,
      );
      const sourceHash = sheetRowsHash(rows);
      if (connection.source_hash === sourceHash) {
        results.push({ id: connection.id, imported: 0, errors: 0, changed: false });
        continue;
      }
      const mappingRejected: Array<{ interviewId: string; fullName: string; reason: string }> = [];
      const candidates = rows.flatMap((row) => {
        try {
          return [mapSheetCandidate(row, connection.event_id)];
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
      const rejected = [...mappingRejected, ...result.rejected];
      const errors = rejected.length;
      await admin
        .from("google_sheet_connections")
        .update({
          // Retain the previous hash if rows failed so the corrected data is
          // retried automatically on the next sync rather than being ignored.
          source_hash: errors ? connection.source_hash : sourceHash,
          last_synced_at: new Date().toISOString(),
          last_sync_status: errors ? "completed_with_errors" : "success",
          last_sync_error: errors
            ? `${errors} records could not be imported: ${rejected.map((row) => `${row.fullName} (${row.reason})`).join(", ")}`
            : null,
        })
        .eq("id", connection.id);
      const imported = result.imported;
      results.push({
        id: connection.id,
        imported,
        errors,
        changed: imported > 0,
        rejected,
      });
    } catch (syncError) {
      await admin
        .from("google_sheet_connections")
        .update({
          last_sync_status: "failed",
          last_sync_error:
            syncError instanceof Error ? syncError.message : "sync failed",
        })
        .eq("id", connection.id);
      results.push({ id: connection.id, imported: 0, errors: 1, changed: false });
    } finally {
      if (lockAcquired)
        await admin
          .from("google_sheet_connections")
          .update({ sync_lock_until: null })
          .eq("id", connection.id);
    }
  }
  return results;
}
export async function POST(request: Request) {
  try {
    // Allow either a logged-in admin (from the dashboard) OR a trusted webhook
    // call (e.g. a Google Apps Script "onEdit" trigger in the Sheet) that
    // presents the same secret used by the Vercel cron, so a Sheet edit can
    // trigger an immediate sync instead of waiting for the 15-minute cron.
    const isWebhook =
      request.headers.get("authorization") ===
      `Bearer ${process.env.CRON_SECRET}`;
    if (!isWebhook) await requireRole(["admin"]);
    const body = z
      .object({
        eventId: z.string().uuid().optional(),
        connectionId: z.string().uuid().optional(),
      })
      .parse(await request.json());
    return NextResponse.json({
      results: await sync(body.eventId, body.connectionId),
    });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถซิงก์ข้อมูลได้");
  }
}
export async function GET(request: Request) {
  if (
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ results: await sync() });
  } catch {
    return NextResponse.json({ message: "Sync failed" }, { status: 500 });
  }
}
