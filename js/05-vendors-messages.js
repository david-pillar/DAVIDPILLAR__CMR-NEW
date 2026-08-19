/* ===================== 05-vendors-messages.js =====================
   Databáza dodávateľov a šablóny WhatsApp správ (vrátane DPH prepínača).
   ===================================================== */

var VENDOR_TYPE_LABELS = { fotograf:'Fotograf', kapela:'Kapela', dj:'DJ', ine:'Iné' };
function openVendorModal(id){
  const editing = !!id;
  document.getElementById('vendorModalTitle').textContent = editing ? 'Upraviť dodávateľa' : 'Nový dodávateľ';
  document.getElementById('vn-delete').style.display = editing ? 'inline-flex' : 'none';
  if(editing){
    const v = DATA.vendors.find(x=>x.id===id);
    document.getElementById('vn-id').value = v.id;
    document.getElementById('vn-name').value = v.name||'';
    document.getElementById('vn-type').value = v.type||'fotograf';
    document.getElementById('vn-phone').value = v.phone||'';
    document.getElementById('vn-email').value = v.email||'';
    document.getElementById('vn-notes').value = v.notes||'';
  }else{
    document.getElementById('vn-id').value = '';
    document.getElementById('vn-name').value = '';
    document.getElementById('vn-type').value = 'fotograf';
    document.getElementById('vn-phone').value = '';
    document.getElementById('vn-email').value = '';
    document.getElementById('vn-notes').value = '';
  }
  openModal('modal-vendor');
}
async function saveVendor(){
  const id = document.getElementById('vn-id').value || uid();
  const name = document.getElementById('vn-name').value.trim();
  if(!name){ showToast('Zadaj meno dodávateľa'); return; }
  const vendor = {
    id, name,
    type: document.getElementById('vn-type').value,
    phone: document.getElementById('vn-phone').value.trim(),
    email: document.getElementById('vn-email').value.trim(),
    notes: document.getElementById('vn-notes').value.trim()
  };
  const idx = DATA.vendors.findIndex(v=>v.id===id);
  if(idx>-1) DATA.vendors[idx]=vendor; else DATA.vendors.push(vendor);
  await saveKey('vendors', DATA.vendors);
  closeModal('modal-vendor'); renderVendors(); populateVendorDatalists();
  showToast('Dodávateľ uložený');
}
async function deleteVendor(){
  const id = document.getElementById('vn-id').value;
  const item = DATA.vendors.find(v=>v.id===id);
  DATA.vendors = DATA.vendors.filter(v=>v.id!==id);
  await saveKey('vendors', DATA.vendors);
  if(item) await moveToTrash('vendor', item);
  closeModal('modal-vendor'); renderVendors(); populateVendorDatalists();
  showToast('Dodávateľ odstránený (v Koši 30 dní)');
}
function renderVendors(){
  const q = (document.getElementById('vendorSearch').value||'').toLowerCase();
  const list = DATA.vendors.filter(v=>!q || (v.name||'').toLowerCase().includes(q));
  const el = document.getElementById('vendorsList');
  if(!list.length){ el.innerHTML = '<div class="empty">🎥 Žiadni dodávatelia. Pridaj prvého tlačidlom vyššie.</div>'; return; }
  const vendorTypeColors = { fotograf:'#e0568a', kapela:'#3d8fe0', dj:'#e0c828', ine:'#9c9890' };
  el.innerHTML = list.map(v=>{
    const color = vendorTypeColors[v.type]||'#9c9890';
    return `<div class="list-row" onclick="openVendorModal('${v.id}')">
      <div class="row-main"><div class="row-title">${escapeHtml(v.name)}</div><div class="row-sub">${escapeHtml(v.phone||v.email||'')}</div></div>
      <span class="tag-pill" style="background:${color}2e;color:${color};border-color:${color}55;">${VENDOR_TYPE_LABELS[v.type]||'Iné'}</span>
    </div>`;
  }).join('');
}
// Autocomplete suggestions for the free-text fotograf/hudba fields in the project form —
// keeps those fields as simple text inputs (so nothing breaks) while offering quick-pick
// suggestions from the vendor database via a native <datalist>.
function populateVendorDatalists(){
  const photogList = document.getElementById('vendor-photographers-list');
  const bandList = document.getElementById('vendor-bands-list');
  if(!photogList || !bandList) return;
  photogList.innerHTML = DATA.vendors.filter(v=>v.type==='fotograf').map(v=>`<option value="${escapeHtml(v.name)}">`).join('');
  bandList.innerHTML = DATA.vendors.filter(v=>v.type==='kapela'||v.type==='dj').map(v=>`<option value="${escapeHtml(v.name)}">`).join('');
}

