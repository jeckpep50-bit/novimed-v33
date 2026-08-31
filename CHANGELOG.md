# NOVIMED — Changelog

## Reglas — Derecho de eliminación (LOPDP)

Hasta ahora ningún historial clínico podía borrarse, ni siquiera con rol SuperAdmin (`allow delete: if false;` en todas las colecciones clínicas). Eso es correcto como postura por defecto, pero deja sin forma técnica de atender el derecho de eliminación de datos personales (LOPDP, Ecuador) cuando un padre o tutor lo solicita para su hijo.

- **Nueva colección `erasureLog/{studentId}`**: un documento por estudiante, con el `studentId` como ID del documento. Solo `SuperAdmin` puede crearlo (autoría verificada, motivo de 10 a 500 caracteres). **Create-only**: nunca se puede actualizar ni borrar, así que sigue existiendo como prueba permanente incluso después de que el resto de los datos del estudiante se haya borrado.
- **El borrado real de `students`, `careRecords`, `alerts`, `vaccines` e `inventoryLog` ahora requiere dos condiciones a la vez**: rol `SuperAdmin` (nunca `Admin_Colegio` ni `Personal_Salud`), y que ya exista `erasureLog/{studentId}` para ese estudiante. Las reglas lo exigen directamente vía `exists()` — no es solo disciplina de procedimiento, un intento de borrar sin el registro previo se deniega en el servidor. Un registro huérfano (sin `studentId`, nunca enlazado a una ficha) queda protegido por defecto: no hay forma de que exista el `erasureLog` correspondiente.
- 9 pruebas nuevas contra el emulador de Firestore (`tests/firestore.rules.test.mjs`, 27/27 en total): que ni `Admin_Colegio` ni `Personal_Salud` puedan crear el registro, que el motivo corto o el ID no coincidente se rechacen, que el registro sea inmutable, que `SuperAdmin` no pueda borrar sin el registro y sí pueda una vez creado (para las 5 colecciones), y que un huérfano sin `studentId` no se pueda borrar aunque existan registros de otros estudiantes.
- **Falta lo legal, no lo técnico**: cómo se verifica que quien pide el borrado es realmente el padre o tutor, plazos de respuesta, y si aplica alguna excepción de retención — ver `PLAN_DE_TRABAJO.md`, Fase 5.
- `RUNBOOK.md §7.1` gana una cuarta simulación obligatoria en el Rules Playground antes de publicar: `SuperAdmin` intentando borrar sin `erasureLog` previo debe denegarse.

## V42.0 — Lectura dual: el héroe deja de fiarse del caso único

Primera entrega de `ROADMAP_V42.md` (cierra el crítico C4 en cuatro fases; esta es la fase 1, sin riesgo por diseño: se sigue escribiendo en `active-case` igual que antes).

- **`activeAlert()` deja de depender solo de `meta/active-case`.** El héroe, sus banderas (`alertSent`/`careSaved`/`familyRead`) y el foco (`state.activeAlertId`, nuevo) se derivan ahora también de la cola real `alerts` en `applyQueueDerivedFocus()` (`core.js`, invocada al inicio de cada `renderAll()`). Diseño deliberadamente **dual, no destructivo**: el documento único sigue siendo la señal inmediata al iniciar sesión (`mapFirestoreToLocalState`, `sync.js`), y la cola es la señal resiliente que gana cuando resuelve — si el documento se borra o vuelve a un payload neutro, `state.activeAlertId` (pegajoso, igual que `currentAlertDocId`) sigue apuntando a la alerta real y `resolveActiveAlertFromQueue()` la recupera de `state.alerts`.
- **Criterio de aceptación verificado con navegador real**, no solo por lectura de código: `scripts/smoke-test.mjs` (`npm run test:smoke`) levanta Firestore + Auth emulator, siembra una institución con una alerta pendiente real, confirma que el héroe la muestra, **borra `active-case` a mano y recarga la página desde cero** (sin nada en memoria) — el héroe sigue mostrando la alerta correcta porque la lee de la cola. La demo `eight-demo` se verifica en paralelo: su guion de ventas (Sofía Martínez) sigue intacto, tal como exige `ROADMAP_V42.md §5`.
- Un defecto real se encontró y cerró en el proceso: la primera versión de este cambio dejaba el héroe en un `renderAll()` transitorio en neutro entre el momento en que `startRealtimeSync()` recibe el documento y el momento en que `attachCollectionListeners()` conecta el listener de `alerts` — el fallback "conservar el valor previo" no cubría ese instante porque `mapFirestoreToLocalState` había dejado de escribir la señal inmediata. Se corrigió manteniendo ambas fuentes activas (ver arriba).
- Infraestructura de pruebas nueva, reutilizable a partir de aquí: `tests/firestore.rules.test.mjs` (17 casos contra el emulador real de Firestore, `npm run test:rules`) y `scripts/smoke-test.mjs` (smoke E2E de navegador contra Firestore + Auth emulator, `npm run test:smoke`). Ambos exigen `VITE_USE_EMULATOR=true` explícito (inerte por defecto, mismo patrón defensivo que App Check) — nunca tocan el proyecto Firebase real.

