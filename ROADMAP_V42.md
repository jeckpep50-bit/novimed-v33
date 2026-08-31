# NOVIMED V42 — Alertas como fuente de verdad única
### Hoja de ruta técnica · retirada del modelo de caso único

---

## 1. Qué problema cierra

**C4, el último crítico abierto.** Novimed sostiene el panel operativo sobre un documento único, `schools/{id}/meta/active-case`, heredado de la demo de V29. Ese documento representa *la* emergencia del colegio. En singular.

Consecuencias hoy, en producción:

- Dos incidentes simultáneos —una clase de educación física, una intoxicación en el bar, cualquier martes— se sobrescriben. El segundo pisa al primero.
- La primera alerta queda `pending` **para siempre**: nadie la cerrará, y su tiempo de respuesta nunca se mide. El KPI queda contaminado de forma permanente.
- `currentAlertDocId` es una variable de módulo, no un dato. Si el iPad recarga entre la alerta y la atención, el vínculo se pierde en silencio.
- El fallo ocurre precisamente en el escenario de mayor carga, que es cuando el sistema más se necesita. Y ocurre sin avisar.

**La colección `alerts` ya tiene todo lo necesario.** Ciclo de estados, timestamps reales, `studentId` desde V41, autoría desde V41. El trabajo de V42 no es construir un modelo nuevo: es dejar de leer del viejo.

---

## 2. Principio de diseño

> El estado operativo del colegio **es** el conjunto de alertas con `status == 'pending'`.
> No hay un caso; hay una cola. El panel es una vista de esa cola, no un documento aparte.

Todo lo que hoy vive en `active-case` o bien ya existe en `alerts`, o bien es teatro:

| Campo de `active-case` | Destino en V42 |
|---|---|
| `studentId`, `studentName`, `location`, `symptoms` | Ya están en el documento de `alerts` |
| `status` (`alert_pending`/`in_observation`/…) | Se unifica con `alerts.status` (`pending`/`attended`/`family_confirmed`) |
| `alertId` | Innecesario: la alerta **es** el registro |
| `careRecordId` | Pasa a `alerts.careRecordId` (ya escrito desde V41) |
| `doctorNotified`, `familyRead` | Derivados de `alerts.status`. Redundantes. |
| `alertTimeLabel`, `attentionTimeLabel` | Ya en `alerts.timeLabel` / `attendedTimeLabel` |
| `priority: "high"` literal | Sustituido por prioridad real elegida al reportar (A4) |

**Resultado: `meta/active-case` desaparece. No se migra: se retira.**

---

## 3. Ejecución en cuatro entregas

El orden importa. Cada fase deja el sistema desplegable; ninguna requiere un "big bang".

### V42.0 — Lectura dual (sin riesgo) ✅ Entregado — ver `CHANGELOG.md`
La app empieza a **leer** de `alerts` y sigue **escribiendo** en `active-case`. Si algo falla, se revierte publicando el deploy anterior sin tocar datos.

- Nuevo estado: `state.activeAlertId` (la alerta enfocada) y `state.pendingAlerts` (derivado de `state.alerts`).
- Implementado como una fuente **doble**, no como reemplazo: `mapFirestoreToLocalState()` (sync.js) sigue aportando la señal inmediata al iniciar sesión, y `applyQueueDerivedFocus()` (core.js, nueva, corre al inicio de cada `renderAll()`) resuelve desde `state.alerts` por `activeAlertId` con fallback a la `pending` más reciente, y GANA cuando resuelve. `activeAlert()` en sí no cambió de firma — sigue leyendo `state.currentAlert` — pero ese campo ahora lo mantienen ambas fuentes, no solo el documento. Se descubrió en la práctica que la versión "solo cola, sin fuente inmediata" dejaba un parpadeo a neutro entre el primer snapshot del caso y la conexión del listener de `alerts`; de ahí el diseño final.
- `renderAll()` deriva héroe y banderas (`alertSent`/`careSaved`/`familyRead`) de la cola cuando resuelve; el KPI de alertas (`kpiAlerts`) ya las derivaba de `state.alerts` desde antes de V42.
- **Criterio de aceptación, verificado con navegador real contra el emulador de Firestore + Auth** (`npm run test:smoke`, `smoke-test.mjs`), no solo por lectura de código: con `active-case` borrado manualmente y la página **recargada desde cero**, el panel sigue mostrando la alerta correcta. La demo `eight-demo` se verifica en el mismo test y su guion de ventas queda intacto.

### V42.1 — Corte de escritura
Se deja de escribir en `active-case` y se elimina el código muerto.

