/* ═══════════════════════════════════════════════════════════════════════════
   NOVIMED — Pruebas de la purga de almacenamiento local (V42.1, A4)

   Ejecutar:  npm run test:purge
   No necesita emulador ni navegador: el módulo recibe el almacén por
   argumento, así que se prueba con un doble en memoria.

   Lo que se verifica no es "la función borra cosas", sino las tres decisiones
   de diseño que hacen que esta corrección sea segura:
     1. La caché de estado siempre desaparece (es reconstruible).
     2. La cola con trabajo sin enviar NO desaparece sin advertencia previa
        (es la única copia de esos registros clínicos).
     3. Nada ajeno a Novimed se toca (el navegador es del colegio, no nuestro).
   ═══════════════════════════════════════════════════════════════════════════ */

import test from "node:test";
import assert from "node:assert/strict";
import {
  purgeNovimedStorage,
  novimedStorageKeys,
  countPendingOps,
  isStateKey,
  isQueueKey
} from "./local-purge.js";

/* Doble de Storage fiel en lo que importa para este bug: `length` y `key(i)`
   se reindexan al eliminar, que es exactamente lo que rompe un bucle ingenuo. */
function fakeStorage(seed = {}){
  const map = new Map(Object.entries(seed));
  return {
    get length(){ return map.size; },
    key(i){ return [...map.keys()][i] ?? null; },
    getItem(k){ return map.has(k) ? map.get(k) : null; },
    setItem(k, v){ map.set(k, String(v)); },
    removeItem(k){ map.delete(k); },
    _all(){ return [...map.keys()]; }
  };
}

const ficha = JSON.stringify({
  schema: 4,
  data: { students: [{ id: "s1", fullName: "Menor de prueba", allergies: "Penicilina" }] }
});
const colaConTrabajo = JSON.stringify([
  { opId: "op_1", type: "addCareRecord", payload: { studentName: "Menor de prueba" } }
]);
const colaVacia = JSON.stringify([]);

/* ─────────────────────────────────────────────────────────────────────────
   1. El caso que motiva toda la entrega
   ───────────────────────────────────────────────────────────────────────── */

test("A4: la ficha de un menor no sobrevive al cierre de sesión", () => {
  const s = fakeStorage({ "novimed_local_state_v2::colegio-a": ficha });
  purgeNovimedStorage(s, { keepQueue: false });
  assert.equal(s.getItem("novimed_local_state_v2::colegio-a"), null);
  assert.deepEqual(novimedStorageKeys(s), []);
});

test("A4: se purgan TODOS los tenants del dispositivo, no solo el activo", () => {
  /* Escenario real del iPad compartido: la enfermera del colegio A cerró
     sesión ayer y hoy entra el colegio B. Los datos de A no pueden quedarse. */
  const s = fakeStorage({
    "novimed_local_state_v2::colegio-a": ficha,
    "novimed_local_state_v2::colegio-b": ficha,
    "novimed_local_state_v2::eight-demo": ficha
  });
  const r = purgeNovimedStorage(s);
  assert.equal(r.removed.length, 3);
  assert.deepEqual(s._all(), []);
});

test("A4: también se purgan los esquemas antiguos (v1), no solo el vigente", () => {
  /* Si el prefijo llevara el número de versión, una ficha guardada por la v1
     seguiría en el equipo para siempre tras la migración. */
  const s = fakeStorage({
    "novimed_local_state_v1": ficha,
    "novimed_local_state_v2::colegio-a": ficha
  });
  purgeNovimedStorage(s);
  assert.deepEqual(s._all(), []);
});

/* ─────────────────────────────────────────────────────────────────────────
   2. La cola: no perder registros clínicos por proteger la privacidad
   ───────────────────────────────────────────────────────────────────────── */

