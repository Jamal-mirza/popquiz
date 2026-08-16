import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

let db = null;
let currentApp = null;

// Initialize Firebase dynamically
export function initFirebase(config) {
  try {
    // If there are existing apps, clean them up to prevent duplication errors
    const apps = getApps();
    if (apps.length > 0) {
      for (const app of apps) {
        deleteApp(app);
      }
    }
    
    currentApp = initializeApp(config);
    db = getFirestore(currentApp);
    return db;
  } catch (error) {
    console.error("Firebase dynamic initialization failed:", error);
    db = null;
    return null;
  }
}

// Retrieve the database instance, checking environment variables first (for Vercel), then localStorage
export function getDb() {
  if (db) return db;

  // 1. Check for Vite environment variables (ideal for automated production deployment)
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  if (envConfig.apiKey && envConfig.projectId && envConfig.appId) {
    const initializedDb = initFirebase(envConfig);
    if (initializedDb) return initializedDb;
  }

  // 2. Fall back to manual localStorage settings
  const savedConfig = localStorage.getItem("firebase_config");
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      return initFirebase(config);
    } catch (e) {
      console.error("Failed to parse saved Firebase config:", e);
    }
  }
  return null;
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return getDb() !== null;
}

// Clear configuration
export function clearFirebaseConfig() {
  localStorage.removeItem("firebase_config");
  const apps = getApps();
  for (const app of apps) {
    deleteApp(app);
  }
  db = null;
  currentApp = null;
}
