import { accessFor, ContractError, denyOutbound, requireConversation } from './policy.mjs';

const text = (v, max = 500) => typeof v === 'string' ? v.slice(0, max) : '';
const identifier = v => typeof v === 'string' && v.length > 0 && v.length <= 256;
const iso = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const userDto = u => u && identifier(u.id) ? { id: u.id, displayName: text(u.displayName, 160) } : null;
const owners = new Set(['appbarber', 'fonseca', 'unassigned']);
const states = new Set(['received', 'pending', 'accepted', 'delivered', 'read', 'unknown', 'failed']);
function conversationDto(c) {
  if (!identifier(c.id) || !Number.isSafeInteger(c.version) || c.version < 0 || !iso(c.updatedAt) || !owners.has(c.owner) || typeof c.optedOut !== 'boolean') {
    throw new ContractError(502, 'INVALID_BACKEND_RESPONSE', 'Não foi possível carregar esta conversa.');
  }
  return { id: c.id, displayName: text(c.displayName, 160), preview: text(c.preview), updatedAt: iso(c.updatedAt), unreadCount: Number.isSafeInteger(c.unreadCount) && c.unreadCount >= 0 ? c.unreadCount : 0, assignedTo: userDto(c.assignedTo), version: c.version, optedOut: c.optedOut, owner: c.owner };
}
function messageDto(m, actor, conversationId) {
  if (m.tenantId !== actor.tenantId || m.conversationId !== conversationId || !identifier(m.id) || !['inbound','outbound'].includes(m.direction) || !states.has(m.status) || !iso(m.createdAt)) {
    throw new ContractError(502, 'INVALID_BACKEND_RESPONSE', 'Não foi possível carregar as mensagens.');
  }
  return { id: m.id, conversationId, direction: m.direction, text: text(m.text, 10000), createdAt: iso(m.createdAt), status: m.status };
}
function page(result, map) {
  if (!result || !Array.isArray(result.items) || (result.nextCursor !== null && !identifier(result.nextCursor))) {
    throw new ContractError(502, 'INVALID_BACKEND_RESPONSE', 'Não foi possível carregar os dados.');
  }
  return { items: result.items.map(map), nextCursor: result.nextCursor };
}
function pagination(params) {
  const raw = params.get('limit');
  const limit = raw === null ? 30 : Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ContractError(400, 'INVALID_REQUEST', 'Limite de consulta inválido.');
  const cursor = params.get('cursor');
  if (cursor !== null && !identifier(cursor)) throw new ContractError(400, 'INVALID_REQUEST', 'Cursor inválido.');
  return { limit, cursor };
}

/** Framework-neutral boundary. actor and csrfVerified MUST be supplied by trusted
 * server middleware, never copied from request JSON, query, browser roles or headers.
 * No WAHA/n8n HTTP client, secret, database or real data is created by this module. */
