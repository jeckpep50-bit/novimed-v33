import { defineConfig } from 'vite';

// Separa el SDK de Firebase en su propio chunk: elimina la advertencia de
// tamaño del build y mejora el caché del navegador (el SDK cambia menos
// que el código de la app).
export default defineConfig({
  build: {
    // El SDK de Firebase pesa ~690kB minificado (172kB gzip): es tamaño del
    // proveedor, ya aislado en su propio chunk cacheable. 800 evita un aviso
    // que no señala nada accionable.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  }
});
