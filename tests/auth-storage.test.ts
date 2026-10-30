import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  AuthStorageUnavailableError,
  createHybridAuthStorage,
  DEFAULT_PKCE_TTL_MS,
  MAX_PKCE_TTL_MS,
  type AuthPersistentStorage,
} from "../src/auth/storage.ts";

const KEY = "fonseca-auth-storage-test";
const LEGACY = `${KEY}-code-verifier`;
const INDEX = `${KEY}-flows-code-verifier`;
const FLOW = "syntheticFlow1234";
const slot = (flow = FLOW) => `${KEY}-flow-${flow}-code-verifier`;
const VERIFIER = "a".repeat(64);
const NOW = Date.UTC(2026, 9, 28, 12);

class MemoryPersistent implements AuthPersistentStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("only exact valid PKCE keys persist; new documents have no session/user/token", () => {
  const persistent = new MemoryPersistent();
  const first = createHybridAuthStorage({
    storageKey: KEY,
    persistent,
    now: () => NOW,
  });
  assert.equal(first.preflight(), true);
  assert.equal(persistent.length, 0);
  for (const key of [
    KEY,
    `${KEY}-user`,
    `${KEY}-other-code-verifier`,
    `other-${KEY}-code-verifier`,
    `${KEY}-flow-x-code-verifier`,
  ])
    first.setItem(key, "SYNTHETIC_PRIVATE_VALUE");
  first.setItem(LEGACY, JSON.stringify(VERIFIER));
  first.setItem(INDEX, JSON.stringify([FLOW]));
  first.setItem(slot(), JSON.stringify(VERIFIER));
  assert.deepEqual(
    [...persistent.values.keys()].sort(),
    [LEGACY, INDEX, slot()].sort(),
  );
  assert.equal(
    JSON.stringify([...persistent.values]).includes("SYNTHETIC_PRIVATE_VALUE"),
    false,
  );
  const second = createHybridAuthStorage({
    storageKey: KEY,
    persistent,
    now: () => NOW + 1,
  });
  assert.equal(second.getItem(KEY), null);
  assert.equal(second.getItem(`${KEY}-user`), null);
  assert.equal(second.getItem(LEGACY), JSON.stringify(VERIFIER));
  assert.equal(second.getItem(slot()), JSON.stringify(VERIFIER));
  assert.equal(second.getItem(INDEX), JSON.stringify([FLOW]));
});

test("PKCE values expire without read extension, and corrupt/oversized/future entries fail closed", () => {
  const persistent = new MemoryPersistent();
  let time = NOW;
  const storage = createHybridAuthStorage({
    storageKey: KEY,
    persistent,
    now: () => time,
  });
  storage.setItem(LEGACY, JSON.stringify(VERIFIER));
  const raw = persistent.getItem(LEGACY);
  time += DEFAULT_PKCE_TTL_MS - 1;
  assert.equal(storage.getItem(LEGACY), JSON.stringify(VERIFIER));
  assert.equal(persistent.getItem(LEGACY), raw);
  time++;
  assert.equal(storage.getItem(LEGACY), null);
  assert.equal(persistent.getItem(LEGACY), null);
  for (const value of [
    "not-json",
    "x".repeat(4097),
    JSON.stringify({
      v: 1,
      writtenAt: time + 1,
      expiresAt: time + 100,
      value: JSON.stringify(VERIFIER),
    }),
    JSON.stringify({
      v: 1,
      writtenAt: time,
      expiresAt: time + MAX_PKCE_TTL_MS + 1,
      value: JSON.stringify(VERIFIER),
    }),
    JSON.stringify({
      v: 1,
      writtenAt: time,
      expiresAt: time + 100,
      value: '{"access_token":"synthetic"}',
    }),
  ]) {
    persistent.setItem(LEGACY, value);
    assert.equal(storage.getItem(LEGACY), null);
    assert.equal(persistent.getItem(LEGACY), null);
  }
});

test("durable PKCE content validation rejects session payloads and malformed indexes", () => {
  const persistent = new MemoryPersistent();
  const storage = createHybridAuthStorage({ storageKey: KEY, persistent });
  for (const value of [
    '{"access_token":"synthetic"}',
    JSON.stringify("short"),
    JSON.stringify("a".repeat(129)),
    "not-json",
  ])
    assert.throws(
      () => storage.setItem(LEGACY, value),
      AuthStorageUnavailableError,
    );
  for (const value of [
    JSON.stringify([FLOW, FLOW]),
    JSON.stringify(["bad"]),
    JSON.stringify([1]),
    JSON.stringify(Array.from({ length: 6 }, (_, n) => `synthetic${n}`)),
  ])
    assert.throws(
      () => storage.setItem(INDEX, value),
      AuthStorageUnavailableError,
    );
  assert.equal(persistent.length, 0);
});

