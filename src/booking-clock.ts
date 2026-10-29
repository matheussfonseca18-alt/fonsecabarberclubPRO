/** First whole minute not earlier than the actual instant; no business buffer. */
export function bookingNotBeforeMinute(epochMs: number): number {
  return Number.isFinite(epochMs) ? Math.ceil(epochMs / 60000) : NaN;
}
