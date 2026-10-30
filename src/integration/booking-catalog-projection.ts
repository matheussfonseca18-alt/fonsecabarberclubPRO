import {
  bookingBlocked,
  type BookingFact,
  type BookingResult,
} from "../booking-domain.ts";
import type { BookingCatalogData } from "../data/booking-access.ts";
import type {
  ProfessionalCatalogRow,
  ProductCatalogRow,
  ServiceCatalogRow,
} from "../data/catalog-read.ts";

/** Local DTO contract only. Caller assertions are not proof of remote authorization. */
export type ProjectionFact<T> =
  | { readonly state: "missing" }
  | {
      readonly state: "confirmed" | "estimated";
      readonly value: T;
      /** Factual snapshot revision, independent of row schema version 1. */
      readonly revision: string;
      /** Opaque evidence reference; never included in the booking output. */
      readonly source: string;
    };
type Fields<T> = { readonly [K in keyof T]: ProjectionFact<T[K]> };
export type ProjectionCollection<T> = {
  readonly coverage: ProjectionFact<{
    readonly status: "complete" | "partial";
    readonly total: number;
  }>;
  readonly rows: readonly T[];
};
export type ProfessionalProjection = Fields<ProfessionalCatalogRow>;
export type ServiceProjection = Fields<
  Pick<
    ServiceCatalogRow,
    | "entity_id"
    | "version"
    | "name"
    | "active"
    | "price_cents"
    | "currency"
    | "standalone_duration_minutes"
  >
>;
export type ProductProjection = Fields<
  Pick<
    ProductCatalogRow,
    | "entity_id"
    | "version"
    | "name"
    | "active"
    | "sale_price_cents"
    | "currency"
  >
>;
export type ExtraProjection = Fields<{
  baseServiceId: string;
  extraServiceId: string;
  incrementalMinutes: number;
  priceCents: number;
}>;
export type EligibilityProjection = Fields<{
  professionalId: string;
  /** Exhaustive only when confirmed. [] explicitly enables no services. */
  serviceIds: readonly string[];
}>;
export type BookingCatalogProjectionInput = {
  readonly contractVersion: 1;
  readonly revision: string;
  readonly professionals: ProjectionCollection<ProfessionalProjection>;
  readonly services: ProjectionCollection<ServiceProjection>;
  readonly products: ProjectionCollection<ProductProjection>;
  readonly extras: ProjectionCollection<ExtraProjection>;
  readonly eligibility: ProjectionCollection<EligibilityProjection>;
  readonly timeZone?: ProjectionFact<string>;
};

class ProjectionFailure extends Error {
  readonly code: string;
  readonly target: string;
  constructor(code: string, target: string) {
    super(code);
    this.code = code;
    this.target = target;
  }
}
function fail(code: string, target: string): never {
  throw new ProjectionFailure(code, target);
}
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}
function identifier(value: unknown): value is string {
  return text(value, 128);
}
function label(value: unknown): value is string {
  return text(value, 160);
}
function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
/** Read data descriptors without invoking getters. DTOs must be plain data. */
function record(value: unknown, target: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("invalid-projection", target);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    fail("invalid-projection", target);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const pairs = Object.entries(descriptors).map(([key, descriptor]) => {
    if (!("value" in descriptor)) fail("invalid-projection", target);
    return [key, descriptor.value];
  });
  return Object.fromEntries(pairs);
}
function array(value: unknown, target: string): readonly unknown[] {
  if (!Array.isArray(value)) fail("invalid-projection", target);
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !("value" in length) || !nonnegative(length.value))
    fail("invalid-projection", target);
  const result: unknown[] = [];
  for (let index = 0; index < length.value; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor))
      fail("invalid-projection", target);
    result.push(descriptor.value);
  }
  return result;
}

