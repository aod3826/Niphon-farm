/* * Feed_Service.gs
 * ระบบจัดการอาหาร: ผสมอาหาร, สต็อกวัตถุดิบ/ยา, และเบิกจ่ายเข้าคอก
 */

// ==========================================
// 🔑 1. CONFIGURATION (ส่วนตั้งค่าระบบ)
// ==========================================
var _scriptProps = PropertiesService.getScriptProperties();

const FEED_CONFIG = {
  // 1. System Config
  SPREADSHEET_ID: _scriptProps.getProperty("SPREADSHEET_ID"),
  IMAGE_FOLDER_ID: _scriptProps.getProperty("FEED_IMAGE_FOLDER_ID"),
  SETTINGS_PASSWORD: "3826",

  // 2. LINE Messaging API Config
  LINE_ACCESS_TOKEN: _scriptProps.getProperty("LINE_TOKEN"),      // Channel Access Token
  LINE_TARGET_ID: _scriptProps.getProperty("LINE_GROUP_ID"),      // Group ID สำหรับแจ้งเตือนทีมงาน

  // 3. Sheet Names Mapping (จับคู่ชื่อชีต)
  SHEET_NAMES: {
   MATERIALS: 'อาหาร_สต็อกวัตถุดิบ',
   VITAMINS: 'อาหาร_สต็อกยา',
   FORMULAS: 'อาหาร_สูตรผสม',
   FORMULA_SUPPLEMENTS: 'อาหาร_สูตรวิตามิน',
   LOG_MIXING: 'อาหาร_ประวัติผสม',
   LOG_STOCK_IN: 'อาหาร_รับเข้า',
   LOG_ADJUST: 'อาหาร_ปรับสต็อก',
   PRICES: 'อาหาร_ราคา',
   LOG_EVENTS: 'อาหาร_บันทึกเหตุการณ์',

   // ✅ เพิ่มใหม่: สำหรับฟีเจอร์เบิกอาหารเข้าคอก
   LOG_DISPENSE: 'อาหาร_การเบิกใช้' 
  }
};

// ==========================================
// 🛠️ 2. CORE FUNCTIONS (ฟังก์ชันหลัก)
// ==========================================

/* * ฟังก์ชันดึงข้อมูลเริ่มต้น (สำหรับหน้า Dashboard)
 * - ดึงสต็อกวัตถุดิบ (Material) + ราคา (Price)
 * - ดึงสต็อกยา/วิตามิน (Vitamin)
 * - ดึงสูตรอาหาร (Formulas)
 */
function feed_getInitialData() {
  try {
    const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
    
    // 1. ดึงข้อมูลวัตถุดิบ (Materials)
    const sheetMat = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.MATERIALS);
    const dataMat = sheetMat.getDataRange().getValues();
    const headersMat = dataMat[0]; // แถวหัวตาราง
    
    // ดึงราคากลาง (Prices) แยกต่างหาก
    const sheetPrice = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.PRICES);
    const dataPrice = sheetPrice ? sheetPrice.getDataRange().getValues() : [];
    const priceMap = {};
    
    if (dataPrice.length > 1) {
       dataPrice.slice(1).forEach(r => {
          priceMap[r[0]] = r[1]; // Key=ชื่อวัตถุดิบ, Value=ราคา
       });
    }

    const materials = dataMat.slice(1).map(row => {
       let matName = row[0];
       return {
         id: matName,
         name: matName,
         stock: row[1], // คงเหลือ
         min: row[2],   // ขั้นต่ำ
         unit: row[3],  // หน่วยนับ
         price: priceMap[matName] || 0 // ใส่ราคาเข้าไปด้วย (ถ้าไม่มีให้เป็น 0)
       };
    });

    // 2. ดึงข้อมูลยาและวิตามิน (Vitamins)
    const sheetVit = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.VITAMINS);
    const dataVit = sheetVit.getDataRange().getValues();
    
    const vitamins = dataVit.slice(1).map(row => ({
       id: row[0],
       name: row[0],
       stock: row[1],
       unit: row[2],
       price: row[3] // ราคายาอยู่ในชีตตัวเอง (col index 3)
    }));

    // 3. ดึงสูตรอาหาร (Formulas) - ส่งไปทั้งตารางเลย เดี๋ยวไปจัดการหน้าบ้าน
    const sheetForm = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.FORMULAS);
    const formulas = sheetForm.getDataRange().getValues();

    // 4. ดึงสูตรยา/วิตามินเสริม (Supplements) - ส่งไปทั้งตารางเช่นกัน
    const sheetSupp = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.FORMULA_SUPPLEMENTS);
    const supplements = sheetSupp.getDataRange().getValues();


    return { materials, vitamins, formulas, supplements };

  } catch (e) {
    Logger.log("Error feed_getInitialData: " + e.toString());
    return { error: e.toString() };
  }
}

