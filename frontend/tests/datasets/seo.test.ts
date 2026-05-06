import { describe, expect, it } from "vitest";
import {
  buildDatasetMetadata,
  buildDatasetJsonLd,
  buildSearchPageMetadata,
} from "@/lib/datasets/seo";

const summary = {
  id: "ds-1",
  title: "Korean Legal Q&A",
  description: "한국 법률 데이터셋",
  ownerName: "Alice",
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
