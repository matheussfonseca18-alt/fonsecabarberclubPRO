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
const settingsSections = [
  "Identidade", "Parâmetros", "Funcionamento", "Restrições", "Avaliações", "Conexões",
  "Conexão", "Etapas", "Critérios de liberação",
];
export function resolveSettingsSection(hash: string): string | undefined {
  try {
    const candidate = decodeURIComponent(hash.replace(/^#\/?/, ""));
    const segments = candidate.split("/");
    const [page, section] = segments;
    return segments.length === 2 && page === "Configurações" && settingsSections.includes(section)
      ? section : undefined;
  } catch {
    return undefined;
  }
}
export function settingsSectionHash(section: string): string {
  return settingsSections.includes(section)
    ? `#${encodeURIComponent("Configurações")}/${encodeURIComponent(section)}`
    : `#${encodeURIComponent("Configurações")}`;
}
export function resolveRoute(hash: string): string {
  try {
    if (resolveSettingsSection(hash)) return "Configurações";
    const candidate = decodeURIComponent(hash.replace(/^#\/?/, ""));
    if (candidate === "Serviços / Produtos") return "Serviços";
    return routes.includes(candidate) ? candidate : "Dashboard";
  } catch {
    return "Dashboard";
  }
}
