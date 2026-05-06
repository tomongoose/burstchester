import { randomUUID } from "node:crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

export interface HandlerClock {
  readonly now: () => Timestamp;
}

export interface HandlerFieldValueFactory {
  readonly serverTimestamp: () => FieldValue;
  readonly increment: (delta: number) => FieldValue;
}

export interface HandlerDeps {
  readonly db: Firestore;
  readonly storage: Storage;
  readonly clock: HandlerClock;
  readonly fieldValue: HandlerFieldValueFactory;
  readonly generateId: () => string;
}

export function buildDefaultHandlerDeps(): HandlerDeps {
  if (getApps().length === 0) {
    initializeApp();
  }
  return Object.freeze({
    db: getFirestore(),
    storage: getStorage(),
    clock: Object.freeze({ now: () => Timestamp.now() }),
    fieldValue: Object.freeze({
      serverTimestamp: () => FieldValue.serverTimestamp(),
      increment: (delta: number) => FieldValue.increment(delta),
    }),
    generateId: () => randomUUID(),
  });
}
