/* ===================== 20-slovakia-map.js =====================
   Mapa — kde všade si už natáčal (podľa vyplneného miesta konania zákazky).
   Čisto pre zaujímavosť: geokóduje sa cez rovnaký free Open-Meteo lookup ako počasie,
   výsledky sa cachujú v localStorage, aby sa opakovane neposielali requesty na tie isté obce.
   Hranica Slovenska je zjednodušený, ilustratívny polygón (nie geodeticky presný) —
   na "zaujímavostnú" mapku to stačí; presné čísla dáva zoznam obcí pod mapou.
   ===================================================== */

var SLOVAKIA_BORDER = [
  [16.85,48.14],[16.97,48.32],[17.05,48.60],[17.25,48.85],[17.60,49.05],
  [17.95,49.25],[18.30,49.50],[18.85,49.53],[19.30,49.45],[19.65,49.38],
  [19.95,49.28],[20.35,49.38],[20.75,49.42],[21.15,49.47],[21.55,49.40],
  [21.90,49.35],[22.25,49.22],[22.56,49.08],
  [22.50,48.85],[22.42,48.65],[22.30,48.42],
  [21.90,48.38],[21.55,48.32],[21.25,48.60],[21.00,48.38],[20.65,48.28],
  [20.30,48.20],[19.90,48.05],[19.55,47.95],[19.15,47.90],[18.75,47.78],
  [18.35,47.76],[18.10,47.76],[17.75,47.83],[17.45,47.95],[17.20,48.05],
  [17.00,48.10]
];
// Pár väčších miest len ako tiché orientačné body na pozadí mapy (nie dáta zo zákaziek).
var SK_REFERENCE_CITIES = [
  { name:'Bratislava', lon:17.11, lat:48.15 },
  { name:'Žilina', lon:18.74, lat:49.22 },
  { name:'Banská Bystrica', lon:19.15, lat:48.74 },
  { name:'Prešov', lon:21.24, lat:49.00 },
  { name:'Košice', lon:21.26, lat:48.72 },
  { name:'Nitra', lon:18.09, lat:48.31 }
];
var SK_TYPE_COLOR = { svadba:'#e0568a', stuzkova:'#3d8fe0', klip:'#e0c828', ine:'#9c9890' };
var SK_BOUNDS = { lonMin:16.83, lonMax:22.60, latMin:47.70, latMax:49.65 };
var SK_VIEW_W = 800, SK_VIEW_H = 440;
function projectSkPoint(lon, lat){
  const x = (lon - SK_BOUNDS.lonMin) / (SK_BOUNDS.lonMax - SK_BOUNDS.lonMin) * SK_VIEW_W;
  const y = SK_VIEW_H - (lat - SK_BOUNDS.latMin) / (SK_BOUNDS.latMax - SK_BOUNDS.latMin) * SK_VIEW_H;
  return [x, y];
}
function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function loadGeocodeCache(){
  try{ return JSON.parse(localStorage.getItem('slate:geocodeCache') || '{}'); }catch(e){ return {}; }
}
function saveGeocodeCache(cache){
  try{ localStorage.setItem('slate:geocodeCache', JSON.stringify(cache)); }catch(e){ /* ignore quota errors */ }
}
async function geocodeWithCache(cache, rawText){
  const cacheKey = rawText.trim().toLowerCase();
  if(cache[cacheKey] !== undefined) return cache[cacheKey];
  let result = null;
  try{ result = await geocodeLocation(rawText); }catch(e){ /* skús ďalej */ }
  cache[cacheKey] = result ? { lat: result.latitude, lon: result.longitude, name: result.name } : null;
  return cache[cacheKey];
}

