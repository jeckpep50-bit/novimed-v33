import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  initializeFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  runTransaction,
  writeBatch,
  increment,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

/* ✅ API Key rotada (V30). ✅ Security Rules publicadas (solo usuarios autenticados).
   ✅ Autenticación anónima implementada (V30.1) — la sincronización solo inicia con sesión válida.
   ⚠️ PENDIENTE (acción externa):
   1. Verificar que la clave anterior fue DESHABILITADA en Google Cloud Console → Credentials.
   2. Restringir esta clave por HTTP referrer al dominio de producción.
   3. Evolución futura: email/password con roles (médico, docente, familia, directivo). */
/* V40 — Configuración por entorno.
   Sin variables definidas usa producción (comportamiento idéntico al actual).
   Un sitio de staging solo necesita definir estas variables en Netlify:
   apunta al proyecto Firebase de pruebas sin modificar una línea de código. */
const env = import.meta.env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCnZE08xhYV5KHZfGDoHj1KMRn16hLEe18",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "novimed-2c5e9.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "novimed-2c5e9",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "novimed-2c5e9.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_SENDER_ID || "750799724381",
  appId: env.VITE_FIREBASE_APP_ID || "1:750799724381:web:638f41cb950a83a617d2b4",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-ZL3PW9N40F"
};
const ENV_NAME = env.VITE_NOVIMED_ENV || (firebaseConfig.projectId === "novimed-2c5e9" ? "producción" : "staging");
window.novimedEnvName = ENV_NAME;

const app = initializeApp(firebaseConfig);

/* ============================================================
   V40 — APP CHECK (reCAPTCHA v3)
   Las reglas controlan QUÉ puede hacer una sesión; App Check controla
   que la llamada provenga de esta app y no de un script externo.
   Diseño defensivo deliberado: sin clave configurada NO se inicializa
   y la app funciona exactamente como hoy. Un fallo de App Check nunca
   debe dejar sin servicio al personal de salud, así que su ausencia es
   un no-evento y su error se reporta sin bloquear el arranque.
   Rollout: monitor (sin aplicar) → verificar métricas → aplicar. */
const APPCHECK_SITE_KEY = env.VITE_APPCHECK_SITE_KEY || "";
window.novimedAppCheck = "no configurado";
if(APPCHECK_SITE_KEY){
  try{
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    window.novimedAppCheck = "activo";
  }catch(error){
    console.error("App Check no pudo inicializarse:", error);
    window.novimedAppCheck = "error (" + (error.code || "desconocido") + ")";
  }
}
/* V30.3 — Safari/iOS y redes institucionales cortan el canal WebChannel de Firestore:
   la lectura inicial funciona pero los push en vivo nunca llegan.
   Long polling es el transporte compatible recomendado por Firebase para estos entornos. */
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
let SCHOOL_ID = null; // V38: se resuelve por sesión (claims.schoolId) o modo demo
/* V38: el caso activo vive DENTRO del tenant */
const caseRef = () => doc(db, "schools", SCHOOL_ID, "meta", "active-case");

window.firebaseApp = app;
window.db = db;
window.novimedCaseRef = caseRef; /* referencia; se invoca solo con sesión activa */

/* ============================================================
   V31 — CAPA DE DATOS MULTI-COLECCIÓN (multi-tenant desde el día 1)
   schools/{SCHOOL_ID}/students | careRecords | inventory | inventoryLog | vaccines
   - Cada ficha, atención y movimiento es un documento permanente.
   - Los listeners en vivo mantienen el estado local sincronizado entre dispositivos.
   - Si la nube no está disponible, la app cae al modo local existente (sin pérdida de UX).
   ============================================================ */


const colRef = (name) => collection(db, "schools", SCHOOL_ID, name);
const seedRef = () => doc(db, "schools", SCHOOL_ID, "meta", "seed");

window.novimedCloudReady = false;

/* ============================================================
   V41 — AUTORÍA Y AUDITORÍA (C5)
   Ninguna escritura clínica tenía autor: un registro médico sin autor
   carece de valor probatorio. Toda escritura lleva ahora:
     createdBy   { uid, email, role }  — plano, seguro para JSON (cola offline)
     createdAt   epoch-ms               — ordenamiento estable (no cambiar: hay índices)
     serverCreatedAt / updatedAt        — serverTimestamp(), reloj de confianza
   El sentinel serverTimestamp() NO sobrevive a JSON.stringify, así que se
   aplica al EJECUTAR la operación, nunca al construir el payload que puede
   quedar encolado en localStorage.
   ============================================================ */
let IDENTITY = null;
function setIdentity(user, role, schoolId){
  IDENTITY = user ? {
    uid: user.uid,
    email: user.email || null,
    role: String(role || "Desconocido"),
    anonymous: !!user.isAnonymous,
    schoolId: schoolId || null
  } : null;
}
function authorStamp(){
  return IDENTITY
    ? { uid: IDENTITY.uid, email: IDENTITY.email, role: IDENTITY.role }
    : { uid: null, email: null, role: "Desconocido" };
}
window.novimedIdentity = () => IDENTITY;
const serverCreate = () => ({ serverCreatedAt: serverTimestamp() });
const serverUpdate = () => ({ updatedAt: serverTimestamp(), updatedBy: authorStamp() });
/* Atención vinculada al caso activo: sustituye al uso de careRecords[0]. */
let linkedCareRecordId = null;
window.novimedLinkedCareRecordId = () => linkedCareRecordId;

/* ============================================================
   V37 — COLA DE REINTENTOS OFFLINE (P5)
   Escrituras fallidas se encolan en localStorage y se reintentan
   con backoff (25s→60s→180s→300s, máx 6 intentos). La deduplicación
   usa clientOpId: el doc lleva el id de operación, y el merge de
   listeners descarta la copia local pendiente cuando el doc llega.
   Excluido por diseño: el caso activo y la alerta docente (estado
   de coordinación efímero; reproducirlo tarde induciría a error).
   ============================================================ */
