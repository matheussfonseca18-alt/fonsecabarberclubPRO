import type {
  CatalogKind,
  CatalogReadResult,
  CatalogRowMap,
  ProfessionalCatalogRow,
  ServiceCatalogRow,
  ProductCatalogRow,
} from "./data/catalog-read.ts";

export type CatalogReadFilters = {
  query: string;
  status: string;
  page: number;
  pageSize: number;
};
export type CatalogReadLoading = { state: "loading" };

export const defaultCatalogReadFilters: Readonly<CatalogReadFilters> = {
  query: "",
  status: "Todos",
  page: 1,
  pageSize: 10,
};

const statusOptions = ["Todos", "Ativos", "Inativos", "Não informado"];
const pageSizes = [5, 10, 25];
const titles: Record<CatalogKind, string> = {
  professionals: "Profissionais importados",
  services: "Serviços importados",
  products: "Produtos importados",
};
const escapeHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const optionalText = (value: string | null) =>
  value === null ? "Não informado" : value;
const price = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const statusText = (active: boolean | null) =>
  active === null ? "Não informado" : active ? "Ativo" : "Inativo";
const statusBadge = (active: boolean | null) =>
  `<span class="catalog-read-status catalog-read-status-${active === null ? "unknown" : active ? "active" : "inactive"}">${statusText(active)}</span>`;

function rowName(kind: CatalogKind, row: CatalogRowMap[CatalogKind]): string {
  return kind === "professionals"
    ? (row as ProfessionalCatalogRow).full_name
    : (row as ServiceCatalogRow | ProductCatalogRow).name;
}

function searchText(
  kind: CatalogKind,
  row: CatalogRowMap[CatalogKind],
): string {
  if (kind === "professionals") {
    const item = row as ProfessionalCatalogRow;
    return [item.full_name, item.display_name]
      .filter((value) => value !== null)
      .join(" ");
  }
  if (kind === "services") {
    const item = row as ServiceCatalogRow;
    return [item.name, item.category]
      .filter((value) => value !== null)
      .join(" ");
  }
  const item = row as ProductCatalogRow;
  return [item.name, item.brand, item.category, item.unit]
    .filter((value) => value !== null)
    .join(" ");
}

function normalizeFilters(
  input: Partial<CatalogReadFilters> = {},
): CatalogReadFilters {
  const merged = { ...defaultCatalogReadFilters, ...input };
  return {
    query: typeof merged.query === "string" ? merged.query : "",
    status: statusOptions.includes(merged.status) ? merged.status : "Todos",
    page: Number.isFinite(merged.page)
      ? Math.max(1, Math.floor(merged.page))
      : 1,
    pageSize: pageSizes.includes(merged.pageSize) ? merged.pageSize : 10,
  };
}

const controls = (
  filters: CatalogReadFilters,
) => `<div class="catalog-read-controls">
  <label class="catalog-read-filter"><span>Situação</span><select data-catalog-field="status" aria-label="Situação do catálogo">${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${status === filters.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label>
  <label class="catalog-read-page-size"><span>Mostrar</span><select data-catalog-field="pageSize" aria-label="Registros por página">${pageSizes.map((size) => `<option value="${size}" ${size === filters.pageSize ? "selected" : ""}>${size}</option>`).join("")}</select><span>registros</span></label>
  <div class="catalog-read-search"><label><span>Pesquisar</span><input type="search" data-catalog-field="query" aria-label="Pesquisar no catálogo importado" placeholder="Buscar nos registros disponíveis" value="${escapeHtml(filters.query)}"></label><button type="button" data-catalog-reset>Limpar filtros</button></div>
</div>`;

const headers: Record<CatalogKind, string[]> = {
  professionals: ["Nome completo", "Nome de exibição", "Situação", "Ações"],
  services: [
    "Descrição",
    "Categoria",
    "Valor",
    "Duração avulsa",
    "Situação",
    "Ações",
  ],
  products: [
    "Descrição",
    "Marca",
    "Categoria",
    "Valor de venda",
    "Unidade",
    "Situação",
    "Ações",
  ],
};

