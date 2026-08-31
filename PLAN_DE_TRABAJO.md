# NOVIMED — Plan de trabajo hacia producto vendible
### Vigente desde el 16 de agosto de 2026 · parte de V41.1 (importado a este repositorio en este commit)

---

## 1. Punto de partida

Este no es un producto en cero. `INFORME_ESTADO_V41.1.md`, `ARCHITECTURE.md`, `CHANGELOG.md` y `ROADMAP_V42.md` —ya en el repo— documentan 41 iteraciones reales: de un monolito HTML con credenciales expuestas (V29, "12–15% de producto") a una SPA con multi-tenant, offline queue, App Check, autoría obligatoria y archivado lógico. El build actual compila limpio (`vite build` ✅, verificado en este mismo commit).

Lo que **no** está resuelto, según la propia auditoría interna:
- **C4 abierto**: un solo caso activo por colegio — dos emergencias simultáneas se pisan.
- **C3 parcialmente mitigado**: no existe canal familiar real, solo un estado honesto de "no confirmado".
- **Dos bloqueantes de despliegue**: reglas Firestore sin publicar y backfill de `studentId` sin ejecutar. **El sistema todavía no está en producción con datos reales.**
- Cero pruebas automatizadas (M9). Toda la validación de 41 versiones fue manual, en iPad, 3 pasadas.
- Deuda de accesibilidad y UI: contraste, trampas de foco, tablas en móvil, 129 `!important`.

Ese trabajo técnico es real y hay que terminarlo. Pero "vendible" es un objetivo distinto de "sin bugs": un colegio no compra un roadmap de GitHub, compra que sus datos estén seguros, que alguien responda cuando algo falla, y que el precio y el contrato tengan sentido. Este plan cubre ambos ejes.

---

## 2. Qué significa "vendible" aquí

| Eje | Ya existe | Falta |
|---|---|---|
| **Funcional** | Núcleo clínico honesto, multi-tenant aislado, offline robusto, reglas de seguridad versionadas | Cola de alertas real (C4), canal familiar real (C3), pruebas automatizadas, accesibilidad |
| **Operable** | RUNBOOK con diagnóstico, rollback, App Check, staging documentado | Backup **probado** (no solo programado), staging **montado** (hoy es solo procedimiento) |
| **Comercial** | Tenant de demo (`eight-demo`) para pitch | Alta de colegio nuevo sin intervención manual en Firestore, modelo de precios, piloto pagado con un colegio real |
| **Legal** | Historial clínico protegido por defecto, y derecho de eliminación con mecanismo técnico (solo SuperAdmin, con motivo registrado de forma permanente) ya en las reglas | Contrato de encargo de tratamiento de datos, política de privacidad, base legal explícita para datos de salud de menores (Ecuador: LOPDP), y el procedimiento humano de verificación de solicitudes de eliminación |

Un producto puede ser técnicamente perfecto y no venderse porque no hay forma de dar de alta a un segundo colegio sin que un desarrollador toque Firestore a mano. Ese punto está en la Fase 4 y es tan bloqueante como C4.

---

## 3. Fases

El orden respeta la dependencia real: no tiene sentido pulir accesibilidad (Fase 3) sobre un modelo de datos que la Fase 1 va a reescribir, y no tiene sentido vender (Fase 5) sin poder dar de alta un tenant (Fase 4).

### Fase 0 — Desbloquear producción (inmediata, esta semana)
Ya especificada en detalle en `RUNBOOK.md §7` e `INFORME_ESTADO_V41.1.md §5`. No es trabajo nuevo, es ejecutar lo ya escrito:
1. Publicar `firestore.rules` (Rules Playground con las 3 simulaciones documentadas antes de publicar).
2. `backfill-student-ids.mjs --dry-run` → revisar reporte → `--apply`.
3. Deploy V41.1 → checklist de 9 puntos en iPad Safari.

**Sin esto, todo lo demás es teoría: el sistema no tiene datos reales sobre los que construir el resto del plan.**

