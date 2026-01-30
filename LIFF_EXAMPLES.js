/* ===========================================================================
 * LIFF_EXAMPLES.js
 * ตัวอย่างการใช้งาน LIFF ในแต่ละหน้าของระบบ
 * (วางโค้ดเหล่านี้ในไฟล์ HTML ของแต่ละหน้า)
 * =========================================================================== */

// ===========================
// 1. ตัวอย่างสำหรับทุกหน้า
// ===========================

// วิธีตรวจสอบว่าอยู่ใน LINE หรือไม่
if (isInLINE()) {
  console.log('กำลังใช้งานใน LINE');
  // ซ่อนปุ่ม "ดาวน์โหลดแอป LINE" หรือแสดง UI พิเศษ
} else {
  console.log('กำลังใช้งานใน Browser ปกติ');
}

// วิธีดึงข้อมูล LINE Profile
const profile = getLINEProfile();
if (profile) {
  console.log('สวัสดี ' + profile.displayName);
  console.log('User ID: ' + profile.userId);
  // แสดงรูปโปรไฟล์
  document.getElementById('avatar').src = profile.pictureUrl;
}


// ===========================
// 2. สำหรับหน้า Sow_Index.html
// ===========================

// ตัวอย่าง: บันทึกการผสมพันธุ์พร้อมแชร์ผลผ่าน LINE
function saveSowBreedingAndShare(sowData) {
  // บันทึกข้อมูล
  google.script.run.withSuccessHandler(res => {
    if (res.success) {
      Swal.fire('สำเร็จ', 'บันทึกข้อมูลแล้ว', 'success');

      // แชร์ผลผ่าน LINE (ถ้าอยู่ใน LINE)
      if (isInLINE()) {
        const message = `🐷 บันทึกการผสมพันธุ์\n` +
                       `แม่หมู: ${sowData.earTag}\n` +
                       `วันที่: ${sowData.breedDate}\n` +
                       `พ่อพันธุ์: ${sowData.sireId}`;

        shareLINEContent(message);
      }
    }
  }).sow_addBreedingEvent(sowData);
}

// ตัวอย่าง: สแกน QR Code ของแม่หมู
async function scanSowQRCode() {
  if (!isInLINE()) {
    Swal.fire('ขออภัย', 'ฟีเจอร์นี้ใช้ได้เฉพาะใน LINE เท่านั้น', 'info');
    return;
  }

  const qrValue = await scanQRCode();
  if (qrValue) {
    console.log('QR Code:', qrValue);

    // ถ้า QR มีรูปแบบ SOW-XXX
    if (qrValue.startsWith('SOW-')) {
      showSowCard(qrValue);
    }
  }
}

// ตัวอย่าง: ส่งรายงานสุขภาพแม่หมูผ่าน LINE Chat
function sendSowHealthReport(sowId, healthData) {
  const message = `🏥 รายงานสุขภาพแม่หมู ${sowId}\n` +
                  `สถานะ: ${healthData.status}\n` +
                  `อุณหภูมิ: ${healthData.temp}°C\n` +
                  `หมายเหตุ: ${healthData.notes}`;

  if (isInLINE()) {
    sendLineMessage(message);
  }
}


// ===========================
// 3. สำหรับหน้า Fatten_Index.html
// ===========================

// ตัวอย่าง: บันทึกการขายพร้อมแชร์ใบเสร็จ
function logSaleAndShareReceipt(saleData) {
  google.script.run.withSuccessHandler(res => {
    if (res.success && res.url) {
      Swal.fire('สำเร็จ', 'บันทึกการขายแล้ว', 'success');

      // แชร์ PDF ผ่าน LINE
      if (isInLINE()) {
        const message = `💰 ใบเสร็จการขาย\n` +
                       `คอก: ${saleData.penNumber}\n` +
                       `จำนวน: ${saleData.quantity} ตัว\n` +
                       `ยอดรวม: ${saleData.netTotal} บาท\n\n` +
                       `ดูใบเสร็จ PDF: ${res.url}`;

        sendLineMessage(message);
      }
    }
  }).fatten_logSale(saleData);
}

