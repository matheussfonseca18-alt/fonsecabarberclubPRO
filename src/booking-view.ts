import { h } from "./admin-ui.ts";
import {
  priceBookingCart,
  quoteBooking,
  type CartAddition,
} from "./booking-domain.ts";
import {
  bookingScreen,
  confirmedTimeZone,
  type BookingUiState,
} from "./booking-controller.ts";
import type { BookingCatalogData } from "./data/booking-access.ts";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const steps = [
  ["service", "Serviço"],
  ["professional", "Profissional"],
  ["items", "Complementos"],
  ["times", "Horários"],
  ["confirmation", "Revisão"],
] as const;
const readMessages: Record<string, string> = {
  idle: "A consulta ainda não foi iniciada.",
  loading: "Consultando os dados necessários…",
  unavailable: "A conexão de agendamento ainda não está disponível.",
  "signed-out": "É necessário um acesso verificado para consultar esses dados.",
  forbidden: "Este acesso não tem permissão para consultar esses dados.",
  error: "Não foi possível validar os dados. Tente consultar novamente.",
};
export function safeBookingPortrait(raw: unknown): string | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("state" in raw) ||
    raw.state !== "confirmed" ||
    !("value" in raw)
  )
    return null;
  const path = raw.value;
  return typeof path === "string" &&
    /^\/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/u.test(path) &&
    !path.startsWith("//")
    ? path
    : null;
}
export function bookingTime(minute: number, zone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(minute * 60000);
}
function label(
  data: BookingCatalogData,
  kind: keyof BookingCatalogData["labels"],
  id: string,
): string {
  return data.labels[kind][id];
}
function choice(
  attribute: string,
  id: string,
  title: string,
  details: string,
  reason?: string,
  portrait = "",
) {
  return `<button id="${attribute}-${h(id)}" type="button" class="booking-choice" ${attribute}="${h(id)}" ${reason ? "disabled" : ""}>${portrait}<span><strong>${h(title)}</strong><small>${h(details)}</small>${reason ? `<small class="booking-reason">${h(reason)}</small>` : '<small class="booking-choice-next">Selecionar →</small>'}</span></button>`;
}
function additions(state: BookingUiState, data: BookingCatalogData): string {
  const cart = state.draft.cart!;
  const professional = state.draft.professionalId!;
  function option(item: CartAddition, title: string): string {
    const entityId = item.kind === "product" ? item.productId : item.serviceId;
    const selected = cart.additions.find(
      (row) =>
        row.kind === item.kind &&
        (row.kind === "product" ? row.productId : row.serviceId) === entityId,
    );
    const elsewhere =
      item.kind !== "product" &&
      cart.additions.some(
        (row) =>
          row.kind !== "product" &&
          row.serviceId === entityId &&
          row.kind !== item.kind,
      );
    const proposal = quoteBooking(
      data.catalog,
      {
        ...cart,
        additions: selected ? cart.additions : [...cart.additions, item],
      },
      professional,
    );
    const reason = elsewhere
      ? "Já selecionado em outro papel."
      : proposal.state === "blocked"
        ? proposal.issue.message
        : "";
    const line =
      proposal.state === "ready"
        ? proposal.value.lines.find(
            (row) => row.kind === item.kind && row.entityId === entityId,
          )
        : null;
    const details = line
      ? `${money(line.priceCents)} · ${item.kind === "product" ? "não acrescenta tempo" : `${line.minutes} min ${item.kind === "extra" ? "adicionais" : "avulsos"}`}`
      : "Dados ainda não confirmados";
    const inputId = `item-${item.kind}-${entityId}`;
    return `<div class="booking-item"><label for="${h(inputId)}"><input id="${h(inputId)}" type="checkbox" data-addition-kind="${item.kind}" data-entity-id="${h(entityId)}" ${selected ? "checked" : ""} ${reason && !selected ? "disabled" : ""}><span><b>${h(title)}</b><small>${h(details)}</small>${reason ? `<small class="booking-reason">${h(reason)}</small>` : ""}</span></label>${item.kind === "product" ? `<label class="booking-quantity" for="qty-${h(entityId)}">Quantidade<input id="qty-${h(entityId)}" type="number" inputmode="numeric" min="1" step="1" value="${selected?.kind === "product" ? selected.quantity : 1}" data-product-quantity="${h(entityId)}" ${selected ? "" : "disabled"}></label>` : ""}</div>`;
  }
  const extras = data.catalog.extraRules
    .filter((rule) => rule.baseServiceId === cart.baseServiceId)
    .map((rule) =>
      data.catalog.services.find(
        (service) => service.id === rule.extraServiceId,
      ),
    )
    .filter((row) => row !== undefined);
  const regular = data.catalog.services.filter(
    (service) => service.id !== cart.baseServiceId,
  );
  return `<p>Selecione apenas o que deseja acrescentar. Cada serviço será realizado pelo profissional escolhido.</p><fieldset><legend>Extras vinculados ao serviço principal</legend><p class="booking-muted">Usam o incremento configurado, que pode ser zero.</p>${extras.length ? extras.map((service) => option({ kind: "extra", serviceId: service.id }, label(data, "services", service.id))).join("") : '<p class="booking-muted">Nenhum vínculo de extra informado para esta base.</p>'}</fieldset><fieldset><legend>Outros serviços</legend><p class="booking-muted">Usam sua duração e preço avulsos.</p>${regular.map((service) => option({ kind: "service", serviceId: service.id }, label(data, "services", service.id))).join("") || '<p class="booking-muted">Nenhum outro serviço disponível no catálogo consultado.</p>'}</fieldset><fieldset><legend>Produtos</legend>${data.catalog.products.map((product) => option({ kind: "product", productId: product.id, quantity: 1 }, label(data, "products", product.id))).join("") || '<p class="booking-muted">Nenhum produto no catálogo consultado.</p>'}</fieldset><button class="booking-primary" type="button" id="booking-next" data-booking-next ${state.itemsBlocked ? "disabled" : ""}>Escolher horários →</button>`;
}
function summary(state: BookingUiState): string {
  if (state.catalog.state !== "ready" || !state.draft.cart)
    return '<p class="booking-muted">O resumo aparece após escolher um serviço com dados confirmados.</p>';
  const data = state.catalog.data;
  const priced = priceBookingCart(data.catalog, state.draft.cart);
  if (priced.state === "blocked") return `<p>${h(priced.issue.message)}</p>`;
  return `<ul class="booking-summary-lines">${priced.value.lines.map((line) => `<li><span>${h(label(data, line.kind === "product" ? "products" : "services", line.entityId))}${line.quantity > 1 ? ` × ${line.quantity}` : ""}<small>${line.kind === "extra" ? "Extra vinculado" : line.kind === "product" ? "Produto · sem tempo adicional" : line.kind === "base" ? "Serviço principal" : "Serviço avulso"}</small></span><b>${money(line.priceCents)}</b></li>`).join("")}</ul><dl><div><dt>Duração total</dt><dd>${priced.value.totalMinutes} min</dd></div><div><dt>Subtotal informado</dt><dd>${money(priced.value.totalCents)}</dd></div>${state.draft.professionalId ? `<div><dt>Profissional</dt><dd>${h(label(data, "professionals", state.draft.professionalId))}</dd></div>` : ""}</dl><p class="booking-muted">Sem cálculo de plano, desconto, pagamento ou comissão.</p>`;
}
export function renderBooking(state: BookingUiState): string {
  const screen = bookingScreen(state);
  const busy =
    state.catalog.state === "loading" || state.availability.state === "loading";
  let content: string;
  if (state.catalog.state !== "ready") {
    content = `<section class="booking-unavailable" aria-busy="${busy}"><span class="booking-eyebrow">SELEÇÕES AINDA NÃO CARREGADAS</span><h2>Precisamos dos dados confirmados</h2><p>${readMessages[state.catalog.state]}</p><ul><li>Serviços com preço e duração.</li><li>Profissionais ativos e habilitações.</li><li>Vínculos de extras e seus incrementos.</li><li>Jornada, bloqueios e fuso do estabelecimento.</li></ul><p class="booking-muted">Indisponível não significa catálogo vazio. Nenhum exemplo será usado no lugar dos seus dados.</p><button type="button" class="booking-primary" id="booking-reload" data-booking-reload ${busy ? "disabled" : ""}>Consultar disponibilidade dos dados</button></section>`;
  } else {
    const data = state.catalog.data;
    const zone = confirmedTimeZone(data.timeZone);
    if (screen === "service")
      content = `<p>Comece pelo serviço principal. Valores ou durações não confirmados impedem a seleção.</p><div class="booking-choices">${
        data.catalog.services
          .map((service) => {
            const result = priceBookingCart(data.catalog, {
              baseServiceId: service.id,
              additions: [],
            });
            return choice(
              "data-booking-service",
              service.id,
              label(data, "services", service.id),
              result.state === "ready"
                ? `${result.value.totalMinutes} min · ${money(result.value.totalCents)}`
                : "Seleção indisponível",
              result.state === "blocked" ? result.issue.message : undefined,
            );
          })
          .join("") || "<p>Nenhum serviço no catálogo consultado.</p>"
      }</div>`;
    else if (screen === "professional")
      content = `<p>Escolha quem realizará o serviço. Complementos serão verificados para esse mesmo profissional.</p><div class="booking-choices">${
        data.catalog.professionals
          .map((professional) => {
            const result = quoteBooking(
              data.catalog,
              state.draft.cart!,
              professional.id,
            );
            const portrait = safeBookingPortrait(
              data.portraits[professional.id],
            );
            return choice(
              "data-booking-professional",
              professional.id,
              label(data, "professionals", professional.id),
              result.state === "ready"
                ? "Habilitado para o serviço principal"
                : "Seleção indisponível",
              result.state === "blocked" ? result.issue.message : undefined,
              portrait
                ? `<img class="booking-portrait" src="${h(portrait)}" alt="" width="64" height="64" loading="lazy">`
                : '<span class="booking-no-photo">Foto não disponível</span>',
            );
          })
          .join("") || "<p>Nenhum profissional no catálogo consultado.</p>"
      }</div>`;
    else if (screen === "items") content = additions(state, data);
    else if (screen === "times")
      content = `<p>O atendimento precisa caber por inteiro em um intervalo livre.</p><form id="booking-date-form"><label for="booking-date">Data do atendimento<input id="booking-date" type="date" name="date" value="${h(state.date)}" required aria-describedby="booking-zone"></label><p id="booking-zone" class="booking-muted">${zone ? `Fuso do estabelecimento: ${h(zone)}` : "Fuso ainda não confirmado; consulta bloqueada."}</p><button id="booking-search" type="submit" class="booking-primary" ${busy || !zone ? "disabled" : ""}>Consultar horários compatíveis</button></form><div class="booking-times" aria-busy="${busy}">${state.availability.state === "ready" && state.plan ? (state.plan.availability.slots.length ? `<p>Opções compatíveis com os dados consultados. Ainda não são reservas.</p><div class="booking-slots" role="group" aria-label="Horários compatíveis">${state.plan.availability.slots.map((slot) => `<button id="booking-slot-${slot.start}" type="button" data-booking-slot="${slot.start}">${h(bookingTime(slot.start, zone!))}<small>até ${h(bookingTime(slot.end, zone!))}</small></button>`).join("")}</div>` : '<p role="status">Nenhum horário compatível nesta consulta. Escolha outra data ou revise os complementos.</p>') : `<p role="status">${state.availability.state === "idle" ? "Escolha a data e consulte os horários." : readMessages[state.availability.state]}</p>`}</div>`;
    else
      content = `<p class="booking-review-label">RASCUNHO · NÃO RESERVADO</p><p>Confira os itens, o profissional e o período antes da futura confirmação.</p>${state.draft.review && zone ? `<dl class="booking-review-time"><dt>Período escolhido</dt><dd>${h(bookingTime(state.draft.review.slot.start, zone))} até ${h(bookingTime(state.draft.review.slot.end, zone))}</dd><dt>Fuso</dt><dd>${h(zone)}</dd></dl>` : "<p>Horário ainda não revisado.</p>"}<p id="booking-confirm-help">A confirmação está indisponível: o serviço que valida e grava reservas ainda não está conectado. Nenhum agendamento foi criado.</p><button type="button" class="booking-primary" id="booking-confirm" data-booking-confirm disabled aria-describedby="booking-confirm-help">Confirmar agendamento — indisponível</button>`;
  }
  return `<main class="booking-page"><a id="booking-skip" class="booking-skip" href="#booking-step-title">Pular para a etapa atual</a><header class="booking-header"><a id="booking-brand" class="booking-brand" href="/inicio">FONSECA <span>BARBER CLUB</span></a><a id="booking-agenda" href="/?mode=real#Agenda">← Voltar à Agenda</a></header><div class="booking-heading"><span class="booking-eyebrow">PREPARAÇÃO DO AGENDAMENTO</span><h1>Seu próximo atendimento</h1><p>Monte a seleção e revise horários quando os dados estiverem disponíveis.</p></div><nav aria-label="Etapas do agendamento"><ol class="booking-steps">${steps.map(([step, title], index) => `<li ${screen === step || (screen === "reviewed" && step === "confirmation") ? 'aria-current="step"' : ""}><span aria-hidden="true">${index + 1}</span>${title}</li>`).join("")}</ol></nav><div class="booking-layout"><section class="booking-panel" aria-labelledby="booking-step-title"><h2 id="booking-step-title" tabindex="-1">${steps.find(([step]) => step === screen)?.[1] ?? "Revisão"}</h2><div id="booking-status" tabindex="-1" role="${state.notice?.tone === "error" ? "alert" : "status"}" ${state.notice ? "" : "hidden"}>${h(state.notice?.text ?? "")}</div>${state.itemsBlocked ? '<p>A seleção válida anterior continua exibida. Corrija os itens ou descarte a alteração inválida para continuar.</p><button id="booking-restore" type="button" data-booking-restore>Descartar alteração inválida</button>' : ""}${content}<div class="booking-actions">${screen !== "service" ? '<button type="button" id="booking-back" data-booking-back>← Voltar uma etapa</button>' : ""}${busy ? '<button type="button" id="booking-interrupt" data-booking-interrupt>Interromper consulta</button>' : ""}<button type="button" id="booking-cancel" data-booking-cancel>Cancelar rascunho</button></div></section><aside class="booking-summary" aria-labelledby="booking-summary-title"><h2 id="booking-summary-title">Sua seleção</h2>${summary(state)}<p class="booking-footnote">Preparação local. A confirmação de uma reserva depende do servidor.</p></aside></div><footer class="booking-footer">Nenhuma reserva, cobrança ou alteração de cadastro é realizada nesta tela.</footer></main>`;
}
