import {
  searchParameters,
  validateParameterCatalog,
  type ParameterReadEntry,
} from "./model.ts";

/** A local metadata source, never an adapter for effective settings. */
export type ParametersMetadataResult =
  | { state: "ready"; entries: readonly ParameterReadEntry[] }
  | { state: "unavailable" };
export type ParametersMetadataLoader = () => Promise<ParametersMetadataResult>;
export type ParametersReadState =
  | { phase: "loading"; query: string }
  | { phase: "error"; query: string }
  | { phase: "unavailable"; query: string }
  | {
      phase: "ready";
      query: string;
      entries: readonly ParameterReadEntry[];
      matches: readonly ParameterReadEntry[];
    };

export const localParametersMetadata: ParametersMetadataLoader = async () => {
  const { PARAMETERS_READ_CATALOG } = await import("./catalog.ts");
  return { state: "ready", entries: PARAMETERS_READ_CATALOG };
};

function expectedCoverage(entries: readonly ParameterReadEntry[]) {
  const count = (kind: ParameterReadEntry["options"]["completeness"]) =>
    entries.filter((entry) => entry.options.completeness === kind).length;
  return (
    entries.length === 72 &&
    entries.every((entry, index) => entry.sourceNumber === index + 1) &&
    entries.filter((entry) => entry.observedControl.tag === "select").length ===
      67 &&
    count("complete") === 35 &&
    count("sampled") === 2 &&
    count("not-recovered") === 30 &&
    count("not-applicable") === 5
  );
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function createParametersReadController(
  loadMetadata: ParametersMetadataLoader = localParametersMetadata,
) {
  let state: ParametersReadState = Object.freeze({
    phase: "loading",
    query: "",
  });
  let generation = 0;
  let disposed = false;
  const listeners = new Set<() => void>();
  function emit(next: ParametersReadState) {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  }
  function setQuery(query: string) {
    if (disposed) return;
    if (state.phase === "ready") {
      emit({
        ...state,
        query,
        matches: Object.freeze(searchParameters(state.entries, query)),
      });
    } else emit({ ...state, query });
  }
  async function load() {
    if (disposed) return;
    const current = ++generation;
    emit({ phase: "loading", query: state.query });
    try {
      const result = await loadMetadata();
      if (disposed || current !== generation) return;
      if (result.state === "unavailable") {
        emit({ phase: "unavailable", query: state.query });
      } else if (
        !validateParameterCatalog(result.entries).valid ||
        !expectedCoverage(result.entries)
      ) {
        emit({ phase: "error", query: state.query });
      } else {
        const entries = freezeTree(structuredClone(result.entries));
        emit({
          phase: "ready",
          query: state.query,
          entries,
          matches: Object.freeze(searchParameters(entries, state.query)),
        });
      }
    } catch {
      // Transport messages and implementation details do not belong in the UI.
      if (!disposed && current === generation)
        emit({ phase: "error", query: state.query });
    }
  }
  return {
    snapshot: (): ParametersReadState => state,
    subscribe(listener: () => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setQuery,
    clearQuery: () => setQuery(""),
    load,
    dispose() {
      disposed = true;
      generation += 1;
      listeners.clear();
      state = Object.freeze({ phase: "unavailable", query: "" });
    },
  };
}

export type ParametersReadController = ReturnType<
  typeof createParametersReadController
>;
