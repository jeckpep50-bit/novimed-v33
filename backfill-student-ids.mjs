#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOVIMED — Backfill de claves foráneas `studentId` (V41)
 *
 * PROBLEMA QUE RESUELVE
 *   Hasta V40, `alerts`, `careRecords`, `vaccines` e `inventoryLog` enlazaban
 *   al estudiante por CADENA DE TEXTO. V41 introdujo `studentId` como clave
 *   real. Los documentos anteriores no la tienen, así que la interfaz los
 *   muestra —con razón— como "Sin ficha enlazada". Este script reconstruye
 *   ese vínculo emparejando por nombre normalizado.
 *
 * POR QUÉ ES SEGURO
 *   · En seco por defecto. Escribe SOLO con --apply, y hay que teclearlo.
 *   · Solo toca coincidencias EXACTAS y ÚNICAS. Lo ambiguo no se adivina.
 *   · Nunca sobrescribe un `studentId` existente.
 *   · Nunca borra ni modifica un campo clínico: solo añade el enlace.
 *   · Deja rastro: `studentLinkedBy: 'backfill'` + `studentLinkedAt`.
 *   · Emite un reporte JSON revisable antes de aplicar nada.
 *
 * CÓMO EJECUTARLO SIN MÁQUINA LOCAL (flujo iPad)
 *   Google Cloud Shell funciona en Safari y trae Node y credenciales ya
 *   autenticadas — no hace falta descargar ninguna clave de servicio:
 *     1. console.cloud.google.com → icono de terminal (Activar Cloud Shell)
 *     2. gcloud config set project novimed-2c5e9
 *     3. mkdir nv && cd nv && npm init -y && npm i firebase-admin
 *     4. Subir este archivo (menú ⋮ → Cargar archivo)
 *     5. node backfill-student-ids.mjs --school=<ID> --dry-run
 *
 * USO
 *   node backfill-student-ids.mjs --school=eight-demo --dry-run
 *   node backfill-student-ids.mjs --school=eight-demo --apply
 *
 * OPCIONES
 *   --school=<id>     Institución a migrar. Obligatorio (evita migrar todo por accidente).
 *   --dry-run         Simulación. Es el valor por defecto.
 *   --apply           Escribe realmente. Requiere confirmación por teclado.
 *   --collections=... Lista separada por comas. Por defecto, las cuatro.
 *   --report=<ruta>   Ruta del reporte JSON. Por defecto backfill-report-<school>-<fecha>.json
 *   --key=<ruta>      Clave de servicio. Si se omite, usa credenciales por defecto (ADC).
 *
 * ⚠️ El reporte contiene nombres de estudiantes: es dato personal de menores.
 *    Está en .gitignore. Bórralo del disco cuando termines de revisarlo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
/* firebase-admin se carga de forma diferida: así los errores de argumentos
   se reportan con un mensaje claro en vez de un fallo de resolución de
   módulo, y el script se puede inspeccionar sin instalar dependencias. */

// ─── Configuración de las colecciones a migrar ─────────────────────────────
// `nameFields` va en orden de preferencia: los documentos anteriores a V41
// guardaban el nombre en `student`; los nuevos en `studentName`.
const COLLECTIONS = {
  careRecords:  { nameFields: ['studentName', 'student'], label: 'Atenciones' },
  alerts:       { nameFields: ['studentName', 'student'], label: 'Alertas' },
  vaccines:     { nameFields: ['studentName', 'student'], label: 'Vacunas' },
  inventoryLog: { nameFields: ['studentName', 'student'], label: 'Movimientos de inventario' }
};

const BATCH_LIMIT = 400; // margen bajo el techo de 500 de Firestore

// ─── Argumentos ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const [k, v] = raw.replace(/^--/, '').split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}

/**
 * Normalización para emparejar nombres. Deliberadamente conservadora:
 * quita acentos, colapsa espacios y pasa a minúsculas, pero NO reordena
 * apellidos ni intenta coincidencias parciales. Un emparejamiento difuso
 * en una historia clínica es peor que ningún emparejamiento: vincularía la
 * atención de un menor al expediente de otro.
 */
