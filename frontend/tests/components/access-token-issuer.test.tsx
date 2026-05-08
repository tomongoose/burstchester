import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccessTokenIssuer } from "@/components/access-token/AccessTokenIssuer";

describe("AccessTokenIssuer", () => {
  it("prompts signed-out users to sign in", () => {
    render(<AccessTokenIssuer currentUser={null} />);

    expect(screen.getByText(/sign in to issue an access token/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("issues and displays a token for the signed-in user", async () => {
    const user = userEvent.setup();
    const issueToken = vi.fn(async () => ({
      token: "bst_token-id_secret",
      tokenId: "token-id",
    }));

    render(
      <AccessTokenIssuer
        currentUser={{ getIdToken: async () => "firebase-id-token" }}
        issueToken={issueToken}
      />,
    );

    await user.clear(screen.getByLabelText(/token label/i));
    await user.type(screen.getByLabelText(/token label/i), "Colab");
    await user.click(screen.getByRole("button", { name: /issue access token/i }));

    expect(issueToken).toHaveBeenCalledWith({
      user: expect.any(Object),
      label: "Colab",
    });
    expect(await screen.findByText("bst_token-id_secret")).toBeInTheDocument();
    expect(screen.getByText(/copy this token now/i)).toBeInTheDocument();
  });
});
