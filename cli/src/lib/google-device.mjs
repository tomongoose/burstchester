export async function startGoogleDeviceFlow({
  clientId,
  scope = "openid email profile",
  fetchImpl = fetch,
}) {
  const response = await fetchImpl("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Failed to start Google device flow.");
  }

  return payload;
}

export async function pollGoogleDeviceFlow({
  clientId,
  clientSecret,
  deviceCode,
  interval,
  fetchImpl = fetch,
  sleepImpl = sleep,
}) {
  let pollIntervalMs = Number(interval || 5) * 1000;

  for (;;) {
    await sleepImpl(pollIntervalMs);

    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: deviceCode,
        grant_type: "http://oauth.net/grant_type/device/1.0",
      }),
    });

    const payload = await response.json();
    if (response.ok) {
      return payload;
    }

    if (payload?.error === "authorization_pending") {
      continue;
    }

    if (payload?.error === "slow_down") {
      pollIntervalMs += 5_000;
      continue;
    }

    throw new Error(payload?.error_description || payload?.error || "Google device flow failed.");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
