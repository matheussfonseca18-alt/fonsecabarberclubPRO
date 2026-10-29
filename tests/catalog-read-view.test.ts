import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  CatalogReadResult,
  ProfessionalCatalogRow,
  ServiceCatalogRow,
  ProductCatalogRow,
} from "../src/data/catalog-read.ts";
import {
  defaultCatalogReadFilters,
  renderCatalogRead,
  renderCatalogReadDetail,
} from "../src/catalog-read-view.ts";

// Entirely generic synthetic records; never imports the validation catalog.
const id = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const professionals: ProfessionalCatalogRow[] = Array.from(
  { length: 12 },
  (_, index) => ({
    entity_id: id(index + 1),
    version: 1,
    full_name: `Profissional de teste ${String(index + 1).padStart(2, "0")}`,
    display_name: index === 0 ? "Ação exemplo" : null,
    active: index % 3 === 0 ? true : index % 3 === 1 ? false : null,
  }),
);
const service: ServiceCatalogRow = {
  entity_id: id(20),
  version: 1,
  name: "Serviço exemplo",
  category: null,
  price_cents: 0,
  currency: "BRL",
  standalone_duration_minutes: 0,
  active: null,
};
const product: ProductCatalogRow = {
  entity_id: id(30),
  version: 1,
  name: "Produto exemplo",
  brand: null,
  category: null,
  sale_price_cents: 0,
  currency: "BRL",
  unit: null,
  active: false,
};
const readyProfessionals: CatalogReadResult<"professionals"> = {
  state: "ready",
  kind: "professionals",
  rows: professionals,
  total: professionals.length,
};
const detailIds = (html: string) =>
  [...html.matchAll(/data-catalog-detail="([^"]+)"/g)].map((match) => match[1]);

test("catalog boundary states never render raw error or masquerade as an empty ready result", () => {
  const states = ["inactive", "signed-out", "forbidden", "error"] as const;
  for (const state of states) {
    const html = renderCatalogRead("professionals", {
      state,
      message: "PRIVATE_ERROR_SENTINEL <script>secret</script>",
    });
    assert.ok(!html.includes("PRIVATE_ERROR_SENTINEL"));
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<table"));
    assert.ok(!html.includes("lista vazia"));
    assert.ok(html.includes(`data-catalog-state="${state}"`));
  }
  const loading = renderCatalogRead("services", { state: "loading" });
  assert.ok(loading.includes('aria-busy="true"'));
  assert.ok(!loading.includes("lista vazia"));
  const empty = renderCatalogRead("products", {
    state: "ready",
    kind: "products",
    rows: [],
    total: 0,
  });
  assert.ok(empty.includes('data-catalog-state="error"'));
  assert.ok(!empty.includes("lista vazia"));
  assert.ok(!empty.includes("<table"));
});

test("unknown activity remains separate from inactive and zero price/duration are preserved", () => {
  const unknown = renderCatalogRead("professionals", readyProfessionals, {
    status: "Não informado",
  });
  assert.deepEqual(detailIds(unknown), [id(3), id(6), id(9), id(12)]);
  const inactive = renderCatalogRead("professionals", readyProfessionals, {
    status: "Inativos",
  });
  assert.deepEqual(detailIds(inactive), [id(2), id(5), id(8), id(11)]);
  const html = renderCatalogRead("services", {
    state: "ready",
    kind: "services",
    rows: [service],
    total: 1,
  });
  assert.match(html, /R\$\s0,00/);
  assert.ok(html.includes("0 min"));
  assert.ok(html.includes("catalog-read-status-unknown"));
  const detail = renderCatalogReadDetail("products", product);
  assert.match(detail, /R\$\s0,00/);
  assert.ok(detail.includes("<dt>Situação</dt><dd>Inativo</dd>"));
});

test("query is accent insensitive and pagination clamps after filtering", () => {
  const second = renderCatalogRead("professionals", readyProfessionals, {
    page: 2,
    pageSize: 5,
  });
  assert.deepEqual(detailIds(second), [id(6), id(7), id(8), id(9), id(10)]);
  assert.ok(second.includes("Mostrando 6–10 de 12 registros"));
  const filtered = renderCatalogRead("professionals", readyProfessionals, {
    query: "acao",
    page: 99,
    pageSize: 5,
  });
  assert.deepEqual(detailIds(filtered), [id(1)]);
  assert.ok(filtered.includes("Mostrando 1–1 de 1 registro"));
  assert.ok(
    filtered.includes(
      'data-catalog-page="1" aria-label="Página 1" aria-current="page"',
    ),
  );
  const none = renderCatalogRead("professionals", readyProfessionals, {
    query: "registro inexistente",
  });
  assert.ok(none.includes("Nenhum resultado para os filtros"));
  assert.ok(none.includes("data-catalog-reset"));
  assert.ok(
    !none.includes("Esta consulta autorizada retornou uma lista vazia"),
  );
});

test("imported values and query are escaped; details expose only the allowed fields", () => {
  const injected = {
    ...product,
    name: '<img src=x onerror="test">',
    entity_id: id(40),
    stock: 911,
    commission: "PRIVATE_COMMISSION_SENTINEL",
    provenance: "PRIVATE_PROVENANCE_SENTINEL",
    auth_user_id: "PRIVATE_AUTH_SENTINEL",
  };
  const html = renderCatalogRead(
    "products",
    { state: "ready", kind: "products", rows: [injected], total: 1 },
    { query: '" onfocus="test' },
  );
  assert.ok(!html.includes('value="" onfocus='));
  assert.ok(html.includes("&quot; onfocus=&quot;test"));
  const detail = renderCatalogReadDetail("products", injected);
  assert.ok(detail.includes("&lt;img"));
  assert.ok(!detail.includes("<img"));
  for (const secret of [
    "PRIVATE_COMMISSION_SENTINEL",
    "PRIVATE_PROVENANCE_SENTINEL",
    "PRIVATE_AUTH_SENTINEL",
    id(40),
    "911",
  ]) {
    assert.ok(!detail.includes(secret));
  }
  assert.ok(!detail.includes("Editar"));
  assert.ok(!detail.includes("Excluir"));
});

test("filter normalization never mutates defaults and supports only the documented page sizes", () => {
  const snapshot = JSON.stringify(defaultCatalogReadFilters);
  const html = renderCatalogRead("professionals", readyProfessionals, {
    status: "inventado",
    page: -1,
    pageSize: 3,
  });
  assert.equal(detailIds(html).length, 10);
  assert.equal(JSON.stringify(defaultCatalogReadFilters), snapshot);
  for (const size of [5, 10, 25]) assert.ok(html.includes(`value="${size}"`));
  assert.ok(html.includes('value="Todos" selected'));
});
