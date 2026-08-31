# NOVIMED — Runbook de Operación (V37)

## 1. Despliegue estándar
1. Recibir zip de versión → descomprimir.
2. GitHub (repo `novimed-v33`) → Add file → Upload files → subir TODOS los archivos a la raíz (reemplazando). Regla de oro iPad: los archivos van sueltos; nunca subir el zip ni carpetas.
3. Commit con mensaje `V{N} — {resumen}`.
4. Netlify construye solo (~15–30s). Verificar Deploys → "Published" verde.
5. Validar en dispositivo: recarga forzada o pestaña privada (el caché de Safari es agresivo).

## 2. Rollback
Netlify → Deploys → localizar el deploy anterior "Published" → ⋯ → "Publish deploy". Efecto inmediato, sin tocar GitHub. Para rollback de código: GitHub → Commits → Revert del commit problemático (genera commit inverso y redeploya).

## 3. Diagnóstico rápido (sin consola de desarrollador)
Página **Configuración → Sistema**: versión desplegada, institución, estado de sincronización y cola offline. Toasts de arranque:
| Mensaje | Significado | Acción |
|---|---|---|
| Tiempo real activo | Todo correcto | — |
| Sin conexión Firebase (auth/…-blocked) | Restricción de API Key bloquea Identity Toolkit o el referrer no está autorizado | GCP → Credentials → revisar APIs permitidas y HTTP referrers |
| Sin tiempo real (permission-denied) | Reglas Firestore rechazan la operación | Firebase → Firestore → Rules |
| Modo local (sin autenticación) | Sin red o Auth deshabilitado | Verificar red / Authentication → Sign-in method |
| Sincronización parcial '{colección}' | Regla o índice falla en esa colección | Revisar reglas para esa ruta |
| Alerta solo local / Guardado local | Escritura rechazada; quedó local y ENCOLADA | Se reintenta sola; ver "Cola offline" en Sistema |

## 4. Incidentes conocidos y su resolución histórica
- **Push en vivo no llega, recargar sí funciona** → Safari/redes cortan WebChannel. Ya mitigado con long polling forzado. Si reaparece: probar en red celular para aislar el WiFi institucional.
- **Layout roto tras deploy** → casi siempre CSS cacheado o subida que aplanó/perdió archivos. Recarga forzada; verificar en GitHub que `main.css` y `index.html` tengan la fecha del último commit.
- **Build "Unrecognized Git contributor"** → la cuenta que hizo commit no es la vinculada. Netlify → Manage Git contributors, o reconectar el repositorio.
- **Build "exit code 2"** → estructura del repo no coincide con los imports (histórico: carpetas aplanadas). Confirmar que TODOS los archivos del zip estén en la raíz con su última fecha.

## 5. Mantenimiento de datos
- **Reset de caché de un dispositivo**: Safari → Configuración → Avanzado → Datos de sitios web → eliminar el dominio (borra `novimed_local_state_v2` y la cola). La nube repobla al recargar.
- **Cola offline atascada ("abandoned")**: los datos siguen en el dispositivo; anotar el registro manualmente en otro dispositivo sincronizado y luego resetear caché del afectado.
- **Re-sembrar demo**: borrar en Firestore `schools/eight-demo/meta/seed` y `meta/seed-alerts` + las colecciones → el próximo dispositivo autenticado siembra de nuevo.

## 5b. App Check (V40)
Rollout en tres tiempos, nunca de golpe:
1. Firebase Console → App Check → registrar la app web con reCAPTCHA v3 → copiar la **clave de sitio**.
2. Definir `VITE_APPCHECK_SITE_KEY` en Netlify → Site configuration → Environment variables → redeploy. Verificar en Configuración → Sistema que dice "App Check: activo".
3. Dejar **una semana en modo monitor** (sin aplicar). Firebase Console → App Check → métricas: cuando ~100% del tráfico aparezca como verificado, activar "Enforce" para Firestore y Authentication.
Si tras aplicar aparecen errores `permission-denied` masivos: desactivar Enforce en consola (efecto inmediato, sin deploy). Sin clave definida, App Check queda inerte y la app funciona como antes.

## 5c. Staging (V40)
El código ya es agnóstico del entorno. Para montarlo:
1. Firebase Console → crear proyecto `novimed-staging` → habilitar Firestore, Authentication (Email/Password + Anónima) y publicar **las mismas reglas** de producción.
2. Registrar app web en ese proyecto → copiar su configuración.
3. Netlify → crear un segundo sitio desde **el mismo repositorio**, rama `staging` → definir las variables `VITE_FIREBASE_*` con los valores del proyecto de pruebas y `VITE_NOVIMED_ENV=staging`.
4. Flujo de trabajo: cambios → rama `staging` → validar → merge a `main` → producción.
Verificación: Configuración → Sistema debe decir "staging" en el sitio de pruebas y "producción" en el real. Nunca deben compartir proyecto Firebase.

