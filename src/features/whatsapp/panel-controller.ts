import type {
  Connection,
  Conversation,
  Message,
  Page,
  User,
  WhatsappAdapter,
} from "./contracts.ts";
import {
  createDisabledWhatsappAdapter,
  disabledConnection,
  WhatsappClientError,
} from "./client.ts";

export type LoadPhase = "idle" | "loading" | "ready" | "error";
export interface PanelState {
  connection: Connection;
  statusPhase: LoadPhase;
  statusError: string | null;
  query: string;
  conversations: Page<Conversation>;
  conversationsPhase: LoadPhase;
  conversationsError: string | null;
  selectedId: string | null;
  messages: Page<Message>;
  messagesPhase: LoadPhase;
  messagesError: string | null;
  assignees: User[];
  assigneesPhase: LoadPhase;
  assigneesError: string | null;
  assignmentPhase: LoadPhase;
  notice: string | null;
  draft: string;
}

function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null };
}
function initial(): PanelState {
  return {
    connection: disabledConnection(),
    statusPhase: "idle",
    statusError: null,
    query: "",
    conversations: emptyPage(),
    conversationsPhase: "idle",
    conversationsError: null,
    selectedId: null,
    messages: emptyPage(),
    messagesPhase: "idle",
    messagesError: null,
    assignees: [],
    assigneesPhase: "idle",
    assigneesError: null,
    assignmentPhase: "idle",
    notice: null,
    draft: "",
  };
}
function safeError(error: unknown): string {
  return error instanceof WhatsappClientError
    ? error.message
    : "Não foi possível consultar o serviço. Tente novamente.";
}
function merge<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item]),
    ).values(),
  ];
}

