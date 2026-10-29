/** Inactive by default. No SDK, login, refresh, persistence or write transport. */
export type CatalogKind = "professionals" | "services" | "products";

type CatalogIdentity = { readonly entity_id: string; readonly version: 1 };
export type ProfessionalCatalogRow = CatalogIdentity & {
  readonly full_name: string;
  readonly display_name: string | null;
  readonly active: boolean | null;
};
export type ServiceCatalogRow = CatalogIdentity & {
  readonly name: string;
  readonly category: string | null;
  readonly price_cents: number;
  readonly currency: "BRL";
  readonly standalone_duration_minutes: number;
  readonly active: boolean | null;
};
export type ProductCatalogRow = CatalogIdentity & {
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly sale_price_cents: number;
  readonly currency: "BRL";
  readonly unit: string | null;
  readonly active: boolean | null;
};
export type CatalogRowMap = {
  professionals: ProfessionalCatalogRow;
  services: ServiceCatalogRow;
  products: ProductCatalogRow;
};
export type CatalogRow = CatalogRowMap[CatalogKind];
export type CatalogReadFailure = {
  state: "inactive" | "signed-out" | "forbidden" | "error";
  message: string;
};
type CatalogReady<K extends CatalogKind> = K extends CatalogKind
  ? {
      state: "ready";
      kind: K;
      rows: readonly CatalogRowMap[K][];
      total: number;
    }
  : never;
export type CatalogReadResult<K extends CatalogKind = CatalogKind> =
  CatalogReadFailure | CatalogReady<K>;

export type CatalogReadConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly approved: true;
      readonly baseUrl: string;
      readonly publishableKey: string;
      readonly expectedUserId: string;
      /** Approval metadata only: never used as row filters or authorization. */
      readonly tenantId: string;
      readonly scopeId: string;
      readonly batchId: string;
      /** ISO timestamp with explicit timezone; approval must still be valid. */
      readonly expiresAt: string;
      readonly schema: "fonseca_catalog_api";
      readonly views: {
        readonly professionals: "professionals";
        readonly services: "services";
        readonly products: "products";
      };
    };

export type CatalogSession = {
  userId: string;
  accessToken: string;
  /** Epoch milliseconds, matching Date.now(). Not Supabase expires_at seconds. */
  expiresAt: number;
};
export type CatalogReaderDependencies = {
  /** Passive snapshot only. Must not refresh tokens, read storage or perform I/O. */
  getSession(): Promise<CatalogSession | null>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
};
export interface CatalogReader {
  list<K extends CatalogKind>(
    kind: K,
    options?: { signal?: AbortSignal },
  ): Promise<CatalogReadResult<K>>;
}

export const CATALOG_COLUMNS = Object.freeze({
  professionals: Object.freeze([
    "entity_id",
    "version",
    "full_name",
    "display_name",
    "active",
  ]),
  services: Object.freeze([
    "entity_id",
    "version",
    "name",
    "category",
    "price_cents",
    "currency",
    "standalone_duration_minutes",
    "active",
  ]),
  products: Object.freeze([
    "entity_id",
    "version",
    "name",
    "brand",
    "category",
    "sale_price_cents",
    "currency",
    "unit",
    "active",
  ]),
});

const PAGE_SIZE = 250;
const MAX_ROWS = 1000;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;
const messages = {
  inactive: "Leitura autenticada inativa. Nenhuma consulta foi realizada.",
  invalidConfig:
    "Leitura inativa: a configuração aprovada está ausente, inválida ou expirada.",
  signedOut:
    "Uma sessão válida e estável é necessária. Nenhum catálogo foi disponibilizado.",
  forbidden: "A sessão não tem acesso autorizado a este catálogo.",
  error:
    "Não foi possível validar o catálogo completo. Nenhum resultado parcial foi disponibilizado.",
  unconfirmed:
    "Não foi possível confirmar o catálogo autorizado. A consulta e o acesso precisam de verificação.",
  cancelled:
    "Consulta cancelada ou substituída. Nenhum resultado foi disponibilizado.",
} as const;

