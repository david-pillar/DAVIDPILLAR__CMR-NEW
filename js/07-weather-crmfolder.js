/* ===================== 07-weather-crmfolder.js =====================
   Predpoveď počasia, QR platba, harmonogram dňa, prepojenie priečinka na disku.
   ===================================================== */

var WEATHER_CODE_MAP = {
  0:'☀️ jasno', 1:'🌤️ prevažne jasno', 2:'⛅ polooblačno', 3:'☁️ zamračené',
  45:'🌫️ hmla', 48:'🌫️ hmla (námraza)',
  51:'🌦️ slabé mrholenie', 53:'🌦️ mrholenie', 55:'🌧️ silné mrholenie',
  61:'🌦️ slabý dážď', 63:'🌧️ dážď', 65:'🌧️ silný dážď',
  71:'🌨️ slabé sneženie', 73:'🌨️ sneženie', 75:'❄️ silné sneženie',
  80:'🌦️ prehánky', 81:'🌧️ prehánky', 82:'⛈️ silné prehánky',
  95:'⛈️ búrka', 96:'⛈️ búrka s krúpami', 99:'⛈️ silná búrka s krúpami'
};
function weatherCodeToLabel(code){ return WEATHER_CODE_MAP[code] || '❓ neznáme'; }
function weatherCodeToEmoji(code){
  const label = WEATHER_CODE_MAP[code] || '❓';
  return label.split(' ')[0]; // WEATHER_CODE_MAP values are "emoji slovo" — just the emoji for compact display
}
// Open-Meteo vracia sunrise/sunset ako "2026-08-01T05:52" — vytiahne len čas "05:52".
function fmtHM(isoDateTime){
  if(!isoDateTime) return '';
  const parts = isoDateTime.split('T');
  return parts.length>1 ? parts[1] : isoDateTime;
}
var weatherCache = {}; // { 'YYYY-MM-DD': { code, tmax, tmin, pop } } — used to show a small weather icon directly in the calendar cell.
// Miesto konania podľa typu zákazky — svadba a stužková majú svoje vlastné polia (miesto hostiny/kostol,
// resp. miesto), inak (aj pre klip/iné) sa použije všeobecné pole "location" zo zákazky.
function getProjectWeatherLocation(p){
  if(p.type==='svadba' && p.wedding && (p.wedding.svadbaMiesto || p.wedding.sobasKostol)) return p.wedding.svadbaMiesto || p.wedding.sobasKostol;
  if(p.type==='stuzkova' && p.stuzkova && p.stuzkova.miesto) return p.stuzkova.miesto;
  return p.location || '';
}
// Búrka/silný dážď/sneženie/krúpy — kódy, pri ktorých má zmysel vizuálne upozorniť.
var WEATHER_WARNING_CODES = new Set([65,75,82,95,96,99]);
function isWeatherRisky(code, pop){
  return WEATHER_WARNING_CODES.has(code) || (typeof pop === 'number' && pop >= 60);
}
// Open-Meteo geokódovanie pozná len skutočné obce/mestá, nie názvy sál/hotelov (napr. "Sála Rasľavice"
// alebo "Hotel Šariš Bardejov"). Preto skúša najprv celý reťazec a pri neúspechu postupne odsekáva
// slová zľava — obec/mesto je v takýchto názvoch takmer vždy na konci.
async function geocodeLocation(location){
  const words = location.trim().split(/\s+/).filter(Boolean);
  for(let i=0; i<words.length; i++){
    const candidate = words.slice(i).join(' ');
    try{
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=sk`);
      const geoData = await geoRes.json();
      if(geoData.results && geoData.results.length) return geoData.results[0];
    }catch(e){ /* skús ďalší kandidát */ }
  }
  return null;
}
async function loadWeatherForecasts(){
  const container = document.getElementById('weatherForecastList');
  const todayStr = toLocalISODate(new Date());
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()+16);
  const cutoffStr = toLocalISODate(cutoff);

  const upcoming = DATA.projects.filter(p=>
    p.deadline && p.deadline>=todayStr && p.deadline<=cutoffStr && getProjectWeatherLocation(p)
  );

  const weatherPanel = document.getElementById('weatherPanel');
  if(!upcoming.length){
    container.innerHTML = '<div class="empty">Žiadne zákazky s vyplneným miestom konania v najbližších 16 dňoch.</div>';
    if(weatherPanel) weatherPanel.classList.remove('panel-attention');
    return;
  }
  container.innerHTML = '<div class="empty">Načítavam predpoveď…</div>';

  const results = [];
  for(const p of upcoming){
    const location = getProjectWeatherLocation(p);
    try{
      const geoResult = await geocodeLocation(location);
      if(!geoResult){ results.push({ p, location, error:true }); continue; }
      const { latitude, longitude, name } = geoResult;
      const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&hourly=temperature_2m,weathercode,precipitation_probability&timezone=auto&start_date=${p.deadline}&end_date=${p.deadline}`);
      const forecastData = await forecastRes.json();
      if(!forecastData.daily || !forecastData.daily.time || !forecastData.daily.time.length){ results.push({ p, location, error:true }); continue; }
      const pop = forecastData.daily.precipitation_probability_max ? forecastData.daily.precipitation_probability_max[0] : null;
      const sunrise = forecastData.daily.sunrise ? forecastData.daily.sunrise[0] : null;
      const sunset = forecastData.daily.sunset ? forecastData.daily.sunset[0] : null;
      // Krátky výber hodín cez deň (namiesto celých 24) — dosť na predstavu o priebehu,
      // stále sa to zmestí do jedného kompaktného riadku na dashboarde.
      const HOURS_TO_SHOW = [8,12,16,20];
      let hourlySlots = [];
      if(forecastData.hourly && forecastData.hourly.time){
        hourlySlots = HOURS_TO_SHOW.map(h=>{
          const idx = forecastData.hourly.time.findIndex(t=>t.endsWith(`T${String(h).padStart(2,'0')}:00`));
          if(idx<0) return null;
          return {
            hour: h,
            temp: forecastData.hourly.temperature_2m[idx],
            code: forecastData.hourly.weathercode[idx],
            pop: forecastData.hourly.precipitation_probability ? forecastData.hourly.precipitation_probability[idx] : null
          };
        }).filter(Boolean);
      }
      const dayResult = {
        p, location: name || location,
        code: forecastData.daily.weathercode[0],
        tmax: forecastData.daily.temperature_2m_max[0],
        tmin: forecastData.daily.temperature_2m_min[0],
        pop, sunrise, sunset, hourlySlots
      };
      results.push(dayResult);
      weatherCache[p.deadline] = { code: dayResult.code, tmax: dayResult.tmax, tmin: dayResult.tmin, pop };
    }catch(e){
      results.push({ p, location, error:true });
    }
  }

  container.innerHTML = results.map(r=>{
    if(r.error){
      return `<div class="weather-item"><div class="weather-top"><div class="row-main"><div class="row-title">${escapeHtml(r.p.title)}</div><div class="row-sub">${fmtDate(r.p.deadline)} · ${escapeHtml(r.location)}</div></div><span class="row-sub">Predpoveď nedostupná</span></div></div>`;
    }
    const risky = isWeatherRisky(r.code, r.pop);
    const popLabel = (typeof r.pop === 'number') ? ` · 💧 ${Math.round(r.pop)}%` : '';
    const sunLine = (r.sunrise && r.sunset) ? `<div class="weather-sun">🌅 východ ${fmtHM(r.sunrise)} · 🌇 západ ${fmtHM(r.sunset)}</div>` : '';
    const hourlyHtml = (r.hourlySlots && r.hourlySlots.length) ? `<div class="weather-hourly">${r.hourlySlots.map(h=>{
      const hRisky = isWeatherRisky(h.code, h.pop);
      return `<div class="weather-hour${hRisky?' weather-hour-warn':''}" title="${weatherCodeToLabel(h.code)}${typeof h.pop==='number'?' · 💧'+Math.round(h.pop)+'%':''}">
        <div class="weather-hour-time">${String(h.hour).padStart(2,'0')}:00</div>
        <div class="weather-hour-emoji">${weatherCodeToEmoji(h.code)}</div>
        <div class="weather-hour-temp">${Math.round(h.temp)}°</div>
      </div>`;
    }).join('')}</div>` : '';
    return `<div class="weather-item${risky ? ' weather-item-warn' : ''}">
      <div class="weather-top">
        <div class="row-main"><div class="row-title">${escapeHtml(r.p.title)}</div><div class="row-sub">${fmtDate(r.p.deadline)} · ${escapeHtml(r.location)}</div></div>
        <span class="row-sub"${risky ? ' style="color:#c62828;font-weight:600;"' : ''}>${risky ? '⚠️ ' : ''}${weatherCodeToLabel(r.code)} · ${Math.round(r.tmin)}–${Math.round(r.tmax)}°C${popLabel}</span>
      </div>
      ${sunLine}
      ${hourlyHtml}
    </div>`;
  }).join('');
  // Zvýrazni dlaždicu na dashboarde (rovnaký "panel-attention" štýl ako pri chýbajúcich správach),
  // keď máme aspoň jednu reálne stiahnutú predpoveď — inak sa počasie ľahko stratí medzi ostatnými dlaždicami.
  if(weatherPanel) weatherPanel.classList.toggle('panel-attention', results.some(r=>!r.error));
  renderCalendar(); // pick up any newly cached weather icons for the currently viewed month
}

