/* ===================== 04-hours-expenses.js =====================
   Stránka Hodiny (sledovanie práce) a Náklady (výdavky).
   ===================================================== */

var chartHoursMonth, chartHoursType;
var hoursTypeFilter = '';
function setHoursFilter(type, btnEl){
  hoursTypeFilter = type;
  document.querySelectorAll('.hours-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  renderHours();
}
function renderHours(){
  const todayStr = toLocalISODate(new Date());
  const curMonth = todayStr.slice(0,7);
  const curYear = todayStr.slice(0,4);

  let totalAll = 0, totalMonth = 0, totalYear = 0;
  const monthTotals = {};
  const typeTotals = { svadba:0, stuzkova:0, klip:0, ine:0 };
  const projectRows = [];

  DATA.projects.forEach(p=>{
    if(hoursTypeFilter && p.type !== hoursTypeFilter) return;
    const entries = p.timeEntries || [];
    if(!entries.length) return;
    const projectHours = entries.reduce((s,e)=>s+Number(e.hours||0),0);
    if(projectHours<=0) return;
    totalAll += projectHours;
    typeTotals[p.type||'ine'] = (typeTotals[p.type||'ine']||0) + projectHours;
    entries.forEach(e=>{
      const h = Number(e.hours||0);
      if(!e.date) return;
      if(e.date.slice(0,7)===curMonth) totalMonth += h;
      if(e.date.slice(0,4)===curYear) totalYear += h;
      const mKey = e.date.slice(0,7);
      monthTotals[mKey] = (monthTotals[mKey]||0) + h;
    });
    const client = DATA.clients.find(c=>c.id===p.clientId);
    const budget = Number(p.budget)||0;
    const rate = projectHours>0 ? budget/projectHours : 0;
    projectRows.push({ title:p.title, clientName: client?client.name:'—', hours:projectHours, budget, rate });
  });

  document.getElementById('hoursTotalAll').textContent = `${Math.round(totalAll*10)/10} h`;
  document.getElementById('hoursTotalMonth').textContent = `${Math.round(totalMonth*10)/10} h`;
  document.getElementById('hoursTotalYear').textContent = `${Math.round(totalYear*10)/10} h`;
  const totalBudgetTracked = projectRows.reduce((s,r)=>s+r.budget,0);
  const avgRate = totalAll>0 ? totalBudgetTracked/totalAll : 0;
  document.getElementById('hoursAvgRate').textContent = fmtMoney(Math.round(avgRate));

  const tbody = document.getElementById('hoursByProjectTable');
  const emptyEl = document.getElementById('hoursEmpty');
  if(!projectRows.length){
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
  }else{
    emptyEl.style.display = 'none';
    tbody.innerHTML = projectRows.sort((a,b)=>b.hours-a.hours).map(r=>{
      let rowClass = '';
      if(avgRate>0 && r.rate){
        if(r.rate >= avgRate*1.2) rowClass = 'rate-high';
        else if(r.rate <= avgRate*0.8) rowClass = 'rate-low';
      }
      return `<tr class="${rowClass}">
        <td>${escapeHtml(r.title||'Bez názvu')}</td>
        <td>${escapeHtml(r.clientName)}</td>
        <td class="num">${Math.round(r.hours*10)/10} h</td>
        <td class="num">${fmtMoney(r.budget)}</td>
        <td class="num">${r.rate?fmtMoney(Math.round(r.rate)):'—'}</td>
      </tr>`;
    }).join('');
  }

  const monthKeys = Object.keys(monthTotals).sort();
  const monthLabels = monthKeys.map(k=>{ const [y,m]=k.split('-'); return `${m}/${y.slice(2)}`; });
  const monthData = monthKeys.map(k=>Math.round(monthTotals[k]*10)/10);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e85002';
  const gridColor = 'rgba(255,255,255,0.06)';
  if(typeof Chart === 'undefined') return;
  if(chartHoursMonth) chartHoursMonth.destroy();
  chartHoursMonth = new Chart(document.getElementById('chartHoursMonth'), {
    type:'bar',
    data:{ labels: monthLabels, datasets:[{ label:'Hodiny', data: monthData, backgroundColor: accent, borderRadius:4 }]},
    options:{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, grid:{color:gridColor} }, x:{ grid:{display:false} } } }
  });

  const typeLabelsMap = { svadba:'💍 Svadby', stuzkova:'🎓 Stužkové', klip:'🎬 Klipy', ine:'Iné' };
  const typeKeys = Object.keys(typeTotals).filter(k=>typeTotals[k]>0);
  if(chartHoursType) chartHoursType.destroy();
  chartHoursType = new Chart(document.getElementById('chartHoursType'), {
    type:'doughnut',
    data:{ labels: typeKeys.map(k=>typeLabelsMap[k]||k), datasets:[{ data: typeKeys.map(k=>Math.round(typeTotals[k]*10)/10), backgroundColor:['#e0568a','#3d8fe0','#e0c828','#9c9890'] }]},
    options:{ plugins:{legend:{position:'bottom'}} }
  });
}

