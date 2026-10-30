import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAuthFlow,
  AUTH_ATTEMPT_KEY,
  AUTH_STORAGE_KEY,
  type AuthPort,
} from "../src/auth/flow.ts";
import {
  createHybridAuthStorage,
  type AuthPersistentStorage,
} from "../src/auth/storage.ts";
import { AUTH_ORIGIN, parseCallback } from "../src/auth/callback.ts";
import type { AuthConfig } from "../src/auth/config.ts";
import type { CatalogSession } from "../src/data/catalog-read.ts";

const NOW = Date.UTC(2026, 9, 28, 12);
const EMAIL = "synthetic@example.invalid";
const USER = {
  id: "10000000-0000-4000-8000-000000000001",
  email: EMAIL,
  email_confirmed_at: new Date(NOW - 1000).toISOString(),
  is_anonymous: false,
};
const CONFIG: AuthConfig = {
  enabled: true,
  dispatchEnabled: true,
  expectedEmail: EMAIL,
  baseUrl: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_only",
};
const INPUT = {
  origin: AUTH_ORIGIN,
  pathname: "/auth/callback",
  search: "?code=synthetic-code-only",
  hash: "",
};
const VERIFIER = "a".repeat(56);

function persistent(): AuthPersistentStorage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(
  options: {
    config?: AuthConfig;
    persistent?: AuthPersistentStorage | null;
    exclusive?: <T>(task: () => Promise<T>) => Promise<T>;
    cryptoReady?: () => boolean;
  } = {},
) {
  let time = NOW;
  const durable =
    options.persistent === undefined ? persistent() : options.persistent;
  const storage = createHybridAuthStorage({
    storageKey: AUTH_STORAGE_KEY,
    persistent: durable,
    now: () => time,
  });
  const calls = {
    make: 0,
    send: 0,
    exchange: 0,
    user: 0,
    logout: 0,
    abort: 0,
    dispose: 0,
  };
  const snapshots: Array<CatalogSession | null> = [];
  const successful = () => ({
    error: null,
    session: {
      access_token: "synthetic-access-token",
      expires_at: NOW / 1000 + 3600,
      user: { ...USER },
    },
  });
  const port: AuthPort = {
    async send(email) {
      calls.send++;
      assert.equal(email, EMAIL);
      storage.setItem(
        `${AUTH_STORAGE_KEY}-code-verifier`,
        JSON.stringify(VERIFIER),
      );
      return { error: null };
    },
    async exchange(code) {
      calls.exchange++;
      assert.equal(code, "synthetic-code-only");
      const response = successful();
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.session));
      return response;
    },
    async user(token) {
      calls.user++;
      assert.equal(token, "synthetic-access-token");
      return { error: null, user: { ...USER } };
    },
    async signOut() {
      calls.logout++;
      return { error: null };
    },
    abort() {
      calls.abort++;
    },
    dispose() {
      calls.dispose++;
    },
  };
  const flow = createAuthFlow({
    config: options.config ?? CONFIG,
    storage,
    persistent: durable,
    makeClient: () => {
      calls.make++;
      return port;
    },
    exclusive: options.exclusive ?? (async (task) => task()),
    cryptoReady: options.cryptoReady ?? (() => true),
    sessionChanged: (session) => snapshots.push(session),
    now: () => time,
  });
  function prepare() {
    durable?.setItem(
      AUTH_ATTEMPT_KEY,
      JSON.stringify({ version: 1, status: "accepted", at: NOW }),
    );
    storage.setItem(
      `${AUTH_STORAGE_KEY}-code-verifier`,
      JSON.stringify(VERIFIER),
    );
  }
  return {
    flow,
    storage,
    durable,
    port,
    calls,
    snapshots,
    successful,
    prepare,
    setNow: (value: number) => {
      time = value;
    },
  };
}

