import type { AuthConfig } from "./config.ts";
import {
  AUTH_CALLBACK,
  parseCallback,
  type CallbackInput,
} from "./callback.ts";
import type { HybridAuthStorage, AuthPersistentStorage } from "./storage.ts";
import type { CatalogSession } from "../data/catalog-read.ts";

export const AUTH_STORAGE_KEY = "fonseca-validation-auth-v1";
export const AUTH_ATTEMPT_KEY = "fonseca-first-login-attempt-v1";
export type AuthStatus =
  | "inactive"
  | "ready"
  | "sending"
  | "requested"
  | "uncertain"
  | "checking"
  | "authenticated"
  | "expired"
  | "error"
  | "cancelled"
  | "signed-out";
export type AuthState = { status: AuthStatus; message: string };
type User = {
  id?: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};
export interface AuthPort {
  send(email: string): Promise<{ error: unknown }>;
  exchange(
    code: string,
    flowId?: string,
  ): Promise<{
    error: unknown;
    session: { access_token: string; expires_at?: number; user: User } | null;
  }>;
  user(token: string): Promise<{ error: unknown; user: User | null }>;
  signOut(token?: string): Promise<{ error: unknown }>;
  abort(): void;
  dispose(): void;
}
type Dependencies = {
  config: AuthConfig;
  storage: HybridAuthStorage;
  persistent: AuthPersistentStorage | null;
  makeClient(): AuthPort;
  exclusive<T>(task: () => Promise<T>): Promise<T>;
  cryptoReady(): boolean;
  sessionChanged(session: CatalogSession | null): void;
  now?: () => number;
};
const messages = {
  inactive: "Login ainda não ativado. Nenhum e-mail será enviado.",
  ready:
    "Primeiro acesso por e-mail. Abra o link neste mesmo Chrome e computador.",
  requested:
    "Solicitação aceita pelo serviço de autenticação. A entrega do e-mail ainda depende do provedor. Não solicitaremos outro link automaticamente.",
  uncertain:
    "Já existe uma tentativa de envio. O resultado pode ser incerto; não será feito reenvio automático. Verifique o e-mail e o estado do envio.",
  expired:
    "O link está expirado, já foi utilizado ou não pertence a este navegador. Nenhum acesso foi liberado.",
  error:
    "Não foi possível validar o acesso. Nenhum catálogo foi liberado e não haverá nova tentativa automática.",
  authenticated:
    "E-mail confirmado. A consulta dos catálogos aguarda a liberação restrita da sua identidade. Esta sessão fica apenas nesta aba; recarregar encerra o acesso local.",
} as const;

