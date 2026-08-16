#!/usr/bin/env node
/**
 * NOVIMED — smoke test de navegador real contra los emuladores locales.
 *
 * NUNCA apunta al proyecto Firebase real: exige VITE_USE_EMULATOR=true
 * (activado por firebase.json + sync.js) y usa firebase-admin apuntado a
 * los emuladores (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST)
 * para sembrar datos de prueba. Pensado para correr dentro de
 * `firebase emulators:exec "node scripts/smoke-test.mjs"` (ver
 * package.json → test:smoke), que levanta y apaga los emuladores solo.
 *
 * Dos escenarios:
 *  1. Demo (eight-demo, self-seed): confirma que el guion de ventas de
 *     Sofía Martínez sigue intacto tras V42.0 (ROADMAP_V42.md §5, riesgo
 *     "la demo depende del teatro de active-case").
 *  2. Institución real con una alerta pendiente real: confirma el criterio
 *     de aceptación de V42.0 — con `meta/active-case` borrado y la página
 *     recargada desde cero (sin nada en memoria), el panel principal sigue
 *     mostrando la alerta correcta porque la lee de la cola `alerts`, no
 *     del documento único.
 */
import { spawn, execSync } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5183;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROJECT_ID = "demo-novimed";
const SCHOOL_ID = "colegio-test";
const TEST_EMAIL = "salud@colegio-test.local";
const TEST_PASSWORD = "clave-de-prueba-123";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = PROJECT_ID;

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function tick() {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() > deadline) reject(new Error(`Timeout esperando ${url}`));
        else setTimeout(tick, 300);
      });
    })();
  });
}

/* Un vite huérfano de una corrida anterior (matada por el timeout externo
   antes de que su propio `finally` corriera) puede seguir vivo en el mismo
   puerto: waitForServer() lo aceptaría igual y esta corrida terminaría
   probando código/env de la corrida VIEJA sin darse cuenta. Se limpia el
   puerto antes de arrancar el vite de esta corrida. */
function killStalePort(port) {
  try { execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" }); } catch {}
}

async function seedRealTenant() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");

  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();
  const auth = getAuth();

  const user = await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
  await auth.setCustomUserClaims(user.uid, { role: "Personal_Salud", schoolId: SCHOOL_ID });

  const root = db.collection("schools").doc(SCHOOL_ID);
  const studentRef = root.collection("students").doc();
  await studentRef.set({
    fullName: "Ana Real",
    createdAt: Date.now(),
    createdBy: { uid: user.uid, email: TEST_EMAIL, role: "Personal_Salud" }
  });

  const alertRef = root.collection("alerts").doc();
  const alertData = {
    studentId: studentRef.id,
    studentName: "Ana Real",
    location: "Aula 4B",
    symptoms: "Caída en el patio, dolor en el brazo",
    priority: "Alta",
    status: "pending",
    timeLabel: "11:15",
    createdAt: Date.now(),
    createdBy: { uid: user.uid, email: TEST_EMAIL, role: "Personal_Salud" }
  };
  await alertRef.set(alertData);

  const caseRef = root.collection("meta").doc("active-case");
  await caseRef.set({
    studentId: studentRef.id,
    studentName: "Ana Real",
    status: "alert_pending",
    alertId: alertRef.id,
    location: "Aula 4B",
    symptoms: "Caída en el patio, dolor en el brazo",
    alertTimeLabel: "11:15",
    updatedAt: FieldValue.serverTimestamp()
  });

  return { db, caseRef, studentName: "Ana Real" };
}

