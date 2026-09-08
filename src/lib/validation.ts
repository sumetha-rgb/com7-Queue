import { z } from "zod";
export const uuidSchema = z.string().uuid();
export const checkInSchema = z.object({ candidateId: uuidSchema });
export const interviewStatusSchema = z.object({ status: z.enum(["ยังไม่สัมภาษณ์", "สัมภาษณ์แล้ว", "ไม่เข้าร่วม"]) });
export const retryEmailSchema = z.object({ ticketId: uuidSchema });
export const createEventSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ Event").max(200),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง"),
  location: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
});