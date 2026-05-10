import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SiteNav } from "@/components/site-nav/SiteNav";

export const metadata: Metadata = {
  title: "Points Policy | Burstchester",
  description:
    "How Burstchester points are earned, spent, and planned to support dataset and model creators.",
};

const FLOWS = [
  {
    title: "Use points to download assets",
    body: "Datasets and models can set a point cost. When you download an asset, points make the exchange explicit and keep usage tied to creator value.",
    icon: "download",
  },
  {
    title: "Earn from useful work",
    body: "Publishing assets, improving quality, and attracting real downloads are the foundation for future point rewards and creator reputation.",
    icon: "workspace_premium",
  },
  {
    title: "Withdraw earned value",
    body: "The roadmap includes cash withdrawals for points earned through accepted marketplace activity, so valuable contributions can become real income.",
    icon: "payments",
  },
] as const;

const PRINCIPLES = [
  "Points should reward assets that save other builders time.",
  "Costs should stay visible before download or model access.",
  "Creator payouts should be tied to legitimate marketplace activity.",
  "Abuse prevention, review, and transparent accounting come before payment launch.",
] as const;

export default function PointsPage() {
  return (
    <>
      <SiteNav active="points" />
      <main className="flex-1 pt-16">
        <section className="border-b border-white/10 bg-surface-container-lowest">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-xl px-gutter py-xl lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <p className="font-label text-label uppercase tracking-widest text-primary">
                Burstchester points
              </p>
              <h1 className="mt-md max-w-3xl font-h1 text-h1 text-on-surface">
                A marketplace currency for useful AI assets.
              </h1>
              <p className="mt-md max-w-2xl font-body text-body-lg text-on-surface-variant">
                Points are designed to connect the people who publish strong
                datasets and models with the builders who use them. Spend them
                on downloads, earn them through contribution, and eventually
                withdraw earned value as the payment layer matures.
              </p>
              <div className="mt-lg flex flex-wrap gap-sm">
                <Link
                  href="/datasets"
                  className="rounded-lg bg-primary px-md py-3 font-body text-body-sm font-bold text-on-primary transition-opacity hover:opacity-90"
                >
                  Browse assets
                </Link>
                <Link
                  href="/profile"
                  className="rounded-lg border border-outline-variant/40 px-md py-3 font-body text-body-sm font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
                >
                  View profile
                </Link>
              </div>
            </div>

            <aside className="rounded-xl border border-outline-variant/30 bg-surface-container p-lg card-inner-shadow">
              <p className="font-label text-label uppercase tracking-widest text-on-surface-variant">
                Current role
              </p>
              <div className="mt-md grid gap-md">
                <PolicyMetric label="Initial balance" value="10,000 pts" />
                <PolicyMetric label="Used for" value="Downloads" />
                <PolicyMetric label="Roadmap" value="Purchase + withdraw" />
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-gutter py-xl">
          <div className="grid gap-lg lg:grid-cols-3">
            {FLOWS.map((flow) => (
              <article
                key={flow.title}
                className="rounded-xl border border-outline-variant/30 bg-surface-container p-lg card-inner-shadow"
              >
                <span className="material-symbols-outlined text-3xl text-primary">
                  {flow.icon}
                </span>
                <h2 className="mt-md font-h2 text-h3 text-on-surface">
                  {flow.title}
                </h2>
                <p className="mt-sm font-body text-body-md text-on-surface-variant">
                  {flow.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-lg grid gap-lg lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-xl border border-outline-variant/30 bg-surface-container p-lg card-inner-shadow">
              <p className="font-label text-label uppercase tracking-widest text-primary">
                Policy principles
              </p>
              <ul className="mt-md grid gap-sm">
                {PRINCIPLES.map((principle) => (
                  <li
                    key={principle}
                    className="flex gap-sm font-body text-body-md text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined mt-1 text-sm text-primary">
                      check_circle
                    </span>
                    <span>{principle}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-primary/25 bg-primary/10 p-lg">
              <p className="font-label text-label uppercase tracking-widest text-primary">
                Payment roadmap
              </p>
              <h2 className="mt-xs font-h2 text-h2 text-on-surface">
                Payments are planned, not rushed.
              </h2>
              <p className="mt-md font-body text-body-md text-on-surface-variant">
                Burstchester will add point purchases and creator withdrawals
                after the marketplace has the right controls: clear balances,
                download accounting, asset review, abuse monitoring, and payout
                rules. Until then, points establish the economic layer and make
                the value of datasets and models visible.
              </p>
            </section>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PolicyMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/25 bg-background/45 p-md">
      <p className="font-label text-label uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="mt-xs font-h2 text-h3 text-on-surface">
        {value}
      </p>
    </div>
  );
}
