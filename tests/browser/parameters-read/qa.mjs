/* global URL, innerWidth, document, getComputedStyle, window, console */
import { chromium } from "playwright";
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = new URL("../../../evidence/", import.meta.url);
const origin = "http://127.0.0.1:5193";
const report = {
  origin,
  profile:
    "Temporary isolated headless Chrome; no shared tabs or auth profile; envFile=false",
  layout: [],
  checks: [],
  errors: [],
  external: [],
  passed: false,
};
const server = await createServer({
  root,
  envFile: false,
  server: { host: "127.0.0.1", port: 5193, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      report.external.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  const entry = `${origin}/tests/browser/parameters-read/index.html`;
  const query = () => page.locator("[data-parameters-query]");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.goto(entry, { waitUntil: "networkidle" });
    await page.locator('[data-parameters-state="ready"]').waitFor();
    assert.equal(await page.locator(".pr-card").count(), 72);
    const measurements = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      queryHeight: document.querySelector(".pr-query").getBoundingClientRect()
        .height,
      clearHeight: document
        .querySelector(".pr-search button")
        .getBoundingClientRect().height,
      noticeVisible: getComputedStyle(document.querySelector(".pr-notice")).visibility === "visible",
      noticePosition: getComputedStyle(document.querySelector(".pr-notice")).position,
      sectionsDoNotOverlap:
        document.querySelector(".pr-heading").getBoundingClientRect().bottom <=
          document.querySelector(".pr-notice").getBoundingClientRect().top &&
        document.querySelector(".pr-notice").getBoundingClientRect().bottom <=
          document.querySelector(".pr-search").getBoundingClientRect().top,
    }));
    assert.ok(measurements.scrollWidth <= width, `Overflow at ${width}`);
    assert.ok(measurements.queryHeight >= 44 && measurements.clearHeight >= 44);
    assert.equal(measurements.noticeVisible, true);
    assert.equal(measurements.noticePosition, "static");
    assert.equal(measurements.sectionsDoNotOverlap, true);
    report.layout.push(measurements);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: fileURLToPath(
          new URL(
            width === 1440 ? "parameters-desktop.png" : "parameters-mobile.png",
            output,
          ),
        ),
      });
  }
  report.checks.push(
    "72 cards, no horizontal overflow, 44px+ search/clear targets at1440/768/390/320",
  );
  await query().fill("COMISSAO");
  assert.ok((await page.locator(".pr-card").count()) > 0);
  assert.equal(
    await query().evaluate((element) => element === document.activeElement),
    true,
  );
  await query().press("End");
  await query().pressSequentially(" de teste inexistente");
  await page.locator('[data-parameters-state="no-matches"]').waitFor();
  await page.locator(".pr-state [data-parameters-clear]").click();
  assert.equal(await page.locator(".pr-card").count(), 72);
  assert.equal(await query().inputValue(), "");
  assert.equal(
    await query().evaluate((element) => element === document.activeElement),
    true,
  );
  report.checks.push(
    "accent/case label search, typing keeps focus, no-match state, clear restores72 and focus",
  );
  const beforeUrl = page.url();
  await query().fill("Slots");
  await query().press("Enter");
  assert.equal(page.url(), beforeUrl);
  assert.equal(await page.locator(".pr-card").count(), 1);
  await query().press("Tab");
  assert.equal(
    await page
      .locator(".pr-search button")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".pr-details summary")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const outline = await page
    .locator(".pr-details summary")
    .evaluate((element) => getComputedStyle(element).outlineWidth);
  assert.ok(parseFloat(outline) >= 3);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("details").getAttribute("open"), "");
  assert.equal(await page.locator(".pr-options li").count(), 9);
  assert.ok(
    (await page.locator(".pr-option-body").innerText()).includes("100px"),
  );
  report.checks.push(
    "Enter does not submit/navigate; keyboard disclosure opens; visible focus; ninepixeloptions",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  // Use the reference itself, not a guessed substring, to open the sampled entry.
  await page.locator(".pr-search [data-parameters-clear]").click();
  await page
    .locator('[data-parameter-id="parameter-read-054"] summary')
    .click();
  const sample = page.locator('[data-parameter-id="parameter-read-054"]');
  assert.equal(await sample.locator(".pr-options li").count(), 9);
  assert.ok((await sample.innerText()).includes("Conjunto incompleto"));
  assert.ok(!(await sample.innerText()).includes("0:00"));
  report.checks.push(
    "P54 renders onlynine recovered timechoices plusplaceholder, no interpolatedtimes",
  );
  await query().fill('"><img src=x onerror="window.__xss=1">');
  assert.equal(await page.locator(".pr-root img").count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok((await page.locator(".pr-state").innerText()).includes("<img"));
  assert.equal(await page.locator(".pr-root input").count(), 1);
  assert.equal(
    await page.locator(".pr-root select,.pr-root textarea").count(),
    0,
  );
  report.checks.push(
    "literal HTMLquery neverexecutes; no editableconfigurationcontrols",
  );
  await page.goto(`${entry}?scenario=error`, { waitUntil: "networkidle" });
  await page.locator('[data-parameters-state="error"]').waitFor();
  assert.ok(
    !(await page.locator("body").innerText()).includes("TEST_ONLY_ERROR"),
  );
  await page.locator("[data-parameters-retry]").click();
  await page.locator('[data-parameters-state="ready"]').waitFor();
  assert.equal(
    await query().evaluate((element) => element === document.activeElement),
    true,
  );
  for (const scenario of ["unavailable", "loading"]) {
    await page.goto(`${entry}?scenario=${scenario}`, {
      waitUntil: "networkidle",
    });
    await page.locator(`[data-parameters-state="${scenario}"]`).waitFor();
    assert.equal(await page.locator(".pr-card").count(), 0);
  }
  report.checks.push(
    "loading/unavailable/error aredistinct; sanitizederror; retryrecoversandfocuspersists",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(entry, { waitUntil: "networkidle" });
  assert.equal(
    await query().evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
    "none",
  );
  assert.equal(
    await query().evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
    "0s",
  );
  report.checks.push("reducedmotion enabled; no animationortransition");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(
    new URL("parameters-browser-qa.json", output),
    JSON.stringify(report, null, 2),
  );
}
console.log(JSON.stringify(report, null, 2));
