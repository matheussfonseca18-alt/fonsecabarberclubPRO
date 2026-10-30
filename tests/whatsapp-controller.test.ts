import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createWhatsappPanelController } from "../src/features/whatsapp/panel-controller.ts";
import {
  createDisabledWhatsappAdapter,
  WhatsappClientError,
} from "../src/features/whatsapp/client.ts";
import type {
  Connection,
  Conversation,
  Message,
  Page,
  WhatsappAdapter,
} from "../src/features/whatsapp/contracts.ts";

// Synthetic in-memory fixtures only. No real user, tenant or service interaction.
const connection: Connection = {
  state: "connected",
  capabilities: { canRead: true, canAssign: false, canSend: false },
};
const first: Conversation = {
  id: "synthetic-first",
  displayName: "Contato sintético A",
  updatedAt: "2026-10-30T10:00:00Z",
  unreadCount: 1,
  assignedTo: null,
  version: 2,
  optedOut: false,
  owner: "fonseca",
};
const second: Conversation = {
  ...first,
  id: "synthetic-second",
  displayName: "Contato sintético B",
};
function message(conversationId: string, id = "synthetic-message"): Message {
  return {
    id,
    conversationId,
    direction: "inbound",
    text: "Conteúdo sintético",
    createdAt: first.updatedAt,
    status: "received",
  };
}
function adapter(overrides: Partial<WhatsappAdapter> = {}): WhatsappAdapter {
  return {
    ...createDisabledWhatsappAdapter(),
    async getStatus() {
      return connection;
    },
    async listConversations() {
      return { items: [first, second], nextCursor: null };
    },
    async listMessages() {
      return { items: [], nextCursor: null };
    },
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function loaded(port = adapter()) {
  const controller = createWhatsappPanelController(port);
  await controller.refresh();
  return controller;
}

test("default controller settles disabled with no fabricated data", async () => {
  const controller = await loaded(createDisabledWhatsappAdapter());
  const state = controller.snapshot();
  assert.equal(state.statusPhase, "ready");
  assert.equal(state.connection.state, "disabled");
  assert.deepEqual(state.conversations.items, []);
  assert.deepEqual(state.messages.items, []);
  assert.equal(state.connection.capabilities.canSend, false);
});

test("read capability gates all list requests", async () => {
  let calls = 0;
  const controller = await loaded(
    adapter({
      async getStatus() {
        return {
          ...connection,
          capabilities: { canRead: false, canAssign: false, canSend: false },
        };
      },
      async listConversations() {
        calls++;
        return { items: [first], nextCursor: null };
      },
    }),
  );
  await controller.search("synthetic");
  await controller.loadMessages();
  assert.equal(calls, 0);
  assert.equal(controller.snapshot().selectedId, null);
});

test("drafts are isolated by conversation and the controller never invokes send", async () => {
  let sends = 0;
  const controller = await loaded(
    adapter({
      async sendMessage() {
        sends++;
        throw new Error("must not call");
      },
    }),
  );
  await controller.select(first.id);
  controller.setDraft("Rascunho sintético A");
  await controller.select(second.id);
  assert.equal(controller.snapshot().draft, "");
  controller.setDraft("Rascunho sintético B");
  await controller.select(first.id);
  assert.equal(controller.snapshot().draft, "Rascunho sintético A");
  assert.equal(controller.requestSend(), false);
  assert.equal(sends, 0);
  assert.match(controller.snapshot().notice ?? "", /Envio bloqueado/u);
  controller.clearDraft();
  assert.equal(controller.snapshot().draft, "");
  await controller.select(second.id);
  assert.equal(controller.snapshot().draft, "Rascunho sintético B");
});

test("switching conversation aborts and discards a stale message response", async () => {
  const firstMessages = deferred<Page<Message>>();
  let signal: AbortSignal | undefined;
  const controller = await loaded(
    adapter({
      async listMessages(id, request) {
        if (id === first.id) {
          signal = request?.signal;
          return firstMessages.promise;
        }
        return { items: [message(second.id)], nextCursor: null };
      },
    }),
  );
  const old = controller.select(first.id);
  await controller.select(second.id);
  assert.equal(signal?.aborted, true);
  firstMessages.resolve({ items: [message(first.id)], nextCursor: null });
  await old;
  assert.equal(controller.snapshot().selectedId, second.id);
  assert.equal(
    controller.snapshot().messages.items[0].conversationId,
    second.id,
  );
});

test("new searches discard stale results and preserve the submitted encoded query as text", async () => {
  const oldPage = deferred<Page<Conversation>>();
  const queries: string[] = [];
  const controller = await loaded(
    adapter({
      async listConversations(request) {
        queries.push(request?.query ?? "");
        if (request?.query === "old") return oldPage.promise;
        return { items: request?.query ? [second] : [first], nextCursor: null };
      },
    }),
  );
  const old = controller.search("old");
  await controller.search("  <synthetic>&new  ");
  oldPage.resolve({ items: [first], nextCursor: null });
  await old;
  assert.equal(controller.snapshot().query, "<synthetic>&new");
  assert.equal(controller.snapshot().conversations.items[0].id, second.id);
  assert.deepEqual(queries, ["", "old", "<synthetic>&new"]);
});

test("scope reset immediately clears drafts and data and invalidates pending requests", async () => {
  const delayed = deferred<Page<Message>>();
  let signal: AbortSignal | undefined;
  let delay = false;
  const controller = await loaded(
    adapter({
      async listMessages(id, request) {
        if (delay) {
          signal = request?.signal;
          return delayed.promise;
        }
        return { items: [message(id)], nextCursor: null };
      },
    }),
  );
  await controller.select(first.id);
  controller.setDraft("Rascunho sintético privado");
  delay = true;
  const old = controller.loadMessages();
  controller.resetScope();
  assert.equal(signal?.aborted, true);
  assert.equal(controller.snapshot().connection.capabilities.canRead, false);
  assert.equal(controller.snapshot().draft, "");
  assert.deepEqual(controller.snapshot().conversations.items, []);
  delayed.resolve({ items: [message(first.id)], nextCursor: null });
  await old;
  assert.deepEqual(controller.snapshot().messages.items, []);
  delay = false;
  await controller.refresh();
  await controller.select(first.id);
  assert.equal(controller.snapshot().draft, "");
});

test("destroy cancels all pending work, removes subscribers and erases sensitive state", async () => {
  const delayed = deferred<Connection>();
  let signal: AbortSignal | undefined;
  const controller = createWhatsappPanelController(
    adapter({
      async getStatus(input) {
        signal = input;
        return delayed.promise;
      },
    }),
  );
  let updates = 0;
  controller.subscribe(() => updates++);
  const work = controller.refresh();
  controller.destroy();
  const before = updates;
  delayed.resolve(connection);
  await work;
  await controller.refresh();
  controller.requestSend();
  assert.equal(signal?.aborted, true);
  assert.equal(updates, before);
  assert.deepEqual(controller.snapshot().conversations.items, []);
});

test("pagination appends distinct records and suppresses repeated cursors", async () => {
  const cursors: (string | undefined)[] = [];
  const controller = await loaded(
    adapter({
      async listConversations(request) {
        cursors.push(request?.cursor);
        return request?.cursor
          ? { items: [first, second], nextCursor: "synthetic-next" }
          : { items: [first], nextCursor: "synthetic-next" };
      },
    }),
  );
  await controller.loadConversations(true);
  await controller.loadConversations(true);
  assert.deepEqual(cursors, [undefined, "synthetic-next"]);
  assert.deepEqual(
    controller.snapshot().conversations.items.map((item) => item.id),
    [first.id, second.id],
  );
  assert.equal(controller.snapshot().conversations.nextCursor, null);
});

test("message pages append without duplicate messages", async () => {
  const controller = await loaded(
    adapter({
      async listMessages(id, request) {
        return {
          items: request?.cursor
            ? [message(id), message(id, "synthetic-next-message")]
            : [message(id)],
          nextCursor: request?.cursor ? null : "synthetic-page",
        };
      },
    }),
  );
  await controller.select(first.id);
  await controller.loadMessages(true);
  assert.equal(controller.snapshot().messages.items.length, 2);
  assert.equal(controller.snapshot().messages.nextCursor, null);
});

test("errors expose safe text and retry reaches the ready or empty state", async () => {
  let fail = true;
  const controller = await loaded(
    adapter({
      async listConversations() {
        if (fail) throw new Error("synthetic private debug details");
        return { items: [], nextCursor: null };
      },
    }),
  );
  assert.equal(controller.snapshot().conversationsPhase, "error");
  assert.equal(
    controller.snapshot().conversationsError?.includes("private"),
    false,
  );
  fail = false;
  await controller.loadConversations();
  assert.equal(controller.snapshot().conversationsPhase, "ready");
  assert.deepEqual(controller.snapshot().conversations.items, []);
});

test("authorization loss clears previously loaded details and drafts", async () => {
  let deny = false;
  const controller = await loaded(
    adapter({
      async listMessages(id) {
        if (deny) throw new WhatsappClientError("forbidden");
        return { items: [message(id)], nextCursor: null };
      },
    }),
  );
  await controller.select(first.id);
  controller.setDraft("Rascunho sintético");
  deny = true;
  await controller.loadMessages();
  assert.equal(controller.snapshot().statusPhase, "error");
  assert.equal(controller.snapshot().connection.capabilities.canRead, false);
  assert.deepEqual(controller.snapshot().conversations.items, []);
  assert.equal(controller.snapshot().draft, "");
});

test("assignment uses selected version, requires returned success, and preserves the draft", async () => {
  let requestVersion = -1;
  const assignee = {
    id: "synthetic-assignee",
    displayName: "Responsável sintético",
  };
  const controller = await loaded(
    adapter({
      async getStatus() {
        return {
          ...connection,
          capabilities: { ...connection.capabilities, canAssign: true },
        };
      },
      async listAssignees() {
        return [assignee];
      },
      async assignConversation(request) {
        requestVersion = request.expectedVersion;
        return { ...first, assignedTo: assignee, version: 3 };
      },
    }),
  );
  await controller.select(first.id);
  controller.setDraft("Rascunho sintético");
  await controller.assign(assignee.id);
  assert.equal(requestVersion, 2);
  assert.equal(controller.snapshot().conversations.items[0].version, 3);
  assert.equal(
    controller.snapshot().conversations.items[0].assignedTo?.id,
    assignee.id,
  );
  assert.equal(controller.snapshot().draft, "Rascunho sintético");
  assert.equal(controller.snapshot().assignmentPhase, "ready");
});

test("assignment conflicts never fabricate an assignment or consume the draft", async () => {
  const controller = await loaded(
    adapter({
      async getStatus() {
        return {
          ...connection,
          capabilities: { ...connection.capabilities, canAssign: true },
        };
      },
      async assignConversation() {
        throw new WhatsappClientError("conflict");
      },
    }),
  );
  await controller.select(first.id);
  controller.setDraft("Rascunho sintético");
  await controller.assign(null);
  assert.equal(controller.snapshot().assignmentPhase, "error");
  assert.match(controller.snapshot().notice ?? "", /Atualize/u);
  assert.equal(controller.snapshot().conversations.items[0].version, 2);
  assert.equal(controller.snapshot().draft, "Rascunho sintético");
});

test("stale status and unscoped messages do not replace the active state", async () => {
  const oldStatus = deferred<Connection>();
  let calls = 0;
  const controller = createWhatsappPanelController(
    adapter({
      async getStatus() {
        return ++calls === 1 ? oldStatus.promise : connection;
      },
      async listMessages() {
        return {
          items: [message("synthetic-wrong-conversation")],
          nextCursor: null,
        };
      },
    }),
  );
  const old = controller.refresh();
  await controller.refresh();
  oldStatus.resolve({
    state: "disabled",
    capabilities: { canRead: false, canAssign: false, canSend: false },
  });
  await old;
  await controller.select(first.id);
  assert.equal(controller.snapshot().connection.state, "connected");
  assert.equal(controller.snapshot().messagesPhase, "error");
  assert.deepEqual(controller.snapshot().messages.items, []);
});

test("snapshots do not expose mutable live state and drafts have a bounded size", async () => {
  const controller = await loaded();
  const state = controller.snapshot();
  state.conversations.items.length = 0;
  assert.equal(controller.snapshot().conversations.items.length, 2);
  await controller.select(first.id);
  controller.setDraft("x".repeat(5000));
  assert.equal(controller.snapshot().draft.length, 4000);
  await nextTurn();
});
