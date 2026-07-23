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

## 6. Credenciales y llaves
API Key web: pública por diseño; su seguridad = restricciones (referrer + 3 APIs: Identity Toolkit, Token Service, Firestore) + reglas. Rotación: GCP Credentials → crear nueva → restringir → reemplazar en `sync.js` → deshabilitar la anterior → deploy.

## 7. Contactos de plataforma
Firebase Console: proyecto `novimed-2c5e9` · Netlify: sitio `mednovid` · GitHub: repo privado `novimed-v33`.
