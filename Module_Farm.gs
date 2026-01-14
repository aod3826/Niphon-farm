/* ==========================================================================
   📂 FILE: Module_Farm.gs
   คำอธิบาย: Logic ระบบฟาร์ม (แม่พันธุ์, หมูขุน, อาหาร)
   ========================================================================== */

// --- 1. DASHBOARD & STATS (ตัวที่ Error อยู่ตอนนี้) ---
function Farm_Service_GetStats() {
  let stats = { sow: 0, fatten: 0, feed: "ปกติ" };
  try {
    // นับแม่พันธุ์
    const sowList = DB_Select(CONFIG.DB.SOW_LIST.NAME, CONFIG.DB.SOW_LIST.COL);
    stats.sow = sowList.length;

    // นับหมูขุน (รวมยอดคงเหลือ เฉพาะคอกที่ใช้งาน)
    const fatList = DB_Select(CONFIG.DB.FAT_PEN.NAME, CONFIG.DB.FAT_PEN.COL);
    // แปลงค่า AMT เป็นตัวเลขก่อนบวก
    stats.fatten = fatList.reduce((sum, r) => {
      return r.STATUS === 'ใช้งาน' ? sum + (Number(r.AMT) || 0) : sum;
    }, 0);

    // มูลค่าอาหารคงคลัง (ดึงจากชีตภาพรวม หรือ คำนวณสด)
    // เบื้องต้นให้เช็คสถานะสต็อกก่อน
    const feedList = DB_Select(CONFIG.DB.FEED_STOCK.NAME, CONFIG.DB.FEED_STOCK.COL);
    const isLow = feedList.some(r => (Number(r.QTY)||0) < (Number(r.MIN)||0));
    stats.feed = isLow ? "สั่งซื้อด่วน" : "ปกติ";
    
  } catch(e) { 
    console.error("Error getting stats: " + e.toString()); 
  }
  return stats;
}

// --- 2. SOW SYSTEM (แม่พันธุ์) ---
function Farm_Service_GetSowList() {
  const c = CONFIG.DB.SOW_LIST;
  return DB_Select(c.NAME, c.COL).map(r => ({
    id: r.ID,
    earTag: r.EAR,
    breed: r.BREED,
    cycle: r.CYCLE || 0,
    status: r.STATUS_SYS || r.STATUS_USER,
    img: r.IMG || '',
    lastUpdate: r.UPDATE || UTILS_DateNow()
  }));
}

// --- 3. FATTEN SYSTEM (หมูขุน) ---
function Farm_Service_GetFattenPens() {
  const c = CONFIG.DB.FAT_PEN;
  return DB_Select(c.NAME, c.COL).map(r => ({
    pen: r.ID,
    status: r.STATUS,
    batch: r.BATCH,
    count: r.AMT || 0,
    food: r.FOOD
  }));
}

function Farm_Service_GetSales() {
  const c = CONFIG.DB.FAT_SALE;
  return DB_Select(c.NAME, c.COL).map(r => ({
    date: r.DATE,
    buyer: r.BUYER,
    qty: r.QTY,
    weight: r.WEIGHT,
    total: r.TOTAL,
    pdf: r.PDF || ''
  })).reverse().slice(0, 20); // เอา 20 รายการล่าสุด
}

// --- 4. FEED SYSTEM (อาหาร) ---
function Farm_Service_GetStock() {
  let list = [];
  
  // วัตถุดิบ
  const f = CONFIG.DB.FEED_STOCK;
  DB_Select(f.NAME, f.COL).forEach(r => {
    const qty = Number(r.QTY) || 0;
    const min = Number(r.MIN) || 0;
    list.push({ name: r.NAME, qty: qty, unit: r.UNIT, type: 'feed', status: qty < min ? 'low' : 'ok' });
  });

  // ยา
  const m = CONFIG.DB.FEED_MED;
  DB_Select(m.NAME, m.COL).forEach(r => {
    const qty = Number(r.QTY) || 0;
    const min = Number(r.MIN) || 0;
    list.push({ name: r.NAME, qty: qty, unit: r.UNIT, type: 'med', status: qty < min ? 'low' : 'ok' });
  });

  return list;
}

// --- 5. QR CODE ---
function Farm_Service_GetQR() {
  const c = CONFIG.DB.QR_CODE;
  return DB_Select(c.NAME, c.COL).map(r => ({
    name: r.NAME,
    link: r.LINK,
    qr: `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(r.LINK)}`
  }));
}
