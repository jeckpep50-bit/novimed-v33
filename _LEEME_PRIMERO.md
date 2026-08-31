# Novimed V42.0.1 — Paquete de despliegue

Preparado sobre el estado actual del repositorio (`252c425`).
Build de producción verificado. Sintaxis verificada en los 4 archivos JS.

---

## PASO 1 — BORRAR cuatro archivos del repositorio

Hazlo **antes** de subir nada. Son renombrados accidentales de la subida
anterior desde iPad; si se quedan, conviven dos versiones del mismo archivo
y nadie sabrá cuál manda.

En GitHub: abre el archivo → menú `···` (arriba a la derecha) → **Delete file** → Commit.

| Borrar | Por qué |
|---|---|
| `firestore.rules 2.txt` | Era `firestore.rules` mal nombrado. Sus reglas nunca estuvieron activas. |
| `smoke-test.js` | Era `smoke-test.mjs` mal nombrado. `npm run test:smoke` ejecutaba la versión rota. |
| `gitignore` | Sin el punto inicial, git no lo lee. No ignoraba nada. |
| `CAMBIOS.diff` | Entregable de trabajo, no código fuente. |

---

## PASO 2 — SUBIR estos archivos (reemplazan a los actuales)

`Add file` → `Upload files` → arrastra → Commit.

### Código (los cambios de fondo)
- `core.js`
- `sync.js`
- `index.html`
- `firestore.rules`  ← **sin extensión**, ojo al subirlo
- `firestore.rules.test.mjs`
- `smoke-test.mjs`
- `package.json`

### Documentación
- `CHANGELOG.md`
- `PLAN_DE_TRABAJO.md`
- `ROADMAP_V42.md`
- `VERIFICACION_FASE0.md`

### No subir
- `_LEEME_PRIMERO.md`, `_DIFF_COMPLETO.txt`, `gitignore-CONTENIDO.txt`
  son material de apoyo. No pertenecen al repositorio.

---

## PASO 3 — CREAR el `.gitignore` (no lo subas: créalo)

iOS oculta los archivos que empiezan con punto y GitHub web les quita el
punto al subirlos. Por eso este se **escribe**, no se sube:

1. En GitHub: `Add file` → **Create new file**
2. En el campo del nombre escribe exactamente: `.gitignore`
3. Pega este contenido (también está en `gitignore-CONTENIDO.txt`):

```
node_modules/
dist/
smoke-out/
.env
```

4. Commit.

---

## PASO 4 — VERIFICAR que la subida no renombró nada

Mira la raíz del repositorio y confirma:

- [ ] `firestore.rules` aparece **una sola vez**, sin `.txt` ni ` 2`
- [ ] `smoke-test.mjs` aparece **una sola vez**, sin gemelo `.js`
- [ ] `.gitignore` existe **con** el punto
- [ ] `CAMBIOS.diff` ya no está

Si alguno salió con el nombre equivocado: abre el archivo → lápiz de editar
→ corrige el nombre en el campo superior → Commit. Al **renombrar** sí acepta
puntos y extensiones raras; al **subir** no siempre.

---

## PASO 5 — PROBAR

```
npm install
npm run test:rules      →  esperado: 33/33
npm run build           →  debe terminar sin errores
```

Si falla algún caso, mándame el nombre: seis de los 33 son nuevos y son los
primeros sospechosos.

---

## PASO 6 — PUBLICAR LAS REGLAS (antes del deploy del código)

`RUNBOOK.md §7.1`. Firebase Console → Firestore → Rules → pegar
`firestore.rules` íntegro. Las **cuatro** simulaciones del Rules Playground
antes de Publicar, incluida la nueva de `erasureLog`.

Guarda copia del texto anterior por si hay que revertir.

---

## PASO 7 — DESPLEGAR Y COMPROBAR

Netlify despliega solo al hacer commit. Después, en la app:

**Configuración → Sistema debe decir `V42.0.1`.**

