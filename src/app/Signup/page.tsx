"use client";
import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"none" | "needsConfirmation" | "loggedIn">("none");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirmPassword) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || null } },
    });
    setLoading(false);
    if (signUpError) { setError(signUpError.message === "User already registered" ? "อีเมลนี้มีบัญชีอยู่แล้ว" : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่"); return; }
    if (data.session) { setDone("loggedIn"); window.location.href = "/interview-queue"; return; }
    setDone("needsConfirmation");
  }

  if (done === "needsConfirmation") {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-emerald-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
          <h1 className="mt-1 text-xl font-bold">ยืนยันอีเมลของคุณ</h1>
          <p className="mt-3 text-sm text-slate-500">เราส่งลิงก์ยืนยันไปที่ <span className="font-medium text-slate-700">{email}</span> แล้ว กรุณาเปิดอีเมลและกดยืนยันก่อนเข้าสู่ระบบ</p>
          <p className="mt-4 text-xs text-slate-400">บัญชีใหม่จะเริ่มต้นด้วยสิทธิ์ &quot;ผู้ดูข้อมูล&quot; และรอผู้ดูแลระบบอนุมัติสิทธิ์เพิ่มเติม</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-emerald-700 underline">กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-emerald-950">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
        <h1 className="mt-1 text-2xl font-bold">สมัครสมาชิก</h1>
        <p className="mt-2 text-sm text-slate-500">Interview Queue Management System</p>
        <label className="mt-6 block text-sm font-medium">ชื่อ-นามสกุล
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        <label className="mt-4 block text-sm font-medium">อีเมล
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        <label className="mt-4 block text-sm font-medium">รหัสผ่าน
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        <label className="mt-4 block text-sm font-medium">ยืนยันรหัสผ่าน
          <input required type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:bg-slate-300">{loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}</button>
        <p className="mt-4 text-center text-sm text-slate-500">มีบัญชีอยู่แล้ว? <Link href="/login" className="font-semibold text-emerald-700 underline">เข้าสู่ระบบ</Link></p>
      </form>
    </main>
  );
}