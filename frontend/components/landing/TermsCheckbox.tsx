"use client";

import type { JSX } from "react";
import Link from "next/link";

interface TermsCheckboxProps {
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onChange: (next: boolean) => void;
}

export function TermsCheckbox({
  checked = false,
  disabled = false,
  onChange,
}: TermsCheckboxProps): JSX.Element {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        I agree to the <Link href="/terms">Terms of Use</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </span>
    </label>
  );
}