async function generateInvoiceQR(){
  const iban = (DATA.settings.iban || '').replace(/\s/g,'');
  if(!iban){ showToast('Najprv vyplň IBAN v Nastaveniach'); return; }
  const amount = Number(document.getElementById('iv-amount').value);
  if(!amount || amount<=0){ showToast('Zadaj sumu faktúry'); return; }
  const number = document.getElementById('iv-number').value.trim();
  const variableSymbol = (number.match(/\d+/g) || []).join('').slice(-10) || '';
  const container = document.getElementById('iv-qr-container');
  container.style.display = 'block';
  container.innerHTML = '<div class="empty" style="color:#666;">Generujem QR kód…</div>';
  try{
    const { encode, PaymentOptions, CurrencyCode } = await import('https://esm.sh/bysquare@4/pay');
    const qrstring = encode({
      payments: [{
        type: PaymentOptions.PaymentOrder,
        amount,
        variableSymbol,
        currencyCode: CurrencyCode.EUR,
        paymentNote: `Faktura ${number || ''}`.trim(),
        beneficiary: { name: DATA.settings.companyName || '' },
        bankAccounts: [{ iban }]
      }]
    });
    const { QRCode } = await import('https://esm.sh/@lostinbrittany/qr-esm@latest');
    const svg = QRCode.generateSVG(qrstring);
    svg.style.width = '220px';
    svg.style.height = '220px';
    container.innerHTML = '';
    container.appendChild(svg);
    const caption = document.createElement('div');
    caption.style.cssText = 'color:#333;font-size:12px;margin-top:8px;';
    caption.textContent = `${fmtMoney(amount)} · VS: ${variableSymbol || '—'}`;
    container.appendChild(caption);
  }catch(e){
    container.innerHTML = '<div class="empty" style="color:#a33;">Nepodarilo sa vygenerovať QR kód — over internetové pripojenie a skús znova.</div>';
  }
}

