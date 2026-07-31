/* ===================== 08-dashboard.js =====================
   Dashboard — chýbajúce správy, výročia, rýchle poznámky, ročný cieľ a súhrn.
   ===================================================== */

function renderDashboard(){
  const today = new Date();
  document.getElementById('todayDate').textContent = today.toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'});
  const todayStr = toLocalISODate(today);
  const todaysBookings = DATA.bookings.filter(b=>b.date===todayStr);
  document.getElementById('todayCount').textContent = todaysBookings.length;

  const activeStatuses = ['dopyt','zabookovane','nakrutene','spracovane'];
  const activeProjects = DATA.projects.filter(p=>activeStatuses.includes(p.status));
  document.getElementById('activeCount').textContent = activeProjects.length;

  document.getElementById('statClients').textContent = DATA.clients.length;

  const curMonth = today.getMonth(), curYear = today.getFullYear();
  const monthBookings = DATA.bookings.filter(b=>{
    const d = new Date(b.date+'T00:00:00');
    return d.getMonth()===curMonth && d.getFullYear()===curYear;
  });
  document.getElementById('statBookings').textContent = monthBookings.length;

  const unpaid = DATA.invoices.filter(i=>i.status==='neuhradena').reduce((s,i)=>s+Number(i.amount||0),0);
  document.getElementById('statUnpaid').textContent = fmtMoney(unpaid);
  const paidThisMonth = DATA.invoices.filter(i=>{
    if(i.status!=='uhradena' || !i.due) return false;
    const d = new Date(i.due+'T00:00:00');
    return d.getMonth()===curMonth && d.getFullYear()===curYear;
  }).reduce((s,i)=>s+Number(i.amount||0),0);
  document.getElementById('statPaid').textContent = fmtMoney(paidThisMonth);

  // upcoming bookings
  const upcoming = DATA.bookings.filter(b=>b.date>=todayStr).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
  const ub = document.getElementById('upcomingBookings');
  ub.innerHTML = upcoming.length ? upcoming.map(b=>{
    const client = DATA.clients.find(c=>c.id===b.clientId);
    return `<div class="list-row" onclick="openBookingModal('${b.id}')">
      <div class="row-main"><div class="row-title">${escapeHtml(b.title||'Bez názvu')}</div><div class="row-sub">${client?escapeHtml(client.name):'—'} · ${fmtDate(b.date)} ${b.time||''}</div></div>
      <span class="pill status-${b.status}">${STATUS_LABELS[b.status]||b.status}</span>
    </div>`;
  }).join('') : '<div class="empty">Žiadne nadchádzajúce rezervácie.</div>';

  // upcoming projects by deadline
  const upcomingProj = DATA.projects.filter(p=>p.deadline && activeStatuses.includes(p.status)).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,5);
  const up = document.getElementById('upcomingProjects');
  up.innerHTML = upcomingProj.length ? upcomingProj.map(p=>{
    const client = DATA.clients.find(c=>c.id===p.clientId);
    return `<div class="list-row" onclick="openProjectModal('${p.id}')">
      <div class="row-main"><div class="row-title">${escapeHtml(p.title||'Bez názvu')}</div><div class="row-sub">${client?escapeHtml(client.name):'—'} · termín ${fmtDate(p.deadline)}</div></div>
      <span class="pill status-${p.status}">${STATUS_LABELS[p.status]||p.status}</span>
    </div>`;
  }).join('') : '<div class="empty">Žiadne blížiace sa termíny.</div>';

  renderYearlySummary(curYear);
  renderTodoPanel();
  renderMissingMessages();
  renderAnniversaries();
  renderQuickNotes();
  checkBackupReminder();
  maybeAutoLoadWeather();
}
/* ===================== Jednotný TO-DO panel =====================
   Zbiera na jedno miesto: nesplnené checklist položky z aktívnych zákaziek
   + nezaplatené faktúry po splatnosti — namiesto preklikávania sa cez každú zákazku zvlášť. */