/** No I/O, clock, fixture imports, write port or inferred availability. */
export function projectBookingCatalog(
  input: BookingCatalogProjectionInput,
  expectedRevision: string,
): BookingResult<BookingCatalogData> {
  try {
    const envelope = record(input, "catalog");
    if (envelope.contractVersion !== 1)
      fail("unsupported-projection-version", "contractVersion");
    if (!identifier(expectedRevision) || envelope.revision !== expectedRevision)
      fail("projection-revision", "revision");

    function parsedFact<T>(
      raw: unknown,
      target: string,
      parse: (value: unknown) => T,
    ): BookingFact<T> {
      if (raw === undefined) return { state: "missing" };
      const data = record(raw, target);
      if (data.state === "missing") {
        if ("value" in data) fail("invalid-projection", target);
        return { state: "missing" };
      }
      if (data.state !== "confirmed" && data.state !== "estimated")
        fail("invalid-projection", target);
      if (data.revision !== expectedRevision)
        fail("projection-revision", target);
      if (!identifier(data.source)) fail("missing-provenance", target);
      return { state: data.state, value: parse(data.value) };
    }
    function fact<T>(
      raw: unknown,
      target: string,
      valid: (value: unknown) => value is T,
    ): BookingFact<T> {
      return parsedFact(raw, target, (value) => {
        if (!valid(value)) fail("invalid-projection", target);
        return value;
      });
    }
    function confirmedValue<T>(result: BookingFact<T>, target: string): T {
      if (result.state === "missing") fail("missing-data", target);
      if (result.state !== "confirmed") fail("unconfirmed-data", target);
      return result.value;
    }
    function required<T>(
      raw: unknown,
      target: string,
      valid: (value: unknown) => value is T,
    ): T {
      return confirmedValue(fact(raw, target, valid), target);
    }
    function collection(key: string): readonly Record<string, unknown>[] {
      const data = record(envelope[key], key);
      const coverage = confirmedValue(
        parsedFact(data.coverage, `${key}.coverage`, (value) => {
          const coverage = record(value, `${key}.coverage`);
          if (
            (coverage.status !== "complete" && coverage.status !== "partial") ||
            !nonnegative(coverage.total)
          )
            fail("invalid-projection", `${key}.coverage`);
          return { status: coverage.status, total: coverage.total };
        }),
        `${key}.coverage`,
      );
      const rows = array(data.rows, `${key}.rows`);
      if (coverage.status !== "complete" || coverage.total !== rows.length)
        fail("incomplete-catalog", key);
      return rows.map((row, index) => record(row, `${key}[${index}]`));
    }
    function entities(key: string) {
      const seen = new Set<string>();
      return collection(key).map((row, index) => {
        const target = `${key}[${index}]`;
        const id = required(row.entity_id, `${target}.entity_id`, identifier);
        if (seen.has(id)) fail("duplicate-id", target);
        seen.add(id);
        required(
          row.version,
          `${target}.version`,
          (value): value is 1 => value === 1,
        );
        return { id, row, target };
      });
    }
    function active(raw: unknown, target: string): BookingFact<boolean> {
      const result = fact(
        raw,
        target,
        (value): value is boolean | null =>
          typeof value === "boolean" || value === null,
      );
      if (result.state === "missing" || result.value === null)
        return { state: "missing" };
      return { state: result.state, value: result.value };
    }
    const sourceServices = entities("services");
    const sourceProducts = entities("products");
    const sourceProfessionals = entities("professionals");
    const serviceIds = new Set(sourceServices.map((row) => row.id));
    const professionalIds = new Set(sourceProfessionals.map((row) => row.id));
    const serviceLabels: [string, string][] = [];
    const productLabels: [string, string][] = [];
    const professionalLabels: [string, string][] = [];
    const services = sourceServices.map(({ id, row, target }) => {
      serviceLabels.push([id, required(row.name, `${target}.name`, label)]);
      required(
        row.currency,
        `${target}.currency`,
        (value): value is "BRL" => value === "BRL",
      );
      return {
        id,
        active: active(row.active, `${target}.active`),
        priceCents: fact(row.price_cents, `${target}.price_cents`, nonnegative),
        // Zero is preserved as a fact. The existing core blocks zero standalone use.
        standaloneMinutes: fact(
          row.standalone_duration_minutes,
          `${target}.standalone_duration_minutes`,
          nonnegative,
        ),
      };
    });
    const products = sourceProducts.map(({ id, row, target }) => {
      productLabels.push([id, required(row.name, `${target}.name`, label)]);
      required(
        row.currency,
        `${target}.currency`,
        (value): value is "BRL" => value === "BRL",
      );
      return {
        id,
        active: active(row.active, `${target}.active`),
        priceCents: fact(
          row.sale_price_cents,
          `${target}.sale_price_cents`,
          nonnegative,
        ),
      };
    });
    const eligibility = new Map<string, BookingFact<readonly string[]>>();
    for (const [index, row] of collection("eligibility").entries()) {
      const target = `eligibility[${index}]`;
      const professionalId = required(
        row.professionalId,
        `${target}.professionalId`,
        identifier,
      );
      if (!professionalIds.has(professionalId))
        fail("broken-reference", target);
      if (eligibility.has(professionalId))
        fail("duplicate-eligibility", target);
      const services = parsedFact(
        row.serviceIds,
        `${target}.serviceIds`,
        (value): readonly string[] => {
          const ids = array(value, `${target}.serviceIds`);
          if (
            ids.some((id) => !identifier(id)) ||
            new Set(ids).size !== ids.length
          )
            fail("invalid-eligibility", target);
          if (ids.some((id) => !serviceIds.has(id as string)))
            fail("broken-reference", target);
          return ids as string[];
        },
      );
      eligibility.set(professionalId, services);
    }
    if (eligibility.size !== sourceProfessionals.length)
      fail("incomplete-catalog", "eligibility");
    const professionals = sourceProfessionals.map(({ id, row, target }) => {
      const name = required(row.full_name, `${target}.full_name`, label);
      const displayName = required(
        row.display_name,
        `${target}.display_name`,
        (value): value is string | null => value === null || label(value),
      );
      professionalLabels.push([id, displayName ?? name]);
      return {
        id,
        active: active(row.active, `${target}.active`),
        eligibleServiceIds: eligibility.get(id)!,
      };
    });
    const pairs = new Set<string>();
    const extraRules = collection("extras").map((row, index) => {
      const target = `extras[${index}]`;
      const baseServiceId = required(
        row.baseServiceId,
        `${target}.baseServiceId`,
        identifier,
      );
      const extraServiceId = required(
        row.extraServiceId,
        `${target}.extraServiceId`,
        identifier,
      );
      if (!serviceIds.has(baseServiceId) || !serviceIds.has(extraServiceId))
        fail("broken-reference", target);
      const key = JSON.stringify([baseServiceId, extraServiceId]);
      if (baseServiceId === extraServiceId || pairs.has(key))
        fail("invalid-extra-link", target);
      pairs.add(key);
      return {
        baseServiceId,
        extraServiceId,
        incrementalMinutes: fact(
          row.incrementalMinutes,
          `${target}.incrementalMinutes`,
          nonnegative,
        ),
        priceCents: fact(row.priceCents, `${target}.priceCents`, nonnegative),
      };
    });
    const timeZone = fact(
      envelope.timeZone,
      "timeZone",
      (value): value is string => {
        if (!identifier(value)) return false;
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
    );
    return {
      state: "ready",
      value: {
        catalog: {
          revision: expectedRevision,
          services,
          products,
          professionals,
          extraRules,
        },
        labels: {
          services: Object.fromEntries(serviceLabels),
          products: Object.fromEntries(productLabels),
          professionals: Object.fromEntries(professionalLabels),
        },
        portraits: {},
        timeZone,
      },
    };
  } catch (error) {
    return bookingBlocked(
      error instanceof ProjectionFailure ? error.code : "invalid-projection",
      error instanceof ProjectionFailure ? error.target : "catalog",
      "Catálogo ou informações complementares não puderam ser validados. Nenhum horário foi reservado.",
    );
  }
}