var mapTypeFilter = '';
function setMapTypeFilter(type, btnEl){
  mapTypeFilter = type;
  document.querySelectorAll('.map-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  mapListExpanded = false;
  renderSlovakiaMap();
}

async function renderSlovakiaMap(){
  const statusEl = document.getElementById('mapStatus');
  const svgEl = document.getElementById('slovakiaMapSvg');
  const listEl = document.getElementById('mapVillageList');
  const statsEl = document.getElementById('mapStatsGrid');
  if(!svgEl) return;

  const projects = DATA.projects.filter(p=>{
    if(mapTypeFilter && p.type !== mapTypeFilter) return false;
    return !!getProjectWeatherLocation(p);
  });

  if(!projects.length){
    if(statusEl) statusEl.textContent = 'Zatiaľ žiadne zákazky s vyplneným miestom konania.';
    svgEl.innerHTML = '';
    if(listEl) listEl.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>';
    if(statsEl) statsEl.innerHTML = '';
    return;
  }

  const byRawLocation = {};
  projects.forEach(p=>{
    const loc = getProjectWeatherLocation(p);
    if(!byRawLocation[loc]) byRawLocation[loc] = [];
    byRawLocation[loc].push(p);
  });

  const cache = loadGeocodeCache();
  const rawLocations = Object.keys(byRawLocation);
  const toResolve = rawLocations.filter(loc => cache[loc.trim().toLowerCase()] === undefined);

  let done = 0;
  for(const loc of toResolve){
    if(statusEl) statusEl.textContent = `Načítavam polohy obcí… (${done+1}/${toResolve.length})`;
    await geocodeWithCache(cache, loc);
    done++;
  }
  if(toResolve.length) saveGeocodeCache(cache);

  const byVillage = {}; // resolved name -> { count, lat, lon, found, byType:{svadba,stuzkova,klip,ine} }
  rawLocations.forEach(loc=>{
    const cacheKey = loc.trim().toLowerCase();
    const geo = cache[cacheKey];
    const projs = byRawLocation[loc];
    const key = geo ? geo.name : loc;
    if(!byVillage[key]) byVillage[key] = { count:0, lat: geo?geo.lat:null, lon: geo?geo.lon:null, found: !!geo, byType:{svadba:0,stuzkova:0,klip:0,ine:0} };
    projs.forEach(p=>{
      byVillage[key].count++;
      const t = SK_TYPE_COLOR[p.type] ? p.type : 'ine';
      byVillage[key].byType[t]++;
    });
  });

  // Domovský okres (z Cenotvorby) — pre "najďalej si cestoval" štatistiku.
  let homeGeo = null;
  const homeDistrict = (PRICING && PRICING.homeDistrict) ? PRICING.homeDistrict.trim() : '';
  if(homeDistrict){
    homeGeo = await geocodeWithCache(cache, homeDistrict);
    saveGeocodeCache(cache);
  }

  if(statusEl){
    const villageCount = Object.keys(byVillage).length;
    statusEl.textContent = `${projects.length} zákaziek naprieč ${villageCount} obcami/mestami.`;
  }
  renderSkMapSvg(byVillage);
  renderSkMapVillageList(byVillage);
  renderSkMapStats(byVillage, homeGeo);
}

function skDominantType(byType){
  let best = 'ine', bestCount = -1;
  Object.keys(byType).forEach(t=>{ if(byType[t] > bestCount){ bestCount = byType[t]; best = t; } });
  return best;
}

function renderSkMapSvg(byVillage){
  const svgEl = document.getElementById('slovakiaMapSvg');
  if(!svgEl) return;
  const borderPoints = SLOVAKIA_BORDER.map(([lon,lat])=>projectSkPoint(lon,lat));
  const pathD = 'M' + borderPoints.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L') + ' Z';

  const refHtml = SK_REFERENCE_CITIES.map(c=>{
    const [x,y] = projectSkPoint(c.lon, c.lat);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" class="sk-map-ref-dot"></circle>
      <text x="${(x+6).toFixed(1)}" y="${(y+3).toFixed(1)}" class="sk-map-ref-label">${escapeHtml(c.name)}</text>`;
  }).join('');

  const names = Object.keys(byVillage).filter(k=>byVillage[k].found);
  const maxCount = Math.max(...names.map(k=>byVillage[k].count), 1);
  // Popisky priamo na mape len pri väčších obciach — a len ak nie sú príliš blízko už
  // popísanej (väčšej) obci, inak by sa pri susediacich obciach text prekrýval.
  const MIN_LABEL_DIST = 42;
  const labelNames = new Set();
  const labeledPoints = [];
  names.slice().sort((a,b)=>byVillage[b].count-byVillage[a].count).forEach(name=>{
    if(labelNames.size >= 6) return;
    const v = byVillage[name];
    const [px,py] = projectSkPoint(v.lon, v.lat);
    const tooClose = labeledPoints.some(p=> Math.hypot(p[0]-px, p[1]-py) < MIN_LABEL_DIST);
    if(!tooClose){ labelNames.add(name); labeledPoints.push([px,py]); }
  });

  const dotsHtml = names.map(name=>{
    const v = byVillage[name];
    const [x,y] = projectSkPoint(v.lon, v.lat);
    const r = 4 + Math.sqrt(v.count/maxCount) * 15;
    const color = SK_TYPE_COLOR[skDominantType(v.byType)];
    const typeBreakdown = Object.keys(v.byType).filter(t=>v.byType[t]>0).map(t=>`${t}: ${v.byType[t]}`).join(', ');
    const label = labelNames.has(name) ? `<text x="${x.toFixed(1)}" y="${(y - r - 5).toFixed(1)}" class="sk-map-village-label">${escapeHtml(name)} (${v.count})</text>` : '';
    return `<g>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0" data-r="${r.toFixed(1)}" class="sk-map-dot" style="fill:${color};stroke:${color};"><title>${escapeHtml(name)} — ${v.count}× (${typeBreakdown})</title></circle>
      ${label}
    </g>`;
  }).join('');

  svgEl.innerHTML = `<path d="${pathD}" class="sk-map-outline"></path>${refHtml}${dotsHtml}`;

  // Dvojitý requestAnimationFrame, aby prehliadač stihol vykresliť r=0 pred prechodom na cieľovú
  // hodnotu — vďaka CSS transition na "r" to pôsobí ako plynulé "vyrastenie" bodiek pri načítaní.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    svgEl.querySelectorAll('.sk-map-dot').forEach(dot=>{ dot.setAttribute('r', dot.dataset.r); });
  }));
}

/* ---- Zoznam obcí — vyhľadávanie, zoraďovanie kliknutím na hlavičku, a "top 15 +
   zobraziť všetky", aby dlhý zoznam nezahltil stránku. Posledné dáta si appka
   pamätá (mapListByVillageCache), aby zmena hľadania/zoradenia nemusela znovu geokódovať. ---- */
var mapListByVillageCache = null;
var mapListSearch = '';
var mapListSort = { field:'count', dir:'desc' };
var mapListExpanded = false;
function onMapListSearchInput(){
  mapListSearch = document.getElementById('mapListSearch').value;
  mapListExpanded = false;
  renderSkMapVillageList(mapListByVillageCache);
}
function setMapListSort(field){
  if(mapListSort.field === field) mapListSort.dir = mapListSort.dir==='asc' ? 'desc' : 'asc';
  else mapListSort = { field, dir: field==='name' ? 'asc' : 'desc' };
  renderSkMapVillageList(mapListByVillageCache);
}
function toggleMapListExpanded(){
  mapListExpanded = !mapListExpanded;
  renderSkMapVillageList(mapListByVillageCache);
}
function renderSkMapVillageList(byVillage){
  if(byVillage) mapListByVillageCache = byVillage;
  const el = document.getElementById('mapVillageList');
  if(!el || !byVillage) return;

  let rows = Object.keys(byVillage).map(name=>({ name, count: byVillage[name].count, found: byVillage[name].found }));
  const q = mapListSearch.trim().toLowerCase();
  if(q) rows = rows.filter(r=>r.name.toLowerCase().includes(q));
  rows.sort((a,b)=>{
    const cmp = mapListSort.field==='name' ? a.name.localeCompare(b.name) : (a.count-b.count);
    return mapListSort.dir==='asc' ? cmp : -cmp;
  });

  if(!rows.length){ el.innerHTML = `<div class="empty">${q?'Žiadna obec nezodpovedá hľadaniu.':'Žiadne dáta.'}</div>`; return; }

  const TOP_N = 15;
  const visibleRows = mapListExpanded ? rows : rows.slice(0, TOP_N);
  const showMedals = mapListSort.field==='count' && mapListSort.dir==='desc' && !q;
  const medals = ['🥇','🥈','🥉'];
  const arrow = field => mapListSort.field===field ? (mapListSort.dir==='asc'?' ▲':' ▼') : '';

  el.innerHTML = `
    <table><thead><tr>
      <th style="cursor:pointer;user-select:none;" onclick="setMapListSort('name')">Obec / mesto${arrow('name')}</th>
      <th style="cursor:pointer;user-select:none;" onclick="setMapListSort('count')">Počet${arrow('count')}</th>
    </tr></thead><tbody>
      ${visibleRows.map((r,i)=>`<tr><td>${showMedals&&medals[i]?medals[i]+' ':''}${escapeHtml(r.name)}${r.found?'':' <span class="row-sub">(poloha sa nenašla)</span>'}</td><td class="num">${r.count}</td></tr>`).join('')}
    </tbody></table>
    ${rows.length>TOP_N ? `<button class="btn ghost small" style="margin-top:10px;" onclick="toggleMapListExpanded()">${mapListExpanded?'Zobraziť menej':`Zobraziť všetky (${rows.length})`}</button>` : ''}
  `;
}

function renderSkMapStats(byVillage, homeGeo){
  const el = document.getElementById('mapStatsGrid');
  if(!el) return;
  const entries = Object.keys(byVillage).map(name=>({ name, ...byVillage[name] }));
  const topVillage = entries.slice().sort((a,b)=>b.count-a.count)[0];
  const uniqueCount = entries.length;

  let farthestHtml = '';
  if(homeGeo){
    const withDistance = entries.filter(e=>e.found).map(e=>({ name:e.name, km: haversineKm(homeGeo.lat, homeGeo.lon, e.lat, e.lon) }));
    const farthest = withDistance.sort((a,b)=>b.km-a.km)[0];
    if(farthest && farthest.km > 0.5){
      farthestHtml = `<div class="stat-card"><div class="stat-num">${Math.round(farthest.km)} km</div><div class="stat-label">Najďalej — ${escapeHtml(farthest.name)}</div></div>`;
    }
  }

  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${topVillage ? topVillage.count : 0}×</div><div class="stat-label">Najviac — ${topVillage ? escapeHtml(topVillage.name) : '—'}</div></div>
    <div class="stat-card"><div class="stat-num">${uniqueCount}</div><div class="stat-label">Rôznych obcí/miest</div></div>
    ${farthestHtml}
  `;
}