function renderTodoPanel(){
  const panel = document.getElementById('todoPanel');
  const el = document.getElementById('todoList');
  if(!panel || !el) return;
  const todayStr = toLocalISODate(new Date());
  const activeStatuses = ['dopyt','zabookovane','nakrutene','spracovane'];
  const items = [];

  DATA.invoices.forEach(i=>{
    if(i.status==='neuhradena' && i.due && i.due < todayStr){
      const client = DATA.clients.find(c=>c.id===i.clientId);
      const project = DATA.projects.find(p=>p.id===i.projectId);
      items.push({
        urgency: 0, sortKey: i.due,
        icon: '💸', title: `Faktúra ${i.number||'bez čísla'} po splatnosti`,
        sub: `${client?client.name:'— bez klienta —'}${project?' · '+project.title:''} · splatnosť ${fmtDate(i.due)}`,
        onclick: `openInvoiceModal('${i.id}')`
      });
    }
  });

  DATA.projects.forEach(p=>{
    if(!activeStatuses.includes(p.status)) return;
    (p.checklist||[]).forEach(item=>{
      if(item.done) return;
      items.push({
        urgency: 1, sortKey: p.deadline || '9999-99-99',
        icon: '☑️', title: item.text,
        sub: `${p.title||'Bez názvu'}${p.deadline?' · termín '+fmtDate(p.deadline):''}`,
        onclick: `openProjectModal('${p.id}')`
      });
    });
  });

  if(!items.length){
    panel.classList.remove('panel-attention');
    el.innerHTML = '<div class="empty">✓ Nič naliehavé — všetko pod kontrolou.</div>';
    return;
  }
  items.sort((a,b)=> a.urgency-b.urgency || a.sortKey.localeCompare(b.sortKey));
  panel.classList.add('panel-attention');
  const MAX_SHOWN = 12;
  const shown = items.slice(0, MAX_SHOWN);
  el.innerHTML = shown.map(it=>`
    <div class="list-row" onclick="${it.onclick}">
      <div class="row-main"><div class="row-title">${it.icon} ${escapeHtml(it.title)}</div><div class="row-sub">${escapeHtml(it.sub)}</div></div>
    </div>`).join('') + (items.length>MAX_SHOWN ? `<div class="row-sub" style="padding:8px 4px;">+ ${items.length-MAX_SHOWN} ďalších položiek</div>` : '');
}
var lastWeatherAutoAttempt = 0;
function maybeAutoLoadWeather(){
  // Skúša znova pre KAŽDÚ blížiacu sa svadbu/stužkovú, ktorá ešte nemá úspešne stiahnuté počasie
  // (namiesto trvalého "len raz za reláciu" zámku, ktorý by sa natrvalo zaseknul po
  // jednom zlyhanom pokuse). Krátky cooldown len bráni zbytočnému bombardovaniu API
  // pri rýchlom prekliknutí medzi stránkami.
  const todayStr = toLocalISODate(new Date());
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()+16);
  const cutoffStr = toLocalISODate(cutoff);
  const stillNeedsWeather = DATA.projects.some(p=>
    p.deadline && p.deadline>=todayStr && p.deadline<=cutoffStr &&
    getProjectWeatherLocation(p) && !weatherCache[p.deadline]
  );
  if(!stillNeedsWeather) return;
  const now = Date.now();
  if(now - lastWeatherAutoAttempt < 60000) return; // cooldown 60s medzi automatickými pokusmi
  lastWeatherAutoAttempt = now;
  loadWeatherForecasts();
}
/* ===================== Rýchle poznámky (Dashboard) =====================
   Malý "nalepovací lístok" na veci, ktoré nepatria ku konkrétnej zákazke. */
