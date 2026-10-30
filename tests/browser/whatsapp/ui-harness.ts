import { mountWhatsappPanel } from "../../../src/features/whatsapp/panel.ts";
import "../../../src/features/whatsapp/panel.css";
import { createDisabledWhatsappAdapter } from "../../../src/features/whatsapp/client.ts";
import type {
  Conversation,
  Message,
  Page,
  WhatsappAdapter,
} from "../../../src/features/whatsapp/contracts.ts";

// All content in this harness is synthetic and stays under tests/.
const first: Conversation = {
  id: "synthetic-a",
  displayName: "Contato sintético <img src=x onerror=alert(1)>",
  preview: "Prévia sintética " + "longa ".repeat(30),
  updatedAt: "2026-10-30T10:00:00Z",
  unreadCount: 2,
  assignedTo: null,
  version: 1,
  optedOut: false,
  owner: "fonseca",
};
const second: Conversation = {
  ...first,
  id: "synthetic-b",
  displayName: "Contato sintético B",
  unreadCount: 0,
  optedOut: true,
  owner: "appbarber",
};
const third: Conversation = {
  ...first,
  id: "synthetic-c",
  displayName: "Contato sintético C",
  unreadCount: 0,
  optedOut: false,
  owner: "unassigned",
};
const assignee = {
  id: "synthetic-agent",
  displayName: "Responsável sintético",
};
let scopeListener = () => {};
let slow = false;
let failList = false;
let pending: ((page: Page<Message>) => void) | null = null;
const slowAssignment =
  new URLSearchParams(location.search).get("slowAssignment") === "1";
let finishAssignment: (() => void) | null = null;
const metrics = {
  sends: 0,
  assignments: 0,
  queries: [] as string[],
  unsubscribes: 0,
  cancelledMessages: 0,
};
function message(id: string, older = false): Message {
  return {
    id: older ? "synthetic-older" : `synthetic-message-${id}`,
    conversationId: id,
    direction: older ? "outbound" : "inbound",
    text: older
      ? "Mensagem anterior sintética"
      : `Mensagem sintética ${id} <script>window.syntheticExecuted=true</script>`,
    createdAt: older ? "2026-10-30T09:00:00Z" : "2026-10-30T10:00:00Z",
    status: older ? "unknown" : "received",
  };
}
const adapter: WhatsappAdapter = {
  ...createDisabledWhatsappAdapter(),
  async getStatus() {
    return {
      state: "connected",
      capabilities: { canRead: true, canAssign: true, canSend: false },
    };
  },
  async listConversations(request) {
    metrics.queries.push(request?.query ?? "");
    if (failList) throw new Error("synthetic private debug content");
    if (request?.query === "nenhuma") return { items: [], nextCursor: null };
    return request?.cursor
      ? { items: [third], nextCursor: null }
      : { items: [first, second], nextCursor: "synthetic-next" };
  },
  async listMessages(id, request) {
    if (slow && id === first.id) {
      request?.signal?.addEventListener(
        "abort",
        () => metrics.cancelledMessages++,
      );
      return new Promise((resolve) => {
        pending = resolve;
      });
    }
    return {
      items: [message(id, Boolean(request?.cursor))],
      nextCursor: request?.cursor ? null : "synthetic-older-page",
    };
  },
  async listAssignees() {
    return [assignee];
  },
  async assignConversation(request) {
    metrics.assignments++;
    if (slowAssignment)
      await new Promise<void>((resolve) => {
        finishAssignment = resolve;
      });
    return {
      ...first,
      id: request.conversationId,
      assignedTo: request.assigneeId ? assignee : null,
      version: request.expectedVersion + 1,
    };
  },
  async sendMessage() {
    metrics.sends++;
    throw new Error("send must stay blocked");
  },
};
const mode =
  (globalThis as typeof globalThis & { syntheticHarnessMode?: string })
    .syntheticHarnessMode ?? new URLSearchParams(location.search).get("mode");
if (slowAssignment) {
  const release = () => {
    finishAssignment?.();
    finishAssignment = null;
  };
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Liberar atribuição sintética (Alt+R)";
  button.setAttribute("aria-keyshortcuts", "Alt+R");
  button.addEventListener("click", release);
  document.querySelector("#panel")!.before(button);
  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      release();
    }
  });
}
const panel = mountWhatsappPanel(
  document.querySelector<HTMLElement>("#panel")!,
  mode === "disabled"
    ? {}
    : {
        adapter,
        ...(mode === "missing-scope"
          ? {}
          : {
              subscribeScope(listener: () => void) {
                scopeListener = listener;
                return () => {
                  metrics.unsubscribes++;
                  scopeListener = () => {};
                };
              },
            }),
      },
);
Object.assign(window, {
  syntheticPanel: {
    metrics,
    panel,
    scope: () => scopeListener(),
    setSlow: (value: boolean) => {
      slow = value;
    },
    setFailList: (value: boolean) => {
      failList = value;
    },
    release: () => {
      pending?.({ items: [message(first.id)], nextCursor: null });
      pending = null;
    },
  },
});
