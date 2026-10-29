import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAdminState } from "../src/admin-ui.ts";
import { orderFixtures, subscriberFixtures } from "../src/demo-operations.ts";
import {
  operationsDetail,
  renderOrders,
  renderSubscriptions,
  selectOrders,
  selectSubscribers,
} from "../src/operations-view.ts";

test("order queries combine tab, period, professional, status and accent-insensitive search", () => {
  assert.deepEqual(
    selectOrders(defaultAdminState()).map((row) => row.id),
    ["1041", "1042", "1043"],
  );
  const history = defaultAdminState({
    tab: "Histórico",
    status: "Cancelada",
    professional: "Lucas Almeida",
    from: "2026-10-27",
    to: "2026-10-27",
    query: "gabriel",
  });
  assert.deepEqual(
    selectOrders(history).map((row) => row.id),
    ["1047"],
  );
  assert.equal(selectOrders({ ...history, to: "2026-10-26" }).length, 0);
  assert.deepEqual(
    selectOrders(defaultAdminState({ query: "andre" })).map((row) => row.id),
    ["1041"],
  );
});

test("subscriber filters preserve missing due dates and do not derive payment status", () => {
  const rows = selectSubscribers(
    defaultAdminState({ status: "Inativa", plan: "Essencial" }),
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["sub-demo-4"],
  );
  assert.equal(rows[0].nextDue, null);
  assert.equal(
    selectSubscribers(defaultAdminState({ status: "Ativa", plan: "Essencial" }))
      .length,
    1,
  );
  assert.equal(
    selectSubscribers(
      defaultAdminState({
        status: "Ativa",
        plan: "Black Club",
        query: "André",
      }),
    ).length,
    0,
  );
});

test("readonly details retain missing financial evidence and do not mutate fixtures", () => {
  const before = JSON.stringify({ orderFixtures, subscriberFixtures });
  const closed = operationsDetail("order:1044")!;
  assert.ok(closed.includes("Não informado"));
  assert.ok(closed.includes("<dt>Cadastro</dt><dd>Não informado</dd>"));
  assert.ok(orderFixtures.every((order) => order.registration === null));
  assert.ok(closed.includes("não existe registro de recebimento"));
  assert.ok(!closed.includes('data-admin-action="pay'));
  assert.equal(operationsDetail("order:missing"), undefined);
  assert.equal(operationsDetail("subscriber:missing"), undefined);
  assert.equal(JSON.stringify({ orderFixtures, subscriberFixtures }), before);
  const orders = renderOrders(defaultAdminState());
  const headers = [...orders.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(headers, [
    "Comanda",
    "Cartão",
    "Data",
    "Valor",
    "Cliente",
    "Profissional",
    "Ações",
  ]);
  const empty = renderSubscriptions(
    defaultAdminState({ tab: "Assinantes", query: "sem correspondência" }),
  );
  assert.ok(empty.includes("Nenhum resultado"));
  assert.ok(empty.includes("data-admin-reset"));
});
