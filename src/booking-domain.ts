/** Pure planning only. No fixtures, clock, network, persistence or booking writes. */
export type BookingFact<T> =
  | { readonly state: "confirmed"; readonly value: T }
  | { readonly state: "estimated"; readonly value: T }
  | { readonly state: "missing" };

export type BookingService = {
  readonly id: string;
  readonly active: BookingFact<boolean>;
  readonly priceCents: BookingFact<number>;
  readonly standaloneMinutes: BookingFact<number>;
};
export type BookingProduct = {
  readonly id: string;
  readonly active: BookingFact<boolean>;
  readonly priceCents: BookingFact<number>;
};
export type BookingProfessional = {
  readonly id: string;
  readonly active: BookingFact<boolean>;
  /** A confirmed list is exhaustive; [] means no services, missing means unknown. */
  readonly eligibleServiceIds: BookingFact<readonly string[]>;
};
export type LinkedExtraRule = {
  readonly baseServiceId: string;
  readonly extraServiceId: string;
  readonly incrementalMinutes: BookingFact<number>;
  /** Explicit linked price; never inferred from the standalone service price. */
  readonly priceCents: BookingFact<number>;
};
export type BookingCatalog = {
  readonly revision: string;
  readonly services: readonly BookingService[];
  readonly products: readonly BookingProduct[];
  readonly professionals: readonly BookingProfessional[];
  readonly extraRules: readonly LinkedExtraRule[];
};
export type CartAddition =
  | { readonly kind: "extra"; readonly serviceId: string }
  | { readonly kind: "service"; readonly serviceId: string }
  | {
      readonly kind: "product";
      readonly productId: string;
      readonly quantity: number;
    };
export type BookingCart = {
  readonly baseServiceId: string;
  readonly additions: readonly CartAddition[];
};
export type BookingIssue = {
  readonly code: string;
  readonly target: string;
  readonly message: string;
};
export type BookingResult<T> =
  | { readonly state: "ready"; readonly value: T }
  | { readonly state: "blocked"; readonly issue: BookingIssue };
export type PricedLine = {
  readonly kind: "base" | CartAddition["kind"];
  readonly entityId: string;
  readonly quantity: number;
  readonly minutes: number;
  readonly priceCents: number;
};
/** A valid price calculation is not an eligibility or availability decision. */
export type PricedCart = {
  readonly catalogRevision: string;
  readonly lines: readonly PricedLine[];
  readonly currency: "BRL";
  readonly totalMinutes: number;
  readonly totalCents: number;
};
export type BookingQuote = PricedCart & { readonly professionalId: string };

export function bookingBlocked(
  code: string,
  target: string,
  message: string,
): BookingResult<never> {
  return { state: "blocked", issue: { code, target, message } };
}
function ready<T>(value: T): BookingResult<T> {
  return { state: "ready", value };
}
function fact<T>(value: BookingFact<T>, target: string): BookingResult<T> {
  if (!value || value.state === "missing")
    return bookingBlocked(
      "missing-data",
      target,
      "Informação não disponível; configure antes de continuar.",
    );
  if (value.state !== "confirmed")
    return bookingBlocked(
      "unconfirmed-data",
      target,
      "Estimativa não permite confirmar este agendamento.",
    );
  return ready(value.value);
}
function integer(value: unknown, minimum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
  );
}
function id(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value
  );
}
function amount(
  value: BookingFact<number>,
  target: string,
  minimum = 0,
): BookingResult<number> {
  const result = fact(value, target);
  if (result.state === "blocked") return result;
  return integer(result.value, minimum)
    ? result
    : bookingBlocked(
        "invalid-number",
        target,
        "Número inteiro válido obrigatório.",
      );
}
function active(
  value: BookingFact<boolean>,
  target: string,
): BookingResult<true> {
  const result = fact(value, target);
  if (result.state === "blocked") return result;
  return result.value === true
    ? ready(true)
    : bookingBlocked(
        "inactive",
        target,
        "Cadastro não está confirmado como ativo.",
      );
}
function uniqueIndex<T extends { readonly id: string }>(
  rows: readonly T[],
  target: string,
): BookingResult<Map<string, T>> {
  const index = new Map<string, T>();
  for (const row of rows) {
    if (!id(row.id) || index.has(row.id))
      return bookingBlocked(
        "invalid-catalog",
        target,
        "Identificador ausente ou duplicado no catálogo.",
      );
    index.set(row.id, row);
  }
  return ready(index);
}

