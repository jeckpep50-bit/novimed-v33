/* Novimed V32 — Punto de entrada.
   El orden importa: core define el estado y los handlers;
   sync (Firebase) sobreescribe los handlers que sincronizan a la nube;
   drawer inicializa la navegación móvil. */
import './main.css';
import './core.js';
import './sync.js';
import './drawer.js';
