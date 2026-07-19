import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  addDoc,
  query,
  orderBy,
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
  onAuthStateChanged
} from "firebase/auth";

/* ✅ API Key rotada (V30). ✅ Security Rules publicadas (solo usuarios autenticados).
   ✅ Autenticación anónima implementada (V30.1) — la sincronización solo inicia con sesión válida.
   ⚠️ PENDIENTE (acción externa):
   1. Verificar que la clave anterior fue DESHABILITADA en Google Cloud Console → Credentials.
   2. Restringir esta clave por HTTP referrer al dominio de producción.
   3. Evolución futura: email/password con roles (médico, docente, familia, directivo). */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCnZE08xhYV5KHZfGDoHj1KMRn16hLEe18",
  authDomain: "novimed-2c5e9.firebaseapp.com",
  projectId: "novimed-2c5e9",
  storageBucket: "novimed-2c5e9.firebasestorage.app",
  messagingSenderId: "750799724381",
  appId: "1:750799724381:web:638f41cb950a83a617d2b4",
  measurementId: "G-ZL3PW9N40F"
};

const app = initializeApp(firebaseConfig);
/* V30.3 — Safari/iOS y redes institucionales cortan el canal WebChannel de Firestore:
   la lectura inicial funciona pero los push en vivo nunca llegan.
   Long polling es el transporte compatible recomendado por Firebase para estos entornos. */
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const caseRef = doc(db, "cases", "active-alert");

window.firebaseApp = app;
window.db = db;
window.novimedCaseRef = caseRef;

/* ============================================================
   V31 — CAPA DE DATOS MULTI-COLECCIÓN (multi-tenant desde el día 1)
   schools/{SCHOOL_ID}/students | careRecords | inventory | inventoryLog | vaccines
   - Cada ficha, atención y movimiento es un documento permanente.
   - Los listeners en vivo mantienen el estado local sincronizado entre dispositivos.
   - Si la nube no está disponible, la app cae al modo local existente (sin pérdida de UX).
   ============================================================ */
const SCHOOL_ID = "eight-demo"; // ← raíz multi-tenant; en SaaS real vendrá de la cuenta institucional

const colRef = (name) => collection(db, "schools", SCHOOL_ID, name);
const seedRef = doc(db, "schools", SCHOOL_ID, "meta", "seed");

window.novimedCloudReady = false;

function stripUndefined(obj){
  const out = {};
  for(const k in obj){ if(obj[k] !== undefined) out[k] = obj[k]; }
  return out;
}

async function seedIfNeeded(){
  const s = window.novimedState;
  if(!s) return;
  const won = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seedRef);
    if(snap.exists()) return false;
    tx.set(seedRef, { seededAt: Date.now(), version: 31 });
    return true;
  });
  if(!won) return;
  const base = Date.now();
  const batch = writeBatch(db);
  (s.students||[]).forEach((st,i)=> batch.set(doc(colRef("students")), stripUndefined({...st, createdAt: base + i})));
  (s.inventory||[]).forEach((it,i)=> batch.set(doc(colRef("inventory")), stripUndefined({...it, createdAt: base + i})));
  (s.vaccines||[]).forEach((v,i)=> batch.set(doc(colRef("vaccines")), stripUndefined({...v, createdAt: base + i})));
  (s.careRecords||[]).forEach((r,i)=> batch.set(doc(colRef("careRecords")), stripUndefined({...r, createdAt: base - i})));
  (s.inventoryHistory||[]).forEach((h,i)=> batch.set(doc(colRef("inventoryLog")), {time:h[0]||"",name:h[1]||"",qty:h[2]||"",student:h[3]||"",context:h[4]||"",createdAt: base - i}));
  await batch.commit();
  console.log("Novimed: datos base sembrados en Firestore para", SCHOOL_ID);
}

const seedAlertsRef = doc(db, "schools", SCHOOL_ID, "meta", "seed-alerts");
async function seedAlertsIfNeeded(){
  const won = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seedAlertsRef);
    if(snap.exists()) return false;
    tx.set(seedAlertsRef, { seededAt: Date.now(), version: 33 });
    return true;
  });
  if(!won) return;
  const base = Date.now();
  const batch = writeBatch(db);
  [
    {studentName:"Mateo Ruiz", location:"Aula 2A", symptoms:"Golpe leve en recreo", priority:"Media", status:"attended", timeLabel:"09:50"},
    {studentName:"Valentina Pérez", location:"Aula 1C", symptoms:"Dolor de cabeza", priority:"Baja", status:"family_confirmed", timeLabel:"08:41"}
  ].forEach((a,i)=> batch.set(doc(colRef("alerts")), {...a, createdAt: base - (i+1)}));
  await batch.commit();
}

