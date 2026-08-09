/* ===================== 03-pricing.js =====================
   Cenotvorba — balíky, príplatky, cenník podľa roka, kalkulačka, grafy.
   ===================================================== */

function fillSettingsForm(){
  document.getElementById('set-companyName').value = DATA.settings.companyName || '';
  document.getElementById('set-ownerName').value = DATA.settings.ownerName || '';
  document.getElementById('set-address').value = DATA.settings.address || '';
  document.getElementById('set-ico').value = DATA.settings.ico || '';
  document.getElementById('set-dic').value = DATA.settings.dic || '';
  document.getElementById('set-iban').value = DATA.settings.iban || '';
  document.getElementById('set-email').value = DATA.settings.email || '';
  document.getElementById('set-phone').value = DATA.settings.phone || '';
  document.getElementById('set-vatPayer').checked = !!DATA.settings.vatPayer;
  document.getElementById('set-defaultVatRate').value = DATA.settings.defaultVatRate || 20;
  document.getElementById('set-vat-rate-row').style.display = DATA.settings.vatPayer ? 'grid' : 'none';
  const goalYear = new Date().getFullYear();
  document.getElementById('set-goal-year-label').textContent = goalYear;
  document.getElementById('set-yearlyGoal').value = (DATA.settings.yearlyGoals && DATA.settings.yearlyGoals[goalYear]) || '';
  document.getElementById('set-contractTemplate').value = DATA.settings.contractTemplate || DEFAULT_SETTINGS.contractTemplate;
  document.getElementById('set-invoiceTemplate').value = DATA.settings.invoiceTemplate || DEFAULT_SETTINGS.invoiceTemplate;
  document.getElementById('set-dayScheduleTemplate').value = DATA.settings.dayScheduleTemplate || DEFAULT_SETTINGS.dayScheduleTemplate;
  if(!DATA.settings.messageTemplates || !DATA.settings.messageTemplates.length){
    DATA.settings.messageTemplates = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.messageTemplates));
  }
  renderMessageTemplates();
  refreshPinSettingsUI();
  renderDataHealthCheck();
}
/* ---- Pricing (Cenotvorba) ---- */
function fillPricingForm(){
  document.getElementById('pricing-km-rate').value = PRICING.kmRate;
  document.getElementById('pricing-home-district').value = PRICING.homeDistrict || '';
  renderBalickyList();
  renderPriplatkyList();
  renderYearPricingList();
  initCalculator();
}

