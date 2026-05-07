const HF_ID_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export class HuggingFaceLocator {
  private constructor(
    readonly huggingFaceId: string,
    readonly revision: string,
  ) {}

  static create(huggingFaceId: string, revision: string): HuggingFaceLocator {
    if (!HF_ID_PATTERN.test(huggingFaceId)) {
      throw new Error(
        `Invalid huggingFaceId: "${huggingFaceId}" must match "org/name" pattern`,
      );
    }
    if (!revision || !revision.trim()) {
      throw new Error("revision must be a non-empty string");
    }
    return Object.freeze(new HuggingFaceLocator(huggingFaceId, revision));
  }

  resolveUrl(filePath: string): string {
    return `https://huggingface.co/datasets/${this.huggingFaceId}/resolve/${this.revision}/${filePath}`;
  }
}
