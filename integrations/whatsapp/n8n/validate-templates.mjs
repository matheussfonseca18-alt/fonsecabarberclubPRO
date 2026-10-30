import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = ["ingress.backend-events.inactive.json", "dispatch.inactive.json"];
const allowedTypes = new Set([
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.stopAndError",
  "n8n-nodes-base.stickyNote",
]);

for (const file of files) {
  const text = await readFile(new URL(file, import.meta.url), "utf8");
  const workflow = JSON.parse(text);
  assert.equal(workflow.active, false, `${file}: active must be false`);
  assert.equal(workflow.nodes.length, 3, `${file}: only trigger, guard and note`);
  assert.deepEqual(workflow.pinData, {}, `${file}: no pinned data`);
  assert.deepEqual(workflow.tags, [], `${file}: no instance tag references`);
  assert.deepEqual(workflow.settings, {
    executionOrder: "v1",
    saveManualExecutions: false,
    saveExecutionProgress: false,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "none",
    executionTimeout: 30,
  }, `${file}: execution settings changed`);
  assert(!/https?:\/\//i.test(text), `${file}: no external URL`);
  assert(!text.includes("={{"), `${file}: no executable expressions`);

  const names = new Set();
  const ids = new Set();
  for (const node of workflow.nodes) {
    assert(allowedTypes.has(node.type), `${file}: forbidden node ${node.type}`);
    assert(!("credentials" in node), `${file}: no credential reference`);
    assert(!names.has(node.name) && !ids.has(node.id), `${file}: duplicate node`);
    names.add(node.name);
    ids.add(node.id);
  }
  const triggers = workflow.nodes.filter((node) =>
    ["n8n-nodes-base.webhook", "n8n-nodes-base.manualTrigger"].includes(node.type));
  const guards = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.stopAndError");
  assert.equal(triggers.length, 1, `${file}: exactly one trigger`);
  assert.equal(guards.length, 1, `${file}: exactly one guard`);
  const [trigger] = triggers;
  const [guard] = guards;
  assert.equal(guard.disabled, false, `${file}: guard enabled`);
  assert.equal(guard.continueOnFail, false, `${file}: guard must fail`);
  assert.equal(guard.retryOnFail, false, `${file}: no guard retries`);
  assert.equal(guard.onError, "stopWorkflow", `${file}: stop on error`);
  assert.equal(guard.parameters.errorType, "errorMessage");
  assert.match(guard.parameters.errorMessage, /^FONSECA_(INTEGRATION|SEND)_BLOCKED:/);
  assert.deepEqual(workflow.connections, {
    [trigger.name]: { main: [[{ node: guard.name, type: "main", index: 0 }]] },
  }, `${file}: trigger must lead directly to guard; no other connection`);

  if (file.startsWith("ingress")) {
    assert.equal(trigger.type, "n8n-nodes-base.webhook");
    assert.equal(trigger.typeVersion, 2);
    assert.equal(trigger.disabled, true);
    assert.equal(trigger.parameters.httpMethod, "POST");
    assert.equal(trigger.parameters.authentication, "headerAuth");
    assert.equal(trigger.parameters.responseMode, "lastNode");
    assert.equal(trigger.parameters.responseData, "noData");
    assert.equal(trigger.parameters.options.rawBody, true);
    assert.deepEqual(trigger.parameters.options.responseCode, {
      values: { responseCode: "customCode", customCode: 503 },
    });
  } else {
    assert.equal(trigger.type, "n8n-nodes-base.manualTrigger");
    assert.equal(trigger.typeVersion, 1);
    assert.deepEqual(trigger.parameters, {});
  }
  console.log(`${file}: JSON valid; inactive; immediate blocking guard; no outbound capability`);
}

console.log("Static verification only. No n8n import, endpoint, credential or runtime was used.");