type ApprovedConfig = Extract<CatalogReadConfig, { enabled: true }> & {
  approvalExpiresAt: number;
};
function failure(
  state: CatalogReadFailure["state"],
  message: string,
): CatalogReadFailure {
  return { state, message };
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
function isoTimestamp(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.exec(
      raw,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > lastDay ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}
/** Capture data descriptors once. Never evaluate caller-supplied accessors. */
function dataProperties(raw: unknown): Record<string, unknown> | null {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const prototype = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const entries: [string, unknown][] = [];
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, "value")) return null;
      entries.push([key, descriptor.value]);
    }
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}
function approvedConfig(
  rawConfig: unknown,
  now: number,
): ApprovedConfig | null {
  const config = dataProperties(rawConfig);
  const views = dataProperties(config?.views);
  if (!config || !Number.isFinite(now) || config.enabled !== true) return null;
  const allowed = [
    "enabled",
    "approved",
    "baseUrl",
    "publishableKey",
    "expectedUserId",
    "tenantId",
    "scopeId",
    "batchId",
    "expiresAt",
    "schema",
    "views",
  ];
  if (
    Reflect.ownKeys(config).some(
      (key) => typeof key !== "string" || !allowed.includes(key),
    ) ||
    config.approved !== true ||
    typeof config.baseUrl !== "string" ||
    !/^https:\/\/[a-z\d]{20}\.supabase\.co$/u.test(config.baseUrl) ||
    typeof config.publishableKey !== "string" ||
    !/^sb_publishable_[A-Za-z\d_-]+$/u.test(config.publishableKey) ||
    config.publishableKey.length > 4096 ||
    !isUuid(config.expectedUserId) ||
    !isUuid(config.tenantId) ||
    !isUuid(config.scopeId) ||
    !isUuid(config.batchId) ||
    config.schema !== "fonseca_catalog_api" ||
    typeof config.expiresAt !== "string" ||
    !views ||
    Object.keys(views).length !== 3 ||
    views.professionals !== "professionals" ||
    views.services !== "services" ||
    views.products !== "products"
  )
    return null;
  const approvalExpiresAt = isoTimestamp(config.expiresAt);
  if (approvalExpiresAt === null || approvalExpiresAt <= now) return null;
  // Only validated captured primitives reach transport; the caller is never reread.
  return Object.freeze({
    enabled: true,
    approved: true,
    baseUrl: config.baseUrl,
    publishableKey: config.publishableKey,
    expectedUserId: config.expectedUserId.toLowerCase(),
    tenantId: config.tenantId,
    scopeId: config.scopeId,
    batchId: config.batchId,
    expiresAt: config.expiresAt,
    approvalExpiresAt,
    schema: "fonseca_catalog_api",
    views: Object.freeze({
      professionals: "professionals",
      services: "services",
      products: "products",
    }),
  });
}

