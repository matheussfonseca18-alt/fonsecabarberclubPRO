export type Appointment = {
  id: string;
  client: string;
  professional: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  cents: number;
};
export type Production = {
  id: string;
  client: string;
  professional: string;
  date: string;
  cents: number;
  commissionCents: number;
};
export function aggregate(
  rows: Production[],
  start: string,
  end: string,
  professional = "Todos",
) {
  const selected = rows.filter(
    (r) =>
      r.date >= start &&
      r.date <= end &&
      (professional === "Todos" || r.professional === professional),
  );
  return {
    revenue: selected.reduce((s, r) => s + r.cents, 0),
    commission: selected.reduce((s, r) => s + r.commissionCents, 0),
    clients: new Set(selected.map((r) => r.client)).size,
    count: selected.length,
  };
}
export function overlaps(a: Appointment, b: Appointment) {
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return (
    a.date === b.date &&
    a.professional === b.professional &&
    minutes(a.time) < minutes(b.time) + b.duration &&
    minutes(b.time) < minutes(a.time) + a.duration
  );
}
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