/*
 * ฟังก์ชันบันทึกการผสมอาหาร (Mixing)
 * - ตัดสต็อกวัตถุดิบ (Materials)
 * - ตัดสต็อกยา/วิตามิน (Vitamins)
 * - บันทึก Log การผสม
 * - ส่ง LINE Notify
 */
function feed_recordCustomMixing(data) {
  var lock = LockService.getScriptLock();
  try {
    // 🔒 ล็อกไม่ให้แย่งกันเขียน 10 วินาที
    lock.waitLock(10000); 

    const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
    const sheetMat = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.MATERIALS);
    const sheetVit = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.VITAMINS);
    const sheetLog = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.LOG_MIXING);

    // เตรียมข้อมูลราคากลาง (Materials)
    const sheetPrice = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.PRICES);
    const priceData = sheetPrice ? sheetPrice.getDataRange().getValues() : [];
    const priceMap = {};
    priceData.slice(1).forEach(r => priceMap[r[0]] = r[1]);

    const timestamp = new Date();
    const mixId = timestamp.getTime(); // ใช้เวลาเป็น ID อ้างอิงกลุ่ม

    let totalCostBatch = 0;
    let itemsLog = []; // เก็บรายการเพื่อไปทำ LINE Notify

    // 1. ตัดสต็อกวัตถุดิบ (Materials)
    if (data.materials && data.materials.length > 0) {
       const matData = sheetMat.getDataRange().getValues();
       
       data.materials.forEach(item => {
          // ค้นหาแถวของวัตถุดิบนี้
          for (let i = 1; i < matData.length; i++) {
             if (matData[i][0] == item.name) {
                // คำนวณสต็อกใหม่
                let currentStock = Number(matData[i][1]);
                let used = Number(item.used);
                let newStock = currentStock - used;
                
                // อัปเดตลง Sheet (Row i+1 เพราะ index เริ่ม 0)
                sheetMat.getRange(i + 1, 2).setValue(newStock); 

                // คำนวณต้นทุน
                let unitPrice = priceMap[item.name] || 0;
                let totalCost = used * unitPrice;
                totalCostBatch += totalCost;

                // บันทึก Log
                sheetLog.appendRow([
                   mixId, timestamp, data.formulaId, 
                   item.name, used, unitPrice, totalCost
                ]);
                
                itemsLog.push(`${item.name}: ${used} ${matData[i][3]}`); // เก็บหน่วยนับมาด้วย
                break;
             }
          }
       });
    }

    // 2. ตัดสต็อกยา/วิตามิน (Vitamins)
    if (data.vitamins && data.vitamins.length > 0) {
       const vitData = sheetVit.getDataRange().getValues();

       data.vitamins.forEach(item => {
          for (let i = 1; i < vitData.length; i++) {
             if (vitData[i][0] == item.name) {
                let currentStock = Number(vitData[i][1]);
                let used = Number(item.used);
                let newStock = currentStock - used;

                sheetVit.getRange(i + 1, 2).setValue(newStock);

                // ราคายาอยู่ใน Sheet ตัวเอง (Column 4 -> index 3)
                let unitPrice = Number(vitData[i][3]) || 0;
                let totalCost = used * unitPrice;
                totalCostBatch += totalCost;

                // บันทึก Log (ใส่ prefix [เสริม] ให้รู้ว่าเป็นยา)
                sheetLog.appendRow([
                   mixId, timestamp, data.formulaId, 
                   "[เสริม] " + item.name, used, unitPrice, totalCost
                ]);
                
                itemsLog.push(`[เสริม] ${item.name}: ${used} ${vitData[i][2]}`);
                break;
             }
          }
       });
    }

    // 3. ส่ง LINE Notify 🟢
    if (FEED_CONFIG.LINE_ACCESS_TOKEN && FEED_CONFIG.LINE_TARGET_ID) {
       let msg = `🥣 ผสมอาหาร: ${data.formulaId}\n`;
       msg += `🔢 จำนวน: ${data.qty} ชุด\n`;
       msg += `💰 ต้นทุนรวม: ${totalCostBatch.toLocaleString()} บาท\n`;
       msg += `👤 โดย: ${data.user || 'Admin'}`;
       // msg += `\n----------------\n` + itemsLog.join('\n'); // ถ้าอยากแสดงรายการย่อยให้เอา comment ออก

       feed_sendLineMessage(msg);
    }

    return { success: true };

  } catch (e) {
    Logger.log("Error recordMixing: " + e.toString());
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock(); // 🔓 ปลดล็อกเสมอ
  }
}

