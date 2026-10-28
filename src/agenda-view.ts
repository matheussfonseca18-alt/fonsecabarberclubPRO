import type { Appointment } from "./domain";

export type AgendaViewProps = {
  date: string;
  mode: string;
  filter: string;
  rows: Appointment[];
  professionals: string[];
};

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const localDate = (value: string) => new Date(`${value}T12:00:00`);
const dateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Month cells include padding, so every date stays under its weekday. */
export function monthCells(date: string): (string | null)[] {
  const current = localDate(date);
  const first = new Date(current.getFullYear(), current.getMonth(), 1, 12);
  const count = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0,
    12,
  ).getDate();
  const padding = (first.getDay() + 6) % 7;
  const result: (string | null)[] = Array.from({ length: padding }, () => null);
  for (let day = 1; day <= count; day++)
    result.push(
      dateKey(new Date(current.getFullYear(), current.getMonth(), day, 12)),
    );
  while (result.length % 7) result.push(null);
  return result;
}

export function weekDates(date: string): string[] {
  const start = localDate(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return dateKey(day);
  });
}

export type AgendaEventLayout = {
  appointment: Appointment;
  start: number;
  duration: number;
  lane: number;
  lanes: number;
};
/** Clip to the display range and allocate independent columns to intersecting events. */
export function layoutAppointments(rows: Appointment[]): AgendaEventLayout[] {
  const sorted = rows
    .map((appointment) => ({
      appointment,
      start: Math.max(540, minutes(appointment.time)),
      end: Math.min(1140, minutes(appointment.time) + appointment.duration),
    }))
    .filter((item) => item.end > item.start)
    .sort(
      (a, b) =>
        a.start - b.start ||
        a.end - b.end ||
        a.appointment.id.localeCompare(b.appointment.id),
    );
  const result: AgendaEventLayout[] = [];
  let group: AgendaEventLayout[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const finish = () => {
    for (const item of group) item.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.start >= groupEnd) {
      finish();
      groupEnd = 0;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    groupEnd = Math.max(groupEnd, item.end);
    const placed = {
      appointment: item.appointment,
      start: item.start - 540,
      duration: item.end - item.start,
      lane,
      lanes: 1,
    };
    result.push(placed);
    group.push(placed);
  }
  finish();
  return result;
}

function eventCard(item: AgendaEventLayout): string {
  const a = item.appointment;
  const label = `${a.time}, ${a.duration} minutos, ${a.client}, ${a.service}, ${a.professional}, ${a.status}`;
  const statusClass =
    a.status === "Concluído"
      ? "agenda-event-completed"
      : a.status === "Confirmado"
        ? "agenda-event-confirmed"
        : "";
  return `<button class="agenda-event ${statusClass} ${item.duration < 40 ? "agenda-event-short" : ""}" style="--event-start:${item.start / 60};--event-duration:${item.duration / 60};--event-lane:${item.lane};--event-lanes:${item.lanes}" data-detail="appointment:${escape(a.id)}" title="${escape(label)}" aria-label="${escape(label)}"><span class="agenda-event-time">${escape(a.time)} <span>· ${a.duration} min</span></span><b>${escape(a.client)}</b><small>${escape(a.service)}</small><small class="agenda-event-professional">${escape(a.professional)}</small></button>`;
}

function timeGrid(props: AgendaViewProps, filtered: Appointment[]): string {
  const weekly = props.mode === "Semana";
  const columns = weekly
    ? weekDates(props.date)
    : props.filter === "Todos"
      ? props.professionals
      : [props.filter];
  const hours = Array.from(
    { length: 11 },
    (_, index) => String(9 + index).padStart(2, "0") + ":00",
  );
  return `<div class="agenda-grid-scroll" tabindex="0" aria-label="Grade de horários; role horizontalmente em telas estreitas"><div class="agenda-time-grid ${weekly ? "agenda-week-grid" : ""}" style="--agenda-columns:${columns.length}"><div class="agenda-grid-head"><span class="agenda-axis-title">Hora</span>${columns
    .map(
      (column) =>
        `<div class="agenda-column-heading">${
          weekly
            ? `<span>${localDate(column).toLocaleDateString("pt-BR", { weekday: "short" })}</span><b>${localDate(column).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</b>`
            : `<span class="agenda-professional-avatar">${column
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}</span><b>${escape(column)}</b>`
        }</div>`,
    )
    .join(
      "",
    )}</div><div class="agenda-grid-body"><div class="agenda-time-axis">${hours.map((hour, index) => `<span style="--hour:${index}">${hour}</span>`).join("")}</div>${columns
    .map((column) => {
      const rows = filtered.filter((a) =>
        weekly
          ? a.date === column
          : a.date === props.date && a.professional === column,
      );
      return `<div class="agenda-day-column" aria-label="${escape(column)}">${layoutAppointments(rows).map(eventCard).join("")}</div>`;
    })
    .join("")}</div></div></div>`;
}

function monthly(date: string, rows: Appointment[]): string {
  return `<div class="agenda-month"><div class="agenda-month-weekdays">${weekdayLabels.map((day) => `<span>${day}</span>`).join("")}</div><div class="agenda-month-cells">${monthCells(
    date,
  )
    .map((day) =>
      day
        ? `<button class="agenda-month-day ${day === date ? "agenda-date-selected" : ""}" data-day="${day}" aria-label="Abrir ${localDate(day).toLocaleDateString("pt-BR")}"><b>${Number(day.slice(-2))}</b><span>${rows.filter((a) => a.date === day).length} agendamentos</span></button>`
        : '<span class="agenda-month-padding" aria-hidden="true"></span>',
    )
    .join("")}</div></div>`;
}

function list(date: string, rows: Appointment[]): string {
  const items = rows
    .filter((a) => a.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  return `<div class="agenda-list"><div class="agenda-list-heading"><h2>Lista de agendamentos</h2><span>${items.length} registros no dia</span></div>${items.length ? items.map((a) => `<button class="agenda-list-row" data-detail="appointment:${escape(a.id)}"><span><b>${escape(a.time)}</b><small>${a.duration} min</small></span><span><b>${escape(a.client)}</b><small>${escape(a.service)} · ${escape(a.professional)}</small></span><span class="agenda-list-status">${escape(a.status)}</span><span aria-hidden="true">↗</span></button>`).join("") : '<div class="agenda-empty"><h3>Nenhum agendamento neste dia</h3><p>Escolha outra data ou outro profissional para consultar a base fictícia.</p></div>'}</div>`;
}

function sidebar(props: AgendaViewProps, filtered: Appointment[]): string {
  const selectedCount = filtered.filter((a) => a.date === props.date).length;
  return `<section class="agenda-side" aria-label="Consultas da agenda"><div class="agenda-mini-calendar"><div class="agenda-mini-heading"><h2>${localDate(props.date).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2></div><div class="agenda-mini-weekdays">${weekdayLabels.map((day) => `<span>${day.slice(0, 1)}</span>`).join("")}</div><div class="agenda-mini-days">${monthCells(
    props.date,
  )
    .map((day) =>
      day
        ? `<button class="${day === props.date ? "agenda-mini-selected" : ""}" data-day="${day}" aria-label="Selecionar ${localDate(day).toLocaleDateString("pt-BR")}" ${day === props.date ? 'aria-current="date"' : ""}>${Number(day.slice(-2))}${filtered.some((a) => a.date === day) ? '<i aria-hidden="true"></i>' : ""}</button>`
        : '<span aria-hidden="true"></span>',
    )
    .join(
      "",
    )}</div><button class="agenda-mini-today" data-action="today">Hoje</button></div><label class="agenda-filter" for="filter">Profissional<select id="filter">${["Todos", ...props.professionals].map((p) => `<option ${props.filter === p ? "selected" : ""}>${escape(p)}</option>`).join("")}</select></label><div class="agenda-query-actions"><button data-action="availability">◷ &nbsp; Horários disponíveis</button><button data-mode="Lista">☷ &nbsp; Lista de agendamentos</button></div><div class="agenda-quick-catalog"><span>CONSULTAR CADASTROS</span><div><button data-nav="Serviços">✂ Serviços</button><button data-nav="Produtos">◇ Produtos</button></div></div><div class="agenda-demo-note"><b>${selectedCount} agendamentos no dia</b><p>Todos os registros são fictícios. Novos horários ficam apenas nesta sessão.</p><span class="agenda-legend-confirmed"><i></i> Confirmado na demo</span><span class="agenda-legend-scheduled"><i></i> Agendado na demo</span><span class="agenda-legend-completed"><i></i> Concluído na demo</span></div></section>`;
}

export function renderAgenda(props: AgendaViewProps): string {
  const filtered = props.rows.filter(
    (a) => props.filter === "Todos" || a.professional === props.filter,
  );
  const label = localDate(props.date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `<section class="agenda-layout"><h1 class="agenda-sr-only">Agenda</h1><div class="agenda-main"><div class="agenda-toolbar"><div class="agenda-date-controls"><button data-shift="-1" aria-label="Período anterior">‹</button><button data-action="today">Hoje</button><button data-shift="1" aria-label="Próximo período">›</button><input aria-label="Data da agenda" id="date" type="date" value="${props.date}"></div><div class="agenda-view-modes" aria-label="Visualização da agenda">${["Dia", "Semana", "Mês", "Lista"].map((mode) => `<button class="${props.mode === mode ? "agenda-mode-active" : ""}" data-mode="${mode}" aria-pressed="${props.mode === mode}">${mode}</button>`).join("")}</div></div><div class="agenda-period-heading"><h2>${props.mode === "Mês" ? localDate(props.date).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : label}</h2><span>AGENDA DEMONSTRATIVA</span></div>${props.mode === "Mês" ? monthly(props.date, filtered) : props.mode === "Lista" ? list(props.date, filtered) : timeGrid(props, filtered)}<p class="agenda-grid-footnote">Horários locais · blocos posicionados pela duração do serviço · clique para consultar os detalhes.</p></div><div class="agenda-right"><button class="primary agenda-new" data-action="schedule">＋ Novo agendamento</button>${sidebar(props, filtered)}</div></section>`;
}
