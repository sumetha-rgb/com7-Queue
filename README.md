# COM7 Interview Queue Management System

ระบบ Next.js 16 สำหรับจัดการคิวสัมภาษณ์ โดยย้ายข้อมูลหลักไป Supabase PostgreSQL และใช้ Resend สำหรับอีเมล

## เริ่มต้นใช้งาน

1. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า Supabase และ Resend
2. เปิด Supabase SQL Editor แล้วรัน `supabase/migrations/202609070001_initial_schema.sql`
3. (ทางเลือก) รัน `supabase/seed.sql` เพื่อเพิ่มข้อมูลตัวอย่าง
4. สร้างผู้ใช้ใน Supabase Auth แล้วเพิ่มแถวใน `profiles` โดยกำหนด `role` เป็น `admin`
5. รัน `npm run dev` แล้วเปิด `/login`

## การปรับใช้ Vercel

เชื่อม repository กับ Vercel และเพิ่ม environment variables ตาม `.env.example` ใน Project Settings. อย่าเพิ่ม `SUPABASE_SERVICE_ROLE_KEY` ลงฝั่ง browser หรือค่า `NEXT_PUBLIC_*` ที่ไม่จำเป็น

## การรับประกันเลขคิว

RPC `check_in_candidate` ทำงานภายใน transaction และใช้ PostgreSQL advisory lock ต่อ Event และ Employee Category พร้อม unique constraint `(event_id, employee_category, queue_no)` จึงแยกคิวหน้าร้าน/ออฟฟิศและไม่ซ้ำเมื่อกดพร้อมกัน

## Google Sheet Sync

เปิด `/admin/interview-queue/sync` เลือก Event แล้ววาง URL ของ Google Sheet และชื่อแท็บ (เช่น `ผู้สมัคร`). ระบบใช้ `Interview_Id` เป็นคีย์สำหรับเพิ่มหรืออัปเดต candidate และเก็บข้อมูลต้นฉบับไว้ใน `candidates.source_data`; จะไม่แก้ไข `queue_tickets` ที่เป็นข้อมูลเช็คชื่อ/คิวของระบบ.

ระบบอ่านเฉพาะ Google Sheets จาก Google Drive folder ที่กำหนดใน `GOOGLE_DRIVE_FOLDER_ID` และให้แอดมินเลือก Event ของเดือนที่ต้องการก่อนผูก Sheet. สร้าง Google service account, แชร์โฟลเดอร์ให้ service account เป็น Viewer, แล้วตั้ง `GOOGLE_SERVICE_ACCOUNT_EMAIL` และ `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` ใน Vercel. Vercel Cron ใน `vercel.json` เรียก sync ทุก 15 นาที โดยต้องตั้ง `CRON_SECRET` ใน Vercel.

คอลัมน์ที่มีความอ่อนไหวมาก เช่น `National_Id`, ที่อยู่ และวันเกิด ไม่จำเป็นต่อการออกคิว จึงควรไม่นำเข้าหรือจำกัดสิทธิ์เข้าถึงตาม PDPA ก่อนเปิดใช้จริง.

## Drive Event Discovery

เปิด `/admin/events` แล้วกด **สแกน Event จาก Drive**. ระบบสร้าง Event จากชื่อไฟล์ Google Sheet และอ่าน `Interview_Date` ของรายการแรกเพื่อจัดเข้าตามเดือน โดยตั้งต้นเป็น `draft`. เปลี่ยนเป็น `active` เมื่อต้องการเปิดบัตรคิว หรือ `closed` เมื่องานจบแล้ว. Event ที่ไม่พบวันที่รูปแบบ ISO หรือ `วัน/เดือน/ปี` จะไม่ถูกสร้างอัตโนมัติเพื่อป้องกันการจัดงานผิดเดือน.
