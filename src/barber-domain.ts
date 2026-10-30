/**
 * Proposed barber-only contracts. These browser checks are defense in depth,
 * never backend authorization. Only an authenticated server may bind a scope.
 * This module has no transport, clock, storage, financial calculation or writer.
 */
export type WorkspaceRole = "owner" | "admin" | "reception" | "barber";
export type WorkspaceArea = "administration" | "barber";
export type RoleNavigationProposal = {
  readonly areas: readonly WorkspaceArea[];
  readonly defaultArea: WorkspaceArea;
};

/** Navigation proposal only: actual professional-role permissions are unknown. */
export const PROPOSED_ROLE_NAVIGATION: Readonly<
  Record<WorkspaceRole, RoleNavigationProposal>
> = Object.freeze({
  owner: Object.freeze({
    areas: Object.freeze(["administration", "barber"] as const),
    defaultArea: "administration",
  }),
  admin: Object.freeze({
    areas: Object.freeze(["administration", "barber"] as const),
    defaultArea: "administration",
  }),
  reception: Object.freeze({
    areas: Object.freeze(["administration"] as const),
    defaultArea: "administration",
  }),
  barber: Object.freeze({
    areas: Object.freeze(["barber"] as const),
    defaultArea: "barber",
  }),
});

/** Must originate from the future authenticated server, never URL or form data. */
export type TrustedBarberScope = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly professionalId: string;
  /** Opaque session binding, not a credential or access token. */
  readonly sessionId: string;
};
export type BarberMetric<T> =
  | { readonly state: "known"; readonly value: T }
  | { readonly state: "unknown" };
export type BarberRead<T> =
  | { readonly state: "ready"; readonly data: T }
  | {
      readonly state: "unavailable" | "signed-out" | "forbidden" | "error";
      readonly reason?: string;
    };
