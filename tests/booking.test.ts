import { test } from "node:test";
import assert from "node:assert/strict";
import {
  priceBookingCart,
  quoteBooking,
  evaluateProfessionals,
  findCompatibleSlots,
  planBooking,
  type BookingCatalog,
  type BookingCart,
  type BookingFact,
  type BookingResult,
  type AvailabilitySnapshot,
  type MinuteInterval,
  type SlotSearch,
} from "../src/booking-domain.ts";
import {
  emptyBookingDraft,
  transitionBooking,
  type BookingContext,
  type BookingDraft,
} from "../src/booking-flow.ts";

// Synthetic unit inputs only. No live records or application demo fallback.
const yes = <T>(value: T): BookingFact<T> => ({ state: "confirmed", value });
const missing = { state: "missing" } as const;
function catalog(): BookingCatalog {
  return {
    revision: "catalog-test-v1",
    services: [
      {
        id: "base",
        active: yes(true),
        priceCents: yes(4000),
        standaloneMinutes: yes(40),
      },
      {
        id: "extra",
        active: yes(true),
        priceCents: yes(7000),
        standaloneMinutes: yes(80),
      },
      {
        id: "additional",
        active: yes(true),
        priceCents: yes(2000),
        standaloneMinutes: yes(30),
      },
    ],
    products: [{ id: "product", active: yes(true), priceCents: yes(1500) }],
    professionals: [
      {
        id: "p1",
        active: yes(true),
        eligibleServiceIds: yes(["base", "extra", "additional"]),
      },
      { id: "p2", active: yes(true), eligibleServiceIds: yes(["base"]) },
    ],
    extraRules: [
      {
        baseServiceId: "base",
        extraServiceId: "extra",
        incrementalMinutes: yes(20),
        priceCents: yes(5000),
      },
    ],
  };
}
const base: BookingCart = { baseServiceId: "base", additions: [] };
const withExtra: BookingCart = {
  ...base,
  additions: [{ kind: "extra", serviceId: "extra" }],
};
const range = (start: number, end: number): MinuteInterval => ({ start, end });
function snapshot(
  working = [range(540, 720)],
  busy: readonly MinuteInterval[] = [],
): AvailabilitySnapshot {
  return {
    revision: "availability-test-v1",
    professionalId: "p1",
    coverage: range(0, 1440),
    working: yes(working),
    busy: yes(busy),
  };
}
const search: SlotSearch = {
  window: range(540, 720),
  notBefore: 540,
  grid: { anchor: 0, stepMinutes: 20 },
};
function value<T>(result: BookingResult<T>): T {
  assert.equal(result.state, "ready", JSON.stringify(result));
  if (result.state !== "ready") throw new Error("Expected ready");
  return result.value;
}
function blocked(result: BookingResult<unknown>, code: string) {
  assert.equal(result.state, "blocked");
  if (result.state === "blocked") assert.equal(result.issue.code, code);
  assert.equal(
    "value" in result,
    false,
    "Blocked result cannot masquerade as zero totals/empty availability",
  );
}
function changeService(
  field: "active" | "priceCents" | "standaloneMinutes",
  fact: BookingFact<number> | BookingFact<boolean>,
): BookingCatalog {
  const data = catalog();
  return {
    ...data,
    services: data.services.map((row) =>
      row.id === "base" ? { ...row, [field]: fact } : row,
    ),
  } as BookingCatalog;
}