function attachCollectionListeners(){
  const s = window.novimedState;
  if(!s) return;
  const bind = (name, order, map, mergeLocal) => {
    onSnapshot(query(colRef(name), orderBy("createdAt", order)), (qs) => {
      const arr = [];
      qs.forEach(d => arr.push(map(d)));
      const key = name === "inventoryLog" ? "inventoryHistory" : name;
      if(mergeLocal){
        /* Preserva registros locales que no llegaron a la nube (sin id) para no perderlos */
        const pending = (s[key]||[]).filter(x => x && typeof x === "object" && !x.id);
        s[key] = order === "desc" ? [...pending, ...arr] : [...arr, ...pending];
      }else{
        s[key] = arr;
      }
      safeRender();
    }, (error) => {
      console.error("Listener "+name+":", error);
      uiNotify("Sincronización parcial", "No se pudo escuchar '"+name+"' ("+(error.code||"error")+").");
    });
  };
  bind("students", "asc", d => ({ id: d.id, ...d.data() }), true);
  bind("inventory", "asc", d => ({ id: d.id, ...d.data() }), true);
  bind("vaccines", "asc", d => ({ id: d.id, ...d.data() }), false);
  bind("careRecords", "desc", d => ({ id: d.id, ...d.data() }), true);
  bind("inventoryLog", "desc", d => { const x = d.data(); return [x.time||"", x.name||"", x.qty||"", x.student||"", x.context||""]; }, false);
  bind("alerts", "desc", d => ({ id: d.id, ...d.data() }), false);
}

/* API de nube para el script clásico. Todas devuelven una Promise;
   el script clásico decide el fallback local si fallan. */
window.novimedCloudAddStudent = (student) => addDoc(colRef("students"), stripUndefined({...student, createdAt: Date.now()}));
window.novimedCloudAddInventoryItem = (item) => addDoc(colRef("inventory"), stripUndefined({...item, createdAt: Date.now()}));
window.novimedCloudAddCareRecord = (record) => addDoc(colRef("careRecords"), stripUndefined({...record, createdAt: Date.now()}));
window.novimedCloudUseInventory = (itemId, logEntry) => Promise.all([
  updateDoc(doc(colRef("inventory"), itemId), { stock: increment(-1) }),
  addDoc(colRef("inventoryLog"), {...logEntry, createdAt: Date.now()})
]);
window.novimedCloudConfirmFamily = (recordId) => updateDoc(doc(colRef("careRecords"), recordId), { family: "Confirmada" });

