import { parse } from "csv-parse/sync";
import { deriveEmployeeCategory } from "@/lib/category";
import { google } from "googleapis";
import { googleServiceAccountAuth } from "@/lib/google-drive";

type Row = Record<string, string>;
export function sheetIdFromUrl(value: string) { const match = value.trim().match(/\/d\/([a-zA-Z0-9-_]+)/); return match?.[1] ?? (/^[\w-]{20,}$/.test(value.trim()) ? value.trim() : null); }
export function parseInterviewDate(value: string | undefined): string | null {
  if (!value) return null; const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/); if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); let year = Number(match[3]); if (year > 2400) year -= 543; else if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
export async function downloadGoogleSheet(sheetUrl: string, sheetName?: string) {
  const id = sheetIdFromUrl(sheetUrl); if (!id) throw new Error("ลิงก์ Google Sheet ไม่ถูกต้อง");
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    const sheets = google.sheets({ version: "v4", auth: googleServiceAccountAuth() });
    const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A:ZZ` : "A:ZZ";
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: id, range });
    const values = response.data.values ?? []; if (!values.length) return { id, rows: [] };
    const headers = values[0].map((header) => String(header).replace(/^\uFEFF/, "").trim());
    const rows = values.slice(1).filter((line) => line.some((value) => value !== "")).map((line) => Object.fromEntries(headers.map((header, index) => [header, String(line[index] ?? "").trim()])));
    return { id, rows };
  }
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`); url.searchParams.set("tqx", "out:csv"); if (sheetName) url.searchParams.set("sheet", sheetName);
  const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error("ไม่สามารถอ่าน Google Sheet ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง");
  const rows = parse(await response.text(), { columns: (headers: string[]) => headers.map((header) => header.replace(/^\uFEFF/, "").trim()), skip_empty_lines: true, relax_column_count: true, trim: true }) as Row[];
  return { id, rows };
}
export function mapSheetCandidate(row: Row, eventId: string) {
  const interviewId = row.Interview_Id?.trim(); if (!interviewId) throw new Error("ไม่พบ Interview_Id");
  const category = deriveEmployeeCategory({ positionApplied: row.Position_Applied, employeeCategory: row.Employee_Category, positionType: row.Position_Type });
  if (!category) throw new Error(`ไม่สามารถจัดกลุ่มงานของ ${interviewId}`);
  return { interview_id: interviewId, full_name: row.Fullname?.trim() || "ไม่ระบุชื่อ", phone_number: row.Phone_Number?.trim() || null, email: row.Email?.trim().toLowerCase() || null, position_applied: row.Position_Applied?.trim() || null, employee_category: category, interview_date: row.Interview_Date || null, interview_period: row.Interview_Period || null, event_id: eventId, source_data: row };
}