const QUEUE_BASE_KEY = "novimed_pending_ops_v1";
const queueKey = () => QUEUE_BASE_KEY + "::" + (SCHOOL_ID || "boot");
const QUEUE_MAX_ATTEMPTS = 6;
const QUEUE_BACKOFF_MS = [25000, 60000, 180000, 300000];

function makeOpId(){ return "op_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9); }
window.novimedNewOpId = makeOpId;

function loadQueue(){
  try{
    const raw = localStorage.getItem(queueKey());
    const q = raw ? JSON.parse(raw) : [];
    return Array.isArray(q) ? q.filter(o => o && o.type && o.opId) : [];
  }catch(e){ return []; }
}
function saveQueue(q){
  try{ localStorage.setItem(queueKey(), JSON.stringify(q)); }catch(e){/* sin cuota: la cola vive en memoria */}
}
let pendingOps = [];
function loadTenantQueue(){ pendingOps = loadQueue(); abandonNotified = false; }
let abandonNotified = false;

function enqueueOp(type, payload, opId){
  if(pendingOps.some(o => o.opId === opId)) return;
  pendingOps.push({ type, payload, opId, attempts: 1, nextAt: Date.now() + QUEUE_BACKOFF_MS[0], status: "pending" });
  saveQueue(pendingOps);
}
window.novimedPendingOpsCount = () => pendingOps.filter(o => o.status !== "done").length;

const queueExecutors = {
  addStudent:      (p) => addDoc(colRef("students"), { ...p, ...serverCreate() }),
  addInventoryItem:(p) => addDoc(colRef("inventory"), { ...p, ...serverCreate() }),
  addCareRecord:   (p) => addDoc(colRef("careRecords"), { ...p, ...serverCreate() }),
  /* V41/A5 — antes: Promise.all de dos escrituras. Si el descuento aterrizaba
     y el log fallaba, el reintento descontaba stock por segunda vez.
     writeBatch la hace atómica: o ambas, o ninguna. */
  invUse:          (p) => {
                      const batch = writeBatch(db);
                      batch.update(doc(colRef("inventory"), p.itemId), { stock: increment(-1), ...serverUpdate() });
                      batch.set(doc(colRef("inventoryLog")), { ...p.logEntry, ...serverCreate() });
                      return batch.commit();
                    },
  updateStudent:   (p) => updateDoc(doc(colRef("students"), p.id), { ...p.data, ...serverUpdate() }),
  archiveStudent:  (p) => updateDoc(doc(colRef("students"), p.id), {
                      isArchived: true,
                      archivedReason: p.reason || "Sin motivo registrado",
                      archivedAt: Date.now(),
                      archivedBy: p.createdBy || authorStamp(),
                      ...serverUpdate()
                    }),
  /* V41 — El borrado en duro de una ficha clínica queda retirado del sistema.
     El tipo `deleteStudent` se conserva mapeado al archivado para que las
     operaciones encoladas por V40 en dispositivos ya desplegados drenen de
     forma segura en lugar de ejecutar la eliminación que ya no queremos. */
  deleteStudent:   (p) => updateDoc(doc(colRef("students"), p.id), {
                      isArchived: true,
                      archivedReason: p.reason || "Archivada al migrar una operación pendiente de V40",
                      archivedAt: Date.now(),
                      archivedBy: p.createdBy || authorStamp(),
                      ...serverUpdate()
                    }),
  confirmFamily:   (p) => updateDoc(doc(colRef("careRecords"), p.recordId), { family: "Confirmada", ...serverUpdate() })
};

function alreadyConverged(op){
  const st = window.novimedState;
  if(!st) return false;
  const cid = op.payload && op.payload.clientOpId;
  if(cid){
    const coll = op.type === "addStudent" ? st.students
               : op.type === "addInventoryItem" ? st.inventory
               : op.type === "addCareRecord" ? st.careRecords : null;
    if(coll && coll.some(x => x && x.id && x.clientOpId === cid)) return true;
  }
  if(op.type === "confirmFamily"){
    const r = (st.careRecords||[]).find(x => x && x.id === op.payload.recordId);
    if(r && r.family === "Confirmada") return true;
  }
  return false;
}
function isTerminalConvergence(err){
  /* Documento ya inexistente: el sistema convergió (p. ej. reintento de
     eliminación cuando otro dispositivo ya la aplicó). */
  return err && err.code === "not-found";
}
function stripLocalPendingByOpId(opId){
  const st = window.novimedState;
  if(!st) return;
  ["students","inventory","careRecords"].forEach(k => {
    if(Array.isArray(st[k])) st[k] = st[k].filter(x => !(x && x._pendingOpId === opId));
  });
}

let queueRunning = false;
async function processQueue(trigger, force){
  if(queueRunning) return;
  /* Barrido de convergencia: no requiere red ni sesión. Si la escritura
     original colgada terminó aplicándose (doc llegó con el mismo
     clientOpId), la operación se cierra sin duplicar. */
  let converged = false;
  pendingOps.forEach(op => {
    if(op.status === "pending" && alreadyConverged(op)){
      op.status = "done"; stripLocalPendingByOpId(op.opId); converged = true;
    }
  });
  if(converged){
    pendingOps = pendingOps.filter(o => o.status !== "done");
    saveQueue(pendingOps); safeRender();
  }
  /* Reintentos de red: automáticos solo con sesión; el forzado manual
     lo intenta igualmente y reporta el fallo con honestidad. */
  if(!auth.currentUser && !force) return;
  const now = Date.now();
  const due = pendingOps.filter(o => o.status === "pending" && (force || o.nextAt <= now));
  if(!due.length) return;
  queueRunning = true;
  for(const op of due){
    const exec = queueExecutors[op.type];
    if(!exec){ op.status = "done"; continue; }
    try{
      await withTimeout(exec(op.payload));
      op.status = "done";
      stripLocalPendingByOpId(op.opId);
      uiNotify("Sincronizado", "Un cambio pendiente se subió a la nube correctamente.");
    }catch(err){
      if(isTerminalConvergence(err)){ op.status = "done"; continue; }
      op.attempts += 1;
      if(op.attempts > QUEUE_MAX_ATTEMPTS){
        op.status = "abandoned";
        if(!abandonNotified){
          abandonNotified = true;
          uiNotify("Cambios sin sincronizar", "Algunos cambios no pudieron subirse tras varios intentos. Siguen en este dispositivo (panel Sistema).");
        }
      }else{
        op.nextAt = Date.now() + QUEUE_BACKOFF_MS[Math.min(op.attempts - 1, QUEUE_BACKOFF_MS.length - 1)];
      }
    }
  }
  pendingOps = pendingOps.filter(o => o.status !== "done");
  saveQueue(pendingOps);
  queueRunning = false;
  safeRender();
}
window.novimedProcessQueueNow = (force) => processQueue("manual", force === true);
window.novimedQueueSnapshot = () => pendingOps.map(o => ({ type: o.type, attempts: o.attempts, status: o.status }));
setInterval(() => processQueue("interval"), 25000);
window.addEventListener("online", () => processQueue("online"));


function stripUndefined(obj){
  const out = {};
  for(const k in obj){ if(obj[k] !== undefined) out[k] = obj[k]; }
  return out;
}

async function seedIfNeeded(){
  const s = window.novimedState;
  if(!s) return;
  if(SCHOOL_ID !== "eight-demo") return; /* V38: tenants reales nacen vacíos (P4) */
  const won = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seedRef());
    if(snap.exists()) return false;
    tx.set(seedRef(), { seededAt: Date.now(), version: 31 });
    return true;
  });
  if(!won) return;
  const base = Date.now();
  const batch = writeBatch(db);
  /* El autor de la siembra es la sesión que la ejecuta: un uid ficticio
     ("seed") sería rechazado por la regla createdBy.uid == request.auth.uid. */
  const seedAuthor = authorStamp();
  /* V41 — La siembra crea las fichas con refs explícitas para poder enlazar
     las claves foráneas de atenciones, vacunas e inventoryLog. La demo deja
     de depender de coincidencias por nombre. */
  const idByName = {};
  (s.students||[]).forEach((st,i)=>{
    const ref = doc(colRef("students"));
    idByName[st.fullName] = ref.id;
    batch.set(ref, stripUndefined({...st, createdAt: base + i, createdBy: seedAuthor}));
  });
  const fk = (name) => idByName[name] || null;
  (s.inventory||[]).forEach((it,i)=> batch.set(doc(colRef("inventory")), stripUndefined({...it, createdAt: base + i, createdBy: seedAuthor})));
  (s.vaccines||[]).forEach((v,i)=> batch.set(doc(colRef("vaccines")), stripUndefined({...v, studentId: fk(v.student), studentName: v.student, createdAt: base + i, createdBy: seedAuthor})));
  (s.careRecords||[]).forEach((r,i)=> batch.set(doc(colRef("careRecords")), stripUndefined({...r, studentId: fk(r.student), studentName: r.student, createdAt: base - i, createdBy: seedAuthor})));
  (s.inventoryHistory||[]).forEach((h,i)=> batch.set(doc(colRef("inventoryLog")), {time:h[0]||"",name:h[1]||"",qty:h[2]||"",studentId:fk(h[3]),studentName:h[3]||"",context:h[4]||"",createdAt: base - i, createdBy: seedAuthor}));
  await batch.commit();
}

