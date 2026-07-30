/* ===================== 17-import.js =====================
   Import z Google Formulára a z textu (napr. Pripomienky).
   ===================================================== */

var gformParsedRows = [];
function openGoogleFormModal(){
  setVal('gform-csv-url', DATA.settings.googleFormCsvUrl || '');
  document.getElementById('gform-preview-list').innerHTML = '';
  document.getElementById('gform-preview-count').textContent = '';
  document.getElementById('gform-import-btn').style.display = 'none';
  document.getElementById('gform-csv-paste').value = '';
  gformParsedRows = [];
  openModal('modal-googleform');
}
async function saveGoogleFormUrl(){
  DATA.settings.googleFormCsvUrl = document.getElementById('gform-csv-url').value.trim();
  await saveKey('settings', DATA.settings);
  showToast('Odkaz uložený');
}
// Publikované Google Sheets CSV odkazy vždy bežia cez docs.google.com. Obmedzenie na túto
// doménu bráni tomu, aby appka (napr. po obnovení podvrhnutej zálohy, ktorá by mohla nastaviť
// googleFormCsvUrl na cudziu adresu) automaticky poslala request na útočníkom kontrolovaný server.
const GOOGLE_FORM_CSV_ALLOWED_HOSTS = ['docs.google.com'];
function isAllowedGoogleFormCsvUrl(url){
  try{
    const u = new URL(url);
    return u.protocol === 'https:' && GOOGLE_FORM_CSV_ALLOWED_HOSTS.includes(u.hostname);
  }catch(e){
    return false;
  }
}
async function syncGoogleFormResponses(){
  const url = document.getElementById('gform-csv-url').value.trim();
  if(!url){ showToast('Najprv vlož odkaz na publikovaný CSV'); return; }
  if(!isAllowedGoogleFormCsvUrl(url)){
    showToast('Odkaz musí byť publikovaný CSV z docs.google.com — skús vložiť CSV text ručne nižšie');
    return;
  }
  await saveGoogleFormUrl();
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('fetch failed');
    const text = await res.text();
    parseGoogleFormCsv(text);
  }catch(e){
    showToast('Nepodarilo sa stiahnuť automaticky — skús vložiť CSV text ručne nižšie');
  }
}
function parseCsvText(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      }else field += c;
    }else{
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n' || c === '\r'){
        if(field !== '' || row.length){ row.push(field); rows.push(row); row = []; field = ''; }
        if(c === '\r' && text[i+1] === '\n') i++;
      }else field += c;
    }
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows;
}
function parseFlexibleDate(str){
  if(!str) return '';
  str = str.trim();
  let m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if(m){
    let [, d, mo, y] = m;
    if(y.length===2) y = '20'+y;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){
    let [, mo, d, y] = m;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return str.slice(0,10);
  return '';
}
function guessGformType(str){
  const s = (str||'').toLowerCase();
  if(s.includes('svad')) return 'svadba';
  if(s.includes('stuz')||s.includes('stuž')) return 'stuzkova';
  if(s.includes('klip')) return 'klip';
  return 'ine';
}
function parseGoogleFormCsv(text){
  if(!text || !text.trim()){ showToast('Vlož alebo stiahni CSV obsah najprv'); return; }
  const rows = parseCsvText(text.trim());
  if(rows.length < 2){ showToast('CSV neobsahuje žiadne odpovede'); return; }
  const headers = rows[0].map(h=>h.toLowerCase());
  const idx = {
    timestamp: headers.findIndex(h=>h.includes('timestamp')),
    name: headers.findIndex(h=>h.includes('meno')),
    phone: headers.findIndex(h=>h.includes('telef')||h.includes('phone')),
    email: headers.findIndex(h=>h.includes('mail')),
    date: headers.findIndex(h=>h.includes('dátum')||h.includes('datum')),
    type: headers.findIndex(h=>h.includes('typ')),
    location: headers.findIndex(h=>h.includes('miesto')),
    notes: headers.findIndex(h=>h.includes('poznám')||h.includes('poznam')||h.includes('prian'))
  };
  const alreadyImported = new Set(DATA.settings.gformImportedTimestamps || []);
  gformParsedRows = rows.slice(1).filter(r=>r.some(c=>c && c.trim())).map(r=>{
    const timestamp = idx.timestamp>-1 ? r[idx.timestamp] : '';
    return {
      timestamp,
      name: idx.name>-1 ? r[idx.name] : '',
      phone: idx.phone>-1 ? r[idx.phone] : '',
      email: idx.email>-1 ? r[idx.email] : '',
      date: idx.date>-1 ? parseFlexibleDate(r[idx.date]) : '',
      type: idx.type>-1 ? guessGformType(r[idx.type]) : 'ine',
      location: idx.location>-1 ? r[idx.location] : '',
      notes: idx.notes>-1 ? r[idx.notes] : '',
      alreadyImported: timestamp && alreadyImported.has(timestamp)
    };
  });
  renderGformPreview();
}
function renderGformPreview(){
  const el = document.getElementById('gform-preview-list');
  const newCount = gformParsedRows.filter(r=>!r.alreadyImported).length;
  document.getElementById('gform-preview-count').textContent = `${gformParsedRows.length} odpovedí — ${newCount} nových`;
  document.getElementById('gform-import-btn').style.display = gformParsedRows.length ? 'inline-flex' : 'none';
  if(!gformParsedRows.length){ el.innerHTML = '<div class="empty">Žiadne odpovede na spracovanie.</div>'; return; }
  el.innerHTML = gformParsedRows.map((r,i)=>`
    <label style="display:flex;align-items:flex-start;gap:10px;background:var(--surface-2);border:1px solid var(--surface-3);border-radius:8px;padding:10px 12px;text-transform:none;letter-spacing:0;margin:0;${r.alreadyImported?'opacity:.5;':''}">
      <input type="checkbox" class="gform-row-check" data-idx="${i}" style="width:auto;margin-top:3px;" ${r.alreadyImported?'':'checked'}>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${escapeHtml(r.name||'— bez mena —')} ${r.alreadyImported?'<span class="tag-pill">už importované</span>':''}</div>
        <div class="row-sub">${escapeHtml(r.phone||'')} ${r.email?'· '+escapeHtml(r.email):''} ${r.date?'· '+fmtDate(r.date):'· dátum neurčený'} ${r.location?'· '+escapeHtml(r.location):''}</div>
        ${r.notes?`<div class="row-sub" style="margin-top:2px;">${escapeHtml(r.notes)}</div>`:''}
      </div>
    </label>`).join('');
}
async function importSelectedGoogleFormRows(){
  const checks = document.querySelectorAll('.gform-row-check:checked');
  if(!checks.length){ showToast('Vyber aspoň jednu odpoveď na import'); return; }
  const importedTimestamps = new Set(DATA.settings.gformImportedTimestamps || []);
  let count = 0;
  checks.forEach(chk=>{
    const row = gformParsedRows[Number(chk.dataset.idx)];
    if(!row) return;
    let clientId = '';
    if(row.name){
      const existingClient = DATA.clients.find(c=>c.name.toLowerCase()===row.name.toLowerCase());
      if(existingClient){
        clientId = existingClient.id;
      }else{
        clientId = uid();
        DATA.clients.push({ id: clientId, name: row.name, email: row.email||'', phone: row.phone||'', notes: '' });
      }
    }
    const typeLabels = { svadba:'Svadba', stuzkova:'Stužková', klip:'Klip', ine:'Dopyt' };
    DATA.projects.push({
      id: uid(),
      title: `${typeLabels[row.type]||'Dopyt'}${row.name?' — '+row.name:''}`,
      clientId,
      deadline: row.date || '',
      budget: '',
      status: 'dopyt',
      notes: [row.location?('Miesto: '+row.location):'', row.notes||'', 'Importované z Google formulára'].filter(Boolean).join('\n'),
      tags: row.type!=='ine' ? [row.type] : [],
      type: row.type
    });
    if(row.timestamp) importedTimestamps.add(row.timestamp);
    count++;
  });
  DATA.settings.gformImportedTimestamps = Array.from(importedTimestamps);
  await saveKey('clients', DATA.clients);
  await saveKey('projects', DATA.projects);
  await saveKey('settings', DATA.settings);
  closeModal('modal-googleform');
  renderAll();
  showToast(`Naimportovaných ${count} nových dopytov`);
}

function openImportModal(){
  populateClientSelects();
  const opts = '<option value="">— bez klienta —</option>' + DATA.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('import-client').innerHTML = opts;
  document.getElementById('import-text').value = '';
  document.getElementById('importPreviewCount').textContent = '';
  openModal('modal-import');
}
document.getElementById('import-text')?.addEventListener('input', updateImportPreviewCount);
function updateImportPreviewCount(){
  const lines = document.getElementById('import-text').value.split('\n').map(l=>l.trim()).filter(Boolean);
  document.getElementById('importPreviewCount').textContent = lines.length ? `Nájdených riadkov: ${lines.length}` : '';
}
async function runImportProjects(){
  const raw = document.getElementById('import-text').value;
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length){ showToast('Vlož aspoň jeden riadok textu'); return; }
  const clientId = document.getElementById('import-client').value;
  const status = document.getElementById('import-status').value;
  const dateRe = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*\.?\s*$/;
  let withDate = 0;
  lines.forEach(line=>{
    // remove common Reminders bullet artifacts if pasted with checkboxes/dashes
    let title = line.replace(/^[-•\u2022\u25A1\u2610]\s*/, '').trim();
    if(!title) return;
    let deadline = '';
    const m = title.match(dateRe);
    if(m){
      let [, d, mo, y] = m;
      if(y.length===2) y = '20'+y;
      const dd = d.padStart(2,'0'), mm = mo.padStart(2,'0');
      // basic sanity check
      if(Number(mm)>=1 && Number(mm)<=12 && Number(dd)>=1 && Number(dd)<=31){
        deadline = `${y}-${mm}-${dd}`;
        title = title.slice(0, m.index).trim();
        withDate++;
      }
    }
    DATA.projects.push({
      id: uid(),
      title,
      clientId: clientId || '',
      deadline,
      budget: '',
      status,
      notes: 'Importované z Pripomienok'
    });
  });
  await saveKey('projects', DATA.projects);
  closeModal('modal-import');
  renderAll();
  showToast(`Naimportovaných ${lines.length} zákaziek (${withDate}× s rozpoznaným termínom)`);
}

/* --- Invoice modal --- */
