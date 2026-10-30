import "../../../src/style.css";
import "../../../src/admin.css";
import { mountParametersRead } from "../../../src/parameters-read/mount.ts";
import { createParametersReadController } from "../../../src/parameters-read/controller.ts";
import { PARAMETERS_READ_CATALOG } from "../../../src/parameters-read/catalog.ts";

const host = document.querySelector<HTMLElement>("#parameters-host")!;
const scenario = new URLSearchParams(location.search).get("scenario");
let attempts = 0;
const controller = createParametersReadController(async () => {
  attempts++;
  if (scenario === "loading") return new Promise(() => {});
  if (scenario === "unavailable") return { state: "unavailable" };
  if (scenario === "error" && attempts === 1)
    throw new Error("TEST_ONLY_ERROR_NOT_FOR_UI");
  return { state: "ready", entries: PARAMETERS_READ_CATALOG };
});
const mounted = mountParametersRead(host, controller);
window.addEventListener("pagehide", () => mounted.dispose(), { once: true });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
