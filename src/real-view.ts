import { h } from "./admin-ui";
import type { EntityKind } from "./data/contracts";

export const registrationRoutes: Record<string, EntityKind> = {
  Profissionais: "professionals",
  Serviços: "services",
  Produtos: "products",
  Clientes: "clients",
};
export const firstStage = ["Profissionais", "Serviços", "Produtos"];
export const realSections: Record<string, string[]> = {
  Comandas: ["Abertas", "Histórico"],
  Assinaturas: ["Planos", "Assinantes"],
  Financeiro: [
    "Resultado gerencial",
    "Caixa",
    "Histórico de Caixa",
    "Comissões",
    "Conta Cliente",
    "Fluxo de Caixa",
    "Conta Profissional",
  ],
  Relatórios: ["Agendamentos", "Clientes", "Resumo", "Aniversariantes"],
  "Raio-X": ["Empresa", "Profissional"],
  Configurações: ["Conexão", "Etapas", "Critérios de liberação"],
};
const explanations: Record<string, string> = {
  Dashboard:
    "Os indicadores serão calculados sobre registros persistidos e identificados pela origem. Não há dados consultados neste ambiente.",
  Agenda:
    "A agenda depende dos profissionais, serviços e regras de disponibilidade validados. Nenhum horário está sendo oferecido ou reservado.",
  Clientes:
    "Clientes entram em uma etapa posterior à validação de profissionais, serviços e produtos. A lista ainda não foi consultada.",
  Profissionais:
    "Primeira etapa: validar o cadastro dos profissionais. Nome e contatos ainda não foram consultados.",
  Serviços:
    "Primeira etapa: validar descrição, preço e duração dos serviços. Nenhuma regra de comissão foi presumida.",
  Produtos:
    "Primeira etapa: validar descrição e preço dos produtos. Estoque não informado permanece ausente, sem assumir zero.",
  Comandas:
    "Comandas dependem de cadastros e vínculos operacionais aprovados. Encerramento não será usado como prova de recebimento.",
  Assinaturas:
    "Planos e adesões dependerão de regras aprovadas. Cobrança, renovação e consumo não estão ativos.",
  Financeiro:
    "Produção por competência, movimentos por liquidação e pagamento de comissão terão registros separados. Não há saldo ou resultado consultado.",
  Relatórios:
    "Os relatórios dependerão da origem e da qualidade dos registros. Clientes únicos serão calculados no período inteiro, sem somar meses.",
  "Raio-X":
    "Análise da empresa e dos profissionais depende de produção validada. Sem dados, não há estimativa de desempenho nem duplicação de valores.",
  Metas:
    "Nenhuma meta foi definida ou consultada. O progresso depende de uma base validada e de um período explícito.",
};

export function unavailablePanel(route: string, reason: string) {
  return `<section class="real-unavailable" aria-labelledby="unavailable-title"><span class="real-symbol" aria-hidden="true">↗</span><div><span class="eyebrow">DADOS NÃO CONSULTADOS</span><h2 id="unavailable-title">Consulta indisponível</h2><p>${h(reason)}</p><p>${h(explanations[route] ?? "Esta consulta aguarda conexão e autorização.")}</p><p class="real-footnote">Indisponível não significa lista vazia, saldo zero ou ausência de histórico.</p></div></section>`;
}

export function connectionSteps() {
  return `<ol class="real-steps"><li><span>01</span><div><b>Destino e etapas</b><p>Projeto Supabase existente escolhido. Profissionais, serviços e produtos primeiro.</p><small class="real-tag">Sequência confirmada</small></div></li><li><span>02</span><div><b>Primeiro acesso</b><p>Concluir o login com e-mail verificado para identificar a conta autorizada.</p><small class="real-tag pending">Pendente</small></div></li><li><span>03</span><div><b>Consulta restrita</b><p>Vincular a conta verificada aos catálogos aprovados e testar leitura, isolamento e revogação.</p><small class="real-tag pending">Pendente</small></div></li><li><span>04</span><div><b>Liberação por etapas</b><p>Validar cadastros e origem dos registros antes de clientes, histórico e operação.</p><small class="real-tag pending">Produção não liberada</small></div></li></ol>`;
}

function settings(section: string) {
  if (section === "Etapas")
    return `<section class="panel real-panel"><h2>Preparação por partes</h2>${connectionSteps()}<p>O AppBarber permanece como sistema oficial durante esta preparação. Não haverá importação automática.</p></section>`;
  if (section === "Critérios de liberação")
    return `<section class="panel real-panel"><h2>Antes de liberar a consulta</h2><ul class="real-requirements"><li>Primeiro login concluído com e-mail verificado.</li><li>Permissão ligada ao identificador da conta, empresa e lote autorizados.</li><li>Somente os campos necessários dos três catálogos disponíveis para leitura.</li><li>Contas não autorizadas, acesso anônimo e gravações bloqueados.</li><li>Logout, expiração, revogação e falhas de conexão verificados.</li></ul><div class="notice">Esta tela registra requisitos. Não concede acesso, cria contas nem altera permissões.</div></section>`;
  return `<section class="panel real-panel"><h2>Conexão do ambiente</h2><dl class="real-status-grid"><div><dt>Destino pretendido</dt><dd>Projeto Supabase existente</dd></div><div><dt>Consulta no aplicativo</dt><dd>Inativa</dd></div><div><dt>Autenticação</dt><dd>Não configurada</dd></div><div><dt>Permissões de consulta</dt><dd>Aguardando identidade verificada e ativação</dd></div><div><dt>Gravação persistente</dt><dd>Indisponível</dd></div><div><dt>Operação em produção</dt><dd>Não liberada</dd></div></dl><div class="notice">Nenhuma chave ou senha é solicitada nesta tela. O primeiro acesso e a consulta serão validados antes de qualquer etapa de edição.</div><button type="button" data-real-nav="Profissionais">Ver primeira etapa</button></section>`;
}

