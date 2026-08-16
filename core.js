const state={
  role:'medico',
  alertSent:false,
  careSaved:false,
  familyRead:false,
  /* V42.0 — foco de la cola real de alertas (ver ROADMAP_V42.md §3).
     activeAlertId: qué alerta mira el panel. pendingAlerts: derivado de
     state.alerts en cada render, no se escribe a mano. */
  activeAlertId:null,
  pendingAlerts:[],
  selectedStudentIndex:0,
  currentAlert:{studentId:null,studentName:'Sofía Martínez',location:'Aula 3B · 2° piso',symptoms:'Mareo, náuseas y dolor abdominal durante la clase.',alertTimeLabel:'10:24'},
  students:[
    {fullName:'Sofía Martínez',birthDate:'',age:'15 años',sex:'Femenino',course:'3° Secundaria · Aula 3B',address:'',phone:'+593 99 000 0000',email:'',contacts:[{name:'Ana Martínez',relation:'Madre',phone:'+593 99 000 0000'}],allergies:'Maní',chronic:'',medicines:'',restrictions:'Evitar consumo de maní y derivados.',medicalNotes:'Alergia alimentaria registrada. Requiere notificación familiar ante cualquier síntoma compatible.',insurance:'',vaccineStatus:'Pendiente de verificación',medicationAuth:'Sin registrar',emergencyTransfer:'Sin registrar'},
    {fullName:'Mateo Ruiz',birthDate:'',age:'9 años',sex:'Masculino',course:'5° Básica · Aula 5A',address:'',phone:'',email:'',contacts:[],allergies:'',chronic:'Asma leve',medicines:'',restrictions:'Seguimiento preventivo en actividad física intensa.',medicalNotes:'',insurance:'',vaccineStatus:'Al día',medicationAuth:'Sin registrar',emergencyTransfer:'Sin registrar'},
    {fullName:'Valentina Pérez',birthDate:'',age:'',sex:'Femenino',course:'7° Básica · Aula 7C',address:'',phone:'',email:'',contacts:[],allergies:'',chronic:'',medicines:'',restrictions:'',medicalNotes:'',insurance:'',vaccineStatus:'Al día',medicationAuth:'Sin registrar',emergencyTransfer:'Sin registrar'}
  ],
  activities:[
    ['10:24','red','Nueva alerta de Sofía Martínez','Aula 3B · docente reporta síntomas'],
    ['10:25','blue','Departamento médico notificado','María González recibió alerta'],
    ['10:26','green','Ficha médica consultada','Alergia y contactos verificados'],
    ['10:27','amber','Familia notificada','Ana Martínez pendiente de lectura']
  ],
  riskProfiles:[
    {student:'Sofía Martínez',course:'3° Secundaria · Aula 3B',condition:'Alergia registrada: maní',critical:true,activeAlert:true,openCase:true,careCountMonth:2,vaccineStatus:'Pendiente de verificación',familyRead:false,action:'Atención prioritaria y verificación familiar'},
    {student:'Mateo Ruiz',course:'5° Básica · Aula 5A',condition:'Asma leve',critical:true,activeAlert:false,openCase:false,careCountMonth:1,vaccineStatus:'Al día',familyRead:true,action:'Seguimiento preventivo'},
    {student:'Valentina Pérez',course:'7° Básica · Aula 7C',condition:'Sin alertas críticas',critical:false,activeAlert:false,openCase:false,careCountMonth:1,vaccineStatus:'Al día',familyRead:true,action:'Control regular'}
  ],
  vaccines:[
    {student:'Sofía Martínez',course:'3° Secundaria · Aula 3B',age:'15 años',reference:'dT · Difteria y tétanos',status:'Pendiente de verificación',last:'No registrado',next:'Solicitar carné actualizado'},
    {student:'Mateo Ruiz',course:'5° Básica · Aula 5A',age:'9 años',reference:'HPV · Virus del Papiloma Humano · dosis única',status:'Al día',last:'Registrado en carné',next:'Control anual'}
  ],
  vaccineSchedule:[
    ['5 años','DPT','Difteria, Tosferina, Tétanos'],
    ['5 años','bOPV','Poliomielitis'],
    ['9 años','HPV','Virus del Papiloma Humano · dosis única'],
    ['15 años','dT','Difteria y tétanos']
  ],
  inventory:[
    {name:'Paracetamol pediátrico',category:'Analgésico',stock:18,min:12,expires:'2026-11-30',status:'Disponible'},
    {name:'Suero oral',category:'Hidratación',stock:7,min:10,expires:'2026-09-15',status:'Reponer'},
    {name:'Loratadina',category:'Antihistamínico',stock:14,min:8,expires:'2027-02-20',status:'Disponible'},
    {name:'Gasas estériles',category:'Insumo',stock:9,min:15,expires:'2026-08-10',status:'Reponer'}
  ],
  inventoryHistory:[
    ['10:18','Paracetamol pediátrico','1 unidad','Sofía Martínez','Dolor moderado'],
    ['09:35','Gasas estériles','2 unidades','Mateo Ruiz','Golpe leve'],
    ['08:18','Suero oral','1 unidad','Valentina Pérez','Mareo']
  ],
  careRecords:[
    {date:'21/06/2026',time:'10:27',student:'Sofía Martínez',bodyArea:'Abdomen',eva:'5 · Dolor moderado',symptoms:'Mareo, náuseas y dolor abdominal durante la clase.',presumptiveDiagnosis:'Dolor abdominal en observación',actionDone:'Observación, control y notificación a representante',medication:'No registrado',dose:'',derivation:'Representante informado',observations:'Estudiante consciente y orientada.',family:'Pendiente'},
    {date:'21/06/2026',time:'09:35',student:'Mateo Ruiz',bodyArea:'Pierna derecha',eva:'3 · Dolor leve',symptoms:'Golpe leve durante actividad escolar.',presumptiveDiagnosis:'Contusión leve',actionDone:'Control y reposo breve',medication:'No administrado',dose:'',derivation:'No requiere derivación',observations:'Caso cerrado.',family:'Confirmada'},
    {date:'21/06/2026',time:'08:18',student:'Valentina Pérez',bodyArea:'General / sin zona específica',eva:'2 · Dolor leve',symptoms:'Mareo.',presumptiveDiagnosis:'Malestar general leve',actionDone:'Hidratación y observación',medication:'No administrado',dose:'',derivation:'No requiere derivación',observations:'Evolución favorable.',family:'Confirmada'}
  ]
};
const roleData={medico:['MG','María González','Departamento médico'],docente:['LC','Laura Castillo','Docente · Aula 3B'],familia:['AM','Ana Martínez','Familia · Representante'],directivo:['DR','Dirección','Panel directivo']};
const NOVIMED_VERSION='V41.1';
function el(id){return document.getElementById(id)}

/* V36 — Paginación de tablas (client-side, primera página de 15) */
const TABLE_PAGE_SIZE=15;
const tableExpanded={students:false,care:false,alerts:false};
function pagedRows(rows,key){
  if(tableExpanded[key]||rows.length<=TABLE_PAGE_SIZE) return {rows,extra:0};
  return {rows:rows.slice(0,TABLE_PAGE_SIZE),extra:rows.length-TABLE_PAGE_SIZE};
}
function expandTable(key){tableExpanded[key]=true;renderAll();}
/* V39 — H2: cuando la vista local ya está expandida y la colección tiene
   histórico más antiguo en la nube, el mismo botón lo trae por cursor. */
const CLOUD_COLLECTION_BY_TABLE={care:'careRecords',alerts:'alerts'};
function tableHasCloudHistory(key){
  const coll=CLOUD_COLLECTION_BY_TABLE[key];
  return !!(coll && window.novimedHasOlder && window.novimedHasOlder(coll));
}
function loadOlderFor(key){
  const coll=CLOUD_COLLECTION_BY_TABLE[key];
  if(!coll || !window.novimedLoadOlder)return;
  tableExpanded[key]=true;
  const btn=el('pager-'+key);
  if(btn){btn.disabled=true;btn.textContent='Cargando…';}
  window.novimedLoadOlder(coll);
}
function pagerRow(colspan,key,extra){
  if(extra){
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:14px"><button type="button" class="btn secondary" id="pager-${key}" onclick="expandTable('${key}')">Mostrar ${extra} más</button></td></tr>`;
  }
  if(tableHasCloudHistory(key)){
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:14px"><button type="button" class="btn secondary" id="pager-${key}" onclick="loadOlderFor('${key}')">Cargar registros anteriores</button></td></tr>`;
  }
  return '';
}
function emptyRow(colspan,text){return `<tr><td colspan="${colspan}" style="text-align:center;color:#71819b;padding:18px">${text}</td></tr>`}

