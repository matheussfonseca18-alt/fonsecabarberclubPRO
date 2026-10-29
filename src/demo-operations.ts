import { clients, professionals, services } from "./demo.ts";

// Independent synthetic samples. An order is not a production or payment entry.
export type DemoOrder = {
  id: string;
  client: string;
  professional: string;
  service: string;
  date: string;
  // The observed "Cadastro" label has no validated meaning or data type yet.
  registration: null;
  cents: number;
  status: "Aberta" | "Encerrada" | "Cancelada";
  card: string | null;
  cashDate: string | null;
};

export const orderFixtures: DemoOrder[] = clients.map((client, index) => ({
  id: String(1041 + index),
  client,
  professional: professionals[index % professionals.length],
  service: services[index % services.length].name,
  date: index < 3 ? "2026-10-28" : `2026-10-${27 - (index % 3)}`,
  registration: null,
  cents: services[index % services.length].cents,
  status: index < 3 ? "Aberta" : index === 6 ? "Cancelada" : "Encerrada",
  card: null,
  cashDate: null,
}));

export type DemoPlan = {
  id: string;
  name: string;
  dueDay: number;
  periodicity: string;
  cents: number;
  type: string;
  benefits: string[];
};

export const planFixtures: DemoPlan[] = [
  {
    id: "essencial",
    name: "Essencial",
    dueDay: 5,
    periodicity: "Mensal",
    cents: 12900,
    type: "Plano demonstrativo",
    benefits: ["2 cortes mensais de referência", "Cuidado essencial"],
  },
  {
    id: "signature",
    name: "Signature",
    dueDay: 10,
    periodicity: "Mensal",
    cents: 18900,
    type: "Plano demonstrativo",
    benefits: ["3 cortes mensais de referência", "Ritual de barba ilustrativo"],
  },
  {
    id: "black-club",
    name: "Black Club",
    dueDay: 15,
    periodicity: "Mensal",
    cents: 27900,
    type: "Plano demonstrativo",
    benefits: ["4 cortes mensais de referência", "Ritual de barba ilustrativo"],
  },
];

export type DemoSubscriber = {
  id: string;
  client: string;
  planId: string;
  nextDue: string | null;
  status: "Ativa" | "Inativa";
  type: string;
};

export const subscriberFixtures: DemoSubscriber[] = [
  {
    id: "sub-demo-1",
    client: clients[0],
    planId: "essencial",
    nextDue: "2026-11-05",
    status: "Ativa",
    type: "Adesão demonstrativa",
  },
  {
    id: "sub-demo-2",
    client: clients[1],
    planId: "signature",
    nextDue: "2026-11-10",
    status: "Ativa",
    type: "Adesão demonstrativa",
  },
  {
    id: "sub-demo-3",
    client: clients[2],
    planId: "black-club",
    nextDue: "2026-11-15",
    status: "Ativa",
    type: "Adesão demonstrativa",
  },
  {
    id: "sub-demo-4",
    client: clients[4],
    planId: "essencial",
    nextDue: null,
    status: "Inativa",
    type: "Adesão demonstrativa",
  },
];
