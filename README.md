# COM7 Interview Queue Management System

ระบบ Next.js 16 สำหรับจัดการคิวสัมภาษณ์ โดยย้ายข้อมูลหลักไป Supabase PostgreSQL และใช้ Brevo สำหรับอีเมล

## เริ่มต้นใช้งาน

1. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า Supabase และ Brevo
2. เปิด Supabase SQL Editor แล้วรัน `supabase/migrations/202609070001_initial_schema.sql`
3. (ทางเลือก) รัน `supabase/seed.sql` เพื่อเพิ่มข้อมูลตัวอย่าง
4. สร้างผู้ใช้ใน Supabase Auth แล้วเพิ่มแถวใน `profiles` โดยกำหนด `role` เป็น `admin`
5. รัน `npm run dev` แล้วเปิด `/login`

หลังรัน migration `202609090002_create_profile_on_signup.sql` บัญชีใหม่จะถูกสร้างใน `profiles` อัตโนมัติด้วย role `admin` หลังสร้าง Auth user เนื่องจากระบบนี้เปิดให้เจ้าหน้าที่ Admin ใช้งานเท่านั้น. ให้ปิด **Confirm email** ใน Supabase Auth เพื่อให้สมัครแล้วเข้าสู่ระบบได้ทันที. การยืนยันอีเมลจะใช้เฉพาะกรณี **ลืมรหัสผ่าน** เท่านั้น. บัญชีเดิมจะไม่ถูกเปลี่ยน role อัตโนมัติ:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

## การปรับใช้ Vercel

เชื่อม repository กับ Vercel และเพิ่ม environment variables ตาม `.env.example` ใน Project Settings. อย่าเพิ่ม `SUPABASE_SERVICE_ROLE_KEY` ลงฝั่ง browser หรือค่า `NEXT_PUBLIC_*` ที่ไม่จำเป็น

## การรับประกันเลขคิว

RPC `check_in_candidate` ทำงานภายใน transaction และใช้ PostgreSQL advisory lock ต่อ Event และ Employee Category พร้อม unique constraint `(event_id, employee_category, queue_no)` จึงแยกคิวหน้าร้าน/ออฟฟิศและไม่ซ้ำเมื่อกดพร้อมกัน

## Google Sheet Sync

เปิด `/admin/interview-queue/sync` เลือก Event แล้ววาง URL ของ Google Sheet และชื่อแท็บ (เช่น `ผู้สมัคร`). ระบบใช้ `Interview_Id` เป็นคีย์สำหรับเพิ่มหรืออัปเดต candidate และเก็บข้อมูลต้นฉบับไว้ใน `candidates.source_data`; จะไม่แก้ไข `queue_tickets` ที่เป็นข้อมูลเช็คชื่อ/คิวของระบบ. ก่อนใช้งานจริงต้องรัน migrations ทุกไฟล์ตามลำดับ โดยเฉพาะ `202609080004_event_scoped_candidate_identity.sql` และ `202609080006_preserve_queue_history.sql`; ห้ามเปลี่ยนค่า `Interview_Id` ของผู้สมัครเดิมใน Sheet เพราะจะถือเป็นคนละคน.

เปิดไฟล์จากโฟลเดอร์ Google Drive ผ่าน `NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_URL` ซึ่งต้องแชร์เป็นสาธารณะตามนโยบายขององค์กร. สำหรับ dropdown Event ให้ตั้ง `GOOGLE_DRIVE_FOLDER_ID` และ `GOOGLE_DRIVE_API_KEY` โดย API key ใช้เฉพาะอ่านรายชื่อไฟล์สาธารณะ ไม่ต้องใช้ service account. เมื่อเลือกไฟล์ ระบบอ่านข้อมูลผ่าน public CSV endpoint และบันทึกข้อมูลคิว/ประวัติแยกใน Supabase โดยไม่เขียนกลับไปยัง Sheet ต้นทาง. Vercel Cron ใน `vercel.json` เรียก sync ทุก 15 นาที โดยต้องตั้ง `CRON_SECRET` ใน Vercel.

คอลัมน์ที่มีความอ่อนไหวมาก เช่น `National_Id`, ที่อยู่ และวันเกิด ไม่จำเป็นต่อการออกคิว จึงควรไม่นำเข้าหรือจำกัดสิทธิ์เข้าถึงตาม PDPA ก่อนเปิดใช้จริง.

## อัปเดตจาก Google Sheet

หน้าคิวตรวจ Sheet ของ Event ที่เลือกทุก 30 วินาที และจะเขียนข้อมูลลงฐานข้อมูลเฉพาะเมื่อเนื้อหาใน Sheet เปลี่ยนเท่านั้น จึงไม่มีการสร้างคิวใหม่หรืออัปเดตข้อมูลซ้ำเมื่อ Sheet ไม่เปลี่ยน

หากต้องการอัปเดตทันทีหลังแก้ไข Google Sheet ให้สร้าง **installable On edit trigger** ใน Google Apps Script ของ Sheet แล้วเรียก `POST https://<โดเมนระบบ>/api/sync/google-sheet` พร้อม header `Authorization: Bearer <CRON_SECRET>` และ body:

```json
{ "eventId": "<Event ID ของ Sheet นี้>" }
```

เก็บ `CRON_SECRET` ใน Script Properties ของ Apps Script ไม่ใส่ไว้ในเซลล์หรือโค้ดที่แชร์สาธารณะ การเรียกนี้จะดาวน์โหลด Sheet ตรวจ hash และจะไม่เขียนข้อมูลใด ๆ หากยังไม่มีการเปลี่ยนแปลง
