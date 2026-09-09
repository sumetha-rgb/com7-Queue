"use client";

import Link from "next/link";
import {
  CircleCheck,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const navigation = [
  { href: "/interview-queue", label: "หน้าบัตรคิว", icon: LayoutDashboard },
  { href: "/queue-history", label: "ประวัติคิว", icon: History },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
];

export function QueueSidebar() {
  const [name, setName] = useState("กำลังโหลด...");
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setName("ผู้ใช้ระบบ");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", user.id)
        .maybeSingle();
      setName(
        profile?.full_name || profile?.email || user.email || "ผู้ใช้ระบบ",
      );
    })();
  }, []);

  async function logout() {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-white p-5 text-slate-800 shadow-xl shadow-emerald-950/5 lg:flex">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
          <img src="/com7-logo.svg" alt="COM7" className="h-12 w-28 object-contain object-left" />
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            COM7 Recruitment
          </p>
          <h2 className="mt-2 text-lg font-bold">ระบบจัดการคิว</h2>
          <p className="mt-1 text-xs text-slate-500">Interview operations</p>
        </div>
        <p className="mt-7 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          เมนูหลัก
        </p>
        <nav className="mt-2 space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CircleCheck className="h-4 w-4" />
            ระบบพร้อมใช้งาน
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-700">
            ข้อมูลคิวและประวัติถูกบันทึกแยกจาก Google Sheet
          </p>
        </div>
        <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-400">เข้าสู่ระบบอยู่</p>
          <p
            className="mt-1 truncate text-sm font-semibold text-slate-700"
            title={name}
          >
            {name}
          </p>
          <button
            onClick={() => setConfirmLogout(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4"
          onClick={() => setConfirmLogout(false)}
        >
          <section
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800">ออกจากระบบ?</h3>
            <p className="mt-2 text-sm text-slate-500">
              คุณต้องการออกจากระบบจัดการคิวใช่หรือไม่
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void logout()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                ออกจากระบบ
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
