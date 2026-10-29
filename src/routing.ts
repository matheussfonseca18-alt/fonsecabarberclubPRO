export const routes = [
  "Dashboard",
  "Agenda",
  "Clientes",
  "Profissionais",
  "Serviços",
  "Produtos",
  "Comandas",
  "Assinaturas",
  "Financeiro",
  "Relatórios",
  "Raio-X",
  "Metas",
  "Configurações",
];
export function resolveRoute(hash: string): string {
  try {
    const candidate = decodeURIComponent(hash.replace(/^#\/?/, ""));
    if (candidate === "Serviços / Produtos") return "Serviços";
    return routes.includes(candidate) ? candidate : "Dashboard";
  } catch {
    return "Dashboard";
  }
}
