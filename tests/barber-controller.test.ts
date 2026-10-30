import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import {
  createBarberController,
  currentBarberDay,
  offsetBarberDay,
  validBarberDay,
} from "../src/barber-controller.ts";
import {
  barberScreen,
  emptyBarberEditor,
  escapeBarber,
  renderBarber,
} from "../src/barber-view.ts";
import type {
  BarberRead,
  BarberSnapshot,
  TrustedBarberScope,
} from "../src/barber-domain.ts";
import {
  inactiveBarberAdapter,
  type BarberDataAdapter,
} from "../src/data/barber-access.ts";

// Synthetic fixtures only. No records or authenticated subjects from production.
const DAY = "2026-10-29";
const NEXT_DAY = "2026-10-30";
const SCOPE: TrustedBarberScope = {
  tenantId: "synthetic-controller-tenant",
  actorId: "synthetic-controller-actor",
  professionalId: "synthetic-controller-professional",
  sessionId: "synthetic-controller-session",
};
function data(day = DAY): BarberSnapshot {
  return {
    scope: { ...SCOPE },
    day,
    timeZone: "UTC",
    appointments: [
      {
        id: "synthetic-controller-appointment",
        tenantId: SCOPE.tenantId,
        professionalId: SCOPE.professionalId,
        startsAt: `${day}T10:00:00Z`,
        endsAt: `${day}T10:45:00Z`,
        customer: { displayName: "Synthetic controller customer" },
        serviceLabels: ["Synthetic controller service"],
        statusLabel: null,
      },
    ],
    performance: {
      completedAppointments: { state: "unknown" },
      serviceUnits: { state: "unknown" },
      productUnits: { state: "unknown" },
    },
    commission: { amount: { state: "unknown" }, periodLabel: null },
  };
}
function port(overrides: Partial<BarberDataAdapter> = {}): BarberDataAdapter {
  return {
    async readScope() {
      return { state: "ready", data: { ...SCOPE } };
    },
    async readDay({ day }) {
      return { state: "ready", data: data(day) };
    },
    subscribeScope() {
      return () => {};
    },
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function render(
  controller: ReturnType<typeof createBarberController>,
  screen = "agenda" as const,
) {
  return renderBarber(controller.snapshot(), screen, emptyBarberEditor());
}
function addLocal(controller: ReturnType<typeof createBarberController>) {
  assert.equal(
    controller.addLine({
      kind: "service",
      description: "Synthetic manual local item",
      quantity: 2,
    }),
    true,
  );
}
async function loaded(source = port()) {
  const controller = createBarberController(source, DAY);
  await controller.refresh();
  return controller;
}

test("calendar controls validate real dates and shift across month and year boundaries", () => {
  for (const day of [DAY, "2024-02-29", "2027-01-01"])
    assert.equal(validBarberDay(day), true);
  for (const day of [
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-1-01",
    "",
    "invalid",
  ])
    assert.equal(validBarberDay(day), false);
  assert.equal(offsetBarberDay("2026-12-31", 1), "2027-01-01");
  assert.equal(offsetBarberDay("2024-03-01", -1), "2024-02-29");
  assert.equal(offsetBarberDay(DAY, 0.5), DAY);
  assert.equal(offsetBarberDay(DAY, Infinity), DAY);
  assert.equal(offsetBarberDay("invalid", 1), "invalid");
  assert.throws(() => createBarberController(port(), "2026-02-30"));
});

test("today follows a verified time zone at midnight and otherwise the device calendar", () => {
  const now = new Date("2026-10-29T01:30:00Z");
  assert.equal(currentBarberDay(now, "UTC"), DAY);
  assert.equal(currentBarberDay(now, "America/Sao_Paulo"), "2026-10-28");
  const device = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  assert.equal(currentBarberDay(now), device);
});

test("scope failure states make no day query and expose no raw diagnostic content", async () => {
  for (const state of [
    "unavailable",
    "signed-out",
    "forbidden",
    "error",
  ] as const) {
    let reads = 0;
    const controller = await loaded(
      port({
        async readScope() {
          return { state, reason: "SYNTHETIC_PRIVATE_DIAGNOSTIC" };
        },
        async readDay() {
          reads++;
          throw new Error("Unexpected day read");
        },
      }),
    );
    assert.equal(reads, 0);
    assert.equal(controller.snapshot().read.state, state);
    assert.equal(controller.snapshot().scope, null);
    assert.doesNotMatch(render(controller), /SYNTHETIC_PRIVATE_DIAGNOSTIC/);
    controller.dispose();
  }
});

test("malformed or rejected independent scope fails closed before reading the day", async () => {
  for (const result of [
    null,
    { state: "ready", data: null },
    { state: "ready", data: { ...SCOPE, professionalId: "" } },
  ]) {
    let reads = 0;
    const controller = await loaded(
      port({
        async readScope() {
          return result as BarberRead<TrustedBarberScope>;
        },
        async readDay() {
          reads++;
          throw new Error("Unexpected day read");
        },
      }),
    );
    assert.equal(reads, 0);
    assert.equal(controller.snapshot().read.state, "error");
    controller.dispose();
  }
  const controller = await loaded(
    port({
      async readScope() {
        throw new Error("SYNTHETIC_SCOPE_SECRET");
      },
      async readDay() {
        throw new Error("Unexpected day read");
      },
    }),
  );
  assert.equal(controller.snapshot().read.state, "error");
  assert.doesNotMatch(render(controller), /SYNTHETIC_SCOPE_SECRET/);
  controller.dispose();
});

test("day failure states and thrown errors are distinct from a genuine empty result", async () => {
  for (const state of [
    "unavailable",
    "signed-out",
    "forbidden",
    "error",
  ] as const) {
    const controller = await loaded(
      port({
        async readDay() {
          return { state, reason: "SYNTHETIC_READ_SECRET" };
        },
      }),
    );
    assert.equal(controller.snapshot().read.state, state);
    assert.equal(controller.snapshot().scope, null);
    assert.doesNotMatch(
      render(controller),
      /Nenhum atendimento nesta consulta|SYNTHETIC_READ_SECRET/,
    );
    controller.dispose();
  }
  const failed = await loaded(
    port({
      async readDay() {
        throw new Error("SYNTHETIC_THROWN_SECRET");
      },
    }),
  );
  assert.equal(failed.snapshot().read.state, "error");
  assert.doesNotMatch(render(failed), /SYNTHETIC_THROWN_SECRET/);
  failed.dispose();
  const empty = await loaded(
    port({
      async readDay() {
        return { state: "ready", data: { ...data(), appointments: [] } };
      },
    }),
  );
  assert.equal(empty.snapshot().read.state, "ready");
  assert.match(render(empty), /Nenhum atendimento nesta consulta/);
  assert.match(render(empty), /não indica horários livres/);
  empty.dispose();
});

test("controller rejects whole mismatched scope, row, requested day and malformed day responses", async () => {
  const source = data();
  const invalid: unknown[] = [
    null,
    { ...source, appointments: null },
    { ...source, scope: { ...SCOPE, tenantId: "synthetic-other-tenant" } },
    { ...source, scope: { ...SCOPE, actorId: "synthetic-other-actor" } },
    {
      ...source,
      scope: { ...SCOPE, professionalId: "synthetic-other-professional" },
    },
    { ...source, scope: { ...SCOPE, sessionId: "synthetic-other-session" } },
    {
      ...source,
      appointments: [
        ...source.appointments,
        {
          ...source.appointments[0],
          id: "synthetic-cross-tenant",
          tenantId: "synthetic-other-tenant",
        },
      ],
    },
    {
      ...source,
      appointments: [
        {
          ...source.appointments[0],
          professionalId: "synthetic-other-professional",
        },
      ],
    },
    data(NEXT_DAY),
  ];
  for (const response of invalid) {
    const controller = await loaded(
      port({
        async readDay() {
          return { state: "ready", data: response as BarberSnapshot };
        },
      }),
    );
    assert.equal(controller.snapshot().read.state, "error");
    assert.equal(controller.snapshot().scope, null);
    assert.equal(controller.snapshot().selectedAppointmentId, null);
    assert.doesNotMatch(
      render(controller),
      /Synthetic controller customer|data-appointment=/,
    );
    controller.dispose();
  }
});

test("accepted scope and day DTOs are detached and retain only the allowed fields", async () => {
  const source = data();
  const scope = { ...SCOPE, privateExtra: "SYNTHETIC_SCOPE_EXTRA" };
  const controller = await loaded(
    port({
      async readScope() {
        return { state: "ready", data: scope };
      },
      async readDay() {
        return { state: "ready", data: source };
      },
    }),
  );
  assert.deepEqual(controller.snapshot().scope, SCOPE);
  Object.assign(scope, { professionalId: "synthetic-mutated-professional" });
  Object.assign(source.appointments[0].customer, {
    displayName: "SYNTHETIC_MUTATION",
  });
  assert.deepEqual(controller.snapshot().scope, SCOPE);
  assert.match(render(controller), /Synthetic controller customer/);
  assert.doesNotMatch(
    render(controller),
    /SYNTHETIC_SCOPE_EXTRA|SYNTHETIC_MUTATION/,
  );
  controller.dispose();
});

test("a superseded scope promise cannot query or overwrite the newer day", async () => {
  const oldScope = deferred<BarberRead<TrustedBarberScope>>();
  const scopeSignals: AbortSignal[] = [];
  const days: string[] = [];
  const controller = createBarberController(
    port({
      async readScope(signal) {
        scopeSignals.push(signal);
        return scopeSignals.length === 1
          ? oldScope.promise
          : { state: "ready", data: { ...SCOPE } };
      },
      async readDay({ day }) {
        days.push(day);
        return { state: "ready", data: data(day) };
      },
    }),
    DAY,
  );
  const stale = controller.refresh();
  controller.changeDay(NEXT_DAY);
  await nextTurn();
  assert.equal(scopeSignals[0].aborted, true);
  assert.equal(controller.snapshot().read.state, "ready");
  assert.equal(controller.snapshot().day, NEXT_DAY);
  oldScope.resolve({
    state: "ready",
    data: { ...SCOPE, sessionId: "synthetic-old-session" },
  });
  await stale;
  assert.deepEqual(days, [NEXT_DAY]);
  assert.equal(controller.snapshot().read.state, "ready");
  assert.deepEqual(controller.snapshot().scope, SCOPE);
  controller.dispose();
});

test("a late aborted day result cannot resurrect old appointments or replace a newer result", async () => {
  const requests: {
    day: string;
    signal: AbortSignal;
    pending: ReturnType<typeof deferred<BarberRead<BarberSnapshot>>>;
  }[] = [];
  const controller = createBarberController(
    port({
      async readDay({ day, signal }) {
        const pending = deferred<BarberRead<BarberSnapshot>>();
        requests.push({ day, signal, pending });
        return pending.promise;
      },
    }),
    DAY,
  );
  const first = controller.refresh();
  await nextTurn();
  controller.changeDay(NEXT_DAY);
  await nextTurn();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  requests[1].pending.resolve({ state: "ready", data: data(NEXT_DAY) });
  await nextTurn();
  const current = controller.snapshot();
  requests[0].pending.resolve({ state: "ready", data: data(DAY) });
  await first;
  assert.equal(controller.snapshot(), current);
  assert.equal(controller.snapshot().read.state, "ready");
  if (controller.snapshot().read.state === "ready")
    assert.equal(
      (controller.snapshot().read as { state: "ready"; data: BarberSnapshot })
        .data.day,
      NEXT_DAY,
    );
  controller.dispose();
});

test("a stale rejected scope promise cannot turn the current successful read into an error", async () => {
  const rejected = deferred<BarberRead<TrustedBarberScope>>();
  let calls = 0;
  const controller = createBarberController(
    port({
      async readScope() {
        return ++calls === 1
          ? rejected.promise
          : { state: "ready", data: { ...SCOPE } };
      },
    }),
    DAY,
  );
  const first = controller.refresh();
  await controller.refresh();
  const current = controller.snapshot();
  rejected.reject(new Error("SYNTHETIC_STALE_SCOPE_ERROR"));
  await first;
  assert.equal(controller.snapshot(), current);
  assert.equal(current.read.state, "ready");
  controller.dispose();
});

test("scope invalidation immediately clears visible data and local draft before the next scope resolves", async () => {
  let invalidate = () => {};
  let reads = 0;
  const pendingScope = deferred<BarberRead<TrustedBarberScope>>();
  const controller = await loaded(
    port({
      subscribeScope(listener) {
        invalidate = listener;
        return () => {};
      },
      async readScope() {
        return ++reads === 1
          ? { state: "ready", data: { ...SCOPE } }
          : pendingScope.promise;
      },
    }),
  );
  controller.selectAppointment(data().appointments[0].id);
  addLocal(controller);
  assert.equal(controller.linkSelected(), true);
  const observed: ReturnType<typeof controller.snapshot>[] = [];
  controller.subscribe(() => observed.push(controller.snapshot()));
  invalidate();
  assert.equal(controller.snapshot().accessRevision, 1);
  assert.equal(controller.snapshot().scope, null);
  assert.equal(controller.snapshot().selectedAppointmentId, null);
  assert.equal(controller.snapshot().detailsOpen, false);
  assert.deepEqual(controller.snapshot().draft.lines, []);
  assert.equal(controller.snapshot().draft.link, null);
  assert.equal(controller.snapshot().read.state, "loading");
  assert.ok(observed.length >= 1);
  assert.ok(
    observed.every(
      (state) =>
        state.read.state !== "ready" &&
        state.scope === null &&
        state.draft.lines.length === 0,
    ),
  );
  pendingScope.resolve({ state: "signed-out" });
  await nextTurn();
  assert.equal(controller.snapshot().read.state, "signed-out");
  controller.dispose();
});

test("scope invalidation aborts pending old day data even if the adapter ignores cancellation", async () => {
  let invalidate = () => {};
  const pending = deferred<BarberRead<BarberSnapshot>>();
  let signal: AbortSignal | undefined;
  let scopes = 0;
  const controller = createBarberController(
    port({
      subscribeScope(listener) {
        invalidate = listener;
        return () => {};
      },
      async readScope() {
        return ++scopes === 1
          ? { state: "ready", data: { ...SCOPE } }
          : { state: "unavailable" };
      },
      async readDay(request) {
        signal = request.signal;
        return pending.promise;
      },
    }),
    DAY,
  );
  const stale = controller.refresh();
  await nextTurn();
  addLocal(controller);
  invalidate();
  assert.equal(signal?.aborted, true);
  assert.equal(controller.snapshot().draft.lines.length, 0);
  pending.resolve({ state: "ready", data: data() });
  await stale;
  await nextTurn();
  assert.equal(controller.snapshot().read.state, "unavailable");
  assert.equal(controller.snapshot().scope, null);
  controller.dispose();
});

test("closing details preserves appointment selection and linked lines; choosing another appointment clears them", async () => {
  const first = data().appointments[0];
  const second = { ...first, id: "synthetic-controller-second" };
  const controller = await loaded(
    port({
      async readDay() {
        return {
          state: "ready",
          data: { ...data(), appointments: [first, second] },
        };
      },
    }),
  );
  assert.equal(controller.selectAppointment(first.id), true);
  addLocal(controller);
  assert.equal(controller.linkSelected(), true);
  assert.equal(controller.snapshot().detailsOpen, true);
  const draft = controller.snapshot().draft;
  controller.closeDetails();
  assert.equal(controller.snapshot().detailsOpen, false);
  assert.equal(controller.snapshot().selectedAppointmentId, first.id);
  assert.equal(controller.snapshot().draft, draft);
  assert.doesNotMatch(render(controller), /id="bm-detail"/);
  assert.equal(controller.selectAppointment(first.id), true);
  assert.equal(controller.snapshot().detailsOpen, true);
  assert.equal(controller.snapshot().draft, draft);
  assert.equal(controller.selectAppointment(second.id), true);
  assert.equal(controller.snapshot().draft.link, null);
  assert.deepEqual(controller.snapshot().draft.lines, []);
  controller.dispose();
});

test("refresh immediately removes linked context while a pending read remains unresolved", async () => {
  const pending = deferred<BarberRead<TrustedBarberScope>>();
  let calls = 0;
  const controller = await loaded(
    port({
      async readScope() {
        return ++calls === 1
          ? { state: "ready", data: { ...SCOPE } }
          : pending.promise;
      },
    }),
  );
  controller.selectAppointment(data().appointments[0].id);
  addLocal(controller);
  controller.linkSelected();
  const refresh = controller.refresh();
  assert.equal(controller.snapshot().read.state, "loading");
  assert.equal(controller.snapshot().scope, null);
  assert.equal(controller.snapshot().selectedAppointmentId, null);
  assert.equal(controller.snapshot().detailsOpen, false);
  assert.equal(controller.snapshot().draft.link, null);
  assert.deepEqual(controller.snapshot().draft.lines, []);
  pending.resolve({ state: "unavailable" });
  await refresh;
  controller.dispose();
});

test("invalid dates and invisible appointment IDs preserve current content without new reads", async () => {
  let queries = 0;
  const controller = await loaded(
    port({
      async readDay({ day }) {
        queries++;
        return { state: "ready", data: data(day) };
      },
    }),
  );
  controller.selectAppointment(data().appointments[0].id);
  addLocal(controller);
  controller.linkSelected();
  const draft = controller.snapshot().draft;
  controller.changeDay("2026-02-30");
  assert.equal(controller.snapshot().day, DAY);
  assert.equal(controller.snapshot().read.state, "ready");
  assert.equal(controller.snapshot().draft, draft);
  assert.equal(controller.selectAppointment("synthetic-foreign-unseen"), false);
  assert.equal(controller.snapshot().draft, draft);
  assert.equal(queries, 1);
  controller.dispose();
});

test("local CRUD needs no reads or writes, and save remains explicitly unavailable", async (t) => {
  let calls = 0;
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected fetch");
  });
  const adapter = {
    ...port({
      async readScope() {
        calls++;
        return { state: "unavailable" };
      },
      async readDay() {
        calls++;
        return { state: "unavailable" };
      },
    }),
    save() {
      calls++;
      throw new Error("Unexpected write");
    },
  };
  const controller = createBarberController(adapter, DAY);
  addLocal(controller);
  const id = controller.snapshot().draft.lines[0].id;
  assert.equal(
    controller.updateLine(id, {
      kind: "product",
      description: "Synthetic changed local item",
      quantity: 3,
    }),
    true,
  );
  assert.equal(controller.snapshot().draft.lines[0].quantity, 3);
  const updated = controller.snapshot().draft;
  assert.equal(
    controller.updateLine(id, {
      kind: "product",
      description: "Invalid quantity",
      quantity: 0,
    }),
    false,
  );
  assert.equal(controller.snapshot().draft, updated);
  controller.requestSave();
  assert.equal(controller.snapshot().draft, updated);
  assert.equal(controller.snapshot().notice?.error, true);
  assert.match(
    controller.snapshot().notice!.text,
    /não está disponível.*Nenhum dado foi enviado/,
  );
  const html = renderBarber(
    controller.snapshot(),
    "rascunho",
    emptyBarberEditor(),
  );
  assert.match(html, /data-save disabled/);
  assert.doesNotMatch(html, /salvo com sucesso|venda confirmada|40%/i);
  assert.equal(controller.removeLine(id), true);
  assert.equal(controller.snapshot().draft.lines.length, 0);
  addLocal(controller);
  controller.clearDraft();
  assert.equal(controller.snapshot().draft.lines.length, 0);
  assert.equal(calls, 0);
  assert.equal(fetch.mock.callCount(), 0);
  controller.dispose();
});