test("base 40 + linked extra 20 = 60; product adds price but no time", () => {
  const result = value(
    quoteBooking(
      catalog(),
      {
        ...withExtra,
        additions: [
          ...withExtra.additions,
          { kind: "product", productId: "product", quantity: 2 },
        ],
      },
      "p1",
    ),
  );
  assert.equal(result.totalMinutes, 60);
  assert.equal(result.totalCents, 12000);
  assert.equal(result.currency, "BRL");
  assert.deepEqual(
    result.lines.map((line) => [line.kind, line.minutes, line.priceCents]),
    [
      ["base", 40, 4000],
      ["extra", 20, 5000],
      ["product", 0, 3000],
    ],
  );
});
test("same service as regular additional uses standalone duration and price", () => {
  const result = value(
    priceBookingCart(catalog(), {
      ...base,
      additions: [{ kind: "service", serviceId: "extra" }],
    }),
  );
  assert.equal(result.totalMinutes, 120);
  assert.equal(result.totalCents, 11000);
});
test("regular additional services sum in one continuous appointment", () => {
  const result = value(
    priceBookingCart(catalog(), {
      ...withExtra,
      additions: [
        ...withExtra.additions,
        { kind: "service", serviceId: "additional" },
      ],
    }),
  );
  assert.equal(result.totalMinutes, 90);
  assert.equal(result.totalCents, 11000);
});
test("confirmed zero increment and zero linked price are allowed; standalone is not used", () => {
  const data = catalog();
  const updated = {
    ...data,
    services: data.services.map((row) =>
      row.id === "extra"
        ? { ...row, standaloneMinutes: missing, priceCents: missing }
        : row,
    ),
    extraRules: [
      { ...data.extraRules[0], incrementalMinutes: yes(0), priceCents: yes(0) },
    ],
  };
  assert.equal(value(priceBookingCart(updated, withExtra)).totalMinutes, 40);
  assert.equal(value(priceBookingCart(updated, withExtra)).totalCents, 4000);
});
for (const field of ["active", "priceCents", "standaloneMinutes"] as const) {
  test(`unknown ${field} blocks without zero fallback`, () =>
    blocked(
      priceBookingCart(changeService(field, missing), base),
      "missing-data",
    ));
  test(`estimated ${field} blocks`, () =>
    blocked(
      priceBookingCart(
        changeService(field, {
          state: "estimated",
          value: field === "active" ? true : 40,
        }),
        base,
      ),
      "unconfirmed-data",
    ));
}
test("inactive base, product and professional cannot be booked", () => {
  blocked(
    priceBookingCart(changeService("active", yes(false)), base),
    "inactive",
  );
  const data = catalog();
  blocked(
    priceBookingCart(
      { ...data, products: [{ ...data.products[0], active: yes(false) }] },
      {
        ...base,
        additions: [{ kind: "product", productId: "product", quantity: 1 }],
      },
    ),
    "inactive",
  );
  blocked(
    quoteBooking(
      {
        ...data,
        professionals: [{ ...data.professionals[0], active: yes(false) }],
      },
      base,
      "p1",
    ),
    "inactive",
  );
});
test("zero standalone duration is blocked for base and regular additional", () => {
  blocked(
    priceBookingCart(changeService("standaloneMinutes", yes(0)), base),
    "invalid-number",
  );
  const data = catalog();
  blocked(
    priceBookingCart(
      {
        ...data,
        services: data.services.map((row) =>
          row.id === "extra" ? { ...row, standaloneMinutes: yes(0) } : row,
        ),
      },
      { ...base, additions: [{ kind: "service", serviceId: "extra" }] },
    ),
    "invalid-number",
  );
});
test("missing linked duration or price never falls back to standalone", () => {
  for (const field of ["incrementalMinutes", "priceCents"] as const) {
    const data = catalog();
    blocked(
      priceBookingCart(
        { ...data, extraRules: [{ ...data.extraRules[0], [field]: missing }] },
        withExtra,
      ),
      "missing-data",
    );
  }
});
test("extra relationship must refer to the actual base", () => {
  blocked(
    priceBookingCart(catalog(), {
      baseServiceId: "additional",
      additions: withExtra.additions,
    }),
    "extra-not-linked",
  );
  blocked(
    priceBookingCart({ ...catalog(), extraRules: [] }, withExtra),
    "extra-not-linked",
  );
});
test("duplicates across base, regular service and extra block instead of being silently summed", () => {
  for (const additions of [
    [{ kind: "service", serviceId: "base" }],
    [
      { kind: "extra", serviceId: "extra" },
      { kind: "service", serviceId: "extra" },
    ],
    [
      { kind: "extra", serviceId: "extra" },
      { kind: "extra", serviceId: "extra" },
    ],
    [
      { kind: "product", productId: "product", quantity: 1 },
      { kind: "product", productId: "product", quantity: 2 },
    ],
  ] as BookingCart["additions"][])
    blocked(
      priceBookingCart(catalog(), { ...base, additions }),
      "duplicate-item",
    );
});
test("ambiguous duplicate catalog identities and links block", () => {
  const data = catalog();
  blocked(
    priceBookingCart(
      { ...data, services: [...data.services, data.services[0]] },
      base,
    ),
    "invalid-catalog",
  );
  blocked(
    priceBookingCart(
      { ...data, products: [...data.products, data.products[0]] },
      base,
    ),
    "invalid-catalog",
  );
  blocked(
    priceBookingCart(
      { ...data, extraRules: [...data.extraRules, data.extraRules[0]] },
      base,
    ),
    "invalid-catalog",
  );
  blocked(
    quoteBooking(
      {
        ...data,
        professionals: [...data.professionals, data.professionals[0]],
      },
      base,
      "p1",
    ),
    "invalid-catalog",
  );
});
test("absent base or unknown entities block", () => {
  blocked(
    priceBookingCart(catalog(), { ...base, baseServiceId: "" }),
    "base-required",
  );
  blocked(
    priceBookingCart(catalog(), { ...base, baseServiceId: "absent" }),
    "unknown-service",
  );
  blocked(
    priceBookingCart(catalog(), {
      ...base,
      additions: [{ kind: "product", productId: "absent", quantity: 1 }],
    }),
    "unknown-product",
  );
  blocked(quoteBooking(catalog(), base, "absent"), "professional-required");
});
test("negative, fractional, nonfinite and unsafe configuration/quantity numbers block", () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    blocked(
      priceBookingCart(changeService("standaloneMinutes", yes(invalid)), base),
      "invalid-number",
    );
    blocked(
      priceBookingCart(changeService("priceCents", yes(invalid)), base),
      "invalid-number",
    );
    blocked(
      priceBookingCart(catalog(), {
        ...base,
        additions: [
          { kind: "product", productId: "product", quantity: invalid },
        ],
      }),
      "invalid-quantity",
    );
  }
  blocked(
    priceBookingCart(catalog(), {
      ...base,
      additions: [{ kind: "product", productId: "product", quantity: 0 }],
    }),
    "invalid-quantity",
  );
});
test("integer multiplication and total overflow block", () => {
  blocked(
    priceBookingCart(catalog(), {
      ...base,
      additions: [
        {
          kind: "product",
          productId: "product",
          quantity: Number.MAX_SAFE_INTEGER,
        },
      ],
    }),
    "overflow",
  );
  blocked(
    priceBookingCart(
      changeService("priceCents", yes(Number.MAX_SAFE_INTEGER)),
      withExtra,
    ),
    "overflow",
  );
  blocked(
    priceBookingCart(
      changeService("standaloneMinutes", yes(Number.MAX_SAFE_INTEGER)),
      withExtra,
    ),
    "overflow",
  );
});
test("zero-price service is different from an unknown price", () => {
  assert.equal(
    value(priceBookingCart(changeService("priceCents", yes(0)), base))
      .totalCents,
    0,
  );
});
test("eligibility applies to every service including zero-minute extra", () => {
  const data = catalog();
  assert.equal(quoteBooking(data, base, "p2").state, "ready");
  blocked(quoteBooking(data, withExtra, "p2"), "ineligible-professional");
  blocked(
    quoteBooking(
      {
        ...data,
        extraRules: [{ ...data.extraRules[0], incrementalMinutes: yes(0) }],
      },
      withExtra,
      "p2",
    ),
    "ineligible-professional",
  );
  blocked(
    quoteBooking(
      data,
      { ...base, additions: [{ kind: "service", serviceId: "additional" }] },
      "p2",
    ),
    "ineligible-professional",
  );
  assert.equal(
    quoteBooking(
      data,
      {
        ...base,
        additions: [{ kind: "product", productId: "product", quantity: 1 }],
      },
      "p2",
    ).state,
    "ready",
  );
});
test("confirmed empty eligibility differs from missing and estimated eligibility", () => {
  const data = catalog();
  for (const [eligibility, expected] of [
    [yes([]), "ineligible-professional"],
    [missing, "missing-data"],
    [{ state: "estimated", value: ["base"] }, "unconfirmed-data"],
  ] as const) {
    blocked(
      quoteBooking(
        {
          ...data,
          professionals: [
            { ...data.professionals[0], eligibleServiceIds: eligibility },
          ],
        },
        base,
        "p1",
      ),
      expected,
    );
  }
  assert.deepEqual(
    evaluateProfessionals(data, withExtra).map((row) => row.result.state),
    ["ready", "blocked"],
  );
});
test("adjacent and overlapping working intervals merge; input ordering is irrelevant", () => {
  const result = value(
    findCompatibleSlots(
      "p1",
      60,
      snapshot([range(570, 600), range(540, 580), range(600, 720)]),
      search,
    ),
  );
  assert.deepEqual(result.freeIntervals, [range(540, 720)]);
  assert.deepEqual(
    result.slots.map((slot) => slot.start),
    [540, 560, 580, 600, 620, 640, 660],
  );
  assert.equal(result.slots.at(-1)?.end, 720);
});
test("separated intervals cannot be added to fit a continuous appointment", () => {
  assert.deepEqual(
    value(
      findCompatibleSlots(
        "p1",
        60,
        snapshot([range(540, 570), range(600, 630)]),
        search,
      ),
    ).slots,
    [],
  );
  assert.deepEqual(
    value(
      findCompatibleSlots(
        "p1",
        60,
        snapshot([range(540, 570), range(571, 600)]),
        search,
      ),
    ).slots,
    [],
  );
  assert.equal(
    value(
      findCompatibleSlots(
        "p1",
        60,
        snapshot([range(540, 570), range(570, 600)]),
        search,
      ),
    ).slots.length,
    1,
  );
});
test("busy boundaries are half-open; a booking can end or begin at a conflict boundary", () => {
  const result = value(
    findCompatibleSlots(
      "p1",
      60,
      snapshot(undefined, [range(600, 660)]),
      search,
    ),
  );
  assert.deepEqual(result.slots, [
    { professionalId: "p1", start: 540, end: 600 },
    { professionalId: "p1", start: 660, end: 720 },
  ]);
  assert.deepEqual(
    value(
      findCompatibleSlots(
        "p1",
        61,
        snapshot(undefined, [range(600, 660)]),
        search,
      ),
    ).slots,
    [],
  );
});
test("contained, spanning, adjacent, duplicated and unsorted conflicts subtract their union", () => {
  const result = value(
    findCompatibleSlots(
      "p1",
      20,
      snapshot(undefined, [
        range(610, 640),
        range(600, 620),
        range(640, 660),
        range(600, 620),
        range(500, 540),
        range(720, 800),
      ]),
      search,
    ),
  );
  assert.deepEqual(result.freeIntervals, [range(540, 600), range(660, 720)]);
  assert.deepEqual(
    value(
      findCompatibleSlots(
        "p1",
        20,
        snapshot(undefined, [range(0, 1440)]),
        search,
      ),
    ).slots,
    [],
  );
});
test("confirmed empty working is no slots; missing busy is unavailable, not an empty agenda", () => {
  assert.deepEqual(
    value(findCompatibleSlots("p1", 60, snapshot([]), search)).slots,
    [],
  );
  blocked(
    findCompatibleSlots("p1", 60, { ...snapshot(), busy: missing }, search),
    "missing-data",
  );
  blocked(
    findCompatibleSlots(
      "p1",
      60,
      { ...snapshot(), working: { state: "estimated", value: [] } },
      search,
    ),
    "unconfirmed-data",
  );
});
test("incomplete coverage and another professional cannot provide times", () => {
  blocked(
    findCompatibleSlots(
      "p1",
      60,
      { ...snapshot(), coverage: range(550, 720) },
      search,
    ),
    "incomplete-coverage",
  );
  blocked(
    findCompatibleSlots(
      "p1",
      60,
      { ...snapshot(), coverage: range(540, 719) },
      search,
    ),
    "incomplete-coverage",
  );
  blocked(
    findCompatibleSlots("p2", 60, snapshot(), search),
    "schedule-mismatch",
  );
});
test("window clipping, explicit notBefore and anchored cadence never round down", () => {
  const result = value(
    findCompatibleSlots("p1", 40, snapshot(), {
      window: range(545, 700),
      notBefore: 563,
      grid: { anchor: 5, stepMinutes: 20 },
    }),
  );
  assert.deepEqual(
    result.slots.map((slot) => slot.start),
    [565, 585, 605, 625, 645],
  );
  assert.deepEqual(
    value(
      findCompatibleSlots("p1", 40, snapshot(), { ...search, notBefore: 800 }),
    ).slots,
    [],
  );
});
test("absolute minutes cross day boundaries without local time parsing", () => {
  const result = value(
    findCompatibleSlots(
      "p1",
      60,
      {
        revision: "availability-test-v1",
        professionalId: "p1",
        coverage: range(1380, 1530),
        working: yes([range(1380, 1440), range(1440, 1530)]),
        busy: yes([]),
      },
      {
        window: range(1380, 1530),
        notBefore: 1380,
        grid: { anchor: 0, stepMinutes: 30 },
      },
    ),
  );
  assert.deepEqual(
    result.slots.map((slot) => slot.start),
    [1380, 1410, 1440, 1470],
  );
});
test("anchor after window and negative epoch minutes are deterministic", () => {
  const result = value(
    findCompatibleSlots(
      "p1",
      20,
      {
        revision: "availability-test-v1",
        professionalId: "p1",
        coverage: range(-100, 100),
        working: yes([range(-100, 100)]),
        busy: yes([]),
      },
      {
        window: range(-90, 10),
        notBefore: -85,
        grid: { anchor: 5, stepMinutes: 20 },
      },
    ),
  );
  assert.deepEqual(
    result.slots.map((slot) => slot.start),
    [-75, -55, -35, -15],
  );
});
test("invalid times, intervals, cadence and excessive result sets block without partial slots", () => {
  for (const invalid of [
    range(600, 600),
    range(600, 500),
    range(0.5, 10),
    range(NaN, 10),
    range(0, Infinity),
  ])
    blocked(
      findCompatibleSlots("p1", 20, snapshot([invalid]), search),
      "invalid-interval",
    );
  blocked(findCompatibleSlots("p1", 0, snapshot(), search), "invalid-search");
  blocked(
    findCompatibleSlots("p1", 20, snapshot(), {
      ...search,
      grid: { anchor: 0, stepMinutes: 0 },
    }),
    "invalid-search",
  );
  blocked(
    findCompatibleSlots("p1", 20, snapshot(), {
      ...search,
      grid: { anchor: -1, stepMinutes: Number.MAX_SAFE_INTEGER },
    }),
    "invalid-search",
  );
  blocked(
    findCompatibleSlots(
      "p1",
      1,
      {
        revision: "availability-test-v1",
        professionalId: "p1",
        coverage: range(0, 20000),
        working: yes([range(0, 20000)]),
        busy: yes([]),
      },
      {
        window: range(0, 20000),
        notBefore: 0,
        grid: { anchor: 0, stepMinutes: 1 },
      },
    ),
    "search-limit",
  );
});
test("interval union/subtraction agrees with a minute-by-minute oracle across synthetic schedules", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const working = [
      range(0, 20 + (seed % 8)),
      range(25 + (seed % 5), 60),
      range(15, 30),
    ];
    const busy = [
      range(seed % 20, 20 + (seed % 7)),
      range(35 + (seed % 5), 44 + (seed % 9)),
    ];
    const duration = 1 + (seed % 12);
    const stepMinutes = 1 + (seed % 7);
    const notBefore = seed % 9;
    const expected: number[] = [];
    for (let start = 0; start <= 60 - duration; start++) {
      if (start < notBefore || (start - 3) % stepMinutes !== 0) continue;
      const valid = Array.from(
        { length: duration },
        (_, offset) => start + offset,
      ).every(
        (minute) =>
          working.some((row) => row.start <= minute && minute < row.end) &&
          !busy.some((row) => row.start <= minute && minute < row.end),
      );
      if (valid) expected.push(start);
    }
    const result = value(
      findCompatibleSlots(
        "p1",
        duration,
        {
          revision: "availability-test-v1",
          professionalId: "p1",
          coverage: range(0, 60),
          working: yes(working),
          busy: yes(busy),
        },
        { window: range(0, 60), notBefore, grid: { anchor: 3, stepMinutes } },
      ),
    );
    assert.deepEqual(
      result.slots.map((slot) => slot.start),
      expected,
      `seed ${seed}`,
    );
  }
});
function context(): BookingContext {
  return { catalog: catalog(), snapshot: snapshot(), search };
}
function toTimes(ctx = context()): BookingDraft {
  let state = value(
    transitionBooking(
      emptyBookingDraft(),
      { type: "select-service", serviceId: "base" },
      ctx,
    ),
  );
  state = value(
    transitionBooking(
      state,
      { type: "select-professional", professionalId: "p1" },
      ctx,
    ),
  );
  state = value(
    transitionBooking(
      state,
      { type: "set-items", additions: withExtra.additions },
      ctx,
    ),
  );
  return value(transitionBooking(state, { type: "show-times" }, ctx));
}
test("workflow enforces service → professional → items → times → local review", () => {
  const ctx = context();
  blocked(
    transitionBooking(
      emptyBookingDraft(),
      { type: "select-professional", professionalId: "p1" },
      ctx,
    ),
    "wrong-step",
  );
  blocked(
    transitionBooking(emptyBookingDraft(), { type: "show-times" }, ctx),
    "wrong-step",
  );
  const professional = value(
    transitionBooking(
      emptyBookingDraft(),
      { type: "select-service", serviceId: "base" },
      ctx,
    ),
  );
  blocked(
    transitionBooking(professional, { type: "set-items", additions: [] }, ctx),
    "wrong-step",
  );
  const times = toTimes(ctx);
  blocked(transitionBooking(times, { type: "review" }, ctx), "wrong-step");
  const confirmation = value(
    transitionBooking(times, { type: "select-time", start: 540 }, ctx),
  );
  assert.equal(confirmation.step, "confirmation");
  const reviewed = value(
    transitionBooking(confirmation, { type: "review" }, ctx),
  );
  assert.equal(reviewed.step, "reviewed");
  assert.equal("appointmentId" in reviewed, false);
  blocked(transitionBooking(reviewed, { type: "review" }, ctx), "wrong-step");
});
test("items cannot jump directly to time; unknown availability blocks", () => {
  const ctx = context();
  const items = value(transitionBooking(toTimes(ctx), { type: "back" }, ctx));
  blocked(
    transitionBooking(items, { type: "select-time", start: 540 }, ctx),
    "wrong-step",
  );
  blocked(
    transitionBooking(items, { type: "show-times" }, { catalog: catalog() }),
    "missing-schedule",
  );
  blocked(
    transitionBooking(toTimes(ctx), { type: "select-time", start: 541 }, ctx),
    "unavailable-time",
  );
});
test("changing base/professional clears complements/time; item changes clear time/review", () => {
  const ctx = context();
  const confirmation = value(
    transitionBooking(toTimes(ctx), { type: "select-time", start: 540 }, ctx),
  );
  const changedService = value(
    transitionBooking(
      confirmation,
      { type: "select-service", serviceId: "additional" },
      ctx,
    ),
  );
  assert.equal(changedService.professionalId, null);
  assert.deepEqual(changedService.cart?.additions, []);
  assert.equal(changedService.review, null);
  const changedProfessional = value(
    transitionBooking(
      confirmation,
      { type: "select-professional", professionalId: "p2" },
      ctx,
    ),
  );
  assert.equal(changedProfessional.step, "items");
  assert.deepEqual(changedProfessional.cart?.additions, []);
  assert.equal(changedProfessional.review, null);
  const changedItems = value(
    transitionBooking(confirmation, { type: "set-items", additions: [] }, ctx),
  );
  assert.equal(changedItems.step, "items");
  assert.equal(changedItems.review, null);
});
test("review rechecks current price, duration, eligibility, conflicts and cutoff", () => {
  const ctx = context();
  const confirmation = value(
    transitionBooking(toTimes(ctx), { type: "select-time", start: 540 }, ctx),
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, catalog: changeService("priceCents", yes(4500)) },
    ),
    "stale-review",
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, catalog: changeService("standaloneMinutes", yes(45)) },
    ),
    "stale-review",
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      {
        ...ctx,
        catalog: {
          ...catalog(),
          professionals: [
            { id: "p1", active: yes(true), eligibleServiceIds: missing },
          ],
        },
      },
    ),
    "missing-data",
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, snapshot: snapshot(undefined, [range(550, 560)]) },
    ),
    "stale-review",
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, search: { ...search, notBefore: 541 } },
    ),
    "stale-review",
  );
});
test("Back/Cancel can be repeated safely and never preserve confirmation", () => {
  const ctx = context();
  let draft = value(
    transitionBooking(toTimes(ctx), { type: "select-time", start: 540 }, ctx),
  );
  for (const expected of [
    "times",
    "items",
    "professional",
    "service",
    "service",
  ]) {
    draft = value(transitionBooking(draft, { type: "back" }, ctx));
    assert.equal(draft.step, expected);
    assert.equal(draft.review, null);
  }
  draft = value(transitionBooking(toTimes(ctx), { type: "cancel" }, ctx));
  assert.deepEqual(draft, emptyBookingDraft());
  assert.deepEqual(
    value(transitionBooking(draft, { type: "cancel" }, ctx)),
    emptyBookingDraft(),
  );
});
test("deterministic recalculation does not mutate catalog, cart, availability or draft", () => {
  const data = catalog();
  const availability = snapshot(
    [range(600, 720), range(540, 600)],
    [range(640, 660)],
  );
  const freeze = (input: unknown): void => {
    if (!input || typeof input !== "object") return;
    Object.values(input).forEach(freeze);
    Object.freeze(input);
  };
  freeze({ data, availability, withExtra, search });
  const before = JSON.stringify({ data, availability, withExtra, search });
  const a = planBooking(data, withExtra, "p1", availability, search);
  const b = planBooking(data, withExtra, "p1", availability, search);
  assert.deepEqual(a, b);
  assert.equal(
    JSON.stringify({ data, availability, withExtra, search }),
    before,
  );
  const draft = toTimes();
  freeze(draft);
  const copy = JSON.stringify(draft);
  transitionBooking(draft, { type: "set-items", additions: [] }, context());
  assert.equal(JSON.stringify(draft), copy);
});

