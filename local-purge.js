/* ═══════════════════════════════════════════════════════════════════════════
   NOVIMED — Purga de almacenamiento local (V42.1, A4)

   POR QUÉ EXISTE ESTE ARCHIVO
   Hasta V42.0.2, cerrar sesión solo llamaba a signOut(). Todo lo que la app
   había guardado en localStorage sobrevivía indefinidamente en el dispositivo:

     novimed_local_state_v2::<tenant>   fichas completas de menores —
                                        alergias, condiciones crónicas,
                                        teléfonos de contacto — más
                                        atenciones, vacunas e inventario.
     novimed_pending_ops_v1::<schoolId> escrituras clínicas AÚN NO ENVIADAS,
                                        con su carga útil completa.

   En un iPad compartido de enfermería —que es el escenario real de Novimed,
   no una hipótesis— eso significa que los datos de salud de menores de una
   institución quedan en el equipo después de que su responsable cierra
   sesión. Bajo la LOPDP ecuatoriana es un tratamiento de datos sensibles sin
   base de conservación, y es bloqueante antes de cualquier piloto.

   POR QUÉ NO SE BORRA TODO SIN MÁS
   Los dos almacenes NO son equivalentes y tratarlos igual causa un daño peor
   que el que se quiere evitar:

     · El estado (`novimed_local_state_v*`) es una CACHÉ de lectura. Se
       reconstruye entero desde Firestore en el siguiente inicio de sesión.
       Borrarlo no pierde nada. Se borra siempre.

     · La cola (`novimed_pending_ops_v*`) es la ÚNICA copia de escrituras que
       todavía no llegaron al servidor. Borrarla destruye registros clínicos
       que nadie más tiene. Solo se borra cuando está vacía, o cuando quien
       cierra sesión ha sido advertido explícitamente y lo confirma.

   Este módulo es puro a propósito: recibe el `storage` como argumento en vez
   de tocar `localStorage` directamente, para poder probarlo en Node sin
   navegador. Ver local-purge.test.mjs.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Prefijos SIN el número de versión: una purga tiene que llevarse también los
   esquemas viejos (v1) que quedaron de migraciones anteriores. Si aquí se
   listara 'novimed_local_state_v2', una ficha guardada por la v1 seguiría en
   el dispositivo para siempre. */
export const STATE_PREFIX = 'novimed_local_state_v';
export const QUEUE_PREFIX = 'novimed_pending_ops_v';

export const isStateKey = k => typeof k === 'string' && k.startsWith(STATE_PREFIX);
export const isQueueKey = k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX);
export const isNovimedKey = k => isStateKey(k) || isQueueKey(k);

/* Enumera las claves de Novimed presentes en el almacén.
   Se materializa la lista ANTES de borrar: localStorage reindexa al eliminar,
   así que recorrerlo con storage.key(i) mientras se borra se salta entradas. */
export function novimedStorageKeys(storage){
  const keys = [];
  if(!storage) return keys;
  try{
    for(let i = 0; i < storage.length; i++){
      const k = storage.key(i);
      if(isNovimedKey(k)) keys.push(k);
    }
  }catch(e){
    /* Safari en modo privado puede lanzar al enumerar. Sin acceso al almacén
       no hay nada que purgar, pero tampoco hay que romper el cierre de
       sesión por ello. */
    return keys;
  }
  return keys;
}

/* Cuenta las operaciones pendientes en TODAS las colas del dispositivo, no
   solo la del tenant activo: en un equipo compartido puede haber trabajo sin
   enviar de una sesión anterior, y esa es justamente la que se perdería sin
   avisar. */
export function countPendingOps(storage){
  let total = 0;
  for(const key of novimedStorageKeys(storage)){
    if(!isQueueKey(key)) continue;
    try{
      const parsed = JSON.parse(storage.getItem(key));
      if(Array.isArray(parsed)) total += parsed.filter(o => o && o.type && o.opId).length;
    }catch(e){ /* cola ilegible: no se puede contar, no se cuenta */ }
  }
  return total;
}

/**
 * Elimina los almacenes locales de Novimed.
 * @param storage      objeto tipo Storage (localStorage o un doble de prueba)
 * @param keepQueue    true = conserva las colas con trabajo sin enviar
 * @returns {{removed:string[], kept:string[], pendingKept:number}}
 */
export function purgeNovimedStorage(storage, { keepQueue = false } = {}){
  const removed = [];
  const kept = [];
  if(!storage) return { removed, kept, pendingKept: 0 };

  for(const key of novimedStorageKeys(storage)){
    if(keepQueue && isQueueKey(key)){ kept.push(key); continue; }
    try{ storage.removeItem(key); removed.push(key); }
    catch(e){ kept.push(key); }   /* no se pudo borrar: se declara, no se miente */
  }
  return { removed, kept, pendingKept: keepQueue ? countPendingOps(storage) : 0 };
}
