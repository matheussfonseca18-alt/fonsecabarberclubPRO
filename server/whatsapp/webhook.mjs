import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { ContractError } from './policy.mjs';

const opaqueId = v => typeof v === 'string' && v.length > 0 && v.length <= 256;
const fail = () => { throw new ContractError(400, 'INVALID_EVENT', 'Evento inválido.'); };

/** Pure verifier/normalizer; this does not expose an HTTP route or connect a service. */
export function verifyWahaEvent({ rawBody, signature, algorithm, secret, instanceId, environment, allowedSessions, now = Date.now() }) {
  if (!secret || !opaqueId(instanceId) || !['test','production'].includes(environment) || !Array.isArray(allowedSessions) || allowedSessions.length === 0) throw new ContractError(423, 'INTEGRATION_DISABLED', 'Recepção não configurada.');
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 1024 * 1024) throw new ContractError(413, 'PAYLOAD_TOO_LARGE', 'Corpo inválido ou muito grande.');
  if (algorithm !== 'sha512' || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) throw new ContractError(401, 'INVALID_SIGNATURE', 'Assinatura inválida.');
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new ContractError(401, 'INVALID_SIGNATURE', 'Assinatura inválida.');
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { fail(); }
  if (!event || !opaqueId(event.id) || !opaqueId(event.session) || !allowedSessions.includes(event.session) || typeof event.event !== 'string' || !Number.isSafeInteger(event.timestamp) || event.timestamp < 0 || !Number.isFinite(new Date(event.timestamp).getTime())) fail();
  const base = { schema: 'fonseca.whatsapp.event.v2', environment, instanceId, providerEventId: event.id, session: event.session, occurredAt: new Date(event.timestamp).toISOString(), receivedAt: new Date(now).toISOString(), bodyDigest: createHash('sha256').update(rawBody).digest('hex') };
  if (!['message','message.ack','session.status'].includes(event.event)) return { ...base, type: 'ignored', reason: 'UNSUPPORTED_EVENT' };
  const p = event.payload;
  if (!p || typeof p !== 'object') fail();
  if (event.event === 'session.status') {
    if (!['STOPPED','STARTING','SCAN_QR_CODE','WORKING','FAILED'].includes(p.status)) return { ...base, type: 'ignored', reason: 'UNSUPPORTED_SESSION_STATUS' };
    return { ...base, type: 'session.status', status: p.status };
  }
  if (!opaqueId(p.id) || typeof p.fromMe !== 'boolean') fail();
  if (event.event === 'message.ack') {
    if (!Number.isSafeInteger(p.ack) || p.ack < -1 || p.ack > 4) fail();
    return { ...base, type: 'message.ack', providerMessageId: p.id, ack: p.ack };
  }
  if (p.fromMe) return { ...base, type: 'ignored', reason: 'OWN_MESSAGE' };
  if (!opaqueId(p.from)) fail();
  if (p.from.endsWith('@g.us') || p.from.endsWith('@broadcast')) return { ...base, type: 'ignored', reason: 'UNSUPPORTED_CHAT' };
  if (p.hasMedia !== false || typeof p.body !== 'string' || p.body.length > 10000) return { ...base, type: 'ignored', reason: 'UNSUPPORTED_CONTENT' };
  return { ...base, type: 'message.received', providerMessageId: p.id, chatId: p.from, fromMe: false, text: p.body };
}

export function inboxKey(event) {
  return JSON.stringify([event.environment, event.instanceId, event.session, event.providerEventId]);
}

export function messageEffectKey(event, handlerVersion) {
  if (!opaqueId(event.providerMessageId) || !opaqueId(handlerVersion)) throw new TypeError('Missing message identity');
  return JSON.stringify([event.environment, event.instanceId, event.session, event.providerMessageId, handlerVersion]);
}

/** Persist only through an injected repository transaction. Duplicate event ids
 * with a different digest are rejected. HTTP adapter must ACK only after this resolves. */
export async function acceptVerifiedEvent(event, repository) {
  if (!repository?.insertInboxOnce) throw new ContractError(503, 'INBOX_UNAVAILABLE', 'Recepção temporariamente indisponível.');
  const result = await repository.insertInboxOnce({ key: inboxKey(event), event, bodyDigest: event.bodyDigest });
  if (result?.kind === 'duplicate' && result.bodyDigest !== event.bodyDigest) throw new ContractError(409, 'EVENT_CONFLICT', 'Evento conflitante.');
  if (!['inserted','duplicate'].includes(result?.kind)) throw new ContractError(503, 'INBOX_UNAVAILABLE', 'Recepção temporariamente indisponível.');
  return { accepted: true, duplicate: result.kind === 'duplicate' };
}
