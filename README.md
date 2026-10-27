# Plant 02 — Calibration Intelligence

เว็บไซต์รายงานการสอบเทียบเครื่องมือสำหรับทีม Production ปี 2026 จากไฟล์ **Calibration critical instrument plant 2_2026.xlsx** ใช้ Python 3.10+ และ JavaScript/CSS โดยไม่ต้อง build หรือติดตั้ง package สำหรับการรันปกติ

## GitHub Pages

มี workflow `.github/workflows/pages.yml` สำหรับ build และเผยแพร่เมื่อ push ไปที่ `main` หรือสั่ง **Run workflow** ในแท็บ Actions

- หาก Pages ยังไม่ถูกเปิดและ token ของ workflow ไม่มีสิทธิ์เปิดอัตโนมัติ: เข้า **Settings → Pages → Build and deployment → Source: GitHub Actions** แล้วสั่ง workflow อีกครั้ง
- URL มาตรฐานหลัง deployment สำเร็จ: `https://folkze.github.io/Test_codex_v1.1/`
- สถานะการ deploy ตรวจได้ในแท็บ Actions ของ repository; URL ข้างต้นไม่ได้ยืนยันว่า deployment สำเร็จแล้ว
- GitHub Pages ใช้ข้อมูลเริ่มต้นจาก `data/source.json` การเพิ่มและแก้ไขเก็บใน **localStorage ของเบราว์เซอร์นั้น** ไม่ซิงก์กับ GitHub หรือผู้ใช้อื่น
- ปุ่ม **สำรอง JSON** เก็บข้อมูลครบทุกขอบเขต; **นำเข้า JSON** อัปเดตรายการ ID เดียวกันจากไฟล์ที่เลือกและเก็บรายการอื่นไว้ ตรวจสอบไฟล์ก่อนนำเข้าและสำรองก่อนเปลี่ยนเครื่อง/ล้าง browser
- รุ่น Python ด้านล่างยังใช้ข้อมูลบน server ร่วมกันตามเดิม

ทดสอบ static build โดยไม่ใช้ Python application server:

```bash
python scripts/build_pages.py
python -m http.server 8080 --directory site
```

คำสั่ง build ต้องใช้ directory ปลายทางที่ยังไม่มีอยู่ เพื่อป้องกันเขียนทับไฟล์ที่ไม่ได้ตั้งใจ เปลี่ยนปลายทางได้ด้วย `python scripts/build_pages.py /tmp/new-pages-build`

## เริ่มใช้งาน

```bash
cd /workspace/Test_codex_v1.1
python server.py --port 3000
```

ให้เปิดแอปจากพอร์ต 3000 ของเครื่องที่รัน server เว็บไซต์ต้องใช้ server นี้เพื่ออ่านและบันทึกข้อมูล ไม่ใช่เปิด `index.html` โดยตรง

## ฟังก์ชัน

- คำอธิบายเอกสาร (`guide.html`): สรุปภาษาไทยจาก LEC – Critical Sensor Critiria & Definition จำนวน 2 หน้า ครอบคลุม Critical Sensor, Validation, Calibration, master plans และการสื่อสาร พร้อมลิงก์เปิด/ดาวน์โหลด PDF ต้นฉบับ และพิมพ์คำอธิบาย

- Overview: KPI, กราฟแผน/ผลจริงรายเดือน, ความคืบหน้าทั้งปี และสรุปแยก Workshop
- เลือกขอบเขต **เครื่องมือทั้งหมด** (387 รายการ) หรือ **Critical instruments** (111 รายการ) รวมถึง workshop และเดือนรายงาน
- Instrument register: ค้นหา TAG/ชื่อ/ประเภท/Workshop และแบ่งหน้า
- เพิ่มเครื่องมือ แก้ไขรายละเอียด แผน/จำนวนงานจริงรายเดือน และค่าอ่านของ Critical
- TAG ซ้ำในขอบเขตเดียวกันจะถูกปฏิเสธ รายการเดิมที่ไม่มี TAG สามารถเติมได้
- การแก้ไขรายการเดียวกันจากข้อมูลเก่าจะถูกปฏิเสธ ให้รีเฟรชก่อนแก้ใหม่
- Export CSV: ส่งออก **ทุกรายการที่ตรงตัวกรองและคำค้น** พร้อมข้อมูล 12 เดือน เปิดใน Excel ได้ รวมค่าอ่านและข้อความจากต้นฉบับ
- พิมพ์/PDF: หน้า Overview พิมพ์สรุปรายงาน; หน้า Instrument register พิมพ์ทุกรายการที่ตรงตัวกรอง/คำค้น ไม่จำกัดหน้าปัจจุบัน
- Data insights: อธิบายความคลาดเคลื่อนของสูตรต้นฉบับ ขอบเขตข้อมูล และวิธีคำนวณ

