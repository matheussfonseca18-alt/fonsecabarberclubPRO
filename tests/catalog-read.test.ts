import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_COLUMNS,
  createCatalogReader,
  type CatalogKind,
  type CatalogReadConfig,
  type CatalogSession,
} from "../src/data/catalog-read.ts";

const NOW = Date.UTC(2026, 9, 28, 12);
const USER_ID = "10000000-0000-4000-8000-000000000001";
const VERIFIED_USER = {
  id: USER_ID,
  is_anonymous: false,
  email_confirmed_at: new Date(NOW - 60_000).toISOString(),
};
const SESSION: CatalogSession = {
  userId: USER_ID,
  accessToken: "synthetic.access.token",
  expiresAt: NOW + 60_000,
};
const CONFIG: Extract<CatalogReadConfig, { enabled: true }> = {
  enabled: true,
  approved: true,
  baseUrl: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_only",
  expectedUserId: USER_ID,
  tenantId: "20000000-0000-4000-8000-000000000001",
  scopeId: "30000000-0000-4000-8000-000000000001",
  batchId: "40000000-0000-4000-8000-000000000001",
  expiresAt: new Date(NOW + 3_600_000).toISOString(),
  schema: "fonseca_catalog_api",
  views: {
    professionals: "professionals",
    services: "services",
    products: "products",
  },
};
const entityId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const professional = (index = 1) => ({
  entity_id: entityId(index),
  version: 1,
  full_name: "Profissional Sintético",
  display_name: null,
  active: null,
});
const service = () => ({
  entity_id: entityId(1),
  version: 1,
  name: "Serviço Sintético",
  category: null,
  price_cents: 0,
  currency: "BRL",
  standalone_duration_minutes: 0,
  active: false,
});
const product = () => ({
  entity_id: entityId(1),
  version: 1,
  name: "Produto Sintético",
  brand: null,
  category: null,
  sale_price_cents: 0,
  currency: "BRL",
  unit: null,
  active: true,
});
function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
function page(
  rows: unknown[],
  total = rows.length,
  offset = 0,
  status = 200,
): Response {
  return json(rows, status, {
    "content-range":
      rows.length === 0
        ? `*/${total}`
        : `${offset}-${offset + rows.length - 1}/${total}`,
  });
}
type Call = { url: URL; init: RequestInit };
function harness(
  options: {
    config?: CatalogReadConfig;
    session?: CatalogSession | null;
    auth?: () => Response | Promise<Response>;
    rest?: (call: Call, index: number) => Response | Promise<Response>;
  } = {},
) {
  let current =
    options.session === undefined ? { ...SESSION } : options.session;
  let clock = NOW;
  let sessionReads = 0;
  let restReads = 0;
  const calls: Call[] = [];
  const reader = createCatalogReader(options.config ?? CONFIG, {
    now: () => clock,
    getSession: async () => {
      sessionReads++;
      return current;
    },
    fetch: async (input, init = {}) => {
      const call = { url: new URL(String(input)), init };
      calls.push(call);
      if (call.url.pathname === "/auth/v1/user")
        return options.auth?.() ?? json(VERIFIED_USER);
      const index = restReads++;
      return options.rest?.(call, index) ?? page([professional()]);
    },
  });
  return {
    reader,
    calls,
    get sessionReads() {
      return sessionReads;
    },
    setSession(value: CatalogSession | null) {
      current = value;
    },
    setTime(value: number) {
      clock = value;
    },
  };
}

test("inactive and unapproved transport configuration cannot access session or network", async () => {
  const cases: CatalogReadConfig[] = [
    { enabled: false },
    { ...CONFIG, approved: false } as unknown as CatalogReadConfig,
    { ...CONFIG, expiresAt: new Date(NOW).toISOString() },
    { ...CONFIG, publishableKey: "sb_secret_synthetic_forbidden" },
    { ...CONFIG, publishableKey: "eyJsyntheticLegacyKey" },
    { ...CONFIG, schema: "public" } as unknown as CatalogReadConfig,
    { ...CONFIG, tenantId: "not-a-uuid" },
    {
      ...CONFIG,
      views: { ...CONFIG.views, products: "other_table" },
    } as unknown as CatalogReadConfig,
    ...[
      "http://aaaaaaaaaaaaaaaaaaaa.supabase.co",
      "https://aaaaaaaaaaaaaaaaaaaa.supabase.co.attacker.test",
      "https://user@aaaaaaaaaaaaaaaaaaaa.supabase.co",
      "https://aaaaaaaaaaaaaaaaaaaa.supabase.co:443",
      "https://aaaaaaaaaaaaaaaaaaaa.supabase.co/path",
      "https://aaaaaaaaaaaaaaaaaaaa.supabase.co?target=other",
    ].map((baseUrl) => ({ ...CONFIG, baseUrl })),
  ];
  for (const config of cases) {
    const h = harness({ config });
    assert.equal((await h.reader.list("professionals")).state, "inactive");
    assert.equal(h.sessionReads, 0);
    assert.equal(h.calls.length, 0);
  }
});

