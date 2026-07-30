/* ===================== 15-project-extras.js =====================
   Podpis klienta, časovač práce, checklist zákazky.
   ===================================================== */

var signaturePadHasDrawing = false;
var signaturePadDrawing = false;
var signaturePadCtx = null;
function initSignaturePad(){
  const canvas = document.getElementById('pr-signature-pad');
  if(!canvas || canvas.dataset.wired) return;
  canvas.dataset.wired = '1';
  signaturePadCtx = canvas.getContext('2d');
  signaturePadCtx.lineWidth = 2;
  signaturePadCtx.lineCap = 'round';
  signaturePadCtx.strokeStyle = '#1b1a18';

  function getPos(ev){
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = ev.touches ? ev.touches[0] : ev;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  }
  function start(ev){
    ev.preventDefault();
    signaturePadDrawing = true;
    const pos = getPos(ev);
    signaturePadCtx.beginPath();
    signaturePadCtx.moveTo(pos.x, pos.y);
  }
  function move(ev){
    if(!signaturePadDrawing) return;
    ev.preventDefault();
    const pos = getPos(ev);
    signaturePadCtx.lineTo(pos.x, pos.y);
    signaturePadCtx.stroke();
    signaturePadHasDrawing = true;
    updateSignatureStatus();
  }
  function end(){ signaturePadDrawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive:false });
  canvas.addEventListener('touchmove', move, { passive:false });
  canvas.addEventListener('touchend', end);
}
function clearSignaturePad(){
  const canvas = document.getElementById('pr-signature-pad');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  signaturePadHasDrawing = false;
  updateSignatureStatus();
}
function updateSignatureStatus(){
  const el = document.getElementById('pr-signature-status');
  if(el) el.textContent = signaturePadHasDrawing ? '✓ Podpis zachytený' : 'Zatiaľ bez podpisu';
}
function loadSignatureIntoPad(dataUrl){
  clearSignaturePad();
  if(!dataUrl) return;
  const canvas = document.getElementById('pr-signature-pad');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = ()=>{ ctx.drawImage(img, 0, 0, canvas.width, canvas.height); signaturePadHasDrawing = true; updateSignatureStatus(); };
  img.src = dataUrl;
}
function getSignatureDataUrl(){
  if(!signaturePadHasDrawing) return '';
  const canvas = document.getElementById('pr-signature-pad');
  return canvas.toDataURL('image/png');
}

