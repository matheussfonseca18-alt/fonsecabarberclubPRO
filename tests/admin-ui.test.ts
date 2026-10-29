import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultAdminState,
  h,
  inPeriod,
  matchQuery,
  pageSlice,
} from "../src/admin-ui.ts";
test("administrative queries handle accents and literal markup safely", () => {
  assert.equal(matchQuery("OLEO", "Óleo para barba"), true);
  assert.equal(h('<img src="x">'), "&lt;img src=&quot;x&quot;&gt;");
});
test("pagination clamps page after filtering and unknown page sizes", () => {
  assert.deepEqual(pageSlice(["one", "two"], { page: 99, pageSize: 5 }).rows, [
    "one",
    "two",
  ]);
  assert.equal(pageSlice([], { page: 3, pageSize: 5 }).start, 0);
  assert.equal(
    pageSlice([1, 2, 3, 4, 5, 6], { page: 1, pageSize: 0 }).rows.length,
    5,
  );
});
test("period filter excludes out-of-range and missing dates", () => {
  const state = defaultAdminState();
  assert.equal(inPeriod("2026-10-01", state), true);
  assert.equal(inPeriod("2026-11-01", state), false);
  assert.equal(inPeriod("", state), false);
  assert.equal(
    inPeriod("2026-10-20", { from: "2026-10-31", to: "2026-10-01" }),
    false,
  );
});
