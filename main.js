/* Novimed V32 — Punto de entrada.
   El orden importa: core define el estado y los handlers;
   sync (Firebase) sobreescribe los handlers que sincronizan a la nube;
   drawer inicializa la navegación móvil. */
import './styles/main.css';
import './app/core.js';
import './firebase/sync.js';
import './app/drawer.js';
