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
    const invs = DATA.invoices.filter(i=>i.clientId===id);
    const totalPaid = invs.filter(i=>i.status==='uhradena').reduce((s,i)=>s+Number(i.amount||0),0);
    const totalUnpaid = invs.filter(i=>i.status==='neuhradena').reduce((s,i)=>s+Number(i.amount||0),0);
    let h = '';
    if(invs.length){
      h += `<div style="padding:2px 0 12px;font-weight:700;font-size:14px;color:var(--text);">💰 Uhradené spolu: ${fmtMoney(totalPaid)}${totalUnpaid?` <span style="color:var(--text-dim);font-weight:500;font-size:12px;">· neuhradené ${fmtMoney(totalUnpaid)}</span>`:''}</div>`;
    }
    if(prs.length){
      h += `<div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin:6px 0 2px;">Zákazky</div>`;
      h += prs.map(p=>`<div class="list-row" style="padding:7px 2px;" onclick="openProjectFromClientHistory('${p.id}')">
        <div class="row-main"><div class="row-title" style="font-size:13px;">${escapeHtml(p.title||'Bez názvu')}${p.archived?' 🗄️':''}</div><div class="row-sub">${p.deadline?fmtDate(p.deadline):'bez termínu'}</div></div>
        <span class="pill status-${p.status}" style="padding:1px 7px;">${STATUS_LABELS[p.status]}</span>
      </div>`).join('');
    }
    if(bks.length){
      h += `<div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 2px;">Rezervácie</div>`;
      h += bks.map(b=>`<div class="list-row" style="padding:7px 2px;" onclick="openBookingFromClientHistory('${b.id}')">
        <div class="row-main"><div class="row-title" style="font-size:13px;">${escapeHtml(b.title||'Bez názvu')}${b.archived?' 🗄️':''}</div><div class="row-sub">${fmtDate(b.date)} ${b.time||''}</div></div>
      </div>`).join('');
    }
    if(invs.length){
      h += `<div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 2px;">Faktúry</div>`;
      h += invs.map(i=>`<div class="list-row" style="padding:7px 2px;" onclick="openInvoiceFromClientHistory('${i.id}')">
        <div class="row-main"><div class="row-title" style="font-size:13px;">${escapeHtml(i.number||'bez čísla')}${i.archived?' 🗄️':''}</div><div class="row-sub">${i.due?fmtDate(i.due):''}</div></div>
        <span class="pill inv-${i.status}" style="padding:1px 7px;">${fmtMoney(i.amount)} · ${i.status==='uhradena'?'Uhradená':'Neuhradená'}</span>
      </div>`).join('');
    }
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
function openProjectFromClientHistory(id){ closeModal('modal-client'); openProjectModal(id); }
function openBookingFromClientHistory(id){ closeModal('modal-client'); openBookingModal(id); }
function openInvoiceFromClientHistory(id){ closeModal('modal-client'); openInvoiceModal(id); }
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
