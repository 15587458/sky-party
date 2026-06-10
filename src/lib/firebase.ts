import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// We'll try to import the config.
import firebaseConfig from '../../firebase-applet-config.json';

function getFirebaseApp() {
  if (getApps().length > 0) return getApp();
  
  const isPlaceholder = !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_API_KEY");
  
  if (isPlaceholder) {
    return null;
  }
  
  try {
    return initializeApp(firebaseConfig);
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return null;
  }
}

const app = getFirebaseApp();

export const db = app ? initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig?.firestoreDatabaseId) : null;

export const auth = app ? getAuth(app) : null;

// Validate Connection to Firestore
async function testConnection() {
  if (!db) return;
  try {
    // Only test if not already connected
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    } else {
      console.warn("Firestore connection test failed (expected if 'test' collection doesn't exist, but confirming connectivity):", error);
    }
  }
}

if (db) {
  testConnection();
}

export function getFbFirestore() {
  return db;
}

export function getFbAuth() {
  return auth;
}
