import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DRAFT_DESCRIPTION_LENGTH,
  MAX_DRAFT_LINES,
  MAX_DRAFT_QUANTITY,
  PROPOSED_ROLE_NAVIGATION,
  createDraftLine,
  emptyBarberDraft,
  isTrustedBarberScopeShape,
  linkDraftToAppointment,
  projectBarberSnapshot,
  reconcileDraftContext,
  removeDraftLine,
  updateDraftLine,
  type BarberAppointment,
  type BarberDraft,
  type BarberDraftResult,
  type BarberSnapshot,
  type TrustedBarberScope,
} from "../src/barber-domain.ts";
import { inactiveBarberAdapter } from "../src/data/barber-access.ts";

// Every identity, appointment, amount and description in this file is synthetic.
// These fixtures exercise a proposed local contract, not real backend permission.
const SCOPE: TrustedBarberScope = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  professionalId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
};

function appointment(id = "synthetic-appointment-1"): BarberAppointment {
  return {
    id,
    tenantId: SCOPE.tenantId,
    professionalId: SCOPE.professionalId,
    startsAt: "2026-10-29T10:00:00Z",
    endsAt: "2026-10-29T10:45:00Z",
    customer: { displayName: "Synthetic customer" },
    serviceLabels: ["Synthetic service"],
    statusLabel: null,
  };
}

function snapshot(): BarberSnapshot {
  return {
    scope: { ...SCOPE },
    day: "2026-10-29",
    timeZone: "UTC",
    appointments: [appointment()],
    performance: {
      completedAppointments: { state: "unknown" },
      serviceUnits: { state: "unknown" },
      productUnits: { state: "unknown" },
    },
    commission: { amount: { state: "unknown" }, periodLabel: null },
  };
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

function readyDraft(result: BarberDraftResult): BarberDraft {
  assert.equal(result.state, "ready");
  if (result.state !== "ready") throw new Error(result.message);
  return result.draft;
}

function rejectSnapshot(raw: unknown, scope = SCOPE) {
  const result = projectBarberSnapshot(raw, scope);
  assert.notEqual(result.state, "ready");
  assert.equal(
    "data" in result,
    false,
    "a rejected read must not expose partial data",
  );
}

function localDraft(): BarberDraft {
  return readyDraft(
    createDraftLine(emptyBarberDraft(), {
      kind: "service",
      description: "Synthetic draft service",
      quantity: 1,
    }),
  );
}

function context() {
  return {
    scope: { ...SCOPE },
    selectedAppointmentId: "synthetic-appointment-1",
    appointments: [appointment()],
  };
}

function linkedDraft(): BarberDraft {
  return readyDraft(linkDraftToAppointment(localDraft(), context()));
}

test("appointment day follows its start date in the explicit time zone", () => {
  const row = {
    ...appointment(),
    startsAt: "2026-10-29T00:30:00Z",
    endsAt: "2026-10-29T01:15:00Z",
  };
  const utc = { ...snapshot(), appointments: [row] };
  assert.equal(projectBarberSnapshot(utc, SCOPE).state, "ready");
  rejectSnapshot({ ...utc, day: "2026-10-28" });
  rejectSnapshot({ ...utc, timeZone: "America/Sao_Paulo" });
  assert.equal(
    projectBarberSnapshot(
      { ...utc, day: "2026-10-28", timeZone: "America/Sao_Paulo" },
      SCOPE,
    ).state,
    "ready",
  );
});

test("a cross-midnight end is allowed only when the local start day matches", () => {
  const raw = {
    ...snapshot(),
    timeZone: "America/Sao_Paulo",
    appointments: [
      {
        ...appointment(),
        startsAt: "2026-10-29T23:30:00-03:00",
        endsAt: "2026-10-30T00:30:00-03:00",
      },
    ],
  };
  assert.equal(projectBarberSnapshot(raw, SCOPE).state, "ready");
  rejectSnapshot({ ...raw, day: "2026-10-30" });
});

test("role navigation remains the explicit proposal with separate default areas", () => {
  assert.deepEqual(PROPOSED_ROLE_NAVIGATION, {
    owner: {
      areas: ["administration", "barber"],
      defaultArea: "administration",
    },
    admin: {
      areas: ["administration", "barber"],
      defaultArea: "administration",
    },
    reception: { areas: ["administration"], defaultArea: "administration" },
    barber: { areas: ["barber"], defaultArea: "barber" },
  });
});

test("inactive access stays unavailable without fetching or claiming an empty day", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("The inactive adapter must not fetch");
  });
  let storageReads = 0;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        storageReads++;
        throw new Error("The inactive adapter must not access browser storage");
      },
    });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const controller = new AbortController();
  const scope = await inactiveBarberAdapter.readScope(controller.signal);
  let scopeNotifications = 0;
  const unsubscribe = inactiveBarberAdapter.subscribeScope(() => {
    scopeNotifications++;
  });
  const initial = await inactiveBarberAdapter.readDay({
    day: "2026-10-29",
    signal: controller.signal,
  });
  controller.abort();
  const aborted = await inactiveBarberAdapter.readDay({
    day: "2026-10-30",
    signal: controller.signal,
  });
  const abortedScope = await inactiveBarberAdapter.readScope(controller.signal);
  unsubscribe();
  unsubscribe();
  for (const result of [scope, initial, abortedScope, aborted]) {
    assert.equal(result.state, "unavailable");
    assert.equal("data" in result, false);
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(storageReads, 0);
  assert.equal(scopeNotifications, 0);
  assert.deepEqual(Object.keys(inactiveBarberAdapter).sort(), [
    "readDay",
    "readScope",
    "subscribeScope",
  ]);
});

