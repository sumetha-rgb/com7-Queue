"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type EventStatus = "draft" | "active" | "closed";
type Event = { id: string; name: string; event_date: string; status: EventStatus };
const currentMonth = new Date().toISOString().slice(0, 7);
const statusLabel: Record<EventStatus, string> = { draft: "ร่าง", active: "เปิดใช้งาน", closed: "ปิดแล้ว" };
const statusStyle: Record<EventStatus, string> = { draft: "bg-slate-100 text-slate-600", active: "bg-emerald-50 text-emerald-700", closed: "bg-amber-50 text-amber-700" };

export default function AdminEventsPage() {
  const [month, setMonth] = useState(currentMonth);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/events?month=${month}`);
    if (response.status === 401) { window.location.href = "/login"; return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "ไม่สามารถโหลดรายการ Event ได้"); setEvents([]); setLoading(false); return; }
    setEvents(data.events ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  async function createEvent() {
    if (!name.trim() || !eventDate) { setMessage("กรุณากรอกชื่อ Event และวันที่"); return; }
    setCreating(true); setMessage("");
    const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, event_date: eventDate, location, status: "draft" }) });
    if (response.status === 401) { window.location.href = "/login"; return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "ไม่สามารถสร้าง Event ได้"); setCreating(false); return; }
    setMessage(`สร้าง Event "${data.event.name}" สำเร็จ ถัดไปให้ไปหน้า "ผูก/ซิงก์ Sheet" เพื่อวางลิงก์ Google Sheet ของ Event นี้`);
    setName(""); setEventDate(""); setLocation(""); setShowCreate(false); setCreating(false);
    await loadEvents();
  }

  async function updateStatus(eventId: string, status: EventStatus) {
    setMessage("");
    const response = await fetch(`/api/events/${eventId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.status === 401) { window.location.href = "/login"; return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "เปลี่ยนสถานะ Event ไม่สำเร็จ"); return; }
    await loadEvents();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">จัดการ Event</h1>
            <p className="mt-1 text-sm text-slate-500">สร้าง Event ใหม่ แล้วไปผูกลิงก์ Google Sheet ของ Event นั้น (ไม่ต้องใช้ Google Cloud / Service Account — แค่แชร์ชีทเป็น &quot;ทุกคนที่มีลิงก์ดูได้&quot;)</p>
          </div>
          <div className="flex gap-2">
            <Link href="/interview-queue" className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm sm:flex-none">กลับหน้าคิว</Link>
            <button onClick={() => setShowCreate((value) => !value)} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white sm:flex-none">
              {showCreate ? "ยกเลิก" : "+ สร้าง Event ใหม่"}
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="w-full text-xs text-slate-600 sm:min-w-56 sm:flex-1">ชื่อ Event
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น Interview Day โรงแรม..." className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="w-full text-xs text-slate-600 sm:w-auto">วันที่ Event
                <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto" />
              </label>
              <label className="w-full text-xs text-slate-600 sm:min-w-40 sm:flex-1">สถานที่ (ไม่บังคับ)
                <input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <button disabled={creating} onClick={() => void createEvent()} className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300 sm:w-auto">{creating ? "กำลังสร้าง..." : "สร้าง Event"}</button>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          <label className="text-sm text-slate-600">เดือน
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>

        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        {/* Desktop table */}
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">วันที่ Event</th>
                <th className="p-3">ชื่อ Event</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">กำลังโหลดข้อมูล...</td></tr>
              ) : events.length ? (
                events.map((event) => (
                  <tr key={event.id} className="border-t border-slate-100">
                    <td className="p-3">{event.event_date}</td>
                    <td className="p-3 font-medium">{event.name}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${statusStyle[event.status]}`}>{statusLabel[event.status]}</span></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {event.status !== "active" && <button onClick={() => void updateStatus(event.id, "active")} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">เปิดใช้งาน</button>}
                        {event.status !== "closed" && <button onClick={() => void updateStatus(event.id, "closed")} className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50">ปิด Event</button>}
                        {event.status !== "draft" && <button onClick={() => void updateStatus(event.id, "draft")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">กลับเป็นร่าง</button>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">ยังไม่มี Event ในเดือนนี้ ลองกด &quot;+ สร้าง Event ใหม่&quot;</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="mt-4 space-y-3 md:hidden">
          {loading ? (
            <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">กำลังโหลดข้อมูล...</p>
          ) : events.length ? (
            events.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{event.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{event.event_date}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${statusStyle[event.status]}`}>{statusLabel[event.status]}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.status !== "active" && <button onClick={() => void updateStatus(event.id, "active")} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50">เปิดใช้งาน</button>}
                  {event.status !== "closed" && <button onClick={() => void updateStatus(event.id, "closed")} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">ปิด Event</button>}
                  {event.status !== "draft" && <button onClick={() => void updateStatus(event.id, "draft")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">กลับเป็นร่าง</button>}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">ยังไม่มี Event ในเดือนนี้ ลองกด &quot;+ สร้าง Event ใหม่&quot;</p>
          )}
        </div>
      </div>
    </main>
  );
}