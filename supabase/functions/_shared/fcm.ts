const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID")!;
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL")!;
const FCM_PRIVATE_KEY = Deno.env.get("FCM_PRIVATE_KEY")!;

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedToken.expiresAt - 60) {
    return cachedToken.token;
  }

  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: FCM_CLIENT_EMAIL,
        sub: FCM_CLIENT_EMAIL,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/firebase.cloud-messaging",
      })
    )
  );

  console.log("FCM auth - email:", FCM_CLIENT_EMAIL, "project:", FCM_PROJECT_ID);

  const key = await importPrivateKey(FCM_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(header + "." + payload)
  );

  const jwt = header + "." + payload + "." + base64url(new Uint8Array(signature));

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });

  const tokenResText = await tokenRes.text();
  console.log("Google OAuth response:", tokenRes.status, tokenResText.substring(0, 300));

  if (!tokenRes.ok) {
    throw new Error("Failed to get FCM access token: " + tokenResText);
  }

  const tokenData = JSON.parse(tokenResText);
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };
  return cachedToken.token;
}

async function sendFcmNotification(
  deviceToken: string,
  title: string,
  body: string,
  url: string
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: { url },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("FCM send failed for token " + deviceToken.substring(0, 20) + "...:", err);
      return false;
    }
    console.log("FCM send success for token " + deviceToken.substring(0, 20) + "...");
    return true;
  } catch (err) {
    console.error("FCM send error:", err);
    return false;
  }
}

export async function sendFcmToUsers(
  supabase: any,
  recipientIds: string[],
  title: string,
  body: string,
  url: string
): Promise<void> {
  const { data: tokens, error } = await supabase
    .from("device_tokens")
    .select("token")
    .in("user_id", recipientIds);

  if (error || !tokens || tokens.length === 0) {
    console.log("No device tokens found, recipients:", recipientIds.length);
    return;
  }

  console.log("Sending FCM to", tokens.length, "device(s)");
  await Promise.all(
    tokens.map((t: { token: string }) => sendFcmNotification(t.token, title, body, url))
  );
}