**Estado (ver `VERIFICACION_FASE0.md`):** todo lo verificable sin credenciales del proyecto Firebase real ya se hizo — build reproducido, self-test del backfill (14/14), y una suite de 17 pruebas contra el emulador de Firestore (`npm run test:rules`) que confirma que cada payload que `sync.js` envía hoy es aceptado por `firestore.rules`, incluidas las 3 simulaciones que el RUNBOOK exige. De paso se documentó una brecha menor no bloqueante (reglas de `vaccines` sin `onlyChanges()`, a cerrar en Fase 2 junto con A3). **Lo único que falta de la Fase 0 es que alguien con acceso a la consola de Firebase y a Netlify ejecute los 3 pasos de arriba** — eso no se puede hacer desde este entorno.

### Fase 1 — V42: cola de alertas real (cierra C4)
Ya diseñada completa en `ROADMAP_V42.md`. Resumen de la secuencia (cada entrega es desplegable):
- **V42.0** lectura dual desde `alerts` sin dejar de escribir en `active-case` (reversible sin tocar datos).
- **V42.1** corte de escritura, retiro de ~120 líneas de código muerto.
- **V42.2** cola multi-caso visible, prioridad real (cierra A4), cierre explícito de alertas con motivo.
- **V42.3** feed de actividad derivado de eventos reales, no reconstruido.

El propio roadmap recomienda **adelantar aquí las pruebas mínimas de la Fase 2** (`calculateRisk`, `inventoryStatus`, reglas en el emulador de Firestore) antes de tocar el núcleo del panel — es la parte de V44 con mayor retorno por hora invertida, y evita repetir el patrón que generó los defectos C1/C2/C5. Se adopta esa recomendación: **Fase 1 empieza con un arnés de pruebas mínimo, no con código de producto.**

**Estado:** arnés de pruebas construido (`tests/firestore.rules.test.mjs`, 17 casos contra el emulador real de Firestore; `scripts/smoke-test.mjs`, smoke E2E de navegador contra Firestore + Auth emulator — ninguno de los dos toca nunca el proyecto Firebase real) y **V42.0 entregado y verificado con navegador real**, no solo por lectura de código — ver `CHANGELOG.md` y `ROADMAP_V42.md §3`. Quedan V42.1–V42.3.

### Fase 2 — V43: lo que queda de la auditoría original
- A3: decidir Riesgo y Vacunas (completarlos o retirarlos — hoy están muertos en producción, y un módulo muerto en un producto que se vende es peor que no tenerlo).
- A6: búsqueda real en vez de un toast.
- A7: estados de carga.
- A8/M6/M7: fechas y edad como tipos reales, no texto.

### Fase 3 — V44: pruebas, accesibilidad, saneamiento
- Ampliar el arnés de pruebas adelantado en Fase 1 a cobertura de reglas + funciones puras.
- M1 contraste 3.95:1, M2 trampa de foco, M3 tablas en móvil — no son cosméticos: son requisitos de accesibilidad que un cliente institucional (colegio, posible requisito de contratación pública) puede exigir por escrito.
- M8: consolidar los 129 `!important` de `main.css`.

### Fase 4 — Onboarding comercial (puede empezar en paralelo a la Fase 1)
Esta es la fase que falta en el roadmap técnico existente y es la que convierte el producto en vendible:
- **Alta de colegio self-service o asistida**: hoy, según `ARCHITECTURE.md`, un tenant nuevo depende de claims (`schoolId`, `role`) resueltos por configuración manual. Se necesita un flujo — aunque sea un panel SuperAdmin mínimo, no público — para dar de alta un colegio, su primer Admin_Colegio y sus reglas de acceso sin tocar la consola de Firebase a mano cada vez.
- **Montar staging de verdad** (el procedimiento ya está en `RUNBOOK.md §5c`, falta ejecutarlo una vez y dejarlo vivo).
- **Probar la restauración de un backup** (`RUNBOOK.md §5d` lo exige "obligatoria" y hoy no se ha hecho nunca).
- **Modelo de precios**: por alumno/mes es lo estándar en este vertical (edtech/healthtech escolar); definir tiers (colegio único vs. red de colegios, dado que el modelo ya es multi-tenant por diseño).

