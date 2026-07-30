/* ===================== 01-state.js =====================
   Dátový model appky (DATA, PRICING, nastavenia), stavy zákaziek, migrácie starých dát, systém Koša.
   ===================================================== */

/* ===================== STATE ===================== */
var DATA = { clients: [], bookings: [], projects: [], invoices: [], expenses: [], vendors: [], trash: [], quickNotes: [], settings: {} };
var DEFAULT_PRICING = {
  kmRate: 0.30,
  homeDistrict: '',
  balicky: [
    { id:'A', name:'Balík A', price:400 },
    { id:'B', name:'Balík B', price:500 },
    { id:'C', name:'Balík C', price:600 }
  ],
  priplatky: [
    { id: uid(), name:'2. kamera', price:100 },
    { id: uid(), name:'Dron', price:80 },
    { id: uid(), name:'Kradnutie (stužková)', price:200 }
  ],
  yearPrices: {} // { "2027": { "A": 450, "B": 550 } }
};
var PRICING = JSON.parse(JSON.stringify(DEFAULT_PRICING));
var DEFAULT_SETTINGS = {
  companyName: 'Moja produkcia',
  ownerName: '',
  address: '',
  ico: '',
  dic: '',
  iban: '',
  email: '',
  phone: '',
  vatPayer: false,
  defaultVatRate: 20,
  contractTemplate:
`ZMLUVA O DIELO
uzatvorená podľa § 631 a nasl. Občianskeho zákonníka

Objednávateľ: {{klient}}

Zhotoviteľ: {{produkcia}}
Zastúpený: {{konatel}}
IČO: {{ico}}    DIČ: {{dic}}
Sídlo: {{adresa}}
IBAN: {{iban}}

Predmet zmluvy:
Zhotoviteľ sa zaväzuje pre objednávateľa zrealizovať audiovizuálnu produkciu s názvom "{{nazov_zakazky}}", a to v rozsahu a kvalite dohodnutej medzi stranami.

Termín plnenia: {{termin}}
Cena diela: {{rozpocet}} €

Platobné podmienky:
Cena je splatná na základe faktúry vystavenej zhotoviteľom po odovzdaní diela, resp. podľa dohodnutého harmonogramu záloh.

Autorské práva:
Zhotoviteľ udeľuje objednávateľovi licenciu na použitie diela v rozsahu dohodnutom stranami. Zhotoviteľ si vyhradzuje právo použiť ukážky diela na vlastnú propagáciu, pokiaľ sa strany nedohodnú inak.

Záverečné ustanovenia:
Zmluva sa vyhotovuje v dvoch rovnopisoch. Zmeny zmluvy sú platné len písomnou formou po dohode oboch strán.

V ......................... dňa {{datum_dnes}}


......................................              ......................................
Zhotoviteľ                                            Objednávateľ`,
  invoiceTemplate:
`FAKTÚRA č. {{cislo_faktury}}

Dodávateľ: {{produkcia}}
Zastúpený: {{konatel}}
IČO: {{ico}}    DIČ: {{dic}}
Sídlo: {{adresa}}
IBAN: {{iban}}

Odberateľ: {{klient}}

Dátum vystavenia: {{datum_dnes}}
Dátum splatnosti: {{splatnost}}

Za: {{nazov_zakazky}}

Suma na úhradu: {{suma}} €

Prosíme uhradiť na uvedený IBAN do dátumu splatnosti, ako variabilný symbol uveďte číslo faktúry.

Ďakujeme za spoluprácu.
{{produkcia}}`,
  dayScheduleTemplate:
`HARMONOGRAM DŇA
{{nazov_zakazky}}
Dátum: {{termin}}

Nevesta: {{nevesta}}
Ženích: {{zenich}}

{{cas_prichodu}}   Príchod kameramana / prípravy
{{sobas_cas}}   Sobáš — {{sobas_kostol}}
{{cas_prijmu}}   Príchod na svadobnú hostinu — {{svadba_miesto}}

Hudba: {{hudba}}
Fotograf: {{fotograf}}

Špeciálne priania / momenty na zachytenie:
{{special_priania}}

Poznámka: harmonogram je orientačný, časy priprav a obradu si over s klientom.`,
  messageTemplates: [
    { id:'tpl-potvrdenie', name:'Potvrdenie rezervácie', text:
`Dobrý deň {{meno}},

potvrdzujem rezerváciu termínu {{termin}} — {{nazov_zakazky}}.

Teším sa na spoluprácu!
{{firma}}` },
    { id:'tpl-pripomienka', name:'Pripomienka pred natáčaním', text:
`Dobrý deň {{meno}},

len pripomínam, že nás už čaká {{termin}} — {{nazov_zakazky}}. Ak by ste ešte niečo potrebovali doriešiť, napíšte mi.

Tešíme sa!
{{firma}}` },
    { id:'tpl-dakujem', name:'Poďakovanie po odovzdaní', text:
`Dobrý deň {{meno}},

ďakujem za spoluprácu na {{nazov_zakazky}}! Verím, že sa vám video/fotky páčia. Ak by ste boli spokojní, budem rád za odporúčanie ďalej 🙂

Pekný deň,
{{firma}}` }
  ]
};
var calCursor = new Date();
var calFilters = { clientId:'', status:'', tag:'' };
var selectedDay = null;
var currentView = 'dashboard';

