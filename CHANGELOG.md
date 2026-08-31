# NOVIMED — Changelog

## V42.2.0 — A1 y A2: derecho de eliminación con interfaz, y triaje posible

### A2 — La regla de estados era un error de diseño mío

V42.0.1 introdujo `request.resource.data.status in ['attended', ...]` para
impedir que una alerta volviera a `pending` y borrara su medición de tiempo
de respuesta. La intención era correcta; la implementación, no: esa condición
valida el **estado final**, no la **transición**. El efecto real era que
*ninguna* escritura podía dejar una alerta en `pending` — bloqueando
reasignar prioridad, enlazar una ficha o destacar una alerta antigua, que son
justamente las funciones de V42.2. Habría aparecido como un
`permission-denied` incomprensible al escribir ese código.

Se sustituye por una máquina de estados explícita (`validAlertTransition()`):

    pending          → pending | attended | closed_none
    attended         → attended | family_confirmed | closed_none
    family_confirmed → family_confirmed   (terminal)
    closed_none      → closed_none        (terminal)

El avance sigue siendo irreversible, que era el objetivo original, pero ahora
sin efectos colaterales. Se añade además una rama separada para el triaje:
cambiar `priority` sobre una alerta en cola es legítimo y **no puede colar un
cambio de estado**, porque las dos ramas están deliberadamente disjuntas.
`priority` se valida contra el catálogo Alta/Media/Baja tanto al crear como al
actualizar.

**Nota de despliegue**: el endurecimiento de `alerts` de V42.0.1 nunca llegó a
`firestore.rules` en el repositorio (sí llegó el de `inventory`), pero sus 3
pruebas sí. Esos casos habrían fallado contra las reglas publicadas. Esta
versión aplica ambas cosas de forma coherente: autoría verificada
(`updateAuthoredByCaller()`) más la máquina de estados.

### A1 — El derecho de eliminación ya se puede ejercer

Desde V42.0 las reglas exigen `erasureLog/{studentId}` antes de permitir
cualquier borrado real, pero **ningún código de la aplicación podía crear ese
documento**. La función estaba protegida y, a la vez, era imposible de
ejercer: ante una solicitud de un padre habría que entrar a la consola de
Firebase y escribir el documento a mano, sin validación, sin trazabilidad de
quién autorizó y sin que el runbook lo explicara. Una función legal que solo
existe en las reglas no es una función entregada.

- `window.novimedRegisterErasureRequest(studentId, reason)` en `sync.js`.
- Panel **Derecho de eliminación (LOPDP)** en Configuración, revelado solo a
  SuperAdmin. Ocultarlo es comodidad de interfaz, no seguridad: quien manda
  son las reglas, que rechazan la escritura venga de donde venga.
- Confirmación con el nombre del estudiante delante, porque el registro es
  permanente (`allow update, delete: if false`) y una constancia sobre la
  ficha equivocada no se puede corregir.
- El texto de la interfaz insiste en lo que la función **no** hace: registrar
  la solicitud no borra nada. El borrado sigue siendo posterior y deliberado.

### Pruebas

**44 casos de reglas** (antes 33) y 13 de purga. Los 11 nuevos cubren: las
seis transiciones válidas e inválidas de la alerta, que el triaje no pueda
colar un cambio de estado, la prioridad fuera de catálogo, y el ciclo completo
del `erasureLog` — que un SuperAdmin puede registrar, que Personal_Salud no,
que un motivo corto se rechaza y que la constancia no se puede editar ni
borrar.

### Higiene

`purge-test.mjs` se renombra a **`purge-test.mjs`**. La subida web desde
iPad convierte el segundo punto del nombre en guion bajo
(`local-purge_test.mjs`), lo que dejaba `npm run test:purge` apuntando a un
archivo inexistente. Un solo punto en el nombre elimina el problema de raíz.

## V42.1.0 — A4: los datos clínicos no sobreviven al cierre de sesión

Cierra el bloqueante legal identificado en la auditoría 360. Hasta V42.0.2,
`novimedLogout` solo llamaba a `signOut()`: todo lo que la app había escrito
en `localStorage` permanecía en el dispositivo indefinidamente.

En un iPad compartido de enfermería —el escenario real de Novimed— eso
significaba que las fichas completas de menores (alergias, condiciones
crónicas, teléfonos de contacto), las atenciones, las vacunas y el inventario
de una institución quedaban en el equipo después de que su responsable cerraba
sesión. Bajo la LOPDP ecuatoriana es tratamiento de datos sensibles sin base
de conservación.

