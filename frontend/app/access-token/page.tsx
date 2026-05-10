"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { AccessTokenIssuer } from "@/components/access-token/AccessTokenIssuer";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SiteNav } from "@/components/site-nav/SiteNav";
import { getFirebaseAuth } from "@/lib/firebase";

export default function AccessTokenPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <SiteNav active="tokens" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter py-xl">
          {loading ? <AccessTokenSkeleton /> : <AccessTokenIssuer currentUser={currentUser} />}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function AccessTokenSkeleton() {
  return (
    <div className="rounded-[2rem] border border-outline-variant/30 bg-surface-container p-xl shadow-card">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-container-high" />
      <div className="mt-md h-12 w-2/3 animate-pulse rounded bg-surface-container-high" />
      <div className="mt-lg h-32 animate-pulse rounded-xl bg-surface-container-high" />
    </div>
  );
}
