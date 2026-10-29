import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthTransport } from "../src/auth/transport.ts";

const BASE = "https://aaaaaaaaaaaaaaaaaaaa.supabase.co";
const CALLBACK = "http://127.0.0.1:5174/auth/callback";
const OTP = `${BASE}/auth/v1/otp?redirect_to=${encodeURIComponent(CALLBACK)}`;

test("only approved Auth routes are reachable with restrictive fetch options", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const transport = createAuthTransport(BASE, async (input, init) => {
    requests.push({ input, init });
    return new Response("{}", { status: 200 });
  });
  for (const [url, method] of [
    [OTP, "POST"],
    [`${BASE}/auth/v1/token?grant_type=pkce`, "POST"],
    [`${BASE}/auth/v1/user`, "GET"],
    [`${BASE}/auth/v1/logout?scope=local`, "POST"],
  ]) {
    await transport.fetch(url, {
      method,
      credentials: "include",
      cache: "force-cache",
      redirect: "follow",
      referrerPolicy: "unsafe-url",
    });
  }
  assert.equal(requests.length, 4);
  for (const { init } of requests) {
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.referrerPolicy, "no-referrer");
    assert.ok(init?.signal instanceof AbortSignal);
  }
});

test("refresh, admin, writes, other origins, redirects and duplicate parameters are denied before fetch", async () => {
  let calls = 0;
  const transport = createAuthTransport(BASE, async () => {
    calls++;
    return new Response("{}");
  });
  const rejected = [
    [`${BASE}/auth/v1/token?grant_type=refresh_token`, "POST"],
    [`${BASE}/auth/v1/admin/users`, "POST"],
    [`${BASE}/rest/v1/products`, "POST"],
    [`${BASE}/auth/v1/user`, "PUT"],
    [`${BASE}/auth/v1/logout?scope=global`, "POST"],
    [`${BASE}/auth/v1/otp?redirect_to=https://example.invalid`, "POST"],
    [`${OTP}&redirect_to=https://example.invalid`, "POST"],
    [`${BASE}/auth/v1/token?grant_type=pkce&extra=1`, "POST"],
    [`${BASE}/auth/v1/user?extra=1`, "GET"],
    [`${BASE}/auth/v1/user#access_token=synthetic`, "GET"],
    ["https://bbbbbbbbbbbbbbbbbbbb.supabase.co/auth/v1/user", "GET"],
    [
      "https://synthetic:synthetic@aaaaaaaaaaaaaaaaaaaa.supabase.co/auth/v1/user",
      "GET",
    ],
  ];
  for (const [url, method] of rejected)
    await assert.rejects(transport.fetch(url, { method }), /unavailable/);
  assert.equal(calls, 0);
});

test("Request input cannot smuggle a forbidden method past route checks", async () => {
  let calls = 0;
  const transport = createAuthTransport(BASE, async () => {
    calls++;
    return new Response("{}");
  });
  await assert.rejects(
    transport.fetch(
      new Request(`${BASE}/auth/v1/user`, {
        method: "POST",
        body: "synthetic",
      }),
    ),
    /unavailable/,
  );
  assert.equal(calls, 0);
});

test("abort and timeout are sanitized and do not retry", async () => {
  let calls = 0;
  const fake: typeof fetch = async (_input, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      const fail = () => reject(new Error("synthetic-private-network-details"));
      if (init?.signal?.aborted) fail();
      else init?.signal?.addEventListener("abort", fail, { once: true });
    });
  };
  const transport = createAuthTransport(BASE, fake, 10);
  await assert.rejects(
    transport.fetch(`${BASE}/auth/v1/user`),
    (error: Error) => error.message === "Auth request unavailable",
  );
  assert.equal(calls, 1);
  const running = transport.fetch(`${BASE}/auth/v1/user`);
  transport.abort();
  await assert.rejects(
    running,
    (error: Error) => error.message === "Auth request unavailable",
  );
  assert.equal(calls, 2);
});

test("caller cancellation is forwarded without exposing its error", async () => {
  const controller = new AbortController();
  let signal: AbortSignal | null | undefined;
  const transport = createAuthTransport(BASE, async (_input, init) => {
    signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) reject(new Error("private reason"));
      else
        signal?.addEventListener(
          "abort",
          () => reject(new Error("private reason")),
          { once: true },
        );
    });
  });
  const running = transport.fetch(`${BASE}/auth/v1/user`, {
    signal: controller.signal,
  });
  controller.abort("synthetic-sensitive-reason");
  await assert.rejects(running, /Auth request unavailable/);
  assert.equal(signal?.aborted, true);
});

test("a rejected fetch surfaces no raw exception and no automatic retry", async () => {
  let calls = 0;
  const transport = createAuthTransport(BASE, async () => {
    calls++;
    throw new Error("synthetic-sensitive-response");
  });
  await assert.rejects(
    transport.fetch(OTP, { method: "POST" }),
    (error: Error) => error.message === "Auth request unavailable",
  );
  assert.equal(calls, 1);
});

test("deadline remains active while a response body is stalled after headers", async () => {
  let calls = 0;
  const transport = createAuthTransport(
    BASE,
    async (_input, init) => {
      calls++;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const fail = () =>
              controller.error(new Error("synthetic-private-body-error"));
            if (init?.signal?.aborted) fail();
            else init?.signal?.addEventListener("abort", fail, { once: true });
          },
        }),
        { status: 200 },
      );
    },
    10,
  );
  await assert.rejects(
    transport.fetch(`${BASE}/auth/v1/user`),
    (error: Error) => error.message === "Auth request unavailable",
  );
  assert.equal(calls, 1);
});

test("response bodies larger than 512 KiB are rejected before reaching the SDK", async () => {
  const transport = createAuthTransport(
    BASE,
    async () => new Response("x".repeat(512 * 1024 + 1), { status: 200 }),
  );
  await assert.rejects(
    transport.fetch(`${BASE}/auth/v1/user`),
    /Auth request unavailable/,
  );
});