**Nuevo módulo `local-purge.js`**
Puro y sin dependencias del navegador: recibe el almacén por argumento, lo que
permite probarlo en Node. Purga por prefijo SIN número de versión, para
llevarse también los esquemas antiguos (`v1`) que quedaron de migraciones.

**Los dos almacenes no se tratan igual — y esa es la decisión de fondo**
- `novimed_local_state_v*` es una **caché de lectura**, reconstruible entera
  desde Firestore. Se borra siempre.
- `novimed_pending_ops_v*` es la **única copia** de escrituras clínicas que
  todavía no llegaron al servidor. Borrarla a ciegas destruiría registros que
  nadie más tiene — un daño peor que el que se quiere evitar.

**Cierre voluntario** (`novimedLogout`): si hay operaciones pendientes, primero
intenta enviarlas; si algo queda, dice cuántos registros son y que son la única
copia, y pide confirmación explícita. Solo entonces purga todo. La purga ocurre
ANTES del `signOut()`: si fuera después y el `signOut` fallara sin red, el
usuario se quedaría con la sesión abierta creyendo que los datos ya no están.

**Cierre involuntario** (token caducado, credenciales revocadas, cuenta
deshabilitada): se purga la caché igual, pero se **conserva la cola**
(`keepQueue: true`). Ahí no hubo oportunidad de advertir a nadie, y perder
trabajo clínico en silencio por una expiración de token sería inaceptable. Se
subirá al volver a entrar.

**Estado en memoria**: también se vacía. Sin eso, el siguiente `renderAll()`
volvería a persistir en disco justo lo que se acaba de borrar.

**13 pruebas nuevas** (`npm run test:purge`, sin emulador ni navegador) que
verifican las tres decisiones de diseño: la caché siempre desaparece; la cola
con trabajo no desaparece sin advertencia; y nada ajeno a Novimed se toca. Se
cubren los tenants múltiples del mismo equipo, los esquemas antiguos, la cola
corrupta, la doble purga y Safari en modo privado. `npm test` las ejecuta
primero, porque son las únicas que corren sin infraestructura.

**También corregido — A3, mismo ciclo de sesión**
`setInterval(processQueue, 25000)` se creaba a nivel de módulo y no se detenía
nunca: tras cerrar sesión seguía disparando cada 25 segundos contra
`SCHOOL_ID = null`. Ahora se ata al ciclo de sesión, como los listeners de
Firestore: `startQueueTimer()` al entrar, `stopQueueTimer()` al salir.

**Consecuencia asumida**: la caché ya no sobrevive entre sesiones, así que el
primer arranque tras iniciar sesión necesita red. Es el precio correcto: en un
dispositivo compartido, la historia clínica de un menor no debe seguir ahí
cuando la sesión ya no existe.

## V42.0.1 — Hotfix de verdad clínica, navegación y reglas

Corrige defectos que sobrevivieron a las barridas de V40.1 y V41 y que solo
se manifiestan en una institución real, nunca en la demo de ventas.

**Bloqueantes (P0)**
- **Panel directivo (`core.js`, `renderRoles`)**: mostraba en TODA institución
  «96% de lectura», «2 casos críticos», «2m 34s de respuesta» y una tabla
  titulada *Trazabilidad del caso Sofía Martínez* con horas fijas. No estaba
  protegido por `isDemoTenant()`. Ahora los cuatro KPIs y la trazabilidad se
  derivan de `alerts`/`careRecords` con autoría real, y la ausencia de datos
  se declara («—», «sin mediciones aún») en vez de rellenarse.
- **Feed de actividad (`sync.js`, `mapFirestoreToLocalState`)**: inyectaba
  «Andrés Sánchez recibió alerta» y «Ana Martínez pendiente de lectura» en
  cualquier colegio, atribuyendo actos a personas inexistentes. Usa ahora el
  autor real (`updatedBy`, disponible desde V41) o texto impersonal.
- **Caída total de la interfaz por un documento de vacunas sin `status`**:
  `v.status.includes()` lanzaba `TypeError` dentro de `renderAll()`, que no
  tenía ningún aislamiento, abortando el ciclo completo (KPIs, héroe,
  reportes) sin error visible. Se normaliza en el mapper y **cada sección de
  `renderAll()` queda aislada**: la que falle se registra y el resto se
  actualiza igual.
