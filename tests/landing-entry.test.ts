import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolveDataMode } from "../src/environment.ts";

const entry = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(bootstrap);

// Run the actual entry controller with local module stubs. No browser, SDK,
// credentials, network or real storage participates in these routing checks.
async function dispatch(address: string) {
  const initial = new URL(address, "http://127.0.0.1:5186");
  const location = {
    origin: initial.origin,
    pathname: initial.pathname,
    search: initial.search,
    hash: initial.hash,
  };
  const window: Record<string, unknown> = {};
  const dataset: Record<string, string> = {};
  const loaded: string[] = [];
  const started: string[] = [];
  const history = {
    replaceState(_state: unknown, _title: string, url: string) {
      const next = new URL(url, initial.origin);
      Object.assign(location, {
        pathname: next.pathname,
        search: next.search,
        hash: next.hash,
      });
    },
  };
  runInNewContext(bootstrap!, { window, location, history, URLSearchParams });
  const executable = entry
    .replace(
      /^import\s+\{ resolveDataMode \}\s+from\s+"\.\/environment";\s*/u,
      "",
    )
    .replace(/\bimport\(/gu, "load(");
  await runInNewContext(`(async () => { ${executable} })()`, {
    window,
    location,
    document: { documentElement: { dataset } },
    resolveDataMode,
    URLSearchParams,
    load: async (module: string) => {
      loaded.push(module);
      return {
        startLanding: () => started.push("landing"),
        startBookingPage: () => started.push("booking"),
        startRealApp: async () => started.push("real"),
        startAuthPage: async () => started.push("auth"),
      };
    },
  });
  return { loaded, started, location, window, dataset };
}

test("landing has an explicit isolated route, including its trailing slash", async () => {
  for (const path of [
    "/inicio",
    "/inicio/",
    "/inicio#clube",
    "/inicio?mode=demo",
  ]) {
    const result = await dispatch(path);
    assert.deepEqual(result.loaded, ["./landing"]);
    assert.deepEqual(result.started, ["landing"]);
  }
});

test("public root and home anchors open the presentation across refresh", async () => {
  for (const path of [
    "/",
    "/#inicio",
    "/#clube",
    "/#conteudo",
    "/#experiencia",
    "/#planos",
    "/#encontre",
    "/#equipe",
    "/?utm_source=synthetic#equipe",
  ]) {
    const result = await dispatch(path);
    assert.deepEqual(result.loaded, ["./landing"]);
    assert.deepEqual(result.started, ["landing"]);
    assert.equal(result.dataset.dataMode, "real");
  }
});

test("legacy administrative hashes and explicit mode selection keep their behavior", async () => {
  for (const path of [
    "/?mode=real",
    "/?mode=",
    "/?mode=unknown",
    "/#Agenda",
    "/#/Agenda",
    "/#Configura%C3%A7%C3%B5es",
    "/#Servi%C3%A7os%20%2F%20Produtos",
    "/?mode=real#Agenda",
    "/?mode=demo&mode=demo#Agenda",
    "/inicio-extra",
  ]) {
    assert.deepEqual((await dispatch(path)).loaded, ["./real-app"]);
  }
  assert.deepEqual((await dispatch("/?mode=demo#Agenda")).loaded, [
    "./demo-app",
  ]);
  assert.deepEqual((await dispatch("/?mode=demo")).loaded, ["./demo-app"]);
});

test("auth routes keep precedence over demo selection", async () => {
  for (const path of ["/auth/login?mode=demo", "/auth/callback?mode=demo"]) {
    const result = await dispatch(path);
    assert.deepEqual(result.loaded, ["./auth/page"]);
    assert.equal(result.dataset.dataMode, "real");
  }
});

test("auth material on the landing is captured and redacted before dispatch", async () => {
  for (const suffix of [
    "?code=synthetic-code",
    "?sb_flow_id=synthetic-flow",
    "#access_token=synthetic-token",
    "?refresh_token=synthetic-token",
  ]) {
    const result = await dispatch(`/inicio${suffix}`);
    assert.deepEqual(result.loaded, ["./auth/page"]);
    assert.equal(result.location.pathname, "/auth/callback");
    assert.equal(result.location.search, "");
    assert.equal(result.location.hash, "");
    assert.equal(result.window.__fonsecaAuthReturn, undefined);
  }
});

test("booking route is isolated and always real even with demo parameters", async () => {
  for (const path of ["/agendar", "/agendar/", "/agendar?mode=demo"]) {
    const result = await dispatch(path);
    assert.deepEqual(result.loaded, ["./booking-page"]);
    assert.deepEqual(result.started, ["booking"]);
    assert.equal(result.dataset.dataMode, "real");
  }
});
test("auth callback material takes precedence over booking and is redacted", async () => {
  for (const suffix of [
    "?code=synthetic-code&mode=demo",
    "#access_token=synthetic-token",
  ]) {
    const result = await dispatch(`/agendar${suffix}`);
    assert.deepEqual(result.loaded, ["./auth/page"]);
    assert.equal(result.location.pathname, "/auth/callback");
    assert.equal(result.location.search, "");
    assert.equal(result.location.hash, "");
  }
});
