import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectBookingCatalog,
  type BookingCatalogProjectionInput,
  type ProjectionFact,
} from "../src/integration/booking-catalog-projection.ts";
import {
  priceBookingCart,
  quoteBooking,
  type BookingCart,
  type BookingResult,
} from "../src/booking-domain.ts";
import { emptyBookingDraft, transitionBooking } from "../src/booking-flow.ts";
import { createBookingController } from "../src/booking-controller.ts";
import {
  inactiveBookingAdapter,
  type BookingCatalogData,
} from "../src/data/booking-access.ts";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
const revision = "synthetic-catalog-r1";
function confirmed<T>(value: T): ProjectionFact<T> {
  return {
    state: "confirmed",
    value,
    revision,
    source: "synthetic-fixture-v1",
  };
}
function complete<T>(rows: T[]) {
  return {
    coverage: confirmed({ status: "complete" as const, total: rows.length }),
    rows,
  };
}
/** Entire fixture is synthetic and is never imported by an application screen. */
function fixture(): Mutable<BookingCatalogProjectionInput> {
  return {
    contractVersion: 1,
    revision,
    services: complete([
      {
        entity_id: confirmed("hair"),
        version: confirmed(1),
        name: confirmed("Cabelo sintético"),
        active: confirmed(true),
        price_cents: confirmed(4000),
        currency: confirmed("BRL"),
        standalone_duration_minutes: confirmed(40),
      },
      {
        entity_id: confirmed("treatment"),
        version: confirmed(1),
        name: confirmed("Selagem sintética"),
        active: confirmed(true),
        price_cents: confirmed(7000),
        currency: confirmed("BRL"),
        standalone_duration_minutes: confirmed(50),
      },
    ]),
    products: complete([
      {
        entity_id: confirmed("product"),
        version: confirmed(1),
        name: confirmed("Produto sintético"),
        active: confirmed(true),
        sale_price_cents: confirmed(1000),
        currency: confirmed("BRL"),
      },
    ]),
    professionals: complete([
      {
        entity_id: confirmed("person"),
        version: confirmed(1),
        full_name: confirmed("Pessoa sintética"),
        display_name: confirmed(null),
        active: confirmed(true),
      },
    ]),
    eligibility: complete([
      {
        professionalId: confirmed("person"),
        serviceIds: confirmed(["hair", "treatment"]),
      },
    ]),
    extras: complete([
      {
        baseServiceId: confirmed("hair"),
        extraServiceId: confirmed("treatment"),
        incrementalMinutes: confirmed(20),
        priceCents: confirmed(5000),
      },
    ]),
  };
}
function value<T>(result: BookingResult<T>): T {
  assert.equal(result.state, "ready", JSON.stringify(result));
  if (result.state !== "ready") throw new Error("Expected a usable result");
  return result.value;
}
function blocked(result: BookingResult<unknown>, code: string) {
  assert.equal(result.state, "blocked");
  if (result.state === "blocked") assert.equal(result.issue.code, code);
}
const extraCart: BookingCart = {
  baseServiceId: "hair",
  additions: [{ kind: "extra", serviceId: "treatment" }],
};
const baseCart: BookingCart = { baseServiceId: "hair", additions: [] };