## 5d. Backups de Firestore (V40)
Requiere facturación activa en Google Cloud (las exportaciones se cobran por GB).
1. Crear bucket: `gcloud storage buckets create gs://novimed-backups --location=us-central1 --project=novimed-2c5e9`
2. Exportación manual (verifica permisos antes de programar):
   `gcloud firestore export gs://novimed-backups/manual-$(date +%Y%m%d) --project=novimed-2c5e9`
3. Programar diaria: Google Cloud Console → Firestore → **Scheduled backups** → diaria, retención 7–30 días (según presupuesto).
4. **Prueba de restauración semestral obligatoria**: un backup no probado no es un backup. Restaurar sobre el proyecto de staging, nunca sobre producción:
   `gcloud firestore import gs://novimed-backups/<carpeta> --project=novimed-staging`
Retención recomendada para datos de menores: 30 días.

## 6. Credenciales y llaves
API Key web: pública por diseño; su seguridad = restricciones (referrer + 3 APIs: Identity Toolkit, Token Service, Firestore) + reglas. Rotación: GCP Credentials → crear nueva → restringir → reemplazar en `sync.js` → deshabilitar la anterior → deploy.

## 7. Contactos de plataforma
Firebase Console: proyecto `novimed-2c5e9` · Netlify: sitio `mednovid` · GitHub: repo privado `novimed-v33`.


## 7. Despliegue de V41.1 — ORDEN OBLIGATORIO

El orden importa: las reglas primero. Si el código llega antes, el archivado
lógico y la autoría fallarán contra las reglas antiguas y quedarán encolados.
Si llegan las reglas primero, el código V40 en dispositivos sin actualizar
sigue funcionando salvo el borrado en duro, que es justo lo que se bloquea.

### 7.1 Publicar reglas (Bloqueante ①)
Desde Firebase Console (funciona en iPad, no requiere CLI):
1. Firebase → Firestore → **Rules** → copiar íntegro `firestore.rules` del repositorio.
2. **Antes de Publicar**, usar el *Rules Playground* con cuatro simulaciones:
   - `delete` sobre `schools/eight-demo/students/{cualquiera}` autenticado como `Personal_Salud` o `Admin_Colegio` → debe **denegar**.
   - `delete` sobre `schools/eight-demo/students/{cualquiera}` autenticado como `SuperAdmin` **sin** que exista antes `schools/eight-demo/erasureLog/{ese id}` → debe **denegar** (derecho de eliminación: solo con el motivo ya registrado, ver `firestore.rules` §"REGISTRO DE ELIMINACIÓN").
   - `create` en `careRecords` con `createdBy.uid` distinto del uid autenticado → debe **denegar**.
   - `update` de archivado con `archivedReason` vacío → debe **denegar**.
3. Publicar. Guardar copia del texto anterior por si hay que revertir.
4. Verificar en la app: crear una ficha y registrar una atención. Si aparece
   el toast "Permiso denegado por el servidor", las reglas no coinciden con
   el código: revertir a las anteriores y revisar antes de seguir.

### 7.2 Backfill (Bloqueante ②)
1. Cloud Shell (console.cloud.google.com, funciona en Safari):
   `gcloud config set project novimed-2c5e9`
2. `npm init -y && npm i firebase-admin` y subir `backfill-student-ids.mjs`.
3. **Seco primero, siempre**: `node backfill-student-ids.mjs --school=<ID> --dry-run`
4. Revisar el reporte JSON: coincidencias exactas / ambiguas / huérfanas.
   - Ambiguas ⇒ hay nombres duplicados en la matrícula. Corregirlos y repetir.
   - Huérfanas ⇒ registros de estudiantes que nunca tuvieron ficha. Se quedan
     como "Sin ficha enlazada": es la verdad, no un defecto.
5. Aplicar: `node backfill-student-ids.mjs --school=<ID> --apply` (pide teclear APLICAR).
6. **Borrar el reporte del disco al terminar**: contiene nombres de menores.

### 7.3 Deploy del código
Procedimiento estándar de §1. Después, ejecutar el checklist de 9 puntos del
INFORME_ESTADO en iPad Safari, en vertical y en horizontal.

### 7.4 Reversión
- Reglas: Firebase Console → Rules → historial de versiones → republicar la anterior.
- Código: Netlify → Deploys → publicar el deploy previo.
- Backfill: **no es reversible automáticamente**. Por eso el modo seco no es opcional.
  Los campos añadidos (`studentId`, `studentLinkedBy`) son aditivos: si algo sale
  mal, el estado previo se restaura eliminando esos campos, nunca el documento.