/* ---- Simple work timer: adds elapsed time into the "hours spent" field ---- */
var workTimerStart = null;
var workTimerInterval = null;
function toggleWorkTimer(){
  const btn = document.getElementById('pr-timer-btn');
  if(workTimerStart){
    const elapsedHours = Math.round(((Date.now() - workTimerStart) / 3600000) * 10) / 10;
    workTimerStart = null;
    clearInterval(workTimerInterval);
    workTimerInterval = null;
    btn.textContent = '▶️ Spustiť časovač';
    document.getElementById('pr-timer-display').textContent = '';
    if(elapsedHours > 0){
      currentTimeEntries.push({ id: uid(), date: toLocalISODate(new Date()), hours: elapsedHours, note: 'Časovač' });
      renderTimeEntries();
    }
  }else{
    workTimerStart = Date.now();
    btn.textContent = '⏸ Zastaviť a pripočítať';
    workTimerInterval = setInterval(updateWorkTimerDisplay, 1000);
    updateWorkTimerDisplay();
  }
}
function updateWorkTimerDisplay(){
  if(!workTimerStart) return;
  const elapsedMs = Date.now() - workTimerStart;
  const h = Math.floor(elapsedMs/3600000);
  const m = Math.floor((elapsedMs%3600000)/60000);
  const s = Math.floor((elapsedMs%60000)/1000);
  document.getElementById('pr-timer-display').textContent = `beží: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function resetWorkTimer(){
  workTimerStart = null;
  if(workTimerInterval){ clearInterval(workTimerInterval); workTimerInterval = null; }
  const btn = document.getElementById('pr-timer-btn');
  if(btn) btn.textContent = '▶️ Spustiť časovač';
  const disp = document.getElementById('pr-timer-display');
  if(disp) disp.textContent = '';
}

/* ---- Time entries (work log) per zákazka ---- */
var currentTimeEntries = [];
function renderTimeEntries(){
  const el = document.getElementById('pr-time-entries-list');
  if(!currentTimeEntries.length){
    el.innerHTML = '<div class="empty" style="padding:4px 0;">Zatiaľ žiadne zápisy.</div>';
  }else{
    el.innerHTML = currentTimeEntries.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(entry=>`
      <div style="display:flex;align-items:center;gap:10px;background:var(--surface-2);border:1px solid var(--surface-3);border-radius:6px;padding:6px 10px;">
        <span class="row-tag" style="flex:none;">${entry.date?fmtDate(entry.date):'—'}</span>
        <span class="num" style="flex:none;color:var(--accent);">${entry.hours} h</span>
        <span class="row-sub" style="flex:1;">${escapeHtml(entry.note||'')}</span>
        <button class="icon-btn" style="width:24px;height:24px;font-size:13px;" onclick="deleteTimeEntry('${entry.id}')" title="Odstrániť">×</button>
      </div>`).join('');
  }
  const total = currentTimeEntries.reduce((s,e)=>s+Number(e.hours||0),0);
  document.getElementById('pr-time-total').textContent = `${Math.round(total*10)/10} h`;
}
function addTimeEntry(){
  const date = document.getElementById('pr-time-entry-date').value || toLocalISODate(new Date());
  const hours = Number(document.getElementById('pr-time-entry-hours').value);
  if(!hours || hours<=0){ showToast('Zadaj počet hodín'); return; }
  const note = document.getElementById('pr-time-entry-note').value.trim();
  currentTimeEntries.push({ id: uid(), date, hours, note });
  document.getElementById('pr-time-entry-hours').value = '';
  document.getElementById('pr-time-entry-note').value = '';
  renderTimeEntries();
}
function deleteTimeEntry(id){
  currentTimeEntries = currentTimeEntries.filter(e=>e.id!==id);
  renderTimeEntries();
}
var currentChecklist = [];
function renderChecklist(){
  const el = document.getElementById('pr-checklist-list');
  if(!currentChecklist.length){ el.innerHTML = '<div class="empty" style="padding:4px 0;">Zatiaľ žiadne položky.</div>'; return; }
  el.innerHTML = currentChecklist.map(item=>`
    <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:${item.done?'var(--text-faint)':'var(--text)'};margin:0;${item.done?'text-decoration:line-through;':''}">
      <input type="checkbox" style="width:auto;" ${item.done?'checked':''} onchange="toggleChecklistItem('${item.id}')">
      <span style="flex:1;">${escapeHtml(item.text)}</span>
      <button class="icon-btn" style="width:24px;height:24px;font-size:13px;" onclick="deleteChecklistItem('${item.id}')" title="Odstrániť">×</button>
    </label>`).join('');
}
function addChecklistItem(){
  const input = document.getElementById('pr-checklist-new');
  const text = input.value.trim();
  if(!text) return;
  currentChecklist.push({ id: uid(), text, done:false });
  input.value = '';
  renderChecklist();
}
function toggleChecklistItem(id){
  const item = currentChecklist.find(i=>i.id===id);
  if(item) item.done = !item.done;
  renderChecklist();
}
function deleteChecklistItem(id){
  currentChecklist = currentChecklist.filter(i=>i.id!==id);
  renderChecklist();
}
var CHECKLIST_PRESETS = {
  svadba: ['Poslať cenovú ponuku', 'Odoslať zmluvu', 'Prijatá záloha', 'Dohodnutý harmonogram dňa', 'Natočené', 'Zostrih odovzdaný', 'Doplatok prijatý'],
  stuzkova: ['Poslať cenovú ponuku', 'Odoslať zmluvu', 'Prijatá záloha', 'Natočené', 'Zostrih odovzdaný', 'Doplatok prijatý'],
  klip: ['Poslať cenovú ponuku', 'Dohodnutý koncept', 'Natočené', 'Zostrih odovzdaný', 'Platba prijatá'],
  ine: ['Poslať cenovú ponuku', 'Dohodnuté detaily', 'Realizované', 'Odovzdané', 'Platba prijatá']
};
function addChecklistPreset(){
  const type = document.getElementById('pr-type').value || 'ine';
  const preset = CHECKLIST_PRESETS[type] || CHECKLIST_PRESETS.ine;
  preset.forEach(text=>{
    if(!currentChecklist.some(i=>i.text===text)) currentChecklist.push({ id: uid(), text, done:false });
  });
  renderChecklist();
}
function clearWeddingFields(){
  ['w-nevesta-meno','w-nevesta-adresa','w-zenich-meno','w-zenich-adresa','w-svadba-miesto','w-sobas-kostol','w-sobas-adresa','w-sobas-cas','w-hudba-meno','w-fotograf','w-special-wishes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('w-balik').value = '';
  document.getElementById('w-sobas-typ').value = '';
  document.getElementById('w-hudba-typ').value = '';
}
function clearStuzkovaFields(){
  ['s-miesto','s-hudba','s-fotograf','s-pocet-ziakov'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('s-balik').value = '';
  document.getElementById('s-kradnutie').checked = false;
}
