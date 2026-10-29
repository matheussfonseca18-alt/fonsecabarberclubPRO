import type { DataAdapter } from "./contracts.ts";

export const DISCONNECTED_REASON =
  "Conexão de dados indisponível nesta etapa. Nenhum cadastro foi consultado ou gravado.";

/** Fail closed: no network, storage, fixtures, payload logging or false success. */
export function createDisconnectedAdapter(): DataAdapter {
  return Object.freeze({
    async status() {
      return { state: "disconnected" as const, reason: DISCONNECTED_REASON };
    },
    async list() {
      return { state: "unavailable" as const, reason: DISCONNECTED_REASON };
    },
    async create() {
      return { state: "unavailable" as const, reason: DISCONNECTED_REASON };
    },
  });
}

export const disconnectedAdapter = createDisconnectedAdapter();
