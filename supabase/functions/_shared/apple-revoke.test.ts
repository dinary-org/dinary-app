import { exportJWK, exportPKCS8, generateKeyPair, SignJWT } from "npm:jose@6.1.3";
import { revokeAppleAuthorization } from "./apple-revoke.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("Apple deletion validates the linked identity and fails closed before revocation", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_CLIENT_ID"];
  const old = names.map((name) => Deno.env.get(name));
  const signing = await generateKeyPair("ES256", { extractable: true });
  const apple = await generateKeyPair("RS256");
  const jwk = await exportJWK(apple.publicKey);
  let mode: "ok" | "wrong-user" | "expired-code" | "revoke-failure" = "ok";
  let revocations = 0;
  let requests = 0;
  try {
    Deno.env.set("APPLE_TEAM_ID", "TESTTEAM");
    Deno.env.set("APPLE_KEY_ID", "TESTKEY");
    Deno.env.set("APPLE_CLIENT_ID", "app.dinary");
    Deno.env.set("APPLE_PRIVATE_KEY", await exportPKCS8(signing.privateKey));
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests++;
      const url = String(input);
      if (url.endsWith("/auth/keys")) return Response.json({ keys: [{ ...jwk, kid: "test-apple", alg: "RS256", use: "sig" }] });
      if (url.endsWith("/auth/token")) {
        if (mode === "expired-code") return Response.json({ error: "invalid_grant" }, { status: 400 });
        const body = new URLSearchParams(String(init?.body));
        assert(body.get("code") === "fresh-code", "fresh authorization code required");
        assert(body.get("client_id") === "app.dinary", "fixed native audience required");
        const token = await new SignJWT({})
          .setProtectedHeader({ alg: "RS256", kid: "test-apple" })
          .setIssuer("https://appleid.apple.com").setAudience("app.dinary")
          .setSubject(mode === "wrong-user" ? "other-apple-user" : "linked-apple-user")
          .setIssuedAt().setExpirationTime("5m").sign(apple.privateKey);
        return Response.json({ id_token: token, refresh_token: "server-only-refresh-token" });
      }
      if (url.endsWith("/auth/revoke")) {
        revocations++;
        const body = new URLSearchParams(String(init?.body));
        assert(body.get("token_type_hint") === "refresh_token", "must revoke refresh token");
        assert(body.get("token") === "server-only-refresh-token", "must use exchanged token");
        return new Response(null, { status: mode === "revoke-failure" ? 503 : 200 });
      }
      throw new Error("Unexpected network request");
    }) as typeof fetch;
    await revokeAppleAuthorization("fresh-code", "linked-apple-user");
    assert(revocations === 1, "matching identity revoked");
    for (const next of ["wrong-user", "expired-code", "revoke-failure"] as const) {
      mode = next;
      let rejected = false;
      try { await revokeAppleAuthorization("fresh-code", "linked-apple-user"); } catch { rejected = true; }
      assert(rejected, `${next} must reject deletion`);
      if (next !== "revoke-failure") assert(revocations === 1, "must not revoke another identity or expired code");
    }
    const before = requests;
    Deno.env.delete("APPLE_PRIVATE_KEY");
    let rejected = false;
    try { await revokeAppleAuthorization("fresh-code", "linked-apple-user"); } catch { rejected = true; }
    assert(rejected && requests === before, "missing credentials must fail before network/destruction");
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => old[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, old[i]!));
  }
});