- `ensureCaseExists()`, `neutralCasePayload()`, `cleanDemoLeakOnce()`, `looksLikeDemoLeak()`, `linkDemoCaseOnce()` y `caseRef()` se retiran por completo (≈120 líneas).
- `currentAlertDocId` (variable de módulo) desaparece: el enlace vive en `state.activeAlertId` y sobrevive a recargas porque se recalcula de la cola.
- `submitCare()` actualiza directamente la alerta enfocada; `confirmFamilyRead()` resuelve por `alerts.careRecordId`.
- Reglas: se puede endurecer `match /meta/{docId}` a solo `seed`/`seed-alerts`.
- **Criterio de aceptación:** ninguna referencia a `active-case` en el código; la demo de ventas sigue funcionando.

### V42.2 — Cola real y prioridad (el valor visible)
Aquí es donde el cliente nota el cambio.

- **Multi-caso:** el panel muestra la cola de alertas pendientes ordenada por prioridad y luego antigüedad. El "incidente principal" pasa a ser la alerta enfocada, seleccionable desde la cola.
- **Prioridad real (cierra A4):** selector Alta/Media/Baja al reportar, con criterio explícito junto a cada opción para que el docente no tenga que interpretarlo bajo estrés. El gráfico "Alertas por prioridad" de Reportes deja de ser una constante.
- **Cierre explícito:** una alerta pendiente puede cerrarse sin atención con motivo obligatorio (falsa alarma, resuelta en aula, estudiante retirado). Hoy no hay forma de cerrarlas y por eso se acumulan.
- **Antigüedad visible:** una alerta pendiente con más de N minutos se destaca. Es el indicador que un director quiere ver y que hoy no existe.

### V42.3 — Feed de actividad real
Hoy `state.activities` se **reconstruye** desde `active-case` en cada snapshot: el feed "en tiempo real" pierde la historia real al reconectar (hallazgo B6).

- El feed pasa a derivarse de eventos reales: `alerts` + `careRecords` + `inventoryLog`, fusionados por `createdAt` y limitados a la ventana viva.
- Cada evento muestra su autor, disponible desde V41. La trazabilidad deja de ser una promesa del titular y pasa a ser visible en pantalla.

---

## 4. Cambios en reglas de Firestore

```
// alerts — prioridad validada y cierre con motivo
allow create: … && request.resource.data.priority in ['Alta','Media','Baja'];
allow update: … && onlyChanges([… ,'closedAt','closedReason','closedBy']);
//   cierre sin atención: closedReason string, 3..300 caracteres.

// meta — se restringe al haber desaparecido active-case
match /meta/{docId} {
  allow read:  if belongsTo(schoolId);
  allow write: if canWrite(schoolId) && docId in ['seed','seed-alerts'];
}
```

Se publican **antes** que el código de cada fase, igual que en V41.1 (RUNBOOK §7).

---

## 5. Riesgos y cómo se contienen

| Riesgo | Contención |
|---|---|
| La demo de ventas depende del teatro de `active-case` | V42.0 es dual: la demo sigue igual hasta V42.1, donde se resiembra `alerts` con el guion de Sofía. Validar la demo es criterio de aceptación de cada fase. |
| Alertas `pending` huérfanas ya acumuladas en producción | El cierre explícito de V42.2 es la herramienta para saldarlas. Antes de V42.2, revisarlas con el panel Sistema. |
| Dispositivos con V41.1 conviviendo con V42.1 | Durante V42.0 la escritura sigue siendo compatible. El salto a V42.1 exige que todos los dispositivos recarguen — el RUNBOOK ya cubre la recarga forzada en Safari. |
| Regresión silenciosa al reescribir el núcleo del panel | **Bloqueante:** las pruebas de V44 (funciones puras + reglas en emulador) deberían adelantarse a V42.0. Reescribir el corazón del sistema sin red de pruebas es cómo se generaron los defectos que acabamos de cerrar. |

---

## 6. Recomendación sobre el orden

Sugiero **adelantar la parte de pruebas de V44 antes de V42.0**. Son unas pocas horas: `calculateRisk`, `inventoryStatus`, la clasificación del backfill y las reglas en el emulador de Firestore (`schoolId` A no lee de B; `delete` denegado; autoría exigida).

El motivo no es formalismo. V42 reescribe el núcleo del panel operativo, y hasta hoy toda la validación de este proyecto ha sido manual, en tres pasadas, sobre un iPad. Ese método encontró los defectos —pero solo después de que llegaran a producción. Para un cambio de este calibre en un sistema que ya tendrá datos reales, conviene invertir el orden.

---

## 7. Definición de terminado para V42

1. `grep -r "active-case"` no devuelve nada en el código.
2. Dos alertas simultáneas de estudiantes distintos coexisten, se atienden y se cierran de forma independiente.
3. El tiempo de respuesta se mide correctamente en ambas.
4. Una recarga del navegador entre alerta y atención no rompe el vínculo.
5. "Alertas por prioridad" en Reportes muestra tres valores distintos con datos reales.
6. El feed muestra el autor de cada evento y sobrevive a una reconexión.
7. La demo `eight-demo` conserva su guion de ventas.
8. Checklist de iPad Safari, vertical y horizontal.
