import { describe, expect, it } from "vitest";

import { resolveFirebaseWebConfig } from "@/lib/firebase";

describe("resolveFirebaseWebConfig", () => {
  it("falls back to the project defaults when NEXT_PUBLIC env vars are missing", () => {
    const originalEnv = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

    const config = resolveFirebaseWebConfig();

    expect(config.projectId).toBe("bustchester-e08c3");
    expect(config.apiKey).toBeTruthy();
    expect(config.appId).toBeTruthy();

    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalEnv.apiKey;
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = originalEnv.authDomain;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = originalEnv.projectId;
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = originalEnv.storageBucket;
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = originalEnv.messagingSenderId;
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = originalEnv.appId;
  });
});
