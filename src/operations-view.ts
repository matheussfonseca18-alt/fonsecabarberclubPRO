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
  actionButton,
} from "./admin-ui.ts";
import { professionals } from "./demo.ts";
import { money } from "./domain.ts";
import {
  orderFixtures,
  planFixtures,
  subscriberFixtures,
  type DemoOrder,
  type DemoPlan,
  type DemoSubscriber,
} from "./demo-operations.ts";

const applies = (value: string, selected: string) =>
  !selected || selected === "Todos" || value === selected;
const planName = (id: string) =>
  planFixtures.find((plan) => plan.id === id)?.name ?? "Plano não informado";
const info = (pairs: [string, string][]) =>
  `<dl class="admin-detail-list">${pairs.map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join("")}</dl>`;

export function selectOrders(state: AdminState): DemoOrder[] {
  return orderFixtures.filter(
    (order) =>
      (state.tab === "Histórico" || order.status === "Aberta") &&
      (state.tab !== "Histórico" || applies(order.status, state.status)) &&
      applies(order.professional, state.professional) &&
      inPeriod(order.date, state) &&
      matchQuery(
        state.query,
        order.id,
        order.client,
        order.professional,
        order.service,
      ),
  );
}

export function selectPlans(state: AdminState): DemoPlan[] {
  return planFixtures.filter(
    (plan) =>
      applies(plan.type, state.type) &&
      matchQuery(state.query, plan.name, plan.periodicity, plan.type),
  );
}

export function selectSubscribers(state: AdminState): DemoSubscriber[] {
  return subscriberFixtures.filter(
    (subscriber) =>
      applies(subscriber.status, state.status) &&
      applies(planName(subscriber.planId), state.plan) &&
      applies(subscriber.type, state.type) &&
      matchQuery(
        state.query,
        subscriber.client,
        planName(subscriber.planId),
        subscriber.status,
      ),
  );
}

export function renderOrders(state: AdminState): string {
  const active = state.tab === "Histórico" ? "Histórico" : "Abertas";
  const isHistory = active === "Histórico";
  const rows = selectOrders({ ...state, tab: active });
  const filters =
    periodFields(state) +
    field(
      "professional",
      "Profissional",
      ["Todos", ...professionals],
      state.professional,
    ) +
    (isHistory
      ? field(
          "status",
          "Mostrar comandas",
          ["Todos", "Aberta", "Encerrada", "Cancelada"],
          state.status,
        )
      : "");
  const headers = isHistory
    ? [
        "Comanda",
        "Status",
        "Data",
        "Valor",
        "Cliente",
        "Cadastro",
        "Profissional",
        "Data caixa",
        "Ações",
      ]
    : [
        "Comanda",
        "Cartão",
        "Data",
        "Valor",
        "Cliente",
        "Profissional",
        "Ações",
      ];
  const cells = rows.map((order) =>
    isHistory
      ? [
          `<strong>#${h(order.id)}</strong>`,
          badge(`${order.status} · demo`),
          fmtDate(order.date),
          money(order.cents),
          h(order.client),
          h(order.registration ?? "Não informado"),
          h(order.professional),
          order.cashDate ? fmtDate(order.cashDate) : "Não informado",
          detailButton(`order:${order.id}`, `Consultar #${order.id}`),
        ]
      : [
          `<strong>#${h(order.id)}</strong>`,
          h(order.card ?? "Não informado"),
          fmtDate(order.date),
          money(order.cents),
          h(order.client),
          h(order.professional),
          detailButton(`order:${order.id}`, `Consultar #${order.id}`),
        ],
  );
  return (
    tabs(["Abertas", "Histórico"], active) +
    notice(
      "Consulta de comandas fictícias. Status de encerramento não comprova recebimento, produção ou comissão; os vínculos de caixa não estão definidos.",
    ) +
    panel(
      isHistory ? "Histórico de comandas" : "Comandas abertas",
      `<div class="admin-actions">${actionButton("order:about", "Como funciona esta consulta")}</div>` +
        toolbar(state, filters) +
        dataTable(
          isHistory ? "Histórico de comandas" : "Comandas abertas",
          headers,
          cells,
          state,
          "Nenhuma comanda corresponde ao período e aos filtros escolhidos.",
        ),
      isHistory
        ? "Histórico da amostra, incluindo todos os estados propostos nesta demo Fonseca. Filtros são aplicados automaticamente. O significado de Cadastro ainda não foi definido."
        : "Amostra de comandas abertas. Cartão é um campo observado, cuja finalidade ainda precisa de definição; não há dados de pagamento.",
    )
  );
}

