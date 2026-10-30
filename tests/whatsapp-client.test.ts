import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDisabledWhatsappAdapter,
  createHttpWhatsappAdapter,
  WhatsappClientError,
} from "../src/features/whatsapp/client.ts";
import type {
  Conversation,
  Connection,
  Message,
} from "../src/features/whatsapp/contracts.ts";

// Synthetic transport fixtures only; no real contacts, identities or provider access.
const conversation: Conversation = {
  id: "synthetic-conversation",
  displayName: "Contato sintético",
  updatedAt: "2026-10-30T10:00:00Z",
  unreadCount: 0,
  assignedTo: null,
  version: 2,
  optedOut: false,
  owner: "fonseca",
};
const status: Connection = {
  state: "connected",
  capabilities: { canRead: true, canAssign: false, canSend: false },
};
const message: Message = {
  id: "synthetic-message",
  conversationId: conversation.id,
  direction: "inbound",
  text: "Texto sintético",
  createdAt: conversation.updatedAt,
  status: "received",
};
const json = (value: unknown, code = 200) =>
  new Response(JSON.stringify(value), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
const expectCode = (code: string) => (error: unknown) =>
  error instanceof WhatsappClientError && error.code === code;

test("default and explicitly disabled adapters perform no fetch and return no fixtures", async () => {
  let calls = 0;
  const client = createHttpWhatsappAdapter({
    fetch: async () => {
      calls++;
      throw new Error("must not fetch");
    },
  });
  assert.equal((await client.getStatus()).state, "disabled");
  assert.deepEqual(await client.listConversations(), {
    items: [],
    nextCursor: null,
  });
  assert.deepEqual(await client.listMessages("anything"), {
    items: [],
    nextCursor: null,
  });
  assert.deepEqual(await client.listAssignees(), []);
  await assert.rejects(
    client.assignConversation({
      conversationId: "synthetic",
      assigneeId: null,
      expectedVersion: 0,
    }),
    expectCode("disabled"),
  );
  await assert.rejects(client.sendMessage(), expectCode("disabled"));
  assert.equal(calls, 0);
  assert.equal(
    (await createDisabledWhatsappAdapter().getStatus()).capabilities.canSend,
    false,
  );
});

test("queries remain on the fixed relative backend, encoded and same-origin", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const client = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return json({ items: [conversation], nextCursor: null });
    },
  });
  const query = "<&?/ conversa synthetic";
  const result = await client.listConversations({
    query,
    cursor: "synthetic cursor&",
    limit: 20,
  });
  assert.deepEqual(result.items, [conversation]);
  const request = requests[0];
  assert.equal(request.url.split("?")[0], "/api/whatsapp/conversations");
  const params = new URLSearchParams(request.url.split("?")[1]);
  assert.equal(params.get("q"), query);
  assert.equal(params.get("cursor"), "synthetic cursor&");
  assert.equal(params.get("limit"), "20");
  assert.equal(request.init?.credentials, "same-origin");
  assert.equal(request.init?.mode, "same-origin");
  assert.equal(request.init?.redirect, "error");
  assert.equal(request.init?.cache, "no-store");
});

test("message IDs are path encoded, pagination uses cursor, abort is forwarded", async () => {
  const abort = new AbortController();
  let seen = "";
  const id = "synthetic/a?b#c";
  const client = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async (url, init) => {
      seen = String(url);
      assert.equal(init?.signal, abort.signal);
      return json({
        items: [{ ...message, conversationId: id }],
        nextCursor: "synthetic-next",
      });
    },
  });
  assert.equal(
    (
      await client.listMessages(id, {
        cursor: "previous",
        signal: abort.signal,
      })
    ).nextCursor,
    "synthetic-next",
  );
  assert.equal(
    seen,
    "/api/whatsapp/conversations/synthetic%2Fa%3Fb%23c/messages?cursor=previous&limit=30",
  );
});

test("send is blocked even when all available adapter options are enabled", async () => {
  let calls = 0;
  const client = createHttpWhatsappAdapter({
    enabled: true,
    enableAssignment: true,
    getCsrfToken: () => "synthetic-csrf",
    fetch: async () => {
      calls++;
      return json(status);
    },
  });
  await assert.rejects(client.sendMessage(), expectCode("disabled"));
  assert.equal(calls, 0);
});

test("assignment requires separate opt-in and a live CSRF provider", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return json(conversation);
  };
  const request = {
    conversationId: conversation.id,
    assigneeId: null,
    expectedVersion: 2,
  };
  for (const options of [
    {},
    { enableAssignment: true },
    { enableAssignment: true, getCsrfToken: () => null },
    { enableAssignment: true, getCsrfToken: () => "bad\r\nvalue" },
  ]) {
    const client = createHttpWhatsappAdapter({
      enabled: true,
      fetch: transport,
      ...options,
    });
    await assert.rejects(
      client.assignConversation(request),
      expectCode("disabled"),
    );
  }
  assert.equal(calls, 0);
});

