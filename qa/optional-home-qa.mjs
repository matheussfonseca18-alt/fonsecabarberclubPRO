import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "http://127.0.0.1:5195";
const report = {
  syntheticOnly: true,
  screenshotsTaken: false,
  checks: [],
  errors: [],
  passed: false,
};
const server = await createServer({
  root,
  envFile: false,
  server: { host: "127.0.0.1", port: 5195, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const context = await browser.newContext();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/brand/"))
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9kAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/inicio", { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      const { renderLegacyHome } = await import("/src/legacy-home-view.ts");
      const { mountLegacyHomeInteractions } =
        await import("/src/legacy-home-interactions.ts");
      const verified = (value) => ({
        value,
        evidence: { source: "SYNTHETIC QA ONLY", checkedOn: "2026-10-30" },
      });
      const content = {
        logo: verified({
          src: "/brand/test-logo.png",
          alt: "Synthetic QA logo",
          width: 300,
          height: 120,
        }),
        location: verified({ lines: ["SYNTHETIC ADDRESS ONLY"] }),
        socials: [],
        plans: [1, 2, 3].map((i) =>
          verified({
            id: "test" + i,
            name: "Plano sintético " + i,
            priceCents: 12345 + i,
            cadence: "month",
            features: ["Item sintético"],
            terms: "TEST ONLY — NOT AN OFFER",
            validFrom: "2026-10-30",
            validThrough: "2026-12-31",
          }),
        ),
      };
      const photos = [1, 2, 3, 4].map((i) =>
        verified({
          src: "/brand/test-photo-" + i + ".png",
          alt: "Synthetic QA photo",
          width: 400,
          height: 400,
        }),
      );
      const host = document.createElement("div");
      document.body.replaceChildren(host);
      host.innerHTML = renderLegacyHome(content, "2026-10-30", photos);
      mountLegacyHomeInteractions(host);
    });
    assert.equal(await page.locator(".fc-home__plan").count(), 3);
    assert.equal(await page.locator(".fc-home__gallery-photo").count(), 4);
    assert.equal(await page.locator("#encontre").count(), 1);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const logo = await page
      .locator(".fc-home__official-logo")
      .first()
      .evaluate((el) => ({
        filter: getComputedStyle(el).filter,
        fit: getComputedStyle(el).objectFit,
        transform: getComputedStyle(el).transform,
        src: el.getAttribute("src"),
        width: el.getAttribute("width"),
        height: el.getAttribute("height"),
      }));
    assert.deepEqual(logo, {
      filter: "none",
      fit: "contain",
      transform: "none",
      src: "/brand/test-logo.png",
      width: "300",
      height: "120",
    });
    if (width < 980) {
      await page.locator("[data-home-open-menu]").click();
      await page.locator('#fc-home-menu a[href="/inicio#galeria"]').click();
      await page.waitForFunction(
        () => !document.querySelector("#fc-home-menu").open,
      );
      assert.equal(
        await page
          .locator("#galeria")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(
        await page.locator("#galeria").getAttribute("tabindex"),
        "-1",
      );
    }
    report.checks.push({
      width,
      plans: 3,
      photos: 4,
      overflow: false,
      logoPresentation: "no filters/crop/transform; original path/dimensions",
      galleryFocus: width < 980 ? "passed" : "desktop",
    });
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(
    new URL("../evidence/legacy-home-optional-qa.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
}
console.log(JSON.stringify(report, null, 2));