test("absent, expired or mismatched sessions fail before any transport", async () => {
  for (const session of [null, { ...SESSION, expiresAt: NOW }]) {
    const h = harness({ session });
    assert.equal((await h.reader.list("professionals")).state, "signed-out");
    assert.equal(h.calls.length, 0);
  }
  const h = harness({ session: { ...SESSION, userId: CONFIG.tenantId } });
  assert.equal((await h.reader.list("professionals")).state, "forbidden");
  assert.equal(h.calls.length, 0);
});

test("configuration and session accessors cannot change validated credentials or origin", async () => {
  for (const key of [
    "enabled",
    "baseUrl",
    "publishableKey",
    "expectedUserId",
    "expiresAt",
  ] as const) {
    let reads = 0;
    const config = { ...CONFIG };
    Object.defineProperty(config, key, {
      enumerable: true,
      get() {
        reads++;
        return reads < 3 ? CONFIG[key] : "https://attacker.test";
      },
    });
    const h = harness({ config });
    assert.equal((await h.reader.list("professionals")).state, "inactive");
    assert.equal(reads, 0);
    assert.equal(h.sessionReads, 0);
    assert.equal(h.calls.length, 0);
  }
  let sessionReads = 0;
  const session = { ...SESSION };
  Object.defineProperty(session, "accessToken", {
    enumerable: true,
    get() {
      sessionReads++;
      return SESSION.accessToken;
    },
  });
  const h = harness({ session });
  assert.equal((await h.reader.list("professionals")).state, "signed-out");
  assert.equal(sessionReads, 0);
  assert.equal(h.calls.length, 0);

  const config = { ...CONFIG };
  const changing = harness({
    config,
    auth: () => {
      config.baseUrl = "https://attacker.test";
      return json(VERIFIED_USER);
    },
  });
  assert.equal((await changing.reader.list("professionals")).state, "ready");
  assert.ok(changing.calls.every((call) => call.url.origin === CONFIG.baseUrl));
});

test("server user validation rejects anonymous, missing anonymous status and wrong identity before catalog", async () => {
  for (const user of [
    { ...VERIFIED_USER, is_anonymous: true },
    { id: USER_ID, email_confirmed_at: VERIFIED_USER.email_confirmed_at },
    { ...VERIFIED_USER, is_anonymous: null },
    { ...VERIFIED_USER, id: CONFIG.tenantId },
    null,
    [],
  ]) {
    const h = harness({ auth: () => json(user) });
    assert.equal((await h.reader.list("professionals")).state, "forbidden");
    assert.equal(h.calls.length, 1);
  }
});

test("email confirmation must be an explicit valid nonfuture server timestamp", async () => {
  for (const email_confirmed_at of [
    undefined,
    null,
    "invalid",
    "2026-02-30T12:00:00Z",
    "2026-10-28",
    new Date(NOW + 1).toISOString(),
    0,
  ]) {
    const h = harness({
      auth: () => json({ ...VERIFIED_USER, email_confirmed_at }),
    });
    assert.equal((await h.reader.list("professionals")).state, "forbidden");
    assert.equal(h.calls.length, 1);
  }
});