function currentTimeLabel(){
  return new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

function safeRender(){
  if(typeof window.novimedRenderAll === "function"){
    window.novimedRenderAll();
  }
}

let currentAlertDocId = null;
function mapFirestoreToLocalState(data){
  if(data && data.alertId) currentAlertDocId = data.alertId;
  const s = window.novimedState;
  if(!s || !data) return;

  const status = data.status || "alert_pending";
  const studentName = data.studentName || "Sofía Martínez";
  const location = data.location || "Aula 3B · 2° piso";
  const symptoms = data.symptoms || "Mareo, náuseas y dolor abdominal durante la clase.";
  s.currentAlert = {studentName, location, symptoms, allergy:data.allergy || "Maní", alertTimeLabel:data.alertTimeLabel || "Ahora"};
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
      "Alergia registrada: " + (data.allergy || "Maní")
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

  if(activities.length === 0){
    activities.push(
      ["10:24","red",`Nueva alerta de ${studentName}`, location + " · docente reporta síntomas"],
      ["10:25","blue","Departamento médico notificado","Andrés Sánchez recibió alerta"],
      ["10:26","green","Ficha médica consultada","Alergia y contactos verificados"],
      ["10:27","amber","Familia notificada","Ana Martínez pendiente de lectura"]
    );
  }

  s.activities = activities;
}

async function ensureCaseExists(){
  await setDoc(caseRef, {
    studentName: "Sofía Martínez",
    status: "alert_pending",
    allergy: "Maní",
    familyRead: false,
    doctorNotified: false,
    priority: "high",
    location: "Aula 3B · 2° piso",
    symptoms: "Mareo, náuseas y dolor abdominal durante la clase.",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

window.submitTeacherAlert = async function(){
  const student = (document.getElementById("reportStudent")?.value || "Estudiante sin nombre").trim();
  const location = (document.getElementById("reportRoom")?.value || "Ubicación sin registrar").trim();
  const symptoms = (document.getElementById("reportSymptoms")?.value || "Síntomas sin especificar").trim();

  window.novimedSubmitTeacherAlertLocal?.();

  try{
    const alertRef = await addDoc(colRef("alerts"), {
      studentName: student,
      location,
      symptoms,
      priority: "Alta",
      status: "pending",
      timeLabel: currentTimeLabel(),
      createdAt: Date.now()
    });
    currentAlertDocId = alertRef.id;
    await setDoc(caseRef, {
      studentName: student,
      status: "alert_pending",
      allergy: "Maní",
      familyRead: false,
      doctorNotified: false,
      priority: "high",
      location,
      symptoms,
      alertId: alertRef.id,
      alertTimeLabel: currentTimeLabel(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }catch(error){
    console.error("Error al sincronizar alerta en Firebase. Se mantiene el registro local:", error);
    uiNotify("Alerta solo local","No se pudo enviar a Firestore ("+(error.code||"error")+"). Otros dispositivos no la verán.");
  }
};

window.submitCare = async function(){
  const careStatus = document.getElementById("careStatus")?.value || "En observación";
  const eva = document.getElementById("careEva")?.value || "5 · Moderado";
  const careNote = document.getElementById("careObservations")?.value || document.getElementById("careActionDone")?.value || "Atención médica registrada y familia notificada.";
  let selectedStudentIndex = parseInt(document.getElementById("careStudent")?.value || window.novimedState?.selectedStudentIndex || 0, 10);
  if(!Number.isFinite(selectedStudentIndex) || selectedStudentIndex < 0) selectedStudentIndex = 0;
  const selectedStudent = window.novimedState?.students?.[selectedStudentIndex]?.fullName || "Estudiante sin nombre";
  const bodyArea = document.getElementById("careBodyArea")?.value || "Sin especificar";
  const symptoms = document.getElementById("careSymptoms")?.value || "Sin especificar";
  const presumptiveDiagnosis = document.getElementById("carePresumptiveDiagnosis")?.value || "Sin especificar";
  const actionDone = document.getElementById("careActionDone")?.value || "Sin especificar";

  window.novimedSubmitCareLocal?.();

  try{
    await updateDoc(caseRef, {
      status: "in_observation",
      doctorNotified: true,
      familyRead: false,
      studentName: selectedStudent,
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
        attendedTimeLabel: currentTimeLabel()
      }).catch(err => console.error("Alerta→atendida:", err));
    }
  }catch(error){
    console.error("Error al sincronizar atención en Firebase. Se mantiene el registro local:", error);
  }
};

window.confirmFamilyRead = async function(){
  window.novimedConfirmFamilyReadLocal?.();

  try{
    await updateDoc(caseRef, {
      familyRead: true,
      status: "family_confirmed",
      familyReadTimeLabel: currentTimeLabel(),
      updatedAt: serverTimestamp()
    });
    const linkedAlertFR=(window.novimedState?.alerts||[]).find(a=>a&&a.id===currentAlertDocId);
    if(currentAlertDocId && (!linkedAlertFR || linkedAlertFR.status!=="family_confirmed")){
      updateDoc(doc(colRef("alerts"), currentAlertDocId), {
        status: "family_confirmed",
        familyConfirmedAt: Date.now(),
        familyReadTimeLabel: currentTimeLabel()
      }).catch(err => console.error("Alerta→cerrada:", err));
    }
  }catch(error){
    console.error("Error al sincronizar lectura familiar en Firebase. Se mantiene la confirmación local:", error);
  }
};

/* V30.1 — Autenticación anónima: las Security Rules exigen sesión válida.
   La sincronización en tiempo real solo se inicia tras autenticar.
   Si la autenticación falla, la app continúa en modo local (sin tiempo real). */
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
  onSnapshot(caseRef, (snapshot) => {
    if(snapshot.exists()){
      mapFirestoreToLocalState(snapshot.data());
      safeRender();
      if(!firstSnapshotNotified){
        firstSnapshotNotified = true;
        uiNotify("Tiempo real activo","Conectado a Firestore. Este dispositivo recibirá alertas en vivo.");
      }
    }else{
      ensureCaseExists().catch(error => console.error("No se pudo crear el caso base:", error));
    }
  }, (error) => {
    console.error("Error de sincronización Firestore:", error);
    uiNotify("Sin tiempo real","Firestore rechazó la conexión ("+(error.code||"error")+"). La app funciona en modo local.");
  });
  console.log("Novimed: sesión autenticada y sincronización en tiempo real activa");
}

onAuthStateChanged(auth, (user) => {
  if(user){
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
        window.novimedCloudReady = true;
      });
  }
});

signInAnonymously(auth).catch((error) => {
  console.error("No se pudo autenticar con Firebase. La app continúa en modo local:", error);
  uiNotify("Sin conexión Firebase","Autenticación falló ("+(error.code||"error")+"). La app funciona en modo local.");
});

/* V30.3 — Red de seguridad: Safari suspende pestañas en segundo plano.
   Al recuperar visibilidad, se relee el caso por si algún push se perdió. */
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && auth.currentUser){
    getDoc(caseRef).then((snapshot) => {
      if(snapshot.exists()){
        mapFirestoreToLocalState(snapshot.data());
        safeRender();
      }
    }).catch(() => {/* sin conexión momentánea: el listener seguirá intentando */});
  }
});
