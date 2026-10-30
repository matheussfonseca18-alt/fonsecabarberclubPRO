import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBookingController,
  bookingScreen,
  validBookingDate,
} from "../src/booking-controller.ts";
import { renderBooking, safeBookingPortrait } from "../src/booking-view.ts";
import {
  inactiveBookingAdapter,
  type BookingAvailabilityData,
  type BookingCatalogData,
  type BookingDataAdapter,
  type BookingRead,
} from "../src/data/booking-access.ts";
import type { BookingFact } from "../src/booking-domain.ts";
import { bookingNotBeforeMinute } from "../src/booking-clock.ts";

// Tests only: fixtures are never imported by a production/development screen.
const confirmed = <T>(value: T): BookingFact<T> => ({
  state: "confirmed",
  value,
});
const date = "2026-11-01";
const at = (hour: number) =>
  Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`) / 60000;
function data(): BookingCatalogData {
  return {
    catalog: {
      revision: "c1",
      services: [
        {
          id: "base",
          active: confirmed(true),
          priceCents: confirmed(4000),
          standaloneMinutes: confirmed(40),
        },
        {
          id: "extra",
          active: confirmed(true),
          priceCents: confirmed(7000),
          standaloneMinutes: confirmed(50),
        },
      ],
      products: [
        { id: "product", active: confirmed(true), priceCents: confirmed(1000) },
      ],
      professionals: [
        {
          id: "p1",
          active: confirmed(true),
          eligibleServiceIds: confirmed(["base", "extra"]),
        },
        {
          id: "p2",
          active: confirmed(true),
          eligibleServiceIds: confirmed(["base", "extra"]),
        },
      ],
      extraRules: [
        {
          baseServiceId: "base",
          extraServiceId: "extra",
          incrementalMinutes: confirmed(20),
          priceCents: confirmed(5000),
        },
      ],
    },
    labels: {
      services: { base: "Serviço sintético", extra: "Extra sintético" },
      professionals: { p1: "Pessoa sintética A", p2: "Pessoa sintética B" },
      products: { product: "Produto sintético" },
    },
    portraits: {},
    timeZone: confirmed("UTC"),
  };
}
function schedule(professionalId = "p1"): BookingAvailabilityData {
  return {
    date,
    timeZone: "UTC",
    snapshot: {
      revision: "s1",
      professionalId,
      coverage: { start: at(0), end: at(23) + 60 },
      working: confirmed([{ start: at(9), end: at(12) }]),
      busy: confirmed([]),
    },
    search: {
      window: { start: at(0), end: at(23) + 60 },
      notBefore: at(8),
      grid: { anchor: at(0), stepMinutes: 20 },
    },
  };
}
function adapter(catalog = data()): BookingDataAdapter {
  return {
    async readCatalog() {
      return { state: "ready", data: catalog };
    },
    async readAvailability(request) {
      return { state: "ready", data: schedule(request.professionalId) };
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
async function items(port = adapter()) {
  const controller = createBookingController(port, () => at(8));
  await controller.loadCatalog();
  controller.chooseService("base");
  controller.chooseProfessional("p1");
  return controller;
}
test("inactive adapter never reads demo data or offers a confirmation/write method", async () => {
  const c = createBookingController(inactiveBookingAdapter, () => at(8));
  await c.loadCatalog();
  assert.equal(c.snapshot().catalog.state, "unavailable");
  const html = renderBooking(c.snapshot());
  assert.match(html, /dados confirmados/);
  assert.doesNotMatch(html, /Serviço sintético|data-booking-service=/);
  assert.deepEqual(Object.keys(inactiveBookingAdapter).sort(), [
    "readAvailability",
    "readCatalog",
  ]);
  c.confirm();
  assert.match(c.snapshot().notice!.text, /Nenhum agendamento foi gravado/);
});
test("controller and view follow service → professional → items → times → review, without saved success", async () => {
  const c = createBookingController(adapter(), () => at(8));
  await c.loadCatalog();
  assert.match(renderBooking(c.snapshot()), /data-booking-service="base"/);
  c.chooseService("base");
  assert.equal(bookingScreen(c.snapshot()), "professional");
  assert.match(renderBooking(c.snapshot()), /Foto não disponível/);
  c.chooseProfessional("p1");
  c.setItems([
    { kind: "extra", serviceId: "extra" },
    { kind: "product", productId: "product", quantity: 2 },
  ]);
  assert.match(renderBooking(c.snapshot()), /60 min/);
  assert.match(renderBooking(c.snapshot()), /20 min adicionais/);
  c.openTimes();
  assert.equal(bookingScreen(c.snapshot()), "times");
  await c.loadTimes(date);
  assert.equal(c.snapshot().plan?.quote.totalCents, 11000);
  c.chooseTime(at(9));
  assert.equal(bookingScreen(c.snapshot()), "confirmation");
  const html = renderBooking(c.snapshot());
  assert.match(html, /RASCUNHO · NÃO RESERVADO/);
  assert.match(html, /01\/11\/2026/);
  assert.match(
    html,
    /data-booking-confirm disabled aria-describedby="booking-confirm-help"/,
  );
  assert.doesNotMatch(html, /reserva confirmada|bookingId|appointmentId/i);
  c.confirm();
  assert.equal(c.snapshot().draft.step, "confirmation");
  assert.match(c.snapshot().notice!.text, /indisponível/);
});
test("extra vs regular service uses different displayed price/duration; products affect only subtotal", async () => {
  const c = await items();
  c.setItems([{ kind: "service", serviceId: "extra" }]);
  assert.match(renderBooking(c.snapshot()), /90 min/);
  assert.match(renderBooking(c.snapshot()), /50 min avulsos/);
  c.setItems([{ kind: "extra", serviceId: "extra" }]);
  assert.match(renderBooking(c.snapshot()), /60 min/);
  c.setItems([
    { kind: "extra", serviceId: "extra" },
    { kind: "product", productId: "product", quantity: 3 },
  ]);
  assert.match(renderBooking(c.snapshot()), /60 min/);
  assert.match(renderBooking(c.snapshot()), /Produto · sem tempo adicional/);
});
test("missing eligibility and estimated durations visibly block choices without default true/zero", async () => {
  const source = data();
  source.catalog.services[1].standaloneMinutes = {
    state: "estimated",
    value: 50,
  };
  source.catalog.professionals[0].eligibleServiceIds = { state: "missing" };
  const c = createBookingController(adapter(source), () => at(8));
  await c.loadCatalog();
  assert.match(
    renderBooking(c.snapshot()),
    /data-booking-service="extra" disabled/,
  );
  c.chooseService("base");
  assert.match(
    renderBooking(c.snapshot()),
    /data-booking-professional="p1" disabled/,
  );
  c.chooseProfessional("p1");
  assert.equal(c.snapshot().draft.step, "professional");
  assert.match(c.snapshot().notice!.text, /Informação não disponível/);
});
test("catalog failure/forbidden/signed-out are distinct and never echo raw errors", async () => {
  for (const state of [
    "unavailable",
    "forbidden",
    "signed-out",
    "error",
  ] as const) {
    const c = createBookingController(
      {
        ...adapter(),
        async readCatalog() {
          return { state };
        },
      },
      () => at(8),
    );
    await c.loadCatalog();
    assert.equal(c.snapshot().catalog.state, state);
    assert.doesNotMatch(renderBooking(c.snapshot()), /data-booking-service=/);
  }
  const c = createBookingController(
    {
      ...adapter(),
      async readCatalog() {
        throw new Error("SECRET_SENTINEL");
      },
    },
    () => at(8),
  );
  await c.loadCatalog();
  assert.doesNotMatch(renderBooking(c.snapshot()), /SECRET_SENTINEL/);
});
test("malformed catalog structure fails closed and valid catalog is detached from adapter objects", async () => {
  const c = createBookingController(
    adapter({ catalog: null } as unknown as BookingCatalogData),
    () => at(8),
  );
  await c.loadCatalog();
  assert.equal(c.snapshot().catalog.state, "error");
  const source = data();
  const valid = await items(adapter(source));
  source.labels.services.base = "CHANGED";
  assert.doesNotMatch(renderBooking(valid.snapshot()), /CHANGED/);
});
test("cancel during catalog read prevents late data resurrection, including repeated cancel", async () => {
  const pending = deferred<BookingRead<BookingCatalogData>>();
  let signal: AbortSignal | undefined;
  const c = createBookingController(
    {
      ...adapter(),
      readCatalog(input) {
        signal = input;
        return pending.promise;
      },
    },
    () => at(8),
  );
  const task = c.loadCatalog();
  c.cancel();
  c.cancel();
  assert.equal(signal?.aborted, true);
  pending.resolve({ state: "ready", data: data() });
  await task;
  assert.equal(c.snapshot().catalog.state, "idle");
  assert.equal(c.snapshot().draft.cart, null);
});
test("late availability A cannot replace B after Back and professional reselection", async () => {
  const pending = deferred<BookingRead<BookingAvailabilityData>>();
  let count = 0;
  const c = await items({
    ...adapter(),
    async readAvailability(request) {
      count++;
      return count === 1
        ? pending.promise
        : { state: "ready", data: schedule(request.professionalId) };
    },
  });
  c.openTimes();
  const a = c.loadTimes(date);
  c.back();
  c.chooseProfessional("p2");
  c.openTimes();
  await c.loadTimes(date);
  pending.resolve({ state: "ready", data: schedule("p1") });
  await a;
  assert.equal(c.snapshot().plan?.quote.professionalId, "p2");
  assert.equal(c.snapshot().draft.professionalId, "p2");
});
test("interrupt/dispose during availability prevents resurrection and clears private data on dispose", async () => {
  for (const action of ["interrupt", "dispose"] as const) {
    const pending = deferred<BookingRead<BookingAvailabilityData>>();
    const c = await items({
      ...adapter(),
      readAvailability() {
        return pending.promise;
      },
    });
    c.openTimes();
    const task = c.loadTimes(date);
    c[action]();
    pending.resolve({ state: "ready", data: schedule() });
    await task;
    assert.equal(c.snapshot().plan, null);
    assert.notEqual(c.snapshot().availability.state, "ready");
    if (action === "dispose") assert.equal(c.snapshot().catalog.state, "idle");
  }
});
test("new date clears old options before submit; late old response remains ignored", async () => {
  const c = await items();
  c.openTimes();
  await c.loadTimes(date);
  assert.ok(c.snapshot().plan?.availability.slots.length);
  c.setDate("2026-11-02");
  assert.equal(c.snapshot().plan, null);
  assert.equal(c.snapshot().availability.state, "idle");
  c.chooseTime(at(9));
  assert.equal(c.snapshot().draft.review, null);
});
test("failed refresh cannot retain a previous successful plan", async () => {
  let failed = false;
  const c = await items({
    ...adapter(),
    async readAvailability() {
      return failed
        ? { state: "forbidden" }
        : { state: "ready", data: schedule() };
    },
  });
  c.openTimes();
  await c.loadTimes(date);
  failed = true;
  await c.loadTimes(date);
  assert.equal(c.snapshot().availability.state, "forbidden");
  assert.equal(c.snapshot().plan, null);
  assert.doesNotMatch(renderBooking(c.snapshot()), /data-booking-slot=/);
});
test("confirmed empty availability differs from missing intervals and wrong-day empty response", async () => {
  const empty = schedule();
  empty.snapshot.working = confirmed([]);
  const c = await items({
    ...adapter(),
    async readAvailability() {
      return { state: "ready", data: empty };
    },
  });
  c.openTimes();
  await c.loadTimes(date);
  assert.match(
    renderBooking(c.snapshot()),
    /Nenhum horário compatível nesta consulta/,
  );
  const unknown = schedule();
  unknown.snapshot.busy = { state: "missing" };
  const u = await items({
    ...adapter(),
    async readAvailability() {
      return { state: "ready", data: unknown };
    },
  });
  u.openTimes();
  await u.loadTimes(date);
  assert.equal(u.snapshot().availability.state, "error");
  assert.doesNotMatch(
    renderBooking(u.snapshot()),
    /Nenhum horário compatível nesta consulta/,
  );
  const wrong = schedule();
  wrong.search.window = { start: at(0) + 1440, end: at(0) + 2880 };
  wrong.snapshot.working = confirmed([]);
  const w = await items({
    ...adapter(),
    async readAvailability() {
      return { state: "ready", data: wrong };
    },
  });
  w.openTimes();
  await w.loadTimes(date);
  assert.equal(w.snapshot().availability.state, "error");
});
test("date, timezone and professional envelope mismatch block options", async () => {
  assert.equal(validBookingDate("2026-02-30"), false);
  assert.equal(validBookingDate("2028-02-29"), true);
  for (const changed of [
    { ...schedule(), date: "2026-11-02" },
    { ...schedule(), timeZone: "America/Sao_Paulo" },
    schedule("p2"),
  ]) {
    const c = await items({
      ...adapter(),
      async readAvailability() {
        return { state: "ready", data: changed };
      },
    });
    c.openTimes();
    await c.loadTimes(date);
    assert.equal(c.snapshot().availability.state, "error");
  }
  const source = data();
  source.timeZone = { state: "missing" };
  const c = await items(adapter(source));
  c.openTimes();
  await c.loadTimes(date);
  assert.match(c.snapshot().notice!.text, /fuso/);
  assert.equal(c.snapshot().plan, null);
});
test("clock advancement rechecks previously offered start before review", async () => {
  let now = at(8);
  const c = createBookingController(adapter(), () => now);
  await c.loadCatalog();
  c.chooseService("base");
  c.chooseProfessional("p1");
  c.openTimes();
  await c.loadTimes(date);
  now = at(9) + 1;
  c.chooseTime(at(9));
  assert.equal(c.snapshot().draft.review, null);
  assert.equal(c.snapshot().plan, null);
  assert.match(c.snapshot().notice!.text, /horário/);
});

test("page clock conversion permits exact start, rejects +1ms/+30s and keeps future slots", async () => {
  for (const delta of [0, 1, 30000]) {
    let nowMs = at(8) * 60000;
    const c = createBookingController(adapter(), () =>
      bookingNotBeforeMinute(nowMs),
    );
    await c.loadCatalog();
    c.chooseService("base");
    c.chooseProfessional("p1");
    c.openTimes();
    await c.loadTimes(date);
    nowMs = at(10) * 60000 + delta;
    assert.equal(bookingNotBeforeMinute(nowMs), at(10) + (delta ? 1 : 0));
    c.chooseTime(at(10));
    assert.equal(Boolean(c.snapshot().draft.review), delta === 0);
    if (delta === 0) c.back();
    await c.loadTimes(date);
    c.chooseTime(at(10) + 20);
    assert.equal(c.snapshot().draft.review?.slot.start, at(10) + 20);
  }
  assert.ok(Number.isNaN(bookingNotBeforeMinute(NaN)));
  assert.ok(Number.isNaN(bookingNotBeforeMinute(Infinity)));
});

test("invalid item edit from times blocks all downstream API paths until explicit recovery", async () => {
  let reads = 0;
  const c = await items({
    ...adapter(),
    async readAvailability() {
      reads++;
      return { state: "ready", data: schedule() };
    },
  });
  for (const recovery of ["restore", "correct"] as const) {
    c.openTimes();
    c.setItems([{ kind: "product", productId: "product", quantity: 0 }]);
    const issue = c.snapshot().notice;
    assert.equal(bookingScreen(c.snapshot()), "items");
    assert.equal(c.snapshot().choosingTime, false);
    const priorReads = reads;
    await c.loadTimes(date);
    c.chooseTime(at(9));
    assert.equal(reads, priorReads);
    assert.equal(c.snapshot().notice, issue);
    assert.equal(c.snapshot().plan, null);
    assert.equal(c.snapshot().draft.review, null);
    if (recovery === "restore") c.restoreItems();
    else c.setItems([{ kind: "product", productId: "product", quantity: 2 }]);
    c.openTimes();
    await c.loadTimes(date);
    c.chooseTime(at(9));
    assert.equal(c.snapshot().draft.step, "confirmation");
    c.back();
    c.back();
  }
});

test("invalid items abort an in-flight schedule and cannot revive review from its late response", async () => {
  const pending = deferred<BookingRead<BookingAvailabilityData>>();
  const c = await items({
    ...adapter(),
    readAvailability() {
      return pending.promise;
    },
  });
  c.openTimes();
  const request = c.loadTimes(date);
  c.setItems([{ kind: "product", productId: "product", quantity: 0 }]);
  pending.resolve({ state: "ready", data: schedule() });
  await request;
  c.chooseTime(at(9));
  assert.equal(c.snapshot().itemsBlocked, true);
  assert.equal(bookingScreen(c.snapshot()), "items");
  assert.equal(c.snapshot().plan, null);
  assert.equal(c.snapshot().draft.review, null);
});
test("Back/reselection/cancel clear review and repeated cycles do not create bookings", async () => {
  const c = await items();
  c.setItems([{ kind: "extra", serviceId: "extra" }]);
  c.openTimes();
  await c.loadTimes(date);
  c.chooseTime(at(9));
  c.back();
  assert.equal(c.snapshot().draft.review, null);
  assert.equal(bookingScreen(c.snapshot()), "times");
  c.back();
  assert.equal(bookingScreen(c.snapshot()), "items");
  c.back();
  assert.equal(bookingScreen(c.snapshot()), "professional");
  c.chooseProfessional("p2");
  assert.deepEqual(c.snapshot().draft.cart?.additions, []);
  c.chooseService("extra");
  assert.equal(c.snapshot().draft.professionalId, null);
  c.cancel();
  c.cancel();
  assert.equal(bookingScreen(c.snapshot()), "service");
  assert.equal(c.snapshot().draft.cart, null);
});
test("invalid item edits keep an error without advancing or offering stale times", async () => {
  const c = await items();
  c.setItems([
    { kind: "extra", serviceId: "extra" },
    { kind: "service", serviceId: "extra" },
  ]);
  assert.equal(bookingScreen(c.snapshot()), "items");
  assert.match(c.snapshot().notice!.text, /mais de uma linha/);
  assert.equal(c.snapshot().plan, null);
});
test("pagehide-style interruption clears catalog, choices, times and review", async () => {
  const c = await items();
  c.openTimes();
  await c.loadTimes(date);
  c.chooseTime(at(9));
  c.interrupt(true);
  assert.equal(c.snapshot().catalog.state, "idle");
  assert.equal(c.snapshot().draft.cart, null);
  assert.equal(c.snapshot().draft.review, null);
});

test("invalid quantity blur cannot advance with the old cart; a corrected edit can", async () => {
  const c = await items();
  c.setItems([{ kind: "product", productId: "product", quantity: 1 }]);
  for (const quantity of [0, -1, 1.5, NaN]) {
    c.setItems([{ kind: "product", productId: "product", quantity }]);
    const error = c.snapshot().notice;
    c.openTimes();
    assert.equal(bookingScreen(c.snapshot()), "items");
    assert.equal(c.snapshot().itemsBlocked, true);
    assert.equal(c.snapshot().notice, error);
    assert.match(renderBooking(c.snapshot()), /data-booking-next disabled/);
  }
  assert.match(renderBooking(c.snapshot()), /data-booking-restore/);
  c.restoreItems();
  assert.equal(c.snapshot().itemsBlocked, false);
  assert.equal(c.snapshot().notice, null);
  assert.deepEqual(c.snapshot().draft.cart?.additions, [
    { kind: "product", productId: "product", quantity: 1 },
  ]);
  c.openTimes();
  assert.equal(bookingScreen(c.snapshot()), "times");
  c.back();
  c.setItems([{ kind: "product", productId: "product", quantity: 3 }]);
  c.openTimes();
  assert.equal(bookingScreen(c.snapshot()), "times");
  await c.loadTimes(date);
  assert.equal(c.snapshot().plan?.quote.totalCents, 7000);
});
test("rendered controls have labels, focus targets, status/error semantics and disabled final action", async () => {
  const c = await items();
  let html = renderBooking(c.snapshot());
  assert.match(html, /aria-current="step"/);
  assert.match(html, /id="booking-step-title" tabindex="-1"/);
  assert.match(html, /<legend>/);
  assert.match(html, /id="booking-next" data-booking-next/);
  assert.match(html, /id="booking-cancel" data-booking-cancel/);
  c.openTimes();
  html = renderBooking(c.snapshot());
  assert.match(html, /label for="booking-date"/);
  assert.match(html, /aria-describedby="booking-zone"/);
  assert.match(html, /id="booking-search" type="submit"/);
  await c.loadTimes("invalid");
  assert.match(renderBooking(c.snapshot()), /role="alert"/);
});
test("untrusted presentation strings are escaped and portraits need confirmed same-origin assets", async () => {
  const source = data();
  source.labels.services.base = '<img src=x onerror="bad">';
  source.portraits.p1 = confirmed("https://external.invalid/photo.jpg");
  const c = createBookingController(adapter(source), () => at(8));
  await c.loadCatalog();
  assert.match(renderBooking(c.snapshot()), /&lt;img/);
  assert.doesNotMatch(renderBooking(c.snapshot()), /<img src=x/);
  c.chooseService("base");
  assert.doesNotMatch(renderBooking(c.snapshot()), /src="https/);
  assert.match(renderBooking(c.snapshot()), /Foto não disponível/);
  for (const url of [
    "//external/photo.jpg",
    "javascript:alert(1)",
    "data:image/png,abc",
    "/../secret.jpg",
    '/image.jpg" onerror="bad',
  ])
    assert.equal(safeBookingPortrait(confirmed(url)), null);
  assert.equal(
    safeBookingPortrait({ state: "estimated", value: "/portrait.jpg" }),
    null,
  );
  assert.equal(
    safeBookingPortrait(confirmed("/approved/portrait.webp")),
    "/approved/portrait.webp",
  );
});