test("scope shape requires all four identities without claiming authentication", () => {
  assert.equal(isTrustedBarberScopeShape(SCOPE), true);
  for (const value of [null, [], {}, { ...SCOPE, sessionId: "" }]) {
    assert.equal(isTrustedBarberScopeShape(value), false);
  }
  for (const key of [
    "tenantId",
    "actorId",
    "professionalId",
    "sessionId",
  ] as const) {
    for (const value of [
      undefined,
      null,
      123,
      " ",
      " synthetic ",
      "synthetic\ninvalid",
    ]) {
      assert.equal(
        isTrustedBarberScopeShape({ ...SCOPE, [key]: value }),
        false,
      );
    }
  }
});

test("valid projection keeps only the allowed fields and does not mutate raw data", () => {
  const expected = snapshot();
  const raw = freezeDeep({
    ...expected,
    companyRevenue: 987654,
    colleagues: [{ name: "Synthetic private colleague" }],
    scope: { ...SCOPE, accessToken: "synthetic-private-token" },
    appointments: [
      {
        ...appointment(),
        internalNotes: "Synthetic private note",
        payment: { card: "synthetic-private-card" },
        customer: {
          displayName: "Synthetic customer",
          email: "synthetic@example.invalid",
          telephone: "synthetic-private-phone",
        },
      },
    ],
    performance: {
      ...expected.performance,
      companyTotal: 12345,
      serviceUnits: { state: "unknown", privateTotal: 123 },
    },
    commission: {
      ...expected.commission,
      formula: "synthetic-private-formula",
    },
  });
  const before = JSON.stringify(raw);
  const result = projectBarberSnapshot(raw, SCOPE);
  assert.deepEqual(result, { state: "ready", data: expected });
  assert.equal(JSON.stringify(raw), before);
  if (result.state !== "ready") return;
  assert.notEqual(result.data.scope, raw.scope);
  assert.notEqual(result.data.appointments, raw.appointments);
  assert.notEqual(
    result.data.appointments[0].customer,
    raw.appointments[0].customer,
  );
  assert.notEqual(
    result.data.appointments[0].serviceLabels,
    raw.appointments[0].serviceLabels,
  );
});

test("a validated genuinely empty snapshot is ready and preserves unknown values", () => {
  const raw = { ...snapshot(), appointments: [] };
  assert.deepEqual(projectBarberSnapshot(raw, SCOPE), {
    state: "ready",
    data: raw,
  });
});

test("appointments do not imply completed work, commission, payment or zero totals", () => {
  const result = projectBarberSnapshot(snapshot(), SCOPE);
  assert.equal(result.state, "ready");
  if (result.state !== "ready") return;
  assert.deepEqual(result.data.performance, {
    completedAppointments: { state: "unknown" },
    serviceUnits: { state: "unknown" },
    productUnits: { state: "unknown" },
  });
  assert.deepEqual(result.data.commission, {
    amount: { state: "unknown" },
    periodLabel: null,
  });
});