/* ---- Year-based package pricing ---- */
function getBalikPrice(balikId, year){
  // year can be a number or string; falls back to the package's base price
  // when no year-specific override exists for that year.
  const yStr = String(year || new Date().getFullYear());
  const override = PRICING.yearPrices && PRICING.yearPrices[yStr] && PRICING.yearPrices[yStr][balikId];
  if(override !== undefined && override !== null && override !== '') return Number(override);
  const balik = PRICING.balicky.find(b=>b.id===balikId);
  return balik ? Number(balik.price) : 0;
}
function renderYearPricingList(){
  const balikSel = document.getElementById('yp-balik');
  balikSel.innerHTML = PRICING.balicky.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');

  const el = document.getElementById('year-pricing-list');
  const years = Object.keys(PRICING.yearPrices || {}).sort();
  if(!years.length){ el.innerHTML = '<div class="empty" style="padding:6px 0;">Zatiaľ žiadne ceny podľa roku — základná cena balíka platí pre všetky roky.</div>'; return; }
  el.innerHTML = years.map(year=>{
    const entries = PRICING.yearPrices[year] || {};
    const rows = Object.keys(entries).map(balikId=>{
      const balik = PRICING.balicky.find(b=>b.id===balikId);
      const label = balik ? balik.name : balikId;
      return `<div class="pricing-row">
        <span style="flex:1;font-size:13px;">${escapeHtml(label)}</span>
        <input type="number" value="${entries[balikId]}" onchange="updateYearPrice('${year}','${balikId}',this.value)">
        <button class="icon-btn" onclick="deleteYearPrice('${year}','${balikId}')" title="Odstrániť">×</button>
      </div>`;
    }).join('');
    return `<div style="background:var(--surface-2);border:1px solid var(--surface-3);border-radius:8px;padding:10px 12px;">
      <div class="row-sub" style="margin-bottom:6px;font-weight:700;color:var(--text);">Rok ${escapeHtml(year)}</div>
      ${rows || '<div class="empty" style="padding:2px 0;">—</div>'}
    </div>`;
  }).join('');
}
function addYearPriceRow(){
  const year = document.getElementById('yp-year').value.trim();
  const balikId = document.getElementById('yp-balik').value;
  const price = document.getElementById('yp-price').value;
  if(!year || !balikId || price===''){ showToast('Vyplň rok, balík aj cenu'); return; }
  if(!PRICING.yearPrices[year]) PRICING.yearPrices[year] = {};
  PRICING.yearPrices[year][balikId] = Number(price);
  document.getElementById('yp-year').value = '';
  document.getElementById('yp-price').value = '';
  renderYearPricingList();
  savePricingSilent();
  showToast('Cena pre daný rok uložená');
}
function updateYearPrice(year, balikId, value){
  if(!PRICING.yearPrices[year]) PRICING.yearPrices[year] = {};
  PRICING.yearPrices[year][balikId] = Number(value);
  savePricingSilent();
}
function deleteYearPrice(year, balikId){
  if(PRICING.yearPrices[year]){
    delete PRICING.yearPrices[year][balikId];
    if(!Object.keys(PRICING.yearPrices[year]).length) delete PRICING.yearPrices[year];
  }
  renderYearPricingList();
  savePricingSilent();
}