- **El enlace atención↔alerta se persistía como `null`**: `submitCare` en
  `sync.js` no esperaba al `addDoc` de la atención antes de escribir
  `careRecordId`, así que el FK que V41 introdujo quedaba vacío en Firestore
  y se perdía al recargar. La función local devuelve ahora su promesa y se
  espera antes de enlazar.

**Producto (P1)**
- **Módulo Riesgo revivido**: `state.riskProfiles` se vaciaba al activar un
  tenant real y nada volvía a llenarlo — tabla vacía sin estado vacío,
  contadores en 0/0/0 y el KPI de Reportes fijo en 0. Se deriva ahora de
  fichas + alertas + atenciones. `calculateRisk()` no cambia.
- **Prioridad real (cierra A4)**: se escribía siempre `"Alta"`, de modo que
  el gráfico «Alertas por prioridad» no podía mostrar otra cosa. Selector
  Alta/Media/Baja con el criterio explícito junto a cada opción.
- **Navegación**: Atenciones, Riesgo, Vacunas e Inventario existían como
  páginas pero no tenían entrada en el menú; el registro médico escolar solo
  se alcanzaba desde un botón dentro de una tarjeta. 11 páginas, 11 entradas.
- **Atención sin matrícula**: `submitCare` caía a `students[0]` (undefined) y
  creaba un registro clínico huérfano con `studentId: null`. Se bloquea en
  `openAttentionModal()`.
- **Acoplamiento de render**: `renderRoles` copiaba el HTML de `#familyNotices`,
  que el render selectivo de V39 podía no haber actualizado. Se fuerza el
  render de origen antes de copiar.
- **Cola offline**: `queueRunning` no se liberaba en un `finally`; una
  excepción inesperada dejaba la cola bloqueada el resto de la sesión.

**Reglas de Firestore**
- `alerts`: el `update` no exigía `updateAuthoredByCaller()` — `attendedBy` y
  `familyConfirmedBy` eran campos que el cliente afirmaba sin verificación,
  contra el principio nº 4 del propio archivo. Y `status` admitía cualquier
  cadena: se podía devolver una alerta a `pending` y borrar su medición de
  respuesta. Ambos cerrados; se añaden los campos de cierre de V42.2.
- `inventory`: el `update` no tenía `onlyChanges()` ni autoría, así que
  `stock` se podía reescribir en silencio sin rastro en `inventoryLog` — pese
  a que el comentario del archivo afirmaba lo contrario. Campos acotados,
  autor verificado y `stock` validado como número no negativo.
- **6 pruebas nuevas** que ejercen exactamente estos tres huecos (33 casos en
  total), incluida una que confirma que el descuento real de `invUse` sigue
  aceptándose.
- *No* se toca `vaccines`: su brecha está deliberadamente documentada por un
  test que asserta el comportamiento actual y rastreada para V43/A3. Cerrarla
  aquí rompería ese test sin cerrar el módulo, que sigue muerto en producción.

**Higiene del repositorio**
- `firestore.rules 2.txt`, `smoke-test.js` y `gitignore` eran renombrados
  accidentales de la subida web desde iPad: los archivos correctos existían
  con el nombre equivocado, así que las reglas nuevas no estaban activas,
  `test:smoke` ejecutaba la versión rota y el `.gitignore` no surtía efecto.
  Restaurados. `CAMBIOS.diff` eliminado del repositorio.
- Referencias a `tests/` y `scripts/` corregidas en CHANGELOG, PLAN_DE_TRABAJO,
  ROADMAP_V42 y VERIFICACION_FASE0: esos directorios nunca existieron.
- `NOVIMED_VERSION` y `package.json` alineados en 42.0.1. El marcador del
  panel Sistema vuelve a servir para verificar despliegues.

