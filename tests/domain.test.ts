import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, overlaps } from "../src/domain.ts";
test("clientes são distintos através de meses e profissionais", () => {
  const rows = [
    {
      id: "1",
      client: "a",
      professional: "p",
      date: "2026-09-30",
      cents: 100,
      commissionCents: 40,
    },
    {
      id: "2",
      client: "a",
      professional: "q",
      date: "2026-10-01",
      cents: 200,
      commissionCents: 80,
    },
  ];
  assert.deepEqual(aggregate(rows, "2026-09-01", "2026-10-31"), {
    revenue: 300,
    commission: 120,
    clients: 1,
    count: 2,
  });
  assert.equal(aggregate(rows, "2026-10-01", "2026-10-31", "p").revenue, 0);
  assert.equal(aggregate(rows, "2026-09-01", "2026-10-31", "q").revenue, 200);
});
test("intervalos contíguos são permitidos; sobreposição no mesmo profissional é bloqueada", () => {
  const a = {
    id: "1",
    client: "a",
    professional: "p",
    date: "2026-10-28",
    time: "10:00",
    duration: 45,
    status: "Agendado",
    cents: 100,
    service: "Corte",
  };
  assert.equal(overlaps(a, { ...a, time: "10:30" }), true);
  assert.equal(overlaps(a, { ...a, time: "10:45" }), false);
  assert.equal(overlaps(a, { ...a, professional: "q" }), false);
  assert.equal(overlaps(a, { ...a, date: "2026-10-29" }), false);
});