## V41.1 — Vista Docente: formulario real

- **Hallazgo:** el panel de Vista Docente traía `value="Sofía Martínez"` y los síntomas del caso demo escritos en el textarea. Peor aún, esos dos campos **nunca se leían**: aparecían una sola vez en el proyecto —en su propia plantilla— y el botón abría el modal descartando lo que el docente hubiera escrito.
- **Causa del prellenado:** el panel se reconstruía con `innerHTML` en cada `renderAll()`, así que cualquier texto real se perdía; los valores fijos disimulaban el problema.
- Panel reconstruido como formulario controlado en Vanilla JS: se construye **una vez** y después solo se refrescan opciones y validación, de modo que escribir no destruye foco ni contenido.
- Estado inicial en blanco (`studentId`, `studentName`, `location`, `symptoms` vacíos; `isSubmitting:false`).
- Combobox de estudiante alimentado desde la matrícula real (solo fichas activas), con teclado (↑/↓/Enter/Esc), roles ARIA y objetivos táctiles de 44px.
- Al seleccionar estudiante se muestran sus alergias y condiciones derivadas de la ficha, antes de enviar.
- Botón deshabilitado sin estudiante enlazado o con síntomas vacíos (`symptoms.trim() === ""`), y durante el envío. Errores de validación inline con `role="alert"`.
- Reset completo del formulario únicamente tras un envío procesado con éxito.
- `submitTeacherAlert(payload)` acepta ahora un payload: modal y panel docente comparten un único camino de escritura.

## V41 (actual) — Verdad clínica: autoría, claves foráneas y archivado

**V40.1 — Hotfix de seguridad clínica (incluido)**
- El aviso de alergias del incidente era HTML estático (`Alergia conocida: maní`) que ningún render tocaba: en cualquier institución real afirmaba alergia al maní para cualquier estudiante. Ahora deriva de la ficha enlazada por `studentId` y declara explícitamente "Sin ficha enlazada — verificar manualmente" cuando no hay vínculo. Sin valores por defecto en campos clínicos.
- El campo `allergy` desaparece del modelo del caso: era un dato copiado que la UI mostraba como verificado. Las alergias se derivan siempre de la ficha en tiempo de render.
- Modal de alerta docente: se retiran los prellenados demo (Sofía Martínez / Aula 3B / síntomas) y el estudiante pasa a elegirse de la matrícula real. El texto libre queda como excepción explícitamente rotulada como "sin ficha enlazada".
- Módulo Familias: se retira "Simular confirmación familiar" de instituciones reales. El estado honesto es **Notificación registrada · lectura no confirmada**; la simulación queda rotulada y confinada a `eight-demo`. Los nombres fijos (Ana Martínez / Sofía) se sustituyen por los contactos de emergencia de la ficha.
- Badge "3 activas" del Centro de alertas: dinámico.

**V41 — Trazabilidad y esquema**
- **Autoría obligatoria**: toda escritura clínica lleva `createdBy {uid, email, role}` + `serverCreatedAt`/`updatedAt` de servidor. `authored()` es el único camino a Firestore. El sentinel `serverTimestamp()` se aplica al ejecutar, nunca en el payload que puede quedar encolado en localStorage.
- **Claves foráneas**: `alerts`, `careRecords`, `vaccines` e `inventoryLog` usan `studentId`. `studentName` queda desnormalizado solo para lectura. Los documentos anteriores se normalizan en el mapper (`student` → `studentName`) sin reescribir el histórico.
- **Archivado lógico**: `deleteStudent` (borrado en duro con `window.confirm`) se sustituye por `archiveStudent` con motivo obligatorio y autoría. `deleteDoc` desaparece del código. El tipo de cola `deleteStudent` se remapea al archivado para drenar con seguridad las operaciones pendientes de V40.
- **`invUse` atómico**: `Promise.all` de dos escrituras → `writeBatch`. Elimina el riesgo de doble descuento de stock en reintentos (deuda reconocida en ARCHITECTURE §8).
- **Confirmación familiar corregida**: escribía sobre `careRecords[0]` (el más reciente); ahora resuelve por el `careRecordId` que el caso enlaza. Sin vínculo, no escribe sobre ningún expediente.
- `inventoryLog` pasa de array posicional a objeto con `date` y `studentId`.

## V40 — Infraestructura: App Check y entornos
- App Check (reCAPTCHA v3) integrado con diseño defensivo: sin clave configurada queda inerte y la app funciona igual; un fallo suyo nunca deja sin servicio al personal de salud.
- Configuración de Firebase por variables de entorno: un sitio de staging apunta a otro proyecto sin tocar código (`.env.example` documenta todas).
- Entorno y estado de App Check visibles en Configuración → Sistema.
- RUNBOOK ampliado: rollout de App Check en tres tiempos, montaje de staging y política de backups con prueba de restauración.


