"use client";

import { useState, type FormEvent, type JSX } from "react";
import Link from "next/link";
import {
  issueAccessTokenForUser,
  type AccessTokenUser,
  type IssuedAccessToken,
} from "@/lib/access-tokens/issue-access-token";

interface AccessTokenIssuerProps {
  readonly currentUser: AccessTokenUser | null;
  readonly issueToken?: (input: {
    user: AccessTokenUser;
    label: string;
  }) => Promise<IssuedAccessToken>;
}

export function AccessTokenIssuer({
  currentUser,
  issueToken = issueAccessTokenForUser,
}: AccessTokenIssuerProps): JSX.Element {
  const [label, setLabel] = useState("CLI access token");
  const [issued, setIssued] = useState<IssuedAccessToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) {
    return (
      <section className="rounded-[2rem] border border-outline-variant/30 bg-surface-container p-xl text-center shadow-card">
        <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
          Access token
        </p>
        <h1 className="mt-sm font-h2 text-h2 text-on-surface">
          Sign in to issue an access token
        </h1>
        <p className="mx-auto mt-md max-w-2xl font-body text-body-md text-on-surface-variant">
          Tokens are bound to your account and let CLI or Colab runs download paid
          datasets and models without pasting a Firebase session token.
        </p>
        <Link
          href="/login"
          className="mt-lg inline-flex items-center rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary"
        >
          Sign in
        </Link>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!currentUser || submitting) return;

    setSubmitting(true);
    setError("");
    setCopied(false);
    try {
      setIssued(await issueToken({
        user: currentUser,
        label: label.trim() || "CLI access token",
      }));
    } catch (caught) {
      setIssued(null);
      setError(caught instanceof Error ? caught.message : "Access token issue failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToken(): Promise<void> {
    if (!issued?.token || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(issued.token);
    setCopied(true);
  }

  return (
    <section className="grid gap-lg lg:grid-cols-[1fr_0.85fr]">
      <div className="rounded-[2rem] border border-outline-variant/30 bg-surface-container p-xl shadow-card">
        <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
          Runtime credentials
        </p>
        <h1 className="mt-sm font-h1 text-h1 text-on-surface">
          Issue a CLI access token
        </h1>
        <p className="mt-md max-w-2xl font-body text-body-md text-on-surface-variant">
          Use this token with <code className="text-primary">--access-token</code>{" "}
          or <code className="text-primary">BURSTCHESTER_ACCESS_TOKEN</code> when
          downloading datasets, models, or preparing training runs.
        </p>

        <form className="mt-xl space-y-md" onSubmit={handleSubmit}>
          <label className="block">
            <span className="font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
              Token label
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-sm w-full rounded-xl border border-outline-variant/40 bg-background px-md py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
              aria-label="Token label"
              placeholder="Colab run"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-xl bg-primary px-lg py-3 font-body text-body-md font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Issuing..." : "Issue access token"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-md font-body text-body-sm text-error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="rounded-[2rem] border border-primary/20 bg-primary-container/12 p-xl">
        <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
          One-time secret
        </p>
        {issued ? (
          <div className="mt-md space-y-md">
            <p className="font-body text-body-sm text-on-surface-variant">
              Copy this token now. The backend stores only a hash and will not
              show the secret again.
            </p>
            <pre className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-background p-md font-mono text-sm text-on-surface">
              {issued.token}
            </pre>
            <button
              type="button"
              onClick={copyToken}
              className="rounded-xl border border-primary/40 px-md py-2 font-label text-[11px] uppercase tracking-[0.22em] text-primary transition-colors hover:bg-primary/10"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
            <p className="font-body text-body-sm text-on-surface-variant">
              Token ID: <span className="text-on-surface">{issued.tokenId}</span>
            </p>
          </div>
        ) : (
          <div className="mt-md rounded-xl border border-dashed border-outline-variant/40 p-lg font-body text-body-sm text-on-surface-variant">
            The generated token will appear here after issuance.
          </div>
        )}
      </div>
    </section>
  );
}
