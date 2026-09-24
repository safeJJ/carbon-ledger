# Carbon Ledger

เว็บบันทึกและคำนวณ Carbon Footprint of Organization (CFO) สำหรับหลายบัญชี พัฒนาด้วย Next.js และ Supabase และเผยแพร่ที่ https://carbon-ledger-sigma.vercel.app บน Vercel Hobby

## เริ่มใช้งาน

1. สร้าง Supabase project และรัน SQL ใน `supabase/migrations/` ตามลำดับ
2. ตั้งค่า `NEXT_PUBLIC_CARBON_LEDGER_SUPABASE_URL` และ `NEXT_PUBLIC_CARBON_LEDGER_SUPABASE_PUBLISHABLE_KEY` จากหน้า Connect ของ Supabase ใน Vercel (Production, Preview และ Development ตามที่ใช้งาน)
3. ตั้งค่า Authentication > URL Configuration ให้ Site URL เป็นโดเมน Vercel ที่ใช้งานจริง และเพิ่ม Redirect URLs ที่ต้องการทดสอบ
4. เชื่อม GitHub repo กับ Vercel โดยเลือก Framework Preset: Next.js แล้ว Deploy
5. ผู้ใช้สมัครด้วยอีเมลและรหัสผ่านแล้วเริ่มบันทึกข้อมูลได้ทันที ปัจจุบันปิดการยืนยันอีเมลเพื่อใช้งานโดยไม่ต้องมี SMTP ผู้ใช้จึงต้องเก็บรหัสผ่านเอง เพราะระบบกู้รหัสผ่านผ่านอีเมลของคนนอกทีมยังใช้ไม่ได้ หากต้องการยืนยันอีเมลและกู้รหัสผ่าน ให้ตั้งบริการ SMTP ของตนเองใน Supabase แล้วเปิด Confirm email อีกครั้ง

สำหรับทดสอบในเครื่อง ให้คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ URL และ publishable key ของโปรเจกต์ Supabase จากนั้นรัน `pnpm install` และ `pnpm dev`

## โครงสร้างข้อมูลและสิทธิ์

- `profiles`: ข้อมูลองค์กรและผลการประเมิน Scope 3 ของบัญชี
- `activities`: กิจกรรมปีปัจจุบัน/ปีฐาน ปริมาณ ค่า EF และแหล่งอ้างอิง
- ทุกตารางเปิด RLS และจำกัดการอ่าน/เพิ่ม/แก้ไข/ลบด้วย `auth.uid() = user_id`
- หน้าเว็บใช้เฉพาะ publishable key; ไม่มี service role key ใน frontend หรือ repo
- คำนวณ `tCO₂e = ปริมาณ × EF (kgCO₂e/หน่วย) ÷ 1000`
- หน้าบันทึกแสดงเฉพาะค่า EF จากชุดข้อมูล TGO ที่บริษัทเลือกใช้และตรงกับ Scope; หากยังไม่เลือกจะแสดงทางลัดไปคลังค่า EF และตรวจหน่วย/ค่า EF/แถวอ้างอิงก่อนบันทึก
- รายการ Scope 3 ระบุหมวดกิจกรรมและเชื่อมกลับไปหน้าประเมินหมวดได้; ชุดค่า EF ที่มี Scope 3 จำกัด จึงใช้ค่า EF จากแหล่งอื่นพร้อมระบุที่มาได้
- วันที่กิจกรรมตรวจเทียบช่วงปีรายงาน/ปีฐานเมื่อระบุช่วงปีที่อ่านได้; หน้าแดชบอร์ดเตือนรายการเก่าที่ไม่ตรงช่วงปี
- หน้าแดชบอร์ดและข้อมูลองค์กรเปิดรายการที่กรองตาม Scope หรือปีได้; ผลผลิตปีฐานใช้แสดงความเข้มการปล่อยปีฐาน

ข้อมูลจากเว็บ Sites เดิมไม่ได้อยู่ใน repo นี้เพื่อปกป้องข้อมูลองค์กร ต้องนำเข้าฐานข้อมูลใหม่หลังเจ้าของสร้างบัญชี Supabase และผูกข้อมูลกับ `user_id` ที่ถูกต้องแล้ว

## ตรวจสอบ

`pnpm typecheck` และ `pnpm build`
