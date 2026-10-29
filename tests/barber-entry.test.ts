import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolveDataMode } from "../src/environment.ts";

const entry = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(
  bootstrap,
  "index.html must retain the initial authentication bootstrap",
);

type Address = {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
};

// Execute the actual bootstrap and entry point with local module stubs only.
// All callback material is synthetic; no browser, SDK, credentials, network or
// real storage participates. These checks prove dispatch, not authorization.
async function dispatch(address: string) {
  const initial = new URL(address, "http://127.0.0.1:5186");
  const location: Address = {
    origin: initial.origin,
    pathname: initial.pathname,
    search: initial.search,
    hash: initial.hash,
  };
  const window: Record<string, unknown> = {};
  const dataset: Record<string, string> = {};
  const loaded: string[] = [];
  const started: string[] = [];
  const authArguments: (Address | undefined)[] = [];
  const historyCalls: { state: unknown; title: string; url: string }[] = [];
  const atLoad: {
    module: string;
    location: Address;
    dataMode: string | undefined;
    hasTemporaryAuth: boolean;
  }[] = [];
  const history = {
    replaceState(state: unknown, title: string, url: string) {
      historyCalls.push({ state, title, url });
      const next = new URL(url, initial.origin);
      Object.assign(location, {
        pathname: next.pathname,
        search: next.search,
        hash: next.hash,
      });
    },
  };
  runInNewContext(bootstrap!, { window, location, history, URLSearchParams });
  const afterBootstrap = {
    location: { ...location },
    hasTemporaryAuth: Object.hasOwn(window, "__fonsecaAuthReturn"),
  };
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
    load: async (module: string) => {
      loaded.push(module);
      atLoad.push({
        module,
        location: { ...location },
        dataMode: dataset.dataMode,
        hasTemporaryAuth: Object.hasOwn(window, "__fonsecaAuthReturn"),
      });
      return {
        startLanding: () => started.push("landing"),
        startBookingPage: () => started.push("booking"),
        startBarberPage: () => started.push("barber"),
        startRealApp: async () => started.push("real"),
        startAuthPage: async (authReturn?: Address) => {
          started.push("auth");
          // Copy into this VM realm so assertions compare values, not prototypes.
          authArguments.push(authReturn ? { ...authReturn } : undefined);
        },
      };
    },
  });
  return {
    loaded,
    started,
    location,
    window,
    dataset,
    atLoad,
    afterBootstrap,
    authArguments,
    historyCalls,
  };
}

const ADMIN_HASHES = ["#Dashboard", "#Financeiro", "#Clientes", "#Comissoes"];
const DEMO_QUERIES = [
  "?mode=demo",
  "?mode=demo&mode=demo",
  "?mode=real&mode=demo",
  "?mode=demo&mode=real",
];

function assertBarber(result: Awaited<ReturnType<typeof dispatch>>) {
  assert.deepEqual(result.loaded, ["./barber-page"]);
  assert.deepEqual(result.started, ["barber"]);
  assert.equal(result.dataset.dataMode, "real");
  assert.equal(result.atLoad[0].dataMode, "real");
  assert.deepEqual(result.authArguments, []);
  assert.deepEqual(result.historyCalls, []);
}

async function assertRedactedCallback(address: string) {
  const initial = new URL(address, "http://127.0.0.1:5186");
  const result = await dispatch(address);
  const redacted = {
    origin: initial.origin,
    pathname: "/auth/callback",
    search: "",
    hash: "",
  };
  assert.deepEqual(result.loaded, ["./auth/page"]);
  assert.deepEqual(result.started, ["auth"]);
  assert.equal(result.dataset.dataMode, "real");
  assert.deepEqual(result.afterBootstrap.location, redacted);
  assert.equal(result.afterBootstrap.hasTemporaryAuth, true);
  assert.deepEqual(result.atLoad, [
    {
      module: "./auth/page",
      location: redacted,
      dataMode: "real",
      hasTemporaryAuth: false,
    },
  ]);
  assert.deepEqual(result.location, redacted);
  assert.deepEqual(result.authArguments, [
    {
      origin: initial.origin,
      pathname: initial.pathname,
      search: initial.search,
      hash: initial.hash,
    },
  ]);
  assert.deepEqual(result.historyCalls, [
    {
      state: null,
      title: "",
      url: "/auth/callback",
    },
  ]);
  assert.equal(Object.hasOwn(result.window, "__fonsecaAuthReturn"), false);
  assert.equal(result.window.__fonsecaAuthReturn, undefined);
}

test("barber entry and its trailing slash dispatch only the barber page", async () => {
  for (const path of ["/barbeiro", "/barbeiro/"]) {
    assertBarber(await dispatch(path));
  }
});

test("unknown barber subpaths remain in the barber branch for isolated not-found handling", async () => {
  for (const path of [
    "/barbeiro/nao-existe",
    "/barbeiro/nao-existe/mais",
    "/barbeiro/auth/login",
    "/barbeiro/agendar",
    "/barbeiro//",
  ]) {
    const result = await dispatch(path);
    assertBarber(result);
    assert.equal(result.location.pathname, path);
  }
});

