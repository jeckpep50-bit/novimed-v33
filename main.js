/* Novimed V35 — Punto de entrada (estructura plana, compatible con subidas desde iPad).
   El orden importa: core define estado y handlers; sync (Firebase) sobreescribe
   los que sincronizan a la nube; drawer inicializa el menú móvil. */
import './main.css';
import './core.js';
import './sync.js';
import './drawer.js';
