import { clients, professionals, services, production } from "./demo.ts";
import { aggregate, money, type Appointment } from "./domain.ts";
import {
  birthdayOccurrences,
  reportClients,
  reportPlanLabels,
} from "./demo-reports.ts";
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

const reportTabs = ["Agendamentos", "Clientes", "Resumo", "Aniversariantes"];
const appointmentTabs = [
  "Geral",
  "Clientes",
  "Profissionais",
  "Recorrentes",
  "Assinaturas",
];
const summaryTabs = ["Resumo", "Dashboard", "Vendas", "Profissionais"];
const clientReportTypes = [
  "Cadastrados no período",
  "Clientes sem acesso",
  "Atendimentos no período",
];
const any = (value: string) => !value || value === "Todos" || value === "Todas";
const pick = (value: string, choices: string[]) =>
  choices.includes(value) ? value : choices[0];
const rangeNote = (state: AdminState) =>
  `${fmtDate(state.from)} a ${fmtDate(state.to)}`;
const unknown = () => badge("Não informado");

export function selectReportAppointments(
  rows: Appointment[],
  state: AdminState,
): Appointment[] {
  return rows
    .filter(
      (row) =>
        inPeriod(row.date, state) &&
        (any(state.client) || row.client === state.client) &&
        (any(state.professional) || row.professional === state.professional) &&
        (any(state.service) || row.service === state.service) &&
        (any(state.status) || row.status === state.status) &&
        matchQuery(
          state.query,
          row.client,
          row.professional,
          row.service,
          row.id,
          row.status,
        ),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time),
    );
}

function appointmentFilters(state: AdminState, mode: string) {
  const type =
    mode === "Assinaturas"
      ? field(
          "type",
          "Tipo de relatório",
          ["Total de agendamentos", "Total de assinantes"],
          pick(state.type, ["Total de agendamentos", "Total de assinantes"]),
        ) +
        field("plan", "Assinatura", ["Todas", ...reportPlanLabels], state.plan)
      : field(
          "status",
          "Status",
          ["Todos", "Agendado", "Confirmado", "Concluído", "Cancelado"],
          state.status,
        );
  return toolbar(
    state,
    periodFields(state) +
      type +
      (mode !== "Assinaturas"
        ? field("client", "Cliente", ["Todos", ...clients], state.client)
        : "") +
      field(
        "professional",
        "Profissional",
        ["Todos", ...professionals],
        state.professional,
      ) +
      field(
        "service",
        "Serviço",
        ["Todos", ...services.map((service) => service.name)],
        state.service,
      ),
  );
}

function appointmentLink(row: Appointment): string {
  return `<button type="button" data-detail="appointment:${h(row.id)}" aria-label="Consultar agendamento de ${h(row.client)} em ${fmtDate(row.date)}">Consultar</button>`;
}

