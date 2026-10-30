/** Coalesce paints after input/change/click completes, preserving its DOM target. */
export function createBookingRenderQueue(
  render: () => void,
  defer: (callback: () => void) => () => void = (callback) => {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  },
) {
  const held = new Set<"pointer" | "keyboard">();
  let pending = false;
  let disposed = false;
  let cancel: (() => void) | null = null;
  function schedule() {
    if (disposed || held.size || !pending || cancel) return;
    cancel = defer(() => {
      cancel = null;
      if (disposed || held.size || !pending) return;
      pending = false;
      render();
    });
  }
  return {
    request() {
      if (disposed) return;
      pending = true;
      schedule();
    },
    hold(source: "pointer" | "keyboard" = "pointer") {
      held.add(source);
      cancel?.();
      cancel = null;
    },
    release(source: "pointer" | "keyboard" = "pointer") {
      held.delete(source);
      schedule();
    },
    releaseAll() {
      held.clear();
      schedule();
    },
    flush() {
      cancel?.();
      cancel = null;
      held.clear();
      if (!disposed && pending) {
        pending = false;
        render();
      }
    },
    dispose() {
      disposed = true;
      pending = false;
      held.clear();
      cancel?.();
      cancel = null;
    },
  };
}
