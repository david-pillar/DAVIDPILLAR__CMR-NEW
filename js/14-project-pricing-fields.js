/* ===================== 14-project-pricing-fields.js =====================
   Polia svadby/stužkovej, prepočet ceny, stavové indikátory, zisk/strata na zákazke.
   ===================================================== */

function onProjectTypeChange(){
  const type = document.getElementById('pr-type').value;
  document.getElementById('pr-wedding-fields').style.display = (type==='svadba') ? 'flex' : 'none';
  document.getElementById('pr-stuzkova-fields').style.display = (type==='stuzkova') ? 'flex' : 'none';
  document.getElementById('pr-schedule-btn').style.display = (type==='svadba') ? 'inline-flex' : 'none';
  document.getElementById('pr-questionnaire-btn').style.display = (type==='svadba' || type==='stuzkova') ? 'inline-flex' : 'none';
  // Pri NOVEJ zákazke (nie pri úprave existujúcej) automaticky predvyplň bežné kroky
  // podľa zvoleného typu, ak checklist ešte nemá žiadne položky — ušetrí klik na "✨ Vyplniť bežné kroky".
  const isNewProject = !document.getElementById('pr-id').value;
  if(isNewProject && type && currentChecklist.length===0){
    addChecklistPreset();
  }
  recalcProjectPrice();
}
function populateBalikSelects(){
  const opts = '<option value="">— nevybraté —</option>' + PRICING.balicky.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  document.getElementById('w-balik').innerHTML = opts;
  document.getElementById('s-balik').innerHTML = opts;
}
function populatePriplatkyChecks(selectedIds){
  selectedIds = selectedIds || [];
  const el = document.getElementById('pr-priplatky-checks');
  el.innerHTML = PRICING.priplatky.map(p=>`
    <label style="display:flex;align-items:center;justify-content:space-between;text-transform:none;letter-spacing:0;font-size:13px;color:var(--text);margin:0;">
      <span style="display:flex;align-items:center;gap:8px;"><input type="checkbox" class="pr-priplatok-check" value="${p.id}" style="width:auto;" ${selectedIds.includes(p.id)?'checked':''} onchange="onPriceInputsChange()"> ${escapeHtml(p.name)}</span>
      <span class="num" style="color:var(--text-dim);">${fmtMoney(p.price)}</span>
    </label>`).join('') || '<div class="empty" style="padding:4px 0;">Zatiaľ žiadne príplatky (pridaj ich v Cenotvorbe).</div>';
}
function getSelectedBalikId(){
  const type = document.getElementById('pr-type').value;
  if(type==='svadba') return document.getElementById('w-balik').value;
  if(type==='stuzkova') return document.getElementById('s-balik').value;
  return '';
}
function onPriceInputsChange(){ recalcProjectPrice(); }
function recalcProjectPrice(){
  const balikId = getSelectedBalikId();
  const balik = PRICING.balicky.find(b=>b.id===balikId);
  const deadlineVal = document.getElementById('pr-deadline').value;
  const year = deadlineVal ? deadlineVal.slice(0,4) : new Date().getFullYear();
  const balikPrice = balik ? getBalikPrice(balikId, year) : 0;
  document.getElementById('pr-price-balik-label').textContent = balik ? `${balik.name} — ${fmtMoney(balikPrice)} (rok ${year})` : '—';

  const mimoOkresu = document.getElementById('pr-mimo-okresu').checked;
  document.getElementById('pr-km-row').style.display = mimoOkresu ? 'grid' : 'none';
  const km = mimoOkresu ? (Number(document.getElementById('pr-km').value) || 0) : 0;
  const cesta = km * (PRICING.kmRate || 0);
  document.getElementById('pr-price-cesta-label').value = fmtMoney(cesta);

  let priplatkySum = 0;
  document.querySelectorAll('.pr-priplatok-check:checked').forEach(chk=>{
    const p = PRICING.priplatky.find(x=>x.id===chk.value);
    if(p) priplatkySum += Number(p.price);
  });

  const total = balikPrice + cesta + priplatkySum;
  const totalEl = document.getElementById('pr-price-total');
  totalEl.textContent = fmtMoney(total);
  totalEl.dataset.rawValue = total;
}
function applyPriceToBudget(){
  const raw = Number(document.getElementById('pr-price-total').dataset.rawValue || 0);
  document.getElementById('pr-budget').value = raw;
  showToast('Cena aplikovaná do rozpočtu');
}
function setClientMode(mode){
  document.getElementById('pr-client-mode').value = mode;
  document.getElementById('client-mode-new-btn').classList.toggle('active', mode==='new');
  document.getElementById('client-mode-existing-btn').classList.toggle('active', mode==='existing');
  document.getElementById('pr-newclient-block').style.display = mode==='new' ? 'block' : 'none';
  document.getElementById('pr-existingclient-block').style.display = mode==='existing' ? 'block' : 'none';
  onProjectClientChange();
}
function onProjectClientChange(){
  const mode = document.getElementById('pr-client-mode').value;
  const box = document.getElementById('pr-client-contact');
  if(mode === 'new'){
    // Most zákazky are for a brand-new client — always show the contact fields
    // ready to type into, rather than hiding them behind a selection step.
    box.style.display = 'block';
    return;
  }
  const clientId = document.getElementById('pr-client').value;
  if(!clientId){ box.style.display = 'none'; return; }
  const c = DATA.clients.find(x=>x.id===clientId);
  if(!c){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  document.getElementById('pr-client-email').value = c.email||'';
  document.getElementById('pr-client-phone').value = c.phone||'';
  document.getElementById('pr-client-address').value = c.address||'';
}

/* ---- Status strip: priečinok / zmluva / faktúra at a glance ---- */
function renderProjectStatusIndicators(project){
  const folderBadge = document.getElementById('pr-status-folder-badge');
  const contractBadge = document.getElementById('pr-status-contract-badge');
  const invoiceBadge = document.getElementById('pr-status-invoice-badge');
  if(!folderBadge) return;

  const folderCreated = !!(project && project.folderCreated);
  folderBadge.textContent = folderCreated ? '📁 Priečinok: vytvorený' : '📁 Priečinok: nevytvorený';
  folderBadge.className = 'pr-indicator ' + (folderCreated ? 'state-done' : 'state-none');

  const generated = document.getElementById('pr-contract-generated').checked;
  const signed = document.getElementById('pr-contract-signed').checked;
  let contractText, contractClass;
  if(signed){ contractText = '📄 Zmluva: podpísaná'; contractClass = 'state-done'; }
  else if(generated){ contractText = '📄 Zmluva: vytvorená (nepodpísaná)'; contractClass = 'state-partial'; }
  else { contractText = '📄 Zmluva: nevytvorená'; contractClass = 'state-none'; }
  contractBadge.textContent = contractText;
  contractBadge.className = 'pr-indicator ' + contractClass;

  let invoiceText = '🧾 Faktúra: nevytvorená', invoiceClass = 'state-none';
  if(project && project.id){
    const related = DATA.invoices.filter(i=>i.projectId===project.id);
    if(related.length){
      const totalPaid = related.filter(i=>i.status==='uhradena').reduce((s,i)=>s+Number(i.amount||0),0);
      const budget = Number(project.budget)||0;
      const fullyPaid = budget>0 ? totalPaid>=budget : related.every(i=>i.status==='uhradena');
      const anySent = related.some(i=>i.sent);
      if(fullyPaid){ invoiceText = '🧾 Faktúra: zaplatená'; invoiceClass = 'state-done'; }
      else if(anySent){ invoiceText = '🧾 Faktúra: odoslaná (čaká na platbu)'; invoiceClass = 'state-partial'; }
      else{ invoiceText = '🧾 Faktúra: vytvorená (neodoslaná)'; invoiceClass = 'state-partial'; }
    }
  }
  invoiceBadge.textContent = invoiceText;
  invoiceBadge.className = 'pr-indicator ' + invoiceClass;

  if(project){
    renderMessageStatusIndicator(project);
    renderProfitSummary(project);
  }else{
    const msgBadge = document.getElementById('pr-status-messages-badge');
    if(msgBadge){ msgBadge.textContent = '💬 Správy: uložiť zákazku najprv'; msgBadge.className = 'pr-indicator state-none'; }
    const logEl = document.getElementById('pr-sent-messages-log');
    if(logEl) logEl.innerHTML = '';
    const msgChecklistEl = document.getElementById('pr-message-checklist');
    if(msgChecklistEl) msgChecklistEl.innerHTML = '';
    const profitEl = document.getElementById('pr-profit-summary');
    if(profitEl) profitEl.innerHTML = '<div class="empty">Uložiť zákazku najprv.</div>';
  }
}
function renderProfitSummary(project){
  const el = document.getElementById('pr-profit-summary');
  if(!el) return;
  const budget = Number(project.budget) || 0;
  const paidIncome = DATA.invoices
    .filter(i=>i.projectId===project.id && i.status==='uhradena')
    .reduce((s,i)=>s+Number(i.amount||0), 0);
  const unpaidIncome = DATA.invoices
    .filter(i=>i.projectId===project.id && i.status==='neuhradena')
    .reduce((s,i)=>s+Number(i.amount||0), 0);
  const costs = DATA.expenses
    .filter(e=>e.projectId===project.id)
    .reduce((s,e)=>s+Number(e.amount||0), 0);
  const profit = paidIncome - costs;
  const hours = (project.timeEntries||[]).reduce((s,t)=>s+Number(t.hours||0), 0);
  const profitColor = profit >= 0 ? '#22c55e' : '#ff4d4d';
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;">
      <div><div class="row-sub">Rozpočet</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;">${fmtMoney(budget)}</div></div>
      <div><div class="row-sub">Uhradené faktúry</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:#22c55e;">${fmtMoney(paidIncome)}</div></div>
      <div><div class="row-sub">Neuhradené faktúry</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;">${fmtMoney(unpaidIncome)}</div></div>
      <div><div class="row-sub">Náklady na zákazku</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:#ff8a00;">${fmtMoney(costs)}</div></div>
      <div><div class="row-sub">Zisk (uhradené − náklady)</div><div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:${profitColor};">${fmtMoney(profit)}</div></div>
      <div><div class="row-sub">Odpracované hodiny</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;">${hours} h</div></div>
    </div>
    <p class="row-sub" style="margin:10px 0 0;">Zisk počíta len uhradené faktúry (nie celý rozpočet) mínus priradené náklady — hodiny sú len informačné, nepočítajú sa do peňazí.</p>`;
}
function onContractFlagsChange(){
  const id = document.getElementById('pr-id').value;
  if(id){
    const p = DATA.projects.find(x=>x.id===id);
    if(p){
      p.contractGenerated = document.getElementById('pr-contract-generated').checked;
      p.contractSigned = document.getElementById('pr-contract-signed').checked;
      saveKey('projects', DATA.projects);
      renderProjectStatusIndicators(p);
      return;
    }
  }
  renderProjectStatusIndicators(null);
}

/* ---- Signature pad: draw a client signature and embed it into the contract PDF ---- */