test("inactive reads preserve an unlinked local draft without inventing appointments", async () => {
  const controller = createBarberController(inactiveBarberAdapter, DAY);
  addLocal(controller);
  await controller.refresh();
  assert.equal(controller.snapshot().read.state, "unavailable");
  assert.equal(controller.snapshot().draft.lines.length, 1);
  assert.equal(controller.snapshot().draft.link, null);
  assert.equal(controller.linkSelected(), false);
  assert.doesNotMatch(
    render(controller),
    /data-appointment=|Synthetic controller customer/,
  );
  controller.dispose();
});

test("dispose aborts pending work, unsubscribes once and cannot restore data or local lines", async () => {
  let stopped = 0;
  let scopeCalls = 0;
  let invalidate = () => {};
  const pending = deferred<BarberRead<BarberSnapshot>>();
  let signal: AbortSignal | undefined;
  const controller = createBarberController(
    port({
      subscribeScope(listener) {
        invalidate = listener;
        return () => {
          stopped++;
        };
      },
      async readScope() {
        scopeCalls++;
        return { state: "ready", data: { ...SCOPE } };
      },
      async readDay(request) {
        signal = request.signal;
        return pending.promise;
      },
    }),
    DAY,
  );
  const refresh = controller.refresh();
  await nextTurn();
  addLocal(controller);
  controller.dispose();
  assert.equal(signal?.aborted, true);
  assert.equal(stopped, 1);
  assert.equal(controller.snapshot().scope, null);
  assert.equal(controller.snapshot().selectedAppointmentId, null);
  assert.equal(controller.snapshot().detailsOpen, false);
  assert.equal(controller.snapshot().read.state, "unavailable");
  assert.deepEqual(controller.snapshot().draft.lines, []);
  assert.equal(controller.snapshot().notice, null);
  const disposed = controller.snapshot();
  invalidate();
  controller.dispose();
  await controller.refresh();
  controller.changeDay(NEXT_DAY);
  controller.requestSave();
  controller.clearDraft();
  controller.closeDetails();
  assert.equal(controller.selectAppointment(null), false);
  assert.equal(
    controller.addLine({
      kind: "service",
      description: "Synthetic late item",
      quantity: 1,
    }),
    false,
  );
  pending.resolve({ state: "ready", data: data() });
  await refresh;
  assert.equal(controller.snapshot(), disposed);
  assert.equal(scopeCalls, 1);
  assert.equal(stopped, 1);
});