export function renderSubscriptions(state: AdminState): string {
  const active = state.tab === "Assinantes" ? "Assinantes" : "Planos";
  const common =
    tabs(["Planos", "Assinantes"], active) +
    notice(
      "Gestão demonstrativa de planos e assinantes. Nenhuma cobrança, renovação, reserva de benefício ou cancelamento é executado.",
    );
  if (active === "Planos") {
    const rows = selectPlans(state).map((plan) => [
      `<strong>${h(plan.name)}</strong>`,
      `Dia ${plan.dueDay} · demo`,
      h(plan.periodicity),
      money(plan.cents),
      badge(plan.type),
      detailButton(`plan:${plan.id}`, `Consultar ${plan.name}`),
    ]);
    return (
      common +
      panel(
        "Planos de assinatura",
        `<div class="admin-actions">${actionButton("plan:about", "Sobre os planos demo")}</div>` +
          toolbar(
            state,
            field("type", "Tipo", ["Todos", "Plano demonstrativo"], state.type),
          ) +
          dataTable(
            "Planos de assinatura",
            [
              "Descrição",
              "Dia de vencimento",
              "Periodicidade",
              "Valor",
              "Tipo",
              "Ações",
            ],
            rows,
            state,
            "Nenhum plano corresponde à pesquisa e ao tipo selecionado.",
          ),
        "Valores, benefícios, periodicidade e tipos são exemplos próprios da demo Fonseca. Dias de vencimento são referências visuais e não configuram cobrança.",
      )
    );
  }
  const filters =
    field(
      "status",
      "Status da assinatura",
      ["Todos", "Ativa", "Inativa"],
      state.status,
    ) +
    field(
      "plan",
      "Plano",
      ["Todos", ...planFixtures.map((plan) => plan.name)],
      state.plan,
    ) +
    field("type", "Tipo", ["Todos", "Adesão demonstrativa"], state.type);
  const rows = selectSubscribers(state).map((subscriber) => [
    `<strong>${h(subscriber.client)}</strong>`,
    h(planName(subscriber.planId)),
    subscriber.nextDue ? fmtDate(subscriber.nextDue) : "Não informado",
    badge(`${subscriber.status} · demo`),
    h(subscriber.type),
    detailButton(
      `subscriber:${subscriber.id}`,
      `Consultar ${subscriber.client}`,
    ),
  ]);
  return (
    common +
    panel(
      "Assinantes",
      `<div class="admin-actions">${actionButton("subscriber:about", "Entender os estados demo")}</div>` +
        toolbar(state, filters) +
        dataTable(
          "Assinantes",
          ["Nome", "Plano", "Próximo vencimento", "Status", "Tipo", "Ações"],
          rows,
          state,
          "Nenhum assinante corresponde aos filtros escolhidos.",
        ),
      "Ativa e Inativa são estados propostos nesta demo Fonseca. Vencimentos são referências visuais; não indicam pagamento, inadimplência ou consumo de plano.",
    )
  );
}