/* V41 — El caso demo se sembraba con el NOMBRE de Sofía pero sin studentId,
   de modo que tras la migración a claves foráneas la demo mostraría
   correctamente "Sin ficha enlazada". Este enlace se repara una sola vez
   buscando la ficha sembrada. Solo aplica al tenant de ventas. */
let demoLinkAttempted = false;
async function linkDemoCaseOnce(){
  if(SCHOOL_ID !== "eight-demo" || demoLinkAttempted) return;
  demoLinkAttempted = true;
  try{
    const snap = await getDoc(caseRef());
    if(snap.exists() && snap.data().studentId) return;
    const qs = await getDocs(query(colRef("students"), orderBy("createdAt", "asc"), limit(50)));
    let match = null;
    qs.forEach(d => { const x = d.data(); if(!match && x && x.fullName === "Sofía Martínez") match = d.id; });
    if(match) await setDoc(caseRef(), { studentId: match }, { merge: true });
  }catch(err){ console.error("Enlace del caso demo:", err); }
}

const seedAlertsRef = () => doc(db, "schools", SCHOOL_ID, "meta", "seed-alerts");
async function seedAlertsIfNeeded(){
  if(SCHOOL_ID !== "eight-demo") return;
  const won = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seedAlertsRef());
    if(snap.exists()) return false;
    tx.set(seedAlertsRef(), { seededAt: Date.now(), version: 33 });
    return true;
  });
  if(!won) return;
  const base = Date.now();
  const batch = writeBatch(db);
  const ids = {};
  try{
    const qs = await getDocs(query(colRef("students"), orderBy("createdAt","asc"), limit(50)));
    qs.forEach(d => { const x = d.data(); if(x && x.fullName) ids[x.fullName] = d.id; });
  }catch(e){ console.error("FK de alertas demo:", e); }
  [
    {studentName:"Mateo Ruiz", location:"Aula 2A", symptoms:"Golpe leve en recreo", priority:"Media", status:"attended", timeLabel:"09:50"},
    {studentName:"Valentina Pérez", location:"Aula 1C", symptoms:"Dolor de cabeza", priority:"Baja", status:"family_confirmed", timeLabel:"08:41"}
  ].forEach((a,i)=> batch.set(doc(colRef("alerts")), {...a, studentId: ids[a.studentName] || null, createdAt: base - (i+1), createdBy: authorStamp()}));
  await batch.commit();
}

