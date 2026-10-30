import { clients, professionals } from "./demo.ts";

// Independent synthetic examples. These are not derived from production,
// appointments, orders, bank feeds or commission payments.
export type DemoCashMovement = {
  id: string;
  date: string;
  description: string;
  kind: "Entrada" | "Saída";
  cents: number;
  professional: string;
  status: "Liquidado na demo";
};

export const cashMovements: DemoCashMovement[] = [
  {
    id: "mov-01",
    date: "2026-10-27",
    description: "Recebimentos ilustrativos · lote A",
    kind: "Entrada",
    cents: 270000,
    professional: "Empresa",
    status: "Liquidado na demo",
  },
  {
    id: "mov-02",
    date: "2026-10-27",
    description: "Recebimentos ilustrativos · lote B",
    kind: "Entrada",
    cents: 200000,
    professional: "Empresa",
    status: "Liquidado na demo",
  },
  {
    id: "mov-03",
    date: "2026-10-27",
    description: "Recebimentos ilustrativos · lote C",
    kind: "Entrada",
    cents: 200000,
    professional: "Empresa",
    status: "Liquidado na demo",
  },
  {
    id: "mov-04",
    date: "2026-10-28",
    description: "Despesa operacional ilustrativa · A",
    kind: "Saída",
    cents: -140000,
    professional: "Empresa",
    status: "Liquidado na demo",
  },
  {
    id: "mov-05",
    date: "2026-10-28",
    description: "Despesa operacional ilustrativa · B",
    kind: "Saída",
    cents: -100000,
    professional: "Empresa",
    status: "Liquidado na demo",
  },
];

export type DemoCashSession = {
  id: string;
  description: string;
  status: string;
  date: string;
  start: string;
  end: string;
  initialCents: number;
  balanceCents: number;
  professional: string;
};

// Historical scenarios only; they do not establish the state of a current cash register.
export const cashHistory: DemoCashSession[] = [
  {
    id: "cx-01",
    description: "Caixa demonstrativo · 27/10",
    status: "Encerrado na demo",
    date: "2026-10-27",
    start: "09:00",
    end: "19:00",
    initialCents: 0,
    balanceCents: 670000,
    professional: "Empresa",
  },
  {
    id: "cx-02",
    description: "Caixa demonstrativo · 28/10",
    status: "Encerrado na demo",
    date: "2026-10-28",
    start: "09:00",
    end: "19:00",
    initialCents: 0,
    balanceCents: -240000,
    professional: "Empresa",
  },
];

export const clientAccounts = clients.map((name, index) => ({
  id: `client-${index}`,
  name,
  balanceCents: null,
}));
export const professionalAccounts = professionals.map((name, index) => ({
  id: `professional-${index}`,
  name,
  balanceCents: null,
}));

export function cashTotals(rows: readonly DemoCashMovement[]) {
  return {
    incoming: rows
      .filter((row) => row.cents > 0)
      .reduce((sum, row) => sum + row.cents, 0),
    outgoing: rows
      .filter((row) => row.cents < 0)
      .reduce((sum, row) => sum - row.cents, 0),
    net: rows.reduce((sum, row) => sum + row.cents, 0),
  };
}
