import { professionals, production } from "./demo.ts";
import { money, type Production } from "./domain.ts";
import {
  cashMovements,
  cashHistory,
  cashTotals,
  clientAccounts,
  professionalAccounts,
  type DemoCashMovement,
} from "./demo-finance.ts";
import {
  type AdminState,
  h,
  matchQuery,
  inPeriod,
  fmtDate,
  badge,
  tabs,
  field,
  periodFields,
  toolbar,
  panel,
  dataTable,
  detailButton,
  notice,
  detailContent,
} from "./admin-ui.ts";

export const financeTabs = [
  "Resultado gerencial",
  "Caixa",
  "Histórico de Caixa",
  "Comissões",
  "Conta Cliente",
  "Fluxo de Caixa",
  "Conta Profissional",
];

const selected = (value: string, actual: string) =>
  !value || value === "Todos" || value === "Todas" || value === actual;
const unknown = () => badge("Não informado", "neutral");
const scopeField = (state: AdminState, company = false) =>
  field(
    "professional",
    "Buscar profissionais",
    ["Todos", ...(company ? ["Empresa"] : []), ...professionals],
    state.professional,
  );
const summary = (items: [string, string, string][]) =>
  `<div class="admin-summary">${items.map(([label, value, note]) => `<div class="admin-stat"><span>${h(label)}</span><strong>${h(value)}</strong><small>${h(note)}</small></div>`).join("")}</div>`;

// The same controls remain available in valid and invalid consultation states.
function periodControls(state: AdminState, section: string) {
  if (section === "Comissões") {
    const subtab =
      state.subtab === "Lançamentos" ? "Lançamentos" : "Profissionais";
    return (
      `<div class="admin-filters" aria-label="Tipo de comissão">${field("type", "Tipo", ["Todos", "Serviços", "Produtos"], state.type)}</div>` +
      `<div class="admin-filters" aria-label="Consulta por profissional">${field("status", "Mostrar", ["Todas", "Geradas (estimadas)", "Pagas"], state.status)}${scopeField(state)}${tabs(["Profissionais", "Lançamentos"], subtab, "subtab")}</div>` +
      toolbar(state, periodFields(state))
    );
  }
  if (section === "Fluxo de Caixa") {
    const subtab =
      state.subtab === "Fluxo geral" ? "Fluxo geral" : "Fluxo de Caixa";
    return (
      tabs(["Fluxo de Caixa", "Fluxo geral"], subtab, "subtab") +
      toolbar(
        state,
        periodFields(state) +
          field(
            "type",
            "Tipo de movimento",
            ["Todos", "Entradas", "Saídas"],
            state.type,
          ),
      )
    );
  }
  if (section === "Histórico de Caixa")
    return toolbar(
      state,
      periodFields(state) +
        scopeField(state, true) +
        field("status", "Status", ["Todos", "Encerrado na demo"], state.status),
    );
  return toolbar(state, periodFields(state) + scopeField(state));
}

export function selectFinanceProduction(state: AdminState): Production[] {
  return production.filter(
    (row) =>
      inPeriod(row.date, state) &&
      selected(state.professional, row.professional) &&
      matchQuery(state.query, row.professional, row.client, row.date),
  );
}

export function selectCashMovements(state: AdminState): DemoCashMovement[] {
  return cashMovements.filter(
    (row) =>
      inPeriod(row.date, state) &&
      selected(state.professional, row.professional) &&
      (selected(state.type, row.kind) ||
        (state.type === "Entradas" && row.kind === "Entrada") ||
        (state.type === "Saídas" && row.kind === "Saída")) &&
      matchQuery(
        state.query,
        row.description,
        row.professional,
        row.date,
        row.kind,
      ),
  );
}

