#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOVIMED — Backfill de claves foráneas `studentId`  ·  v2 (idempotente)
 *
 * Vincula los registros históricos de `careRecords`, `alerts`, `vaccines` e
 * `inventoryLog` con la ficha del estudiante, emparejando por el nombre en
 * texto plano que usaban las versiones anteriores a V41.
 *
 * ─── DECISIÓN DE DISEÑO: dónde vive UNLINKED_LEGACY ────────────────────────
 * La etiqueta NO se escribe en `studentId`, sino en `studentLinkStatus`.
 * Motivo: `studentId` es una clave foránea; un centinela dentro de ella
 * rompería la idempotencia. Los huérfanos suelen ser estudiantes cuya ficha
 * todavía no existe — cuando el colegio la cree, una segunda pasada debe
 * poder enlazarlos. Si `studentId` estuviera "lleno" con el centinela, el
 * script los saltaría y ese historial quedaría desvinculado para siempre.
 *
 *   studentId          : null | "<id real>"        ← clave foránea, o nada
 *   studentLinkStatus  : "LINKED" | "UNLINKED_LEGACY" | "AMBIGUOUS_LEGACY"
 *
 * ─── IDEMPOTENCIA ─────────────────────────────────────────────────────────
 *   · Documento ya enlazado a un id real  → se ignora siempre.
 *   · Documento UNLINKED/AMBIGUOUS        → se reintenta en cada pasada.
 *   · Solo se añaden campos; ningún dato clínico se modifica ni se borra.
 *   Ejecutarlo diez veces produce el mismo resultado que ejecutarlo una.
 *
 * ─── AMBIGÜEDAD (añadido deliberado, no solicitado) ────────────────────────
 * Si dos fichas comparten nombre, el documento NO se enlaza: se marca
 * AMBIGUOUS_LEGACY y se reporta. Adivinar vincularía la atención de un menor
 * al expediente de otro, que es peor que dejarlo sin vincular.
 *
 * ⚠️ El Admin SDK IGNORA las reglas de seguridad de Firestore. Este script
 *    puede escribir aunque las reglas lo prohíban. La única protección real
 *    es el modo seco y la confirmación por teclado.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * USO
 *   Simulación (por defecto, no escribe nada):
 *     node backfill-student-ids.mjs --school=eight-demo --dry-run
 *   Ejecución real (pide teclear APLICAR):
 *     node backfill-student-ids.mjs --school=eight-demo --apply
 *   Todas las instituciones:
 *     node backfill-student-ids.mjs --school=all --dry-run
 *   Verificar la lógica sin tocar Firebase ni credenciales:
 *     node backfill-student-ids.mjs --self-test
 *
 * CREDENCIALES (en orden de preferencia)
 *   1. GOOGLE_APPLICATION_CREDENTIALS  → ruta a la clave de servicio
 *   2. --key=<ruta>                    → ídem, por argumento
 *   3. Credenciales por defecto (ADC)  → Cloud Shell, Cloud Run, GCE
 *   Proyecto: FIREBASE_PROJECT_ID o --project=<id>
 *
 * FLUJO SIN MÁQUINA LOCAL (iPad): Google Cloud Shell funciona en Safari y ya
 * viene autenticado, así que no hay que descargar ninguna clave.
 *   gcloud config set project novimed-2c5e9
 *   npm init -y && npm i firebase-admin
 *   (subir este archivo)  →  node backfill-student-ids.mjs --school=<ID> --dry-run
 *
 * ⚠️ El reporte JSON contiene nombres de menores. Está en .gitignore.
 *    Bórralo del disco en cuanto termines de revisarlo.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/** Campos donde pudo quedar el nombre, en orden de preferencia.
 *  `student` es el campo de las versiones anteriores a V41. */
const COLLECTIONS = {
  careRecords:  { nameFields: ['studentName', 'student'], label: 'Atenciones' },
  alerts:       { nameFields: ['studentName', 'student'], label: 'Alertas' },
  vaccines:     { nameFields: ['studentName', 'student'], label: 'Vacunas' },
  inventoryLog: { nameFields: ['studentName', 'student'], label: 'Movimientos de inventario' }
};

/** Límite estricto de Firestore: 500 operaciones por lote. */
const MAX_BATCH_OPS = 500;