test("Auth is inactive without configuration and dispatch remains separately gated", async () => {
  for (const config of [
    { enabled: false } as AuthConfig,
    { ...CONFIG, dispatchEnabled: false } as AuthConfig,
  ]) {
    const h = harness({ config });
    await h.flow.send(EMAIL);
    assert.equal(h.calls.make, 0);
    assert.equal(h.flow.snapshot().status, "inactive");
  }
});

test("only the configured address can be sent, normalized, with a durable guard first", async () => {
  const h = harness();
  await h.flow.send("different@example.invalid");
  assert.equal(h.calls.send, 0);
  h.port.send = async (email) => {
    h.calls.send++;
    assert.equal(email, EMAIL);
    assert.equal(
      JSON.parse(h.durable!.getItem(AUTH_ATTEMPT_KEY)!).status,
      "pending",
    );
    return { error: null };
  };
  await h.flow.send(` ${EMAIL.toUpperCase()} `);
  assert.equal(h.calls.send, 1);
  assert.equal(h.flow.snapshot().status, "requested");
});

test("double click, reload and uncertain outcomes never resend automatically", async () => {
  const h = harness();
  const pending = deferred<{ error: unknown }>();
  h.port.send = async () => {
    h.calls.send++;
    return pending.promise;
  };
  const first = h.flow.send(EMAIL);
  await h.flow.send(EMAIL);
  assert.equal(h.calls.send, 1);
  pending.resolve({ error: new Error("synthetic private provider detail") });
  await first;
  assert.equal(h.flow.snapshot().status, "uncertain");
  assert.doesNotMatch(h.flow.snapshot().message, /private provider/);
  h.flow.dispose();
  const second = harness({ persistent: h.durable });
  await second.flow.send(EMAIL);
  assert.equal(second.calls.send, 0);
  assert.equal(second.flow.snapshot().status, "uncertain");
});

test("storage or crypto failure prevents dispatch before client construction", async () => {
  for (const options of [{ persistent: null }, { cryptoReady: () => false }]) {
    const h = harness(options);
    await h.flow.send(EMAIL);
    assert.equal(h.calls.make, 0);
    assert.notEqual(h.flow.snapshot().status, "requested");
  }
});

test("cancellation while waiting for the cross-tab lock prevents dispatch", async () => {
  const gate = deferred<void>();
  const h = harness({
    exclusive: async (task) => {
      await gate.promise;
      return task();
    },
  });
  const running = h.flow.send(EMAIL);
  h.flow.cancel();
  gate.resolve();
  await running;
  assert.equal(h.calls.send, 0);
  assert.equal(h.flow.snapshot().status, "cancelled");
});

test("a new document can finish the requested flow but cannot recover a persisted session", async () => {
  const first = harness();
  await first.flow.send(EMAIL);
  first.flow.dispose();
  const second = harness({ persistent: first.durable });
  assert.equal(second.storage.getItem(AUTH_STORAGE_KEY), null);
  await second.flow.callback(INPUT);
  assert.equal(second.flow.snapshot().status, "authenticated");
  assert.equal(second.calls.exchange, 1);
  assert.equal(second.calls.user, 1);
  assert.equal(second.snapshots.at(-1)?.userId, USER.id);
  assert.equal(second.snapshots.at(-1)?.expiresAt, NOW + 3_600_000);
  assert.equal(second.durable!.getItem(AUTH_STORAGE_KEY), null);
  assert.equal(
    second.storage.getItem(`${AUTH_STORAGE_KEY}-code-verifier`),
    null,
  );
  assert.equal(
    JSON.parse(second.durable!.getItem(AUTH_ATTEMPT_KEY)!).status,
    "consumed",
  );
});

test("successful callback is consumed once and replay in a fresh document is rejected", async () => {
  const h = harness();
  h.prepare();
  await h.flow.callback(INPUT);
  const fresh = harness({ persistent: h.durable });
  await fresh.flow.callback(INPUT);
  assert.equal(fresh.calls.exchange, 0);
  assert.equal(fresh.flow.snapshot().status, "expired");
  assert.equal(fresh.snapshots.at(-1), null);
});