function resultView(state: AdminState) {
  const rows = selectFinanceProduction(state);
  if (!rows.length)
    return panel(
      "Resultado por competência",
      periodControls(state, "Resultado gerencial") +
        dataTable(
          "Composição gerencial",
          ["Componente", "Valor", "Qualidade do dado", "Critério"],
          [],
          state,
          "Nenhuma produção corresponde ao período, profissional e pesquisa selecionados. Altere os filtros para consultar a base fictícia.",
        ) +
        notice(
          "Sem registros no recorte, não há composição gerencial a exibir. Os dados financeiros reais continuam não informados.",
        ),
      "Produção por competência. Não é extrato de recebimentos nem posição bancária.",
    );
  const gross = rows.reduce((sum, row) => sum + row.cents, 0);
  const commission = rows.reduce((sum, row) => sum + row.commissionCents, 0);
  const composition = [
    [
      "Produção de serviços",
      money(gross),
      badge("Confirmado na base demo"),
      "Competência dos serviços filtrados",
    ],
    [
      "Comissões geradas",
      money(commission),
      badge("Estimativa demo"),
      "Hipótese de 40%; regra real pendente",
    ],
    [
      "Custos operacionais",
      "Não informado",
      badge("Ausente"),
      "Sem base de custos validada",
    ],
    [
      "Taxas e impostos",
      "Não informado",
      badge("Ausente"),
      "Sem taxas ou regime tributário definido",
    ],
    [
      "Saldo após comissão",
      money(gross - commission),
      badge("Estimativa demo"),
      "Produção menos comissão estimada; não é lucro",
    ],
    [
      "Resultado líquido",
      "Não disponível",
      badge("Ausente"),
      "Depende de custos, impostos e taxas",
    ],
  ];
  return panel(
    "Resultado por competência",
    periodControls(state, "Resultado gerencial") +
      summary([
        [
          "Produção filtrada",
          money(gross),
          `${rows.length} serviços na base fictícia`,
        ],
        [
          "Comissão estimada",
          money(commission),
          "Gerada; pagamento não informado",
        ],
        [
          "Resultado líquido",
          "Não disponível",
          "Custos, impostos e taxas ausentes",
        ],
      ]) +
      dataTable(
        "Composição gerencial",
        ["Componente", "Valor", "Qualidade do dado", "Critério"],
        composition,
        state,
      ) +
      notice(
        "A pesquisa considera profissional, cliente e data da produção. Este modelo gerencial é próprio do Fonseca; não representa fórmula validada do sistema de referência.",
      ),
    "Produção por competência. Não é extrato de recebimentos nem posição bancária.",
  );
}

function currentCash(state: AdminState) {
  const rows = [
    [
      "Situação operacional",
      unknown(),
      "Não há conexão com um caixa operacional",
    ],
    ["Valor inicial", unknown(), "Não informado para o caixa atual"],
    [
      "Abertura / fechamento",
      unknown(),
      "Fluxo operacional ainda não especificado",
    ],
    [
      "Saldo atual",
      unknown(),
      "Não pode ser inferido do histórico demonstrativo",
    ],
  ];
  return panel(
    "Caixa operacional",
    notice(
      "Estado não informado. A evidência disponível não permite afirmar se um caixa real está aberto, fechado ou vazio.",
    ) +
      dataTable(
        "Dados do caixa atual",
        ["Informação", "Estado", "Observação"],
        rows,
        { ...state, page: 1, pageSize: 10 },
      ) +
      `<div class="admin-actions"><button type="button" data-admin-tab="Histórico de Caixa">Consultar histórico demonstrativo</button><button type="button" data-admin-tab="Fluxo de Caixa">Consultar fluxo de caixa</button></div>`,
    "Modelo de consulta próprio. Abertura, fechamento e cobrança não estão disponíveis.",
  );
}

function historyView(state: AdminState) {
  const rows = cashHistory.filter(
    (row) =>
      inPeriod(row.date, state) &&
      selected(state.professional, row.professional) &&
      selected(state.status, row.status) &&
      matchQuery(state.query, row.description, row.date, row.professional),
  );
  return panel(
    "Histórico de Caixa",
    periodControls(state, "Histórico de Caixa") +
      dataTable(
        "Histórico de caixa demonstrativo",
        [
          "Descrição",
          "Status",
          "Saldo",
          "Valor inicial",
          "Data do caixa",
          "Data de início",
          "Data de fim",
          "Profissional",
          "Ações",
        ],
        rows.map((row) => [
          h(row.description),
          badge(row.status),
          money(row.balanceCents),
          money(row.initialCents),
          fmtDate(row.date),
          `${fmtDate(row.date)} · ${row.start}`,
          `${fmtDate(row.date)} · ${row.end}`,
          h(row.professional),
          detailButton(`finance:${row.id}`),
        ]),
        state,
      ) +
      notice(
        "Dois cenários fictícios independentes, com valor inicial zero informado na própria fixture. Não são extratos reais; não indicam estado do caixa atual.",
      ),
    "Datas e valores exclusivamente demonstrativos. Consulta sem fechar ou reabrir caixas.",
  );
}