test("demo parameters and administrative hashes cannot select another barber entry branch", async () => {
  for (const path of ["/barbeiro", "/barbeiro/", "/barbeiro/nao-existe"]) {
    for (const query of ["", ...DEMO_QUERIES]) {
      for (const hash of ["", ...ADMIN_HASHES]) {
        const result = await dispatch(`${path}${query}${hash}`);
        assertBarber(result);
        assert.equal(result.location.pathname, path);
        assert.equal(result.location.search, query);
        assert.equal(result.location.hash, hash);
      }
    }
  }
});

test("auth login keeps precedence over mode selection and administrative hashes", async () => {
  for (const query of ["", ...DEMO_QUERIES]) {
    for (const hash of ["", ...ADMIN_HASHES]) {
      const result = await dispatch(`/auth/login${query}${hash}`);
      assert.deepEqual(result.loaded, ["./auth/page"]);
      assert.deepEqual(result.started, ["auth"]);
      assert.deepEqual(result.authArguments, [undefined]);
      assert.equal(result.dataset.dataMode, "real");
      assert.equal(result.atLoad[0].dataMode, "real");
      assert.equal(result.atLoad[0].hasTemporaryAuth, false);
    }
  }
});

test("auth callback path is redacted before dispatch even without callback parameters", async () => {
  for (const suffix of [
    "",
    "?mode=demo#Dashboard",
    "?mode=demo&mode=demo#Financeiro",
  ]) {
    await assertRedactedCallback(`/auth/callback${suffix}`);
  }
});

test("query callback materials override every barber path and are removed before imports", async () => {
  for (const path of ["/barbeiro", "/barbeiro/", "/barbeiro/nao-existe"]) {
    for (const key of ["code", "sb_flow_id", "access_token", "refresh_token"]) {
      await assertRedactedCallback(
        `${path}?mode=demo&${key}=synthetic-callback-material&mode=demo#Financeiro`,
      );
    }
  }
});

test("hash callback materials override barber paths and are removed before imports", async () => {
  for (const path of ["/barbeiro", "/barbeiro/", "/barbeiro/nao-existe"]) {
    for (const key of ["access_token", "refresh_token", "code"]) {
      for (const prefix of ["#", "#Dashboard&"]) {
        await assertRedactedCallback(
          `${path}?mode=demo${prefix}${key}=synthetic-callback-material`,
        );
      }
    }
  }
});

test("existing root and ordinary administrative hashes retain their mode rules", async () => {
  for (const hash of ["", "#Agenda", ...ADMIN_HASHES]) {
    for (const query of ["", "?mode=real", ...DEMO_QUERIES.slice(1)]) {
      const result = await dispatch(`/${query}${hash}`);
      assert.deepEqual(result.loaded, ["./real-app"]);
      assert.deepEqual(result.started, ["real"]);
      assert.equal(result.dataset.dataMode, "real");
    }
    const demo = await dispatch(`/?mode=demo${hash}`);
    assert.deepEqual(demo.loaded, ["./demo-app"]);
    assert.deepEqual(demo.started, []);
    assert.equal(demo.dataset.dataMode, "demo");
  }
});

test("landing stays isolated for its normal URLs and demo parameters", async () => {
  for (const path of ["/inicio", "/inicio/"]) {
    for (const suffix of [
      "",
      "#clube",
      "?mode=demo#clube",
      "?mode=demo&mode=demo#Dashboard",
    ]) {
      const result = await dispatch(`${path}${suffix}`);
      assert.deepEqual(result.loaded, ["./landing"]);
      assert.deepEqual(result.started, ["landing"]);
      assert.deepEqual(result.authArguments, []);
    }
  }
});

test("booking stays isolated and real with demo parameters and administrative hashes", async () => {
  for (const path of ["/agendar", "/agendar/"]) {
    for (const query of ["", ...DEMO_QUERIES]) {
      for (const hash of ["", ...ADMIN_HASHES]) {
        const result = await dispatch(`${path}${query}${hash}`);
        assert.deepEqual(result.loaded, ["./booking-page"]);
        assert.deepEqual(result.started, ["booking"]);
        assert.equal(result.dataset.dataMode, "real");
        assert.equal(result.atLoad[0].dataMode, "real");
      }
    }
  }
});

test("callback priority and early redaction remain intact for root, landing and booking", async () => {
  for (const path of ["/", "/inicio", "/inicio/", "/agendar", "/agendar/"]) {
    for (const suffix of [
      "?mode=demo&code=synthetic-code#Dashboard",
      "?mode=demo&mode=demo#access_token=synthetic-token",
    ]) {
      await assertRedactedCallback(`${path}${suffix}`);
    }
  }
});

test("similarly named sibling paths are not captured as barber subpaths", async () => {
  for (const path of ["/barbeiro-extra", "/barbeiros", "/inicio-extra"]) {
    const result = await dispatch(path);
    assert.deepEqual(result.loaded, ["./real-app"]);
    assert.deepEqual(result.started, ["real"]);
  }
});
