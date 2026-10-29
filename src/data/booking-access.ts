import type {
  AvailabilitySnapshot,
  BookingCatalog,
  BookingFact,
  SlotSearch,
} from "../booking-domain.ts";

export type BookingRead<T> =
  | { readonly state: "ready"; readonly data: T }
  | { readonly state: "unavailable" | "signed-out" | "forbidden" | "error" };
export type BookingCatalogData = {
  readonly catalog: BookingCatalog;
  readonly labels: {
    readonly services: Readonly<Record<string, string>>;
    readonly professionals: Readonly<Record<string, string>>;
    readonly products: Readonly<Record<string, string>>;
  };
  /** Same-origin portrait paths only. Missing means no photo, never a stock photo. */
  readonly portraits: Readonly<Record<string, BookingFact<string>>>;
  readonly timeZone: BookingFact<string>;
};
export type BookingAvailabilityData = {
  readonly date: string;
  readonly timeZone: string;
  readonly snapshot: AvailabilitySnapshot;
  readonly search: SlotSearch;
};
/** Read-only port. No create/confirm method exists in this activation stage. */
export interface BookingDataAdapter {
  readCatalog(signal: AbortSignal): Promise<BookingRead<BookingCatalogData>>;
  readAvailability(request: {
    readonly professionalId: string;
    readonly date: string;
    readonly signal: AbortSignal;
  }): Promise<BookingRead<BookingAvailabilityData>>;
}

/** Independent of query mode, Auth, imported catalog readers and demo fixtures. */
export const inactiveBookingAdapter: BookingDataAdapter = {
  async readCatalog() {
    return { state: "unavailable" };
  },
  async readAvailability() {
    return { state: "unavailable" };
  },
};
