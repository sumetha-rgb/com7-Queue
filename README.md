# COM7 Interview Queue Management

ระบบจัดการคิวสัมภาษณ์สำหรับทีมสรรหาบุคลากร COM7 สร้างด้วย Next.js, Supabase และ Google Sheets ใช้สำหรับนำเข้ารายชื่อผู้สมัคร ออกบัตรคิว เช็คชื่อ บันทึกสถานะสัมภาษณ์ และส่งอีเมลแจ้งผู้สมัคร

## ความสามารถหลัก

- เลือก Event และดูรายชื่อผู้สมัครพร้อมสถานะคิวแบบรวมศูนย์
- เช็คชื่อและออกเลขคิวแยกตามกลุ่ม `พนักงานหน้าร้าน` และ `ออฟฟิศ`
- เปลี่ยนสถานะเป็นยังไม่สัมภาษณ์, สัมภาษณ์แล้ว หรือไม่เข้าร่วม
- ส่งอีเมลแจ้งบัตรคิวผ่าน Brevo และเก็บสถานะการส่ง
- นำเข้าหรือซิงก์ผู้สมัครจาก Google Sheets โดยไม่เขียนทับประวัติคิว
- เก็บประวัติคิวตาม Event และตั้งค่าการเชื่อมต่อ Sheet
- ควบคุมสิทธิ์ด้วย Supabase Auth: `admin`, `interviewer`, `viewer`

## โครงสร้างโปรเจกต์และหน้าที่ของไฟล์

```text
src/
├── app/                              # หน้าเว็บและ API routes ของ Next.js
│   ├── interview-queue/page.tsx      # หน้าบัตรคิวหลัก
│   ├── queue-history/page.tsx        # หน้าดูประวัติคิวแยกตาม Event
│   ├── settings/page.tsx             # หน้าตั้งค่าการเชื่อมต่อ Google Sheet
│   ├── admin/events/page.tsx         # หน้าจัดการสถานะ Event สำหรับผู้ดูแล
│   ├── login/, signup/, forgot-password/, Reset-password/
│   │                                  # หน้า authentication และรีเซ็ตรหัสผ่าน
│   ├── auth/callback/route.ts         # รับ callback หลังยืนยันตัวตนกับ Supabase
│   └── api/                           # API สำหรับหน้าเว็บ, sync และ Cron
├── components/interview-queue/        # React components ของระบบคิว
├── lib/                               # โค้ด business logic และตัวเชื่อมต่อบริการภายนอก
│   └── supabase/                      # Supabase clients สำหรับ browser/server/admin
└── types/domain.ts                    # TypeScript types ที่ใช้ร่วมกัน

supabase/
├── migrations/                        # การเปลี่ยน schema ฐานข้อมูลตามลำดับเวลา
├── seed.sql                           # ข้อมูลตัวอย่างสำหรับ environment พัฒนา
└── cleanup-duplicate-events.sql       # คำสั่งช่วยจัดการ Event ซ้ำ

public/                                # โลโก้และไฟล์ static ที่เปิดใช้จาก browser
vercel.json                            # ตาราง Vercel Cron
.env.example                           # รายการ environment variables ที่จำเป็น
```

### หน้าเว็บ

| ไฟล์ | หน้าที่ |
| --- | --- |
| `src/app/page.tsx` | ส่งผู้ใช้จากหน้าแรกไปยังหน้าบัตรคิว |
| `src/app/interview-queue/page.tsx` | ประกอบ sidebar และ dashboard ของหน้าคิวหลัก |
| `src/app/queue-history/page.tsx` | แสดงประวัติบัตรคิวตาม Event |
| `src/app/settings/page.tsx` | แสดงและจัดการการเชื่อมต่อ Google Sheet |
| `src/app/admin/events/page.tsx` | สร้างและเปลี่ยนสถานะ Event สำหรับผู้ดูแล |
| `src/app/login/page.tsx` | เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน |
| `src/app/signup/page.tsx` | สมัครบัญชีเจ้าหน้าที่ |
| `src/app/forgot-password/page.tsx` | ขออีเมลสำหรับรีเซ็ตรหัสผ่าน |
| `src/app/Reset-password/page.tsx` | ตั้งรหัสผ่านใหม่หลังยืนยันตัวตน |
| `src/app/layout.tsx` และ `src/app/globals.css` | โครง HTML หลักและสไตล์ส่วนกลาง |