function appointmentsReport(
  state: AdminState,
  appointments: Appointment[],
): string {
  const mode = pick(state.subtab, appointmentTabs);
  const rows = selectReportAppointments(appointments, state);
  const controls =
    tabs(appointmentTabs, mode, "subtab") + appointmentFilters(state, mode);
  if (mode === "Recorrentes")
    return (
      controls +
      panel(
        "Agendamentos recorrentes",
        dataTable(
          "Agendamentos recorrentes",
          [
            "Cliente",
            "Telefone",
            "Serviço",
            "Profissional",
            "Data agendamento",
            "Data de cadastro",
            "Agendamento",
          ],
          [],
          state,
          "Nenhum vínculo de recorrência foi definido na base demonstrativa. Agendamentos comuns não são convertidos em recorrentes.",
        ),
        "Recorrência de horário e assinatura comercial são entidades distintas. Esta consulta não cria uma série nem presume sua existência.",
      )
    );
  if (mode === "Assinaturas")
    return (
      controls +
      panel(
        "Agendamentos de assinaturas",
        notice(
          "Vínculos entre agendamentos e assinaturas não estão definidos na demo. Totais de consumo e de assinantes permanecem não disponíveis.",
        ) + detailButton("report:subscription-links", "Entender esta consulta"),
        "Os filtros seguem os controles observados. Não havia tabela confirmada nessa tela; nenhum resultado financeiro foi deduzido.",
      )
    );

  const headers =
    mode === "Clientes"
      ? [
          "Comanda",
          "Serviço",
          "Cliente",
          "Valor de referência",
          "Data",
          "Ações",
        ]
      : mode === "Profissionais"
        ? [
            "Comanda",
            "Profissional",
            "Serviço",
            "Valor de referência",
            "Data",
            "Ações",
          ]
        : [
            "Serviço",
            "Cliente",
            "Telefone",
            "Profissional",
            "Data",
            "Valor de referência",
            "Status",
            "Ações",
          ];
  const rendered = rows.map((row) =>
    mode === "Clientes"
      ? [
          unknown(),
          h(row.service),
          h(row.client),
          money(row.cents),
          `${fmtDate(row.date)} · ${h(row.time)}`,
          appointmentLink(row),
        ]
      : mode === "Profissionais"
        ? [
            unknown(),
            h(row.professional),
            h(row.service),
            money(row.cents),
            `${fmtDate(row.date)} · ${h(row.time)}`,
            appointmentLink(row),
          ]
        : [
            h(row.service),
            h(row.client),
            unknown(),
            h(row.professional),
            `${fmtDate(row.date)} · ${h(row.time)}`,
            money(row.cents),
            badge(row.status),
            appointmentLink(row),
          ],
  );
  return (
    controls +
    panel(
      mode === "Geral"
        ? "Relatório de agendamentos"
        : `Agendamentos por ${mode.toLowerCase()}`,
      dataTable(`Agendamentos · ${mode}`, headers, rendered, state),
      `${rows.length} agendamentos · ${new Set(rows.map((row) => row.client)).size} clientes únicos no filtro inteiro. Agenda não comprova recebimento ou produção; vínculo de comanda e telefone estão ausentes.`,
    )
  );
}

function clientsReport(state: AdminState, appointments: Appointment[]): string {
  const type = pick(state.type, clientReportTypes);
  const controls = toolbar(
    state,
    periodFields(state) +
      field("type", "Tipo", clientReportTypes, type) +
      field("client", "Cliente", ["Todos", ...clients], state.client) +
      (type === "Atendimentos no período"
        ? field(
            "professional",
            "Profissional",
            ["Todos", ...professionals],
            state.professional,
          ) +
          field(
            "service",
            "Serviço",
            ["Todos", ...services.map((service) => service.name)],
            state.service,
          )
        : ""),
  );

  if (type === "Atendimentos no período") {
    const selected = selectReportAppointments(appointments, {
      ...state,
      status: "Concluído",
    });
    return (
      controls +
      panel(
        "Clientes com atendimentos no período",
        dataTable(
          "Relatório de clientes · atendimentos",
          ["Serviço", "Cliente", "Agendamento", "Profissional", "Celular"],
          selected.map((row) => [
            h(row.service),
            h(row.client),
            `${fmtDate(row.date)} · ${h(row.time)}`,
            h(row.professional),
            unknown(),
          ]),
          state,
        ),
        `${new Set(selected.map((row) => row.client)).size} clientes distintos com status Concluído na agenda demonstrativa. Esta consulta é de agenda; a base analítica de produção é independente.`,
      )
    );
  }
  const selected = reportClients.filter(
    (client) =>
      inPeriod(client.registeredAt, state) &&
      (any(state.client) || client.name === state.client) &&
      (type !== "Clientes sem acesso" ||
        client.accessStatus === "Sem acesso na demo") &&
      matchQuery(state.query, client.name, client.accessStatus),
  );
  return (
    controls +
    panel(
      type,
      dataTable(
        `Relatório de clientes · ${type}`,
        [
          "Cliente",
          "Cadastro demonstrativo",
          "Acesso demonstrativo",
          "Celular",
          "Ações",
        ],
        selected.map((client) => [
          h(client.name),
          fmtDate(client.registeredAt),
          badge(client.accessStatus),
          unknown(),
          detailButton(`report:client:${client.id}`),
        ]),
        state,
      ),
      "Modelo próprio de consulta. O período filtra a data de cadastro da amostra sintética. Acesso simulado não representa login real; nenhuma autenticação está conectada.",
    )
  );
}

