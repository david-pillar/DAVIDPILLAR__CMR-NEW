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
   sa externá knižnica na grafy nenačíta kvôli pomalému/blokovanému pripojeniu).
   Stĺpce/pruhy sa vykreslia najprv na 0 a hneď nato (cez dvojitý requestAnimationFrame,
   aby prehliadač stihol prvý stav vykresliť) narastú na cieľovú hodnotu — vďaka CSS
   transition to pôsobí ako plynulá animácia bez akejkoľvek externej knižnice. ---- */
function animateFillIn(el, selector, prop, unit){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll(selector).forEach(node=>{ node.style[prop] = node.dataset.pct + (unit||'%'); });
  }));
}
function renderMiniBarChart(containerId, labels, values, opts){
  opts = opts || {};
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!labels.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>'; return; }
  const maxVal = Math.max(...values, 1);
  const fmt = opts.fmt || (v=>String(v));
  el.innerHTML = labels.map((label,i)=>{
    const v = values[i]||0;
    const pct = Math.max(Math.round(v/maxVal*100), v>0?4:0);
    const clickable = typeof opts.onClick === 'function';
    const extraClass = typeof opts.colClass === 'function' ? (opts.colClass(label,v,i)||'') : '';
    return `<div class="mini-bar-col${clickable?' mini-bar-col-clickable':''}${extraClass?' '+extraClass:''}" ${clickable?`onclick="(${opts.onClick.name})('${label}')" title="Klikni pre detail"`:''}>
      <div class="mini-bar-value">${fmt(v)}</div>
      <div class="mini-bar-track"><div class="mini-bar" data-pct="${pct}" style="height:0%;"></div></div>
      <div class="mini-bar-label">${escapeHtml(String(label))}</div>
    </div>`;
  }).join('');
  animateFillIn(el, '.mini-bar', 'height');
}
function renderHBarList(containerId, items, opts){
  opts = opts || {};
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!items.length){ el.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>'; return; }
  const maxVal = Math.max(...items.map(it=>it.value), 1);
  el.innerHTML = items.map((it,i)=>{
    const pct = Math.max(Math.round(it.value/maxVal*100), it.value>0?2:0);
    const color = typeof opts.color === 'function' ? opts.color(it,i) : null;
    return `<div>
      <div class="hbar-row-head"><span>${escapeHtml(it.label)}</span><span class="hbar-value">${fmtMoney(it.value)}</span></div>
      <div class="hbar-track"><div class="hbar-fill" data-pct="${pct}" style="width:0%;${color?`background:${color};`:''}"></div></div>
    </div>`;
  }).join('');
  animateFillIn(el, '.hbar-fill', 'width');
}
/* ---- Rýchla navigácia medzi panelmi na Cenotvorbe ---- */
function scrollToPricingPanel(e, panelId){
  if(e) e.preventDefault();
  const target = document.getElementById(panelId);
  if(target) target.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ---- Globálny výber roka pre celú stránku Cenotvorby — "" znamená "Všetky roky".
   Ovplyvňuje prognózu, priemerné ceny, sezónnosť a grafy nižšie; panel "Ako mi idu roky"
   ostáva vždy celkový prehľad všetkých rokov, vybraný rok sa v ňom len zvýrazní. ---- */
var pricingSelectedYear = localStorage.getItem('slate:pricingSelectedYear') || '';
function setPricingYear(year){
  pricingSelectedYear = year || '';
  if(pricingSelectedYear) localStorage.setItem('slate:pricingSelectedYear', pricingSelectedYear);
  else localStorage.removeItem('slate:pricingSelectedYear');
  renderPricingCharts();
}
function renderPricingYearTileBar(){
  const el = document.getElementById('pricingYearTileBar');
  if(!el) return;
  const years = new Set();
  DATA.projects.forEach(p=>{ if(p.deadline) years.add(p.deadline.slice(0,4)); });
  const curYear = new Date().getFullYear();
  const maxYear = getYearTileMaxYear();
  for(let y=curYear; y<=maxYear; y++) years.add(String(y));
  const sortedYears = Array.from(years).sort();
  const countFor = y => DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(y)).length;
  const allActive = !pricingSelectedYear;
  el.innerHTML = `
    <div class="year-tile ${allActive?'active':''}" onclick="setPricingYear('')">
      <div class="year-tile-num">Všetky</div>
      <div class="year-tile-count">${DATA.projects.length} zákaziek</div>
    </div>
    ${sortedYears.map(y=>`
      <div class="year-tile ${pricingSelectedYear===y?'active':''}" onclick="setPricingYear('${y}')">
        <div class="year-tile-num">${y}</div>
        <div class="year-tile-count">${countFor(y)} zákaziek</div>
      </div>`).join('')}
    <div class="year-tile year-tile-add" onclick="extendYearTiles(); renderPricingYearTileBar();" title="Pridať ďalší rok dopredu">
      <div class="year-tile-num">+</div>
      <div class="year-tile-count">rok</div>
    </div>
  `;
}
/* ---- Kapacitné upozornenie — porovná vybraný/aktuálny rok s typickým predošlým rokom
   a upozorní, ak je vyťaženie výrazne nad normál (celoročne alebo v konkrétnom mesiaci). ---- */
