type QueueEmailInput = { to: string; fullName: string; queueNo: number; position: string | null; period: string | null; eventName: string; date?: string | null };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

function formatThaiDate(value: string | null | undefined) {
  if (!value) return "-";
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  const year = iso ? Number(iso[1]) : slash ? Number(slash[3]) : 0;
  const month = iso ? Number(iso[2]) : slash ? Number(slash[2]) : 0;
  const day = iso ? Number(iso[3]) : slash ? Number(slash[1]) : 0;
  if (!year || !month || !day) return text;
  const thaiYear = year < 2400 ? year + 543 : year;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long" }).format(new Date(Date.UTC(thaiYear - 543, month - 1, day))) + ` ${thaiYear}`;
}

function senderFromEnv() {
  const value = process.env.EMAIL_FROM?.trim();
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า EMAIL_FROM");
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  return match ? { name: match[1].trim() || "COM7 Recruitment", email: match[2].trim() } : { name: "COM7 Recruitment", email: value };
}

export async function sendQueueTicketEmail(input: QueueEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า BREVO_API_KEY");
  const sender = senderFromEnv();
  const fullName = escapeHtml(input.fullName); const position = escapeHtml(input.position ?? "-"); const period = escapeHtml(input.period ?? "-"); const eventName = escapeHtml(input.eventName); const date = escapeHtml(formatThaiDate(input.date));
  const queueText = escapeHtml(String(input.queueNo));
  const socialLinks = `<div style="margin-top:14px;display:flex;gap:12px"><a href="https://web.facebook.com/Comsevencareer?_rdc=1&_rdr#"><img src="https://img.icons8.com/fluency/48/facebook-new.png" width="36" height="36" alt="Facebook" style="display:block;border-radius:50%" /></a><a href="https://www.instagram.com/comsevencareer/"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="36" height="36" alt="Instagram" style="display:block;border-radius:50%" /></a><a href="https://page.line.me/comsevencareer?openQrModal=true"><img src="https://img.icons8.com/color/48/line-me.png" width="36" height="36" alt="LINE" style="display:block;border-radius:50%" /></a><a href="https://www.tiktok.com/@comsevencareer"><img src="https://img.icons8.com/color/48/tiktok--v1.png" width="36" height="36" alt="TikTok" style="display:block;border-radius:50%" /></a></div>`;
  const htmlContent = `<!doctype html><html lang="th"><body style="margin:0;background:#f4f5f7;color:#111827;font-family:Arial,'Noto Sans Thai',sans-serif"><main style="padding:24px 0"><section style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #d1d5db;border-radius:20px;overflow:hidden"><header style="background:#fff;padding:28px 30px;border-bottom:3px solid #5cb030;text-align:center"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/COM7_Logo.svg/1280px-COM7_Logo.svg.png" alt="COM7" style="height:60px;max-width:220px;object-fit:contain" /></header><div style="padding:26px 30px 4px"><p style="margin:0 0 4px;font-size:13px;color:#9ca3af">เรียนคุณ</p><p style="margin:0;font-size:20px;font-weight:600;color:#111827">${fullName}</p><p style="margin:8px 0 0;font-size:13px;color:#6b7280;line-height:1.7">ลำดับคิวสัมภาษณ์ของคุณในงาน ${eventName} โปรดนำข้อมูลนี้ไปใช้ประกอบการเข้ารับการสัมภาษณ์</p></div><div style="margin:22px 30px 24px;text-align:center"><div style="display:inline-block;min-width:110px;padding:22px 20px;border:1px solid #d4ebd0;border-radius:20px;background:#eff8ea"><div style="font-size:64px;font-weight:700;line-height:1;color:#059669;margin-bottom:8px">${queueText}</div><div style="font-size:13px;color:#059669;font-weight:600">ลำดับคิวของคุณ</div></div></div><div style="margin:0 30px 24px"><div style="display:inline-block;width:46%;vertical-align:top;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-sizing:border-box"><div style="font-size:11px;color:#9ca3af;margin-bottom:6px">วันที่สัมภาษณ์</div><div style="font-size:15px;color:#111827;font-weight:600">${date}</div></div><div style="display:inline-block;width:46%;vertical-align:top;margin-left:3%;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-sizing:border-box"><div style="font-size:11px;color:#9ca3af;margin-bottom:6px">เวลาสัมภาษณ์</div><div style="font-size:15px;color:#111827;font-weight:600">${period}</div></div><div style="margin-top:12px;border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:11px;color:#9ca3af;margin-bottom:6px">ตำแหน่งที่สมัคร</div><div style="font-size:15px;color:#111827;font-weight:600">${position}</div></div></div><div style="margin:0 30px 24px;padding-top:20px;border-top:1px dashed #d1d5db"><p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#111827">ข้อควรทราบ</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.9">กรุณามาให้ทันเวลานัดหมาย เพื่อให้การสัมภาษณ์เป็นไปอย่างราบรื่น<br/>หากมีการเปลี่ยนแปลง กรุณาแจ้งฝ่ายทรัพยากรบุคคลล่วงหน้า</p></div><div style="margin:0 30px 28px;padding:18px 20px;border-left:3px solid #5cb030;border-radius:0 14px 14px 0;background:#eff8ea"><div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:10px">ฝ่ายทรัพยากรบุคคล</div><div style="font-size:12px;color:#6b7280;line-height:1.8">ร่วมเป็นส่วนหนึ่งของบริษัท COM7 แค่เพียงคุณสมัครงานเข้ามาเพื่อคว้าโอกาสดีๆกับทางบริษัท</div><div style="font-size:13px;color:#111827;font-weight:600;margin-top:10px">โทร. 02-017-7777 ต่อ 7212, 7208, 7209, 7210</div></div><footer style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:16px;text-align:center;color:#fff;font-size:11px">&copy; 2026 Comseven Public Company Limited</footer></section></main></body></html>`;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender, to: [{ email: input.to, name: input.fullName }],
      subject: `${input.eventName} | คิวสัมภาษณ์ของคุณ - ลำดับที่ ${input.queueNo}`,
      htmlContent: htmlContent.replace("</div><footer", `${socialLinks}</div><footer`),
    }),
  });
  if (!response.ok) throw new Error(`Brevo ส่งอีเมลไม่สำเร็จ (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<{ messageId: string }>;
}
