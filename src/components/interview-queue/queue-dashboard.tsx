"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  Search,
  Users,
} from "lucide-react";
import { QueueTicketModal } from "./queue-ticket-modal";

type Ticket = {
  id: string;
  queue_no: number;
  check_in_status: string;
  interview_status: string;
  checked_in_at: string;
  checked_in_by: string | null;
  checked_in_by_name?: string | null;
  email_status: string;
};

type Candidate = {
  id: string;
  full_name: string;
  position_applied: string | null;
  employee_category: string;
  interview_date?: string | null;
  interview_period: string | null;
  queue_tickets: Ticket[];
};

type EventOption = {
  id: string;
  name: string;
  event_date: string;
  status: "draft" | "active" | "closed";
  candidate_count: number;
  event_ids: string[];
};

type DriveEventOption = {
  fileId: string;
  fileName: string;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  eventStatus: string | null;
};

type Summary = {
  total: number;
  checkedIn: number;
  pending: number;
  interviewed: number;
  noShow: number;
  emailSent: number;
};

const empty: Summary = {
  total: 0,
  checkedIn: 0,
  pending: 0,
  interviewed: 0,
  noShow: 0,
  emailSent: 0,
};

const thisMonth = "";

function Badge({ value }: { value: string }) {
  const label =
    value === "pending"
      ? "ยังไม่ส่ง"
      : value === "sent"
        ? "ส่งแล้ว"
        : value === "failed"
          ? "ส่งไม่สำเร็จ"
          : value;

  const style =
    value.includes("แล้ว") || value === "sent"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value.includes("ไม่เข้าร่วม") || value === "failed"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}
    >
      {label}
    </span>
  );
}

