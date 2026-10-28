import { productFixtures, services } from "./demo.ts";
import { money } from "./domain.ts";

export type CatalogItem = {
  id: number;
  type: "service" | "product";
  name: string;
  cents: number;
  category: string;
  commissionLabel: string;
  duration?: number;
  stock?: number;
};

export const serviceCatalog: CatalogItem[] = services.map((service, id) => ({
  ...service,
  id,
  type: "service",
  category: ["Cortes", "Barba", "Combos", "Acabamentos"][id],
  commissionLabel: "40% · estimativa demo",
}));

export const products: CatalogItem[] = productFixtures.map((product, id) => ({
  ...product,
  id,
  type: "product",
}));

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function paginateCatalog<T extends { name: string; category: string }>(
  rows: readonly T[],
  query: string,
  requestedPage: number,
  requestedPageSize: number,
) {
  const term = normalize(query.trim());
  const filtered = rows.filter((row) =>
    normalize(`${row.name} ${row.category}`).includes(term),
  );
  const pageSize = [2, 5, 10].includes(requestedPageSize)
    ? requestedPageSize
    : 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const finitePage = Number.isFinite(requestedPage)
    ? Math.floor(requestedPage)
    : 1;
  const page = Math.min(pageCount, Math.max(1, finitePage));
  const offset = (page - 1) * pageSize;
  return {
    rows: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    start: filtered.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, filtered.length),
  };
}

export function catalogItem(
  type: string,
  id: string | number,
): CatalogItem | undefined {
  const source =
    type === "service" ? serviceCatalog : type === "product" ? products : [];
  return source.find((item) => item.id === Number(id));
}

export type CatalogViewOptions = {
  route: string;
  query: string;
  page: number;
  pageSize: number;
};

export function renderCatalog({
  route,
  query,
  page,
  pageSize,
}: CatalogViewOptions): string {
  const isService = route !== "Produtos";
  const result = paginateCatalog(
    isService ? serviceCatalog : products,
    query,
    page,
    pageSize,
  );
  const caption = isService ? "Serviços cadastrados" : "Produtos cadastrados";
  const headers = isService
    ? ["Descrição", "Valor", "Tempo", "Comissão", "Categoria", "Ações"]
    : ["Descrição", "Valor", "Estoque", "Comissão", "Categoria", "Ações"];
  return `<section class="catalog-panel" aria-label="${caption}">
    <div class="catalog-section-head"><h2>${caption}</h2><span class="pill">${result.total} ${result.total === 1 ? "registro fictício" : "registros fictícios"}</span></div>
    <p class="catalog-demo-note">${isService ? "Preços, tempos e categorias são referências fictícias. Comissão de 40% é apenas uma estimativa da demonstração; a regra real não está definida." : "Preços, categorias e estoque são fictícios. Custos e comissões não foram definidos; esta tela não movimenta estoque."}</p>
    <div class="catalog-toolbar">
      <label class="catalog-page-size">Mostrar <select id="page-size" aria-label="Registros por página">${[2, 5, 10].map((size) => `<option value="${size}" ${size === result.pageSize ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label>
      <div class="catalog-search-controls"><label class="catalog-search"><span>Pesquisar</span><input id="search" aria-label="Pesquisar" placeholder="Descrição ou categoria" value="${escapeHtml(query)}" type="search"></label><button type="button" data-action="clear" class="catalog-clear">Limpar</button></div>
    </div>
    <div class="catalog-table-wrap" role="region" aria-label="Tabela de ${isService ? "serviços" : "produtos"}" tabindex="0">
      <table class="catalog-table"><caption class="catalog-sr-only">${caption}; dados demonstrativos</caption><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join("")}</tr></thead>
      <tbody>${result.rows.length ? result.rows.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td class="catalog-money">${money(item.cents)}</td><td>${isService ? `${item.duration} min` : `${item.stock} un.`}</td><td><span class="catalog-commission">${item.commissionLabel}</span></td><td>${escapeHtml(item.category)}</td><td><button type="button" class="catalog-detail" data-detail="${item.type}:${item.id}" aria-label="Detalhes de ${escapeHtml(item.name)}">Detalhes <span aria-hidden="true">↗</span></button></td></tr>`).join("") : `<tr><td colspan="6"><div class="catalog-empty"><h3>Nenhum resultado encontrado</h3><p>Busque outra descrição ou categoria.</p><button type="button" data-action="clear">Limpar filtros</button></div></td></tr>`}</tbody></table>
    </div>
    <div class="catalog-footer"><span>Mostrando ${result.start}–${result.end} de ${result.total} ${result.total === 1 ? "registro" : "registros"}</span><nav class="catalog-pagination" aria-label="Paginação do catálogo"><button type="button" data-page="${result.page - 1}" aria-label="Página anterior" ${result.page === 1 ? "disabled" : ""}>‹ Anterior</button>${Array.from(
      { length: result.pageCount },
      (_, index) => index + 1,
    )
      .map(
        (number) =>
          `<button type="button" data-page="${number}" aria-label="Página ${number}" ${number === result.page ? 'aria-current="page" class="is-current"' : ""}>${number}</button>`,
      )
      .join(
        "",
      )}<button type="button" data-page="${result.page + 1}" aria-label="Próxima página" ${result.page === result.pageCount ? "disabled" : ""}>Próxima ›</button></nav></div>
  </section>`;
}
