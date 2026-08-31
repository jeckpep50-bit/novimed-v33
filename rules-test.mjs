/**
 * NOVIMED — pruebas de firestore.rules contra el emulador de Firestore.
 *
 * Cubre dos cosas distintas:
 *  1. Las 3 simulaciones que RUNBOOK.md §7.1 exige correr en el Rules
 *     Playground antes de publicar (aquí quedan automatizadas y repetibles).
 *  2. Que cada forma de payload que `sync.js` realmente envía a Firestore
 *     (misma forma de objeto, mismos nombres de campo) es aceptada por las
 *     reglas — para no descubrir un desajuste ya en producción, que es
 *     justo el riesgo que RUNBOOK.md §7 advierte al ordenar "reglas primero".
 *
 * Requiere el emulador de Firestore corriendo (`npm run test:rules` lo
 * levanta y lo apaga solo). No toca ningún proyecto Firebase real.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, collection, getDoc } from "firebase/firestore";

const SCHOOL_A = "colegio-a";
const SCHOOL_B = "colegio-b";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-novimed",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080
    }
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

function ctx(uid, { role, schoolId, anonymous } = {}) {
  return testEnv.authenticatedContext(uid, {
    role,
    schoolId,
    firebase: { sign_in_provider: anonymous ? "anonymous" : "password" }
  });
}

async function seed(schoolId, path, data) {
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    await setDoc(doc(adminCtx.firestore(), `schools/${schoolId}/${path}`), data);
  });
}

// ─── RUNBOOK.md §7.1 — las 3 simulaciones obligatorias antes de publicar ───

test("RUNBOOK 1/3: delete sobre students se deniega para roles que no son SuperAdmin", async () => {
  await seed(SCHOOL_A, "students/stu1", { fullName: "Ana", createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(deleteDoc(doc(db, `schools/${SCHOOL_A}/students/stu1`)));
});

test("RUNBOOK 2/3: create en careRecords con createdBy.uid distinto del autenticado se deniega", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(collection(db, `schools/${SCHOOL_A}/careRecords`)), {
      createdBy: { uid: "otra-persona" },
      createdAt: Date.now()
    })
  );
});

test("RUNBOOK 3/3: archivado con archivedReason vacío se deniega", async () => {
  await seed(SCHOOL_A, "students/stu2", { fullName: "Beto", isArchived: false, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/students/stu2`), {
      isArchived: true,
      archivedReason: "",
      archivedBy: { uid: "health1" },
      archivedAt: Date.now(),
      updatedAt: new Date(),
      updatedBy: { uid: "health1" }
    })
  );
});

// ─── Payloads reales de sync.js: cada forma que el código produce hoy ──────

test("addStudent (authored() + serverCreate()) se acepta", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    setDoc(doc(collection(db, `schools/${SCHOOL_A}/students`)), {
      fullName: "Camila",
      clientOpId: "op_1",
      createdAt: Date.now(),
      createdBy: { uid: "health1", email: "h@x.com", role: "Personal_Salud" }
    })
  );
});

test("archiveStudent (queueExecutors.archiveStudent) se acepta", async () => {
  await seed(SCHOOL_A, "students/stu3", { fullName: "Diego", isArchived: false, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/students/stu3`), {
      isArchived: true,
      archivedReason: "Cambio de institución",
      archivedAt: Date.now(),
      archivedBy: { uid: "health1" },
      updatedAt: new Date(),
      updatedBy: { uid: "health1" }
    })
  );
});

test("updateStudent (edición ordinaria, sin tocar isArchived) se acepta", async () => {
  await seed(SCHOOL_A, "students/stu4", { fullName: "Eva", isArchived: false, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/students/stu4`), {
      fullName: "Eva Actualizada",
      updatedAt: new Date(),
      updatedBy: { uid: "health1" }
    })
  );
});

test("confirmFamily (queueExecutors.confirmFamily, update de solo 'family') se acepta", async () => {
  await seed(SCHOOL_A, "careRecords/care1", { createdBy: { uid: "health1" }, createdAt: 1000, family: "Pendiente" });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/careRecords/care1`), {
      family: "Confirmada",
      updatedAt: new Date(),
      updatedBy: { uid: "health1" }
    })
  );
});

test("alerts: create (submitTeacherAlert) y transición a 'attended' (submitCare) se aceptan", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  const ref = doc(collection(db, `schools/${SCHOOL_A}/alerts`));
  await assertSucceeds(
    setDoc(ref, {
      studentId: "stu1",
      studentName: "Ana",
      location: "Aula 1",
      symptoms: "Dolor de cabeza",
      priority: "Alta",
      status: "pending",
      timeLabel: "10:00",
      createdAt: Date.now(),
      createdBy: { uid: "health1" }
    })
  );
  await assertSucceeds(
    updateDoc(ref, {
      status: "attended",
      attendedAt: Date.now(),
      attendedTimeLabel: "10:05",
      careRecordId: null,
      attendedBy: { uid: "health1" },
      updatedAt: new Date(),
      updatedBy: { uid: "health1" }
    })
  );
});

test("invUse: create en inventoryLog (authored() + serverCreate()) se acepta", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    setDoc(doc(collection(db, `schools/${SCHOOL_A}/inventoryLog`)), {
      date: "2026-08-16",
      studentId: "stu1",
      createdAt: Date.now(),
      createdBy: { uid: "health1" }
    })
  );
});

// ─── Roles y aislamiento multi-tenant ───────────────────────────────────────

test("rol Consulta no puede crear fichas (solo lectura)", async () => {
  const db = ctx("viewer1", { role: "Consulta", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(collection(db, `schools/${SCHOOL_A}/students`)), {
      fullName: "X",
      createdAt: Date.now(),
      createdBy: { uid: "viewer1" }
    })
  );
});

test("rol Consulta sí puede leer", async () => {
  await seed(SCHOOL_A, "students/stu5", { fullName: "F" });
  const db = ctx("viewer1", { role: "Consulta", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(getDoc(doc(db, `schools/${SCHOOL_A}/students/stu5`)));
});

test("un usuario del colegio A no puede leer datos del colegio B", async () => {
  await seed(SCHOOL_B, "students/stuB", { fullName: "Otro colegio" });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(getDoc(doc(db, `schools/${SCHOOL_B}/students/stuB`)));
});

test("una sesión anónima solo entra al tenant de demo eight-demo", async () => {
  await seed(SCHOOL_A, "students/stuAnon", { fullName: "No debería verse" });
  const db = ctx("anon1", { anonymous: true }).firestore();
  await assertFails(getDoc(doc(db, `schools/${SCHOOL_A}/students/stuAnon`)));
});

test("una sesión anónima sí puede leer eight-demo", async () => {
  await seed("eight-demo", "students/demo1", { fullName: "Sofía Martínez" });
  const db = ctx("anon1", { anonymous: true }).firestore();
  await assertSucceeds(getDoc(doc(db, `schools/eight-demo/students/demo1`)));
});

test("createdAt más de 5 minutos en el futuro se deniega (sanePastTimestamp)", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(collection(db, `schools/${SCHOOL_A}/students`)), {
      fullName: "Futuro",
      createdAt: Date.now() + 600000,
      createdBy: { uid: "health1" }
    })
  );
});

test("una colección no declarada se deniega por defecto", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(getDoc(doc(db, `schools/${SCHOOL_A}/coleccionNueva/doc1`)));
});

// ─── Derecho de eliminación (LOPDP) — solo SuperAdmin, solo con motivo ────

test("erasureLog: Personal_Salud no puede crear un registro de eliminación", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuX`), {
      studentId: "stuX",
      reason: "Solicitud de un padre por correo",
      createdAt: Date.now(),
      createdBy: { uid: "health1" }
    })
  );
});

test("erasureLog: Admin_Colegio tampoco puede crearlo (solo SuperAdmin)", async () => {
  const db = ctx("admin1", { role: "Admin_Colegio", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuX`), {
      studentId: "stuX",
      reason: "Solicitud de un padre por correo",
      createdAt: Date.now(),
      createdBy: { uid: "admin1" }
    })
  );
});

test("erasureLog: SuperAdmin no puede registrar con un motivo demasiado corto", async () => {
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuX`), {
      studentId: "stuX",
      reason: "corto",
      createdAt: Date.now(),
      createdBy: { uid: "super1" }
    })
  );
});

test("erasureLog: SuperAdmin no puede registrar con el ID del documento distinto de studentId", async () => {
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuX`), {
      studentId: "otro-estudiante",
      reason: "Solicitud de eliminación de la madre, verificada por dirección",
      createdAt: Date.now(),
      createdBy: { uid: "super1" }
    })
  );
});

test("erasureLog: SuperAdmin sí puede registrar un motivo válido", async () => {
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuX`), {
      studentId: "stuX",
      reason: "Solicitud de eliminación de la madre, verificada por dirección",
      createdAt: Date.now(),
      createdBy: { uid: "super1" }
    })
  );
});

test("erasureLog: es inmutable, ni SuperAdmin puede editarlo o borrarlo", async () => {
  await seed(SCHOOL_A, "erasureLog/stuY", {
    studentId: "stuY",
    reason: "Solicitud de eliminación del padre, verificada por dirección",
    createdAt: Date.now(),
    createdBy: { uid: "super1" }
  });
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertFails(updateDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuY`), { reason: "otro motivo, igual de largo que el anterior" }));
  await assertFails(deleteDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuY`)));
});

test("SuperAdmin NO puede borrar una ficha sin erasureLog previo para ese estudiante", async () => {
  await seed(SCHOOL_A, "students/stuZ", { fullName: "Sin registro de eliminación", createdBy: { uid: "health1" } });
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertFails(deleteDoc(doc(db, `schools/${SCHOOL_A}/students/stuZ`)));
});

test("SuperAdmin SÍ puede borrar una ficha una vez registrado el motivo en erasureLog", async () => {
  await seed(SCHOOL_A, "students/stuW", { fullName: "Con registro de eliminación", createdBy: { uid: "health1" } });
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stuW`), {
      studentId: "stuW",
      reason: "Solicitud de eliminación de la familia, verificada por dirección",
      createdAt: Date.now(),
      createdBy: { uid: "super1" }
    })
  );
  await assertSucceeds(deleteDoc(doc(db, `schools/${SCHOOL_A}/students/stuW`)));
});

test("erasureLog también habilita el borrado de careRecords/alerts/vaccines/inventoryLog del mismo estudiante", async () => {
  const studentId = "stuV";
  await seed(SCHOOL_A, `erasureLog/${studentId}`, {
    studentId,
    reason: "Solicitud de eliminación de la familia, verificada por dirección",
    createdAt: Date.now(),
    createdBy: { uid: "super1" }
  });
  await seed(SCHOOL_A, "careRecords/care-stuV", { studentId, createdBy: { uid: "health1" }, createdAt: 1000 });
  await seed(SCHOOL_A, "alerts/alert-stuV", { studentId, createdBy: { uid: "health1" }, createdAt: 1000, status: "pending" });
  await seed(SCHOOL_A, "vaccines/vac-stuV", { studentId, createdBy: { uid: "health1" } });
  await seed(SCHOOL_A, "inventoryLog/log-stuV", { studentId, createdBy: { uid: "health1" } });

  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(deleteDoc(doc(db, `schools/${SCHOOL_A}/careRecords/care-stuV`)));
  await assertSucceeds(deleteDoc(doc(db, `schools/${SCHOOL_A}/alerts/alert-stuV`)));
  await assertSucceeds(deleteDoc(doc(db, `schools/${SCHOOL_A}/vaccines/vac-stuV`)));
  await assertSucceeds(deleteDoc(doc(db, `schools/${SCHOOL_A}/inventoryLog/log-stuV`)));
});

test("un registro huérfano (sin studentId) no se puede borrar aunque haya erasureLogs de otros estudiantes", async () => {
  await seed(SCHOOL_A, "erasureLog/algun-estudiante", {
    studentId: "algun-estudiante",
    reason: "Solicitud de eliminación de la familia, verificada por dirección",
    createdAt: Date.now(),
    createdBy: { uid: "super1" }
  });
  await seed(SCHOOL_A, "careRecords/care-huerfano", { createdBy: { uid: "health1" }, createdAt: 1000 });
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertFails(deleteDoc(doc(db, `schools/${SCHOOL_A}/careRecords/care-huerfano`)));
});

// ─── Hallazgo del cruce reglas↔código (ver PLAN_DE_TRABAJO.md) ─────────────

/* ══════════════════════════════════════════════════════════════════════
   V42.0.1 — Pruebas de los huecos cerrados en esta versión.
   Se añaden JUNTO a la corrección, no después: una regla endurecida sin
   test que la ejerza es una regla que nadie sabe si sigue vigente.
   ══════════════════════════════════════════════════════════════════════ */

