insert into public.events (id, name, event_date, location, status) values
  ('11111111-1111-1111-1111-111111111111', 'Interview Day โรงแรมนิวซีซั่นสแควร์ หาดใหญ่', '2026-09-03', 'หาดใหญ่', 'active');
insert into public.candidates (interview_id, full_name, phone_number, email, position_applied, employee_category, interview_date, interview_period, event_id) values
  ('b91c2e40', 'นาย ฮัสซัน โตะอาดัม', '0886847936', 'orangza34@example.com', 'พนักงานประจำหน้าร้านสาขา True', 'พนักงานหน้าร้าน', '2026-09-03', '11:00-12:00', '11111111-1111-1111-1111-111111111111'),
  ('d18ee210', 'นาย ธีรพงศ์ ใจดี', '0819876543', 'teerapong@example.com', 'นักศึกษาฝึกงาน แผนก IT Software', 'ออฟฟิศ', '2026-09-03', '13:00-14:00', '11111111-1111-1111-1111-111111111111');