export function realContent(route: string, section: string, reason: string) {
  const tabs = realSections[route];
  const tabBar = tabs
    ? `<div class="admin-tabs" role="group" aria-label="Seções da consulta">${tabs.map((name) => `<button type="button" data-real-section="${h(name)}" aria-pressed="${name === section}">${h(name)}</button>`).join("")}</div>`
    : "";
  if (route === "Configurações") return tabBar + settings(section);
  if (route === "Agenda")
    return `<div class="real-query-actions"><span>Seleção e revisão local · confirmação ainda indisponível</span><a class="real-primary-link" href="/agendar">Preparar agendamento →</a></div>${unavailablePanel(route, reason)}<a href="#Configura%C3%A7%C3%B5es" class="real-inline-link">Ver preparação da conexão →</a>`;
  if (route === "Dashboard")
    return `<section class="real-intro"><span class="eyebrow">PREPARAÇÃO PARA DADOS REAIS</span><h2>Seu sistema,<br>com os seus dados.</h2><p>O próximo passo é consultar profissionais, serviços e produtos com uma conta verificada. A consulta ainda está inativa.</p><a class="real-primary-link" href="#Profissionais">Começar por profissionais <span>↗</span></a></section><div class="real-stage-grid">${firstStage.map((name, i) => `<a class="real-stage-card" href="#${encodeURIComponent(name)}"><span>0${i + 1}</span><h2>${name}</h2><p>Consulta somente leitura preparada.<br>Acesso ainda não ativado.</p><b>Ver preparação ↗</b></a>`).join("")}</div>${unavailablePanel(route, reason)}`;
  const registration = registrationRoutes[route];
  const formButton =
    registration && firstStage.includes(route)
      ? `<div class="real-query-actions"><span>Estrutura do cadastro disponível para revisão</span><button type="button" data-real-form="${registration}">Ver formulário</button></div>`
      : "";
  return `${tabBar}${formButton}${unavailablePanel(route, reason)}${route === "Financeiro" || route === "Raio-X" ? '<dl class="real-status-grid real-indicators"><div><dt>Produção</dt><dd>Não consultada</dd></div><div><dt>Caixa</dt><dd>Não consultado</dd></div><div><dt>Pagamento de comissão</dt><dd>Não informado</dd></div></dl>' : ""}<a href="#Configura%C3%A7%C3%B5es" class="real-inline-link">Ver preparação da conexão →</a>`;
}

export function registrationForm(kind: EntityKind) {
  const labels: Record<EntityKind, string> = {
    professionals: "profissional",
    services: "serviço",
    products: "produto",
    clients: "cliente",
  };
  const contactFields = kind === "professionals" || kind === "clients";
  const field = (
    label: string,
    name: string,
    type = "text",
    required = false,
  ) =>
    `<label>${label}${required ? ' <span aria-hidden="true">*</span>' : ""}<input name="${name}" type="${type}" ${required ? "required" : ""} autocomplete="off" ${name === "name" ? 'maxlength="120"' : ""}></label>`;
  return `<h2 id="real-dialog-title">Cadastro de ${labels[kind]}</h2><p>Estrutura preparada para revisão. Os campos serão liberados após conexão, autenticação e permissões verificadas.</p><div class="notice" id="form-blocked">Não insira dados reais nesta etapa. Este formulário não coleta, transmite ou salva informações.</div><form id="real-registration-form" autocomplete="off"><fieldset disabled aria-describedby="form-blocked"><legend>Campos previstos</legend>${field(contactFields ? "Nome completo" : "Descrição", "name", "text", true)}<div class="form-grid">${contactFields ? field("Celular (opcional)", "phone", "tel") + field("E-mail (opcional)", "email", "email") : field("Preço em reais", "price", "text", true) + (kind === "services" ? field("Duração em minutos", "durationMinutes", "number", true) : field("Estoque inicial (opcional)", "stockQuantity", "number"))}</div></fieldset><p class="real-footnote">${contactFields ? "Contatos opcionais permanecem ausentes quando não informados. A permissão do usuário não é definida neste cadastro." : kind === "services" ? "Preço e duração precisarão ser confirmados. Não há comissão padrão ou regra de Extras aplicada." : "Estoque ausente não será convertido em zero. Não é uma movimentação de estoque nem confirmação de compra."}</p><p id="real-form-status" role="status"></p><div class="modal-actions"><button type="button" data-real-close>Cancelar</button><button type="submit" class="primary" disabled>Salvar indisponível</button></div></form>`;
}