/** One base, each service at most once (including extras); products use quantity. */
export function priceBookingCart(
  catalog: BookingCatalog,
  cart: BookingCart,
): BookingResult<PricedCart> {
  if (!id(catalog.revision))
    return bookingBlocked(
      "missing-revision",
      "catalog.revision",
      "Revisão do catálogo obrigatória para revisar a proposta.",
    );
  const services = uniqueIndex(catalog.services, "services");
  if (services.state === "blocked") return services;
  const products = uniqueIndex(catalog.products, "products");
  if (products.state === "blocked") return products;
  const rules = new Map<string, LinkedExtraRule>();
  for (const rule of catalog.extraRules) {
    const key = JSON.stringify([rule.baseServiceId, rule.extraServiceId]);
    if (
      !id(rule.baseServiceId) ||
      !id(rule.extraServiceId) ||
      rules.has(key) ||
      rule.baseServiceId === rule.extraServiceId
    )
      return bookingBlocked(
        "invalid-catalog",
        "extraRules",
        "Vínculo de extra inválido ou duplicado.",
      );
    rules.set(key, rule);
  }
  if (!id(cart.baseServiceId))
    return bookingBlocked(
      "base-required",
      "baseServiceId",
      "Escolha primeiro o serviço principal.",
    );
  const lines: PricedLine[] = [];
  const seenServices = new Set<string>();
  const seenProducts = new Set<string>();
  const items: readonly (
    { readonly kind: "base"; readonly serviceId: string } | CartAddition
  )[] = [{ kind: "base", serviceId: cart.baseServiceId }, ...cart.additions];
  for (const item of items) {
    if (item.kind === "product") {
      const product = products.value.get(item.productId);
      if (!product)
        return bookingBlocked(
          "unknown-product",
          item.productId,
          "Produto não encontrado no catálogo informado.",
        );
      if (seenProducts.has(item.productId))
        return bookingBlocked(
          "duplicate-item",
          item.productId,
          "Use a quantidade em uma única linha de produto.",
        );
      seenProducts.add(item.productId);
      if (!integer(item.quantity, 1))
        return bookingBlocked(
          "invalid-quantity",
          item.productId,
          "Quantidade deve ser um inteiro positivo.",
        );
      const status = active(product.active, `${product.id}.active`);
      if (status.state === "blocked") return status;
      const price = amount(product.priceCents, `${product.id}.priceCents`);
      if (price.state === "blocked") return price;
      const priceCents = price.value * item.quantity;
      if (!integer(priceCents, 0))
        return bookingBlocked(
          "overflow",
          product.id,
          "Total excede a precisão suportada.",
        );
      lines.push({
        kind: "product",
        entityId: product.id,
        quantity: item.quantity,
        minutes: 0,
        priceCents,
      });
      continue;
    }
    if (
      item.kind !== "base" &&
      item.kind !== "service" &&
      item.kind !== "extra"
    )
      return bookingBlocked(
        "invalid-item",
        "cart",
        "Tipo de item não suportado.",
      );
    const service = services.value.get(item.serviceId);
    if (!service)
      return bookingBlocked(
        "unknown-service",
        item.serviceId,
        "Serviço não encontrado no catálogo informado.",
      );
    if (seenServices.has(item.serviceId))
      return bookingBlocked(
        "duplicate-item",
        item.serviceId,
        "Um serviço não pode ocupar mais de uma linha do agendamento.",
      );
    seenServices.add(item.serviceId);
    const status = active(service.active, `${service.id}.active`);
    if (status.state === "blocked") return status;
    const rule =
      item.kind === "extra"
        ? rules.get(JSON.stringify([cart.baseServiceId, service.id]))
        : undefined;
    if (item.kind === "extra" && !rule)
      return bookingBlocked(
        "extra-not-linked",
        service.id,
        "Não há vínculo configurado entre o extra e o serviço principal.",
      );
    const duration = amount(
      rule ? rule.incrementalMinutes : service.standaloneMinutes,
      `${service.id}.${rule ? "incrementalMinutes" : "standaloneMinutes"}`,
      rule ? 0 : 1,
    );
    if (duration.state === "blocked") return duration;
    const price = amount(
      rule ? rule.priceCents : service.priceCents,
      `${service.id}.${rule ? "linkedPriceCents" : "priceCents"}`,
    );
    if (price.state === "blocked") return price;
    lines.push({
      kind: item.kind,
      entityId: service.id,
      quantity: 1,
      minutes: duration.value,
      priceCents: price.value,
    });
  }
  const totalMinutes = lines.reduce((sum, line) => sum + line.minutes, 0);
  const totalCents = lines.reduce((sum, line) => sum + line.priceCents, 0);
  if (!integer(totalMinutes, 1) || !integer(totalCents, 0))
    return bookingBlocked(
      "overflow",
      "cart",
      "Total excede a precisão suportada.",
    );
  return ready({
    catalogRevision: catalog.revision,
    lines,
    currency: "BRL",
    totalMinutes,
    totalCents,
  });
}