test("barber rendering escapes names, services, status, manual descriptions, editor fields and notices", async () => {
  const unsafe = `"><img src=x onerror='synthetic'>&`;
  const encoded =
    "&quot;&gt;&lt;img src=x onerror=&#39;synthetic&#39;&gt;&amp;";
  assert.equal(escapeBarber(unsafe), encoded);
  const original = data().appointments[0];
  const controller = await loaded(
    port({
      async readDay() {
        return {
          state: "ready",
          data: {
            ...data(),
            appointments: [
              {
                ...original,
                id: unsafe,
                customer: { displayName: unsafe },
                serviceLabels: [unsafe],
                statusLabel: unsafe,
              },
            ],
            commission: { amount: { state: "unknown" }, periodLabel: unsafe },
          },
        };
      },
    }),
  );
  controller.selectAppointment(unsafe);
  const agenda = render(controller);
  assert.match(agenda, /&lt;img/);
  assert.ok(agenda.includes(`data-appointment="${encoded}"`));
  assert.doesNotMatch(agenda, /<img|<script/);
  controller.addLine({ kind: "service", description: unsafe, quantity: 1 });
  const state = {
    ...controller.snapshot(),
    notice: { text: unsafe, error: true },
  };
  const draft = renderBarber(state, "rascunho", {
    id: null,
    kind: "service",
    description: unsafe,
    quantity: unsafe,
  });
  assert.ok(draft.includes(`value="${encoded}"`));
  assert.doesNotMatch(draft, /<img|<script/);
  assert.ok(
    renderBarber(state, "desempenho", emptyBarberEditor()).includes(encoded),
  );
  controller.dispose();
});

