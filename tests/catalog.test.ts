import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogItem,
  paginateCatalog,
  products,
  renderCatalog,
  serviceCatalog,
} from "../src/catalog-view.ts";

test("catalog pagination filters before slicing and clamps stale page", () => {
  const second = paginateCatalog(serviceCatalog, "", 2, 2);
  assert.deepEqual(
    second.rows.map((row) => row.id),
    [2, 3],
  );
  const filtered = paginateCatalog(serviceCatalog, "barba", 2, 2);
  assert.equal(filtered.total, 2);
  assert.equal(filtered.page, 1);
  assert.deepEqual(
    filtered.rows.map((row) => row.id),
    [1, 2],
  );
  const none = paginateCatalog(serviceCatalog, "sem correspondência", 4, 2);
  assert.equal(none.total, 0);
  assert.equal(none.start, 0);
  assert.equal(none.end, 0);
  assert.equal(none.page, 1);
});

test("catalog search is accent insensitive and detail ids remain stable", () => {
  assert.deepEqual(
    paginateCatalog(products, "finalizacao", 1, 5).rows.map((row) => row.id),
    [0],
  );
  assert.equal(catalogItem("service", "2")?.name, "Corte + barba");
  assert.equal(catalogItem("product", 1)?.stock, 8);
  assert.equal(catalogItem("service", 20), undefined);
});

test("services table preserves administrative order and honest consultation actions", () => {
  const html = renderCatalog({
    route: "Serviços",
    query: "",
    page: 1,
    pageSize: 2,
  });
  const headers = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(headers, [
    "Descrição",
    "Valor",
    "Tempo",
    "Comissão",
    "Categoria",
    "Ações",
  ]);
  assert.ok(html.includes('data-detail="service:0"'));
  assert.ok(html.includes('data-page="2"'));
  assert.ok(!html.includes("Novo agendamento"));
  assert.ok(!html.includes("Excluir"));
});