export function quoteBooking(
  catalog: BookingCatalog,
  cart: BookingCart,
  professionalId: string,
): BookingResult<BookingQuote> {
  const priced = priceBookingCart(catalog, cart);
  if (priced.state === "blocked") return priced;
  const professionals = uniqueIndex(catalog.professionals, "professionals");
  if (professionals.state === "blocked") return professionals;
  const professional = professionals.value.get(professionalId);
  if (!professional)
    return bookingBlocked(
      "professional-required",
      "professionalId",
      "Escolha um profissional cadastrado.",
    );
  const status = active(professional.active, `${professional.id}.active`);
  if (status.state === "blocked") return status;
  const eligibility = fact(
    professional.eligibleServiceIds,
    `${professional.id}.eligibleServiceIds`,
  );
  if (eligibility.state === "blocked") return eligibility;
  if (
    !Array.isArray(eligibility.value) ||
    eligibility.value.some((value) => !id(value)) ||
    new Set(eligibility.value).size !== eligibility.value.length
  )
    return bookingBlocked(
      "invalid-eligibility",
      professional.id,
      "Habilitações inválidas ou duplicadas.",
    );
  for (const line of priced.value.lines) {
    if (line.kind !== "product" && !eligibility.value.includes(line.entityId))
      return bookingBlocked(
        "ineligible-professional",
        line.entityId,
        "Profissional não habilitado para todos os serviços selecionados.",
      );
  }
  return ready({ ...priced.value, professionalId });
}

/** Per-professional outcomes preserve unknown vs explicitly ineligible. */
export function evaluateProfessionals(
  catalog: BookingCatalog,
  cart: BookingCart,
) {
  return catalog.professionals.map((professional) => ({
    professionalId: professional.id,
    result: quoteBooking(catalog, cart, professional.id),
  }));
}

