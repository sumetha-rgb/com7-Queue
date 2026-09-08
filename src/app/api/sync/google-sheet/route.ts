import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { downloadGoogleSheet, mapSheetCandidate } from "@/lib/google-sheet-sync";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { z } from "zod";

async function sync(eventId?: string, connectionId?: string) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("google_sheet_connections").select("*");
  if (eventId) query = query.eq("event_id", eventId); if (connectionId) query = query.eq("id", connectionId);
  const { data: connections, error } = await query; if (error) throw error;
  const results: { id: string; imported: number; errors: number }[] = [];
  for (const connection of connections ?? []) {
    try {
      const { rows } = await downloadGoogleSheet(connection.sheet_url, connection.sheet_name ?? undefined);
      let imported = 0; let errors = 0;
      for (const row of rows) {
        try { const candidate = mapSheetCandidate(row, connection.event_id); const { error: upsertError } = await admin.from("candidates").upsert(candidate, { onConflict: "interview_id" }); if (upsertError) throw upsertError; imported++; } catch { errors++; }
      }
      await admin.from("google_sheet_connections").update({ last_synced_at: new Date().toISOString(), last_sync_status: errors ? "completed_with_errors" : "success", last_sync_error: errors ? `${errors} records could not be imported` : null }).eq("id", connection.id);
      results.push({ id: connection.id, imported, errors });
    } catch (syncError) { await admin.from("google_sheet_connections").update({ last_sync_status: "failed", last_sync_error: syncError instanceof Error ? syncError.message : "sync failed" }).eq("id", connection.id); results.push({ id: connection.id, imported: 0, errors: 1 }); }
  }
  return results;
}
export async function POST(request: Request) {
  try {
    // Allow either a logged-in admin (from the dashboard) OR a trusted webhook
    // call (e.g. a Google Apps Script "onEdit" trigger in the Sheet) that
    // presents the same secret used by the Vercel cron, so a Sheet edit can
    // trigger an immediate sync instead of waiting for the 15-minute cron.
    const isWebhook = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
    if (!isWebhook) await requireRole(["admin"]);
    const body = z.object({ eventId: z.string().uuid().optional(), connectionId: z.string().uuid().optional() }).parse(await request.json());
    return NextResponse.json({ results: await sync(body.eventId, body.connectionId) });
  } catch (error) { return toErrorResponse(error, "ไม่สามารถซิงก์ข้อมูลได้"); }
}
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ results: await sync() }); } catch { return NextResponse.json({ message: "Sync failed" }, { status: 500 }); }
}