/*
 * ฟังก์ชันเบิกอาหารเข้าคอก (Dispense to Pen) - Feature ใหม่!
 * Input: { penNumber, batchId, formulaName, qty, user }
 */
function feed_dispenseToPen(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 

    const penNumber = data.penNumber;
    const batchId = data.batchId;
    const formulaName = data.formulaName;
    const qty = Number(data.qty);

    if (qty <= 0) return { success: false, message: "จำนวนต้องมากกว่า 0" };

    const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
    
    // ตรวจสอบก่อนว่า "สูตร" นี้ เป็น "สินค้าสำเร็จรูป" หรือ "สูตรผสม"
    const sheetMat = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.MATERIALS);
    const dataMat = sheetMat.getDataRange().getValues();
    
    let isFinishedGood = false;
    let finishedGoodRowIndex = -1;
    let currentStock = 0;
    let unitPrice = 0;

    // เช็คใน Material ว่ามีชื่อนี้ไหม (ถ้ามี แสดงว่าเป็นอาหารสำเร็จรูป เช่น "รำ", "อาหารหมูขุนสำเร็จ")
    for (let i = 1; i < dataMat.length; i++) {
       if (dataMat[i][0] == formulaName) {
          isFinishedGood = true;
          finishedGoodRowIndex = i + 1;
          currentStock = Number(dataMat[i][1]);
          // หาราคา
          const sheetPrice = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.PRICES);
          const dataPrice = sheetPrice ? sheetPrice.getDataRange().getValues() : [];
          dataPrice.forEach(r => { if(r[0] == formulaName) unitPrice = r[1]; });
          break;
       }
    }

    var itemsToDeduct = []; // รายการที่จะตัดสต็อก
    var totalCost = 0;
    var logDetail = "";

    // กรณี 1: เป็นสินค้าสำเร็จรูป (ตัดสต็อกตัวนั้นเลย)
    if (isFinishedGood) {
       if (currentStock < qty) return { success: false, message: "สต็อกไม่พอ (เหลือ " + currentStock + ")" };
       
       itemsToDeduct.push({
          sheet: 'MAT',
          rowIndex: finishedGoodRowIndex,
          current: currentStock,
          deduct: qty
       });
       totalCost = qty * unitPrice;
       logDetail = "เบิกโดยตรง (" + qty + " หน่วย)";
    } 
    // กรณี 2: เป็นสูตรผสม (ต้องไปตัดวัตถุดิบย่อยๆ)
    else {
      const sheetForm = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.FORMULAS);
      const dataForm = sheetForm.getDataRange().getValues();
      const headers = dataForm[0];
      
      let formulaRow = dataForm.find(r => r[0] == formulaName);
      if (!formulaRow) return { success: false, message: "ไม่พบสูตรหรือรายการ: " + formulaName };

      // ดึงราคากลางมาเตรียมไว้
      const sheetPrice = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.PRICES);
      const dataPrice = sheetPrice ? sheetPrice.getDataRange().getValues() : [];
      const priceMap = {};
      dataPrice.slice(1).forEach(r => priceMap[r[0]] = r[1]);

      // วนลูปหาวัตถุดิบในสูตร
      var errors = [];
      headers.forEach((header, index) => {
        if (index > 0) { // ข้ามคอลัมน์ชื่อสูตร
          let needPerSet = Number(formulaRow[index]);
          if (needPerSet > 0) {
             let matName = header;
             let needQty = needPerSet * qty;

             // หาวัตถุดิบในสต็อก
             let found = false;
             for (let m = 1; m < dataMat.length; m++) {
                if (dataMat[m][0] == matName) {
                   if (dataMat[m][1] < needQty) {
                      errors.push(matName + " (ขาด " + (needQty - dataMat[m][1]) + ")");
                   } else {
                      itemsToDeduct.push({
                         sheet: 'MAT',
                         rowIndex: m + 1,
                         current: Number(dataMat[m][1]),
                         deduct: needQty
                      });
                      
                      let p = priceMap[matName] || 0;
                      totalCost += (needQty * p);
                   }
                   found = true;
                   break;
                }
             }
             if (!found) errors.push(matName + " (ไม่พบในทะเบียนวัตถุดิบ)");
          }
        }
      });

      // วนลูปหาวิตามินในสูตร (ถ้ามี)
      const sheetSupp = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.FORMULA_SUPPLEMENTS);
      if (sheetSupp) {
        const dataSupp = sheetSupp.getDataRange().getValues();
        const headSupp = dataSupp[0];
        let suppRow = dataSupp.find(r => r[0] == formulaName);
        
        if (suppRow) {
           const sheetVit = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.VITAMINS);
           const dataVit = sheetVit.getDataRange().getValues();

           headSupp.forEach((h, idx) => {
             if (idx > 0) {
                let need = Number(suppRow[idx]);
                if (need > 0) {
                   let vitName = h;
                   let needQty = need * qty;
                   
                   for (let v=1; v < dataVit.length; v++) {
                      if (dataVit[v][0] == vitName) {
                         if (dataVit[v][1] < needQty) {
                            errors.push(vitName + " (ยาขาด " + (needQty - dataVit[v][1]) + ")");
                         } else {
                             // Vit logic ตัดสต็อกยา
                             // (ถ้าจะให้สมบูรณ์ต้องเพิ่ม logic ตัดยาด้วย แต่เบื้องต้นเอาแค่วัตถุดิบก่อนตามความต้องการหลัก)
                             // ในที่นี้ขอละไว้ก่อนเพื่อให้โค้ดไม่ซับซ้อนเกินไปสำหรับการเบิกเข้าคอก
                             // หรือถ้าจะตัดก็ทำคล้ายๆ MAT ข้างบน
                             
                             // *เพิ่ม Logic ตัดยา*
                             itemsToDeduct.push({
                                 sheet: 'VIT',
                                 rowIndex: v+1,
                                 current: Number(dataVit[v][1]),
                                 deduct: needQty,
                                 sheetObj: sheetVit // ฝาก obj ไป
                             });
                             
                             let p = Number(dataVit[v][3]) || 0;
                             totalCost += (needQty * p);
                         }
                         break;
                      }
                   }
                }
             }
           });
        }
      }

      if (errors.length > 0) return { success: false, message: "ของไม่พอ:\n" + errors.join("\n") };
      logDetail = "เบิกตามสูตร (" + qty + " ชุด)";
    }

    // 3. บันทึกและตัดสต็อกจริง (Execution) 📝
    itemsToDeduct.forEach(function(action) {
       var newStock = action.current - action.deduct;
       if (action.sheet == 'MAT') {
          sheetMat.getRange(action.rowIndex, 2).setValue(newStock);
       } else if (action.sheet == 'VIT') {
          action.sheetObj.getRange(action.rowIndex, 2).setValue(newStock);
       }
    });

    // 4. ลงบันทึก Log การเบิก
    var sheetLog = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.LOG_DISPENSE);
    if (sheetLog) {
      sheetLog.appendRow([
        new Date(), // Timestamp
        Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy"), // Date
        penNumber,
        batchId,
        formulaName,
        qty,
        totalCost,
        data.user || "Admin",
        logDetail
      ]);
    }

    // 5. แจ้งเตือน LINE Push 📲
    if (FEED_CONFIG.LINE_ACCESS_TOKEN && FEED_CONFIG.LINE_TARGET_ID) {
      var msg = "🚚 เบิกอาหารเข้าคอก " + penNumber + "\n" +
                "📦 รุ่น: " + batchId + "\n" +
                "🍲 รายการ: " + formulaName + " (" + qty + ")\n" +
                "💰 ต้นทุน: " + totalCost.toLocaleString() + " บ.";
      feed_sendLineMessage(msg);
    }

    return { success: true };

  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/*
 * ฟังก์ชันรับของเข้าสต็อก (Stock In)
 */
