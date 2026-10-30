/* global URL */
import { build } from "vite";
import { fileURLToPath } from "node:url";

await build({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  envFile: false,
  build: {
    outDir: "dist-parameters",
    lib: {
      entry: fileURLToPath(
        new URL("../../../src/parameters-read/mount.ts", import.meta.url),
      ),
      formats: ["es"],
      fileName: "parameters-read",
      cssFileName: "parameters-read",
    },
  },
});
