/* ===================== 16-project-crud.js =====================
   Vytváranie/úprava/mazanie/duplikovanie zákazky.
   ===================================================== */

function openNewDopytForm(){
  openProjectModal();
}
function openProjectModal(id){
  populateClientSelects();
  populateBalikSelects();
  populateMessageTemplatePicker();
  initSignaturePad();
  const editing = !!id;
  document.getElementById('projectFormTitle').textContent = editing ? 'Upraviť zákazku' : 'Nová zákazka';
  document.getElementById('pr-delete').style.display = editing ? 'inline-flex' : 'none';
  document.getElementById('pr-duplicate-btn').style.display = editing ? 'inline-flex' : 'none';
  document.getElementById('pr-remind-btn').style.display = editing ? 'inline-flex' : 'none';
  clearWeddingFields();
  clearStuzkovaFields();
  if(editing){
    const p = DATA.projects.find(x=>x.id===id);
    document.getElementById('pr-id').value = p.id;
    document.getElementById('pr-title').value = p.title||'';
    document.getElementById('pr-client').value = p.clientId||'';
    document.getElementById('pr-deadline').value = p.deadline||'';
    document.getElementById('pr-budget').value = p.budget||'';
    document.getElementById('pr-location').value = p.location||'';
    currentTimeEntries = (p.timeEntries || []).map(e=>({...e}));
    renderTimeEntries();
    resetWorkTimer();
    document.getElementById('pr-status').value = p.status||'zabookovane';
    document.getElementById('pr-notes').value = p.notes||'';
    document.getElementById('pr-tags').value = (p.tags||[]).join(', ');
    document.getElementById('pr-delivery-link').value = p.deliveryLink||'';
    document.getElementById('pr-delivery-date').value = p.deliveryDate||'';
    document.getElementById('pr-delivery-confirmed').checked = !!p.deliveryConfirmed;
    document.getElementById('pr-type').value = p.type||'';
    currentChecklist = (p.checklist || []).map(i=>({...i}));
    renderChecklist();
    onProjectTypeChange();
    if(p.clientId){
      setClientMode('existing');
      document.getElementById('pr-newclient-name').value = '';
    }else{
      setClientMode('new');
      document.getElementById('pr-newclient-name').value = '';
    }
    onProjectClientChange();
    if(p.wedding){
      document.getElementById('w-nevesta-meno').value = p.wedding.nevestaMeno||'';
      document.getElementById('w-nevesta-adresa').value = p.wedding.nevestaAdresa||'';
      document.getElementById('w-zenich-meno').value = p.wedding.zenichMeno||'';
      document.getElementById('w-zenich-adresa').value = p.wedding.zenichAdresa||'';
      document.getElementById('w-svadba-miesto').value = p.wedding.svadbaMiesto||'';
      document.getElementById('w-sobas-kostol').value = p.wedding.sobasKostol||'';
      document.getElementById('w-sobas-adresa').value = p.wedding.sobasAdresa||'';
      document.getElementById('w-sobas-typ').value = p.wedding.sobasTyp||'';
      document.getElementById('w-sobas-cas').value = p.wedding.sobasCas||'';
      document.getElementById('w-hudba-typ').value = p.wedding.hudbaTyp||'';
      document.getElementById('w-hudba-meno').value = p.wedding.hudbaMeno||'';
      document.getElementById('w-fotograf').value = p.wedding.fotograf||'';
      document.getElementById('w-balik').value = p.wedding.balik||'';
      document.getElementById('w-special-wishes').value = p.wedding.specialWishes||'';
    }
    if(p.stuzkova){
      document.getElementById('s-miesto').value = p.stuzkova.miesto||'';
      document.getElementById('s-hudba').value = p.stuzkova.hudba||'';
      document.getElementById('s-fotograf').value = p.stuzkova.fotograf||'';
      document.getElementById('s-pocet-ziakov').value = p.stuzkova.pocetZiakov||'';
      document.getElementById('s-balik').value = p.stuzkova.balik||'';
      document.getElementById('s-kradnutie').checked = !!p.stuzkova.kradnutie;
    }
    const pb = p.priceBreakdown || {};
    document.getElementById('pr-mimo-okresu').checked = !!pb.mimoOkresu;
    document.getElementById('pr-km').value = pb.km || '';
    populatePriplatkyChecks(pb.priplatkyIds || []);
    recalcProjectPrice();
    document.getElementById('pr-contract-generated').checked = !!p.contractGenerated;
    document.getElementById('pr-contract-signed').checked = !!p.contractSigned;
    loadSignatureIntoPad(p.signatureDataUrl || '');
    renderProjectStatusIndicators(p);
  }else{
    document.getElementById('pr-id').value = '';
    document.getElementById('pr-title').value = '';
    document.getElementById('pr-client').value = '';
    document.getElementById('pr-deadline').value = '';
    document.getElementById('pr-budget').value = '';
    document.getElementById('pr-location').value = '';
    currentTimeEntries = [];
    renderTimeEntries();
    resetWorkTimer();
    document.getElementById('pr-status').value = 'dopyt';
    document.getElementById('pr-notes').value = '';
    document.getElementById('pr-tags').value = '';
    document.getElementById('pr-delivery-link').value = '';
    document.getElementById('pr-delivery-date').value = '';
    document.getElementById('pr-delivery-confirmed').checked = false;
    document.getElementById('pr-type').value = '';
    currentChecklist = [];
    renderChecklist();
    onProjectTypeChange();
    setClientMode('new');
    document.getElementById('pr-newclient-name').value = '';
    document.getElementById('pr-client-email').value = '';
    document.getElementById('pr-client-phone').value = '';
    document.getElementById('pr-client-address').value = '';
    onProjectClientChange();
    document.getElementById('pr-mimo-okresu').checked = false;
    document.getElementById('pr-km').value = '';
    populatePriplatkyChecks([]);
    recalcProjectPrice();
    document.getElementById('pr-contract-generated').checked = false;
    document.getElementById('pr-contract-signed').checked = false;
    clearSignaturePad();
    renderProjectStatusIndicators(null);
  }
  updateMessagePreview();
  renderTagSuggestions('pr-tags','pr-tags-suggestions');
  showProjectFormView();
}
function showProjectFormView(){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const projectsNavItem = document.querySelector('.nav-item[data-view="projects"]');
  if(projectsNavItem) projectsNavItem.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-projectform').classList.add('active');
  currentView = 'projectform';
  window.scrollTo(0,0);
}
function closeProjectForm(){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const projectsNavItem = document.querySelector('.nav-item[data-view="projects"]');
  if(projectsNavItem) projectsNavItem.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-projects').classList.add('active');
  currentView = 'projects';
  renderAll();
}
async function saveProject(){
  const id = document.getElementById('pr-id').value || uid();
  const title = document.getElementById('pr-title').value.trim();
  if(!title){ showToast('Zadaj názov zákazky'); return; }
  const tags = document.getElementById('pr-tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
  const type = document.getElementById('pr-type').value;

  const clientMode = document.getElementById('pr-client-mode').value;
  const contactEmail = document.getElementById('pr-client-email').value.trim();
  const contactPhone = document.getElementById('pr-client-phone').value.trim();
  const contactAddress = document.getElementById('pr-client-address').value.trim();
  let clientId = '';

  if(clientMode === 'new'){
    const newName = document.getElementById('pr-newclient-name').value.trim();
    if(newName){
      // Reuse an existing client with the same name instead of creating a duplicate,
      // in case someone types a name that already exists in the database.
      const existingMatch = DATA.clients.find(c=>c.name.toLowerCase()===newName.toLowerCase());
      if(existingMatch){
        clientId = existingMatch.id;
        existingMatch.email = contactEmail || existingMatch.email;
        existingMatch.phone = contactPhone || existingMatch.phone;
        existingMatch.address = contactAddress || existingMatch.address;
      }else{
        clientId = uid();
        DATA.clients.push({ id: clientId, name: newName, email: contactEmail, phone: contactPhone, address: contactAddress, notes: '' });
      }
      await saveKey('clients', DATA.clients);
    }
  }else{
    clientId = document.getElementById('pr-client').value;
    // Sync inline client contact edits back to the client record
    if(clientId){
      const c = DATA.clients.find(x=>x.id===clientId);
      if(c){
        c.email = contactEmail;
        c.phone = contactPhone;
        c.address = contactAddress;
        await saveKey('clients', DATA.clients);
      }
    }
  }

  // Keep the same CRM folder even if the zákazka gets renamed later,
  // so files don't end up split across two differently-named folders.
  // New folders are named "DÁTUM_názov-zákazky" (e.g. 2026-06-13_svadba-fabryova)
  // so they also sort chronologically on the disk.
  const existingProject = DATA.projects.find(p=>p.id===id);
  const deadlineForFolder = document.getElementById('pr-deadline').value;
  const newFolderName = deadlineForFolder ? `${deadlineForFolder}_${sanitizeName(title)}` : sanitizeName(title);
  const folderName = (existingProject && existingProject.folderName) || newFolderName;

  const project = {
    id, title,
    clientId,
    deadline: document.getElementById('pr-deadline').value,
    budget: document.getElementById('pr-budget').value,
    location: document.getElementById('pr-location').value.trim(),
    timeEntries: currentTimeEntries,
    hoursSpent: currentTimeEntries.reduce((s,e)=>s+Number(e.hours||0),0),
    status: document.getElementById('pr-status').value,
    notes: document.getElementById('pr-notes').value.trim(),
    tags,
    type,
    checklist: currentChecklist,
    folderName,
    folderCreated: (existingProject && existingProject.folderCreated) || false,
    contractGenerated: document.getElementById('pr-contract-generated').checked,
    contractSigned: document.getElementById('pr-contract-signed').checked,
    signatureDataUrl: getSignatureDataUrl(),
    deliveryLink: document.getElementById('pr-delivery-link').value.trim(),
    deliveryDate: document.getElementById('pr-delivery-date').value,
    deliveryConfirmed: document.getElementById('pr-delivery-confirmed').checked
  };
  if(type === 'svadba'){
    project.wedding = {
      nevestaMeno: document.getElementById('w-nevesta-meno').value.trim(),
      nevestaAdresa: document.getElementById('w-nevesta-adresa').value.trim(),
      zenichMeno: document.getElementById('w-zenich-meno').value.trim(),
      zenichAdresa: document.getElementById('w-zenich-adresa').value.trim(),
      svadbaMiesto: document.getElementById('w-svadba-miesto').value.trim(),
      sobasKostol: document.getElementById('w-sobas-kostol').value.trim(),
      sobasAdresa: document.getElementById('w-sobas-adresa').value.trim(),
      sobasTyp: document.getElementById('w-sobas-typ').value,
      sobasCas: document.getElementById('w-sobas-cas').value,
      hudbaTyp: document.getElementById('w-hudba-typ').value,
      hudbaMeno: document.getElementById('w-hudba-meno').value.trim(),
      fotograf: document.getElementById('w-fotograf').value.trim(),
      balik: document.getElementById('w-balik').value,
      specialWishes: document.getElementById('w-special-wishes').value.trim()
    };
  }
  if(type === 'stuzkova'){
    project.stuzkova = {
      miesto: document.getElementById('s-miesto').value.trim(),
      hudba: document.getElementById('s-hudba').value.trim(),
      fotograf: document.getElementById('s-fotograf').value.trim(),
      pocetZiakov: document.getElementById('s-pocet-ziakov').value,
      balik: document.getElementById('s-balik').value,
      kradnutie: document.getElementById('s-kradnutie').checked
    };
  }

  const selectedPriplatkyIds = Array.from(document.querySelectorAll('.pr-priplatok-check:checked')).map(chk=>chk.value);
  project.priceBreakdown = {
    mimoOkresu: document.getElementById('pr-mimo-okresu').checked,
    km: document.getElementById('pr-km').value,
    priplatkyIds: selectedPriplatkyIds
  };

  const idx = DATA.projects.findIndex(p=>p.id===id);
  if(idx>-1){
    if(DATA.projects[idx].archived) project.archived = true; // uloženie úpravy nesmie tichým spôsobom vytiahnuť zákazku z archívu
    DATA.projects[idx]=project;
  }else{
    DATA.projects.push(project);
  }
  await saveKey('projects', DATA.projects);
  syncProjectFolder(project);
  closeProjectForm(); showToast('Zákazka uložená');
}
async function deleteProject(){
  const id = document.getElementById('pr-id').value;
  const item = DATA.projects.find(p=>p.id===id);
  DATA.projects = DATA.projects.filter(p=>p.id!==id);
  await saveKey('projects', DATA.projects);
  if(item) await moveToTrash('project', item);
  closeProjectForm(); showToast('Zákazka odstránená (v Koši 30 dní)');
}
async function duplicateProject(){
  const id = document.getElementById('pr-id').value;
  const original = DATA.projects.find(p=>p.id===id);
  if(!original){ showToast('Najprv zákazku ulož'); return; }
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = uid();
  copy.title = original.title + ' (kópia)';
  // Cleared so the copy starts fresh — same package/details, but a new client and date to fill in.
  copy.clientId = '';
  copy.deadline = '';
  copy.status = 'dopyt';
  delete copy.folderName;
  copy.folderCreated = false;
  copy.contractGenerated = false;
  copy.contractSigned = false;
  copy.signatureDataUrl = '';
  copy.checklist = [];
  copy.timeEntries = [];
  copy.hoursSpent = 0;
  copy.deliveryLink = '';
  copy.deliveryDate = '';
  copy.deliveryConfirmed = false;
  DATA.projects.push(copy);
  await saveKey('projects', DATA.projects);
  showToast('Zákazka duplikovaná — uprav dátum a klienta');
  openProjectModal(copy.id);
}

/* --- Import projects from pasted text (e.g. Apple Reminders) --- */
/* ---- Google Form sync: pull questionnaire responses in as new zákazky ---- */