export function selectReportProduction(state: AdminState) {
  return production.filter(
    (row) =>
      inPeriod(row.date, state) &&
      (any(state.professional) || row.professional === state.professional) &&
      matchQuery(state.query, row.professional, row.client, row.id),
  );
}

function summaryReport(state: AdminState): string {
  const mode = pick(state.subtab, summaryTabs);
  const selected = selectReportProduction(state);
  const summary = aggregate(
    selected,
    state.from || "0000-01-01",
    state.to || "9999-12-31",
  );
  const controls =
    tabs(summaryTabs, mode, "subtab") +
    toolbar(
      state,
      periodFields(state) +
        field(
          "professional",
          "Profissional",
          ["Todos", ...professionals],
          state.professional,
        ) +
        (mode === "Vendas"
          ? field(
              "type",
              "Classificação",
              ["Todos", "Serviços", "Produtos"],
              state.type,
            )
          : ""),
    );
  const note =
    "Modelo demonstrativo próprio. Dados de produção por competência são independentes da agenda e dos movimentos de caixa. Valores não comprovam recebimento.";

  if (mode === "Vendas")
    return (
      controls +
      panel(
        "Resumo de vendas",
        notice(
          "Não há uma base de vendas conciliada nesta demonstração. Produção de serviços não é usada como substituto de venda recebida; vendas de produtos também não foram registradas.",
        ) + detailButton("report:sales", "Entender os dados ausentes"),
        "Composição dos totais e regras da tela original não foram recuperadas. Não exibimos zero como se fosse saldo confirmado.",
      )
    );
  if (mode === "Profissionais") {
    const names = [...new Set(selected.map((row) => row.professional))];
    return (
      controls +
      panel(
        "Resumo por profissional",
        dataTable(
          "Produção por profissional",
          [
            "Profissional",
            "Atendimentos",
            "Clientes únicos",
            "Produção",
            "Comissão estimada",
          ],
          names.map((name) => {
            const totals = aggregate(
              selected,
              state.from || "0000-01-01",
              state.to || "9999-12-31",
              name,
            );
            return [
              h(name),
              String(totals.count),
              String(totals.clients),
              money(totals.revenue),
              money(totals.commission),
            ];
          }),
          state,
        ),
        `${note} Clientes únicos da empresa: ${summary.clients}, recalculados no período completo. Não some os clientes das linhas. Comissão estimada em 40%, sem comprovação de pagamento.`,
      )
    );
  }

  if (mode === "Dashboard") {
    const days = [...new Set(selected.map((row) => row.date))].sort();
    return (
      controls +
      panel(
        "Dashboard do relatório",
        dataTable(
          "Produção diária por competência",
          ["Data", "Atendimentos", "Clientes únicos no dia", "Produção"],
          days.map((day) => {
            const totals = aggregate(selected, day, day);
            return [
              fmtDate(day),
              String(totals.count),
              String(totals.clients),
              money(totals.revenue),
            ];
          }),
          state,
        ),
        `${note} ${summary.clients} clientes únicos no período; não somar os clientes diários. Relatório separado do Dashboard principal.`,
      )
    );
  }
  const metrics = selected.length
    ? [
        [
          "Produção por competência",
          money(summary.revenue),
          badge("Confirmado na demo"),
          "Amostra de serviços realizados",
        ],
        [
          "Atendimentos",
          String(summary.count),
          badge("Confirmado na demo"),
          "Quantidade de produções no período",
        ],
        [
          "Clientes únicos",
          String(summary.clients),
          badge("Confirmado na demo"),
          "Identificadores distintos no período inteiro",
        ],
        [
          "Ticket médio de produção",
          money(Math.round(summary.revenue / summary.count)),
          badge("Derivado da demo"),
          "Produção dividida por atendimentos",
        ],
        [
          "Comissão gerada",
          money(summary.commission),
          badge("Estimado"),
          "Hipótese de 40%; pagamento ausente",
        ],
        [
          "Resultado líquido",
          "Não disponível",
          badge("Ausente"),
          "Custos, taxas e impostos não informados",
        ],
      ]
    : [];
  return (
    controls +
    panel(
      "Resumo do período",
      dataTable(
        "Indicadores de produção",
        ["Indicador", "Valor", "Qualidade", "Leitura"],
        metrics,
        state,
      ),
      `${rangeNote(state)}. ${note}`,
    )
  );
}

