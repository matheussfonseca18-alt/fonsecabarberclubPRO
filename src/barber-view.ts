import type { BarberUiState } from "./barber-controller.ts";
import type { BarberAppointment, BarberMetric } from "./barber-domain.ts";

export type BarberScreen = "agenda" | "rascunho" | "desempenho" | "mais";
export type BarberEditor = {
  id: string | null;
  kind: "service" | "product";
  description: string;
  quantity: string;
};
export const emptyBarberEditor = (): BarberEditor => ({
  id: null,
  kind: "service",
  description: "",
  quantity: "1",
});
export function barberScreen(hash: string): BarberScreen {
  const value = hash.replace(/^#/u, "");
  return ["agenda", "rascunho", "desempenho", "mais"].includes(value)
    ? (value as BarberScreen)
    : "agenda";
}
export function escapeBarber(value: unknown): string {
  return String(value).replace(
    /[&<>"']/gu,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
const iconPaths: Record<string, string> = {
  agenda:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h3m-3 3h6"/>',
  rascunho:
    '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M16 3l5 5-9 9-5 1 1-5Z"/>',
  desempenho: '<path d="M4 20V10m8 10V4m8 16v-8M2 22h20"/>',
  mais: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
export function barberIcon(name: string) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] ?? iconPaths.mais}</svg>`;
}
function dayLabel(day: string, short = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...(short
      ? { day: "numeric", month: "short" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  }).format(new Date(`${day}T12:00:00Z`));
}
function time(value: string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function dateControls(state: BarberUiState) {
  return `<section class="bm-date" aria-label="Escolher dia"><div class="bm-date__title"><span class="bm-eyebrow">${escapeBarber(dayLabel(state.day, true))}</span><button type="button" class="bm-text-button" data-today data-focus-key="today">Hoje</button></div><div class="bm-date__controls"><button type="button" class="bm-icon-button" data-day-offset="-1" data-focus-key="previous-day" aria-label="Dia anterior">‹</button><label class="bm-date__input"><span class="bm-sr-only">Data da consulta</span><input type="date" value="${escapeBarber(state.day)}" data-day data-focus-key="date" required></label><button type="button" class="bm-icon-button" data-day-offset="1" data-focus-key="next-day" aria-label="Próximo dia">›</button></div><p class="bm-caption">${escapeBarber(dayLabel(state.day))}</p></section>`;
}
function unavailable(state: BarberUiState, area: "agenda" | "desempenho") {
  const messages = {
    unavailable: [
      area === "agenda"
        ? "Sua agenda ainda não está conectada."
        : "Seu desempenho ainda não está disponível.",
      "A consulta depende de acesso individual liberado. Nenhum registro foi consultado.",
    ],
    "signed-out": [
      "Confirme seu acesso para continuar.",
      "Entre com a conta autorizada. O vínculo com seu perfil de barbeiro precisa ser validado.",
    ],
    forbidden: [
      "Esta consulta não foi autorizada.",
      "Seu acesso individual precisa ser conferido antes de mostrar os dados.",
    ],
    error: [
      "Não foi possível conferir os dados.",
      "Tente novamente. Nenhum resultado parcial ou de outro profissional será apresentado.",
    ],
    loading: [
      "Conferindo seu acesso…",
      "Aguarde a consulta do contexto individual.",
    ],
  } as const;
  const mode = state.read.state === "ready" ? "unavailable" : state.read.state;
  const [title, body] = messages[mode];
  return `<section class="bm-empty" aria-labelledby="bm-empty-title"><span class="bm-empty__icon">${barberIcon(mode === "loading" ? "agenda" : "lock")}</span><h2 id="bm-empty-title">${title}</h2><p>${body}</p>${mode === "signed-out" ? '<a class="bm-button bm-button--gold" href="/auth/login">Acessar com minha conta</a>' : `<button type="button" class="bm-button bm-button--outline" data-refresh data-focus-key="refresh" ${mode === "loading" ? "disabled" : ""}>${mode === "loading" ? "Consultando…" : "Atualizar consulta"}</button>`}</section>`;
}
function appointmentRow(
  row: BarberAppointment,
  zone: string,
  selected: boolean,
) {
  return `<li><button type="button" class="bm-appointment ${selected ? "is-selected" : ""}" data-appointment="${escapeBarber(row.id)}" aria-expanded="${selected}" ${selected ? 'aria-controls="bm-detail"' : ""}><span class="bm-appointment__time"><b>${escapeBarber(time(row.startsAt, zone))}</b><small>${escapeBarber(time(row.endsAt, zone))}</small></span><span class="bm-appointment__copy"><strong>${escapeBarber(row.customer.displayName)}</strong><span>${escapeBarber(row.serviceLabels.join(" · ")) || "Serviços não informados"}</span>${row.statusLabel ? `<small>${escapeBarber(row.statusLabel)}</small>` : ""}</span>${barberIcon("arrow")}</button></li>`;
}
function agenda(state: BarberUiState) {
  const ready = state.read.state === "ready" ? state.read.data : null;
  const selected = ready?.appointments.find(
    (row) => row.id === state.selectedAppointmentId && state.detailsOpen,
  );
  return `<div class="bm-page-heading"><p class="bm-eyebrow">SEU DIA, EM FOCO</p><h1 tabindex="-1" data-screen-title>Minha agenda</h1><p>Seus atendimentos, organizados por dia.</p></div>${dateControls(state)}<div class="bm-section-title"><h2>Atendimentos do dia</h2><span>${ready ? `${ready.appointments.length} nesta consulta` : "Consulta pendente"}</span></div>${
    !ready
      ? unavailable(state, "agenda")
      : ready.appointments.length === 0
        ? '<section class="bm-empty"><span class="bm-empty__icon">' +
          barberIcon("agenda") +
          "</span><h2>Nenhum atendimento nesta consulta.</h2><p>Não há atendimentos atribuídos a você no dia consultado. Isso não indica horários livres para agendamento.</p></section>"
        : `<ul class="bm-appointments">${[...ready.appointments]
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
            .map((row) =>
              appointmentRow(
                row,
                ready.timeZone,
                row.id === state.selectedAppointmentId && state.detailsOpen,
              ),
            )
            .join("")}</ul>`
  }${selected && ready && state.detailsOpen ? `<section id="bm-detail" class="bm-panel bm-detail" tabindex="-1" aria-label="Detalhes do atendimento"><div class="bm-section-title"><h2>Detalhes do atendimento</h2><button type="button" class="bm-text-button" data-close-detail>Fechar</button></div><h3>${escapeBarber(selected.customer.displayName)}</h3><p>${escapeBarber(time(selected.startsAt, ready.timeZone))} – ${escapeBarber(time(selected.endsAt, ready.timeZone))}</p><p>${escapeBarber(selected.serviceLabels.join(" · ")) || "Serviços não informados"}</p><button type="button" class="bm-button bm-button--gold" data-link-draft>Preparar rascunho deste atendimento</button><p class="bm-caption">O rascunho não altera a agenda nem conclui o atendimento.</p></section>` : ""}<a class="bm-next-step" href="#rascunho"><span class="bm-next-step__icon">${barberIcon("rascunho")}</span><span><strong>Prepare os itens do atendimento</strong><small>Organize um rascunho de serviços e produtos.</small></span>${barberIcon("arrow")}</a><p class="bm-fine-print">${ready ? `Horários no fuso ${escapeBarber(ready.timeZone)}.` : "A data inicial segue seu dispositivo. O fuso da barbearia será informado na consulta."}</p>`;
}
function draft(state: BarberUiState, editor: BarberEditor) {
  const appointment =
    state.read.state === "ready"
      ? state.read.data.appointments.find(
          (row) => row.id === state.draft.link?.appointmentId,
        )
      : null;
  return `<div class="bm-page-heading"><p class="bm-eyebrow">ALIMENTAR, COM CLAREZA</p><h1 tabindex="-1" data-screen-title>Meu rascunho</h1><p>Serviços e produtos que você quer organizar.</p></div><div class="bm-draft-notice"><span class="bm-status-dot" aria-hidden="true"></span><div><strong>Somente nesta aba</strong><p>Não é uma comanda ou venda. Recarregar ou sair desta página descarta o rascunho.</p></div></div><div class="bm-draft-binding">${barberIcon("agenda")}<span><small>Atendimento</small><strong>${appointment ? escapeBarber(appointment.customer.displayName) : "Sem atendimento vinculado"}</strong></span>${!appointment ? '<a href="#agenda">Ver agenda</a>' : '<span class="bm-tag">Vínculo local</span>'}</div><section class="bm-panel bm-editor" aria-labelledby="bm-editor-title"><div class="bm-section-title"><h2 id="bm-editor-title">${editor.id ? "Editar item do rascunho" : "Adicionar um item"}</h2><span class="bm-tag">LOCAL</span></div><form id="bm-item-form" aria-describedby="bm-draft-help"><div class="bm-form-grid"><label>Tipo de item<select name="kind" data-editor-field="kind" data-focus-key="editor-kind"><option value="service" ${editor.kind === "service" ? "selected" : ""}>Serviço</option><option value="product" ${editor.kind === "product" ? "selected" : ""}>Produto</option></select></label><label>Quantidade<input type="number" name="quantity" min="1" max="99" step="1" required inputmode="numeric" value="${escapeBarber(editor.quantity)}" data-editor-field="quantity" data-focus-key="editor-quantity"></label><label class="bm-form-wide">Descrição do item<input type="text" name="description" required maxlength="120" autocomplete="off" placeholder="Descreva o serviço ou produto" value="${escapeBarber(editor.description)}" data-editor-field="description" data-focus-key="editor-description"></label></div><p id="bm-draft-help" class="bm-caption">Descrição livre para planejamento. Não inclua dados de clientes. Preços e catálogo ainda não estão vinculados.</p><div class="bm-form-actions"><button type="submit" class="bm-button bm-button--gold">${barberIcon(editor.id ? "rascunho" : "plus")}${editor.id ? "Atualizar item local" : "Adicionar ao rascunho"}</button>${editor.id ? '<button type="button" class="bm-button bm-button--outline" data-cancel-edit>Cancelar edição</button>' : ""}</div></form></section><section aria-labelledby="bm-items-title"><div class="bm-section-title"><h2 id="bm-items-title">Itens do rascunho</h2><span>${state.draft.lines.length} de 20 itens</span></div>${state.draft.lines.length ? `<ul class="bm-draft-lines">${state.draft.lines.map((line, index) => `<li class="bm-draft-line"><span class="bm-line-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div class="bm-line-copy"><small>${line.kind === "service" ? "SERVIÇO" : "PRODUTO"} · QUANTIDADE ${line.quantity}</small><strong>${escapeBarber(line.description)}</strong></div><div class="bm-line-actions"><button type="button" data-edit-line="${escapeBarber(line.id)}" aria-label="Editar item ${index + 1}">Editar</button><button type="button" data-remove-line="${escapeBarber(line.id)}" aria-label="Remover item ${index + 1}">Remover</button></div></li>`).join("")}</ul>` : '<div class="bm-list-empty"><p>Nenhum item no rascunho.</p><small>Use o formulário acima para começar.</small></div>'}</section><div class="bm-save-area"><button type="button" class="bm-button bm-button--gold" data-save disabled aria-describedby="bm-save-help">${barberIcon("lock")}Salvar no sistema</button><p id="bm-save-help">Envio indisponível. Os itens não alteram agenda, estoque, produção ou comissão.</p>${state.draft.lines.length ? '<button type="button" class="bm-text-button bm-danger" data-clear-draft>Descartar rascunho</button>' : ""}</div>`;
}
function metric(value: BarberMetric<number> | undefined) {
  return value?.state === "known" ? String(value.value) : "Não informado";
}
function performance(state: BarberUiState) {
  const ready = state.read.state === "ready" ? state.read.data : null;
  const amount = ready?.commission.amount;
  let commission = "Não informado";
  if (amount?.state === "known") {
    const formatter = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: amount.value.currency,
    });
    commission = formatter.format(
      amount.value.minorUnits /
        10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2),
    );
  }
  return `<div class="bm-page-heading"><p class="bm-eyebrow">ACOMPANHAR SEU TRABALHO</p><h1 tabindex="-1" data-screen-title>Meu desempenho</h1><p>Uma visão individual, sem dados da equipe.</p></div>${dateControls(state)}<div class="bm-section-title"><h2>Resumo do dia</h2><span>${ready ? "Informado pelo sistema" : "Consulta pendente"}</span></div><div class="bm-metrics">${[
    ["Atendimentos concluídos", ready?.performance.completedAppointments],
    ["Serviços", ready?.performance.serviceUnits],
    ["Produtos", ready?.performance.productUnits],
  ]
    .map(
      ([label, value]) =>
        `<article class="bm-metric"><h3>${label}</h3><strong class="${(value as BarberMetric<number> | undefined)?.state === "known" ? "" : "is-unknown"}">${metric(value as BarberMetric<number> | undefined)}</strong><p>Somente o seu contexto</p></article>`,
    )
    .join(
      "",
    )}</div><section class="bm-commission" aria-labelledby="bm-commission-title"><div class="bm-section-title"><h2 id="bm-commission-title">Comissão informada</h2><span class="bm-tag">INDIVIDUAL</span></div><strong>${escapeBarber(commission)}</strong><p>${escapeBarber(ready?.commission.periodLabel ?? "Período ainda não informado")}</p><div class="bm-commission__note">O valor depende da regra e da apuração do sistema. Não indica pagamento, saldo disponível ou valor a receber.</div></section>${!ready ? unavailable(state, "desempenho") : ""}<p class="bm-fine-print">Itens do rascunho não entram neste resumo. Nenhum percentual de comissão é aplicado nesta tela.</p>`;
}
function more() {
  return `<div class="bm-page-heading"><p class="bm-eyebrow">SEU ESPAÇO</p><h1 tabindex="-1" data-screen-title>Mais opções</h1><p>Acesso e informações desta área.</p></div><nav class="bm-panel" aria-label="Outras áreas"><a class="bm-button bm-button--outline" href="/inicio">Voltar à página inicial</a></nav><section class="bm-panel bm-access-card"><span class="bm-empty__icon">${barberIcon("lock")}</span><h2>Acesso individual</h2><p>O vínculo entre sua conta e seu perfil de barbeiro precisa ser verificado para consultar atendimentos e desempenho.</p><a class="bm-button bm-button--outline" href="/auth/login">Ir para a tela de acesso</a></section><section class="bm-panel bm-scope"><h2>O que você encontra aqui</h2><ul><li><strong>Minha agenda</strong><span>Consulta dos atendimentos atribuídos a você.</span></li><li><strong>Meu rascunho</strong><span>Organização temporária de serviços e produtos, sem envio.</span></li><li><strong>Meu desempenho</strong><span>Resumo e comissão individual, quando autorizados.</span></li></ul></section><section class="bm-note-panel"><h2>Antes de começar</h2><p>Esta área está em preparação. Consultas reais e gravações ainda não foram liberadas.</p><p>O menu organiza as telas; as permissões precisam ser conferidas pelo sistema em cada consulta. Ele não concede acesso por si só.</p><p>Rascunhos ficam apenas na memória desta aba. Sair, recarregar ou trocar o contexto de acesso limpa os itens. Um rascunho vinculado também é limpo ao trocar de atendimento ou atualizar a consulta.</p></section>`;
}
export function renderBarber(
  state: BarberUiState,
  screen: BarberScreen,
  editor: BarberEditor,
  notFound = false,
) {
  const content = notFound
    ? '<section class="bm-empty"><h1 data-screen-title tabindex="-1">Tela não encontrada</h1><p>Este endereço não pertence à navegação da área do barbeiro.</p><a class="bm-button bm-button--gold" href="/barbeiro#agenda">Abrir minha agenda</a></section>'
    : screen === "agenda"
      ? agenda(state)
      : screen === "rascunho"
        ? draft(state, editor)
        : screen === "desempenho"
          ? performance(state)
          : more();
  const nav = (
    [
      ["agenda", "Agenda"],
      ["rascunho", "Rascunho"],
      ["desempenho", "Desempenho"],
      ["mais", "Mais"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<a href="${notFound ? "/barbeiro" : ""}#${id}" ${!notFound && screen === id ? 'aria-current="page"' : ""}>${barberIcon(id)}<span>${label}</span>${id === "rascunho" && state.draft.lines.length ? `<small aria-label="${state.draft.lines.length} itens locais">${state.draft.lines.length}</small>` : ""}</a>`,
    )
    .join("");
  return `<div class="bm-app"><a class="bm-skip" href="#bm-content">Pular para o conteúdo</a><header class="bm-header"><a class="bm-brand" href="/barbeiro#agenda" aria-label="Fonseca Barber Club — área do barbeiro">FONSECA<span>BARBER CLUB</span></a><div class="bm-header__context"><span>ÁREA DO BARBEIRO</span><strong>${state.read.state === "ready" ? "Consulta individual" : "Prévia sem conexão"}</strong></div></header><div class="bm-layout"><nav class="bm-nav" aria-label="Menu do barbeiro">${nav}</nav><main class="bm-main" id="bm-content" tabindex="-1"><div class="bm-mode-label"><span aria-hidden="true"></span>${state.read.state === "ready" ? "SOMENTE CONSULTA · RASCUNHOS LOCAIS" : "CONSULTAS E ENVIO AINDA NÃO LIBERADOS"}</div>${state.notice ? `<div class="bm-notice ${state.notice.error ? "is-error" : ""}" role="${state.notice.error ? "alert" : "status"}" tabindex="-1" data-notice>${escapeBarber(state.notice.text)}</div>` : ""}${content}<footer class="bm-footer">FONSECA BARBER CLUB <span>Seu trabalho, seu espaço.</span></footer></main></div></div>`;
}
