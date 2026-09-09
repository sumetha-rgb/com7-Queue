import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await requireRole(["admin"]);
    const { data, error } = await supabase
      .from("google_sheet_connections")
      .select(
        "id,event_id,sheet_url,sheet_name,last_synced_at,last_sync_status,last_sync_error,events(name,event_date,status)",
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ connections: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถโหลดการเชื่อมต่อ Sheet ได้");
  }
}

export async function DELETE(request: Request) {
  try {
    const { connectionId } = z
      .object({ connectionId: z.string().uuid() })
      .parse(await request.json());
    const { supabase } = await requireRole(["admin"]);

    const { data: connection, error: findError } = await supabase
      .from("google_sheet_connections")
      .select("event_id")
      .eq("id", connectionId)
      .single();
    if (findError) throw findError;

    // Hide this Event from the working queue while retaining its history.
    // Queue history remains accessible, but it cannot be selected for new
    // check-ins after its source Sheet is disconnected.
    const { error: closeError } = await supabase
      .from("events")
      .update({ status: "closed" })
      .eq("id", connection.event_id);
    if (closeError) throw closeError;

    const { error } = await supabase
      .from("google_sheet_connections")
      .delete()
      .eq("id", connectionId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถยกเลิกการเชื่อมต่อ Sheet ได้");
  }
}
