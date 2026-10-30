import { clients } from "./demo.ts";

// Synthetic reporting metadata. These are not contact, login or birth records.
export const reportClients = clients.map((name, index) => ({
  id: `report-client-${index}`,
  name,
  registeredAt: `2026-10-${String(1 + index * 3).padStart(2, "0")}`,
  accessStatus: index % 3 === 0 ? "Sem acesso na demo" : "Acesso simulado",
  birthdayMonthDay: [
    "10-05",
    "10-12",
    "10-23",
    "10-28",
    "10-31",
    "11-02",
    "09-09",
    "12-25",
  ][index],
  phone: "Não informado",
}));

export const reportPlanLabels = ["Essencial", "Signature", "Black Club"];

/** Each record occurs annually; a period can cross December without losing January. */
export function birthdayOccurrences(start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  )
    return [];
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  // A broad arbitrary range would not be a useful birthday consultation.
  if (lastYear - firstYear > 10) return [];
  return Array.from(
    { length: lastYear - firstYear + 1 },
    (_, offset) => firstYear + offset,
  )
    .flatMap((year) =>
      reportClients.map((client) => ({
        ...client,
        date: `${year}-${client.birthdayMonthDay}`,
      })),
    )
    .filter((client) => client.date >= start && client.date <= end)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
    );
}
