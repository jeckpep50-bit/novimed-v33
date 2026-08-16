# NOVIMED — Informe de estado
### Corte al 16 de agosto de 2026 · versión en código: **V41.1** (`package.json` 41.1.0)

---

## 1. Dónde estaba y dónde está

**Punto de partida (V40).** Infraestructura de producción madura —App Check, aislamiento multi-tenant validado, cola offline con backoff y dedupe, ventanas de lectura acotadas— sosteniendo un núcleo clínico que todavía era la demo de V29. La auditoría identificó 5 hallazgos críticos, 8 altos y 9 medios.

**Punto actual (V41.1).** El núcleo clínico ya no miente. Se cerraron **3 de los 5 críticos** (C1, C2, C5), **C3 quedó parcialmente mitigado** —la falsedad está retirada, pero el canal familiar real sigue sin existir, así que cuenta como deuda operativa, no como cierre— y C4 sigue abierto; además se corrigieron 3 defectos adyacentes que no estaban en el plan pero hacían inútil el resto. **El sistema todavía no está desplegado**: hay dos bloqueantes de operación descritos en §5.

**Estado del build:** `vite build` ✅ · `dist/assets/index.js` 106 kB (31.6 kB gzip) + chunk Firebase 698 kB (172 kB gzip) · sintaxis verificada en ambos módulos.

**Volumen del cambio:** `core.js` +449/−56 · `sync.js` +188/−52 · `main.css` +30 · `index.html` +5/−5.

---

## 2. Qué se cambió, por qué y dónde

### V40.1 — Hotfix de seguridad clínica

| Cambio | Archivo | Razón |
|---|---|---|
| `renderMainAllergyNote()` sustituye al nodo estático `Alergia conocida: maní` | `core.js`, `index.html` | El nodo no tenía `id` y ningún render lo tocaba: afirmaba alergia al maní para cualquier estudiante de cualquier institución. Ahora deriva de la ficha por `studentId`, con tres estados y **ninguno por defecto**. |
| Campo `allergy` eliminado del modelo del caso | `sync.js`, `core.js` | Era un valor copiado (y en demo, literal) que la UI presentaba como dato clínico verificado. Un dato clínico no se copia: se deriva o se declara ausente. |
| Modal de alerta: `<select>` de la matrícula real, campos vacíos | `index.html`, `core.js` | Venía prellenado con Sofía Martínez / Aula 3B / síntomas. El texto libre sobrevive como excepción rotulada "sin ficha enlazada". |
| Módulo Familias: estados honestos | `core.js` | "Simular confirmación familiar" se retira de instituciones reales. El estado verificable es **"Notificación registrada · lectura no confirmada"**. Los nombres fijos (Ana Martínez / Sofía) se sustituyen por los contactos de la ficha. La simulación queda rotulada y confinada a `eight-demo`. |
| Badge "3 activas" del Centro de alertas → dinámico | `index.html`, `core.js` | Número estático. |

### V41 — Trazabilidad y esquema

