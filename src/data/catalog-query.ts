import type { CatalogKind, CatalogReadResult } from "./catalog-read.ts";

export type CatalogQuerySnapshot = { kind: CatalogKind; result: CatalogReadResult<CatalogKind> | {state:"loading"} } | null;
export type CatalogReadPort = { list(kind: CatalogKind, options?: {signal?: AbortSignal}): Promise<CatalogReadResult<CatalogKind>> };

/** No persistent cache. Navigation and auth changes discard rows and cancel pending reads. */
export function createCatalogQuery(reader: CatalogReadPort, notify: () => void) {
  let revision = 0;
  let request: AbortController | null = null;
  let snapshot: CatalogQuerySnapshot = null;
  let disposed = false;
  function clear() {
    ++revision;
    request?.abort();
    request = null;
    snapshot = null;
    if (!disposed) notify();
  }
  return {
    snapshot: () => snapshot,
    clear,
    async load(kind: CatalogKind) {
      if (disposed) return;
      clear();
      const ownRevision = revision;
      request = new AbortController();
      const signal = request.signal;
      snapshot = {kind,result:{state:"loading"}};
      notify();
      let result: CatalogReadResult<CatalogKind>;
      try { result = await reader.list(kind,{signal}); }
      catch { result = {state:"error",message:"Não foi possível consultar o catálogo."}; }
      if (disposed || signal.aborted || ownRevision !== revision) return;
      if (result.state === "ready" && result.kind !== kind)
        result = {state:"error",message:"Resposta incompatível com o catálogo solicitado."};
      snapshot = {kind,result};
      request = null;
      notify();
    },
    dispose() { disposed = true; clear(); },
  };
}
