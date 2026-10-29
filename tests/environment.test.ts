import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDataMode, modeHref } from "../src/environment.ts";

test("real preparation is default; demo requires explicit unambiguous opt-in", () => {
  for (const search of [
    "",
    "?mode=real",
    "?mode=true",
    "?mode=DEMO",
    "?mode=demo&mode=real",
    "?mode=demo&mode=demo",
  ])
    assert.equal(resolveDataMode(search), "real");
  assert.equal(resolveDataMode("?mode=demo"), "demo");
  assert.equal(modeHref("real", "Serviços"), "?mode=real#Servi%C3%A7os");
});

test("real entry dependency graph cannot reach fixtures or demonstration renderers", () => {
  const src = fileURLToPath(new URL("../src/", import.meta.url));
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(file, /[\\/]demo(?:-|\.)/);
    assert.doesNotMatch(
      content,
      /DemoAppointmentRepository|from\s*["']\.\/demo/,
    );
    for (const match of content.matchAll(
      /(?:from\s*|import\s*[(]?\s*)["'](\.[^"']+)["']/g,
    )) {
      const name = resolve(dirname(file), match[1]);
      if (name.endsWith(".css")) continue;
      const target = name.endsWith(".ts") ? name : name + ".ts";
      if (existsSync(target)) visit(target);
    }
  }
  visit(resolve(src, "real-app.ts"));
  assert.ok(seen.size >= 7);
  const entry = readFileSync(resolve(src, "main.ts"), "utf8");
  assert.match(entry, /if \(mode === "demo"\)/);
  assert.match(entry, /await import\("\.\/demo-app"\)/);
  assert.doesNotMatch(entry, /from ["']\.\/demo/);
});

test("real forms have no samples and cannot submit data before connection", () => {
  const src = fileURLToPath(new URL("../src/", import.meta.url));
  const view = readFileSync(resolve(src, "real-view.ts"), "utf8");
  const controller = readFileSync(resolve(src, "real-app.ts"), "utf8");
  assert.match(view, /<fieldset disabled/);
  assert.match(view, /type="submit" class="primary" disabled/);
  assert.doesNotMatch(view, /value="(?:André|Lucas|65|40|2026)/);
  assert.doesNotMatch(
    controller,
    /localStorage|sessionStorage|fetch\(|\.create\(/,
  );
  assert.match(controller, /event.preventDefault\(\)/);
});