test("flow ID selects its verifier slot and is passed unchanged to the port", async () => {
  const h = harness();
  h.prepare();
  const flowId = "synthetic_flow_123";
  h.storage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  h.storage.setItem(
    `${AUTH_STORAGE_KEY}-flow-${flowId}-code-verifier`,
    JSON.stringify(VERIFIER),
  );
  h.port.exchange = async (_code, receivedFlowId) => {
    h.calls.exchange++;
    assert.equal(receivedFlowId, flowId);
    return h.successful();
  };
  await h.flow.callback({
    ...INPUT,
    search: `${INPUT.search}&sb_flow_id=${flowId}`,
  });
  assert.equal(h.flow.snapshot().status, "authenticated");
  assert.equal(
    h.storage.getItem(`${AUTH_STORAGE_KEY}-flow-${flowId}-code-verifier`),
    null,
  );
});

test("missing and expired verifiers never exchange", async () => {
  const h = harness();
  h.prepare();
  h.setNow(NOW + h.storage.ttlMs + 1);
  await h.flow.callback(INPUT);
  assert.equal(h.calls.exchange, 0);
  assert.equal(h.flow.snapshot().status, "expired");
  const fresh = harness();
  await fresh.flow.callback(INPUT);
  assert.equal(fresh.calls.exchange, 0);
});

test("unconfirmed, anonymous, unexpected email or mismatched verified ID fail closed", async () => {
  const variants = [
    { ...USER, email_confirmed_at: "" },
    { ...USER, email_confirmed_at: new Date(NOW + 1000).toISOString() },
    { ...USER, is_anonymous: true },
    { ...USER, email: "other@example.invalid" },
    { ...USER, id: "10000000-0000-4000-8000-000000000002" },
  ];
  for (const user of variants) {
    const h = harness();
    h.prepare();
    h.port.user = async () => ({ error: null, user });
    await h.flow.callback(INPUT);
    assert.equal(h.flow.snapshot().status, "error");
    assert.equal(h.snapshots.at(-1), null);
    assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
  }
});

test("invalid session expiration never produces an authenticated snapshot", async () => {
  for (const expires_at of [NaN, Infinity, -Infinity, 0, NOW / 1000 - 1]) {
    const h = harness();
    h.prepare();
    h.port.exchange = async () => ({
      error: null,
      session: { ...h.successful().session, expires_at },
    });
    await h.flow.callback(INPUT);
    assert.equal(h.flow.snapshot().status, "error", String(expires_at));
    assert.equal(h.snapshots.at(-1), null);
  }
});

test("exchange and verification errors are sanitized, consumed and cleaned", async () => {
  for (const stage of ["exchange", "user"] as const) {
    const h = harness();
    h.prepare();
    if (stage === "exchange")
      h.port.exchange = async () => {
        throw new Error("synthetic-secret-code");
      };
    else
      h.port.user = async () => ({
        error: new Error("synthetic-secret-token"),
        user: null,
      });
    await h.flow.callback(INPUT);
    assert.equal(h.flow.snapshot().status, "error");
    assert.doesNotMatch(h.flow.snapshot().message, /synthetic-secret/);
    assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
    assert.equal(h.storage.getItem(`${AUTH_STORAGE_KEY}-code-verifier`), null);
    assert.equal(
      JSON.parse(h.durable!.getItem(AUTH_ATTEMPT_KEY)!).status,
      "consumed",
    );
  }
});

test("cancel suppresses a late exchange response and clears session memory", async () => {
  const h = harness();
  h.prepare();
  const pending = deferred<ReturnType<typeof h.successful>>();
  h.port.exchange = async () => pending.promise;
  const running = h.flow.callback(INPUT);
  await flush();
  h.flow.cancel();
  pending.resolve(h.successful());
  await running;
  assert.equal(h.flow.snapshot().status, "cancelled");
  assert.equal(h.snapshots.at(-1), null);
  assert.equal(h.calls.user, 0);
  assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
});

