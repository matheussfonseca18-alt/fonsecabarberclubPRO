/** Local interactions only. The native dialog provides keyboard containment. */
export function mountLegacyHomeInteractions(root: HTMLElement) {
  const menu = root.querySelector<HTMLDialogElement>("#fc-home-menu")!;
  const opener = root.querySelector<HTMLButtonElement>(
    "[data-home-open-menu]",
  )!;
  const closeButton = root.querySelector<HTMLButtonElement>(
    "[data-home-close-menu]",
  )!;
  const desktop = window.matchMedia("(min-width: 980px)");
  let nextFocus: HTMLElement | null = null;
  function close() {
    if (menu.open) menu.close();
  }
  function open() {
    if (menu.open) return;
    menu.showModal();
    opener.setAttribute("aria-expanded", "true");
    closeButton.focus();
  }
  function closed() {
    opener.setAttribute("aria-expanded", "false");
    if (nextFocus) {
      nextFocus.focus({ preventScroll: true });
      nextFocus = null;
    } else if (!desktop.matches) opener.focus({ preventScroll: true });
  }
  function click(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const destination = new URL(link.href, location.href);
    if (
      destination.origin === location.origin &&
      destination.pathname === location.pathname &&
      destination.search === location.search &&
      destination.hash
    ) {
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(
          decodeURIComponent(destination.hash.slice(1)),
        );
      } catch {
        /* malformed fragment has no focus target */
      }
      if (target && root.contains(target)) {
        if (!target.hasAttribute("tabindex"))
          target.setAttribute("tabindex", "-1");
        if (menu.contains(link)) nextFocus = target;
        else target.focus({ preventScroll: true });
      }
    }
    if (menu.contains(link)) close();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key !== "Tab" || !menu.open) return;
    const controls = [
      ...menu.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex="0"]',
      ),
    ];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  }
  function resized() {
    if (desktop.matches && menu.open) {
      nextFocus = root.querySelector<HTMLElement>(".fc-home__brand");
      close();
    }
  }
  opener.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  menu.addEventListener("close", closed);
  menu.addEventListener("keydown", keydown);
  root.addEventListener("click", click);
  desktop.addEventListener("change", resized);
  window.addEventListener("pagehide", close);
  return () => {
    opener.removeEventListener("click", open);
    closeButton.removeEventListener("click", close);
    menu.removeEventListener("close", closed);
    menu.removeEventListener("keydown", keydown);
    root.removeEventListener("click", click);
    desktop.removeEventListener("change", resized);
    window.removeEventListener("pagehide", close);
    close();
    opener.setAttribute("aria-expanded", "false");
  };
}
