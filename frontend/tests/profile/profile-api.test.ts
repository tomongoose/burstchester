import { describe, expect, it, vi } from "vitest";

import { fetchMyProfile, saveMyProfile } from "@/lib/profile/profile-api";

const PROFILE = {
  uid: "user-1",
  displayName: "Alice",
  email: "alice@example.com",
  photoURL: "https://example.com/a.png",
  description: "Builder",
  workplace: "Acme",
  uploadCount: 1,
  downloadCount: 2,
  reputation: 3,
};

describe("profile api", () => {
  it("fetches the current user profile with a Firebase bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, profile: PROFILE }),
      { status: 200 },
    ));
    const user = { uid: "user-1", getIdToken: vi.fn(async () => "id-token") };

    await expect(fetchMyProfile({
      user,
      endpointUrl: "https://functions.example/upsertCliProfile",
      fetchImpl,
    })).resolves.toEqual(PROFILE);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/upsertCliProfile",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer id-token",
          Accept: "application/json",
        },
      },
    );
  });

  it("fetches a public profile by uid", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, profile: { ...PROFILE, email: "" } }),
      { status: 200 },
    ));
    const user = { uid: "viewer", getIdToken: vi.fn(async () => "id-token") };

    await expect(fetchMyProfile({
      user,
      uid: "user-1",
      endpointUrl: "https://functions.example/upsertCliProfile",
      fetchImpl,
    })).resolves.toEqual({ ...PROFILE, email: "" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/upsertCliProfile?uid=user-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("saves editable profile fields", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, profile: PROFILE }),
      { status: 200 },
    ));
    const user = { uid: "user-1", getIdToken: vi.fn(async () => "id-token") };

    await saveMyProfile({
      user,
      endpointUrl: "https://functions.example/upsertCliProfile",
      fetchImpl,
      profile: {
        displayName: "Alice",
        description: "Builder",
        workplace: "Acme",
        photoURL: "https://example.com/a.png",
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://functions.example/upsertCliProfile",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          displayName: "Alice",
          description: "Builder",
          workplace: "Acme",
          photoURL: "https://example.com/a.png",
        }),
      }),
    );
  });
});
