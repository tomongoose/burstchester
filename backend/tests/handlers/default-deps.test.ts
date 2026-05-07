import { describe, expect, it, vi, beforeEach } from "vitest";

// Spies for firebase-admin getters; reset between tests.
const adminAppSpies = {
  getApps: vi.fn(() => [] as unknown[]),
  initializeApp: vi.fn(),
};
const firestoreSpy = vi.fn(() => ({ __brand: "firestore" } as unknown));
const databaseSpy = vi.fn(() => ({ __brand: "database" } as unknown));
const storageSpy = vi.fn(() => ({ __brand: "storage" } as unknown));

vi.mock("firebase-admin/app", () => ({
  getApps: () => adminAppSpies.getApps(),
  initializeApp: (...args: unknown[]) => adminAppSpies.initializeApp(...args),
}));

vi.mock("firebase-admin/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase-admin/firestore")>(
    "firebase-admin/firestore",
  );
  return {
    ...actual,
    getFirestore: () => firestoreSpy(),
    FieldValue: actual.FieldValue,
    Timestamp: actual.Timestamp,
  };
});

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => storageSpy(),
}));

vi.mock("firebase-admin/database", () => ({
  getDatabase: () => databaseSpy(),
}));

beforeEach(() => {
  adminAppSpies.getApps.mockClear();
  adminAppSpies.initializeApp.mockClear();
  firestoreSpy.mockClear();
  databaseSpy.mockClear();
  storageSpy.mockClear();
  adminAppSpies.getApps.mockReturnValue([]);
  vi.resetModules();
});

describe("buildDefaultHandlerDeps — lazy admin SDK initialization", () => {
  it("does not call admin SDK getters at module import time", async () => {
    await import("@/handlers/deps");

    expect(adminAppSpies.initializeApp).not.toHaveBeenCalled();
    expect(firestoreSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(databaseSpy).not.toHaveBeenCalled();
  });

  it("initializes the firebase app exactly once across multiple invocations", async () => {
    const { buildDefaultHandlerDeps } = await import("@/handlers/deps");

    buildDefaultHandlerDeps();
    adminAppSpies.getApps.mockReturnValue([{} as unknown]);
    buildDefaultHandlerDeps();

    expect(adminAppSpies.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("returns deps with db, storage, clock, fieldValue, generateId", async () => {
    const { buildDefaultHandlerDeps } = await import("@/handlers/deps");

    const deps = buildDefaultHandlerDeps();

    expect(deps.db).toBeDefined();
    expect(deps.storage).toBeDefined();
    expect(deps.database).toBeDefined();
    expect(deps.clock).toBeDefined();
    expect(deps.fieldValue).toBeDefined();
    expect(deps.generateId).toBeDefined();
  });

  it("freezes the returned deps object", async () => {
    const { buildDefaultHandlerDeps } = await import("@/handlers/deps");

    const deps = buildDefaultHandlerDeps();

    expect(Object.isFrozen(deps)).toBe(true);
  });

  it("clock.now() returns a Timestamp instance", async () => {
    const { buildDefaultHandlerDeps } = await import("@/handlers/deps");
    const { Timestamp } = await import("firebase-admin/firestore");

    const deps = buildDefaultHandlerDeps();
    const now = deps.clock.now();

    expect(now).toBeInstanceOf(Timestamp);
  });

  it("generateId returns a unique string on each call", async () => {
    const { buildDefaultHandlerDeps } = await import("@/handlers/deps");

    const deps = buildDefaultHandlerDeps();
    const a = deps.generateId();
    const b = deps.generateId();

    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
  });
});
