/* ===================== 10-clients-projects-list.js =====================
   Zoznamy klientov, zákaziek (kanban) a faktúr (vrátane hromadných akcií).
   ===================================================== */

function renderClients(){
  const q = (document.getElementById('clientSearch').value||'').toLowerCase();
  const list = DATA.clients.filter(c=>!q || (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q));
  const el = document.getElementById('clientsList');
  if(!list.length){ el.innerHTML = '<div class="empty">Žiadni klienti. Pridaj prvého tlačidlom vyššie.</div>'; return; }
  el.innerHTML = list.map(c=>{
    const bookingsCount = DATA.bookings.filter(b=>b.clientId===c.id).length;
    const projectsCount = DATA.projects.filter(p=>p.clientId===c.id).length;
    const waBtn = c.phone ? `<button class="icon-btn" style="color:#25D366;" onclick="event.stopPropagation();openWhatsappForClient('${c.id}')" title="Napísať na WhatsApp">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.15 8.15 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.45-1.37-1.7-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.06 0 1.22.88 2.39 1.01 2.56.12.17 1.74 2.67 4.23 3.73.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28z"/></svg>
    </button>` : '';
    return `<div class="list-row" onclick="openClientModal('${c.id}')">
      <div class="row-main"><div class="row-title">${escapeHtml(c.name||'Bez mena')}</div><div class="row-sub">${escapeHtml(c.email||c.phone||'')}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="row-tag">${projectsCount} zákaziek · ${bookingsCount} rezervácií</div>
        ${waBtn}
      </div>
    </div>`;
  }).join('');
}

