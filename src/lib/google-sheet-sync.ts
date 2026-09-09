import { parse } from "csv-parse/sync";
import { deriveEmployeeCategory } from "@/lib/category";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

type Row = Record<string, string>;
type CandidateImportError = {
  interviewId: string;
  fullName: string;
  reason: string;
};
type SheetCandidate = ReturnType<typeof mapSheetCandidate>;
type ExistingCandidate = {
  id: string;
  interview_id: string;
  full_name: string;
  phone_number: string | null;
};

const headerAliases: Record<string, keyof Row> = {
  interview_id: "Interview_Id",
  interviewid: "Interview_Id",
  รหัสผู้สมัคร: "Interview_Id",
  รหัสสัมภาษณ์: "Interview_Id",
  fullname: "Fullname",
  full_name: "Fullname",
  ชื่อสกุล: "Fullname",
  "ชื่อ-สกุล": "Fullname",
  ชื่อผู้สมัคร: "Fullname",
  phone_number: "Phone_Number",
  phonenumber: "Phone_Number",
  เบอร์โทรศัพท์: "Phone_Number",
  เบอร์โทร: "Phone_Number",
  email: "Email",
  อีเมล: "Email",
  position_applied: "Position_Applied",
  positionapplied: "Position_Applied",
  ตำแหน่งที่สมัคร: "Position_Applied",
  employee_category: "Employee_Category",
  employeecategory: "Employee_Category",
  กลุ่มงาน: "Employee_Category",
  position_type: "Position_Type",
  positiontype: "Position_Type",
  ประเภทตำแหน่ง: "Position_Type",
  shop: "Shop",
  สาขา: "Shop",
  interview_date: "Interview_Date",
  interviewdate: "Interview_Date",
  วันที่สัมภาษณ์: "Interview_Date",
  interview_period: "Interview_Period",
  interviewperiod: "Interview_Period",
  ช่วงเวลาสัมภาษณ์: "Interview_Period",
  event_name: "Event_Name",
  eventname: "Event_Name",
  ชื่องาน: "Event_Name",
};

function canonicalHeader(header: string) {
  const key = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return headerAliases[key] ?? header.trim();
}

// Google Sheets often adds an invisible non-breaking space or a second space
// when a recruiter edits a name. Treat those as the same display name for the
// Event-local fallback match; do not use this value across Events.
function normalizedFullName(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th-TH");
}

function sanitizeSheetText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "�")
    .normalize("NFC");
}

function sanitizeSourceData(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      sanitizeSheetText(key),
      sanitizeSheetText(value),
    ]),
  );
}
export function sheetIdFromUrl(value: string) {
  const match = value.trim().match(/\/d\/([a-zA-Z0-9-_]+)/);
  return (
    match?.[1] ?? (/^[\w-]{20,}$/.test(value.trim()) ? value.trim() : null)
  );
}
export function parseInterviewDate(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year > 2400) year -= 543;
  else if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