export function QueueDashboard() {
  const LegacyQueueTicketModal = QueueTicketModal;

  const [month, setMonth] = useState(thisMonth);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [driveEvents, setDriveEvents] = useState<DriveEventOption[]>([]);
  const [driveSearch, setDriveSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [showEventNameDialog, setShowEventNameDialog] = useState(false);
  const [items, setItems] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<Summary>(empty);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [checkInStatus, setCheckInStatus] = useState("all");
  const [emailStatus, setEmailStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const preferredEventId = useRef<string | null>(null);
  const syncInFlight = useRef(false);

  const chooseEvent = useCallback((id: string) => {
    setEventId(id);
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem("com7-last-queue-event", id);
    else window.localStorage.removeItem("com7-last-queue-event");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("event", id);
    else url.searchParams.delete("event");
    window.history.replaceState(null, "", url);
  }, []);

  const returnToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId),
    [events, eventId],
  );
  const filteredDriveEvents = useMemo(() => {
    const query = driveSearch.trim().toLocaleLowerCase("th-TH");
    if (!query) return driveEvents;
    return driveEvents.filter((file) =>
      file.fileName.toLocaleLowerCase("th-TH").includes(query),
    );
  }, [driveEvents, driveSearch]);
  const duplicateEventKeys = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      const key = `${event.event_date}:${event.name}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [events]);

  const loadEvents = useCallback(async () => {
    const [eventsResponse, driveResponse] = await Promise.all([
      fetch(`/api/events?month=${month}`, { cache: "no-store" }),
      fetch("/api/google-drive/events", { cache: "no-store" }),
    ]);

    const data = await eventsResponse.json();
    const driveData = await driveResponse.json();

    if (eventsResponse.status === 401 || driveResponse.status === 401) {
      returnToLogin();
      return;
    }

    if (!eventsResponse.ok) {
      setNotice(data.message ?? "ไม่สามารถโหลด Event ได้");
      return;
    }

    const availableEvents = data.events ?? [];
    setEvents(availableEvents);
    setEventId((current) =>
      availableEvents.some((event: EventOption) => event.id === current)
        ? current
        : (availableEvents.find(
            (event: EventOption) =>
              event.id === preferredEventId.current && event.candidate_count > 0,
          )?.id ??
          availableEvents
            .filter((event: EventOption) => event.status === "active")
            .sort(
              (left: EventOption, right: EventOption) =>
                right.candidate_count - left.candidate_count,
            )[0]?.id ??
          availableEvents[0]?.id ??
          ""),
    );
    setDriveEvents(driveResponse.ok ? (driveData.items ?? []) : []);
  }, [month, returnToLogin]);

  const loadQueue = useCallback(
    async (background = false) => {
      if (!eventId) {
        setItems([]);
        setSummary(empty);
        return;
      }

      if (!background) setLoading(true);

      const selectedEventIds = selectedEvent?.event_ids ?? [eventId];
      const query = new URLSearchParams({ limit: "100", eventIds: selectedEventIds.join(",") });
      if (search.trim()) query.set("search", search.trim());
      if (category !== "all") query.set("category", category);
      if (checkInStatus !== "all") query.set("checkInStatus", checkInStatus);
      if (emailStatus !== "all") query.set("emailStatus", emailStatus);

      try {
        const [listResponse, summaryResponse] = await Promise.all([
          fetch(`/api/candidates?${query}`, { cache: "no-store" }),
          fetch(`/api/dashboard/interview-queue?eventIds=${selectedEventIds.join(",")}`, {
            cache: "no-store",
          }),
        ]);

        const list = await listResponse.json();
        const dashboard = await summaryResponse.json();

        if (listResponse.status === 401 || summaryResponse.status === 401) {
          returnToLogin();
          return;
        }

        setItems(list.candidates ?? []);
        setSummary(summaryResponse.ok ? dashboard : empty);

        if (!listResponse.ok && !background) {
          setNotice(list.message ?? "ไม่สามารถโหลดรายชื่อได้");
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [eventId, selectedEvent, search, category, checkInStatus, emailStatus, returnToLogin],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      preferredEventId.current =
        new URLSearchParams(window.location.search).get("event") ||
        window.localStorage.getItem("com7-last-queue-event");
    }
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const timer = setTimeout(() => void loadQueue(), 250);
    return () => clearTimeout(timer);
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedEvent?.event_ids.length) return;
    const syncTimer = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || syncInFlight.current) return;
      syncInFlight.current = true;
      try {
        const results = await Promise.all(
          selectedEvent.event_ids.map(async (id) => {
            const response = await fetch("/api/sync/google-sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId: id }),
              cache: "no-store",
            });
            if (!response.ok) return false;
            const data = await response.json();
            return data.results?.some((result: { changed?: boolean }) => result.changed) ?? false;
          }),
        );
        if (results.some(Boolean)) {
          await loadEvents();
          await loadQueue(true);
        }
      } finally {
        syncInFlight.current = false;
      }
    }, 30000);
    return () => window.clearInterval(syncTimer);
  }, [selectedEvent, loadEvents, loadQueue]);

  async function selectDriveEvent(fileId: string) {
    const driveEvent = driveEvents.find((item) => item.fileId === fileId);
    if (!driveEvent) {
      chooseEvent(fileId);
      return;
    }

    if (driveEvent.eventId) {
      chooseEvent(driveEvent.eventId);
      return;
    }

    setConnecting(true);
    setNotice("กำลังนำเข้าข้อมูลจาก Google Sheet...");
    try {
      const response = await fetch("/api/google-drive/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, sheetName: "ผู้สมัคร", activate: true }),
      });
      const data = await response.json();
      if (response.ok && data.eventId) {
        await loadEvents();
        chooseEvent(data.eventId);
        setNotice(
          `โหลด ${data.imported ?? 0} รายการจาก ${driveEvent.fileName} แล้ว`,
        );
      } else {
        setNotice(data.message ?? "ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้");
      }
    } catch {
      setNotice("การเชื่อมต่อ Drive ขัดข้อง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setConnecting(false);
    }
  }

  function requestConnection() {
    if (!sheetUrl.trim()) return;
    setNewEventName("");
    setShowEventNameDialog(true);
  }

  async function connect() {
    if (!sheetUrl.trim() || !newEventName.trim()) {
      setNotice("กรุณาระบุชื่อ Event เพื่อใช้ส่งแจ้งทางอีเมล");
      return;
    }

    setShowEventNameDialog(false);
    setConnecting(true);

    try {
      const response = await fetch("/api/google-sheet/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: sheetUrl.trim(),
          eventName: newEventName.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSheetUrl("");
        setNewEventName("");
        await loadEvents();
        chooseEvent(data.eventId);
        const firstRejectedReason = data.rejected?.[0]?.reason;
        setNotice(
          data.imported > 0
            ? `โหลด ${data.imported} รายการจาก ${data.eventName} แล้ว${data.errors ? ` ข้าม ${data.errors} รายการ${firstRejectedReason ? `: ${firstRejectedReason}` : ""}` : ""}`
            : `เชื่อมต่อแล้ว แต่ยังนำเข้าได้ 0 รายการ${firstRejectedReason ? `: ${firstRejectedReason}` : " กรุณาตรวจสอบหัวตารางและข้อมูลใน Sheet"}`,
        );
      } else {
        setNotice(data.message ?? "เชื่อมต่อ Sheet ไม่สำเร็จ");
      }
    } catch {
      setNotice(
        "เชื่อมต่อ Sheet ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
      );
    } finally {
      setConnecting(false);
    }
  }

  async function checkIn(candidate: Candidate) {
    const response = await fetch("/api/queue/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidate.id }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      setNotice(data.message ?? "ออกคิวไม่สำเร็จ");
      return;
    }

    const ticket = data.ticket as Ticket;
    const updatedCandidate = {
      ...candidate,
      queue_tickets: [ticket],
    };

    setItems((current) =>
      current.map((item) =>
        item.id === candidate.id ? updatedCandidate : item,
      ),
    );
    setSelected(updatedCandidate);

    setSummary((current) => ({
      ...current,
      checkedIn:
        current.checkedIn + (ticket.check_in_status === "เช็คชื่อแล้ว" ? 1 : 0),
      pending: Math.max(0, current.pending - 1),
      emailSent: current.emailSent + (ticket.email_status === "sent" ? 1 : 0),
    }));

    setNotice(
      data.emailStatus === "failed"
        ? `เช็คชื่อสำเร็จ ได้คิว #${ticket.queue_no} แต่ส่งอีเมลไม่สำเร็จ`
        : `เช็คชื่อสำเร็จ ได้คิว #${ticket.queue_no}`,
    );
  }

  async function changeInterviewStatus(ticketId: string, status: string) {
    const response = await fetch(`/api/queue/${ticketId}/interview-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      setNotice(data.message ?? "ปรับสถานะไม่สำเร็จ");
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.queue_tickets[0]?.id === ticketId
          ? {
              ...item,
              queue_tickets: [
                {
                  ...item.queue_tickets[0],
                  ...data.ticket,
                  interview_status: status,
                },
              ],
            }
          : item,
      ),
    );

    setSelected((current) =>
      current
        ? {
            ...current,
            queue_tickets: [
              {
                ...current.queue_tickets[0],
                ...data.ticket,
                interview_status: status,
              },
            ],
          }
        : current,
    );

    setNotice("บันทึกสถานะสัมภาษณ์แล้ว");
  }

  const metrics = [
    ["ผู้สมัครทั้งหมด", summary.total, Users],
    ["เช็คชื่อแล้ว", summary.checkedIn, CheckCircle2],
    ["ยังไม่เช็คชื่อ", summary.pending, Clock3],
    ["สัมภาษณ์แล้ว", summary.interviewed, CheckCircle2],
    ["ไม่เข้าร่วม", summary.noShow, Clock3],
    ["Email ส่งแล้ว", summary.emailSent, Mail],
  ] as const;

  return (
    <main className="min-h-screen bg-[#f8faf9]">
      <header className="border-b border-slate-200 bg-white px-5 py-7 text-slate-900 shadow-sm">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                COM7 Recruitment
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                ระบบบัตรคิวสัมภาษณ์
              </h1>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            รายชื่อจาก Google Sheet · เช็คชื่อ ออกคิว และส่งอีเมลจากระบบนี้
          </p>

            <div className="mt-5 grid gap-2 md:grid-cols-[150px_1fr]">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setEventPickerOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm"
              >
                <span className="truncate">
                  {selectedEvent
                    ? `${selectedEvent.event_date} · ${selectedEvent.name}`
                    : "เลือก Event"}
                </span>
                <ChevronDown className="ml-3 h-4 w-4 shrink-0" />
              </button>
              {eventPickerOpen && (
                <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {events.map((event) => {
                    const key = `${event.event_date}:${event.name}`;
                    const duplicate = (duplicateEventKeys.get(key) ?? 0) > 1;
                    return (
                      <button
                        key={event.id}
                        onClick={() => {
                          chooseEvent(event.id);
                          setEventPickerOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 ${event.id === eventId ? "bg-emerald-50 text-emerald-800" : "text-slate-700"}`}
                      >
                        <span>
                          {event.event_date} · {event.name}
                        </span>
                        {duplicate && (
                          <span className="ml-2 text-xs text-amber-600">
                            รายการซ้ำ · {event.id.slice(-6)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <div className="relative min-w-64 md:w-72">
              <input
                value={driveSearch}
                onChange={(event) => setDriveSearch(event.target.value)}
                disabled={connecting || driveEvents.length === 0}
                placeholder={driveEvents.length ? "ค้นหา Google Sheet จาก Drive" : "ไม่พบ Google Sheet ใน Drive"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm disabled:text-slate-400"
              />
              {driveSearch && filteredDriveEvents.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {filteredDriveEvents.map((file) => (
                    <button
                      key={file.fileId}
                      type="button"
                      onClick={() => {
                        setDriveSearch("");
                        void selectDriveEvent(file.fileId);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                    >
                      {file.fileName}{file.eventName ? " (เชื่อมแล้ว)" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="วางลิงก์ Google Sheet สำหรับ Event ใหม่"
              className="min-w-64 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
            />
            <button
              disabled={!sheetUrl.trim() || connecting}
              onClick={requestConnection}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm disabled:text-slate-400"
            >
              {connecting ? "กำลังโหลด..." : "เชื่อมต่อ Sheet"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-5 md:p-8">
        <h2 className="text-lg font-bold text-slate-800">
          {selectedEvent
            ? `${selectedEvent.name} · ผู้สมัคร ${summary.total} คน`
            : "เลือก Event เพื่อเริ่มเช็คชื่อ"}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {metrics.map(([title, value, Icon]) => (
            <article
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <Icon className="h-4 w-4 text-emerald-700" />
              <strong className="mt-3 block text-2xl">{value}</strong>
              <span className="text-xs text-slate-500">{title}</span>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full outline-none"
              placeholder="ค้นหาชื่อ, เบอร์, อีเมล, ตำแหน่ง, ID"
            />
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <option value="all">กลุ่มงาน: ทั้งหมด</option>
            <option>พนักงานหน้าร้าน</option>
            <option>ออฟฟิศ</option>
          </select>
          <select
            value={checkInStatus}
            onChange={(e) => setCheckInStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <option value="all">สถานะเช็คชื่อ: ทั้งหมด</option>
            <option value="no_queue">ยังไม่มีคิว</option>
            <option value="checked_in">เช็คชื่อแล้ว</option>
            <option value="not_checked_in">ยังไม่เช็คชื่อ</option>
            <option value="not_interviewed">ยังไม่สัมภาษณ์</option>
            <option value="interviewed">สัมภาษณ์แล้ว</option>
            <option value="no_show">ไม่เข้าร่วม</option>
          </select>
          <select
            value={emailStatus}
            onChange={(e) => setEmailStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <option value="all">สถานะอีเมล: ทั้งหมด</option>
            <option value="pending">ยังไม่ส่ง Email</option>
            <option value="sent">ส่ง Email แล้ว</option>
          </select>
        </div>

        {notice && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "คิว",
                  "กลุ่มงาน",
                  "ชื่อ-สกุล",
                  "ตำแหน่ง",
                  "ช่วงเวลา",
                  "เช็คชื่อ",
                  "สัมภาษณ์",
                  "Email",
                ].map((title) => (
                  <th className="p-3" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : (
                items.map((candidate) => {
                  const ticket = candidate.queue_tickets[0];
                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => setSelected(candidate)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50"
                    >
                      <td className="p-3 font-bold text-emerald-700">
                        {ticket ? `#${ticket.queue_no}` : "-"}
                      </td>
                      <td className="p-3">{candidate.employee_category}</td>
                      <td className="p-3 font-medium">{candidate.full_name}</td>
                      <td className="p-3">
                        {candidate.position_applied ?? "-"}
                      </td>
                      <td className="p-3">
                        {candidate.interview_period ?? "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          value={ticket?.check_in_status ?? "ยังไม่เช็คชื่อ"}
                        />
                      </td>
                      <td className="p-3">
                        <Badge
                          value={ticket?.interview_status ?? "ยังไม่สัมภาษณ์"}
                        />
                      </td>
                      <td className="p-3">
                        <Badge value={ticket?.email_status ?? "pending"} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <LegacyQueueTicketModal
          candidate={selected}
          eventName={selectedEvent?.name ?? ""}
          onClose={() => setSelected(null)}
          onCheckIn={checkIn}
          onStatusChange={changeInterviewStatus}
        />
      )}

      {showEventNameDialog && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">ตั้งชื่อ Event</h2>
            <p className="mt-2 text-sm text-slate-600">
              กรุณากรอกชื่ออีเวนต์เพื่อใช้ส่งแจ้งไปที่อีเมลผู้สมัคร
            </p>
            <input
              autoFocus
              value={newEventName}
              onChange={(event) => setNewEventName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void connect();
              }}
              placeholder="เช่น Interview Day หาดใหญ่"
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-800 outline-emerald-600"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowEventNameDialog(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                disabled={!newEventName.trim() || connecting}
                onClick={() => void connect()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                {connecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ Sheet"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function LegacyQueueTicketModal({
  candidate,
  eventName,
  onClose,
  onCheckIn,
  onStatusChange,
}: {
  candidate: Candidate;
  eventName: string;
  onClose: () => void;
  onCheckIn: (candidate: Candidate) => Promise<void>;
  onStatusChange: (ticketId: string, status: string) => Promise<void>;
}) {
  const ticket = candidate.queue_tickets[0];
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-emerald-700 p-7 text-white">
          <button
            onClick={onClose}
            className="float-right rounded-full bg-white/20 px-3 py-1 text-xl"
          >
            ×
          </button>
          <p className="text-sm text-emerald-100">ลำดับคิว</p>
          <p className="text-6xl font-bold">
            {ticket ? `#${ticket.queue_no}` : "-"}
          </p>
          <h2 className="mt-4 text-2xl font-bold">{candidate.full_name}</h2>
          <p className="mt-1 text-sm text-emerald-100">{eventName}</p>
        </div>

        <div className="space-y-5 p-7">
          <div className="flex gap-2">
            <Badge value={ticket?.check_in_status ?? "ยังไม่เช็คชื่อ"} />
            <Badge value={ticket?.interview_status ?? "ยังไม่สัมภาษณ์"} />
          </div>

          <Detail
            label="ตำแหน่งที่สมัคร"
            value={candidate.position_applied ?? "-"}
          />
          <Detail
            label="ช่วงเวลาสัมภาษณ์"
            value={candidate.interview_period ?? "-"}
          />

          {ticket ? (
            <>
              <Detail
                label="เวลาเช็คชื่อ"
                value={new Date(ticket.checked_in_at).toLocaleString("th-TH")}
              />
              <label className="block text-sm font-semibold text-slate-500">
                ปรับสถานะสัมภาษณ์
                <select
                  defaultValue={ticket.interview_status}
                  disabled={busy}
                  onChange={async (e) => {
                    setBusy(true);
                    await onStatusChange(ticket.id, e.target.value);
                    setBusy(false);
                  }}
                  className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-800"
                >
                  <option>ยังไม่สัมภาษณ์</option>
                  <option>สัมภาษณ์แล้ว</option>
                  <option>ไม่เข้าร่วม</option>
                </select>
              </label>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onCheckIn(candidate);
                setBusy(false);
              }}
              className="w-full rounded-xl bg-emerald-700 py-4 text-base font-bold text-white disabled:bg-slate-300"
            >
              {busy ? "กำลังออกคิวและส่งอีเมล..." : "เช็คชื่อ & ออกบัตรคิว"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