let liveUnsubs = [];
function teardownListeners(){
  liveUnsubs.forEach(u => { try{ u(); }catch(e){/* noop */} });
  liveUnsubs = [];
  Object.keys(oldestLive).forEach(k => delete oldestLive[k]);
  Object.keys(noMoreOlder).forEach(k => delete noMoreOlder[k]);
  liveMappers = {};
  syncStarted = false;
  window.novimedCloudReady = false;
}
/* ============================================================
   V39 — H2: VENTANAS EN VIVO ACOTADAS
   Sin límite, cada listener descargaba la colección completa: el costo
   de lecturas de Firestore y el trabajo de render crecían sin techo con
   el historial del colegio. Cada colección escucha ahora una ventana
   reciente; el histórico anterior se trae bajo demanda por cursor
   (loadOlder), sin listener adicional.
   students/inventory NO se acotan por diseño: son catálogos operativos
   de tamaño acotado (matrícula, botiquín) que la UI necesita completos
   para búsqueda, fichas y selectores de medicación.
   ============================================================ */
const LIVE_WINDOW = { careRecords: 200, alerts: 200, inventoryLog: 200, vaccines: 500 };
const PAGE_SIZE = 200;
const oldestLive = {};   /* último doc de la ventana viva, por colección */
const noMoreOlder = {};  /* colecciones cuyo histórico ya se agotó */
window.novimedHasOlder = (name) => !!oldestLive[name] && !noMoreOlder[name];

async function loadOlder(name){
  if(!SCHOOL_ID || !oldestLive[name] || noMoreOlder[name]) return 0;
  const st = window.novimedState;
  if(!st) return 0;
  const key = name === "inventoryLog" ? "inventoryHistory" : name;
  const mapper = liveMappers[name];
  if(!mapper) return 0;
  try{
    const qs = await getDocs(query(colRef(name), orderBy("createdAt", "desc"), startAfter(oldestLive[name]), limit(PAGE_SIZE)));
    if(qs.empty){ noMoreOlder[name] = true; safeRender(); return 0; }
    const older = [];
    qs.forEach(d => {
      try{ const item = mapper(d); if(item !== null && item !== undefined) older.push(item); }
      catch(e){ console.error("Doc inválido en histórico '"+name+"':", e); }
    });
    oldestLive[name] = qs.docs[qs.docs.length - 1];
    if(qs.size < PAGE_SIZE) noMoreOlder[name] = true;
    st[key] = [...(st[key] || []), ...older];
    safeRender();
    uiNotify("Histórico cargado", older.length + " registros anteriores añadidos a la vista.");
    return older.length;
  }catch(err){
    console.error("Histórico '"+name+"':", err);
    uiNotify("No se pudo cargar el histórico", (err.code || "error"));
    return 0;
  }
}
window.novimedLoadOlder = loadOlder;

let liveMappers = {};
function attachCollectionListeners(){
  const s = window.novimedState;
  if(!s) return;
  const bind = (name, order, map, mergeLocal) => {
    liveMappers[name] = map;
    const win = LIVE_WINDOW[name];
    const q = win
      ? query(colRef(name), orderBy("createdAt", order), limit(win))
      : query(colRef(name), orderBy("createdAt", order));
    liveUnsubs.push(onSnapshot(q, (qs) => {
      if(win && order === "desc" && qs.docs.length){
        oldestLive[name] = qs.docs[qs.docs.length - 1];
        if(qs.size < win) noMoreOlder[name] = true;
      }
      const arr = [];
      qs.forEach(d => {
        /* V37: un documento malformado jamás debe tumbar el render */
        try{
          const item = map(d);
          if(item !== null && item !== undefined) arr.push(item);
        }catch(e){ console.error("Doc inválido en '"+name+"' ("+d.id+"):", e); }
      });
      const key = name === "inventoryLog" ? "inventoryHistory" : name;
      if(mergeLocal){
        /* Conserva copias locales sin id, salvo que su operación ya llegó (clientOpId) */
        const arrived = new Set(arr.map(x => x && x.clientOpId).filter(Boolean));
        const pending = (s[key]||[]).filter(x => x && typeof x === "object" && !x.id && !(x._pendingOpId && arrived.has(x._pendingOpId)));
        s[key] = order === "desc" ? [...pending, ...arr] : [...arr, ...pending];
      }else{
        s[key] = arr;
      }
      safeRender();
    }, (error) => {
      console.error("Listener "+name+":", error);
      uiNotify("Sincronización parcial", "No se pudo escuchar '"+name+"' ("+(error.code||"error")+").");
    }));
  };
  const asObj = d => { const x = d.data(); return (x && typeof x === "object") ? { id: d.id, ...x } : null; };
  bind("students", "asc", d => { const o = asObj(d); if(o){ o.fullName = String(o.fullName || "Estudiante sin nombre"); o.isArchived = o.isArchived === true; } return o; }, true);
  bind("inventory", "asc", d => { const o = asObj(d); if(o){ o.name = String(o.name || "Ítem"); o.stock = Number.isFinite(Number(o.stock)) ? Number(o.stock) : 0; } return o; }, true);
  bind("vaccines", "asc", d => { const o = asObj(d); if(o){ o.studentName = o.studentName || o.student || "Sin especificar"; o.studentId = o.studentId || null; } return o; }, false);
  /* V41 — `student` (nombre suelto) sobrevive en documentos anteriores a la
     migración. Se normaliza en lectura a studentName para que la UI tenga un
     único campo de presentación, sin reescribir el histórico. */
  bind("careRecords", "desc", d => { const o = asObj(d); if(o){ o.studentName = o.studentName || o.student || "Sin especificar"; o.studentId = o.studentId || null; } return o; }, true);
  bind("inventoryLog", "desc", d => { const x = d.data() || {}; return { date:x.date||"", time:x.time||"", name:x.name||"", qty:x.qty||"", studentId:x.studentId||null, studentName:x.studentName||x.student||"", context:x.context||"" }; }, false);
  bind("alerts", "desc", d => ({ id: d.id, ...d.data() }), false);
}

