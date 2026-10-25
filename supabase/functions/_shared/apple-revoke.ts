import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "npm:jose@6.1.3";

const issuer = "https://appleid.apple.com";
const keys = createRemoteJWKSet(new URL(`${issuer}/auth/keys`));

/** Fresh native authorization code; never trust a client-supplied Apple subject. */
export async function revokeAppleAuthorization(code: unknown, expectedSubject: string) {
  if (typeof code !== "string" || code.length < 1 || code.length > 4096) {
    throw new Error("Apple로 본인 확인을 다시 해 주세요.");
  }
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const clientId = Deno.env.get("APPLE_CLIENT_ID") || "app.dinary";
  if (!teamId || !keyId || !privateKey) {
    throw new Error("Apple 연결 해제 설정을 확인 중입니다. 잠시 뒤 다시 시도하거나 삭제 요청 페이지로 문의해 주세요.");
  }
  const key = await importPKCS8(privateKey, "ES256");
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId).setSubject(clientId).setAudience(issuer)
    .setIssuedAt().setExpirationTime("5m").sign(key);
  const exchange = await fetch(`${issuer}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15000),
  });
  const tokens = await exchange.json();
  if (!exchange.ok || typeof tokens.id_token !== "string" || typeof tokens.refresh_token !== "string") {
    throw new Error("Apple 본인 확인이 만료되었어요. 다시 시도해 주세요.");
  }
  const { payload } = await jwtVerify(tokens.id_token, keys, { issuer, audience: clientId, algorithms: ["RS256"] });
  if (payload.sub !== expectedSubject) throw new Error("DINARY에 연결된 Apple 계정으로 확인해 주세요.");
  const revoked = await fetch(`${issuer}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token: tokens.refresh_token, token_type_hint: "refresh_token" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!revoked.ok) throw new Error("Apple 연결을 해제하지 못했어요. 다시 시도해 주세요.");
}
