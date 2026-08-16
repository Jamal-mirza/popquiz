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

// Retrieve the database instance, attempting to auto-load from localStorage if available
export function getDb() {
  if (db) return db;

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
