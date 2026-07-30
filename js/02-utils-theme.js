/* ===================== 02-utils-theme.js =====================
   Pomocné funkcie (dátumy, peniaze, telefón/WhatsApp), prepínanie témy, ukladanie/načítanie dát.
   ===================================================== */

function applyTheme(theme){
  document.body.classList.toggle('theme-elegant', theme==='elegant');
  document.body.classList.toggle('theme-vibrant', theme==='vibrant');
  const btn = document.getElementById('themeToggleBtn');
  if(btn) btn.textContent = THEME_NEXT_LABEL[theme] || THEME_NEXT_LABEL.film;
}
function toggleTheme(){
  const current = localStorage.getItem('slate:theme') || 'film';
  const idx = THEME_CYCLE.indexOf(current);
  const next = THEME_CYCLE[(idx+1) % THEME_CYCLE.length];
  localStorage.setItem('slate:theme', next);
  applyTheme(next);
}
// IMPORTANT: use this instead of date.toISOString().slice(0,10) for calendar-day values.
// toISOString() converts to UTC first, which shifts the date by one day in timezones ahead of UTC
// (e.g. Slovakia) whenever local time is past midnight but before the UTC day rolls over.
function toLocalISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
var toastActionFn = null;
function showToast(msg, actionLabel, actionFn){
  const t=document.getElementById('toast');
  toastActionFn = actionFn || null;
  t.innerHTML = actionLabel
    ? `<span>${escapeHtml(msg)}</span> <button class="toast-action-btn" onclick="if(toastActionFn) toastActionFn(); document.getElementById('toast').classList.remove('show');">${escapeHtml(actionLabel)}</button>`
    : escapeHtml(msg);
  t.classList.add('show');
  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(()=>t.classList.remove('show'), actionLabel ? 5000 : 1800);
}
function fmtMoney(n){ return (Number(n)||0).toLocaleString('sk-SK')+' €'; }
function normalizePhoneForWhatsapp(phone){
  if(!phone) return '';
  let digits = phone.replace(/[^\d+]/g, '');
  if(digits.startsWith('+')) digits = digits.slice(1);
  if(digits.startsWith('00')) digits = digits.slice(2);
  if(digits.startsWith('0')) digits = '421' + digits.slice(1); // Slovak local format 0xxx -> 421xxx
  return digits;
}
function whatsappLink(phone, message){
  const number = normalizePhoneForWhatsapp(phone);
  if(!number) return '';
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
function openWhatsapp(phone, message){
  if(!phone){ showToast('Klient nemá uložené telefónne číslo'); return; }
  const link = whatsappLink(phone, message||'');
  if(!link){ showToast('Telefónne číslo sa nepodarilo rozpoznať'); return; }
  window.open(link, '_blank');
}
function fmtDate(d){
  if(!d) return '—';
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function weeksSinceLabel(dateStr){
  if(!dateStr) return '';
  const then = new Date(dateStr+'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - then) / (1000*60*60*24));
  if(diffDays < 0) return '';
  const weeks = Math.floor(diffDays / 7);
  if(weeks === 0) return diffDays===0 ? 'dnes' : (diffDays===1 ? 'pred 1 dňom' : `pred ${diffDays} dňami`);
  return weeks === 1 ? 'pred 1 týždňom' : `pred ${weeks} týždňami`;
}

/* ===================== STORAGE ===================== */
async function loadKey(key, fallback){
  try{
    const raw = localStorage.getItem('slate:'+key);
    if(raw !== null){ return JSON.parse(raw); }
    return fallback;
  }catch(e){ return fallback; }
}
async function saveKey(key, value){
  try{ localStorage.setItem('slate:'+key, JSON.stringify(value)); }
  catch(e){ showToast('Chyba pri ukladaní dát (možno je pamäť prehliadača plná)'); }
  writeAutoBackup();
}
async function loadAll(){
  DATA.clients = await loadKey('clients', []);
  DATA.bookings = await loadKey('bookings', []);
  migrateBookingStatuses();
  DATA.projects = await loadKey('projects', []);
  migrateProjectStatuses();
  DATA.invoices = await loadKey('invoices', []);
  DATA.expenses = await loadKey('expenses', []);
  DATA.vendors = await loadKey('vendors', []);
  DATA.trash = await loadKey('trash', []);
  DATA.quickNotes = await loadKey('quickNotes', []);
  purgeOldTrash();
  const savedSettings = await loadKey('settings', {});
  DATA.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
  const savedPricing = await loadKey('pricing', {});
  PRICING = Object.assign({}, DEFAULT_PRICING, savedPricing);
  if(!PRICING.balicky || !PRICING.balicky.length) PRICING.balicky = DEFAULT_PRICING.balicky;
  if(!PRICING.priplatky) PRICING.priplatky = [];
  if(!PRICING.yearPrices) PRICING.yearPrices = {};
  document.getElementById('companyNameInput').value = DATA.settings.companyName;
  fillSettingsForm();
  fillPricingForm();
  populateVendorDatalists();
  renderAll();
}