/* ===================== MESSAGE TEMPLATES (WhatsApp) ===================== */
function guessTemplateIcon(name){
  const n = (name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(n.includes('potvrd')) return '✅';
  if(n.includes('pripom')) return '⏰';
  if(n.includes('dakuj')||n.includes('dakov')) return '🙏';
  return '💬';
}
function renderMessageTemplates(){
  const el = document.getElementById('messageTemplatesList');
  if(!el) return;
  const templates = DATA.settings.messageTemplates || [];
  if(!templates.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne šablóny.</div>'; return; }
  el.innerHTML = `<div class="msg-template-grid">${templates.map(t=>`
    <div class="msg-template-card" onclick="openMessageTemplateModal('${t.id}')">
      <div class="msg-template-card-head">
        <span class="msg-template-icon">${guessTemplateIcon(t.name)}</span>
        <span class="msg-template-name">${escapeHtml(t.name)}</span>
      </div>
      <div class="msg-template-preview">${escapeHtml(t.text||'')}</div>
    </div>`).join('')}</div>`;
}
function openMessageTemplateModal(id){
  const editing = !!id;
  document.getElementById('msgTemplateModalTitle').textContent = editing ? 'Upraviť šablónu' : 'Nová šablóna';
  document.getElementById('mt-delete').style.display = editing ? 'inline-flex' : 'none';
  if(editing){
    const t = DATA.settings.messageTemplates.find(x=>x.id===id);
    document.getElementById('mt-id').value = t.id;
    document.getElementById('mt-name').value = t.name||'';
    document.getElementById('mt-text').value = t.text||'';
  }else{
    document.getElementById('mt-id').value = '';
    document.getElementById('mt-name').value = '';
    document.getElementById('mt-text').value = '';
  }
  openModal('modal-msgtemplate');
}
async function saveMessageTemplate(){
  const id = document.getElementById('mt-id').value || uid();
  const name = document.getElementById('mt-name').value.trim();
  if(!name){ showToast('Zadaj názov šablóny'); return; }
  const template = { id, name, text: document.getElementById('mt-text').value };
  if(!DATA.settings.messageTemplates) DATA.settings.messageTemplates = [];
  const idx = DATA.settings.messageTemplates.findIndex(t=>t.id===id);
  if(idx>-1) DATA.settings.messageTemplates[idx]=template; else DATA.settings.messageTemplates.push(template);
  await saveKey('settings', DATA.settings);
  closeModal('modal-msgtemplate'); renderMessageTemplates(); populateMessageTemplatePicker();
  showToast('Šablóna uložená');
}
async function deleteMessageTemplate(){
  const id = document.getElementById('mt-id').value;
  DATA.settings.messageTemplates = (DATA.settings.messageTemplates||[]).filter(t=>t.id!==id);
  await saveKey('settings', DATA.settings);
  closeModal('modal-msgtemplate'); renderMessageTemplates(); populateMessageTemplatePicker();
  showToast('Šablóna odstránená');
}
function substituteMessagePlaceholders(text, project, client){
  const s = DATA.settings;
  const map = {
    '{{meno}}': client ? client.name : '',
    '{{nazov_zakazky}}': project ? (project.title||'') : '',
    '{{termin}}': project && project.deadline ? fmtDate(project.deadline) : 'dohodou',
    '{{firma}}': s.companyName || '',
    '{{konatel}}': s.ownerName || ''
  };
  let out = text || '';
  Object.keys(map).forEach(k=>{ out = out.split(k).join(map[k]); });
  return out;
}
/* ---- Track which of the 3 standard messages a zákazka still needs, so nothing
   gets forgotten: Potvrdenie once booked, Pripomienka right before the shoot,
   Poďakovanie once it's processed/delivered. ---- */
function classifyTemplateKey(name){
  // Normalize away diacritics so "Poďakovanie"/"ďakujem"/"dakujem" (with or without
  // diacritics, noun or verb form) are all reliably recognized as the same category.
  const n = (name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(n.includes('potvrd')) return 'potvrdenie';
  if(n.includes('pripom')) return 'pripomienka';
  if(n.includes('dakuj')||n.includes('dakov')) return 'dakujem';
  return 'ine';
}
function getExpectedMessageStatus(project){
  const todayStr = toLocalISODate(new Date());
  const in7 = new Date(); in7.setDate(in7.getDate()+7);
  const in7Str = toLocalISODate(in7);
  const sentKeys = (project.sentMessages||[]).map(m=>classifyTemplateKey(m.templateName));
  const items = [];
  if(project.status && project.status !== 'dopyt'){
    items.push({ key:'potvrdenie', label:'Potvrdenie rezervácie', sent: sentKeys.includes('potvrdenie') });
  }
  if(project.deadline && project.deadline >= todayStr && project.deadline <= in7Str){
    items.push({ key:'pripomienka', label:'Pripomienka pred natáčaním', sent: sentKeys.includes('pripomienka') });
  }
  if(project.status === 'spracovane' || project.status === 'zaplatene'){
    items.push({ key:'dakujem', label:'Poďakovanie po odovzdaní', sent: sentKeys.includes('dakujem') });
  }
  return items;
}
function getProjectsWithMissingMessages(){
  return DATA.projects
    .filter(p=>!p.archived)
    .map(p=>({ project:p, missing: getExpectedMessageStatus(p).filter(i=>!i.sent) }))
    .filter(x=>x.missing.length>0);
}
function renderMessageStatusIndicator(project){
  const el = document.getElementById('pr-status-messages-badge');
  if(!el) return;

  const logEl = document.getElementById('pr-sent-messages-log');
  if(logEl){
    const sent = (project.sentMessages||[]).slice().sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
    logEl.innerHTML = sent.length
      ? 'Odoslané: ' + sent.map(m=>`${escapeHtml(m.templateName)} (${new Date(m.sentAt).toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'})})`).join(' · ')
      : '';
  }

  const expected = getExpectedMessageStatus(project);
  if(!expected.length){
    el.textContent = '💬 Správy: nič sa nečaká';
    el.className = 'pr-indicator state-none';
    renderMessageChecklist(project);
    return;
  }
  const missing = expected.filter(i=>!i.sent);
  if(!missing.length){
    el.textContent = `💬 Správy: všetky odoslané (${expected.length}/${expected.length})`;
    el.className = 'pr-indicator state-done';
  }else{
    el.textContent = `💬 Chýba odoslať: ${missing.map(m=>m.label).join(', ')}`;
    el.className = 'pr-indicator state-partial';
  }
  renderMessageChecklist(project);
}
/* ---- Ručné odkliknutie odoslanej správy priamo v zákazke — checklist-style, pre prípad,
   že si klientovi napísal/zavolal mimo appky (SMS, telefonicky, osobne), nie cez WhatsApp
   tlačidlo. Zdieľa rovnaké dáta (project.sentMessages) ako "Poslať teraz" na Dashboarde,
   takže sa panel "Chýbajúce správy" aktualizuje okamžite v oboch smeroch. ---- */
function renderMessageChecklist(project){
  const el = document.getElementById('pr-message-checklist');
  if(!el) return;
  const expected = getExpectedMessageStatus(project);
  if(!expected.length){ el.innerHTML = ''; return; }
  el.innerHTML = `<p class="row-sub" style="margin:10px 0 2px;">Odkliknúť ako odoslané (aj keď si písal mimo appky):</p>` +
    expected.map(item=>`
    <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:${item.sent?'var(--text-faint)':'var(--text)'};margin:0;${item.sent?'text-decoration:line-through;':''}">
      <input type="checkbox" style="width:auto;" ${item.sent?'checked':''} onchange="toggleExpectedMessageSent('${project.id}','${item.key}')">
      <span>${escapeHtml(item.label)}</span>
    </label>`).join('');
}
var MESSAGE_KEY_LABELS = { potvrdenie:'Potvrdenie rezervácie', pripomienka:'Pripomienka pred natáčaním', dakujem:'Poďakovanie po odovzdaní' };
async function toggleExpectedMessageSent(projectId, key){
  const project = DATA.projects.find(p=>p.id===projectId);
  if(!project) return;
  const sentKeys = (project.sentMessages||[]).map(m=>classifyTemplateKey(m.templateName));
  const isSent = sentKeys.includes(key);
  if(isSent){
    // Odznačenie odstráni len ručne pridaný záznam — skutočne odoslanú správu cez WhatsApp
    // necháva ako dôkaz (tá sa dá zrušiť len priamo v logu, nie týmto checkboxom).
    const hadManual = (project.sentMessages||[]).some(m=>classifyTemplateKey(m.templateName)===key && m.manual);
    project.sentMessages = (project.sentMessages||[]).filter(m=>!(classifyTemplateKey(m.templateName)===key && m.manual));
    if(!hadManual){ showToast('Táto správa bola odoslaná cez WhatsApp tlačidlo — zostáva označená ako odoslaná'); }
  }else{
    if(!project.sentMessages) project.sentMessages = [];
    project.sentMessages.push({ templateId:null, templateName: MESSAGE_KEY_LABELS[key]||key, sentAt: new Date().toISOString(), manual:true });
  }
  await saveKey('projects', DATA.projects);
  renderMessageStatusIndicator(project);
  if(typeof renderMissingMessages==='function') renderMissingMessages();
  if(typeof updateNavBadges==='function') updateNavBadges();
}
function populateMessageTemplatePicker(){
  const sel = document.getElementById('pr-message-template');
  if(!sel) return;
  const templates = DATA.settings.messageTemplates || [];
  sel.innerHTML = '<option value="">— vlastný text —</option>' + templates.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}
function buildCurrentMessageText(){
  const id = document.getElementById('pr-id').value;
  const project = DATA.projects.find(p=>p.id===id);
  const templateId = document.getElementById('pr-message-template').value;
  const client = project ? DATA.clients.find(c=>c.id===project.clientId) : null;
  // Use whatever is currently typed in the form (title/deadline/new-client name) even before
  // saving, so the preview and the sent message reflect what the person sees on screen.
  const liveClientName = client ? client.name : (document.getElementById('pr-newclient-name').value.trim() || '');
  const liveProject = {
    title: document.getElementById('pr-title').value.trim() || (project ? project.title : ''),
    deadline: document.getElementById('pr-deadline').value || (project ? project.deadline : '')
  };
  const liveClient = { name: liveClientName };
  if(templateId){
    const template = (DATA.settings.messageTemplates||[]).find(t=>t.id===templateId);
    return template ? substituteMessagePlaceholders(template.text, liveProject, liveClient) : '';
  }
  const title = liveProject.title;
  const deadline = liveProject.deadline;
  let message = `Dobrý deň, ohľadom zákazky "${title||'bez názvu'}"`;
  if(deadline) message += ` (${fmtDate(deadline)})`;
  message += ' by som sa chcel/a spýtať...';
  return message;
}
function updateMessagePreview(){
  const box = document.getElementById('pr-message-preview');
  if(!box) return;
  const text = buildCurrentMessageText();
  if(!text){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.textContent = text;
}
function sendTemplatedWhatsappFromProject(){
  const phone = document.getElementById('pr-client-phone').value;
  const message = buildCurrentMessageText();
  const templateId = document.getElementById('pr-message-template').value;
  const id = document.getElementById('pr-id').value;
  if(id){
    const project = DATA.projects.find(p=>p.id===id);
    if(project){
      const templateName = templateId
        ? (((DATA.settings.messageTemplates||[]).find(t=>t.id===templateId))||{}).name
        : 'Vlastná správa';
      if(!project.sentMessages) project.sentMessages = [];
      project.sentMessages.push({ templateId, templateName: templateName||'Vlastná správa', sentAt: new Date().toISOString() });
      saveKey('projects', DATA.projects);
      renderMessageStatusIndicator(project);
    }
  }
  openWhatsapp(phone, message);
}

/* ===================== PIN zámok =====================
   Ochrana pred náhodným nazretím na zdieľanom zariadení — NIE je to silné
   zabezpečenie (dáta ostávajú nešifrované v prehliadači), len clona. PIN sa
   uloží ako SHA-256 hash priamo v localStorage (dostupný synchrónne hneď pri
   štarte appky, ešte pred async načítaním DATA z IndexedDB). Odomknutie platí
   len pre aktuálnu reláciu prehliadača (sessionStorage) — zavretie karty appku
   opäť zamkne. */
