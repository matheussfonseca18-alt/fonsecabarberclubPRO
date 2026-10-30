import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" },
  },
  preview: {
    headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" },
  },
});
