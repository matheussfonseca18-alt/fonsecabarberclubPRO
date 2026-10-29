import "./style.css";
import "./shell.css";
import "./agenda.css";
import "./catalog.css";
import "./admin.css";
import "./real.css";
import { modeHref } from "./environment";
import {
  defaultAdminState,
  renderConsultationState,
  type AdminState,
} from "./admin-ui";
import { renderPeople } from "./people-view";
import { renderStock, directoryDetail } from "./stock-view";
import {
  renderOrders,
  renderSubscriptions,
  operationsDetail,
} from "./operations-view";
import { renderFinance, financeDetail } from "./finance-view";
import { renderReports, reportsDetail } from "./reports-view";
import { renderSettings, settingsDetail } from "./settings-view";
import { navigation, registryRoutes } from "./shell";
import { renderAgenda } from "./agenda-view";
import { renderCatalog, catalogItem } from "./catalog-view";
import { routes, resolveRoute } from "./routing";
import { aggregate, money, overlaps, type Appointment } from "./domain";
import {
  clients,
  professionals,
  services,
  production,
  DemoAppointmentRepository,
} from "./demo";
const repo = new DemoAppointmentRepository();
let route = resolveRoute(location.hash),
  query = "",
  filter = "Todos",
  date = "2026-10-28",
  mode = "Dia",
  scope = "Empresa";
let registryExpanded = registryRoutes.includes(route),
  catalogPage = 1,
  catalogPageSize = 5;
let pendingToast = "";
const adminStates: Record<string, AdminState> = {};
let adminMode: "ready" | "loading" | "error" = "ready";
const adminState = () =>
  adminStates[route] ?? (adminStates[route] = defaultAdminState());
const pageTitles: Record<string, string> = {
  Clientes: "Cadastro de Clientes",
  Profissionais: "Cadastro de Profissionais",
  Serviços: "Cadastro de Serviços",
  Produtos: "Controle de Estoque",
};
const root = document.querySelector<HTMLDivElement>("#app")!;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const pill = (s: string, t = "") => `<span class="pill ${t}">${s}</span>`;
const avatar = (s: string) =>
  `<span class="avatar">${s
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")}</span>`;
const metric = (label: string, value: string, note: string, trend = "") =>
  `<article class="metric"><div class="metric-label">${label}<span>↗</span></div><strong>${value}</strong><p class="${trend ? "positive" : ""}">${note}</p></article>`;
