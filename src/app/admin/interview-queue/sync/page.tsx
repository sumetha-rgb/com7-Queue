"use client";

import { GoogleSheetSyncPanel } from "@/components/interview-queue/google-sheet-sync-panel";

export default function GoogleSheetSyncPage() {
  return <main className="min-h-screen bg-slate-50 p-6"><section className="mx-auto max-w-3xl rounded-2xl bg-emerald-900 p-6 text-white shadow-lg"><p className="text-sm font-semibold text-emerald-200">COM7 Recruitment</p><h1 className="mt-1 text-2xl font-bold">เชื่อมต่อและซิงก์ Google Sheet</h1><p className="mt-2 text-sm text-emerald-100">เลือก Event, วางลิงก์ Google Sheet และชื่อแท็บ “ผู้สมัคร” จากนั้นกดเชื่อมต่อและอัปเดต</p><GoogleSheetSyncPanel onSynced={async () => {}} /><p className="mt-4 text-xs text-emerald-100">หลังเชื่อมต่อ ระบบจะตรวจข้อมูลใหม่ทุก 15 นาทีผ่าน Vercel Cron. ข้อมูลคิวและสถานะสัมภาษณ์ที่บันทึกในระบบจะไม่ถูกเขียนทับจากชีท</p></section></main>;
}
