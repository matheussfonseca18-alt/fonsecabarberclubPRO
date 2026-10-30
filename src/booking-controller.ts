import {
  planBooking,
  quoteBooking,
  type BookingFact,
  type BookingPlan,
  type CartAddition,
} from "./booking-domain.ts";
import {
  emptyBookingDraft,
  transitionBooking,
  type BookingAction,
  type BookingDraft,
  type BookingStep,
} from "./booking-flow.ts";
import type {
  BookingAvailabilityData,
  BookingCatalogData,
  BookingDataAdapter,
  BookingRead,
} from "./data/booking-access.ts";

type Load<T> = BookingRead<T> | { readonly state: "idle" | "loading" };
export type BookingUiState = {
  readonly catalog: Load<BookingCatalogData>;
  readonly availability: Load<BookingAvailabilityData>;
  readonly draft: BookingDraft;
  readonly choosingTime: boolean;
  readonly itemsBlocked: boolean;
  readonly date: string;
  readonly plan: BookingPlan | null;
  readonly notice: {
    readonly tone: "status" | "error";
    readonly text: string;
  } | null;
};
export function bookingScreen(state: BookingUiState): BookingStep {
  return state.choosingTime && state.draft.step === "items"
    ? "times"
    : state.draft.step;
}
export function validBookingDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function confirmedTimeZone(fact: BookingFact<string>): string | null {
  if (!fact || fact.state !== "confirmed" || typeof fact.value !== "string")
    return null;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: fact.value }).format(0);
    return fact.value;
  } catch {
    return null;
  }
}
function dayAt(minute: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(minute * 60000);
  return ["year", "month", "day"]
    .map((part) => parts.find((item) => item.type === part)?.value)
    .join("-");
}
function factShape(
  value: unknown,
  type: "number" | "boolean" | "string" | "ids",
): boolean {
  if (!value || typeof value !== "object" || !("state" in value)) return false;
  if (value.state === "missing") return true;
  if (
    (value.state !== "confirmed" && value.state !== "estimated") ||
    !("value" in value)
  )
    return false;
  return type === "ids"
    ? Array.isArray(value.value) &&
        value.value.every((id) => typeof id === "string")
    : typeof value.value === type;
}
/** Structural guard; domain validation preserves missing/estimated per choice. */
function validCatalog(data: BookingCatalogData): boolean {
  try {
    const catalog = data.catalog;
    if (
      !catalog ||
      typeof catalog.revision !== "string" ||
      !catalog.revision.trim() ||
      !Array.isArray(catalog.extraRules) ||
      !factShape(data.timeZone, "string")
    )
      return false;
    for (const kind of ["services", "professionals", "products"] as const) {
      const rows = catalog[kind];
      if (!Array.isArray(rows) || !data.labels[kind] || !data.portraits)
        return false;
      const seen = new Set<string>();
      for (const row of rows) {
        if (
          !row ||
          typeof row.id !== "string" ||
          !row.id.trim() ||
          row.id.length > 128 ||
          seen.has(row.id) ||
          !factShape(row.active, "boolean")
        )
          return false;
        seen.add(row.id);
        const name = Object.hasOwn(data.labels[kind], row.id)
          ? data.labels[kind][row.id]
          : null;
        if (typeof name !== "string" || !name.trim() || name.length > 160)
          return false;
        if ("priceCents" in row && !factShape(row.priceCents, "number"))
          return false;
        if (kind !== "professionals" && !("priceCents" in row)) return false;
        if (
          kind === "services" &&
          (!("standaloneMinutes" in row) ||
            !factShape(row.standaloneMinutes, "number"))
        )
          return false;
        if (
          kind === "professionals" &&
          (!("eligibleServiceIds" in row) ||
            !factShape(row.eligibleServiceIds, "ids"))
        )
          return false;
      }
    }
    return catalog.extraRules.every(
      (rule) =>
        rule &&
        typeof rule.baseServiceId === "string" &&
        typeof rule.extraServiceId === "string" &&
        factShape(rule.incrementalMinutes, "number") &&
        factShape(rule.priceCents, "number"),
    );
  } catch {
    return false;
  }
}
function readState<T>(result: BookingRead<T>): BookingRead<T> {
  return result &&
    ["ready", "unavailable", "signed-out", "forbidden", "error"].includes(
      result.state,
    )
    ? result
    : { state: "error" };
}

