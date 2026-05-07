import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";

const DEFAULT_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBT48mVt9IDw6Ctf_VjNl0JNc4S1SrVZfs",
  authDomain: "bustchester-e08c3.firebaseapp.com",
  projectId: "bustchester-e08c3",
  storageBucket: "bustchester-e08c3.firebasestorage.app",
  messagingSenderId: "542098071019",
  appId: "1:542098071019:web:99a5d7b6592d67514ecdae",
});

export function resolveFirebaseWebConfig() {
  return {
    apiKey:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.authDomain,
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.projectId,
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.storageBucket,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.messagingSenderId,
    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
      || DEFAULT_FIREBASE_WEB_CONFIG.appId,
  };
}

const firebaseConfig = resolveFirebaseWebConfig();

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;
let cachedFunctions: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1";

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  if (useEmulator && typeof window !== "undefined") {
    connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return cachedAuth;
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getFirebaseApp());
  if (useEmulator && typeof window !== "undefined") {
    connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
  }
  return cachedDb;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;
  cachedStorage = getStorage(getFirebaseApp());
  if (useEmulator && typeof window !== "undefined") {
    connectStorageEmulator(cachedStorage, "127.0.0.1", 9199);
  }
  return cachedStorage;
}

export function getFirebaseFunctions(): Functions {
  if (cachedFunctions) return cachedFunctions;
  cachedFunctions = getFunctions(getFirebaseApp());
  if (useEmulator && typeof window !== "undefined") {
    connectFunctionsEmulator(cachedFunctions, "127.0.0.1", 5001);
  }
  return cachedFunctions;
}
