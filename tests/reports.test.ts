import assert from "node:assert/strict";
import test from "node:test";
import { birthdayOccurrences } from "../src/demo-reports.ts";
import { defaultAdminState } from "../src/admin-ui.ts";
import {
  renderReports,
  selectReportAppointments,
} from "../src/reports-view.ts";
import type { Appointment } from "../src/domain.ts";

test("appointment report intersects period, status, client and professional before pagination", () => {
  const base: Appointment = {
    id: "matching",
    client: "André",
    professional: "Lucas",
    service: "Corte",
    date: "2026-10-10",
    time: "10:00",
    duration: 30,
    cents: 5000,
    status: "Concluído",
  };
  const rows = [
    base,
    { ...base, id: "other-professional", professional: "Theo" },
    { ...base, id: "other-period", date: "2026-11-10" },
    { ...base, id: "not-completed", status: "Agendado" },
    { ...base, id: "other-client", client: "Bruno" },
  ];
  const filtered = selectReportAppointments(
    rows,
    defaultAdminState({
      client: "André",
      professional: "Lucas",
      status: "Concluído",
      query: "andre",
    }),
  );
  assert.deepEqual(
    filtered.map((row) => row.id),
    ["matching"],
  );
});

test("birthday occurrence query crosses year boundaries without treating month/day as a timestamp", () => {
  const selected = birthdayOccurrences("2026-12-01", "2027-10-06");
  assert.equal(
    selected.some((row) => row.date === "2026-12-25"),
    true,
  );
  assert.equal(
    selected.some((row) => row.date === "2027-10-05"),
    true,
  );
  assert.equal(
    selected.some((row) => row.date === "2026-10-05"),
    false,
  );
  assert.equal(
    selected.every(
      (row) => row.date >= "2026-12-01" && row.date <= "2027-10-06",
    ),
    true,
  );
});

test("birthday consultation requires a finite ordered date interval", () => {
  assert.deepEqual(birthdayOccurrences("2026-10-31", "2026-10-01"), []);
  assert.deepEqual(birthdayOccurrences("", "2026-10-01"), []);
  assert.deepEqual(birthdayOccurrences("2026-10-01", ""), []);
});

test("reversed report periods expose correction controls without result tables or zero totals", () => {
  for (const [tab, subtab] of [
    ["Agendamentos", "Geral"],
    ["Agendamentos", "Recorrentes"],
    ["Agendamentos", "Assinaturas"],
    ["Clientes", ""],
    ["Resumo", "Resumo"],
    ["Resumo", "Dashboard"],
    ["Resumo", "Vendas"],
    ["Resumo", "Profissionais"],
    ["Aniversariantes", ""],
  ]) {
    const html = renderReports(
      defaultAdminState({ tab, subtab, from: "2026-11-01", to: "2026-10-01" }),
      [],
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /data-admin-field="from"/);
    assert.match(html, /data-admin-field="to"/);
    assert.doesNotMatch(html, /<table|0 clientes|0 registros|R\$/);
  }
});