// ตัวอย่าง: สแกน QR Code คอก
async function scanPenQRCode() {
  const qrValue = await scanQRCode();
  if (qrValue) {
    // ถ้า QR มีรูปแบบ PEN-XX
    if (qrValue.startsWith('PEN-')) {
      const penNumber = qrValue.split('-')[1];
      showPenDetail(penNumber);
    }
  }
}

// ตัวอย่าง: แจ้งเตือนน้ำหนักหมูผ่าน LINE
function notifyPigWeightAlert(penNumber, avgWeight) {
  if (avgWeight >= 100) {
    const message = `⚠️ แจ้งเตือน!\n` +
                   `คอก ${penNumber} น้ำหนักถึงเป้า\n` +
                   `น้ำหนักเฉลี่ย: ${avgWeight} กก.\n` +
                   `พร้อมขายได้แล้ว`;

    if (isInLINE()) {
      sendLineMessage(message);
    }
  }
}


// ===========================
// 4. สำหรับหน้า Feed_Index.html
// ===========================

// ตัวอย่าง: แจ้งเตือนสต็อกต่ำผ่าน LINE
function checkLowStockAndNotify() {
  google.script.run.withSuccessHandler(data => {
    const lowStockItems = data.filter(item => item.qty < item.min);

    if (lowStockItems.length > 0 && isInLINE()) {
      let message = '⚠️ สต็อกต่ำ!\n\n';

      lowStockItems.forEach(item => {
        message += `• ${item.name}: ${item.qty} ${item.unit}\n`;
      });

      message += '\nกรุณาสั่งซื้อด่วน';

      sendLineMessage(message);
    }
  }).farm_getFeedStock();
}

// ตัวอย่าง: แชร์รายงานต้นทุนอาหาร
function shareFeedCostReport(month, totalCost) {
  const message = `📊 รายงานต้นทุนอาหาร\n` +
                  `เดือน: ${month}\n` +
                  `ค่าใช้จ่ายรวม: ${totalCost.toLocaleString()} บาท\n` +
                  `ดูรายละเอียดเพิ่มเติมในระบบ`;

  if (isInLINE()) {
    shareLINEContent(message);
  }
}

// ตัวอย่าง: บันทึกการผสมอาหารพร้อมส่งแจ้งเตือน
function recordFeedMixingAndNotify(mixData) {
  google.script.run.withSuccessHandler(res => {
    if (res.success) {
      Swal.fire('สำเร็จ', 'บันทึกการผสมอาหารแล้ว', 'success');

      // แจ้งทาง LINE
      if (isInLINE()) {
        const message = `🥣 ผสมอาหารเสร็จแล้ว\n` +
                       `สูตร: ${mixData.formulaName}\n` +
                       `จำนวน: ${mixData.quantity} ชุด\n` +
                       `ต้นทุน: ${mixData.cost} บาท`;

        sendLineMessage(message);
      }
    }
  }).feed_recordCustomMixing(mixData);
}


// ===========================
// 5. Event Handlers (สำหรับทุกหน้า)
// ===========================

// ฟังก์ชันที่จะถูกเรียกเมื่อ LIFF พร้อมใช้งาน
function onLIFFReady(profile) {
  console.log('LIFF Ready!', profile);

  // ซ่อนหน้า PIN Login
  const pinModal = document.getElementById('pinModal');
  if (pinModal) {
    pinModal.style.display = 'none';
  }

  // แสดงข้อมูล User
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    userNameElement.textContent = profile.displayName;
  }

  // แสดงรูป Avatar
  const avatarElement = document.getElementById('userAvatar');
  if (avatarElement) {
    avatarElement.src = profile.pictureUrl;
  }

  // เรียกใช้ฟังก์ชันเพิ่มเติม (ถ้ามี)
  if (typeof afterLIFFLogin === 'function') {
    afterLIFFLogin(profile);
  }
}

