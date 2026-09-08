export type EmployeeCategory = "พนักงานหน้าร้าน" | "ออฟฟิศ";
export type CheckInStatus = "ยังไม่เช็คชื่อ" | "เช็คชื่อแล้ว" | "ไม่เข้าร่วม";
export type InterviewStatus = "ยังไม่สัมภาษณ์" | "สัมภาษณ์แล้ว" | "ไม่เข้าร่วม";
export type EmailStatus = "pending" | "sent" | "failed";
export type AppRole = "admin" | "interviewer" | "viewer";

export interface CandidateRow {
  id: string; interview_id: string; full_name: string; phone_number: string | null; email: string | null;
  position_applied: string | null; employee_category: EmployeeCategory; interview_date: string | null;
  interview_period: string | null; event_id: string; is_visible: boolean;
  queue_tickets: QueueTicket | null;
}
export interface QueueTicket {
  id: string; candidate_id: string; event_id: string; employee_category: EmployeeCategory; queue_no: number;
  check_in_status: CheckInStatus; interview_status: InterviewStatus; checked_in_at: string; checked_in_by: string | null;
  email_status: EmailStatus; email_sent_at: string | null; email_error: string | null;
}