test("assignment supplies optimistic version and CSRF without credentials in its body", async () => {
  const client = createHttpWhatsappAdapter({
    enabled: true,
    enableAssignment: true,
    getCsrfToken: () => "synthetic-csrf",
    fetch: async (url, init) => {
      assert.equal(
        url,
        `/api/whatsapp/conversations/${conversation.id}/assignment`,
      );
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        assigneeId: null,
        expectedVersion: 2,
      });
      assert.equal(
        (init?.headers as Record<string, string>)["X-CSRF-Token"],
        "synthetic-csrf",
      );
      return json({ ...conversation, version: 3 });
    },
  });
  assert.equal(
    (
      await client.assignConversation({
        conversationId: conversation.id,
        assigneeId: null,
        expectedVersion: 2,
      })
    ).version,
    3,
  );
});

test("unknown connection states and send-capable payloads fail closed", async () => {
  for (const payload of [
    { ...status, state: "surprise" },
    { ...status, capabilities: { ...status.capabilities, canSend: true } },
    {
      state: "disabled",
      capabilities: { canRead: true, canAssign: false, canSend: false },
    },
    {
      ...status,
      capabilities: { canRead: false, canAssign: true, canSend: false },
    },
  ]) {
    const client = createHttpWhatsappAdapter({
      enabled: true,
      fetch: async () => json(payload),
    });
    await assert.rejects(client.getStatus(), expectCode("invalid_response"));
  }
});

test("malformed pages, fields and mismatched conversation messages are rejected", async () => {
  for (const payload of [
    { items: [], nextCursor: "" },
    { items: [{ ...conversation, unreadCount: -1 }], nextCursor: null },
    { items: [{ ...conversation, version: 1.3 }], nextCursor: null },
    { items: [{ ...conversation, updatedAt: "bad-date" }], nextCursor: null },
    { items: [{ ...conversation, owner: "unknown" }], nextCursor: null },
    { items: Array(101).fill(conversation), nextCursor: null },
  ]) {
    const client = createHttpWhatsappAdapter({
      enabled: true,
      fetch: async () => json(payload),
    });
    await assert.rejects(
      client.listConversations(),
      expectCode("invalid_response"),
    );
  }
  const client = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async () =>
      json({
        items: [{ ...message, conversationId: "other-conversation" }],
        nextCursor: null,
      }),
  });
  await assert.rejects(
    client.listMessages(conversation.id),
    expectCode("invalid_response"),
  );
});

test("HTTP errors use public messages and never expose arbitrary upstream text", async () => {
  for (const [code, expected] of [
    [401, "unauthorized"],
    [403, "forbidden"],
    [409, "conflict"],
    [423, "disabled"],
    [500, "unavailable"],
  ] as const) {
    const client = createHttpWhatsappAdapter({
      enabled: true,
      fetch: async () =>
        json({ error: { message: "synthetic private debug details" } }, code),
    });
    await assert.rejects(
      client.getStatus(),
      (error) =>
        expectCode(expected)(error) &&
        !(error as Error).message.includes("private"),
    );
  }
});

test("invalid input never reaches transport and aborted requests preserve cancellation", async () => {
  let calls = 0;
  const client = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async () => {
      calls++;
      return json(status);
    },
  });
  await assert.rejects(
    client.listConversations({ limit: 0 }),
    expectCode("invalid_request"),
  );
  await assert.rejects(
    client.listConversations({ query: "x".repeat(161) }),
    expectCode("invalid_request"),
  );
  await assert.rejects(client.listMessages(""), expectCode("invalid_request"));
  assert.equal(calls, 0);
  const abort = new AbortController();
  const abortError = new DOMException("Synthetic abort", "AbortError");
  const pending = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async () => {
      abort.abort();
      throw abortError;
    },
  });
  await assert.rejects(
    pending.getStatus(abort.signal),
    (error) => error === abortError,
  );
});

test("non-JSON response is rejected and response-only extra fields are not propagated", async () => {
  const invalid = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async () => new Response("<html>synthetic</html>"),
  });
  await assert.rejects(invalid.getStatus(), expectCode("invalid_response"));
  const client = createHttpWhatsappAdapter({
    enabled: true,
    fetch: async () => json({ ...status, privateField: "synthetic" }),
  });
  assert.deepEqual(await client.getStatus(), status);
});

test("assignment capability also requires local opt-in and a CSRF provider", async () => {
  const enabled = {
    ...status,
    capabilities: { ...status.capabilities, canAssign: true },
  };
  for (const options of [
    {},
    { enableAssignment: true },
    { getCsrfToken: () => "synthetic-csrf" },
  ]) {
    const client = createHttpWhatsappAdapter({
      enabled: true,
      fetch: async () => json(enabled),
      ...options,
    });
    assert.equal((await client.getStatus()).capabilities.canAssign, false);
  }
  const client = createHttpWhatsappAdapter({
    enabled: true,
    enableAssignment: true,
    getCsrfToken: () => "synthetic-csrf",
    fetch: async () => json(enabled),
  });
  assert.equal((await client.getStatus()).capabilities.canAssign, true);
});