/* ---- Pricing calculator (naceniť zákazku) ---- */
function initCalculator(){
  const balikSel = document.getElementById('calc-balik');
  balikSel.innerHTML = '<option value="">— nevybraté —</option>' + PRICING.balicky.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  const checksEl = document.getElementById('calc-priplatky-checks');
  checksEl.innerHTML = PRICING.priplatky.map(p=>`
    <label style="display:flex;align-items:center;justify-content:space-between;text-transform:none;letter-spacing:0;font-size:13px;color:var(--text);margin:0;">
      <span style="display:flex;align-items:center;gap:8px;"><input type="checkbox" class="calc-priplatok-check" value="${p.id}" style="width:auto;" onchange="recalcCalculator()"> ${escapeHtml(p.name)}</span>
      <span class="num" style="color:var(--text-dim);">${fmtMoney(p.price)}</span>
    </label>`).join('') || '<div class="empty" style="padding:4px 0;">Zatiaľ žiadne príplatky.</div>';
  if(!document.getElementById('calc-year').value) document.getElementById('calc-year').value = new Date().getFullYear();
  recalcCalculator();
}
function recalcCalculator(){
  const balikId = document.getElementById('calc-balik').value;
  const balik = PRICING.balicky.find(b=>b.id===balikId);
  const year = document.getElementById('calc-year').value || new Date().getFullYear();
  const balikPrice = balik ? getBalikPrice(balikId, year) : 0;

  const mimoOkresu = document.getElementById('calc-mimo-okresu').checked;
  document.getElementById('calc-km-row').style.display = mimoOkresu ? 'grid' : 'none';
  const km = mimoOkresu ? (Number(document.getElementById('calc-km').value) || 0) : 0;
  const cesta = km * (PRICING.kmRate || 0);
  document.getElementById('calc-cesta-label').value = fmtMoney(cesta);

  let priplatkySum = 0;
  const priplatokNames = [];
  document.querySelectorAll('.calc-priplatok-check:checked').forEach(chk=>{
    const p = PRICING.priplatky.find(x=>x.id===chk.value);
    if(p){ priplatkySum += Number(p.price); priplatokNames.push(p.name); }
  });

  const total = balikPrice + cesta + priplatkySum;
  const parts = [];
  if(balik) parts.push(`${balik.name} (rok ${year}): ${fmtMoney(balikPrice)}`);
  if(cesta>0) parts.push(`Cesta: ${fmtMoney(cesta)}`);
  if(priplatokNames.length) parts.push(`${priplatokNames.join(', ')}: ${fmtMoney(priplatkySum)}`);
  document.getElementById('calc-breakdown-text').textContent = parts.join(' + ') || 'Vyber balík a príplatky pre rozpis ceny.';

  const totalEl = document.getElementById('calc-total');
  totalEl.textContent = fmtMoney(total);
  totalEl.dataset.rawValue = total;
}
function createProjectFromCalculator(){
  const type = document.getElementById('calc-type').value;
  const balikId = document.getElementById('calc-balik').value;
  const mimoOkresu = document.getElementById('calc-mimo-okresu').checked;
  const km = document.getElementById('calc-km').value;
  const priplatkyIds = Array.from(document.querySelectorAll('.calc-priplatok-check:checked')).map(chk=>chk.value);
  const total = Number(document.getElementById('calc-total').dataset.rawValue || 0);

  // Open the new-project modal pre-filled with everything the calculator worked out
  openProjectModal();
  if(type){
    document.getElementById('pr-type').value = type;
    onProjectTypeChange();
  }
  if(type==='svadba') document.getElementById('w-balik').value = balikId;
  if(type==='stuzkova') document.getElementById('s-balik').value = balikId;
  document.getElementById('pr-mimo-okresu').checked = mimoOkresu;
  document.getElementById('pr-km').value = km;
  populatePriplatkyChecks(priplatkyIds);
  recalcProjectPrice();
  document.getElementById('pr-budget').value = total;
  showToast('Cena prenesená — doplň názov, dátum a klienta');
}
function renderBalickyList(){
  const el = document.getElementById('balicky-list');
  el.innerHTML = PRICING.balicky.map(b=>`
    <div class="pricing-row">
      <input value="${escapeHtml(b.name)}" onchange="updateBalik('${b.id}','name',this.value)">
      <input type="number" value="${b.price}" onchange="updateBalik('${b.id}','price',this.value)">
      <button class="icon-btn" onclick="deleteBalik('${b.id}')" title="Odstrániť">×</button>
    </div>`).join('');
}
function renderPriplatkyList(){
  const el = document.getElementById('priplatky-list');
  el.innerHTML = PRICING.priplatky.map(p=>`
    <div class="pricing-row">
      <input value="${escapeHtml(p.name)}" onchange="updatePriplatok('${p.id}','name',this.value)">
      <input type="number" value="${p.price}" onchange="updatePriplatok('${p.id}','price',this.value)">
      <button class="icon-btn" onclick="deletePriplatok('${p.id}')" title="Odstrániť">×</button>
    </div>`).join('');
}
function updateBalik(id, field, value){
  const b = PRICING.balicky.find(x=>x.id===id);
  if(!b) return;
  b[field] = field==='price' ? Number(value) : value;
  savePricingSilent();
}
function addBalikRow(){
  const nextLetter = String.fromCharCode(65 + PRICING.balicky.length);
  PRICING.balicky.push({ id: uid(), name:`Balík ${nextLetter}`, price:0 });
  renderBalickyList();
  savePricingSilent();
}
function deleteBalik(id){
  PRICING.balicky = PRICING.balicky.filter(b=>b.id!==id);
  renderBalickyList();
  savePricingSilent();
}
function updatePriplatok(id, field, value){
  const p = PRICING.priplatky.find(x=>x.id===id);
  if(!p) return;
  p[field] = field==='price' ? Number(value) : value;
  savePricingSilent();
}
function addPriplatokRow(){
  PRICING.priplatky.push({ id: uid(), name:'Nový príplatok', price:0 });
  renderPriplatkyList();
  savePricingSilent();
}
function deletePriplatok(id){
  PRICING.priplatky = PRICING.priplatky.filter(p=>p.id!==id);
  renderPriplatkyList();
  savePricingSilent();
}
async function savePricingSilent(){
  await saveKey('pricing', PRICING);
  if(document.getElementById('view-pricing').classList.contains('active')) renderPricingCharts();
  if(document.getElementById('view-projectform').classList.contains('active')) recalcProjectPrice();
  initCalculator();
  renderYearPricingList();
}
async function savePricingBase(){
  PRICING.kmRate = Number(document.getElementById('pricing-km-rate').value) || 0.30;
  PRICING.homeDistrict = document.getElementById('pricing-home-district').value.trim();
  await saveKey('pricing', PRICING);
  showToast('Cenotvorba uložená');
  if(document.getElementById('view-projectform').classList.contains('active')) recalcProjectPrice();
}

