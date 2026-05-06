import type { JSX } from "react";
import Link from "next/link";

export function Hero(): JSX.Element {
  return (
    <section>
      <h1>Fine-tuning datasets, ready for Ollama.</h1>
      <p>
        Discover community-curated LLM datasets, train locally with the bundled
        Colab notebook, and run the result with Ollama in three steps.
      </p>
      <div>
        <Link href="/datasets">Browse datasets</Link>
        <Link href="/login">Sign in to upload</Link>
      </div>
    </section>
  );
}
