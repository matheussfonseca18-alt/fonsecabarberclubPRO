import type { SupportedStorage } from "@supabase/supabase-js";

export const DEFAULT_PKCE_TTL_MS = 15 * 60_000;
export const MAX_PKCE_TTL_MS = 30 * 60_000;

/** The browser Storage interface, narrowed for injection and offline tests. */
export interface AuthPersistentStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HybridAuthStorage extends SupportedStorage {
  readonly storageKey: string;
  readonly ttlMs: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Checks read/write/remove support without reading any credential. */
  preflight(): boolean;
  /** Drops session/user/token memory while preserving an emailed flow's verifier. */
  clearMemory(): void;
  /** Removes this namespace's verifier slots/index, including orphan slots. */
  clearPkce(): boolean;
  /** Memory is always cleared. False means durable cleanup could not be confirmed. */
  clearAll(): boolean;
}

export interface HybridAuthStorageOptions {
  storageKey: string;
  persistent: AuthPersistentStorage | null;
  now?: () => number;
  ttlMs?: number;
}

/** Never retain the original browser exception, which may contain private data. */
export class AuthStorageUnavailableError extends Error {
  constructor() {
    super("Armazenamento temporário de autenticação indisponível.");
    this.name = "AuthStorageUnavailableError";
  }
}

const FLOW_ID = /^[a-zA-Z0-9_-]{8,64}$/u;
const VERIFIER = /^[a-zA-Z0-9._~-]{43,128}(?:\/recovery)?$/u;
let probeSequence = 0;

/**
 * Use with SDK persistSession:true. Only the SDK 2.118 PKCE namespace is durable;
 * sessions, users and tokens stay in this document's private memory Map.
 * A fresh document can finish an emailed flow but cannot recover a prior session.
 */
export function createHybridAuthStorage(
  options: HybridAuthStorageOptions,
): HybridAuthStorage {
  const { storageKey, persistent } = options;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_PKCE_TTL_MS;
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/u.test(storageKey) ||
    !Number.isSafeInteger(ttlMs) ||
    ttlMs < 1 ||
    ttlMs > MAX_PKCE_TTL_MS
  )
    throw new AuthStorageUnavailableError();

  const memory = new Map<string, string>();
  const legacyKey = `${storageKey}-code-verifier`;
  const indexKey = `${storageKey}-flows-code-verifier`;
  const flowPrefix = `${storageKey}-flow-`;
  const suffix = "-code-verifier";

  function kind(key: string): "verifier" | "index" | null {
    if (key === legacyKey) return "verifier";
    if (key === indexKey) return "index";
    if (key.startsWith(flowPrefix) && key.endsWith(suffix)) {
      const id = key.slice(flowPrefix.length, -suffix.length);
      if (FLOW_ID.test(id)) return "verifier";
    }
    return null;
  }

  function validValue(key: string, value: string): boolean {
    if (value.length > 2048) return false;
    try {
      const decoded: unknown = JSON.parse(value);
      if (kind(key) === "verifier")
        return typeof decoded === "string" && VERIFIER.test(decoded);
      return (
        Array.isArray(decoded) &&
        decoded.length <= 5 &&
        decoded.every(
          (item) => typeof item === "string" && FLOW_ID.test(item),
        ) &&
        new Set(decoded).size === decoded.length
      );
    } catch {
      return false;
    }
  }

  function clock(): number {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0)
      throw new AuthStorageUnavailableError();
    return value;
  }

  function durable(): AuthPersistentStorage {
    if (!persistent) throw new AuthStorageUnavailableError();
    return persistent;
  }

  function ownDurableKeys(): string[] {
    const store = durable();
    const keys: string[] = [];
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index);
      if (key && kind(key)) keys.push(key);
    }
    return keys;
  }

  const api: HybridAuthStorage = {
    storageKey,
    ttlMs,
    getItem(key) {
      if (!kind(key)) return memory.get(key) ?? null;
      try {
        const store = durable();
        const raw = store.getItem(key);
        if (raw === null) return null;
        let valid = false;
        let value: string | null = null;
        if (raw.length <= 4096) {
          try {
            const entry: unknown = JSON.parse(raw);
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
              const record = entry as Record<string, unknown>;
              const time = clock();
              valid =
                Object.keys(record).length === 4 &&
                record.v === 1 &&
                typeof record.writtenAt === "number" &&
                Number.isSafeInteger(record.writtenAt) &&
                record.writtenAt >= 0 &&
                record.writtenAt <= time &&
                typeof record.expiresAt === "number" &&
                Number.isSafeInteger(record.expiresAt) &&
                record.expiresAt > time &&
                record.expiresAt - record.writtenAt <= ttlMs &&
                typeof record.value === "string" &&
                validValue(key, record.value);
              if (valid) value = record.value as string;
            }
          } catch {
            /* Corrupt/expired verifier is absent, never a fallback session. */
          }
        }
        if (!valid) store.removeItem(key);
        return value;
      } catch {
        throw new AuthStorageUnavailableError();
      }
    },
    setItem(key, value) {
      if (!kind(key)) {
        memory.set(key, value);
        return;
      }
      if (!validValue(key, value)) throw new AuthStorageUnavailableError();
      try {
        const writtenAt = clock();
        const expiresAt = writtenAt + ttlMs;
        if (!Number.isSafeInteger(expiresAt))
          throw new AuthStorageUnavailableError();
        const raw = JSON.stringify({ v: 1, writtenAt, expiresAt, value });
        const store = durable();
        store.setItem(key, raw);
        if (store.getItem(key) !== raw) throw new AuthStorageUnavailableError();
      } catch {
        throw new AuthStorageUnavailableError();
      }
    },
    removeItem(key) {
      memory.delete(key);
      if (!kind(key)) return;
      try {
        const store = durable();
        store.removeItem(key);
        if (store.getItem(key) !== null)
          throw new AuthStorageUnavailableError();
      } catch {
        throw new AuthStorageUnavailableError();
      }
    },
    preflight() {
      const key = `${storageKey}-storage-probe-${++probeSequence}`;
      let passed: boolean;
      try {
        const store = durable();
        store.setItem(key, "probe");
        passed = store.getItem(key) === "probe";
        store.removeItem(key);
        passed = passed && store.getItem(key) === null;
        // Enumeration is needed to remove orphan PKCE slots on explicit cleanup.
        ownDurableKeys();
      } catch {
        passed = false;
      } finally {
        try {
          persistent?.removeItem(key);
        } catch {
          passed = false;
        }
      }
      return passed;
    },
    clearMemory() {
      memory.clear();
    },
    clearPkce() {
      try {
        const store = durable();
        for (const key of ownDurableKeys()) store.removeItem(key);
        return ownDurableKeys().length === 0;
      } catch {
        return false;
      }
    },
    clearAll() {
      api.clearMemory();
      return api.clearPkce();
    },
  };
  return Object.freeze(api);
}
