# NOVIMED — Changelog

## V37 (actual) — Hardening P5 + Documentación P7
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