/** In-memory controller. Scope changes and dispose immediately erase conversations and drafts. */
export function createWhatsappPanelController(
  adapter: WhatsappAdapter = createDisabledWhatsappAdapter(),
) {
  let state = initial();
  let generation = 0;
  let disposed = false;
  const drafts = new Map<string, string>();
  const listeners = new Set<() => void>();
  const pending = new Map<string, AbortController>();
  function emit() {
    if (!disposed) listeners.forEach((listener) => listener());
  }
  function abort(key: string) {
    pending.get(key)?.abort();
    pending.delete(key);
  }
  function abortAll() {
    generation += 1;
    pending.forEach((controller) => controller.abort());
    pending.clear();
  }
  function begin(key: string) {
    abort(key);
    const controller = new AbortController();
    pending.set(key, controller);
    const currentGeneration = generation;
    return {
      signal: controller.signal,
      current: () =>
        !disposed &&
        !controller.signal.aborted &&
        currentGeneration === generation &&
        pending.get(key) === controller,
    };
  }
  function clearDetail() {
    abort("messages");
    abort("assignment");
    state.selectedId = null;
    state.messages = emptyPage();
    state.messagesPhase = "idle";
    state.messagesError = null;
    state.assignmentPhase = "idle";
    state.notice = null;
    state.draft = "";
  }
  function denyRead() {
    abortAll();
    drafts.clear();
    state.conversations = emptyPage();
    state.conversationsPhase = "idle";
    state.assignees = [];
    state.assigneesPhase = "idle";
    clearDetail();
  }
  function handleAccessError(error: unknown): boolean {
    if (
      !(error instanceof WhatsappClientError) ||
      !["unauthorized", "forbidden"].includes(error.code)
    )
      return false;
    denyRead();
    state.connection = disabledConnection();
    state.connection.reason = error.message;
    state.statusPhase = "error";
    state.statusError = error.message;
    emit();
    return true;
  }
  async function loadConversations(append = false) {
    if (disposed || !state.connection.capabilities.canRead) return;
    if (
      append &&
      (state.conversationsPhase === "loading" ||
        !state.conversations.nextCursor)
    )
      return;
    const cursor = append
      ? (state.conversations.nextCursor ?? undefined)
      : undefined;
    const task = begin("conversations");
    if (!append) {
      state.conversations = emptyPage();
      clearDetail();
    }
    state.conversationsPhase = "loading";
    state.conversationsError = null;
    emit();
    try {
      const result = await adapter.listConversations({
        query: state.query,
        cursor,
        limit: 30,
        signal: task.signal,
      });
      if (!task.current()) return;
      state.conversations = {
        items: merge(append ? state.conversations.items : [], result.items),
        nextCursor: result.nextCursor === cursor ? null : result.nextCursor,
      };
      state.conversationsPhase = "ready";
      emit();
    } catch (error) {
      if (!task.current() || handleAccessError(error)) return;
      state.conversationsPhase = "error";
      state.conversationsError = safeError(error);
      emit();
    }
  }
  async function loadMessages(append = false) {
    const selectedId = state.selectedId;
    if (disposed || !selectedId || !state.connection.capabilities.canRead)
      return;
    if (
      append &&
      (state.messagesPhase === "loading" || !state.messages.nextCursor)
    )
      return;
    const cursor = append
      ? (state.messages.nextCursor ?? undefined)
      : undefined;
    const task = begin("messages");
    if (!append) state.messages = emptyPage();
    state.messagesPhase = "loading";
    state.messagesError = null;
    emit();
    try {
      const result = await adapter.listMessages(selectedId, {
        cursor,
        limit: 30,
        signal: task.signal,
      });
      if (!task.current() || state.selectedId !== selectedId) return;
      if (result.items.some((item) => item.conversationId !== selectedId))
        throw new WhatsappClientError("invalid_response");
      state.messages = {
        items: merge(append ? state.messages.items : [], result.items),
        nextCursor: result.nextCursor === cursor ? null : result.nextCursor,
      };
      state.messagesPhase = "ready";
      emit();
    } catch (error) {
      if (!task.current() || handleAccessError(error)) return;
      state.messagesPhase = "error";
      state.messagesError = safeError(error);
      emit();
    }
  }
  async function loadAssignees() {
    if (disposed || !state.connection.capabilities.canAssign) return;
    const task = begin("assignees");
    state.assigneesPhase = "loading";
    state.assigneesError = null;
    emit();
    try {
      const result = await adapter.listAssignees(task.signal);
      if (!task.current()) return;
      state.assignees = result;
      state.assigneesPhase = "ready";
      emit();
    } catch (error) {
      if (!task.current() || handleAccessError(error)) return;
      state.assignees = [];
      state.assigneesPhase = "error";
      state.assigneesError = safeError(error);
      emit();
    }
  }
  async function refresh() {
    if (disposed) return;
    abortAll();
    const task = begin("status");
    state = { ...initial(), query: state.query, statusPhase: "loading" };
    emit();
    try {
      const connection = await adapter.getStatus(task.signal);
      if (!task.current()) return;
      state.connection = connection;
      state.statusPhase = "ready";
      if (!connection.capabilities.canRead) {
        denyRead();
        emit();
        return;
      }
      emit();
      await Promise.all([loadConversations(), loadAssignees()]);
    } catch (error) {
      if (!task.current()) return;
      denyRead();
      state.connection = disabledConnection();
      state.statusPhase = "error";
      state.statusError = safeError(error);
      emit();
    }
  }
  async function assign(assigneeId: string | null) {
    const item = state.conversations.items.find(
      (item) => item.id === state.selectedId,
    );
    if (
      disposed ||
      !item ||
      !state.connection.capabilities.canAssign ||
      state.assignmentPhase === "loading"
    )
      return;
    if (
      assigneeId !== null &&
      !state.assignees.some((user) => user.id === assigneeId)
    )
      return;
    const task = begin("assignment");
    state.assignmentPhase = "loading";
    state.notice = null;
    emit();
    try {
      const updated = await adapter.assignConversation({
        conversationId: item.id,
        assigneeId,
        expectedVersion: item.version,
        signal: task.signal,
      });
      if (!task.current() || state.selectedId !== item.id) return;
      if (updated.id !== item.id)
        throw new WhatsappClientError("invalid_response");
      state.conversations.items = state.conversations.items.map((existing) =>
        existing.id === item.id ? updated : existing,
      );
      state.assignmentPhase = "ready";
      state.notice = "Responsável atualizado pelo serviço.";
      emit();
    } catch (error) {
      if (!task.current() || handleAccessError(error)) return;
      state.assignmentPhase = "error";
      state.notice = safeError(error);
      emit();
    }
  }
  return {
    snapshot(): PanelState {
      return structuredClone(state);
    },
    subscribe(listener: () => void) {
      if (!disposed) listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    async search(query: string) {
      if (disposed) return;
      state.query = query.trim().slice(0, 160);
      await loadConversations();
    },
    loadConversations,
    loadMessages,
    loadAssignees,
    async select(id: string) {
      if (
        disposed ||
        !state.connection.capabilities.canRead ||
        !state.conversations.items.some((item) => item.id === id)
      )
        return;
      clearDetail();
      state.selectedId = id;
      state.draft = drafts.get(id) ?? "";
      await loadMessages();
    },
    closeDetail() {
      if (disposed) return;
      clearDetail();
      emit();
    },
    setDraft(text: string) {
      if (
        disposed ||
        !state.selectedId ||
        !state.connection.capabilities.canRead
      )
        return;
      state.draft = text.slice(0, 4000);
      if (state.draft) drafts.set(state.selectedId, state.draft);
      else drafts.delete(state.selectedId);
    },
    clearDraft() {
      if (disposed || !state.selectedId) return;
      drafts.delete(state.selectedId);
      state.draft = "";
      emit();
    },
    requestSend() {
      if (disposed) return false;
      state.notice =
        "Envio bloqueado nesta entrega. O rascunho existe somente nesta aba.";
      emit();
      return false;
    },
    assign,
    resetScope() {
      if (disposed) return;
      abortAll();
      drafts.clear();
      state = initial();
      state.connection.reason =
        "A sessão ou o escopo mudou. Atualize para consultar novamente.";
      emit();
    },
    destroy() {
      if (disposed) return;
      abortAll();
      drafts.clear();
      state = initial();
      listeners.clear();
      disposed = true;
    },
  };
}

export type WhatsappPanelController = ReturnType<
  typeof createWhatsappPanelController
>;
