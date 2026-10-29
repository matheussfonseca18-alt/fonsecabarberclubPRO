export const registryRoutes = [
  "Clientes",
  "Profissionais",
  "Serviços",
  "Produtos",
];
const icons: Record<string, string> = {
  Dashboard: "◈",
  Agenda: "▦",
  Clientes: "♙",
  Profissionais: "♧",
  Serviços: "✂",
  Produtos: "◇",
  Comandas: "▤",
  Assinaturas: "♛",
  Financeiro: "↗",
  Relatórios: "▥",
  "Raio-X": "◎",
  Metas: "⚑",
  Configurações: "⚙",
};
export function navigation(route: string, expanded: boolean) {
  const link = (name: string, child = false) =>
    `<a href="#${encodeURIComponent(name)}" class="${route === name ? "active" : ""} ${child ? "nav-child" : ""}" ${route === name ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icons[name]}</span>${name}</a>`;
  return `<nav aria-label="Menu principal">${link("Dashboard")}${link("Agenda")}<button class="nav-group ${registryRoutes.includes(route) ? "current-group" : ""}" data-action="registries" aria-controls="registry-links" aria-expanded="${expanded}"><span class="nav-icon" aria-hidden="true">▱</span>Cadastros<span class="nav-chevron" aria-hidden="true">${expanded ? "⌃" : "⌄"}</span></button><div id="registry-links" ${expanded ? "" : "hidden"}>${registryRoutes.map((name) => link(name, true)).join("")}</div>${link("Comandas")}${link("Assinaturas")}<span class="nav-label">INTELIGÊNCIA & GESTÃO</span>${["Financeiro", "Relatórios", "Raio-X", "Metas", "Configurações"].map((name) => link(name)).join("")}</nav>`;
}