/* API de nube para el script clásico. Todas devuelven una Promise;
   el script clásico decide el fallback local si fallan. */
function opTimeoutMs(){
  const v = Number(window.novimedCloudTimeoutMs);
  return Number.isFinite(v) && v > 0 ? v : 8000;
}
function withTimeout(promise){
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = new Error("timeout"); e.code = "op-timeout"; reject(e);
    }, opTimeoutMs());
    promise.then(v => { clearTimeout(timer); resolve(v); },
                 e => { clearTimeout(timer); reject(e); });
  });
}
function cloudOp(type, payload, opId){
  return withTimeout(queueExecutors[type](payload)).catch(err => {
    /* El dato SIEMPRE se conserva (se encola), pero un rechazo por reglas no
       se resuelve reintentando: reintentarlo 6 veces durante 10 minutos
       oculta el problema justo cuando hay que verlo. Se avisa de inmediato
       y con el nombre correcto de la causa. */
    enqueueOp(type, payload, opId || makeOpId());
    if(err && err.code === "permission-denied"){
      uiNotify("Permiso denegado por el servidor",
        "Las reglas de Firestore rechazaron esta operación (" + type + "). El dato quedó guardado en este dispositivo. Avisa al administrador: probablemente falte publicar las reglas de la versión actual.");
    }
    throw err;
  });
}
/* V41 — `authored()` es el único camino por el que un dato clínico llega a
   Firestore. No hay escritura sin autor: si algún día faltara, faltaría
   también en el documento y la regla del servidor debe rechazarla. */
function authored(payload, opId){
  return stripUndefined({
    ...payload,
    clientOpId: opId,
    /* ── DOS RELOJES, DOS HECHOS DISTINTOS ──────────────────────────────
       createdAt      : cuándo OCURRIÓ el hecho clínico (reloj del cliente).
                        Es JSON-safe, sobrevive a la cola offline y es el
                        campo por el que se ordena. El servidor NO debe
                        sobrescribirlo: una atención registrada sin red a
                        las 10:00 y sincronizada a las 14:00 ocurrió a las
                        10:00. Sobrescribirla corrompería la historia clínica.
       serverCreatedAt: cuándo lo RECIBIÓ el servidor (reloj de confianza).
                        Se aplica al ejecutar, nunca en el payload, porque
                        el sentinel serverTimestamp() no sobrevive a
                        JSON.stringify en localStorage.
       La diferencia entre ambos es, por definición, la latencia offline, y
       queda auditable. Las reglas exigen createdAt <= now + 5 min: se puede
       registrar en diferido, nunca en el futuro.
       ─────────────────────────────────────────────────────────────────── */
    createdAt: Date.now(),
    createdBy: authorStamp()
  });
}
window.novimedCloudAddStudent = (student, opId) =>
  cloudOp("addStudent", authored(student, opId), opId);
window.novimedCloudAddInventoryItem = (item, opId) =>
  cloudOp("addInventoryItem", authored(item, opId), opId);
window.novimedCloudAddCareRecord = (record, opId) =>
  cloudOp("addCareRecord", authored(record, opId), opId)
    .then(ref => { if(ref && ref.id) linkedCareRecordId = ref.id; return ref; });
window.novimedCloudUseInventory = (itemId, logEntry, opId) =>
  cloudOp("invUse", { itemId, logEntry: authored(logEntry, opId) }, opId);
window.novimedCloudConfirmFamily = (recordId, opId) =>
  cloudOp("confirmFamily", { recordId, createdBy: authorStamp() }, opId);
window.novimedCloudUpdateStudent = (id, data, opId) =>
  cloudOp("updateStudent", { id, data, createdBy: authorStamp() }, opId);
window.novimedCloudArchiveStudent = (id, reason, opId) =>
  cloudOp("archiveStudent", { id, reason, createdBy: authorStamp() }, opId);
/* Retirada explícita: cualquier llamada superviviente al borrado en duro
   se convierte en archivado en lugar de destruir evidencia clínica. */
window.novimedCloudDeleteStudent = (id, opId) =>
  window.novimedCloudArchiveStudent(id, "Solicitud de eliminación convertida en archivado", opId);


