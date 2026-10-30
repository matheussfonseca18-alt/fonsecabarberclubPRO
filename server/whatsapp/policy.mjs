export class ContractError extends Error {
  constructor(status, code, message) { super(message); this.name = 'ContractError'; this.status = status; this.code = code; }
}

// A role is only an upper bound. Server-verified membership grants are ALSO required.
const roleLimits = Object.freeze({
  owner: ['whatsapp.read.all', 'whatsapp.read.assigned', 'whatsapp.assign'],
  admin: ['whatsapp.read.all', 'whatsapp.read.assigned', 'whatsapp.assign'],
  manager: ['whatsapp.read.all', 'whatsapp.read.assigned', 'whatsapp.assign'],
  receptionist: ['whatsapp.read.all', 'whatsapp.read.assigned', 'whatsapp.assign'],
  barber: ['whatsapp.read.assigned'],
});

export function accessFor(actor) {
  if (actor?.authenticated !== true || typeof actor.userId !== 'string' || !actor.userId || typeof actor.tenantId !== 'string' || !actor.tenantId) {
    throw new ContractError(401, 'UNAUTHENTICATED', 'Entre novamente para acessar as conversas.');
  }
  const limits = typeof actor.role === 'string' && Object.hasOwn(roleLimits, actor.role) ? roleLimits[actor.role] : [];
  const granted = new Set(Array.isArray(actor.permissions) ? actor.permissions.filter(p => limits.includes(p)) : []);
  const all = granted.has('whatsapp.read.all');
  const assigned = granted.has('whatsapp.read.assigned');
  return Object.freeze({ canRead: all || assigned, assignedOnly: !all, canAssign: all && granted.has('whatsapp.assign'), canSend: false });
}

export function requireConversation(actor, access, conversation, expectedId) {
  if (!access.canRead) throw new ContractError(403, 'FORBIDDEN', 'Seu perfil não tem acesso às conversas.');
  if (!conversation || conversation.tenantId !== actor.tenantId || (expectedId !== undefined && conversation.id !== expectedId) || (access.assignedOnly && conversation.assignedTo?.id !== actor.userId)) {
    throw new ContractError(404, 'NOT_FOUND', 'Conversa indisponível.');
  }
  return conversation;
}

export function denyOutbound() {
  throw new ContractError(423, 'OUTBOUND_DISABLED', 'O envio de mensagens ainda não está habilitado.');
}
