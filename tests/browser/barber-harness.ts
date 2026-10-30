// This fixture is under tests only and is not an entry point of the production build.
import { createBarberController } from "../../src/barber-controller.ts";
import { mountBarberPage } from "../../src/barber-page.ts";
import type { BarberDataAdapter } from "../../src/data/barber-access.ts";
import type { TrustedBarberScope } from "../../src/barber-domain.ts";

const scope: TrustedBarberScope = {
  tenantId: "synthetic-tenant",
  actorId: "synthetic-actor",
  professionalId: "synthetic-professional",
  sessionId: "synthetic-session",
};
const listeners = new Set<() => void>();
let allowed = true;
const adapter: BarberDataAdapter = {
  async readScope() {
    return allowed ? { state: "ready", data: scope } : { state: "forbidden" };
  },
  subscribeScope(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async readDay({ day }) {
    return {
      state: "ready",
      data: {
        scope,
        day,
        timeZone: "America/Sao_Paulo",
        appointments: [
          {
            id: "synthetic-appointment",
            tenantId: scope.tenantId,
            professionalId: scope.professionalId,
            startsAt: `${day}T09:00:00-03:00`,
            endsAt: `${day}T09:30:00-03:00`,
            customer: { displayName: "Cliente sintético de teste" },
            serviceLabels: ["Serviço sintético de teste"],
            statusLabel: "Estado sintético",
          },
        ],
        performance: {
          completedAppointments: { state: "known", value: 0 },
          serviceUnits: { state: "unknown" },
          productUnits: { state: "unknown" },
        },
        commission: { amount: { state: "unknown" }, periodLabel: null },
      },
    };
  },
};
const controller = createBarberController(adapter, "2026-10-29");
mountBarberPage(
  document.querySelector<HTMLElement>("#app")!,
  controller,
  "/barbeiro",
);
declare global {
  interface Window {
    __barberHarness: { controller: typeof controller; invalidate(): void };
  }
}
window.__barberHarness = {
  controller,
  invalidate() {
    allowed = false;
    listeners.forEach((listener) => listener());
  },
};
