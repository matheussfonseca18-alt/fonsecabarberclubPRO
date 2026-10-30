import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { accessFor } from "../server/whatsapp/policy.mjs";
import { createWhatsappHandler } from "../server/whatsapp/handlers.mjs";
import {
  verifyWahaEvent,
  acceptVerifiedEvent,
  inboxKey,
  messageEffectKey,
} from "../server/whatsapp/webhook.mjs";
import {
  businessKey,
  businessEligibility,
  classifySendOutcome,
  dispatchMessage,
} from "../server/whatsapp/outbox-policy.mjs";

// Synthetic fixtures exist only in tests. No endpoint, real contact or credential is used.
const actor = {
  authenticated: true,
  userId: "user-test",
  tenantId: "tenant-test",
  role: "admin",
  permissions: ["whatsapp.read.all", "whatsapp.assign"],
};
const conversation = {
  id: "conversation-test",
  tenantId: actor.tenantId,
  displayName: "Pessoa de teste",
  preview: "<script>test</script>",
  updatedAt: "2026-01-01T10:00:00Z",
  unreadCount: 1,
  assignedTo: null,
  version: 2,
  optedOut: false,
  owner: "fonseca",
  providerToken: "must-not-leak",
};
const req = (path, extra = {}) => ({
  method: "GET",
  path: `/api/whatsapp${path}`,
  actor,
  ...extra,
});
const repository = (overrides) => ({
  listConversations: async () => ({ items: [conversation], nextCursor: null }),
  getConversation: async () => conversation,
  listMessages: async () => ({ items: [], nextCursor: null }),
  listAssignees: async () => [],
  ...overrides,
});

test("default handler is inactive and does not call repository or connection service", async () => {
  const handle = createWhatsappHandler({
    repository: repository({
      listConversations: () => assert.fail("unexpected call"),
    }),
    getConnectionState: () => assert.fail("unexpected call"),
  });
  assert.equal((await handle(req("/status"))).body.state, "disabled");
  assert.equal((await handle(req("/conversations"))).status, 423);
});
test("missing identity, unknown role and role without membership grants deny access", async () => {
  assert.throws(
    () => accessFor(null),
    (e) => e.status === 401,
  );
  assert.equal(accessFor({ ...actor, role: "unmapped-role" }).canRead, false);
  assert.equal(accessFor({ ...actor, permissions: [] }).canRead, false);
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository(),
  });
  assert.equal(
    (
      await handle(
        req("/conversations", { actor: { ...actor, permissions: [] } }),
      )
    ).status,
    403,
  );
});

test("authentication flags must be booleans and inherited object keys are not roles", () => {
  for (const authenticated of ["true", "false", 1, {}, null])
    assert.throws(
      () => accessFor({ ...actor, authenticated }),
      (e) => e.status === 401,
    );
  for (const role of ["__proto__", "constructor", "toString"]) {
    const access = accessFor({ ...actor, role });
    assert.equal(access.canRead, false);
    assert.equal(access.canAssign, false);
  }
});
test("server strips provider fields and never enables send", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository(),
    getConnectionState: async () => ({
      state: "connected",
      token: "must-not-leak",
    }),
  });
  const result = await handle(req("/conversations"));
  assert.equal(result.status, 200);
  assert.equal("providerToken" in result.body.items[0], false);
  assert.equal((await handle(req("/status"))).body.capabilities.canSend, false);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.headers["Content-Type"], "application/json");
});
test("barber read scope is assigned-only, including repository arguments", async () => {
  const barber = {
    ...actor,
    role: "barber",
    permissions: [
      "whatsapp.read.assigned",
      "whatsapp.read.all",
      "whatsapp.assign",
    ],
  };
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository({
      listConversations: async (args) => {
        assert.equal(args.assignedOnly, true);
        assert.equal(args.tenantId, actor.tenantId);
        return {
          items: [
            {
              ...conversation,
              assignedTo: { id: actor.userId, displayName: "Teste" },
            },
          ],
          nextCursor: null,
        };
      },
    }),
  });
  assert.equal(
    (await handle(req("/conversations", { actor: barber }))).status,
    200,
  );
  assert.equal(accessFor(barber).canAssign, false);
});
test("cross-tenant conversation is indistinguishable from missing conversation", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository({
      getConversation: async () => ({
        ...conversation,
        tenantId: "other-tenant",
      }),
    }),
  });
  assert.equal(
    (await handle(req("/conversations/conversation-test/messages"))).status,
    404,
  );
});
test("unassigned barber cannot open conversation even with known id", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository(),
  });
  assert.equal(
    (
      await handle(
        req("/conversations/conversation-test/messages", {
          actor: {
            ...actor,
            role: "barber",
            permissions: ["whatsapp.read.assigned"],
          },
        }),
      )
    ).status,
    404,
  );
});