/* ---- Dependency-free CSS bar chart helpers (no Chart.js — funguje vždy, aj keď
   sa externá knižnica na grafy nenačíta kvôli pomalému/blokovanému pripojeniu). ---- */
function renderMiniBarChart(containerId, labels, values, fmtFn){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!labels.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>'; return; }
  const maxVal = Math.max(...values, 1);
  const fmt = fmtFn || (v=>String(v));
  el.innerHTML = labels.map((label,i)=>{
    const v = values[i]||0;
    const pct = Math.max(Math.round(v/maxVal*100), v>0?4:0);
    return `<div class="mini-bar-col">
      <div class="mini-bar-value">${fmt(v)}</div>
      <div class="mini-bar-track"><div class="mini-bar" style="height:${pct}%;"></div></div>
      <div class="mini-bar-label">${escapeHtml(String(label))}</div>
    </div>`;
  }).join('');
}
function renderHBarList(containerId, items, colorFn){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!items.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>'; return; }
  const maxVal = Math.max(...items.map(it=>it.value), 1);
  el.innerHTML = items.map((it,i)=>{
    const pct = Math.max(Math.round(it.value/maxVal*100), it.value>0?2:0);
    const color = colorFn ? colorFn(it,i) : null;
    return `<div>
      <div class="hbar-row-head"><span>${escapeHtml(it.label)}</span><span class="hbar-value">${fmtMoney(it.value)}</span></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;${color?`background:${color};`:''}"></div></div>
    </div>`;
  }).join('');
}

function renderPricingCharts(){
  renderYearsAndSeasonCharts();
  const projects = DATA.projects;

  // Revenue by month (based on deadline)
  const monthMap = {};
  projects.forEach(p=>{
    if(!p.deadline || !p.budget) return;
    const key = p.deadline.slice(0,7);
    monthMap[key] = (monthMap[key]||0) + Number(p.budget);
  });
  const monthKeys = Object.keys(monthMap).sort();
  const monthItems = monthKeys.map(k=>{
    const [y,m] = k.split('-');
    return { label: `${m}/${y.slice(2)}`, value: monthMap[k] };
  });
  renderHBarList('revenueMonthBars', monthItems);

  // Revenue by balík
  const balikMap = {};
  projects.forEach(p=>{
    const b = (p.wedding && p.wedding.balik) || (p.stuzkova && p.stuzkova.balik);
    if(!b || !p.budget) return;
    balikMap[b] = (balikMap[b]||0) + Number(p.budget);
  });
  const balikColors = ['#e85002','#6fa3d8','#7cb88f','#e08fa8'];
  const balikItems = Object.keys(balikMap).map(k=>({ label:'Balík '+k, value: balikMap[k] }));
  renderHBarList('revenueBalikBars', balikItems, (it,i)=>balikColors[i % balikColors.length]);

  // Revenue by type
  const typeLabels = { svadba:'Svadba', stuzkova:'Stužková', klip:'Klip', ine:'Iné' };
  const typeMap = {};
  projects.forEach(p=>{
    if(!p.budget) return;
    const t = p.type || 'ine';
    typeMap[t] = (typeMap[t]||0) + Number(p.budget);
  });
  const typeItems = Object.keys(typeMap).map(k=>({ label: typeLabels[k]||k, value: typeMap[k] }));
  renderHBarList('revenueTypeBars', typeItems);
}
/* ---- "Ako mi idu roky" — prepínateľné medzi "Zabookované" (počet zákaziek podľa roku termínu,
   funguje aj keď ešte nemáš vyplnené ceny) a "Vyplatené" (reálne prijaté peniaze z uhradených
   faktúr, podľa roku zákazky) — a sezónnosť (v ktorých mesiacoch prichádza najviac zákaziek). ---- */
