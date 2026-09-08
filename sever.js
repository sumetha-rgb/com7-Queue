const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const nodemailer = require('nodemailer');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let savedSheetUrl = "";
let savedSheetId = "";

// กำหนดการตั้งค่า SMTP สำหรับส่งอีเมล
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'your_email@gmail.com',
    pass: process.env.SMTP_PASS || 'your_app_password' // รหัสผ่านสำหรับแอป (App Password 16 หลัก)
  }
});

function extractSheetIdFromUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  const match = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function fetchSheetRows(sheetId, sheetName) {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv` + 
    (sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '');
  
  const response = await axios.get(exportUrl, { responseType: 'text' });
  
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(response.data);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// ---------------- REST APIs ----------------

// บันทึกลิงก์ Google Sheet
app.post('/api/save-link', async (req, res) => {
  try {
    const { url } = req.body;
    const sheetId = extractSheetIdFromUrl(url);
    if (!sheetId) {
      return res.json({ success: false, message: "ลิงก์ Google Sheet ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" });
    }

    await fetchSheetRows(sheetId);
    savedSheetUrl = url;
    savedSheetId = sheetId;

    return res.json({ 
      success: true, 
      sheetId, 
      spreadsheetName: `Google Sheet (${sheetId.slice(0, 6)}...)` 
    });
  } catch (e) {
    return res.json({ 
      success: false, 
      message: "เชื่อมต่อไม่สำเร็จ: โปรดตรวจสอบว่าชีทเปิดสิทธิ์เป็น 'Anyone with the link can view'" 
    });
  }
});

// ดึงลิงก์เดิมที่เคยเชื่อมต่อไว้
app.get('/api/saved-link', (req, res) => {
  return res.json({
    success: true,
    url: savedSheetUrl,
    sheetId: savedSheetId
  });
});

// ดึงข้อมูลคิว
app.post('/api/queue-data', async (req, res) => {
  try {
    const payload = req.body || {};
    const url = payload.sheetUrl || savedSheetUrl;
    const sheetId = extractSheetIdFromUrl(url);

    if (!sheetId) {
      return res.json({ success: false, message: "ยังไม่ได้เชื่อมต่อ Google Sheet กรุณาวางลิงก์ก่อน" });
    }

    const rows = await fetchSheetRows(sheetId, payload.sheetName);

    const EMAIL_HEADER_CANDIDATES = [
      "Email_Sent", "EmailSent", "Email_Status", "EmailStatus", "สถานะอีเมล", "ส่งอีเมล"
    ];
    let emailKey = null;
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      emailKey = headers.find((h) =>
        EMAIL_HEADER_CANDIDATES.some((c) => c.toLowerCase() === String(h).toLowerCase())
      );
    }
    const SENT_VALUES = ["true", "ส่งแล้ว", "sent", "1", "yes", "success"];

    let data = rows.map((r, index) => {
      const rawVal = emailKey ? r[emailKey] : "";
      const emailSent = SENT_VALUES.includes(String(rawVal).trim().toLowerCase());
      return {
        ...r,
        queueNo: r.queueNo || "-",
        Email_Sent_Flag: emailSent
      };
    });

    const search = payload.search ? String(payload.search).toLowerCase().replace(/\s+/g, "") : "";
    if (search) {
      data = data.filter((r) =>
        Object.entries(r).some(([k, v]) => {
          if (v === null || v === undefined || typeof v === "object") return false;
          return String(v).toLowerCase().replace(/\s+/g, "").includes(search);
        })
      );
    }

    if (payload.checkInFilter && payload.checkInFilter !== "all") {
      data = data.filter((r) =>
        (r.Queue_Display_Status || r.Status || r.checkInStatus || "") === payload.checkInFilter
      );
    }

    if (payload.emailFilter === "sent") {
      data = data.filter((r) => r.Email_Sent_Flag === true);
    } else if (payload.emailFilter === "unsent") {
      data = data.filter((r) => r.Email_Sent_Flag === false);
    }

    const page = Math.max(1, parseInt(payload.page) || 1);
    const limit = Math.max(1, parseInt(payload.limit) || 20);
    const totalItems = data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const start = (page - 1) * limit;
    const paged = data.slice(start, start + limit);

    return res.json({
      success: true,
      data: paged,
      pagination: { totalItems, totalPages, currentPage: page, limit },
      spreadsheetName: "เชื่อมต่อข้อมูลสำเร็จ",
      sheetName: payload.sheetName || "Sheet1"
    });
  } catch (e) {
    return res.json({ 
      success: false, 
      message: "ดึงข้อมูลไม่สำเร็จ โปรดตรวจสอบสิทธิ์การเข้าถึงของชีท" 
    });
  }
});

// ยิงส่งอีเมลบัตรคิวอัตโนมัติ
app.post('/api/send-ticket-email', async (req, res) => {
  try {
    const candidate = req.body;
    if (!candidate || !candidate.Email) {
      return res.json({ success: false, message: 'ไม่พบอีเมลผู้รับ' });
    }

    const mailOptions = {
      from: '"COM7 Recruitment" <no-reply@comseven.com>',
      to: candidate.Email,
      subject: `คิวสัมภาษณ์ของคุณ - ลำดับที่ ${candidate.queueNo} | ${candidate.Event_Name || ''}`,
      html: `
        <div style="font-family:sans-serif;background:#f4f5f7;padding:16px;">
          <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border-top:4px solid #166534;">
            <h2 style="color:#166534;margin-top:0;">COM7 Recruitment</h2>
            <p>เรียนคุณ <b>${candidate.Fullname}</b></p>
            <p>การเช็คชื่อสำเร็จแล้ว ลำดับคิวสัมภาษณ์ของคุณคือ:</p>
            <div style="text-align:center;padding:16px;background:#eff8ea;border-radius:12px;margin:16px 0;">
              <div style="font-size:48px;font-weight:bold;color:#059669;">${candidate.queueNo}</div>
              <div style="color:#059669;font-size:12px;">ลำดับคิวสัมภาษณ์</div>
            </div>
            <p><b>ตำแหน่ง:</b> ${candidate.Position_Applied}</p>
            <p><b>ช่วงเวลา:</b> ${candidate.Interview_Period}</p>
            <p style="font-size:12px;color:#888;margin-top:20px;">* โปรดแสดงอีเมลฉบับนี้ต่อเจ้าหน้าที่เมื่อถึงลำดับการสัมภาษณ์</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'ส่งอีเมลเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Send mail error:', error.message);
    return res.json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});