function cells(kind: CatalogKind, row: CatalogRowMap[CatalogKind]): string[] {
  const name = rowName(kind, row);
  const details = `<button type="button" class="catalog-read-detail-button" data-catalog-detail="${escapeHtml(row.entity_id)}" aria-label="Ver detalhes de ${escapeHtml(name)}">Detalhes <span aria-hidden="true">↗</span></button>`;
  if (kind === "professionals") {
    const item = row as ProfessionalCatalogRow;
    return [
      `<strong>${escapeHtml(item.full_name)}</strong>`,
      escapeHtml(optionalText(item.display_name)),
      statusBadge(item.active),
      details,
    ];
  }
  if (kind === "services") {
    const item = row as ServiceCatalogRow;
    return [
      `<strong>${escapeHtml(item.name)}</strong>`,
      escapeHtml(optionalText(item.category)),
      price(item.price_cents),
      `${item.standalone_duration_minutes} min`,
      statusBadge(item.active),
      details,
    ];
  }
  const item = row as ProductCatalogRow;
  return [
    `<strong>${escapeHtml(item.name)}</strong>`,
    escapeHtml(optionalText(item.brand)),
    escapeHtml(optionalText(item.category)),
    price(item.sale_price_cents),
    escapeHtml(optionalText(item.unit)),
    statusBadge(item.active),
    details,
  ];
}

function boundaryState(
  state: "inactive" | "signed-out" | "forbidden" | "error" | "loading",
): string {
  const copy = {
    inactive: [
      "Consulta inativa",
      "O acesso ao catálogo importado ainda não foi ativado. Aguarde a liberação para consultar os registros.",
    ],
    "signed-out": [
      "Entrada pendente",
      "É necessário entrar com uma conta autorizada. A consulta ficará indisponível até a sessão ser confirmada.",
    ],
    forbidden: [
      "Acesso não autorizado",
      "A consulta deste catálogo não está autorizada para a sessão atual. A liberação depende da permissão de acesso.",
    ],
    error: [
      "Falha na consulta",
      "Não foi possível carregar o catálogo. A consulta poderá ser repetida quando o acesso estiver disponível; nenhum resultado está sendo apresentado.",
    ],
    loading: [
      "Carregando catálogo",
      "Aguarde a resposta da consulta autorizada.",
    ],
  } as const;
  const [title, message] = copy[state];
  return `<div class="catalog-read-boundary" data-catalog-state="${state}" role="${state === "error" || state === "forbidden" ? "alert" : "status"}" ${state === "loading" ? 'aria-busy="true"' : ""}><span class="catalog-read-boundary-mark" aria-hidden="true">${state === "loading" ? "◌" : state === "error" ? "!" : "◇"}</span><h3>${title}</h3><p>${message}</p>${state === "loading" ? '<div class="catalog-read-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>' : ""}</div>`;
}

