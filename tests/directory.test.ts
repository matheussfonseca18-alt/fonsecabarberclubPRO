import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdminState } from "../src/admin-ui.ts";
import { demoClients, demoProfessionals } from "../src/demo-directory.ts";
import { filterDirectory, peopleDetail } from "../src/people-view.ts";
import { filterStock, directoryDetail } from "../src/stock-view.ts";

const state: AdminState = {
  tab: "",
  subtab: "",
  query: "",
  status: "Todos",
  from: "2026-10-01",
  to: "2026-10-31",
  professional: "Todos",
  client: "Todos",
  service: "Todos",
  type: "Todos",
  plan: "Todos",
  page: 1,
  pageSize: 5,
};

test("directory search intersects status without changing identity or treating missing contacts as real", () => {
  const inactive = filterDirectory(demoClients, {
    ...state,
    status: "Inativos",
    query: "henrique",
  });
  assert.deepEqual(
    inactive.map((person) => person.id),
    ["client-7"],
  );
  assert.equal(
    filterDirectory(demoClients, {
      ...state,
      status: "Ativos",
      query: "henrique",
    }).length,
    0,
  );
  assert.equal(
    filterDirectory(demoProfessionals, { ...state, status: "Inativos" }).length,
    0,
  );
  const accents = filterDirectory(demoClients, { ...state, query: "andre" });
  assert.equal(accents[0]?.id, "client-0");
  assert.equal(accents[0]?.phone, "Não informado");
  assert.ok(accents[0]?.email.endsWith("@example.test"));
  assert.ok(
    peopleDetail(`directory:${inactive[0].id}`)?.includes("Henrique Rocha"),
  );
  assert.equal(peopleDetail("directory:missing"), undefined);
});

test("stock filtering combines category and query while details preserve unknown commission and consumption", () => {
  const rows = filterStock({ ...state, query: "oleo", type: "Barba" });
  assert.deepEqual(
    rows.map((product) => product.id),
    ["product-1"],
  );
  assert.equal(
    filterStock({ ...state, query: "oleo", type: "Finalização" }).length,
    0,
  );
  assert.equal(filterStock({ ...state, status: "Estoque zerado" }).length, 0);
  const detail = directoryDetail(`stock:${rows[0].id}`);
  assert.ok(detail?.includes("Não definida"));
  assert.ok(detail?.includes("Não definido"));
  assert.ok(detail?.includes("desconhecidos não equivalem a zero"));
  assert.equal(directoryDetail("stock:missing"), undefined);
});