const LINK_STATUS = {
  LINKED:    'LINKED',
  UNLINKED:  'UNLINKED_LEGACY',
  AMBIGUOUS: 'AMBIGUOUS_LEGACY'
};

// ═══════════════════════════════════════════════════════════════════════════
//  LÓGICA PURA (sin red — verificable con --self-test)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalización conservadora: minúsculas, sin acentos, espacios colapsados.
 * NO reordena apellidos ni hace coincidencias parciales: un emparejamiento
 * difuso en una historia clínica es peor que ningún emparejamiento.
 */
export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Extrae el nombre del documento probando los campos legacy en orden. */
export function readLegacyName(data, fields) {
  for (const f of fields) {
    const v = data?.[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * ¿Debe este documento entrar en la pasada?
 * Idempotencia: lo ya enlazado a un id real se ignora; lo etiquetado como
 * huérfano o ambiguo se reintenta, por si entretanto se creó la ficha.
 */
export function needsProcessing(data) {
  const id = data?.studentId;
  if (typeof id === 'string' && id && id !== LINK_STATUS.UNLINKED && id !== LINK_STATUS.AMBIGUOUS) {
    return false;
  }
  return true;
}

/** Clasifica un documento contra el índice de fichas. */
export function classify(data, nameFields, index) {
  const rawName = readLegacyName(data, nameFields);
  const key = normalizeName(rawName);

  if (!key) {
    return { status: LINK_STATUS.UNLINKED, studentId: null, name: '(sin nombre)', reason: 'el documento no registra nombre de estudiante' };
  }
  const matches = index.get(key) || [];

  if (matches.length === 1) {
    return { status: LINK_STATUS.LINKED, studentId: matches[0].id, name: rawName, matchedTo: matches[0].fullName, archivedTarget: matches[0].isArchived };
  }
  if (matches.length > 1) {
    return { status: LINK_STATUS.AMBIGUOUS, studentId: null, name: rawName, candidates: matches.map(m => ({ id: m.id, fullName: m.fullName })), reason: 'varias fichas comparten este nombre' };
  }
  return { status: LINK_STATUS.UNLINKED, studentId: null, name: rawName, reason: 'no existe ficha con ese nombre en la institución' };
}

/** Construye el índice { nombreNormalizado: [fichas] }. */
export function buildStudentIndex(docs) {
  const index = new Map();
  for (const { id, data } of docs) {
    const key = normalizeName(data?.fullName);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    // Las fichas archivadas SÍ se indexan: el historial de un estudiante dado
    // de baja sigue perteneciéndole y debe reconectarse igual.
    index.get(key).push({ id, fullName: data.fullName, isArchived: data.isArchived === true });
  }
  return index;
}

/** Divide en lotes que respetan el límite estricto de Firestore. */
export function chunk(items, size = MAX_BATCH_OPS) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTOVERIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

function selfTest() {
  let pass = 0, fail = 0;
  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) console.log(`       esperado: ${JSON.stringify(expected)}\n       obtenido: ${JSON.stringify(actual)}`);
    ok ? pass++ : fail++;
  };

  console.log('\n🔬 Autoverificación de la lógica de emparejamiento\n');

  check('normaliza acentos y mayúsculas', normalizeName('Sofía MARTÍNEZ'), 'sofia martinez');
  check('colapsa espacios múltiples', normalizeName('  Ana   López  '), 'ana lopez');
  check('NO empareja apellidos invertidos', normalizeName('Ana López') === normalizeName('López Ana'), false);

  const index = buildStudentIndex([
    { id: 'stu_1', data: { fullName: 'Sofía Martínez' } },
    { id: 'stu_2', data: { fullName: 'Mateo Ruiz' } },
    { id: 'stu_3', data: { fullName: 'Mateo Ruiz' } },              // duplicado → ambiguo
    { id: 'stu_4', data: { fullName: 'Ana López', isArchived: true } }
  ]);
  const f = ['studentName', 'student'];

  check('coincidencia exacta', classify({ studentName: 'sofia martinez' }, f, index).studentId, 'stu_1');
  check('nombre duplicado → AMBIGUOUS', classify({ studentName: 'Mateo Ruiz' }, f, index).status, LINK_STATUS.AMBIGUOUS);
  check('sin ficha → UNLINKED', classify({ studentName: 'Pedro Gómez' }, f, index).status, LINK_STATUS.UNLINKED);
  check('sin nombre → UNLINKED', classify({}, f, index).status, LINK_STATUS.UNLINKED);
  check('campo legacy `student`', classify({ student: 'Sofía Martínez' }, f, index).studentId, 'stu_1');
  check('ficha archivada se enlaza igual', classify({ studentName: 'Ana López' }, f, index).studentId, 'stu_4');

  check('idempotencia: ya enlazado se ignora', needsProcessing({ studentId: 'stu_1' }), false);
  check('idempotencia: null se procesa', needsProcessing({ studentId: null }), true);
  check('idempotencia: sin campo se procesa', needsProcessing({}), true);
  check('idempotencia: huérfano se reintenta', needsProcessing({ studentId: null, studentLinkStatus: LINK_STATUS.UNLINKED }), true);

  check('lotes respetan el límite de 500', chunk(new Array(1201).fill(0)).map(c => c.length), [500, 500, 201]);

  console.log(`\n${fail === 0 ? '✅' : '❌'}  ${pass} correctas, ${fail} fallidas\n`);
  process.exit(fail === 0 ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROGRAMA
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const [k, v] = raw.replace(/^--/, '').split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function loadFirebase(args) {
  let appMod, fsMod;
  try {
    appMod = await import('firebase-admin/app');
    fsMod  = await import('firebase-admin/firestore');
  } catch {
    console.error('✖ Falta la dependencia firebase-admin.\n    npm install firebase-admin\n');
    process.exit(1);
  }

  const keyPath = (args.key && args.key !== true) ? String(args.key) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = (args.project && args.project !== true) ? String(args.project) : process.env.FIREBASE_PROJECT_ID;

  try {
    if (keyPath) {
      if (!existsSync(keyPath)) throw new Error(`No existe el archivo de credenciales: ${keyPath}`);
      appMod.initializeApp({ credential: appMod.cert(JSON.parse(readFileSync(keyPath, 'utf8'))), projectId });
      console.log(`🔑 Credenciales: clave de servicio (${keyPath})`);
    } else {
      appMod.initializeApp({ credential: appMod.applicationDefault(), projectId });
      console.log('🔑 Credenciales: por defecto del entorno (ADC)');
    }
  } catch (err) {
    console.error('✖ No se pudieron cargar las credenciales.');
    console.error('  Cloud Shell:  gcloud auth application-default login');
    console.error('  O bien:       export GOOGLE_APPLICATION_CREDENTIALS=/ruta/clave.json');
    console.error('  Detalle:', err.message, '\n');
    process.exit(1);
  }
  return { db: fsMod.getFirestore(), FieldValue: fsMod.FieldValue };
}

async function processSchool(db, FieldValue, schoolId, targets, apply, summary) {
  const root = db.collection('schools').doc(schoolId);

  const studentsSnap = await root.collection('students').get();
  const index = buildStudentIndex(studentsSnap.docs.map(d => ({ id: d.id, data: d.data() || {} })));

  console.log(`\n╔══ Institución: ${schoolId}`);
  console.log(`║  Fichas indexadas: ${studentsSnap.size}  (${index.size} nombres únicos)`);

  const duplicates = [...index.values()].filter(v => v.length > 1);
  if (duplicates.length) {
    console.log(`║  ⚠️  ${duplicates.length} nombre(s) duplicado(s) — todo lo que apunte a ellos será AMBIGUO:`);
    duplicates.forEach(v => console.log(`║      · "${v[0].fullName}" → ${v.length} fichas`));
  }
  if (!index.size) {
    console.log('║  ⏭️  Sin fichas: nada que enlazar en esta institución.');
    console.log('╚══════════════════════════════════════════════════════════\n');
    return { school: schoolId, skipped: true };
  }

  const detail = {};
  const writes = [];

  for (const name of targets) {
    const cfg = COLLECTIONS[name];
    const snap = await root.collection(name).get();
    const bucket = { total: snap.size, alreadyLinked: 0, linked: [], unlinked: [], ambiguous: [] };

    snap.forEach(doc => {
      const data = doc.data() || {};
      if (!needsProcessing(data)) { bucket.alreadyLinked++; return; }

      const result = classify(data, cfg.nameFields, index);
      const entry = { docId: doc.id, name: result.name, ...(result.reason && { reason: result.reason }) };
      const patch = {
        studentLinkStatus: result.status,
        studentLinkedAt: FieldValue.serverTimestamp(),
        studentLinkedBy: 'backfill-v2'
      };

      if (result.status === LINK_STATUS.LINKED) {
        entry.studentId = result.studentId;
        entry.matchedTo = result.matchedTo;
        if (result.archivedTarget) entry.note = 'la ficha está archivada';
        // studentName se normaliza al nombre canónico de la ficha; el campo
        // legacy `student` se conserva intacto por trazabilidad.
        patch.studentId = result.studentId;
        patch.studentName = result.matchedTo;
        bucket.linked.push(entry);
      } else if (result.status === LINK_STATUS.AMBIGUOUS) {
        entry.candidates = result.candidates;
        patch.studentId = null;
        bucket.ambiguous.push(entry);
      } else {
        patch.studentId = null;
        bucket.unlinked.push(entry);
      }

      writes.push({ ref: root.collection(name).doc(doc.id), data: patch });
    });

    detail[name] = bucket;
    const pct = bucket.total ? Math.round((bucket.linked.length / bucket.total) * 100) : 0;
    console.log('║');
    console.log(`║  ── ${cfg.label} (${name})`);
    console.log(`║     Total                   : ${bucket.total}`);
    console.log(`║     Ya enlazados (ignorados): ${bucket.alreadyLinked}`);
    console.log(`║     ✅ Vinculados           : ${bucket.linked.length}  (${pct}%)`);
    console.log(`║     ⚠️  AMBIGUOUS_LEGACY     : ${bucket.ambiguous.length}`);
    console.log(`║     ❌ UNLINKED_LEGACY      : ${bucket.unlinked.length}`);
    bucket.ambiguous.slice(0, 3).forEach(e => console.log(`║        ambiguo  → "${e.name}" (${e.candidates.length} candidatas)`));
    bucket.unlinked.slice(0, 3).forEach(e => console.log(`║        huérfano → "${e.name}" · ${e.reason}`));

    summary.processed += bucket.total;
    summary.ignored   += bucket.alreadyLinked;
    summary.linked    += bucket.linked.length;
    summary.ambiguous += bucket.ambiguous.length;
    summary.unlinked  += bucket.unlinked.length;
  }

  if (apply && writes.length) {
    const batches = chunk(writes, MAX_BATCH_OPS);
    console.log('║');
    console.log(`║  Escribiendo ${writes.length} documentos en ${batches.length} lote(s) de máx. ${MAX_BATCH_OPS}…`);
    let done = 0;
    for (const [i, group] of batches.entries()) {
      try {
        const batch = db.batch();
        group.forEach(w => batch.update(w.ref, w.data));
        await batch.commit();
        done += group.length;
        console.log(`║     lote ${i + 1}/${batches.length} ✅  (${done}/${writes.length})`);
      } catch (err) {
        summary.errors += group.length;
        console.error(`║     lote ${i + 1}/${batches.length} ❌  ${err.message}`);
        console.error('║        Ese lote no se aplicó; los anteriores sí. El script es');
        console.error('║        idempotente: vuelve a ejecutarlo para completar.');
      }
    }
  }

  console.log('╚══════════════════════════════════════════════════════════\n');
  return { school: schoolId, students: studentsSnap.size, collections: detail, pendingWrites: writes.length };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args['self-test']) return selfTest();

  const apply = args.apply === true;
  const schoolArg = (args.school && args.school !== true) ? String(args.school) : process.env.NOVIMED_SCHOOL_ID;
  const targets = (args.collections && args.collections !== true)
    ? String(args.collections).split(',').map(s => s.trim()).filter(Boolean)
    : Object.keys(COLLECTIONS);

  if (!schoolArg) {
    console.error('✖ Falta --school=<id> (o la variable NOVIMED_SCHOOL_ID).');
    console.error('  Usa --school=all para recorrer todas las instituciones.');
    console.error('  Verifica la lógica sin credenciales con --self-test.\n');
    process.exit(1);
  }
  for (const t of targets) {
    if (!COLLECTIONS[t]) {
      console.error(`✖ Colección desconocida: "${t}". Válidas: ${Object.keys(COLLECTIONS).join(', ')}\n`);
      process.exit(1);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  NOVIMED — Backfill de studentId (v2, idempotente)');
  console.log(`  Modo        : ${apply ? '⚠️  APLICAR — escribe en Firestore' : '🔍 SIMULACIÓN — no escribe nada'}`);
  console.log(`  Institución : ${schoolArg}`);
  console.log(`  Colecciones : ${targets.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════');

  const { db, FieldValue } = await loadFirebase(args);

  const schoolIds = schoolArg === 'all'
    ? (await db.collection('schools').get()).docs.map(d => d.id)
    : [schoolArg];
  if (schoolArg === 'all') console.log(`\n🏫 ${schoolIds.length} institución(es) encontradas.`);

  // Pasada seca completa SIEMPRE antes de confirmar: nadie confirma a ciegas.
  const summary = { processed: 0, ignored: 0, linked: 0, ambiguous: 0, unlinked: 0, errors: 0 };
  const reports = [];
  for (const id of schoolIds) reports.push(await processSchool(db, FieldValue, id, targets, false, summary));

  const reportPath = (args.report && args.report !== true)
    ? String(args.report)
    : `backfill-report-${schoolArg}-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    summary, schools: reports
  }, null, 2), 'utf8');

  console.log('┌─────────────── RESUMEN ───────────────');
  console.log(`│  Documentos procesados     : ${summary.processed}`);
  console.log(`│  Ignorados (ya enlazados)  : ${summary.ignored}`);
  console.log(`│  ✅ Vinculados             : ${summary.linked}`);
  console.log(`│  ⚠️  AMBIGUOUS_LEGACY       : ${summary.ambiguous}`);
  console.log(`│  ❌ UNLINKED_LEGACY        : ${summary.unlinked}`);
  console.log(`│  Errores                   : ${summary.errors}`);
  console.log(`│  Reporte                   : ${reportPath}`);
  console.log('└───────────────────────────────────────\n');

  if (!apply) {
    console.log('🔍 Simulación: no se escribió nada en Firestore.');
    console.log('   Revisa el reporte y repite con --apply si el resultado es correcto.\n');
    if (summary.ambiguous) console.log('   Ambiguos : corrige los nombres duplicados de la matrícula y vuelve a ejecutar.');
    if (summary.unlinked)  console.log('   Huérfanos: crea las fichas que falten y vuelve a ejecutar; el script los recupera.');
    console.log('');
    return;
  }

  const pending = summary.linked + summary.ambiguous + summary.unlinked;
  if (!pending) { console.log('Nada que aplicar.\n'); return; }

  const answer = await ask(
    `⚠️  Se van a MODIFICAR ${pending} documentos.\n` +
    '   Solo se añaden campos de enlace; ningún dato clínico se altera.\n' +
    '   El Admin SDK ignora las reglas de seguridad: esta confirmación es la única barrera.\n' +
    '   Escribe exactamente  APLICAR  para continuar: '
  );
  if (answer.trim() !== 'APLICAR') {
    console.log('\n✖ Cancelado. No se escribió nada.\n');
    return;
  }

  const applied = { processed: 0, ignored: 0, linked: 0, ambiguous: 0, unlinked: 0, errors: 0 };
  for (const id of schoolIds) await processSchool(db, FieldValue, id, targets, true, applied);

  console.log('┌─────────────── APLICADO ──────────────');
  console.log(`│  ✅ Vinculados             : ${applied.linked}`);
  console.log(`│  ⚠️  AMBIGUOUS_LEGACY       : ${applied.ambiguous}`);
  console.log(`│  ❌ UNLINKED_LEGACY        : ${applied.unlinked}`);
  console.log(`│  Errores                   : ${applied.errors}`);
  console.log('└───────────────────────────────────────');
  console.log('\n   Verifica en la app que el histórico ya no dice "Sin ficha enlazada".');
  console.log('   Y borra el reporte del disco: contiene nombres de menores.\n');
}

main().catch(err => {
  console.error('\n✖ Error no controlado:', err);
  console.error('  El script es idempotente: puedes volver a ejecutarlo sin duplicar nada.\n');
  process.exit(1);
});
