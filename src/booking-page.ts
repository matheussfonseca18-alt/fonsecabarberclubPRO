import "./booking.css";
import {
  createBookingController,
  bookingScreen,
} from "./booking-controller.ts";
import { renderBooking } from "./booking-view.ts";
import { createBookingRenderQueue } from "./booking-render-queue.ts";
import { bookingNotBeforeMinute } from "./booking-clock.ts";
import {
  inactiveBookingAdapter,
  type BookingDataAdapter,
} from "./data/booking-access.ts";
import type { CartAddition } from "./booking-domain.ts";

export function startBookingPage(
  adapter: BookingDataAdapter = inactiveBookingAdapter,
) {
  document.title = "Fonseca Barber Club · Preparar agendamento";
  document.documentElement.dataset.dataMode = "real";
  const root = document.querySelector<HTMLDivElement>("#app")!;
  const controller = createBookingController(adapter, () =>
    bookingNotBeforeMinute(Date.now()),
  );
  let previousStep = "";
  function render() {
    const state = controller.snapshot();
    const activeId = root.contains(document.activeElement)
      ? document.activeElement?.id
      : null;
    const screen = bookingScreen(state);
    root.innerHTML = renderBooking(state);
    const bind = (selector: string, action: (element: HTMLElement) => void) =>
      root
        .querySelectorAll<HTMLElement>(selector)
        .forEach((element) =>
          element.addEventListener("click", () => action(element)),
        );
    bind("[data-booking-reload]", () => {
      void controller.loadCatalog();
    });
    bind("[data-booking-service]", (element) =>
      controller.chooseService(element.dataset.bookingService!),
    );
    bind("[data-booking-professional]", (element) =>
      controller.chooseProfessional(element.dataset.bookingProfessional!),
    );
    bind("[data-booking-next]", () => {
      // Commit visible values even when a browser does not deliver change on blur.
      updateItems();
      controller.openTimes();
    });
    bind("[data-booking-restore]", () => controller.restoreItems());
    bind("[data-booking-slot]", (element) =>
      controller.chooseTime(Number(element.dataset.bookingSlot)),
    );
    bind("[data-booking-back]", () => controller.back());
    bind("[data-booking-cancel]", () => controller.cancel());
    bind("[data-booking-interrupt]", () => controller.interrupt());
    bind("[data-booking-confirm]", () => controller.confirm());
    const updateItems = () => {
      const additions: CartAddition[] = [];
      root
        .querySelectorAll<HTMLInputElement>("[data-addition-kind]:checked")
        .forEach((input) => {
          const entityId = input.dataset.entityId!;
          if (input.dataset.additionKind === "product") {
            const quantity = root.querySelector<HTMLInputElement>(
              `#${CSS.escape(`qty-${entityId}`)}`,
            );
            additions.push({
              kind: "product",
              productId: entityId,
              quantity: Number(quantity?.value),
            });
          } else if (
            input.dataset.additionKind === "extra" ||
            input.dataset.additionKind === "service"
          )
            additions.push({
              kind: input.dataset.additionKind,
              serviceId: entityId,
            });
        });
      controller.setItems(additions);
    };
    root
      .querySelectorAll("[data-addition-kind],[data-product-quantity]")
      .forEach((input) => input.addEventListener("change", updateItems));
    root
      .querySelector("#booking-date-form")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        void controller.loadTimes(
          root.querySelector<HTMLInputElement>("#booking-date")!.value,
        );
      });
    root
      .querySelector<HTMLInputElement>("#booking-date")
      ?.addEventListener("change", (event) =>
        controller.setDate((event.target as HTMLInputElement).value),
      );
    // No submit path is a persistence path, even if disabled UI is manipulated.
    root.querySelectorAll("form:not(#booking-date-form)").forEach((form) =>
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        controller.confirm();
      }),
    );
    if (state.notice?.tone === "error")
      root.querySelector<HTMLElement>("#booking-status")?.focus();
    else if (previousStep !== screen)
      root.querySelector<HTMLElement>("#booking-step-title")?.focus();
    else if (activeId) {
      const target = root.querySelector<HTMLElement>(
        `#${CSS.escape(activeId)}`,
      );
      if (target && !target.matches(":disabled,[hidden]")) target.focus();
      else root.querySelector<HTMLElement>("#booking-step-title")?.focus();
    }
    previousStep = screen;
  }
  const queue = createBookingRenderQueue(render);
  const unsubscribe = controller.subscribe(queue.request);
  // A blur/change may precede the click on Next/Submit. Keep its target alive
  // until the complete pointer gesture; state validation still runs immediately.
  const pointerDown = () => queue.hold("pointer");
  const pointerEnd = () => queue.release("pointer");
  let keyboardTarget: Element | null = null;
  const activeKeys = new Set<string>();
  const keyDown = (event: KeyboardEvent) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      !target?.matches(
        'button:not(:disabled),input[type="checkbox"]:not(:disabled)',
      )
    )
      return;
    keyboardTarget = target;
    activeKeys.add(event.code);
    queue.hold("keyboard");
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    activeKeys.delete(event.code);
    if (!activeKeys.size) {
      keyboardTarget = null;
      queue.release("keyboard");
    }
  };
  const focusOut = (event: FocusEvent) => {
    if (event.target !== keyboardTarget) return;
    activeKeys.clear();
    keyboardTarget = null;
    queue.release("keyboard");
  };
  const blur = () => {
    activeKeys.clear();
    keyboardTarget = null;
    queue.releaseAll();
  };
  root.addEventListener("pointerdown", pointerDown, true);
  root.addEventListener("keydown", keyDown, true);
  root.addEventListener("focusout", focusOut);
  document.addEventListener("keyup", keyUp);
  document.addEventListener("pointerup", pointerEnd);
  document.addEventListener("pointercancel", pointerEnd);
  window.addEventListener("blur", blur);
  const hide = () => {
    controller.interrupt(true);
    activeKeys.clear();
    keyboardTarget = null;
    queue.flush();
  };
  const show = (event: PageTransitionEvent) => {
    if (event.persisted) void controller.loadCatalog();
  };
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);
  render();
  void controller.loadCatalog();
  return () => {
    unsubscribe();
    queue.dispose();
    controller.dispose();
    root.removeEventListener("pointerdown", pointerDown, true);
    root.removeEventListener("keydown", keyDown, true);
    root.removeEventListener("focusout", focusOut);
    document.removeEventListener("keyup", keyUp);
    document.removeEventListener("pointerup", pointerEnd);
    document.removeEventListener("pointercancel", pointerEnd);
    window.removeEventListener("blur", blur);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pageshow", show);
    root.replaceChildren();
  };
}
