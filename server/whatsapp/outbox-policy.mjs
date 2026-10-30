import { createHash } from 'node:crypto';
import { denyOutbound } from './policy.mjs';

const identifier = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 256;

export function businessKey({ environment, tenantId, contactId, occurrenceId, purpose, ruleVersion }) {
  const parts = [environment, tenantId, contactId, occurrenceId, purpose, ruleVersion];
  if (parts.some(p => typeof p !== 'string' || !p || p.length > 256) || !['test','production'].includes(environment)) throw new TypeError('Invalid business identity');
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

// Evaluates policy only. A positive result NEVER enables dispatch in this delivery.
export function businessEligibility({ intent, conversation, consent, now = Date.now() }) {
  if (!intent || !conversation || !identifier(intent.tenantId) || !identifier(intent.conversationId) || !identifier(conversation.contactId) || !identifier(intent.purpose) || intent.tenantId !== conversation.tenantId || intent.conversationId !== conversation.id) return { eligible: false, code: 'SCOPE_MISMATCH' };
  if (conversation.owner !== 'fonseca') return { eligible: false, code: 'OWNER_BLOCKED' };
  if (conversation.optedOut !== false) return { eligible: false, code: 'OPTED_OUT' };
  if (conversation.humanPaused !== false) return { eligible: false, code: 'HUMAN_PAUSED' };
  if (!consent || consent.active !== true || consent.tenantId !== intent.tenantId || consent.contactId !== conversation.contactId || consent.purpose !== intent.purpose || consent.channel !== 'whatsapp') return { eligible: false, code: 'CONSENT_REQUIRED' };
  if (!Number.isFinite(now) || typeof intent.expiresAt !== 'string' || !Number.isFinite(Date.parse(intent.expiresAt)) || Date.parse(intent.expiresAt) <= now) return { eligible: false, code: 'EXPIRED' };
  if (!['test','production'].includes(intent.environment)) return { eligible: false, code: 'ENVIRONMENT_BLOCKED' };
  if (intent.environment === 'test' && intent.allowlisted !== true) return { eligible: false, code: 'NOT_ALLOWLISTED' };
  return { eligible: true, code: 'ELIGIBLE_FOR_REVIEW' };
}

export function classifySendOutcome({ acceptedId, timedOut = false, transportError = false, status, provenNotAccepted = false }) {
  if (typeof acceptedId === 'string' && acceptedId) return { state: 'accepted', retry: false };
  if (timedOut || transportError) return { state: 'unknown', retry: false };
  if (status === 401 || status === 403) return { state: 'blocked', retry: false };
  if (provenNotAccepted === true && Number.isInteger(status) && (status === 429 || (status >= 500 && status <= 599))) return { state: 'retry_wait', retry: true };
  return { state: 'unknown', retry: false };
}

export async function dispatchMessage() { denyOutbound(); }
