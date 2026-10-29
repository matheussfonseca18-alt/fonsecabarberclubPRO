import { AuthClient, type GoTrueClientOptions } from "@supabase/supabase-js";
import type { AuthConfig } from "./config.ts";
import { AUTH_STORAGE_KEY, firstLoginRedirect, type AuthPort } from "./flow.ts";
import type { HybridAuthStorage } from "./storage.ts";
import { createAuthTransport } from "./transport.ts";

/** Pinned SDK's protected channel is disabled: sessions belong to one document. */
class DocumentAuthClient extends AuthClient {
  constructor(options: GoTrueClientOptions) {
    super(options);
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
  }
}
export function createSdkAuthPort(
  config: Extract<AuthConfig, { enabled: true }>,
  storage: HybridAuthStorage,
  fetcher?: typeof fetch,
): AuthPort {
  const transport = createAuthTransport(config.baseUrl, fetcher);
  const sdk = new DocumentAuthClient({
    url: `${config.baseUrl}/auth/v1`,
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
    },
    storageKey: AUTH_STORAGE_KEY,
    storage,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: false,
    autoRefreshToken: false,
    skipAutoInitialize: true,
    debug: false,
    experimental: { appendPkceFlowIdToRedirects: false },
    fetch: transport.fetch,
  });
  let initialization: ReturnType<DocumentAuthClient["initialize"]> | undefined;
  const ready = () => (initialization ??= sdk.initialize());
  return {
    async send(email) {
      await ready();
      return sdk.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: firstLoginRedirect,
        },
      });
    },
    async exchange(code, flowId) {
      await ready();
      const result = await sdk.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      return { error: result.error, session: result.data.session };
    },
    async user(token) {
      await ready();
      const result = await sdk.getUser(token);
      return { error: result.error, user: result.data.user };
    },
    async signOut(token) {
      // SDK signOut loads/possibly refreshes session; use only the explicit token.
      if (!token) return { error: new Error("Revocation unconfirmed") };
      try {
        const response = await transport.fetch(
          `${config.baseUrl}/auth/v1/logout?scope=local`,
          {
            method: "POST",
            headers: {
              apikey: config.publishableKey,
              Authorization: `Bearer ${token}`,
            },
          },
        );
        return {
          error: response.ok ? null : new Error("Revocation unconfirmed"),
        };
      } catch {
        return { error: new Error("Revocation unconfirmed") };
      } finally {
        storage.clearMemory();
      }
    },
    abort: transport.abort,
    dispose() {
      transport.abort();
      void sdk.dispose();
    },
  };
}