test("a different conversation returned by the repository cannot authorize the requested id", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository({
      getConversation: async () => ({
        ...conversation,
        id: "another-conversation",
        assignedTo: { id: actor.userId },
      }),
      listMessages: () =>
        assert.fail("messages must not be read after an identity mismatch"),
      assignConversation: () =>
        assert.fail("assignment must not run after an identity mismatch"),
    }),
  });
  const barber = {
    ...actor,
    role: "barber",
    permissions: ["whatsapp.read.assigned"],
  };
  assert.equal(
    (
      await handle(
        req("/conversations/conversation-test/messages", { actor: barber }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handle(
        req("/conversations/conversation-test/assignment", {
          method: "POST",
          csrfVerified: true,
          body: { assigneeId: null, expectedVersion: 2 },
        }),
      )
    ).status,
    404,
  );
});
test("repository data from another tenant cannot leak through a list", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository({
      listConversations: async () => ({
        items: [{ ...conversation, tenantId: "other-tenant" }],
        nextCursor: null,
      }),
    }),
  });
  const response = await handle(req("/conversations"));
  assert.equal(response.status, 404);
  assert.equal(
    JSON.stringify(response.body).includes(conversation.preview),
    false,
  );
});
test("messages from another conversation are rejected", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository({
      listMessages: async () => ({
        items: [
          { tenantId: actor.tenantId, conversationId: "other-conversation" },
        ],
        nextCursor: null,
      }),
    }),
  });
  assert.equal(
    (await handle(req("/conversations/conversation-test/messages"))).status,
    502,
  );
});
test("pagination caps and query length are enforced server-side", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository(),
  });
  for (const path of [
    "/conversations?limit=101",
    "/conversations?limit=0",
    "/conversations?limit=NaN",
    "/conversations?q=" + "x".repeat(161),
  ])
    assert.equal((await handle(req(path))).status, 400);
});
test("assignment requires enabled mutation, capability and verified CSRF", async () => {
  const body = { assigneeId: null, expectedVersion: 2 };
  const readOnly = createWhatsappHandler({
    readEnabled: true,
    repository: repository(),
  });
  assert.equal(
    (
      await readOnly(
        req("/conversations/conversation-test/assignment", {
          method: "POST",
          body,
          csrfVerified: true,
        }),
      )
    ).status,
    403,
  );
  const enabled = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository(),
  });
  assert.equal(
    (
      await enabled(
        req("/conversations/conversation-test/assignment", {
          method: "POST",
          body,
        }),
      )
    ).body.error.code,
    "CSRF_REJECTED",
  );
});
test("assignment rejects stale versions and users from another tenant", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository({
      getAssignableUser: async () => ({
        id: "user-other",
        tenantId: "other",
        active: true,
      }),
      assignConversation: () => assert.fail("unexpected assignment"),
    }),
  });
  const request = (body) =>
    req("/conversations/conversation-test/assignment", {
      method: "POST",
      body,
      csrfVerified: true,
    });
  assert.equal(
    (await handle(request({ assigneeId: null, expectedVersion: 1 }))).status,
    409,
  );
  assert.equal(
    (await handle(request({ assigneeId: "user-other", expectedVersion: 2 })))
      .body.error.code,
    "INVALID_ASSIGNEE",
  );
});
test("assignment compare-and-swap failure yields conflict, success passes audit actor", async () => {
  const request = req("/conversations/conversation-test/assignment", {
    method: "POST",
    body: { assigneeId: null, expectedVersion: 2 },
    csrfVerified: true,
  });
  const conflicting = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository({ assignConversation: async () => null }),
  });
  assert.equal((await conflicting(request)).status, 409);
  const success = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository({
      assignConversation: async (args) => {
        assert.equal(args.expectedVersion, 2);
        assert.equal(args.actorId, actor.userId);
        return { ...conversation, version: 3 };
      },
    }),
  });
  assert.equal((await success(request)).body.version, 3);
});

