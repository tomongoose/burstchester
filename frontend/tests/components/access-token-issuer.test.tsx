import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccessTokenIssuer } from "@/components/access-token/AccessTokenIssuer";

describe("AccessTokenIssuer", () => {
  it("allows signed-out users to issue a token through anonymous auth", async () => {
    const user = userEvent.setup();
    const anonymousUser = { getIdToken: async () => "anonymous-id-token" };
    const getTokenUser = vi.fn(async () => anonymousUser);
    const issueToken = vi.fn(async () => ({
      token: "bst_anon_secret",
      tokenId: "anon-token-id",
    }));
    const listTokens = vi.fn(async () => [
      {
        id: "anon-token-id",
        label: "CLI access token",
        createdAt: "2026-05-09T00:00:00.000Z",
      },
    ]);

    render(
      <AccessTokenIssuer
        currentUser={null}
        getTokenUser={getTokenUser}
        issueToken={issueToken}
        listTokens={listTokens}
      />,
    );

    await user.click(screen.getByRole("button", { name: /issue anonymous access token/i }));

    expect(getTokenUser).toHaveBeenCalledTimes(1);
    expect(issueToken).toHaveBeenCalledWith({
      user: anonymousUser,
      label: "CLI access token",
    });
    expect(await screen.findByText("bst_anon_secret")).toBeInTheDocument();
    expect(await screen.findAllByText("anon-token-id")).toHaveLength(2);
  });

  it("issues and displays a token for the signed-in user", async () => {
    const user = userEvent.setup();
    const issueToken = vi.fn(async () => ({
      token: "bst_token-id_secret",
      tokenId: "token-id",
    }));
    const listTokens = vi.fn(async () => [
      {
        id: "token-id",
        label: "Colab",
        createdAt: "2026-05-09T00:00:00.000Z",
      },
    ]);

    render(
      <AccessTokenIssuer
        currentUser={{ getIdToken: async () => "firebase-id-token" }}
        issueToken={issueToken}
        listTokens={listTokens}
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

  it("deletes an existing token from the current user's token list", async () => {
    const user = userEvent.setup();
    const currentUser = { getIdToken: async () => "firebase-id-token" };
    const deleteToken = vi.fn(async () => undefined);
    const listTokens = vi.fn(async () => [
      {
        id: "token-id",
        label: "Colab",
        createdAt: "2026-05-09T00:00:00.000Z",
      },
    ]);

    render(
      <AccessTokenIssuer
        currentUser={currentUser}
        listTokens={listTokens}
        deleteToken={deleteToken}
      />,
    );

    expect(await screen.findByText("token-id")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(deleteToken).toHaveBeenCalledWith({
      user: currentUser,
      tokenId: "token-id",
    });
    expect(await screen.findByText(/no active access tokens/i)).toBeInTheDocument();
  });
});
