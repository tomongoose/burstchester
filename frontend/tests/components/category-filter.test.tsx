import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilter } from "@/components/datasets/CategoryFilter";
import { SearchFilter } from "@/lib/domain/search-filter";

describe("CategoryFilter", () => {
  it("renders 5 filter group sections (domain/language/task/baseModel/size)", () => {
    render(<CategoryFilter filter={SearchFilter.create({})} onChange={() => {}} />);

    expect(screen.getByRole("group", { name: /domain/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /task/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /base model/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /size/i })).toBeInTheDocument();
  });

  it("calls onChange with an updated SearchFilter when a chip is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryFilter filter={SearchFilter.create({})} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^ko$/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as SearchFilter;
    expect(next.language).toBe("ko");
  });

  it("renders the multi-language chip as all while preserving the multi filter value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryFilter filter={SearchFilter.create({})} onChange={onChange} />);

    expect(screen.queryByRole("button", { name: /^multi$/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^all$/i }));

    const next = onChange.mock.calls[0][0] as SearchFilter;
    expect(next.language).toBe("multi");
  });

  it("marks the active chip with aria-pressed=true", () => {
    render(<CategoryFilter filter={SearchFilter.create({ language: "ko" })} onChange={() => {}} />);

    const koChip = screen.getByRole("button", { name: /^ko$/i });
    expect(koChip).toHaveAttribute("aria-pressed", "true");
  });

  it("clears a filter field when its active chip is clicked again (toggle)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryFilter filter={SearchFilter.create({ language: "ko" })} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /^ko$/i }));

    const next = onChange.mock.calls[0][0] as SearchFilter;
    expect(next.language).toBeNull();
  });

  it("renders no active chip when initial filter is empty", () => {
    render(<CategoryFilter filter={SearchFilter.create({})} onChange={() => {}} />);

    const pressed = screen.queryAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(0);
  });
});