/* V36 — Exportación CSV (BOM para Excel, campos escapados) */
function toCSV(rows){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\r\n')}
function downloadCSV(name,rows){
  const blob=new Blob([toCSV(rows)],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  showToast('Exportado',name+' listo para descargar.');
}
function exportCareCSV(){
  const rows=[['Fecha','Hora','Estudiante','Área','EVA','Síntomas','Diagnóstico presuntivo','Acción','Medicamento','Derivación','Familia']]
    .concat((state.careRecords||[]).map(r=>[r.date,r.time,recordStudentName(r),r.bodyArea,r.eva,r.symptoms,r.presumptiveDiagnosis,r.actionDone,r.medication,r.derivation,r.family]));
  downloadCSV('novimed_atenciones.csv',rows);
}
function exportStudentsCSV(){
  const rows=[['Nombre','Edad','Curso','Alergias','Condiciones crónicas','Medicación','Vacunación','Teléfono','Correo','Estado']]
    .concat((state.students||[]).map(s=>[s.fullName,s.age,s.course,s.allergies,s.chronic,s.medicines,s.vaccineStatus,s.phone,s.email,s.isArchived?'Archivada · '+(s.archivedReason||''):'Activa']));
  downloadCSV('novimed_estudiantes.csv',rows);
}

/* V30 — Persistencia local: los registros creados en sesión sobreviven a recargas.
   Solo persiste colecciones de datos; el caso activo sigue sincronizado vía Firestore. */
const NOVIMED_STORAGE_KEY='novimed_local_state_v2';
const NOVIMED_LEGACY_KEY='novimed_local_state_v1';
const NOVIMED_SCHEMA=2;
const PERSISTED_KEYS=['students','inventory','inventoryHistory','careRecords','vaccines','riskProfiles'];
function tenantStorageKey(){const t=window.__novimedTenant;return NOVIMED_STORAGE_KEY+(t?'::'+t:'');}
let persistTimer=null;
function persistState(){
  clearTimeout(persistTimer);
  persistTimer=setTimeout(persistStateNow,400);
}
function persistStateNow(){
  try{
    const data={};
    PERSISTED_KEYS.forEach(k=>{data[k]=state[k];});
    localStorage.setItem(tenantStorageKey(),JSON.stringify({schema:NOVIMED_SCHEMA,savedAt:Date.now(),data}));
  }catch(e){
    /* Cuota llena u otro fallo: liberar el legado y continuar en memoria */
    try{localStorage.removeItem(NOVIMED_LEGACY_KEY);}catch(_){/* noop */}
  }
}
function applyRestoredData(data){
  if(!data||typeof data!=='object')return;
  PERSISTED_KEYS.forEach(key=>{
    if(Array.isArray(data[key])&&data[key].length)state[key]=data[key];
  });
}
function restoreState(){
  try{
    const raw=localStorage.getItem(tenantStorageKey());
    if(raw){
      const env=JSON.parse(raw);
      if(env&&env.schema===NOVIMED_SCHEMA&&env.data&&typeof env.data==='object'){
        applyRestoredData(env.data);
        return;
      }
      /* Esquema desconocido o envoltura corrupta: descartar de forma segura */
      localStorage.removeItem(tenantStorageKey());
    }
    /* Migración única desde el formato v1 (sin envoltura) */
    const legacy=(window.__novimedTenant==='eight-demo')?localStorage.getItem(NOVIMED_LEGACY_KEY):null;
    if(legacy){
      const oldData=JSON.parse(legacy);
      applyRestoredData(oldData);
      localStorage.removeItem(NOVIMED_LEGACY_KEY);
      persistStateNow();
    }
  }catch(e){
    try{localStorage.removeItem(tenantStorageKey());localStorage.removeItem(NOVIMED_LEGACY_KEY);}catch(_){/* noop */}
  }
}
/* V38a — TENANCY EN EL CLIENTE */
const PRISTINE=JSON.parse(JSON.stringify({
  students:state.students,inventory:state.inventory,inventoryHistory:state.inventoryHistory,
  careRecords:state.careRecords,vaccines:state.vaccines,riskProfiles:state.riskProfiles,
  activities:state.activities,currentAlert:state.currentAlert,alertSent:state.alertSent
}));
let currentSession={role:'Demo',email:null,anonymous:true,schoolId:null};
function sessionRole(){return currentSession.role}
function canWrite(){return sessionRole()!=='Consulta'}
window.novimedCanWrite=canWrite;
window.novimedStudentById=studentById;
function guardWrite(){
  if(canWrite())return true;
  showToast('Solo lectura','Tu rol (Consulta) permite revisar la información, no modificarla.');
  return false;
}
function roleLabel(r){
  return r==='SuperAdmin'?'Superadministrador'
    :r==='Admin_Colegio'?'Administración del colegio'
    :r==='Personal_Salud'?'Personal de salud'
    :r==='Consulta'?'Consulta (solo lectura)'
    :r;
}
window.novimedActivateTenant=function(schoolId,session){
  currentSession={role:(session&&session.role)||'Demo',email:(session&&session.email)||null,anonymous:!!(session&&session.anonymous),schoolId};
  window.__novimedTenant=schoolId;
  if(schoolId==='eight-demo'){
    Object.keys(PRISTINE).forEach(k=>{state[k]=JSON.parse(JSON.stringify(PRISTINE[k]));});
    state.alertSent=true; /* el teatro demo siempre tiene su caso activo */
  }else{
    state.students=[];state.inventory=[];state.inventoryHistory=[];
    state.careRecords=[];state.vaccines=[];state.riskProfiles=[];
    state.activities=[['Ahora','blue','Sesión iniciada','Institución: '+schoolId]];
    state.currentAlert={...NEUTRAL_ALERT};
    state.alertSent=false;
  }
  state.alerts=undefined;
  state.activeAlertId=null;state.pendingAlerts=[];
  state.careSaved=false;state.familyRead=false;
  tableExpanded.students=false;tableExpanded.care=false;tableExpanded.alerts=false;
  forceFullRender=true;
  restoreState();
  const nameEl=el('sidebarName'),roleEl=el('sidebarRole'),avEl=el('sidebarAvatar');
  if(currentSession.anonymous){
    if(nameEl)nameEl.textContent='Andrés Sánchez';
    if(roleEl)roleEl.textContent='Departamento médico · Demo';
    if(avEl)avEl.textContent='MG';
  }else{
    const alias=(currentSession.email||'usuario').split('@')[0];
    if(nameEl)nameEl.textContent=alias;
    if(roleEl)roleEl.textContent=roleLabel(sessionRole());
    if(avEl)avEl.textContent=alias.slice(0,2).toUpperCase();
  }
  renderAll();
};
function showToast(t,txt){el('toastTitle').textContent=t;el('toastText').textContent=txt;el('toast').classList.add('show');setTimeout(()=>el('toast').classList.remove('show'),2800)}
/* V40.1 — El fallback de activeAlert() devolvía el caso demo (Sofía/maní).
   Un valor por defecto en un campo clínico es información falsa presentada
   como verificada: el fallback ahora declara ausencia, no inventa un caso. */
const NEUTRAL_ALERT={studentId:null,studentName:'Sin alertas activas',location:'El panel mostrará aquí la próxima alerta docente',symptoms:'Todo en calma por ahora.',alertTimeLabel:''};
function activeAlert(){return state.currentAlert||NEUTRAL_ALERT}

/* ============================================================
   V42.0 — LECTURA DUAL (ROADMAP_V42.md §3)
   El caso único schools/{id}/meta/active-case sigue existiendo y
   escribiéndose (V42.1 lo retira), pero el héroe, sus banderas
   (alertSent/careSaved/familyRead) y activeAlert() ya no se fían de él:
   se derivan aquí de la cola real `state.alerts`, a partir del foco
   `state.activeAlertId` que sync.js mantiene actualizado.
   Diseño deliberadamente NO destructivo: si la cola todavía no resuelve
   nada (sin sesión de nube, alerta recién enviada en modo local que el
   listener aún no reflejó, tenant demo cuyo guion vive solo en el caso
   legado), se conserva el valor previo de state.currentAlert en vez de
   forzarlo a neutro — es lectura dual, no un reemplazo.
   Criterio de aceptación (ROADMAP_V42.md): con active-case borrado a mano
   en Firestore, el panel debe seguir funcionando correctamente. */
function resolveActiveAlertFromQueue(){
  const alerts=Array.isArray(state.alerts)?state.alerts:null;
  if(!alerts)return null;
  const byId=state.activeAlertId?alerts.find(a=>a&&a.id===state.activeAlertId):null;
  return byId||alerts.find(a=>a&&a.status==='pending')||null;
}
function applyQueueDerivedFocus(){
  const alerts=Array.isArray(state.alerts)?state.alerts:null;
  state.pendingAlerts=alerts?alerts.filter(a=>a&&a.status==='pending'):[];
  const focus=resolveActiveAlertFromQueue();
  if(!focus)return;
  state.currentAlert={
    studentId:focus.studentId||null,
    studentName:focus.studentName||'Sin alertas activas',
    location:focus.location||'El panel mostrará aquí la próxima alerta docente',
    symptoms:focus.symptoms||'Todo en calma por ahora.',
    alertTimeLabel:focus.timeLabel||''
  };
  state.alertSent=true;
  state.careSaved=focus.status==='attended'||focus.status==='family_confirmed';
  state.familyRead=focus.status==='family_confirmed';
}

/* ============================================================
   V41 — RESOLUCIÓN POR CLAVE FORÁNEA
   studentId es la clave real. studentName se conserva desnormalizado
   solo para poder mostrar el registro cuando la ficha fue archivada,
   renombrada o aún no sincronizó. Nunca se usa para enlazar.
   ============================================================ */
function studentById(id){
  if(!id)return null;
  return (state.students||[]).find(s=>s&&s.id===id)||null;
}
function activeStudents(){return (state.students||[]).filter(s=>s&&!s.isArchived)}
function recordStudentName(r){return (r&&(r.studentName||r.student))||'Sin especificar'}
function studentIndexById(id){return (state.students||[]).findIndex(s=>s&&s.id===id)}
function showPage(page){const targetPage=el('page-'+page);if(!targetPage)return;document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));targetPage.classList.add('active');document.querySelectorAll('.nav button').forEach(b=>{const isActive=b.dataset.page===page;b.classList.toggle('active',isActive);if(isActive){b.setAttribute('aria-current','page')}else{b.removeAttribute('aria-current')}});const titles={inicio:['Centro de bienestar institucional','Respuesta médica escolar, familias conectadas y trazabilidad en tiempo real.'],roles:['Roles funcionales','Docente, médico, familia y directivo conectados.'],alertas:['Centro de alertas','Priorización de emergencias escolares.'],estudiantes:['Estudiantes','Fichas médicas y antecedentes relevantes.'],atenciones:['Registro médico escolar','Atenciones clínicas escolares documentadas.'],riesgo:['Priorización de riesgo','Priorización operativa basada en alertas, antecedentes y seguimiento.'],vacunas:['Control de vacunas','Registro y seguimiento según esquema nacional MSP.'],familias:['Familias','Notificaciones y confirmaciones de lectura.'],reportes:['Reportes','Indicadores para decisiones directivas.'],inventario:['Medicamentos disponibles','Stock, caducidad, reposición e historial de uso.'],config:['Configuración','Roles, notificaciones y catálogos clínicos.']};const t=titles[page]||['Novimed','Centro de bienestar institucional.'];el('pageTitle').textContent=t[0];el('pageSub').textContent=t[1];forceFullRender=true;renderAll()}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function setRole(role){state.role=role;const d=roleData[role];el('sidebarAvatar').textContent=d[0];el('sidebarName').textContent=d[1];el('sidebarRole').textContent=d[2];document.querySelectorAll('.role-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===role));document.querySelectorAll('.role-dashboard').forEach(x=>x.classList.remove('active'));const pane=el('role-'+role);if(pane)pane.classList.add('active');forceFullRender=true;showToast('Vista cambiada',d[1]+' ahora está usando Novimed.');renderAll()}
document.querySelectorAll('.role-btn').forEach(b=>b.onclick=()=>setRole(b.dataset.role));
/* ============================================================
   V39 — H1: RENDER SELECTIVO
   renderAll() reconstruía las 11 páginas en cada mutación y en cada
   snapshot de Firestore. Ahora los renders de página se omiten si su
   sección no está visible y se marcan como pendientes; showPage()
   fuerza un ciclo completo al navegar, de modo que el usuario nunca ve
   datos desactualizados. Inicio (feed, KPIs, incidente) se renderiza
   siempre: alimenta indicadores globales visibles desde cualquier vista.
   ============================================================ */
const PAGE_OF_RENDER={renderAlerts:'alertas',renderCare:'atenciones',renderStudents:'estudiantes',renderVaccines:'vacunas',renderInventory:'inventario',renderRisk:'riesgo',renderRoles:'roles',renderFamily:'familias',renderReports:'reportes'};
let forceFullRender=true;
const dirtyPages={};
function pageIsVisible(page){const n=el('page-'+page);return !!n&&n.classList.contains('active')}
function shouldRender(name){
  const page=PAGE_OF_RENDER[name];
  if(!page)return true;
  if(forceFullRender)return true;
  if(pageIsVisible(page)){dirtyPages[page]=false;return true}
  dirtyPages[page]=true;
  return false;
}
const DOT_COLORS={red:'red',blue:'blue',green:'green',amber:'amber'};
/* V40.1 — El aviso de alergias del incidente era HTML estático
   ("Alergia conocida: maní") que ningún render tocaba: en cualquier
   institución real afirmaba alergia al maní para cualquier estudiante.
   Ahora deriva SIEMPRE de la ficha enlazada por studentId, y la ausencia
   de ficha se declara de forma explícita en lugar de rellenarse. */
function renderMainAllergyNote(){
  const node=el('mainAllergyNote');
  if(!node)return;
  const alert=activeAlert();
  const student=studentById(alert.studentId);
  node.classList.remove('unlinked','critical','clear');
  if(!alert.studentId||!student){
    node.classList.add('unlinked');
    node.textContent=alert.studentId?'Ficha no disponible en este dispositivo — verificar manualmente':'Sin ficha enlazada — verificar manualmente';
    return;
  }
  const critical=[
    student.allergies&&'Alergias: '+student.allergies,
    student.chronic&&'Condiciones crónicas: '+student.chronic,
    student.restrictions&&'Restricciones: '+student.restrictions
  ].filter(Boolean).join(' · ');
  if(critical){node.classList.add('critical');node.textContent=critical;}
  else{node.classList.add('clear');node.textContent='Ficha enlazada · sin alergias ni condiciones registradas';}
}
function renderFeed(){el('activityFeed').innerHTML=state.activities.map(a=>`<div class="event"><time>${escapeHtml(a[0])}</time><div><span class="dot" style="display:block;background:var(--${DOT_COLORS[a[1]]||'blue'})"></span></div><div><b>${escapeHtml(a[2])}</b><p>${escapeHtml(a[3])}</p></div></div>`).join('')}
function alertStatusLabel(st){return st==='pending'?'Pendiente':(st==='attended'?'Atendida':(st==='family_confirmed'?'Cerrada':(st||'—')))}
function renderAlerts(){
  const badge=el('alertsActiveBadge');
  let rows=[];
  if(Array.isArray(state.alerts)){
    rows=state.alerts.map(a=>{
      const linked=!!a.studentId&&!!studentById(a.studentId);
      const name=escapeHtml(a.studentName||'Estudiante sin nombre');
      const nameCell=linked?name:name+'<br><span style="color:#b45309;font-size:12px">Sin ficha enlazada</span>';
      const action=linked
        ? `<button type="button" class="btn secondary" onclick="openFichaModalById('${escapeHtml(a.studentId)}')">Ver ficha</button>`
        : `<button type="button" class="btn secondary" disabled title="Esta alerta no está enlazada a una ficha">Sin ficha</button>`;
      return `<tr><td>${escapeHtml(a.timeLabel||'—')}</td><td>${nameCell}</td><td>${escapeHtml(a.priority||'Sin prioridad')}</td><td>${escapeHtml(alertStatusLabel(a.status))}</td><td>${action}</td></tr>`;
    });
    if(badge){
      const pend=state.alerts.filter(a=>a&&a.status==='pending').length;
      badge.textContent=pend===0?'sin alertas activas':(pend===1?'1 activa':pend+' activas');
      badge.className='badge '+(pend?'red':'green');
    }
  }else if(badge){badge.textContent='—';badge.className='badge blue';}
  const alertPg=pagedRows(rows,'alerts');
  el('alertsTable').innerHTML='<tr><th scope="col">Hora</th><th scope="col">Estudiante</th><th scope="col">Prioridad</th><th scope="col">Estado</th><th scope="col">Acción</th></tr>'
    +(rows.length?alertPg.rows.join('')+pagerRow(5,'alerts',alertPg.extra):emptyRow(5,'Sin alertas registradas.'));
}
function renderCare(){
  const rows=(state.careRecords||[]).map(r=>`<tr><td>${escapeHtml(r.date||'Sin registrar')}</td><td>${escapeHtml(r.time||'Sin registrar')}</td><td>${escapeHtml(recordStudentName(r))}${r.studentId?'':'<br><span style="color:#b45309;font-size:12px">Sin ficha enlazada</span>'}</td><td>${escapeHtml(r.bodyArea||'Sin especificar')}</td><td>${escapeHtml(r.eva||'Sin especificar')}</td><td>${escapeHtml(r.symptoms||'Sin especificar')}</td><td>${escapeHtml(r.presumptiveDiagnosis||'Sin especificar')}</td><td>${escapeHtml(r.actionDone||'Sin especificar')}</td><td>${escapeHtml(r.medication||'Sin especificar')}</td><td>${escapeHtml(r.derivation||'Sin especificar')}</td><td>${escapeHtml(r.family||'Pendiente')}</td></tr>`).join('');
  const careAll=(state.careRecords||[]).length?rows.split('</tr>').filter(x=>x.trim()).map(x=>x+'</tr>'):[];
  const carePg=pagedRows(careAll,'care');
  el('careTable').innerHTML='<tr><th scope="col">Fecha</th><th scope="col">Hora</th><th scope="col">Estudiante</th><th scope="col">Área</th><th scope="col">EVA</th><th scope="col">Síntomas</th><th scope="col">Diagnóstico presuntivo</th><th scope="col">Acción realizada</th><th scope="col">Medicamento</th><th scope="col">Derivación</th><th scope="col">Familia</th></tr>'
    +(careAll.length?carePg.rows.join('')+pagerRow(11,'care',carePg.extra):emptyRow(11,'Sin atenciones registradas todavía.'));
}
/* V40.1 — El módulo Familias mostraba "Ana Martínez"/"Sofía" fijos en
   cualquier institución y ofrecía "Simular confirmación familiar" como si
   fuera un hecho registrado. No existe canal familiar: lo que el sistema
   sabe con certeza es que la notificación quedó REGISTRADA. La confirmación
   de lectura solo puede simularse dentro del tenant de ventas, y así se rotula. */
function renderFamily(){
  const box=el('familyNotices');
  if(!box)return;
  const alert=activeAlert();
  const student=studentById(alert.studentId);
  const hasCase=!!(state.currentAlert&&alert.studentId);
  const contacts=(student&&student.contacts||[]).filter(c=>c&&(c.name||c.phone));
  const demo=isDemoTenant();

  /* C3 — Deuda operativa declarada: el canal familiar NO existe. Mientras no
     exista, el módulo se rotula como vista previa en instituciones reales
     para que ningún cliente lo perciba como una función entregada. */
  const head=el('familyPreviewBadge');
  if(head){head.textContent=demo?'Demostración':'Vista previa · no operativo';head.className='badge '+(demo?'blue':'amber');}
  if(!hasCase&&!demo){
    box.innerHTML='<p style="color:#71819b;font-size:13px;line-height:1.5">Cuando se registre una atención sobre una ficha enlazada, aquí aparecerán los contactos de emergencia y el estado de la notificación.</p>';
  }else{
    const who=contacts.length
      ? contacts.map(c=>`<b>${escapeHtml(c.name||'Contacto sin nombre')}</b> <span style="color:#71819b">${escapeHtml(c.relation||'')} ${escapeHtml(c.phone||'')}</span>`).join('<br>')
      : '<b>Sin contactos de emergencia registrados en la ficha</b>';
    const readState=state.familyRead
      ? '<span class="chip green">Lectura confirmada</span>'
      : '<span class="chip amber">Notificación registrada · lectura no confirmada</span>';
    box.innerHTML=`<div class="flow-step"><div class="flow-num">1</div><div>${who}
      <p style="margin-top:6px">Estudiante: ${escapeHtml(alert.studentName||'Sin especificar')}</p>
      <div class="chipline" style="margin-top:8px">${readState}</div></div></div>
      <p class="field-hint" style="margin-top:14px">Novimed registra que la notificación fue emitida. La confirmación de lectura por parte de la familia requiere el canal familiar, no disponible en esta versión.</p>
      ${demo?'<div class="actions" style="margin-top:14px"><button type="button" class="btn secondary" onclick="confirmFamilyRead()">Simular confirmación (solo demo)</button></div>':''}`;
  }

  const screen=el('phoneScreen');
  if(!screen)return;
  if(!demo){
    screen.innerHTML='<div class="screen-top"><div><h4>Novimed</h4><span class="mini">App para familias</span></div></div><div class="parent-card"><b>Canal familiar</b><span>No disponible en esta versión</span></div><p style="margin-top:14px;font-size:12px;color:#71819b;line-height:1.5">Esta vista es una maqueta del producto previsto. Ninguna familia recibe notificaciones desde Novimed todavía.</p>';
    return;
  }
  const demoName=escapeHtml(alert.studentName||'el estudiante');
  screen.innerHTML=`<div class="screen-top"><div><h4>Novimed</h4><span class="mini">App para familias · demo</span></div></div><div class="parent-card"><b>Vista de demostración</b><span>Representante de ${demoName}</span></div><div class="notif-mobile"><b>Atención en enfermería</b><p>${demoName} fue atendido/a. Estado actual: en observación.</p></div><div class="confirm"><b>${state.familyRead?'Confirmación enviada':'Confirmación pendiente'}</b><p>${state.familyRead?'La institución ya registró la lectura.':'Maqueta: en producción este botón vive en el dispositivo de la familia.'}</p></div><button type="button" class="btn primary" style="width:100%;margin-top:14px" onclick="confirmFamilyRead()">Confirmar lectura (demo)</button><div class="bottom-nav"><span>Inicio</span><span>Alertas</span><span>Historial</span></div>`;
}




function valueOrDash(v){return (v && String(v).trim()) ? String(v).trim() : 'Sin registrar'}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function getInitials(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'NE';
  return (parts[0][0]+(parts[1]?.[0]||'')).toUpperCase();
}
function calculateAgeFromBirthDate(birthDate){
  if(!birthDate) return '';
  const birth=new Date(birthDate+'T00:00:00');
  if(Number.isNaN(birth.getTime())) return '';
  const today=new Date();
  let age=today.getFullYear()-birth.getFullYear();
  const m=today.getMonth()-birth.getMonth();
  if(m<0 || (m===0 && today.getDate()<birth.getDate())) age--;
  return age>=0 ? age+' años' : '';
}
function conditionSummary(student){
  const parts=[];
  if(student.allergies) parts.push('Alergia: '+student.allergies);
  if(student.chronic) parts.push('Crónico: '+student.chronic);
  if(student.restrictions) parts.push('Restricción escolar registrada');
  return parts.join(' · ') || 'Sin alertas críticas';
}
let showArchivedStudents=false;
function toggleArchivedStudents(){
  showArchivedStudents=!showArchivedStudents;
  const b=el('toggleArchivedBtn');
  if(b)b.textContent=showArchivedStudents?'Ocultar archivadas':'Mostrar archivadas';
  forceFullRender=true;renderAll();
}
function renderStudents(){
  const table=el('studentsTable');
  if(!table) return;
  /* El índice original se conserva ANTES de filtrar: los handlers siguen
     apuntando a la posición real en state.students. */
  const visible=(state.students||[]).map((s,index)=>({s,index}))
    .filter(x=>showArchivedStudents?true:!x.s.isArchived);
  const all=visible.map(({s,index})=>{
    const archived=!!s.isArchived;
    const actions=archived
      ? `<button type="button" class="btn secondary" onclick="openFichaModal(${index})">Ver ficha</button>`
      : `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn secondary" onclick="openFichaModal(${index})">Ver ficha</button><button type="button" class="btn secondary" onclick="openEditStudentModal(${index})">Editar</button><button type="button" class="btn secondary" onclick="archiveStudent(${index})">Archivar</button></div>`;
    const nameCell=escapeHtml(valueOrDash(s.fullName))
      +(archived?' <span class="chip amber">Archivada</span>':'')
      +`<br><span style="color:#71819b;font-size:12px">${escapeHtml(valueOrDash(s.age))}</span>`
      +(archived&&s.archivedReason?`<br><span style="color:#71819b;font-size:12px">Motivo: ${escapeHtml(s.archivedReason)}</span>`:'');
    return `<tr class="${archived?'row-archived':''}"><td>${nameCell}</td><td>${escapeHtml(valueOrDash(s.course))}</td><td>${escapeHtml(conditionSummary(s))}</td><td>${escapeHtml(valueOrDash(s.vaccineStatus))}</td><td>${actions}</td></tr>`;
  });
  const pg=pagedRows(all,'students');
  table.innerHTML='<tr><th scope="col">Estudiante</th><th scope="col">Curso</th><th scope="col">Condición registrada</th><th scope="col">Vacunación</th><th scope="col">Acción</th></tr>'
    +(all.length?pg.rows.join('')+pagerRow(5,'students',pg.extra):emptyRow(5,showArchivedStudents?'No hay fichas registradas.':'Aún no hay fichas activas. Crea la primera con el botón superior.'));
}
function fillStudentForm(s){
  const set=(id,v)=>{const n=el(id);if(n)n.value=v||'';};
  set('newFullName',s.fullName);set('newBirthDate',s.birthDate);set('newAge',s.age);set('newSex',s.sex);
  set('newCourse',s.course);set('newPhone',s.phone);set('newAddress',s.address);set('newEmail',s.email);
  (s.contacts||[]).slice(0,3).forEach((ct,i)=>{set('contact'+(i+1)+'Name',ct.name);set('contact'+(i+1)+'Relation',ct.relation);set('contact'+(i+1)+'Phone',ct.phone);});
  set('newAllergies',s.allergies);set('newChronic',s.chronic);set('newMedicines',s.medicines);
  set('newRestrictions',s.restrictions);set('newMedicalNotes',s.medicalNotes);set('newInsurance',s.insurance);
  set('newVaccineStatus',s.vaccineStatus);set('newMedicationAuth',s.medicationAuth);set('newEmergencyTransfer',s.emergencyTransfer);
}
function openEditStudentModal(index){
  if(!guardWrite())return;
  const s=state.students[index];
  if(!s){showToast('Ficha no encontrada','El registro ya no está disponible.');return;}
  openStudentModal();
  state.editingStudentIndex=index;
  fillStudentForm(s);
  const t=el('studentModalTitle');if(t)t.textContent='Editar ficha médica estudiantil';
}
/* V41 — El borrado en duro de la ficha médica de un menor tras un
   window.confirm() destruía evidencia clínica y huerfanaba las atenciones
   asociadas. Se sustituye por archivado lógico con motivo obligatorio y
   autoría registrada. La eliminación real debe quedar prohibida también
   en las reglas de Firestore (allow delete: if false). */
function archiveStudent(index){
  if(!guardWrite())return;
  const s=state.students[index];
  if(!s)return;
  if(s.isArchived){showToast('Ya archivada','Esta ficha ya está archivada.');return;}
  const name=s.fullName||'este estudiante';
  const raw=window.prompt('Archivar la ficha de '+name+'.\n\nLa ficha deja de estar activa pero se conserva íntegra junto con su historial clínico.\n\nMotivo (obligatorio):','');
  if(raw===null)return;
  const reason=String(raw).replace(/[\u0000-\u001F]/g,'').trim().slice(0,300);
  if(!reason){showToast('Motivo requerido','Archivar una ficha clínica exige un motivo registrado.');return;}
  const meta={isArchived:true,archivedAt:Date.now(),archivedReason:reason};
  if(window.novimedCloudReady && s.id && window.novimedCloudArchiveStudent){
    window.novimedCloudArchiveStudent(s.id,reason).catch(err=>{
      console.error('Archivado a nube:',err);
      showToast('Archivado local','El archivado no llegó a la nube ('+(err.code||'error')+'). Se reintentará automáticamente.');
    });
  }
  state.students[index]={...s,...meta};
  if(state.selectedStudentIndex===index)state.selectedStudentIndex=0;
  showToast('Ficha archivada','La ficha de '+name+' quedó archivada. Su historial clínico se conserva.');
  forceFullRender=true;
  renderAll();
}
function openFichaModalById(studentId){
  const idx=studentIndexById(studentId);
  if(idx<0){showToast('Ficha no disponible','Este registro no está enlazado a una ficha en este dispositivo.');return;}
  openFichaModal(idx);
}
function openStudentModal(){
  if(!guardWrite())return;
  state.editingStudentIndex=null;
  const t=el('studentModalTitle');if(t)t.textContent='Nueva ficha médica estudiantil';
  [
    'newFullName','newBirthDate','newAge','newSex','newCourse','newPhone','newAddress','newEmail',
    'contact1Name','contact1Relation','contact1Phone','contact2Name','contact2Relation','contact2Phone','contact3Name','contact3Relation','contact3Phone',
    'newAllergies','newChronic','newMedicines','newRestrictions','newMedicalNotes','newInsurance','newVaccineStatus','newMedicationAuth','newEmergencyTransfer'
  ].forEach(id=>{const node=el(id); if(node) node.value='';});
  openModal('studentModal');
}
function readOptional(id){
  const node=el(id);
  if(!node)return '';
  /* V37: saneo central — recorta longitud y elimina caracteres de control */
  return (node.value||'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,500);
}
function saveStudentMedicalRecord(){
  if(!guardWrite())return;
  const fullName=readOptional('newFullName') || 'Estudiante sin nombre';
  const birthDate=readOptional('newBirthDate');
  const age=readOptional('newAge') || calculateAgeFromBirthDate(birthDate);
  const contacts=[
    {name:readOptional('contact1Name'),relation:readOptional('contact1Relation'),phone:readOptional('contact1Phone')},
    {name:readOptional('contact2Name'),relation:readOptional('contact2Relation'),phone:readOptional('contact2Phone')},
    {name:readOptional('contact3Name'),relation:readOptional('contact3Relation'),phone:readOptional('contact3Phone')}
  ].filter(c=>c.name || c.relation || c.phone);
  const student={
    fullName,
    birthDate,
    age,
    sex:readOptional('newSex'),
    course:readOptional('newCourse'),
    address:readOptional('newAddress'),
    phone:readOptional('newPhone'),
    email:readOptional('newEmail'),
    contacts,
    allergies:readOptional('newAllergies'),
    chronic:readOptional('newChronic'),
    medicines:readOptional('newMedicines'),
    restrictions:readOptional('newRestrictions'),
    medicalNotes:readOptional('newMedicalNotes'),
    insurance:readOptional('newInsurance'),
    vaccineStatus:readOptional('newVaccineStatus'),
    medicationAuth:readOptional('newMedicationAuth'),
    emergencyTransfer:readOptional('newEmergencyTransfer')
  };
  const editIndex=state.editingStudentIndex;
  if(editIndex!==null && editIndex!==undefined && state.students[editIndex]){
    const target=state.students[editIndex];
    state.students[editIndex]={...target,...student};
    if(window.novimedCloudReady && target.id && window.novimedCloudUpdateStudent){
      window.novimedCloudUpdateStudent(target.id,student).catch(err=>{
        console.error('Edición a nube:',err);
        showToast('Edición local','Los cambios no llegaron a la nube ('+(err.code||'error')+'). Quedaron en este dispositivo.');
      });
    }
    state.editingStudentIndex=null;
    closeModal('studentModal');
    showSuccess('Ficha actualizada','Los cambios de la ficha fueron guardados.');
    renderAll();
    showPage('estudiantes');
    return;
  }
  if(window.novimedCloudReady && window.novimedCloudAddStudent){
    const opId=window.novimedNewOpId?window.novimedNewOpId():null;
    window.novimedCloudAddStudent(student,opId).catch(err=>{
      console.error('Ficha a nube:',err);
      state.students.push({...student,_pendingOpId:opId});
      renderAll();
      showToast('Guardado local','La ficha no llegó a la nube ('+(err.code||'error')+'). Quedó en este dispositivo.');
    });
  }else{
    state.students.push(student);
  }
  closeModal('studentModal');
  showSuccess('Ficha médica guardada','La ficha estudiantil fue creada y quedó disponible en el módulo Estudiantes.');
  renderAll();
  showPage('estudiantes');
}
function renderFicha(student){
  const content=el('fichaContent');
  if(!content) return;
  const contacts=(student.contacts||[]).length ? student.contacts.map((c,i)=>`<div class="ficha-item"><small>Contacto ${i+1}</small><b>${escapeHtml(valueOrDash(c.name))}<br>${escapeHtml(valueOrDash(c.relation))}<br>${escapeHtml(valueOrDash(c.phone))}</b></div>`).join('') : '<div class="ficha-item"><small>Contactos</small><b>Sin registrar</b></div>';
  const critical=[student.allergies && 'Alergias: '+student.allergies, student.chronic && 'Enfermedades crónicas: '+student.chronic, student.restrictions && 'Restricciones: '+student.restrictions].filter(Boolean).join(' · ');
  content.innerHTML=`
    <div class="student" style="margin-top:18px">
      <div class="avatar">${escapeHtml(getInitials(student.fullName))}</div>
      <div><h4>${escapeHtml(valueOrDash(student.fullName))}</h4><p>${escapeHtml(valueOrDash(student.course))}</p></div>
    </div>
    ${critical ? `<div class="ficha-critical">${escapeHtml(critical)}</div>` : `<div class="alert-note">Sin alertas médicas críticas registradas.</div>`}
    <div class="ficha-summary">
      <div class="ficha-item"><small>Fecha nacimiento</small><b>${escapeHtml(valueOrDash(student.birthDate))}</b></div>
      <div class="ficha-item"><small>Edad</small><b>${escapeHtml(valueOrDash(student.age))}</b></div>
      <div class="ficha-item"><small>Sexo</small><b>${escapeHtml(valueOrDash(student.sex))}</b></div>
      <div class="ficha-item"><small>Teléfono</small><b>${escapeHtml(valueOrDash(student.phone))}</b></div>
      <div class="ficha-item"><small>Correo</small><b>${escapeHtml(valueOrDash(student.email))}</b></div>
      <div class="ficha-item"><small>Dirección</small><b>${escapeHtml(valueOrDash(student.address))}</b></div>
      ${contacts}
      <div class="ficha-item"><small>Medicamentos habituales</small><b>${escapeHtml(valueOrDash(student.medicines))}</b></div>
      <div class="ficha-item"><small>Seguro médico</small><b>${escapeHtml(valueOrDash(student.insurance))}</b></div>
      <div class="ficha-item"><small>Vacunación</small><b>${escapeHtml(valueOrDash(student.vaccineStatus))}</b></div>
      <div class="ficha-item"><small>Medicación básica</small><b>${escapeHtml(valueOrDash(student.medicationAuth))}</b></div>
      <div class="ficha-item"><small>Traslado emergencia</small><b>${escapeHtml(valueOrDash(student.emergencyTransfer))}</b></div>
    </div>
    <div class="field"><label for="fichaMedicalNotesView">Otra información médica importante</label><textarea id="fichaMedicalNotesView" readonly>${escapeHtml(valueOrDash(student.medicalNotes))}</textarea></div>
  `;
}



function calculateRisk(profile){
  let score=0;
  const factors=[];
  if(profile.activeAlert){score+=30;factors.push('alerta activa');}
  if(profile.openCase){score+=15;factors.push('caso abierto');}
  if(profile.critical){score+=25;factors.push('antecedente crítico');}
  if(profile.careCountMonth>=3){score+=15;factors.push('atenciones recurrentes');}
  else if(profile.careCountMonth>0){score+=7;factors.push('atención reciente');}
  if(profile.vaccineStatus && profile.vaccineStatus.includes('Pendiente')){score+=10;factors.push('vacuna pendiente de verificación');}
  if(!profile.familyRead){score+=10;factors.push('confirmación familiar pendiente');}
  score=Math.min(score,100);
  let level='Bajo', cls='green', action='Control regular';
  if((profile.activeAlert && profile.critical) || score>=70){
    level='Alto'; cls='red'; action='Requiere revisión prioritaria';
  }else if(score>=35){
    level='Medio'; cls='amber'; action='Mantener seguimiento';
  }
  return {score,level,cls,action,factors};
}
function syncRiskState(){
  const sofia=state.riskProfiles.find(r=>r.student==='Sofía Martínez');
  if(sofia){
    sofia.openCase=!state.careSaved;
    sofia.familyRead=state.familyRead;
  }
}
function renderRisk(){
  syncRiskState();
  const table=el('riskTable');
  const logic=el('riskLogic');
  if(!table || !logic) return;
  const evaluated=state.riskProfiles.map(p=>({profile:p,risk:calculateRisk(p)}));
  const high=evaluated.filter(x=>x.risk.cls==='red').length;
  const medium=evaluated.filter(x=>x.risk.cls==='amber').length;
  const low=evaluated.filter(x=>x.risk.cls==='green').length;
  el('riskHigh').textContent=high;
  el('riskMedium').textContent=medium;
  el('riskLow').textContent=low;
  table.innerHTML='<tr><th scope="col">Estudiante</th><th scope="col">Condición</th><th scope="col">Nivel</th><th scope="col">Puntaje</th><th scope="col">Factores</th><th scope="col">Acción</th></tr>'+evaluated.map(({profile,risk})=>{
    return `<tr><td>${escapeHtml(profile.student)}<br><span style="color:#71819b;font-size:12px">${escapeHtml(profile.course)}</span></td><td>${escapeHtml(profile.condition)}</td><td><span class="chip ${risk.cls}">${risk.level}</span></td><td><div class="risk-score"><span>${risk.score}/100</span><div class="risk-meter"><div class="risk-fill ${risk.cls}" style="width:${risk.score}%"></div></div></div></td><td>${escapeHtml(risk.factors.join(', ') || 'sin factores activos')}</td><td>${escapeHtml(profile.action)}</td></tr>`;
  }).join('');
  logic.innerHTML=[
    ['Rojo','Se activa cuando existe alerta activa junto con antecedente crítico, o cuando el puntaje total alcanza nivel alto.'],
    ['Amarillo','Se usa para estudiantes con condiciones que requieren seguimiento, atenciones recientes o verificaciones pendientes.'],
    ['Verde','Indica control regular: sin alerta activa, sin caso abierto y sin factores críticos activos.'],
    ['Criterios evaluados','Alerta activa, caso abierto, antecedente crítico, atenciones recientes, vacunas pendientes y confirmación familiar.']
  ].map((r,i)=>`<div class="risk-rule"><b>${r[0]}</b><p>${r[1]}</p></div>`).join('')+`<p style="color:#71819b;font-size:12px;line-height:1.45;margin-top:12px">Este semáforo prioriza la gestión escolar interna. No diagnostica, no reemplaza la valoración del departamento médico y solo ordena la atención según datos registrados en Novimed.</p>`;
}

function renderVaccines(){
  const table=el('vaccinesTable');
  const schedule=el('vaccineSchedule');
  if(!table || !schedule) return;
  const ok=state.vaccines.filter(v=>v.status==='Al día').length;
  const pending=state.vaccines.filter(v=>v.status.includes('Pendiente')).length;
  const review=state.vaccines.filter(v=>v.status.includes('Próxima')).length;
  el('vacTotal').textContent=state.vaccines.length;
  el('vacOk').textContent=ok;
  el('vacPending').textContent=pending;
  el('vacReview').textContent=review;
  table.innerHTML='<tr><th scope="col">Estudiante</th><th scope="col">Edad</th><th scope="col">Referencia MSP</th><th scope="col">Estado</th><th scope="col">Próxima acción</th></tr>'+state.vaccines.map(v=>{
    const cls=v.status==='Al día'?'green':(v.status.includes('Pendiente')?'red':'amber');
    return `<tr><td>${escapeHtml(v.student)}<br><span style="color:#71819b;font-size:12px">${escapeHtml(v.course)}</span></td><td>${escapeHtml(v.age)}</td><td>${escapeHtml(v.reference)}</td><td><span class="chip ${cls}">${escapeHtml(v.status)}</span></td><td>${escapeHtml(v.next)}</td></tr>`;
  }).join('');
  schedule.innerHTML=state.vaccineSchedule.map((v,i)=>`<div class="flow-step"><div class="flow-num">${v[0]}</div><div><b>${v[1]}</b><p>${v[2]}</p></div></div>`).join('')+`<p style="color:#71819b;font-size:12px;line-height:1.45;margin-top:14px">Referencia: Esquema Nacional de Vacunación Ecuador 2025 del Ministerio de Salud Pública. Este módulo registra seguimiento escolar y verificación documental; no diagnostica ni reemplaza la validación del personal de salud.</p>`;
}

function formatDateTime24(date=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return {
    date:`${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}`,
    time:`${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}
function parsePositiveInt(value, fallback=0){
  const n=parseInt(value,10);
  return Number.isFinite(n) && n>=0 ? n : fallback;
}
function inventoryStatus(item){
  const exp = new Date(item.expires + 'T00:00:00');
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = Math.ceil((exp - today) / 86400000);
  if(item.stock <= item.min) return ['red','Reponer'];
  if(days <= 90) return ['amber','Caduca pronto'];
  return ['green','Disponible'];
}
function renderInventory(){
  const table=el('inventoryTable');
  const history=el('inventoryHistory');
  if(!table || !history) return;
  const low=state.inventory.filter(i=>i.stock<=i.min).length;
  const expiring=state.inventory.filter(i=>{const today=new Date();today.setHours(0,0,0,0);return Math.ceil((new Date(i.expires+'T00:00:00')-today)/86400000)<=90}).length;
  el('invTotal').textContent=state.inventory.length;
  el('invLow').textContent=low;
  el('invExpire').textContent=expiring;
  el('invUses').textContent=state.inventoryHistory.length;
  table.innerHTML='<tr><th scope="col">Medicamento / insumo</th><th scope="col">Categoría</th><th scope="col">Stock disponible</th><th scope="col">Stock mínimo</th><th scope="col">Caducidad</th><th scope="col">Reposición</th><th scope="col">Acción</th></tr>'+state.inventory.map((item,index)=>{
    const st=inventoryStatus(item);
    const reorder=item.stock<=item.min?'Solicitar reposición':'Stock suficiente';
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td>${item.stock} unidades</td><td>${item.min} unidades</td><td>${escapeHtml(item.expires||'Sin registrar')}</td><td><span class="chip ${st[0]}">${reorder}</span></td><td><button type="button" class="btn secondary" onclick="registerInventoryUse(${index})">Registrar uso</button></td></tr>`;
  }).join('');
  /* V41 — El log pasó de array posicional a objeto con studentId y fecha.
     Los registros anteriores siguen llegando como array: se normalizan aquí. */
  history.innerHTML=(state.inventoryHistory||[]).map(h=>{
    const e=Array.isArray(h)?{time:h[0],name:h[1],qty:h[2],studentName:h[3],context:h[4],date:''}:(h||{});
    const when=(e.date?e.date+' ':'')+(e.time||'');
    return `<div class="flow-step"><div class="flow-num">${escapeHtml(e.time||'—')}</div><div><b>${escapeHtml(e.name||'—')} · ${escapeHtml(e.qty||'')}</b><p>${escapeHtml(e.studentName||'Registro interno')} — ${escapeHtml(e.context||'')}${when?' · '+escapeHtml(when):''}</p></div></div>`;
  }).join('')||'<p style="color:#71819b;font-size:13px">Sin movimientos registrados.</p>';
}
function registerInventoryUse(index, contextStudent='Registro interno', contextReason='Uso documentado desde inventario', notify=true, studentId=null){
  if(!guardWrite())return false;
  const item=state.inventory[index];
  if(!item || item.stock<=0) return false;
  const stamp=formatDateTime24();
  const logEntry={date:stamp.date,time:stamp.time,name:item.name,qty:'1 unidad',studentId:studentId||null,studentName:contextStudent,context:contextReason};
  if(window.novimedCloudReady && item.id && window.novimedCloudUseInventory){
    window.novimedCloudUseInventory(item.id, logEntry).catch(err=>{
      console.error('Uso de inventario a nube:',err);
      showToast('Registro local','El movimiento no llegó a la nube ('+(err.code||'error')+').');
      item.stock-=1;
      state.inventoryHistory.unshift({...logEntry});
      renderInventory();
    });
  }else{
    item.stock-=1;
    state.inventoryHistory.unshift({...logEntry});
  }
  if(notify){
    showSuccess('Uso registrado','El stock fue actualizado y el movimiento quedó en el historial.');
  }
  renderInventory();
  return true;
}
function openMedicineModal(){
  if(!guardWrite())return;
  ['newMedicineName','newMedicineCategory','newMedicineStock','newMedicineMin','newMedicineExpires'].forEach(id=>{const node=el(id); if(node) node.value='';});
  openModal('medicineModal');
}
function saveMedicineToInventory(){
  if(!guardWrite())return;
  const item={
    name:readOptional('newMedicineName') || 'Medicamento sin nombre',
    category:readOptional('newMedicineCategory') || 'Sin categoría',
    stock:parsePositiveInt(readOptional('newMedicineStock'),0),
    min:parsePositiveInt(readOptional('newMedicineMin'),0),
    expires:readOptional('newMedicineExpires') || 'Sin registrar',
    status:'Disponible'
  };
  if(window.novimedCloudReady && window.novimedCloudAddInventoryItem){
    const opId=window.novimedNewOpId?window.novimedNewOpId():null;
    window.novimedCloudAddInventoryItem(item,opId).catch(err=>{
      console.error('Medicamento a nube:',err);
      state.inventory.push({...item,_pendingOpId:opId});
      renderAll();
      showToast('Guardado local','El medicamento no llegó a la nube ('+(err.code||'error')+'). Quedó en este dispositivo.');
    });
  }else{
    state.inventory.push(item);
  }
  closeModal('medicineModal');
  showSuccess('Medicamento agregado','El medicamento quedó registrado en inventario y disponible para futuras atenciones.');
  renderAll();
  showPage('inventario');
}
/* ============================================================
   V41.1 — VISTA DOCENTE: FORMULARIO REAL
   Antes: plantilla innerHTML con `value="Sofía Martínez"` y los síntomas del
   caso demo escritos en el textarea. Esos dos campos NUNCA se leían: el botón
   abría el modal y descartaba lo escrito. Además, al re-renderizarse en cada
   renderAll(), cualquier texto del docente se perdía — razón por la que el
   original llevaba valores fijos.

   Ahora: el panel se construye UNA vez y a partir de ahí solo se refrescan las
   opciones de estudiante y el estado de validación, de modo que escribir no
   destruye el foco ni el contenido. El estado vive en `teacherForm` y los
   inputs son controlados contra él.
   ============================================================ */
const teacherForm={studentId:'',studentName:'',location:'',symptoms:'',isSubmitting:false,touched:{student:false,symptoms:false},open:false,highlight:-1};
let teacherPaneBuilt=false;

function teacherErrors(){
  return {
    student: teacherForm.studentId ? '' : 'Selecciona un estudiante de la matrícula.',
    symptoms: teacherForm.symptoms.trim() ? '' : 'Describe lo observado antes de reportar.'
  };
}
function teacherIsValid(){const e=teacherErrors();return !e.student && !e.symptoms;}

function teacherMatches(){
  const q=normalizeText(teacherForm.studentName);
  const list=activeStudents();
  if(!q)return list.slice(0,8);
  return list.filter(s=>normalizeText(s.fullName).includes(q)||normalizeText(s.course).includes(q)).slice(0,8);
}
function renderTeacherOptions(){
  const box=el('teacherStudentOptions');
  if(!box)return;
  if(!teacherForm.open){box.innerHTML='';box.style.display='none';el('teacherStudentInput')?.setAttribute('aria-expanded','false');return;}
  const items=teacherMatches();
  el('teacherStudentInput')?.setAttribute('aria-expanded','true');
  if(!items.length){
    box.innerHTML='<div class="combo-empty">Sin coincidencias en la matrícula de esta institución.</div>';
    box.style.display='block';return;
  }
  box.innerHTML=items.map((s,i)=>`<div class="combo-option${i===teacherForm.highlight?' active':''}" role="option" id="teacherOpt${i}" aria-selected="${i===teacherForm.highlight}" data-id="${escapeHtml(s.id||'')}" data-name="${escapeHtml(s.fullName||'')}"><b>${escapeHtml(s.fullName||'Estudiante sin nombre')}</b>${s.course?`<span>${escapeHtml(s.course)}</span>`:''}</div>`).join('');
  box.style.display='block';
}
function selectTeacherStudent(id,name){
  teacherForm.studentId=id||'';
  teacherForm.studentName=name||'';
  teacherForm.touched.student=true;
  teacherForm.open=false;teacherForm.highlight=-1;
  const input=el('teacherStudentInput');
  if(input)input.value=teacherForm.studentName;
  renderTeacherOptions();syncTeacherPane();
}
/* Refresca SOLO lo derivado del estado: valores, errores y disponibilidad
   del botón. Nunca reconstruye el marcado mientras el docente escribe. */
function syncTeacherPane(){
  if(!teacherPaneBuilt)return;
  const e=teacherErrors();
  const setErr=(id,msg,show)=>{const n=el(id);if(!n)return;n.textContent=show?msg:'';n.style.display=(show&&msg)?'block':'none';};
  setErr('teacherStudentError',e.student,teacherForm.touched.student);
  setErr('teacherSymptomsError',e.symptoms,teacherForm.touched.symptoms);
  const input=el('teacherStudentInput');
  if(input)input.setAttribute('aria-invalid',teacherForm.touched.student&&!!e.student?'true':'false');
  const ta=el('teacherSymptoms');
  if(ta&&ta.value!==teacherForm.symptoms)ta.value=teacherForm.symptoms;
  const btn=el('teacherSubmitBtn');
  if(btn){
    const blocked=!teacherIsValid()||teacherForm.isSubmitting||!canWrite();
    btn.disabled=blocked;
    btn.textContent=teacherForm.isSubmitting?'Enviando…':'Reportar emergencia';
  }
  const linked=el('teacherLinkState');
  if(linked){
    const st=studentById(teacherForm.studentId);
    if(st){
      const crit=[st.allergies&&'Alergias: '+st.allergies,st.chronic&&'Crónicas: '+st.chronic].filter(Boolean).join(' · ');
      linked.className='alert-note '+(crit?'critical':'clear');
      linked.textContent=crit?('Ficha enlazada · '+crit):'Ficha enlazada · sin alergias ni condiciones registradas';
      linked.style.display='block';
    }else{linked.style.display='none';}
  }
}
function resetTeacherForm(){
  teacherForm.studentId='';teacherForm.studentName='';teacherForm.location='';teacherForm.symptoms='';
  teacherForm.isSubmitting=false;teacherForm.touched={student:false,symptoms:false};
  teacherForm.open=false;teacherForm.highlight=-1;
  ['teacherStudentInput','teacherLocation','teacherSymptoms'].forEach(id=>{const n=el(id);if(n)n.value='';});
  renderTeacherOptions();syncTeacherPane();
}
async function submitTeacherPane(){
  teacherForm.touched={student:true,symptoms:true};
  syncTeacherPane();
  if(!teacherIsValid()||teacherForm.isSubmitting)return;
  if(!guardWrite())return;
  teacherForm.isSubmitting=true;syncTeacherPane();
  try{
    await window.submitTeacherAlert({
      studentId:teacherForm.studentId,
      studentName:teacherForm.studentName,
      location:teacherForm.location.trim()||'Ubicación sin registrar',
      symptoms:teacherForm.symptoms.trim(),
      valid:true
    });
    resetTeacherForm();   /* D — limpieza solo tras un envío procesado */
  }catch(err){
    console.error('Alerta docente:',err);
    showToast('No se pudo reportar','La alerta no pudo procesarse. Revisa la conexión e inténtalo de nuevo.');
  }finally{
    teacherForm.isSubmitting=false;syncTeacherPane();
  }
}
function renderTeacherPane(){
  const host=el('role-docente');
  if(!host)return;
  if(teacherPaneBuilt){renderTeacherOptions();syncTeacherPane();return;}
  host.innerHTML=`<div class="grid"><article class="card">
    <div class="role-title"><div class="avatar">👩‍🏫</div><div><h3>Vista docente</h3><p>Reporta un incidente del aula sin perder tiempo.</p></div></div>
    <div class="field">
      <label for="teacherStudentInput">Estudiante</label>
      <div class="combo">
        <input id="teacherStudentInput" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="teacherStudentOptions" autocomplete="off" placeholder="Buscar o seleccionar estudiante...">
        <div class="combo-list" id="teacherStudentOptions" role="listbox" aria-label="Estudiantes de la institución" style="display:none"></div>
      </div>
      <p class="field-error" id="teacherStudentError" role="alert" style="display:none"></p>
    </div>
    <div class="alert-note" id="teacherLinkState" style="display:none"></div>
    <div class="field">
      <label for="teacherLocation">Ubicación <span style="font-weight:600;text-transform:none;letter-spacing:0">(opcional)</span></label>
      <input id="teacherLocation" placeholder="Ej. Aula 6B · 2° piso">
    </div>
    <div class="field">
      <label for="teacherSymptoms">Síntomas observados</label>
      <textarea id="teacherSymptoms" placeholder="Describe los síntomas o el motivo del incidente..."></textarea>
      <p class="field-error" id="teacherSymptomsError" role="alert" style="display:none"></p>
    </div>
    <button type="button" class="btn primary" id="teacherSubmitBtn" disabled>Reportar emergencia</button>
  </article><article class="card"><h3>Estado de alerta</h3><br>
    <p style="color:#71819b;line-height:1.5">Al reportar, el departamento médico recibe la notificación y el caso pasa al centro de alertas con la ficha del estudiante ya enlazada.</p>
  </article></div>`;

  const input=el('teacherStudentInput');
  input.addEventListener('input',()=>{
    teacherForm.studentName=input.value;
    teacherForm.studentId='';      /* escribir invalida la selección previa */
    teacherForm.open=true;teacherForm.highlight=-1;
    renderTeacherOptions();syncTeacherPane();
  });
  input.addEventListener('focus',()=>{teacherForm.open=true;renderTeacherOptions();});
  input.addEventListener('blur',()=>{
    /* retardo: permite que el clic en una opción se registre antes de cerrar */
    setTimeout(()=>{teacherForm.touched.student=true;teacherForm.open=false;renderTeacherOptions();syncTeacherPane();},160);
  });
  input.addEventListener('keydown',ev=>{
    const items=teacherMatches();
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault();teacherForm.open=true;
      const d=ev.key==='ArrowDown'?1:-1;
      teacherForm.highlight=Math.max(0,Math.min(items.length-1,teacherForm.highlight+d));
      renderTeacherOptions();
    }else if(ev.key==='Enter'&&teacherForm.open&&items[teacherForm.highlight]){
      ev.preventDefault();
      const s=items[teacherForm.highlight];
      selectTeacherStudent(s.id,s.fullName);
    }else if(ev.key==='Escape'){teacherForm.open=false;renderTeacherOptions();}
  });
  el('teacherStudentOptions').addEventListener('mousedown',ev=>{
    const opt=ev.target.closest('.combo-option');
    if(opt)selectTeacherStudent(opt.dataset.id,opt.dataset.name);
  });
  el('teacherLocation').addEventListener('input',ev=>{teacherForm.location=ev.target.value;});
  const ta=el('teacherSymptoms');
  ta.addEventListener('input',()=>{teacherForm.symptoms=ta.value;syncTeacherPane();});
  ta.addEventListener('blur',()=>{teacherForm.touched.symptoms=true;syncTeacherPane();});
  el('teacherSubmitBtn').addEventListener('click',submitTeacherPane);

  teacherPaneBuilt=true;
  syncTeacherPane();
}
function renderRoles(){el('role-medico').innerHTML=`<div class="grid"><article class="card"><div class="role-title"><div class="avatar">MG</div><div><h3>Panel médico de atención</h3><p>Desde aquí se consulta Ficha Médica, Registra Atención, Revisa Riesgo, Vacunas e Inventario.</p></div></div><div class="actions"><button type="button" class="btn secondary" onclick="openFichaModal()">Ver ficha médica</button><button type="button" class="btn primary" onclick="openAttentionModal()">Registrar atención</button><button type="button" class="btn secondary" onclick="showPage('riesgo')">Revisar riesgo</button><button type="button" class="btn secondary" onclick="showPage('vacunas')">Control de vacunas</button><button type="button" class="btn secondary" onclick="showPage('inventario')">Medicamentos disponibles</button></div></article><article class="card"><div class="section-head"><h3>Flujo clínico</h3><span class="badge green">Activo</span></div><div class="feed">${state.activities.map(a=>`<div class="event"><time>${escapeHtml(a[0])}</time><div><span class="dot" style="display:block;background:var(--${DOT_COLORS[a[1]]||'blue'})"></span></div><div><b>${escapeHtml(a[2])}</b><p>${escapeHtml(a[3])}</p></div></div>`).join('')}</div></article></div>`;
renderTeacherPane();
el('role-familia').innerHTML=`<div class="grid"><article class="card"><div class="role-title"><div class="avatar">AM</div><div><h3>Vista familia</h3><p>Recibe información clara y confirma lectura.</p></div></div><div id="familyRoleBox"></div></article><article class="card"><div class="phone"><div class="screen" id="phoneScreenRole"></div></div></article></div>`;el('familyRoleBox').innerHTML=el('familyNotices')?el('familyNotices').innerHTML:'';el('phoneScreenRole').innerHTML=el('phoneScreen')?el('phoneScreen').innerHTML:'';
el('role-directivo').innerHTML=`<div class="kpis"><div class="kpi"><small>Atenciones hoy</small><strong>${careCountToday()}</strong><em class="green">documentadas</em></div><div class="kpi"><small>Lectura familiar</small><strong class="green">${state.familyRead?'96%':'94%'}</strong><em>actualizado</em></div><div class="kpi"><small>Casos críticos</small><strong class="red">2</strong><em class="red">seguimiento</em></div><div class="kpi"><small>Respuesta</small><strong>2m 34s</strong><em class="green">mejorando</em></div></div><div class="card"><h3>Trazabilidad del caso Sofía Martínez</h3><br><table class="table"><tr><th>Momento</th><th>Acción</th><th>Responsable</th></tr><tr><td>10:24</td><td>Alerta reportada</td><td>Docente</td></tr><tr><td>10:25</td><td>Ficha consultada</td><td>Departamento médico</td></tr><tr><td>10:27</td><td>Familia notificada</td><td>Novimed</td></tr><tr><td>10:29</td><td>${state.familyRead?'Lectura confirmada':'Lectura pendiente'}</td><td>Familia</td></tr></table></div>`}

function populateAttentionOptions(){
  const studentSelect=el('careStudent');
  if(studentSelect){
    studentSelect.innerHTML=(state.students||[]).map((s,i)=>({s,i}))
      .filter(x=>!x.s.isArchived)
      .map(({s,i})=>`<option value="${i}" ${i===state.selectedStudentIndex?'selected':''}>${escapeHtml(s.fullName||'Estudiante sin nombre')}</option>`).join('');
  }
  const medSelect=el('careMedication');
  if(medSelect){
    medSelect.innerHTML='<option value="">Sin medicamento administrado</option>'+(state.inventory||[]).map((m,i)=>`<option value="${i}">${escapeHtml(m.name)} · stock ${m.stock}</option>`).join('')+'<option value="otro">Otro / no registrado en inventario</option>';
  }
}
function setBodyArea(area){
  const input=el('careBodyArea');
  const avatar=el('bodyAvatarFigure');
  if(input) input.value=area;
  document.querySelectorAll('#bodyAreaOptions .area-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.area===area));
  if(avatar){
    if(area && area!=='General / sin zona específica') avatar.dataset.area=area;
    else avatar.removeAttribute('data-area');
  }
}
function clearAttentionForm(){
  ['careSymptoms','carePresumptiveDiagnosis','careActionDone','careMedicationDose','careObservations','careBodyArea'].forEach(id=>{const node=el(id);if(node)node.value='';});
  ['careStatus','careEva','careDerivation','careMedication'].forEach(id=>{const node=el(id);if(node)node.selectedIndex=0;});
  document.querySelectorAll('#bodyAreaOptions .area-btn').forEach(btn=>btn.classList.remove('active'));
  const avatar=el('bodyAvatarFigure');
  if(avatar) avatar.removeAttribute('data-area');
}
function careCountToday(){
  const today=formatDateTime24().date;
  return (state.careRecords||[]).filter(r=>r && r.date===today).length;
}
function formatDuration(ms){const m=Math.floor(ms/60000);const s=Math.round((ms%60000)/1000);return m+'m '+String(s).padStart(2,'0')+'s'}
function avgResponseMs(){
  if(!Array.isArray(state.alerts))return null;
  const times=state.alerts.filter(a=>a&&Number.isFinite(a.attendedAt)&&Number.isFinite(a.createdAt)&&a.attendedAt>a.createdAt).map(a=>a.attendedAt-a.createdAt);
  if(!times.length)return null;
  return {avg:times.reduce((x,y)=>x+y,0)/times.length,n:times.length};
}
function isDemoTenant(){return window.__novimedTenant!=='eight-demo'?false:true}
function familyReadPct(){
  if(!Array.isArray(state.alerts))return null;
  const closed=state.alerts.filter(a=>a&&a.status==='family_confirmed').length;
  const attended=state.alerts.filter(a=>a&&a.status==='attended').length;
  const done=closed+attended;
  return done?Math.round(closed/done*100):null;
}
function renderReports(){
  if(!el('reportClosed'))return;
  const alerts=Array.isArray(state.alerts)?state.alerts:null;
  if(alerts){
    const closed=alerts.filter(a=>a&&a.status==='family_confirmed').length;
    const total=alerts.length;
    el('reportClosed').textContent=String(closed);
    el('reportClosedSub').textContent=total?Math.round(closed/total*100)+'% del total':'sin alertas aún';
    const _r=avgResponseMs();
    if(_r){
      el('reportAvg').textContent=formatDuration(_r.avg);
      el('reportAvgSub').textContent=_r.n===1?'1 caso medido':_r.n+' casos medidos';
    }else{
      el('reportAvg').textContent='—';
      el('reportAvgSub').textContent='aún sin mediciones';
    }
    const cnt=p=>alerts.filter(a=>a&&(a.priority||'Alta')===p).length;
    el('reportPrioLine').innerHTML=`<span class="chip red">Alta ${cnt('Alta')}</span><span class="chip amber">Media ${cnt('Media')}</span><span class="chip green">Baja ${cnt('Baja')}</span>`;
  }
  const pct=familyReadPct();
  el('reportRead').textContent=pct!==null?pct+'%':(isDemoTenant()?(state.familyRead?'96%':'94%'):'—');
  const evaluated=(state.riskProfiles||[]).map(p=>calculateRisk(p));
  el('reportRisk').textContent=String(evaluated.filter(r=>r&&r.cls==='red').length);
  const freq={};
  (state.careRecords||[]).forEach(r=>{const k=((r&&r.symptoms)||'').trim();if(k&&k!=='Sin especificar')freq[k]=(freq[k]||0)+1});
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
  el('reportTopMotivos').textContent=top.length?top.join(' · '):'Aún sin atenciones registradas.';
}
function renderSystemInfo(){
  const st=el('configSyncStatus');if(st)st.textContent=window.novimedSyncStatus||'—';
  const v=el('configVersion');if(v)v.textContent=NOVIMED_VERSION;
  const sc=el('configSchool');if(sc)sc.textContent=window.novimedSchoolLabel||'—';
  const pend=window.novimedPendingOpsCount?window.novimedPendingOpsCount():0;
  const pn=el('configPending');if(pn)pn.textContent=pend>0?(pend+' operación(es) pendiente(s) de sincronizar'):'Todo sincronizado';
  const ce=el('configEnv');if(ce)ce.textContent=(window.novimedEnvName||'producción')+' · App Check: '+(window.novimedAppCheck||'no configurado');
  const cu=el('configUser');if(cu)cu.textContent=currentSession.anonymous?'Modo demo (sin cuenta)':(currentSession.email||'—');
  const cr=el('configRole');if(cr)cr.textContent=roleLabel(sessionRole());
  const ct=el('configCounts');if(ct)ct.textContent=(state.students||[]).length+' estudiantes · '+(state.careRecords||[]).length+' atenciones · '+((state.alerts&&state.alerts.length)||0)+' alertas · '+(state.inventory||[]).length+' ítems de inventario';
}
function renderAll(){
  applyQueueDerivedFocus();
  if(state.activities.length>100)state.activities=state.activities.slice(-100);renderFeed();if(shouldRender('renderAlerts'))renderAlerts();if(shouldRender('renderCare'))renderCare();if(shouldRender('renderFamily'))renderFamily();if(shouldRender('renderStudents'))renderStudents();if(shouldRender('renderVaccines'))renderVaccines();if(shouldRender('renderInventory'))renderInventory();if(shouldRender('renderRisk'))renderRisk();if(shouldRender('renderRoles'))renderRoles();const c=activeAlert();if(el('mainStudentName'))el('mainStudentName').textContent=c.studentName;if(el('mainStudentAvatar'))el('mainStudentAvatar').textContent=getInitials(c.studentName);if(el('mainStudentMeta'))el('mainStudentMeta').textContent=c.location;if(el('mainSymptoms'))el('mainSymptoms').textContent=c.symptoms;renderMainAllergyNote();if(Array.isArray(state.alerts)){const pend=state.alerts.filter(a=>a&&a.status==='pending').length;el('kpiAlerts').textContent=String(pend);const sub=el('kpiAlertsSub');if(sub){sub.textContent=pend===0?'sin pendientes':(pend===1?'1 requiere atención':pend+' requieren atención');sub.className=pend===0?'green':'red';}}else if(isDemoTenant()){el('kpiAlerts').textContent=state.careSaved?'2':'3';}else{el('kpiAlerts').textContent='0';const sub=el('kpiAlertsSub');if(sub){sub.textContent='sin pendientes';sub.className='green';}}el('kpiCare').textContent=careCountToday();const _frp=familyReadPct();
  el('kpiFamily').textContent=_frp!==null?_frp+'%':(isDemoTenant()?(state.familyRead?'96%':'94%'):'—');
  const hero=el('heroTitle');
  if(hero)hero.textContent=state.alertSent?((state.currentAlert&&state.currentAlert.studentName)||'Estudiante')+' necesita atención':'Sin alertas activas';
  const pendN=Array.isArray(state.alerts)?state.alerts.filter(a=>a&&a.status==='pending').length:(isDemoTenant()?null:0);
  [['navAlertPill'],['bellCount']].forEach(([id])=>{const n=el(id);if(!n)return;if(pendN===null)return;n.textContent=String(pendN);n.style.display=pendN===0?'none':'';});
  const resp=avgResponseMs();
  const kr=el('kpiResp'),krs=el('kpiRespSub');
  if(kr){if(resp){kr.textContent=formatDuration(resp.avg);if(krs)krs.textContent=resp.n===1?'1 caso medido':resp.n+' casos medidos';}else if(!isDemoTenant()){kr.textContent='—';if(krs)krs.textContent='sin datos aún';}}
  if(pendN===null){ /* demo antes de nube: restaurar teatro por si otro tenant lo pisó */
    const dt=[['chipAlertas','3 alertas'],['chipAtenciones','27 atenciones'],['chipLectura','94% lectura'],['chipTiempo','2m 34s'],['bellCount','3'],['navAlertPill','3']];
    dt.forEach(([id,v])=>{const n=el(id);if(n){n.textContent=v;n.style.display='';}});
    if(kr&&!resp){kr.textContent='2m 34s';if(krs)krs.textContent='mejorando';}
  }
  const ca=el('chipAlertas');if(ca&&pendN!==null)ca.textContent=pendN+' alertas';
  const cat=el('chipAtenciones');if(cat&&(!isDemoTenant()||Array.isArray(state.alerts)))cat.textContent=careCountToday()+' atenciones';
  const cl=el('chipLectura');if(cl)cl.textContent=_frp!==null?_frp+'% lectura':(isDemoTenant()?'94% lectura':'— lectura');
  const cti=el('chipTiempo');if(cti){if(resp)cti.textContent=formatDuration(resp.avg);else if(!isDemoTenant())cti.textContent='—';}
  if(shouldRender('renderReports'))renderReports();el('mainBadge').textContent=state.careSaved?'En seguimiento':'Acción requerida';el('mainBadge').className='badge '+(state.careSaved?'green':'red');renderSystemInfo();forceFullRender=false;persistState()}
let lastFocusedBeforeModal=null;
function openModal(id){const m=el(id);if(!m)return;lastFocusedBeforeModal=document.activeElement;m.classList.add('open');const box=m.querySelector('.modal-box');if(box){box.setAttribute('tabindex','-1');box.focus({preventScroll:true});}}
function closeModal(id){const m=el(id);if(!m)return;m.classList.remove('open');if(lastFocusedBeforeModal&&typeof lastFocusedBeforeModal.focus==='function'){lastFocusedBeforeModal.focus({preventScroll:true});lastFocusedBeforeModal=null;}}/* V40.1 + V41 — El modal de alerta venía prellenado con el caso demo y
   capturaba el estudiante como texto libre, de modo que la alerta nunca
   podía enlazarse a una ficha. Ahora se elige de la matrícula real y el
   texto libre queda como excepción explícitamente rotulada. */
function populateAlertStudentOptions(){
  const sel=el('reportStudent');
  if(!sel)return;
  const list=activeStudents();
  sel.innerHTML='<option value="">— Selecciona un estudiante —</option>'
    +list.map(s=>`<option value="${escapeHtml(s.id||'')}">${escapeHtml(s.fullName||'Estudiante sin nombre')}${s.course?' · '+escapeHtml(s.course):''}</option>`).join('')
    +'<option value="__other__">Estudiante no registrado en Novimed</option>';
  sel.onchange=()=>{
    const f=el('reportStudentOtherField');
    if(f)f.style.display=sel.value==='__other__'?'':'none';
  };
}
function openReportModal(){
  if(!guardWrite())return;
  populateAlertStudentOptions();
  ['reportRoom','reportSymptoms','reportStudentOther'].forEach(id=>{const n=el(id);if(n)n.value='';});
  const f=el('reportStudentOtherField');if(f)f.style.display='none';
  openModal('reportModal');
}
/* Contrato único de lectura del formulario: sync.js lo reutiliza para no
   duplicar el parseo del DOM en dos módulos. */
window.novimedReadAlertForm=function(){
  const sel=el('reportStudent');
  const value=sel?sel.value:'';
  const other=readOptional('reportStudentOther');
  const linked=value&&value!=='__other__'?studentById(value):null;
  return {
    studentId:linked?linked.id:null,
    studentName:linked?(linked.fullName||'Estudiante sin nombre'):(other||'Estudiante no registrado'),
    location:readOptional('reportRoom')||'Ubicación sin registrar',
    symptoms:readOptional('reportSymptoms')||'Síntomas sin especificar',
    valid:!!(linked||other)
  };
};function openFichaModal(index=0){if(!state.students.length){showToast('Sin fichas','Aún no hay estudiantes registrados. Crea una ficha desde el módulo Estudiantes.');return;}if(!Number.isFinite(index)||index<0||index>=state.students.length)index=0;state.selectedStudentIndex=index;renderFicha(state.students[index]);openModal('fichaModal')}function openAttentionModal(){
  if(!guardWrite())return;closeModal('fichaModal');populateAttentionOptions();clearAttentionForm();openModal('attentionModal')}
/**
 * @typedef {Object} AlertPayload
 * @property {string|null} studentId   Clave foránea a schools/{id}/students. null = sin ficha enlazada.
 * @property {string}      studentName Nombre desnormalizado, solo para lectura.
 * @property {string}      location    Ubicación del incidente.
 * @property {string}      symptoms    Síntomas observados.
 * @property {boolean}     valid       Cumple las validaciones mínimas de envío.
 */
/** @param {AlertPayload=} payload Si se omite, se lee del modal. */
function submitTeacherAlert(payload){
  if(!guardWrite())return;
  const form=payload||window.novimedReadAlertForm();
  if(!form.valid){showToast('Estudiante requerido','Selecciona un estudiante de la matrícula o escribe el nombre si no está registrado.');return;}
  /* Sin campo `allergy`: las alergias se derivan de la ficha por studentId
     en tiempo de render. Nunca se copian ni se asumen. */
  state.currentAlert={studentId:form.studentId,studentName:form.studentName,location:form.location,symptoms:form.symptoms,alertTimeLabel:'Ahora'};
  state.alertSent=true;
  state.activities.unshift(['Ahora','red','Nueva alerta de '+form.studentName,form.location+' · docente reporta síntomas'+(form.studentId?'':' · sin ficha enlazada')]);
  closeModal('reportModal');
  showSuccess('Alerta enviada','El departamento médico recibió la notificación en tiempo real.');
  renderAll();showPage('alertas');
}
function submitCare(){
  if(!guardWrite())return;
  let selectedIndex=parseInt(el('careStudent')?.value || state.selectedStudentIndex || 0,10);
  if(!Number.isFinite(selectedIndex) || selectedIndex<0 || selectedIndex>=state.students.length) selectedIndex=0;
  const selectedStudent=(state.students&&state.students[selectedIndex])?state.students[selectedIndex]:state.students[0];
  state.selectedStudentIndex=selectedIndex;
  const medValue=readOptional('careMedication');
  const dose=readOptional('careMedicationDose');
  let medication='Sin medicamento administrado';
  let medicationInventoryIndex=null;
  if(medValue && medValue!=='otro'){
    const parsedMedIndex=parseInt(medValue,10);
    if(Number.isFinite(parsedMedIndex) && parsedMedIndex>=0 && parsedMedIndex<state.inventory.length){
      medicationInventoryIndex=parsedMedIndex;
      medication=state.inventory[parsedMedIndex].name;
    }
  }else if(medValue==='otro'){
    medication='Otro / no registrado en inventario';
  }
  const stamp=formatDateTime24();
  const record={
    date:stamp.date,
    time:stamp.time,
    /* V41 — studentId es la clave; studentName queda desnormalizado
       solo para lectura (ficha archivada, renombrada o no sincronizada). */
    studentId:selectedStudent?.id || null,
    studentName:selectedStudent?.fullName || 'Estudiante sin nombre',
    bodyArea:readOptional('careBodyArea') || 'Sin especificar',
    eva:readOptional('careEva') || 'Sin especificar',
    symptoms:readOptional('careSymptoms') || 'Sin especificar',
    presumptiveDiagnosis:readOptional('carePresumptiveDiagnosis') || 'Sin especificar',
    actionDone:readOptional('careActionDone') || 'Sin especificar',
    medication:dose ? medication+' · '+dose : medication,
    dose,
    derivation:readOptional('careDerivation') || 'Sin especificar',
    observations:readOptional('careObservations') || 'Sin observaciones',
    family:'Pendiente'
  };
  if(medicationInventoryIndex!==null && Number.isFinite(medicationInventoryIndex)){
    registerInventoryUse(medicationInventoryIndex,record.studentName,'Administrado en atención médica',false,record.studentId);
  }
  if(window.novimedCloudReady && window.novimedCloudAddCareRecord){
    const opId=window.novimedNewOpId?window.novimedNewOpId():null;
    window.novimedCloudAddCareRecord(record,opId).catch(err=>{
      console.error('Atención a nube:',err);
      state.careRecords.unshift({...record,_pendingOpId:opId});
      renderAll();
      showToast('Registro local','La atención no llegó a la nube ('+(err.code||'error')+'). Quedó en este dispositivo.');
    });
  }else{
    state.careRecords.unshift(record);
  }
  state.careSaved=true;
  state.activities.push([stamp.time,'green','Atención registrada',`${record.studentName} · ${record.eva} · ${record.bodyArea}`]);
  closeModal('attentionModal');
  showSuccess('Atención registrada','La atención médica quedó documentada y la familia fue notificada.');
  renderAll();
  showPage('atenciones');
}
/* V41 — confirmFamilyRead escribía sobre state.careRecords[0] (el registro
   MÁS RECIENTE), no sobre el vinculado al caso: la confirmación podía
   aterrizar en el expediente de otro estudiante. Ahora se resuelve por el
   id de atención que el caso activo enlaza; si no hay vínculo, no se escribe
   sobre ningún expediente. */
function linkedCareRecord(){
  const id=window.novimedLinkedCareRecordId&&window.novimedLinkedCareRecordId();
  if(id){
    const byId=(state.careRecords||[]).find(r=>r&&r.id===id);
    if(byId)return byId;
  }
  const sid=activeAlert().studentId;
  if(!sid)return null;
  return (state.careRecords||[]).find(r=>r&&r.studentId===sid)||null;
}
function confirmFamilyRead(){
  if(!guardWrite())return;
  const target=linkedCareRecord();
  if(!target){
    showToast('Sin atención vinculada','No hay una atención enlazada a este caso: la confirmación no se registra sobre ningún expediente.');
    return;
  }
  state.familyRead=true;
  target.family='Confirmada';
  if(window.novimedCloudReady && target.id && window.novimedCloudConfirmFamily){
    window.novimedCloudConfirmFamily(target.id).catch(err=>console.error('Confirmación a nube:',err));
  }
  state.activities.push(['Ahora','amber','Confirmación de lectura registrada',recordStudentName(target)]);
  showSuccess('Lectura confirmada','La confirmación quedó registrada en la atención de '+recordStudentName(target)+'.');
  renderAll();
}
function showSuccess(t,txt){el('successTitle').textContent=t;el('successText').textContent=txt;openModal('successModal')}
document.querySelectorAll('#bodyAreaOptions .area-btn').forEach(btn=>btn.onclick=()=>setBodyArea(btn.dataset.area));el('openFicha').onclick=openFichaModal;el('openAttention').onclick=openAttentionModal;el('goDemo').onclick=()=>showPage('roles');el('bell').onclick=()=>{const c=activeAlert();showToast('Nueva alerta médica',`${c.studentName} — ${c.location}. El centro médico fue notificado.`);};/* V30 — Búsqueda real sobre los registros del sistema (antes era un resultado fijo) */
function normalizeText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
let searchDebounce=null;
el('searchInput').addEventListener('input',e=>{
  clearTimeout(searchDebounce);
  const q=normalizeText(e.target.value.trim());
  if(q.length<2) return;
  searchDebounce=setTimeout(()=>{
    const studentIdx=state.students.findIndex(s=>normalizeText(s.fullName).includes(q));
    if(studentIdx>=0){
      const s=state.students[studentIdx];
      showToast('Estudiante encontrado',`${s.fullName} · ${conditionSummary(s)}`);
      return;
    }
    const med=state.inventory.find(m=>normalizeText(m.name).includes(q));
    if(med){showToast('Inventario',`${med.name} · ${med.stock} unidades disponibles`);return;}
    const care=(state.careRecords||[]).find(r=>normalizeText(recordStudentName(r)).includes(q)||normalizeText(r.symptoms).includes(q));
    if(care){showToast('Atención registrada',`${recordStudentName(care)} · ${care.date} ${care.time}`);}
  },220);
});
el('searchInput').addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const q=normalizeText(e.target.value.trim());
  if(q.length<2)return;
  const idx=state.students.findIndex(s=>normalizeText(s.fullName).includes(q));
  if(idx>=0)openFichaModal(idx);
});
document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('open')});
/* V30 — Accesibilidad: cerrar modales con Escape y llevar el foco al abrir */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id));
  }
});
renderAll();