test("explicit known zero quantities and commission remain genuine known zero", () => {
  const raw: BarberSnapshot = {
    ...snapshot(),
    appointments: [],
    performance: {
      completedAppointments: { state: "known", value: 0 },
      serviceUnits: { state: "known", value: 0 },
      productUnits: { state: "known", value: 0 },
    },
    commission: {
      amount: { state: "known", value: { minorUnits: 0, currency: "BRL" } },
      periodLabel: "Synthetic reporting period",
    },
  };
  assert.deepEqual(projectBarberSnapshot(raw, SCOPE), {
    state: "ready",
    data: raw,
  });
});

test("missing and malformed snapshot containers never become successful empty reads", () => {
  const valid = snapshot();
  for (const raw of [
    undefined,
    null,
    [],
    "synthetic invalid payload",
    {},
    { ...valid, scope: null },
    { ...valid, appointments: undefined },
    { ...valid, appointments: {} },
    { ...valid, performance: null },
    { ...valid, commission: null },
  ]) {
    rejectSnapshot(raw);
  }
});

test("malformed expected identity cannot validate an otherwise well-formed snapshot", () => {
  for (const scope of [
    null,
    {},
    { ...SCOPE, actorId: "" },
    { ...SCOPE, sessionId: undefined },
  ]) {
    rejectSnapshot(snapshot(), scope as TrustedBarberScope);
  }
});

for (const key of [
  "tenantId",
  "actorId",
  "professionalId",
  "sessionId",
] as const) {
  test(`snapshot ${key} must exactly match the trusted current scope`, () => {
    const raw = snapshot();
    rejectSnapshot({
      ...raw,
      scope: { ...raw.scope, [key]: `other-synthetic-${key}` },
    });
    rejectSnapshot({ ...raw, scope: { ...raw.scope, [key]: "" } });
    rejectSnapshot(raw, { ...SCOPE, [key]: `other-synthetic-${key}` });
  });
}

for (const key of ["tenantId", "professionalId"] as const) {
  test(`one appointment with another ${key} rejects the whole read`, () => {
    const raw = snapshot();
    rejectSnapshot({
      ...raw,
      appointments: [
        appointment(),
        { ...appointment("synthetic-foreign"), [key]: "other-synthetic" },
      ],
    });
  });
}

test("ambiguous duplicate appointment IDs reject the whole read", () => {
  rejectSnapshot({
    ...snapshot(),
    appointments: [appointment(), appointment()],
  });
});

test("invalid date, timezone and appointment shapes are rejected rather than partly rendered", () => {
  const raw = snapshot();
  for (const patch of [
    { day: "2026-02-30" },
    { day: "not-a-day" },
    { timeZone: "Synthetic/Invalid_Zone" },
    { timeZone: "" },
  ]) {
    rejectSnapshot({ ...raw, ...patch });
  }
  for (const patch of [
    { id: "" },
    { customer: null },
    { customer: { displayName: "" } },
    { serviceLabels: "Synthetic service" },
    { serviceLabels: [123] },
    { statusLabel: 123 },
    { startsAt: "invalid" },
    { endsAt: "invalid" },
    { endsAt: "2026-10-29T10:00:00Z" },
    { endsAt: "2026-10-29T09:59:00Z" },
  ]) {
    rejectSnapshot({
      ...raw,
      appointments: [
        appointment(),
        { ...appointment("synthetic-malformed"), ...patch },
      ],
    });
  }
});