export function createBookingController(
  adapter: BookingDataAdapter,
  nowMinute: () => number,
) {
  let state: BookingUiState = {
    catalog: { state: "idle" },
    availability: { state: "idle" },
    draft: emptyBookingDraft(),
    choosingTime: false,
    itemsBlocked: false,
    date: "",
    plan: null,
    notice: null,
  };
  const listeners = new Set<() => void>();
  let generation = 0;
  let request: AbortController | null = null;
  let disposed = false;
  function emit() {
    if (!disposed) listeners.forEach((listener) => listener());
  }
  function stop() {
    generation++;
    request?.abort();
    request = null;
  }
  function notice(text: string, tone: "status" | "error" = "error") {
    state = { ...state, notice: { tone, text } };
    emit();
  }
  function resetAvailability() {
    state = {
      ...state,
      availability: { state: "idle" },
      plan: null,
      notice: null,
    };
  }
  function context() {
    if (state.catalog.state !== "ready") return null;
    const availability =
      state.availability.state === "ready" ? state.availability.data : null;
    const now = nowMinute();
    if (!Number.isSafeInteger(now)) return null;
    return {
      catalog: state.catalog.data.catalog,
      ...(availability
        ? {
            snapshot: availability.snapshot,
            search: {
              ...availability.search,
              notBefore: Math.max(availability.search.notBefore, now),
            },
          }
        : {}),
    };
  }
  function act(action: BookingAction) {
    if (disposed) return;
    stop();
    resetAvailability();
    if (action.type === "set-items")
      state = {
        ...state,
        itemsBlocked: true,
        choosingTime: false,
        draft: {
          ...state.draft,
          review: null,
          step:
            state.draft.cart && state.draft.professionalId
              ? "items"
              : state.draft.step,
        },
      };
    const ctx = context();
    if (!ctx) {
      notice("Os dados necessários ainda não estão disponíveis.");
      return;
    }
    try {
      const result = transitionBooking(state.draft, action, ctx);
      if (result.state === "blocked") {
        state = {
          ...state,
          draft: {
            ...state.draft,
            review: null,
            step:
              state.draft.step === "confirmation" ? "items" : state.draft.step,
          },
        };
        notice(result.issue.message);
        return;
      }
      state = {
        ...state,
        draft: result.value,
        choosingTime: false,
        itemsBlocked: false,
      };
      resetAvailability();
      emit();
    } catch {
      resetAvailability();
      notice(
        "Não foi possível validar a seleção. Nenhum agendamento foi criado.",
      );
    }
  }
  async function loadCatalog() {
    if (disposed) return;
    stop();
    const version = generation;
    const controller = new AbortController();
    request = controller;
    state = {
      catalog: { state: "loading" },
      availability: { state: "idle" },
      draft: emptyBookingDraft(),
      choosingTime: false,
      itemsBlocked: false,
      date: "",
      plan: null,
      notice: null,
    };
    emit();
    try {
      const result = readState(await adapter.readCatalog(controller.signal));
      if (disposed || version !== generation || controller.signal.aborted)
        return;
      const safe =
        result.state === "ready"
          ? validCatalog(result.data)
            ? { state: "ready" as const, data: structuredClone(result.data) }
            : { state: "error" as const }
          : result;
      state = { ...state, catalog: safe };
    } catch {
      if (disposed || version !== generation) return;
      state = { ...state, catalog: { state: "error" } };
    }
    request = null;
    emit();
  }
  function openTimes() {
    if (
      disposed ||
      state.catalog.state !== "ready" ||
      !state.draft.cart ||
      !state.draft.professionalId ||
      state.itemsBlocked ||
      state.draft.step !== "items"
    )
      return;
    stop();
    resetAvailability();
    const result = quoteBooking(
      state.catalog.data.catalog,
      state.draft.cart,
      state.draft.professionalId,
    );
    if (result.state === "blocked") {
      notice(result.issue.message);
      return;
    }
    state = { ...state, choosingTime: true };
    emit();
  }
  async function loadTimes(date: string) {
    if (
      disposed ||
      state.itemsBlocked ||
      bookingScreen(state) !== "times" ||
      state.catalog.state !== "ready" ||
      !state.draft.cart ||
      !state.draft.professionalId
    )
      return;
    const timeZone = confirmedTimeZone(state.catalog.data.timeZone);
    stop();
    resetAvailability();
    // A new date/refresh always invalidates the previous schedule and selection.
    state = {
      ...state,
      date,
      draft: { ...state.draft, step: "items", review: null },
      choosingTime: true,
    };
    if (!validBookingDate(date)) {
      notice("Escolha uma data válida para consultar os horários.");
      return;
    }
    if (!timeZone) {
      notice("O fuso do estabelecimento ainda precisa ser confirmado.");
      return;
    }
    const version = generation;
    const controller = new AbortController();
    request = controller;
    const professionalId = state.draft.professionalId!;
    state = { ...state, availability: { state: "loading" } };
    emit();
    try {
      const result = readState(
        await adapter.readAvailability({
          professionalId,
          date,
          signal: controller.signal,
        }),
      );
      if (disposed || version !== generation || controller.signal.aborted)
        return;
      if (result.state !== "ready") state = { ...state, availability: result };
      else if (
        result.data.date !== date ||
        result.data.timeZone !== timeZone ||
        result.data.snapshot.professionalId !== professionalId ||
        dayAt(result.data.search.window.start, timeZone) !== date ||
        dayAt(result.data.search.window.end - 1, timeZone) !== date
      )
        state = { ...state, availability: { state: "error" } };
      else {
        state = {
          ...state,
          availability: { state: "ready", data: structuredClone(result.data) },
        };
        const ctx = context();
        if (!ctx?.snapshot || !ctx.search) throw new Error("Invalid context");
        const resultPlan = planBooking(
          ctx.catalog,
          state.draft.cart!,
          professionalId,
          ctx.snapshot,
          ctx.search,
        );
        if (resultPlan.state === "blocked") {
          state = {
            ...state,
            availability: { state: "error" },
            notice: { tone: "error", text: resultPlan.issue.message },
          };
        } else if (
          resultPlan.value.availability.slots.some(
            (slot) => dayAt(slot.start, timeZone) !== date,
          )
        )
          throw new Error("Wrong date");
        else {
          const transition = transitionBooking(
            state.draft,
            { type: "show-times" },
            ctx,
          );
          if (transition.state === "blocked")
            throw new Error("Invalid transition");
          state = {
            ...state,
            draft: transition.value,
            plan: resultPlan.value,
            choosingTime: false,
          };
        }
      }
    } catch {
      if (disposed || version !== generation) return;
      state = { ...state, availability: { state: "error" }, plan: null };
    }
    request = null;
    emit();
  }
  function chooseTime(start: number) {
    if (
      disposed ||
      state.itemsBlocked ||
      state.draft.step !== "times" ||
      state.availability.state !== "ready"
    )
      return;
    stop();
    const ctx = context();
    if (!ctx) return;
    try {
      const result = transitionBooking(
        state.draft,
        { type: "select-time", start },
        ctx,
      );
      if (result.state === "blocked") {
        resetAvailability();
        state = {
          ...state,
          draft: { ...state.draft, step: "items", review: null },
          choosingTime: true,
        };
        notice(result.issue.message);
        return;
      }
      state = { ...state, draft: result.value, notice: null };
      emit();
    } catch {
      resetAvailability();
      notice(
        "Não foi possível revisar o horário. Consulte a disponibilidade novamente.",
      );
    }
  }
  function back() {
    if (disposed) return;
    stop();
    if (state.choosingTime) {
      state = { ...state, choosingTime: false };
      resetAvailability();
      emit();
      return;
    }
    act({ type: "back" });
  }
  function interrupt(clearCatalog = false) {
    if (disposed) return;
    stop();
    if (clearCatalog || state.catalog.state === "loading")
      state = {
        ...state,
        catalog: { state: "idle" },
        draft: emptyBookingDraft(),
        choosingTime: false,
        itemsBlocked: false,
        date: "",
      };
    else if (
      bookingScreen(state) === "times" ||
      state.draft.step === "confirmation"
    )
      state = {
        ...state,
        draft: { ...state.draft, step: "items", review: null },
        choosingTime: true,
      };
    resetAvailability();
    notice("Consulta interrompida. Nenhum agendamento foi criado.", "status");
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadCatalog,
    loadTimes,
    openTimes,
    chooseTime,
    back,
    interrupt,
    setDate(date: string) {
      if (disposed || bookingScreen(state) !== "times") return;
      stop();
      resetAvailability();
      state = {
        ...state,
        date,
        draft: { ...state.draft, step: "items", review: null },
        choosingTime: true,
      };
      emit();
    },
    chooseService(serviceId: string) {
      act({ type: "select-service", serviceId });
    },
    chooseProfessional(professionalId: string) {
      act({ type: "select-professional", professionalId });
    },
    setItems(additions: readonly CartAddition[]) {
      act({ type: "set-items", additions });
    },
    restoreItems() {
      if (state.itemsBlocked && state.draft.cart)
        act({ type: "set-items", additions: state.draft.cart.additions });
    },
    cancel() {
      if (disposed) return;
      stop();
      state = {
        ...state,
        catalog:
          state.catalog.state === "loading" ? { state: "idle" } : state.catalog,
        draft: emptyBookingDraft(),
        choosingTime: false,
        itemsBlocked: false,
        date: "",
      };
      resetAvailability();
      notice("Rascunho cancelado. Nenhum agendamento foi criado.", "status");
    },
    confirm() {
      if (!disposed)
        notice(
          "Confirmação indisponível: o serviço de reservas ainda não está conectado. Nenhum agendamento foi gravado.",
        );
    },
    dispose() {
      stop();
      disposed = true;
      listeners.clear();
      state = {
        catalog: { state: "idle" },
        availability: { state: "idle" },
        draft: emptyBookingDraft(),
        choosingTime: false,
        itemsBlocked: false,
        date: "",
        plan: null,
        notice: null,
      };
    },
  };
}