/* Bridge (antes bloque separado) */
/* Bridge V8 — Expone la lógica actual para la integración modular con Firebase */
window.novimedState = state;
window.novimedRenderAll = renderAll;
window.novimedShowPage = showPage;
window.novimedShowSuccess = showSuccess;
window.novimedRegisterInventoryUse = registerInventoryUse;
window.novimedCloseModal = closeModal;
window.novimedSubmitTeacherAlertLocal = submitTeacherAlert;
window.novimedShowToast = showToast;
window.novimedSubmitCareLocal = submitCare;
window.novimedConfirmFamilyReadLocal = confirmFamilyRead;

/* ============================================================
   MIGRACIÓN V32 — Exposición explícita de handlers globales.
   En el monolito, las declaraciones de función eran globales;
   como módulo ES, los onclick del HTML requieren window.*.
   ============================================================ */
[
  ['closeModal',closeModal],['openModal',openModal],['showPage',showPage],
  ['openFichaModal',openFichaModal],['openStudentModal',openStudentModal],
  ['openAttentionModal',openAttentionModal],['openMedicineModal',openMedicineModal],
  ['openReportModal',openReportModal],['saveStudentMedicalRecord',saveStudentMedicalRecord],
  ['saveMedicineToInventory',saveMedicineToInventory],['registerInventoryUse',registerInventoryUse],
  ['confirmFamilyRead',confirmFamilyRead],['setRole',setRole],
  ['submitTeacherAlert',submitTeacherAlert],['submitCare',submitCare],
  ['setBodyArea',setBodyArea],
  ['expandTable',expandTable],['loadOlderFor',loadOlderFor],['openEditStudentModal',openEditStudentModal],
  ['archiveStudent',archiveStudent],['exportCareCSV',exportCareCSV],['exportStudentsCSV',exportStudentsCSV],
  ['openFichaModalById',openFichaModalById],['toggleArchivedStudents',toggleArchivedStudents],
  ['submitTeacherPane',submitTeacherPane],['resetTeacherForm',resetTeacherForm]
].forEach(([name,fn])=>{ if(typeof fn==='function') window[name]=window[name]||fn; });