function sessionSnapshot(
  rawValue: CatalogSession | null,
  now: number,
): CatalogSession | null {
  const value = dataProperties(rawValue);
  if (
    !value ||
    !Number.isFinite(now) ||
    !isUuid(value.userId) ||
    typeof value.accessToken !== "string" ||
    !/^[A-Za-z\d._~-]{1,16384}$/u.test(value.accessToken) ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now
  )
    return null;
  return {
    userId: value.userId.toLowerCase(),
    accessToken: value.accessToken,
    expiresAt: value.expiresAt,
  };
}
function text(value: unknown, required = false): boolean {
  return (
    typeof value === "string" &&
    value.length <= 1000 &&
    (!required || value.trim().length > 0) &&
    !Array.from(value).some((character) => (character.codePointAt(0) ?? 0) < 32)
  );
}
function optionalText(value: unknown): boolean {
  return value === null || text(value);
}
function nonnegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseRows<K extends CatalogKind>(
  kind: K,
  raw: unknown,
): CatalogRowMap[K][] | null {
  if (!Array.isArray(raw) || raw.length > PAGE_SIZE) return null;
  const columns = CATALOG_COLUMNS[kind];
  const result: CatalogRowMap[K][] = [];
  for (const rawRow of raw) {
    const row = dataProperties(rawRow);
    if (!row) return null;
    const keys = Object.keys(row);
    if (
      keys.length !== columns.length ||
      keys.some((key) => !columns.includes(key)) ||
      !isUuid(row.entity_id) ||
      row.version !== 1 ||
      (row.active !== null && typeof row.active !== "boolean")
    )
      return null;
    if (kind === "professionals") {
      if (!text(row.full_name, true) || !optionalText(row.display_name))
        return null;
    } else {
      if (
        !text(row.name, true) ||
        !optionalText(row.category) ||
        row.currency !== "BRL"
      )
        return null;
      if (kind === "services") {
        if (
          !nonnegativeInteger(row.price_cents) ||
          !nonnegativeInteger(row.standalone_duration_minutes)
        )
          return null;
      } else if (
        !optionalText(row.brand) ||
        !optionalText(row.unit) ||
        !nonnegativeInteger(row.sale_price_cents)
      )
        return null;
    }
    result.push(
      Object.freeze(
        Object.fromEntries(columns.map((key) => [key, row[key]])),
      ) as CatalogRowMap[K],
    );
  }
  return result;
}
function totalFromRange(
  header: string | null,
  offset: number,
  length: number,
): number | null {
  if (length === 0) return offset === 0 && header === "*/0" ? 0 : null;
  const match = /^(\d+)-(\d+)\/(\d+)$/u.exec(header ?? "");
  if (!match) return null;
  const [start, end, total] = match.slice(1).map(Number);
  if (
    ![start, end, total].every(Number.isSafeInteger) ||
    total > MAX_ROWS ||
    start !== offset ||
    end !== offset + length - 1 ||
    end >= total
  )
    return null;
  return total;
}

/**
 * The unprojected tenant/scope/batch boundary belongs to server RLS/membership.
 * Approval metadata does not prove that boundary. Offset/count/order detect
 * truncation and duplicates, not an atomic snapshot across pages; server-side
 * catalog immutability and remote RLS verification remain prerequisites.
 * getUser does not prove membership: RLS can hide every row with HTTP 200.
 * This initial catalog is expected to be nonempty, so total zero stays unconfirmed.
 */