### Fase 5 — Piso legal
No es opcional para datos de salud de menores:
- Política de privacidad y términos de servicio.
- Ecuador tiene Ley Orgánica de Protección de Datos Personales (LOPDP) vigente: el colegio es responsable del tratamiento, Novimed es encargado — eso necesita un contrato (DPA) explícito, no solo buenas intenciones en el código.
- Definir base legal y consentimiento para el registro de datos clínicos de menores. El derecho de eliminación ya tiene mecanismo técnico (`firestore.rules`: solo SuperAdmin, y solo tras registrar el motivo en `erasureLog` — inmutable, sobrevive al borrado de los datos del estudiante como prueba). **Falta lo legal, no lo técnico:** cómo se verifica que quien pide el borrado es realmente el padre/tutor, plazos de respuesta, y si aplica alguna excepción de retención (ej. una atención médica documentada que el colegio deba conservar por normativa sanitaria antes de poder borrarla).

### Fase 6 — Piloto real
Un colegio real, idealmente ya conocido, en producción con datos reales durante 2–4 semanas antes de vender a un segundo. Es la validación que 41 versiones de iPad manual no pueden reemplazar: uso real, bajo presión, con datos que importan.

---

## 4. Orden y paralelismo

```
Fase 0 (bloqueante, esta semana)
   │
   ├──► Fase 1 (V42 + tests)  ──► Fase 2 (V43)  ──► Fase 3 (V44)
   │
   └──► Fase 4 (onboarding) ──► Fase 5 (legal) ──► Fase 6 (piloto)
```

Fases 1–3 (técnica) y 4–5 (comercial/legal) pueden avanzar en paralelo desde que Fase 0 cierre. Fase 6 necesita que ambas ramas hayan llegado al menos hasta V42.2 (cola de alertas, el defecto más visible para un usuario real) y hasta Fase 5 (sin piso legal no se puede tener un colegio real con datos reales).

C3 (canal familiar real, hoy en V45+ del roadmap original) no es requisito para el piloto: puede venderse honestamente como "notificación registrada, confirmación en desarrollo" — es exactamente la postura que V40.1 ya adoptó en el producto. Sí es requisito para vender a un segundo colegio después del piloto.

---

## 5. Definición de terminado — checklist go-to-market

- [ ] Fase 0 completa y validada en producción con el checklist de 9 puntos.
- [ ] `grep -r "active-case"` no devuelve nada (criterio de terminado de V42 ya definido en `ROADMAP_V42.md §7`).
- [ ] Arnés de pruebas cubre `calculateRisk`, `inventoryStatus`, backfill, reglas en emulador.
- [ ] Staging vivo y usado como paso obligatorio antes de cada deploy a producción.
- [ ] Un backup restaurado con éxito sobre staging, al menos una vez.
- [ ] Alta de un colegio nuevo ejecutable sin tocar la consola de Firebase directamente.
- [ ] Política de privacidad, términos de servicio y modelo de DPA firmables.
- [ ] Modelo de precios definido y validado con al menos una conversación de venta real.
- [ ] Un colegio real en producción 2+ semanas sin incidente no resuelto.

---

## 6. Riesgos principales

| Riesgo | Contención |
|---|---|
| Reescribir el núcleo del panel (Fase 1) sin red de pruebas repite el patrón que generó C1/C2/C5 | Tests antes que código, ya adoptado como principio de la Fase 1 |
| Vender antes de tener piso legal expone a Novimed y al colegio con datos de menores | Fase 5 es bloqueante para Fase 6, no opcional ni posterior |
| Backfill de `studentId` es irreversible en caliente | `--dry-run` obligatorio, ya implementado en `backfill-student-ids.mjs` |
| Un solo colegio piloto no revela problemas de escala multi-tenant | La arquitectura ya es multi-tenant desde V38a; validar con un segundo tenant de prueba (no el piloto real) antes de vender al segundo cliente real |

---

## 7. Próximo paso inmediato

Ejecutar la Fase 0. Es trabajo ya especificado, de horas, y todo lo demás depende de tener el sistema en producción con datos reales en vez de en `dist/`.