function feed_logStockIn(data) {
   var lock = LockService.getScriptLock();
   try {
     lock.waitLock(10000);
     const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
     const sheetLog = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.LOG_STOCK_IN);
     const sheetMat = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.MATERIALS);
     const sheetVit = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.VITAMINS);

     // 1. บันทึก Log รับเข้า (ตาม array row ที่ส่งมา)
     sheetLog.appendRow(data.row);

     // 2. เพิ่มสต็อก (Loop ตามรายการ)
     if (data.items && data.items.length > 0) {
        const matData = sheetMat.getDataRange().getValues();
        const vitData = sheetVit.getDataRange().getValues();

        data.items.forEach(item => {
           let found = false;
           // หาในวัตถุดิบ
           for (let i=1; i<matData.length; i++) {
              if (matData[i][0] == item.name) {
                 let cur = Number(matData[i][1]);
                 sheetMat.getRange(i+1, 2).setValue(cur + Number(item.qty));
                 found = true;
                 break;
              }
           }
           // ถ้าไม่เจอหาในยา
           if (!found) {
              for (let i=1; i<vitData.length; i++) {
                 if (vitData[i][0] == item.name) {
                    let cur = Number(vitData[i][1]);
                    sheetVit.getRange(i+1, 2).setValue(cur + Number(item.qty));
                    break;
                 }
              }
           }
        });
     }

     return { success: true };
   } catch (e) {
     return { success: false, message: e.toString() };
   } finally {
     lock.releaseLock();
   }
}


