"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ModelSummary } from "@/lib/domain/model-summary";
import { buildProfileHref } from "@/lib/profile/routes";
import { buildModelDetailHref } from "@/lib/models/routes";
import { toHuggingFaceRepoUrl } from "@/lib/models/huggingface-url";
import { HuggingFaceRepoActions } from "./HuggingFaceRepoActions";

interface ModelCardProps {
  readonly model: ModelSummary;
}

export function ModelCard({ model }: ModelCardProps): JSX.Element {
  const router = useRouter();
  const detailHref = buildModelDetailHref(model.id);
  const huggingFaceRepoUrl = toHuggingFaceRepoUrl(model.huggingFaceUrl);

  function openDetail(): void {
    router.push(detailHref);
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${model.title} details`}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      className="card-hover-glow flex h-full cursor-pointer flex-col overflow-hidden border border-white/10 bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
    >
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
          <Link
            href={detailHref}
            onClick={(event) => event.stopPropagation()}
            className="mt-xs block break-words font-h3 text-body-lg font-bold text-on-surface hover:text-primary"
          >
            {model.title}
          </Link>
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
          <HuggingFaceRepoActions repoUrl={huggingFaceRepoUrl} compact />
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
      onClick={(event) => event.stopPropagation()}
      className="mt-xs inline-flex font-label text-[11px] uppercase tracking-[0.22em] text-primary hover:underline"
    >
      by {model.ownerLabel}
    </Link>
  );
}
