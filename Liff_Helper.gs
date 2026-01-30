/* =========================================================================== * Liff_Helper.gs
 * LIFF Configuration & Helper Functions สำหรับ LINE Mini App Integration
 * =========================================================================== */

/**
 * ตั้งค่า LIFF ID
 * ให้ไปสร้างใน LINE Developers Console > LIFF > Create New LIFF App
 * แล้วนำ LIFF ID มาใส่ที่นี่
 */
function getLIFFConfig() {
  // ดึงค่าจาก Script Properties (ปลอดภัยกว่า)
  const SCRIPT_PROP = PropertiesService.getScriptProperties();

  return {
    LIFF_ID: SCRIPT_PROP.getProperty('LIFF_ID') || '2006503286-KPxRrnJ8', // เปลี่ยนตรงนี้
    CHANNEL_ID: SCRIPT_PROP.getProperty('LINE_CHANNEL_ID') || '',
    CHANNEL_SECRET: SCRIPT_PROP.getProperty('LINE_CHANNEL_SECRET') || ''
  };
}

/**
 * สร้าง HTML Script สำหรับ LIFF Initialization
 * เอาไปใส่ในทุกหน้าที่ต้องการใช้ LIFF
 */
function getLIFFInitScript() {
  const config = getLIFFConfig();

  return `
<script>
// LIFF Helper Functions (Auto-injected)
const LIFF_CONFIG = {
  LIFF_ID: '${config.LIFF_ID}'
};

let liffReady = false;
let liffUser = null;

async function initializeLIFF() {
  try {
    await liff.init({ liffId: LIFF_CONFIG.LIFF_ID });
    liffReady = true;

    console.log('LIFF initialized successfully');

    // ตรวจสอบว่า Login แล้วหรือยัง
    if (liff.isLoggedIn()) {
      liffUser = await liff.getProfile();
      console.log('LINE User:', liffUser.displayName);

      // Trigger event สำหรับแอปหลัก
      if (typeof onLIFFReady === 'function') {
        onLIFFReady(liffUser);
      }
    } else {
      // ถ้าอยู่ใน LINE Client ให้ login อัตโนมัติ
      if (liff.isInClient()) {
        liff.login();
      }
    }
  } catch (err) {
    console.error('LIFF init failed:', err);
    liffReady = false;

    // Fallback: ใช้ระบบปกติถ้า LIFF ไม่สำเร็จ
    if (typeof onLIFFFailed === 'function') {
      onLIFFFailed(err);
    }
  }
}

// Auto-init เมื่อโหลดหน้า
if (typeof liff !== 'undefined') {
  window.addEventListener('load', initializeLIFF);
} else {
  console.warn('LIFF SDK not loaded');
}

// Helper: ส่งข้อความผ่าน LINE
function sendLineMessage(text) {
  if (liff.isInClient() && liffReady) {
    liff.sendMessages([{
      type: 'text',
      text: text
    }]).then(() => {
      console.log('Message sent');
    }).catch((err) => {
      console.error('Send message failed', err);
    });
  }
}

// Helper: เปิด URL ภายนอก
function openExternalBrowser(url) {
  if (liff.isInClient()) {
    liff.openWindow({ url: url, external: true });
  } else {
    window.open(url, '_blank');
  }
}

// Helper: ปิด LIFF Window
function closeLIFFWindow() {
  if (liff.isInClient()) {
    liff.closeWindow();
  }
}

// Helper: แชร์เนื้อหา
function shareLINEContent(message) {
  if (liff.isInClient() && liff.isApiAvailable('shareTargetPicker')) {
    liff.shareTargetPicker([{
      type: 'text',
      text: message
    }]).then(() => {
      console.log('Shared successfully');
    }).catch((err) => {
      console.error('Share failed', err);
    });
  }
}

// Helper: สแกน QR Code (ถ้ารองรับ)
async function scanQRCode() {
  if (liff.isInClient() && liff.isApiAvailable('scanCodeV2')) {
    try {
      const result = await liff.scanCodeV2();
      return result.value;
    } catch (err) {
      console.error('QR Scan failed', err);
      return null;
    }
  }
  return null;
}

// Helper: ดึง LINE Profile
function getLINEProfile() {
  return liffUser;
}

// Helper: ตรวจสอบว่าอยู่ใน LINE หรือไม่
function isInLINE() {
  return typeof liff !== 'undefined' && liffReady && liff.isInClient();
}

// Helper: Logout จาก LINE
function logoutLINE() {
  if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
    liff.logout();
    window.location.reload();
  }
}
</script>
  `;
}

