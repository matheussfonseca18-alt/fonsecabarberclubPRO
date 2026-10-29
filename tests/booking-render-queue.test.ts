import { test } from "node:test";
import assert from "node:assert/strict";
import { createBookingRenderQueue } from "../src/booking-render-queue.ts";

function harness() {
  const tasks = new Set<() => void>();
  const paints: string[] = [];
  let state = "initial";
  const queue = createBookingRenderQueue(
    () => paints.push(state),
    (task) => {
      tasks.add(task);
      return () => tasks.delete(task);
    },
  );
  return {
    queue,
    paints,
    change(value: string) {
      state = value;
      queue.request();
    },
    tick() {
      for (const task of [...tasks]) {
        tasks.delete(task);
        task();
      }
    },
  };
}

test("pointerdown, blur/change, pointerup, click keeps the target until action completes", () => {
  const h = harness();
  h.queue.hold();
  h.change("edited quantity");
  h.tick();
  assert.deepEqual(h.paints, []);
  h.queue.release();
  h.change("next step from clicked button");
  assert.deepEqual(h.paints, []);
  h.tick();
  assert.deepEqual(h.paints, ["next step from clicked button"]);
});

test("keyboard change defers paint until focus movement completes and coalesces emissions", () => {
  const h = harness();
  h.change("date changed");
  h.change("new focus target settled");
  assert.deepEqual(h.paints, []);
  h.tick();
  assert.deepEqual(h.paints, ["new focus target settled"]);
});

test("new pointerdown cancels a queued paint until release or pointercancel", () => {
  const h = harness();
  h.change("async result");
  h.queue.hold();
  h.tick();
  assert.deepEqual(h.paints, []);
  h.queue.release();
  h.tick();
  assert.deepEqual(h.paints, ["async result"]);
});

test("pagehide flush clears rendered private state immediately even during gesture", () => {
  const h = harness();
  h.queue.hold();
  h.change("cleared private data");
  h.queue.flush();
  assert.deepEqual(h.paints, ["cleared private data"]);
  h.queue.release();
  h.tick();
  assert.equal(h.paints.length, 1);
});

test("disposed queue never paints late async or gesture events", () => {
  const h = harness();
  h.change("pending");
  h.queue.dispose();
  h.queue.release();
  h.queue.request();
  h.queue.flush();
  h.tick();
  assert.deepEqual(h.paints, []);
});

test("held Space survives async response and repeat until keyup and native click", () => {
  const h = harness();
  h.queue.hold("keyboard");
  h.queue.hold("keyboard");
  h.change("response arrived during Space");
  h.tick();
  assert.deepEqual(h.paints, []);
  h.queue.release("keyboard");
  h.change("native click cancelled draft");
  h.tick();
  assert.deepEqual(h.paints, ["native click cancelled draft"]);
});

test("pointer release does not release keyboard; blur releases all safely", () => {
  const h = harness();
  h.queue.hold("keyboard");
  h.queue.hold("pointer");
  h.change("pending");
  h.queue.release("pointer");
  h.tick();
  assert.deepEqual(h.paints, []);
  h.queue.releaseAll();
  h.tick();
  assert.deepEqual(h.paints, ["pending"]);
});