export function operationsDetail(key: string): string | undefined {
  if (key === "order:about")
    return detailContent(
      "Consulta de comandas",
      `<p>Abertas mostra as comandas fictícias nesse estado. Histórico inclui toda a amostra e permite combinar período, status, profissional e pesquisa. A organização em abas e os estados são propostas da demo Fonseca.</p><p>Os rótulos Cartão e Cadastro foram observados, mas seus significados ainda não foram confirmados. Por isso permanecem sem valor; Cartão não é interpretado como cartão de crédito e Cadastro não é tratado como data.</p>${notice("Esta consulta não finaliza, cancela ou recebe valores. Estados, cálculos, meios de pagamento, cancelamento, estorno, fechamento e vínculos de caixa ainda precisam de especificação.")}`,
    );
  if (key === "plan:about")
    return detailContent(
      "Planos demonstrativos",
      `<p>A organização administrativa segue as colunas observadas. As abas, tipos, periodicidade, nomes Essencial, Signature e Black Club, preços e benefícios são escolhas próprias da demonstração Fonseca, sem alegação de equivalência operacional ao AppBarber.</p>${notice("Forma de cobrança, renovação, reajuste, desconto, rateio, inadimplência, cancelamento e regras de consumo ainda não foram definidos. Nada é enviado ao Stripe ou a outro serviço.")}`,
    );
  if (key === "subscriber:about")
    return detailContent(
      "Estados dos assinantes",
      `<p>Os filtros consultam adesões fictícias Ativas ou Inativas. Não existem faturas, verificação de pagamento, agenda recorrente ou consumo de benefícios vinculados a esses estados.</p>${notice("Assinatura comercial e agendamento recorrente são conceitos diferentes. Uma adesão nesta tabela não cria horários na Agenda.")}`,
    );
  const [kind, id] = key.split(":");
  if (kind === "order") {
    const order = orderFixtures.find((item) => item.id === id);
    if (!order) return undefined;
    return detailContent(
      `Comanda #${order.id}`,
      `<p>Consulta de um atendimento fictício · ${h(order.status.toLowerCase())} na demo.</p>` +
        info([
          ["Cliente", order.client],
          ["Profissional", order.professional],
          ["Data", fmtDate(order.date)],
          ["Cadastro", order.registration ?? "Não informado"],
          ["Serviço ilustrativo", order.service],
          ["Quantidade", "1"],
          ["Valor de referência", money(order.cents)],
          ["Cartão", order.card ?? "Não informado"],
          [
            "Data caixa",
            order.cashDate ? fmtDate(order.cashDate) : "Não informado",
          ],
          ["Pagamento", "Ausente — não existe registro de recebimento"],
        ]) +
        notice(
          "Esta comanda é uma amostra independente. Não gera produção, comissão, baixa de estoque ou movimento de caixa. Valores cancelados também não constituem estorno financeiro.",
        ),
    );
  }
  if (kind === "plan") {
    const plan = planFixtures.find((item) => item.id === id);
    if (!plan) return undefined;
    return detailContent(
      plan.name,
      `<p>Plano demonstrativo · benefícios próprios do Fonseca.</p>` +
        info([
          ["Valor ilustrativo", money(plan.cents)],
          ["Periodicidade ilustrativa", plan.periodicity],
          ["Dia de vencimento ilustrativo", String(plan.dueDay)],
          ["Tipo", plan.type],
        ]) +
        `<h3>Benefícios de referência</h3><ul>${plan.benefits.map((benefit) => `<li>${h(benefit)}</li>`).join("")}</ul>` +
        notice(
          "Não há regra ativa de cobrança ou consumo. Esses benefícios não bloqueiam horários, não geram créditos e não representam uma contratação.",
        ),
    );
  }
  if (kind === "subscriber") {
    const subscriber = subscriberFixtures.find((item) => item.id === id);
    if (!subscriber) return undefined;
    return detailContent(
      subscriber.client,
      `<p>Adesão fictícia · nenhuma informação real de cliente.</p>` +
        info([
          ["Plano", planName(subscriber.planId)],
          ["Status na demo", subscriber.status],
          [
            "Próximo vencimento ilustrativo",
            subscriber.nextDue ? fmtDate(subscriber.nextDue) : "Não informado",
          ],
          ["Tipo", subscriber.type],
          ["Pagamento", "Ausente"],
          ["Consumo de benefícios", "Não implementado"],
        ]) +
        notice(
          "Consultar uma adesão não confirma pagamento, renovação, inadimplência ou uso de benefícios. Não é possível alterar ou cancelar uma assinatura nesta demonstração.",
        ),
    );
  }
  return undefined;
}
