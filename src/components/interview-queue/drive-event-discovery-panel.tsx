"use client";

import { useCallback, useEffect, useState } from "react";

type DriveFile = { id: string; name: string; modifiedTime: string | null; url: string };
type DiscoverResult = { name: string; status: string };

const statusLabel: Record<string, string> = {
  already_connected: "เชื่อมต่อไว้แล้ว",
  created_draft: "ดึงเข้าเป็น Event (ร่าง) สำเร็จ",
  created_draft_with_errors: "ดึงเข้าเป็น Event (ร่าง) — มีบางแถวนำเข้าไม่ได้",
  needs_date_review: "ไม่พบวันที่สัมภาษณ์ในแถวแรก ต้องสร้าง Event เอง",
  failed: "สร้าง Event ไม่สำเร็จ",
  connection_failed: "ผูก Sheet กับ Event ไม่สำเร็จ",
};
const statusStyle: Record<string, string> = {
  already_connected: "bg-slate-100 text-slate-600",
  created_draft: "bg-emerald-50 text-emerald-700",
  created_draft_with_errors: "bg-amber-50 text-amber-700",
  needs_date_review: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  connection_failed: "bg-red-50 text-red-700",
};

export function DriveEventDiscoveryPanel({ onImported }: { onImported: () => Promise<void> }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [sheetName, setSheetName] = useState("ผู้สมัคร");

  const loadFiles = useCallback(async () => {
    setLoading(true); setMessage("");
    const response = await fetch("/api/google-drive/sheets");
    if (response.status === 401) { window.location.href = "/login"; return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "ไม่สามารถอ่านโฟลเดอร์ Drive ได้"); setFiles([]); setLoading(false); return; }
    setFiles(data.files ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void loadFiles(); }, [loadFiles]);

  async function pull(fileId?: string) {
    if (fileId) setBusyId(fileId); else setBusyAll(true);
    setMessage("");
    const response = await fetch("/api/google-drive/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId, sheetName }) });
    if (response.status === 401) { window.location.href = "/login"; return; }
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "ดึง Event จาก Drive ไม่สำเร็จ"); setBusyId(null); setBusyAll(false); return; }
    setResults(data.results ?? []);
    setBusyId(null); setBusyAll(false);
    await onImported();
    await loadFiles();
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">ดึง Event จากโฟลเดอร์ Drive</h2>
          <p className="mt-1 text-sm text-slate-500">
            อ่านชีตทั้งหมดในโฟลเดอร์ <span className="font-mono">GOOGLE_DRIVE_FOLDER_ID</span> — ชีตไหนยังไม่เคยผูก จะถูกสร้างเป็น Event (สถานะร่าง) ให้อัตโนมัติ พร้อมนำเข้ารายชื่อจากแถวแรกของชีต
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">ชื่อแท็บในชีต
            <input value={sheetName} onChange={(event) => setSheetName(event.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </label>
          <button disabled={busyAll || loading || !files.length} onClick={() => void pull(undefined)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            {busyAll ? "กำลังดึงทั้งหมด..." : "ดึงทุกชีตในโฟลเดอร์"}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      {results.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">ผลลัพธ์ล่าสุด</p>
          <ul className="mt-2 space-y-1 text-sm">
            {results.map((result) => (
              <li key={result.name} className="flex items-center justify-between gap-2">
                <span>{result.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[result.status] ?? "bg-slate-100 text-slate-600"}`}>{statusLabel[result.status] ?? result.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="p-3">ชื่อไฟล์ (Sheet)</th><th className="p-3">แก้ไขล่าสุด</th><th className="p-3">การจัดการ</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="p-8 text-center text-slate-400">กำลังโหลดรายการไฟล์...</td></tr>
            ) : files.length ? (
              files.map((file) => (
                <tr key={file.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium"><a href={file.url} target="_blank" rel="noreferrer" className="hover:underline">{file.name}</a></td>
                  <td className="p-3 text-slate-500">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleString("th-TH") : "-"}</td>
                  <td className="p-3">
                    <button disabled={busyId === file.id || busyAll} onClick={() => void pull(file.id)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-400">
                      {busyId === file.id ? "กำลังดึง..." : "ดึงเป็น Event"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3} className="p-8 text-center text-slate-400">ไม่พบไฟล์ Google Sheet ในโฟลเดอร์ (ตรวจสอบว่าแชร์โฟลเดอร์ให้ service account แล้ว)</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}