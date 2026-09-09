import type { EmployeeCategory } from "@/types/domain";

export function deriveEmployeeCategory(input: { positionApplied?: string | null; employeeCategory?: string | null; positionType?: string | null; shop?: string | null }): EmployeeCategory | null {
  // Some source rows only identify the retail brand in Shop (for example
  // Studio7) and leave Position_Type / Position_Applied blank.
  const raw = [input.positionApplied, input.employeeCategory, input.positionType, input.shop].filter(Boolean).join(" ");
  const text = raw.trim().toLowerCase();
  if (["หน้าร้าน", "retail", "store", "true", "studio7", "banana", "dtac"].some((keyword) => text.includes(keyword))) return "พนักงานหน้าร้าน";
  if (["สำนักงานใหญ่", "นักศึกษาฝึกงาน", "ฝึกงาน", "ออฟฟิศ", "office", "head office", "intern"].some((keyword) => text.includes(keyword))) return "ออฟฟิศ";
  return null;
}