function commissionsView(state: AdminState) {
  const subtab =
    state.subtab === "Lançamentos" ? "Lançamentos" : "Profissionais";
  const allRows = selectFinanceProduction(state);
  const rows =
    state.type === "Produtos" || state.status === "Pagas" ? [] : allRows;
  const bodyRows =
    subtab === "Lançamentos"
      ? rows.map((row) => [
          fmtDate(row.date),
          h(row.professional),
          h(row.client),
          money(row.cents),
          money(row.commissionCents),
          badge("Estimativa demo"),
          "Não informado",
          detailButton(
            `finance:commission-${professionals.indexOf(row.professional)}`,
          ),
        ])
      : professionals
          .map((name, index) => ({
            name,
            index,
            items: rows.filter((row) => row.professional === name),
          }))
          .filter((item) => item.items.length)
          .map((item) => [
            h(item.name),
            String(item.items.length),
            money(item.items.reduce((sum, row) => sum + row.cents, 0)),
            money(
              item.items.reduce((sum, row) => sum + row.commissionCents, 0),
            ),
            "Não informado",
            "Não determinável",
            detailButton(`finance:commission-${item.index}`),
          ]);
  const headers =
    subtab === "Lançamentos"
      ? [
          "Competência",
          "Profissional",
          "Cliente",
          "Produção",
          "Comissão gerada",
          "Qualidade",
          "Pagamento",
          "Ações",
        ]
      : [
          "Profissional",
          "Serviços",
          "Produção",
          "Comissão gerada",
          "Pagamento",
          "Saldo a pagar",
          "Ações",
        ];
  return panel(
    "Comissões / profissionais",
    periodControls(state, "Comissões") +
      dataTable(
        "Consulta de comissões",
        headers,
        bodyRows,
        state,
        state.status === "Pagas"
          ? "Não há registros de pagamento de comissão nesta demonstração. Isso não significa valor pago igual a zero."
          : state.type === "Produtos"
            ? "Não há base de comissão de produtos na demonstração. A regra real está pendente."
            : "Nenhuma produção corresponde aos filtros.",
      ) +
      notice(
        "40% é somente a hipótese já usada na demo. Base real, rateios, descontos e arredondamento precisam de definição. Pagamento ausente não é pagamento zero; não é possível confirmar saldo a pagar.",
      ),
    "Tabelas, filtros de competência e visões Profissionais/Lançamentos são modelos próprios da demo. Produção e pagamento de comissão são eventos diferentes.",
  );
}

function accountsView(state: AdminState, professional: boolean) {
  const rows = (professional ? professionalAccounts : clientAccounts).filter(
    (row) =>
      matchQuery(state.query, row.name) &&
      (!professional || selected(state.professional, row.name)),
  );
  return panel(
    professional ? "Conta Profissional" : "Conta Cliente",
    toolbar(state, professional ? scopeField(state) : "") +
      dataTable(
        professional ? "Contas de profissionais" : "Contas de clientes",
        ["Nome", "Saldo", "Ações"],
        rows.map((row) => [
          h(row.name),
          unknown(),
          detailButton(`finance:${row.id}`),
        ]),
        state,
      ) +
      notice(
        professional
          ? "Saldo da conta do profissional não é sua comissão gerada. Créditos, débitos, adiantamentos e pagamentos não foram informados."
          : "Créditos, débitos e saldo de clientes não foram informados. A ausência desses registros não significa saldo zero.",
      ),
    "Nomes fictícios. Consulta demonstrativa; autorização de acesso real ainda depende de implementação.",
  );
}

function flowView(state: AdminState) {
  const subtab =
    state.subtab === "Fluxo geral" ? "Fluxo geral" : "Fluxo de Caixa";
  const rows = selectCashMovements(state);
  const totals = cashTotals(rows);
  const daily = [...new Set(rows.map((row) => row.date))].sort().map((date) => {
    const day = cashTotals(rows.filter((row) => row.date === date));
    return [
      fmtDate(date),
      money(day.incoming),
      money(day.outgoing),
      money(day.net),
      badge("Liquidado na demo"),
    ];
  });
  return panel(
    "Fluxo de Caixa",
    periodControls(state, "Fluxo de Caixa") +
      summary([
        [
          "Entradas filtradas",
          money(totals.incoming),
          "Data de liquidação fictícia",
        ],
        [
          "Saídas filtradas",
          money(totals.outgoing),
          "Data de liquidação fictícia",
        ],
        [
          "Variação dos movimentos",
          money(totals.net),
          "Entradas menos saídas; não é saldo bancário",
        ],
      ]) +
      (subtab === "Fluxo de Caixa"
        ? dataTable(
            "Movimentos de caixa demonstrativos",
            ["Liquidação", "Descrição", "Tipo", "Valor", "Estado", "Ações"],
            rows.map((row) => [
              fmtDate(row.date),
              h(row.description),
              badge(row.kind),
              money(row.cents),
              badge(row.status),
              detailButton(`finance:${row.id}`),
            ]),
            state,
          )
        : dataTable(
            "Fluxo por data de liquidação",
            ["Data", "Entradas", "Saídas", "Variação", "Estado"],
            daily,
            state,
          )) +
      notice(
        "Modelo demonstrativo próprio, com movimentos independentes da produção e das comandas. Valores filtrados não são lucro, saldo bancário ou conciliação. Não há previsão de recebíveis.",
      ),
    "As guias usam nomes observados; seu comportamento sobre estas fixtures é próprio da demo. Consulta pela data de liquidação, separada do resultado por competência.",
  );
}

