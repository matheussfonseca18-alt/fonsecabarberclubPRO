import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = new URL("../evidence/", import.meta.url);
const origin = "http://127.0.0.1:5194";
const report = {
  origin,
  isolatedProfile: true,
  envFilesDisabled: true,
  layout: [],
  checks: [],
  errors: [],
  external: [],
  passed: false,
};
const server = await createServer({
  root,
  envFile: false,
  server: { host: "127.0.0.1", port: 5194, strictPort: true },
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
    if (url.origin !== origin) {
      report.external.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const requests = [];
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  for (const width of [1440, 1024, 980, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.goto(`${origin}/inicio`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".fc-home__hero-copy"))
          .opacity === "1",
    );
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector("h1").textContent,
      heroWidth: document
        .querySelector(".fc-home__hero")
        .getBoundingClientRect().width,
      menuVisible:
        getComputedStyle(document.querySelector("[data-home-open-menu]"))
          .display !== "none",
      navVisible:
        getComputedStyle(document.querySelector(".fc-home__nav")).display !==
        "none",
      css: [...document.querySelectorAll("style[data-vite-dev-id]")].map(
        (style) => style.getAttribute("data-vite-dev-id").split("/").at(-1),
      ),
      minimumHeroTarget: Math.min(
        ...[...document.querySelectorAll(".fc-home__hero-actions a")].map(
          (a) => a.getBoundingClientRect().height,
        ),
      ),
    }));
    assert.ok(layout.scrollWidth <= width, `overflow ${width}`);
    assert.deepEqual(layout.css, ["legacy-home.css"]);
    assert.equal(layout.menuVisible, width < 980);
    assert.equal(layout.navVisible, width >= 980);
    assert.ok(layout.minimumHeroTarget >= 44);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(
      await page
        .locator('img,video,iframe,[id="planos"],[id="galeria"]')
        .count(),
      0,
    );
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .filter((href) => !document.querySelector(href)),
    );
    assert.deepEqual(broken, []);
    report.layout.push(layout);
    if (width === 1440 || width === 390) {
      const name =
        width === 1440 ? "legacy-home-desktop" : "legacy-home-mobile";
      await page.screenshot({
        path: fileURLToPath(new URL(name + ".png", out)),
        fullPage: true,
      });
      await page.screenshot({
        path: fileURLToPath(new URL(name + "-hero.png", out)),
      });
    }
  }
  report.checks.push(
    "Six widths: nooverflow, isolatedCSS, 44px+heroactions, nofakeassetsorprices, validlocalanchors",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/inicio?qa=keyboard`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".fc-home__skip")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .locator("#conteudo")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  const opener = page.locator("[data-home-open-menu]");
  await opener.click();
  assert.equal(await opener.getAttribute("aria-expanded"), "true");
  assert.equal(
    await page
      .locator("[data-home-close-menu]")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .locator("#fc-home-menu > .fc-home__button")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("[data-home-close-menu]")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.screenshot({
    path: fileURLToPath(new URL("legacy-home-mobile-menu.png", out)),
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-home-open-menu]")
        .getAttribute("aria-expanded") === "false",
  );
  assert.equal(
    await opener.evaluate((el) => el === document.activeElement),
    true,
  );
  await opener.click();
  await page.locator('#fc-home-menu a[href="#experiencia"]').click();
  await page.waitForFunction(
    () => !document.querySelector("#fc-home-menu").open,
  );
  assert.equal(
    await page
      .locator("#experiencia")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.ok(page.url().endsWith("#experiencia"));
  await opener.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(
    () => !document.querySelector("#fc-home-menu").open,
  );
  assert.equal(
    await page
      .locator(".fc-home__header .fc-home__brand")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  report.checks.push(
    "Skiplink, nativefocuscontainment, Escape, focusreturn, sectionlinkfocus, desktopresizeclose",
  );
  for (const address of ["/", "/inicio/", "/#equipe", "/inicio#galeria"]) {
    await page.goto(origin + address, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#fc-home-title").count(), 1);
  }
  assert.ok(
    !requests.some((path) =>
      /\/(?:auth\/runtime|demo-app|real-app|booking-page|barber-page|whatsapp-page|api\/)/.test(
        path,
      ),
    ),
  );
  report.checks.push(
    "Existinghomeentries andexplicitgalleryentry remainhome; nooperationalmodulesloaded",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/inicio`, { waitUntil: "networkidle" });
  assert.equal(
    await page
      .locator(".fc-home__hero-copy")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.equal(
    await page
      .locator(".fc-home__button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  report.checks.push("Reducedmotion disablesentryanimation andtransitions");
  assert.deepEqual(report.external, []);
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(
    new URL("legacy-home-browser-qa.json", out),
    JSON.stringify(report, null, 2),
  );
}
console.log(JSON.stringify(report, null, 2));