/* ===================== RENDER: PROJECTS (KANBAN) ===================== */
var projectFilters = { clientId:'', tag:'', year:'', sort:'deadline-asc' };
function getFilteredProjects(){
  const filtered = DATA.projects.filter(p=>{
    if(projectFilters.clientId && p.clientId !== projectFilters.clientId) return false;
    if(projectFilters.tag){
      const q = projectFilters.tag.toLowerCase().trim();
      const tags = (p.tags||[]).map(t=>t.toLowerCase());
      if(!tags.some(t=>t.includes(q))) return false;
    }
    if(projectFilters.year){
      if(!p.deadline || !p.deadline.startsWith(projectFilters.year)) return false;
    }
    return true;
  });
  const sort = projectFilters.sort || 'deadline-asc';
  filtered.sort((a,b)=>{
    if(sort==='name-asc') return (a.title||'').localeCompare(b.title||'', 'sk');
    if(sort==='budget-desc') return (Number(b.budget)||0) - (Number(a.budget)||0);
    if(sort==='budget-asc') return (Number(a.budget)||0) - (Number(b.budget)||0);
    // deadline-asc / deadline-desc: items without a deadline always sink to the bottom
    if(!a.deadline && !b.deadline) return 0;
    if(!a.deadline) return 1;
    if(!b.deadline) return -1;
    return sort==='deadline-desc' ? b.deadline.localeCompare(a.deadline) : a.deadline.localeCompare(b.deadline);
  });
  return filtered;
}
function onProjectFilterChange(){
  projectFilters.clientId = document.getElementById('pr-filter-client').value;
  projectFilters.tag = document.getElementById('pr-filter-tag').value;
  projectFilters.sort = document.getElementById('pr-sort').value;
  clearQuickFilterHighlight();
  renderProjects();
}
function clearProjectFilters(){
  document.getElementById('pr-filter-client').value = '';
  document.getElementById('pr-filter-tag').value = '';
  document.getElementById('pr-sort').value = 'deadline-asc';
  projectFilters = { clientId:'', tag:'', year:'', sort:'deadline-asc' };
  clearQuickFilterHighlight();
  renderProjects();
}
function clearQuickFilterHighlight(){
  document.querySelectorAll('.quick-filter-btn').forEach(b=>b.classList.remove('active'));
}
function setQuickFilter(tag, year, btnEl){
  projectFilters.tag = tag;
  projectFilters.year = year;
  document.getElementById('pr-filter-tag').value = tag;
  clearQuickFilterHighlight();
  if(btnEl) btnEl.classList.add('active');
  renderProjects();
}
/* ---- Veľký prehľadný filter podľa roka (dynamicky podľa toho, čo je v dátach) ---- */
function renderYearTileBar(){
  const el = document.getElementById('yearTileBar');
  if(!el) return;
  const years = new Set();
  DATA.projects.forEach(p=>{ if(p.deadline) years.add(p.deadline.slice(0,4)); });
  const curYear = new Date().getFullYear();
  years.add(String(curYear));
  years.add(String(curYear+1));
  const sortedYears = Array.from(years).sort();
  const countFor = y => DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(y)).length;
  const allActive = !projectFilters.year;
  el.innerHTML = `
    <div class="year-tile ${allActive?'active':''}" onclick="setYearFilter('')">
      <div class="year-tile-num">Všetky</div>
      <div class="year-tile-count">${DATA.projects.length} zákaziek</div>
    </div>
    ${sortedYears.map(y=>`
    <div class="year-tile ${projectFilters.year===y?'active':''}" onclick="setYearFilter('${y}')">
      <div class="year-tile-num">${y}</div>
      <div class="year-tile-count">${countFor(y)} zákaziek</div>
    </div>`).join('')}
  `;
}
function setYearFilter(year){
  projectFilters.year = year;
  renderYearTileBar();
  renderProjects();
}
function populateProjectClientFilter(){
  const sel = document.getElementById('pr-filter-client');
  const current = sel.value;
  sel.innerHTML = '<option value="">Všetci</option>' + DATA.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = current;
}
var activeProjectStatusTab = 'dopyt';
function renderProjects(){
  renderYearTileBar();
  const filtered = getFilteredProjects();
  const todayStr = toLocalISODate(new Date());
  const soonCutoff = new Date(); soonCutoff.setDate(soonCutoff.getDate()+14);
  const soonStr = toLocalISODate(soonCutoff);

  // Tabs
  const tabsEl = document.getElementById('statusTabs');
  tabsEl.innerHTML = PROJECT_STATUSES.map(status=>{
    const count = filtered.filter(p=>p.status===status).length;
    return `<div class="status-tab ${status===activeProjectStatusTab?'active':''}" data-status="${status}" onclick="selectProjectStatusTab('${status}')">
      ${STATUS_LABELS[status]} <span class="status-tab-count">${count}</span>
    </div>`;
  }).join('');

  // Card grid for the selected tab only
  const gridEl = document.getElementById('projectsGrid');
  const items = filtered.filter(p=>p.status===activeProjectStatusTab);
  gridEl.innerHTML = items.map(p=>{
    const client = DATA.clients.find(c=>c.id===p.clientId);
    const tagsHtml = (p.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');
    const isPast = p.deadline && p.deadline < todayStr;
    const isSoon = p.deadline && p.deadline >= todayStr && p.deadline <= soonStr;
    const dateClass = isPast ? 'kcard-date-past' : (isSoon ? 'kcard-date-soon' : '');
    const dateLabel = p.deadline ? fmtDate(p.deadline) : 'bez termínu';
    const weeksLabel = p.deadline ? weeksSinceLabel(p.deadline) : '';
    const type = p.type || 'ine';
    const typeLabels = { svadba:'💍 Svadba', stuzkova:'🎓 Stužková', klip:'🎬 Klip', ine:'' };
    const typeTag = typeLabels[type] ? `<div class="kcard-type-tag">${typeLabels[type]}</div>` : '';
    const stepIdx = PROJECT_STATUSES.indexOf(p.status);
    const checklist = p.checklist || [];
    const checklistDone = checklist.filter(i=>i.done).length;
    const checklistHtml = checklist.length ? `<span class="tag-pill" title="Checklist">✅ ${checklistDone}/${checklist.length}</span>` : '';
    const progressHtml = `<div class="kcard-progress">${PROJECT_STATUSES.map((s,i)=>`<div class="kcard-progress-seg ${i<=stepIdx?'filled':''}" data-seg="${s}"></div>`).join('')}</div>
      <div class="kcard-progress-labels"><span>Dopyt</span><span>Zabook.</span><span>Nakrút.</span><span>Sprac.</span><span>Zaplat.</span></div>`;
    return `<div class="kcard type-${type}" onclick="openProjectModal('${p.id}')">
      ${typeTag}
      <div class="kcard-top">
        <span class="kcard-date ${dateClass}">${dateLabel}</span>
        ${p.budget?`<span class="kcard-budget">${fmtMoney(p.budget)}</span>`:''}
      </div>
      <div class="kcard-title">${escapeHtml(p.title||'Bez názvu')}</div>
      <div class="kcard-meta"><span>${client?escapeHtml(client.name):'— bez klienta —'}</span>${weeksLabel?`<span>${weeksLabel}</span>`:''}</div>
      ${(tagsHtml||checklistHtml)?`<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${tagsHtml}${checklistHtml}</div>`:''}
      ${progressHtml}
    </div>`;
  }).join('') || '<div class="empty" style="padding:20px 0;grid-column:1/-1;">Žiadne zákazky v tomto stave.</div>';
}
function selectProjectStatusTab(status){
  activeProjectStatusTab = status;
  renderProjects();
}

/* ===================== RENDER: INVOICES ===================== */
function renderInvoices(){
  const todayStr = toLocalISODate(new Date());
  const unpaid = DATA.invoices.filter(i=>i.status==='neuhradena').reduce((s,i)=>s+Number(i.amount||0),0);
  const paid = DATA.invoices.filter(i=>i.status==='uhradena').reduce((s,i)=>s+Number(i.amount||0),0);
  const overdueCount = DATA.invoices.filter(i=>i.status==='neuhradena' && i.due && i.due<todayStr).length;
  document.getElementById('invUnpaidTotal').textContent = fmtMoney(unpaid);
  document.getElementById('invPaidTotal').textContent = fmtMoney(paid);
  document.getElementById('invCountTotal').textContent = DATA.invoices.length;
  const overdueEl = document.getElementById('invOverdueCount');
  if(overdueEl) overdueEl.textContent = overdueCount;
  const overdueCardEl = document.getElementById('invOverdueCard');
  if(overdueCardEl) overdueCardEl.classList.toggle('stat-danger', overdueCount > 0);

  const tbody = document.getElementById('invoicesTable');
  const empty = document.getElementById('invoicesEmpty');
  if(!DATA.invoices.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  selectedInvoiceIds = selectedInvoiceIds.filter(id=>DATA.invoices.some(i=>i.id===id));
  tbody.innerHTML = DATA.invoices.slice().sort((a,b)=>(b.due||'').localeCompare(a.due||'')).map(i=>{
    const client = DATA.clients.find(c=>c.id===i.clientId);
    const isOverdue = i.status==='neuhradena' && i.due && i.due<todayStr;
    const statusPill = isOverdue
      ? `<span class="pill" style="background:rgba(224,86,86,.22);color:#e05656;">Po splatnosti</span>`
      : `<span class="pill inv-${i.status}">${i.status==='uhradena'?'Uhradená':'Neuhradená'}</span>`;
    const typeLabels = { cela:'Celá suma', zaloha:'Záloha', doplatok:'Doplatok' };
    const vatBadge = i.vatBase ? ` <span class="tag-pill" title="DPH ${i.vatRate}% zo základu ${fmtMoney(i.vatBase)}">DPH ${i.vatRate}%</span>` : '';
    const isChecked = selectedInvoiceIds.includes(i.id);
    return `<tr onclick="openInvoiceModal('${i.id}')" style="cursor:pointer;${isOverdue?'background:rgba(224,86,86,.06);':''}">
      <td onclick="event.stopPropagation();"><input type="checkbox" ${isChecked?'checked':''} onchange="toggleInvoiceSelection('${i.id}', this.checked)"></td>
      <td class="num">${escapeHtml(i.number||'—')}</td>
      <td>${typeLabels[i.type]||'Celá suma'}${vatBadge}</td>
      <td>${client?escapeHtml(client.name):'—'}</td>
      <td class="num">${fmtMoney(i.amount)}</td>
      <td class="num" style="${isOverdue?'color:#e05656;font-weight:700;':''}">${fmtDate(i.due)}</td>
      <td>${statusPill}</td>
    </tr>`;
  }).join('');
  updateInvoiceBulkBar();
}
var selectedInvoiceIds = [];
function toggleInvoiceSelection(id, checked){
  if(checked){ if(!selectedInvoiceIds.includes(id)) selectedInvoiceIds.push(id); }
  else { selectedInvoiceIds = selectedInvoiceIds.filter(x=>x!==id); }
  updateInvoiceBulkBar();
}
function toggleSelectAllInvoices(checked){
  selectedInvoiceIds = checked ? DATA.invoices.map(i=>i.id) : [];
  renderInvoices();
}
function clearInvoiceSelection(){
  selectedInvoiceIds = [];
  renderInvoices();
}
function updateInvoiceBulkBar(){
  const bar = document.getElementById('invoiceBulkBar');
  const countEl = document.getElementById('invoiceBulkCount');
  const selectAllEl = document.getElementById('invoiceSelectAll');
  if(!bar) return;
  bar.style.display = selectedInvoiceIds.length ? 'flex' : 'none';
  if(countEl) countEl.textContent = `${selectedInvoiceIds.length} vybraných`;
  if(selectAllEl) selectAllEl.checked = DATA.invoices.length>0 && selectedInvoiceIds.length === DATA.invoices.length;
}
async function bulkMarkInvoicesPaid(){
  if(!selectedInvoiceIds.length) return;
  if(!confirm(`Označiť ${selectedInvoiceIds.length} faktúr(y) ako uhradené?`)) return;
  DATA.invoices.forEach(i=>{ if(selectedInvoiceIds.includes(i.id)) i.status = 'uhradena'; });
  await saveKey('invoices', DATA.invoices);
  selectedInvoiceIds = [];
  renderInvoices();
  showToast('Faktúry označené ako uhradené');
}
