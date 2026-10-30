/** Public consultation metadata. These types do not represent effective settings. */
export type ParameterOptionLabel = Readonly<{
  label: string;
  kind: "placeholder" | "choice";
}>;

export type ParameterOptions =
  | Readonly<{
      completeness: "complete";
      items: readonly ParameterOptionLabel[];
    }>
  | Readonly<{
      completeness: "sampled";
      samples: Readonly<{
        first: readonly ParameterOptionLabel[];
        last: readonly ParameterOptionLabel[];
      }>;
    }>
  | Readonly<{ completeness: "not-recovered" }>
  | Readonly<{ completeness: "not-applicable" }>;

export type ParameterUnitKind = "minutes" | "hours" | "days" | "pixels";

export type ParameterUnit =
  | Readonly<{
      status: "declared";
      kinds: readonly ParameterUnitKind[];
      label: string;
    }>
  | Readonly<{ status: "unknown" }>;

export type ParameterReadEntry = Readonly<{
  localId: string;
  sourceNumber: number;
  label: string;
  observedControl: Readonly<{
    tag: "select" | "input";
    inputType: "text" | null;
  }>;
  options: ParameterOptions;
  unit: ParameterUnit;
  sourceRef: Readonly<{ document: string; pointer: string }>;
}>;

export type ParameterCatalogValidation = Readonly<{
  valid: boolean;
  issues: readonly string[];
}>;

export const PARAMETER_PLACEHOLDER_LABEL = "Selecione uma Opção";

function searchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/** Literal label search; no regular-expression, HTML or business-rule evaluation. */
export function searchParameters(
  catalog: readonly ParameterReadEntry[],
  query: string,
): readonly ParameterReadEntry[] {
  const normalizedQuery = searchText(query);
  return catalog.filter((entry) =>
    searchText(entry.label).includes(normalizedQuery),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validOptionLabels(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      isRecord(item) &&
      hasOnlyKeys(item, ["label", "kind"]) &&
      isText(item.label) &&
      (item.kind === "choice" || item.kind === "placeholder") &&
      (item.kind === "placeholder") ===
        (item.label === PARAMETER_PLACEHOLDER_LABEL),
  );
}

function validOptions(value: unknown, tag: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.completeness) {
    case "complete":
      return (
        tag === "select" &&
        hasOnlyKeys(value, ["completeness", "items"]) &&
        validOptionLabels(value.items)
      );
    case "sampled":
      return (
        tag === "select" &&
        hasOnlyKeys(value, ["completeness", "samples"]) &&
        isRecord(value.samples) &&
        hasOnlyKeys(value.samples, ["first", "last"]) &&
        validOptionLabels(value.samples.first) &&
        validOptionLabels(value.samples.last)
      );
    case "not-recovered":
      return tag === "select" && hasOnlyKeys(value, ["completeness"]);
    case "not-applicable":
      return tag === "input" && hasOnlyKeys(value, ["completeness"]);
    default:
      return false;
  }
}

function validUnit(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.status === "unknown") return hasOnlyKeys(value, ["status"]);
  const kinds = value.kinds;
  return (
    value.status === "declared" &&
    hasOnlyKeys(value, ["status", "kinds", "label"]) &&
    isText(value.label) &&
    Array.isArray(kinds) &&
    kinds.length > 0 &&
    new Set(kinds).size === kinds.length &&
    kinds.every((kind) => ["minutes", "hours", "days", "pixels"].includes(kind))
  );
}

/** Checks metadata structure only. It never establishes authorization or validity of a setting. */
export function validateParameterCatalog(
  value: unknown,
): ParameterCatalogValidation {
  if (!Array.isArray(value))
    return { valid: false, issues: ["O catálogo deve ser uma lista."] };

  const issues: string[] = [];
  const localIds = new Set<string>();
  const sourceNumbers = new Set<number>();
  const labels = new Set<string>();
  value.forEach((entry, index) => {
    const at = `Linha ${index + 1}`;
    if (!isRecord(entry)) {
      issues.push(`${at}: metadados inválidos.`);
      return;
    }
    if (
      !hasOnlyKeys(entry, [
        "localId",
        "sourceNumber",
        "label",
        "observedControl",
        "options",
        "unit",
        "sourceRef",
      ])
    )
      issues.push(`${at}: campo fora do contrato de consulta.`);
    if (
      !isText(entry.localId) ||
      entry.localId === `P${entry.sourceNumber}` ||
      localIds.has(entry.localId)
    )
      issues.push(`${at}: identificador local inválido ou repetido.`);
    else localIds.add(entry.localId);
    if (
      typeof entry.sourceNumber !== "number" ||
      !Number.isInteger(entry.sourceNumber) ||
      entry.sourceNumber < 1 ||
      sourceNumbers.has(entry.sourceNumber)
    )
      issues.push(`${at}: referência numérica inválida ou repetida.`);
    else sourceNumbers.add(entry.sourceNumber);
    if (!isText(entry.label) || labels.has(entry.label))
      issues.push(`${at}: rótulo inválido ou repetido.`);
    else labels.add(entry.label);

    const control = entry.observedControl;
    if (
      !isRecord(control) ||
      !hasOnlyKeys(control, ["tag", "inputType"]) ||
      !(
        (control.tag === "select" && control.inputType === null) ||
        (control.tag === "input" && control.inputType === "text")
      )
    )
      issues.push(`${at}: tipo de controle inválido.`);
    if (!validOptions(entry.options, isRecord(control) ? control.tag : null))
      issues.push(`${at}: completude ou opções inválidas.`);
    if (!validUnit(entry.unit)) issues.push(`${at}: unidade inválida.`);

    const sourceRef = entry.sourceRef;
    if (
      !isRecord(sourceRef) ||
      !hasOnlyKeys(sourceRef, ["document", "pointer"]) ||
      !isText(sourceRef.document) ||
      typeof entry.sourceNumber !== "number" ||
      sourceRef.pointer !== `/rows/${entry.sourceNumber - 1}`
    )
      issues.push(`${at}: referência documental inválida.`);
  });
  return { valid: issues.length === 0, issues };
}