export function renderFinance(state: AdminState): string {
  const active = financeTabs.includes(state.tab) ? state.tab : financeTabs[0];
  const introduction =
    tabs(financeTabs, active) +
    notice(
      "Demonstração · todos os dados são fictícios. Produção não significa recebimento; comissão gerada não significa pagamento.",
    );
  const usesPeriod = [
    "Resultado gerencial",
    "Histórico de Caixa",
    "Comissões",
    "Fluxo de Caixa",
  ].includes(active);
  if (usesPeriod && state.from && state.to && state.from > state.to) {
    return (
      introduction +
      panel(
        active,
        periodControls(state, active) +
          notice(
            "Consulta não executada. Corrija o período para exibir registros e totais; um intervalo inválido não representa ausência de movimentos nem valor zero.",
          ),
        "Período inválido. Os filtros foram preservados para correção.",
      )
    );
  }
  const view =
    active === "Caixa"
      ? currentCash(state)
      : active === "Histórico de Caixa"
        ? historyView(state)
        : active === "Comissões"
          ? commissionsView(state)
          : active === "Conta Cliente"
            ? accountsView(state, false)
            : active === "Conta Profissional"
              ? accountsView(state, true)
              : active === "Fluxo de Caixa"
                ? flowView(state)
                : resultView(state);
  return introduction + view;
}

export function financeDetail(key: string): string | undefined {
  if (!key.startsWith("finance:")) return undefined;
  const id = key.slice("finance:".length);
  const movement = cashMovements.find((row) => row.id === id);
  if (movement)
    return detailContent(
      "Movimento demonstrativo",
      `<p>${h(movement.description)}</p><dl class="admin-detail-list"><dt>Liquidação</dt><dd>${fmtDate(movement.date)}</dd><dt>Tipo</dt><dd>${h(movement.kind)}</dd><dt>Valor</dt><dd>${money(movement.cents)}</dd><dt>Estado</dt><dd>${h(movement.status)}</dd></dl>${notice("Fixture independente, sem vínculo com uma cobrança, comanda ou banco real. Esta consulta não executa pagamentos, estornos nem conciliação.")}`,
    );
  const cash = cashHistory.find((row) => row.id === id);
  if (cash)
    return detailContent(
      cash.description,
      `<dl class="admin-detail-list"><dt>Estado do cenário</dt><dd>${h(cash.status)}</dd><dt>Data</dt><dd>${fmtDate(cash.date)}</dd><dt>Valor inicial ilustrativo</dt><dd>${money(cash.initialCents)}</dd><dt>Saldo do cenário</dt><dd>${money(cash.balanceCents)}</dd></dl>${notice("Este registro histórico fictício não determina se o caixa atual está aberto ou fechado. Nenhuma operação de fechamento é executada nesta demonstração.")}`,
    );
  if (id.startsWith("commission-")) {
    const name = professionals[Number(id.slice("commission-".length))];
    if (!name) return undefined;
    return detailContent(
      "Comissão · regra demonstrativa",
      `<p>${h(name)}</p><dl class="admin-detail-list"><dt>Estimativa</dt><dd>40% da produção fictícia por competência</dd><dt>Pagamento</dt><dd>Não informado</dd><dt>Saldo a pagar confirmado</dt><dd>Não determinável</dd></dl>${notice("A porcentagem é hipótese da demo, não regra observada. Base, descontos, rateios, arredondamento e datas de pagamento precisam ser especificados. Consulte a tabela filtrada para os valores do período selecionado.")}`,
    );
  }
  const account = [...clientAccounts, ...professionalAccounts].find(
    (row) => row.id === id,
  );
  if (account)
    return detailContent(
      id.startsWith("client-") ? "Conta do cliente" : "Conta do profissional",
      `<p>${h(account.name)}</p><dl class="admin-detail-list"><dt>Saldo</dt><dd>Não informado</dd><dt>Créditos / débitos</dt><dd>Sem registros na demonstração</dd><dt>Conciliação</dt><dd>Não realizada</dd></dl>${notice("Ausência de dados não confirma saldo zero. Não há cobrança, movimentação ou alteração de conta neste preview.")}`,
    );
  return undefined;
}