/* ---- Day-of wedding schedule PDF (auto-computed from ceremony time) ---- */
function shiftTime(hhmm, deltaMinutes){
  if(!hhmm) return '';
  const [h,m] = hhmm.split(':').map(Number);
  let total = h*60 + m + deltaMinutes;
  total = ((total % 1440) + 1440) % 1440; // wrap around midnight safely
  const nh = Math.floor(total/60), nm = total%60;
  return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
}
async function generateDaySchedulePDF(){
  const id = document.getElementById('pr-id').value;
  const project = DATA.projects.find(p=>p.id===id);
  if(!project){ showToast('Najprv zákazku ulož, potom vygeneruj harmonogram'); return; }
  const w = project.wedding || {};
  const client = DATA.clients.find(c=>c.id===project.clientId);
  const s = DATA.settings;
  const sobasCas = w.sobasCas || '';
  const map = {
    '{{nazov_zakazky}}': project.title || '',
    '{{termin}}': project.deadline ? fmtDate(project.deadline) : 'dohodou',
    '{{nevesta}}': w.nevestaMeno || (client ? client.name : '—'),
    '{{zenich}}': w.zenichMeno || '—',
    '{{sobas_cas}}': sobasCas || 'dohodou',
    '{{sobas_kostol}}': w.sobasKostol || '—',
    '{{svadba_miesto}}': w.svadbaMiesto || '—',
    '{{hudba}}': w.hudbaMeno || '—',
    '{{fotograf}}': w.fotograf || '—',
    '{{cas_prichodu}}': sobasCas ? shiftTime(sobasCas, -60) : 'dohodou',
    '{{cas_prijmu}}': sobasCas ? shiftTime(sobasCas, 90) : 'dohodou',
    '{{special_priania}}': w.specialWishes || '—'
  };
  let text = s.dayScheduleTemplate || DEFAULT_SETTINGS.dayScheduleTemplate;
  Object.keys(map).forEach(k=>{ text = text.split(k).join(map[k]); });

  if(!window.jspdf){ showToast('PDF knižnica sa ešte načítava, skús o chvíľu znova'); return; }
  const doc = renderTextToPdf(text);
  const filename = `harmonogram-${sanitizeName(project.title)}.pdf`;
  await saveDocSmart(doc, filename, (project.folderName || project.title));
}

