import {
  bookingBlocked,
  planBooking,
  priceBookingCart,
  quoteBooking,
  type AvailabilitySnapshot,
  type BookingCart,
  type BookingCatalog,
  type BookingQuote,
  type BookingResult,
  type BookingSlot,
  type CartAddition,
  type SlotSearch,
} from "./booking-domain.ts";

/** UI-independent order. A reviewed draft is never a persisted appointment. */
export type BookingStep =
  "service" | "professional" | "items" | "times" | "confirmation" | "reviewed";
export type BookingReview = {
  readonly snapshotRevision: string;
  readonly quote: BookingQuote;
  readonly slot: BookingSlot;
};
export type BookingDraft = {
  readonly step: BookingStep;
  readonly cart: BookingCart | null;
  readonly professionalId: string | null;
  readonly review: BookingReview | null;
};
export type BookingContext = {
  readonly catalog: BookingCatalog;
  /** Caller supplies fresh, complete data; absence never becomes empty agenda. */
  readonly snapshot?: AvailabilitySnapshot;
  readonly search?: SlotSearch;
};
export type BookingAction =
  | { readonly type: "select-service"; readonly serviceId: string }
  | { readonly type: "select-professional"; readonly professionalId: string }
  | { readonly type: "set-items"; readonly additions: readonly CartAddition[] }
  | { readonly type: "show-times" }
  | { readonly type: "select-time"; readonly start: number }
  | { readonly type: "review" }
  | { readonly type: "back" }
  | { readonly type: "cancel" };

export function emptyBookingDraft(): BookingDraft {
  return { step: "service", cart: null, professionalId: null, review: null };
}
function ready(value: BookingDraft): BookingResult<BookingDraft> {
  return { state: "ready", value };
}
function wrongStep(): BookingResult<never> {
  return bookingBlocked(
    "wrong-step",
    "step",
    "Siga a ordem: serviço, profissional, complementos, horários e confirmação.",
  );
}

/** Recomputes using the supplied context on each transition, without I/O. */
export function transitionBooking(
  draft: BookingDraft,
  action: BookingAction,
  context: BookingContext,
): BookingResult<BookingDraft> {
  if (action.type === "cancel") return ready(emptyBookingDraft());
  if (action.type === "select-service") {
    const cart = { baseServiceId: action.serviceId, additions: [] };
    const priced = priceBookingCart(context.catalog, cart);
    return priced.state === "blocked"
      ? priced
      : ready({
          step: "professional",
          cart,
          professionalId: null,
          review: null,
        });
  }
  if (action.type === "back") {
    if (draft.step === "service" || draft.step === "professional")
      return ready(emptyBookingDraft());
    if (draft.step === "items")
      return ready({
        ...draft,
        step: "professional",
        professionalId: null,
        cart: draft.cart ? { ...draft.cart, additions: [] } : null,
        review: null,
      });
    if (draft.step === "times")
      return ready({ ...draft, step: "items", review: null });
    return ready({ ...draft, step: "times", review: null });
  }
  if (!draft.cart) return wrongStep();
  if (action.type === "select-professional") {
    if (draft.step === "service") return wrongStep();
    // Re-selecting a professional restarts complements, clearing stale choices.
    const cart = { ...draft.cart, additions: [] };
    const quote = quoteBooking(context.catalog, cart, action.professionalId);
    return quote.state === "blocked"
      ? quote
      : ready({
          step: "items",
          cart,
          professionalId: action.professionalId,
          review: null,
        });
  }
  if (
    !draft.professionalId ||
    draft.step === "professional" ||
    draft.step === "service"
  )
    return wrongStep();
  if (action.type === "set-items") {
    const cart = {
      ...draft.cart,
      additions: action.additions.map((item) => ({ ...item })),
    };
    const quote = quoteBooking(context.catalog, cart, draft.professionalId);
    return quote.state === "blocked"
      ? quote
      : ready({ ...draft, step: "items", cart, review: null });
  }
  if (
    action.type === "show-times" &&
    draft.step !== "items" &&
    draft.step !== "times"
  )
    return wrongStep();
  if (action.type === "select-time" && draft.step !== "times")
    return wrongStep();
  if (action.type === "review" && draft.step !== "confirmation")
    return wrongStep();
  if (!context.snapshot || !context.search)
    return bookingBlocked(
      "missing-schedule",
      "schedule",
      "Disponibilidade confirmada ainda não disponível.",
    );
  const plan = planBooking(
    context.catalog,
    draft.cart,
    draft.professionalId,
    context.snapshot,
    context.search,
  );
  if (plan.state === "blocked") return plan;
  if (action.type === "show-times")
    return ready({ ...draft, step: "times", review: null });
  if (action.type === "select-time") {
    const slot = plan.value.availability.slots.find(
      (value) => value.start === action.start,
    );
    return slot
      ? ready({
          ...draft,
          step: "confirmation",
          review: {
            snapshotRevision: plan.value.availability.snapshotRevision,
            quote: plan.value.quote,
            slot,
          },
        })
      : bookingBlocked(
          "unavailable-time",
          "slot",
          "O horário não comporta todos os itens selecionados.",
        );
  }
  if (action.type !== "review" || !draft.review) return wrongStep();
  const slot = plan.value.availability.slots.find(
    (value) => value.start === draft.review?.slot.start,
  );
  const freshReview = slot
    ? {
        snapshotRevision: plan.value.availability.snapshotRevision,
        quote: plan.value.quote,
        slot,
      }
    : null;
  // Comparison is a stale-review guard, not a cryptographic authorization token.
  if (
    !freshReview ||
    JSON.stringify(freshReview) !== JSON.stringify(draft.review)
  )
    return bookingBlocked(
      "stale-review",
      "review",
      "Valores, duração ou disponibilidade mudaram. Escolha e revise o horário novamente.",
    );
  return ready({ ...draft, step: "reviewed", review: freshReview });
}
