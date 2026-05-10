import type { JSX } from "react";
import Link from "next/link";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { buildProfileHref } from "@/lib/profile/routes";

interface ModelCardProps {
  readonly model: ModelSummary;
}

export function ModelCard({ model }: ModelCardProps): JSX.Element {
  return (
    <article className="card-hover-glow flex h-full flex-col overflow-hidden border border-white/10 bg-surface-container">
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-tertiary/20 via-surface-container-high to-surface-container">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(45,212,191,0.16),transparent_70%)]" />
        <span className="absolute bottom-2 left-md font-label text-label uppercase tracking-[0.22em] text-on-surface-variant">
          {model.trainingMethod}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-md p-lg">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.22em] text-primary">
            Fine-tuned model
          </p>
          <h4 className="mt-xs break-words font-h3 text-body-lg font-bold text-on-surface">
            {model.id}
          </h4>
          <OwnerLink model={model} />
        </div>
        <dl className="grid gap-sm font-body text-body-sm text-on-surface-variant">
          <div>
            <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              Base
            </dt>
            <dd className="mt-1 break-words text-on-surface">{model.baseModel}</dd>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                Datasets
              </dt>
              <dd className="mt-1 text-on-surface">{model.trainingDatasetCount}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                Price
              </dt>
              <dd className="mt-1 text-on-surface">{model.pointCost} pts</dd>
            </div>
          </div>
        </dl>
        <div className="mt-auto flex flex-col gap-sm border-t border-outline-variant/20 pt-md">
          <a
            href={model.huggingFaceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-label text-[11px] uppercase tracking-[0.22em] text-primary hover:underline"
          >
            Hugging Face
          </a>
          {model.ollamaPullUrl ? (
            <code className="rounded-lg border border-outline-variant/20 bg-background px-sm py-2 font-mono text-xs text-on-surface-variant">
              {model.ollamaPullUrl}
            </code>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OwnerLink({ model }: { readonly model: ModelSummary }): JSX.Element {
  if (model.ownerLabel === "Anonymous") {
    return (
      <p className="mt-xs font-label text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
        by Anonymous
      </p>
    );
  }

  return (
    <Link
      href={buildProfileHref(model.ownerUid)}
      className="mt-xs inline-flex font-label text-[11px] uppercase tracking-[0.22em] text-primary hover:underline"
    >
      by {model.ownerLabel}
    </Link>
  );
}
