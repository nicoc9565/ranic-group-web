// Firestore vía Admin SDK — solo para código server-side (API routes de cron). Ignora
// firestore.rules por diseño (service account de confianza). Nunca importar desde componentes
// de cliente ni desde código que corre en el browser.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Inicialización perezosa: el build de Next evalúa el scope de los módulos importados por las
// rutas, y sin la env var cargada un cert({}) a nivel de módulo rompería el build.
let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON");
  app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  return app;
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
