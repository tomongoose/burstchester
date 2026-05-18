export function toHuggingFaceRepoUrl(value: string): string {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "huggingface.co" && hostname !== "hf.co") {
      return value;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return value;

    return `https://huggingface.co/${parts[0]}/${parts[1]}`;
  } catch {
    return value;
  }
}