**Pendiente, no incluido aquí**: limpieza de `localStorage` al cerrar sesión
(PHI de menores persiste en iPads compartidos tras el logout — bloqueante
legal antes del piloto), consolidación de los 129 `!important` de `main.css`,
y el contraste de `--muted` (#71819b = 3,95:1, falla WCAG AA).

## Reglas — Derecho de eliminación (LOPDP)

Hasta ahora ningún historial clínico podía borrarse, ni siquiera con rol SuperAdmin (`allow delete: if false;` en todas las colecciones clínicas). Eso es correcto como postura por defecto, pero deja sin forma técnica de atender el derecho de eliminación de datos personales (LOPDP, Ecuador) cuando un padre o tutor lo solicita para su hijo.

- **Nueva colección `erasureLog/{studentId}`**: un documento por estudiante, con el `studentId` como ID del documento. Solo `SuperAdmin` puede crearlo (autoría verificada, motivo de 10 a 500 caracteres). **Create-only**: nunca se puede actualizar ni borrar, así que sigue existiendo como prueba permanente incluso después de que el resto de los datos del estudiante se haya borrado.
- **El borrado real de `students`, `careRecords`, `alerts`, `vaccines` e `inventoryLog` ahora requiere dos condiciones a la vez**: rol `SuperAdmin` (nunca `Admin_Colegio` ni `Personal_Salud`), y que ya exista `erasureLog/{studentId}` para ese estudiante. Las reglas lo exigen directamente vía `exists()` — no es solo disciplina de procedimiento, un intento de borrar sin el registro previo se deniega en el servidor. Un registro huérfano (sin `studentId`, nunca enlazado a una ficha) queda protegido por defecto: no hay forma de que exista el `erasureLog` correspondiente.
- 9 pruebas nuevas contra el emulador de Firestore (`rules-test.mjs`, 27/27 en total): que ni `Admin_Colegio` ni `Personal_Salud` puedan crear el registro, que el motivo corto o el ID no coincidente se rechacen, que el registro sea inmutable, que `SuperAdmin` no pueda borrar sin el registro y sí pueda una vez creado (para las 5 colecciones), y que un huérfano sin `studentId` no se pueda borrar aunque existan registros de otros estudiantes.
- **Falta lo legal, no lo técnico**: cómo se verifica que quien pide el borrado es realmente el padre o tutor, plazos de respuesta, y si aplica alguna excepción de retención — ver `PLAN_DE_TRABAJO.md`, Fase 5.
- `RUNBOOK.md §7.1` gana una cuarta simulación obligatoria en el Rules Playground antes de publicar: `SuperAdmin` intentando borrar sin `erasureLog` previo debe denegarse.

## V42.0 — Lectura dual: el héroe deja de fiarse del caso único

Primera entrega de `ROADMAP_V42.md` (cierra el crítico C4 en cuatro fases; esta es la fase 1, sin riesgo por diseño: se sigue escribiendo en `active-case` igual que antes).

- **`activeAlert()` deja de depender solo de `meta/active-case`.** El héroe, sus banderas (`alertSent`/`careSaved`/`familyRead`) y el foco (`state.activeAlertId`, nuevo) se derivan ahora también de la cola real `alerts` en `applyQueueDerivedFocus()` (`core.js`, invocada al inicio de cada `renderAll()`). Diseño deliberadamente **dual, no destructivo**: el documento único sigue siendo la señal inmediata al iniciar sesión (`mapFirestoreToLocalState`, `sync.js`), y la cola es la señal resiliente que gana cuando resuelve — si el documento se borra o vuelve a un payload neutro, `state.activeAlertId` (pegajoso, igual que `currentAlertDocId`) sigue apuntando a la alerta real y `resolveActiveAlertFromQueue()` la recupera de `state.alerts`.
- **Criterio de aceptación verificado con navegador real**, no solo por lectura de código: `smoke-test.mjs` (`npm run test:smoke`) levanta Firestore + Auth emulator, siembra una institución con una alerta pendiente real, confirma que el héroe la muestra, **borra `active-case` a mano y recarga la página desde cero** (sin nada en memoria) — el héroe sigue mostrando la alerta correcta porque la lee de la cola. La demo `eight-demo` se verifica en paralelo: su guion de ventas (Sofía Martínez) sigue intacto, tal como exige `ROADMAP_V42.md §5`.
- Un defecto real se encontró y cerró en el proceso: la primera versión de este cambio dejaba el héroe en un `renderAll()` transitorio en neutro entre el momento en que `startRealtimeSync()` recibe el documento y el momento en que `attachCollectionListeners()` conecta el listener de `alerts` — el fallback "conservar el valor previo" no cubría ese instante porque `mapFirestoreToLocalState` había dejado de escribir la señal inmediata. Se corrigió manteniendo ambas fuentes activas (ver arriba).
- Infraestructura de pruebas nueva, reutilizable a partir de aquí: `rules-test.mjs` (17 casos contra el emulador real de Firestore, `npm run test:rules`) y `smoke-test.mjs` (smoke E2E de navegador contra Firestore + Auth emulator, `npm run test:smoke`). Ambos exigen `VITE_USE_EMULATOR=true` explícito (inerte por defecto, mismo patrón defensivo que App Check) — nunca tocan el proyecto Firebase real.

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