### Components

| ไฟล์ | หน้าที่ |
| --- | --- |
| `queue-dashboard.tsx` | หน้าจัดการคิวหลัก: เลือก Event, ค้นหา, กรอง, เช็คชื่อ และแสดงสรุป |
| `queue-ticket-modal.tsx` | หน้าต่างรายละเอียดผู้สมัครและการออกบัตรคิว |
| `queue-history.tsx` | รายการ Event ในประวัติและตารางคิวของ Event ที่เลือก |
| `queue-sidebar.tsx` | เมนูนำทาง, ชื่อผู้ใช้ และปุ่มออกจากระบบ |
| `sheet-connection-settings.tsx` | แสดงสถานะและยกเลิกการเชื่อมต่อ Sheet |

### API routes

| เส้นทาง | ไฟล์ | หน้าที่ |
| --- | --- | --- |
| `/api/candidates` | `api/candidates/route.ts` | ส่งรายชื่อผู้สมัคร, บัตรคิวล่าสุด และตัวเลขสรุปของ Event |
| `/api/candidates/:id/visibility` | `api/candidates/[Id]/visibility/route.ts` | ซ่อนหรือแสดงผู้สมัคร |
| `/api/events` | `api/events/route.ts` | อ่านรายการ Event และสร้าง Event ใหม่ |
| `/api/events/:id/status` | `api/events/[id]/status/route.ts` | เปลี่ยนสถานะ Event |
| `/api/queue/check-in` | `api/queue/check-in/route.ts` | เช็คชื่อ, ออกเลขคิว และส่งอีเมล |
| `/api/queue/:id/interview-status` | `api/queue/[id]/interview-status/route.ts` | บันทึกสถานะสัมภาษณ์ |
| `/api/queue/:id/email/retry` | `api/queue/[id]/email/retry/route.ts` | ส่งอีเมลบัตรคิวซ้ำ |
| `/api/queue/events` | `api/queue/events/route.ts` | ส่ง Event ที่มีประวัติคิวสำหรับหน้าประวัติ |
| `/api/google-drive/events` | `api/google-drive/events/route.ts` | ค้นหา Sheet จาก Google Drive และนำเข้า Event ที่เลือก |
| `/api/google-sheet/connect` | `api/google-sheet/connect/route.ts` | เชื่อม URL Google Sheet กับ Event |
| `/api/google-sheet/connections` | `api/google-sheet/connections/route.ts` | อ่านและยกเลิกการเชื่อมต่อ Sheet |
| `/api/sync/google-sheet` | `api/sync/google-sheet/route.ts` | ซิงก์ Sheet จากหน้าเว็บ, Cron หรือ webhook |
| `/api/dashboard/interview-queue` | `api/dashboard/interview-queue/route.ts` | API สรุปคิวแบบเดิม; หน้าคิวหลักปัจจุบันใช้ summary จาก `/api/candidates` |

### Business logic และบริการภายนอก

| ไฟล์ | หน้าที่ |
| --- | --- |
| `lib/auth.ts` | ตรวจสอบ session และ role ก่อนอนุญาตให้เรียก API |
| `lib/validation.ts` | กฎตรวจสอบข้อมูลที่รับจาก request ด้วย Zod |
| `lib/google-sheet-sync.ts` | ดาวน์โหลด, แปลง, hash และบันทึกผู้สมัครจาก Google Sheet |
| `lib/google-drive.ts` | อ่านรายการ Google Sheets จาก Google Drive folder |
| `lib/email.ts` | สร้างและส่งอีเมลบัตรคิวผ่าน Brevo |
| `lib/category.ts` | utility สำหรับกลุ่มพนักงาน |
| `lib/supabase/client.ts` | Supabase client สำหรับ browser |
| `lib/supabase/server.ts` | Supabase client สำหรับ server ที่รับ session จาก cookie |
| `lib/supabase/admin.ts` | Supabase service-role client สำหรับงานระบบ เช่น sync |
| `types/domain.ts` | นิยาม type ของ role, Event, ผู้สมัคร และบัตรคิว |