async function main() {
  // Salvavidas: el transporte long-polling de Firestore (ARCHITECTURE.md
  // §5, deliberado para Safari/redes escolares) mantiene actividad de red
  // casi continua, así que cualquier espera basada en "networkidle" puede
  // colgarse. Si el script entero se cuelga por otra causa, que truene con
  // un mensaje claro en vez de que alguien tenga que matarlo a mano.
  const watchdog = setTimeout(() => {
    console.error("✖ Watchdog: el smoke test no terminó en 150s. Abortando.");
    process.exit(1);
  }, 150000);
  watchdog.unref?.();

  console.log("→ Sembrando institución real en el emulador (colegio-test)…");
  const { caseRef, studentName } = await seedRealTenant();

  killStalePort(PORT);
  console.log("→ Arrancando vite dev en modo emulador…");
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    // VITE_FIREBASE_PROJECT_ID debe coincidir con --project de
    // `firebase emulators:exec` (PROJECT_ID de este script): con
    // --single_project_mode, el emulador sirve un único espacio de datos,
    // y el cliente (que sin esta variable cae al `novimed-2c5e9` de
    // producción por defecto en sync.js) quedaría leyendo un proyecto
    // distinto al que aquí se siembra con firebase-admin — cero datos
    // visibles, sin ningún error de permisos que lo delate.
    env: { ...process.env, VITE_USE_EMULATOR: "true", VITE_FIREBASE_PROJECT_ID: PROJECT_ID },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let viteLog = "";
  vite.stdout.on("data", (d) => { viteLog += d.toString(); });
  vite.stderr.on("data", (d) => { viteLog += d.toString(); });
  let browserRef = null;
  const cleanup = () => {
    try { vite.kill(); } catch {}
    try { browserRef?.process()?.kill("SIGKILL"); } catch {}
  };
  process.on("exit", cleanup);

  // Ruido conocido, no del código de la app:
  //  - Google Fonts: bloqueado por la política de red de este sandbox.
  //  - Canal long-polling de Firestore (google.firestore.v1.Firestore/…):
  //    ARCHITECTURE.md §5 documenta que este transporte "mantiene actividad
  //    de red casi continua" por diseño (es el motivo por el que se usa,
  //    en vez de WebChannel, para sobrevivir a redes que cortan conexiones
  //    persistentes). Un ERR_CONNECTION_RESET/ERR_ABORTED sobre ese canal
  //    justo al recargar o cerrar la página es la conexión en vuelo
  //    cortándose, no un fallo de la app.
  const isKnownNoise = (e) =>
    /Download the React DevTools|WebChannelConnection|fonts\.googleapis\.com|fonts\.gstatic\.com|google\.firestore\.v1\.Firestore|net::ERR_CONNECTION_RESET|net::ERR_ABORTED|status of 404/i.test(e);

  function watchConsole(page) {
    const errors = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
    page.on("requestfailed", (req) => {
      errors.push(`requestfailed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "?"})`);
    });
    page.on("response", (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });
    return () => errors.filter((e) => !isKnownNoise(e));
  }

  let browser;
  try {
    // (browserRef se enlaza justo después de lanzar Chromium, más abajo)
    await waitForServer(BASE_URL, 20000);
    console.log("→ vite listo. Abriendo Chromium…");
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    browserRef = browser;

    // Contextos separados por escenario: son "dos dispositivos distintos"
    // (localStorage/IndexedDB aislados). Compartir un mismo contexto haría
    // que la sesión anónima de la demo contaminara la sesión real, o
    // viceversa — el mismo tipo de aislamiento que el propio Novimed exige
    // entre tenants (ARCHITECTURE.md §5, caché local por institución).

    // ── Escenario 1: demo (eight-demo) ──────────────────────────────────
    const demoCtx = await browser.newContext();
    const demoPage = await demoCtx.newPage();
    const demoErrors = watchConsole(demoPage);
    await demoPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    console.log("→ [demo] Entrando como 'Explorar demo' (tenant eight-demo)…");
    await demoPage.click("#authDemoBtn");
    await demoPage.waitForSelector("#authGate", { state: "hidden", timeout: 20000 });
    await demoPage.waitForFunction(
      () => document.getElementById("mainStudentName")?.textContent?.trim().length > 0,
      { timeout: 20000 }
    );
    const demoHero = await demoPage.textContent("#mainStudentName");
    const demoKpi = await demoPage.textContent("#kpiAlerts");
    await demoPage.screenshot({ path: "scripts/smoke-demo.png", fullPage: true });
    console.log(`  [demo] mainStudentName="${demoHero}" kpiAlerts="${demoKpi}"`);
    await demoPage.close();
    await demoCtx.close();

    if (demoHero.trim() !== "Sofía Martínez") {
      throw new Error(`[demo] Se esperaba "Sofía Martínez" (guion de ventas intacto), se obtuvo "${demoHero}". `
        + `V42.0 rompió el guion de la demo — ver ROADMAP_V42.md §5.`);
    }

    // ── Escenario 2: institución real, alerta pendiente real ────────────
    const realCtx = await browser.newContext();
    const realPage = await realCtx.newPage();
    const realErrors = watchConsole(realPage);
    await realPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    console.log("→ [real] Ingresando con cuenta real de colegio-test…");
    await realPage.fill("#authEmail", TEST_EMAIL);
    await realPage.fill("#authPass", TEST_PASSWORD);
    await realPage.click("#authLoginBtn");
    await realPage.waitForSelector("#authGate", { state: "hidden", timeout: 20000 });
    console.log("  [real] authGate oculto (login OK). Esperando que el héroe muestre la alerta…");
    try {
      await realPage.waitForFunction(
        (name) => document.getElementById("mainStudentName")?.textContent?.trim() === name,
        studentName,
        { timeout: 20000 }
      );
    } catch (waitErr) {
      const diag = await realPage.evaluate(() => ({
        mainStudentName: document.getElementById("mainStudentName")?.textContent,
        syncStatus: window.novimedSyncStatus,
        cloudReady: window.novimedCloudReady,
        activeAlertId: window.novimedState?.activeAlertId,
        alertsLen: Array.isArray(window.novimedState?.alerts) ? window.novimedState.alerts.length : "no-array",
        alertsSample: (window.novimedState?.alerts || []).slice(0, 3),
        currentAlert: window.novimedState?.currentAlert,
        alertSent: window.novimedState?.alertSent
      }));
      console.error("  [real] DIAGNÓSTICO al fallar el héroe:", JSON.stringify(diag, null, 2));
      console.error("  [real] Errores de consola capturados hasta ahora:", JSON.stringify(realErrors(), null, 2));
      throw waitErr;
    }
    const beforeHero = await realPage.textContent("#mainStudentName");
    console.log(`  [real] Con active-case presente → mainStudentName="${beforeHero}"`);

    console.log("→ [real] Borrando meta/active-case a mano en el emulador (criterio de aceptación V42.0)…");
    await caseRef.delete();
    await realPage.reload({ waitUntil: "domcontentloaded" });
    // Recarga completa: no queda nada en memoria. Si esto resuelve, es
    // porque activeAlert() lo sacó de la cola `alerts`, no del documento.
    // La sesión de Firebase Auth persiste en IndexedDB entre recargas
    // (ARCHITECTURE.md §6, mismo mecanismo documentado para la sesión
    // anónima): authGate ya está oculto de entrada, no hace falta volver
    // a llenar el formulario de login.
    console.log("→ [real] Esperando a que la sesión se reanude sola tras la recarga…");
    await realPage.waitForSelector("#authGate", { state: "hidden", timeout: 20000 });
    // Espera el valor CORRECTO, no "cualquier texto": justo tras la recarga
    // el primer render es neutro (antes de que el listener de `alerts` se
    // conecte y aporte el dato), y ese neutro también tiene texto no vacío.
    try {
      await realPage.waitForFunction(
        (name) => document.getElementById("mainStudentName")?.textContent?.trim() === name,
        studentName,
        { timeout: 20000 }
      );
    } catch (waitErr) {
      const diag = await realPage.evaluate(() => ({
        mainStudentName: document.getElementById("mainStudentName")?.textContent,
        syncStatus: window.novimedSyncStatus,
        cloudReady: window.novimedCloudReady,
        activeAlertId: window.novimedState?.activeAlertId,
        alertsLen: Array.isArray(window.novimedState?.alerts) ? window.novimedState.alerts.length : "no-array",
        alertsSample: (window.novimedState?.alerts || []).slice(0, 3),
        currentAlert: window.novimedState?.currentAlert,
        alertSent: window.novimedState?.alertSent
      }));
      console.error("  [real] DIAGNÓSTICO tras recarga:", JSON.stringify(diag, null, 2));
      console.error("  [real] Errores de consola:", JSON.stringify(realErrors(), null, 2));
      throw waitErr;
    }
    const afterHero = await realPage.textContent("#mainStudentName");
    const afterMeta = await realPage.textContent("#mainStudentMeta");
    await realPage.screenshot({ path: "scripts/smoke-real-after-delete.png", fullPage: true });
    console.log(`  [real] Sin active-case, tras recarga → mainStudentName="${afterHero}" mainStudentMeta="${afterMeta}"`);
    await realPage.close();
    await realCtx.close();

    if (afterHero.trim() !== studentName) {
      throw new Error(`[real] CRITERIO DE ACEPTACIÓN V42.0 NO CUMPLIDO: con active-case borrado y `
        + `la página recargada, se esperaba "${studentName}" y se obtuvo "${afterHero}".`);
    }

    const badConsole = [...demoErrors(), ...realErrors()];
    if (badConsole.length) {
      throw new Error("Errores de consola durante la carga:\n  " + badConsole.join("\n  "));
    }

    console.log("\n✅ Smoke test OK:");
    console.log("   - Demo eight-demo: el guion de ventas de Sofía Martínez sigue intacto.");
    console.log("   - Institución real: la alerta pendiente se ve con active-case presente");
    console.log("     Y sigue viéndose igual después de borrar active-case y recargar la página");
    console.log("     desde cero — el héroe ya no depende de ese documento único (V42.0).");
  } finally {
    // browser.close() puede colgarse tras una página en mal estado (se
    // observó en la práctica: deja el emulador y vite vivos para siempre,
    // rompiendo la siguiente corrida por puerto ocupado). Con carrera
    // contra un timeout y un kill duro de respaldo, cleanup() SIEMPRE se
    // ejecuta.
    if (browser) {
      await Promise.race([
        browser.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 8000))
      ]);
    }
    cleanup();
  }
}

main()
  .catch((err) => {
    console.error("\n✖ Smoke test falló:", err.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Se observó en la práctica: incluso tras cerrar vite y Chromium,
    // algún handle (WebChannel/long-polling de Firestore, típicamente)
    // puede dejar el proceso vivo indefinidamente en vez de drenar solo.
    // Salida explícita: el resultado ya se imprimió y process.exitCode
    // ya está fijado arriba si algo falló.
    process.exit(process.exitCode || 0);
  });
