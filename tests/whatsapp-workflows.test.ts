import { test } from "node:test";

test("WhatsApp workflow templates remain inactive, credential-free and unconditionally blocked", async () => {
  await import("../integrations/whatsapp/n8n/validate-templates.mjs");
});
