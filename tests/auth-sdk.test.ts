import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createSdkAuthPort } from "../src/auth/sdk.ts";
import { AUTH_STORAGE_KEY } from "../src/auth/flow.ts";
import {
  createHybridAuthStorage,
  type AuthPersistentStorage,
} from "../src/auth/storage.ts";
import type { AuthConfig } from "../src/auth/config.ts";
import { parseCallback, type CallbackInput } from "../src/auth/callback.ts";

const CONFIG: Extract<AuthConfig, { enabled: true }> = {
  enabled: true,
  baseUrl: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_key_0000",
  expectedEmail: "synthetic@example.invalid",
  dispatchEnabled: true,
};
const TOKEN = "SYNTHETIC_SDK_ACCESS_TOKEN";
const REFRESH = "SYNTHETIC_SDK_REFRESH_TOKEN";
const USER = {
  id: "10000000-0000-4000-8000-000000000001",
  email: CONFIG.expectedEmail,
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: false,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

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

type RequestRecord = {
  url: URL;
  init: RequestInit;
  body: Record<string, unknown>;
};
function harness(
  persistent = new MemoryPersistent(),
  options: { expired?: boolean; logoutStatus?: number; failOtp?: boolean } = {},
) {
  const requests: RequestRecord[] = [];
  const storage = createHybridAuthStorage({
    storageKey: AUTH_STORAGE_KEY,
    persistent,
  });
  const fakeFetch: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init.body ?? "{}")) as Record<
      string,
      unknown
    >;
    requests.push({ url, init, body });
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname === "/auth/v1/otp") {
      if (options.failOtp) throw new Error("SYNTHETIC_PRIVATE_NETWORK_DETAIL");
      return json({});
    }
    if (url.pathname === "/auth/v1/token" && url.search === "?grant_type=pkce")
      return json({
        access_token: TOKEN,
        refresh_token: REFRESH,
        token_type: "bearer",
        expires_in: 3600,
        expires_at:
          Math.floor(Date.now() / 1000) + (options.expired ? -60 : 3600),
        user: USER,
      });
    if (url.pathname === "/auth/v1/user") return json(USER);
    if (url.pathname === "/auth/v1/logout")
      return new Response(null, { status: options.logoutStatus ?? 204 });
    throw new Error("Unexpected test transport");
  };
  return {
    persistent,
    storage,
    requests,
    port: createSdkAuthPort(CONFIG, storage, fakeFetch),
  };
}

test("actual SDK adapter sends exact callback/S256/signup and exchanges only once in a new document", async () => {
  const first = harness();
  const second = harness(first.persistent);
  try {
    const sent = await first.port.send(CONFIG.expectedEmail);
    assert.equal(sent.error, null);
    assert.equal(first.requests.length, 1);
    const otp = first.requests[0];
    assert.equal(otp.init.method, "POST");
    assert.equal(otp.url.pathname, "/auth/v1/otp");
    assert.equal(
      otp.url.searchParams.get("redirect_to"),
      "http://127.0.0.1:5174/auth/callback",
    );
    assert.equal(otp.url.searchParams.size, 1);
    assert.equal(otp.body.email, CONFIG.expectedEmail);
    assert.equal(otp.body.create_user, true);
    assert.equal(otp.body.code_challenge_method, "s256");
    first.port.dispose();
    first.storage.clearMemory();
    assert.equal(second.storage.getItem(AUTH_STORAGE_KEY), null);
    const exchanged = await second.port.exchange("synthetic_callback_code");
    assert.equal(exchanged.error, null);
    assert.equal(exchanged.session?.access_token, TOKEN);
    assert.equal(second.requests.length, 1);
    const tokenRequest = second.requests[0];
    assert.equal(tokenRequest.url.search, "?grant_type=pkce");
    assert.equal(tokenRequest.body.auth_code, "synthetic_callback_code");
    assert.equal(
      createHash("sha256")
        .update(tokenRequest.body.code_verifier as string)
        .digest("base64url"),
      otp.body.code_challenge,
    );
    const repeated = await second.port.exchange("synthetic_callback_code");
    assert.ok(repeated.error);
    assert.equal(second.requests.length, 1);
    const durable = JSON.stringify([...first.persistent.values]);
    assert.equal(durable.includes(TOKEN), false);
    assert.equal(durable.includes(REFRESH), false);
    assert.match(
      second.storage.getItem(AUTH_STORAGE_KEY)!,
      /SYNTHETIC_SDK_ACCESS_TOKEN/,
    );
    for (const request of [...first.requests, ...second.requests]) {
      assert.equal(request.init.credentials, "omit");
      assert.equal(request.init.cache, "no-store");
      assert.equal(request.init.redirect, "error");
      assert.equal(request.init.referrerPolicy, "no-referrer");
      assert.equal(
        new Headers(request.init.headers).get("apikey"),
        CONFIG.publishableKey,
      );
    }
  } finally {
    first.port.dispose();
    second.port.dispose();
    first.storage.clearAll();
    second.storage.clearAll();
  }
});

