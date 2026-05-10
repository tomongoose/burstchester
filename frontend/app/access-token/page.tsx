"use client";

import { AccessTokenIssuer } from "@/components/access-token/AccessTokenIssuer";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SiteNav } from "@/components/site-nav/SiteNav";

export default function AccessTokenPage() {
  const { status, user } = useAuth();
  const loading = status === "loading";

  return (
    <>
      <SiteNav active="tokens" />
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-container-max px-gutter py-xl">
          {loading ? <AccessTokenSkeleton /> : <AccessTokenIssuer currentUser={user} />}
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