### Migrations สำคัญ

| ไฟล์ | หน้าที่ |
| --- | --- |
| `202609070001_initial_schema.sql` | สร้าง schema หลัก, tables, roles, RLS และ RPC ออกคิว |
| `202609070002_google_sheet_sync.sql` | เพิ่มตารางการเชื่อมต่อ Google Sheet และข้อมูลต้นฉบับ |
| `202609070003_drive_event_discovery.sql` | รองรับการค้นหา Event จาก Google Drive |
| `202609080003_queue_date_and_event_history.sql` | รองรับเลขคิวตามวันและประวัติคิว |
| `202609080004_event_scoped_candidate_identity.sql` | กำหนด `Interview_Id` ให้ไม่ซ้ำภายใน Event |
| `202609080005_sheet_sync_optimization.sql` | เพิ่ม metadata และ lock สำหรับการ sync Sheet |
| `202609080006_preserve_queue_history.sql` | ป้องกันการ sync ลบหรือเปลี่ยนผู้สมัครที่มีประวัติคิว |
| `202609090002_create_profile_on_signup.sql` | สร้าง profile เมื่อมีผู้สมัครบัญชีใหม่ |
| `202609090003_queue_dashboard_read_indexes.sql` | เพิ่ม index เพื่อให้หน้าคิวค้นหาและอ่านประวัติเร็วขึ้น |

## ประสิทธิภาพ

หน้า `/interview-queue` ลดงานบนเส้นทางการแสดงผลหลักดังนี้

- รายชื่อและตัวเลขสรุปคิวโหลดจาก API เดียว
- Event ล่าสุดที่ผู้ใช้เลือกถูกโหลดพร้อมรายการ Event ในการเปิดซ้ำ
- รายการ Google Drive โหลดเมื่อผู้ใช้เริ่มค้นหา Sheet เท่านั้น และเก็บ cache ฝั่งเบราว์เซอร์ระยะสั้น
- มีดัชนีสำหรับการค้นหาผู้สมัครและประวัติคิวตาม Event

ผลลัพธ์ของตารางคิวและตัวเลขสรุปยังใช้เงื่อนไขเดิมทั้งหมด การเปลี่ยนแปลงมีเฉพาะลำดับและเวลาการโหลดข้อมูล

## ข้อกำหนด

- Node.js 20 ขึ้นไป
- โปรเจกต์ Supabase
- บัญชี Brevo (ถ้าต้องการส่งอีเมล)
- Google Drive folder และ Google Sheets ที่เข้าถึงได้ (ถ้าต้องการนำเข้าจาก Sheet)

## ตั้งค่าในเครื่อง

ติดตั้ง dependencies และสร้างไฟล์ environment:

```powershell
npm install
Copy-Item .env.example .env.local
```

กำหนดค่าใน `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BREVO_API_KEY=
EMAIL_FROM="COM7 Recruitment <queue@example.com>"
CRON_SECRET=
NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_URL=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_API_KEY=
```

ห้ามเผยแพร่ `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` หรือ `CRON_SECRET` และห้ามตั้งชื่อเป็น `NEXT_PUBLIC_*` เพราะค่ากลุ่มนี้จะถูกส่งไปยังเบราว์เซอร์

เริ่มระบบ:

```powershell
npm run dev
```