test("explicit JWT user lookup and direct local logout never refresh even with expired SDK memory", async () => {
  const h = harness(undefined, { expired: true });
  try {
    await h.port.send(CONFIG.expectedEmail);
    const exchange = await h.port.exchange("synthetic_callback_code");
    assert.equal(exchange.error, null);
    const verified = await h.port.user("SYNTHETIC_EXPLICIT_JWT");
    assert.equal(verified.error, null);
    assert.equal(verified.user?.id, USER.id);
    const userRequest = h.requests.at(-1)!;
    assert.equal(userRequest.url.pathname, "/auth/v1/user");
    assert.equal(
      new Headers(userRequest.init.headers).get("authorization"),
      "Bearer SYNTHETIC_EXPLICIT_JWT",
    );
    const logout = await h.port.signOut(TOKEN);
    assert.equal(logout.error, null);
    const logoutRequest = h.requests.at(-1)!;
    assert.equal(logoutRequest.url.pathname, "/auth/v1/logout");
    assert.equal(logoutRequest.url.search, "?scope=local");
    assert.equal(logoutRequest.init.method, "POST");
    assert.equal(
      new Headers(logoutRequest.init.headers).get("authorization"),
      `Bearer ${TOKEN}`,
    );
    assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
    assert.equal(
      h.requests.some((request) =>
        request.url.search.includes("refresh_token"),
      ),
      false,
    );
    assert.deepEqual(
      h.requests.map((request) => request.url.pathname),
      ["/auth/v1/otp", "/auth/v1/token", "/auth/v1/user", "/auth/v1/logout"],
    );
    const repeated = await h.port.signOut();
    assert.ok(repeated.error);
    assert.equal(h.requests.length, 4);
  } finally {
    h.port.dispose();
    h.storage.clearAll();
  }
});

test("SDK adapter does not retry failed OTP and failed revocation still clears local session", async () => {
  const failed = harness(undefined, { failOtp: true });
  const h = harness(undefined, { logoutStatus: 500 });
  try {
    const result = await failed.port.send(CONFIG.expectedEmail);
    assert.ok(result.error);
    assert.equal(failed.requests.length, 1);
    assert.equal(
      String(result.error).includes("SYNTHETIC_PRIVATE_NETWORK_DETAIL"),
      false,
    );
    await h.port.send(CONFIG.expectedEmail);
    await h.port.exchange("synthetic_callback_code");
    const logout = await h.port.signOut(TOKEN);
    assert.ok(logout.error);
    assert.equal(h.storage.getItem(AUTH_STORAGE_KEY), null);
    assert.equal(h.requests.length, 3);
    assert.equal(h.requests.at(-1)!.url.search, "?scope=local");
  } finally {
    failed.port.dispose();
    h.port.dispose();
    failed.storage.clearAll();
    h.storage.clearAll();
  }
});

