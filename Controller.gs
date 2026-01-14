/* 📂 FILE: Controller.gs */

function doGet(e) {
  var params = e.parameter || {};
  var page = params.page || 'home'; 
  var html;

  // 🔥 จุดแก้สำคัญ: สั่งให้เปิดไฟล์ HTML แยกกันตามชื่อ page
  switch (page) {
    case 'sow':    
      html = HtmlService.createTemplateFromFile('Sow_Index'); 
      break;
    case 'fatten': 
      html = HtmlService.createTemplateFromFile('Fatten_Index'); 
      if (params.pen) html.startPen = params.pen; else html.startPen = ""; // กัน Error
      break;
    case 'feed':   
      html = HtmlService.createTemplateFromFile('Feed_Index'); 
      break;
    case 'home':
    default:       
      html = HtmlService.createTemplateFromFile('Index'); 
      break;
  }

  // ส่งตัวแปร URL ไปให้ทุกหน้า เพื่อให้กดลิงก์ไปมาหากันได้
  html.appUrl = ScriptApp.getService().getUrl();

  return html.evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle(CONFIG.APP_NAME);
}

// ... (ส่วนฟังก์ชัน API ด้านล่างปล่อยไว้เหมือนเดิมครับ) ...



// 1. กลุ่ม HR Module
function auth_checkLogin(id, pass) { return HR_Service_Login(id, pass); }
function hr_submitTimeLog(data) { return HR_Service_SubmitTime(data); }
function user_getData(id) { return HR_Service_GetMyData(id); }
function hr_getPendingRequests() { return HR_Service_GetPending(); }
function hr_processRequest(data) { return HR_Service_ProcessRequest(data); }
function hr_submitRequest(form) { return {success:true}; /* รอทำต่อ */ } 
function hr_uploadDocument(form) { return {success:true}; /* รอทำต่อ */ }
function hr_registerUser(form) { return {success:true, message:"ระบบยังไม่เปิดรับสมัคร"}; /* รอทำต่อ */ }
function auth_loginByPin(pin) { return HR_Service_LoginByPIN(pin); }
function hr_registerUser(form) { return HR_Service_Register(form); }

// 2. กลุ่ม Farm Module (เพิ่มเข้ามาแล้ว! 🔥)
function main_getGlobalStats() { return Farm_Service_GetStats(); }
function farm_getSowList() { return Farm_Service_GetSowList(); }
function farm_getFattenPens() { return Farm_Service_GetFattenPens(); }
function farm_getFeedStock() { return Farm_Service_GetStock(); }
function farm_getSalesHistory() { return Farm_Service_GetSales(); }
function farm_getQrCodes() { return Farm_Service_GetQR(); }

// 3. Utilities
function main_getWeatherUpdate() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.LOCATION.LAT}&longitude=${CONFIG.LOCATION.LNG}&current_weather=true&timezone=Asia%2FBangkok`;
    const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
    const code = res.current_weather.weathercode;
    let icon = "☀️"; if(code > 3) icon = "☁️"; if(code > 50) icon = "🌧️";
    return { success: true, temp: res.current_weather.temperature, icon: icon };
  } catch(e) { return { success: false }; }
}