// ฟังก์ชันที่จะถูกเรียกเมื่อ LIFF ล้มเหลว
function onLIFFFailed(error) {
  console.error('LIFF Failed:', error);

  // Fallback: แสดงหน้า PIN Login ปกติ
  const pinModal = document.getElementById('pinModal');
  if (pinModal) {
    pinModal.style.display = 'flex';
  }

  // แสดงข้อความให้ user รู้
  Swal.fire({
    icon: 'info',
    title: 'ใช้งานนอก LINE',
    text: 'กรุณา Login ด้วย PIN หรือรหัสผ่าน',
    timer: 3000
  });
}


// ===========================
// 6. Utility Functions
// ===========================

// ปรับแต่ง UI ตามสภาพแวดล้อม
function adjustUIForLINE() {
  if (isInLINE()) {
    // ซ่อนปุ่มที่ไม่จำเป็นเมื่ออยู่ใน LINE
    const downloadAppBtn = document.getElementById('downloadAppBtn');
    if (downloadAppBtn) {
      downloadAppBtn.style.display = 'none';
    }

    // แสดงปุ่มพิเศษสำหรับ LINE
    const lineOnlyFeatures = document.querySelectorAll('.line-only');
    lineOnlyFeatures.forEach(element => {
      element.style.display = 'block';
    });
  } else {
    // ซ่อนฟีเจอร์ที่ใช้ได้เฉพาะใน LINE
    const lineOnlyFeatures = document.querySelectorAll('.line-only');
    lineOnlyFeatures.forEach(element => {
      element.style.display = 'none';
    });
  }
}

// เรียกใช้เมื่อโหลดหน้า
window.addEventListener('load', () => {
  adjustUIForLINE();
});


// ===========================
// 7. Advanced: การใช้ Flex Message
// ===========================

// ส่ง Flex Message (JSON Format) ผ่าน LINE
function sendFlexMessageReport(reportData) {
  if (!isInLINE()) return;

  const flexMessage = {
    type: 'flex',
    altText: 'รายงานฟาร์ม',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'รายงานฟาร์มประจำวัน',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          }
        ],
        backgroundColor: '#10b981'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `แม่พันธุ์: ${reportData.sowCount} ตัว`,
            margin: 'md'
          },
          {
            type: 'text',
            text: `หมูขุน: ${reportData.fattenCount} ตัว`,
            margin: 'md'
          },
          {
            type: 'text',
            text: `สต็อกอาหาร: ${reportData.feedStatus}`,
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: window.location.href
            },
            style: 'primary'
          }
        ]
      }
    }
  };

  // ส่งผ่าน LIFF SDK
  if (liff.isInClient()) {
    liff.sendMessages([flexMessage]).then(() => {
      Swal.fire('สำเร็จ', 'ส่งรายงานแล้ว', 'success');
    }).catch(err => {
      console.error('Send Flex Message Error:', err);
    });
  }
}


// ===========================
// 8. การใช้ LINE Location
// ===========================

// ส่ง Location ปัจจุบัน (ที่ตั้งฟาร์ม) ผ่าน LINE
function shareFarmLocation() {
  if (!isInLINE()) return;

  const farmLocation = {
    type: 'location',
    title: 'นิพนธ์ฟาร์ม',
    address: 'ตำบล..., อำเภอ..., จังหวัด...',
    latitude: 7.6266950,
    longitude: 100.0030960
  };

  liff.sendMessages([farmLocation]).then(() => {
    Swal.fire('สำเร็จ', 'แชร์ที่ตั้งฟาร์มแล้ว', 'success');
  }).catch(err => {
    console.error('Send Location Error:', err);
  });
}


/* ===========================================================================
 * วิธีใช้งาน:
 *
 * 1. คัดลอกฟังก์ชันที่ต้องการไปใส่ใน <script> ของแต่ละหน้า
 * 2. เรียกใช้ฟังก์ชันเมื่อต้องการ เช่น:
 *    - onClick="scanSowQRCode()"
 *    - onClick="shareFarmLocation()"
 * 3. ปรับแต่งข้อความและ Logic ตามต้องการ
 *
 * Note: ฟังก์ชัน Helper (isInLINE, sendLineMessage, etc.) จะมาจาก
 *       Liff_Helper.gs ที่ inject เข้ามาอัตโนมัติแล้ว
 * =========================================================================== */