test("A4: con keepQueue, el trabajo sin enviar se conserva y la caché no", () => {
  const s = fakeStorage({
    "novimed_local_state_v2::colegio-a": ficha,
    "novimed_pending_ops_v1::colegio-a": colaConTrabajo
  });
  const r = purgeNovimedStorage(s, { keepQueue: true });

  assert.equal(s.getItem("novimed_local_state_v2::colegio-a"), null, "la caché debe irse");
  assert.ok(s.getItem("novimed_pending_ops_v1::colegio-a"), "la cola debe quedarse");
  assert.equal(r.pendingKept, 1);
});

test("A4: sin keepQueue la cola se borra — solo tras advertir al usuario", () => {
  const s = fakeStorage({ "novimed_pending_ops_v1::colegio-a": colaConTrabajo });
  const r = purgeNovimedStorage(s, { keepQueue: false });
  assert.equal(s.getItem("novimed_pending_ops_v1::colegio-a"), null);
  assert.equal(r.removed.length, 1);
});

test("A4: una cola vacía no cuenta como trabajo pendiente", () => {
  const s = fakeStorage({ "novimed_pending_ops_v1::colegio-a": colaVacia });
  assert.equal(countPendingOps(s), 0);
});

test("A4: se cuentan las operaciones de todas las colas del equipo", () => {
  const s = fakeStorage({
    "novimed_pending_ops_v1::colegio-a": colaConTrabajo,
    "novimed_pending_ops_v1::colegio-b": JSON.stringify([
      { opId: "op_2", type: "addStudent" },
      { opId: "op_3", type: "invUse" }
    ])
  });
  assert.equal(countPendingOps(s), 3);
});

test("A4: una cola corrupta no rompe el cierre de sesión", () => {
  const s = fakeStorage({ "novimed_pending_ops_v1::colegio-a": "{{{ no es json" });
  assert.equal(countPendingOps(s), 0);
  assert.doesNotThrow(() => purgeNovimedStorage(s));
});

/* ─────────────────────────────────────────────────────────────────────────
   3. Alcance: no somos dueños del navegador
   ───────────────────────────────────────────────────────────────────────── */

test("A4: no se toca nada que no sea de Novimed", () => {
  const s = fakeStorage({
    "novimed_local_state_v2::colegio-a": ficha,
    "theme": "dark",
    "jamf_device_token": "abc",
    "novimedia_otra_app": "no es nuestra"   // parecido, pero no es nuestro prefijo
  });
  purgeNovimedStorage(s);
  assert.deepEqual(s._all().sort(), ["jamf_device_token", "novimedia_otra_app", "theme"]);
});

test("A4: purgar dos veces seguidas es inocuo", () => {
  const s = fakeStorage({ "novimed_local_state_v2::colegio-a": ficha });
  purgeNovimedStorage(s);
  const r = purgeNovimedStorage(s);
  assert.deepEqual(r.removed, []);
});

test("A4: sin almacén disponible (Safari privado) no se lanza", () => {
  assert.doesNotThrow(() => purgeNovimedStorage(null));
  assert.deepEqual(novimedStorageKeys(null), []);
  assert.equal(countPendingOps(null), 0);
});

test("A4: un almacén que lanza al enumerar se degrada sin romper", () => {
  const roto = { get length(){ throw new Error("SecurityError"); }, key(){}, getItem(){}, removeItem(){} };
  assert.doesNotThrow(() => purgeNovimedStorage(roto));
});

/* ─────────────────────────────────────────────────────────────────────────
   4. Clasificación de claves
   ───────────────────────────────────────────────────────────────────────── */

test("A4: las claves se clasifican por prefijo, no por coincidencia parcial", () => {
  assert.ok(isStateKey("novimed_local_state_v2::x"));
  assert.ok(isQueueKey("novimed_pending_ops_v1::x"));
  assert.ok(!isStateKey("mi_novimed_local_state_v2"));
  assert.ok(!isQueueKey(null));
  assert.ok(!isQueueKey(undefined));
});
