import Link from "next/link";
import { GoogleRedirectHandler } from "@/components/auth/GoogleRedirectHandler";
import { LoginButton } from "@/components/auth/LoginButton";
import { LoginSessionPanel } from "@/components/auth/LoginSessionPanel";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      <GoogleRedirectHandler />
      <div className="absolute inset-0 kinetic-glow pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] px-md">
        <div className="card-inner-shadow flex flex-col items-center rounded-xl border border-outline-variant bg-surface-container p-xl">
          <Link
            href="/"
            className="mb-xl inline-flex items-center gap-sm font-h2 text-h2 font-bold text-primary"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-container text-on-primary-container">
              B
            </span>
            Burstchester
          </Link>

          <div className="mb-lg text-center">
            <h2 className="mb-sm font-h2 text-h2 text-on-surface">
              Sign in to continue
            </h2>
            <p className="font-body text-body-md text-on-surface-variant">
              Use your Google account to upload datasets, like, and download in
              one click.
            </p>
          </div>

          <LoginButton />
          <LoginSessionPanel />

          <p className="mt-lg font-body text-body-md text-on-surface-variant">
            By continuing, you agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <div className="mt-xl w-full border-t border-outline-variant/30 pt-lg text-center">
            <p className="font-label text-label uppercase tracking-widest text-on-surface-variant">
              Local-first usage. Your data stays yours.
            </p>
          </div>
        </div>

        <p className="mt-lg text-center font-body text-body-md text-on-surface-variant">
          Need help?{" "}
          <a
            href="https://github.com/tomato-data/burstchester/issues"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Contact us
          </a>
        </p>
      </div>
    </main>
  );
}
