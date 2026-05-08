"use client";

import { useState, type ChangeEvent, type FormEvent, type JSX } from "react";
import type { EditableProfileUser, UserProfile } from "@/lib/profile/profile-api";
import { saveMyProfile, uploadProfilePhoto } from "@/lib/profile/profile-api";

interface ProfileEditorProps {
  readonly user: EditableProfileUser;
  readonly profile: UserProfile;
  readonly onSaved: (profile: UserProfile) => void;
  readonly saveProfile?: typeof saveMyProfile;
  readonly uploadPhoto?: typeof uploadProfilePhoto;
}

export function ProfileEditor({
  user,
  profile,
  onSaved,
  saveProfile = saveMyProfile,
  uploadPhoto = uploadProfilePhoto,
}: ProfileEditorProps): JSX.Element {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [description, setDescription] = useState(profile.description);
  const [workplace, setWorkplace] = useState(profile.workplace);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");
    try {
      setPhotoURL(await uploadPhoto({ user, file }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile photo upload failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    try {
      const saved = await saveProfile({
        user,
        profile: {
          displayName: displayName.trim() || "Anonymous",
          description: description.trim(),
          workplace: workplace.trim(),
          photoURL: photoURL.trim(),
        },
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="rounded-xl border border-outline-variant/30 bg-surface-container p-xl"
    >
      <div>
        <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
          Profile settings
        </p>
        <h2 className="mt-xs font-h2 text-h2 text-on-surface">Edit your profile</h2>
      </div>

      <div className="mt-lg grid gap-md">
        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
            Display name
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-sm w-full rounded-xl border border-outline-variant/40 bg-background px-md py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
            Workplace
          </span>
          <input
            value={workplace}
            onChange={(event) => setWorkplace(event.target.value)}
            placeholder="Acme AI, Research Lab, Independent"
            className="mt-sm w-full rounded-xl border border-outline-variant/40 bg-background px-md py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
            About
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe your datasets, model work, or background."
            className="mt-sm w-full rounded-xl border border-outline-variant/40 bg-background px-md py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
            Profile photo
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              void handlePhotoChange(event);
            }}
            className="mt-sm block w-full font-body text-body-sm text-on-surface-variant file:mr-md file:rounded-lg file:border-0 file:bg-primary file:px-md file:py-2 file:font-label file:text-[11px] file:uppercase file:tracking-[0.2em] file:text-on-primary"
          />
          {photoURL ? (
            <p className="mt-xs break-all font-body text-body-sm text-on-surface-variant">
              Current photo: {photoURL}
            </p>
          ) : null}
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-md font-body text-body-sm text-error">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-lg rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