function birthdayReport(state: AdminState): string {
  const from = state.from;
  const to = state.to;
  const selected = birthdayOccurrences(from, to).filter((client) =>
    matchQuery(state.query, client.name),
  );
  const broadRange = Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > 10;
  return (
    toolbar(state, periodFields(state)) +
    panel(
      "Relatório de aniversariantes",
      (!from || !to
        ? notice(
            "Informe data inicial e final para consultar os aniversários fictícios.",
          )
        : "") +
        (broadRange
          ? notice(
              "Selecione um intervalo de até 10 anos para esta consulta demonstrativa.",
            )
          : "") +
        dataTable(
          "Aniversariantes",
          ["Nome", "Data", "Dias", "Telefone/Celular", "Ações"],
          selected.map((client) => [
            h(client.name),
            fmtDate(client.date),
            badge("A definir"),
            unknown(),
            detailButton(`report:birthday:${client.id}`),
          ]),
          state,
        ),
      "Datas de aniversário são inteiramente inventadas. O período é uma proposta de consulta Fonseca; o significado de Dias ainda será definido. Nenhuma mensagem é enviada.",
    )
  );
}

export function renderReports(
  state: AdminState,
  appointments: Appointment[],
): string {
  const selected = pick(state.tab, reportTabs);
  if (state.from && state.to && state.from > state.to) {
    const subNavigation =
      selected === "Agendamentos"
        ? tabs(appointmentTabs, pick(state.subtab, appointmentTabs), "subtab")
        : selected === "Resumo"
          ? tabs(summaryTabs, pick(state.subtab, summaryTabs), "subtab")
          : "";
    return (
      tabs(reportTabs, selected) +
      subNavigation +
      toolbar(state, periodFields(state)) +
      panel(
        "Corrija o período da consulta",
        notice(
          "Os resultados demonstrativos aguardam um período válido. Ajuste a data inicial ou final para continuar; nenhum total foi calculado.",
        ),
      )
    );
  }
  const content =
    selected === "Agendamentos"
      ? appointmentsReport(state, appointments)
      : selected === "Clientes"
        ? clientsReport(state, appointments)
        : selected === "Resumo"
          ? summaryReport(state)
          : birthdayReport(state);
  return (
    tabs(reportTabs, selected) +
    notice(
      "Consultas de demonstração · todos os registros e valores são fictícios. Relatórios são independentes da área Raio-X.",
    ) +
    content
  );
}

export function reportsDetail(key: string): string | undefined {
  if (key === "report:subscription-links")
    return detailContent(
      "Agendamentos de assinaturas",
      "<p>Esta consulta depende de um vínculo explícito entre agendamento, assinatura e regra de utilização. A base fictícia atual não possui esses vínculos.</p><p>Um horário recorrente não indica uma assinatura comercial. Consumo, cobrança, renovação e estorno não são simulados.</p>",
    );
  if (key === "report:sales")
    return detailContent(
      "Dados de vendas ausentes",
      "<p>Produção por competência, venda e liquidação são eventos diferentes. A amostra de produção não informa recebimentos, descontos, estornos ou vendas de produtos conciliadas.</p><p>Os totais de vendas permanecerão não disponíveis até que exista um conjunto demonstrativo específico ou uma integração validada.</p>",
    );
  const [, type, id] = key.split(":");
  if (!key.startsWith("report:") || !["client", "birthday"].includes(type))
    return undefined;
  const client = reportClients.find((row) => row.id === id);
  if (!client) return undefined;
  return detailContent(
    client.name,
    `<p>Registro fictício usado somente nos relatórios.</p><dl class="admin-detail-list"><dt>Cadastro sintético</dt><dd>${fmtDate(client.registeredAt)}</dd><dt>Acesso</dt><dd>${h(client.accessStatus)}</dd><dt>Aniversário sintético</dt><dd>${client.birthdayMonthDay.slice(3)}/${client.birthdayMonthDay.slice(0, 2)}</dd><dt>Telefone</dt><dd>Não informado</dd></dl><p>Não há login, contato ou envio de mensagem conectado a este registro. Datas e classificações de acesso são exemplos inventados.</p>`,
  );
}