export function createCatalogReader(
  config: CatalogReadConfig,
  deps: CatalogReaderDependencies,
): CatalogReader {
  const currentRequests = new Map<CatalogKind, number>();
  return {
    async list<K extends CatalogKind>(
      kind: K,
      options: { signal?: AbortSignal } = {},
    ): Promise<CatalogReadResult<K>> {
      let request = 0;
      try {
        const configured = dataProperties(config);
        if (!configured) return failure("inactive", messages.invalidConfig);
        if (configured.enabled === false)
          return failure("inactive", messages.inactive);
        const now = deps.now ?? Date.now;
        const approved = approvedConfig(configured, now());
        if (!approved) return failure("inactive", messages.invalidConfig);
        if (!Object.hasOwn(CATALOG_COLUMNS, kind))
          return failure("error", messages.error);
        request = (currentRequests.get(kind) ?? 0) + 1;
        currentRequests.set(kind, request);
        const signal = options.signal;
        if (signal?.aborted) return failure("error", messages.cancelled);
        let initial: CatalogSession | null;
        try {
          initial = sessionSnapshot(await deps.getSession(), now());
        } catch {
          return failure("signed-out", messages.signedOut);
        }
        if (!initial) return failure("signed-out", messages.signedOut);
        if (initial.userId !== approved.expectedUserId)
          return failure("forbidden", messages.forbidden);
        const session = initial;
        const guard = async (): Promise<CatalogReadFailure | null> => {
          if (signal?.aborted || currentRequests.get(kind) !== request)
            return failure("error", messages.cancelled);
          const time = now();
          if (!Number.isFinite(time) || approved.approvalExpiresAt <= time)
            return failure("inactive", messages.invalidConfig);
          let latest: CatalogSession | null;
          try {
            latest = sessionSnapshot(await deps.getSession(), now());
          } catch {
            return failure("signed-out", messages.signedOut);
          }
          if (
            !latest ||
            session.expiresAt <= now() ||
            latest.userId !== session.userId ||
            latest.accessToken !== session.accessToken ||
            latest.expiresAt !== session.expiresAt
          )
            return failure("signed-out", messages.signedOut);
          if (signal?.aborted || currentRequests.get(kind) !== request)
            return failure("error", messages.cancelled);
          if (approved.approvalExpiresAt <= now())
            return failure("inactive", messages.invalidConfig);
          return null;
        };
        const transport = deps.fetch ?? globalThis.fetch;
        if (typeof transport !== "function")
          return failure("error", messages.error);
        const requestJson = async (
          url: URL,
          catalog: boolean,
        ): Promise<Response> =>
          transport(url, {
            method: "GET",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal,
            headers: {
              apikey: approved.publishableKey,
              Authorization: `Bearer ${session.accessToken}`,
              Accept: "application/json",
              ...(catalog
                ? { "Accept-Profile": approved.schema, Prefer: "count=exact" }
                : {}),
            },
          });
        const responseFailure = (
          response: Response,
          url: URL,
          catalog: boolean,
        ): CatalogReadFailure | null => {
          if (
            response.redirected ||
            (response.url !== "" && response.url !== url.href)
          )
            return failure("error", messages.error);
          if (response.status === 401)
            return failure("signed-out", messages.signedOut);
          if (response.status === 403)
            return failure("forbidden", messages.forbidden);
          if (
            (response.status !== 200 &&
              !(catalog && response.status === 206)) ||
            !/^application\/json(?:;|$)/iu.test(
              response.headers.get("content-type") ?? "",
            )
          )
            return failure("error", messages.error);
          return null;
        };

        let blocked = await guard();
        if (blocked) return blocked;
        const authUrl = new URL("/auth/v1/user", approved.baseUrl);
        const authResponse = await requestJson(authUrl, false);
        blocked = await guard();
        if (blocked) return blocked;
        const authFailure = responseFailure(authResponse, authUrl, false);
        if (authFailure) return authFailure;
        const user = dataProperties(await authResponse.json());
        blocked = await guard();
        if (blocked) return blocked;
        const emailConfirmedAt = isoTimestamp(user?.email_confirmed_at);
        if (
          !user ||
          !("id" in user) ||
          !isUuid(user.id) ||
          user.id.toLowerCase() !== approved.expectedUserId ||
          !("is_anonymous" in user) ||
          user.is_anonymous !== false ||
          emailConfirmedAt === null ||
          emailConfirmedAt > now()
        )
          return failure("forbidden", messages.forbidden);

        const rows: CatalogRowMap[K][] = [];
        let total: number | null = null;
        let previousId = "";
        do {
          blocked = await guard();
          if (blocked) return blocked;
          const offset = rows.length;
          const url = new URL(
            `/rest/v1/${approved.views[kind]}`,
            approved.baseUrl,
          );
          url.searchParams.set("select", CATALOG_COLUMNS[kind].join(","));
          url.searchParams.set("version", "eq.1");
          url.searchParams.set("order", "entity_id.asc,version.asc");
          url.searchParams.set("limit", String(PAGE_SIZE));
          url.searchParams.set("offset", String(offset));
          const response = await requestJson(url, true);
          blocked = await guard();
          if (blocked) return blocked;
          const failed = responseFailure(response, url, true);
          if (failed) return failed;
          const page = parseRows(kind, await response.json());
          blocked = await guard();
          if (blocked) return blocked;
          if (!page) return failure("error", messages.error);
          const pageTotal = totalFromRange(
            response.headers.get("content-range"),
            offset,
            page.length,
          );
          if (pageTotal === null || (total !== null && pageTotal !== total))
            return failure("error", messages.error);
          if (pageTotal === 0) return failure("error", messages.unconfirmed);
          total = pageTotal;
          for (const row of page) {
            const id = row.entity_id.toLowerCase();
            if (id <= previousId) return failure("error", messages.error);
            previousId = id;
            rows.push(row);
          }
        } while (rows.length < (total ?? 0));
        blocked = await guard();
        if (blocked) return blocked;
        if (total === null || rows.length !== total)
          return failure("error", messages.error);
        return {
          state: "ready",
          kind,
          rows: Object.freeze(rows),
          total,
        } as CatalogReadResult<K>;
      } catch {
        return failure("error", messages.error);
      }
    },
  };
}