/* ===================== EXPENSES ===================== */
var EXPENSE_CATEGORY_LABELS = {
  benzin:'Benzín / cesta', technika:'Technika / vybavenie', asistent:'Asistent / 2. kamera',
  softver:'Softvér / predplatné', marketing:'Marketing / reklama', ine:'Iné'
};
function openExpenseModal(id){
  const clientSelectOpts = '<option value="">— žiadna —</option>' + DATA.projects.map(p=>`<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
  document.getElementById('exp-project').innerHTML = clientSelectOpts;
  const editing = !!id;
  document.getElementById('expenseModalTitle').textContent = editing ? 'Upraviť náklad' : 'Nový náklad';
  document.getElementById('exp-delete').style.display = editing ? 'inline-flex' : 'none';
  if(editing){
    const e = DATA.expenses.find(x=>x.id===id);
    document.getElementById('exp-id').value = e.id;
    document.getElementById('exp-date').value = e.date||'';
    document.getElementById('exp-amount').value = e.amount||'';
    document.getElementById('exp-category').value = e.category||'ine';
    document.getElementById('exp-description').value = e.description||'';
    document.getElementById('exp-project').value = e.projectId||'';
  }else{
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = toLocalISODate(new Date());
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-category').value = 'benzin';
    document.getElementById('exp-description').value = '';
    document.getElementById('exp-project').value = '';
  }
  openModal('modal-expense');
}
async function saveExpense(){
  const id = document.getElementById('exp-id').value || uid();
  const amount = document.getElementById('exp-amount').value;
  if(!amount || Number(amount)<=0){ showToast('Zadaj sumu nákladu'); return; }
  const expense = {
    id,
    date: document.getElementById('exp-date').value,
    amount,
    category: document.getElementById('exp-category').value,
    description: document.getElementById('exp-description').value.trim(),
    projectId: document.getElementById('exp-project').value
  };
  const idx = DATA.expenses.findIndex(e=>e.id===id);
  if(idx>-1) DATA.expenses[idx]=expense; else DATA.expenses.push(expense);
  await saveKey('expenses', DATA.expenses);
  closeModal('modal-expense'); renderAll(); if(document.getElementById('view-expenses').classList.contains('active')) renderExpenses();
  showToast('Náklad uložený');
}
async function deleteExpense(){
  const id = document.getElementById('exp-id').value;
  const item = DATA.expenses.find(e=>e.id===id);
  DATA.expenses = DATA.expenses.filter(e=>e.id!==id);
  await saveKey('expenses', DATA.expenses);
  if(item) await moveToTrash('expense', item);
  closeModal('modal-expense'); renderAll(); if(document.getElementById('view-expenses').classList.contains('active')) renderExpenses();
  showToast('Náklad odstránený (v Koši 30 dní)');
}
var chartExpensesCategory;
function renderExpenses(){
  const todayStr = toLocalISODate(new Date());
  const curMonth = todayStr.slice(0,7);
  const curYear = todayStr.slice(0,4);

  const totalAll = DATA.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalMonth = DATA.expenses.filter(e=>e.date && e.date.slice(0,7)===curMonth).reduce((s,e)=>s+Number(e.amount||0),0);
  const totalYear = DATA.expenses.filter(e=>e.date && e.date.slice(0,4)===curYear).reduce((s,e)=>s+Number(e.amount||0),0);

  document.getElementById('expTotalAll').textContent = fmtMoney(totalAll);
  document.getElementById('expTotalMonth').textContent = fmtMoney(totalMonth);
  document.getElementById('expTotalYear').textContent = fmtMoney(totalYear);

  const revenueThisYear = DATA.projects
    .filter(p=>p.deadline && p.deadline.slice(0,4)===curYear)
    .reduce((s,p)=>s+(Number(p.budget)||0),0);
  const netProfit = revenueThisYear - totalYear;
  const netEl = document.getElementById('expNetProfit');
  netEl.textContent = fmtMoney(netProfit);
  netEl.style.color = netProfit>=0 ? 'var(--green-page)' : '#f0827f';

  const tbody = document.getElementById('expensesTable');
  const emptyEl = document.getElementById('expensesEmpty');
  if(!DATA.expenses.length){
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
  }else{
    emptyEl.style.display = 'none';
    tbody.innerHTML = DATA.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>{
      const project = DATA.projects.find(p=>p.id===e.projectId);
      return `<tr onclick="openExpenseModal('${e.id}')" style="cursor:pointer;">
        <td class="num">${e.date?fmtDate(e.date):'—'}</td>
        <td>${EXPENSE_CATEGORY_LABELS[e.category]||'Iné'}</td>
        <td>${escapeHtml(e.description||'')}</td>
        <td>${project?escapeHtml(project.title):'—'}</td>
        <td class="num">${fmtMoney(e.amount)}</td>
      </tr>`;
    }).join('');
  }

  const categoryTotals = {};
  DATA.expenses.forEach(e=>{ const c = e.category||'ine'; categoryTotals[c] = (categoryTotals[c]||0) + Number(e.amount||0); });
  const catKeys = Object.keys(categoryTotals);
  if(typeof Chart === 'undefined') return;
  if(chartExpensesCategory) chartExpensesCategory.destroy();
  chartExpensesCategory = new Chart(document.getElementById('chartExpensesCategory'), {
    type:'doughnut',
    data:{ labels: catKeys.map(k=>EXPENSE_CATEGORY_LABELS[k]||k), datasets:[{ data: catKeys.map(k=>Math.round(categoryTotals[k]*100)/100), backgroundColor:['#e0568a','#3d8fe0','#e0c828','#7cb88f','#9c6ce0','#9c9890'] }]},
    options:{ plugins:{legend:{position:'bottom'}} }
  });
}

/* ===================== VENDORS (suppliers: photographers, bands, DJs) ===================== */