test("only GET to fixed origins/views is allowed with explicit projection and no scope authorization filters", async () => {
  for (const kind of ["professionals", "services", "products"] as const) {
    const row =
      kind === "professionals"
        ? professional()
        : kind === "services"
          ? service()
          : product();
    const h = harness({ rest: () => page([row]) });
    const result = await h.reader.list(kind);
    assert.equal(result.state, "ready");
    assert.equal(h.calls.length, 2);
    for (const call of h.calls) {
      assert.equal(call.url.origin, CONFIG.baseUrl);
      assert.equal(call.init.method, "GET");
      assert.equal(call.init.credentials, "omit");
      assert.equal(call.init.cache, "no-store");
      assert.equal(call.init.redirect, "error");
      assert.equal(call.init.body, undefined);
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get("apikey"), CONFIG.publishableKey);
      assert.equal(
        headers.get("authorization"),
        `Bearer ${SESSION.accessToken}`,
      );
    }
    const read = h.calls[1];
    assert.equal(read.url.pathname, `/rest/v1/${kind}`);
    assert.deepEqual(
      [...read.url.searchParams.keys()],
      ["select", "version", "order", "limit", "offset"],
    );
    assert.equal(
      read.url.searchParams.get("select"),
      CATALOG_COLUMNS[kind].join(","),
    );
    assert.equal(read.url.searchParams.get("version"), "eq.1");
    assert.equal(
      read.url.searchParams.get("order"),
      "entity_id.asc,version.asc",
    );
    assert.equal(
      new Headers(read.init.headers).get("accept-profile"),
      "fonseca_catalog_api",
    );
    assert.equal(new Headers(read.init.headers).get("prefer"), "count=exact");
    assert.deepEqual(Object.keys(h.reader), ["list"]);
  }
});

test("nullable fields remain null and genuine numeric zero is preserved", async () => {
  for (const [kind, row] of [
    ["services", service()],
    ["products", product()],
  ] as const) {
    const h = harness({ rest: () => page([row]) });
    const result = await h.reader.list(kind);
    assert.equal(result.state, "ready");
    if (result.state !== "ready") assert.fail("expected ready");
    assert.deepEqual(result.rows, [row]);
    assert.equal(result.total, 1);
    assert.ok(Object.isFrozen(result.rows));
    assert.ok(Object.isFrozen(result.rows[0]));
  }
});

test("malformed, extra, private, mismatched context and wrong-version rows never become ready", async () => {
  const rows = [
    { ...professional(), version: 2 },
    { ...professional(), entity_id: "not-a-uuid" },
    { ...professional(), full_name: " " },
    { ...professional(), active: "true" },
    { ...professional(), display_name: undefined },
    { ...professional(), scope_id: CONFIG.scopeId },
    { ...professional(), batch_id: CONFIG.batchId },
    { ...professional(), tenant_id: CONFIG.tenantId },
    { ...professional(), contacts: [] },
    { ...professional(), commission: 40 },
    { ...professional(), raw: {} },
  ];
  for (const row of rows) {
    const h = harness({ rest: () => page([row]) });
    assert.equal((await h.reader.list("professionals")).state, "error");
  }
  for (const row of [
    { ...service(), price_cents: null },
    { ...service(), price_cents: -1 },
    { ...service(), price_cents: Number.MAX_SAFE_INTEGER + 1 },
    { ...service(), standalone_duration_minutes: 1.5 },
    { ...service(), currency: "USD" },
  ]) {
    const h = harness({ rest: () => page([row]) });
    assert.equal((await h.reader.list("services")).state, "error");
  }
  const h = harness({ rest: () => page([{ ...product(), stockQuantity: 0 }]) });
  assert.equal((await h.reader.list("products")).state, "error");
});

