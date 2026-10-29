import "./style.css";
import "./shell.css";
import "./admin.css";
import "./real.css";
import "./catalog-read.css";
import { catalogReader, catalogSessionSource, catalogReadActivation } from "./data/catalog-access";
import { createCatalogQuery } from "./data/catalog-query";
import type { CatalogKind } from "./data/catalog-read";
import { renderCatalogRead, renderCatalogReadDetail, defaultCatalogReadFilters, type CatalogReadFilters } from "./catalog-read-view";
import { h } from "./admin-ui";
import { modeHref } from "./environment";
import { navigation, registryRoutes } from "./shell";
import { resolveRoute } from "./routing";
import { disconnectedAdapter } from "./data/disconnected-adapter";
import type { EntityKind } from "./data/contracts";
import {
  firstStage,
  realContent,
  realSections,
  registrationForm,
  registrationRoutes,
} from "./real-view";

export async function startRealApp() {
  const root = document.querySelector<HTMLDivElement>("#app")!;
  let route = resolveRoute(location.hash);
  let expanded = registryRoutes.includes(route);
  let revision = 0;
  const sections: Record<string, string> = {};
  const catalogFilters: Record<CatalogKind,CatalogReadFilters> = {
    professionals: {...defaultCatalogReadFilters},
    services: {...defaultCatalogReadFilters},
    products: {...defaultCatalogReadFilters},
  };
  const catalogQuery = createCatalogQuery(catalogReader, () => { void render(); });
  const catalogKind = () => {
    const kind = registrationRoutes[route];
    return kind && kind !== "clients" ? kind as CatalogKind : undefined;
  };
  function refreshCatalogRoute() {
    catalogQuery.clear();
    const kind = catalogKind();
    if (kind) void catalogQuery.load(kind);
  }
  const unsubscribeSession = catalogSessionSource.subscribe(() => {
    root.querySelector("#content")?.replaceChildren();
    document.querySelector<HTMLDialogElement>("#real-modal")?.close();
    for (const kind of Object.keys(catalogFilters) as CatalogKind[])
      catalogFilters[kind] = { ...defaultCatalogReadFilters };
    refreshCatalogRoute();
  });
  window.addEventListener("pagehide", () => {
    catalogQuery.clear();
    root.querySelector("#content")?.replaceChildren();
    document.querySelector<HTMLDialogElement>("#real-modal")?.close();
  });
  window.addEventListener("pageshow", event => { if (event.persisted) refreshCatalogRoute(); });
  window.addEventListener("unload", () => { unsubscribeSession(); catalogQuery.dispose(); });
  document.title = "Fonseca Barber Club • Validação";

  function setMenu(open: boolean) {
    document.querySelector("#sidebar")?.classList.toggle("open", open);
    document
      .querySelector(".menu-button")
      ?.setAttribute("aria-expanded", String(open));
    if (open)
      window.setTimeout(() => {
        if (document.querySelector("#sidebar.open"))
          document.querySelector<HTMLElement>(".sidebar-close")?.focus();
      }, 180);
    else document.querySelector<HTMLElement>(".menu-button")?.focus();
  }

  function showForm(kind: EntityKind, opener: HTMLElement) {
    if (!firstStage.includes(route) || registrationRoutes[route] !== kind)
      return;
    const dialog = document.querySelector<HTMLDialogElement>("#real-modal")!;
    dialog.innerHTML = `<div class="modal-top"><span class="eyebrow">VALIDAÇÃO · GRAVAÇÃO INDISPONÍVEL</span><button type="button" data-real-close aria-label="Fechar formulário">×</button></div>${registrationForm(kind)}`;
    dialog
      .querySelectorAll("[data-real-close]")
      .forEach((button) =>
        button.addEventListener("click", () => dialog.close()),
      );
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      // Fail closed even if a disabled button is manipulated in the DOM.
      dialog.querySelector("#real-form-status")!.textContent =
        "Salvamento indisponível. Nenhum dado foi enviado ou persistido.";
    });
    dialog.onclose = () => {
      dialog.innerHTML = "";
      opener.focus();
    };
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-real-close]")?.focus();
  }

  function bindCatalog() {
    const kind = catalogKind();
    if (!kind) return;
    const filters = catalogFilters[kind];
    root.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-catalog-field]").forEach(field => {
      field.addEventListener(field.dataset.catalogField === "query" ? "input" : "change", async () => {
        const key=field.dataset.catalogField;
        const cursor=field instanceof HTMLInputElement ? field.selectionStart : null;
        if(key === "query") filters.query=field.value;
        if(key === "status") filters.status=field.value as CatalogReadFilters["status"];
        if(key === "pageSize") filters.pageSize=[5,10,25].includes(Number(field.value)) ? Number(field.value) : 10;
        filters.page=1;
        await render('[data-catalog-field="'+key+'"]');
        const active=root.querySelector<HTMLInputElement>('[data-catalog-field="query"]');
        if(key === "query" && active && cursor !== null) active.setSelectionRange(cursor,cursor);
      });
    });
    root.querySelectorAll<HTMLElement>("[data-catalog-reset]").forEach(button=>button.addEventListener("click",()=>{
      catalogFilters[kind]={...defaultCatalogReadFilters};
      void render('[data-catalog-field="query"]');
    }));
    root.querySelectorAll<HTMLElement>("[data-catalog-page]").forEach(button=>button.addEventListener("click",()=>{
      const page=Number(button.dataset.catalogPage);
      filters.page=Number.isSafeInteger(page)&&page>0 ? page : 1;
      void render();
    }));
    root.querySelectorAll<HTMLElement>("[data-catalog-detail]").forEach(button=>button.addEventListener("click",()=>{
      const snapshot=catalogQuery.snapshot();
      if(!snapshot || snapshot.kind !== kind || snapshot.result.state !== "ready") return;
      const row=snapshot.result.rows.find(item=>item.entity_id === button.dataset.catalogDetail);
      if(!row) return;
      const dialog=root.querySelector<HTMLDialogElement>("#real-modal")!;
      dialog.innerHTML=renderCatalogReadDetail(kind,row)+'<div class="modal-actions"><button type="button" data-catalog-close>Voltar</button></div>';
      dialog.setAttribute("aria-label","Detalhes do catálogo — somente leitura");
      dialog.removeAttribute("aria-labelledby");
      dialog.querySelector("[data-catalog-close]")!.addEventListener("click",()=>dialog.close());
      dialog.onclose=()=>{dialog.innerHTML="";button.focus();};
      dialog.showModal();
    }));
  }

  async function render(focus?: string) {
    const current = ++revision;
    let reason: string;
    try {
      const connection = await disconnectedAdapter.status();
      reason = connection.reason;
      const kind = registrationRoutes[route];
      if (kind) {
        const result = await disconnectedAdapter.list(kind);
        reason =
          result.state === "unavailable"
            ? result.reason
            : "Consulta não liberada nesta etapa de preparação.";
      }
    } catch {
      reason =
        "Não foi possível verificar a disponibilidade. Nenhum dado foi consultado.";
    }
    if (current !== revision) return;
    const section = sections[route] ?? realSections[route]?.[0] ?? "";
    const readKind=catalogKind();
    const snapshot=catalogQuery.snapshot();
    const catalogResult=snapshot && snapshot.kind === readKind ? snapshot.result : {state:"inactive" as const,message:"Consulta não ativada."};
    const pageContent=readKind ? renderCatalogRead(readKind,catalogResult,catalogFilters[readKind]) : realContent(route,section,reason);
    root.innerHTML = `<aside id="sidebar"><button class="sidebar-close" data-real-menu aria-label="Fechar navegação">×</button><a class="brand" href="#Dashboard"><span class="brand-mark">F<span>✦</span></span><span>FONSECA<small>BARBER CLUB</small></span></a><div class="workspace"><span class="workspace-icon">F</span><span>Seu espaço de gestão<small>Ambiente de validação</small></span></div><span class="nav-label">PRINCIPAL</span>${navigation(route, expanded)}<div class="sidebar-bottom real-sidebar-bottom"><b>Dados reais · preparação</b><small>Operação ainda não liberada</small><a href="${modeHref("demo", route)}">Abrir demonstração isolada ↗</a></div></aside><div class="main-shell"><header class="app-header"><div><button class="menu-button" aria-controls="sidebar" aria-expanded="false" data-real-menu aria-label="Abrir navegação">☰</button><span class="breadcrumb">Validação <span>/</span> <b>${h(route)}</b></span></div><div class="header-right"><span class="pill">${catalogReadActivation.enabled ? "VALIDAÇÃO · SOMENTE LEITURA" : "VALIDAÇÃO · CONSULTA INATIVA"}</span><span class="profile">FC</span></div></header><main class="real-page"><div class="page-heading"><div><h1>${h(route)}</h1><p>Preparação para dados reais · sem operação em produção</p></div></div><div class="real-mode-notice" role="status"><span aria-hidden="true">◌</span><div><b>Validação dos catálogos</b><span>${catalogReadActivation.enabled ? "Consulta restrita à conta autorizada. Nenhuma edição ou operação em produção está habilitada." : "Consulta preparada, aguardando primeiro login verificado e ativação. Nenhum registro está sendo consultado."}</span></div></div><div id="content">${pageContent}</div><footer><span>FONSECA <b>BARBER CLUB</b></span><span>Validação local · nenhuma gravação habilitada</span></footer></main></div><dialog id="real-modal" aria-labelledby="real-dialog-title"></dialog>`;
    root
      .querySelectorAll("[data-real-menu]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          setMenu(!document.querySelector("#sidebar.open")),
        ),
      );
    root
      .querySelector('[data-action="registries"]')
      ?.addEventListener("click", () => {
        expanded = !expanded;
        const group = root.querySelector('[data-action="registries"]')!;
        group.setAttribute("aria-expanded", String(expanded));
        root.querySelector<HTMLElement>("#registry-links")!.hidden = !expanded;
        group.querySelector(".nav-chevron")!.textContent = expanded ? "⌃" : "⌄";
      });
    root
      .querySelectorAll<HTMLElement>("[data-real-section]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          sections[route] = button.dataset.realSection!;
          void render(`[data-real-section="${CSS.escape(sections[route])}"]`);
        }),
      );
    root
      .querySelectorAll<HTMLElement>("[data-real-form]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          showForm(button.dataset.realForm as EntityKind, button),
        ),
      );
    root.querySelectorAll<HTMLElement>("[data-real-nav]").forEach((button) =>
      button.addEventListener("click", () => {
        location.hash = button.dataset.realNav!;
      }),
    );
    root
      .querySelectorAll("#sidebar nav a")
      .forEach((link) => link.addEventListener("click", () => setMenu(false)));
    root.querySelector("#sidebar")!.addEventListener("keydown", (event) => {
      const key = event as KeyboardEvent;
      if (!document.querySelector("#sidebar.open")) return;
      if (key.key === "Escape") {
        key.preventDefault();
        setMenu(false);
      }
      if (key.key === "Tab") {
        const items = [
          ...root.querySelectorAll<HTMLElement>("#sidebar a, #sidebar button"),
        ].filter((el) => el.getClientRects().length);
        if (
          document.activeElement ===
          (key.shiftKey ? items[0] : items[items.length - 1])
        ) {
          key.preventDefault();
          (key.shiftKey ? items[items.length - 1] : items[0])?.focus();
        }
      }
    });
    bindCatalog();
    const authSession = await catalogSessionSource.getSession();
    if (current !== revision) return;
    const authControl = document.createElement(authSession ? "button" : "a");
    authControl.textContent = authSession ? "Encerrar sessão" : "Acessar";
    authControl.className = "pill";
    if (authControl instanceof HTMLAnchorElement) authControl.href = "/auth/login";
    else authControl.addEventListener("click", async () => {
      const { getAuthFlow } = await import("./auth/runtime.ts");
      await getAuthFlow().signOut();
      location.replace("/auth/login");
    });
    root.querySelector(".header-right")?.prepend(authControl);
    if (focus) root.querySelector<HTMLElement>(focus)?.focus();
  }
  window.addEventListener("hashchange", () => {
    route = resolveRoute(location.hash);
    if (registryRoutes.includes(route)) expanded = true;
    refreshCatalogRoute();
    void render();
    window.scrollTo(0, 0);
  });
  refreshCatalogRoute();
  await render();
}