test("an invalid callback supersedes and invalidates an earlier pending callback", async () => {
  const h = harness();
  h.prepare();
  const pending = deferred<ReturnType<typeof h.successful>>();
  h.port.exchange = async () => pending.promise;
  const running = h.flow.callback(INPUT);
  await flush();
  await h.flow.callback({ ...INPUT, search: "?code=bad" });
  pending.resolve(h.successful());
  await running;
  assert.equal(h.flow.snapshot().status, "error");
  assert.equal(h.snapshots.at(-1), null);
  assert.equal(h.calls.user, 0);
});

test("callback cancellation while queued prevents exchange", async () => {
  const gate = deferred<void>();
  const h = harness({
    exclusive: async (task) => {
      await gate.promise;
      return task();
    },
  });
  h.prepare();
  const running = h.flow.callback(INPUT);
  h.flow.cancel();
  gate.resolve();
  await running;
  assert.equal(h.calls.exchange, 0);
  assert.equal(h.flow.snapshot().status, "cancelled");
});

test("revalidation hides the snapshot until expected identity is freshly verified", async () => {
  const h = harness();
  h.prepare();
  await h.flow.callback(INPUT);
  const pending = deferred<{ error: unknown; user: typeof USER | null }>();
  h.port.user = async () => pending.promise;
  const running = h.flow.revalidate();
  assert.equal(h.snapshots.at(-1), null);
  assert.equal(h.flow.snapshot().status, "checking");
  pending.resolve({ error: null, user: USER });
  await running;
  assert.equal(h.flow.snapshot().status, "authenticated");
  assert.equal(h.snapshots.at(-1)?.userId, USER.id);
  h.port.user = async () => ({
    error: new Error("synthetic revoked"),
    user: null,
  });
  await h.flow.revalidate();
  assert.equal(h.flow.snapshot().status, "error");
  assert.equal(h.snapshots.at(-1), null);
});

test("expiration clears local session without network refresh", async () => {
  const h = harness();
  h.prepare();
  await h.flow.callback(INPUT);
  const before = { ...h.calls };
  h.setNow(NOW + 3_600_001);
  h.flow.checkExpiry();
  assert.equal(h.flow.snapshot().status, "expired");
  assert.equal(h.snapshots.at(-1), null);
  assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
  assert.equal(h.calls.user, before.user);
  assert.equal(h.calls.exchange, before.exchange);
});

test("logout removes local data even when remote revocation fails", async () => {
  const h = harness();
  h.prepare();
  await h.flow.callback(INPUT);
  h.port.signOut = async () => ({
    error: new Error("synthetic private failure"),
  });
  await h.flow.signOut();
  assert.equal(h.flow.snapshot().status, "signed-out");
  assert.match(h.flow.snapshot().message, /N.o foi poss.vel confirmar/);
  assert.equal(h.snapshots.at(-1), null);
  assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
  assert.doesNotMatch(h.flow.snapshot().message, /private failure/);
});

test("malformed callback parameters are rejected without accepting tokens or redirect targets", () => {
  for (const patch of [
    { origin: "http://localhost:5174" },
    { pathname: "/auth/callback/" },
    { hash: "#access_token=synthetic" },
    { search: "?access_token=synthetic" },
    { search: "?code=synthetic-code-only&code=synthetic-other" },
    { search: "?code=synthetic-code-only&mode=demo" },
    { search: "?code=synthetic-code-only&next=https://example.invalid" },
    { search: "?code=synthetic-code-only&sb_flow_id=bad" },
    { search: "?code=%3Cscript%3Ealert(1)%3C/script%3E" },
  ])
    assert.equal(parseCallback({ ...INPUT, ...patch }).ok, false);
  assert.deepEqual(parseCallback({ ...INPUT, search: "" }), {
    ok: false,
    reason: "missing",
  });
  assert.deepEqual(
    parseCallback({
      ...INPUT,
      search:
        "?error=access_denied&error_description=synthetic-sensitive-detail",
    }),
    { ok: false, reason: "provider" },
  );
});
