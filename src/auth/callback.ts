export const AUTH_ORIGIN = "http://127.0.0.1:5174";
export const AUTH_CALLBACK = `${AUTH_ORIGIN}/auth/callback`;
export type CallbackInput = {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
};
export type ParsedCallback =
  | { ok: true; code: string; flowId?: string }
  | {
      ok: false;
      reason: "missing" | "invalid" | "provider";
    };
export function parseCallback(input: CallbackInput): ParsedCallback {
  if (
    input.origin !== AUTH_ORIGIN ||
    input.pathname !== "/auth/callback" ||
    input.hash
  )
    return { ok: false, reason: "invalid" };
  const params = new URLSearchParams(input.search);
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
    return { ok: false, reason: "invalid" };
  if (params.has("error") || params.has("error_code"))
    return { ok: false, reason: "provider" };
  if ([...params.keys()].some((key) => !["code", "sb_flow_id"].includes(key)))
    return { ok: false, reason: "invalid" };
  const code = params.get("code");
  if (!code) return { ok: false, reason: "missing" };
  if (!/^[A-Za-z0-9_-]{8,512}$/u.test(code))
    return { ok: false, reason: "invalid" };
  const flowId = params.get("sb_flow_id");
  if (flowId !== null && !/^[A-Za-z0-9_-]{8,64}$/u.test(flowId))
    return { ok: false, reason: "invalid" };
  return { ok: true, code, ...(flowId ? { flowId } : {}) };
}