test("known performance metrics require valid nonnegative safe integers", () => {
  for (const key of [
    "completedAppointments",
    "serviceUnits",
    "productUnits",
  ] as const) {
    for (const value of [
      undefined,
      null,
      "0",
      true,
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const raw = snapshot();
      rejectSnapshot({
        ...raw,
        performance: { ...raw.performance, [key]: { state: "known", value } },
      });
    }
    for (const metric of [null, {}, { state: "invalid" }]) {
      const raw = snapshot();
      rejectSnapshot({
        ...raw,
        performance: { ...raw.performance, [key]: metric },
      });
    }
  }
});

test("known commission requires a valid amount and currency instead of a fabricated zero", () => {
  for (const value of [
    undefined,
    null,
    0,
    {},
    { minorUnits: "0", currency: "BRL" },
    { minorUnits: 0.5, currency: "BRL" },
    { minorUnits: NaN, currency: "BRL" },
    { minorUnits: Infinity, currency: "BRL" },
    { minorUnits: Number.MAX_SAFE_INTEGER + 1, currency: "BRL" },
    { minorUnits: Number.MIN_SAFE_INTEGER - 1, currency: "BRL" },
    { minorUnits: 0, currency: "" },
    { minorUnits: 0, currency: "brl" },
    { minorUnits: 0, currency: "BR" },
  ]) {
    rejectSnapshot({
      ...snapshot(),
      commission: { amount: { state: "known", value }, periodLabel: null },
    });
  }
});

test("signed server commission is preserved without assuming adjustment semantics", () => {
  for (const minorUnits of [-100, 12345]) {
    const raw: BarberSnapshot = {
      ...snapshot(),
      commission: {
        amount: { state: "known", value: { minorUnits, currency: "BRL" } },
        periodLabel: "Synthetic reporting period",
      },
    };
    assert.deepEqual(projectBarberSnapshot(raw, SCOPE), {
      state: "ready",
      data: raw,
    });
  }
});

test("new drafts are empty, local and independent", () => {
  const first = emptyBarberDraft();
  const second = emptyBarberDraft();
  assert.deepEqual(first.lines, []);
  assert.equal(first.link, null);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
});

test("create, update and remove preserve frozen inputs and unrelated lines", () => {
  const empty = freezeDeep(emptyBarberDraft());
  const first = freezeDeep(
    readyDraft(
      createDraftLine(empty, {
        kind: "service",
        description: "Synthetic service",
        quantity: 1,
      }),
    ),
  );
  const second = freezeDeep(
    readyDraft(
      createDraftLine(first, {
        kind: "product",
        description: "Synthetic product",
        quantity: 2,
      }),
    ),
  );
  const edited = freezeDeep(
    readyDraft(
      updateDraftLine(second, second.lines[0].id, {
        kind: "service",
        description: "Synthetic updated service",
        quantity: 3,
      }),
    ),
  );
  assert.equal(empty.lines.length, 0);
  assert.equal(first.lines.length, 1);
  assert.equal(second.lines[0].description, "Synthetic service");
  assert.deepEqual(edited.lines[0], {
    ...second.lines[0],
    description: "Synthetic updated service",
    quantity: 3,
  });
  assert.deepEqual(edited.lines[1], second.lines[1]);
  const removed = readyDraft(removeDraftLine(edited, edited.lines[0].id));
  assert.deepEqual(removed.lines, [edited.lines[1]]);
  assert.equal(edited.lines.length, 2);
});

test("draft descriptions trim outer whitespace and preserve literal user text", () => {
  const description = '<img src="synthetic" onerror="synthetic()">';
  const draft = readyDraft(
    createDraftLine(emptyBarberDraft(), {
      kind: "service",
      description: `  ${description}  `,
      quantity: 1,
    }),
  );
  assert.equal(draft.lines[0].description, description);
});

test("draft line count, description length and quantity accept their exact upper bounds", () => {
  assert.equal(MAX_DRAFT_LINES, 20);
  assert.equal(MAX_DRAFT_DESCRIPTION_LENGTH, 120);
  assert.equal(MAX_DRAFT_QUANTITY, 99);
  let draft = emptyBarberDraft();
  for (let index = 0; index < MAX_DRAFT_LINES; index++) {
    draft = readyDraft(
      createDraftLine(freezeDeep(draft), {
        kind: index % 2 === 0 ? "service" : "product",
        description: "S".repeat(MAX_DRAFT_DESCRIPTION_LENGTH),
        quantity: MAX_DRAFT_QUANTITY,
      }),
    );
  }
  assert.equal(draft.lines.length, MAX_DRAFT_LINES);
  assert.equal(
    new Set(draft.lines.map((line) => line.id)).size,
    MAX_DRAFT_LINES,
  );
  const overflow = createDraftLine(freezeDeep(draft), {
    kind: "service",
    description: "Synthetic overflow",
    quantity: 1,
  });
  assert.equal(overflow.state, "invalid");
  assert.equal(draft.lines.length, MAX_DRAFT_LINES);
  const edited = readyDraft(
    updateDraftLine(draft, draft.lines[0].id, {
      kind: "product",
      description: "Synthetic valid update at line limit",
      quantity: 1,
    }),
  );
  assert.equal(edited.lines.length, MAX_DRAFT_LINES);
});

test("create and update reject malformed line input without changing the draft", () => {
  const draft = freezeDeep(localDraft());
  const before = JSON.stringify(draft);
  const valid = {
    kind: "service" as const,
    description: "Synthetic line",
    quantity: 1,
  };
  const malformed: unknown[] = [
    null,
    {},
    { ...valid, kind: "extra" },
    { ...valid, kind: null },
    { ...valid, description: "" },
    { ...valid, description: " \n\t " },
    { ...valid, description: 123 },
    { ...valid, description: "Synthetic\u0000invalid" },
    { ...valid, description: "Synthetic\ninvalid" },
    { ...valid, description: "S".repeat(MAX_DRAFT_DESCRIPTION_LENGTH + 1) },
    ...[
      undefined,
      null,
      "1",
      true,
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      MAX_DRAFT_QUANTITY + 1,
    ].map((quantity) => ({ ...valid, quantity })),
  ];
  for (const input of malformed) {
    const typed = input as Parameters<typeof createDraftLine>[1];
    for (const result of [
      createDraftLine(draft, typed),
      updateDraftLine(draft, draft.lines[0].id, typed),
    ]) {
      assert.equal(result.state, "invalid");
      if (result.state === "invalid") assert.ok(result.message.trim());
    }
  }
  assert.equal(JSON.stringify(draft), before);
});

test("update and remove cannot target an absent line", () => {
  const draft = freezeDeep(localDraft());
  const before = JSON.stringify(draft);
  assert.equal(
    updateDraftLine(draft, "synthetic-missing", {
      kind: "product",
      description: "Synthetic wrong target",
      quantity: 1,
    }).state,
    "invalid",
  );
  assert.equal(removeDraftLine(draft, "synthetic-missing").state, "invalid");
  assert.equal(JSON.stringify(draft), before);
});

test("malformed existing drafts reject operations and reconcile to an empty draft", () => {
  const valid = localDraft();
  const malformed: unknown[] = [
    null,
    {},
    { ...valid, lines: null },
    { ...valid, lines: [valid.lines[0], valid.lines[0]] },
    { ...valid, lines: [{ ...valid.lines[0], quantity: 0 }] },
    { ...valid, nextLineNumber: 0 },
    { ...valid, nextLineNumber: NaN },
    { ...valid, nextLineNumber: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, link: { scope: SCOPE, appointmentId: "" } },
    {
      ...valid,
      link: {
        scope: { ...SCOPE, sessionId: "" },
        appointmentId: "synthetic-appointment-1",
      },
    },
  ];
  for (const raw of malformed) {
    const draft = freezeDeep(raw) as BarberDraft;
    const input = {
      kind: "service" as const,
      description: "Synthetic new item",
      quantity: 1,
    };
    for (const result of [
      createDraftLine(draft, input),
      updateDraftLine(draft, valid.lines[0].id, input),
      removeDraftLine(draft, valid.lines[0].id),
      linkDraftToAppointment(draft, context()),
    ]) {
      assert.equal(result.state, "invalid");
    }
    assert.deepEqual(
      reconcileDraftContext(draft, context()),
      emptyBarberDraft(),
    );
  }
});

test("removing then creating a line never reuses a stale line ID", () => {
  const original = localDraft();
  const removed = readyDraft(removeDraftLine(original, original.lines[0].id));
  const replacement = readyDraft(
    createDraftLine(removed, {
      kind: "product",
      description: "Synthetic replacement",
      quantity: 1,
    }),
  );
  assert.notEqual(replacement.lines[0].id, original.lines[0].id);
  assert.equal(
    updateDraftLine(replacement, original.lines[0].id, {
      kind: "service",
      description: "Synthetic stale edit",
      quantity: 1,
    }).state,
    "invalid",
  );
});

test("linking to an owned selected appointment preserves items without changing source data", () => {
  const draft = freezeDeep(localDraft());
  const current = freezeDeep(context());
  const before = JSON.stringify({ draft, current });
  const linked = readyDraft(linkDraftToAppointment(draft, current));
  assert.deepEqual(linked.lines, draft.lines);
  assert.deepEqual(linked.link, {
    scope: SCOPE,
    appointmentId: current.selectedAppointmentId,
  });
  assert.equal(draft.link, null);
  assert.equal(JSON.stringify({ draft, current }), before);
  assert.deepEqual(reconcileDraftContext(freezeDeep(linked), current), linked);
});

test("linking rejects absent identity, missing selection and foreign appointment ownership", () => {
  const draft = freezeDeep(localDraft());
  const before = JSON.stringify(draft);
  const current = context();
  for (const candidate of [
    { ...current, scope: null },
    { ...current, selectedAppointmentId: null },
    { ...current, selectedAppointmentId: "synthetic-missing" },
    { ...current, appointments: [] },
    { ...current, appointments: [appointment(), appointment()] },
    {
      ...current,
      appointments: [{ ...appointment(), tenantId: "synthetic-other-tenant" }],
    },
    {
      ...current,
      appointments: [
        { ...appointment(), professionalId: "synthetic-other-professional" },
      ],
    },
  ]) {
    assert.equal(linkDraftToAppointment(draft, candidate).state, "invalid");
  }
  assert.equal(JSON.stringify(draft), before);
});

test("unlinked local drafts retain their items as appointment context changes", () => {
  const draft = freezeDeep(localDraft());
  for (const candidate of [
    context(),
    { scope: null, selectedAppointmentId: null, appointments: [] },
    {
      ...context(),
      scope: { ...SCOPE, professionalId: "synthetic-other-professional" },
    },
    { ...context(), selectedAppointmentId: "synthetic-other-appointment" },
  ]) {
    assert.deepEqual(reconcileDraftContext(draft, candidate), draft);
  }
});

test("linked drafts clear when selection, identity or appointment availability disappears", () => {
  const draft = freezeDeep(linkedDraft());
  const before = JSON.stringify(draft);
  const current = context();
  for (const candidate of [
    { ...current, scope: null },
    { ...current, selectedAppointmentId: null },
    { ...current, appointments: [] },
    { ...current, appointments: [appointment(), appointment()] },
    {
      ...current,
      selectedAppointmentId: "synthetic-appointment-2",
      appointments: [appointment("synthetic-appointment-2")],
    },
    {
      ...current,
      appointments: [{ ...appointment(), tenantId: "synthetic-other-tenant" }],
    },
    {
      ...current,
      appointments: [
        { ...appointment(), professionalId: "synthetic-other-professional" },
      ],
    },
  ]) {
    const cleared = reconcileDraftContext(draft, candidate);
    assert.deepEqual(cleared.lines, []);
    assert.equal(cleared.link, null);
  }
  assert.equal(JSON.stringify(draft), before);
});

for (const key of [
  "tenantId",
  "actorId",
  "professionalId",
  "sessionId",
] as const) {
  test(`linked draft clears when ${key} changes even for the same appointment ID`, () => {
    const draft = freezeDeep(linkedDraft());
    const current = context();
    const scope = { ...SCOPE, [key]: `synthetic-other-${key}` };
    const candidate = {
      ...current,
      scope,
      appointments: [
        {
          ...appointment(),
          tenantId: scope.tenantId,
          professionalId: scope.professionalId,
        },
      ],
    };
    const cleared = reconcileDraftContext(draft, candidate);
    assert.deepEqual(cleared.lines, []);
    assert.equal(cleared.link, null);
    assert.equal(draft.lines.length, 1);
  });
}

test("direct relinking cannot carry an existing linked draft into another context", () => {
  const draft = freezeDeep(linkedDraft());
  for (const candidate of [
    {
      ...context(),
      selectedAppointmentId: "synthetic-appointment-2",
      appointments: [appointment("synthetic-appointment-2")],
    },
    { ...context(), scope: { ...SCOPE, actorId: "synthetic-other-actor" } },
    { ...context(), scope: { ...SCOPE, sessionId: "synthetic-other-session" } },
  ]) {
    const result = readyDraft(linkDraftToAppointment(draft, candidate));
    assert.deepEqual(
      result.lines,
      [],
      "changed ownership must not inherit old items",
    );
    assert.deepEqual(result.link, {
      scope: candidate.scope,
      appointmentId: candidate.selectedAppointmentId,
    });
  }
  assert.equal(draft.link?.appointmentId, "synthetic-appointment-1");
  assert.equal(draft.lines.length, 1);
});
