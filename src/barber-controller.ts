import {
  createDraftLine,
  emptyBarberDraft,
  isTrustedBarberScopeShape,
  linkDraftToAppointment,
  projectBarberSnapshot,
  reconcileDraftContext,
  removeDraftLine,
  updateDraftLine,
  type BarberDraft,
  type BarberDraftInput,
  type BarberDraftResult,
  type BarberRead,
  type BarberSnapshot,
  type TrustedBarberScope,
} from "./barber-domain.ts";
import type { BarberDataAdapter } from "./data/barber-access.ts";

export type BarberUiState = {
  readonly accessRevision: number;
  readonly day: string;
  readonly read: BarberRead<BarberSnapshot> | { readonly state: "loading" };
  readonly scope: TrustedBarberScope | null;
  readonly selectedAppointmentId: string | null;
  readonly detailsOpen: boolean;
  readonly draft: BarberDraft;
  readonly notice: { readonly text: string; readonly error: boolean } | null;
};

export function validBarberDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === day
  );
}

export function offsetBarberDay(day: string, offset: number): string {
  if (!validBarberDay(day) || !Number.isSafeInteger(offset)) return day;
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  if (!Number.isFinite(date.valueOf())) return day;
  const shifted = date.toISOString().slice(0, 10);
  return validBarberDay(shifted) ? shifted : day;
}

