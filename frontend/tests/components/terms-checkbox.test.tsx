import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TermsCheckbox } from "@/components/landing/TermsCheckbox";

describe("TermsCheckbox", () => {
  it("renders unchecked when checked prop is not provided", () => {
    render(<TermsCheckbox onChange={() => {}} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("calls onChange with true when an unchecked box is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TermsCheckbox onChange={onChange} />);

    await user.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when a checked box is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TermsCheckbox checked onChange={onChange} />);

    await user.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders a label that links to the /terms page", () => {
    render(<TermsCheckbox onChange={() => {}} />);

    const link = screen.getByRole("link", { name: /terms/i });
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("ignores clicks when disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TermsCheckbox onChange={onChange} disabled />);

    await user.click(screen.getByRole("checkbox"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
