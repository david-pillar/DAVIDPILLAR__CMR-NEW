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
// Bezpečný wrapper pre tlačidlá vykresľované cez innerHTML: do onclick sa vkladá
// len interné client.id (bezpečný reťazec z uid()), nikdy nie surové telefónne
// číslo, ktoré by sa dalo zneužiť na XSS (viď 10-clients-projects-list.js).
function openWhatsappForClient(clientId){
  const client = DATA.clients.find(c=>c.id===clientId);
  openWhatsapp(client ? client.phone : '');
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

/* ===================== SUPABASE (cloud sync + prihlásenie) =====================
   Appka teraz ukladá dáta do Supabase (Postgres, EU región) namiesto len localStorage.
   localStorage sa ale stále používa ako offline cache: každý loadKey/saveKey zapíše
   aj lokálnu kópiu, takže appka funguje aj bez pripojenia (zobrazí posledné známe dáta,
   zmeny sa lokálne uložia a nabudúce sa appka pokúsi znova zosynchronizovať).
   Publishable/anon kľúč je bezpečné mať priamo v kóde — bez prihlásenia (Supabase Auth)
   a Row Level Security politík na serveri sa cezeň k žiadnym dátam nedostaneš. */
var SUPABASE_URL = 'https://opxrzhduiijnrpevczpv.supabase.co';
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_euM-aG0JRWb4PscQIv5PAA_btJYyQTY';
var supabaseClient = (typeof window.supabase !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
var currentUser = null;

// JS kľúč (ako sa dáta volajú v appke) -> Supabase tabuľka + typ uloženia.
// "collection" = pole záznamov (každý má vlastné id, jeden riadok v tabuľke na záznam).
// "singleton"  = jeden objekt na používateľa (napr. nastavenia, cenník).
var SUPABASE_TABLE_MAP = {
  clients:   { type:'collection', table:'clients' },
  bookings:  { type:'collection', table:'bookings' },
  projects:  { type:'collection', table:'projects' },
  invoices:  { type:'collection', table:'invoices' },
  expenses:  { type:'collection', table:'expenses' },
  vendors:   { type:'collection', table:'vendors' },
  trash:     { type:'collection', table:'trash' },
  quickNotes:{ type:'collection', table:'quick_notes' },
  settings:  { type:'singleton', table:'settings' },
  pricing:   { type:'singleton', table:'pricing' }
};

async function initAuthGate(){
  if(!supabaseClient){
    showToast('Supabase sa nepodarilo načítať — appka pobeží len lokálne (skontroluj internet)');
    document.getElementById('authScreen').style.display = 'none';
    afterAuthReady();
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if(data && data.session){
    currentUser = data.session.user;
    setAuthScreenVisible(false);
    afterAuthReady();
  }else{
    setAuthScreenVisible(true);
  }
  supabaseClient.auth.onAuthStateChange((event, session)=>{
    if(event === 'SIGNED_IN' && session){
      currentUser = session.user;
      setAuthScreenVisible(false);
      afterAuthReady();
    }else if(event === 'SIGNED_OUT'){
      currentUser = null;
      setAuthScreenVisible(true);
    }
  });
}
function setAuthScreenVisible(visible){
  document.getElementById('authScreen').style.display = visible ? 'flex' : 'none';
  document.getElementById('app-root') && (document.getElementById('app-root').style.display = visible ? 'none' : '');
}
async function afterAuthReady(){
  const emailEl = document.getElementById('auth-current-email');
  if(emailEl) emailEl.textContent = currentUser ? currentUser.email : '— (offline režim) —';

  // Zachyť staré lokálne dáta PRED prvým načítaním z cloudu — loadAll nižšie ich vie
  // prepísať prázdnym cloudovým stavom, ak ide o nové/zatiaľ prázdne cloudové konto.
  // Vďaka tomu vieme po prihlásení ponúknuť jednorazové nahratie doterajších dát do Supabase.
  const preCloudSnapshot = {};
  const COLLECTION_KEYS = ['clients','projects','bookings','invoices','expenses','vendors','quickNotes'];
  COLLECTION_KEYS.forEach(k=>{
    try{
      const raw = localStorage.getItem('slate:'+k);
      preCloudSnapshot[k] = raw ? JSON.parse(raw) : [];
    }catch(e){ preCloudSnapshot[k] = []; }
  });
  ['settings','pricing'].forEach(k=>{
    try{
      const raw = localStorage.getItem('slate:'+k);
      preCloudSnapshot[k] = raw ? JSON.parse(raw) : null;
    }catch(e){ preCloudSnapshot[k] = null; }
  });

  checkPinLock();
  await loadAll();

  if(currentUser) await maybeOfferLocalMigration(preCloudSnapshot, COLLECTION_KEYS);
}
async function maybeOfferLocalMigration(preCloudSnapshot, collectionKeys){
  const cloudIsEmpty = !DATA.clients.length && !DATA.projects.length && !DATA.bookings.length && !DATA.invoices.length;
  const localHadData = collectionKeys.some(k=>preCloudSnapshot[k] && preCloudSnapshot[k].length);
  if(!cloudIsEmpty || !localHadData) return;
  showToast('Našli sme dáta z tohto prehliadača, ktoré ešte nie sú v cloude.', '⬆ Nahrať do cloudu', async ()=>{
    for(const key of collectionKeys){
      if(preCloudSnapshot[key] && preCloudSnapshot[key].length){
        DATA[key] = preCloudSnapshot[key];
        await saveKey(key, DATA[key]);
      }
    }
    if(preCloudSnapshot.settings){ DATA.settings = Object.assign({}, DEFAULT_SETTINGS, preCloudSnapshot.settings); await saveKey('settings', DATA.settings); }
    if(preCloudSnapshot.pricing){ PRICING = Object.assign({}, DEFAULT_PRICING, preCloudSnapshot.pricing); await saveKey('pricing', PRICING); }
    showToast('Doterajšie dáta nahrané do cloudu ✓');
    fillSettingsForm(); fillPricingForm(); renderAll();
  });
}
async function authSignIn(){
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';
  if(!email || !password){ errEl.textContent = 'Zadaj e-mail aj heslo.'; errEl.style.display = 'block'; return; }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ errEl.textContent = 'Prihlásenie zlyhalo: nesprávny e-mail alebo heslo.'; errEl.style.display = 'block'; }
}
async function authSignUp(){
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  const infoEl = document.getElementById('auth-info');
  errEl.style.display = 'none'; infoEl.style.display = 'none';
  if(!email || !password){ errEl.textContent = 'Zadaj e-mail aj heslo.'; errEl.style.display = 'block'; return; }
  if(password.length < 8){ errEl.textContent = 'Heslo musí mať aspoň 8 znakov.'; errEl.style.display = 'block'; return; }
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if(error){ errEl.textContent = 'Registrácia zlyhala: ' + error.message; errEl.style.display = 'block'; return; }
  if(data && data.session){ return; } // niektoré projekty prihlásia rovno bez potvrdenia e-mailu
  infoEl.textContent = 'Účet vytvorený — over si e-mail a potvrď ho, potom sa prihlás.';
  infoEl.style.display = 'block';
}
async function authSignOut(){
  if(supabaseClient) await supabaseClient.auth.signOut();
}

/* ===================== STORAGE ===================== */
async function loadKey(key, fallback){
  const map = SUPABASE_TABLE_MAP[key];
  if(map && supabaseClient && currentUser){
    try{
      if(map.type === 'collection'){
        const { data, error } = await supabaseClient.from(map.table).select('data').order('created_at', { ascending:true });
        if(error) throw error;
        const value = (data||[]).map(row=>row.data);
        try{ localStorage.setItem('slate:'+key, JSON.stringify(value)); }catch(e){}
        return value;
      }else{
        const { data, error } = await supabaseClient.from(map.table).select('data').eq('user_id', currentUser.id).maybeSingle();
        if(error) throw error;
        const value = data ? data.data : fallback;
        try{ localStorage.setItem('slate:'+key, JSON.stringify(value)); }catch(e){}
        return value;
      }
    }catch(e){
      showToast('⚠️ Nepodarilo sa načítať dáta z cloudu — zobrazujem posledné uložené lokálne');
      // padá na lokálnu cache nižšie
    }
  }
  try{
    const raw = localStorage.getItem('slate:'+key);
    if(raw !== null){ return JSON.parse(raw); }
    return fallback;
  }catch(e){ return fallback; }
}
async function syncCollectionToSupabase(table, items){
  const ids = items.map(it=>it && it.id).filter(Boolean);
  const { data: existing, error: selErr } = await supabaseClient.from(table).select('id');
  if(selErr) throw selErr;
  const existingIds = (existing||[]).map(r=>r.id);
  const toDelete = existingIds.filter(id=>!ids.includes(id));
  if(toDelete.length){
    const { error: delErr } = await supabaseClient.from(table).delete().in('id', toDelete);
    if(delErr) throw delErr;
  }
  if(items.length){
    const rows = items.filter(it=>it && it.id).map(it=>({ id: it.id, data: it }));
    if(rows.length){
      const { error: upErr } = await supabaseClient.from(table).upsert(rows, { onConflict:'id' });
      if(upErr) throw upErr;
    }
  }
}
async function saveKey(key, value){
  try{ localStorage.setItem('slate:'+key, JSON.stringify(value)); }
  catch(e){ showToast('Chyba pri ukladaní dát (možno je pamäť prehliadača plná)'); }

  const map = SUPABASE_TABLE_MAP[key];
  if(map && supabaseClient && currentUser){
    try{
      if(map.type === 'collection'){
        await syncCollectionToSupabase(map.table, Array.isArray(value) ? value : []);
      }else{
        const { error } = await supabaseClient.from(map.table).upsert({ user_id: currentUser.id, data: value }, { onConflict:'user_id' });
        if(error) throw error;
      }
    }catch(e){
      showToast('⚠️ Zmena sa neuložila do cloudu (over pripojenie) — je uložená aspoň lokálne v tomto prehliadači');
    }
  }
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
