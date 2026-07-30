/* ===================== 12-bookings.js =====================
   Rezervácie (CRUD), synchronizácia so zákazkami, export .ics.
   ===================================================== */

function openBookingModal(id, prefillDate){
  populateClientSelects();
  const editing = !!id;
  document.getElementById('bookingModalTitle').textContent = editing ? 'Upraviť rezerváciu' : 'Nová rezervácia';
  document.getElementById('bk-delete').style.display = editing ? 'inline-flex' : 'none';
  if(editing){
    const b = DATA.bookings.find(x=>x.id===id);
    document.getElementById('bk-id').value = b.id;
    document.getElementById('bk-title').value = b.title||'';
    document.getElementById('bk-client').value = b.clientId||'';
    document.getElementById('bk-date').value = b.date||'';
    document.getElementById('bk-time').value = b.time||'';
    document.getElementById('bk-location').value = b.location||'';
    document.getElementById('bk-tags').value = (b.tags||[]).join(', ');
    document.getElementById('bk-status').value = b.status||'dopyt';
    document.getElementById('bk-notes').value = b.notes||'';
  }else{
    document.getElementById('bk-id').value = '';
    document.getElementById('bk-title').value = '';
    document.getElementById('bk-client').value = '';
    document.getElementById('bk-date').value = prefillDate || toLocalISODate(new Date());
    document.getElementById('bk-time').value = '';
    document.getElementById('bk-location').value = '';
    document.getElementById('bk-tags').value = '';
    document.getElementById('bk-status').value = 'dopyt';
    document.getElementById('bk-notes').value = '';
  }
  openModal('modal-booking');
}
async function saveBooking(){
  const id = document.getElementById('bk-id').value || uid();
  const title = document.getElementById('bk-title').value.trim();
  if(!title){ showToast('Zadaj názov rezervácie'); return; }
  const tags = document.getElementById('bk-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const date = document.getElementById('bk-date').value;

  const conflicting = DATA.bookings.filter(b=>b.id!==id && b.date===date);
  if(conflicting.length){
    const names = conflicting.map(b=>b.title||'bez názvu').join(', ');
    const proceed = confirm(`Na ${fmtDate(date)} už máš rezerváciu: ${names}.\n\nChceš aj tak uložiť túto rezerváciu na rovnaký deň?`);
    if(!proceed) return;
  }

  const booking = {
    id, title,
    clientId: document.getElementById('bk-client').value,
    date,
    time: document.getElementById('bk-time').value,
    location: document.getElementById('bk-location').value.trim(),
    tags,
    status: document.getElementById('bk-status').value,
    notes: document.getElementById('bk-notes').value.trim()
  };
  const idx = DATA.bookings.findIndex(b=>b.id===id);
  if(idx>-1) DATA.bookings[idx]=booking; else DATA.bookings.push(booking);
  await saveKey('bookings', DATA.bookings);
  closeModal('modal-booking'); renderAll(); showToast('Rezervácia uložená');
}
async function deleteBooking(){
  const id = document.getElementById('bk-id').value;
  const item = DATA.bookings.find(b=>b.id===id);
  DATA.bookings = DATA.bookings.filter(b=>b.id!==id);
  await saveKey('bookings', DATA.bookings);
  if(item) await moveToTrash('booking', item);
  closeModal('modal-booking'); renderAll(); showToast('Rezervácia odstránená (v Koši 30 dní)');
}

/* ---- Sync project deadlines into calendar bookings ---- */
async function syncProjectsToCalendar(){
  const existingProjectIds = new Set(DATA.bookings.filter(b=>b.projectId).map(b=>b.projectId));
  let created = 0, updated = 0;
  DATA.projects.forEach(p=>{
    if(!p.deadline) return;
    const location = (p.wedding && p.wedding.svadbaMiesto) || (p.stuzkova && p.stuzkova.miesto) || '';
    const time = (p.wedding && p.wedding.sobasCas) || '';
    if(existingProjectIds.has(p.id)){
      // update date/location/time if project changed since last sync
      const b = DATA.bookings.find(x=>x.projectId===p.id);
      if(b){
        b.date = p.deadline; b.title = p.title; b.clientId = p.clientId;
        b.location = location; b.time = b.time || time; b.tags = p.tags || [];
        updated++;
      }
    }else{
      DATA.bookings.push({
        id: uid(), title: p.title, clientId: p.clientId||'', date: p.deadline, time,
        location, tags: p.tags||[], status: 'zabookovane',
        notes: 'Automaticky vytvorené zo zákazky.', projectId: p.id
      });
      created++;
    }
  });
  await saveKey('bookings', DATA.bookings);
  renderAll();
  showToast(`Kalendár aktualizovaný: ${created} nových, ${updated} aktualizovaných rezervácií`);
}

/* ---- Export bookings as .ics for Apple Calendar ---- */
function icsEscape(str){
  return String(str||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function exportICS(){
  if(!DATA.bookings.length){ showToast('Zatiaľ nemáš žiadne rezervácie na export'); return; }
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SLATE//Produkcny manazer//SK','CALSCALE:GREGORIAN'];
  DATA.bookings.forEach(b=>{
    if(!b.date) return;
    const client = DATA.clients.find(c=>c.id===b.clientId);
    const dateStr = b.date.replace(/-/g,'');
    let dtStart, dtEnd, allDay = !b.time;
    if(b.time){
      const [hh,mm] = b.time.split(':');
      dtStart = `${dateStr}T${hh}${mm}00`;
      const endHour = (parseInt(hh,10)+2) % 24;
      dtEnd = `${dateStr}T${String(endHour).padStart(2,'0')}${mm}00`;
    }
    const desc = [
      client ? `Klient: ${client.name}` : '',
      client && client.phone ? `Tel: ${client.phone}` : '',
      b.location ? `Miesto: ${b.location}` : '',
      b.notes ? b.notes : ''
    ].filter(Boolean).join('\\n');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${b.id}@slate-app`);
    lines.push(`SUMMARY:${icsEscape(b.title||'Rezervácia')}`);
    if(allDay){
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    }else{
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }
    if(b.location) lines.push(`LOCATION:${icsEscape(b.location)}`);
    if(desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type:'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'slate-rezervacie.ics';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Súbor .ics stiahnutý — otvor ho a appka Kalendár ho naimportuje');
}

/* --- Client modal --- */
