import { AUTH_CALLBACK } from "./callback.ts";

export type AuthConfig =
  | { enabled: false }
  | {
      enabled: true;
      baseUrl: string;
      publishableKey: string;
      expectedEmail: string;
      dispatchEnabled: boolean;
    };
export function readAuthConfig(env: Record<string, unknown>): AuthConfig {
  if (env.VITE_FONSECA_AUTH_ENABLED !== "true") return { enabled: false };
  const baseUrl = env.VITE_FONSECA_AUTH_URL;
  const publishableKey = env.VITE_FONSECA_AUTH_PUBLISHABLE_KEY;
  const email = env.VITE_FONSECA_AUTH_EMAIL;
  if (
    typeof baseUrl !== "string" ||
    !/^https:\/\/[a-z]{20}\.supabase\.co$/u.test(baseUrl) ||
    typeof publishableKey !== "string" ||
    !/^sb_publishable_[A-Za-z0-9_-]{16,}$/u.test(publishableKey) ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  )
    return { enabled: false };
  return {
    enabled: true,
    baseUrl,
    publishableKey,
    expectedEmail: email.toLowerCase(),
    dispatchEnabled: env.VITE_FONSECA_AUTH_DISPATCH_ENABLED === "true",
  };
}
export const authCallbackUrl = AUTH_CALLBACK;
