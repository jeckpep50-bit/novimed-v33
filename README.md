# Novimed V32 — Proyecto multi-archivo

## Estructura
```
index.html              Maquetado (sin JS ni CSS inline)
src/main.js             Punto de entrada (orden de carga)
src/styles/main.css     Todo el CSS
src/app/core.js         Estado, renders, acciones, búsqueda, modales
src/app/drawer.js       Menú móvil off-canvas
src/firebase/sync.js    Auth anónima, caso activo, colecciones multi-tenant
.env.example            Variables de entorno (VITE_FIREBASE_API_KEY)
netlify.toml            Build automático en Netlify
```

## Desplegar (opción A — arrastrar, sin instalar nada)
1. Descomprime `novimed_v32_dist.zip`.
2. En Netlify → Deploys → arrastra la carpeta `dist`.

## Desplegar (opción B — profesional, con builds automáticos)
1. Sube esta carpeta a un repositorio GitHub.
2. Netlify → "Import from Git" → detecta `netlify.toml` y construye solo.
3. Cada push a main = deploy automático.

## Desarrollo local (requiere Node 18+)
```
npm install
npm run dev      # servidor local con recarga en vivo
npm run build    # genera dist/
```

## Nota de seguridad
La clave web de Firebase es pública por diseño (va al navegador siempre);
la protección real son las Security Rules + restricción por HTTP referrer,
ambas ya activas. `.env` permite rotarla sin tocar código.
