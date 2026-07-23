const state={
  role:'medico',
  alertSent:false,
  careSaved:false,
  familyRead:false,
  selectedStudentIndex:0,
  currentAlert:{studentName:'Sofía Martínez',location:'Aula 3B · 2° piso',symptoms:'Mareo, náuseas y dolor abdominal durante la clase.',allergy:'Maní',alertTimeLabel:'10:24'},
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
const NOVIMED_VERSION='V37';
function el(id){return document.getElementById(id)}

/* V36 — Paginación de tablas (client-side, primera página de 15) */
const TABLE_PAGE_SIZE=15;
const tableExpanded={students:false,care:false,alerts:false};
function pagedRows(rows,key){
  if(tableExpanded[key]||rows.length<=TABLE_PAGE_SIZE) return {rows,extra:0};
  return {rows:rows.slice(0,TABLE_PAGE_SIZE),extra:rows.length-TABLE_PAGE_SIZE};
}
function expandTable(key){tableExpanded[key]=true;renderAll();}
function pagerRow(colspan,key,extra){
  return extra?`<tr><td colspan="${colspan}" style="text-align:center;padding:14px"><button type="button" class="btn secondary" onclick="expandTable('${key}')">Mostrar ${extra} más</button></td></tr>`:'';
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
    .concat((state.careRecords||[]).map(r=>[r.date,r.time,r.student,r.bodyArea,r.eva,r.symptoms,r.presumptiveDiagnosis,r.actionDone,r.medication,r.derivation,r.family]));
  downloadCSV('novimed_atenciones.csv',rows);
}
function exportStudentsCSV(){
  const rows=[['Nombre','Edad','Curso','Alergias','Condiciones crónicas','Medicación','Vacunación','Teléfono','Correo']]
    .concat((state.students||[]).map(s=>[s.fullName,s.age,s.course,s.allergies,s.chronic,s.medicines,s.vaccineStatus,s.phone,s.email]));
  downloadCSV('novimed_estudiantes.csv',rows);
}

/* V30 — Persistencia local: los registros creados en sesión sobreviven a recargas.
   Solo persiste colecciones de datos; el caso activo sigue sincronizado vía Firestore. */
const NOVIMED_STORAGE_KEY='novimed_local_state_v2';
const NOVIMED_LEGACY_KEY='novimed_local_state_v1';
const NOVIMED_SCHEMA=2;
const PERSISTED_KEYS=['students','inventory','inventoryHistory','careRecords','vaccines','riskProfiles'];
let persistTimer=null;
function persistState(){
  clearTimeout(persistTimer);
  persistTimer=setTimeout(persistStateNow,400);
}
function persistStateNow(){
  try{
    const data={};
    PERSISTED_KEYS.forEach(k=>{data[k]=state[k];});
    localStorage.setItem(NOVIMED_STORAGE_KEY,JSON.stringify({schema:NOVIMED_SCHEMA,savedAt:Date.now(),data}));
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
    const raw=localStorage.getItem(NOVIMED_STORAGE_KEY);
    if(raw){
      const env=JSON.parse(raw);
      if(env&&env.schema===NOVIMED_SCHEMA&&env.data&&typeof env.data==='object'){
        applyRestoredData(env.data);
        return;
      }
      /* Esquema desconocido o envoltura corrupta: descartar de forma segura */
      localStorage.removeItem(NOVIMED_STORAGE_KEY);
    }
    /* Migración única desde el formato v1 (sin envoltura) */
    const legacy=localStorage.getItem(NOVIMED_LEGACY_KEY);
    if(legacy){
      const oldData=JSON.parse(legacy);
      applyRestoredData(oldData);
      localStorage.removeItem(NOVIMED_LEGACY_KEY);
      persistStateNow();
    }
  }catch(e){
    try{localStorage.removeItem(NOVIMED_STORAGE_KEY);localStorage.removeItem(NOVIMED_LEGACY_KEY);}catch(_){/* noop */}
  }
}
restoreState();
function showToast(t,txt){el('toastTitle').textContent=t;el('toastText').textContent=txt;el('toast').classList.add('show');setTimeout(()=>el('toast').classList.remove('show'),2800)}
function activeAlert(){return state.currentAlert||{studentName:'Sofía Martínez',location:'Aula 3B · 2° piso',symptoms:'Mareo, náuseas y dolor abdominal durante la clase.',allergy:'Maní',alertTimeLabel:'10:24'}}
function showPage(page){const targetPage=el('page-'+page);if(!targetPage)return;document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));targetPage.classList.add('active');document.querySelectorAll('.nav button').forEach(b=>{const isActive=b.dataset.page===page;b.classList.toggle('active',isActive);if(isActive){b.setAttribute('aria-current','page')}else{b.removeAttribute('aria-current')}});const titles={inicio:['Centro de bienestar institucional','Respuesta médica escolar, familias conectadas y trazabilidad en tiempo real.'],roles:['Roles funcionales','Docente, médico, familia y directivo conectados.'],alertas:['Centro de alertas','Priorización de emergencias escolares.'],estudiantes:['Estudiantes','Fichas médicas y antecedentes relevantes.'],atenciones:['Registro médico escolar','Atenciones clínicas escolares documentadas.'],riesgo:['Priorización de riesgo','Priorización operativa basada en alertas, antecedentes y seguimiento.'],vacunas:['Control de vacunas','Registro y seguimiento según esquema nacional MSP.'],familias:['Familias','Notificaciones y confirmaciones de lectura.'],reportes:['Reportes','Indicadores para decisiones directivas.'],inventario:['Medicamentos disponibles','Stock, caducidad, reposición e historial de uso.'],config:['Configuración','Roles, notificaciones y catálogos clínicos.']};const t=titles[page]||['Novimed','Centro de bienestar institucional.'];el('pageTitle').textContent=t[0];el('pageSub').textContent=t[1];renderAll()}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function setRole(role){state.role=role;const d=roleData[role];el('sidebarAvatar').textContent=d[0];el('sidebarName').textContent=d[1];el('sidebarRole').textContent=d[2];document.querySelectorAll('.role-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===role));document.querySelectorAll('.role-dashboard').forEach(x=>x.classList.remove('active'));const pane=el('role-'+role);if(pane)pane.classList.add('active');showToast('Vista cambiada',d[1]+' ahora está usando Novimed.');renderAll()}
document.querySelectorAll('.role-btn').forEach(b=>b.onclick=()=>setRole(b.dataset.role));
const DOT_COLORS={red:'red',blue:'blue',green:'green',amber:'amber'};
function renderFeed(){el('activityFeed').innerHTML=state.activities.map(a=>`<div class="event"><time>${escapeHtml(a[0])}</time><div><span class="dot" style="display:block;background:var(--${DOT_COLORS[a[1]]||'blue'})"></span></div><div><b>${escapeHtml(a[2])}</b><p>${escapeHtml(a[3])}</p></div></div>`).join('')}
function alertStatusLabel(st){return st==='pending'?'Pendiente':(st==='attended'?'Atendida':(st==='family_confirmed'?'Cerrada':(st||'—')))}
function renderAlerts(){
  let rows;
  if(Array.isArray(state.alerts)){
    rows=state.alerts.map(a=>[a.timeLabel||'—',a.studentName||'Estudiante sin nombre',a.priority||'Alta',alertStatusLabel(a.status)]);
    if(!rows.length)rows=[['—','Sin alertas registradas','—','—']];
  }else{
    const c=activeAlert();
    rows=[[c.alertTimeLabel||'Ahora',c.studentName||'Estudiante sin nombre','Alta',state.careSaved?'Atendida':'Pendiente'],['09:50','Mateo Ruiz','Media','En seguimiento'],['08:41','Valentina Pérez','Baja','Cerrada']];
  }
  const alertRows=rows.map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td>${escapeHtml(r[3])}</td><td><button type="button" class="btn secondary" onclick="openFichaModal()">Revisar</button></td></tr>`);
  const alertPg=pagedRows(alertRows,'alerts');
  el('alertsTable').innerHTML='<tr><th scope="col">Hora</th><th scope="col">Estudiante</th><th scope="col">Prioridad</th><th scope="col">Estado</th><th scope="col">Acción</th></tr>'+alertPg.rows.join('')+pagerRow(5,'alerts',alertPg.extra)}
function renderCare(){
  const rows=(state.careRecords||[]).map(r=>`<tr><td>${escapeHtml(r.date||'Sin registrar')}</td><td>${escapeHtml(r.time||'Sin registrar')}</td><td>${escapeHtml(r.student||'Sin especificar')}</td><td>${escapeHtml(r.bodyArea||'Sin especificar')}</td><td>${escapeHtml(r.eva||'Sin especificar')}</td><td>${escapeHtml(r.symptoms||'Sin especificar')}</td><td>${escapeHtml(r.presumptiveDiagnosis||'Sin especificar')}</td><td>${escapeHtml(r.actionDone||'Sin especificar')}</td><td>${escapeHtml(r.medication||'Sin especificar')}</td><td>${escapeHtml(r.derivation||'Sin especificar')}</td><td>${escapeHtml(r.family||'Pendiente')}</td></tr>`).join('');
  const careAll=(state.careRecords||[]).length?rows.split('</tr>').filter(x=>x.trim()).map(x=>x+'</tr>'):[];
  const carePg=pagedRows(careAll,'care');
  el('careTable').innerHTML='<tr><th scope="col">Fecha</th><th scope="col">Hora</th><th scope="col">Estudiante</th><th scope="col">Área</th><th scope="col">EVA</th><th scope="col">Síntomas</th><th scope="col">Diagnóstico presuntivo</th><th scope="col">Acción realizada</th><th scope="col">Medicamento</th><th scope="col">Derivación</th><th scope="col">Familia</th></tr>'
    +(careAll.length?carePg.rows.join('')+pagerRow(11,'care',carePg.extra):emptyRow(11,'Sin atenciones registradas todavía.'));
}
function renderFamily(){const status=state.familyRead?'Confirmación recibida':'Pendiente de lectura';el('familyNotices').innerHTML=`<div class="flow-step"><div class="flow-num">1</div><div><b>Ana Martínez</b><p>Sofía fue atendida por mareo y dolor abdominal. Estado: en observación.</p><div class="chipline" style="margin-top:8px"><span class="chip ${state.familyRead?'green':'red'}">${status}</span></div></div></div><div class="actions" style="margin-top:14px"><button type="button" class="btn primary" onclick="confirmFamilyRead()">Simular confirmación familiar</button></div>`;el('phoneScreen').innerHTML=`<div class="screen-top"><div><h4>Novimed</h4><span class="mini">App para familias</span></div><span class="mini">9:41</span></div><div class="parent-card"><b>Hola, Ana</b><span>Madre de Sofía Martínez</span></div><div class="notif-mobile"><b>Atención en enfermería</b><p>Sofía fue atendida por mareo y dolor abdominal. Estado actual: en observación.</p></div><div class="confirm"><b>${state.familyRead?'Confirmación enviada':'Confirmación pendiente'}</b><p>${state.familyRead?'La institución ya registró tu lectura.':'Presiona confirmar para registrar que recibiste la información.'}</p></div><button type="button" class="btn primary" style="width:100%;margin-top:14px" onclick="confirmFamilyRead()">Confirmar lectura</button><div class="bottom-nav"><span>Inicio</span><span>Alertas</span><span>Historial</span></div>`}



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
function renderStudents(){
  const table=el('studentsTable');
  if(!table) return;
  const all=state.students.map((s,index)=>`<tr><td>${escapeHtml(valueOrDash(s.fullName))}<br><span style="color:#71819b;font-size:12px">${escapeHtml(valueOrDash(s.age))}</span></td><td>${escapeHtml(valueOrDash(s.course))}</td><td>${escapeHtml(conditionSummary(s))}</td><td>${escapeHtml(valueOrDash(s.vaccineStatus))}</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn secondary" onclick="openFichaModal(${index})">Ver ficha</button><button type="button" class="btn secondary" onclick="openEditStudentModal(${index})">Editar</button><button type="button" class="btn secondary" onclick="deleteStudent(${index})">Eliminar</button></div></td></tr>`);
  const pg=pagedRows(all,'students');
  table.innerHTML='<tr><th scope="col">Estudiante</th><th scope="col">Curso</th><th scope="col">Condición registrada</th><th scope="col">Vacunación</th><th scope="col">Acción</th></tr>'
    +(all.length?pg.rows.join('')+pagerRow(5,'students',pg.extra):emptyRow(5,'Aún no hay estudiantes registrados. Crea la primera ficha con el botón superior.'));
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
  const s=state.students[index];
  if(!s){showToast('Ficha no encontrada','El registro ya no está disponible.');return;}
  openStudentModal();
  state.editingStudentIndex=index;
  fillStudentForm(s);
  const t=el('studentModalTitle');if(t)t.textContent='Editar ficha médica estudiantil';
}
function deleteStudent(index){
  const s=state.students[index];
  if(!s)return;
  const name=s.fullName||'este estudiante';
  if(!window.confirm('¿Eliminar la ficha de '+name+'? Sus atenciones históricas se conservarán en el registro clínico.'))return;
  if(window.novimedCloudReady && s.id && window.novimedCloudDeleteStudent){
    window.novimedCloudDeleteStudent(s.id).catch(err=>{
      console.error('Eliminación a nube:',err);
      showToast('Aviso','La nube rechazó la eliminación ('+(err.code||'error')+'). Puede reaparecer al sincronizar.');
    });
  }
  state.students.splice(index,1);
  if(state.selectedStudentIndex>=state.students.length)state.selectedStudentIndex=0;
  showToast('Ficha eliminada','La ficha de '+name+' fue eliminada. Atenciones históricas conservadas.');
  renderAll();
}
function openStudentModal(){
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
  history.innerHTML=state.inventoryHistory.map(h=>`<div class="flow-step"><div class="flow-num">${escapeHtml(h[0])}</div><div><b>${escapeHtml(h[1])} · ${escapeHtml(h[2])}</b><p>${escapeHtml(h[3])} — ${escapeHtml(h[4])}</p></div></div>`).join('');
}
function registerInventoryUse(index, contextStudent='Registro interno', contextReason='Uso documentado desde inventario', notify=true){
  const item=state.inventory[index];
  if(!item || item.stock<=0) return false;
  const stamp=formatDateTime24();
  const logEntry={time:stamp.time,name:item.name,qty:'1 unidad',student:contextStudent,context:contextReason};
  if(window.novimedCloudReady && item.id && window.novimedCloudUseInventory){
    window.novimedCloudUseInventory(item.id, logEntry).catch(err=>{
      console.error('Uso de inventario a nube:',err);
      showToast('Registro local','El movimiento no llegó a la nube ('+(err.code||'error')+').');
      item.stock-=1;
      state.inventoryHistory.unshift([logEntry.time,logEntry.name,logEntry.qty,logEntry.student,logEntry.context]);
      renderInventory();
    });
  }else{
    item.stock-=1;
    state.inventoryHistory.unshift([logEntry.time,logEntry.name,logEntry.qty,logEntry.student,logEntry.context]);
  }
  if(notify){
    showSuccess('Uso registrado','El stock fue actualizado y el movimiento quedó en el historial.');
  }
  renderInventory();
  return true;
}
function openMedicineModal(){
  ['newMedicineName','newMedicineCategory','newMedicineStock','newMedicineMin','newMedicineExpires'].forEach(id=>{const node=el(id); if(node) node.value='';});
  openModal('medicineModal');
}
function saveMedicineToInventory(){
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
function renderRoles(){el('role-medico').innerHTML=`<div class="grid"><article class="card"><div class="role-title"><div class="avatar">MG</div><div><h3>Panel médico de atención</h3><p>Desde aquí se consulta Ficha Médica, Registra Atención, Revisa Riesgo, Vacunas e Inventario.</p></div></div><div class="actions"><button type="button" class="btn secondary" onclick="openFichaModal()">Ver ficha médica</button><button type="button" class="btn primary" onclick="openAttentionModal()">Registrar atención</button><button type="button" class="btn secondary" onclick="showPage('riesgo')">Revisar riesgo</button><button type="button" class="btn secondary" onclick="showPage('vacunas')">Control de vacunas</button><button type="button" class="btn secondary" onclick="showPage('inventario')">Medicamentos disponibles</button></div></article><article class="card"><div class="section-head"><h3>Flujo clínico</h3><span class="badge green">Activo</span></div><div class="feed">${state.activities.map(a=>`<div class="event"><time>${escapeHtml(a[0])}</time><div><span class="dot" style="display:block;background:var(--${DOT_COLORS[a[1]]||'blue'})"></span></div><div><b>${escapeHtml(a[2])}</b><p>${escapeHtml(a[3])}</p></div></div>`).join('')}</div></article></div>`;
el('role-docente').innerHTML=`<div class="grid"><article class="card"><div class="role-title"><div class="avatar">LC</div><div><h3>Vista docente</h3><p>Registra un incidente desde el aula sin perder tiempo.</p></div></div><div class="field"><label for="roleDocenteStudent">Estudiante</label><input id="roleDocenteStudent" value="Sofía Martínez"></div><div class="field"><label for="roleDocenteSymptoms">Síntomas observados</label><textarea id="roleDocenteSymptoms">Mareo, náuseas y dolor abdominal durante la clase.</textarea></div><button type="button" class="btn primary" onclick="openReportModal()">Reportar emergencia</button></article><article class="card"><h3>Estado de alerta</h3><br><p style="color:#71819b">Al reportar la emergencia, el departamento médico recibirá la notificación y el caso pasará al centro de alertas.</p></article></div>`;
el('role-familia').innerHTML=`<div class="grid"><article class="card"><div class="role-title"><div class="avatar">AM</div><div><h3>Vista familia</h3><p>Recibe información clara y confirma lectura.</p></div></div><div id="familyRoleBox"></div></article><article class="card"><div class="phone"><div class="screen" id="phoneScreenRole"></div></div></article></div>`;el('familyRoleBox').innerHTML=el('familyNotices')?el('familyNotices').innerHTML:'';el('phoneScreenRole').innerHTML=el('phoneScreen')?el('phoneScreen').innerHTML:'';
el('role-directivo').innerHTML=`<div class="kpis"><div class="kpi"><small>Atenciones hoy</small><strong>${careCountToday()}</strong><em class="green">documentadas</em></div><div class="kpi"><small>Lectura familiar</small><strong class="green">${state.familyRead?'96%':'94%'}</strong><em>actualizado</em></div><div class="kpi"><small>Casos críticos</small><strong class="red">2</strong><em class="red">seguimiento</em></div><div class="kpi"><small>Respuesta</small><strong>2m 34s</strong><em class="green">mejorando</em></div></div><div class="card"><h3>Trazabilidad del caso Sofía Martínez</h3><br><table class="table"><tr><th>Momento</th><th>Acción</th><th>Responsable</th></tr><tr><td>10:24</td><td>Alerta reportada</td><td>Docente</td></tr><tr><td>10:25</td><td>Ficha consultada</td><td>Departamento médico</td></tr><tr><td>10:27</td><td>Familia notificada</td><td>Novimed</td></tr><tr><td>10:29</td><td>${state.familyRead?'Lectura confirmada':'Lectura pendiente'}</td><td>Familia</td></tr></table></div>`}

function populateAttentionOptions(){
  const studentSelect=el('careStudent');
  if(studentSelect){
    studentSelect.innerHTML=(state.students||[]).map((s,i)=>`<option value="${i}" ${i===state.selectedStudentIndex?'selected':''}>${escapeHtml(s.fullName||'Estudiante sin nombre')}</option>`).join('');
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
    const times=alerts.filter(a=>a&&Number.isFinite(a.attendedAt)&&Number.isFinite(a.createdAt)&&a.attendedAt>a.createdAt).map(a=>a.attendedAt-a.createdAt);
    if(times.length){
      const avg=times.reduce((x,y)=>x+y,0)/times.length;
      el('reportAvg').textContent=formatDuration(avg);
      el('reportAvgSub').textContent=times.length===1?'1 caso medido':times.length+' casos medidos';
    }else{
      el('reportAvg').textContent='—';
      el('reportAvgSub').textContent='aún sin mediciones';
    }
    const cnt=p=>alerts.filter(a=>a&&(a.priority||'Alta')===p).length;
    el('reportPrioLine').innerHTML=`<span class="chip red">Alta ${cnt('Alta')}</span><span class="chip amber">Media ${cnt('Media')}</span><span class="chip green">Baja ${cnt('Baja')}</span>`;
  }
  const pct=familyReadPct();
  el('reportRead').textContent=pct===null?(state.familyRead?'96%':'94%'):pct+'%';
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
  const ct=el('configCounts');if(ct)ct.textContent=(state.students||[]).length+' estudiantes · '+(state.careRecords||[]).length+' atenciones · '+((state.alerts&&state.alerts.length)||0)+' alertas · '+(state.inventory||[]).length+' ítems de inventario';
}
function renderAll(){
  if(state.activities.length>100)state.activities=state.activities.slice(-100);renderFeed();renderAlerts();renderCare();renderFamily();renderStudents();renderVaccines();renderInventory();renderRisk();renderRoles();const c=activeAlert();if(el('mainStudentName'))el('mainStudentName').textContent=c.studentName;if(el('mainStudentAvatar'))el('mainStudentAvatar').textContent=getInitials(c.studentName);if(el('mainStudentMeta'))el('mainStudentMeta').textContent=c.location;if(el('mainSymptoms'))el('mainSymptoms').textContent=c.symptoms;if(Array.isArray(state.alerts)){const pend=state.alerts.filter(a=>a&&a.status==='pending').length;el('kpiAlerts').textContent=String(pend);const sub=el('kpiAlertsSub');if(sub){sub.textContent=pend===0?'sin pendientes':(pend===1?'1 requiere atención':pend+' requieren atención');sub.className=pend===0?'green':'red';}}else{el('kpiAlerts').textContent=state.careSaved?'2':'3';}el('kpiCare').textContent=careCountToday();const _frp=familyReadPct();el('kpiFamily').textContent=_frp===null?(state.familyRead?'96%':'94%'):_frp+'%';renderReports();el('mainBadge').textContent=state.careSaved?'En seguimiento':'Acción requerida';el('mainBadge').className='badge '+(state.careSaved?'green':'red');renderSystemInfo();persistState()}
let lastFocusedBeforeModal=null;
function openModal(id){const m=el(id);if(!m)return;lastFocusedBeforeModal=document.activeElement;m.classList.add('open');const box=m.querySelector('.modal-box');if(box){box.setAttribute('tabindex','-1');box.focus({preventScroll:true});}}
function closeModal(id){const m=el(id);if(!m)return;m.classList.remove('open');if(lastFocusedBeforeModal&&typeof lastFocusedBeforeModal.focus==='function'){lastFocusedBeforeModal.focus({preventScroll:true});lastFocusedBeforeModal=null;}}function openReportModal(){openModal('reportModal')}function openFichaModal(index=0){if(!state.students.length){showToast('Sin fichas','Aún no hay estudiantes registrados. Crea una ficha desde el módulo Estudiantes.');return;}if(!Number.isFinite(index)||index<0||index>=state.students.length)index=0;state.selectedStudentIndex=index;renderFicha(state.students[index]);openModal('fichaModal')}function openAttentionModal(){closeModal('fichaModal');populateAttentionOptions();clearAttentionForm();openModal('attentionModal')}
function submitTeacherAlert(){const student=(el('reportStudent')?.value||'Estudiante sin nombre').trim();const location=(el('reportRoom')?.value||'Ubicación sin registrar').trim();const symptoms=(el('reportSymptoms')?.value||'Síntomas sin especificar').trim();state.currentAlert={studentName:student,location,symptoms,allergy:'Maní',alertTimeLabel:'Ahora'};state.alertSent=true;state.activities.unshift(['Ahora','red',`Nueva alerta de ${student}`,`${location} · docente reporta síntomas`]);closeModal('reportModal');showSuccess('Alerta enviada','El departamento médico recibió la notificación en tiempo real.');renderAll();showPage('alertas')}
function submitCare(){
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
    student:selectedStudent?.fullName || 'Estudiante sin nombre',
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
    registerInventoryUse(medicationInventoryIndex,record.student,'Administrado en atención médica',false);
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
  state.activities.push([stamp.time,'green','Atención registrada',`${record.student} · ${record.eva} · ${record.bodyArea}`]);
  closeModal('attentionModal');
  showSuccess('Atención registrada','La atención médica quedó documentada y la familia fue notificada.');
  renderAll();
  showPage('atenciones');
}
function confirmFamilyRead(){
  state.familyRead=true;
  const latest=(state.careRecords||[])[0];
  if(latest){
    latest.family='Confirmada';
    if(window.novimedCloudReady && latest.id && window.novimedCloudConfirmFamily){
      window.novimedCloudConfirmFamily(latest.id).catch(err=>console.error('Confirmación a nube:',err));
    }
  }
  state.activities.push(['Ahora','amber','Familia confirmó lectura','Ana Martínez recibió la información']);
  showSuccess('Lectura confirmada','La confirmación familiar quedó registrada en trazabilidad.');
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
    const care=(state.careRecords||[]).find(r=>normalizeText(r.student).includes(q)||normalizeText(r.symptoms).includes(q));
    if(care){showToast('Atención registrada',`${care.student} · ${care.date} ${care.time}`);}
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
  ['expandTable',expandTable],['openEditStudentModal',openEditStudentModal],
  ['deleteStudent',deleteStudent],['exportCareCSV',exportCareCSV],['exportStudentsCSV',exportStudentsCSV]
].forEach(([name,fn])=>{ if(typeof fn==='function') window[name]=window[name]||fn; });