function pagination(total: number, page: number, pageSize: number): string {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pages = Array.from({ length: count }, (_, index) => index + 1).filter(
    (number) =>
      number === 1 || number === count || Math.abs(number - page) <= 1,
  );
  return `<div class="catalog-read-footer"><span>Mostrando ${first}–${last} de ${total} ${total === 1 ? "registro" : "registros"}</span><div class="catalog-read-pagination" role="group" aria-label="Paginação do catálogo importado"><button type="button" data-catalog-page="${page - 1}" aria-label="Página anterior" ${page === 1 ? "disabled" : ""}>‹ Anterior</button>${pages.map((number, index) => `${index > 0 && number - pages[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : ""}<button type="button" data-catalog-page="${number}" aria-label="Página ${number}" ${number === page ? 'aria-current="page"' : ""}>${number}</button>`).join("")}<button type="button" data-catalog-page="${page + 1}" aria-label="Próxima página" ${page === count ? "disabled" : ""}>Próxima ›</button></div></div>`;
}

export function renderCatalogRead<K extends CatalogKind>(
  kind: K,
  result: CatalogReadResult<K> | CatalogReadLoading,
  filterState: Partial<CatalogReadFilters> = {},
): string {
  const title = titles[kind];
  const begin = `<section class="catalog-read" aria-label="${title}"><div class="catalog-read-heading"><h2>${title}</h2><span class="catalog-read-badge">Somente leitura</span></div><p class="catalog-read-note">Informações importadas em validação. Esta consulta não habilita operação em produção.</p>`;
  if (result.state !== "ready")
    return begin + boundaryState(result.state) + "</section>";
  if (result.kind !== kind || result.total <= 0 || result.rows.length !== result.total)
    return begin + boundaryState("error") + "</section>";
  const filters = normalizeFilters(filterState);
  const query = normalize(filters.query.trim());
  const rows = result.rows.filter((row) => {
    const statusMatches =
      filters.status === "Todos" ||
      (filters.status === "Ativos" && row.active === true) ||
      (filters.status === "Inativos" && row.active === false) ||
      (filters.status === "Não informado" && row.active === null);
    return statusMatches && normalize(searchText(kind, row)).includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const paged = rows.slice(
    (page - 1) * filters.pageSize,
    page * filters.pageSize,
  );
  const empty = '<h3>Nenhum resultado para os filtros</h3><p>Altere a pesquisa ou a situação para consultar os registros disponíveis.</p><button type="button" data-catalog-reset>Limpar filtros</button>';
  return (
    begin +
    controls(filters) +
    `<div class="catalog-read-table-scroll" tabindex="0" role="region" aria-label="Tabela de ${title.toLowerCase()}"><table class="catalog-read-table"><caption class="catalog-read-sr-only">${title} · consulta de dados importados em validação</caption><thead><tr>${headers[kind].map((header) => `<th scope="col">${header}</th>`).join("")}</tr></thead><tbody>${
      paged.length > 0
        ? paged
            .map(
              (row) =>
                `<tr>${cells(kind, row)
                  .map((cell) => `<td>${cell}</td>`)
                  .join("")}</tr>`,
            )
            .join("")
        : `<tr><td colspan="${headers[kind].length}"><div class="catalog-read-empty" role="status">${empty}</div></td></tr>`
    }</tbody></table></div>` +
    pagination(rows.length, page, filters.pageSize) +
    '<p class="catalog-read-footnote">“Não informado” preserva um campo ausente. Um valor de R$ 0,00 permanece zero. Situação e dados importados não confirmam disponibilidade operacional.</p></section>'
  );
}

export function renderCatalogReadDetail<K extends CatalogKind>(
  kind: K,
  row: CatalogRowMap[K],
): string {
  let entries: [string, string][];
  if (kind === "professionals") {
    const item = row as ProfessionalCatalogRow;
    entries = [
      ["Nome completo", item.full_name],
      ["Nome de exibição", optionalText(item.display_name)],
      ["Situação", statusText(item.active)],
    ];
  } else if (kind === "services") {
    const item = row as ServiceCatalogRow;
    entries = [
      ["Descrição", item.name],
      ["Categoria", optionalText(item.category)],
      ["Valor", price(item.price_cents)],
      ["Duração avulsa", `${item.standalone_duration_minutes} min`],
      ["Situação", statusText(item.active)],
    ];
  } else {
    const item = row as ProductCatalogRow;
    entries = [
      ["Descrição", item.name],
      ["Marca", optionalText(item.brand)],
      ["Categoria", optionalText(item.category)],
      ["Valor de venda", price(item.sale_price_cents)],
      ["Unidade", optionalText(item.unit)],
      ["Situação", statusText(item.active)],
    ];
  }
  return `<div class="catalog-read-detail"><span class="catalog-read-badge">Importado · em validação</span><h2 id="dialog-title">${escapeHtml(rowName(kind, row))}</h2><p>Consulta somente leitura. Nenhuma alteração será feita neste registro.</p><dl class="catalog-read-detail-list">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><p class="catalog-read-note">Campos ausentes permanecem “Não informado”. Estas informações não representam autorização para uso em produção.</p></div>`;
}