async function addQuickNote(){
  const input = document.getElementById('quick-note-input');
  const text = input.value.trim();
  if(!text) return;
  DATA.quickNotes.unshift({ id: uid(), text, createdAt: new Date().toISOString() });
  await saveKey('quickNotes', DATA.quickNotes);
  input.value = '';
  renderQuickNotes();
}
async function deleteQuickNote(id){
  DATA.quickNotes = DATA.quickNotes.filter(n=>n.id!==id);
  await saveKey('quickNotes', DATA.quickNotes);
  renderQuickNotes();
}
function renderQuickNotes(){
  const el = document.getElementById('quickNotesList');
  if(!el) return;
  if(!DATA.quickNotes.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne poznámky.</div>'; return; }
  el.innerHTML = DATA.quickNotes.map(n=>`
    <div class="list-row" style="padding:7px 4px;">
      <div class="row-main"><div class="row-title" style="font-size:13px;font-weight:500;">${escapeHtml(n.text)}</div></div>
      <button class="icon-btn" onclick="deleteQuickNote('${n.id}')" title="Odstrániť">✕</button>
    </div>`).join('');
}
function renderAnniversaries(){
  const el = document.getElementById('anniversariesList');
  if(!el) return;
  const today = new Date();
  const windowDays = 30;
  const upcoming = [];
  DATA.projects.forEach(p=>{
    if(p.type!=='svadba' || !p.deadline) return;
    const wDate = new Date(p.deadline+'T00:00:00');
    const yearsPassed = today.getFullYear() - wDate.getFullYear();
    if(yearsPassed < 1) return; // len svadby, ktoré sa už reálne konali aspoň pred rokom
    const thisYearAnniv = new Date(today.getFullYear(), wDate.getMonth(), wDate.getDate());
    const diffDays = Math.round((thisYearAnniv - today) / (1000*60*60*24));
    if(diffDays >= 0 && diffDays <= windowDays){
      const client = DATA.clients.find(c=>c.id===p.clientId);
      upcoming.push({ project:p, client, diffDays, years: yearsPassed });
    }
  });
  upcoming.sort((a,b)=>a.diffDays-b.diffDays);
  if(!upcoming.length){ el.innerHTML = '<div class="empty">Žiadne výročia v najbližších 30 dňoch.</div>'; return; }
  el.innerHTML = upcoming.map(u=>`
    <div class="list-row" onclick="openProjectModal('${u.project.id}')">
      <div class="row-main">
        <div class="row-title">${u.years}. výročie — ${u.client?escapeHtml(u.client.name):escapeHtml(u.project.title)}</div>
        <div class="row-sub">${u.diffDays===0?'dnes! 🎉':'o '+u.diffDays+' dní'} · pôvodná svadba ${fmtDate(u.project.deadline)}</div>
      </div>
    </div>`).join('');
}
function checkBackupReminder(){
  const banner = document.getElementById('backupReminderBanner');
  if(!banner) return;
  const lastBackup = localStorage.getItem('slate:lastAutoBackupTime');
  const hasAutoBackup = !!autoBackupHandle;
  if(!lastBackup){
    banner.style.display = hasAutoBackup ? 'none' : 'flex';
    return;
  }
  const daysSince = Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000*60*60*24));
  banner.style.display = daysSince >= 7 ? 'flex' : 'none';
  const textEl = document.getElementById('backupReminderText');
  if(textEl) textEl.textContent = `⚠️ Posledná záloha bola pred ${daysSince} dňami — over si zálohovanie v Nastaveniach.`;
}
function renderMissingMessages(){
  const panel = document.getElementById('missingMessagesPanel');
  const el = document.getElementById('missingMessagesList');
  if(!panel || !el) return;
  const items = getProjectsWithMissingMessages();
  if(!items.length){
    panel.classList.remove('panel-attention');
    el.innerHTML = '<div class="empty">✓ Všetky zákazky majú poslané správy, ktoré sa od nich očakávajú.</div>';
    return;
  }
  panel.classList.add('panel-attention');
  el.innerHTML = items.map(({project, missing})=>{
    const client = DATA.clients.find(c=>c.id===project.clientId);
    return `<div class="missing-msg-row" onclick="openProjectModal('${project.id}')">
      <div class="row-main">
        <div class="row-title">${escapeHtml(project.title||'Bez názvu')}</div>
        <div class="row-sub">${client?escapeHtml(client.name):'— bez klienta —'}${project.deadline?' · '+fmtDate(project.deadline):''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${missing.map(m=>`<button class="missing-msg-badge" onclick="event.stopPropagation(); quickSendMissingMessage('${project.id}','${m.key}')" title="Poslať teraz">${escapeHtml(m.label)} ↗</button>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function findTemplateForKey(key){
  return (DATA.settings.messageTemplates||[]).find(t=>classifyTemplateKey(t.name)===key);
}
async function quickSendMissingMessage(projectId, key){
  const project = DATA.projects.find(p=>p.id===projectId);
  if(!project) return;
  const client = DATA.clients.find(c=>c.id===project.clientId);
  if(!client || !client.phone){ showToast('Klient nemá uložené telefónne číslo — otvor zákazku a doplň ho'); return; }
  const template = findTemplateForKey(key);
  if(!template){ showToast('Nenašla sa vhodná šablóna pre tento typ správy — over v Nastaveniach'); return; }
  const message = substituteMessagePlaceholders(template.text, project, client);
  openWhatsapp(client.phone, message);
  if(!project.sentMessages) project.sentMessages = [];
  project.sentMessages.push({ templateId: template.id, templateName: template.name, sentAt: new Date().toISOString() });
  await saveKey('projects', DATA.projects);
  renderMissingMessages();
  updateNavBadges();
  showToast('Správa odoslaná a zaznamenaná');
}
function renderYearlySummary(year){
  document.getElementById('yearlySummaryTitle').textContent = `Ročný súhrn — ${year}`;
  const yearProjects = DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(String(year)));
  const total = yearProjects.length;
  const revenue = yearProjects.reduce((s,p)=>s+(Number(p.budget)||0),0);
  const avg = total ? revenue/total : 0;
  const yearExpenses = DATA.expenses.filter(e=>e.date && e.date.startsWith(String(year))).reduce((s,e)=>s+Number(e.amount||0),0);
  const netProfit = revenue - yearExpenses;
  const byType = { svadba:0, stuzkova:0, klip:0, ine:0 };
  yearProjects.forEach(p=>{ byType[p.type||'ine'] = (byType[p.type||'ine']||0)+1; });
  const typeLabels = { svadba:'💍 Svadby', stuzkova:'🎓 Stužkové', klip:'🎬 Klipy', ine:'Iné' };

  const yearPaidIncome = DATA.invoices.filter(i=>{
    if(i.status !== 'uhradena') return false;
    const project = DATA.projects.find(p=>p.id===i.projectId);
    const dateStr = (project && project.deadline) || i.due;
    return dateStr && dateStr.startsWith(String(year));
  }).reduce((s,i)=>s+Number(i.amount||0),0);
  const goal = DATA.settings.yearlyGoals && DATA.settings.yearlyGoals[year];
  let goalHtml = '';
  if(goal){
    const pct = Math.min(100, Math.round((yearPaidIncome/goal)*100));
    const remaining = Math.max(0, goal - yearPaidIncome);
    goalHtml = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
          <span>🎯 Cieľ ${fmtMoney(goal)} — <b style="color:var(--text);">${pct}%</b> splnené</span>
          <span class="row-sub">${remaining>0 ? 'Chýba '+fmtMoney(remaining) : 'Cieľ splnený! 🎉'}</span>
        </div>
        <div style="height:10px;background:var(--surface-3);border-radius:20px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, var(--accent), var(--accent-hover));border-radius:20px;transition:width .3s var(--ease);"></div>
        </div>
      </div>`;
  }

  const el = document.getElementById('yearlySummary');
  el.innerHTML = `
    ${goalHtml}
    <div class="grid-stats" style="margin-bottom:14px;">
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Zákaziek za rok</div></div>
      <div class="stat-card"><div class="stat-num">${fmtMoney(revenue)}</div><div class="stat-label">Obrat (podľa dátumu zákazky)</div></div>
      <div class="stat-card"><div class="stat-num">${fmtMoney(yearExpenses)}</div><div class="stat-label">Náklady za rok</div></div>
      <div class="stat-card"><div class="stat-num" style="color:${netProfit>=0?'var(--green-page)':'#f0827f'};">${fmtMoney(netProfit)}</div><div class="stat-label">Čistý zisk</div></div>
      <div class="stat-card"><div class="stat-num">${fmtMoney(avg)}</div><div class="stat-label">Priemerná cena za zákazku</div></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${Object.keys(typeLabels).map(t=>`<span class="tag-pill" style="font-size:12px;padding:5px 12px;">${typeLabels[t]}: ${byType[t]||0}</span>`).join('')}
    </div>
  `;
}
async function saveYearlyGoal(){
  const year = new Date().getFullYear();
  const val = Number(document.getElementById('set-yearlyGoal').value) || 0;
  if(!DATA.settings.yearlyGoals) DATA.settings.yearlyGoals = {};
  if(val > 0) DATA.settings.yearlyGoals[year] = val;
  else delete DATA.settings.yearlyGoals[year];
  await saveKey('settings', DATA.settings);
  showToast('Ročný cieľ uložený');
  renderYearlySummary(year);
}

/* ===================== RENDER: CALENDAR ===================== */