var STATUS_LABELS = {
  dopyt:'Dopyt', potvrdene:'Potvrdené', natacanie:'Natáčanie',
  postprodukcia:'Postprodukcia', hotovo:'Hotovo', fakturovane:'Fakturované',
  zabookovane:'Zabookované', nakrutene:'Nakrútené', spracovane:'Spracované', zaplatene:'Zaplatené'
};
var PROJECT_STATUSES = ['dopyt','zabookovane','nakrutene','spracovane','zaplatene'];
var SOBAS_TYP_LABELS = {
  rimokatolicky:'Rímokatolícky', greckokatolicky:'Gréckokatolícky', pravoslavny:'Pravoslávny',
  evanjelicky:'Evanjelický', civilny:'Civilný'
};
var HUDBA_TYP_LABELS = { kapela:'Kapela', dj:'DJ' };
var OLD_TO_NEW_STATUS = {
  potvrdene:'zabookovane', natacanie:'nakrutene',
  postprodukcia:'spracovane', hotovo:'spracovane', fakturovane:'zaplatene'
};
function migrateProjectStatuses(){
  let changed = false;
  DATA.projects.forEach(p=>{
    if(OLD_TO_NEW_STATUS[p.status]){
      p.status = OLD_TO_NEW_STATUS[p.status];
      changed = true;
    }
  });
  if(changed) saveKey('projects', DATA.projects);
}
function migrateBookingStatuses(){
  // Bookings used the same old status vocabulary as projects before the 5-stage
  // pipeline (Dopyt/Zabookované/Nakrútené/Spracované/Zaplatené) was introduced —
  // keep them in sync so a rezervácia and its linked zákazka never show mismatched stages.
  let changed = false;
  DATA.bookings.forEach(b=>{
    if(OLD_TO_NEW_STATUS[b.status]){
      b.status = OLD_TO_NEW_STATUS[b.status];
      changed = true;
    }
  });
  if(changed) saveKey('bookings', DATA.bookings);
}

/* ===================== TRASH (safe delete + restore) =====================
   Every delete in the app goes through moveToTrash() instead of splicing the
   array directly, so a wrong click never means the data is gone for good.
   Items sit in the trash for 30 days before being purged automatically. */
