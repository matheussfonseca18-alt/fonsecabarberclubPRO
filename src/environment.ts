export type DataMode = "real" | "demo";

// Demo requires an explicit, unambiguous URL opt-in. No remembered fallback.
export function resolveDataMode(search: string): DataMode {
  const modes = new URLSearchParams(search).getAll("mode");
  return modes.length === 1 && modes[0] === "demo" ? "demo" : "real";
}

export function modeHref(mode: DataMode, route: string): string {
  return `?mode=${mode}#${encodeURIComponent(route)}`;
}