const select = (
  label: string,
  values: string[],
  value: string,
  id = "filter",
) =>
  `<label class="select-label">${label}<select id="${id}">${values.map((x) => `<option ${x === value ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
const empty = () =>
  `<div class="empty"><span>⌕</span><h3>Nenhum resultado encontrado</h3><p>Experimente outro termo ou limpe os filtros.</p><button data-action="clear">Limpar filtros</button></div>`;
const title: Record<string, string> = {
  Dashboard: "Uma visão completa do seu negócio.",
  Agenda: "Cada horário, uma experiência bem cuidada.",
  Clientes: "Relacionamentos que vão além da cadeira.",
  Profissionais: "Talento, presença e evolução.",
  Serviços: "Consulta administrativa · preços e comissões fictícios.",
  Produtos: "Catálogo e estoque demonstrativo.",
  Comandas: "Todos os atendimentos, organizados.",
  Assinaturas: "Mais recorrência. Mais proximidade.",
  Financeiro:
    "Consultas de competência, caixa e contas em contextos separados.",
  Relatórios: "Consultas administrativas por período e entidade.",
  "Raio-X": "Entenda o desempenho em profundidade.",
  Metas: "Transforme objetivos em direção.",
  Configurações: "Seu clube, do seu jeito.",
};
function chart() {
  const values = Array.from({ length: 7 }, (_, i) =>
    production
      .filter(
        (x) =>
          Number(x.date.slice(-2)) >= i * 4 + 1 &&
          Number(x.date.slice(-2)) <= i * 4 + 4,
      )
      .reduce((s, x) => s + x.cents, 0),
  );
  return `<div class="chart" role="img" aria-label="Produção por intervalo de quatro dias de outubro, dados fictícios">${values.map((v, i) => `<div class="bar-group"><span class="bar-value">${money(v)}</span><div class="bar" style="height:${(v / Math.max(...values)) * 132}px"></div><small>${i * 4 + 1}–${i * 4 + 4} out</small></div>`).join("")}</div>`;
}
function appointmentRows(rows: Appointment[]) {
  return rows.length
    ? rows
        .map(
          (a) =>
            `<button class="appointment-row" data-detail="appointment:${a.id}"><span class="time">${a.time}<small>${a.duration} min</small></span>${avatar(a.client)}<span class="grow"><b>${a.client}</b><small>${a.service} · ${a.professional}</small></span>${pill(a.status, a.status === "Confirmado" ? "green" : "")}<span class="arrow">↗</span></button>`,
        )
        .join("")
    : empty();
}
function dashboard() {
  const totals = aggregate(production, "2026-10-01", "2026-10-31");
  return `<section class="hero"><div><span class="eyebrow">EXCELÊNCIA EM CADA DETALHE</span><h2>Um bom dia começa<br>com uma boa gestão.</h2><p>Seu clube em movimento. Acompanhe o que importa.</p><button class="primary" data-nav="Agenda">Organizar minha agenda <span>↗</span></button></div><div class="hero-emblem"><span>F</span><small>FONSECA<br>BARBER CLUB</small><i>EST. • DEMO</i></div></section><div class="section-line"><h2>O mês em perspectiva</h2><span>01 a 31 de outubro de 2026 · fictício</span></div><div class="metrics">${metric("Produção por competência", money(totals.revenue), "Confirmado na base demonstrativa")}${metric("Atendimentos realizados", String(totals.count), "Serviços da competência de outubro")}${metric("Clientes únicos", String(totals.clients), "IDs distintos no período inteiro")}${metric("Ticket médio", money(Math.round(totals.revenue / totals.count)), "Produção ÷ atendimentos")}</div><div class="two-columns"><section class="panel"><div class="panel-head"><div><h2>Ritmo de produção</h2><p>Serviços realizados · outubro de 2026</p></div>${pill("Competência")}</div>${chart()}</section><section class="panel"><div class="panel-head"><div><h2>Meta do mês</h2><p>Produção da empresa</p></div><span class="gold">⚑</span></div><div class="goal-number">${Math.round((totals.revenue / 1200000) * 100)}<small>%</small></div><div class="progress"><i style="width:${(totals.revenue / 1200000) * 100}%"></i></div><p>${money(totals.revenue)} <span class="muted">de ${money(1200000)}</span></p><div class="insight">↗ &nbsp; Faltam ${money(1200000 - totals.revenue)} para o objetivo.</div></section></div><section class="panel"><div class="panel-head"><div><h2>Na agenda de hoje</h2><p>28 de outubro · data de referência da demonstração</p></div><button class="text-button" data-nav="Agenda">Ver agenda completa ↗</button></div>${appointmentRows(
    repo
      .list()
      .filter((x) => x.date === "2026-10-28")
      .slice(0, 3),
  )}</section>`;
}
function agenda() {
  return renderAgenda({ date, mode, filter, rows: repo.list(), professionals });
}
function catalog() {
  return renderCatalog({
    route: "Serviços",
    query,
    page: catalogPage,
    pageSize: catalogPageSize,
  });
}
function xray() {
  const a = aggregate(
    production,
    "2026-10-01",
    "2026-10-31",
    scope === "Empresa" ? "Todos" : scope,
  );
  return `<div class="toolbar">${select("Escopo do Raio-X", ["Empresa", ...professionals], scope, "scope")}<span class="muted">01–31 out 2026 · competência</span></div><div class="metrics">${metric("Produção", money(a.revenue), "Confirmado na base fictícia")}${metric("Atendimentos", String(a.count), "Serviços realizados no período")}${metric("Clientes únicos", String(a.clients), "Contagem distinta no escopo")}${metric("Comissão gerada", money(a.commission), "Estimativa de 40% · pagamento não informado")}</div><section class="panel"><div class="panel-head"><div><h2>${scope === "Empresa" ? "Participação da equipe" : `Desempenho · ${scope}`}</h2><p>Uma produção é atribuída a um único profissional.</p></div>${pill("Sem duplicação")}</div>${professionals
    .filter((p) => scope === "Empresa" || scope === p)
    .map((p) => {
      const n = aggregate(production, "2026-10-01", "2026-10-31", p);
      return `<div class="performance"><div class="list-line"><b>${p}</b><span>${n.count} atendimentos</span><strong>${money(n.revenue)}</strong></div><div class="progress"><i style="width:${(n.revenue / a.revenue) * 100}%"></i></div></div>`;
    })
    .join(
      "",
    )}<div class="insight">Clientes únicos são recalculados pelos IDs no período e no escopo. Não somamos meses nem clientes de profissionais para obter o total da empresa.</div></section>`;
}
function goals() {
  return `<div class="notice">⚑ &nbsp; Metas ilustrativas de outubro · progresso calculado pela produção fictícia.</div><div class="cards">${[
    "Empresa",
    ...professionals,
  ]
    .map((p, i) => {
      const a = aggregate(
        production,
        "2026-10-01",
        "2026-10-31",
        i ? p : "Todos",
      );
      const goal = i ? 400000 : 1200000;
      return `<article class="panel"><span class="eyebrow">META DE PRODUÇÃO</span><h2>${p}</h2><div class="goal-number">${Math.round((a.revenue / goal) * 100)}<small>%</small></div><div class="progress"><i style="width:${Math.min(100, (a.revenue / goal) * 100)}%"></i></div><p>${money(a.revenue)} de ${money(goal)}</p>${pill("Objetivo estimado")}<p class="muted">Faltam ${money(Math.max(0, goal - a.revenue))}</p></article>`;
    })
    .join("")}</div>`;
}
function adminContent() {
  if (adminMode !== "ready")
    return (
      '<div class="admin-area">' +
      renderConsultationState(adminMode, true) +
      "</div>"
    );
  const state = adminState();
  try {
    const body =
      route === "Clientes" || route === "Profissionais"
        ? renderPeople(route, state)
        : route === "Produtos"
          ? renderStock(state)
          : route === "Comandas"
            ? renderOrders(state)
            : route === "Assinaturas"
              ? renderSubscriptions(state)
              : route === "Financeiro"
                ? renderFinance(state)
                : route === "Relatórios"
                  ? renderReports(state, repo.list())
                  : renderSettings(state);
    return '<div class="admin-area">' + body + "</div>";
  } catch (error) {
    console.error("Falha na consulta demonstrativa", error);
    return (
      '<div class="admin-area">' + renderConsultationState("error") + "</div>"
    );
  }
}
function adminDetail(key: string) {
  const body =
    directoryDetail(key) ??
    operationsDetail(key) ??
    financeDetail(key) ??
    reportsDetail(key) ??
    settingsDetail(key);
  modal(
    (body ??
      '<h2 id="dialog-title">Consulta indisponível</h2><p>Este registro não está presente na amostra. Volte à consulta e atualize os filtros.</p>') +
      '<div class="modal-actions"><button data-close>Voltar</button></div>',
  );
}
function render(focusSelector?: string) {
  if (!routes.includes(route)) route = "Dashboard";
  root.innerHTML = `<aside id="sidebar"><button class="sidebar-close" data-action="menu" aria-label="Fechar navegação">×</button><a class="brand" href="#Dashboard"><span class="brand-mark">F<span>✦</span></span><span>FONSECA<small>BARBER CLUB</small></span></a><div class="workspace"><span class="workspace-icon">F</span><span>Seu espaço de gestão<small>Unidade demonstrativa</small></span><span>⌄</span></div><span class="nav-label">PRINCIPAL</span>${navigation(route, registryExpanded)}<div class="sidebar-bottom"><span class="status-dot"></span> Ambiente de demonstração<small>Feito para o seu próximo capítulo.</small></div></aside><div class="main-shell"><header class="app-header"><div><button class="menu-button" aria-controls="sidebar" aria-expanded="false" data-action="menu" aria-label="Abrir navegação">☰</button><span class="breadcrumb">Workspace <span>/</span> <b>${route}</b></span></div><div class="header-right">${pill("DEMO • DADOS FICTÍCIOS")}<span class="header-date">28 out, 2026</span><span class="profile">FC</span></div></header><main class="${route === "Agenda" ? "agenda-page" : route === "Serviços" || route === "Produtos" ? "catalog-page" : ""}">${route === "Agenda" ? "" : `<div class="page-heading"><div><span class="eyebrow">FONSECA BARBER CLUB</span><h1>${pageTitles[route] ?? route}</h1><p>${title[route]}</p></div>${route !== "Dashboard" ? "" : '<button class="primary" data-action="schedule">＋ Novo agendamento</button>'}</div>`}<div id="content">${route === "Dashboard" ? dashboard() : route === "Agenda" ? agenda() : route === "Serviços" ? catalog() : route === "Raio-X" ? xray() : route === "Metas" ? goals() : adminContent()}</div><footer><span>FONSECA <b>BARBER CLUB</b></span><span>Todos os nomes e valores são fictícios · Preview local v0.1</span></footer></main></div><div id="toast" role="status"></div><dialog id="modal" aria-labelledby="dialog-title"></dialog>`;
  const modeLink = document.createElement("a");
  modeLink.className = "demo-mode-return";
  modeLink.href = modeHref("real", route);
  modeLink.textContent = "Ir para validação";
  root.querySelector(".header-date")?.replaceWith(modeLink);
  bind();
  if (focusSelector)
    document.querySelector<HTMLElement>(focusSelector)?.focus();
}
function toast(s: string) {
  const t = document.querySelector("#toast")!;
  t.textContent = s;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}
function modal(body: string) {
  const d = document.querySelector<HTMLDialogElement>("#modal")!;
  d.innerHTML = `<div class="modal-top"><span class="eyebrow">DEMONSTRAÇÃO · DADOS FICTÍCIOS</span><button data-close aria-label="Fechar">×</button></div>${body}`;
  d.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => d.close()),
  );
  d.showModal();
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
}
function schedule() {
  modal(
    `<h2 id="dialog-title">Um novo cuidado na agenda</h2><p>Crie um horário fictício. Nada será enviado ou cobrado.</p><form id="schedule-form"><label>Cliente<select name="client">${clients.map((c) => `<option>${c}</option>`).join("")}</select></label><div class="form-grid"><label>Profissional<select name="professional">${professionals.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Serviço<select name="service">${services.map((c) => `<option>${c.name}</option>`).join("")}</select></label><label>Data<input name="date" type="date" required value="${date}"></label><label>Horário<input name="time" type="time" required value="15:00" step="900"></label></div><p class="footnote">Horários de referência: 09h–19h, segunda a sábado. Sobreposições serão bloqueadas.</p><p id="form-error" role="alert"></p><div class="modal-actions"><button type="button" data-close>Cancelar</button><button class="primary" type="submit">Adicionar à demo</button></div></form>`,
  );
  document.querySelector("#schedule-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const service = services.find((s) => s.name === data.get("service"))!;
    const a: Appointment = {
      id: crypto.randomUUID(),
      client: String(data.get("client")),
      professional: String(data.get("professional")),
      service: service.name,
      date: String(data.get("date")),
      time: String(data.get("time")),
      duration: service.duration,
      cents: service.cents,
      status: "Agendado",
    };
    let error = "";
    const mins = Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3));
    if (
      new Date(a.date + "T12:00:00").getDay() === 0 ||
      mins < 540 ||
      mins + a.duration > 1140
    )
      error = "Escolha um horário entre segunda e sábado, com término até 19h.";
    if (repo.list().some((b) => overlaps(a, b)))
      error =
        "Este profissional já tem um atendimento neste intervalo. Escolha outro horário.";
    if (error) {
      document.querySelector("#form-error")!.textContent = error;
      return;
    }
    repo.create(a);
    date = a.date;
    mode = "Dia";
    filter = "Todos";
    pendingToast = "Agendamento fictício adicionado somente nesta sessão.";
    if (route === "Agenda") {
      render('[data-action="schedule"]');
      toast(pendingToast);
      pendingToast = "";
    } else location.hash = "Agenda";
  });
}
function detail(value: string) {
  const [type, id] = value.split(":");
  let body: string;
  if (type === "client") {
    const a = aggregate(
      production.filter((p) => p.client === id),
      "2026-10-01",
      "2026-10-31",
    );
    body = `<div class="person">${avatar(id)}<h2 id="dialog-title">${id}</h2></div><p>Perfil inteiramente fictício · sem dados de contato reais</p><div class="metrics two">${metric("Visitas em outubro", String(a.count), "Confirmado na demo")}${metric("Produção vinculada", money(a.revenue), "Serviços por competência")}</div><h3>Histórico demonstrativo</h3>${appointmentRows(repo.list().filter((a) => a.client === id))}`;
  } else if (type === "appointment") {
    const a = repo.list().find((x) => x.id === id)!;
    body = `<h2 id="dialog-title">${a.client}</h2><p>${a.service}</p><div class="detail-lines"><p>Profissional <b>${a.professional}</b></p><p>Data <b>${a.date.split("-").reverse().join("/")}</b></p><p>Horário <b>${a.time} · ${a.duration} min</b></p><p>Valor de referência <b>${money(a.cents)}</b></p></div>${pill(a.status)}`;
  } else if (type === "order") {
    const i = Number(id) - 1041,
      s = services[i % 4];
    body = `<h2 id="dialog-title">Comanda #${id}</h2><p>${clients[i]} · registro fictício</p><div class="list-line"><b>${s.name}</b><span>1 × ${money(s.cents)}</span></div><div class="order-total"><span>Total de itens</span><strong>${money(s.cents)}</strong></div><div class="notice">Pagamento: não disponível. Esta demonstração não recebe valores nem emite comprovantes.</div><button disabled>Pagamento não conectado</button>`;
  } else if (type === "professional") {
    const a = aggregate(production, "2026-10-01", "2026-10-31", id);
    body = `<h2 id="dialog-title">${id}</h2><p>Profissional fictício · especialista em corte e barba</p><div class="metrics two">${metric("Produção", money(a.revenue), "Outubro · competência")}${metric("Comissão", money(a.commission), "Estimado · pagamento ausente")}</div>`;
  } else if (type === "service" || type === "product") {
    const item = catalogItem(type, id);
    if (!item) return;
    body = `<h2 id="dialog-title">${esc(item.name)}</h2><p>Consulta de ${type === "service" ? "serviço" : "produto"} · dados inteiramente fictícios</p><div class="detail-lines"><p>Valor de referência <b>${money(item.cents)}</b></p><p>Categoria <b>${esc(item.category)}</b></p>${item.duration !== undefined ? `<p>Duração <b>${item.duration} min</b></p>` : ""}${item.stock !== undefined ? `<p>Estoque demonstrativo <b>${item.stock} un.</b></p>` : ""}<p>Comissão interna <b>${esc(item.commissionLabel)}</b></p></div><div class="notice">Somente consulta. Cadastro, edição e exclusão ainda não estão disponíveis. Regras de comissão, custos e disponibilidade precisam ser definidas antes do uso real.</div>`;
  } else if (type === "plan") {
    body = `<h2 id="dialog-title">Plano ${id}</h2><p>Benefícios e preços ilustrativos para validar a experiência do clube.</p><div class="notice">Adesão, consumo de créditos, renovação e cobrança precisam de regras aprovadas e backend. Nenhuma assinatura será criada.</div>`;
  } else {
    body = `<h2 id="dialog-title">Detalhes do catálogo</h2><p>Preço, duração e estoque são referências fictícias. Comissões, custos e movimentações serão definidos na próxima etapa.</p>${pill("Consulta demonstrativa")}`;
  }
  modal(
    body +
      `<div class="modal-actions"><button data-close>Voltar</button></div>`,
  );
  document.querySelectorAll("#modal [data-detail]").forEach((b) =>
    b.addEventListener("click", () => {
      (document.querySelector("#modal") as HTMLDialogElement).close();
      detail((b as HTMLElement).dataset.detail!);
    }),
  );
}
function setMenu(open: boolean) {
  document.querySelector("#sidebar")!.classList.toggle("open", open);
  document
    .querySelector(".menu-button")!
    .setAttribute("aria-expanded", String(open));
  if (open)
    // The mobile controls inherit a short visibility transition.
    window.setTimeout(() => {
      if (document.querySelector("#sidebar.open"))
        document.querySelector<HTMLElement>(".sidebar-close")?.focus();
    }, 180);
  else document.querySelector<HTMLElement>(".menu-button")?.focus();
}
function restoreDemo() {
  modal(
    '<h2 id="dialog-title">Restaurar a demonstração?</h2><p>Os agendamentos criados nesta aba serão removidos e a base fictícia inicial será restaurada.</p><div class="modal-actions"><button data-close>Cancelar</button><button id="confirm-reset" class="primary">Restaurar demo</button></div>',
  );
  document.querySelector<HTMLElement>("#confirm-reset")!.onclick = () => {
    repo.reset();
    render();
    toast("Base demonstrativa restaurada.");
  };
}
function bindAdmin() {
  document
    .querySelectorAll<HTMLElement>("[data-admin-tab],[data-admin-subtab]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const state = adminState();
          adminStates[route] = defaultAdminState({
            tab: button.dataset.adminTab ?? state.tab,
            subtab: button.dataset.adminSubtab ?? "",
            pageSize: state.pageSize,
          });
          render(
            button.dataset.adminTab
              ? `[data-admin-tab="${button.dataset.adminTab}"]`
              : `[data-admin-subtab="${button.dataset.adminSubtab}"]`,
          );
        }),
    );
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "[data-admin-field]",
    )
    .forEach((input) => {
      const key = input.dataset.adminField as keyof AdminState;
      input.addEventListener(key === "query" ? "input" : "change", () => {
        if (!(key in adminState())) return;
        const position =
          input instanceof HTMLInputElement && input.type === "search"
            ? input.selectionStart
            : null;
        adminStates[route] = {
          ...adminState(),
          [key]: key === "pageSize" ? Number(input.value) : input.value,
          page: 1,
        };
        render(`[data-admin-field="${key}"]`);
        if (position !== null)
          document
            .querySelector<HTMLInputElement>('[data-admin-field="query"]')
            ?.setSelectionRange(position, position);
      });
    });
  document.querySelectorAll<HTMLElement>("[data-admin-page]").forEach(
    (button) =>
      (button.onclick = () => {
        adminState().page = Number(button.dataset.adminPage);
        render('.admin-pagination [aria-current="page"]');
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-admin-reset]").forEach(
    (button) =>
      (button.onclick = () => {
        const state = adminState();
        adminStates[route] = defaultAdminState({
          tab: state.tab,
          subtab: state.subtab,
          pageSize: state.pageSize,
        });
        render('[data-admin-field="query"]');
      }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-admin-detail]")
    .forEach(
      (button) =>
        (button.onclick = () => adminDetail(button.dataset.adminDetail!)),
    );
  document.querySelectorAll<HTMLElement>("[data-admin-action]").forEach(
    (button) =>
      (button.onclick = () => {
        const key = button.dataset.adminAction!;
        if (key === "today") {
          const today = new Date().toLocaleDateString("en-CA");
          Object.assign(adminState(), { from: today, to: today, page: 1 });
          render('[data-admin-action="today"]');
        } else if (key === "ready") {
          adminMode = "ready";
          render();
        } else if (key === "reset-demo") restoreDemo();
        else if (key === "demo-states") {
          modal(
            '<h2 id="dialog-title">Estados da demonstração</h2><p>Veja como a consulta apresenta carregamento e falha. Estes estados são simulações visuais, sem conexão externa.</p><div class="modal-actions"><button data-preview-state="loading">Simular carregamento</button><button data-preview-state="error">Simular falha</button><button data-close>Voltar</button></div>',
          );
          document
            .querySelectorAll<HTMLElement>("[data-preview-state]")
            .forEach(
              (option) =>
                (option.onclick = () => {
                  adminMode = option.dataset.previewState as
                    "loading" | "error";
                  render();
                }),
            );
        } else if (key === "apply") render();
        else adminDetail(key);
      }),
  );
}
function bind() {
  bindAdmin();
  document.querySelector("#sidebar")!.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (!document.querySelector("#sidebar.open")) return;
    if (key.key === "Escape") {
      key.preventDefault();
      setMenu(false);
    }
    if (key.key === "Tab") {
      const items = [
        ...document.querySelectorAll<HTMLElement>(
          "#sidebar a, #sidebar button",
        ),
      ].filter((el) => el.getClientRects().length);
      const edge = key.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge) {
        key.preventDefault();
        (key.shiftKey ? items[items.length - 1] : items[0])?.focus();
      }
    }
  });
  document.querySelectorAll<HTMLElement>("#sidebar nav a").forEach((link) =>
    link.addEventListener("click", () => {
      if (document.querySelector("#sidebar.open")) setMenu(false);
    }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-page]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        catalogPage = Number(button.dataset.page);
        render('.catalog-pagination [aria-current="page"]');
      }),
    );
  document.querySelector("#page-size")?.addEventListener("change", (event) => {
    catalogPageSize = Number((event.target as HTMLSelectElement).value);
    catalogPage = 1;
    render("#page-size");
  });
  document
    .querySelectorAll<HTMLElement>("[data-nav]")
    .forEach(
      (x) =>
        (x.onclick = () =>
          (location.hash = encodeURIComponent(x.dataset.nav!))),
    );
  document
    .querySelectorAll<HTMLElement>("[data-detail]")
    .forEach((x) => (x.onclick = () => detail(x.dataset.detail!)));
  document.querySelectorAll<HTMLElement>("[data-action]").forEach(
    (x) =>
      (x.onclick = () => {
        const a = x.dataset.action;
        if (a === "schedule") schedule();
        if (a === "registries") {
          registryExpanded = !registryExpanded;
          document.querySelector<HTMLElement>("#registry-links")!.hidden =
            !registryExpanded;
          x.setAttribute("aria-expanded", String(registryExpanded));
          x.querySelector(".nav-chevron")!.textContent = registryExpanded
            ? "⌃"
            : "⌄";
        }
        if (a === "availability") {
          modal(
            `<h2 id="dialog-title">Horários disponíveis</h2><p>A disponibilidade automática ainda não está implementada. A grade mostra apenas os agendamentos fictícios; espaços vazios não garantem um horário disponível.</p><form id="agenda-consult"><label class="select-label">Profissional<select name="professional">${["Todos", ...professionals].map((p) => `<option ${p === filter ? "selected" : ""}>${p}</option>`).join("")}</select></label><label class="select-label">Data<input name="date" type="date" required value="${date}"></label><p class="footnote">Duração, pausas e regras de disponibilidade precisam de validação antes de uso real.</p><div class="modal-actions"><button type="button" data-close>Cancelar</button><button type="submit" class="primary">Consultar agenda</button></div></form>`,
          );
          document
            .querySelector("#agenda-consult")!
            .addEventListener("submit", (event) => {
              event.preventDefault();
              const values = new FormData(event.target as HTMLFormElement);
              filter = String(values.get("professional"));
              date = String(values.get("date"));
              mode = "Dia";
              render("#date");
            });
        }
        if (a === "menu") setMenu(!document.querySelector("#sidebar.open"));
        if (a === "clear") {
          query = "";
          filter = "Todos";
          catalogPage = 1;
          render("#search");
        }
        if (a === "today") {
          date = new Date().toLocaleDateString("en-CA");
          render('[data-action="today"]');
        }
        if (a === "reset") {
          modal(
            `<h2 id="dialog-title">Restaurar a demonstração?</h2><p>Os agendamentos adicionados nesta sessão serão removidos. A base fictícia inicial será restaurada.</p><div class="modal-actions"><button data-close>Cancelar</button><button class="primary" id="confirm-reset">Restaurar demo</button></div>`,
          );
          document.querySelector<HTMLElement>("#confirm-reset")!.onclick =
            () => {
              repo.reset();
              render();
              toast("Base demonstrativa restaurada.");
            };
        }
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-mode],[data-day]").forEach(
    (x) =>
      (x.onclick = () => {
        if (x.dataset.mode) mode = x.dataset.mode;
        if (x.dataset.day) {
          date = x.dataset.day;
          mode = "Dia";
        }
        render(x.dataset.mode ? `[data-mode="${x.dataset.mode}"]` : "#date");
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-shift]").forEach(
    (x) =>
      (x.onclick = () => {
        const d = new Date(date + "T12:00:00"),
          n = Number(x.dataset.shift);
        if (mode === "Mês") {
          d.setDate(1);
          d.setMonth(d.getMonth() + n);
        } else d.setDate(d.getDate() + n * (mode === "Semana" ? 7 : 1));
        date = d.toISOString().slice(0, 10);
        render(`[data-shift="${n}"]`);
      }),
  );
  document.querySelector("#search")?.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    const pos = el.selectionStart;
    query = el.value;
    catalogPage = 1;
    render();
    const n = document.querySelector<HTMLInputElement>("#search")!;
    n.focus();
    n.setSelectionRange(pos, pos);
  });
  document.querySelector("#filter")?.addEventListener("change", (e) => {
    filter = (e.target as HTMLSelectElement).value;
    render("#filter");
  });
  document.querySelector("#scope")?.addEventListener("change", (e) => {
    scope = (e.target as HTMLSelectElement).value;
    render("#scope");
  });
  document.querySelector("#date")?.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).value) {
      date = (e.target as HTMLInputElement).value;
      render("#date");
    }
  });
}
window.addEventListener("hashchange", () => {
  route = resolveRoute(location.hash);
  adminMode = "ready";
  catalogPage = 1;
  if (registryRoutes.includes(route)) registryExpanded = true;
  query = "";
  filter = "Todos";
  render();
  window.scrollTo(0, 0);
  if (pendingToast) {
    toast(pendingToast);
    pendingToast = "";
  }
});
render();