export type BarberAppointment = {
  readonly id: string;
  readonly tenantId: string;
  readonly professionalId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly customer: { readonly displayName: string };
  readonly serviceLabels: readonly string[];
  /** Server-provided display label; lifecycle transitions are not inferred. */
  readonly statusLabel: string | null;
};
export type BarberPerformance = {
  readonly completedAppointments: BarberMetric<number>;
  readonly serviceUnits: BarberMetric<number>;
  readonly productUnits: BarberMetric<number>;
};
export type BarberMoney = {
  readonly minorUnits: number;
  readonly currency: string;
};
export type BarberCommission = {
  /** Supplied by the server; no percentage, formula, total or estimate is derived. */
  readonly amount: BarberMetric<BarberMoney>;
  readonly periodLabel: string | null;
};
export type BarberSnapshot = {
  readonly scope: TrustedBarberScope;
  readonly day: string;
  readonly timeZone: string;
  readonly appointments: readonly BarberAppointment[];
  readonly performance: BarberPerformance;
  readonly commission: BarberCommission;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function noControlCharacters(value: string): boolean {
  return Array.from(value).every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
}
function identifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    noControlCharacters(value)
  );
}
function label(value: unknown, maximum = 160): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    noControlCharacters(value)
  );
}
function validScope(value: unknown): value is TrustedBarberScope {
  return (
    record(value) &&
    identifier(value.tenantId) &&
    identifier(value.actorId) &&
    identifier(value.professionalId) &&
    identifier(value.sessionId)
  );
}
/** Shape check only. It does not authenticate or establish a trusted identity. */
export function isTrustedBarberScopeShape(
  value: unknown,
): value is TrustedBarberScope {
  return validScope(value);
}
function sameScope(a: TrustedBarberScope, b: TrustedBarberScope): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.actorId === b.actorId &&
    a.professionalId === b.professionalId &&
    a.sessionId === b.sessionId
  );
}
function copyScope(scope: TrustedBarberScope): TrustedBarberScope {
  return {
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    professionalId: scope.professionalId,
    sessionId: scope.sessionId,
  };
}
function calendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  );
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    calendarDay(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  );
}
function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
function appointmentStartDay(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function projectMetric<T>(
  value: unknown,
  projectValue: (value: unknown) => T | null,
): BarberMetric<T> | null {
  if (!record(value)) return null;
  if (value.state === "unknown") return { state: "unknown" };
  if (value.state !== "known") return null;
  const projected = projectValue(value.value);
  return projected === null ? null : { state: "known", value: projected };
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
function money(value: unknown): BarberMoney | null {
  if (
    !record(value) ||
    typeof value.minorUnits !== "number" ||
    !Number.isSafeInteger(value.minorUnits) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency)
  )
    return null;
  // Signed server amounts are preserved: adjustment semantics are not assumed.
  return { minorUnits: value.minorUnits, currency: value.currency };
}

/**
 * Rejects a whole response if any row is outside the independently trusted scope.
 * It deliberately does not filter and display the remaining rows. Unknown fields
 * are omitted from the returned DTO, including contact and broader finance data.
 */
export function projectBarberSnapshot(
  raw: unknown,
  expectedScope: TrustedBarberScope,
): BarberRead<BarberSnapshot> {
  const malformed = (): BarberRead<never> => ({
    state: "error",
    reason: "invalid-barber-snapshot",
  });
  const forbidden = (): BarberRead<never> => ({
    state: "forbidden",
    reason: "barber-scope-mismatch",
  });
  if (!validScope(expectedScope)) return forbidden();
  if (!record(raw) || !validScope(raw.scope)) return malformed();
  if (!sameScope(raw.scope, expectedScope)) return forbidden();
  if (
    !calendarDay(raw.day) ||
    !validTimeZone(raw.timeZone) ||
    !Array.isArray(raw.appointments) ||
    raw.appointments.length > 200 ||
    !record(raw.performance) ||
    !record(raw.commission)
  )
    return malformed();

  const appointments: BarberAppointment[] = [];
  const ids = new Set<string>();
  for (const row of raw.appointments) {
    if (!record(row)) return malformed();
    if (
      row.tenantId !== expectedScope.tenantId ||
      row.professionalId !== expectedScope.professionalId
    )
      return forbidden();
    if (
      !identifier(row.id) ||
      ids.has(row.id) ||
      !timestamp(row.startsAt) ||
      !timestamp(row.endsAt) ||
      Date.parse(row.endsAt) <= Date.parse(row.startsAt) ||
      !record(row.customer) ||
      !label(row.customer.displayName) ||
      !Array.isArray(row.serviceLabels) ||
      row.serviceLabels.length > 20 ||
      !row.serviceLabels.every((value: unknown) => label(value)) ||
      !(row.statusLabel === null || label(row.statusLabel, 80))
    )
      return malformed();
    // Proposed day policy: the start belongs to this local calendar day.
    // A valid end may fall on the next day; this is not a lifecycle assumption.
    if (appointmentStartDay(row.startsAt, raw.timeZone) !== raw.day)
      return malformed();
    ids.add(row.id);
    appointments.push({
      id: row.id,
      tenantId: row.tenantId,
      professionalId: row.professionalId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      customer: { displayName: row.customer.displayName },
      serviceLabels: [...row.serviceLabels],
      statusLabel: row.statusLabel,
    });
  }
  const completedAppointments = projectMetric(
    raw.performance.completedAppointments,
    count,
  );
  const serviceUnits = projectMetric(raw.performance.serviceUnits, count);
  const productUnits = projectMetric(raw.performance.productUnits, count);
  const amount = projectMetric(raw.commission.amount, money);
  if (
    !completedAppointments ||
    !serviceUnits ||
    !productUnits ||
    !amount ||
    !(
      raw.commission.periodLabel === null ||
      label(raw.commission.periodLabel, 80)
    )
  )
    return malformed();

  return {
    state: "ready",
    data: {
      scope: copyScope(raw.scope),
      day: raw.day,
      timeZone: raw.timeZone,
      appointments,
      performance: { completedAppointments, serviceUnits, productUnits },
      commission: { amount, periodLabel: raw.commission.periodLabel },
    },
  };
}

export const MAX_DRAFT_LINES = 20;
export const MAX_DRAFT_DESCRIPTION_LENGTH = 120;
export const MAX_DRAFT_QUANTITY = 99;
export type BarberDraftInput = {
  readonly kind: "service" | "product";
  /** Manual description only: not a service/product catalog record or ID. */
  readonly description: string;
  readonly quantity: number;
};
export type BarberDraftLine = BarberDraftInput & { readonly id: string };
export type BarberDraftLink = {
  readonly scope: TrustedBarberScope;
  readonly appointmentId: string;
};
export type BarberDraft = {
  readonly lines: readonly BarberDraftLine[];
  readonly link: BarberDraftLink | null;
  readonly nextLineNumber: number;
};
export type BarberDraftContext = {
  readonly scope: TrustedBarberScope | null;
  readonly selectedAppointmentId: string | null;
  readonly appointments: readonly BarberAppointment[];
};
export type BarberDraftResult =
  | { readonly state: "ready"; readonly draft: BarberDraft }
  | { readonly state: "invalid"; readonly message: string };

export function emptyBarberDraft(): BarberDraft {
  return { lines: [], link: null, nextLineNumber: 1 };
}
function invalidDraft(message: string): BarberDraftResult {
  return { state: "invalid", message };
}
function projectDraftInput(input: unknown): BarberDraftInput | null {
  if (
    !record(input) ||
    (input.kind !== "service" && input.kind !== "product") ||
    !label(input.description, MAX_DRAFT_DESCRIPTION_LENGTH) ||
    typeof input.quantity !== "number" ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_DRAFT_QUANTITY
  )
    return null;
  return {
    kind: input.kind,
    description: input.description.trim(),
    quantity: input.quantity,
  };
}
function validDraft(draft: BarberDraft): boolean {
  if (
    !record(draft) ||
    !Array.isArray(draft.lines) ||
    draft.lines.length > MAX_DRAFT_LINES ||
    !Number.isSafeInteger(draft.nextLineNumber) ||
    draft.nextLineNumber < 1
  )
    return false;
  if (
    draft.link !== null &&
    (!record(draft.link) ||
      !validScope(draft.link.scope) ||
      !identifier(draft.link.appointmentId))
  )
    return false;
  const ids = new Set<string>();
  for (const line of draft.lines) {
    if (
      !record(line) ||
      !identifier(line.id) ||
      ids.has(line.id) ||
      !projectDraftInput(line)
    )
      return false;
    ids.add(line.id);
  }
  return true;
}

export function createDraftLine(
  draft: BarberDraft,
  input: BarberDraftInput,
): BarberDraftResult {
  if (!validDraft(draft)) return invalidDraft("Rascunho local inválido.");
  if (draft.lines.length >= MAX_DRAFT_LINES)
    return invalidDraft(`Use no máximo ${MAX_DRAFT_LINES} itens no rascunho.`);
  const projected = projectDraftInput(input);
  if (!projected)
    return invalidDraft(
      "Informe serviço ou produto, descrição e quantidade inteira de 1 a 99.",
    );
  const id = `local-${draft.nextLineNumber}`;
  if (
    draft.nextLineNumber >= Number.MAX_SAFE_INTEGER ||
    draft.lines.some((line) => line.id === id)
  )
    return invalidDraft("Identificador local inválido.");
  return {
    state: "ready",
    draft: {
      ...draft,
      lines: [...draft.lines, { id, ...projected }],
      nextLineNumber: draft.nextLineNumber + 1,
    },
  };
}
export function updateDraftLine(
  draft: BarberDraft,
  lineId: string,
  input: BarberDraftInput,
): BarberDraftResult {
  if (!validDraft(draft)) return invalidDraft("Rascunho local inválido.");
  const projected = projectDraftInput(input);
  if (!projected)
    return invalidDraft(
      "Informe serviço ou produto, descrição e quantidade inteira de 1 a 99.",
    );
  if (!draft.lines.some((line) => line.id === lineId))
    return invalidDraft("Item local não encontrado.");
  return {
    state: "ready",
    draft: {
      ...draft,
      lines: draft.lines.map((line) =>
        line.id === lineId ? { id: line.id, ...projected } : line,
      ),
    },
  };
}
export function removeDraftLine(
  draft: BarberDraft,
  lineId: string,
): BarberDraftResult {
  if (!validDraft(draft)) return invalidDraft("Rascunho local inválido.");
  if (!draft.lines.some((line) => line.id === lineId))
    return invalidDraft("Item local não encontrado.");
  return {
    state: "ready",
    draft: {
      ...draft,
      lines: draft.lines.filter((line) => line.id !== lineId),
    },
  };
}
function verifiedSelectedAppointment(
  context: BarberDraftContext,
): BarberDraftLink | null {
  if (
    !record(context) ||
    !validScope(context.scope) ||
    !identifier(context.selectedAppointmentId) ||
    !Array.isArray(context.appointments)
  )
    return null;
  const matches = context.appointments.filter(
    (row) => record(row) && row.id === context.selectedAppointmentId,
  );
  if (
    matches.length !== 1 ||
    matches[0].tenantId !== context.scope.tenantId ||
    matches[0].professionalId !== context.scope.professionalId
  )
    return null;
  return {
    scope: copyScope(context.scope),
    appointmentId: context.selectedAppointmentId,
  };
}

/** Clears all linked content on identity, session, selection or visibility loss. */
export function reconcileDraftContext(
  draft: BarberDraft,
  context: BarberDraftContext,
): BarberDraft {
  if (!validDraft(draft)) return emptyBarberDraft();
  if (draft.link === null) return draft;
  const next = verifiedSelectedAppointment(context);
  return next &&
    sameScope(draft.link.scope, next.scope) &&
    draft.link.appointmentId === next.appointmentId
    ? draft
    : emptyBarberDraft();
}

/** Context must come from the server-scoped, projected visible appointment read. */
export function linkDraftToAppointment(
  draft: BarberDraft,
  context: BarberDraftContext,
): BarberDraftResult {
  if (!validDraft(draft)) return invalidDraft("Rascunho local inválido.");
  const link = verifiedSelectedAppointment(context);
  if (!link)
    return invalidDraft(
      "Vínculo exige agendamento próprio visível e escopo verificado.",
    );
  const reconciled = reconcileDraftContext(draft, context);
  return { state: "ready", draft: { ...reconciled, link } };
}