test("B01/B03: standalone base duration differs from the linked contribution of the same service", () => {
  assert.equal(value(quoteBooking(catalog(), base, "p1")).totalMinutes, 40);
  const data = catalog();
  const updated = {
    ...data,
    services: data.services.map((row) =>
      row.id === "extra" ? { ...row, standaloneMinutes: yes(50) } : row,
    ),
  };
  assert.equal(
    value(
      quoteBooking(updated, { baseServiceId: "extra", additions: [] }, "p1"),
    ).totalMinutes,
    50,
  );
  assert.equal(value(quoteBooking(updated, withExtra, "p1")).totalMinutes, 60);
});
test("B11/B12: exact conflict boundaries with explicit 30-minute and 1-minute grids", () => {
  const available = snapshot(undefined, [range(600, 660)]);
  assert.deepEqual(
    value(
      findCompatibleSlots("p1", 60, available, {
        ...search,
        grid: { anchor: 540, stepMinutes: 30 },
      }),
    ).slots.map((slot) => slot.start),
    [540, 660],
  );
  const minuteSlots = value(
    findCompatibleSlots("p1", 60, available, {
      ...search,
      grid: { anchor: 0, stepMinutes: 1 },
    }),
  ).slots;
  assert.equal(
    minuteSlots.some((slot) => slot.start === 659),
    false,
  );
  assert.equal(
    minuteSlots.some((slot) => slot.start === 660),
    true,
  );
});
test("B13: one continuous booking cannot cross lunch or the final closing boundary", () => {
  const available = snapshot([range(540, 720), range(780, 1080)]);
  const slots = value(
    findCompatibleSlots("p1", 60, available, {
      window: range(540, 1080),
      notBefore: 540,
      grid: { anchor: 0, stepMinutes: 1 },
    }),
  ).slots;
  for (const [start, expected] of [
    [660, true],
    [690, false],
    [1020, true],
    [1021, false],
  ] as const)
    assert.equal(
      slots.some((slot) => slot.start === start),
      expected,
    );
});
test("B14: base40 fits before 10:50, but adding extra20 invalidates the 10:00 start", () => {
  const available = snapshot(undefined, [range(650, 720)]);
  const before = value(planBooking(catalog(), base, "p1", available, search));
  const after = value(
    planBooking(catalog(), withExtra, "p1", available, search),
  );
  assert.equal(
    before.availability.slots.some((slot) => slot.start === 600),
    true,
  );
  assert.equal(
    after.availability.slots.some((slot) => slot.start === 600),
    false,
  );
});
test("B16: changed snapshot or catalog revision requires a new local review even if values are equal", () => {
  const ctx = context();
  const confirmation = value(
    transitionBooking(toTimes(ctx), { type: "select-time", start: 540 }, ctx),
  );
  assert.equal(confirmation.review?.quote.catalogRevision, "catalog-test-v1");
  assert.equal(confirmation.review?.snapshotRevision, "availability-test-v1");
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, snapshot: { ...snapshot(), revision: "availability-test-v2" } },
    ),
    "stale-review",
  );
  blocked(
    transitionBooking(
      confirmation,
      { type: "review" },
      { ...ctx, catalog: { ...catalog(), revision: "catalog-test-v2" } },
    ),
    "stale-review",
  );
  blocked(
    priceBookingCart({ ...catalog(), revision: "" }, base),
    "missing-revision",
  );
  blocked(
    findCompatibleSlots("p1", 60, { ...snapshot(), revision: "" }, search),
    "missing-revision",
  );
});
test("B17: client and staff callers share the same pure proposal, without persistence claims", () => {
  const outputs = ["client", "staff"].map((channel) => ({
    channel,
    proposal: value(
      planBooking(catalog(), withExtra, "p1", snapshot(), search),
    ),
  }));
  assert.deepEqual(outputs[0].proposal, outputs[1].proposal);
  assert.equal(outputs[0].proposal.quote.totalMinutes, 60);
  assert.equal("bookingId" in outputs[0].proposal, false);
});
