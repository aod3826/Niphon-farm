# 🚀 Quick Start - LINE Mini App Integration

## ✅ ไฟล์ที่แก้ไขแล้ว

```
Index.html          ✅ เพิ่ม LIFF SDK + Auto Login
Sow_Index.html      ✅ เพิ่ม LIFF SDK
Fatten_Index.html   ✅ เพิ่ม LIFF SDK
Feed_Index.html     ✅ เพิ่ม LIFF SDK
Liff_Helper.gs      ✅ ไฟล์ใหม่ - Helper Functions
Config.gs           ⚠️ ต้องเพิ่มคอลัมน์ "LINE ID" (ดูด้านล่าง)
```

---

## ⚡ 3 ขั้นตอนเริ่มต้น

### 1️⃣ สร้าง LIFF App

1. เข้า https://developers.line.biz/console/
2. สร้าง Channel > LIFF > Add
3. คัดลอก **LIFF ID**

### 2️⃣ ใส่ LIFF ID

**ใน Google Apps Script:**
```
Project Settings > Script Properties
Property: LIFF_ID
Value: [ใส่ LIFF ID ที่คัดลอก]
```

**ใน Index.html (บรรทัดที่ 575):**
```javascript
const LIFF_ID = 'ใส่ LIFF ID ตรงนี้';
```

### 3️⃣ Deploy แอป

1. Deploy > New deployment > Web app
2. คัดลอก URL (ต้องมี /exec)
3. นำ URL ไปใส่ใน LIFF Endpoint URL

---

## 🔧 แก้ไข Config.gs

**เพิ่มบรรทัดนี้:**

```javascript
HR_EMP: {
  NAME: "HR_Employees",
  COL: {
    ID: "รหัสพนักงาน",
    NAME: "ชื่อ-สกุล",
    ROLE: "ตำแหน่ง",
    PIN: "PIN",
    PASS: "รหัสผ่าน",
    STATUS: "สถานะ",
    PHONE: "เบอร์โทร",
    LINE: "LINE ID",    // <-- เพิ่มบรรทัดนี้
    ADDR: "ที่อยู่",
    BANK: "ชื่อธนาคาร",
    ACC_NO: "เลขบัญชี",
    IMG: "รูปโปรไฟล์"
  }
}
```

---

## 📱 ทดสอบ

### เปิดใน LINE:
```
https://liff.line.me/[LIFF_ID]
```

### เปิดใน Browser:
```
[Google Apps Script URL]
```

---

## 🎯 ฟีเจอร์หลัก

✅ **Auto Login** จาก LINE Profile
✅ **Fallback** ไปใช้ PIN ถ้าไม่มี LINE
✅ **Responsive** ทำงานได้ทั้ง Mobile และ Desktop
✅ **Secure** ไม่ต้องจำ PIN อีกต่อไป

---

## 💡 Tips

- ใช้ในหน้า Sow/Fatten/Feed โดยเรียก `getLINEProfile()` ได้ทันที
- แชร์เนื้อหาด้วย `shareLINEContent(message)`
- สแกน QR ด้วย `scanQRCode()`
- ปิดหน้าต่างด้วย `closeLIFFWindow()`

---

## ❓ เกิดปัญหา?

อ่านไฟล์ `LINE_MINI_APP_SETUP.md` เพื่อดูรายละเอียดทั้งหมด

---

**พร้อมใช้งาน!** 🎉
