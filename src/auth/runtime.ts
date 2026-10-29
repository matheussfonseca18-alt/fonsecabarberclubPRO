import { readAuthConfig } from "./config.ts";
import { AUTH_STORAGE_KEY, createAuthFlow, type AuthFlow } from "./flow.ts";
import { createHybridAuthStorage } from "./storage.ts";
import { createSdkAuthPort } from "./sdk.ts";
import { setAuthSession } from "./session.ts";
import { AUTH_ORIGIN } from "./callback.ts";

let instance: AuthFlow | undefined;
export const authConfiguration = readAuthConfig(import.meta.env);
export function getAuthFlow(): AuthFlow {
  if (instance) return instance;
  let persistent: Storage | null = null;
  try {
    persistent = window.localStorage;
  } catch {
    /* storage blocked: fail closed */
  }
  const storage = createHybridAuthStorage({
    storageKey: AUTH_STORAGE_KEY,
    persistent,
  });
  instance = createAuthFlow({
    config: authConfiguration,
    storage,
    persistent,
    makeClient() {
      if (!authConfiguration.enabled) throw new Error("Auth unavailable");
      return createSdkAuthPort(authConfiguration, storage);
    },
    exclusive: async (task) => {
      if (!navigator.locks) throw new Error("Browser lock unavailable");
      return navigator.locks.request("fonseca-first-login-v1", task);
    },
    cryptoReady: () =>
      location.origin === AUTH_ORIGIN &&
      window.isSecureContext &&
      Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues),
    sessionChanged: setAuthSession,
  });
  const expiryTimer = window.setInterval(() => instance?.checkExpiry(), 1000);
  window.addEventListener("pagehide", () => {
    clearInterval(expiryTimer);
    instance?.dispose();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.replace("/auth/login");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void instance?.revalidate();
  });
  return instance;
}
