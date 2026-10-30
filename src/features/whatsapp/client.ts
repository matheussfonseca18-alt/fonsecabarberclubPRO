import type {
  AssignmentRequest,
  Connection,
  Conversation,
  ConversationRequest,
  Message,
  Page,
  PageRequest,
  User,
  WhatsappAdapter,
} from "./contracts.ts";

export type ClientErrorCode =
  | "disabled"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "invalid_response"
  | "invalid_request"
  | "unavailable";

export class WhatsappClientError extends Error {
  readonly code: ClientErrorCode;
  constructor(code: ClientErrorCode) {
    const messages: Record<ClientErrorCode, string> = {
      disabled: "Esta operação está desativada nesta entrega.",
      unauthorized:
        "Sua sessão não está disponível. Entre novamente para consultar.",
      forbidden: "Esta consulta não está disponível para sua sessão.",
      conflict:
        "A conversa foi alterada. Atualize antes de atribuir novamente.",
      invalid_response:
        "O serviço retornou uma resposta inválida. Tente novamente.",
      invalid_request: "A solicitação não é válida.",
      unavailable: "Não foi possível consultar o serviço. Tente novamente.",
    };
    super(messages[code]);
    this.name = "WhatsappClientError";
    this.code = code;
  }
}

export function disabledConnection(): Connection {
  return {
    state: "disabled",
    capabilities: { canRead: false, canAssign: false, canSend: false },
    reason: "Integração inativa. Nenhuma conversa foi consultada.",
  };
}

export function createDisabledWhatsappAdapter(): WhatsappAdapter {
  return {
    async getStatus() {
      return disabledConnection();
    },
    async listConversations() {
      return { items: [], nextCursor: null };
    },
    async listMessages() {
      return { items: [], nextCursor: null };
    },
    async listAssignees() {
      return [];
    },
    async assignConversation() {
      throw new WhatsappClientError("disabled");
    },
    async sendMessage() {
      throw new WhatsappClientError("disabled");
    },
  };
}

