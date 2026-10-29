import "./barber.css";
import {
  createBarberController,
  currentBarberDay,
  offsetBarberDay,
  type BarberController,
} from "./barber-controller.ts";
import {
  barberScreen,
  emptyBarberEditor,
  renderBarber,
  type BarberEditor,
} from "./barber-view.ts";
import { inactiveBarberAdapter } from "./data/barber-access.ts";

/** Test harnesses may mount a controller; production always uses the inactive port. */
export function mountBarberPage(
  root: HTMLElement,
  controller: BarberController,
  pathname = location.pathname,
) {
  document.body.classList.add("bm-document");
  document.title = "Fonseca Barber Club — Área do barbeiro";
  let editor: BarberEditor = emptyBarberEditor();
  const notFound = pathname !== "/barbeiro" && pathname !== "/barbeiro/";
  let contextKey = "";
  let focusKey: string | null = null;
  function focus(selector: string) {
    root.querySelector<HTMLElement>(selector)?.focus();
  }
  function render() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active))
      focusKey = active.getAttribute("data-focus-key");
    else if (active && active !== document.body) focusKey = null;
    const state = controller.snapshot();
    const nextContextKey = `${state.accessRevision}:${JSON.stringify(state.scope)}`;
    if (contextKey && contextKey !== nextContextKey)
      editor = emptyBarberEditor();
    contextKey = nextContextKey;
    if (editor.id && !state.draft.lines.some((line) => line.id === editor.id))
      editor = emptyBarberEditor();
    root.innerHTML = renderBarber(
      state,
      barberScreen(location.hash),
      editor,
      notFound,
    );
    if (focusKey)
      root
        .querySelector<HTMLElement>(
          `[data-focus-key="${CSS.escape(focusKey)}"]`,
        )
        ?.focus({ preventScroll: true });
    root.querySelector(".bm-skip")?.addEventListener("click", (event) => {
      event.preventDefault();
      focus("#bm-content");
      root.querySelector("#bm-content")?.scrollIntoView();
    });
    root
      .querySelectorAll<HTMLButtonElement>("[data-refresh]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          void controller.refresh();
        }),
      );
    root
      .querySelector<HTMLInputElement>("[data-day]")
      ?.addEventListener("change", (event) => {
        controller.changeDay((event.target as HTMLInputElement).value);
      });
    root
      .querySelectorAll<HTMLElement>("[data-day-offset]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          controller.changeDay(
            offsetBarberDay(state.day, Number(button.dataset.dayOffset)),
          ),
        ),
      );
    root
      .querySelector("[data-today]")
      ?.addEventListener("click", () =>
        controller.changeDay(
          currentBarberDay(
            new Date(),
            state.read.state === "ready" ? state.read.data.timeZone : undefined,
          ),
        ),
      );
    root.querySelectorAll<HTMLElement>("[data-appointment]").forEach((button) =>
      button.addEventListener("click", () => {
        if (controller.selectAppointment(button.dataset.appointment!))
          focus("#bm-detail");
      }),
    );
    root.querySelector("[data-close-detail]")?.addEventListener("click", () => {
      const id = state.selectedAppointmentId;
      controller.closeDetails();
      if (id) focus(`[data-appointment="${CSS.escape(id)}"]`);
    });
    root.querySelector("[data-link-draft]")?.addEventListener("click", () => {
      if (controller.linkSelected()) location.hash = "rascunho";
    });
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-editor-field]",
      )
      .forEach((input) =>
        input.addEventListener("input", () => {
          const field = input.dataset.editorField;
          if (field === "kind")
            editor = {
              ...editor,
              kind: input.value === "product" ? "product" : "service",
            };
          else if (field === "description" || field === "quantity")
            editor = { ...editor, [field]: input.value };
        }),
      );
    root
      .querySelector<HTMLFormElement>("#bm-item-form")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = {
          kind: editor.kind,
          description: editor.description,
          quantity: Number(editor.quantity),
        };
        const okay = editor.id
          ? controller.updateLine(editor.id, input)
          : controller.addLine(input);
        if (okay) {
          editor = emptyBarberEditor();
          render();
        }
        focus("[data-notice]");
      });
    root.querySelectorAll<HTMLElement>("[data-edit-line]").forEach((button) =>
      button.addEventListener("click", () => {
        const line = controller
          .snapshot()
          .draft.lines.find((item) => item.id === button.dataset.editLine);
        if (!line) return;
        editor = {
          id: line.id,
          kind: line.kind,
          description: line.description,
          quantity: String(line.quantity),
        };
        render();
        focus('[name="description"]');
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-remove-line]").forEach((button) =>
      button.addEventListener("click", () => {
        controller.removeLine(button.dataset.removeLine!);
        focus("[data-notice]");
      }),
    );
    root.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
      editor = emptyBarberEditor();
      render();
      focus('[name="description"]');
    });
    root.querySelector("[data-clear-draft]")?.addEventListener("click", () => {
      const dialog = document.createElement("dialog");
      dialog.className = "bm-confirm";
      dialog.setAttribute("aria-labelledby", "bm-discard-title");
      dialog.innerHTML =
        '<h2 id="bm-discard-title">Descartar este rascunho?</h2><p>Os itens serão removidos desta aba. Não há envio ou registro no sistema.</p><div><button type="button" class="bm-button bm-button--outline" data-cancel>Continuar editando</button><button type="button" class="bm-button bm-button--gold" data-confirm>Descartar</button></div>';
      root.querySelector(".bm-app")!.append(dialog);
      dialog
        .querySelector("[data-cancel]")!
        .addEventListener("click", () => dialog.close());
      dialog.querySelector("[data-confirm]")!.addEventListener("click", () => {
        dialog.close();
        editor = emptyBarberEditor();
        controller.clearDraft();
        focus("[data-notice]");
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        focus("[data-clear-draft]");
      });
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-cancel]")!.focus();
    });
    root
      .querySelector("[data-save]")
      ?.addEventListener("click", () => controller.requestSave());
  }
  const unsubscribe = controller.subscribe(render);
  const changeScreen = () => {
    focusKey = null;
    editor = emptyBarberEditor();
    render();
    window.scrollTo(0, 0);
    focus("[data-screen-title]");
  };
  const restore = (event: PageTransitionEvent) => {
    if (event.persisted) location.reload();
  };
  window.addEventListener("hashchange", changeScreen);
  window.addEventListener("pageshow", restore);
  function dispose(keepRestore = false) {
    unsubscribe();
    controller.dispose();
    root.replaceChildren();
    document.body.classList.remove("bm-document");
    window.removeEventListener("hashchange", changeScreen);
    if (!keepRestore) window.removeEventListener("pageshow", restore);
    window.removeEventListener("pagehide", hide);
  }
  const hide = () => dispose(true);
  window.addEventListener("pagehide", hide);
  render();
  if (!notFound) void controller.refresh();
  return () => dispose();
}

export function startBarberPage() {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Barber root unavailable");
  mountBarberPage(
    root,
    createBarberController(inactiveBarberAdapter, currentBarberDay(new Date())),
  );
}