test("assignment result must preserve requested identity and advance the committed version", async () => {
  const request = req("/conversations/conversation-test/assignment", {
    method: "POST",
    body: { assigneeId: null, expectedVersion: 2 },
    csrfVerified: true,
  });
  for (const [changed, expectedStatus] of [
    [{ ...conversation, id: "another-conversation", version: 3 }, 404],
    [{ ...conversation, version: 2 }, 502],
    [{ ...conversation, version: 1 }, 502],
    [{ ...conversation, version: 3.5 }, 502],
  ]) {
    const handle = createWhatsappHandler({
      readEnabled: true,
      assignmentEnabled: true,
      repository: repository({ assignConversation: async () => changed }),
    });
    const result = await handle(request);
    assert.equal(result.status, expectedStatus);
    assert.equal("id" in result.body, false);
  }
});
test("outbound stays blocked even with admin, enabled flags and crafted request", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    assignmentEnabled: true,
    repository: repository(),
  });
  assert.equal(
    (
      await handle(
        req("/conversations/conversation-test/messages", {
          method: "POST",
          csrfVerified: true,
          body: { enabled: true, text: "test" },
        }),
      )
    ).body.error.code,
    "OUTBOUND_DISABLED",
  );
  await assert.rejects(
    dispatchMessage(),
    (e) => e.code === "OUTBOUND_DISABLED",
  );
});
test("unexpected backend errors are not echoed to browser", async () => {
  const handle = createWhatsappHandler({
    readEnabled: true,
    repository: repository({
      listConversations: async () => {
        throw Error("secret-provider-response");
      },
    }),
  });
  const result = await handle(req("/conversations"));
  assert.equal(result.status, 500);
  assert.equal(result.headers["Content-Type"], "application/json");
  assert.equal(
    JSON.stringify(result).includes("secret-provider-response"),
    false,
  );
});