var yearsOverviewMode = 'count';
function setYearsOverviewMode(mode, btnEl){
  yearsOverviewMode = mode;
  document.querySelectorAll('.years-view-btn').forEach(b=>b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  renderYearsAndSeasonCharts();
}
function renderYearsAndSeasonCharts(){
  const projects = DATA.projects;
  const subtextEl = document.getElementById('yearsOverviewSubtext');

  const yearMap = {}; // year -> { count, value }
  if(yearsOverviewMode === 'paid'){
    if(subtextEl) subtextEl.textContent = 'Skutočne prijaté peniaze z uhradených faktúr, podľa roku termínu zákazky.';
    DATA.invoices.filter(i=>i.status==='uhradena').forEach(i=>{
      const project = DATA.projects.find(p=>p.id===i.projectId);
      const dateStr = (project && project.deadline) || i.due;
      if(!dateStr) return;
      const y = dateStr.slice(0,4);
      if(!yearMap[y]) yearMap[y] = { count:0, value:0 };
      yearMap[y].count++;
      yearMap[y].value += Number(i.amount)||0;
    });
  }else{
    if(subtextEl) subtextEl.textContent = 'Počet zabookovaných zákaziek podľa roku termínu (bez ohľadu na to, či už majú vyplnenú cenu) — vrátane archivovaných rokov.';
    projects.forEach(p=>{
      if(!p.deadline) return;
      const y = p.deadline.slice(0,4);
      if(!yearMap[y]) yearMap[y] = { count:0, value:0 };
      yearMap[y].count++;
      yearMap[y].value += Number(p.budget)||0;
    });
  }
  const years = Object.keys(yearMap).sort();
  const yearValues = years.map(y=> yearsOverviewMode==='paid' ? yearMap[y].value : yearMap[y].count);
  const yearFmt = yearsOverviewMode==='paid' ? (v=>fmtMoney(v)) : (v=>String(v));
  renderMiniBarChart('yearsBarChart', years, yearValues, yearFmt);

  const tableEl = document.getElementById('yearsOverviewTable');
  if(tableEl){
    if(!years.length){
      tableEl.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>';
    }else if(yearsOverviewMode==='paid'){
      tableEl.innerHTML = `<table><thead><tr><th>Rok</th><th>Uhradené faktúry</th><th>Vyplatené</th></tr></thead><tbody>
        ${years.map(y=>`<tr><td>${y}</td><td class="num">${yearMap[y].count}</td><td class="num">${fmtMoney(yearMap[y].value)}</td></tr>`).join('')}
      </tbody></table>`;
    }else{
      tableEl.innerHTML = `<table><thead><tr><th>Rok</th><th>Zákaziek</th><th>Rozpočet spolu</th></tr></thead><tbody>
        ${years.map(y=>`<tr><td>${y}</td><td class="num">${yearMap[y].count}</td><td class="num">${fmtMoney(yearMap[y].value)}</td></tr>`).join('')}
      </tbody></table>`;
    }
  }

  const monthNames = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
  const monthCounts = new Array(12).fill(0);
  projects.forEach(p=>{
    if(!p.deadline) return;
    const m = Number(p.deadline.slice(5,7)) - 1;
    if(m>=0 && m<12) monthCounts[m]++;
  });
  renderMiniBarChart('seasonBarChart', monthNames, monthCounts, v=>String(v));
}
