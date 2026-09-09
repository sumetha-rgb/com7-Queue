import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { createEventSchema } from "@/lib/validation";
export async function GET(request: Request) {
  try {
    const { supabase } = await requireRole(["admin", "interviewer", "viewer"]);
    const month = new URL(request.url).searchParams.get("month");
    let query = supabase
      .from("events")
      .select("*")
      .eq("status", "active")
      .order("event_date", { ascending: true });
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = `${month}-01`;
      const end = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1),
      )
        .toISOString()
        .slice(0, 10);
      query = query.gte("event_date", start).lt("event_date", end);
    }
    const [
      { data: events, error },
      { data: connections, error: connectionsError },
      { data: candidates, error: candidatesError },
    ] = await Promise.all([
      query,
      supabase.from("google_sheet_connections").select("event_id,sheet_url,drive_file_id"),
      supabase.from("candidates").select("event_id,interview_id,is_visible"),
    ]);
    if (error) throw error;
    if (connectionsError) throw connectionsError;
    if (candidatesError) throw candidatesError;
    const connectionByEvent = new Map(
      (connections ?? []).map((connection) => [connection.event_id, connection]),
    );
    const grouped = new Map<string, {
      event: (typeof events)[number];
      event_ids: string[];
      candidate_count: number;
    }>();
    for (const event of events ?? []) {
      const connection = connectionByEvent.get(event.id);
      if (!connection) continue;
      const groupKey = `${event.event_date}:${event.name.trim().toLocaleLowerCase("th-TH")}`;
      const current = grouped.get(groupKey);
      if (current) {
        current.event_ids.push(event.id);
      } else {
        grouped.set(groupKey, {
          event,
          event_ids: [event.id],
          candidate_count: 0,
        });
      }
    }
    const groupByEventId = new Map<string, string>();
    for (const [groupKey, group] of grouped) {
      for (const id of group.event_ids) groupByEventId.set(id, groupKey);
    }
    const candidateIdsByGroup = new Map<string, Set<string>>();
    for (const candidate of candidates ?? []) {
      if (candidate.is_visible === false) continue;
      const groupKey = groupByEventId.get(candidate.event_id);
      if (!groupKey) continue;
      const ids = candidateIdsByGroup.get(groupKey) ?? new Set<string>();
      ids.add(candidate.interview_id);
      candidateIdsByGroup.set(groupKey, ids);
    }
    for (const [groupKey, group] of grouped) {
      group.candidate_count = candidateIdsByGroup.get(groupKey)?.size ?? 0;
    }
    return NextResponse.json({
      events: [...grouped.values()].map(({ event, event_ids, candidate_count }) => ({
        ...event,
        event_ids,
        candidate_count,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถโหลดรายการ Event ได้");
  }
}
export async function POST(request: Request) {
  try {
    const input = createEventSchema.parse(await request.json());
    const { supabase } = await requireRole(["admin"]);
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: input.name,
        event_date: input.event_date,
        location: input.location || null,
        status: input.status,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถสร้าง Event ได้");
  }
}
