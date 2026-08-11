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
var SK_BOUNDS = { lonMin:16.83, lonMax:22.60, latMin:47.70, latMax:49.65 };
var SK_VIEW_W = 800, SK_VIEW_H = 440;
function projectSkPoint(lon, lat){
  const x = (lon - SK_BOUNDS.lonMin) / (SK_BOUNDS.lonMax - SK_BOUNDS.lonMin) * SK_VIEW_W;
  const y = SK_VIEW_H - (lat - SK_BOUNDS.latMin) / (SK_BOUNDS.latMax - SK_BOUNDS.latMin) * SK_VIEW_H;
  return [x, y];
}
function loadGeocodeCache(){
  try{ return JSON.parse(localStorage.getItem('slate:geocodeCache') || '{}'); }catch(e){ return {}; }
}
function saveGeocodeCache(cache){
  try{ localStorage.setItem('slate:geocodeCache', JSON.stringify(cache)); }catch(e){ /* ignore quota errors */ }
}

var mapTypeFilter = '';
function setMapTypeFilter(type, btnEl){
  mapTypeFilter = type;
  document.querySelectorAll('.map-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  renderSlovakiaMap();
}

async function renderSlovakiaMap(){
  const statusEl = document.getElementById('mapStatus');
  const svgEl = document.getElementById('slovakiaMapSvg');
  const listEl = document.getElementById('mapVillageList');
  if(!svgEl) return;

  const projects = DATA.projects.filter(p=>{
    if(mapTypeFilter && p.type !== mapTypeFilter) return false;
    return !!getProjectWeatherLocation(p);
  });

  if(!projects.length){
    if(statusEl) statusEl.textContent = 'Zatiaľ žiadne zákazky s vyplneným miestom konania.';
    svgEl.innerHTML = '';
    if(listEl) listEl.innerHTML = '<div class="empty">Zatiaľ žiadne dáta.</div>';
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
    const cacheKey = loc.trim().toLowerCase();
    let result = null;
    try{ result = await geocodeLocation(loc); }catch(e){ /* skús ďalšiu obec */ }
    cache[cacheKey] = result ? { lat: result.latitude, lon: result.longitude, name: result.name } : null;
    done++;
  }
  if(toResolve.length) saveGeocodeCache(cache);

  const byVillage = {}; // resolved name -> { count, lat, lon, found }
  rawLocations.forEach(loc=>{
    const cacheKey = loc.trim().toLowerCase();
    const geo = cache[cacheKey];
    const count = byRawLocation[loc].length;
    const key = geo ? geo.name : loc;
    if(!byVillage[key]) byVillage[key] = { count:0, lat: geo?geo.lat:null, lon: geo?geo.lon:null, found: !!geo };
    byVillage[key].count += count;
  });

  if(statusEl){
    const villageCount = Object.keys(byVillage).length;
    statusEl.textContent = `${projects.length} zákaziek naprieč ${villageCount} obcami/mestami.`;
  }
  renderSkMapSvg(byVillage);
  renderSkMapVillageList(byVillage);
}

function renderSkMapSvg(byVillage){
  const svgEl = document.getElementById('slovakiaMapSvg');
  if(!svgEl) return;
  const borderPoints = SLOVAKIA_BORDER.map(([lon,lat])=>projectSkPoint(lon,lat));
  const pathD = 'M' + borderPoints.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L') + ' Z';

  const names = Object.keys(byVillage).filter(k=>byVillage[k].found);
  const maxCount = Math.max(...names.map(k=>byVillage[k].count), 1);

  const dotsHtml = names.map(name=>{
    const v = byVillage[name];
    const [x,y] = projectSkPoint(v.lon, v.lat);
    const r = 4 + Math.sqrt(v.count/maxCount) * 15;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" class="sk-map-dot"><title>${escapeHtml(name)} — ${v.count}×</title></circle>`;
  }).join('');

  svgEl.innerHTML = `<path d="${pathD}" class="sk-map-outline"></path>${dotsHtml}`;
}

function renderSkMapVillageList(byVillage){
  const el = document.getElementById('mapVillageList');
  if(!el) return;
  const rows = Object.keys(byVillage)
    .map(name=>({ name, count: byVillage[name].count, found: byVillage[name].found }))
    .sort((a,b)=> b.count-a.count || a.name.localeCompare(b.name));
  if(!rows.length){ el.innerHTML = '<div class="empty">Žiadne dáta.</div>'; return; }
  const medals = ['🥇','🥈','🥉'];
  el.innerHTML = `<table><thead><tr><th>Obec / mesto</th><th>Počet zákaziek</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr><td>${medals[i]?medals[i]+' ':''}${escapeHtml(r.name)}${r.found?'':' <span class="row-sub">(poloha sa nenašla)</span>'}</td><td class="num">${r.count}</td></tr>`).join('')}
  </tbody></table>`;
}
