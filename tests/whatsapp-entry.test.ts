import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveDataMode } from "../src/environment.ts";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const bootstrap = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
).match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(bootstrap);
async function dispatch(address: string) {
  const parsed = new URL(address, "http://127.0.0.1:5174");
  const location = {
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  };
  const window = {};
  const dataset: Record<string, string> = {};
  const loaded: string[] = [];
  const started: string[] = [];
  const history = {
    replaceState(_state: unknown, _title: string, url: string) {
      const next = new URL(url, location.origin);
      Object.assign(location, {
        pathname: next.pathname,
        search: next.search,
        hash: next.hash,
      });
    },
  };
  runInNewContext(bootstrap!, { window, location, history, URLSearchParams });
  const executable = source
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
        startWhatsappPage: () => started.push("whatsapp"),
        startLanding: () => started.push("home"),
        startBookingPage: () => started.push("booking"),
        startBarberPage: () => started.push("barber"),
        startRealApp: async () => started.push("real"),
        startAuthPage: async () => started.push("auth"),
      };
    },
  });
  return { loaded, started, dataset, location };
}
test("WhatsApp direct, trailing and unknown nested routes stay in the real isolated branch", async () => {
  for (const path of ["/whatsapp", "/whatsapp/", "/whatsapp/nao-existe"]) {
    for (const query of [
      "",
      "?mode=demo",
      "?mode=demo&mode=real",
      "?mode=real&mode=demo",
    ]) {
      const result = await dispatch(`${path}${query}#Financeiro`);
      assert.deepEqual(result.loaded, ["./whatsapp-page"]);
      assert.deepEqual(result.started, ["whatsapp"]);
      assert.equal(result.dataset.dataMode, "real");
    }
  }
});
test("Auth capture still wins over WhatsApp and redacts the synthetic return", async () => {
  for (const address of [
    "/whatsapp?code=synthetic-code&mode=demo",
    "/whatsapp/#access_token=synthetic-token&type=signup",
  ]) {
    const result = await dispatch(address);
    assert.deepEqual(result.loaded, ["./auth/page"]);
    assert.deepEqual(result.started, ["auth"]);
    assert.equal(result.location.pathname, "/auth/callback");
    assert.equal(result.location.search, "");
    assert.equal(result.location.hash, "");
  }
});
test("home, booking, barber and administrative entry behavior is preserved", async () => {
  for (const [address, module] of [
    ["/", "./landing"],
    ["/inicio", "./landing"],
    ["/agendar", "./booking-page"],
    ["/barbeiro", "./barber-page"],
    ["/?mode=real#Agenda", "./real-app"],
    ["/?mode=demo#Agenda", "./demo-app"],
    ["/whatsapps", "./real-app"],
  ]) {
    assert.deepEqual((await dispatch(address)).loaded, [module]);
  }
});

function lifecycle(path = "/whatsapp") {
  const pageSource = readFileSync(
    new URL("../src/whatsapp-page.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts
    .transpileModule(pageSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/^import .*;\s*$/gmu, "")
    .replace(/^export /gmu, "");
  const listeners = new Map<
    string,
    Set<(event: { persisted?: boolean }) => void>
  >();
  const classes = new Set<string>();
  const view = {
    addEventListener(
      name: string,
      listener: (event: { persisted?: boolean }) => void,
    ) {
      const set = listeners.get(name) ?? new Set();
      set.add(listener);
      listeners.set(name, set);
    },
    removeEventListener(
      name: string,
      listener: (event: { persisted?: boolean }) => void,
    ) {
      listeners.get(name)?.delete(listener);
    },
  };
  const skipLink = { addEventListener() {}, removeEventListener() {} };
  const container = {};
  const root = {
    innerHTML: "",
    ownerDocument: {
      defaultView: view,
      title: "",
      body: {
        classList: {
          add(name: string) {
            classes.add(name);
          },
          remove(name: string) {
            classes.delete(name);
          },
        },
      },
    },
    querySelector(selector: string) {
      return selector === "[data-whatsapp-panel]"
        ? container
        : selector === ".wp-host-skip"
          ? skipLink
          : null;
    },
    replaceChildren() {
      root.innerHTML = "";
    },
  };
  let mounts = 0;
  let destroys = 0;
  const module = runInNewContext(`${compiled}\n({mountWhatsappPage});`, {
    mountWhatsappPanel(target: unknown, options?: unknown) {
      assert.equal(target, container);
      assert.equal(
        options,
        undefined,
        "Host must never inject an active adapter",
      );
      mounts++;
      return {
        destroy() {
          destroys++;
        },
      };
    },
  });
  const instance = module.mountWhatsappPage(root, path);
  return {
    root,
    instance,
    listeners,
    counts: () => ({ mounts, destroys }),
    fire(name: string, persisted = true) {
      listeners.get(name)?.forEach((listener) => listener({ persisted }));
    },
  };
}
test("bfcache restores a fresh disconnected panel after pagehide destroys state", () => {
  const page = lifecycle();
  assert.deepEqual(page.counts(), { mounts: 1, destroys: 0 });
  page.fire("pagehide");
  assert.deepEqual(page.counts(), { mounts: 1, destroys: 1 });
  page.fire("pageshow", false);
  assert.equal(page.counts().mounts, 1);
  page.fire("pageshow");
  page.fire("pageshow");
  assert.deepEqual(page.counts(), { mounts: 2, destroys: 1 });
  page.instance.destroy();
  page.instance.destroy();
  page.fire("pageshow");
  assert.deepEqual(page.counts(), { mounts: 2, destroys: 2 });
  assert.equal(page.root.innerHTML, "");
  assert.equal(page.listeners.get("pageshow")?.size, 0);
});
test("unknown WhatsApp subpath has a return link and does not mount a data panel", () => {
  const page = lifecycle("/whatsapp/nao-existe");
  assert.equal(page.counts().mounts, 0);
  assert.match(page.root.innerHTML, /Página não encontrada/);
  assert.match(page.root.innerHTML, /href="\/whatsapp"/);
  page.fire("pageshow");
  assert.equal(page.counts().mounts, 0);
  page.instance.destroy();
});
