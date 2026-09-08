"use client";

import { useCallback, useEffect, useState } from "react";

type Event = { id: string; name: string; event_date: string; status: "draft" | "active" | "closed" };
const currentMonth = new Date().toISOString().slice(0, 7);

export function GoogleSheetSyncPanel({ onSynced }: { onSynced: () => Promise<void> }) {
  const [month, setMonth] = useState(currentMonth); const [events, setEvents] = useState<Event[]>([]); const [eventId, setEventId] = useState(""); const [url, setUrl] = useState(""); const [sheetName, setSheetName] = useState("ผู้สมัคร"); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const loadEvents = useCallback(async () => { const response = await fetch(`/api/events?month=${month}`); if (response.status === 401) { window.location.href = "/login"; return; } const data = await response.json(); setEvents(data.events ?? []); setEventId((selected) => data.events?.some((event: Event) => event.id === selected) ? selected : data.events?.find((event: Event) => event.status === "active")?.id ?? data.events?.[0]?.id ?? ""); }, [month]);
  useEffect(() => { void loadEvents(); }, [loadEvents]);
  async function connectAndSync() { if (!eventId || !url.trim()) { setMessage("เลือก Event และวางลิงก์ Google Sheet ก่อน"); return; } setBusy(true); setMessage(""); const saved = await fetch("/api/google-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, sheetUrl: url.trim(), sheetName }) }); if (saved.status === 401) { window.location.href = "/login"; return; } if (!saved.ok) { setMessage((await saved.json()).message ?? "เชื่อมต่อไม่สำเร็จ"); setBusy(false); return; } const connection = (await saved.json()).connection as { id: string }; const sync = await fetch("/api/sync/google-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: connection.id }) }); const data = await sync.json(); const result = data.results?.[0]; setMessage(sync.ok ? `อัปเดตสำเร็จ ${result.imported} รายการ${result.errors ? ` · มีปัญหา ${result.errors} รายการ` : ""}` : data.message ?? "ซิงก์ไม่สำเร็จ"); setBusy(false); await onSynced(); }
  return (
    <section className="mt-5 rounded-xl border border-emerald-800/30 bg-emerald-800/20 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-emerald-100">เดือน Event<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-lg bg-white px-3 py-2 text-sm text-slate-800" /></label>
        <label className="min-w-56 flex-1 text-xs text-emerald-100">Event ในเดือนนี้<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 block w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-800"><option value="">เลือก Event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.event_date} · {event.name} [{event.status}]</option>)}</select></label>
        <label className="min-w-72 flex-1 text-xs text-emerald-100">ลิงก์ Google Sheet<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="mt-1 block w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-800" /></label>
        <label className="text-xs text-emerald-100">ชื่อแท็บ<input value={sheetName} onChange={(event) => setSheetName(event.target.value)} className="mt-1 block w-28 rounded-lg bg-white px-3 py-2 text-sm text-slate-800" /></label>
        <button disabled={busy} onClick={() => void connectAndSync()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-900 disabled:text-slate-400">{busy ? "กำลังอัปเดต..." : "ผูกและซิงก์"}</button>
      </div>
      <div className="mt-3 flex justify-between gap-3">
        <p className="text-xs text-emerald-50">ตั้งค่าแชร์ Google Sheet เป็น &quot;ทุกคนที่มีลิงก์ - ดูได้&quot; ก่อนวางลิงก์ · ระบบจะซิงก์ข้อมูลใหม่อัตโนมัติทุก 15 นาทีหลังผูกสำเร็จ · Event ปิดแล้วจะเก็บประวัติแต่ไม่ควรนำมาเปิดคิวใหม่</p>
      </div>
      {message && <p className="mt-2 text-xs text-amber-100">{message}</p>}
    </section>
  );
}