const secret = Buffer.alloc(32, 7);
const wireEvent = {
  id: "evt_test",
  timestamp: 1760000000000,
  event: "message",
  session: "test-session",
  payload: {
    id: "message-test",
    from: "opaque-test@lid",
    fromMe: false,
    hasMedia: false,
    body: "Teste sintético",
  },
};
function signed(event = wireEvent) {
  const rawBody = Buffer.from(JSON.stringify(event));
  return {
    rawBody,
    signature: createHmac("sha512", secret).update(rawBody).digest("hex"),
    algorithm: "sha512",
    secret,
    instanceId: "instance-test",
    environment: "test",
    allowedSessions: ["test-session"],
    now: 1760000000100,
  };
}
test("HMAC verifies raw bytes and normalization excludes engine/private metadata", () => {
  const event = verifyWahaEvent(
    signed({
      ...wireEvent,
      environment: "production",
      payload: { ...wireEvent.payload, _data: { token: "not-exported" } },
    }),
  );
  assert.equal(event.environment, "test");
  assert.equal(event.chatId, "opaque-test@lid");
  assert.equal(event.occurredAt, new Date(wireEvent.timestamp).toISOString());
  assert.equal(JSON.stringify(event).includes("not-exported"), false);
});
test("tampered bytes, missing signature and wrong algorithm fail closed", () => {
  const valid = signed();
  for (const input of [
    { ...valid, rawBody: Buffer.concat([valid.rawBody, Buffer.from(" ")]) },
    { ...valid, signature: "" },
    { ...valid, algorithm: "sha256" },
  ])
    assert.throws(
      () => verifyWahaEvent(input),
      (e) => e.status === 401,
    );
});
test("unconfigured receiver, unknown session and missing event identity are rejected", () => {
  assert.throws(
    () => verifyWahaEvent({ ...signed(), secret: null }),
    (e) => e.status === 423,
  );
  assert.throws(
    () => verifyWahaEvent(signed({ ...wireEvent, session: "other" })),
    (e) => e.code === "INVALID_EVENT",
  );
  assert.throws(
    () => verifyWahaEvent(signed({ ...wireEvent, id: "" })),
    (e) => e.code === "INVALID_EVENT",
  );
});
test("own messages, groups, media and unsupported events never enter reply path", () => {
  for (const event of [
    { ...wireEvent, payload: { ...wireEvent.payload, fromMe: true } },
    {
      ...wireEvent,
      payload: { ...wireEvent.payload, from: "group-test@g.us" },
    },
    { ...wireEvent, payload: { ...wireEvent.payload, hasMedia: true } },
    { ...wireEvent, event: "message.any" },
  ])
    assert.equal(verifyWahaEvent(signed(event)).type, "ignored");
});
test("inbox insert/duplicate is acknowledged only after durable adapter result", async () => {
  const event = verifyWahaEvent(signed());
  let committed = false;
  const result = await acceptVerifiedEvent(event, {
    insertInboxOnce: async (row) => {
      assert.equal(row.key, inboxKey(event));
      committed = true;
      return { kind: "inserted" };
    },
  });
  assert.equal(committed, true);
  assert.equal(result.accepted, true);
  assert.equal(
    (
      await acceptVerifiedEvent(event, {
        insertInboxOnce: async () => ({
          kind: "duplicate",
          bodyDigest: event.bodyDigest,
        }),
      })
    ).duplicate,
    true,
  );
  await assert.rejects(
    acceptVerifiedEvent(event, {
      insertInboxOnce: async () => ({
        kind: "duplicate",
        bodyDigest: "different",
      }),
    }),
    (e) => e.status === 409,
  );
  await assert.rejects(acceptVerifiedEvent(event, {}), (e) => e.status === 503);
});
test("message effect identity survives changed envelope id but not environment", () => {
  const event = verifyWahaEvent(signed());
  assert.equal(
    messageEffectKey(event, "v1"),
    messageEffectKey({ ...event, providerEventId: "other-event" }, "v1"),
  );
  assert.notEqual(
    messageEffectKey(event, "v1"),
    messageEffectKey({ ...event, environment: "production" }, "v1"),
  );
});
test("business key is deterministic and separates purpose, tenant and occurrence", () => {
  const input = {
    environment: "test",
    tenantId: "t",
    contactId: "c",
    occurrenceId: "o",
    purpose: "reminder",
    ruleVersion: "v1",
  };
  assert.equal(businessKey(input), businessKey({ ...input }));
  for (const change of [
    { tenantId: "other" },
    { purpose: "confirmation" },
    { occurrenceId: "rescheduled" },
  ])
    assert.notEqual(businessKey(input), businessKey({ ...input, ...change }));
});
test("AppBarber ownership, opt-out, consent, human pause and test allowlist block eligibility", () => {
  const input = {
    intent: {
      tenantId: "t",
      conversationId: "c",
      purpose: "reply",
      environment: "test",
      allowlisted: true,
      expiresAt: "2027-01-01T00:00:00Z",
    },
    conversation: {
      id: "c",
      tenantId: "t",
      contactId: "contact",
      owner: "fonseca",
      optedOut: false,
      humanPaused: false,
    },
    consent: {
      active: true,
      tenantId: "t",
      contactId: "contact",
      purpose: "reply",
      channel: "whatsapp",
    },
    now: 1760000000000,
  };
  assert.equal(businessEligibility(input).eligible, true);
  for (const change of [
    { owner: "appbarber" },
    { optedOut: true },
    { humanPaused: true },
  ])
    assert.equal(
      businessEligibility({
        ...input,
        conversation: { ...input.conversation, ...change },
      }).eligible,
      false,
    );
  assert.equal(
    businessEligibility({ ...input, consent: null }).eligible,
    false,
  );
  assert.equal(
    businessEligibility({
      ...input,
      intent: { ...input.intent, allowlisted: false },
    }).eligible,
    false,
  );
});