function renderCapacityWarning(){
  const el = document.getElementById('capacityWarning');
  if(!el) return;
  const targetYear = pricingSelectedYear || String(new Date().getFullYear());

  const countsByYear = {};
  DATA.projects.forEach(p=>{
    if(!p.deadline) return;
    const y = p.deadline.slice(0,4);
    countsByYear[y] = (countsByYear[y]||0) + 1;
  });
  const otherYears = Object.keys(countsByYear).filter(y=>y!==targetYear);
  const targetCount = countsByYear[targetYear] || 0;

  if(!otherYears.length || targetCount === 0){ el.innerHTML = ''; return; }
  const avgOtherYears = otherYears.reduce((s,y)=>s+countsByYear[y],0) / otherYears.length;
  const maxOtherYear = Math.max(...otherYears.map(y=>countsByYear[y]));

  // Najvyťaženejší mesiac v cieľovom roku vs. historický rekord toho istého mesiaca (iné roky)
  const monthCountsTarget = new Array(12).fill(0);
  const monthCountsOtherMax = new Array(12).fill(0);
  DATA.projects.forEach(p=>{
    if(!p.deadline) return;
    const y = p.deadline.slice(0,4);
    const m = Number(p.deadline.slice(5,7)) - 1;
    if(m<0 || m>11) return;
    if(y === targetYear) monthCountsTarget[m]++;
  });
  otherYears.forEach(y=>{
    const perMonth = new Array(12).fill(0);
    DATA.projects.forEach(p=>{
      if(!p.deadline || !p.deadline.startsWith(y)) return;
      const m = Number(p.deadline.slice(5,7)) - 1;
      if(m>=0 && m<12) perMonth[m]++;
    });
    perMonth.forEach((c,i)=>{ if(c > monthCountsOtherMax[i]) monthCountsOtherMax[i] = c; });
  });
  const monthNames = ['január','február','marec','apríl','máj','jún','júl','august','september','október','november','december'];
  let hottestMonthIdx = -1;
  for(let i=0;i<12;i++){
    if(monthCountsTarget[i] > 0 && monthCountsTarget[i] >= monthCountsOtherMax[i] && monthCountsOtherMax[i] > 0){
      if(hottestMonthIdx===-1 || monthCountsTarget[i] > monthCountsTarget[hottestMonthIdx]) hottestMonthIdx = i;
    }
  }

  const msgs = [];
  if(targetCount > avgOtherYears * 1.15){
    const pctOver = Math.round((targetCount/avgOtherYears - 1) * 100);
    msgs.push(`Rok ${targetYear} má už <b>${targetCount}</b> zákaziek — o ${pctOver}% viac než tvoj typický rok (priemer ${Math.round(avgOtherYears)}). Zváž, či zvládneš tempo, prípadne zvýš ceny.`);
  }
  if(targetCount >= maxOtherYear && targetCount > 0 && maxOtherYear > 0){
    msgs.push(`Rok ${targetYear} sa blíži k tvojmu doteraz najvyťaženejšiemu roku (${maxOtherYear} zákaziek) alebo ho už prekonáva.`);
  }
  if(hottestMonthIdx >= 0){
    msgs.push(`${monthNames[hottestMonthIdx].charAt(0).toUpperCase()+monthNames[hottestMonthIdx].slice(1)} ${targetYear} má ${monthCountsTarget[hottestMonthIdx]} zákaziek — vyrovnáva alebo prekonáva tvoj doterajší rekord pre tento mesiac.`);
  }

  if(!msgs.length){ el.innerHTML = ''; return; }
  el.innerHTML = `<div style="margin-top:14px;padding:12px 14px;background:rgba(224,82,79,.1);border:1px solid rgba(224,82,79,.35);border-radius:10px;font-size:13px;color:var(--text);">
    ⚠️ <b>Kapacitné upozornenie:</b> ${msgs.join(' ')}
  </div>`;
}

