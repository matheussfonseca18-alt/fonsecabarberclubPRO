import { createServer } from "vite";
import process from "node:process";
import { log } from "node:console";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const app = resolve(root, "../..");
const server = await createServer({
  configFile: false,
  envFile: false,
  envDir: false,
  root,
  mode: "booking-test",
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" },
    fs: {
      strict: true,
      allow: [root, resolve(app, "src"), resolve(app, "node_modules")],
      deny: [
        "**/.env*",
        "**/.local-preparation/**",
        "**/.preview/**",
        "**/*.pem",
        "**/*.key",
      ],
    },
  },
});
await server.listen();
log("Harness TESTE somente loopback: http://127.0.0.1:5175/");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