/*
 * ฟังก์ชันปรับสต็อก (Adjust Stock) - ของเสีย / ปรับยอด / ใช้เอง
 */
function feed_adjustStock(data) {
   // data = { itemName, amount, reason, user }
   // amount เป็นบวกเสมอ แต่ความหมายคือ "ตัดออก" ถ้าเป็นของเสีย
   // แต่ใน UI อาจจะส่งมาเป็น ลบ หรือ บวก แล้วแต่ logic
   // *สมมติ UI ส่งมาเป็นค่าที่ต้องเอาไป + หรือ - เลย*
   
   var lock = LockService.getScriptLock();
   try {
      lock.waitLock(10000);
      const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
      const sheetMat = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.MATERIALS);
      const sheetVit = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.VITAMINS);
      const sheetLog = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.LOG_ADJUST);

      const matData = sheetMat.getDataRange().getValues();
      const vitData = sheetVit.getDataRange().getValues();
      
      let found = false;
      let targetSheet = null;
      let targetRow = -1;
      let currentStock = 0;

      // ค้นหา
      for(let i=1; i<matData.length; i++) {
         if(matData[i][0] == data.itemName) {
            targetSheet = sheetMat; targetRow = i+1; currentStock = Number(matData[i][1]); found=true; break;
         }
      }
      if(!found) {
         for(let i=1; i<vitData.length; i++) {
            if(vitData[i][0] == data.itemName) {
               targetSheet = sheetVit; targetRow = i+1; currentStock = Number(vitData[i][1]); found=true; break;
            }
         }
      }

      if(found) {
         let adjustAmt = Number(data.amount); // UI ต้องส่งมาเป็น -5 หรือ +5
         let newStock = currentStock + adjustAmt;
         targetSheet.getRange(targetRow, 2).setValue(newStock);

         // Log
         sheetLog.appendRow([
            new Date(),
            data.itemName,
            adjustAmt,
            data.reason
         ]);
         
         return { success: true };
      } else {
         return { success: false, message: "ไม่พบรายการสินค้า" };
      }

   } catch (e) {
      return { success: false, message: e.toString() };
   } finally {
      lock.releaseLock();
   }
}

function feed_logEvent(data) {
  try {
    const ss = SpreadsheetApp.openById(FEED_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(FEED_CONFIG.SHEET_NAMES.LOG_EVENTS);
    sheet.appendRow([new Date(), data.event, data.imageUrl]);
    return { success: true };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function feed_getFullReportData() {
  // ฟังก์ชันดึงข้อมูลกราฟ (แบบย่อ)
  const data = feed_getInitialData(); // ใช้ data นี้ไปก่อน หรือเขียน query เพิ่มตามเดิม
  return { success: true }; // (Placeholder)
}


// --- Helper: Send LINE ---
function feed_sendLineMessage(message) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + FEED_CONFIG.LINE_ACCESS_TOKEN
      },
      'method': 'post',
      'payload': JSON.stringify({
        to: FEED_CONFIG.LINE_TARGET_ID,
        messages: [{ type: 'text', text: message }]
      })
    });
  } catch (e) {
    Logger.log("Line Error: " + e);
  }
}