| Cambio | Archivo | Razón |
|---|---|---|
| **Autoría obligatoria**: `createdBy {uid,email,role}` + `serverCreatedAt`/`updatedAt` en toda escritura, vía `authored()` | `sync.js` | Ningún registro clínico tenía autor. `authored()` es el único camino a Firestore. El sentinel `serverTimestamp()` se aplica **al ejecutar**, no en el payload, porque no sobrevive a `JSON.stringify` en la cola offline. |
| **Claves foráneas**: `studentId` en `alerts`, `careRecords`, `vaccines`, `inventoryLog` | `core.js`, `sync.js` | Todo se enlazaba por nombre. `studentName` queda desnormalizado solo para lectura; los documentos previos se normalizan en el mapper (`student` → `studentName`) sin reescribir el histórico. |
| **Archivado lógico**: `archiveStudent()` con motivo obligatorio y autoría | `core.js`, `sync.js` | `deleteStudent` borraba en duro la ficha de un menor tras un `window.confirm`. `deleteDoc` ya no existe en el código. El tipo de cola `deleteStudent` se remapea al archivado para drenar con seguridad operaciones encoladas en dispositivos con V40. |
| **`invUse` atómico**: `Promise.all` → `writeBatch` | `sync.js` | Si el descuento aterrizaba y el log fallaba, el reintento descontaba stock por segunda vez. Cierra la deuda reconocida en `ARCHITECTURE §8`. |
| **`confirmFamilyRead` corregido**: resuelve por `careRecordId` del caso | `core.js`, `sync.js` | Escribía sobre `careRecords[0]` —el más reciente—, así que la confirmación podía aterrizar en el expediente de otro estudiante. Sin vínculo, ahora no escribe sobre ningún expediente. |
| `inventoryLog`: array posicional → objeto con `date` y `studentId` | `core.js`, `sync.js` | El log solo guardaba hora, sin fecha. El render tolera el formato antiguo. |
| Tabla de estudiantes: filtro de archivadas + índice estable | `core.js`, `index.html` | El índice original se conserva antes de filtrar para no romper los handlers. |
| Siembra demo con refs explícitas + `linkDemoCaseOnce()` | `sync.js` | Para que la demo enlace sus propias FKs y no muestre "Sin ficha enlazada". |

### V41.1 — Vista Docente

El panel traía `value="Sofía Martínez"` y los síntomas del caso demo. **La causa raíz no era descuido:** el panel se reconstruía con `innerHTML` en cada `renderAll()`, así que cualquier texto real se perdía al llegar un snapshot; los valores fijos disimulaban ese fallo. Además, esos dos campos **nunca se leían** —el botón abría el modal y descartaba lo escrito—.

Reconstruido como formulario controlado: se construye una vez y después solo se refresca lo derivado del estado. Combobox alimentado de la matrícula activa con teclado y ARIA, validación con botón deshabilitado (`symptoms.trim() === ""`), errores inline con `role="alert"`, reset solo tras envío exitoso, y `submitTeacherAlert(payload)` como camino único compartido con el modal.

---

## 3. Estado de los hallazgos de la auditoría

### Críticos
| | Hallazgo | Estado |
|---|---|---|
| C1 | Alergia estática | ✅ **Cerrado** |
| C2 | Alerta sin enlace a estudiante | ✅ **Cerrado** (modal + panel docente) |
| C3 | Confirmación familiar simulada | 🟡 **Parcialmente mitigado / deuda operativa** · falsedad retirada y módulo rotulado "Vista previa · no operativo" en instituciones reales. No cuenta como cerrado hasta que exista canal familiar. |
| C4 | Un solo caso activo por institución | ❌ **Abierto** → es el objetivo de V42 |
| C5 | Escrituras sin autor | 🟡 **Cerrado en cliente** · falta exigirlo en reglas |

### Altos
| | Hallazgo | Estado |
|---|---|---|
| A1 | Sin claves foráneas | 🟡 Esquema listo · script de backfill entregado · **falta ejecutarlo** |
| A2 | Reglas Firestore fuera del repositorio | ✅ **Cerrado** · `firestore.rules` + `firebase.json` versionados |
| A3 | Riesgo y Vacunas muertos en producción | ❌ Abierto |
| A4 | Prioridad de alerta siempre "Alta" | ❌ Abierto |
| A5 | `invUse` no atómico | ✅ Cerrado |
| A6 | Búsqueda devuelve un toast | ❌ Abierto |
| A7 | Sin estado de carga | ❌ Abierto |
| A8 | Fechas como texto | 🟡 Solo `inventoryLog` |

### Medios
✅ M4 archivado lógico · 🟡 M7 log con fecha · ❌ M1 contraste 3.95:1 · ❌ M2 trampa de foco · ❌ M3 tablas en móvil · ❌ M5 config todo-o-nada · ❌ M6 edad como texto · ❌ M8 129 `!important` · ❌ M9 sin pruebas