test("alerts: un update sin updatedBy verificado se deniega (autoría)", async () => {
  await seed(SCHOOL_A, "alerts/al-auth", { status: "pending", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Sin updatedBy: antes se aceptaba, y con ello `attendedBy` era un campo
  // que el cliente afirmaba sin verificación alguna.
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-auth`), {
      status: "attended", attendedAt: Date.now(), attendedBy: { uid: "otro" }
    })
  );
});

test("alerts: no se puede atribuir la atención a otro uid", async () => {
  await seed(SCHOOL_A, "alerts/al-suplant", { status: "pending", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-suplant`), {
      status: "attended", attendedAt: Date.now(),
      updatedAt: new Date(), updatedBy: { uid: "medico-que-no-soy" }
    })
  );
});

test("alerts: no se puede devolver una alerta atendida a 'pending'", async () => {
  await seed(SCHOOL_A, "alerts/al-estado", { status: "attended", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Revertir el estado borraría la medición de tiempo de respuesta.
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-estado`), {
      status: "pending", updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

/* ══════════════════════════════════════════════════════════════════════
   V42.2 — A2. Máquina de estados de la alerta.
   La versión anterior validaba el ESTADO FINAL con `status in [lista]`, lo
   que prohibía cualquier escritura que dejara la alerta en 'pending' y por
   tanto bloqueaba el triaje de V42.2. Estas pruebas fijan el comportamiento
   correcto: se validan TRANSICIONES, y reasignar prioridad sobre una alerta
   en cola es legítimo.
   ══════════════════════════════════════════════════════════════════════ */

test("A2: reasignar la prioridad de una alerta pendiente se acepta", async () => {
  await seed(SCHOOL_A, "alerts/al-prio", { status: "pending", priority: "Media", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Esto fallaba con la regla anterior: el documento resultante seguía en
  // 'pending' y la lista plana de estados no lo contemplaba.
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-prio`), {
      priority: "Alta", priorityChangedBy: { uid: "health1" }, priorityChangedAt: Date.now(),
      updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: reasignar prioridad no puede colar un cambio de estado", async () => {
  await seed(SCHOOL_A, "alerts/al-prio2", { status: "pending", priority: "Baja", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // La rama de triaje está separada a propósito de la del ciclo clínico.
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-prio2`), {
      priority: "Alta", status: "family_confirmed",
      updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: una prioridad fuera del catálogo se deniega", async () => {
  await seed(SCHOOL_A, "alerts/al-prio3", { status: "pending", priority: "Media", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-prio3`), {
      priority: "Urgentísima", updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: pendiente → atendida sigue aceptándose (no se rompió el ciclo)", async () => {
  await seed(SCHOOL_A, "alerts/al-ciclo", { status: "pending", priority: "Alta", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-ciclo`), {
      status: "attended", attendedAt: Date.now(), attendedBy: { uid: "health1" },
      updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: no se puede saltar de 'pending' directo a 'family_confirmed'", async () => {
  await seed(SCHOOL_A, "alerts/al-salto", { status: "pending", priority: "Alta", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Confirmar lectura familiar de algo que nadie atendió es un caso imposible.
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-salto`), {
      status: "family_confirmed", familyConfirmedAt: Date.now(),
      updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: un caso cerrado no se reabre", async () => {
  await seed(SCHOOL_A, "alerts/al-cerrado", { status: "family_confirmed", priority: "Alta", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-cerrado`), {
      status: "attended", updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("A2: cerrar sin atención desde la cola se acepta (V42.2)", async () => {
  await seed(SCHOOL_A, "alerts/al-falsa", { status: "pending", priority: "Baja", createdAt: Date.now(), createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/alerts/al-falsa`), {
      status: "closed_none", closedAt: Date.now(), closedReason: "Falsa alarma",
      closedBy: { uid: "health1" }, updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

/* ══════════════════════════════════════════════════════════════════════
   V42.2 — A1. Interfaz del derecho de eliminación (LOPDP).
   Las reglas exigían erasureLog desde V42.0, pero ningún código podía
   crearlo: la función era imposible de ejercer desde la aplicación.
   ══════════════════════════════════════════════════════════════════════ */

test("A1: un SuperAdmin puede registrar una solicitud de eliminación", async () => {
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  await assertSucceeds(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stu-lopdp`), {
      studentId: "stu-lopdp",
      reason: "Solicitud presentada por la madre el 31/08/2026, art. 12 LOPDP.",
      requestedAt: Date.now(),
      createdAt: Date.now(),
      createdBy: { uid: "super1" }
    })
  );
});

test("A1: Personal_Salud no puede registrar una solicitud de eliminación", async () => {
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stu-x`), {
      studentId: "stu-x",
      reason: "Intento desde un rol sin atribución para esto.",
      createdAt: Date.now(),
      createdBy: { uid: "health1" }
    })
  );
});

test("A1: un motivo demasiado corto se deniega", async () => {
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  // Sin motivo utilizable, el registro no sirve para auditar nada.
  await assertFails(
    setDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stu-y`), {
      studentId: "stu-y", reason: "borrar",
      createdAt: Date.now(), createdBy: { uid: "super1" }
    })
  );
});

test("A1: el registro de eliminación no se puede editar ni borrar", async () => {
  await seed(SCHOOL_A, "erasureLog/stu-z", {
    studentId: "stu-z", reason: "Solicitud del representante legal, expediente 2026-014.",
    createdAt: Date.now(), createdBy: { uid: "super1" }
  });
  const db = ctx("super1", { role: "SuperAdmin", schoolId: SCHOOL_A }).firestore();
  // Es la garantía que hace útil todo el mecanismo: la constancia es permanente.
  await assertFails(updateDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stu-z`), { reason: "otro motivo distinto" }));
  await assertFails(deleteDoc(doc(db, `schools/${SCHOOL_A}/erasureLog/stu-z`)));
});

test("inventory: no se puede reescribir el stock sin autor verificado", async () => {
  await seed(SCHOOL_A, "inventory/med1", { name: "Paracetamol", stock: 10, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/inventory/med1`), { stock: 999 })
  );
});

test("inventory: el descuento de invUse (stock + updatedBy) sigue aceptándose", async () => {
  await seed(SCHOOL_A, "inventory/med2", { name: "Suero", stock: 10, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Forma exacta que envía sync.js en el writeBatch de invUse.
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/inventory/med2`), {
      stock: 9, updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("inventory: un stock negativo se deniega", async () => {
  await seed(SCHOOL_A, "inventory/med3", { name: "Gasas", stock: 1, createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  await assertFails(
    updateDoc(doc(db, `schools/${SCHOOL_A}/inventory/med3`), {
      stock: -5, updatedAt: new Date(), updatedBy: { uid: "health1" }
    })
  );
});

test("BRECHA CONOCIDA (rastreada para V43/A3): update en vaccines no tiene lista de campos permitidos", async () => {
  await seed(SCHOOL_A, "vaccines/vac1", { studentId: "stu1", createdBy: { uid: "health1" } });
  const db = ctx("health1", { role: "Personal_Salud", schoolId: SCHOOL_A }).firestore();
  // Hoy esto SE ACEPTA porque firestore.rules no tiene onlyChanges() en el
  // update de vaccines (a diferencia de careRecords/alerts/students), así
  // que cualquier escritor puede reescribir studentId de un registro de
  // vacunación existente. Vacunas está muerto en producción (A3), así que
  // el riesgo actual es bajo — pero conviene cerrar esta brecha cuando V43
  // reactive el módulo, no después. Ver PLAN_DE_TRABAJO.md, Fase 2.
  await assertSucceeds(
    updateDoc(doc(db, `schools/${SCHOOL_A}/vaccines/vac1`), {
      studentId: "stu-secuestrado"
    })
  );
});
