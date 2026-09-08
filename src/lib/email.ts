import { Resend } from "resend";

export async function sendQueueTicketEmail(input: { to: string; fullName: string; queueNo: number; position: string | null; period: string | null; eventName: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: process.env.EMAIL_FROM || "COM7 Recruitment <onboarding@resend.dev>", to: input.to,
    subject: `คิวสัมภาษณ์ของคุณ - ลำดับที่ #${input.queueNo} | ${input.eventName}`,
    html: `<main style="font-family:Arial,sans-serif;background:#f8faf9;padding:24px"><section style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:28px;border-top:4px solid #15803d"><h2 style="color:#15803d">COM7 Recruitment</h2><p>เรียนคุณ <strong>${input.fullName}</strong></p><p>การเช็คชื่อสำเร็จแล้ว ลำดับคิวสัมภาษณ์ของคุณคือ:</p><div style="text-align:center;background:#eff8ea;border-radius:12px;padding:18px"><strong style="font-size:48px;color:#15803d">#${input.queueNo}</strong></div><p><strong>ตำแหน่ง:</strong> ${input.position ?? "-"}</p><p><strong>ช่วงเวลา:</strong> ${input.period ?? "-"}</p><p style="color:#64748b;font-size:12px">โปรดแสดงอีเมลฉบับนี้ต่อเจ้าหน้าที่เมื่อถึงลำดับการสัมภาษณ์</p></section></main>`,
  });
}
