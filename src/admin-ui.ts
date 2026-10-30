export type AdminState = {
  tab: string;
  subtab: string;
  query: string;
  status: string;
  from: string;
  to: string;
  professional: string;
  client: string;
  service: string;
  type: string;
  plan: string;
  page: number;
  pageSize: number;
};
export const defaultAdminState = (
  overrides: Partial<AdminState> = {},
): AdminState => ({
  tab: "",
  subtab: "",
  query: "",
  status: "Todos",
  from: "2026-10-01",
  to: "2026-10-31",
  professional: "Todos",
  client: "Todos",
  service: "Todos",
  type: "Todos",
  plan: "Todos",
  page: 1,
  pageSize: 5,
  ...overrides,
});
export const h = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const matchQuery = (query: string, ...values: unknown[]) =>
  normalize(values.join(" ")).includes(normalize(query.trim()));
export const inPeriod = (
  date: string,
  state: Pick<AdminState, "from" | "to">,
) =>
  Boolean(date) &&
  (!state.from || date >= state.from) &&
  (!state.to || date <= state.to);
export const fmtDate = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "Não informado";
export const badge = (text: string, tone = "neutral") =>
  `<span class="admin-badge admin-badge-${h(tone)}">${h(text)}</span>`;
export const notice = (text: string) =>
  `<div class="admin-notice">${h(text)}</div>`;
export const tabs = (
  items: string[],
  active: string,
  kind: "tab" | "subtab" = "tab",
) =>
  `<div class="admin-tabs ${kind === "subtab" ? "admin-subtabs" : ""}" role="group" aria-label="${kind === "tab" ? "Seções da consulta" : "Visões da consulta"}">${items.map((item) => `<button type="button" data-admin-${kind}="${h(item)}" aria-pressed="${active === item}" class="${active === item ? "is-active" : ""}">${h(item)}</button>`).join("")}</div>`;
export const field = (
  key: keyof AdminState,
  label: string,
  options: string[],
  value: string,
) =>
  `<label class="admin-field"><span>${h(label)}</span><select data-admin-field="${h(key)}" aria-label="${h(label)}">${options.map((option) => `<option value="${h(option)}" ${value === option ? "selected" : ""}>${h(option)}</option>`).join("")}</select></label>`;
export const periodFields = (state: AdminState) =>
  `<label class="admin-field"><span>Data inicial</span><input type="date" aria-label="Data inicial" data-admin-field="from" value="${h(state.from)}"></label><label class="admin-field"><span>Data final</span><input type="date" aria-label="Data final" data-admin-field="to" value="${h(state.to)}"></label><button type="button" data-admin-action="today">Hoje</button>${state.from && state.to && state.from > state.to ? '<p class="admin-error" role="alert">A data inicial deve ser anterior ou igual à final.</p>' : ""}`;
export const toolbar = (state: AdminState, extra = "") =>
  `<div class="admin-filters">${extra}</div><div class="admin-toolbar"><label class="admin-page-size">Mostrar <select aria-label="Registros por página" data-admin-field="pageSize">${[5, 10, 25].map((size) => `<option ${state.pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label><div class="admin-search"><label><span>Pesquisar</span><input type="search" aria-label="Pesquisar" placeholder="Buscar nesta consulta" data-admin-field="query" value="${h(state.query)}"></label><button type="button" data-admin-reset>Limpar filtros</button></div></div>`;
export const panel = (title: string, body: string, note = "") =>
  `<section class="admin-panel" aria-label="${h(title)}"><div class="admin-panel-heading"><h2>${h(title)}</h2>${badge("Dados fictícios")}</div>${note ? `<p class="admin-panel-note">${h(note)}</p>` : ""}${body}</section>`;
export function pageSlice<T>(
  rows: T[],
  state: Pick<AdminState, "page" | "pageSize">,
) {
  const size = [5, 10, 25].includes(state.pageSize) ? state.pageSize : 5;
  const count = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(
    1,
    Math.min(count, Number.isFinite(state.page) ? Math.floor(state.page) : 1),
  );
  const start = (page - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    page,
    count,
    start: rows.length ? start + 1 : 0,
    end: Math.min(start + size, rows.length),
    total: rows.length,
  };
}
export function dataTable(
  title: string,
  headers: string[],
  rows: string[][],
  state: AdminState,
  emptyText = "Nenhum registro corresponde aos filtros desta consulta.",
) {
  const page = pageSlice(rows, state);
  const visiblePages = Array.from(
    { length: page.count },
    (_, i) => i + 1,
  ).filter((n) => n === 1 || n === page.count || Math.abs(n - page.page) <= 1);
  return `<div class="admin-table-scroll" role="region" aria-label="${h(title)}" tabindex="0"><table class="admin-table"><caption class="sr-only">${h(title)} · dados fictícios</caption><thead><tr>${headers.map((header) => `<th scope="col">${h(header)}</th>`).join("")}</tr></thead><tbody>${page.rows.length ? page.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}"><div class="admin-empty"><span aria-hidden="true">◇</span><h3>Nenhum resultado</h3><p>${h(emptyText)}</p><button data-admin-reset>Limpar filtros</button></div></td></tr>`}</tbody></table></div><div class="admin-table-footer"><span>Mostrando ${page.start}–${page.end} de ${page.total} registros</span><div class="admin-pagination" role="group" aria-label="Paginação"><button data-admin-page="${page.page - 1}" aria-label="Página anterior" ${page.page === 1 ? "disabled" : ""}>‹ Anterior</button>${visiblePages.map((n) => `<button data-admin-page="${n}" aria-label="Página ${n}" ${page.page === n ? 'aria-current="page"' : ""}>${n}</button>`).join("")}<button data-admin-page="${page.page + 1}" aria-label="Próxima página" ${page.page === page.count ? "disabled" : ""}>Próxima ›</button></div></div>`;
}
export const detailButton = (key: string, label = "Detalhes") =>
  `<button type="button" class="admin-detail-button" data-admin-detail="${h(key)}">${h(label)} <span aria-hidden="true">↗</span></button>`;
export const actionButton = (key: string, label: string) =>
  `<button type="button" data-admin-action="${h(key)}">${h(label)}</button>`;
export const detailContent = (title: string, body: string) =>
  `<h2 id="dialog-title">${h(title)}</h2>${body}`;
export function renderConsultationState(
  mode: "loading" | "error",
  simulated = false,
): string {
  const isLoading = mode === "loading";
  return `<section class="admin-panel admin-consultation-state" aria-label="Estado da consulta"><div role="${isLoading ? "status" : "alert"}"><span class="admin-state-icon" aria-hidden="true">${isLoading ? "◌" : "!"}</span><h2>${isLoading ? "Carregando consulta" : "Não foi possível exibir a consulta"}</h2><p>${simulated ? "Simulação visual: nenhum serviço externo foi consultado e nenhum dado foi alterado." : "A consulta encontrou uma falha. Seus dados de demonstração não foram apagados."}</p>${isLoading ? '<div class="admin-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>' : "<p>A falha é diferente de uma consulta sem resultados.</p>"}</div><button data-admin-action="ready">${isLoading ? "Voltar à consulta" : "Tentar novamente"}</button></section>`;
}
