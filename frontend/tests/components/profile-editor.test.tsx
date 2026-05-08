import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProfileEditor } from "@/components/profile/ProfileEditor";

const PROFILE = {
  uid: "user-1",
  displayName: "Alice",
  email: "alice@example.com",
  photoURL: "",
  description: "",
  workplace: "",
  uploadCount: 0,
  downloadCount: 0,
  reputation: 0,
};

describe("ProfileEditor", () => {
  it("saves editable profile fields", async () => {
    const user = userEvent.setup();
    const saveProfile = vi.fn(async ({ profile }) => ({
      ...PROFILE,
      ...profile,
    }));
    const onSaved = vi.fn();

    render(
      <ProfileEditor
        user={{ uid: "user-1", getIdToken: async () => "id-token" }}
        profile={PROFILE}
        saveProfile={saveProfile}
        uploadPhoto={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.clear(screen.getByLabelText(/workplace/i));
    await user.type(screen.getByLabelText(/workplace/i), "Acme AI");
    await user.type(screen.getByLabelText(/about/i), "Dataset curator");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(saveProfile).toHaveBeenCalledWith({
      user: expect.any(Object),
      profile: {
        displayName: "Alice",
        description: "Dataset curator",
        workplace: "Acme AI",
        photoURL: "",
      },
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      workplace: "Acme AI",
    }));
  });
});
