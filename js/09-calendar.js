/* ===================== 09-calendar.js =====================
   Kalendár — filtre, vykresľovanie, drag&drop, denná agenda, kontaktný hárok.
   ===================================================== */

function getFilteredBookings(){
  return DATA.bookings.filter(b=>{
    if(calFilters.clientId && b.clientId !== calFilters.clientId) return false;
    if(calFilters.status && b.status !== calFilters.status) return false;
    if(calFilters.tag){
      const q = calFilters.tag.toLowerCase().trim();
      const tags = (b.tags||[]).map(t=>t.toLowerCase());
      if(!tags.some(t=>t.includes(q))) return false;
    }
    return true;
  });
}
function onCalFilterChange(){
  calFilters.clientId = document.getElementById('cal-filter-client').value;
  calFilters.status = document.getElementById('cal-filter-status').value;
  calFilters.tag = document.getElementById('cal-filter-tag').value;
  renderCalendar();
  if(selectedDay) renderDayAgenda();
}
function clearCalFilters(){
  document.getElementById('cal-filter-client').value = '';
  document.getElementById('cal-filter-status').value = '';
  document.getElementById('cal-filter-tag').value = '';
  calFilters = { clientId:'', status:'', tag:'' };
  renderCalendar();
  if(selectedDay) renderDayAgenda();
}
function populateCalClientFilter(){
  const sel = document.getElementById('cal-filter-client');
  const current = sel.value;
  sel.innerHTML = '<option value="">Všetci</option>' + DATA.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = current;
}
function calShift(delta){
  calCursor.setMonth(calCursor.getMonth()+delta);
  renderCalendar();
}
function goToToday(){
  calCursor = new Date();
  selectedDay = toLocalISODate(new Date());
  renderCalendar();
  renderDayAgenda();
}
function bookingChipType(b){
  const tags = (b.tags||[]).map(t=>t.toLowerCase());
  if(tags.includes('svadba')) return 'svadba';
  if(tags.includes('stuzkova')) return 'stuzkova';
  if(tags.includes('klip')) return 'klip';
  return 'ine';
}
var CHIP_ICON = { svadba:'💍', stuzkova:'🎓', klip:'🎬', ine:'•' };
var CAL_TYPE_COLOR = { svadba:'#e0568a', stuzkova:'#3d8fe0', klip:'#e0c828', ine:'#9c9890' };
function renderCalendar(){
  const label = calCursor.toLocaleDateString('sk-SK',{month:'long', year:'numeric'});
  document.getElementById('calMonthLabel').textContent = label.charAt(0).toUpperCase()+label.slice(1);

  const year = calCursor.getFullYear(), month = calCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay()+6)%7; // Monday first
  const gridStart = new Date(year, month, 1-startOffset);

  const dows = ['Po','Ut','St','Št','Pi','So','Ne'];
  let html = dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');

  const filtered = getFilteredBookings();
  const todayStr = toLocalISODate(new Date());
  const soonCutoff = new Date(); soonCutoff.setDate(soonCutoff.getDate()+3);
  const soonCutoffStr = toLocalISODate(soonCutoff);
  const MAX_CHIPS = 3;
  for(let i=0;i<42;i++){
    const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
    const dStr = toLocalISODate(d);
    const inMonth = d.getMonth()===month;
    const items = filtered.filter(b=>b.date===dStr);
    const isSelected = dStr === selectedDay;
    const visibleItems = items.slice(0, MAX_CHIPS);
    const chipsHtml = visibleItems.map(b=>{
      const client = DATA.clients.find(c=>c.id===b.clientId);
      const label = client ? client.name : (b.title || 'Rezervácia');
      const type = bookingChipType(b);
      const fullInfo = `${b.title||''}${client?' — '+client.name:''}${b.time?' · '+b.time:''}${b.location?' · '+b.location:''}`;
      return `<div class="cal-chip type-${type}" draggable="true" ondragstart="onChipDragStart(event,'${b.id}')" onclick="event.stopPropagation(); openBookingModal('${b.id}')" title="${escapeHtml(fullInfo)} (potiahni na iný deň)">${CHIP_ICON[type]} ${escapeHtml(label)}</div>`;
    }).join('');
    const moreCount = items.length - visibleItems.length;
    const moreHtml = moreCount>0 ? `<div class="cal-chip-more">+${moreCount} ďalšie</div>` : '';
    const isSoon = items.length>0 && dStr>=todayStr && dStr<=soonCutoffStr;
    const countBadge = items.length>=2 ? `<div class="cal-day-count">${items.length}</div>` : '';
    const weatherEntry = weatherCache[dStr];
    const weatherRisky = weatherEntry && isWeatherRisky(weatherEntry.code, weatherEntry.pop);
    const popTitle = weatherEntry && typeof weatherEntry.pop==='number' ? ` · 💧${Math.round(weatherEntry.pop)}%` : '';
    const weatherBadge = weatherEntry ? `<div class="cal-day-weather${weatherRisky?' cal-day-weather-warn':''}" title="${weatherCodeToLabel(weatherEntry.code)} · ${Math.round(weatherEntry.tmin)}–${Math.round(weatherEntry.tmax)}°C${popTitle}">${weatherRisky?'⚠️':weatherCodeToEmoji(weatherEntry.code)}</div>` : '';
    // Deň s aspoň jednou rezerváciou dostane bielu žiaru + orámovanie vo farbe podľa typu
    // (ak je viac typov naraz, berie sa farba prvej rezervácie toho dňa).
    const dominantType = items.length ? bookingChipType(items[0]) : null;
    const cellColorStyle = dominantType ? `--cal-type-color:${CAL_TYPE_COLOR[dominantType]};` : '';
    const outlineStyle = isSelected ? 'outline:2px solid var(--accent);outline-offset:2px;' : '';
    html += `<div class="cal-day ${inMonth?'':'other-month'} ${dStr===todayStr?'today':''} ${isSoon?'cal-day-soon':''} ${items.length?'cal-day-active has-items':''}" style="${cellColorStyle}${outlineStyle}" onclick="selectDay('${dStr}')" ondragover="event.preventDefault()" ondragenter="this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="this.classList.remove('drag-over'); onDayDrop(event,'${dStr}')">
      ${countBadge}
      <div class="cal-daynum">${d.getDate()}<span class="cal-daynum-dow">${dows[(d.getDay()+6)%7]}</span>${weatherBadge}</div>
      <div class="cal-chips">${chipsHtml}${moreHtml}</div>
    </div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}
function onChipDragStart(ev, bookingId){
  ev.dataTransfer.setData('text/plain', bookingId);
  ev.dataTransfer.effectAllowed = 'move';
}
async function onDayDrop(ev, dateStr){
  ev.preventDefault();
  const bookingId = ev.dataTransfer.getData('text/plain');
  const b = DATA.bookings.find(x=>x.id===bookingId);
  if(!b || b.date === dateStr) return;
  const previousDate = b.date;
  const project = b.projectId ? DATA.projects.find(x=>x.id===b.projectId) : null;
  const previousProjectDeadline = project ? project.deadline : null;
  b.date = dateStr;
  await saveKey('bookings', DATA.bookings);
  if(project){ project.deadline = dateStr; await saveKey('projects', DATA.projects); }
  renderCalendar();
  renderDayAgenda();
  showToast('Rezervácia presunutá na '+fmtDate(dateStr)+(b.projectId ? ' (aj v zákazke)' : ''), '↺ Vrátiť späť', async ()=>{
    b.date = previousDate;
    await saveKey('bookings', DATA.bookings);
    if(project){ project.deadline = previousProjectDeadline; await saveKey('projects', DATA.projects); }
    renderCalendar();
    renderDayAgenda();
    showToast('Presun vrátený späť');
  });
}
function selectDay(dateStr){
  selectedDay = dateStr;
  renderCalendar();
  renderDayAgenda();
}
function renderDayAgenda(){
  const titleEl = document.getElementById('dayAgendaTitle');
  const listEl = document.getElementById('dayAgendaList');
  if(!selectedDay){ titleEl.textContent = 'Vyber deň v kalendári'; listEl.innerHTML = ''; return; }
  const items = getFilteredBookings().filter(b=>b.date===selectedDay).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const sheetBtn = items.length ? `<button class="btn ghost small" style="margin-left:8px;" onclick="generateDayContactSheet('${selectedDay}')">🖨️ Kontaktný hárok</button>` : '';
  titleEl.innerHTML = `${fmtDate(selectedDay)} <button class="btn ghost small" style="margin-left:10px;" onclick="openBookingModal(null, '${selectedDay}')">+ Pridať rezerváciu</button>${sheetBtn}`;
  listEl.innerHTML = items.length ? items.map(b=>{
    const client = DATA.clients.find(c=>c.id===b.clientId);
    const tagsHtml = (b.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');
    return `<div class="list-row" onclick="openBookingModal('${b.id}')">
      <div class="row-main">
        <div class="row-title">${escapeHtml(b.title||'Bez názvu')} ${b.time?`· ${b.time}`:''}</div>
        <div class="row-sub">${client?escapeHtml(client.name):'—'}${b.location?' · '+escapeHtml(b.location):''}</div>
        ${tagsHtml?`<div style="margin-top:4px;">${tagsHtml}</div>`:''}
      </div>
      <span class="pill status-${b.status}">${STATUS_LABELS[b.status]||b.status}</span>
    </div>`;
  }).join('') : '<div class="empty">Žiadne rezervácie v tento deň (podľa aktívnych filtrov).</div>';
}
function findVendorPhoneByName(name){
  if(!name) return '';
  const match = DATA.vendors.find(v=>v.name && v.name.toLowerCase().trim()===name.toLowerCase().trim());
  return match ? match.phone : '';
}
async function generateDayContactSheet(dateStr){
  const bookings = DATA.bookings.filter(b=>b.date===dateStr);
  if(!bookings.length){ showToast('Na tento deň nemáš žiadnu rezerváciu'); return; }
  const lines = [];
  lines.push('KONTAKTNÝ HÁROK');
  lines.push(fmtDate(dateStr));
  lines.push('');
  bookings.forEach((b, idx)=>{
    const project = b.projectId ? DATA.projects.find(p=>p.id===b.projectId) : null;
    const client = DATA.clients.find(c=>c.id===b.clientId) || (project ? DATA.clients.find(c=>c.id===project.clientId) : null);
    lines.push(`--- ${b.title || 'Bez názvu'} ${b.time?'('+b.time+')':''} ---`);
    if(b.location) lines.push(`Miesto: ${b.location}`);
    if(client) lines.push(`Klient: ${client.name}${client.phone?' — '+client.phone:''}`);
    if(project && project.type==='svadba' && project.wedding){
      const w = project.wedding;
      if(w.nevestaMeno) lines.push(`Nevesta: ${w.nevestaMeno}`);
      if(w.zenichMeno) lines.push(`Ženích: ${w.zenichMeno}`);
      if(w.sobasKostol) lines.push(`Sobáš: ${w.sobasKostol}${w.sobasCas?' o '+w.sobasCas:''}`);
      if(w.svadbaMiesto) lines.push(`Svadba: ${w.svadbaMiesto}`);
      if(w.fotograf){ const p = findVendorPhoneByName(w.fotograf); lines.push(`Fotograf: ${w.fotograf}${p?' — '+p:''}`); }
      if(w.hudbaMeno){ const p = findVendorPhoneByName(w.hudbaMeno); lines.push(`Hudba: ${w.hudbaMeno}${p?' — '+p:''}`); }
    }
    if(project && project.type==='stuzkova' && project.stuzkova){
      const s = project.stuzkova;
      if(s.miesto) lines.push(`Miesto: ${s.miesto}`);
      if(s.fotograf){ const p = findVendorPhoneByName(s.fotograf); lines.push(`Fotograf: ${s.fotograf}${p?' — '+p:''}`); }
      if(s.hudba){ const p = findVendorPhoneByName(s.hudba); lines.push(`Hudba: ${s.hudba}${p?' — '+p:''}`); }
    }
    if(idx < bookings.length-1) lines.push('');
  });
  if(!window.jspdf){ showToast('PDF knižnica sa ešte načítava, skús o chvíľu znova'); return; }
  const doc = renderTextToPdf(lines.join('\n'));
  doc.save(`kontaktny-harok-${dateStr}.pdf`);
  showToast('Kontaktný hárok stiahnutý');
}

/* ===================== RENDER: CLIENTS ===================== */
