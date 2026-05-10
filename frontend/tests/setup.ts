import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node 22+ injects an experimental globalThis.localStorage stub that lacks the
// Storage API (no getItem/setItem/clear). When jsdom proxies window globals it
// surfaces this broken stub, so production code that touches localStorage
// silently no-ops in tests. Replace with a Map-backed Storage that mirrors the
// browser API.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

const memoryLocalStorage = createMemoryStorage();
const memorySessionStorage = createMemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: memoryLocalStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: memorySessionStorage,
  writable: true,
  configurable: true,
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: memoryLocalStorage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: memorySessionStorage,
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