test("A02 maps the allowed contract and composes 40+20=60 with linked price", () => {
  const data = value(projectBookingCatalog(fixture(), revision));
  const quote = value(quoteBooking(data.catalog, extraCart, "person"));
  assert.equal(quote.totalMinutes, 60);
  assert.equal(quote.totalCents, 9000);
  assert.equal(quote.catalogRevision, revision);
  assert.deepEqual(data.labels, {
    services: { hair: "Cabelo sintético", treatment: "Selagem sintética" },
    products: { product: "Produto sintético" },
    professionals: { person: "Pessoa sintética" },
  });
  assert.deepEqual(data.timeZone, { state: "missing" });
  assert.deepEqual(data.portraits, {});
});
test("same service standalone uses its own price/duration, products add money only", () => {
  const { catalog } = value(projectBookingCatalog(fixture(), revision));
  const standalone = value(
    quoteBooking(
      catalog,
      { baseServiceId: "treatment", additions: [] },
      "person",
    ),
  );
  assert.equal(standalone.totalMinutes, 50);
  assert.equal(standalone.totalCents, 7000);
  const additional = value(
    quoteBooking(
      catalog,
      { ...baseCart, additions: [{ kind: "service", serviceId: "treatment" }] },
      "person",
    ),
  );
  assert.equal(additional.totalMinutes, 90);
  assert.equal(additional.totalCents, 11000);
  const products = value(
    quoteBooking(
      catalog,
      {
        ...extraCart,
        additions: [
          ...extraCart.additions,
          { kind: "product", productId: "product", quantity: 2 },
        ],
      },
      "person",
    ),
  );
  assert.equal(products.totalMinutes, 60);
  assert.equal(products.totalCents, 11000);
  assert.equal(products.lines.at(-1)?.minutes, 0);
});
test("only explicit confirmed extra zero is usable; zero standalone remains blocked", () => {
  const input = fixture();
  input.extras.rows[0].incrementalMinutes = confirmed(0);
  input.services.rows[1].standalone_duration_minutes = confirmed(0);
  const { catalog } = value(projectBookingCatalog(input, revision));
  assert.equal(
    value(quoteBooking(catalog, extraCart, "person")).totalMinutes,
    40,
  );
  blocked(
    priceBookingCart(catalog, { baseServiceId: "treatment", additions: [] }),
    "invalid-number",
  );
  blocked(
    priceBookingCart(catalog, {
      ...baseCart,
      additions: [{ kind: "service", serviceId: "treatment" }],
    }),
    "invalid-number",
  );
});
for (const state of ["missing", "estimated"] as const) {
  test(`${state} extra zero and standalone facts block affected use without a fallback`, () => {
    const input = fixture();
    input.extras.rows[0].incrementalMinutes =
      state === "missing"
        ? { state }
        : { state, value: 0, revision, source: "synthetic-estimate" };
    const { catalog } = value(projectBookingCatalog(input, revision));
    assert.equal(value(priceBookingCart(catalog, baseCart)).totalMinutes, 40);
    blocked(
      quoteBooking(catalog, extraCart, "person"),
      state === "missing" ? "missing-data" : "unconfirmed-data",
    );
    input.services.rows[0].standalone_duration_minutes =
      state === "missing"
        ? { state }
        : { state, value: 40, revision, source: "synthetic-estimate" };
    blocked(
      priceBookingCart(
        value(projectBookingCatalog(input, revision)).catalog,
        baseCart,
      ),
      state === "missing" ? "missing-data" : "unconfirmed-data",
    );
  });
}
test("unknown standalone price/duration does not erase separately confirmed linked facts", () => {
  const input = fixture();
  input.services.rows[1].standalone_duration_minutes = { state: "missing" };
  input.services.rows[1].price_cents = { state: "missing" };
  const { catalog } = value(projectBookingCatalog(input, revision));
  assert.equal(
    value(quoteBooking(catalog, extraCart, "person")).totalMinutes,
    60,
  );
  blocked(
    priceBookingCart(catalog, { baseServiceId: "treatment", additions: [] }),
    "missing-data",
  );
});
test("missing linked price never borrows the standalone price", () => {
  const input = fixture();
  input.extras.rows[0].priceCents = { state: "missing" };
  blocked(
    quoteBooking(
      value(projectBookingCatalog(input, revision)).catalog,
      extraCart,
      "person",
    ),
    "missing-data",
  );
});
for (const kind of ["services", "products", "professionals"] as const) {
  test(`${kind} null activity stays unknown and false stays inactive`, () => {
    const input = fixture();
    input[kind].rows[0].active = confirmed(null);
    const cart: BookingCart =
      kind === "products"
        ? {
            ...baseCart,
            additions: [{ kind: "product", productId: "product", quantity: 1 }],
          }
        : baseCart;
    blocked(
      quoteBooking(
        value(projectBookingCatalog(input, revision)).catalog,
        cart,
        "person",
      ),
      "missing-data",
    );
    input[kind].rows[0].active = confirmed(false);
    blocked(
      quoteBooking(
        value(projectBookingCatalog(input, revision)).catalog,
        cart,
        "person",
      ),
      "inactive",
    );
  });
}
test("eligibility missing, estimated and confirmed empty are distinct", () => {
  const input = fixture();
  input.eligibility.rows[0].serviceIds = { state: "missing" };
  blocked(
    quoteBooking(
      value(projectBookingCatalog(input, revision)).catalog,
      baseCart,
      "person",
    ),
    "missing-data",
  );
  input.eligibility.rows[0].serviceIds = {
    state: "estimated",
    value: ["hair"],
    revision,
    source: "synthetic-estimate",
  };
  blocked(
    quoteBooking(
      value(projectBookingCatalog(input, revision)).catalog,
      baseCart,
      "person",
    ),
    "unconfirmed-data",
  );
  input.eligibility.rows[0].serviceIds = confirmed([]);
  blocked(
    quoteBooking(
      value(projectBookingCatalog(input, revision)).catalog,
      baseCart,
      "person",
    ),
    "ineligible-professional",
  );
});
for (const kind of [
  "services",
  "products",
  "professionals",
  "extras",
  "eligibility",
] as const) {
  test(`${kind} must have explicit complete coverage and matching count`, () => {
    const input = fixture();
    input[kind].coverage = { state: "missing" };
    blocked(projectBookingCatalog(input, revision), "missing-data");
    input[kind].coverage = confirmed({
      status: "partial",
      total: input[kind].rows.length,
    });
    blocked(projectBookingCatalog(input, revision), "incomplete-catalog");
    input[kind].coverage = confirmed({
      status: "complete",
      total: input[kind].rows.length + 1,
    });
    blocked(projectBookingCatalog(input, revision), "incomplete-catalog");
  });
}
test("absent extras never becomes a confirmed empty relation set", () => {
  const input = fixture();
  delete (input as Partial<BookingCatalogProjectionInput>).extras;
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
});
test("complete empty extras works; labels/categories never create a relation", () => {
  const input = fixture();
  input.extras = complete([]);
  Object.assign(input.services.rows[1], { category: confirmed("Extra") });
  const { catalog } = value(projectBookingCatalog(input, revision));
  assert.deepEqual(catalog.extraRules, []);
  blocked(quoteBooking(catalog, extraCart, "person"), "extra-not-linked");
  assert.equal(value(priceBookingCart(catalog, baseCart)).totalMinutes, 40);
});
test("complete empty catalogs are empty only with complete empty supplements", () => {
  const input = fixture();
  input.services = complete([]);
  input.products = complete([]);
  input.professionals = complete([]);
  input.extras = complete([]);
  input.eligibility = complete([]);
  assert.equal(
    value(projectBookingCatalog(input, revision)).catalog.services.length,
    0,
  );
});
for (const kind of ["services", "products", "professionals"] as const) {
  test(`${kind} duplicate IDs reject the entire projection`, () => {
    const input = fixture();
    const rows = input[kind].rows;
    (rows as unknown[]).push(structuredClone(rows[0]));
    input[kind].coverage = confirmed({
      status: "complete",
      total: rows.length,
    });
    blocked(projectBookingCatalog(input, revision), "duplicate-id");
  });
}
test("duplicate extra pairs, self-link and broken unused relation reject", () => {
  const input = fixture();
  input.extras = complete([
    input.extras.rows[0],
    structuredClone(input.extras.rows[0]),
  ]);
  blocked(projectBookingCatalog(input, revision), "invalid-extra-link");
  input.extras = complete([input.extras.rows[0]]);
  input.extras.rows[0].extraServiceId = confirmed("hair");
  blocked(projectBookingCatalog(input, revision), "invalid-extra-link");
  input.extras.rows[0].extraServiceId = confirmed("nonexistent");
  blocked(projectBookingCatalog(input, revision), "broken-reference");
});
test("eligibility must cover every professional exactly once with valid references", () => {
  const input = fixture();
  input.eligibility = complete([]);
  blocked(projectBookingCatalog(input, revision), "incomplete-catalog");
  input.eligibility = complete([
    { professionalId: confirmed("nonexistent"), serviceIds: confirmed([]) },
  ]);
  blocked(projectBookingCatalog(input, revision), "broken-reference");
  input.eligibility = fixture().eligibility;
  input.eligibility.rows[0].serviceIds = confirmed(["nonexistent"]);
  blocked(projectBookingCatalog(input, revision), "broken-reference");
  input.eligibility.rows[0].serviceIds = confirmed(["hair", "hair"]);
  blocked(projectBookingCatalog(input, revision), "invalid-eligibility");
  input.eligibility = fixture().eligibility;
  input.eligibility = complete([
    input.eligibility.rows[0],
    structuredClone(input.eligibility.rows[0]),
  ]);
  blocked(projectBookingCatalog(input, revision), "duplicate-eligibility");
});
test("expected factual revision is mandatory and is not schema version", () => {
  blocked(
    projectBookingCatalog(fixture(), "different-revision"),
    "projection-revision",
  );
  blocked(projectBookingCatalog(fixture(), ""), "projection-revision");
  const input = fixture();
  input.contractVersion = 2 as 1;
  blocked(
    projectBookingCatalog(input, revision),
    "unsupported-projection-version",
  );
  input.contractVersion = 1;
  input.services.rows[0].version = confirmed(2 as 1);
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
});
test("mismatched revision or missing provenance in any consumed fact rejects", () => {
  const input = fixture();
  input.extras.rows[0].incrementalMinutes = {
    state: "confirmed",
    value: 20,
    revision: "older-revision",
    source: "synthetic-fixture",
  };
  blocked(projectBookingCatalog(input, revision), "projection-revision");
  input.extras = fixture().extras;
  input.services.rows[0].price_cents = {
    state: "confirmed",
    value: 4000,
    revision,
    source: "",
  };
  blocked(projectBookingCatalog(input, revision), "missing-provenance");
  input.services = fixture().services;
  input.products.coverage = {
    state: "confirmed",
    value: { status: "complete", total: 1 },
    revision: "older-revision",
    source: "synthetic-fixture",
  };
  blocked(projectBookingCatalog(input, revision), "projection-revision");
});
test("identity, labels, currency and coverage require confirmation", () => {
  const input = fixture();
  input.services.rows[0].entity_id = { state: "missing" };
  blocked(projectBookingCatalog(input, revision), "missing-data");
  input.services = fixture().services;
  input.services.rows[0].name = {
    state: "estimated",
    value: "Nome sintético",
    revision,
    source: "synthetic-estimate",
  };
  blocked(projectBookingCatalog(input, revision), "unconfirmed-data");
  input.services = fixture().services;
  input.services.rows[0].currency = confirmed("USD" as "BRL");
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
  input.services = fixture().services;
  input.extras.coverage = {
    state: "estimated",
    value: { status: "complete", total: 1 },
    revision,
    source: "synthetic-estimate",
  };
  blocked(projectBookingCatalog(input, revision), "unconfirmed-data");
});
for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid numeric fact ${String(bad)} is blocked before projection`, () => {
    for (const field of [
      "price_cents",
      "standalone_duration_minutes",
    ] as const) {
      const input = fixture();
      input.services.rows[0][field] = confirmed(bad);
      blocked(projectBookingCatalog(input, revision), "invalid-projection");
    }
    const input = fixture();
    input.extras.rows[0].incrementalMinutes = confirmed(bad);
    blocked(projectBookingCatalog(input, revision), "invalid-projection");
  });
}
test("zero prices are preserved; invalid quantity and overflow remain core errors", () => {
  const input = fixture();
  input.services.rows[0].price_cents = confirmed(0);
  let catalog = value(projectBookingCatalog(input, revision)).catalog;
  assert.equal(value(priceBookingCart(catalog, baseCart)).totalCents, 0);
  for (const quantity of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    blocked(
      priceBookingCart(catalog, {
        ...baseCart,
        additions: [{ kind: "product", productId: "product", quantity }],
      }),
      "invalid-quantity",
    );
  }
  input.products.rows[0].sale_price_cents = confirmed(Number.MAX_SAFE_INTEGER);
  catalog = value(projectBookingCatalog(input, revision)).catalog;
  blocked(
    priceBookingCart(catalog, {
      ...baseCart,
      additions: [{ kind: "product", productId: "product", quantity: 2 }],
    }),
    "overflow",
  );
});
test("duplicate cart lines remain rejected through the existing core", () => {
  const { catalog } = value(projectBookingCatalog(fixture(), revision));
  blocked(
    priceBookingCart(catalog, {
      ...extraCart,
      additions: [
        ...extraCart.additions,
        { kind: "service", serviceId: "treatment" },
      ],
    }),
    "duplicate-item",
  );
  blocked(
    priceBookingCart(catalog, {
      ...baseCart,
      additions: [
        { kind: "product", productId: "product", quantity: 1 },
        { kind: "product", productId: "product", quantity: 1 },
      ],
    }),
    "duplicate-item",
  );
});
test("timezone is explicit, missing stays missing, no portrait or schedule is invented", () => {
  const input = fixture();
  input.timeZone = confirmed("UTC");
  assert.deepEqual(value(projectBookingCatalog(input, revision)).timeZone, {
    state: "confirmed",
    value: "UTC",
  });
  input.timeZone = {
    state: "estimated",
    value: "UTC",
    revision,
    source: "synthetic-estimate",
  };
  assert.equal(
    value(projectBookingCatalog(input, revision)).timeZone.state,
    "estimated",
  );
  input.timeZone = confirmed("not/a/timezone");
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
});
test("plain DTO getters and sparse arrays are rejected without evaluating accessors", () => {
  const input = fixture();
  let calls = 0;
  Object.defineProperty(input.services.rows[0], "price_cents", {
    get() {
      calls++;
      return confirmed(1);
    },
  });
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
  assert.equal(calls, 0);
  const sparse = fixture();
  delete (sparse.services.rows as unknown[])[0];
  blocked(projectBookingCatalog(sparse, revision), "invalid-projection");
});
test("coverage uses the captured values instead of rereading a changing object", () => {
  const input = fixture();
  let reads = 0;
  input.extras.coverage = confirmed(
    new Proxy(
      { status: "partial" as const, total: 100 },
      {
        get(target, key) {
          reads++;
          return key === "status"
            ? "complete"
            : key === "total"
              ? 1
              : Reflect.get(target, key);
        },
      },
    ),
  );
  blocked(projectBookingCatalog(input, revision), "incomplete-catalog");
  assert.equal(reads, 0);
});
test("eligibility validates and returns one captured array, including its length", () => {
  const input = fixture();
  let elementReads = 0;
  let propertyReads = 0;
  const changing = new Proxy(["hair"], {
    get(target, key) {
      propertyReads++;
      return Reflect.get(target, key);
    },
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (key === "0" && descriptor)
        return {
          ...descriptor,
          value: ++elementReads === 1 ? "hair" : "nonexistent",
        };
      return descriptor;
    },
  });
  input.eligibility.rows[0].serviceIds = confirmed(changing);
  const output = value(projectBookingCatalog(input, revision));
  assert.deepEqual(output.catalog.professionals[0].eligibleServiceIds, {
    state: "confirmed",
    value: ["hair"],
  });
  assert.equal(elementReads, 1);
  assert.equal(propertyReads, 0);
});
test("source and output eligibility arrays are independent in both directions", () => {
  const input = fixture();
  const output = value(
    projectBookingCatalog(input, revision),
  ) as Mutable<BookingCatalogData>;
  const source = input.eligibility.rows[0].serviceIds;
  const destination = output.catalog.professionals[0].eligibleServiceIds;
  assert.equal(source.state, "confirmed");
  assert.equal(destination.state, "confirmed");
  if (source.state === "missing" || destination.state === "missing")
    throw new Error("Expected known eligibility");
  source.value.push("source-only");
  assert.deepEqual(destination.value, ["hair", "treatment"]);
  destination.value.push("output-only");
  assert.deepEqual(source.value, ["hair", "treatment", "source-only"]);
});
test("output strips provenance/private fields and has no mutable aliases", () => {
  const input = fixture();
  Object.assign(input, {
    token: "SYNTHETIC_PRIVATE_SENTINEL",
    contacts: ["SYNTHETIC_PRIVATE_SENTINEL"],
  });
  Object.assign(input.professionals.rows[0], {
    commission: "SYNTHETIC_PRIVATE_SENTINEL",
    authUserId: "SYNTHETIC_PRIVATE_SENTINEL",
    photo: "/unverified.jpg",
  });
  Object.assign(input.services.rows[0], {
    rawManifest: "SYNTHETIC_PRIVATE_SENTINEL",
  });
  const before = JSON.stringify(input);
  const output = value(projectBookingCatalog(input, revision));
  assert.equal(JSON.stringify(input), before);
  assert.doesNotMatch(
    JSON.stringify(output),
    /SYNTHETIC_PRIVATE_SENTINEL|synthetic-fixture-v1|unverified.jpg/,
  );
  assert.deepEqual(Object.keys(output).sort(), [
    "catalog",
    "labels",
    "portraits",
    "timeZone",
  ]);
  input.eligibility.rows[0].serviceIds = confirmed([]);
  input.services.rows[0].price_cents = confirmed(1);
  assert.equal(
    value(quoteBooking(output.catalog, extraCart, "person")).totalCents,
    9000,
  );
  const mutableOutput = output as Mutable<typeof output>;
  if (
    mutableOutput.catalog.professionals[0].eligibleServiceIds.state !==
    "missing"
  )
    mutableOutput.catalog.professionals[0].eligibleServiceIds.value.push("new");
  assert.deepEqual(input.eligibility.rows[0].serviceIds, confirmed([]));
});
test("deterministic projection accepts frozen input and labels cannot alter prototypes", () => {
  const input = fixture();
  input.products.rows[0].entity_id = confirmed("__proto__");
  function freeze(raw: unknown): void {
    if (raw && typeof raw === "object") {
      Object.values(raw).forEach(freeze);
      Object.freeze(raw);
    }
  }
  freeze(input);
  const output = value(projectBookingCatalog(input, revision));
  assert.deepEqual(output, value(projectBookingCatalog(input, revision)));
  assert.equal(Object.hasOwn(output.labels.products, "__proto__"), true);
  assert.equal(Object.getPrototypeOf(output.labels.products), Object.prototype);
});
test("changed revision recalculates facts; availability remains explicitly missing", () => {
  const first = value(projectBookingCatalog(fixture(), revision));
  let draft = value(
    transitionBooking(
      emptyBookingDraft(),
      { type: "select-service", serviceId: "hair" },
      first,
    ),
  );
  draft = value(
    transitionBooking(
      draft,
      { type: "select-professional", professionalId: "person" },
      first,
    ),
  );
  draft = value(
    transitionBooking(
      draft,
      { type: "set-items", additions: extraCart.additions },
      first,
    ),
  );
  blocked(
    transitionBooking(draft, { type: "show-times" }, first),
    "missing-schedule",
  );
  const updated = JSON.parse(
    JSON.stringify(fixture()).replaceAll(revision, "synthetic-catalog-r2"),
  ) as Mutable<BookingCatalogProjectionInput>;
  updated.extras.rows[0].incrementalMinutes = {
    state: "confirmed",
    value: 30,
    revision: "synthetic-catalog-r2",
    source: "synthetic-change",
  };
  const next = value(projectBookingCatalog(updated, "synthetic-catalog-r2"));
  assert.equal(
    value(quoteBooking(next.catalog, extraCart, "person")).totalMinutes,
    70,
  );
  assert.equal(
    value(quoteBooking(first.catalog, extraCart, "person")).totalMinutes,
    60,
  );
  blocked(projectBookingCatalog(updated, revision), "projection-revision");
});
test("labels respect the existing controller limit without silently truncating", () => {
  const input = fixture();
  input.services.rows[0].name = confirmed("a".repeat(160));
  assert.equal(
    value(projectBookingCatalog(input, revision)).labels.services.hair.length,
    160,
  );
  input.services.rows[0].name = confirmed("a".repeat(161));
  blocked(projectBookingCatalog(input, revision), "invalid-projection");
});
test("compatible with existing controller while the real adapter stays unavailable", async () => {
  const data = value(projectBookingCatalog(fixture(), revision));
  let availabilityCalls = 0;
  const controller = createBookingController(
    {
      async readCatalog() {
        return { state: "ready", data };
      },
      async readAvailability() {
        availabilityCalls++;
        return { state: "unavailable" };
      },
    },
    () => 0,
  );
  await controller.loadCatalog();
  controller.chooseService("hair");
  controller.chooseProfessional("person");
  controller.setItems(extraCart.additions);
  controller.openTimes();
  await controller.loadTimes("2026-11-01");
  assert.equal(availabilityCalls, 0); // Missing timezone cannot become UTC.
  assert.equal(controller.snapshot().plan, null);
  assert.equal(controller.snapshot().draft.review, null);
  assert.deepEqual(
    await inactiveBookingAdapter.readCatalog(new AbortController().signal),
    { state: "unavailable" },
  );
  assert.equal("confirm" in inactiveBookingAdapter, false);
  controller.dispose();
});
