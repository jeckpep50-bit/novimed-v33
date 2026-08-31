# NOVIMED — Verificación previa a la Fase 0
### 16 de agosto de 2026 · antes de publicar `firestore.rules` en producción

Antes de ejecutar los pasos manuales del RUNBOOK (`RUNBOOK.md §7`, que requieren la consola de Firebase y Cloud Shell, y por tanto credenciales que este entorno no tiene), se verificó todo lo que sí se puede probar sin tocar el proyecto Firebase real.

## 1. Build
`npm run build` reproduce exactamente lo que reporta `INFORME_ESTADO_V41.1.md §1`: `dist/assets/index.js` 106 kB (31.6 kB gzip) + chunk Firebase 698 kB (172 kB gzip).

## 2. Autoverificación del backfill
`node backfill-student-ids.mjs --self-test` → **14/14 correctas**. La lógica de emparejamiento (normalización, ambigüedad, idempotencia, límite de lote) es sólida antes de correrla contra datos reales.

## 3. Reglas vs. código, probado contra el emulador de Firestore (no a ojo)

Se añadió `firestore.rules.test.mjs` — 17 casos, corridos con `npm run test:rules` contra el emulador real (descarga el jar de Firestore la primera vez, no requiere proyecto ni credenciales). **17/17 pasan.**

Cubre:
- **Las 3 simulaciones que `RUNBOOK.md §7.1` exige correr en el Rules Playground** antes de publicar (`delete` sobre `students` → deniega; `create` en `careRecords` con `createdBy.uid` ajeno → deniega; archivado con `archivedReason` vacío → deniega), ahora automatizadas y repetibles en cada cambio de reglas.
- **Cada forma de payload que `sync.js` realmente envía hoy** (`addStudent`, `archiveStudent`, `updateStudent`, `confirmFamily`, el ciclo de `alerts` create→attended, `invUse`/`inventoryLog`) — todas aceptadas por las reglas actuales. **No hay ningún desajuste que vaya a producir el toast "Permiso denegado por el servidor" al desplegar.**
- Aislamiento multi-tenant, rol Consulta de solo lectura, la sesión anónima limitada a `eight-demo`, y el límite de 5 minutos hacia el futuro en `createdAt`.

Esto es, en efecto, adelantar una porción concreta de lo que `ROADMAP_V42.md §6` recomienda para V44 ("reglas en el emulador de Firestore") — y es exactamente lo que corresponde probar antes de un cambio de reglas en producción, no después.

## 4. Hallazgo: brecha en las reglas de `vaccines` (no bloqueante)

`careRecords`, `alerts` y `students` restringen sus `update` con `onlyChanges([...])` — solo se puede tocar una lista explícita de campos. `vaccines` (y `inventory`) **no tienen esa restricción**: cualquier usuario con permiso de escritura puede reescribir *cualquier* campo de un registro de vacunación existente, incluido `studentId`.

Riesgo actual: bajo. `A3` (`INFORME_ESTADO_V41.1.md §3`) ya documenta que Vacunas está muerto en producción — ningún código escribe ahí hoy salvo la siembra de la demo. El test `BRECHA CONOCIDA` en la suite lo deja documentado y reproducible para que no se repita sin querer cuando V43 reactive el módulo (`PLAN_DE_TRABAJO.md`, Fase 2): ahí es donde corresponde añadir el mismo `onlyChanges()` que ya tienen `careRecords` y `alerts`, no antes ni después.

## 5. Lo que queda fuera de este entorno

Estos tres pasos de `RUNBOOK.md §7` siguen requiriendo que alguien con acceso al proyecto Firebase (`novimed-2c5e9`) y a Netlify los ejecute — no se pueden automatizar desde aquí:

1. **Publicar `firestore.rules`** en Firebase Console (con las 3 simulaciones del Rules Playground — ya cubiertas arriba, pero repetirlas ahí es la única forma de confirmarlas contra el proyecto real).
2. **Backfill real**: `node backfill-student-ids.mjs --school=<ID> --dry-run` desde Cloud Shell, revisar el reporte, luego `--apply`.
3. **Deploy de V41.1** y el checklist de 9 puntos en iPad Safari.

Con la verificación de este documento, esos tres pasos se pueden ejecutar con la confianza de que el código y las reglas ya están probados a que coincidan — lo único que falta es tocar el proyecto real.