## V39 — Techos de escalabilidad (H2) y rendimiento (H1)
- H2: ventanas en vivo acotadas por colección + carga de histórico por cursor en el pager de Atenciones y Alertas. El costo de lecturas deja de ser proporcional al historial acumulado.
- H1: render selectivo con seguimiento de páginas pendientes; ciclo completo forzado al navegar, al cambiar de institución y al cambiar de rol.
- Documentación de arquitectura ampliada (§4b) con los límites, cursores y su justificación.


## V38a.2 — Corrección 360 de corteza demo
- Hallazgo raíz: el H1 del héroe era HTML estático jamás conectado al estado (por eso persistía "Sofía" en tenants reales); ahora es dinámico.
- Chip lateral, badges de campana/menú y KPI "Tiempo respuesta" ahora dinámicos y conscientes del tenant; fallbacks teatrales quedan exclusivos de la demo.
- Marcador de versión V38.2 visible en Sistema para verificar qué build corre.

## V38a.1 — Hotfix de contaminación demo
- El caso activo de tenants reales nace en estado neutro ("Sin alertas activas"); el teatro de Sofía queda exclusivo de eight-demo.
- Descontaminación automática única de casos ya sembrados con la firma demo en instituciones reales.
- Textos de mapeo, feed vacío y alergia de alerta ahora son conscientes del tenant.

## V38a — Identidad y multi-tenant real (P2 fase 1)
- Compuerta de autenticación: login email/contraseña con mapeo de errores en español + "Explorar demo" (anónimo). Sesiones anónimas existentes se reanudan sin corte.
- Claims del token (`role`, `schoolId`) resuelven la institución: `SCHOOL_ID` deja de ser constante. Cuenta real sin institución ⇒ bloqueo seguro (denegación por defecto).
- Tenants reales nacen VACÍOS (sin datos demo); `eight-demo` intacto como entorno de ventas con restauración prístina.
- Aislamiento por institución de: caché local, cola offline y caso activo (ahora `schools/{id}/meta/active-case`).
- Roles: Consulta = solo lectura con doble guarda (UI + wrappers de nube); Personal_Salud/Admin_Colegio/SuperAdmin escriben. Identidad visible en sidebar y panel Sistema; cierre de sesión con teardown completo de listeners.

## V37 — Hardening P5 + Documentación P7
- Cola de reintentos offline persistente (backoff 25s→300s, 6 intentos, dedupe por `clientOpId`, `not-found`=convergencia, estado visible en Sistema).
- Caché local con esquema versionado (`v2`) + migración automática desde v1 + descarte seguro de corruptos.
- Guardas de forma en los 6 listeners (un doc malformado no rompe el render) y saneo por colección (stock numérico, nombres string).
- Saneo central de entradas en `readOptional` (control chars fuera, tope 500).
- Tope de 100 en el feed de actividades (sesiones largas).
- Documentación de mantenimiento: ARCHITECTURE.md, RUNBOOK.md, CHANGELOG.md.

## V36 — CRUD y utilidades de operación
Editar/Eliminar fichas (update/deleteDoc + fallback), paginación (15+“Mostrar más”), exportación CSV (BOM, escapado), estados vacíos, Enter-para-abrir en búsqueda, panel Sistema en Configuración, renders coalescidos, persistencia con debounce.

## V35 — Estructura plana certificada
Migración a raíz plana (restricción iPad), corrección de `<link>` roto, auditoría zero-defect (3 pasadas + 13 smoke tests), chunk separado de Firebase, netlify.toml con SPA fallback y cabeceras, engines, lockfile.

## V33–V34 — Datos honestos
V33: `alerts` como colección real con ciclo pending→attended→family_confirmed, KPI de alertas real, siembra transaccional. V34: reportes 100% dinámicos (casos cerrados, tiempo de respuesta con timestamps reales, % lectura, prioridades, top motivos), fix del KPI teatral 27/28.

## V31–V32 — Backend real y proyecto profesional
V31: modelo multi-colección `schools/{id}` (students, careRecords, inventory, inventoryLog, vaccines), siembra única transaccional, stock atómico, anti-pérdida en merges. V31.x: long polling (fix Safari/iPad), relectura por visibilidad, KPI atenciones real. V32: migración de monolito a proyecto Vite multi-archivo con CI GitHub→Netlify.

## V30 — Blindaje del monolito
XSS cerrado en todos los renders, persistencia localStorage, búsqueda real, Escape+foco en modales, guardas anti-crash, aria mejoras, diagnóstico visible (toasts de sync), autenticación anónima gateando la sincronización, rotación de API Key + Security Rules.

## V29 (base) — Prototipo de presentación
Monolito HTML de alta fidelidad con flujos simulados y credenciales expuestas (estado auditado inicial: 12–15% de producto).