/* ---- CRM folder (organized per-zákazka storage, Chrome/Edge only) ---- */
var crmFolderHandle = null;

async function initCrmFolder(){
  const supported = 'showDirectoryPicker' in window;
  document.getElementById('crmFolderSupported').style.display = supported ? 'block' : 'none';
  document.getElementById('crmFolderUnsupported').style.display = supported ? 'none' : 'block';
  if(!supported) return;
  try{
    const handle = await idbGet('crmFolderHandle');
    if(handle){
      crmFolderHandle = handle;
      const perm = await handle.queryPermission({mode:'readwrite'});
      updateCrmFolderStatusUI(perm);
    }else{
      updateCrmFolderStatusUI(null);
    }
  }catch(e){ updateCrmFolderStatusUI(null); }
}
function updateCrmFolderStatusUI(permState){
  const statusEl = document.getElementById('crmFolderStatus');
  const grantBtn = document.getElementById('grantFolderAccessBtn');
  const disableBtn = document.getElementById('disableCrmFolderBtn');
  if(!statusEl) return;
  if(!crmFolderHandle){
    statusEl.textContent = 'Nenastavené';
    statusEl.style.color = 'var(--text-dim)';
    grantBtn.style.display = 'none';
    disableBtn.style.display = 'none';
    return;
  }
  disableBtn.style.display = 'inline-flex';
  if(permState === 'granted'){
    statusEl.textContent = '✓ Aktívne → ' + (crmFolderHandle.name || 'priečinok');
    statusEl.style.color = 'var(--green-page)';
    grantBtn.style.display = 'none';
  }else{
    statusEl.textContent = 'Treba znova povoliť prístup';
    statusEl.style.color = 'var(--yellow-page)';
    grantBtn.style.display = 'inline-flex';
  }
}
async function pickCrmFolder(){
  try{
    const handle = await window.showDirectoryPicker({ mode:'readwrite' });
    crmFolderHandle = handle;
    await idbSet('crmFolderHandle', handle);
    updateCrmFolderStatusUI('granted');
    showToast('CRM priečinok nastavený ✓');
  }catch(e){
    if(e.name !== 'AbortError') showToast('Nepodarilo sa nastaviť priečinok');
  }
}
async function grantCrmFolderAccess(){
  if(!crmFolderHandle) return;
  try{
    const perm = await crmFolderHandle.requestPermission({mode:'readwrite'});
    updateCrmFolderStatusUI(perm);
    if(perm === 'granted') showToast('Prístup povolený');
  }catch(e){ showToast('Prístup sa nepodarilo obnoviť'); }
}
async function disableCrmFolder(){
  crmFolderHandle = null;
  try{ await idbSet('crmFolderHandle', null); }catch(e){}
  updateCrmFolderStatusUI(null);
  showToast('CRM priečinok vypnutý');
}

/* ===================== NAV ===================== */
document.getElementById('nav').addEventListener('click', (e)=>{
  const item = e.target.closest('.nav-item');
  if(!item) return;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  item.classList.add('active');
  const view = item.dataset.view;
  currentView = view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  renderAll();
  if(view==='pricing') renderPricingCharts();
  if(view==='hours') renderHours();
  if(view==='expenses') renderExpenses();
  if(view==='vendors') renderVendors();
  if(view==='trash') renderTrash();
});

document.getElementById('companyNameInput').addEventListener('change', (e)=>{
  DATA.settings.companyName = e.target.value || 'Moja produkcia';
  saveKey('settings', DATA.settings);
  const setField = document.getElementById('set-companyName');
  if(setField) setField.value = DATA.settings.companyName;
});

/* ===================== RENDER: DASHBOARD ===================== */