test("clearAll removes orphan slots but preserves unrelated storage and clears memory on failure", () => {
  const persistent = new MemoryPersistent();
  persistent.setItem("another-app-code-verifier", "unrelated");
  const storage = createHybridAuthStorage({ storageKey: KEY, persistent });
  storage.setItem(slot(), JSON.stringify(VERIFIER));
  storage.setItem(KEY, "session");
  storage.clearMemory();
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.getItem(slot()), JSON.stringify(VERIFIER));
  storage.setItem(KEY, "session");
  assert.equal(storage.clearAll(), true);
  assert.equal(storage.getItem(KEY), null);
  assert.deepEqual(
    [...persistent.values],
    [["another-app-code-verifier", "unrelated"]],
  );
  const absent = createHybridAuthStorage({ storageKey: KEY, persistent: null });
  absent.setItem(KEY, "session");
  assert.equal(absent.preflight(), false);
  assert.equal(absent.clearAll(), false);
  assert.equal(absent.getItem(KEY), null);
  assert.throws(
    () => absent.setItem(LEGACY, JSON.stringify(VERIFIER)),
    AuthStorageUnavailableError,
  );
});

test("storage exceptions and configuration failures never expose underlying messages", () => {
  const broken: AuthPersistentStorage = {
    length: 0,
    key: () => null,
    getItem: () => {
      throw new Error("SYNTHETIC_SECRET_BROWSER_MESSAGE");
    },
    setItem: () => {
      throw new Error("SYNTHETIC_SECRET_BROWSER_MESSAGE");
    },
    removeItem: () => {
      throw new Error("SYNTHETIC_SECRET_BROWSER_MESSAGE");
    },
  };
  const storage = createHybridAuthStorage({
    storageKey: KEY,
    persistent: broken,
  });
  assert.equal(storage.preflight(), false);
  for (const run of [
    () => storage.getItem(LEGACY),
    () => storage.setItem(LEGACY, JSON.stringify(VERIFIER)),
    () => storage.removeItem(LEGACY),
  ])
    assert.throws(
      run,
      (error) =>
        error instanceof AuthStorageUnavailableError &&
        !String(error).includes("SYNTHETIC_SECRET"),
    );
  for (const ttlMs of [0, -1, NaN, MAX_PKCE_TTL_MS + 1])
    assert.throws(
      () =>
        createHybridAuthStorage({ storageKey: KEY, persistent: null, ttlMs }),
      AuthStorageUnavailableError,
    );
  assert.throws(
    () =>
      createHybridAuthStorage({ storageKey: "untrusted.*", persistent: null }),
    AuthStorageUnavailableError,
  );
});

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function sdkHarness(
  persistent: MemoryPersistent,
  now: () => number = () => Date.now(),
  appendFlowId = false,
) {
  const requests: { url: URL; body: Record<string, unknown> }[] = [];
  const storage = createHybridAuthStorage({ storageKey: KEY, persistent, now });
  const client = createClient(
    "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
    "sb_publishable_synthetic_only",
    {
      auth: {
        storageKey: KEY,
        storage,
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        debug: false,
        experimental: { appendPkceFlowIdToRedirects: appendFlowId },
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          const body = JSON.parse(String(init?.body ?? "{}")) as Record<
            string,
            unknown
          >;
          requests.push({ url, body });
          if (url.pathname === "/auth/v1/otp") return json({});
          if (
            url.pathname === "/auth/v1/token" &&
            url.searchParams.get("grant_type") === "pkce"
          )
            return json({
              access_token: "SYNTHETIC_ACCESS_TOKEN",
              refresh_token: "SYNTHETIC_REFRESH_TOKEN",
              token_type: "bearer",
              expires_in: 3600,
              user: {
                id: "10000000-0000-4000-8000-000000000001",
                email: "synthetic@example.invalid",
                aud: "authenticated",
                role: "authenticated",
                email_confirmed_at: new Date().toISOString(),
                is_anonymous: false,
                app_metadata: {},
                user_metadata: {},
                created_at: new Date().toISOString(),
              },
            });
          throw new Error("Unexpected test transport");
        },
      },
    },
  );
  return { client, storage, requests };
}