Ese marcador vuelve a ser fiable: antes decía V41.1 mientras el repositorio
iba por V42, así que no servía para verificar despliegues.

---

# QUÉ CAMBIA EN ESTA VERSIÓN

## Bloqueantes (P0)

**Panel directivo con datos inventados en toda institución.**
Mostraba «96% de lectura», «2 casos críticos», «2m 34s de respuesta» y una
tabla titulada *Trazabilidad del caso Sofía Martínez* con horas fijas. No
estaba protegido por `isDemoTenant()`: un rector de un colegio cliente veía
un caso ficticio presentado como trazabilidad propia. Ahora todo se deriva de
`alerts` y `careRecords` con autoría real, y la ausencia se declara («—»,
«sin mediciones aún») en lugar de rellenarse.

**Nombres de personas demo en el feed de tenants reales.**
`sync.js` inyectaba «Andrés Sánchez recibió alerta» y «Ana Martínez pendiente
de lectura» en cualquier colegio, atribuyendo actos clínicos a personas
inexistentes. Usa ahora el autor real (`updatedBy`, disponible desde V41).

**Un documento de vacunas sin `status` tumbaba la interfaz entera.**
`v.status.includes()` lanzaba `TypeError` dentro de `renderAll()`, que no
tenía ningún aislamiento: abortaba el ciclo completo (KPIs, héroe, reportes)
y la pantalla se quedaba con datos viejos, sin error visible. Se normaliza en
el mapper y **cada sección de `renderAll()` queda aislada**.

**El enlace atención↔alerta se persistía como `null`.**
`submitCare` no esperaba al `addDoc` de la atención antes de escribir
`careRecordId`, así que la clave foránea que V41 introdujo quedaba vacía en
Firestore y se perdía al recargar — justo el criterio que V42 dice cumplir.

## Producto (P1)

- **Módulo Riesgo revivido**: `state.riskProfiles` se vaciaba al activar un
  tenant real y nada volvía a llenarlo. En producción era una página del menú
  que no hacía nada. Ahora deriva de fichas + alertas + atenciones.
- **Prioridad real (cierra A4)**: se escribía siempre `"Alta"`. Selector
  Alta/Media/Baja con el criterio escrito junto a cada opción.
- **Navegación**: Atenciones, Riesgo, Vacunas e Inventario existían como
  páginas sin entrada en el menú. 11 páginas, 11 entradas.
- **Atención sin matrícula**: creaba un registro clínico huérfano. Bloqueado.
- **Acoplamiento de render** Roles↔Familias y **cerrojo de la cola offline**
  que podía quedarse trabado toda la sesión.

## Reglas de Firestore (+6 pruebas, 33 en total)

- `alerts`: el `update` no exigía autoría verificada — `attendedBy` era un
  campo que el cliente afirmaba sin control, contra el principio nº 4 del
  propio archivo. Y `status` admitía cualquier cadena: se podía devolver una
  alerta a `pending` y borrar su medición de respuesta.
- `inventory`: `stock` se podía reescribir en silencio sin rastro en
  `inventoryLog`, pese a que el comentario del archivo afirmaba lo contrario.
- **`vaccines` no se toca a propósito**: su brecha tiene un test que asserta
  el comportamiento actual y está rastreada para V43/A3. Cerrarla ahora
  rompería ese test sin arreglar un módulo que sigue muerto en producción.

---

# LO QUE NO ESTÁ AQUÍ

**Limpieza de `localStorage` al cerrar sesión.** La ficha completa de menores
(alergias, teléfonos, contactos) sobrevive al logout en iPads compartidos.
Es un bloqueante **legal** LOPDP antes del piloto, pero toca el ciclo de
sesión y merece su propia entrega con pruebas.

**Consolidación de `main.css`** (129 `!important`) y el contraste de
`--muted` (#71819b = 3,95:1, falla WCAG AA). Es la base de la propuesta de
UI; mezclarlo con un hotfix clínico sería sobreingeniería.