export function currentBarberDay(now: Date, timeZone?: string): string {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    return ["year", "month", "day"]
      .map((key) => parts.find((part) => part.type === key)!.value)
      .join("-");
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function createBarberController(
  adapter: BarberDataAdapter,
  initialDay: string,
) {
  if (!validBarberDay(initialDay))
    throw new Error("Invalid initial calendar day");
  let state: BarberUiState = {
    accessRevision: 0,
    day: initialDay,
    read: { state: "unavailable" },
    scope: null,
    selectedAppointmentId: null,
    detailsOpen: false,
    draft: emptyBarberDraft(),
    notice: null,
  };
  const listeners = new Set<() => void>();
  let request: AbortController | null = null;
  let version = 0;
  let disposed = false;
  const emit = () => {
    if (!disposed) listeners.forEach((listener) => listener());
  };
  function cancel() {
    version++;
    request?.abort();
    request = null;
  }
  function context() {
    return {
      scope: state.scope,
      selectedAppointmentId: state.selectedAppointmentId,
      appointments:
        state.read.state === "ready" ? state.read.data.appointments : [],
    };
  }
  function notice(text: string, error = false) {
    state = { ...state, notice: { text, error } };
    emit();
  }
  function fail(
    stateName: "unavailable" | "signed-out" | "forbidden" | "error",
  ) {
    state = {
      ...state,
      scope: null,
      selectedAppointmentId: null,
      detailsOpen: false,
      read: { state: stateName },
    };
    state = { ...state, draft: reconcileDraftContext(state.draft, context()) };
    emit();
  }
  async function refresh() {
    if (disposed) return;
    cancel();
    const generation = version;
    request = new AbortController();
    const signal = request.signal;
    const day = state.day;
    state = {
      ...state,
      read: { state: "loading" },
      scope: null,
      selectedAppointmentId: null,
      detailsOpen: false,
    };
    state = { ...state, draft: reconcileDraftContext(state.draft, context()) };
    emit();
    const current = () =>
      !disposed && !signal.aborted && generation === version;
    try {
      const access = await adapter.readScope(signal);
      if (!current()) return;
      if (!access || access.state !== "ready") {
        fail(
          access &&
            ["unavailable", "signed-out", "forbidden"].includes(access.state)
            ? (access.state as "unavailable" | "signed-out" | "forbidden")
            : "error",
        );
        return;
      }
      if (!isTrustedBarberScopeShape(access.data)) {
        fail("error");
        return;
      }
      const expected: TrustedBarberScope = {
        tenantId: access.data.tenantId,
        actorId: access.data.actorId,
        professionalId: access.data.professionalId,
        sessionId: access.data.sessionId,
      };
      const response = await adapter.readDay({ day, signal });
      if (!current()) return;
      if (!response || response.state !== "ready") {
        fail(
          response &&
            ["unavailable", "signed-out", "forbidden"].includes(response.state)
            ? (response.state as "unavailable" | "signed-out" | "forbidden")
            : "error",
        );
        return;
      }
      const projected = projectBarberSnapshot(response.data, expected);
      if (projected.state !== "ready" || projected.data.day !== day) {
        fail("error");
        return;
      }
      state = { ...state, read: projected, scope: expected };
      emit();
    } catch {
      if (current()) fail("error");
    }
  }
  function invalidate() {
    if (disposed) return;
    cancel();
    state = {
      ...state,
      accessRevision: state.accessRevision + 1,
      scope: null,
      read: { state: "unavailable" },
      selectedAppointmentId: null,
      detailsOpen: false,
      draft: emptyBarberDraft(),
      notice: {
        text: "O contexto de acesso mudou. As informações e o rascunho foram limpos.",
        error: false,
      },
    };
    emit();
    void refresh();
  }
  const unsubscribe = adapter.subscribeScope(invalidate);
  function applyDraft(result: BarberDraftResult, text: string): boolean {
    if (disposed) return false;
    if (result.state === "invalid") {
      notice(result.message, true);
      return false;
    }
    state = { ...state, draft: result.draft, notice: { text, error: false } };
    emit();
    return true;
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    invalidate,
    changeDay(day: string) {
      if (disposed) return;
      if (!validBarberDay(day)) {
        notice("Escolha uma data válida.", true);
        return;
      }
      state = { ...state, day, notice: null };
      void refresh();
    },
    selectAppointment(id: string | null) {
      if (disposed) return false;
      if (
        id !== null &&
        (state.read.state !== "ready" ||
          !state.read.data.appointments.some((row) => row.id === id))
      ) {
        notice("Atendimento indisponível neste contexto de acesso.", true);
        return false;
      }
      state = {
        ...state,
        selectedAppointmentId: id,
        detailsOpen: id !== null,
        notice: null,
      };
      state = {
        ...state,
        draft: reconcileDraftContext(state.draft, context()),
      };
      emit();
      return true;
    },
    closeDetails() {
      if (!disposed) {
        state = { ...state, detailsOpen: false };
        emit();
      }
    },
    linkSelected() {
      return applyDraft(
        linkDraftToAppointment(state.draft, context()),
        "Rascunho vinculado apenas nesta aba. Nenhum atendimento foi alterado.",
      );
    },
    addLine(input: BarberDraftInput) {
      return applyDraft(
        createDraftLine(state.draft, input),
        "Item incluído no rascunho desta aba. Nada foi enviado ao sistema.",
      );
    },
    updateLine(id: string, input: BarberDraftInput) {
      return applyDraft(
        updateDraftLine(state.draft, id, input),
        "Item atualizado somente no rascunho desta aba.",
      );
    },
    removeLine(id: string) {
      return applyDraft(
        removeDraftLine(state.draft, id),
        "Item removido somente do rascunho desta aba.",
      );
    },
    clearDraft() {
      if (!disposed) {
        state = { ...state, draft: emptyBarberDraft() };
        notice("Rascunho descartado desta aba.");
      }
    },
    requestSave() {
      if (!disposed)
        notice(
          "Salvar no sistema ainda não está disponível. Nenhum dado foi enviado.",
          true,
        );
    },
    dispose() {
      if (disposed) return;
      cancel();
      unsubscribe();
      state = {
        ...state,
        scope: null,
        read: { state: "unavailable" },
        selectedAppointmentId: null,
        detailsOpen: false,
        draft: emptyBarberDraft(),
        notice: null,
      };
      disposed = true;
      listeners.clear();
    },
  };
}

export type BarberController = ReturnType<typeof createBarberController>;
