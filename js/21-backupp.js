/* ===================== 21-backupp.js =====================
   BACKUPP — prehľad záloh videí/dát pre každú zákazku.
   Kde je záloha (disk / NAS / cloud), presná cesta alebo názov priečinka, počet kópií,
   dátum poslednej zálohy, stav, veľkosť dát a poznámka.

   Dáta sa ukladajú do DATA.settings.footageBackups = { [projectId]: {...} }.
   Nastavenia sú "singleton" v Supabase, takže sa to synchronizuje do cloudu, ide to do
   JSON zálohy aj automatickej zálohy na disk — bez novej tabuľky a bez zásahu do
   ukladania zákaziek (úprava zákazky v jej formulári tieto údaje nikdy neprepíše).
   ===================================================== */

var BACKUP_LOCATIONS = [
  { id:'disk',  label:'Disk',  icon:'💽' },
  { id:'nas',   label:'NAS',   icon:'🗄️' },
  { id:'cloud', label:'Cloud', icon:'☁️' }
];
var BACKUP_STATUS_LABELS = { zalohovane:'Zálohované', ciastocne:'Čiastočne', nezalohovane:'Nezálohované' };
var backuppFilter = 'all';      // all | risk | nezalohovane | ciastocne | zalohovane
var backuppShowUnshot = false;  // zobraziť aj zákazky, ktoré ešte nie sú nakrútené

function getBackupStore(){
  if(!DATA.settings.footageBackups || typeof DATA.settings.footageBackups !== 'object') DATA.settings.footageBackups = {};
  return DATA.settings.footageBackups;
}
function getProjectBackup(projectId){
  return getBackupStore()[projectId] || null;
}

// Zákazka má zmysel v prehľade záloh, až keď existujú nejaké dáta — teda je nakrútená
// (alebo už prešiel jej termín a nie je to len dopyt).
function projectHasFootage(p){
  if(['nakrutene','spracovane','zaplatene'].includes(p.status)) return true;
  const todayStr = toLocalISODate(new Date());
  return p.status !== 'dopyt' && !!p.deadline && p.deadline <= todayStr;
}

// 'none' = žiadna záloha (červená), 'single' = len 1 kópia (oranžová), 'ok' = 2+ kópie
function backupRisk(b){
  if(!b) return 'none';
  if(b.archiveBackup) return 'ok';
  const copies = Number(b.copies)||0;
  if(b.status === 'nezalohovane' || copies <= 0) return 'none';
  if(copies === 1) return 'single';
  return 'ok';
}

// Semafor: počet skupín (HDD / HDD KÓPIA / SSD), kde je záloha. 0 červená, 1 oranžová, 2 žltá, 3 zelená.
function driveCount(b){
  if(!b) return 0;
  if(b.archiveBackup) return 3;   // archivované = hotové, zelená
  if(!b.drives) return Math.min(3, Number(b.copies)||0);   // staré záznamy bez diskov
  // Rovnaký disk v HDD aj v HDD KÓPII je fyzicky jedno miesto — nerátame ho dvakrát.
  return new Set([b.drives.hdd,b.drives.hddCopy,b.drives.ssd].filter(Boolean)).size;
}
function driveColor(n){ return ['#e0524f','#f0922b','#e8c726','#3fb950'][n] || '#555'; }
function driveLampsHtml(n){
  const c = driveColor(n);
  return `<span class="bk-light">${[0,1,2].map(i=>`<i style="${i<n?`background:${c};box-shadow:0 0 8px ${c};`:''}"></i>`).join('')}</span>`;
}
function driveNames(b){
  return b && b.drives ? [b.drives.hdd, b.drives.hddCopy && 'KÓPIA: '+b.drives.hddCopy, b.drives.ssd].filter(Boolean) : [];
}
function updateBackuppDrives(){
  const d = { hdd:document.getElementById('bk-hdd').value, hddCopy:document.getElementById('bk-hddcopy').value, ssd:document.getElementById('bk-ssd').value };
  const n = driveCount({drives:d});
  const c = driveColor(n);
  document.querySelectorAll('#bk-light i').forEach((lamp,i)=>{
    lamp.style.background = i<n ? c : ''; lamp.style.boxShadow = i<n ? `0 0 8px ${c}` : '';
  });
  const names = driveNames({drives:d});
  document.getElementById('bk-light-label').textContent = 'Záloha: ' + ['nikde','POZOR — iba na 1 mieste','na 2 miestach — chýba ešte jedna','na 3 miestach ✓'][n] + (names.length?' ('+names.join(' · ')+')':'');
  if(d.hdd && d.hdd===d.hddCopy) document.getElementById('bk-light-label').textContent += ' ⚠ hlavná záloha a kópia sú rovnaký disk — počíta sa ako 1 miesto';
  document.getElementById('bk-copies').value = n;
  document.getElementById('bk-status').value = n===0 ? 'nezalohovane' : (n===3 ? 'zalohovane' : 'ciastocne');
  updateBackuppModalHint();
}