test("DocumentAuthClient closes its SDK BroadcastChannel before initialization and never broadcasts a token", async (t) => {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const channels: {
    closed: boolean;
    posts: unknown[];
    listeners: Map<string, unknown>;
  }[] = [];
  const logs: unknown[][] = [];
  const events = new Map<string, EventListener>();
  class FakeChannel {
    closed = false;
    posts: unknown[] = [];
    listeners = new Map<string, unknown>();
    constructor() {
      channels.push(this);
    }
    addEventListener(name: string, listener: unknown) {
      this.listeners.set(name, listener);
    }
    postMessage(value: unknown) {
      this.posts.push(value);
    }
    close() {
      this.closed = true;
      this.listeners.clear();
    }
  }
  for (const [key, value] of Object.entries({
    window: {
      location: { href: "http://127.0.0.1:5174/auth/login" },
      addEventListener: (name: string, listener: EventListener) =>
        events.set(name, listener),
      removeEventListener: (name: string) => events.delete(name),
    },
    document: { visibilityState: "visible" },
    BroadcastChannel: FakeChannel,
  })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  t.mock.method(console, "warn", (...args: unknown[]) => logs.push(args));
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  const h = harness();
  try {
    assert.equal(channels.length, 1);
    assert.equal(channels[0].closed, true);
    assert.equal(channels[0].listeners.size, 0);
    await h.port.send(CONFIG.expectedEmail);
    await h.port.exchange("synthetic_callback_code");
    await h.port.user(TOKEN);
    await h.port.signOut(TOKEN);
    assert.deepEqual(channels[0].posts, []);
    assert.equal(JSON.stringify(logs).includes(TOKEN), false);
    assert.equal(JSON.stringify(logs).includes(REFRESH), false);
    assert.equal(
      h.requests.some((request) =>
        request.url.search.includes("refresh_token"),
      ),
      false,
    );
  } finally {
    h.port.dispose();
    h.storage.clearAll();
    await Promise.resolve();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const earlyScript = /<script>\s*([\s\S]*?)<\/script>/u.exec(html)!;
function bootstrap(url: string) {
  let address = new URL(url);
  const historyCalls: unknown[][] = [];
  const window: { __fonsecaAuthReturn?: CallbackInput } = {};
  const context = {
    window,
    URLSearchParams,
    location: {
      get origin() {
        return address.origin;
      },
      get pathname() {
        return address.pathname;
      },
      get search() {
        return address.search;
      },
      get hash() {
        return address.hash;
      },
    },
    history: {
      replaceState: (state: unknown, title: string, path: string) => {
        historyCalls.push([state, title, path]);
        address = new URL(path, address);
      },
    },
    get localStorage() {
      throw new Error("Bootstrap cannot use storage");
    },
    get sessionStorage() {
      throw new Error("Bootstrap cannot use storage");
    },
    console: {
      log: () => {
        throw new Error("Bootstrap cannot log");
      },
      error: () => {
        throw new Error("Bootstrap cannot log");
      },
    },
  };
  runInNewContext(earlyScript[1], context, { timeout: 1000 });
  return { address, window, historyCalls };
}

test("early HTML bootstrap clears callback query/hash before module imports without history state or storage", () => {
  assert.ok(earlyScript);
  const moduleOffset = html.indexOf('<script type="module"');
  assert.ok(moduleOffset > earlyScript.index!);
  const referrerOffset = html.indexOf(
    '<meta name="referrer" content="no-referrer"',
  );
  assert.ok(referrerOffset >= 0 && referrerOffset < earlyScript.index!);
  for (const url of [
    "http://127.0.0.1:5174/auth/callback?code=SYNTHETIC_CODE&sb_flow_id=SYNTHETIC_FLOW",
    "http://127.0.0.1:5174/auth/callback?code=SYNTHETIC_CODE#access_token=SYNTHETIC_ACCESS",
    "http://127.0.0.1:5174/?access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH",
    "http://127.0.0.1:5174/#access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH",
    "http://127.0.0.1:5174/?code=SYNTHETIC_CODE&code=SYNTHETIC_OTHER",
  ]) {
    const result = bootstrap(url);
    assert.equal(result.address.href, "http://127.0.0.1:5174/auth/callback");
    assert.deepEqual(result.historyCalls, [[null, "", "/auth/callback"]]);
    const input = new URL(url);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.window.__fonsecaAuthReturn)),
      {
        origin: input.origin,
        pathname: input.pathname,
        search: input.search,
        hash: input.hash,
      },
    );
    assert.equal(
      JSON.stringify(result.historyCalls).includes("SYNTHETIC"),
      false,
    );
  }
});

test("bootstrap preserves original invalid callback context for rejection and leaves ordinary navigation alone", () => {
  for (const url of [
    "http://127.0.0.1:5174/other?code=SYNTHETIC_CODE",
    "http://127.0.0.1:5174/auth/callback?code=SYNTHETIC_CODE#refresh_token=SYNTHETIC_REFRESH",
    "http://127.0.0.1:5174/auth/callback?code=SYNTHETIC_CODE&code=SYNTHETIC_OTHER",
    "http://localhost:5174/auth/callback?code=SYNTHETIC_CODE",
  ]) {
    const result = bootstrap(url);
    assert.equal(result.address.pathname, "/auth/callback");
    assert.equal(result.address.search, "");
    assert.equal(result.address.hash, "");
    assert.equal(parseCallback(result.window.__fonsecaAuthReturn!).ok, false);
  }
  const ordinary = bootstrap("http://127.0.0.1:5174/?mode=demo#Agenda");
  assert.equal(
    ordinary.address.href,
    "http://127.0.0.1:5174/?mode=demo#Agenda",
  );
  assert.equal(ordinary.window.__fonsecaAuthReturn, undefined);
  assert.deepEqual(ordinary.historyCalls, []);
});