test("real SDK PKCE can exchange from a new document with no durable tokens and cannot reuse verifier", async () => {
  const persistent = new MemoryPersistent();
  const first = sdkHarness(persistent);
  const started = await first.client.auth.signInWithOtp({
    email: "synthetic@example.invalid",
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "http://127.0.0.1:5174/auth/callback",
    },
  });
  assert.equal(started.error, null);
  assert.equal(first.requests.length, 1);
  const request = first.requests[0];
  assert.equal(request.body.code_challenge_method, "s256");
  assert.equal(request.body.create_user, true);
  const redirect = new URL(request.url.searchParams.get("redirect_to")!);
  assert.equal(
    redirect.origin + redirect.pathname,
    "http://127.0.0.1:5174/auth/callback",
  );
  assert.equal(redirect.search, "");
  await first.client.auth.dispose();

  const second = sdkHarness(persistent);
  assert.equal(second.storage.getItem(KEY), null);
  const exchanged = await second.client.auth.exchangeCodeForSession(
    "synthetic-one-use-code",
  );
  assert.equal(exchanged.error, null);
  assert.equal(exchanged.data.session?.access_token, "SYNTHETIC_ACCESS_TOKEN");
  assert.equal(second.requests.length, 1);
  const verifier = second.requests[0].body.code_verifier as string;
  assert.equal(
    createHash("sha256").update(verifier).digest("base64url"),
    request.body.code_challenge,
  );
  // The SDK's legacy exchange removes only the legacy key. Explicit teardown
  // clears the corresponding slot/index, including any orphaned flow.
  assert.equal(second.storage.getItem(LEGACY), null);
  assert.equal(second.storage.clearPkce(), true);
  assert.equal(persistent.length, 0);
  assert.match(second.storage.getItem(KEY)!, /SYNTHETIC_ACCESS_TOKEN/);
  const repeated = await second.client.auth.exchangeCodeForSession(
    "synthetic-one-use-code",
  );
  assert.ok(repeated.error);
  assert.equal(second.requests.length, 1);
  const third = sdkHarness(persistent);
  assert.equal(third.storage.getItem(KEY), null);
  await second.client.auth.dispose();
  await third.client.auth.dispose();
});

test("real SDK expired and mismatched flow verifiers fail before token transport", async () => {
  const persistent = new MemoryPersistent();
  let now = Date.now();
  const first = sdkHarness(persistent, () => now, true);
  await first.client.auth.signInWithOtp({
    email: "synthetic@example.invalid",
    options: { emailRedirectTo: "http://127.0.0.1:5174/auth/callback" },
  });
  const redirect = new URL(
    first.requests[0].url.searchParams.get("redirect_to")!,
  );
  const flowId = redirect.searchParams.get("sb_flow_id")!;
  await first.client.auth.dispose();
  const second = sdkHarness(persistent, () => now);
  const wrong = await second.client.auth.exchangeCodeForSession(
    "synthetic-code",
    { flowId: "differentFlow1234" },
  );
  assert.ok(wrong.error);
  assert.equal(second.requests.length, 0);
  assert.notEqual(second.storage.getItem(slot(flowId)), null);
  now += DEFAULT_PKCE_TTL_MS;
  const expired = await second.client.auth.exchangeCodeForSession(
    "synthetic-code",
    { flowId },
  );
  assert.ok(expired.error);
  assert.equal(second.requests.length, 0);
  assert.equal(second.storage.clearAll(), true);
  await second.client.auth.dispose();
});

test("real SDK optional flow-ID callback exchanges its own slot and cleans its index", async () => {
  const persistent = new MemoryPersistent();
  const first = sdkHarness(persistent, () => Date.now(), true);
  await first.client.auth.signInWithOtp({
    email: "synthetic@example.invalid",
    options: { emailRedirectTo: "http://127.0.0.1:5174/auth/callback" },
  });
  const redirect = new URL(
    first.requests[0].url.searchParams.get("redirect_to")!,
  );
  const flowId = redirect.searchParams.get("sb_flow_id")!;
  assert.match(flowId, /^[a-zA-Z0-9_-]{8,64}$/);
  await first.client.auth.dispose();
  const second = sdkHarness(persistent);
  const result = await second.client.auth.exchangeCodeForSession(
    "synthetic-code",
    { flowId },
  );
  assert.equal(result.error, null);
  assert.equal(second.requests.length, 1);
  assert.equal(persistent.length, 0);
  assert.match(second.storage.getItem(KEY)!, /SYNTHETIC_REFRESH_TOKEN/);
  second.storage.clearMemory();
  assert.equal(second.storage.getItem(KEY), null);
  await second.client.auth.dispose();
});

test("real SDK storage failure stops OTP before network and emits no durable session", async () => {
  const persistent = new MemoryPersistent();
  persistent.setItem = () => {
    throw new Error("SYNTHETIC_QUOTA_DETAIL");
  };
  const attempt = sdkHarness(persistent);
  assert.equal(attempt.storage.preflight(), false);
  await assert.rejects(
    attempt.client.auth.signInWithOtp({
      email: "synthetic@example.invalid",
      options: { emailRedirectTo: "http://127.0.0.1:5174/auth/callback" },
    }),
    (error) =>
      error instanceof AuthStorageUnavailableError &&
      !String(error).includes("SYNTHETIC_QUOTA_DETAIL"),
  );
  assert.equal(attempt.requests.length, 0);
  assert.equal(persistent.length, 0);
  await attempt.client.auth.dispose();
});
