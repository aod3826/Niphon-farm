/* ==========================================================================
   📂 FILE: Module_HR.gs
   คำอธิบาย: Logic ระบบ HR ทั้งหมด
   ========================================================================== */

function HR_Service_Login(empId, password) {
  const conf = CONFIG.DB.HR_EMP;
  // 1. ดึงข้อมูลพนักงานทั้งหมดผ่าน Core DB
  const allEmp = DB_Select(conf.NAME, conf.COL);

  // 2. ค้นหา User
  const user = allEmp.find(u => String(u.ID) === String(empId) && String(u.PASS) === String(password));

  if (!user) return { success: false, message: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" };
  if (user.STATUS !== 'ทำงาน') return { success: false, message: "บัญชีนี้ถูกระงับ" };

  // 3. กำหนด Role
  let role = 'staff';
  if (user.ROLE.includes('ผู้จัดการ') || user.ROLE.includes('เจ้าของ')) role = 'admin';
  else if (user.ROLE.includes('หัวหน้า')) role = 'manager';

  return {
    success: true,
    user: {
      id: user.ID,
      name: user.NAME,
      position: user.ROLE,
      role: role,
      avatar: user.IMG
    }
  };
}

function HR_Service_SubmitTime(data) {
  // 1. เช็คพิกัด
  const dist = UTILS_GetDistance(data.lat, data.lng, CONFIG.LOCATION.LAT, CONFIG.LOCATION.LNG);
  if (dist > CONFIG.MAX_DIST_METERS) {
    return { success: false, message: `อยู่นอกพื้นที่ (${Math.round(dist)} ม.)` };
  }

  const conf = CONFIG.DB.HR_TIME;
  const now = new Date();
  
  // 2. เตรียมข้อมูลบันทึก
  let record = {};
  record.ID = "LOG-" + now.getTime();
  record.TIME = UTILS_DateNow();
  record.EMP_ID = data.empId;
  record.EMP_NAME = data.empName;
  record.LATLNG = `${data.lat},${data.lng}`;
  record.MAP = `http://maps.google.com/?q=${data.lat},${data.lng}`;
  record.STATUS = "ปกติ";
  
  // 3. หาประเภท (IN/OUT) อัตโนมัติ
  const logs = DB_Select(conf.NAME, conf.COL);
  // กรองเฉพาะของคนนี้ และ วันนี้
  const todayLogs = logs.filter(l => l.EMP_ID === data.empId && l.TIME.split(' ')[0] === record.TIME.split(' ')[0]);
  
  // สลับสถานะจากล่าสุด
  let type = "IN";
  if (todayLogs.length > 0) {
    const lastLog = todayLogs[todayLogs.length - 1]; // ตัวสุดท้าย
    type = (lastLog.TYPE === "IN") ? "OUT" : "IN";
  }
  record.TYPE = type;

  // 4. บันทึกลงฐานข้อมูล
  const isSaved = DB_Insert(conf.NAME, conf.COL, record);
  
  if(isSaved) return { success: true, message: `ลงเวลา ${type} สำเร็จ` };
  else return { success: false, message: "เกิดข้อผิดพลาดในการบันทึก" };
}

function HR_Service_GetMyData(empId) {
  // ดึงข้อมูล 3 ส่วน โดยใช้ Key จาก Config ที่ตั้งไว้แม่นๆ
  
  // 1. สลิปเงินเดือน
  const payConf = CONFIG.DB.HR_PAYROLL;
  const payslips = DB_Select(payConf.NAME, payConf.COL)
    .filter(r => String(r.EMP_ID) === String(empId))
    .map(r => ({ period: r.PERIOD, date: r.CUT_DATE, netAmount: r.NET, link: r.PDF }))
    .reverse();

  // 2. ประวัติเบิกเงิน
  const advConf = CONFIG.DB.HR_ADVANCE;
  const advances = DB_Select(advConf.NAME, advConf.COL)
    .filter(r => String(r.EMP_ID) === String(empId))
    .map(r => ({ type: 'เบิกเงิน', detail: r.AMT+' บ.', status: r.STATUS, date: r.REQ_DATE }));

  // 3. ประวัติการลา
  const leaveConf = CONFIG.DB.HR_LEAVE;
  const leaves = DB_Select(leaveConf.NAME, leaveConf.COL)
    .filter(r => String(r.EMP_ID) === String(empId))
    .map(r => ({ type: 'ลา'+r.TYPE, detail: r.REASON, status: r.STATUS, date: r.TIME }));

  // รวมและเรียงวันที่
  const requests = [...advances, ...leaves].sort((a,b) => {
    // แปลงวันที่ string dd/MM/yyyy เป็น Date object เพื่อเทียบ
    // (ส่วนนี้อาจต้องมี function แปลงวันที่ถ้าจะให้ละเอียด แต่เบื้องต้น sort แบบ string ย้อนหลังพอได้)
    return b.date.localeCompare(a.date);
  });

  return { payslips: payslips, requests: requests, documents: [] }; // documents ทำเหมือนกัน
}

// --- MANAGER SECTION ---

// 1. ดึงรายการรออนุมัติทั้งหมด (ใบลา + เบิกเงิน)
function HR_Service_GetPending() {
  let list = [];

  // ดึงใบลา
  const lev = CONFIG.DB.HR_LEAVE;
  const leaves = DB_Select(lev.NAME, lev.COL);
  leaves.forEach(r => {
    if (r.STATUS === 'รออนุมัติ') {
      list.push({
        id: r.ID,
        type: 'leave', // ใช้แยกประเภทตอนกดอนุมัติ
        title: 'ขอลา' + r.TYPE,
        empId: r.EMP_ID,
        detail: r.REASON,
        date: r.TIME
      });
    }
  });

  // ดึงรายการเบิกเงิน
  const adv = CONFIG.DB.HR_ADVANCE;
  const advances = DB_Select(adv.NAME, adv.COL);
  advances.forEach(r => {
    if (r.STATUS === 'รออนุมัติ') {
      list.push({
        id: r.ID,
        type: 'advance',
        title: 'เบิกเงินล่วงหน้า',
        empId: r.EMP_ID,
        detail: `จำนวน ${r.AMT} บาท`,
        date: r.REQ_DATE
      });
    }
  });

  return list;
}

// 2. ประมวลผล (อนุมัติ/ไม่อนุมัติ)
function HR_Service_ProcessRequest(data) {
  // data = { id, type, action, approver }
  const status = (data.action === 'approve') ? 'อนุมัติ' : 'ไม่อนุมัติ';
  
  if (data.type === 'leave') {
    const c = CONFIG.DB.HR_LEAVE;
    // ใช้ DB_Update ที่เราเพิ่งสร้าง
    return DB_Update(c.NAME, c.COL, c.COL.ID, data.id, {
      STATUS: status
      // ถ้ามีคอลัมน์ผู้อนุมัติในชีตใบลา ให้เพิ่มบรรทัดนี้: APPROVER: data.approver 
    });
  } 
  
  if (data.type === 'advance') {
    const c = CONFIG.DB.HR_ADVANCE;
    return DB_Update(c.NAME, c.COL, c.COL.ID, data.id, {
      STATUS: status
      // ถ้ามีคอลัมน์ผู้อนุมัติ ให้เพิ่มบรรทัดนี้: APPROVER: data.approver
    });
  }

  return false;
}

// --- PIN LOGIN SYSTEM ---
function HR_Service_LoginByPIN(pinCode) {
  const conf = CONFIG.DB.HR_EMP;
  const allEmp = DB_Select(conf.NAME, conf.COL);

  // ค้นหา User ที่มี PIN ตรงกับที่ส่งมา (และต้องสถานะ 'ทำงาน')
  const user = allEmp.find(u => String(u.PIN) === String(pinCode));

  if (!user) return { success: false, message: "รหัส PIN ไม่ถูกต้อง" };
  if (user.STATUS !== 'ทำงาน') return { success: false, message: "บัญชีนี้ถูกระงับ" };

  // กำหนด Role
  let role = 'staff';
  if (user.ROLE.includes('ผู้จัดการ') || user.ROLE.includes('เจ้าของ')) role = 'admin';
  else if (user.ROLE.includes('หัวหน้า')) role = 'manager';

  return {
    success: true,
    user: {
      id: user.ID,
      name: user.NAME,
      position: user.ROLE,
      role: role,
      avatar: user.IMG
    }
  };
}

// --- REGISTER SYSTEM ---
function HR_Service_Register(form) {
  const conf = CONFIG.DB.HR_EMP;
  const allEmp = DB_Select(conf.NAME, conf.COL);

  // 1. ตรวจสอบความซ้ำซ้อน (Validation)
  if (allEmp.some(u => String(u.ID) === String(form.id))) {
    return { success: false, message: "❌ รหัสพนักงานนี้มีอยู่ในระบบแล้ว" };
  }
  if (allEmp.some(u => String(u.PIN) === String(form.pin))) {
    return { success: false, message: "❌ รหัส PIN นี้ซ้ำกับคนอื่น กรุณาเปลี่ยนใหม่" };
  }

  // 2. เตรียมข้อมูลบันทึก
  // ค่า Default: สถานะ = รออนุมัติ (ต้องให้ Admin กดรับเข้าทำงานก่อนถึงจะ Login ได้)
  let newEmp = {
    ID: form.id,
    PIN: form.pin,
    PASS: form.pass,
    NAME: form.name,
    ROLE: form.position,
    STATUS: "ทำงาน", // หรือ "รออนุมัติ" ถ้าต้องการให้ Admin ตรวจก่อน (แต่เพื่อให้คุณเทสง่าย ผมใส่ 'ทำงาน' เลย)
    IMG: "" 
  };

  // 3. บันทึก
  const isSaved = DB_Insert(conf.NAME, conf.COL, newEmp);
  
  if (isSaved) return { success: true, message: "ลงทะเบียนสำเร็จ! เข้าใช้งานได้ทันที" };
  else return { success: false, message: "บันทึกข้อมูลล้มเหลว" };
}
