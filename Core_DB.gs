/* ==========================================================================
   📂 FILE: Core_DB.gs
   คำอธิบาย: เครื่องมือกลางสำหรับ อ่าน/เขียน Google Sheets
   ========================================================================== */

/**
 * ดึงข้อมูลจากชีต และแปลงเป็น Array of Objects (JSON)
 */
function DB_Select(sheetName, colMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    console.error("❌ ไม่พบชีต: " + sheetName);
    return [];
  }

  // ใช้ getDisplayValues เพื่อให้ได้ค่าที่เห็นตามตา (เช่น วันที่)
  const range = sheet.getDataRange();
  if (range.getNumRows() < 2) return []; // ถ้ามีแค่หัวข้อ ไม่มีข้อมูล

  const data = range.getDisplayValues(); 
  const headers = data[0]; // แถวแรกคือหัวข้อ
  const rows = data.slice(1); // แถวที่เหลือคือข้อมูล

  // สร้างแผนที่ว่าคอลัมน์ไหน อยู่ index ที่เท่าไหร่
  let idxMap = {};
  for (let key in colMap) {
    let colName = colMap[key];
    let index = headers.indexOf(colName);
    idxMap[key] = index;
  }

  // แปลงข้อมูลแต่ละแถว เป็น Object
  return rows.map(row => {
    let obj = {};
    for (let key in idxMap) {
      if (idxMap[key] !== -1) {
        obj[key] = row[idxMap[key]];
      }
    }
    return obj;
  }).filter(o => o); // return ข้อมูลกลับไป
}

/**
 * เพิ่มข้อมูลลงชีต (Insert)
 */
function DB_Insert(sheetName, colMap, dataObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let newRow = [];

  // วนลูปตามหัวข้อในชีต เพื่อหยอดข้อมูลให้ตรงช่อง
  headers.forEach(header => {
    let foundKey = Object.keys(colMap).find(key => colMap[key] === header);
    if (foundKey && dataObj[foundKey] !== undefined) {
      newRow.push(dataObj[foundKey]);
    } else {
      newRow.push(""); 
    }
  });

  sheet.appendRow(newRow);
  return true;
}

// --- แถม Utility ให้ด้วย (เผื่อไฟล์อื่นเรียกใช้) ---
function UTILS_DateNow() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
}

function UTILS_GetDistance(lat1, lon1, lat2, lon2) {
  var R = 6371e3; 
  var φ1 = lat1 * Math.PI/180;
  var φ2 = lat2 * Math.PI/180;
  var Δφ = (lat2-lat1) * Math.PI/180;
  var Δλ = (lon2-lon1) * Math.PI/180;
  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * แก้ไขข้อมูลในชีต (Update)
 * @param {string} sheetName ชื่อชีต
 * @param {object} colMap แผนที่คอลัมน์
 * @param {string} keyColName ชื่อคอลัมน์ที่จะใช้ค้นหา (เช่น "รหัสรายการ")
 * @param {string} keyValue ค่าที่ต้องการค้นหา (เช่น "LEV-1234")
 * @param {object} updateData ข้อมูลที่ต้องการแก้ { KEY: VALUE }
 */
function DB_Update(sheetName, colMap, keyColName, keyValue, updateData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  
  // หา Index ของคอลัมน์ Key
  const keyIndex = headers.indexOf(keyColName);
  if (keyIndex === -1) return false;

  // วนหาแถวที่ตรงกับ keyValue
  // เริ่มที่ i=1 เพราะแถว 0 คือ Header
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      // เจอแถวแล้ว! อัปเดตข้อมูลตาม updateData
      for (let key in updateData) {
        let colName = colMap[key];
        let colIndex = headers.indexOf(colName);
        if (colIndex !== -1) {
          // +1 เพราะ getRange นับเริ่มที่ 1
          sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
        }
      }
      return true; // จบงาน
    }
  }
  return false; // หาไม่เจอ
}

/**
 * แก้ไขข้อมูลในชีต (Update) 
 * จำเป็นมากสำหรับระบบอนุมัติ!
 */
function DB_Update(sheetName, colMap, keyColName, keyValue, updateData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  // ดึงข้อมูลทั้งหมดมาดู (ใช้ getDisplayValues เพื่อความชัวร์เรื่อง Format)
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0]; // แถวหัวข้อ
  
  // หาว่าคอลัมน์ Key (เช่น ID) อยู่คอลัมน์ที่เท่าไหร่
  const keyIndex = headers.indexOf(keyColName);
  if (keyIndex === -1) {
    console.error("❌ ไม่พบคอลัมน์ Key: " + keyColName);
    return false;
  }

  // วนลูปหาแถวที่ตรงกับ ID ที่ส่งมา
  for (let i = 1; i < data.length; i++) {
    // เปรียบเทียบแบบ String เพื่อความชัวร์
    if (String(data[i][keyIndex]) === String(keyValue)) {
      
      // เจอแถวแล้ว! ทำการอัปเดตเฉพาะคอลัมน์ที่ส่งมา
      for (let key in updateData) {
        let colName = colMap[key];
        let colIndex = headers.indexOf(colName);
        if (colIndex !== -1) {
          // sheet.getRange(row, col) -> เริ่มนับที่ 1
          // i คือ index ของ array (เริ่ม 0) ดังนั้นแถวในชีตคือ i + 1
          sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
        }
      }
      return true; // จบงาน สำเร็จ
    }
  }
  
  console.warn("⚠️ หา ID ไม่เจอ: " + keyValue);
  return false; // หาไม่เจอ
}
