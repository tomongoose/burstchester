import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-nav/SiteFooter";
import { SiteNav } from "@/components/site-nav/SiteNav";

export const metadata: Metadata = {
  title: "Points Policy | Burstchester",
  description:
    "How Burstchester points work during the Gemma 4 Good Hackathon test open period.",
};

const FLOWS = [
  {
    title: "Downloads create a reward signal",
    body: "When a user downloads a dataset or model, the point cost records real demand for that asset. During the test period this is an accounting signal, and the uploader can receive a share of the points after marketplace review and abuse checks.",
    icon: "download",
  },
  {
    title: "Creators earn from useful uploads",
    body: "Useful uploads should not disappear into a flat list. Points help identify assets that other builders actually use, giving uploaders a measurable reason to improve documentation, quality, coverage, and licensing clarity.",
    icon: "workspace_premium",
  },
  {
    title: "Cash withdrawal is planned",
    body: "After the payment layer opens, creators with enough eligible earned points will be able to request a cash withdrawal through a verified payout flow. The exact threshold, review rules, fees, and settlement schedule will be published before activation.",
    icon: "payments",
  },
] as const;

const PRINCIPLES = [
  "Purchases and cash withdrawals are disabled during the Gemma 4 Good Hackathon test open period.",
  "Download costs should be visible before users spend points.",
  "Creator rewards should come from legitimate downloads and accepted marketplace activity.",
  "Point activity should improve asset discovery, reputation, and trust signals.",
] as const;

const EXPLAINERS = [
  {
    title: "Test open status",
    body: "Burstchester is currently open for testing around the Gemma 4 Good Hackathon. Point purchases, paid checkout, and cash withdrawals are not active yet. Balances shown during this period help us test product flow, download accounting, creator incentives, and abuse prevention before real payments are enabled.",
  },
  {
    title: "What happens when someone downloads",
    body: "A downloaded asset sends a stronger signal than a view or a like. The downloader spends the listed point cost, and the uploader may receive an eligible portion of that value once the activity passes basic review. That portion is intentionally not treated as final cash during the test period.",
  },
  {
    title: "How earned points can become cash later",
    body: "When payment functionality is activated, creators who have accumulated enough eligible earned points will be able to submit a withdrawal request. We plan to require account verification, fraud checks, minimum balance rules, and transparent payout records so withdrawals reward real contribution rather than artificial traffic.",
  },
  {
    title: "Why this encourages participation",
    body: "The point system gives builders a reason to upload assets that others can actually use. Downloaders get a clear way to spend value on helpful datasets and models, while creators get a visible path from contribution to reputation, marketplace demand, and future payout eligibility.",
  },
  {
    title: "Why points improve trust",
    body: "Points can become a quality signal when they are tied to real downloads, review, repeat usage, and creator history. Assets that consistently earn points from legitimate users can be ranked and evaluated with more confidence than assets judged only by titles, tags, or self-written descriptions.",
  },
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
                Points connect useful datasets and models with the people who
                build on top of them. During the Gemma 4 Good Hackathon test
                open period, payment and cash withdrawal features are disabled
                while we validate download accounting, creator rewards, and
                trust signals.
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
                <PolicyMetric label="Test status" value="Payments off" />
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

          <section className="mt-lg rounded-xl border border-primary/25 bg-primary/10 p-lg">
            <p className="font-label text-label uppercase tracking-widest text-primary">
              Gemma 4 Good Hackathon test open
            </p>
            <h2 className="mt-xs font-h2 text-h2 text-on-surface">
              Payments and cash withdrawals are not active yet.
            </h2>
            <div className="mt-md grid gap-md">
              {EXPLAINERS.map((section) => (
                <article key={section.title}>
                  <h3 className="font-h2 text-h3 text-on-surface">
                    {section.title}
                  </h3>
                  <p className="mt-xs font-body text-body-md text-on-surface-variant">
                    {section.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

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
                Real payments come after trustworthy accounting.
              </h2>
              <p className="mt-md font-body text-body-md text-on-surface-variant">
                Burstchester will activate point purchases and creator
                withdrawals only after the marketplace has clear balances,
                download accounting, asset review, abuse monitoring, payout
                rules, and user-facing policy disclosures. Until then, points
                are used to test the economic layer and make the value of
                datasets and models easier to evaluate.
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