function currentTimeLabel(){
  return new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

let renderQueued=false;
function safeRender(){
  if(renderQueued) return;
  renderQueued=true;
  setTimeout(()=>{
    renderQueued=false;
    if(typeof window.novimedRenderAll === "function"){ window.novimedRenderAll(); }
  },0);
}

let currentAlertDocId = null;
function mapFirestoreToLocalState(data){
  if(data && data.alertId) currentAlertDocId = data.alertId;
  if(data && data.careRecordId) linkedCareRecordId = data.careRecordId;
  const s = window.novimedState;
  if(!s || !data) return;

  const isDemoTenant = SCHOOL_ID === "eight-demo";
  if(looksLikeDemoLeak(data)){ cleanDemoLeakOnce(); return; }
  const status = data.status || (isDemoTenant ? "alert_pending" : "idle");
  const idleReal = !isDemoTenant && (status === "idle" || !data.studentName);
  const studentName = data.studentName || (isDemoTenant ? "Sofía Martínez" : "Sin alertas activas");
  const location = data.location || (isDemoTenant ? "Aula 3B · 2° piso" : "El panel mostrará aquí la próxima alerta docente");
  const symptoms = data.symptoms || (isDemoTenant ? "Mareo, náuseas y dolor abdominal durante la clase." : "Todo en calma por ahora.");
  /* V41 — `allergy` sale del modelo del caso: era un valor copiado (y en el
     tenant demo, literal) que la UI mostraba como dato clínico verificado.
     Ahora la UI lo deriva de la ficha por studentId, o declara su ausencia. */
  s.currentAlert = {studentId:data.studentId || null, studentName, location, symptoms, alertTimeLabel:data.alertTimeLabel || (idleReal ? "" : "Ahora")};
  const familyRead = data.familyRead === true;
  const doctorNotified = data.doctorNotified === true;
  const careSaved = doctorNotified || status === "in_observation" || status === "attended" || status === "family_confirmed";

  s.alertSent = status !== "idle";
  s.careSaved = careSaved;
  s.familyRead = familyRead;

  const activities = [];

  if(status !== "idle"){
    activities.push([
      data.alertTimeLabel || "Ahora",
      "red",
      `Nueva alerta de ${studentName}`,
      location + " · docente reporta síntomas"
    ]);
  }

  if(doctorNotified || careSaved){
    activities.push([
      data.attentionTimeLabel || "Ahora",
      "blue",
      "Departamento médico notificado",
      "Andrés Sánchez recibió alerta y consultó la ficha médica"
    ]);
    activities.push([
      data.attentionTimeLabel || "Ahora",
      "green",
      "Ficha médica consultada",
      data.studentId ? "Antecedentes verificados en la ficha" : "Sin ficha enlazada — verificación manual"
    ]);
  }

  if(careSaved){
    activities.push([
      data.attentionTimeLabel || "Ahora",
      "green",
      "Atención registrada",
      data.careNote || "Observación médica guardada y familia notificada"
    ]);
    activities.push([
      data.attentionTimeLabel || "Ahora",
      "amber",
      "Familia notificada",
      familyRead ? "Ana Martínez confirmó lectura" : "Ana Martínez pendiente de lectura"
    ]);
  }

  if(familyRead){
    activities.push([
      data.familyReadTimeLabel || "Ahora",
      "amber",
      "Familia confirmó lectura",
      "Ana Martínez recibió la información"
    ]);
  }

  if(SCHOOL_ID !== "eight-demo"){
    if(activities.length === 0) activities.push(["Ahora","blue","Sistema listo","Esperando la primera alerta docente"]);
  }else if(activities.length === 0){
    activities.push(
      ["10:24","red",`Nueva alerta de ${studentName}`, location + " · docente reporta síntomas"],
      ["10:25","blue","Departamento médico notificado","Andrés Sánchez recibió alerta"],
      ["10:26","green","Ficha médica consultada","Alergia y contactos verificados"],
      ["10:27","amber","Familia notificada","Ana Martínez pendiente de lectura"]
    );
  }

  s.activities = activities;
}

function neutralCasePayload(){
  return {
    studentId: null,
    studentName: "",
    status: "idle",
    careRecordId: null,
    familyRead: false,
    doctorNotified: false,
    priority: "none",
    location: "",
    symptoms: "",
    updatedAt: serverTimestamp(),
    updatedBy: authorStamp()
  };
}
async function ensureCaseExists(){
  const payload = SCHOOL_ID === "eight-demo" ? {
    studentName: "Sofía Martínez",
    status: "alert_pending",
    familyRead: false,
    doctorNotified: false,
    priority: "high",
    location: "Aula 3B · 2° piso",
    symptoms: "Mareo, náuseas y dolor abdominal durante la clase.",
    updatedAt: serverTimestamp(),
    updatedBy: authorStamp()
  } : neutralCasePayload();
  await setDoc(caseRef(), payload, { merge: true });
}
/* V38a.1 — Descontaminación: si un tenant real quedó con el caso demo
   sembrado por la versión anterior, se neutraliza una sola vez. */
let demoLeakCleaned = false;
function looksLikeDemoLeak(data){
  return data && data.studentName === "Sofía Martínez"
      && data.location === "Aula 3B · 2° piso"
      && SCHOOL_ID && SCHOOL_ID !== "eight-demo";
}
function cleanDemoLeakOnce(){
  if(demoLeakCleaned) return;
  demoLeakCleaned = true;
  setDoc(caseRef(), neutralCasePayload(), { merge: false })
    .then(() => uiNotify("Panel restablecido","Se retiraron los datos de demostración de esta institución."))
    .catch(err => console.error("Limpieza de caso demo:", err));
}

/** @param {Object=} payload Payload ya validado (panel docente). Si se omite, se lee del modal. */
window.submitTeacherAlert = async function(payload){
  if(window.novimedCanWrite && !window.novimedCanWrite()){ uiNotify("Solo lectura","Tu rol (Consulta) permite revisar la información, no modificarla."); return; }
  const cloudSessionReady = !!SCHOOL_ID;
  /* V41 — Contrato único de payload: lo produce el panel docente o el modal.
     La alerta viaja con studentId; `allergy` no existe en el modelo: las
     alergias se derivan de la ficha en render, nunca se copian a la alerta. */
  const form = payload || (window.novimedReadAlertForm ? window.novimedReadAlertForm() : null);
  if(!form || !form.valid) { window.novimedSubmitTeacherAlertLocal?.(form); return; }

  window.novimedSubmitTeacherAlertLocal?.(form);
  if(!cloudSessionReady) return; /* sin sesión: solo local */

  try{
    const alertRef = await addDoc(colRef("alerts"), {
      studentId: form.studentId,
      studentName: form.studentName,
      studentUnlinked: !form.studentId,
      location: form.location,
      symptoms: form.symptoms,
      priority: "Alta",
      status: "pending",
      timeLabel: currentTimeLabel(),
      createdAt: Date.now(),
      createdBy: authorStamp(),
      ...serverCreate()
    });
    currentAlertDocId = alertRef.id;
    linkedCareRecordId = null;
    await setDoc(caseRef(), {
      studentId: form.studentId,
      studentName: form.studentName,
      status: "alert_pending",
      familyRead: false,
      doctorNotified: false,
      priority: "high",
      location: form.location,
      symptoms: form.symptoms,
      alertId: alertRef.id,
      careRecordId: null,
      alertTimeLabel: currentTimeLabel(),
      updatedAt: serverTimestamp(),
      updatedBy: authorStamp()
    }, { merge: true });
  }catch(error){
    console.error("Error al sincronizar alerta en Firebase. Se mantiene el registro local:", error);
    uiNotify("Alerta solo local","No se pudo enviar a Firestore ("+(error.code||"error")+"). Otros dispositivos no la verán.");
  }
};

window.submitCare = async function(){
  if(window.novimedCanWrite && !window.novimedCanWrite()){ uiNotify("Solo lectura","Tu rol (Consulta) permite revisar la información, no modificarla."); return; }
  const cloudSessionReady = !!SCHOOL_ID;
  const careStatus = document.getElementById("careStatus")?.value || "En observación";
  const eva = document.getElementById("careEva")?.value || "5 · Moderado";
  const careNote = document.getElementById("careObservations")?.value || document.getElementById("careActionDone")?.value || "Atención médica registrada y familia notificada.";
  let selectedStudentIndex = parseInt(document.getElementById("careStudent")?.value || window.novimedState?.selectedStudentIndex || 0, 10);
  if(!Number.isFinite(selectedStudentIndex) || selectedStudentIndex < 0) selectedStudentIndex = 0;
  const studentDoc = window.novimedState?.students?.[selectedStudentIndex] || null;
  const selectedStudent = studentDoc?.fullName || "Estudiante sin nombre";
  const selectedStudentId = studentDoc?.id || null;
  const bodyArea = document.getElementById("careBodyArea")?.value || "Sin especificar";
  const symptoms = document.getElementById("careSymptoms")?.value || "Sin especificar";
  const presumptiveDiagnosis = document.getElementById("carePresumptiveDiagnosis")?.value || "Sin especificar";
  const actionDone = document.getElementById("careActionDone")?.value || "Sin especificar";

  window.novimedSubmitCareLocal?.();
  if(!cloudSessionReady) return; /* sin sesión: solo local */

  try{
    await updateDoc(caseRef(), {
      status: "in_observation",
      doctorNotified: true,
      familyRead: false,
      studentId: selectedStudentId,
      studentName: selectedStudent,
      /* V41 — el caso enlaza la atención concreta: confirmFamilyRead deja de
         escribir sobre "el registro más reciente" y pasa a resolver por id. */
      careRecordId: linkedCareRecordId || null,
      updatedBy: authorStamp(),
      careStatus,
      eva,
      careNote,
      bodyArea,
      symptoms,
      presumptiveDiagnosis,
      actionDone,
      attentionTimeLabel: currentTimeLabel(),
      updatedAt: serverTimestamp()
    });
    const linkedAlert=(window.novimedState?.alerts||[]).find(a=>a&&a.id===currentAlertDocId);
    if(currentAlertDocId && (!linkedAlert || linkedAlert.status==="pending")){
      updateDoc(doc(colRef("alerts"), currentAlertDocId), {
        status: "attended",
        attendedAt: Date.now(),
        attendedTimeLabel: currentTimeLabel(),
        careRecordId: linkedCareRecordId || null,
        attendedBy: authorStamp(),
        ...serverUpdate()
      }).catch(err => console.error("Alerta→atendida:", err));
    }
  }catch(error){
    console.error("Error al sincronizar atención en Firebase. Se mantiene el registro local:", error);
  }
};

window.confirmFamilyRead = async function(){
  if(window.novimedCanWrite && !window.novimedCanWrite()){ uiNotify("Solo lectura","Tu rol (Consulta) permite revisar la información, no modificarla."); return; }
  const cloudSessionReady = !!SCHOOL_ID;
  window.novimedConfirmFamilyReadLocal?.();
  if(!cloudSessionReady) return; /* sin sesión: solo local */

  try{
    await updateDoc(caseRef(), {
      familyRead: true,
      status: "family_confirmed",
      familyReadTimeLabel: currentTimeLabel(),
      updatedAt: serverTimestamp(),
      updatedBy: authorStamp()
    });
    const linkedAlertFR=(window.novimedState?.alerts||[]).find(a=>a&&a.id===currentAlertDocId);
    if(currentAlertDocId && (!linkedAlertFR || linkedAlertFR.status!=="family_confirmed")){
      updateDoc(doc(colRef("alerts"), currentAlertDocId), {
        status: "family_confirmed",
        familyConfirmedAt: Date.now(),
        familyReadTimeLabel: currentTimeLabel(),
        familyConfirmedBy: authorStamp(),
        ...serverUpdate()
      }).catch(err => console.error("Alerta→cerrada:", err));
    }
  }catch(error){
    console.error("Error al sincronizar lectura familiar en Firebase. Se mantiene la confirmación local:", error);
  }
};

/* V30.1 — Autenticación anónima: las Security Rules exigen sesión válida.
   La sincronización en tiempo real solo se inicia tras autenticar.
   Si la autenticación falla, la app continúa en modo local (sin tiempo real). */
window.novimedSyncStatus = "Conectando…";
const auth = getAuth(app);
window.firebaseAuth = auth;

let syncStarted = false;
let firstSnapshotNotified = false;
function uiNotify(title, text){
  if(typeof window.novimedShowToast === "function"){ window.novimedShowToast(title, text); }
}
function startRealtimeSync(){
  if(syncStarted) return;
  syncStarted = true;
  liveUnsubs.push(onSnapshot(caseRef(), (snapshot) => {
    if(snapshot.exists()){
      mapFirestoreToLocalState(snapshot.data());
      safeRender();
      if(!firstSnapshotNotified){
        firstSnapshotNotified = true;
        uiNotify("Tiempo real activo","Conectado a Firestore. Este dispositivo recibirá alertas en vivo.");
        window.novimedSyncStatus = "Tiempo real activo";
      }
    }else{
      ensureCaseExists().catch(error => console.error("No se pudo crear el caso base:", error));
    }
  }, (error) => {
    console.error("Error de sincronización Firestore:", error);
    uiNotify("Sin tiempo real","Firestore rechazó la conexión ("+(error.code||"error")+"). La app funciona en modo local.");
    window.novimedSyncStatus = "Sin tiempo real ("+(error.code||"error")+")";
  }));
}

/* ============================================================
   V38a — CICLO DE SESIÓN
   - Sin arranque anónimo automático: la compuerta (authGate) ofrece
     login por email/contraseña o "Explorar demo" (anónimo).
   - Sesiones anónimas ya persistidas en dispositivos actuales se
     reanudan solas: cero corte de servicio en la transición.
   - Claims del token: role + schoolId. Cuenta email sin schoolId ⇒
     bloqueo seguro (denegación por defecto).
   ============================================================ */
const gateEl = () => document.getElementById("authGate");
function gateShow(){ const g = gateEl(); if(g) g.style.display = "flex"; }
function gateHide(){ const g = gateEl(); if(g) g.style.display = "none"; }
function gateError(msg){ const e = document.getElementById("authError"); if(e){ e.textContent = msg || ""; e.style.display = msg ? "block" : "none"; } }
function gateBusy(busy){
  const b = document.getElementById("authLoginBtn");
  const d = document.getElementById("authDemoBtn");
  if(b){ b.disabled = busy; b.textContent = busy ? "Ingresando…" : "Ingresar"; }
  if(d) d.disabled = busy;
}
function loginErrorText(code){
  switch(code){
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Correo o contraseña incorrectos.";
    case "auth/invalid-email": return "El correo no tiene un formato válido.";
    case "auth/too-many-requests": return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed": return "Sin conexión. Verifica tu red e inténtalo de nuevo.";
    case "auth/user-disabled": return "Esta cuenta fue deshabilitada. Contacta al administrador.";
    default: return "No se pudo iniciar sesión ("+(code||"error")+").";
  }
}
async function doEmailLogin(){
  const email = (document.getElementById("authEmail")?.value || "").trim();
  const pass = document.getElementById("authPass")?.value || "";
  gateError("");
  if(!email || !pass){ gateError("Escribe tu correo y contraseña."); return; }
  gateBusy(true);
  try{ await signInWithEmailAndPassword(auth, email, pass); }
  catch(err){ gateError(loginErrorText(err.code)); }
  finally{ gateBusy(false); }
}
function doDemoLogin(){
  gateError(""); gateBusy(true);
  signInAnonymously(auth).catch(err => gateError(loginErrorText(err.code))).finally(() => gateBusy(false));
}
(function wireGate(){
  const lb = document.getElementById("authLoginBtn");
  const db2 = document.getElementById("authDemoBtn");
  const pw = document.getElementById("authPass");
  if(lb) lb.addEventListener("click", doEmailLogin);
  if(db2) db2.addEventListener("click", doDemoLogin);
  if(pw) pw.addEventListener("keydown", e => { if(e.key === "Enter") doEmailLogin(); });
})();
window.novimedLogout = function(){
  signOut(auth).catch(err => uiNotify("No se pudo cerrar sesión", err.code || "error"));
};

let currentUid = null;
onAuthStateChanged(auth, async (user) => {
  if(!user){
    currentUid = null;
    SCHOOL_ID = null;
    setIdentity(null);
    linkedCareRecordId = null;
    teardownListeners();
    window.novimedSyncStatus = "Sesión cerrada";
    gateBusy(false); gateError("");
    gateShow();
    return;
  }
  if(user.uid === currentUid) return;
  teardownListeners();
  currentUid = user.uid;

  let claims = {};
  try{ claims = (await user.getIdTokenResult()).claims || {}; }
  catch(e){ console.error("No se pudieron leer los claims:", e); }

  if(!user.isAnonymous && !claims.schoolId){
    /* Denegación por defecto: cuenta real sin institución asignada */
    SCHOOL_ID = null;
    gateBusy(false);
    gateShow();
    gateError("Tu cuenta aún no tiene institución asignada. Contacta al administrador de Novimed.");
    return;
  }

  SCHOOL_ID = user.isAnonymous ? "eight-demo" : String(claims.schoolId);
  const role = user.isAnonymous ? "Demo" : String(claims.role || "Consulta");
  /* V41 — La identidad debe quedar fijada ANTES de que cualquier escritura
     pueda ocurrir: authorStamp() se lee en cada payload de nube. */
  setIdentity(user, role, SCHOOL_ID);
  window.novimedSchoolLabel = SCHOOL_ID;
  window.novimedSyncStatus = "Conectando…";

  loadTenantQueue();
  if(typeof window.novimedActivateTenant === "function"){
    window.novimedActivateTenant(SCHOOL_ID, { role, email: user.email || null, anonymous: user.isAnonymous });
  }
  gateError(""); gateBusy(false); gateHide();

  startRealtimeSync();
  seedIfNeeded()
    .catch(error => {
      console.error("Seed:", error);
      uiNotify("Aviso de datos","No se pudo verificar la siembra inicial ("+(error.code||"error")+").");
    })
    .then(() => seedAlertsIfNeeded())
    .catch(error => console.error("Seed alerts:", error))
    .finally(() => {
      attachCollectionListeners();
      linkDemoCaseOnce();
      window.novimedCloudReady = true;
    });
});

/* V30.3 — Red de seguridad: Safari suspende pestañas en segundo plano.
   Al recuperar visibilidad, se relee el caso por si algún push se perdió. */
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && auth.currentUser && SCHOOL_ID){
    getDoc(caseRef()).then((snapshot) => {
      if(snapshot.exists()){
        mapFirestoreToLocalState(snapshot.data());
        safeRender();
      }
    }).catch(() => {/* sin conexión momentánea: el listener seguirá intentando */});
  }
});