export async function downloadGoogleSheet(
  sheetUrl: string,
  sheetName?: string,
) {
  const id = sheetIdFromUrl(sheetUrl);
  if (!id) throw new Error("ลิงก์ Google Sheet ไม่ถูกต้อง");
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set("tqx", "out:csv");
  if (sheetName) url.searchParams.set("sheet", sheetName);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "ไม่สามารถอ่าน Google Sheet ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง",
    );
  const rows = parse(await response.text(), {
    columns: (headers: string[]) =>
      headers.map(canonicalHeader),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Row[];
  return { id, rows };
}
export function mapSheetCandidate(row: Row, eventId: string) {
  const interviewId = row.Interview_Id?.trim();
  if (!interviewId) throw new Error("ไม่พบ Interview_Id");
  const category = deriveEmployeeCategory({
    positionApplied: row.Position_Applied,
    employeeCategory: row.Employee_Category,
    positionType: row.Position_Type,
    shop: row.Shop,
  });
  if (!category) throw new Error(`ไม่สามารถจัดกลุ่มงานของ ${interviewId}`);
  // Sheet dates use Thai DD/MM/BBBB years (for example 26/6/2569), whereas
  // PostgreSQL's date column must receive ISO YYYY-MM-DD. Passing the raw
  // value made one invalid date reject an entire bulk import.
  return {
    interview_id: interviewId,
    full_name: row.Fullname?.trim() || "ไม่ระบุชื่อ",
    phone_number: row.Phone_Number?.trim() || null,
    email: row.Email?.trim().toLowerCase() || null,
    position_applied: row.Position_Applied?.trim() || null,
    employee_category: category,
    interview_date: parseInterviewDate(row.Interview_Date),
    interview_period: row.Interview_Period || null,
    event_id: eventId,
    source_data: sanitizeSourceData(row),
  };
}

export function sheetRowsHash(rows: Row[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export async function saveCandidatesBatchWithoutReplacingTickets(
  supabase: SupabaseClient,
  candidates: SheetCandidate[],
) {
  if (!candidates.length) return { imported: 0, errors: 0, rejected: [] };

  // Read the Event once, then write in small batches. The previous approach
  // queried once or twice per row, which made an Event with 180 candidates
  // visibly slow to connect.
  const eventId = candidates[0].event_id;
  const { data: existingRows, error: existingError } = await supabase
    .from("candidates")
    .select("id,interview_id,full_name,phone_number")
    .eq("event_id", eventId);
  if (existingError) throw existingError;

  const existingByInterviewId = new Map(
    ((existingRows ?? []) as ExistingCandidate[]).map((row) => [
      row.interview_id,
      row,
    ]),
  );
  const existingByName = new Map<string, ExistingCandidate[]>();
  for (const row of (existingRows ?? []) as ExistingCandidate[]) {
    const key = normalizedFullName(row.full_name);
    existingByName.set(key, [...(existingByName.get(key) ?? []), row]);
  }

  const rowsToUpdate: Array<SheetCandidate & { id: string }> = [];
  const rowsToInsert: SheetCandidate[] = [];
  const rejected: CandidateImportError[] = [];

  for (const candidate of candidates) {
    const exactMatch = existingByInterviewId.get(candidate.interview_id);
    if (exactMatch) {
      rowsToUpdate.push({ ...candidate, id: exactMatch.id });
      continue;
    }

    const nameMatches =
      existingByName.get(normalizedFullName(candidate.full_name)) ?? [];
    const matches =
      nameMatches.length === 1
        ? nameMatches
        : candidate.phone_number
          ? nameMatches.filter(
              (row) => row.phone_number === candidate.phone_number,
            )
          : nameMatches;

    if (matches.length === 1) {
      // A regenerated Interview_Id must not detach an issued queue ticket.
      const { interview_id: _interviewId, ...profileFields } = candidate;
      rowsToUpdate.push({
        ...profileFields,
        interview_id: matches[0].interview_id,
        id: matches[0].id,
      });
      continue;
    }

    if (matches.length > 1) {
      rejected.push({
        interviewId: candidate.interview_id,
        fullName: candidate.full_name,
        reason: "พบชื่อ-สกุลซ้ำใน Event เดียวกัน กรุณาใช้ Interview_Id เดิม",
      });
      continue;
    }

    rowsToInsert.push(candidate);
  }

  // Keep writes independent so one bad row cannot roll back the Event, but
  // process them concurrently in small groups so a large Sheet is fast.
  const writeUpdate = async (candidate: SheetCandidate & { id: string }) => {
    const { id, ...profile } = candidate;
    let { error } = await supabase.from("candidates").update(profile).eq("id", id);
    if (error && /unicode escape|invalid input syntax for type json/i.test(error.message)) {
      const { source_data: _sourceData, ...safeProfile } = profile;
      error = (await supabase.from("candidates").update({ ...safeProfile, source_data: {} }).eq("id", id)).error;
    }
    return error
      ? { interviewId: candidate.interview_id, fullName: candidate.full_name, reason: error.message }
      : null;
  };

  const writeInsert = async (candidate: SheetCandidate) => {
    let { error } = await supabase.from("candidates").insert(candidate);
    if (error && /unicode escape|invalid input syntax for type json/i.test(error.message)) {
      const { source_data: _sourceData, ...safeCandidate } = candidate;
      error = (await supabase.from("candidates").insert({ ...safeCandidate, source_data: {} })).error;
    }
    return error
      ? { interviewId: candidate.interview_id, fullName: candidate.full_name, reason: error.message }
      : null;
  };

  const writeInChunks = async <T,>(rows: T[], writer: (row: T) => Promise<CandidateImportError | null>) => {
    const failures: CandidateImportError[] = [];
    for (let start = 0; start < rows.length; start += 20) {
      const results = await Promise.all(rows.slice(start, start + 20).map(writer));
      failures.push(...results.filter((result): result is CandidateImportError => result !== null));
    }
    return failures;
  };

  rejected.push(...await writeInChunks(rowsToUpdate, writeUpdate));
  rejected.push(...await writeInChunks(rowsToInsert, writeInsert));

  return {
    imported: rowsToUpdate.length + rowsToInsert.length - rejected.length,
    errors: rejected.length,
    rejected,
  };
}

export async function saveCandidateWithoutReplacingTicket(
  supabase: SupabaseClient,
  candidate: ReturnType<typeof mapSheetCandidate>,
) {
  const { data: existing, error: findError } = await supabase
    .from("candidates")
    .select("id")
    .eq("event_id", candidate.event_id)
    .eq("interview_id", candidate.interview_id)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { error } = await supabase
      .from("candidates")
      .update(candidate)
      .eq("id", existing.id);
    if (error) throw error;
    return "updated" as const;
  }

  // Sheets occasionally regenerate Interview_Id.  For the same Event, fall
  // back to one unambiguous full-name match so a previously checked-in person
  // keeps the candidate row and its queue ticket.  Never search outside this
  // Event: the same person can correctly have a new queue in another Event.
  const { data: eventCandidates, error: sameNameError } = await supabase
    .from("candidates")
    .select("id,full_name,phone_number")
    .eq("event_id", candidate.event_id);
  if (sameNameError) throw sameNameError;
  const normalizedName = normalizedFullName(candidate.full_name);
  const nameMatches = (eventCandidates ?? []).filter(
    (row) => normalizedFullName(row.full_name) === normalizedName,
  );
  // If the Event happens to have two people with the same name, a matching
  // phone number is a safe tie-breaker. Otherwise refuse to guess.
  const matches =
    nameMatches.length === 1
      ? nameMatches
      : candidate.phone_number
        ? nameMatches.filter(
            (row) => row.phone_number === candidate.phone_number,
          )
        : nameMatches;
  if (matches.length === 1) {
    // Preserve the original Interview_Id as well as the primary key. Both
    // may be referenced by operational history, while profile fields may
    // still be safely refreshed from the Sheet.
    const { interview_id: _interviewId, ...profileFields } = candidate;
    const { error } = await supabase
      .from("candidates")
      .update(profileFields)
      .eq("id", matches[0].id);
    if (error) throw error;
    return "updated_by_name" as const;
  }
  if (matches.length > 1) {
    throw new Error(
      "พบชื่อ-สกุลซ้ำใน Event เดียวกัน กรุณาระบุ Interview_Id ให้คงเดิม",
    );
  }

  const { error } = await supabase.from("candidates").insert(candidate);
  if (error) throw error;
  return "inserted" as const;
}