test("missing or empty business scope and invalid clocks fail eligibility closed", () => {
  const input = {
    intent: {
      tenantId: "t",
      conversationId: "c",
      purpose: "reply",
      environment: "test",
      allowlisted: true,
      expiresAt: "2027-01-01T00:00:00Z",
    },
    conversation: {
      id: "c",
      tenantId: "t",
      contactId: "contact",
      owner: "fonseca",
      optedOut: false,
      humanPaused: false,
    },
    consent: {
      active: true,
      tenantId: "t",
      contactId: "contact",
      purpose: "reply",
      channel: "whatsapp",
    },
    now: 1760000000000,
  };
  for (const missing of [undefined, "", "   "]) {
    for (const keys of [
      [
        ["intent", "tenantId"],
        ["conversation", "tenantId"],
        ["consent", "tenantId"],
      ],
      [
        ["intent", "conversationId"],
        ["conversation", "id"],
      ],
      [
        ["conversation", "contactId"],
        ["consent", "contactId"],
      ],
      [
        ["intent", "purpose"],
        ["consent", "purpose"],
      ],
    ]) {
      const malformed = structuredClone(input);
      for (const [section, key] of keys) malformed[section][key] = missing;
      assert.equal(businessEligibility(malformed).eligible, false);
    }
  }
  for (const now of [NaN, Infinity, "1760000000000"])
    assert.equal(businessEligibility({ ...input, now }).eligible, false);
});
test("ambiguous sends do not retry and accepted HTTP is not marked delivered", () => {
  assert.deepEqual(classifySendOutcome({ timedOut: true }), {
    state: "unknown",
    retry: false,
  });
  assert.equal(classifySendOutcome({ status: 500 }).retry, false);
  assert.equal(
    classifySendOutcome({ status: 429, provenNotAccepted: true }).retry,
    true,
  );
  assert.equal(
    classifySendOutcome({ acceptedId: "message-test" }).state,
    "accepted",
  );
  assert.equal(classifySendOutcome({ status: 401 }).state, "blocked");
});

test("retry requires explicit proof and a valid retryable HTTP status", () => {
  for (const provenNotAccepted of ["true", "false", 1, {}])
    assert.deepEqual(classifySendOutcome({ status: 503, provenNotAccepted }), {
      state: "unknown",
      retry: false,
    });
  for (const status of ["503", 500.5, 600, Infinity])
    assert.deepEqual(classifySendOutcome({ status, provenNotAccepted: true }), {
      state: "unknown",
      retry: false,
    });
  assert.deepEqual(
    classifySendOutcome({ status: 503, provenNotAccepted: true }),
    { state: "retry_wait", retry: true },
  );
  assert.deepEqual(
    classifySendOutcome({
      status: 503,
      provenNotAccepted: true,
      timedOut: true,
    }),
    { state: "unknown", retry: false },
  );
});