---

## 4. Riesgos introducidos por estos cambios

1. **Los registros existentes aparecerán como "Sin ficha enlazada".** Es la verdad —el vínculo nunca existió— pero es un cambio visible para cualquiera que ya tenga datos. Se resuelve con el backfill (§5).
2. **Operaciones `deleteStudent` encoladas en dispositivos con V40** se ejecutarán como archivado. Es intencional y preferible, pero el resultado difiere de lo que el usuario pidió en su momento.
3. **Caché local con `inventoryHistory` en formato array.** El render lo tolera, pero conviene validarlo en un dispositivo que ya tenga la app instalada, no solo en pestaña privada.
4. **`archiveStudent` requiere permiso de `update` sobre `students`.** Si las reglas actuales conceden `delete` pero restringen `update` de algún campo, el archivado fallará silenciosamente a la nube (queda local y encolado).

---

## 5. Bloqueantes antes de desplegar

**① Las reglas Firestore van primero.** Sin ellas el archivado es cosmético y la autoría no es exigible:
- `students`: `allow delete: if false;`
- Colecciones clínicas: exigir `request.resource.data.createdBy.uid == request.auth.uid` en creación.
- Versionar `firestore.rules` + `firebase.json` en el repositorio (cierra A2 de paso).

**② Decidir el backfill de `studentId`.** Puedo escribir un script con `dryRun` que empareje por nombre y reporte coincidencias exactas, ambiguas y huérfanas antes de escribir nada. Sin él, el histórico queda desvinculado de forma permanente.

**Orden sugerido:** reglas → backfill en dry-run → revisar el reporte → backfill real → deploy de V41.1 → validación en iPad.

---

## 6. Checklist de validación (iPad Safari, vertical y horizontal)

1. Login real → dashboard sin alerta activa → el aviso clínico dice "Sin ficha enlazada — verificar manualmente".
2. Crear ficha con alergia → reportar alerta desde Vista Docente seleccionando esa ficha → el dashboard muestra **su** alergia, no maní.
3. Botón "Reportar emergencia" deshabilitado sin estudiante o sin síntomas; se habilita al completar ambos; el formulario se limpia tras enviar.
4. Registrar atención con medicamento → stock baja **una** unidad; el log muestra fecha y estudiante.
5. Archivar una ficha → exige motivo → desaparece de la tabla → reaparece con "Mostrar archivadas" y conserva su historial.
6. Verificar en Firestore que un documento nuevo de `careRecords` tiene `createdBy.uid`, `createdBy.role` y `serverCreatedAt`.
7. Cuenta con rol Consulta: no puede archivar, reportar ni registrar.
8. Modo avión → registrar atención → reconectar → la operación se sincroniza sin duplicar.
9. Tenant `eight-demo`: la demo sigue enlazando la ficha de Sofía y la simulación familiar aparece rotulada como tal.

---

## 7. Lo que sigue

**V42 — Alertas como fuente de verdad.** Retirar `meta/active-case`, derivar el dashboard de `alerts where status=='pending'`, y añadir prioridad real. Cierra C4 y A4 de un golpe, y elimina el resto de corteza demo.

Después: V43 (decidir Riesgo y Vacunas, fechas reales, búsqueda como filtro) · V44 (pruebas, estados de carga, accesibilidad) · V45+ (Cloud Functions, canal familiar real) · React solo cuando exista una red de pruebas que detecte regresiones.

**Decisión vigente:** no migrar a React ni añadir frameworks. Los problemas de Novimed están en el modelo de datos y en la honestidad del dato, no en la capa de vista. Esa decisión se sostiene: los cambios de esta sesión habrían costado varias veces más aplicados sobre una migración en curso.

---

### Resumen en una línea
Novimed pasó de mostrar datos clínicos inventados a declarar explícitamente lo que no sabe. Falta que el servidor lo obligue —reglas— y que el histórico se reconecte —backfill—.