function median(arr){
  if(!arr.length) return 0;
  const s = arr.slice().sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
}
function renderPricingForecast(){
  const el = document.getElementById('pricingForecast');
  if(!el) return;
  const realCurrentYear = new Date().getFullYear();
  const year = pricingSelectedYear ? Number(pricingSelectedYear) : realCurrentYear;
  const isFutureYear = year > realCurrentYear;
  const isPastYear = year < realCurrentYear;
  const now = new Date();
  const isLeap = (year%4===0 && year%100!==0) || year%400===0;
  const daysInYear = isLeap ? 366 : 365;
  let daysElapsed, pctYearElapsed;
  if(isFutureYear){ daysElapsed = 0; pctYearElapsed = 0; }
  else if(isPastYear){ daysElapsed = daysInYear; pctYearElapsed = 100; }
  else{
    const startOfYear = new Date(year,0,1);
    daysElapsed = Math.max(1, Math.floor((now-startOfYear)/86400000)+1);
    pctYearElapsed = Math.min(100, Math.round(daysElapsed/daysInYear*100));
  }

  const paidToDate = DATA.invoices.filter(i=>{
    if(i.status !== 'uhradena') return false;
    const project = DATA.projects.find(p=>p.id===i.projectId);
    const dateStr = (project && project.deadline) || i.due;
    return dateStr && dateStr.startsWith(String(year));
  }).reduce((s,i)=>s+Number(i.amount||0),0);

  const bookedThisYear = DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(String(year)))
    .reduce((s,p)=>s+Number(p.budget||0),0);

  const runRate = daysElapsed>0 ? paidToDate / daysElapsed * daysInYear : 0;
  const estimate = isPastYear ? paidToDate : Math.max(runRate, bookedThisYear);
  const estimateLabel = isPastYear ? 'Skutočný príjem za rok' : (isFutureYear ? 'Odhad na základe zabookovaného' : 'Odhad celoročného príjmu');
  const paceCaption = isPastYear
    ? `Rok ${year} je uzavretý`
    : (isFutureYear ? `Rok ${year} ešte nezačal — zatiaľ len zabookované zákazky` : `Prešlo ${pctYearElapsed}% roka ${year} · Tempo podľa platieb: ${fmtMoney(runRate)}/rok`);

  const goal = DATA.settings.yearlyGoals && DATA.settings.yearlyGoals[year];
  let goalHtml = '';
  if(goal){
    const pctPaid = Math.min(100, Math.round(paidToDate/goal*100));
    const pctEstimate = Math.round(estimate/goal*100);
    const onTrack = estimate >= goal;
    goalHtml = `
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--surface-3);">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
          <span>🎯 Ročný cieľ (${year}): <b style="color:var(--text);">${fmtMoney(goal)}</b></span>
          <span class="row-sub" style="${onTrack?'color:var(--green-page);':'color:#f0827f;'}">${onTrack ? (isPastYear?'Cieľ splnený 🎉':'Podľa odhadu cieľ splníš 🎉') : (isPastYear?'Cieľ nebol splnený':'Podľa doterajšieho tempa cieľ zatiaľ nesplníš')}</span>
        </div>
        <div class="hbar-track" style="margin-bottom:6px;"><div class="hbar-fill" data-pct="${pctPaid}" style="width:0%;"></div></div>
        <div class="row-sub">Vyplatené: ${pctPaid}% cieľa ${isPastYear?'':'· Odhad na konci roka: '+pctEstimate+'% cieľa'}</div>
      </div>`;
  }

  el.innerHTML = `
    <div class="grid-stats" style="margin-bottom:14px;">
      <div class="stat-card"><div class="stat-num">${fmtMoney(paidToDate)}</div><div class="stat-label">Vyplatené (${year})</div></div>
      <div class="stat-card"><div class="stat-num">${fmtMoney(bookedThisYear)}</div><div class="stat-label">Zabookovaná hodnota za ${year}</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--accent);">${fmtMoney(estimate)}</div><div class="stat-label">${estimateLabel}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
      <span>${paceCaption}</span>
    </div>
    <div class="hbar-track"><div class="hbar-fill" data-pct="${pctYearElapsed}" style="width:0%;"></div></div>
    ${goalHtml}
  `;
  animateFillIn(el, '.hbar-fill', 'width');
}
function renderAvgPriceBreakdown(){
  const typeEl = document.getElementById('avgPriceByType');
  const balikEl = document.getElementById('avgPriceByBalik');
  if(!typeEl || !balikEl) return;
  const typeLabels = { svadba:'Svadba', stuzkova:'Stužková', klip:'Klip', ine:'Iné' };

  // Priemer/medián rešpektuje vybraný rok (ak je nastavený) — trend nižšie potrebuje
  // dáta naprieč VŠETKÝMI rokmi, preto sa počíta z DATA.projects bez tohto filtra.
  const yearFilteredProjects = pricingSelectedYear
    ? DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(pricingSelectedYear))
    : DATA.projects;

  const byType = {};
  yearFilteredProjects.forEach(p=>{
    if(!p.budget) return;
    const t = p.type || 'ine';
    if(!byType[t]) byType[t] = [];
    byType[t].push(Number(p.budget));
  });
  const typeRows = Object.keys(byType).map(t=>{
    const vals = byType[t];
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    return { label: typeLabels[t]||t, count: vals.length, avg, median: median(vals) };
  }).sort((a,b)=>b.avg-a.avg);
  typeEl.innerHTML = typeRows.length ? `<table><thead><tr><th>Typ</th><th>Počet</th><th>Priemer</th><th>Medián</th></tr></thead><tbody>
    ${typeRows.map(r=>`<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${fmtMoney(r.avg)}</td><td class="num">${fmtMoney(r.median)}</td></tr>`).join('')}
  </tbody></table>` : '<div class="empty">Zatiaľ žiadne dáta.</div>';

  const byBalik = {};
  yearFilteredProjects.forEach(p=>{
    const b = (p.wedding && p.wedding.balik) || (p.stuzkova && p.stuzkova.balik);
    if(!b || !p.budget) return;
    if(!byBalik[b]) byBalik[b] = [];
    byBalik[b].push(Number(p.budget));
  });
  const byBalikByYear = {}; // balikId -> { year: [budgets] } — vždy naprieč všetkými rokmi (pre trend)
  DATA.projects.forEach(p=>{
    const b = (p.wedding && p.wedding.balik) || (p.stuzkova && p.stuzkova.balik);
    if(!b || !p.budget || !p.deadline) return;
    const y = p.deadline.slice(0,4);
    if(!byBalikByYear[b]) byBalikByYear[b] = {};
    if(!byBalikByYear[b][y]) byBalikByYear[b][y] = [];
    byBalikByYear[b][y].push(Number(p.budget));
  });
  const balikRows = Object.keys(byBalik).map(b=>{
    const vals = byBalik[b];
    const avg = vals.reduce((a,b2)=>a+b2,0)/vals.length;
    return { label: 'Balík '+b, count: vals.length, avg, median: median(vals) };
  }).sort((a,b)=>b.avg-a.avg);
  balikEl.innerHTML = balikRows.length ? `<table><thead><tr><th>Balík</th><th>Počet</th><th>Priemer</th><th>Medián</th></tr></thead><tbody>
    ${balikRows.map(r=>`<tr><td>${escapeHtml(r.label)}</td><td class="num">${r.count}</td><td class="num">${fmtMoney(r.avg)}</td><td class="num">${fmtMoney(r.median)}</td></tr>`).join('')}
  </tbody></table>` : '<div class="empty">Zatiaľ žiadne dáta.</div>';

  const trendEl = document.getElementById('balikPriceTrend');
  if(trendEl){
    const trendRows = Object.keys(byBalikByYear).map(b=>{
      const yearAvgs = {};
      Object.keys(byBalikByYear[b]).forEach(y=>{
        const vals = byBalikByYear[b][y];
        yearAvgs[y] = vals.reduce((a,c)=>a+c,0)/vals.length;
      });
      const years = Object.keys(yearAvgs).sort();
      if(years.length < 2) return null;
      const firstY = years[0], lastY = years[years.length-1];
      const firstV = yearAvgs[firstY], lastV = yearAvgs[lastY];
      const span = Number(lastY) - Number(firstY);
      if(span <= 0 || firstV <= 0) return null;
      const perYearGrowth = Math.pow(lastV/firstV, 1/span) - 1;
      const nextYear = Number(lastY) + 1;
      const suggested = lastV * (1 + perYearGrowth);
      return { label: 'Balík '+b, firstY, lastY, firstV, lastV, perYearGrowth, nextYear, suggested };
    }).filter(Boolean);
    if(!trendRows.length){
      trendEl.innerHTML = '';
    }else{
      trendEl.innerHTML = `<p class="row-sub" style="margin-bottom:8px;">📈 Trend cien naprieč všetkými rokmi (nezávisle od výberu vyššie) — odporúčaná cena na ${trendRows[0].nextYear} pri zachovaní doterajšieho tempa rastu:</p>
        <div style="display:flex;flex-direction:column;gap:6px;">
        ${trendRows.map(r=>{
          const pct = Math.round(r.perYearGrowth*100);
          const dirColor = pct >= 0 ? 'var(--green-page)' : 'var(--danger)';
          const dirTxt = pct >= 0 ? `📈 rastie ~${pct}%/rok` : `📉 klesá ~${Math.abs(pct)}%/rok`;
          return `<div style="font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <span>${escapeHtml(r.label)}: ${fmtMoney(r.firstV)} (${r.firstY}) → ${fmtMoney(r.lastV)} (${r.lastY}), <b style="color:${dirColor};">${dirTxt}</b></span>
            <span><b style="color:var(--accent);">Odporúčaná cena ${r.nextYear}: ${fmtMoney(r.suggested)}</b></span>
          </div>`;
        }).join('')}
        </div>`;
    }
  }
}
function renderPricingCharts(){
  renderPricingYearTileBar();
  renderYearsAndSeasonCharts();
  renderPricingForecast();
  renderAvgPriceBreakdown();
  renderCapacityWarning();
  const projects = pricingSelectedYear
    ? DATA.projects.filter(p=>p.deadline && p.deadline.startsWith(pricingSelectedYear))
    : DATA.projects;

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
  renderHBarList('revenueBalikBars', balikItems, { color: (it,i)=>balikColors[i % balikColors.length] });

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
  // Zvýrazní vybraný rok z prepínača navrchu stránky; keď nič nie je vybrané ("Všetky"),
  // zvýrazní aspoň aktuálny kalendárny rok, aby bol prehľad vždy zorientovaný.
  const highlightYearStr = pricingSelectedYear || String(new Date().getFullYear());
  renderMiniBarChart('yearsBarChart', years, yearValues, {
    fmt: yearFmt,
    onClick: goToProjectsYear,
    colClass: (label)=> label===highlightYearStr ? 'mini-bar-current' : ''
  });

  // Porovnanie rok/rok — "k dnešnému dňu" (rovnaký deň v roku), aby bolo porovnanie férové
  // aj v priebehu roka, nie len celoročné súčty.
  const yoyEl = document.getElementById('yearsYoyBadge');
  if(yoyEl){
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const cutoffMD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const toDateVal = (year, useCount)=>{
      let sum = 0;
      if(yearsOverviewMode === 'paid'){
        DATA.invoices.filter(i=>i.status==='uhradena').forEach(i=>{
          const project = DATA.projects.find(p=>p.id===i.projectId);
          const dateStr = (project && project.deadline) || i.due;
          if(!dateStr || !dateStr.startsWith(String(year))) return;
          if(dateStr.slice(5,10) > cutoffMD) return;
          sum += useCount ? 1 : (Number(i.amount)||0);
        });
      }else{
        projects.forEach(p=>{
          if(!p.deadline || !p.deadline.startsWith(String(year))) return;
          if(p.deadline.slice(5,10) > cutoffMD) return;
          sum += useCount ? 1 : (Number(p.budget)||0);
        });
      }
      return sum;
    };
    const thisYearToDate = toDateVal(thisYear, yearsOverviewMode!=='paid');
    const lastYearToDate = toDateVal(lastYear, yearsOverviewMode!=='paid');
    if(lastYearToDate > 0){
      const diffPct = Math.round((thisYearToDate - lastYearToDate) / lastYearToDate * 100);
      const arrow = diffPct >= 0 ? '📈' : '📉';
      const sign = diffPct >= 0 ? '+' : '';
      const diffColor = diffPct >= 0 ? 'var(--green-page)' : 'var(--danger)';
      const metric = yearsOverviewMode==='paid' ? 'vyplatených faktúr' : 'zákaziek';
      yoyEl.innerHTML = `${arrow} K dnešnému dňu (${cutoffMD.replace('-','.')}.) máš <b style="color:${diffColor};">${sign}${diffPct}%</b> ${metric} oproti rovnakému obdobiu ${lastYear} (${lastYearToDate} vtedy → ${thisYearToDate} teraz)`;
    }else if(thisYearToDate > 0){
      yoyEl.innerHTML = `📈 Za ${lastYear} nebolo k tomuto dátumu zaznamenané nič — tento rok už máš ${thisYearToDate}.`;
    }else{
      yoyEl.innerHTML = '';
    }
  }

  const tableEl = document.getElementById('yearsOverviewTable');
  if(tableEl){
    if(!years.length){
      tableEl.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>';
    }else if(yearsOverviewMode==='paid'){
      tableEl.innerHTML = `<table><thead><tr><th>Rok</th><th>Uhradené faktúry</th><th>Vyplatené</th></tr></thead><tbody>
        ${years.map(y=>`<tr class="clickable-row" onclick="goToProjectsYear('${y}')" title="Zobraziť zákazky za rok ${y}"><td>${y} →</td><td class="num">${yearMap[y].count}</td><td class="num">${fmtMoney(yearMap[y].value)}</td></tr>`).join('')}
      </tbody></table>`;
    }else{
      tableEl.innerHTML = `<table><thead><tr><th>Rok</th><th>Zákaziek</th><th>Rozpočet spolu</th></tr></thead><tbody>
        ${years.map(y=>`<tr class="clickable-row" onclick="goToProjectsYear('${y}')" title="Zobraziť zákazky za rok ${y}"><td>${y} →</td><td class="num">${yearMap[y].count}</td><td class="num">${fmtMoney(yearMap[y].value)}</td></tr>`).join('')}
      </tbody></table>`;
    }
  }

  const monthNames = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
  const monthCounts = new Array(12).fill(0);
  const seasonProjects = pricingSelectedYear
    ? projects.filter(p=>p.deadline && p.deadline.startsWith(pricingSelectedYear))
    : projects;
  const seasonSubtextEl = document.getElementById('seasonSubtext');
  if(seasonSubtextEl){
    seasonSubtextEl.textContent = pricingSelectedYear
      ? `Počet zákaziek podľa mesiaca len za rok ${pricingSelectedYear} — pomôže naplánovať, kedy čakať nával a kedy pokoj.`
      : 'Počet zákaziek podľa mesiaca v roku, spočítané naprieč všetkými rokmi — pomôže naplánovať, kedy čakať nával a kedy pokoj.';
  }
  seasonProjects.forEach(p=>{
    if(!p.deadline) return;
    const m = Number(p.deadline.slice(5,7)) - 1;
    if(m>=0 && m<12) monthCounts[m]++;
  });

  const insightEl = document.getElementById('seasonInsight');
  const total = monthCounts.reduce((a,b)=>a+b,0);
  let topNames = [], weakNames = [];
  if(total > 0){
    const indexed = monthNames.map((name,i)=>({ name, count: monthCounts[i] }));
    const sorted = indexed.slice().sort((a,b)=>b.count-a.count);
    const topMonths = sorted.filter(m=>m.count>0).slice(0,2);
    const weakMonths = sorted.filter(m=>m.count>0).slice(-2).reverse();
    topNames = topMonths.map(m=>m.name);
    const weakOverlapsTop = weakMonths.length && topMonths.length && weakMonths[0].name === topMonths[0].name;
    weakNames = weakOverlapsTop ? [] : weakMonths.map(m=>m.name);
    if(insightEl){
      const topTxt = topMonths.map(m=>`${m.name} (${m.count})`).join(', ');
      const weakTxt = weakNames.length ? weakMonths.map(m=>`${m.name} (${m.count})`).join(', ') : '';
      let txt = `🔥 Najsilnejšie mesiace: <b style="color:var(--green-page);">${topTxt}</b> — tu má zmysel zvážiť vyššie ceny alebo skorší booking.`;
      if(weakTxt) txt += ` 🌤️ Najslabšie: <b style="color:var(--text-dim);">${weakTxt}</b> — priestor na akcie alebo iný typ zákaziek.`;
      insightEl.innerHTML = txt;
    }
  }else if(insightEl){
    insightEl.innerHTML = '';
  }

  renderMiniBarChart('seasonBarChart', monthNames, monthCounts, {
    fmt: v=>String(v),
    colClass: (label)=>{
      if(topNames.includes(label)) return 'mini-bar-top';
      if(weakNames.includes(label)) return 'mini-bar-weak';
      return '';
    }
  });
}
/* ---- Prekliknutie z grafu/tabuľky rokov priamo do Zákaziek, filtrovaných na daný rok ---- */
function goToProjectsYear(year){
  if(!year) return;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const navItem = document.querySelector('.nav-item[data-view="projects"]');
  if(navItem) navItem.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-projects').classList.add('active');
  currentView = 'projects';
  const yearNum = Number(year);
  if(yearNum && yearNum > getYearTileMaxYear()){
    localStorage.setItem('slate:yearTileMaxYear', String(yearNum));
  }
  setYearFilter(String(year));
  showToast(`Zákazky za rok ${year}`);
}
