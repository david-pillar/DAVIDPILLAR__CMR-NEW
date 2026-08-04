/* ===================== 06-export-backup-pdf.js =====================
   PIN zámok, kontrola dát, export do Excelu, záloha/obnova, PDF zmluvy/faktúry.
   ===================================================== */

async function hashPin(pin){
  const enc = new TextEncoder().encode('slate-salt-' + pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function setAppPin(){
  const pin = document.getElementById('pin-new-input').value.trim();
  if(!/^\d{4,6}$/.test(pin)){ showToast('PIN musí mať 4 až 6 číslic'); return; }
  const hash = await hashPin(pin);
  localStorage.setItem('slate:pinHash', hash);
  sessionStorage.setItem('slate:unlocked', 'true');
  document.getElementById('pin-new-input').value = '';
  refreshPinSettingsUI();
  showToast('PIN nastavený');
}
function removeAppPin(){
  if(!confirm('Naozaj odstrániť PIN? Appka sa už nebude dať zamknúť.')) return;
  localStorage.removeItem('slate:pinHash');
  refreshPinSettingsUI();
  showToast('PIN odstránený');
}
function lockAppNow(){
  sessionStorage.removeItem('slate:unlocked');
  checkPinLock();
}
/* ===================== Kontrola dát =====================
   Rýchly prehľad chýbajúcich/nekonzistentných záznamov, aby sa appka
   dlhodobo nezašpinila — klikneš na položku a rovno ju opravíš. */
function renderDataHealthCheck(){
  const el = document.getElementById('dataHealthCheckResults');
  if(!el) return;
  const groups = [];

  const clientsNoPhone = DATA.clients.filter(c=>!c.phone || !c.phone.trim());
  if(clientsNoPhone.length) groups.push({
    label: `📞 ${clientsNoPhone.length} klient(i) bez telefónu`,
    items: clientsNoPhone.map(c=>({ title:c.name, onClick:`openClientModal('${c.id}')` }))
  });

  const invoicesNoDue = DATA.invoices.filter(i=>!i.due);
  if(invoicesNoDue.length) groups.push({
    label: `📅 ${invoicesNoDue.length} faktúra/y bez splatnosti`,
    items: invoicesNoDue.map(i=>({ title:i.number||'bez čísla', onClick:`openInvoiceModal('${i.id}')` }))
  });

  const projectsNoClient = DATA.projects.filter(p=>!p.clientId);
  if(projectsNoClient.length) groups.push({
    label: `👤 ${projectsNoClient.length} zákazka/y bez priradeného klienta`,
    items: projectsNoClient.map(p=>({ title:p.title||'bez názvu', onClick:`openProjectModal('${p.id}')` }))
  });

  const projectsNoDeadline = DATA.projects.filter(p=>!p.deadline);
  if(projectsNoDeadline.length) groups.push({
    label: `📆 ${projectsNoDeadline.length} zákazka/y bez termínu`,
    items: projectsNoDeadline.map(p=>({ title:p.title||'bez názvu', onClick:`openProjectModal('${p.id}')` }))
  });

  const vendorsNoPhone = DATA.vendors.filter(v=>!v.phone || !v.phone.trim());
  if(vendorsNoPhone.length) groups.push({
    label: `📞 ${vendorsNoPhone.length} dodávateľ/ia bez telefónu`,
    items: vendorsNoPhone.map(v=>({ title:v.name, onClick:`openVendorModal('${v.id}')` }))
  });

  if(!groups.length){
    el.innerHTML = '<div class="empty">✓ Všetko v poriadku — žiadne chýbajúce údaje.</div>';
    return;
  }
  el.innerHTML = groups.map(g=>`
    <div style="margin-bottom:14px;">
      <div style="font-weight:600;font-size:13px;color:var(--text);margin-bottom:6px;">${g.label}</div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${g.items.map(item=>`<div class="list-row" style="padding:6px 4px;" onclick="${item.onClick}"><div class="row-main"><div class="row-title" style="font-size:13px;">${escapeHtml(item.title)}</div></div><span class="row-sub">Opraviť →</span></div>`).join('')}
      </div>
    </div>`).join('');
}
function refreshPinSettingsUI(){
  const isSet = !!localStorage.getItem('slate:pinHash');
  const notSetEl = document.getElementById('pin-not-set');
  const isSetEl = document.getElementById('pin-is-set');
  if(notSetEl) notSetEl.style.display = isSet ? 'none' : 'flex';
  if(isSetEl) isSetEl.style.display = isSet ? 'block' : 'none';
}
function checkPinLock(){
  const storedHash = localStorage.getItem('slate:pinHash');
  const screen = document.getElementById('pinLockScreen');
  if(!screen) return;
  if(storedHash && sessionStorage.getItem('slate:unlocked') !== 'true'){
    screen.style.display = 'flex';
    const input = document.getElementById('pin-unlock-input');
    if(input){ input.value = ''; input.focus(); }
  }else{
    screen.style.display = 'none';
  }
}
async function attemptUnlock(){
  const pin = document.getElementById('pin-unlock-input').value.trim();
  const storedHash = localStorage.getItem('slate:pinHash');
  const enteredHash = await hashPin(pin);
  const errorEl = document.getElementById('pin-unlock-error');
  if(enteredHash === storedHash){
    sessionStorage.setItem('slate:unlocked', 'true');
    document.getElementById('pinLockScreen').style.display = 'none';
    if(errorEl) errorEl.style.display = 'none';
  }else{
    if(errorEl) errorEl.style.display = 'block';
    document.getElementById('pin-unlock-input').value = '';
    document.getElementById('pin-unlock-input').focus();
  }
}

async function saveSettings(){
  DATA.settings.companyName = document.getElementById('set-companyName').value.trim() || 'Moja produkcia';
  DATA.settings.ownerName = document.getElementById('set-ownerName').value.trim();
  DATA.settings.address = document.getElementById('set-address').value.trim();
  DATA.settings.ico = document.getElementById('set-ico').value.trim();
  DATA.settings.dic = document.getElementById('set-dic').value.trim();
  DATA.settings.iban = document.getElementById('set-iban').value.trim();
  DATA.settings.email = document.getElementById('set-email').value.trim();
  DATA.settings.phone = document.getElementById('set-phone').value.trim();
  DATA.settings.vatPayer = document.getElementById('set-vatPayer').checked;
  DATA.settings.defaultVatRate = Number(document.getElementById('set-defaultVatRate').value) || 20;
  DATA.settings.contractTemplate = document.getElementById('set-contractTemplate').value;
  DATA.settings.invoiceTemplate = document.getElementById('set-invoiceTemplate').value;
  DATA.settings.dayScheduleTemplate = document.getElementById('set-dayScheduleTemplate').value;
  await saveKey('settings', DATA.settings);
  document.getElementById('companyNameInput').value = DATA.settings.companyName;
  showToast('Nastavenia uložené');
}
function onVatPayerToggle(){
  document.getElementById('set-vat-rate-row').style.display = document.getElementById('set-vatPayer').checked ? 'grid' : 'none';
}

/* ---- Backup / restore ---- */
/* ---- Export to Excel (as .csv — opens natively in Excel, no extra library needed) ---- */
function csvEscapeField(val){
  const s = String(val==null ? '' : val);
  if(s.includes(',') || s.includes('"') || s.includes('\n')){
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}
function downloadCsv(filename, headers, rows){
  const lines = [headers.map(csvEscapeField).join(',')];
  rows.forEach(row=>{ lines.push(row.map(csvEscapeField).join(',')); });
  // BOM prefix so Excel opens UTF-8 files (with diacritics) correctly instead of showing mojibake.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Export stiahnutý — otvor ho priamo v Exceli');
}
function exportProjectsCsv(){
  const typeLabels = { svadba:'Svadba', stuzkova:'Stužková', klip:'Klip', ine:'Iné' };
  const headers = ['Názov','Klient','Telefón','Email','Typ','Stav','Termín','Rozpočet (€)','Odpracované hodiny','Tagy'];
  const rows = getFilteredProjects().map(p=>{
    const client = DATA.clients.find(c=>c.id===p.clientId);
    return [
      p.title||'', client?client.name:'', client?client.phone:'', client?client.email:'',
      typeLabels[p.type]||'', STATUS_LABELS[p.status]||p.status, p.deadline?fmtDate(p.deadline):'',
      p.budget||0, (p.timeEntries||[]).reduce((s,e)=>s+Number(e.hours||0),0), (p.tags||[]).join('; ')
    ];
  });
  downloadCsv(`slate-zakazky-${toLocalISODate(new Date())}.csv`, headers, rows);
}
function exportInvoicesCsv(){
  const typeLabels = { cela:'Celá suma', zaloha:'Záloha', doplatok:'Doplatok' };
  const headers = ['Číslo faktúry','Klient','Zákazka','Typ','Základ (€)','DPH sadzba (%)','DPH suma (€)','Suma spolu (€)','Splatnosť','Stav','Odoslaná'];
  const rows = DATA.invoices.filter(i=>!i.archived).map(i=>{
    const client = DATA.clients.find(c=>c.id===i.clientId);
    const project = DATA.projects.find(p=>p.id===i.projectId);
    return [
      i.number||'', client?client.name:'', project?project.title:'', typeLabels[i.type]||'Celá suma',
      i.vatBase||'', i.vatBase?i.vatRate:'', i.vatBase?i.vatAmount:'', i.amount||0,
      i.due?fmtDate(i.due):'', i.status==='uhradena'?'Uhradená':'Neuhradená', i.sent?'Áno':'Nie'
    ];
  });
  downloadCsv(`slate-faktury-${toLocalISODate(new Date())}.csv`, headers, rows);
}

/* Ročný report pre účtovníctvo — mesačný rozpis obratu, uhradených faktúr, nákladov a zisku,
   v rovnakej logike ako dashboardový "Ročný súhrn" (pozri renderYearlySummary). */
function exportYearlyAccountingReport(year){
  year = year || new Date().getFullYear();
  const monthNames = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];
  const headers = ['Mesiac','Počet zákaziek (podľa termínu)','Rozpočet zákaziek (€)','Uhradené faktúry (€)','Náklady (€)','Zisk: uhradené − náklady (€)'];
  const rows = [];
  let totalCount=0, totalBudget=0, totalPaid=0, totalExpenses=0;
  for(let m=0; m<12; m++){
    const monthStr = `${year}-${String(m+1).padStart(2,'0')}`;
    const monthProjects = DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(monthStr));
    const budget = monthProjects.reduce((s,p)=>s+(Number(p.budget)||0),0);
    const paid = DATA.invoices.filter(i=>{
      if(i.status!=='uhradena') return false;
      const project = DATA.projects.find(p=>p.id===i.projectId);
      const dateStr = (project && project.deadline) || i.due;
      return dateStr && dateStr.startsWith(monthStr);
    }).reduce((s,i)=>s+Number(i.amount||0),0);
    const expenses = DATA.expenses.filter(e=>e.date && e.date.startsWith(monthStr)).reduce((s,e)=>s+Number(e.amount||0),0);
    totalCount += monthProjects.length; totalBudget += budget; totalPaid += paid; totalExpenses += expenses;
    rows.push([monthNames[m], monthProjects.length, budget.toFixed(2), paid.toFixed(2), expenses.toFixed(2), (paid-expenses).toFixed(2)]);
  }
  rows.push(['SPOLU', totalCount, totalBudget.toFixed(2), totalPaid.toFixed(2), totalExpenses.toFixed(2), (totalPaid-totalExpenses).toFixed(2)]);
  downloadCsv(`slate-rocny-report-${year}.csv`, headers, rows);
}
function downloadBackup(){
  const payload = { exportedAt: new Date().toISOString(), clients: DATA.clients, bookings: DATA.bookings, projects: DATA.projects, invoices: DATA.invoices, expenses: DATA.expenses, settings: DATA.settings, pricing: PRICING };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `slate-zaloha-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Záloha stiahnutá — ulož si ju napr. na Google Drive');
}
async function restoreBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    if(!confirm('Obnovením zálohy prepíšeš aktuálne dáta v appke. Pokračovať?')) return;
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
    fillSettingsForm();
    fillPricingForm();
    document.getElementById('companyNameInput').value = DATA.settings.companyName;
    renderAll();
    showToast('Záloha obnovená');
  }catch(e){
    showToast('Súbor sa nepodarilo načítať — skontroluj formát');
  }
  event.target.value = '';
}
async function mergeImportData(event){
  const file = event.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    const newClients = payload.clients || [];
    const newProjects = payload.projects || [];
    const newBookings = payload.bookings || [];
    if(!confirm(`Pridať ${newClients.length} klientov a ${newProjects.length} zákaziek k existujúcim dátam?`)) return;
    DATA.clients = DATA.clients.concat(newClients);
    DATA.projects = DATA.projects.concat(newProjects);
    if(newBookings.length) DATA.bookings = DATA.bookings.concat(newBookings);
    await saveKey('clients', DATA.clients);
    await saveKey('projects', DATA.projects);
    if(newBookings.length) await saveKey('bookings', DATA.bookings);
    renderAll();
    showToast(`Pridaných ${newClients.length} klientov a ${newProjects.length} zákaziek`);
  }catch(e){
    showToast('Súbor sa nepodarilo načítať — skontroluj formát');
  }
  event.target.value = '';
}

/* ---- Shared PDF text renderer ---- */
function sanitizeName(str){
  return (str||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove diacritics
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'zaznam';
}
function renderTextToPdf(text){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const marginX = 56, maxWidth = 483;
  let y = 64;
  doc.setFont('helvetica','normal');
  const lines = text.split('\n');
  lines.forEach(line=>{
    const isHeading = line === line.toUpperCase() && line.trim().length>0 && line.trim().length<60;
    doc.setFontSize(isHeading ? 12.5 : 10.5);
    doc.setFont('helvetica', isHeading ? 'bold' : 'normal');
    const wrapped = doc.splitTextToSize(line || ' ', maxWidth);
    wrapped.forEach(w=>{
      if(y > 770){ doc.addPage(); y = 64; }
      doc.text(w, marginX, y);
      y += 15;
    });
  });
  doc._lastY = y; // used by generateContractPDF to place the signature right after the text
  return doc;
}
/* Saves the PDF either into the chosen CRM folder (organized per zákazka) or, if not set up, triggers a normal browser download. */
async function saveDocSmart(doc, filename, folderLabel){
  if(crmFolderHandle){
    try{
      const perm = await crmFolderHandle.queryPermission({mode:'readwrite'});
      if(perm === 'granted'){
        const subDir = await crmFolderHandle.getDirectoryHandle(sanitizeName(folderLabel), { create:true });
        const fileHandle = await subDir.getFileHandle(filename, { create:true });
        const writable = await fileHandle.createWritable();
        await writable.write(doc.output('blob'));
        await writable.close();
        showToast(`Uložené do CRM/${sanitizeName(folderLabel)}/${filename}`);
        return;
      }
    }catch(e){ /* fall through to download */ }
  }
  doc.save(filename);
  showToast('PDF stiahnuté (nastav si CRM priečinok pre automatické triedenie)');
}

/* ---- Keep an always-current "info.txt" summary inside each zákazka's folder,
   so opening the folder on the HDD shows everything about it at a glance,
   even before any contract/invoice PDF has been generated. ---- */
function buildProjectInfoText(project){
  const client = DATA.clients.find(c=>c.id===project.clientId);
  const typeLabels = { svadba:'Svadba', stuzkova:'Stužková', klip:'Klip', ine:'Iné' };
  const lines = [];
  lines.push(`ZÁKAZKA: ${project.title || 'bez názvu'}`);
  lines.push(`Typ: ${typeLabels[project.type] || '—'}`);
  lines.push(`Stav: ${STATUS_LABELS[project.status] || project.status}`);
  lines.push(`Termín: ${project.deadline ? fmtDate(project.deadline) : 'dohodou'}`);
  lines.push(`Rozpočet: ${project.budget ? fmtMoney(project.budget) : '—'}`);
  lines.push(`Zmluva: ${project.contractSigned ? 'podpísaná' : (project.contractGenerated ? 'vytvorená (nepodpísaná)' : 'nevytvorená')}`);
  if(project.deliveryLink || project.deliveryDate){
    lines.push(`Odovzdanie: ${project.deliveryConfirmed?'prevzaté':'čaká na prevzatie'}${project.deliveryDate?' — '+fmtDate(project.deliveryDate):''}${project.deliveryLink?' — '+project.deliveryLink:''}`);
  }
  lines.push('');
  lines.push('--- KLIENT ---');
  if(client){
    lines.push(`Meno: ${client.name}`);
    if(client.phone) lines.push(`Telefón: ${client.phone}`);
    if(client.email) lines.push(`Email: ${client.email}`);
    if(client.address) lines.push(`Adresa: ${client.address}`);
  }else{
    lines.push('— bez priradeného klienta —');
  }

  if(project.type === 'svadba' && project.wedding){
    const w = project.wedding;
    lines.push('');
    lines.push('--- SVADBA ---');
    if(w.nevestaMeno) lines.push(`Nevesta: ${w.nevestaMeno}${w.nevestaAdresa?' — '+w.nevestaAdresa:''}`);
    if(w.zenichMeno) lines.push(`Ženích: ${w.zenichMeno}${w.zenichAdresa?' — '+w.zenichAdresa:''}`);
    if(w.sobasKostol) lines.push(`Sobáš: ${w.sobasKostol}${w.sobasCas?' o '+w.sobasCas:''} (${SOBAS_TYP_LABELS[w.sobasTyp]||'—'})`);
    if(w.svadbaMiesto) lines.push(`Svadba: ${w.svadbaMiesto}`);
    if(w.hudbaMeno) lines.push(`Hudba: ${w.hudbaMeno} (${HUDBA_TYP_LABELS[w.hudbaTyp]||'—'})`);
    if(w.fotograf) lines.push(`Fotograf: ${w.fotograf}`);
    if(w.balik) lines.push(`Balík: ${w.balik}`);
    if(w.specialWishes) lines.push(`Špeciálne priania: ${w.specialWishes}`);
  }
  if(project.type === 'stuzkova' && project.stuzkova){
    const s = project.stuzkova;
    lines.push('');
    lines.push('--- STUŽKOVÁ ---');
    if(s.miesto) lines.push(`Miesto: ${s.miesto}`);
    if(s.hudba) lines.push(`Hudba: ${s.hudba}`);
    if(s.fotograf) lines.push(`Fotograf: ${s.fotograf}`);
    if(s.pocetZiakov) lines.push(`Počet žiakov: ${s.pocetZiakov}`);
    if(s.balik) lines.push(`Balík: ${s.balik}`);
    lines.push(`Kradnutie: ${s.kradnutie ? 'áno' : 'nie'}`);
  }

  if(project.checklist && project.checklist.length){
    lines.push('');
    lines.push('--- CHECKLIST ---');
    project.checklist.forEach(item=>{ lines.push(`[${item.done?'x':' '}] ${item.text}`); });
  }

  const relatedInvoices = DATA.invoices.filter(i=>i.projectId===project.id);
  if(relatedInvoices.length){
    lines.push('');
    lines.push('--- FAKTÚRY ---');
    relatedInvoices.forEach(i=>{
      lines.push(`${i.number} — ${fmtMoney(i.amount)} — ${i.status==='uhradena'?'uhradená':'neuhradená'}${i.due?' (splatnosť '+fmtDate(i.due)+')':''}`);
    });
  }

  if(project.tags && project.tags.length){
    lines.push('');
    lines.push(`Tagy: ${project.tags.join(', ')}`);
  }
  if(project.notes){
    lines.push('');
    lines.push('--- POZNÁMKA ---');
    lines.push(project.notes);
  }
  lines.push('');
  lines.push(`(automaticky aktualizované appkou SLATE — ${new Date().toLocaleString('sk-SK')})`);
  return lines.join('\n');
}
async function syncProjectFolder(project){
  if(!crmFolderHandle || !project.title) return;
  const folderName = project.folderName || sanitizeName(project.title);
  try{
    const perm = await crmFolderHandle.queryPermission({mode:'readwrite'});
    if(perm !== 'granted') return;
    const subDir = await crmFolderHandle.getDirectoryHandle(folderName, { create:true });
    const fileHandle = await subDir.getFileHandle('info.txt', { create:true });
    const writable = await fileHandle.createWritable();
    await writable.write(buildProjectInfoText(project));
    await writable.close();
    if(!project.folderCreated){
      project.folderCreated = true;
      await saveKey('projects', DATA.projects);
    }
    if(document.getElementById('pr-id').value === project.id){
      renderProjectStatusIndicators(project);
    }
  }catch(e){ /* CRM priečinok nemusí byť pripojený (napr. externý disk odpojený) — tichá chyba, netreba otravovať pri každom uložení */ }
}
async function manualSyncProjectFolder(){
  if(!crmFolderHandle){ showToast('Najprv si v Nastaveniach vyber CRM priečinok'); return; }
  const id = document.getElementById('pr-id').value;
  if(!id){ showToast('Najprv zákazku ulož tlačidlom "Uložiť"'); return; }
  const project = DATA.projects.find(p=>p.id===id);
  if(!project){ showToast('Najprv zákazku ulož tlačidlom "Uložiť"'); return; }
  try{
    const perm = await crmFolderHandle.queryPermission({mode:'readwrite'});
    if(perm !== 'granted'){ showToast('Priečinok nie je dostupný — over pripojenie disku a povoľ prístup v Nastaveniach'); return; }
    await syncProjectFolder(project);
    renderProjectStatusIndicators(project);
    const folderName = project.folderName || sanitizeName(project.title);
    showToast(`Priečinok aktualizovaný: CRM/${folderName}/info.txt`);
  }catch(e){
    showToast('Priečinok sa nepodarilo aktualizovať — skontroluj pripojenie disku');
  }
}

/* ---- Contract PDF generation ---- */
async function generateContractPDF(){
  const id = document.getElementById('pr-id').value;
  const project = DATA.projects.find(p=>p.id===id);
  if(!project){ showToast('Najprv zákazku ulož, potom vygeneruj zmluvu'); return; }
  const client = DATA.clients.find(c=>c.id===project.clientId);
  const s = DATA.settings;
  const todayStr = new Date().toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'});
  const w = project.wedding || {};
  const map = {
    '{{produkcia}}': s.companyName || '',
    '{{konatel}}': s.ownerName || '',
    '{{ico}}': s.ico || '—',
    '{{dic}}': s.dic || '—',
    '{{adresa}}': s.address || '—',
    '{{iban}}': s.iban || '—',
    '{{klient}}': client ? client.name : '—',
    '{{nazov_zakazky}}': project.title || '',
    '{{termin}}': project.deadline ? fmtDate(project.deadline) : 'dohodou',
    '{{rozpocet}}': project.budget ? Number(project.budget).toLocaleString('sk-SK') : '0',
    '{{datum_dnes}}': todayStr,
    '{{nevesta}}': w.nevestaMeno || '—',
    '{{nevesta_adresa}}': w.nevestaAdresa || '—',
    '{{zenich}}': w.zenichMeno || '—',
    '{{zenich_adresa}}': w.zenichAdresa || '—',
    '{{svadba_miesto}}': w.svadbaMiesto || '—',
    '{{sobas_kostol}}': w.sobasKostol || '—',
    '{{sobas_adresa}}': w.sobasAdresa || '—',
    '{{sobas_typ}}': SOBAS_TYP_LABELS[w.sobasTyp] || '—',
    '{{sobas_cas}}': w.sobasCas || '—',
    '{{hudba_typ}}': HUDBA_TYP_LABELS[w.hudbaTyp] || '—',
    '{{hudba}}': w.hudbaMeno || '—',
    '{{fotograf}}': w.fotograf || '—',
    '{{balik}}': w.balik ? ('Balík '+w.balik) : '—'
  };
  let text = s.contractTemplate || DEFAULT_SETTINGS.contractTemplate;
  Object.keys(map).forEach(k=>{ text = text.split(k).join(map[k]); });

  if(!window.jspdf){ showToast('PDF knižnica sa ešte načítava, skús o chvíľu znova'); return; }
  const doc = renderTextToPdf(text);
  const signatureDataUrl = getSignatureDataUrl();
  if(signatureDataUrl){
    let y = doc._lastY + 20;
    if(y > 720){ doc.addPage(); y = 64; }
    doc.setFontSize(10.5);
    doc.setFont('helvetica','normal');
    doc.text('Podpis objednávateľa:', 56, y);
    doc.addImage(signatureDataUrl, 'PNG', 56, y+8, 180, 45);
  }
  const filename = `zmluva-${sanitizeName(project.title)}.pdf`;
  await saveDocSmart(doc, filename, (project.folderName || project.title));
  if(!project.contractGenerated){
    project.contractGenerated = true;
    await saveKey('projects', DATA.projects);
    document.getElementById('pr-contract-generated').checked = true;
    renderProjectStatusIndicators(project);
  }
}

/* ---- Invoice PDF generation ---- */
async function generateInvoicePDF(){
  const id = document.getElementById('iv-id').value;
  const invoice = DATA.invoices.find(i=>i.id===id);
  if(!invoice){ showToast('Najprv faktúru ulož, potom vygeneruj PDF'); return; }
  const client = DATA.clients.find(c=>c.id===invoice.clientId);
  const project = DATA.projects.find(p=>p.id===invoice.projectId);
  const s = DATA.settings;
  const todayStr = new Date().toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'});
  const map = {
    '{{cislo_faktury}}': invoice.number || '',
    '{{klient}}': client ? client.name : '—',
    '{{suma}}': invoice.amount ? Number(invoice.amount).toLocaleString('sk-SK') : '0',
    '{{splatnost}}': invoice.due ? fmtDate(invoice.due) : 'dohodou',
    '{{nazov_zakazky}}': project ? project.title : '—',
    '{{produkcia}}': s.companyName || '',
    '{{konatel}}': s.ownerName || '',
    '{{ico}}': s.ico || '—',
    '{{dic}}': s.dic || '—',
    '{{adresa}}': s.address || '—',
    '{{iban}}': s.iban || '—',
    '{{datum_dnes}}': todayStr
  };
  let text = s.invoiceTemplate || DEFAULT_SETTINGS.invoiceTemplate;
  Object.keys(map).forEach(k=>{ text = text.split(k).join(map[k]); });

  if(invoice.vatBase){
    text += `\n\nZáklad dane: ${Number(invoice.vatBase).toLocaleString('sk-SK')} €\nDPH (${invoice.vatRate}%): ${Number(invoice.vatAmount||0).toLocaleString('sk-SK')} €\nSpolu s DPH: ${Number(invoice.amount||0).toLocaleString('sk-SK')} €`;
  }

  if(!window.jspdf){ showToast('PDF knižnica sa ešte načítava, skús o chvíľu znova'); return; }
  const doc = renderTextToPdf(text);
  const filename = `faktura-${sanitizeName(invoice.number || invoice.id)}.pdf`;
  const folderLabel = project ? (project.folderName || project.title) : (client ? client.name : 'faktury-bez-zakazky');
  await saveDocSmart(doc, filename, folderLabel);
}

/* ---- Pay by Square QR code for the invoice (Slovak bank standard) ----
   Loaded on demand from esm.sh — needs an internet connection, unlike the
   rest of the app which works fully offline from local storage. */
/* ---- Weather forecast for upcoming outdoor weddings (Open-Meteo, free, no API key) ----
   Needs an internet connection, same as the QR payment feature — the rest of the app
   works fully offline from local storage. */