test("unknown performance and commission never render invented zero or commission rates", async () => {
  const inactive = createBarberController(inactiveBarberAdapter, DAY);
  const ready = await loaded();
  for (const controller of [inactive, ready]) {
    addLocal(controller);
    const html = renderBarber(
      controller.snapshot(),
      "desempenho",
      emptyBarberEditor(),
    );
    assert.equal(
      (html.match(/<strong class="is-unknown">Não informado<\/strong>/gu) ?? [])
        .length,
      3,
    );
    assert.match(html, /<strong>Não informado<\/strong>/);
    assert.doesNotMatch(html, /<strong[^>]*>0<\/strong>|R\$|40\s*%/);
    controller.dispose();
  }
});

test("genuinely supplied zero is shown as zero and is never replaced with unknown", async () => {
  const controller = await loaded(
    port({
      async readDay() {
        return {
          state: "ready",
          data: {
            ...data(),
            performance: {
              completedAppointments: { state: "known", value: 0 },
              serviceUnits: { state: "known", value: 0 },
              productUnits: { state: "known", value: 0 },
            },
            commission: {
              amount: {
                state: "known",
                value: { minorUnits: 0, currency: "BRL" },
              },
              periodLabel: "Synthetic period",
            },
          },
        };
      },
    }),
  );
  const html = renderBarber(
    controller.snapshot(),
    "desempenho",
    emptyBarberEditor(),
  );
  assert.equal((html.match(/<strong class="">0<\/strong>/gu) ?? []).length, 3);
  assert.match(html, /R\$\s*0,00/);
  assert.doesNotMatch(html, /Não informado|40\s*%/);
  controller.dispose();
});

test("barber hash navigation cannot select administrative screens and invalid paths render only the safe branch", () => {
  for (const hash of [
    "#Dashboard",
    "#Clientes",
    "#Financeiro",
    "#Comissoes",
    "#Agenda",
    "#unknown",
    "#agenda?mode=demo",
  ])
    assert.equal(barberScreen(hash), "agenda");
  for (const hash of ["agenda", "rascunho", "desempenho", "mais"] as const)
    assert.equal(barberScreen(`#${hash}`), hash);
  const controller = createBarberController(inactiveBarberAdapter, DAY);
  const html = renderBarber(
    controller.snapshot(),
    "agenda",
    emptyBarberEditor(),
    true,
  );
  assert.match(html, /Tela não encontrada/);
  assert.match(html, /href="\/barbeiro#agenda"/);
  assert.doesNotMatch(
    html,
    /data-refresh|data-appointment=|bm-item-form|href="[^"]*#Dashboard"/,
  );
  controller.dispose();
});
