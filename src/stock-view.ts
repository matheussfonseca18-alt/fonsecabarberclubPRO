import {
  type AdminState,
  actionButton,
  badge,
  dataTable,
  detailButton,
  detailContent,
  field,
  h,
  matchQuery,
  notice,
  panel,
  tabs,
  toolbar,
} from "./admin-ui.ts";
import { demoStock } from "./demo-directory.ts";
import { money } from "./domain.ts";
import { peopleDetail } from "./people-view.ts";

export function filterStock(state: AdminState) {
  return demoStock.filter(
    (item) =>
      matchQuery(state.query, item.name, item.category, item.brand) &&
      (!state.type || state.type === "Todos" || state.type === item.category) &&
      (state.status !== "Com estoque" || item.stock > 0) &&
      (state.status !== "Estoque zerado" || item.stock === 0),
  );
}

export function renderStock(state: AdminState): string {
  const active = ["Fornecedores", "Movimentações"].includes(state.tab)
    ? state.tab
    : "Produtos";
  const navigation = tabs(
    ["Produtos", "Fornecedores", "Movimentações"],
    active,
  );
  const warning = notice(
    "Estoque ilustrativo e separado de Serviços e Extras. Nenhuma compra, venda ou movimentação real é realizada.",
  );
  if (active !== "Produtos") {
    const suppliers = active === "Fornecedores";
    return (
      navigation +
      warning +
      panel(
        active,
        `<div class="admin-empty"><h3>${suppliers ? "Sem fornecedores na amostra" : "Sem movimentos na amostra"}</h3><p>${suppliers ? "Os produtos demonstrativos não têm fornecedor vinculado. Cadastro, contatos e condições comerciais ainda não estão implementados." : "As quantidades exibidas são saldos fictícios de referência, sem lançamentos de entrada ou saída. Esta consulta não representa um histórico real de estoque."}</p>${actionButton(suppliers ? "stock:suppliers-info" : "stock:movements-info", "Sobre esta consulta")}</div>`,
        "Consulta própria do preview · estrutura detalhada e regras ainda pendentes",
      )
    );
  }
  const categories = [
    "Todos",
    ...new Set(demoStock.map((item) => item.category)),
  ];
  const category = categories.includes(state.type) ? state.type : "Todos";
  const status = ["Com estoque", "Estoque zerado"].includes(state.status)
    ? state.status
    : "Todos";
  const filtered = filterStock({ ...state, type: category, status });
  return (
    navigation +
    warning +
    panel(
      "Produtos cadastrados",
      toolbar(
        state,
        field("type", "Categoria", categories, category) +
          field(
            "status",
            "Estoque",
            ["Todos", "Com estoque", "Estoque zerado"],
            status,
          ),
      ) +
        dataTable(
          "Controle de Estoque",
          [
            "Descrição",
            "Categoria",
            "Marca",
            "Comissão",
            "Consumo",
            "Valor",
            "Estoque",
            "Ações",
          ],
          filtered.map((item) => [
            `<strong>${h(item.name)}</strong>`,
            h(item.category),
            h(item.brand),
            badge(item.commissionLabel),
            h(item.consumption),
            money(item.cents),
            `${item.stock} un.`,
            detailButton(`stock:${item.id}`),
          ]),
          state,
          "Nenhum produto corresponde à pesquisa e aos filtros selecionados.",
        ),
      `${demoStock.length} produtos fictícios · preços, marcas e quantidades ilustrativos · comissão e consumo não definidos`,
    )
  );
}

export function directoryDetail(key: string): string | undefined {
  const person = peopleDetail(key);
  if (person) return person;
  if (key === "stock:suppliers-info")
    return detailContent(
      "Consulta de fornecedores",
      notice(
        "Nenhum fornecedor foi vinculado às fixtures. Esta área não cria cadastro nem envia pedidos.",
      ) +
        "<p>O acesso Fornecedores foi observado no levantamento. Seus campos, validações e regras não foram abertos, por isso a demonstração mantém este estado sem inventar um formulário.</p>",
    );
  if (key === "stock:movements-info")
    return detailContent(
      "Consulta de movimentações",
      notice("Sem lançamentos de estoque nesta demonstração.") +
        "<p>Estoque exibido é uma quantidade fictícia de referência. Não há histórico que permita calcular compras, vendas, consumo, custo ou reposição.</p><p>O acesso Movimentações foi observado; seus detalhes e regras permanecem pendentes.</p>",
    );
  if (!key.startsWith("stock:")) return undefined;
  const item = demoStock.find(
    (product) => product.id === key.slice("stock:".length),
  );
  if (!item) return undefined;
  const facts = [
    ["Descrição", item.name],
    ["Categoria", item.category],
    ["Marca fictícia", item.brand],
    ["Valor de referência", money(item.cents)],
    ["Estoque demonstrativo", `${item.stock} un.`],
    ["Comissão", item.commissionLabel],
    ["Consumo", item.consumption],
    ["Fornecedor", item.supplier],
  ];
  return detailContent(
    item.name,
    `<p class="admin-muted">Produto · dados inteiramente fictícios</p><dl class="admin-facts">${facts.map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join("")}</dl>` +
      notice(
        "Somente consulta. Não há edição, exclusão ou movimentação de estoque. Consumo e comissão desconhecidos não equivalem a zero.",
      ),
  );
}
