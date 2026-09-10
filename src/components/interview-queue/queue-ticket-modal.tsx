"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Users, UserCheck, UserRoundCheck } from "lucide-react";

type Ticket = { id: string; queue_no: number; check_in_status: string; interview_status: string; checked_in_at: string; checked_in_by: string | null; checked_in_by_name?: string | null; email_status: string };
type Candidate = { id: string; full_name: string; position_applied: string | null; employee_category: string; interview_date?: string | null; interview_period: string | null; queue_tickets: Ticket[] };

function Badge({ value }: { value: string }) {
  const label = value === "pending" ? "ยังไม่ส่ง" : value === "sent" ? "ส่งแล้ว" : value === "failed" ? "ส่งไม่สำเร็จ" : value;
  const green = value === "เช็คชื่อแล้ว" || value === "สัมภาษณ์แล้ว" || value === "sent";
  const red = value === "ไม่เข้าร่วม" || value === "failed";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${green ? "border-emerald-300 bg-emerald-50 text-emerald-700" : red ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>{green && <CheckCircle2 className="h-3.5 w-3.5" />}{label}</span>;
}

function Detail({ icon: Icon, label, value, green }: { icon: typeof Users; label: string; value: string; green?: boolean }) {
  return <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400"><Icon className="h-4 w-4" /></span><div><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-base font-semibold ${green ? "text-emerald-600" : "text-slate-800"}`}>{value || "-"}</p></div></div>;
}

function thaiDate(value: string | null | undefined) {
  if (!value) return "-";
  const text = value.trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return value;
  const year = Number(match[1] ?? match[6]); const month = Number(match[2] ?? match[5]); const day = Number(match[3] ?? match[4]);
  const buddhistYear = year > 2400 ? year : year + 543;
  return `${day} ${new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(Date.UTC(year > 2400 ? year - 543 : year, month - 1, day)))} ${buddhistYear}`;
}

export function QueueTicketModal({ candidate, eventName, onClose, onCheckIn, onStatusChange }: { candidate: Candidate; eventName: string; onClose: () => void; onCheckIn: (candidate: Candidate) => Promise<void>; onStatusChange: (ticketId: string, status: string) => Promise<void> }) {
  const ticket = candidate.queue_tickets[0];
  const [busy, setBusy] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState(ticket?.interview_status ?? "ยังไม่สัมภาษณ์");
  useEffect(() => { setInterviewStatus(ticket?.interview_status ?? "ยังไม่สัมภาษณ์"); }, [ticket?.id, ticket?.interview_status]);
  const checkedIn = ticket?.check_in_status === "เช็คชื่อแล้ว";
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <section
        className="mx-auto min-h-full w-full max-w-lg bg-white shadow-2xl sm:min-h-0 sm:max-h-[90vh] sm:overflow-y-auto sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-emerald-700 p-7 text-white">
          <button onClick={onClose} className="float-right rounded-full bg-white/20 px-3 py-1 text-xl">x</button>
          <p className="text-sm text-emerald-100">ลำดับคิว</p>
          <p className="text-6xl font-bold">{ticket ? ticket.queue_no : "-"}</p>
          <h2 className="mt-4 text-2xl font-bold">{candidate.full_name}</h2>
          <p className="mt-1 text-sm text-emerald-100">{eventName}</p>
        </div>
        <div className="space-y-1 p-7 pb-10">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge value={ticket?.check_in_status ?? "ยังไม่เช็คชื่อ"} />
            <Badge value={ticket?.interview_status ?? "ยังไม่สัมภาษณ์"} />
            <Badge value={ticket?.email_status ?? "pending"} />
          </div>
          <Detail icon={Users} label="ตำแหน่งที่สมัคร" value={candidate.position_applied ?? "-"} />
          <Detail icon={Clock3} label="วันที่สัมภาษณ์" value={thaiDate(candidate.interview_date)} />
          <Detail icon={Clock3} label="ช่วงเวลาสัมภาษณ์" value={candidate.interview_period ?? "-"} />
          {ticket && (
            <>
              <Detail icon={UserRoundCheck} label="เวลาเช็คชื่อ" value={new Date(ticket.checked_in_at).toLocaleString("th-TH")} green={checkedIn} />
              <Detail icon={UserCheck} label="ผู้เช็คชื่อ" value={ticket.checked_in_by_name ?? "-"} />
            </>
          )}
          {ticket ? (
            <label className="block pt-4 text-sm font-semibold text-slate-500">
              ปรับสถานะสัมภาษณ์
              <select
                value={interviewStatus}
                disabled={busy}
                onChange={async (event) => {
                  const nextStatus = event.target.value;
                  setInterviewStatus(nextStatus);
                  setBusy(true);
                  try {
                    await onStatusChange(ticket.id, nextStatus);
                  } catch {
                    setInterviewStatus(ticket.interview_status);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-2 block h-12 w-full rounded-xl border border-slate-200 px-3 text-slate-800"
              >
                <option>ยังไม่สัมภาษณ์</option>
                <option>สัมภาษณ์แล้ว</option>
                <option>ไม่เข้าร่วม</option>
              </select>
            </label>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onCheckIn(candidate);
                setBusy(false);
              }}
              className="mt-5 w-full rounded-xl bg-emerald-700 py-4 text-base font-bold text-white disabled:bg-slate-300"
            >
              {busy ? "กำลังออกคิวและส่งอีเมล..." : "กดเช็คชื่อ & ออกบัตรคิว"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
