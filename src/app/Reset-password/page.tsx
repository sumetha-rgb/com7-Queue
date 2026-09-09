"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase's browser client parses the recovery token out of the URL and
    // establishes a temporary "recovery" session automatically on load.
    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirmPassword) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError("ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลิงก์อาจหมดอายุแล้ว กรุณาขอลิงก์ใหม่"); return; }
    setDone(true);
  }

  if (done) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-white">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
          <h1 className="mt-1 text-xl font-bold">ตั้งรหัสผ่านใหม่สำเร็จ</h1>
          <p className="mt-3 text-sm text-slate-500">คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</p>
          <a href="/login" className="mt-6 inline-block rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white">ไปหน้าเข้าสู่ระบบ</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-white">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-emerald-700">COM7 Recruitment</p>
        <h1 className="mt-1 text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
        {!ready && <p className="mt-2 text-sm text-amber-600">กำลังตรวจสอบลิงก์... ถ้าเปิดหน้านี้ตรงๆ โดยไม่ได้มาจากอีเมล การตั้งรหัสผ่านจะไม่สำเร็จ</p>}
        <label className="mt-6 block text-sm font-medium">รหัสผ่านใหม่
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        <label className="mt-4 block text-sm font-medium">ยืนยันรหัสผ่านใหม่
          <input required type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-emerald-600" />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:bg-slate-300">{loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
      </form>
    </main>
  );
}