เดือนรายงานเริ่มต้นคือ **กันยายน 2026** ตาม workbook ไม่ใช่เดือนปัจจุบัน การกรองเดือนใช้กับ KPI สะสมและสถานะทะเบียน กราฟและ Annual progress แสดงครบทั้งปี

## ข้อมูลและการสำรอง

- `data/source.json` เป็นข้อมูลต้นฉบับที่อ่านจาก workbook ทั้งสองชุดข้อมูลเป็นคนละขอบเขต ห้ามบวกจำนวนเครื่องมือเข้าด้วยกัน
- การแก้ไขบันทึกถาวรที่ `data/working.json` บนเครื่อง server ด้วย atomic write และตรวจ revision ของรายการ
- สำรอง `working.json` เพื่อเก็บข้อมูลที่เพิ่ม/แก้ไข การล้าง browser ไม่ลบข้อมูลบน server
- ไม่มีการเขียนกลับ Excel หรือ sync กับ Excel อัตโนมัติ หมายเหตุ “No cal.” และตำแหน่งแถวจากต้นฉบับยังคงเก็บไว้เพื่ออ้างอิง
- ไม่ใช้ฐานข้อมูลภายนอกหรือ API key
- รุ่นนี้สำหรับ workspace ภายใน มีการบันทึกส่วนกลางบนเครื่องเดียว ยังไม่มีบัญชีผู้ใช้/สิทธิ์รายบุคคลหรือ audit log รายการแก้ไข หากนำไปใช้ร่วมกันบนเครือข่ายองค์กร ให้ใช้ authenticated ingress และสำรองโฟลเดอร์ข้อมูล

รายละเอียดการวิเคราะห์: [docs/DATA_ANALYSIS.md](docs/DATA_ANALYSIS.md)

## นำเข้าจาก Excel อีกครั้ง (เครื่องมือสำหรับผู้พัฒนา)

```bash
python -m pip install -r requirements-import.txt
python scripts/import_excel.py '/path/to/Calibration critical instrument plant 2_2026.xlsx'
```

ทำจาก root ของ repository คำสั่งสร้าง `source.json` ตามโครงสร้างไฟล์ปี 2026 นี้ ไม่ใช่ importer สำหรับ Excel ทุกรูปแบบ หากมี `working.json` แอปยังใช้ไฟล์นั้นต่อไป เพื่อไม่ลบการแก้ไขเดิม ควรสำรองและวางแผนการย้ายข้อมูลก่อนเปลี่ยน baseline

## ทดสอบ

```bash
python -m pip install -r requirements-dev.txt
CHROMIUM_PATH=/usr/bin/chromium python -m unittest discover -s tests -v
node --check web/app.js
```

ต้องมี Chromium สำหรับทดสอบเบราว์เซอร์ กำหนดตำแหน่ง executable ด้วย `CHROMIUM_PATH` ได้ การทดสอบใช้สำเนาข้อมูลใน temporary directory ไม่แก้ไขข้อมูลใช้งานจริง ทดสอบยอดข้อมูลต้นฉบับ, ค่า 0/ติดลบ/No cal., การบันทึกถาวร, revision conflict, validation, TAG ว่าง/ซ้ำ, ตัวกรอง, เพิ่ม/แก้ผ่าน UI, reload, CSV และหน้าจอมือถือ
