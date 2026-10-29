import assert from "node:assert/strict";
import test from "node:test";
import { defaultAdminState } from "../src/admin-ui.ts";
import {
  cashMovements,
  cashTotals,
  clientAccounts,
  professionalAccounts,
} from "../src/demo-finance.ts";
import {
  financeDetail,
  renderFinance,
  selectCashMovements,
  selectFinanceProduction,
} from "../src/finance-view.ts";

test("cash flow filters liquidation dates and totals signed movements independently", () => {
  assert.deepEqual(cashTotals(cashMovements), {
    incoming: 670000,
    outgoing: 240000,
    net: 430000,
  });
  const day = selectCashMovements(
    defaultAdminState({ from: "2026-10-28", to: "2026-10-28" }),
  );
  assert.equal(day.length, 2);
  assert.deepEqual(cashTotals(day), {
    incoming: 0,
    outgoing: 240000,
    net: -240000,
  });
  assert.equal(
    selectCashMovements(
      defaultAdminState({ type: "Entradas", query: "lote b" }),
    ).length,
    1,
  );
  assert.equal(
    selectCashMovements(
      defaultAdminState({ from: "2026-11-01", to: "2026-10-01" }),
    ).length,
    0,
  );
});

test("production scope and missing commission payments stay distinct", () => {
  const state = defaultAdminState({
    professional: "Lucas Almeida",
    from: "2026-10-01",
    to: "2026-10-03",
  });
  const production = selectFinanceProduction(state);
  assert.ok(production.length > 0);
  assert.ok(
    production.every(
      (row) => row.professional === "Lucas Almeida" && row.date <= "2026-10-03",
    ),
  );
  const paid = renderFinance(
    defaultAdminState({ tab: "Comissões", status: "Pagas" }),
  );
  assert.match(paid, /Não há registros de pagamento de comissão/);
  assert.doesNotMatch(paid, /R\$\s*0,00/);
  assert.match(
    renderFinance(defaultAdminState({ tab: "Comissões", type: "Produtos" })),
    /Não há base de comissão de produtos/,
  );
});

test("unknown account balances and current cash state are never fabricated as zero", () => {
  assert.ok(
    [...clientAccounts, ...professionalAccounts].every(
      (account) => account.balanceCents === null,
    ),
  );
  const account = financeDetail("finance:professional-0");
  assert.ok(account);
  assert.match(account, /Não informado/);
  assert.doesNotMatch(account, /R\$/);
  const cash = renderFinance(defaultAdminState({ tab: "Caixa" }));
  assert.match(cash, /Estado não informado/);
  assert.doesNotMatch(cash, /R\$/);
  const emptyResult = renderFinance(
    defaultAdminState({
      tab: "Resultado gerencial",
      query: "sem correspondencia",
    }),
  );
  assert.match(emptyResult, /Nenhuma produção corresponde/);
  assert.doesNotMatch(emptyResult, /R\$/);
  assert.equal(financeDetail("finance:unknown"), undefined);
});

test("invalid periods stop financial results instead of showing monetary zero or empty ledgers", () => {
  const cases = [
    ["Resultado gerencial", ""],
    ["Histórico de Caixa", ""],
    ["Comissões", "Profissionais"],
    ["Comissões", "Lançamentos"],
    ["Fluxo de Caixa", "Fluxo de Caixa"],
    ["Fluxo de Caixa", "Fluxo geral"],
  ];
  for (const [tab, subtab] of cases) {
    const state = defaultAdminState({
      tab,
      subtab,
      from: "2026-10-29",
      to: "2026-10-01",
      query: "",
    });
    const invalid = renderFinance(state);
    assert.match(
      invalid,
      /role="alert"/,
      `${tab}/${subtab}: input error must be announced`,
    );
    assert.match(invalid, /Consulta não executada/);
    assert.match(invalid, /data-admin-field="from" value="2026-10-29"/);
    assert.match(invalid, /data-admin-field="to" value="2026-10-01"/);
    assert.doesNotMatch(
      invalid,
      /R\$|class="admin-summary"|<table|Nenhum resultado/,
    );
    const corrected = renderFinance({
      ...state,
      from: "2026-10-01",
      to: "2026-10-29",
    });
    assert.doesNotMatch(corrected, /Consulta não executada/);
    assert.match(corrected, /<table/);
    assert.match(corrected, /R\$/);
  }
});