จากนั้นเปิด [http://localhost:3000/login](http://localhost:3000/login)

## ฐานข้อมูลและ migrations

ไฟล์ migration อยู่ใน `supabase/migrations` และต้องรันตามลำดับทั้งหมดสำหรับฐานข้อมูลใหม่:

```powershell
npx supabase db push
```

ก่อนกดตอบรับคำสั่งนี้ ให้ตรวจด้วย:

```powershell
npx supabase migration list
```

ถ้า remote database มีตารางหรือข้อมูลอยู่แล้ว แต่คอลัมน์ `Remote` ว่างทั้งหมด **ห้าม push ทันที** เพราะ migration เริ่มต้นอาจชน schema เดิม ต้อง reconcile ประวัติ migration ให้ตรงกับฐานข้อมูลก่อน

สำหรับการปรับประสิทธิภาพของหน้าคิว ต้องมี migration นี้ใน remote database:

```text
202609090003_queue_dashboard_read_indexes.sql
```

ซึ่งเพิ่ม index `candidates_visible_event_created_idx` และ `queue_tickets_event_latest_idx`

## บัญชีผู้ใช้และสิทธิ์

หลังรัน `202609090002_create_profile_on_signup.sql` ผู้ใช้ที่สมัครใหม่จะได้ profile อัตโนมัติด้วย role `admin` ตามการตั้งค่าปัจจุบันของระบบ บัญชีเดิมสามารถกำหนดสิทธิ์ได้จาก Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

สำหรับการสมัครและเข้าสู่ระบบทันที ให้ปิด **Confirm email** ใน Supabase Auth หากนโยบายองค์กรอนุญาต การรีเซ็ตรหัสผ่านยังใช้การยืนยันทางอีเมลตามปกติ

## การทำงานของ Google Sheets

1. ตั้ง `GOOGLE_DRIVE_FOLDER_ID` และ `GOOGLE_DRIVE_API_KEY`
2. แชร์ Google Drive folder และ Google Sheet ตามสิทธิ์ที่ API key อ่านได้
3. ที่หน้าบัตรคิว ค้นหาและเลือก Google Sheet หรือวาง URL Sheet เพื่อสร้าง Event
4. ระบบใช้ `Interview_Id` เป็นคีย์ในการเพิ่มหรืออัปเดตผู้สมัครภายใน Event เดียวกัน

ระบบเก็บข้อมูลต้นฉบับไว้ใน `candidates.source_data` และไม่เขียนทับ `queue_tickets` ซึ่งเป็นประวัติการเช็คชื่อและเลขคิว ห้ามเปลี่ยน `Interview_Id` ของผู้สมัครเดิม หากต้องการให้ระบบระบุว่าเป็นคนเดิม

การซิงก์อัตโนมัติทำงานขณะหน้าคิวเปิดอยู่ทุก 30 วินาทีสำหรับ Event ที่เลือก และจะบันทึกข้อมูลเฉพาะเมื่อเนื้อหา Sheet เปลี่ยน

## Cron และการซิงก์จากภายนอก

Vercel Cron เรียก `GET /api/sync/google-sheet` ทุกวันตาม [vercel.json](vercel.json) โดยต้องใส่ `CRON_SECRET` ใน Vercel Environment Variables

หากต้องการซิงก์ทันทีหลังแก้ Google Sheet สามารถเรียก endpoint นี้จาก Google Apps Script โดยเก็บ secret ไว้ใน Script Properties:

```http
POST https://<your-domain>/api/sync/google-sheet
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{"eventId":"<event-id>"}
```

## ตรวจสอบก่อน deploy

```powershell
npm run build
git status
```

ให้ commit เฉพาะไฟล์ source และ migration ที่ตั้งใจแก้ไข ห้าม commit `.env.local` หรือ `.next`

Vercel ต้องมี environment variables ครบตาม `.env.example` และต้อง deploy migration ไปยัง Supabase ให้สำเร็จก่อน deploy โค้ด เพื่อให้ index ใหม่พร้อมใช้งาน

## คำสั่งที่ใช้บ่อย

```powershell
npm run dev
npm run build
npm run test
npx supabase migration list
npx supabase db push
```