/**
 * ตรวจสอบ LINE User และ Map เข้ากับฐานข้อมูล
 * (เชื่อม LINE ID กับ Employee ID)
 */
function liff_mapUserToEmployee(lineUserId) {
  try {
    const conf = CONFIG.DB.HR_EMP;
    const allEmp = DB_Select(conf.NAME, conf.COL);

    // หาพนักงานที่มี LINE ID ตรงกัน (ต้องเพิ่มคอลัมน์ "LINE ID" ในชีต HR_Employees)
    const employee = allEmp.find(emp => String(emp.LINE) === String(lineUserId));

    if (employee) {
      return {
        success: true,
        user: {
          id: employee.ID,
          name: employee.NAME,
          position: employee.ROLE,
          role: employee.ROLE.includes('ผู้จัดการ') ? 'admin' :
                (employee.ROLE.includes('หัวหน้า') ? 'manager' : 'staff'),
          avatar: employee.IMG,
          lineId: lineUserId
        }
      };
    }

    // ถ้าไม่เจอ ให้สร้าง Guest User
    return {
      success: true,
      user: {
        id: 'GUEST-' + lineUserId.substring(0, 8),
        name: 'LINE User',
        position: 'ผู้เยี่ยมชม',
        role: 'guest',
        lineId: lineUserId
      }
    };

  } catch (e) {
    Logger.log('Error mapping LINE user: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * API สำหรับหน้า Web เรียกใช้
 */
function liff_getUserFromLineId(lineUserId) {
  return liff_mapUserToEmployee(lineUserId);
}

/**
 * บันทึก LINE Notification Token (ถ้าต้องการส่ง Push Message)
 */
function liff_saveNotificationToken(lineUserId, token) {
  try {
    // บันทึกลง Script Properties หรือ Sheet
    PropertiesService.getScriptProperties().setProperty('LINE_TOKEN_' + lineUserId, token);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * ส่ง LINE Notify (ถ้าต้องการ)
 */
function liff_sendPushMessage(lineUserId, message) {
  // ต้องใช้ LINE Messaging API
  // (ต้องมี Channel Access Token)

  const config = getLIFFConfig();
  if (!config.CHANNEL_ID) {
    Logger.log('LINE Channel not configured');
    return { success: false };
  }

  // Implementation here...
  return { success: true };
}

/**
 * ค้นหาข้อมูลพนักงานจาก LINE User ID
 * @param {string} lineId - รหัส User ID จาก LINE
 * @return {object|null} ข้อมูลพนักงาน หรือ null ถ้าไม่พบ
 */
function findEmployeeByLineId(lineId) {
  // ตรวจสอบว่ามี lineId ส่งมาหรือไม่
  if (!lineId) return null;

  const sheet = getSheet("HR_Employees");
  const data = sheet.getDataRange().getValues();

  // เริ่มวนลูปที่แถวที่ 2 (index 1) เพื่อข้ามหัวตาราง
  for (let i = 1; i < data.length; i++) {
    // ใช้ index [16] เพื่อให้อ่านค่าจากคอลัมน์ Q (LINE ID) ตามโครงสร้างชีตของคุณอ๊อด
    if (data[i][16] == lineId) { 
      return {
        empId: data[i][0],    // คอลัมน์ A: รหัสพนักงาน
        name: data[i][1],     // คอลัมน์ B: ชื่อ-สกุล
        role: data[i][2],     // คอลัมน์ C: ตำแหน่ง
        profilePic: data[i][17] // คอลัมน์ R: รูปโปรไฟล์ (ถ้ามี)
      };
    }
  }
  return null;
}