export function createAuthFlow(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  let state: AuthState = {
    status: deps.config.enabled && deps.config.dispatchEnabled ? "ready" : "inactive",
    message: !deps.config.enabled ? messages.inactive : deps.config.dispatchEnabled ? messages.ready : "Configuração local pronta. O envio aguarda confirmação do SMTP salvo; nenhum link será solicitado agora.",
  };
  let client: AuthPort | null = null;
  let generation = 0;
  let busy = false;
  let session: CatalogSession | null = null;
  const listeners = new Set<() => void>();
  const set = (status: AuthStatus, message: string) => {
    state = { status, message };
    for (const listener of listeners) listener();
  };
  const clearSession = () => {
    session = null;
    deps.sessionChanged(null);
  };
  const getClient = () => (client ??= deps.makeClient());
  const marker = () => deps.persistent?.getItem(AUTH_ATTEMPT_KEY);
  const mark = (status: string) => {
    if (!deps.persistent) throw new Error("Storage unavailable");
    deps.persistent.setItem(
      AUTH_ATTEMPT_KEY,
      JSON.stringify({ version: 1, status, at: now() }),
    );
  };
  function acceptedUser(
    user: User | null,
    expectedId?: string,
  ): user is User & { id: string } {
    if (
      !deps.config.enabled ||
      !user ||
      !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/iu.test(user.id ?? "") ||
      (expectedId && user.id !== expectedId) ||
      user.email?.toLowerCase() !== deps.config.expectedEmail ||
      user.is_anonymous !== false
    )
      return false;
    const confirmed = Date.parse(user.email_confirmed_at ?? "");
    return Number.isFinite(confirmed) && confirmed > 0 && confirmed <= now();
  }
  function cleanup() {
    client?.abort();
    deps.storage.clearAll();
    clearSession();
  }
  return {
    snapshot: () => ({ ...state }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async send(email: string) {
      if (busy || !deps.config.enabled || !deps.config.dispatchEnabled) {
        if (!busy)
          set(
            "inactive",
            "Envio bloqueado até confirmar SMTP salvo e callback validado.",
          );
        return;
      }
      if (email.trim().toLowerCase() !== deps.config.expectedEmail) {
        set("error", "Use somente o e-mail autorizado para esta validação.");
        return;
      }
      busy = true;
      const ticket = ++generation;
      let requestStarted = false;
      try {
        await deps.exclusive(async () => {
          if (ticket !== generation) return;
          if (marker()) {
            set("uncertain", messages.uncertain);
            return;
          }
          if (!deps.cryptoReady() || !deps.storage.preflight())
            throw new Error("Preflight unavailable");
          mark("pending"); // Durable guard BEFORE any request; ambiguous outcomes never retry.
          set("sending", "Solicitando um único link de primeiro acesso…");
          requestStarted = true;
          const result = await getClient().send(email.trim().toLowerCase());
          if (ticket !== generation) return;
          mark(result.error ? "uncertain" : "accepted");
          set(
            result.error ? "uncertain" : "requested",
            result.error ? messages.uncertain : messages.requested,
          );
        });
      } catch {
        if (ticket === generation)
          set(
            requestStarted ? "uncertain" : "error",
            requestStarted
              ? messages.uncertain
              : "Este navegador não passou na verificação de origem, armazenamento ou segurança. Nenhum link foi solicitado.",
          );
      } finally {
        busy = false;
      }
    },
    async callback(input: CallbackInput) {
      const parsed = parseCallback(input);
      if (!parsed.ok) {
        ++generation;
        client?.abort();
        clearSession();
        deps.storage.clearMemory();
        set(
          parsed.reason === "provider" ? "expired" : "error",
          parsed.reason === "missing"
            ? "Nenhum código de acesso foi recebido. Abra o link solicitado no mesmo Chrome deste computador."
            : messages.expired,
        );
        return;
      }
      if (!deps.config.enabled) {
        ++generation;
        cleanup();
        set("inactive", messages.inactive);
        return;
      }
      if (busy) return;
      busy = true;
      const ticket = ++generation;
      clearSession();
      deps.storage.clearMemory();
      let candidateToken: string | undefined;
      try {
        await deps.exclusive(async () => {
          if (ticket !== generation) return;
          const raw = marker();
          if (!raw || !deps.storage.preflight() || !deps.cryptoReady()) {
            deps.storage.clearPkce();
            set("expired", messages.expired);
            return;
          }
          const attempt = JSON.parse(raw) as { status?: string };
          if (
            !["pending", "accepted", "uncertain"].includes(attempt.status ?? "")
          ) {
            deps.storage.clearPkce();
            set("expired", messages.expired);
            return;
          }
          const verifierKey = parsed.flowId
            ? `${AUTH_STORAGE_KEY}-flow-${parsed.flowId}-code-verifier`
            : `${AUTH_STORAGE_KEY}-code-verifier`;
          if (!(await deps.storage.getItem(verifierKey))) {
            mark("expired");
            deps.storage.clearPkce();
            set("expired", messages.expired);
            return;
          }
          if (ticket !== generation) return;
          mark("consumed"); // A code is exchanged at most once, including interrupted requests.
          set(
            "checking",
            "Validando o link e a identidade no serviço de autenticação…",
          );
          const result = await getClient().exchange(parsed.code, parsed.flowId);
          candidateToken = result.session?.access_token;
          deps.storage.clearPkce();
          if (ticket !== generation) {
            deps.storage.clearMemory();
            if (candidateToken) await getClient().signOut(candidateToken);
            return;
          }
          if (
            result.error ||
            !result.session ||
            !acceptedUser(result.session.user)
          )
            throw new Error("Invalid exchange");
          const verified = await getClient().user(result.session.access_token);
          if (ticket !== generation) {
            deps.storage.clearMemory();
            if (candidateToken) await getClient().signOut(candidateToken);
            return;
          }
          const expiresAt = (result.session.expires_at ?? 0) * 1000;
          if (
            verified.error ||
            !acceptedUser(verified.user, result.session.user.id) ||
            !Number.isSafeInteger(expiresAt) ||
            expiresAt <= now() ||
            !result.session.access_token
          )
            throw new Error("Invalid identity");
          session = {
            userId: verified.user.id,
            accessToken: result.session.access_token,
            expiresAt,
          };
          deps.sessionChanged({ ...session });
          set("authenticated", messages.authenticated);
        });
      } catch {
        clearSession();
        if (candidateToken) {
          try {
            await client?.signOut(candidateToken);
          } catch {
            /* remote revocation unconfirmed */
          }
        }
        cleanup();
        if (ticket === generation) set("error", messages.error);
      } finally {
        busy = false;
      }
    },
    async revalidate() {
      const original = session;
      if (!original) return;
      const ticket = ++generation;
      deps.sessionChanged(null);
      if (original.expiresAt <= now()) {
        cleanup();
        set("expired", messages.expired);
        return;
      }
      set("checking", "Conferindo a sessão ao retornar para esta aba…");
      try {
        const result = await getClient().user(original.accessToken);
        if (ticket !== generation) return;
        if (
          result.error ||
          !acceptedUser(result.user, original.userId) ||
          original.expiresAt <= now()
        )
          throw new Error("Session unavailable");
        deps.sessionChanged({ ...original });
        set("authenticated", messages.authenticated);
      } catch {
        if (ticket === generation) {
          cleanup();
          set("error", messages.error);
        }
      }
    },
    checkExpiry() {
      if (session && session.expiresAt <= now()) {
        ++generation;
        cleanup();
        set("expired", messages.expired);
      }
    },
    async signOut() {
      ++generation;
      const token = session?.accessToken;
      clearSession();
      client?.abort();
      let revoked = false;
      try {
        revoked = Boolean(client && !(await client.signOut(token)).error);
      } catch {
        /* sanitized below */
      }
      deps.storage.clearAll();
      set(
        "signed-out",
        revoked
          ? "Sessão encerrada nesta aba e revogação solicitada ao serviço."
          : "Sessão local removida. Não foi possível confirmar a revogação no serviço; os tokens existentes expiram conforme o servidor.",
      );
    },
    cancel() {
      ++generation;
      cleanup();
      try {
        if (marker()) mark("cancelled");
      } catch {
        /* no resend guard is removed */
      }
      set(
        "cancelled",
        "Tentativa interrompida neste navegador. Nenhum reenvio será feito; um e-mail já solicitado ainda pode chegar.",
      );
    },
    dispose() {
      ++generation;
      client?.abort();
      // Preserve only the verifier during the trip to the mailbox/new document.
      if (state.status === "checking" || session) deps.storage.clearAll();
      else deps.storage.clearMemory();
      clearSession();
      client?.dispose();
      listeners.clear();
    },
  };
}
export type AuthFlow = ReturnType<typeof createAuthFlow>;
export const firstLoginRedirect = AUTH_CALLBACK;