test("HTTP failures and invalid JSON are sanitized without retry or remote payload disclosure", async () => {
  for (const [status, expected] of [
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "error"],
    [500, "error"],
  ] as const) {
    for (const stage of ["auth", "rest"] as const) {
      const bad = () =>
        json({ message: `DO_NOT_ECHO ${SESSION.accessToken}` }, status);
      const h = harness({ [stage]: bad });
      const result = await h.reader.list("professionals");
      assert.equal(result.state, expected);
      assert.equal(h.calls.length, stage === "auth" ? 1 : 2);
      assert.ok(!JSON.stringify(result).includes("DO_NOT_ECHO"));
      assert.ok(!JSON.stringify(result).includes(SESSION.accessToken));
    }
  }
  const h = harness({
    rest: () =>
      new Response("invalid json SECRET_SENTINEL", {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await h.reader.list("professionals");
  assert.equal(result.state, "error");
  assert.ok(!JSON.stringify(result).includes("SECRET_SENTINEL"));
});

test("redirects and attacker response URLs are rejected without following location", async () => {
  for (const property of ["redirected", "url"] as const) {
    const h = harness({
      rest: () => {
        const response = page([professional()]);
        Object.defineProperty(response, property, {
          value:
            property === "redirected" ? true : "https://attacker.test/records",
        });
        return response;
      },
    });
    assert.equal((await h.reader.list("professionals")).state, "error");
    assert.equal(h.calls.length, 2);
  }
  const h = harness({
    rest: () => json({}, 302, { location: "https://attacker.test" }),
  });
  assert.equal((await h.reader.list("professionals")).state, "error");
  assert.equal(h.calls.length, 2);
});

test("pagination validates exact counts, contiguous ranges and deterministic complete rows", async () => {
  const rows = Array.from({ length: 251 }, (_, index) =>
    professional(index + 1),
  );
  const h = harness({
    rest: (call) => {
      const offset = Number(call.url.searchParams.get("offset"));
      return page(rows.slice(offset, offset + 250), rows.length, offset, 206);
    },
  });
  const result = await h.reader.list("professionals");
  assert.equal(result.state, "ready");
  if (result.state !== "ready") assert.fail("expected complete results");
  assert.equal(result.total, 251);
  assert.equal(result.rows.length, 251);
  assert.deepEqual(
    h.calls.slice(1).map((call) => call.url.searchParams.get("offset")),
    ["0", "250"],
  );
});

test("zero rows do not confirm access because RLS can hide unauthorized rows", async () => {
  const h = harness({ rest: () => page([]) });
  const result = await h.reader.list("professionals");
  assert.equal(result.state, "error");
  assert.equal(Object.hasOwn(result, "rows"), false);
  assert.equal(Object.hasOwn(result, "total"), false);
});

test("missing counts, overflow, duplicates, changing totals and final-page failure never leak partial rows", async () => {
  const firstRows = Array.from({ length: 250 }, (_, index) =>
    professional(index + 1),
  );
  const cases = [
    () => json([professional()]),
    () => json([professional()], 200, { "content-range": "0-0/*" }),
    () => json([professional()], 200, { "content-range": "1-1/2" }),
    () => page([professional()], 1001),
    () => page([professional(2), professional(1)]),
    () => page([professional(1), professional(1)]),
    (_call: Call, index: number) =>
      index === 0 ? page(firstRows, 251) : page([professional(250)], 251, 250),
    (_call: Call, index: number) =>
      index === 0 ? page(firstRows, 251) : page([professional(251)], 252, 250),
    (_call: Call, index: number) =>
      index === 0 ? page(firstRows, 251) : json({ message: "no partial" }, 500),
    (_call: Call, index: number) =>
      index === 0 ? page(firstRows, 251) : page([], 251, 250),
  ];
  for (const rest of cases) {
    const h = harness({ rest });
    const result = await h.reader.list("professionals");
    assert.equal(result.state, "error");
    assert.equal(Object.hasOwn(result, "rows"), false);
  }
});

test("logout, token changes and expiry during reads discard every accumulated result", async () => {
  for (const change of ["logout", "token", "expiry"] as const) {
    const h = harness({
      rest: () => {
        if (change === "logout") h.setSession(null);
        if (change === "token")
          h.setSession({
            ...SESSION,
            accessToken: "replacement.synthetic.token",
          });
        if (change === "expiry") h.setTime(SESSION.expiresAt);
        return page([professional()]);
      },
    });
    const result = await h.reader.list("professionals");
    assert.equal(result.state, "signed-out");
    assert.equal(Object.hasOwn(result, "rows"), false);
  }
  const h = harness({
    rest: () => {
      const response = page([professional()]);
      const read = response.json.bind(response);
      response.json = async () => {
        const body = await read();
        h.setSession(null);
        return body;
      };
      return response;
    },
  });
  assert.equal((await h.reader.list("professionals")).state, "signed-out");
});

test("aborted and superseded requests cannot publish old results", async () => {
  const controller = new AbortController();
  controller.abort();
  const h = harness();
  assert.equal(
    (await h.reader.list("professionals", { signal: controller.signal })).state,
    "error",
  );
  assert.equal(h.calls.length, 0);
  let release!: (response: Response) => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const concurrent = harness({
    rest: (_call, index) => {
      if (index === 0) {
        started();
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return page([professional()]);
    },
  });
  const older = concurrent.reader.list("professionals");
  await pending;
  assert.equal((await concurrent.reader.list("professionals")).state, "ready");
  release(page([professional()]));
  assert.equal((await older).state, "error");
});

test("unknown kinds and thrown transport errors remain closed and sanitized", async () => {
  const h = harness({
    rest: () => {
      throw new Error(`PRIVATE ${SESSION.accessToken}`);
    },
  });
  assert.equal((await h.reader.list("unknown" as CatalogKind)).state, "error");
  assert.equal(h.calls.length, 0);
  const result = await h.reader.list("professionals");
  assert.equal(result.state, "error");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(h.calls.length, 2);
});
