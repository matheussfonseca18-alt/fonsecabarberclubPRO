import type { CatalogSession } from "../data/catalog-read.ts";

// A passive, document-local snapshot. Tokens never reach persistent storage.
let current: CatalogSession | null = null;
const listeners = new Set<() => void>();
export function setAuthSession(session: CatalogSession | null) {
  current = session ? { ...session } : null;
  for (const listener of listeners) listener();
}
export const authSessionSource = {
  async getSession(): Promise<CatalogSession | null> {
    if (current && current.expiresAt <= Date.now()) setAuthSession(null);
    return current ? { ...current } : null;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
