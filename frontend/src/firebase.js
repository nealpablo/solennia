// /src/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getDatabase,
  ref,
  push,
  onValue,
  set,
  update
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC_GISDBsbuQK2xwQohGBUuZ8Qu1pkGggI",
  authDomain: "solennia-cafc2.firebaseapp.com",
  databaseURL:
    "https://solennia-cafc2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "solennia-cafc2",
  storageBucket: "solennia-cafc2.firebasestorage.app",
  messagingSenderId: "1050301290248",
  appId: "1:1050301290248:web:fc6debbf4022db37d73ebd",
  measurementId: "G-XHFHLKPCKB"
};

// ✅ SAFE INITIALIZER (added, nothing removed)
export function initFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
}

// ✅ Ensure app exists (backward compatible)
const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

// helpers (unchanged)
export const dbRef = ref;
export const dbPush = push;
export const dbSet = set;
export const dbUpdate = update;
export const dbOn = onValue;
