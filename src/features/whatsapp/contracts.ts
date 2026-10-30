/** Public, tenant-scoped DTOs. Authorization is performed by the backend. */
export interface Connection {
  state: "disabled" | "connected" | "disconnected" | "error";
  label?: string;
  updatedAt?: string;
  capabilities: { canRead: boolean; canAssign: boolean; canSend: false };
  reason?: string;
}

export interface User {
  id: string;
  displayName: string;
}

export interface Conversation {
  id: string;
  displayName: string;
  preview?: string;
  updatedAt: string;
  unreadCount: number;
  assignedTo: User | null;
  version: number;
  optedOut: boolean;
  owner: "appbarber" | "fonseca" | "unassigned";
}

export interface Message {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  text: string;
  createdAt: string;
  status:
    | "received"
    | "pending"
    | "accepted"
    | "delivered"
    | "read"
    | "unknown"
    | "failed";
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageRequest {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface ConversationRequest extends PageRequest {
  query?: string;
}

export interface AssignmentRequest {
  conversationId: string;
  assigneeId: string | null;
  expectedVersion: number;
  signal?: AbortSignal;
}

export interface WhatsappAdapter {
  getStatus(signal?: AbortSignal): Promise<Connection>;
  listConversations(request?: ConversationRequest): Promise<Page<Conversation>>;
  listMessages(
    conversationId: string,
    request?: PageRequest,
  ): Promise<Page<Message>>;
  listAssignees(signal?: AbortSignal): Promise<User[]>;
  assignConversation(request: AssignmentRequest): Promise<Conversation>;
  /** Deliberately has no request payload or network implementation in this delivery. */
  sendMessage(): Promise<never>;
}
