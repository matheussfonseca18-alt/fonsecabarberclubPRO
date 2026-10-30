import "./parameters-read.css";
import {
  createParametersReadController,
  type ParametersReadController,
} from "./controller.ts";
import {
  parametersReadStatus,
  renderParametersRead,
  renderParametersReadResults,
} from "./view.ts";

/** Mount in the owner's existing authorized Settings surface, never a new access gate. */
export function mountParametersRead(
  host: HTMLElement,
  controller: ParametersReadController = createParametersReadController(),
) {
  host.innerHTML = renderParametersRead(controller.snapshot());
  const query = host.querySelector<HTMLInputElement>(
    "[data-parameters-query]",
  )!;
  const results = host.querySelector<HTMLElement>("[data-parameters-results]")!;
  const status = host.querySelector<HTMLElement>("[data-parameters-status]")!;
  const clear = host.querySelector<HTMLButtonElement>(
    ".pr-search [data-parameters-clear]",
  )!;
  const form = host.querySelector<HTMLFormElement>(".pr-search")!;
  let disposed = false;
  const unsubscribe = controller.subscribe(() => {
    if (disposed) return;
    const state = controller.snapshot();
    // The search input stays mounted: caret, composition and keyboard focus survive.
    if (query.value !== state.query) query.value = state.query;
    clear.disabled = state.query.length === 0;
    status.textContent = parametersReadStatus(state);
    results.innerHTML = renderParametersReadResults(state);
  });
  function input() {
    controller.setQuery(query.value);
  }
  function submit(event: Event) {
    event.preventDefault();
    controller.setQuery(query.value);
  }
  function click(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-parameters-clear]")) {
      controller.clearQuery();
      query.focus();
    } else if (target.closest("[data-parameters-retry]")) {
      // Retry removes the clicked button; give focus a stable destination first.
      query.focus();
      void controller.load();
    }
  }
  query.addEventListener("input", input);
  form.addEventListener("submit", submit);
  host.addEventListener("click", click);
  const ready = controller.load();
  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      query.removeEventListener("input", input);
      form.removeEventListener("submit", submit);
      host.removeEventListener("click", click);
      controller.dispose();
      host.replaceChildren();
    },
  };
}
