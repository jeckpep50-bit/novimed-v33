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

test("RUNBOOK 1/3: delete sobre students siempre se deniega", async () => {
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

// ─── Hallazgo del cruce reglas↔código (ver PLAN_DE_TRABAJO.md) ─────────────

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
