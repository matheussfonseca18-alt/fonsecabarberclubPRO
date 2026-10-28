import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthCells,
  weekDates,
  layoutAppointments,
} from "../src/agenda-view.ts";
const appointment = {
  id: "a",
  client: "Demo",
  professional: "Demo",
  date: "2026-10-28",
  time: "09:00",
  duration: 45,
  status: "Agendado",
  cents: 100,
  service: "Demo",
};
test("month begins in its correct Monday-first weekday and pads the final row", () => {
  const cells = monthCells("2026-10-28");
  assert.deepEqual(cells.slice(0, 4), [null, null, null, "2026-10-01"]);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter(Boolean).length, 31);
  assert.deepEqual(weekDates("2026-11-01"), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
});
test("intersecting events receive lanes; boundary-touching events can reuse a lane", () => {
  const layout = layoutAppointments([
    appointment,
    { ...appointment, id: "b", time: "09:15", duration: 30 },
    { ...appointment, id: "c", time: "09:45", duration: 15 },
  ]);
  assert.equal(layout[0].lanes, 2);
  assert.equal(layout[1].lanes, 2);
  assert.notEqual(layout[0].lane, layout[1].lane);
  assert.equal(layout[2].lane, 0);
  assert.equal(layout[2].lanes, 1);
  assert.equal(layout[2].start, 45);
});
test("events are clipped to visible operating range", () => {
  const layout = layoutAppointments([
    { ...appointment, time: "08:45", duration: 30 },
    { ...appointment, id: "b", time: "18:45", duration: 45 },
    { ...appointment, id: "c", time: "20:00" },
  ]);
  assert.equal(layout.length, 2);
  assert.deepEqual(
    layout.map((item) => [item.start, item.duration]),
    [
      [0, 15],
      [585, 15],
    ],
  );
});
