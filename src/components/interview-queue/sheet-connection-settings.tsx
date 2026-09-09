"use client";

import { Link2Off, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: string;
  sheet_url: string;
  sheet_name: string | null;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
  events: { name: string; event_date: string; status: string } | null;
};

export function SheetConnectionSettings() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/google-sheet/connections", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "ไม่สามารถโหลดการเชื่อมต่อได้");
        return;
      }
      setConnections(data.connections ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  async function disconnect(connection: Connection) {
    if (
      !window.confirm(
        `ยกเลิกการเชื่อมต่อกับ ${connection.events?.name ?? "Event นี้"}?\nคิวและประวัติเดิมจะไม่ถูกลบ`,
      )
    ) {
      return;
    }

    const response = await fetch("/api/google-sheet/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "ยกเลิกการเชื่อมต่อไม่สำเร็จ");
      return;
    }
    setConnections((current) =>
      current.filter((item) => item.id !== connection.id),
    );
    setMessage("ยกเลิกการเชื่อมต่อ Sheet แล้ว ข้อมูลคิวเดิมยังเก็บอยู่");
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] p-5 md:p-8">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-emerald-900 p-6 text-white shadow-lg">
          <Settings2 className="h-6 w-6 text-emerald-200" />
          <h1 className="mt-3 text-2xl font-bold">ตั้งค่าการเชื่อมต่อ Sheet</h1>
          <p className="mt-1 text-sm text-emerald-100">
            จัดการแหล่งข้อมูลผู้สมัคร
            โดยประวัติคิวจะไม่ถูกลบเมื่อยกเลิกการเชื่อมต่อ
          </p>
        </div>

        {message && (
          <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-slate-500">
              กำลังโหลดการเชื่อมต่อ...
            </p>
          ) : connections.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Link2Off className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3">ยังไม่มี Google Sheet ที่เชื่อมต่อ</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {connections.map((connection) => (
                <li
                  key={connection.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {connection.events?.name ?? "Event ที่ลบไปแล้ว"}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {connection.sheet_url}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      ซิงก์ล่าสุด:{" "}
                      {connection.last_synced_at
                        ? new Date(connection.last_synced_at).toLocaleString(
                            "th-TH",
                          )
                        : "ยังไม่เคยซิงก์"}
                    </p>
                    {connection.last_sync_error && (
                      <p className="mt-1 text-xs text-red-600">
                        {connection.last_sync_error}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => void disconnect(connection)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    ยกเลิกการเชื่อมต่อ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
