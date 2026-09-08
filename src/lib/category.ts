import type { EmployeeCategory } from "@/types/domain";

export function deriveEmployeeCategory(input: { positionApplied?: string | null; employeeCategory?: string | null; positionType?: string | null }): EmployeeCategory | null {
  const raw = input.positionApplied || input.employeeCategory || input.positionType || "";
  const text = raw.trim().toLowerCase();
  if (["หน้าร้าน", "true", "studio7", "banana", "dtac"].some((keyword) => text.includes(keyword))) return "พนักงานหน้าร้าน";
  if (["สำนักงานใหญ่", "นักศึกษาฝึกงาน", "ฝึกงาน", "ออฟฟิศ"].some((keyword) => text.includes(keyword))) return "ออฟฟิศ";
  return null;
}
