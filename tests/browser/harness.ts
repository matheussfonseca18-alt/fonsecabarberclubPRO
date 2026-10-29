import { startBookingPage } from "../../src/booking-page.ts";
import type { BookingFact } from "../../src/booking-domain.ts";
import type {
  BookingDataAdapter,
  BookingAvailabilityData,
  BookingRead,
} from "../../src/data/booking-access.ts";

// Explicit test-only entry. Not imported by src, never bundled with the app.
const fact = <T>(value: T): BookingFact<T> => ({ state: "confirmed", value });
const date = "2050-11-01";
const at = (hour: number) =>
  Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`) / 60000;
const responseMode =
  document.querySelector<HTMLSelectElement>("#test-response")!;
let pending: (() => void) | null = null;
let responses = 0;
let cancellations = 0;
let pressedNode: Element | null = null;
let sameNode = "não medido";
function report() {
  document.querySelector("#test-events")!.textContent =
    `Respostas: ${responses}; cancelamentos: ${cancellations}; mesmo nó pressionado: ${sameNode}; consulta pendente: ${Boolean(pending)}.`;
}
const adapter: BookingDataAdapter = {
  async readCatalog() {
    return {
      state: "ready",
      data: {
        catalog: {
          revision: "synthetic-test-c1",
          services: [
            {
              id: "base",
              active: fact(true),
              priceCents: fact(4000),
              standaloneMinutes: fact(40),
            },
            {
              id: "extra",
              active: fact(true),
              priceCents: fact(7000),
              standaloneMinutes: fact(50),
            },
            {
              id: "other",
              active: fact(true),
              priceCents: fact(2000),
              standaloneMinutes: fact(30),
            },
            {
              id: "unknown",
              active: fact(true),
              priceCents: fact(1000),
              standaloneMinutes: { state: "missing" },
            },
          ],
          professionals: [
            {
              id: "p1",
              active: fact(true),
              eligibleServiceIds: fact(["base", "extra", "other"]),
            },
            {
              id: "p2",
              active: fact(true),
              eligibleServiceIds: { state: "missing" },
            },
          ],
          products: [
            { id: "product", active: fact(true), priceCents: fact(1000) },
          ],
          extraRules: [
            {
              baseServiceId: "base",
              extraServiceId: "extra",
              incrementalMinutes: fact(20),
              priceCents: fact(5000),
            },
          ],
        },
        labels: {
          services: {
            base: "Base sintética 40",
            extra: "Extra sintético 20 / avulso 50",
            other: "Outro serviço sintético 30",
            unknown: "Serviço sem duração confirmada",
          },
          professionals: {
            p1: "Profissional sintético habilitado",
            p2: "Profissional com habilitação ausente",
          },
          products: { product: "Produto sintético" },
        },
        portraits: {},
        timeZone: fact("UTC"),
      },
    };
  },
  async readAvailability(request) {
    const mode = responseMode.value;
    const result: BookingRead<BookingAvailabilityData> =
      mode === "error"
        ? { state: "error" }
        : {
            state: "ready",
            data: {
              date: request.date,
              timeZone: "UTC",
              snapshot: {
                revision: "synthetic-test-s1",
                professionalId: request.professionalId,
                coverage: { start: at(0), end: at(0) + 1440 },
                working: fact(
                  mode === "empty"
                    ? []
                    : [
                        { start: at(9), end: at(12) },
                        { start: at(13), end: at(18) },
                      ],
                ),
                busy:
                  mode === "missing"
                    ? { state: "missing" }
                    : fact([{ start: at(10), end: at(11) }]),
              },
              search: {
                window: { start: at(0), end: at(0) + 1440 },
                notBefore: at(0),
                grid: { anchor: at(0), stepMinutes: 20 },
              },
            },
          };
    if (mode === "manual" || mode === "space") {
      return new Promise((resolve) => {
        pending = () => {
          pending = null;
          responses++;
          report();
          resolve(result);
        };
        report();
      });
    }
    responses++;
    report();
    return result;
  },
};
let cleanup = startBookingPage(adapter);
document
  .querySelector("#test-release")!
  .addEventListener("click", () => pending?.());
document.querySelector("#test-reset")!.addEventListener("click", () => {
  cleanup();
  pending = null;
  responses = 0;
  cancellations = 0;
  pressedNode = null;
  sameNode = "não medido";
  cleanup = startBookingPage(adapter);
  report();
});
document.addEventListener("click", (event) => {
  if ((event.target as Element).closest("[data-booking-cancel]")) {
    cancellations++;
    report();
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.code !== "Space" ||
    event.repeat ||
    !(event.target as Element).matches("[data-booking-cancel]")
  )
    return;
  pressedNode = event.target as Element;
  if (responseMode.value === "space" && pending)
    setTimeout(() => {
      pending?.();
      setTimeout(() => {
        sameNode = String(
          pressedNode === document.querySelector("[data-booking-cancel]"),
        );
        report();
      }, 20);
    }, 0);
});
report();
