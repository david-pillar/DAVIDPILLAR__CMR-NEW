/* ===================== 13-clients-crud.js =====================
   Vytváranie/úprava/mazanie klienta.
   ===================================================== */

function openClientModal(id){
  const editing = !!id;
  document.getElementById('clientModalTitle').textContent = editing ? 'Upraviť klienta' : 'Nový klient';
  document.getElementById('cl-delete').style.display = editing ? 'inline-flex' : 'none';
  const historyEl = document.getElementById('clientHistory');
  if(editing){
    const c = DATA.clients.find(x=>x.id===id);
    document.getElementById('cl-id').value = c.id;
    document.getElementById('cl-name').value = c.name||'';
    document.getElementById('cl-email').value = c.email||'';
    document.getElementById('cl-phone').value = c.phone||'';
    document.getElementById('cl-address').value = c.address||'';
    document.getElementById('cl-notes').value = c.notes||'';
    document.getElementById('cl-source').value = c.source||'';
    document.getElementById('cl-whatsapp-btn').style.display = c.phone ? 'inline-flex' : 'none';
    const bks = DATA.bookings.filter(b=>b.clientId===id);
    const prs = DATA.projects.filter(p=>p.clientId===id);
    let h = '';
    prs.forEach(p=>h+=`<div class="row-sub" style="padding:3px 0;">Zákazka: ${escapeHtml(p.title)} — <span class="pill status-${p.status}" style="padding:1px 7px;">${STATUS_LABELS[p.status]}</span></div>`);
    bks.forEach(b=>h+=`<div class="row-sub" style="padding:3px 0;">Rezervácia: ${escapeHtml(b.title)} — ${fmtDate(b.date)}</div>`);
    historyEl.innerHTML = h || '<div class="empty" style="padding:6px 0;">Zatiaľ žiadna história.</div>';
  }else{
    document.getElementById('cl-id').value = '';
    document.getElementById('cl-name').value = '';
    document.getElementById('cl-email').value = '';
    document.getElementById('cl-phone').value = '';
    document.getElementById('cl-address').value = '';
    document.getElementById('cl-notes').value = '';
    document.getElementById('cl-source').value = '';
    document.getElementById('cl-whatsapp-btn').style.display = 'none';
    historyEl.innerHTML = '<div class="empty" style="padding:6px 0;">Ulož klienta, aby si videl históriu.</div>';
  }
  openModal('modal-client');
}
function openWhatsappFromModal(){
  openWhatsapp(document.getElementById('cl-phone').value);
}
function openWhatsappFromProject(){
  const phone = document.getElementById('pr-client-phone').value;
  const title = document.getElementById('pr-title').value.trim();
  const deadline = document.getElementById('pr-deadline').value;
  let message = `Dobrý deň, ohľadom zákazky "${title||'bez názvu'}"`;
  if(deadline) message += ` (${fmtDate(deadline)})`;
  message += ' by som sa chcel/a spýtať...';
  openWhatsapp(phone, message);
}
async function saveClient(){
  const id = document.getElementById('cl-id').value || uid();
  const name = document.getElementById('cl-name').value.trim();
  if(!name){ showToast('Zadaj meno klienta'); return; }
  const client = {
    id, name,
    email: document.getElementById('cl-email').value.trim(),
    phone: document.getElementById('cl-phone').value.trim(),
    address: document.getElementById('cl-address').value.trim(),
    notes: document.getElementById('cl-notes').value.trim(),
    source: document.getElementById('cl-source').value
  };
  const idx = DATA.clients.findIndex(c=>c.id===id);
  if(idx>-1) DATA.clients[idx]=client; else DATA.clients.push(client);
  await saveKey('clients', DATA.clients);
  closeModal('modal-client'); renderAll(); showToast('Klient uložený');
}
async function deleteClient(){
  const id = document.getElementById('cl-id').value;
  const item = DATA.clients.find(c=>c.id===id);
  DATA.clients = DATA.clients.filter(c=>c.id!==id);
  await saveKey('clients', DATA.clients);
  if(item) await moveToTrash('client', item);
  closeModal('modal-client'); renderAll(); showToast('Klient odstránený (v Koši 30 dní)');
}

/* --- Project modal --- */
