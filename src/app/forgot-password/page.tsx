"use client";
import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setLoading(true);
    const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same success message whether or not the email exists,
    // so this form can't be used to check which emails have accounts.
    if (resetError) { setError("ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง"); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="login-page min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
          <h1 className="mt-1 text-xl font-bold">ตรวจสอบอีเมลของคุณ</h1>
          <p className="mt-3 text-sm text-slate-500">ถ้ามีบัญชีที่ใช้อีเมล <span className="font-medium text-slate-700">{email}</span> เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-emerald-700 underline">กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
        <h1 className="mt-1 text-2xl font-bold">ลืมรหัสผ่าน</h1>
        <p className="mt-2 text-sm text-slate-500">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>
        <label className="mt-6 block text-sm font-medium">อีเมล
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:bg-slate-300">{loading ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>
        <p className="mt-4 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-emerald-700 underline">กลับไปหน้าเข้าสู่ระบบ</Link></p>
      </form>
    </main>
  );
}