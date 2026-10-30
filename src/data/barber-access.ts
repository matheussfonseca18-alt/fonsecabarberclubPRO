import type {
  BarberRead,
  BarberSnapshot,
  TrustedBarberScope,
} from "../barber-domain.ts";

/**
 * Proposed read-only port. The authenticated server must derive tenant, actor,
 * professional and session scope. A caller may choose only the requested day.
 * Live activation requires an independently trusted session source and server
 * authorization; query-string values and client filtering cannot supply either.
 */
export interface BarberDataAdapter {
  /** Independent server/session binding; not derived from a day response. */
  readScope(signal: AbortSignal): Promise<BarberRead<TrustedBarberScope>>;
  /** Notify immediately on identity/session invalidation, before any new read. */
  subscribeScope(listener: () => void): () => void;
  readDay(request: {
    readonly day: string;
    readonly signal: AbortSignal;
  }): Promise<BarberRead<BarberSnapshot>>;
}

/** Default: inactive, no Auth integration, request, persistence or write method. */
export const inactiveBarberAdapter: BarberDataAdapter = Object.freeze({
  async readScope(): Promise<BarberRead<TrustedBarberScope>> {
    return { state: "unavailable", reason: "barber-read-not-activated" };
  },
  subscribeScope(): () => void {
    return () => {};
  },
  async readDay(): Promise<BarberRead<BarberSnapshot>> {
    return { state: "unavailable", reason: "barber-read-not-activated" };
  },
});