export function createWhatsappHandler({ repository, readEnabled = false, assignmentEnabled = false, getConnectionState = async () => ({ state: 'disconnected' }) } = {}) {
  return async function handle(request) {
    try {
      const actor = request.actor;
      const access = accessFor(actor);
      if (typeof request.path !== 'string' || !request.path.startsWith('/api/whatsapp/') || request.path.startsWith('//')) throw new ContractError(404, 'NOT_FOUND', 'Recurso indisponível.');
      const url = new URL(request.path, 'https://backend.invalid');
      const path = url.pathname.slice('/api/whatsapp'.length);
      const method = request.method;
      const capabilities = { canRead: Boolean(readEnabled && repository && access.canRead), canAssign: Boolean(readEnabled && repository && assignmentEnabled && access.canAssign), canSend: false };
      if (method === 'GET' && path === '/status') {
        if (!access.canRead) throw new ContractError(403, 'FORBIDDEN', 'Seu perfil não tem acesso às conversas.');
        if (!capabilities.canRead) return ok({ state: 'disabled', capabilities, reason: 'Integração de conversas ainda não configurada.' });
        const status = await getConnectionState({ tenantId: actor.tenantId });
        const state = ['connected','disconnected','error'].includes(status?.state) ? status.state : 'error';
        return ok({ state, capabilities, ...(iso(status?.updatedAt) ? { updatedAt: iso(status.updatedAt) } : {}), ...(state === 'error' ? { reason: 'Não foi possível verificar a conexão.' } : {}) });
      }
      // Defense in depth: no browser request can make this package dispatch a message.
      if (method === 'POST' && /^\/conversations\/[^/]+\/messages$/.test(path)) denyOutbound();
      if (!access.canRead) throw new ContractError(403, 'FORBIDDEN', 'Seu perfil não tem acesso às conversas.');
      if (!capabilities.canRead) throw new ContractError(423, 'INTEGRATION_DISABLED', 'Integração de conversas ainda não configurada.');
      if (method === 'GET' && path === '/conversations') {
        const q = url.searchParams.get('q') ?? '';
        if (q.length > 160) throw new ContractError(400, 'INVALID_REQUEST', 'Busca muito longa.');
        const result = await repository.listConversations({ tenantId: actor.tenantId, userId: actor.userId, assignedOnly: access.assignedOnly, query: q, ...pagination(url.searchParams) });
        return ok(page(result, c => conversationDto(requireConversation(actor, access, c))));
      }
      if (method === 'GET' && path === '/assignees') {
        if (!capabilities.canAssign) throw new ContractError(403, 'FORBIDDEN', 'Atribuição indisponível para seu perfil.');
        const users = await repository.listAssignees({ tenantId: actor.tenantId });
        if (!Array.isArray(users) || users.some(u => u.tenantId !== actor.tenantId || !u.active || !userDto(u))) throw new ContractError(502, 'INVALID_BACKEND_RESPONSE', 'Não foi possível carregar os responsáveis.');
        return ok(users.map(userDto));
      }
      const match = path.match(/^\/conversations\/([^/]+)\/(messages|assignment)$/);
      if (!match) throw new ContractError(404, 'NOT_FOUND', 'Recurso indisponível.');
      let id;
      try { id = decodeURIComponent(match[1]); } catch { throw new ContractError(400, 'INVALID_REQUEST', 'Identificador inválido.'); }
      if (!identifier(id)) throw new ContractError(400, 'INVALID_REQUEST', 'Identificador inválido.');
      const conversation = requireConversation(actor, access, await repository.getConversation({ tenantId: actor.tenantId, id }), id);
      if (method === 'GET' && match[2] === 'messages') {
        const result = await repository.listMessages({ tenantId: actor.tenantId, conversationId: id, ...pagination(url.searchParams) });
        return ok(page(result, m => messageDto(m, actor, id)));
      }
      if (method === 'POST' && match[2] === 'assignment') {
        if (!capabilities.canAssign) throw new ContractError(403, 'FORBIDDEN', 'Atribuição indisponível para seu perfil.');
        if (request.csrfVerified !== true) throw new ContractError(403, 'CSRF_REJECTED', 'Recarregue a página antes de alterar o responsável.');
        const body = request.body;
        if (!body || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || !(body.assigneeId === null || identifier(body.assigneeId))) throw new ContractError(400, 'INVALID_REQUEST', 'Atribuição inválida.');
        if (conversation.version !== body.expectedVersion) throw new ContractError(409, 'VERSION_CONFLICT', 'A conversa foi atualizada. Recarregue antes de atribuir.');
        if (body.assigneeId !== null) {
          const assignee = await repository.getAssignableUser({ tenantId: actor.tenantId, id: body.assigneeId });
          if (!assignee || assignee.id !== body.assigneeId || assignee.tenantId !== actor.tenantId || !assignee.active) throw new ContractError(400, 'INVALID_ASSIGNEE', 'Responsável indisponível.');
        }
        // Repository MUST compare-and-swap version and write its audit record atomically.
        const changed = await repository.assignConversation({ tenantId: actor.tenantId, conversationId: id, assigneeId: body.assigneeId, expectedVersion: body.expectedVersion, actorId: actor.userId });
        if (!changed) throw new ContractError(409, 'VERSION_CONFLICT', 'A conversa foi atualizada. Recarregue antes de atribuir.');
        const updated = requireConversation(actor, access, changed, id);
        if (!Number.isSafeInteger(updated.version) || updated.version <= body.expectedVersion) throw new ContractError(502, 'INVALID_BACKEND_RESPONSE', 'Resposta de atribuição inválida.');
        return ok(conversationDto(updated));
      }
      throw new ContractError(405, 'METHOD_NOT_ALLOWED', 'Operação indisponível.');
    } catch (error) {
      const known = error instanceof ContractError;
      return { status: known ? error.status : 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Não foi possível concluir a consulta.' } } };
    }
  };
}
const ok = body => ({ status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body });
