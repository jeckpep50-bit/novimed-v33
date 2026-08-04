# NOVIMED — Arquitectura Técnica (V37)

## 1. Resumen del sistema
Novimed es una aplicación web de gestión médica escolar (SPA) construida con Vite (vanilla JS por diseño de migración progresiva), con Firebase como backend serverless (Firestore + Authentication) y despliegue continuo GitHub → Netlify.

## 2. Estructura del repositorio (plana, por restricción operativa iPad)
| Archivo | Responsabilidad |
|---|---|
| `index.html` | Maquetado completo de las 11 páginas y 5 modales. Sin JS/CSS inline estructural. |
| `main.js` | Punto de entrada. Orden de carga: css → core → sync → drawer. |
| `core.js` | Estado global, renders, acciones locales, búsqueda, modales, paginación, CSV, persistencia local. |
| `sync.js` | Módulo Firebase: init, auth anónima, caso activo, 6 colecciones, cola de reintentos, estado de sincronización. |
| `drawer.js` | Menú móvil off-canvas (autónomo). |
| `main.css` | Todo el estilo. Contiene capas históricas FIX V6–V29 con 129 `!important` (deuda conocida, consolidación prevista en fase React). |
| `vite.config.js` | Chunk separado para el SDK Firebase (caché de navegador). |
| `netlify.toml` | Build, publish, fallback SPA y cabeceras de seguridad. |

## 3. Flujo de datos
```
Usuario → acción UI (onclick/window.*)
  → core.js muta intención
     → si nube lista: window.novimedCloud*(payload, opId)   [sync.js]
         → éxito: listener onSnapshot actualiza state → renderAll
         → fallo: copia local con _pendingOpId + encolado en QUEUE
     → si nube no lista: mutación local directa (modo local)
  → renderAll() (coalescido, 1 por tick) → persistState() (debounce 400ms)
```

## 4. Modelo de datos Firestore
Raíz multi-tenant: `schools/{SCHOOL_ID}/…` (V37: `SCHOOL_ID` constante `eight-demo`; V38 lo hará dinámico por claims).

| Colección | Documento | Campos clave | Orden |
|---|---|---|---|
| `students` | ficha | fullName, age, course, contacts[], allergies, chronic, …, `clientOpId?`, `createdAt` | asc |
| `careRecords` | atención (inmutable salvo `family`) | date, time, student, bodyArea, eva, symptoms, presumptiveDiagnosis, actionDone, medication, derivation, family, `createdAt` | desc |
| `alerts` | alerta con ciclo de vida | studentName, location, symptoms, priority, `status: pending→attended→family_confirmed`, timeLabel, attendedAt, familyConfirmedAt, `createdAt` | desc |
| `inventory` | ítem | name, category, stock (número), min, expires, `createdAt` | asc |
| `inventoryLog` | movimiento (auditoría) | time, name, qty, student, context, `createdAt` | desc |
| `vaccines` | registro | student, course, age, reference, status, next, `createdAt` | asc |
| `meta/seed`, `meta/seed-alerts` | banderas de siembra (transaccionales) | seededAt, version | — |
| `schools/{id}/meta/active-case` (V38; antes cases/active-alert, hoy huérfano) | foco operativo efímero del dashboard | status, studentName, alertId, familyRead, … | — |

`createdAt` es epoch-ms numérico en todas las colecciones (orden estable, sin mezclar tipos).

## 4b. Rendimiento y límites (V39)
- **Ventanas en vivo**: `careRecords`, `alerts`, `inventoryLog` escuchan los 200 documentos más recientes; `vaccines` 500. `students` e `inventory` sin límite por diseño (catálogos operativos que la UI necesita completos para búsqueda, fichas y selector de medicación).
- **Histórico bajo demanda**: `novimedLoadOlder(coll)` pagina por cursor (`startAfter` + `limit(200)`) sin abrir listeners nuevos. La UI lo expone en el mismo pager de tabla cuando la vista local se agota.
- **Render selectivo**: los renders de página se omiten si su sección no está visible y quedan marcados como pendientes; `showPage()`, el cambio de tenant y el cambio de rol fuerzan un ciclo completo. Inicio se renderiza siempre (alimenta KPIs e indicadores globales).
- Efecto combinado: el costo de lecturas Firestore deja de crecer con el historial del colegio, y el trabajo de DOM por evento baja de 11 páginas a 1 + Inicio.

## 5. Estrategia offline (V37)
1. **Lectura**: caché localStorage `novimed_local_state_v2` con envoltura `{schema, savedAt, data}`. Esquema desconocido/corrupto ⇒ descarte seguro. Migración automática única desde `…_v1`.
2. **Escritura**: cola `novimed_pending_ops_v1` con backoff 25s/60s/180s/300s, máx 6 intentos; disparadores: intervalo 25s, evento `online`, `novimedProcessQueueNow()`. Deduplicación: el doc lleva `clientOpId`; el merge de listeners descarta la copia local `_pendingOpId` cuando el doc llega. `not-found` en reintento ⇒ convergencia (éxito terminal). Tras 6 intentos ⇒ `abandoned` (dato conservado localmente, aviso único, visible en panel Sistema).
3. **Exclusiones deliberadas**: caso activo y alerta docente no se reencolan (reproducir coordinación efímera con horas de retraso induciría a error clínico).
4. **Transporte**: long polling forzado (WebChannel se corta en Safari/iPad y redes escolares).

## 6. Seguridad — postura actual vs objetivo
| Capa | V37 (actual) | Objetivo V38 |
|---|---|---|
| Identidad | Email/contraseña + claims (`role`,`schoolId`) con demo anónima conviviendo | App Check, SSO |
| Roles | Simulados en UI | SuperAdmin, Admin_Colegio, Personal_Salud, Consulta |
| Reglas Firestore | `auth != null` global (V38b las endurece) | Mínimo privilegio por tenant y rol vía claims |
| XSS | `escapeHtml` en todo dato de usuario + whitelist de colores | Igual |
| Clave web | Restringida por referrer + 3 APIs + App Check (V40, opt-in por variable) | Enforce tras periodo monitor |
| Entradas | Saneo central en `readOptional` (control chars, 500 máx) | Igual + validación server-side futura |

## 7. Contratos internos (window.*)
`novimedState` · `novimedRenderAll` · `novimedShowToast` · `novimedCloudAdd{Student,InventoryItem,CareRecord}(payload,opId)` · `novimedCloudUseInventory(itemId,logEntry,opId)` · `novimedCloud{UpdateStudent,DeleteStudent}` · `novimedCloudConfirmFamily` · `novimedNewOpId` · `novimedPendingOpsCount` · `novimedProcessQueueNow` · `novimedSyncStatus` · `novimedSchoolLabel` · handlers UI exportados al final de core.js.

## 8. Deuda técnica reconocida
CSS con capas FIX/`!important` (consolidar en fase React) · `renderAll` global (renders selectivos = propuesta P6, aislada por riesgo) · 8 clases CSS sin referencia (remoción requiere parser CSS real) · riesgo residual de doble decremento en `invUse` si la red cae entre aplicación y ACK (mitigable con Cloud Functions en fase backend).