function fmtBackupSize(gb){
  const n = Number(gb);
  if(!n) return '—';
  if(n >= 1000) return (n/1000).toLocaleString('sk-SK',{maximumFractionDigits:2})+' TB';
  return n.toLocaleString('sk-SK',{maximumFractionDigits:1})+' GB';
}

function setBackuppFilter(f, btn){
  backuppFilter = f;
  document.querySelectorAll('.backupp-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderBackupp();
}
function toggleBackuppShowUnshot(){
  backuppShowUnshot = document.getElementById('backuppShowUnshot').checked;
  renderBackupp();
}

function renderBackupp(){
  const listEl = document.getElementById('backuppList');
  if(!listEl) return;
  const q = (document.getElementById('backuppSearch').value||'').trim().toLowerCase();
  const yearSel = document.getElementById('backuppYear');

  const base = DATA.projects.filter(p=>backuppShowUnshot || projectHasFootage(p));

  // Roky do filtra
  const years = Array.from(new Set(base.map(p=>(p.deadline||'').slice(0,4)).filter(Boolean))).sort().reverse();
  const prevYear = yearSel.value;
  yearSel.innerHTML = '<option value="">Všetky roky</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(years.includes(prevYear)) yearSel.value = prevYear;
  const year = yearSel.value;

  // Štatistiky (za vybraný rok, bez ohľadu na filter stavu / hľadanie)
  const scope = base.filter(p=>!year || (p.deadline||'').startsWith(year));
  let noneCount=0, singleCount=0, twoCount=0, okCount=0, totalGb=0;
  scope.forEach(p=>{
    const b = getProjectBackup(p.id);
    const n = driveCount(b);
    if(n===0) noneCount++; else if(n===1) singleCount++; else if(n===2) twoCount++; else okCount++;
    if(b && Number(b.sizeGB)) totalGb += Number(b.sizeGB);
  });
  document.getElementById('backuppStatsGrid').innerHTML = `
    <div class="stat-card"><div class="stat-num">${scope.length}</div><div class="stat-label">Zákaziek v prehľade</div></div>
    <div class="stat-card${noneCount?' stat-danger':''}"><div class="stat-num">${noneCount}</div><div class="stat-label">Bez zálohy</div></div>
    <div class="stat-card${singleCount?' backupp-stat-warn':''}"><div class="stat-num">${driveLampsHtml(1)} ${singleCount}</div><div class="stat-label">Na 1 mieste</div></div>
    <div class="stat-card"><div class="stat-num">${driveLampsHtml(2)} ${twoCount}</div><div class="stat-label">Na 2 miestach</div></div>
    <div class="stat-card"><div class="stat-num">${driveLampsHtml(3)} ${okCount}</div><div class="stat-label">Na 3 miestach ✓</div></div>
    <div class="stat-card"><div class="stat-num">${fmtBackupSize(totalGb)}</div><div class="stat-label">Celkom dát</div></div>`;

  let list = scope.filter(p=>{
    const b = getProjectBackup(p.id);
    const r = backupRisk(b);
    if(backuppFilter==='archived' && !(b && b.archiveBackup)) return false;
    if(backuppFilter==='risk' && r==='ok') return false;
    if(['zalohovane','ciastocne','nezalohovane'].includes(backuppFilter)){
      const st = b ? (b.status||'nezalohovane') : 'nezalohovane';
      if(st !== backuppFilter) return false;
    }
    if(q){
      const client = DATA.clients.find(c=>c.id===p.clientId);
      const hay = [p.title, client&&client.name, b&&b.path, b&&b.note].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  // Najrizikovejšie hore, potom podľa termínu (najnovšie prvé)
  const riskOrder = { none:0, single:1, ok:2 };
  list.sort((a,b)=>{
    const ra = riskOrder[backupRisk(getProjectBackup(a.id))], rb = riskOrder[backupRisk(getProjectBackup(b.id))];
    if(ra!==rb) return ra-rb;
    return (b.deadline||'').localeCompare(a.deadline||'');
  });

  if(!list.length){
    listEl.innerHTML = `<div class="empty">${scope.length ? 'Žiadna zákazka nezodpovedá filtru.' : '💾 Zatiaľ tu nie sú žiadne nakrútené zákazky.'}</div>`;
    return;
  }

  listEl.innerHTML = list.map(p=>{
    const b = getProjectBackup(p.id);
    const r = backupRisk(b);
    const client = DATA.clients.find(c=>c.id===p.clientId);
    const st = b ? (b.status||'nezalohovane') : 'nezalohovane';
    const dn = driveNames(b);
    const locs = dn.length ? dn.map(x=>`<span class="tag-pill">💽 ${escapeHtml(x)}</span>`).join(' ')
      : (b && b.locations && b.locations.length)
      ? b.locations.map(id=>{ const l = BACKUP_LOCATIONS.find(x=>x.id===id); return l ? `<span class="tag-pill">${l.icon} ${l.label}</span>` : ''; }).join(' ')
      : '<span class="row-sub">—</span>';
    const copies = b ? (Number(b.copies)||0) : 0;
    const warn = (b&&b.archiveBackup) ? '' : r==='none' ? '<span class="backupp-warn backupp-warn-none">⚠ Bez zálohy</span>'
               : r==='single' ? '<span class="backupp-warn backupp-warn-single">⚠ Len 1 kópia</span>' : '';
    return `<div class="backupp-row backupp-risk-${r}${b&&b.archiveBackup?' backupp-archived':''}" onclick="openBackuppModal('${p.id}')">
      <div class="backupp-cell backupp-main">
        <div class="row-title">${escapeHtml(p.title||'Bez názvu')}${p.archived?' 🗄️':''}</div>
        <div class="row-sub">${client?escapeHtml(client.name)+' · ':''}${fmtDate(p.deadline)}</div>
        ${b && b.path ? `<div class="backupp-path" title="${escapeHtml(b.path)}">📁 ${escapeHtml(b.path)}</div>` : ''}
        ${b && b.note ? `<div class="row-sub backupp-note">📝 ${escapeHtml(b.note)}</div>` : ''}
      </div>
      <div class="backupp-cell"><div class="backupp-lbl">Kde</div><div class="backupp-locs">${locs}</div></div>
      <div class="backupp-cell"><div class="backupp-lbl">Kópie</div><div class="backupp-val backupp-copies-${r}">${copies}×</div></div>
      <div class="backupp-cell"><div class="backupp-lbl">Posledná záloha</div><div class="backupp-val">${b&&b.lastBackup?fmtDate(b.lastBackup):'—'}</div></div>
      <div class="backupp-cell"><div class="backupp-lbl">Veľkosť</div><div class="backupp-val">${fmtBackupSize(b&&b.sizeGB)}</div></div>
      <div class="backupp-cell"><div class="backupp-lbl">Archivované</div><div class="backupp-val">${b&&b.archiveBackup ? '<span class="tag-pill" style="background:rgba(76,191,125,.22);color:#4cbf7d;">🗄️ Áno</span>' : '—'}</div></div>
      <div class="backupp-cell backupp-status">
        ${driveLampsHtml(driveCount(b))}
        ${b&&b.sdBacked ? '<span class="tag-pill">💾 SD ✓</span>' : '<span class="backupp-warn backupp-warn-none">💾 SD nezálohované</span>'}
        <span class="pill backupp-st-${st}">${BACKUP_STATUS_LABELS[st]}</span>
        ${warn}
      </div>
    </div>`;
  }).join('');
}

/* ---- Modal ---- */
function openBackuppModal(projectId){
  const p = DATA.projects.find(x=>x.id===projectId);
  if(!p) return;
  const b = getProjectBackup(projectId) || {};
  const client = DATA.clients.find(c=>c.id===p.clientId);
  document.getElementById('bk-project-id').value = projectId;
  document.getElementById('backuppModalTitle').textContent = 'Záloha — ' + (p.title||'Bez názvu');
  document.getElementById('bk-project-sub').textContent = (client?client.name+' · ':'') + fmtDate(p.deadline);
  const dr = b.drives || {};
  document.getElementById('bk-hdd').value = dr.hdd || '';
  document.getElementById('bk-hddcopy').value = dr.hddCopy || '';
  document.getElementById('bk-ssd').value = dr.ssd || '';
  document.getElementById('bk-path').value = b.path || '';
  document.getElementById('bk-copies').value = (b.copies!=null && b.copies!=='') ? b.copies : 0;
  document.getElementById('bk-lastBackup').value = b.lastBackup || '';
  document.getElementById('bk-status').value = b.status || 'nezalohovane';
  const gb = Number(b.sizeGB)||0;
  if(gb >= 1000){
    document.getElementById('bk-size').value = +(gb/1000).toFixed(3);
    document.getElementById('bk-size-unit').value = 'TB';
  }else{
    document.getElementById('bk-size').value = gb || '';
    document.getElementById('bk-size-unit').value = 'GB';
  }
  document.getElementById('bk-note').value = b.note || '';
  document.getElementById('bk-sd').checked = !!b.sdBacked;
  document.getElementById('bk-archive').checked = !!b.archiveBackup;
  document.getElementById('bk-clear').style.display = getProjectBackup(projectId) ? 'inline-flex' : 'none';
  if(b.drives) updateBackuppDrives(); else { updateBackuppModalHint(); document.getElementById('bk-light-label').textContent='Záloha: nikde'; document.querySelectorAll('#bk-light i').forEach(l=>{l.style.background='';l.style.boxShadow='';}); }
  openModal('modal-backupp');
}
function backuppSetToday(){
  document.getElementById('bk-lastBackup').value = toLocalISODate(new Date());
}
function updateBackuppModalHint(){
  const copies = Number(document.getElementById('bk-copies').value)||0;
  const status = document.getElementById('bk-status').value;
  const el = document.getElementById('bk-hint');
  if(status==='nezalohovane' || copies<=0){
    el.className = 'backupp-hint backupp-hint-none'; el.textContent = '⚠ Bez zálohy — ak zlyhá jediné úložisko, dáta sú preč.';
  }else if(copies===1){
    el.className = 'backupp-hint backupp-hint-single'; el.textContent = '⚠ Len 1 kópia — odporúča sa aspoň 2 (ideálne 3-2-1: 3 kópie, 2 typy úložiska, 1 mimo domu).';
  }else{
    el.className = 'backupp-hint backupp-hint-ok'; el.textContent = '✓ ' + copies + ' kópie';
  }
}
async function saveBackupp(){
  const projectId = document.getElementById('bk-project-id').value;
  if(!projectId) return;
  const sizeVal = parseFloat(String(document.getElementById('bk-size').value).replace(',','.')) || 0;
  const unit = document.getElementById('bk-size-unit').value;
  const copiesRaw = parseInt(document.getElementById('bk-copies').value, 10);
  const record = {
    drives: { hdd:document.getElementById('bk-hdd').value, hddCopy:document.getElementById('bk-hddcopy').value, ssd:document.getElementById('bk-ssd').value },
    locations: (getBackupStore()[projectId]||{}).locations || [],
    path: document.getElementById('bk-path').value.trim(),
    copies: isNaN(copiesRaw) || copiesRaw < 0 ? 0 : copiesRaw,
    lastBackup: document.getElementById('bk-lastBackup').value,
    status: document.getElementById('bk-status').value,
    sizeGB: unit==='TB' ? +(sizeVal*1000).toFixed(2) : sizeVal,
    note: document.getElementById('bk-note').value.trim(),
    sdBacked: document.getElementById('bk-sd').checked,
    archiveBackup: document.getElementById('bk-archive').checked,
    updatedAt: new Date().toISOString()
  };
  getBackupStore()[projectId] = record;
  await saveKey('settings', DATA.settings);
  closeModal('modal-backupp');
  renderBackupp();
  updateBackuppNavBadge();
  renderSdBackupBanner();
  showToast('Záloha uložená');
}
async function clearBackupp(){
  const projectId = document.getElementById('bk-project-id').value;
  if(!projectId) return;
  if(!confirm('Vymazať záznam o zálohe pre túto zákazku? (Samotné súbory na diskoch sa nijako nemenia.)')) return;
  delete getBackupStore()[projectId];
  await saveKey('settings', DATA.settings);
  closeModal('modal-backupp');
  renderBackupp();
  updateBackuppNavBadge();
  showToast('Záznam o zálohe vymazaný');
}

/* ---- Upozornenie na Dashboarde: od dňa zákazky svieti, kým nie sú SD karty zálohované ---- */
function sdPendingProjects(){
  return DATA.projects.filter(p=>!p.archived && projectHasFootage(p) && !(getProjectBackup(p.id)||{}).sdBacked && !(getProjectBackup(p.id)||{}).archiveBackup);
}
function renderSdBackupBanner(){
  const el = document.getElementById('sdBackupBanner');
  if(!el) return;
  const list = sdPendingProjects();
  if(!list.length){ el.style.display='none'; return; }
  const today = toLocalISODate(new Date());
  el.style.display = 'block';
  el.innerHTML = `<h3 style="margin-bottom:8px;">💾 Zálohuj SD karty (${list.length})</h3>` + list.map(p=>`
    <div class="list-row" onclick="openBackuppModal('${p.id}')"><div class="row-main">
      <div class="row-title">${escapeHtml(p.title||'Bez názvu')}</div>
      <div class="row-sub">${p.deadline===today?'🔴 DNES — ':''}${fmtDate(p.deadline)} · klikni a odznač po zálohovaní</div>
    </div></div>`).join('');
}

/* ---- Odznak v menu: koľko nakrútených zákaziek nemá žiadnu zálohu alebo len 1 kópiu ---- */
function updateBackuppNavBadge(){
  const badge = document.getElementById('navBadgeBackupp');
  if(!badge) return;
  renderSdBackupBanner();
  const n = DATA.projects.filter(p=>!p.archived && !(getProjectBackup(p.id)||{}).archiveBackup && projectHasFootage(p) && (driveCount(getProjectBackup(p.id))<2 || !(getProjectBackup(p.id)||{}).sdBacked)).length;
  badge.textContent = n;
  badge.style.display = n>0 ? 'inline-flex' : 'none';
}

/* ---- Napojenie na appku bez zásahu do ostatných súborov ---- */
(function(){
  const nav = document.getElementById('nav');
  if(nav) nav.addEventListener('click', (e)=>{
    const item = e.target.closest('.nav-item');
    if(item && item.dataset.view==='backupp') renderBackupp();
  });
  // renderAll() sa volá po načítaní dát aj po každej väčšej zmene — pribalíme k nemu aj odznak.
  if(typeof renderAll === 'function'){
    const _renderAllOrig = renderAll;
    renderAll = function(){
      _renderAllOrig.apply(this, arguments);
      try{
        updateBackuppNavBadge();
        if(currentView==='backupp') renderBackupp();
      }catch(e){}
    };
  }
  document.querySelectorAll('.bk-drive').forEach(el=>el.addEventListener('change', updateBackuppDrives));
  ['bk-copies','bk-status'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.addEventListener('input', updateBackuppModalHint); el.addEventListener('change', updateBackuppModalHint); }
  });
})();
