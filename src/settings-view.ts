import {
  type AdminState,
  actionButton,
  badge,
  dataTable,
  detailContent,
  h,
  matchQuery,
  notice,
  panel,
  tabs,
  toolbar,
} from "./admin-ui.ts";

const sections = [
  "Identidade",
  "Parâmetros",
  "Funcionamento",
  "Restrições",
  "Avaliações",
  "Conexões",
];
const pendingParameters = [
  [
    "Identificação dos campos",
    "Pendente",
    "Associar cada parâmetro ao seu rótulo antes de definir valores.",
  ],
  [
    "Padrões e unidades",
    "Pendente",
    "Dias, horas e opções genéricas foram observados; a associação a regras não foi validada.",
  ],
  [
    "Permissões e validação",
    "Pendente",
    "Definir quem pode alterar, campos obrigatórios e histórico de mudanças.",
  ],
  [
    "Salvamento",
    "Não conectado",
    "A demonstração não grava configurações nem presume os efeitos de Salvar.",
  ],
];
export function renderSettings(state: AdminState): string {
  const active = sections.includes(state.tab) ? state.tab : sections[0];
  const navigation = tabs(sections, active);
  if (active === "Identidade")
    return (
      navigation +
      panel(
        "Identidade do clube",
        `<div class="admin-info-grid"><article><h3>Fonseca Barber Club</h3>${badge("Unidade demonstrativa")}<p>Identidade própria em preto e dourado. Todos os nomes, valores e contatos deste ambiente são fictícios.</p></article><article><h3>Preferências da demonstração</h3><p>Idioma: português brasileiro.<br>Valores: real brasileiro.<br>Indicadores: outubro de 2026.<br>Agenda: data local no botão Hoje.</p></article><article><h3>Dados desta sessão</h3><p>Novos agendamentos ficam na memória da aba. Recarregar restaura as fixtures. Filtros não alteram cadastros.</p>${actionButton("reset-demo", "Restaurar demonstração")} ${actionButton("demo-states", "Estados da interface")}</article></div>`,
        "Consulta da identidade Fonseca. Edição de estabelecimento e persistência não estão conectadas.",
      )
    );
  if (active === "Parâmetros") {
    const rows = pendingParameters
      .filter((row) => matchQuery(state.query, ...row))
      .map(([label, status, note]) => [h(label), badge(status), h(note)]);
    return (
      navigation +
      notice(
        "Os campos operacionais ainda precisam de especificação. Não há valores padrão ou controles de salvamento simulados.",
      ) +
      panel(
        "Configuração de parâmetros",
        toolbar(state) +
          dataTable(
            "Definições pendentes",
            ["Definição", "Situação", "Próximo passo"],
            rows,
            state,
          ) +
          `<div class="admin-actions">${actionButton("settings:parameters", "Entender as pendências")}</div>`,
        "Organização própria das lacunas do levantamento. Estes itens não representam os campos do AppBarber.",
      )
    );
  }
  if (active === "Funcionamento")
    return (
      navigation +
      notice(
        "A Agenda usa segunda a sábado, das 09h às 19h, como referência fictícia própria. Isso não comprova funcionamento real nem considera feriados, pausas ou exceções.",
      ) +
      panel(
        "Funcionamento",
        toolbar(state) +
          dataTable(
            "Datas de funcionamento",
            ["Data"],
            [],
            state,
            "Não há datas especiais cadastradas na amostra. Horários e exceções reais precisam ser definidos.",
          ) +
          `<div class="admin-actions">${actionButton("settings:hours", "Ver referência da Agenda")}</div>`,
        "Consulta de datas. A evidência confirmou Data; as demais colunas e regras permanecem desconhecidas.",
      )
    );
  if (active === "Restrições")
    return (
      navigation +
      panel(
        "Lista de restrições",
        toolbar(state) +
          dataTable(
            "Restrições",
            ["Cliente", "Restrição"],
            [],
            state,
            "Nenhuma restrição foi incluída nesta demonstração. Ausência de fixture não comprova que clientes estejam liberados para todos os serviços.",
          ) +
          `<div class="admin-actions">${actionButton("settings:restrictions", "Sobre esta consulta")}</div>`,
        "Área administrativa de consulta. Tipos, motivos, efeitos e permissões ainda precisam ser definidos; ninguém é bloqueado aqui.",
      )
    );
  if (active === "Avaliações")
    return (
      navigation +
      panel(
        "Avaliações",
        `<div class="admin-empty"><span aria-hidden="true">☆</span><h3>Área aguardando especificação</h3><p>O levantamento confirmou a página, mas não os campos ou as regras de moderação. Nenhuma avaliação real ou nota fictícia foi atribuída a clientes ou profissionais.</p>${actionButton("settings:reviews", "Ver o que falta definir")}</div>`,
        "Cobertura observada parcial. Esta tela mantém a navegação disponível sem inventar um formulário.",
      )
    );
  return (
    navigation +
    panel(
      "Conexões futuras",
      `<div class="admin-info-grid">${[
        [
          "Dados e permissões",
          "Supabase",
          "Definir contratos, perfis de acesso e histórico antes de integrar.",
        ],
        [
          "Cobrança e assinaturas",
          "Stripe",
          "Cobrança no servidor, confirmação por evento verificado e conciliação.",
        ],
        [
          "Notificações",
          "Canal a definir",
          "Definir consentimento, modelos e preferências de envio.",
        ],
      ]
        .map(
          ([label, name, note]) =>
            `<article><h3>${label}</h3>${badge("Não conectado")}<p><b>${name}</b><br>${note}</p></article>`,
        )
        .join("")}</div>`,
      "Nenhuma chave, token, login ou integração é utilizado. Esta consulta não inicia conexões.",
    )
  );
}
export function settingsDetail(key: string): string | undefined {
  const descriptions: Record<string, [string, string]> = {
    "settings:parameters": [
      "Parâmetros pendentes",
      "É necessário confirmar rótulos, valores permitidos, unidades, padrões, validações e efeitos de cada parâmetro. As opções genéricas observadas não foram convertidas em regras presumidas. Não há configuração salva neste preview.",
    ],
    "settings:hours": [
      "Horário de referência",
      "A demonstração permite agendamentos de segunda a sábado entre 09h e 19h, considerando a duração do serviço. Esta regra é própria da amostra. Pausas, feriados, disponibilidade individual e exceções não foram implementados.",
    ],
    "settings:restrictions": [
      "Restrições administrativas",
      "A consulta apresenta somente os campos Cliente e Restrição observados. Nenhum registro de restrição foi criado. Tipos, motivos, efeitos e permissões precisam de definição antes de permitir qualquer bloqueio.",
    ],
    "settings:reviews": [
      "Avaliações: definição necessária",
      "A página foi identificada, mas os campos, critérios, publicação e moderação não foram confirmados. Esses controles não foram inventados. O retorno à consulta permanece disponível.",
    ],
  };
  const item = descriptions[key];
  return item ? detailContent(item[0], notice(item[1])) : undefined;
}