function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function readName(data, fields) {
  for (const f of fields) {
    const v = data?.[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

// ─── Programa ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const schoolId = args.school;
  const apply = args.apply === true;
  const targets = args.collections
    ? String(args.collections).split(',').map(s => s.trim()).filter(Boolean)
    : Object.keys(COLLECTIONS);

  if (!schoolId || schoolId === true) {
    console.error('✖ Falta --school=<id>. Ejemplo: --school=eight-demo');
    process.exit(1);
  }
  for (const t of targets) {
    if (!COLLECTIONS[t]) {
      console.error(`✖ Colección desconocida: "${t}". Válidas: ${Object.keys(COLLECTIONS).join(', ')}`);
      process.exit(1);
    }
  }

  let initializeApp, cert, applicationDefault, getFirestore, FieldValue;
  try {
    ({ initializeApp, cert, applicationDefault } = await import('firebase-admin/app'));
    ({ getFirestore, FieldValue } = await import('firebase-admin/firestore'));
  } catch {
    console.error('✖ Falta la dependencia firebase-admin. Instálala con:\n    npm install firebase-admin\n');
    process.exit(1);
  }

  try {
    initializeApp(
      args.key
        ? { credential: cert(JSON.parse(readFileSync(String(args.key), 'utf8'))) }
        : { credential: applicationDefault() }
    );
  } catch (err) {
    console.error('✖ No se pudieron cargar las credenciales de administración.');
    console.error('  En Google Cloud Shell suele bastar con: gcloud auth application-default login');
    console.error('  O bien pasa una clave de servicio con --key=<ruta>.\n  Detalle:', err.message, '\n');
    process.exit(1);
  }
  const db = getFirestore();
  const root = db.collection('schools').doc(String(schoolId));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  NOVIMED — Backfill de studentId`);
  console.log(`  Institución : ${schoolId}`);
  console.log(`  Modo        : ${apply ? '⚠️  APLICAR (escribe en Firestore)' : '🔍 SIMULACIÓN (--dry-run)'}`);
  console.log(`  Colecciones : ${targets.join(', ')}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 1. Índice de fichas por nombre normalizado ───────────────────────────
  // Se incluyen las fichas ARCHIVADAS: el historial de un estudiante dado de
  // baja sigue perteneciéndole y debe reconectarse igual.
  const studentsSnap = await root.collection('students').get();
  const index = new Map();          // nombre normalizado → [{id, fullName, isArchived}]
  studentsSnap.forEach(doc => {
    const d = doc.data() || {};
    const key = normalizeName(d.fullName);
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ id: doc.id, fullName: d.fullName, isArchived: d.isArchived === true });
  });

  const duplicateNames = [...index.entries()].filter(([, v]) => v.length > 1);
  console.log(`📋 Fichas indexadas: ${studentsSnap.size} (${index.size} nombres únicos)`);
  if (duplicateNames.length) {
    console.log(`⚠️  ${duplicateNames.length} nombre(s) duplicado(s) en la matrícula — todo lo que apunte a ellos será AMBIGUO:`);
    duplicateNames.forEach(([k, v]) => console.log(`     · "${v[0].fullName}" → ${v.length} fichas`));
  }
  if (!index.size) {
    console.error('\n✖ No hay fichas en esta institución. Nada que enlazar. Revisa el --school.');
    process.exit(1);
  }

  // ── 2. Clasificación ─────────────────────────────────────────────────────
  const report = {
    school: schoolId,
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    studentsIndexed: studentsSnap.size,
    duplicateStudentNames: duplicateNames.map(([, v]) => ({ fullName: v[0].fullName, count: v.length })),
    collections: {}
  };
  const pendingWrites = [];

  for (const name of targets) {
    const cfg = COLLECTIONS[name];
    const snap = await root.collection(name).get();
    const bucket = { total: snap.size, alreadyLinked: 0, exact: [], ambiguous: [], orphan: [] };

    snap.forEach(doc => {
      const data = doc.data() || {};
      if (data.studentId) { bucket.alreadyLinked++; return; }  // jamás se sobrescribe

      const rawName = readName(data, cfg.nameFields);
      const key = normalizeName(rawName);
      const matches = key ? (index.get(key) || []) : [];

      const entry = { docId: doc.id, name: rawName || '(sin nombre)' };

      if (matches.length === 1) {
        entry.studentId = matches[0].id;
        entry.matchedTo = matches[0].fullName;
        if (matches[0].isArchived) entry.note = 'ficha archivada';
        bucket.exact.push(entry);
        pendingWrites.push({
          ref: root.collection(name).doc(doc.id),
          data: {
            studentId: matches[0].id,
            studentName: matches[0].fullName,
            studentLinkedBy: 'backfill',
            studentLinkedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }
        });
      } else if (matches.length > 1) {
        entry.candidates = matches.map(m => ({ id: m.id, fullName: m.fullName }));
        entry.reason = 'varias fichas comparten este nombre';
        bucket.ambiguous.push(entry);
      } else {
        entry.reason = key ? 'no existe ficha con ese nombre' : 'el documento no tiene nombre de estudiante';
        bucket.orphan.push(entry);
      }
    });

    report.collections[name] = bucket;

    const pct = bucket.total ? Math.round((bucket.exact.length / bucket.total) * 100) : 0;
    console.log(`\n── ${cfg.label} (${name}) ─────────────────────────`);
    console.log(`   Total documentos    : ${bucket.total}`);
    console.log(`   Ya enlazados        : ${bucket.alreadyLinked}`);
    console.log(`   ✅ Coincidencia exacta : ${bucket.exact.length}  (${pct}% del total)`);
    console.log(`   ⚠️  Ambiguas           : ${bucket.ambiguous.length}`);
    console.log(`   ❌ Huérfanas          : ${bucket.orphan.length}`);
    bucket.ambiguous.slice(0, 5).forEach(e => console.log(`        ambigua → "${e.name}" (${e.candidates.length} candidatas)`));
    bucket.orphan.slice(0, 5).forEach(e => console.log(`        huérfana → "${e.name}" · ${e.reason}`));
    if (bucket.orphan.length > 5) console.log(`        … y ${bucket.orphan.length - 5} más (ver reporte)`);
  }

  // ── 3. Reporte ───────────────────────────────────────────────────────────
  const reportPath = args.report && args.report !== true
    ? String(args.report)
    : `backfill-report-${schoolId}-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const totals = Object.values(report.collections).reduce((acc, b) => ({
    exact: acc.exact + b.exact.length,
    ambiguous: acc.ambiguous + b.ambiguous.length,
    orphan: acc.orphan + b.orphan.length
  }), { exact: 0, ambiguous: 0, orphan: 0 });

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  Enlazables : ${totals.exact}`);
  console.log(`  Ambiguas   : ${totals.ambiguous}   (requieren decisión humana)`);
  console.log(`  Huérfanas  : ${totals.orphan}   (no existe la ficha)`);
  console.log(`  Reporte    : ${reportPath}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 4. Escritura ─────────────────────────────────────────────────────────
  if (!apply) {
    console.log('🔍 Simulación: no se escribió nada en Firestore.');
    console.log('   Revisa el reporte y, si el resultado es correcto, repite con --apply.\n');
    if (totals.ambiguous || totals.orphan) {
      console.log('ℹ️  Lo ambiguo y lo huérfano NO se resuelve solo. Opciones:');
      console.log('   · Ambiguas : desambiguar a mano en la consola de Firestore, o');
      console.log('                corregir los nombres duplicados de la matrícula y repetir.');
      console.log('   · Huérfanas: son registros de estudiantes que nunca tuvieron ficha.');
      console.log('                Quedarán como "Sin ficha enlazada", que es la verdad.\n');
    }
    return;
  }

  if (!pendingWrites.length) {
    console.log('Nada que aplicar.\n');
    return;
  }

  const answer = await confirm(
    `⚠️  Se van a MODIFICAR ${pendingWrites.length} documentos de "${schoolId}".\n` +
    `   Solo se añaden campos de enlace; ningún dato clínico se altera.\n` +
    `   Escribe exactamente  APLICAR  para continuar: `
  );
  if (answer.trim() !== 'APLICAR') {
    console.log('\n✖ Cancelado. No se escribió nada.\n');
    return;
  }

  let written = 0;
  for (let i = 0; i < pendingWrites.length; i += BATCH_LIMIT) {
    const chunk = pendingWrites.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach(w => batch.update(w.ref, w.data));
    await batch.commit();
    written += chunk.length;
    console.log(`   … ${written}/${pendingWrites.length}`);
  }

  console.log(`\n✅ Migración aplicada: ${written} documentos enlazados.`);
  console.log('   Verifica en la app que las atenciones históricas ya no dicen "Sin ficha enlazada".\n');
}

main().catch(err => {
  console.error('\n✖ Error durante la migración:', err);
  console.error('  No se aplicaron cambios parciales dentro del lote que falló.\n');
  process.exit(1);
});