function fail(): never {
  throw new WhatsappClientError("invalid_response");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function str(value: unknown, maximum = 20000): string {
  if (typeof value !== "string" || value.length > maximum) fail();
  return value;
}
function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}
function id(value: unknown): string {
  const result = str(value, 256);
  if (!result || hasControlCharacters(result)) fail();
  return result;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail();
  return value;
}
function date(value: unknown): string {
  const result = str(value, 64);
  if (
    !/^\d{4}-\d{2}-\d{2}T/u.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    fail();
  return result;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail();
  return value as T;
}
function user(value: unknown): User {
  const item = record(value);
  return { id: id(item.id), displayName: str(item.displayName, 300) };
}
function conversation(value: unknown): Conversation {
  const item = record(value);
  return {
    id: id(item.id),
    displayName: str(item.displayName, 300),
    ...(item.preview === undefined ? {} : { preview: str(item.preview, 2000) }),
    updatedAt: date(item.updatedAt),
    unreadCount: count(item.unreadCount),
    assignedTo: item.assignedTo === null ? null : user(item.assignedTo),
    version: count(item.version),
    optedOut: bool(item.optedOut),
    owner: choice(item.owner, ["appbarber", "fonseca", "unassigned"]),
  };
}
function message(value: unknown): Message {
  const item = record(value);
  return {
    id: id(item.id),
    conversationId: id(item.conversationId),
    direction: choice(item.direction, ["inbound", "outbound"]),
    text: str(item.text),
    createdAt: date(item.createdAt),
    status: choice(item.status, [
      "received",
      "pending",
      "accepted",
      "delivered",
      "read",
      "unknown",
      "failed",
    ]),
  };
}
function page<T>(value: unknown, parse: (value: unknown) => T): Page<T> {
  const item = record(value);
  if (!Array.isArray(item.items) || item.items.length > 100) fail();
  const nextCursor = item.nextCursor === null ? null : id(item.nextCursor);
  return { items: item.items.map(parse), nextCursor };
}
function connection(value: unknown): Connection {
  const item = record(value);
  const caps = record(item.capabilities);
  if (caps.canSend !== false) fail();
  const state = choice(item.state, [
    "disabled",
    "connected",
    "disconnected",
    "error",
  ]);
  const canRead = bool(caps.canRead);
  const canAssign = bool(caps.canAssign);
  if (
    (state === "disabled" && (canRead || canAssign)) ||
    (canAssign && !canRead)
  )
    fail();
  return {
    state,
    capabilities: { canRead, canAssign, canSend: false },
    ...(item.label === undefined ? {} : { label: str(item.label, 300) }),
    ...(item.reason === undefined ? {} : { reason: str(item.reason, 1000) }),
    ...(item.updatedAt === undefined
      ? {}
      : { updatedAt: date(item.updatedAt) }),
  };
}

function requestId(value: string): string {
  if (!value || value.length > 256 || hasControlCharacters(value))
    throw new WhatsappClientError("invalid_request");
  return encodeURIComponent(value);
}
function queryParams(request: PageRequest & { query?: string } = {}): string {
  const params = new URLSearchParams();
  if (request.cursor !== undefined) {
    requestId(request.cursor);
    params.set("cursor", request.cursor);
  }
  if (request.query !== undefined) {
    if (request.query.length > 160)
      throw new WhatsappClientError("invalid_request");
    params.set("q", request.query);
  }
  const limit = request.limit ?? 30;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new WhatsappClientError("invalid_request");
  params.set("limit", String(limit));
  return `?${params.toString()}`;
}

export interface HttpWhatsappAdapterOptions {
  /** Both network access and assignment remain opt-in for later integration. */
  enabled?: boolean;
  enableAssignment?: boolean;
  getCsrfToken?: () => string | null;
  fetch?: typeof globalThis.fetch;
}

/** Fixed same-origin backend only. No upstream endpoint, credentials or token storage. */
export function createHttpWhatsappAdapter(
  options: HttpWhatsappAdapterOptions = {},
): WhatsappAdapter {
  if (options.enabled !== true) return createDisabledWhatsappAdapter();
  async function request(
    path: string,
    signal?: AbortSignal,
    body?: object,
  ): Promise<unknown> {
    let csrf: string | null = null;
    if (body) {
      if (!options.enableAssignment) throw new WhatsappClientError("disabled");
      csrf = options.getCsrfToken?.() ?? null;
      if (!csrf || /[\r\n]/u.test(csrf))
        throw new WhatsappClientError("disabled");
    }
    try {
      const response = await (options.fetch ?? globalThis.fetch)(
        `/api/whatsapp${path}`,
        {
          method: body ? "POST" : "GET",
          signal,
          credentials: "same-origin",
          mode: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: body
            ? {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-CSRF-Token": csrf!,
              }
            : { Accept: "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      if (!response.ok) {
        const code =
          response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? "forbidden"
              : response.status === 409
                ? "conflict"
                : response.status === 423
                  ? "disabled"
                  : "unavailable";
        throw new WhatsappClientError(code);
      }
      if (
        !/^application\/json(?:;|$)/iu.test(
          response.headers.get("content-type") ?? "",
        )
      )
        fail();
      return await response.json();
    } catch (error) {
      if (signal?.aborted || error instanceof WhatsappClientError) throw error;
      throw new WhatsappClientError("unavailable");
    }
  }
  return {
    async getStatus(signal) {
      const result = connection(await request("/status", signal));
      return {
        ...result,
        capabilities: {
          ...result.capabilities,
          canAssign:
            result.capabilities.canAssign &&
            options.enableAssignment === true &&
            typeof options.getCsrfToken === "function",
        },
      };
    },
    async listConversations(input: ConversationRequest = {}) {
      return page(
        await request(`/conversations${queryParams(input)}`, input.signal),
        conversation,
      );
    },
    async listMessages(conversationId, input: PageRequest = {}) {
      const result = page(
        await request(
          `/conversations/${requestId(conversationId)}/messages${queryParams(input)}`,
          input.signal,
        ),
        message,
      );
      if (result.items.some((item) => item.conversationId !== conversationId))
        fail();
      return result;
    },
    async listAssignees(signal) {
      const data = await request("/assignees", signal);
      if (!Array.isArray(data) || data.length > 1000) fail();
      return data.map(user);
    },
    async assignConversation(input: AssignmentRequest) {
      if (
        !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion < 0
      )
        throw new WhatsappClientError("invalid_request");
      if (input.assigneeId !== null) requestId(input.assigneeId);
      const result = conversation(
        await request(
          `/conversations/${requestId(input.conversationId)}/assignment`,
          input.signal,
          {
            assigneeId: input.assigneeId,
            expectedVersion: input.expectedVersion,
          },
        ),
      );
      if (result.id !== input.conversationId) fail();
      return result;
    },
    async sendMessage() {
      throw new WhatsappClientError("disabled");
    },
  };
}
