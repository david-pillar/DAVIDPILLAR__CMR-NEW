/* ===================== 18-invoices-crud.js =====================
   Vytváranie/úprava/mazanie faktúry, DPH prepočet.
   ===================================================== */

function openInvoiceModal(id){
  populateClientSelects();
  const editing = !!id;
  document.getElementById('invoiceModalTitle').textContent = editing ? 'Upraviť faktúru' : 'Nová faktúra';
  document.getElementById('iv-delete').style.display = editing ? 'inline-flex' : 'none';
  document.getElementById('iv-qr-container').style.display = 'none';
  document.getElementById('iv-qr-container').innerHTML = '';
  document.getElementById('iv-vat-section').style.display = DATA.settings.vatPayer ? 'block' : 'none';
  if(editing){
    const i = DATA.invoices.find(x=>x.id===id);
    document.getElementById('iv-id').value = i.id;
    document.getElementById('iv-number').value = i.number||'';
    document.getElementById('iv-client').value = i.clientId||'';
    document.getElementById('iv-project').value = i.projectId||'';
    document.getElementById('iv-type').value = i.type||'cela';
    document.getElementById('iv-amount').value = i.amount||'';
    document.getElementById('iv-due').value = i.due||'';
    document.getElementById('iv-status').value = i.status||'neuhradena';
    document.getElementById('iv-sent').checked = !!i.sent;
    document.getElementById('iv-vat-base').value = i.vatBase||'';
    document.getElementById('iv-vat-rate').value = i.vatRate!=null ? i.vatRate : (DATA.settings.defaultVatRate||20);
  }else{
    document.getElementById('iv-id').value = '';
    document.getElementById('iv-number').value = '';
    document.getElementById('iv-client').value = '';
    document.getElementById('iv-project').value = '';
    document.getElementById('iv-type').value = 'cela';
    document.getElementById('iv-amount').value = '';
    document.getElementById('iv-due').value = '';
    document.getElementById('iv-status').value = 'neuhradena';
    document.getElementById('iv-sent').checked = false;
    document.getElementById('iv-vat-base').value = '';
    document.getElementById('iv-vat-rate').value = DATA.settings.defaultVatRate||20;
  }
  document.getElementById('iv-vat-summary').textContent = '';
  onInvoiceProjectChange();
  openModal('modal-invoice');
}
function recalcInvoiceVat(){
  const base = Number(document.getElementById('iv-vat-base').value);
  const rate = Number(document.getElementById('iv-vat-rate').value);
  const summaryEl = document.getElementById('iv-vat-summary');
  if(!base || base<=0){ summaryEl.textContent = ''; return; }
  const vatAmount = base * (rate/100);
  const total = base + vatAmount;
  document.getElementById('iv-amount').value = Math.round(total*100)/100;
  summaryEl.innerHTML = `DPH (${rate}%): <b style="color:var(--text);">${fmtMoney(vatAmount)}</b> · Spolu s DPH: <b style="color:var(--accent);">${fmtMoney(total)}</b>`;
}
function onInvoiceProjectChange(){
  const projectId = document.getElementById('iv-project').value;
  const summaryEl = document.getElementById('iv-project-summary');
  if(!projectId){ summaryEl.style.display = 'none'; return; }
  const project = DATA.projects.find(p=>p.id===projectId);
  if(!project){ summaryEl.style.display = 'none'; return; }
  const currentId = document.getElementById('iv-id').value;
  const relatedInvoices = DATA.invoices.filter(i=>i.projectId===projectId && i.id!==currentId);
  const paidSoFar = relatedInvoices.filter(i=>i.status==='uhradena').reduce((s,i)=>s+Number(i.amount||0),0);
  const budget = Number(project.budget)||0;
  const remaining = budget - paidSoFar;
  summaryEl.style.display = 'block';
  summaryEl.innerHTML = `Rozpočet zákazky: <b style="color:var(--text);">${fmtMoney(budget)}</b> · Doteraz uhradené: <b style="color:var(--green-page);">${fmtMoney(paidSoFar)}</b> · Zostáva: <b style="color:var(--accent);">${fmtMoney(remaining)}</b>`;
}
async function saveInvoice(){
  const id = document.getElementById('iv-id').value || uid();
  const number = document.getElementById('iv-number').value.trim();
  if(!number){ showToast('Zadaj číslo faktúry'); return; }
  const invoice = {
    id, number,
    clientId: document.getElementById('iv-client').value,
    projectId: document.getElementById('iv-project').value,
    type: document.getElementById('iv-type').value,
    amount: document.getElementById('iv-amount').value,
    due: document.getElementById('iv-due').value,
    status: document.getElementById('iv-status').value,
    sent: document.getElementById('iv-sent').checked
  };
  if(DATA.settings.vatPayer){
    const vatBase = document.getElementById('iv-vat-base').value;
    if(vatBase){
      invoice.vatBase = vatBase;
      invoice.vatRate = Number(document.getElementById('iv-vat-rate').value) || 0;
      invoice.vatAmount = Math.round((Number(vatBase) * (invoice.vatRate/100)) * 100) / 100;
    }
  }
  const idx = DATA.invoices.findIndex(i=>i.id===id);
  if(idx>-1) DATA.invoices[idx]=invoice; else DATA.invoices.push(invoice);
  await saveKey('invoices', DATA.invoices);
  if(invoice.projectId){
    const relatedProject = DATA.projects.find(p=>p.id===invoice.projectId);
    if(relatedProject){
      syncProjectFolder(relatedProject);
      if(document.getElementById('pr-id').value === relatedProject.id){
        renderProjectStatusIndicators(relatedProject);
      }
    }
  }
  closeModal('modal-invoice'); renderAll(); showToast('Faktúra uložená');
}
async function deleteInvoice(){
  const id = document.getElementById('iv-id').value;
  const item = DATA.invoices.find(i=>i.id===id);
  DATA.invoices = DATA.invoices.filter(i=>i.id!==id);
  await saveKey('invoices', DATA.invoices);
  if(item) await moveToTrash('invoice', item);
  closeModal('modal-invoice'); renderAll(); showToast('Faktúra odstránená (v Koši 30 dní)');
}

/* ---- Install banner (add to home screen hint) ---- */
