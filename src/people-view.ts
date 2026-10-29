import {
  type AdminState,
  badge,
  dataTable,
  detailButton,
  detailContent,
  field,
  h,
  matchQuery,
  notice,
  panel,
  toolbar,
} from "./admin-ui.ts";
import {
  demoClients,
  demoProfessionals,
  type DirectoryPerson,
} from "./demo-directory.ts";
import { production } from "./demo.ts";
import { aggregate, money } from "./domain.ts";

export function filterDirectory(
  rows: readonly DirectoryPerson[],
  state: AdminState,
) {
  return rows.filter(
    (person) =>
      matchQuery(
        state.query,
        person.name,
        person.email,
        person.login,
        person.nickname,
      ) &&
      (state.status !== "Ativos" || person.active) &&
      (state.status !== "Inativos" || !person.active),
  );
}

export function renderPeople(route: string, state: AdminState): string {
  const isClient = route === "Clientes";
  const source = isClient ? demoClients : demoProfessionals;
  const filtered = filterDirectory(source, state);
  const stateFilter = ["Ativos", "Inativos"].includes(state.status)
    ? state.status
    : "Todos";
  const rows = filtered.map((person) => [
    `<strong>${h(person.name)}</strong><small class="admin-cell-note">Cadastro fictício</small>`,
    h(person.phone),
    h(person.email),
    h(isClient ? person.login : person.nickname),
    ...(isClient ? [] : [h(person.specialty)]),
    badge(
      person.active ? "Ativo" : "Inativo",
      person.active ? "success" : "neutral",
    ),
    detailButton(`directory:${person.id}`),
  ]);
  return (
    notice(
      "Dados de demonstração. Os e-mails usam example.test e não recebem mensagens; nenhum telefone real é exibido.",
    ) +
    panel(
      isClient ? "Clientes cadastrados" : "Profissionais cadastrados",
      toolbar(
        state,
        field(
          "status",
          "Situação",
          ["Todos", "Ativos", "Inativos"],
          stateFilter,
        ),
      ) +
        dataTable(
          isClient ? "Cadastro de Clientes" : "Cadastro de Profissionais",
          [
            "Nome completo",
            "Celular",
            "E-mail",
            isClient ? "Login" : "Apelido",
            ...(isClient ? [] : ["Especialidade"]),
            "Situação",
            "Ações",
          ],
          rows,
          state,
          "Nenhum cadastro corresponde à pesquisa e à situação selecionadas.",
        ),
      `${source.length} cadastros fictícios · pesquisa por nome, e-mail, login ou apelido · somente consulta`,
    )
  );
}

export function peopleDetail(key: string): string | undefined {
  if (!key.startsWith("directory:")) return undefined;
  const id = key.slice("directory:".length);
  const person = [...demoClients, ...demoProfessionals].find(
    (item) => item.id === id,
  );
  if (!person) return undefined;
  const isClient = id.startsWith("client-");
  const summary = isClient
    ? aggregate(
        production.filter((item) => item.client === person.name),
        "2026-10-01",
        "2026-10-31",
      )
    : aggregate(production, "2026-10-01", "2026-10-31", person.name);
  const facts = [
    ["Nome completo", person.name],
    ["Celular", person.phone],
    ["E-mail fictício", person.email],
    ["Login demonstrativo", person.login],
    ["Situação na demo", person.active ? "Ativo" : "Inativo"],
    ...(!isClient
      ? [
          ["Apelido", person.nickname],
          ["Especialidade", person.specialty],
          [
            "Comissão de referência",
            "40% · estimativa fictícia; fórmula real pendente",
          ],
        ]
      : []),
  ];
  return detailContent(
    person.name,
    `<p class="admin-muted">${isClient ? "Cadastro de cliente" : "Cadastro de profissional"} · consulta demonstrativa</p>` +
      `<dl class="admin-facts">${facts.map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join("")}</dl>` +
      `<div class="admin-note"><strong>Referência analítica · outubro de 2026</strong><p>${summary.count} atendimentos fictícios · ${money(summary.revenue)} de produção por competência.</p><p>A amostra de produção é independente dos agendamentos da sessão. Produção não confirma recebimento${isClient ? "." : " ou pagamento de comissão."}</p></div>` +
      notice(
        "Consulta sem edição. Login é um identificador ilustrativo, sem senha ou autenticação. Nenhuma mensagem será enviada.",
      ),
  );
}
