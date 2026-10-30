import { test } from "node:test";
import assert from "node:assert/strict";
import { PARAMETERS_READ_CATALOG } from "../src/parameters-read/catalog.ts";
import {
  createParametersReadController,
  type ParametersMetadataResult,
} from "../src/parameters-read/controller.ts";

const ready = (): ParametersMetadataResult => ({
  state: "ready",
  entries: PARAMETERS_READ_CATALOG,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("local metadata loads all entries without a remote service", async () => {
  const controller = createParametersReadController();
  assert.equal(controller.snapshot().phase, "loading");
  await controller.load();
  const state = controller.snapshot();
  assert.equal(state.phase, "ready");
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.entries.length, 72);
  assert.equal(state.matches.length, 72);
  assert.deepEqual(state.entries, PARAMETERS_READ_CATALOG);
});

test("query is accent insensitive, searches labels, and clear restores the full reference", async () => {
  let loads = 0;
  const controller = createParametersReadController(async () => {
    loads++;
    return ready();
  });
  await controller.load();
  controller.setQuery(" COMISSAO ");
  let state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.ok(state.matches.length > 0 && state.matches.length < 72);
  assert.ok(state.matches.every((entry) => /comiss[aã]o/i.test(entry.label)));
  controller.setQuery("Selecione uma Opção");
  state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.matches.length, 0);
  controller.clearQuery();
  state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.query, "");
  assert.equal(state.matches.length, 72);
  assert.equal(loads, 1, "filtering is local and never loads metadata again");
});

test("a failed catalog is error, not a successful empty search, and raw error is discarded", async () => {
  const controller = createParametersReadController(async () => {
    throw new Error("PRIVATE_ERROR_SENTINEL");
  });
  await controller.load();
  assert.deepEqual(controller.snapshot(), { phase: "error", query: "" });
  assert.ok(
    !JSON.stringify(controller.snapshot()).includes("PRIVATE_ERROR_SENTINEL"),
  );
});

test("unavailable metadata remains separate from load error and no matches", async () => {
  const controller = createParametersReadController(async () => ({
    state: "unavailable",
  }));
  await controller.load();
  assert.deepEqual(controller.snapshot(), { phase: "unavailable", query: "" });
});

test("empty, partial, reordered or extra-setting metadata fails the fixed reference contract", async () => {
  for (const entries of [
    [],
    PARAMETERS_READ_CATALOG.slice(0, 71),
    [...PARAMETERS_READ_CATALOG].reverse(),
    PARAMETERS_READ_CATALOG.map((entry, index) =>
      index ? entry : { ...entry, currentValue: "Sim" },
    ),
  ]) {
    const controller = createParametersReadController(async () => ({
      state: "ready",
      entries,
    }));
    await controller.load();
    assert.equal(controller.snapshot().phase, "error");
  }
});

test("superseded loads cannot replace newer metadata state", async () => {
  const first = deferred<ParametersMetadataResult>();
  const second = deferred<ParametersMetadataResult>();
  let calls = 0;
  const controller = createParametersReadController(() =>
    ++calls === 1 ? first.promise : second.promise,
  );
  const initial = controller.load();
  const retry = controller.load();
  second.resolve(ready());
  await retry;
  controller.setQuery("agenda");
  first.reject(new Error("stale error"));
  await initial;
  assert.equal(controller.snapshot().phase, "ready");
  assert.equal(controller.snapshot().query, "agenda");
});

test("search entered while metadata loads is applied when it becomes ready", async () => {
  const pending = deferred<ParametersMetadataResult>();
  const controller = createParametersReadController(() => pending.promise);
  const loading = controller.load();
  controller.setQuery("cortesia");
  pending.resolve(ready());
  await loading;
  const state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.matches.length, 1);
  assert.equal(state.matches[0].sourceNumber, 57);
});

test("loaded snapshots cannot be changed through loader references or consumer writes", async () => {
  const entries = structuredClone(PARAMETERS_READ_CATALOG);
  const controller = createParametersReadController(async () => ({
    state: "ready",
    entries,
  }));
  await controller.load();
  Object.assign(entries[0], { label: "changed after load" });
  const state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.entries[0].label, PARAMETERS_READ_CATALOG[0].label);
  assert.throws(
    () => Object.assign(state.entries[0], { label: "changed by consumer" }),
    TypeError,
  );
  assert.throws(() => Object.assign(state, { query: "changed" }), TypeError);
});

test("dispose invalidates pending loads, removes listeners and clears the view state", async () => {
  const pending = deferred<ParametersMetadataResult>();
  const controller = createParametersReadController(() => pending.promise);
  let updates = 0;
  controller.subscribe(() => {
    updates++;
  });
  const loading = controller.load();
  const beforeDispose = updates;
  controller.dispose();
  pending.resolve(ready());
  await loading;
  controller.setQuery("ignored");
  await controller.load();
  assert.equal(updates, beforeDispose);
  assert.deepEqual(controller.snapshot(), { phase: "unavailable", query: "" });
});

test("retry can recover from a load failure, keeping the user's query", async () => {
  let loads = 0;
  const controller = createParametersReadController(async () => {
    if (++loads === 1) throw new Error("failed");
    return ready();
  });
  controller.setQuery("Slots");
  await controller.load();
  assert.equal(controller.snapshot().phase, "error");
  await controller.load();
  const state = controller.snapshot();
  if (state.phase !== "ready") assert.fail();
  assert.equal(state.query, "Slots");
  assert.deepEqual(
    state.matches.map((entry) => entry.sourceNumber),
    [58],
  );
});
