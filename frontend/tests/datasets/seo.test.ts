import { describe, expect, it } from "vitest";
import {
  buildDatasetMetadata,
  buildDatasetJsonLd,
  buildSearchPageMetadata,
  buildLandingPageMetadata,
  buildTermsPageMetadata,
  buildPrivacyPageMetadata,
} from "@/lib/datasets/seo";

const summary = {
  id: "ds-1",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  ownerLabel: "Alice",
  tags: ["legal", "korean"],
  likeCount: 12,
  downloadCount: 47,
};

describe("buildDatasetMetadata", () => {
  it("includes the dataset title and description", () => {
    const meta = buildDatasetMetadata(summary);

    expect(meta.title).toMatch(/Korean Legal Q&A/);
    expect(meta.description).toBe("한국 법률 데이터셋");
  });
});

describe("buildDatasetJsonLd", () => {
  it("emits a schema.org Dataset @type", () => {
    const ld = buildDatasetJsonLd(summary);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Dataset");
  });

  it("includes the creator name", () => {
    const ld = buildDatasetJsonLd(summary);

    expect(ld.creator).toEqual({ "@type": "Person", name: "Alice" });
  });
});

describe("buildSearchPageMetadata", () => {
  it("returns static title and description for the search page", () => {
    const meta = buildSearchPageMetadata();

    expect(meta.title).toMatch(/Datasets/i);
    expect(meta.description).toMatch(/.+/);
  });
});

describe("buildLandingPageMetadata", () => {
  it("returns non-empty title and description for the landing page", () => {
    const meta = buildLandingPageMetadata();

    expect(typeof meta.title).toBe("string");
    expect(meta.title).toMatch(/Burstchester/i);
    expect(meta.description).toMatch(/.+/);
  });
});

describe("buildTermsPageMetadata", () => {
  it("returns non-empty title and description for the terms page", () => {
    const meta = buildTermsPageMetadata();

    expect(meta.title).toMatch(/terms/i);
    expect(meta.description).toMatch(/.+/);
  });
});

describe("buildPrivacyPageMetadata", () => {
  it("returns non-empty title and description for the privacy page", () => {
    const meta = buildPrivacyPageMetadata();

    expect(meta.title).toMatch(/privacy/i);
    expect(meta.description).toMatch(/.+/);
  });
});
