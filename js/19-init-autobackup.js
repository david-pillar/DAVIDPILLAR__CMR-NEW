/* ===================== 19-init-autobackup.js =====================
   Automatická záloha, IndexedDB, klávesové skratky, PIN zámok pri štarte, spustenie appky.
   ===================================================== */

async function maybeShowInstallBanner(){
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  if(isStandalone || !isMobile) return;
  try{
    const dismissed = localStorage.getItem('slate:ui:installBannerDismissed');
    if(dismissed === 'true') return;
  }catch(e){ /* not dismissed yet */ }
  document.getElementById('installBanner').style.display = 'block';
}
async function dismissInstallBanner(){
  document.getElementById('installBanner').style.display = 'none';
  try{ localStorage.setItem('slate:ui:installBannerDismissed', 'true'); }catch(e){}
}

/* ---- Automatic backup to a chosen file (Chrome/Edge only) ---- */
var autoBackupHandle = null;

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('slate-db', 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore('handles'); };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbSet(key, val){
  const db = await idbOpen();
  return new Promise((res,rej)=>{
    const tx = db.transaction('handles','readwrite');
    tx.objectStore('handles').put(val, key);
    tx.oncomplete = ()=>res();
    tx.onerror = ()=>rej(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((res,rej)=>{
    const tx = db.transaction('handles','readonly');
    const r = tx.objectStore('handles').get(key);
    r.onsuccess = ()=>res(r.result);
    r.onerror = ()=>rej(r.error);
  });
}

async function initAutoBackup(){
  const supported = 'showSaveFilePicker' in window;
  document.getElementById('autoBackupSupported').style.display = supported ? 'block' : 'none';
  document.getElementById('autoBackupUnsupported').style.display = supported ? 'none' : 'block';
  const quickRestoreBanner = document.getElementById('mobileQuickRestoreBanner');
  if(quickRestoreBanner) quickRestoreBanner.style.display = supported ? 'none' : 'block';
  if(!supported) return;
  try{
    const handle = await idbGet('autoBackupHandle');
    if(handle){
      autoBackupHandle = handle;
      const perm = await handle.queryPermission({mode:'readwrite'});
      updateAutoBackupStatusUI(perm);
      if(perm === 'granted') await autoRestoreOnLaunch();
    }else{
      updateAutoBackupStatusUI(null);
    }
  }catch(e){ updateAutoBackupStatusUI(null); }
}

/* ---- Load the latest backup file automatically every time the app opens
   (Chrome/Edge only, since it needs a persisted file handle + granted permission).
   The person explicitly asked for the file to always win, so no confirm() dialog here. ---- */
async function autoRestoreOnLaunch(){
  if(!autoBackupHandle) return;
  try{
    const file = await autoBackupHandle.getFile();
    const text = await file.text();
    if(!text || !text.trim()) return;
    const payload = JSON.parse(text);
    if(!payload || typeof payload !== 'object') return;

    DATA.clients = payload.clients || [];
    DATA.bookings = payload.bookings || [];
    DATA.projects = payload.projects || [];
    DATA.invoices = payload.invoices || [];
    DATA.expenses = payload.expenses || [];
    DATA.settings = Object.assign({}, DEFAULT_SETTINGS, payload.settings || {});
    if(payload.pricing) PRICING = Object.assign({}, DEFAULT_PRICING, payload.pricing);

    await saveKey('clients', DATA.clients);
    await saveKey('bookings', DATA.bookings);
    await saveKey('projects', DATA.projects);
    await saveKey('invoices', DATA.invoices);
    await saveKey('expenses', DATA.expenses);
    await saveKey('settings', DATA.settings);
    if(payload.pricing) await saveKey('pricing', PRICING);

    document.getElementById('companyNameInput').value = DATA.settings.companyName;
    fillSettingsForm();
    fillPricingForm();
    renderAll();
    showToast('🔄 Načítaná najnovšia záloha z disku');
  }catch(e){
    // Missing/unreadable backup file on launch shouldn't block the app —
    // it just keeps whatever was already loaded from this browser's local storage.
  }
}

var autoBackupLastFailed = false;

function updateAutoBackupStatusUI(permState){
  const statusEl = document.getElementById('autoBackupStatus');
  const grantBtn = document.getElementById('grantAccessBtn');
  const disableBtn = document.getElementById('disableAutoBackupBtn');
  if(!statusEl) return;
  if(!autoBackupHandle){
    statusEl.textContent = 'Nenastavené';
    statusEl.style.color = 'var(--text-dim)';
    grantBtn.style.display = 'none';
    disableBtn.style.display = 'none';
    return;
  }
  disableBtn.style.display = 'inline-flex';
  if(permState === 'granted' && !autoBackupLastFailed){
    const lastTime = localStorage.getItem('slate:lastAutoBackupTime');
    const lastLabel = lastTime ? new Date(lastTime).toLocaleTimeString('sk-SK',{hour:'2-digit',minute:'2-digit'}) : '';
    statusEl.textContent = `✓ Aktívne → ${autoBackupHandle.name || 'súbor'}${lastLabel?' (posledná záloha '+lastLabel+')':''}`;
    statusEl.style.color = 'var(--green-page)';
    grantBtn.style.display = 'none';
  }else if(autoBackupLastFailed){
    statusEl.textContent = `⚠️ Posledný zápis zlyhal — over, či je disk/priečinok pripojený`;
    statusEl.style.color = '#e05656';
    grantBtn.style.display = 'inline-flex';
  }else{
    statusEl.textContent = 'Treba znova povoliť prístup';
    statusEl.style.color = 'var(--yellow-page)';
    grantBtn.style.display = 'inline-flex';
  }
}

async function pickAutoBackupFile(){
  try{
    const handle = await window.showSaveFilePicker({
      suggestedName: 'slate-zaloha.json',
      types: [{ description:'JSON záloha', accept:{ 'application/json':['.json'] } }]
    });
    autoBackupHandle = handle;
    await idbSet('autoBackupHandle', handle);
    await writeAutoBackup();
    updateAutoBackupStatusUI('granted');
    showToast('Automatická záloha nastavená ✓');
  }catch(e){
    if(e.name !== 'AbortError') showToast('Nepodarilo sa nastaviť automatickú zálohu');
  }
}
async function grantAutoBackupAccess(){
  if(!autoBackupHandle) return;
  try{
    const perm = await autoBackupHandle.requestPermission({mode:'readwrite'});
    updateAutoBackupStatusUI(perm);
    if(perm === 'granted'){ await writeAutoBackup(); showToast('Prístup povolený'); }
  }catch(e){ showToast('Prístup sa nepodarilo obnoviť'); }
}
async function disableAutoBackup(){
  autoBackupHandle = null;
  try{ await idbSet('autoBackupHandle', null); }catch(e){}
  updateAutoBackupStatusUI(null);
  showToast('Automatická záloha vypnutá');
}
async function writeAutoBackup(){
  if(!autoBackupHandle) return;
  try{
    const perm = await autoBackupHandle.queryPermission({mode:'readwrite'});
    if(perm !== 'granted') return;
    const payload = { exportedAt:new Date().toISOString(), clients:DATA.clients, bookings:DATA.bookings, projects:DATA.projects, invoices:DATA.invoices, settings:DATA.settings };
    const writable = await autoBackupHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    localStorage.setItem('slate:lastAutoBackupTime', new Date().toISOString());
    if(autoBackupLastFailed){
      autoBackupLastFailed = false;
      showToast('Záloha na disk opäť funguje ✓');
    }
    updateAutoBackupStatusUI('granted');
  }catch(e){
    // File System Access API throws here if the external drive/folder got disconnected —
    // surface this once (not on every save) so the person notices the drive isn't backing up.
    if(!autoBackupLastFailed){
      autoBackupLastFailed = true;
      showToast('⚠️ Záloha na disk zlyhala — skontroluj, či je pripojený externý disk');
    }
    updateAutoBackupStatusUI('denied');
  }
}

/* ===================== KEYBOARD SHORTCUTS ===================== */
document.addEventListener('keydown', (e)=>{
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  const isTyping = tag==='input' || tag==='textarea' || tag==='select' || (e.target && e.target.isContentEditable);

  // Ctrl/Cmd+K — focus global search from anywhere, even while typing elsewhere.
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    const searchEl = document.getElementById('global-search');
    if(searchEl){ searchEl.focus(); searchEl.select(); }
    return;
  }
  // N — new zákazka, but only when not typing into a field (so "n" in a text field works normally).
  if(!isTyping && e.key.toLowerCase()==='n' && !e.ctrlKey && !e.metaKey && !e.altKey){
    const anyModalOpen = document.querySelector('.modal-overlay.open');
    if(anyModalOpen) return;
    e.preventDefault();
    openNewDopytForm();
  }
});

/* ===================== INIT ===================== */
checkPinLock();
document.getElementById('pin-unlock-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') attemptUnlock(); });
document.getElementById('pin-new-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') setAppPin(); });
document.getElementById('quick-note-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') addQuickNote(); });
applyTheme(localStorage.getItem('slate:theme') || 'film');
loadAll();
maybeShowInstallBanner();
initAutoBackup();
initCrmFolder();
