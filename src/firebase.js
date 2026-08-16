import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

let db = null;
let currentApp = null;

// Your registered Firebase project credentials set as the default fallback
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCohMFSQ3WTTcAwHeZGEeoDVObVnG9T_F8",
  authDomain: "popquiz-4c8e7.firebaseapp.com",
  projectId: "popquiz-4c8e7",
  storageBucket: "popquiz-4c8e7.firebasestorage.app",
  messagingSenderId: "123107095300",
  appId: "1:123107095300:web:970fe38e1670242b3b5651"
};

// Initialize Firebase dynamically
export function initFirebase(config) {
  try {
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

// Retrieve the database instance
export function getDb() {
  if (db) return db;

  // 1. Check for Vite environment variables (ideal for production deployment customization)
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

  // 2. Check local storage overrides (from setup settings modal)
  const savedConfig = localStorage.getItem("firebase_config");
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      return initFirebase(config);
    } catch (e) {
      console.error("Failed to parse saved Firebase config:", e);
    }
  }

  // 3. Fall back to your pre-configured project credentials (ensures immediate out-of-the-box play)
  if (DEFAULT_FIREBASE_CONFIG.apiKey) {
    const initializedDb = initFirebase(DEFAULT_FIREBASE_CONFIG);
    if (initializedDb) return initializedDb;
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
