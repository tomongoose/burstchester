"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ProfileCard, type ProfileCardData } from "@/components/profile/ProfileCard";
import { getDb, getFirebaseAuth } from "@/lib/firebase";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubDoc: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      unsubDoc?.();
      unsubDoc = undefined;
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const ref = doc(getDb(), "users", user.uid);
      unsubDoc = onSnapshot(ref, (snap) => {
        setProfile(snap.exists() ? (snap.data() as ProfileCardData) : null);
        setLoading(false);
      });
    });
    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  if (loading) return <main>Loading…</main>;
  if (!profile) return <main>Please sign in.</main>;
  return (
    <main>
      <ProfileCard profile={profile} />
    </main>
  );
}