/** Absolute epoch minutes, half-open [start, end). Never local clock strings. */
export type MinuteInterval = { readonly start: number; readonly end: number };
export type AvailabilitySnapshot = {
  readonly revision: string;
  readonly professionalId: string;
  /** All working/busy intervals relevant to this coverage must be represented. */
  readonly coverage: MinuteInterval;
  readonly working: BookingFact<readonly MinuteInterval[]>;
  readonly busy: BookingFact<readonly MinuteInterval[]>;
};
export type SlotSearch = {
  readonly window: MinuteInterval;
  readonly notBefore: number;
  readonly grid: { readonly anchor: number; readonly stepMinutes: number };
};
export type BookingSlot = MinuteInterval & { readonly professionalId: string };
export type AvailabilityPlan = {
  readonly snapshotRevision: string;
  readonly freeIntervals: readonly MinuteInterval[];
  readonly slots: readonly BookingSlot[];
};
// Date's representable epoch range in minutes; arithmetic remains exact here.
function minute(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= 144_000_000_000
  );
}
function interval(value: MinuteInterval): boolean {
  return (
    !!value &&
    minute(value.start) &&
    minute(value.end) &&
    value.start < value.end
  );
}
/** Merge overlapping/adjacent intervals, never bridge a positive gap. */
function union(rows: readonly MinuteInterval[]): MinuteInterval[] {
  const sorted = rows
    .map((row) => ({ ...row }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const result: MinuteInterval[] = [];
  for (const row of sorted) {
    const last = result.at(-1);
    if (last && row.start <= last.end)
      result[result.length - 1] = {
        start: last.start,
        end: Math.max(last.end, row.end),
      };
    else result.push(row);
  }
  return result;
}

export function findCompatibleSlots(
  professionalId: string,
  durationMinutes: number,
  snapshot: AvailabilitySnapshot,
  search: SlotSearch,
): BookingResult<AvailabilityPlan> {
  if (!id(snapshot.revision))
    return bookingBlocked(
      "missing-revision",
      "snapshot.revision",
      "Revisão da disponibilidade obrigatória para revisar a proposta.",
    );
  if (!id(professionalId) || snapshot.professionalId !== professionalId)
    return bookingBlocked(
      "schedule-mismatch",
      "professionalId",
      "A disponibilidade pertence a outro profissional.",
    );
  if (
    !integer(durationMinutes, 1) ||
    !interval(search.window) ||
    !minute(search.notBefore) ||
    !minute(search.grid.anchor) ||
    !integer(search.grid.stepMinutes, 1) ||
    search.grid.stepMinutes > 288_000_000_000
  )
    return bookingBlocked(
      "invalid-search",
      "search",
      "Duração, janela ou grade de horários inválida.",
    );
  if (
    !interval(snapshot.coverage) ||
    snapshot.coverage.start > search.window.start ||
    snapshot.coverage.end < search.window.end
  )
    return bookingBlocked(
      "incomplete-coverage",
      "coverage",
      "A disponibilidade não cobre integralmente o período solicitado.",
    );
  const working = fact(snapshot.working, "working");
  if (working.state === "blocked") return working;
  const busy = fact(snapshot.busy, "busy");
  if (busy.state === "blocked") return busy;
  if (
    !Array.isArray(working.value) ||
    !Array.isArray(busy.value) ||
    [...working.value, ...busy.value].some((value) => !interval(value))
  )
    return bookingBlocked(
      "invalid-interval",
      "schedule",
      "Intervalos devem ter início e fim válidos, com fim posterior ao início.",
    );
  const start = Math.max(search.window.start, search.notBefore);
  const windows = union(working.value)
    .map((row) => ({
      start: Math.max(row.start, start),
      end: Math.min(row.end, search.window.end),
    }))
    .filter((row) => row.start < row.end);
  const conflicts = union(busy.value);
  const freeIntervals: MinuteInterval[] = [];
  for (const window of windows) {
    let cursor = window.start;
    for (const conflict of conflicts) {
      if (conflict.end <= cursor) continue;
      if (conflict.start >= window.end) break;
      if (conflict.start > cursor)
        freeIntervals.push({ start: cursor, end: conflict.start });
      cursor = Math.max(cursor, conflict.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end)
      freeIntervals.push({ start: cursor, end: window.end });
  }
  const slots: BookingSlot[] = [];
  for (const free of freeIntervals) {
    const offset = (free.start - search.grid.anchor) % search.grid.stepMinutes;
    const normalizedOffset =
      (offset + search.grid.stepMinutes) % search.grid.stepMinutes;
    const first =
      free.start +
      (normalizedOffset === 0 ? 0 : search.grid.stepMinutes - normalizedOffset);
    if (!minute(first))
      return bookingBlocked(
        "invalid-search",
        "grid",
        "Grade fora do intervalo suportado.",
      );
    for (
      let candidate = first;
      candidate <= free.end - durationMinutes;
      candidate += search.grid.stepMinutes
    ) {
      if (slots.length >= 10_000)
        return bookingBlocked(
          "search-limit",
          "window",
          "Reduza o período consultado; limite técnico de 10 mil opções.",
        );
      slots.push({
        professionalId,
        start: candidate,
        end: candidate + durationMinutes,
      });
    }
  }
  return ready({ snapshotRevision: snapshot.revision, freeIntervals, slots });
}

export type BookingPlan = {
  readonly quote: BookingQuote;
  readonly availability: AvailabilityPlan;
};
export function planBooking(
  catalog: BookingCatalog,
  cart: BookingCart,
  professionalId: string,
  snapshot: AvailabilitySnapshot,
  search: SlotSearch,
): BookingResult<BookingPlan> {
  const quote = quoteBooking(catalog, cart, professionalId);
  if (quote.state === "blocked") return quote;
  const availability = findCompatibleSlots(
    professionalId,
    quote.value.totalMinutes,
    snapshot,
    search,
  );
  if (availability.state === "blocked") return availability;
  return ready({ quote: quote.value, availability: availability.value });
}