var TRASH_RETENTION_DAYS = 30;
var TRASH_TYPE_LABELS = { client:'Klient', project:'Zákazka', invoice:'Faktúra', expense:'Náklad', booking:'Rezervácia', vendor:'Dodávateľ' };
var TRASH_TYPE_COLLECTION = { client:'clients', project:'projects', invoice:'invoices', expense:'expenses', booking:'bookings', vendor:'vendors' };
var TRASH_TYPE_NAME_FIELD = { client:'name', project:'title', invoice:'number', expense:'description', booking:'title', vendor:'name' };
async function moveToTrash(type, item){
  DATA.trash.push({ id: uid(), type, deletedAt: new Date().toISOString(), item });
  await saveKey('trash', DATA.trash);
}
async function purgeOldTrash(){
  const cutoff = Date.now() - TRASH_RETENTION_DAYS*24*60*60*1000;
  const before = DATA.trash.length;
  DATA.trash = DATA.trash.filter(t=>new Date(t.deletedAt).getTime() > cutoff);
  if(DATA.trash.length !== before) await saveKey('trash', DATA.trash);
}
async function restoreFromTrash(trashId){
  const entry = DATA.trash.find(t=>t.id===trashId);
  if(!entry) return;
  const collectionName = TRASH_TYPE_COLLECTION[entry.type];
  DATA[collectionName].push(entry.item);
  await saveKey(collectionName, DATA[collectionName]);
  DATA.trash = DATA.trash.filter(t=>t.id!==trashId);
  await saveKey('trash', DATA.trash);
  renderAll();
  if(document.getElementById('view-trash').classList.contains('active')) renderTrash();
  showToast(`${TRASH_TYPE_LABELS[entry.type]} obnovený(á)`);
}
async function permanentlyDeleteFromTrash(trashId){
  if(!confirm('Natrvalo odstrániť? Toto sa už nedá vrátiť späť.')) return;
  DATA.trash = DATA.trash.filter(t=>t.id!==trashId);
  await saveKey('trash', DATA.trash);
  renderTrash();
  showToast('Natrvalo odstránené');
}
async function emptyTrash(){
  if(!DATA.trash.length){ showToast('Kôš je už prázdny'); return; }
  if(!confirm(`Naozaj natrvalo vymazať všetkých ${DATA.trash.length} položiek v koši? Toto sa nedá vrátiť späť.`)) return;
  DATA.trash = [];
  await saveKey('trash', DATA.trash);
  renderTrash();
  showToast('Kôš vyprázdnený');
}
function renderTrash(){
  const el = document.getElementById('trashList');
  const countEl = document.getElementById('trashCount');
  countEl.textContent = DATA.trash.length;
  if(!DATA.trash.length){
    el.innerHTML = '<div class="empty">Kôš je prázdny.</div>';
    return;
  }
  el.innerHTML = DATA.trash.slice().sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)).map(t=>{
    const nameField = TRASH_TYPE_NAME_FIELD[t.type];
    const name = (t.item && t.item[nameField]) || 'bez názvu';
    const deletedDate = new Date(t.deletedAt).toLocaleDateString('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric'});
    return `<div class="list-row">
      <div class="row-main">
        <div class="row-title">${escapeHtml(name)} <span class="tag-pill">${TRASH_TYPE_LABELS[t.type]}</span></div>
        <div class="row-sub">Odstránené ${deletedDate}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn ghost small" onclick="restoreFromTrash('${t.id}')">↺ Obnoviť</button>
        <button class="btn danger small" onclick="permanentlyDeleteFromTrash('${t.id}')">Vymazať natrvalo</button>
      </div>
    </div>`;
  }).join('');
}

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
/* ---- Theme toggle: "Filmová klapka" (tmavá, predvolená) <-> "Elegantný" (svetlý) ---- */
var THEME_CYCLE = ['film','vibrant','elegant'];
var THEME_NEXT_LABEL = { film:'🌈 Vibrantný dizajn', vibrant:'💐 Elegantný dizajn', elegant:'🎬 Filmový dizajn' };
