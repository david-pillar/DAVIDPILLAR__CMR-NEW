/* ===================== 11-app-core.js =====================
   Jadro appky — prepínanie stránok, odznaky v menu, globálne vyhľadávanie.
   ===================================================== */

function renderAll(){
  populateClientSelects();
  populateCalClientFilter();
  populateProjectClientFilter();
  renderDashboard();
  renderCalendar();
  renderDayAgenda();
  renderClients();
  renderProjects();
  renderInvoices();
  updateNavBadges();
}
/* ---- Sidebar attention badges: small red counters so problems are visible
   before you even click into a section. ---- */
function updateNavBadges(){
  const missingMsgCount = getProjectsWithMissingMessages().length;
  const dashboardBadge = document.getElementById('navBadgeDashboard');
  if(dashboardBadge){
    dashboardBadge.textContent = missingMsgCount;
    dashboardBadge.style.display = missingMsgCount>0 ? 'inline-flex' : 'none';
  }

  const todayStr = toLocalISODate(new Date());
  const todayBookingsCount = DATA.bookings.filter(b=>b.date===todayStr).length;
  const calendarBadge = document.getElementById('navBadgeCalendar');
  if(calendarBadge){
    calendarBadge.textContent = todayBookingsCount;
    calendarBadge.style.display = todayBookingsCount>0 ? 'inline-flex' : 'none';
  }

  const overdueInvoicesCount = DATA.invoices.filter(i=>i.status==='neuhradena' && i.due && i.due<todayStr).length;
  const invoicesBadge = document.getElementById('navBadgeInvoices');
  if(invoicesBadge){
    invoicesBadge.textContent = overdueInvoicesCount;
    invoicesBadge.style.display = overdueInvoicesCount>0 ? 'inline-flex' : 'none';
  }

  // Zákazky: termín už prešiel, ale stav sa nikdy neposunul ďalej — ľahko sa na to zabudne po natáčaní.
  const stuckProjectsCount = DATA.projects.filter(p=>
    p.deadline && p.deadline<todayStr && (p.status==='zabookovane'||p.status==='nakrutene')
  ).length;
  const projectsBadge = document.getElementById('navBadgeProjects');
  if(projectsBadge){
    projectsBadge.textContent = stuckProjectsCount;
    projectsBadge.style.display = stuckProjectsCount>0 ? 'inline-flex' : 'none';
  }

  // Kôš: položky, ktoré sa už o pár dní natrvalo vymažú — posledná šanca na obnovenie.
  const soonPurgeCutoff = Date.now() - (TRASH_RETENTION_DAYS-3)*24*60*60*1000;
  const soonToPurgeCount = DATA.trash.filter(t=>new Date(t.deletedAt).getTime() < soonPurgeCutoff).length;
  const trashBadge = document.getElementById('navBadgeTrash');
  if(trashBadge){
    trashBadge.textContent = soonToPurgeCount;
    trashBadge.style.display = soonToPurgeCount>0 ? 'inline-flex' : 'none';
  }

  // Nastavenia: chýbajúci IBAN by ti zablokoval QR platby na faktúrach.
  const missingIban = !DATA.settings.iban || !DATA.settings.iban.trim();
  const settingsBadge = document.getElementById('navBadgeSettings');
  if(settingsBadge){
    settingsBadge.textContent = '!';
    settingsBadge.style.display = missingIban ? 'inline-flex' : 'none';
  }
}

/* ---- Global search (clients + projects) ---- */
function onGlobalSearchInput(){
  const q = document.getElementById('global-search').value.trim().toLowerCase();
  const resultsEl = document.getElementById('global-search-results');
  if(!q){ resultsEl.style.display = 'none'; resultsEl.innerHTML=''; return; }

  const matchedClients = DATA.clients.filter(c=>(c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q)).slice(0,5);
  const matchedProjects = DATA.projects.filter(p=>(p.title||'').toLowerCase().includes(q)).slice(0,5);

  if(!matchedClients.length && !matchedProjects.length){
    resultsEl.innerHTML = '<div class="empty" style="padding:10px;">Nič sa nenašlo.</div>';
    resultsEl.style.display = 'block';
    return;
  }
  let html = '';
  if(matchedClients.length){
    html += `<div style="padding:6px 10px 2px;font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;">Klienti</div>`;
    html += matchedClients.map(c=>`<div class="list-row" style="padding:8px 10px;" onclick="goToSearchResult('client','${c.id}')">
      <div class="row-main"><div class="row-title">${escapeHtml(c.name)}</div><div class="row-sub">${escapeHtml(c.phone||c.email||'')}</div></div>
    </div>`).join('');
  }
  if(matchedProjects.length){
    html += `<div style="padding:6px 10px 2px;font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;">Zákazky</div>`;
    html += matchedProjects.map(p=>{
      const client = DATA.clients.find(c=>c.id===p.clientId);
      return `<div class="list-row" style="padding:8px 10px;" onclick="goToSearchResult('project','${p.id}')">
        <div class="row-main"><div class="row-title">${escapeHtml(p.title||'Bez názvu')}</div><div class="row-sub">${client?escapeHtml(client.name):''}${p.deadline?' · '+fmtDate(p.deadline):''}</div></div>
      </div>`;
    }).join('');
  }
  resultsEl.innerHTML = html;
  resultsEl.style.display = 'block';
}
function goToSearchResult(kind, id){
  document.getElementById('global-search').value = '';
  document.getElementById('global-search-results').style.display = 'none';
  if(kind==='client'){
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="clients"]').classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-clients').classList.add('active');
    currentView = 'clients';
    openClientModal(id);
  }else{
    openProjectModal(id);
  }
}
document.addEventListener('click', (e)=>{
  const searchBox = document.getElementById('global-search');
  const resultsEl = document.getElementById('global-search-results');
  if(searchBox && resultsEl && !searchBox.contains(e.target) && !resultsEl.contains(e.target)){
    resultsEl.style.display = 'none';
  }
});

function populateClientSelects(){
  const opts = '<option value="">— vyber klienta —</option>' + DATA.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  ['bk-client','pr-client','iv-client'].forEach(id=>{ document.getElementById(id).innerHTML = opts; });
  const projOpts = '<option value="">— žiadna —</option>' + DATA.projects.map(p=>`<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
  document.getElementById('iv-project').innerHTML = projOpts;
}

function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ===================== MODALS ===================== */
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.classList.remove('open'); });
});

/* --- Booking modal --- */
