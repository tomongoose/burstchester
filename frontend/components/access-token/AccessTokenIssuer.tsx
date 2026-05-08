"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import Link from "next/link";
import {
  issueAccessTokenForUser,
  type AccessTokenUser,
  type IssuedAccessToken,
} from "@/lib/access-tokens/issue-access-token";
import { getOrCreateAccessTokenUser } from "@/lib/access-tokens/anonymous-token-user";
import {
  deleteAccessTokenForUser,
  listAccessTokensForUser,
  type AccessTokenSummary,
} from "@/lib/access-tokens/manage-access-tokens";

interface AccessTokenIssuerProps {
  readonly currentUser: AccessTokenUser | null;
  readonly issueToken?: (input: {
    user: AccessTokenUser;
    label: string;
  }) => Promise<IssuedAccessToken>;
  readonly getTokenUser?: () => Promise<AccessTokenUser>;
  readonly listTokens?: (input: {
    user: AccessTokenUser;
  }) => Promise<AccessTokenSummary[]>;
  readonly deleteToken?: (input: {
    user: AccessTokenUser;
    tokenId: string;
  }) => Promise<void>;
}

export function AccessTokenIssuer({
  currentUser,
  issueToken = issueAccessTokenForUser,
  getTokenUser = getOrCreateAccessTokenUser,
  listTokens = listAccessTokensForUser,
  deleteToken = deleteAccessTokenForUser,
}: AccessTokenIssuerProps): JSX.Element {
  const [label, setLabel] = useState("CLI access token");
  const [issued, setIssued] = useState<IssuedAccessToken | null>(null);
  const [anonymousTokenOwner, setAnonymousTokenOwner] =
    useState<AccessTokenUser | null>(null);
  const [tokens, setTokens] = useState<AccessTokenSummary[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [deletingTokenId, setDeletingTokenId] = useState("");
  const tokenOwner = currentUser ?? anonymousTokenOwner;

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    void Promise.resolve().then(async () => {
      setLoadingTokens(true);
      setListError("");
      try {
        const loadedTokens = await listTokens({ user: currentUser });
        if (!cancelled) setTokens(loadedTokens);
      } catch (caught) {
        if (!cancelled) {
          setListError(caught instanceof Error ? caught.message : "Access token listing failed.");
        }
      } finally {
        if (!cancelled) setLoadingTokens(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, listTokens]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setCopied(false);
    try {
      const tokenUser = currentUser ?? await getTokenUser();
      if (!currentUser) setAnonymousTokenOwner(tokenUser);
      const nextIssued = await issueToken({
        user: tokenUser,
        label: label.trim() || "CLI access token",
      });
      setIssued(nextIssued);
      setTokens(await listTokens({ user: tokenUser }));
    } catch (caught) {
      setIssued(null);
      setError(caught instanceof Error ? caught.message : "Access token issue failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteIssuedToken(tokenId: string): Promise<void> {
    if (!tokenOwner || deletingTokenId) return;
    setDeletingTokenId(tokenId);
    setListError("");
    try {
      await deleteToken({ user: tokenOwner, tokenId });
      setTokens((current) => current.filter((token) => token.id !== tokenId));
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : "Access token deletion failed.");
    } finally {
      setDeletingTokenId("");
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
            {submitting
              ? "Issuing..."
              : currentUser
                ? "Issue access token"
                : "Issue anonymous access token"}
          </button>
          {!currentUser ? (
            <p className="font-body text-body-sm text-on-surface-variant">
              No login required. This creates an anonymous Firebase account for
              token ownership. You can still{" "}
              <Link href="/login" className="text-primary hover:underline">
                sign in with Google
              </Link>{" "}
              to bind future tokens to your Google profile.
            </p>
          ) : null}
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

      <div className="rounded-[2rem] border border-outline-variant/30 bg-surface-container p-xl shadow-card lg:col-span-2">
        <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.26em] text-primary">
              Token management
            </p>
            <h2 className="mt-sm font-h2 text-h2 text-on-surface">
              Your access tokens
            </h2>
          </div>
          {loadingTokens ? (
            <p className="font-body text-body-sm text-on-surface-variant">
              Loading tokens...
            </p>
          ) : null}
        </div>

        {listError ? (
          <p role="alert" className="mt-md font-body text-body-sm text-error">
            {listError}
          </p>
        ) : null}

        {!tokenOwner ? (
          <div className="mt-md rounded-xl border border-dashed border-outline-variant/40 p-lg font-body text-body-sm text-on-surface-variant">
            Sign in or issue an anonymous token to load tokens stored under your
            user ID.
          </div>
        ) : tokens.length > 0 ? (
          <div className="mt-lg grid gap-sm">
            {tokens.map((token) => (
              <article
                key={token.id}
                className="flex flex-col gap-sm rounded-xl border border-outline-variant/30 bg-background p-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-body text-body-md font-bold text-on-surface">
                    {token.label}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-on-surface-variant">
                    {token.id}
                  </p>
                  <p className="mt-2 font-body text-body-sm text-on-surface-variant">
                    Created {formatTokenDate(token.createdAt)}
                    {token.lastUsedAt
                      ? ` · Last used ${formatTokenDate(token.lastUsedAt)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteIssuedToken(token.id)}
                  disabled={Boolean(deletingTokenId)}
                  className="self-start rounded-xl border border-error/40 px-md py-2 font-label text-[11px] uppercase tracking-[0.22em] text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
                >
                  {deletingTokenId === token.id ? "Deleting..." : "Delete"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-md rounded-xl border border-dashed border-outline-variant/40 p-lg font-body text-body-sm text-on-surface-variant">
            No active access tokens are stored for this user.
          </div>
        )}
      </div>
    </section>
  );
}

function formatTokenDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
