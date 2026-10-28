import type { Appointment, Production } from "./domain";
export const clients = [
  "André Oliveira",
  "Bruno Martins",
  "Caio Ribeiro",
  "Daniel Costa",
  "Eduardo Lima",
  "Felipe Santos",
  "Gabriel Alves",
  "Henrique Rocha",
];
export const professionals = ["Lucas Almeida", "Rafael Nunes", "Theo Castro"];
export const services = [
  { name: "Corte signature", cents: 6500, duration: 45 },
  { name: "Barba ritual", cents: 4500, duration: 30 },
  { name: "Corte + barba", cents: 10000, duration: 75 },
  { name: "Acabamento", cents: 2500, duration: 15 },
];
export const productFixtures = [
  {
    name: "Pomada matte · 80g",
    cents: 5500,
    category: "Finalização",
    stock: 12,
    commissionLabel: "Não definida",
  },
  {
    name: "Óleo para barba · 30ml",
    cents: 4900,
    category: "Barba",
    stock: 8,
    commissionLabel: "Não definida",
  },
  {
    name: "Shampoo daily · 250ml",
    cents: 4200,
    category: "Cuidados diários",
    stock: 5,
    commissionLabel: "Não definida",
  },
];
export const appointments: Appointment[] = Array.from(
  { length: 18 },
  (_, i) => ({
    id: `demo-${i}`,
    client: clients[i % 8],
    professional: professionals[i % 3],
    service: services[i % 4].name,
    date: `2026-10-${String(26 + Math.floor(i / 6)).padStart(2, "0")}`,
    time: `${String(9 + Math.floor((i % 6) / 3) * 3).padStart(2, "0")}:${i % 3 === 0 ? "00" : i % 3 === 1 ? "15" : "30"}`,
    duration: services[i % 4].duration,
    status: i < 12 ? "Concluído" : i % 2 ? "Confirmado" : "Agendado",
    cents: services[i % 4].cents,
  }),
);
export const production: Production[] = Array.from({ length: 148 }, (_, i) => ({
  id: `production-${i}`,
  client: clients[i % 8],
  professional: professionals[i % 3],
  date: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}`,
  cents: services[i % 4].cents,
  commissionCents: services[i % 4].cents * 0.4,
}));
// Only synthetic fixtures. Adapters for future remote storage must implement this contract.
export interface AppointmentRepository {
  list(): Appointment[];
  create(item: Appointment): void;
  reset(): void;
}
export class DemoAppointmentRepository implements AppointmentRepository {
  private rows = structuredClone(appointments);
  list() {
    return structuredClone(this.rows);
  }
  create(item: Appointment) {
    this.rows.push(structuredClone(item));
  }
  reset() {
    this.rows = structuredClone(appointments);
  }
}
