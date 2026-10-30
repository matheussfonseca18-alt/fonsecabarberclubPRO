import type { Message, WhatsappAdapter } from "./contracts.ts";
import { createWhatsappPanelController } from "./panel-controller.ts";

export interface WhatsappPanelOptions {
  adapter?: WhatsappAdapter;
  /** Required for a custom adapter: subscribe to logout / tenant / server-derived scope changes. */
  subscribeScope?: (listener: () => void) => () => void;
}

const statusLabels = {
  disabled: "Integração inativa",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Conexão indisponível",
};
const messageLabels: Record<Message["status"], string> = {
  received: "Recebida",
  pending: "Pendente",
  accepted: "Aceita pelo serviço",
  delivered: "Entregue",
  read: "Lida",
  unknown: "Status desconhecido",
  failed: "Falha",
};
const ownerLabels = {
  appbarber: "AppBarber",
  fonseca: "Fonseca",
  unassigned: "Não definido",
};
function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "Data indisponível";
}

/** Mount without fixture data, global storage or direct provider calls. Import panel.css in the host entry. */
export function mountWhatsappPanel(
  root: HTMLElement,
  options: WhatsappPanelOptions = {},
) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  // An active adapter without logout/tenant invalidation must never expose history.
  const controller = createWhatsappPanelController(
    options.subscribeScope ? options.adapter : undefined,
  );
  let destroyed = false;
  let searchValue = "";
  let assignmentChoice: { id: string; value: string } | null = null;
  let pendingFocusKey: string | undefined;
  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(
    text: string,
    action: string,
    disabled = false,
    className = "wp-button",
  ) {
    const element = el("button", className, text);
    element.type = "button";
    element.dataset.action = action;
    element.dataset.focusKey = action;
    element.disabled = disabled;
    return element;
  }
  function notice(text: string, error = false) {
    const element = el(
      "p",
      error ? "wp-notice wp-notice--error" : "wp-notice",
      text,
    );
    element.setAttribute("role", error ? "alert" : "status");
    return element;
  }
  function render() {
    if (destroyed) return;
    const active = doc.activeElement as
      HTMLInputElement | HTMLTextAreaElement | null;
    const focusKey =
      active && root.contains(active)
        ? active.dataset.focusKey
        : active === doc.body || active === doc.documentElement
          ? pendingFocusKey
          : undefined;
    pendingFocusKey = undefined;
    const selection =
      active &&
      (active.tagName === "TEXTAREA" ||
        (active.tagName === "INPUT" && active.type === "search"))
        ? { start: active.selectionStart, end: active.selectionEnd }
        : null;
    const state = controller.snapshot();
    const app = el("section", "wp-app");
    app.setAttribute("aria-label", "Painel WhatsApp");
    const header = el("header", "wp-header");
    const brand = el("div");
    brand.append(
      el("p", "wp-eyebrow", "FONSECA BARBER CLUB"),
      el("h1", "wp-title", "WhatsApp"),
      el("p", "wp-muted", "Conversas e responsáveis"),
    );
    header.append(
      brand,
      button("Atualizar", "refresh", state.statusPhase === "loading"),
    );
    const connection = el("section", "wp-connection");
    connection.setAttribute("aria-label", "Estado da conexão");
    connection.setAttribute(
      "aria-busy",
      String(state.statusPhase === "loading"),
    );
    const connectionTitle = el(
      "strong",
      "wp-connection__title",
      state.statusPhase === "loading"
        ? "Consultando conexão…"
        : statusLabels[state.connection.state],
    );
    connectionTitle.setAttribute("role", "status");
    connection.append(connectionTitle);
    if (state.connection.label)
      connection.append(el("span", "wp-muted", state.connection.label));
    if (state.connection.reason && state.statusPhase !== "loading")
      connection.append(el("p", "wp-muted", state.connection.reason));
    if (state.connection.updatedAt)
      connection.append(
        el(
          "small",
          "wp-muted",
          `Atualizado em ${dateLabel(state.connection.updatedAt)}`,
        ),
      );
    if (state.statusError)
      connection.append(
        notice(state.statusError, true),
        button("Tentar conexão novamente", "refresh-error"),
      );
    connection.append(
      el(
        "p",
        "wp-lock",
        "Envio bloqueado nesta entrega. Rascunhos ficam somente nesta aba.",
      ),
    );
    const layout = el("div", "wp-layout");
    const inbox = el("section", "wp-inbox");
    inbox.setAttribute("aria-label", "Conversas");
    const inboxHeader = el("div", "wp-section-heading");
    inboxHeader.append(el("h2", "", "Conversas"));
    const search = el("form", "wp-search");
    search.dataset.form = "search";
    search.setAttribute("role", "search");
    const searchLabel = el("label", "wp-search-label");
    searchLabel.append(el("span", "wp-sr-only", "Buscar conversas"));
    const searchInput = el("input");
    searchInput.type = "search";
    searchInput.name = "query";
    searchInput.dataset.focusKey = "query";
    searchInput.placeholder = "Buscar conversas";
    searchInput.maxLength = 160;
    searchInput.value = searchValue;
    searchInput.disabled = !state.connection.capabilities.canRead;
    searchLabel.append(searchInput);
    const searchButton = button(
      "Buscar",
      "search",
      !state.connection.capabilities.canRead,
    );
    searchButton.type = "submit";
    search.append(searchLabel, searchButton);
    inboxHeader.append(search);
    inbox.append(inboxHeader);
    const conversations = el("ul", "wp-conversations");
    conversations.setAttribute(
      "aria-busy",
      String(state.conversationsPhase === "loading"),
    );
    for (const item of state.conversations.items) {
      const row = el("li");
      const open = button("", "open", false, "wp-conversation");
      open.dataset.conversationId = item.id;
      open.dataset.focusKey = `conversation:${item.id}`;
      open.setAttribute(
        "aria-current",
        item.id === state.selectedId ? "true" : "false",
      );
      const title = el("span", "wp-conversation__title");
      title.append(el("strong", "", item.displayName));
      if (item.unreadCount) {
        const unread = el("span", "wp-badge", String(item.unreadCount));
        unread.setAttribute(
          "aria-label",
          `${item.unreadCount} mensagens não lidas`,
        );
        title.append(unread);
      }
      open.append(title);
      if (item.preview) open.append(el("span", "wp-preview", item.preview));
      open.append(
        el("small", "wp-muted", dateLabel(item.updatedAt)),
        el(
          "small",
          "wp-muted",
          item.assignedTo
            ? `Responsável: ${item.assignedTo.displayName}`
            : "Sem responsável",
        ),
      );
      row.append(open);
      conversations.append(row);
    }
    inbox.append(conversations);
    if (state.conversationsPhase === "loading")
      inbox.append(notice("Carregando conversas…"));
    if (state.conversationsError)
      inbox.append(
        notice(state.conversationsError, true),
        button("Tentar conversas novamente", "retry-conversations"),
      );
    if (
      state.conversationsPhase === "ready" &&
      !state.conversations.items.length
    )
      inbox.append(
        el(
          "p",
          "wp-empty",
          state.query
            ? "Nenhuma conversa encontrada para esta busca."
            : "Nenhuma conversa disponível.",
        ),
      );
    if (
      !state.connection.capabilities.canRead &&
      state.statusPhase !== "loading"
    )
      inbox.append(
        el(
          "p",
          "wp-empty",
          "As conversas aparecerão quando a consulta estiver autorizada e ativa.",
        ),
      );
    if (state.conversations.nextCursor)
      inbox.append(
        button(
          "Carregar mais conversas",
          "more-conversations",
          state.conversationsPhase === "loading",
        ),
      );
    const detail = el("section", "wp-detail");
    detail.setAttribute("aria-label", "Detalhes da conversa");
    detail.tabIndex = -1;
    detail.dataset.focusKey = "detail";
    const selected = state.conversations.items.find(
      (item) => item.id === state.selectedId,
    );
    if (!selected) {
      const empty = el("div", "wp-empty wp-empty--detail");
      empty.append(
        el("h2", "", "Selecione uma conversa"),
        el("p", "wp-muted", "O histórico e o responsável aparecem aqui."),
      );
      detail.append(empty);
    } else {
      const detailHeading = el("div", "wp-detail-heading");
      const identity = el("div");
      identity.append(
        el("h2", "", selected.displayName),
        el("p", "wp-muted", `Operação: ${ownerLabels[selected.owner]}`),
      );
      detailHeading.append(identity, button("Voltar à lista", "close-detail"));
      detail.append(detailHeading);
      if (selected.optedOut)
        detail.append(notice("Este contato pediu para não receber mensagens."));
      const assignment = el("form", "wp-assignment");
      assignment.dataset.form = "assignment";
      const assigneeLabel = el("label", "", "Responsável");
      const select = el("select");
      select.name = "assignee";
      select.setAttribute("aria-label", "Responsável");
      select.dataset.focusKey = "assignee";
      const unassigned = el("option", "", "Sem responsável");
      unassigned.value = "";
      select.append(unassigned);
      const choices = [...state.assignees];
      if (
        selected.assignedTo &&
        !choices.some((user) => user.id === selected.assignedTo?.id)
      )
        choices.push(selected.assignedTo);
      for (const user of choices) {
        const option = el("option", "", user.displayName);
        option.value = user.id;
        select.append(option);
      }
      select.value =
        assignmentChoice?.id === selected.id
          ? assignmentChoice.value
          : (selected.assignedTo?.id ?? "");
      select.disabled =
        !state.connection.capabilities.canAssign ||
        state.assigneesPhase !== "ready" ||
        state.assignmentPhase === "loading";
      assigneeLabel.append(select);
      const assign = button(
        state.assignmentPhase === "loading" ? "Atribuindo…" : "Atribuir",
        "assign",
        select.disabled,
      );
      assign.type = "submit";
      assignment.append(assigneeLabel, assign);
      if (!state.connection.capabilities.canAssign)
        assignment.append(
          el("small", "wp-muted", "Atribuição indisponível nesta sessão."),
        );
      if (state.assigneesPhase === "loading")
        assignment.append(notice("Carregando responsáveis…"));
      if (state.assigneesError)
        assignment.append(
          notice(state.assigneesError, true),
          button("Tentar responsáveis novamente", "retry-assignees"),
        );
      detail.append(assignment);
      const history = el("section", "wp-history");
      history.setAttribute("aria-label", "Histórico de mensagens");
      history.setAttribute(
        "aria-busy",
        String(state.messagesPhase === "loading"),
      );
      if (state.messages.nextCursor)
        history.append(
          button(
            "Carregar mais mensagens",
            "more-messages",
            state.messagesPhase === "loading",
          ),
        );
      const messages = el("ol", "wp-messages");
      for (const item of [...state.messages.items].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )) {
        const row = el("li", `wp-message wp-message--${item.direction}`);
        row.append(
          el(
            "span",
            "wp-message__direction",
            item.direction === "inbound" ? "Recebida" : "Enviada",
          ),
          el("p", "wp-message__text", item.text),
        );
        const time = el("time", "wp-muted", dateLabel(item.createdAt));
        time.dateTime = item.createdAt;
        row.append(time, el("small", "wp-muted", messageLabels[item.status]));
        messages.append(row);
      }
      history.append(messages);
      if (state.messagesPhase === "loading")
        history.append(notice("Carregando mensagens…"));
      if (state.messagesError)
        history.append(
          notice(state.messagesError, true),
          button("Tentar mensagens novamente", "retry-messages"),
        );
      if (state.messagesPhase === "ready" && !state.messages.items.length)
        history.append(
          el("p", "wp-empty", "Nenhuma mensagem disponível nesta conversa."),
        );
      detail.append(history);
      const compose = el("form", "wp-composer");
      compose.dataset.form = "compose";
      const draftLabel = el("label", "", "Rascunho local");
      const draft = el("textarea");
      draft.name = "draft";
      draft.dataset.focusKey = "draft";
      draft.rows = 3;
      draft.maxLength = 4000;
      draft.value = state.draft;
      draft.placeholder = "Escreva um rascunho. O envio está bloqueado.";
      draftLabel.append(draft);
      const composeActions = el("div", "wp-composer__actions");
      const counter = el(
        "small",
        "wp-muted",
        `${state.draft.length}/4000 caracteres`,
      );
      counter.dataset.draftCount = "";
      const send = button(
        "Envio bloqueado",
        "send",
        true,
        "wp-button wp-button--gold",
      );
      send.type = "submit";
      composeActions.append(
        counter,
        button("Limpar rascunho", "clear-draft"),
        send,
      );
      compose.append(
        draftLabel,
        el(
          "p",
          "wp-muted",
          "Não salvo. O rascunho será apagado ao sair, recarregar ou mudar de sessão.",
        ),
        composeActions,
      );
      detail.append(compose);
      if (state.notice)
        detail.append(notice(state.notice, state.assignmentPhase === "error"));
    }
    layout.append(inbox, detail);
    app.append(header, connection, layout);
    root.replaceChildren(app);
    if (focusKey) {
      const next = [
        ...root.querySelectorAll<HTMLElement>("[data-focus-key]"),
      ].find((element) => element.dataset.focusKey === focusKey);
      if (next && (next as HTMLButtonElement).disabled) {
        // Preserve keyboard position while an async action disables its button.
        pendingFocusKey = focusKey;
      } else if (next) {
        next.focus({ preventScroll: true });
        if (
          selection &&
          (next.tagName === "TEXTAREA" || next.tagName === "INPUT")
        )
          (next as HTMLInputElement).setSelectionRange(
            selection.start,
            selection.end,
          );
      }
    }
  }
  function target(event: Event): HTMLElement | null {
    return event.target && (event.target as Node).nodeType === 1
      ? (event.target as HTMLElement)
      : null;
  }
  function click(event: Event) {
    const element = target(event)?.closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (!element || !root.contains(element) || element.disabled) return;
    const action = element.dataset.action;
    if (action === "refresh" || action === "refresh-error")
      void controller.refresh();
    else if (action === "retry-conversations")
      void controller.loadConversations();
    else if (action === "more-conversations")
      void controller.loadConversations(true);
    else if (action === "retry-messages") void controller.loadMessages();
    else if (action === "more-messages") void controller.loadMessages(true);
    else if (action === "retry-assignees") void controller.loadAssignees();
    else if (action === "open" && element.dataset.conversationId) {
      assignmentChoice = null;
      void controller.select(element.dataset.conversationId);
      root.querySelector<HTMLElement>(".wp-detail")?.focus();
    } else if (action === "close-detail") {
      const id = controller.snapshot().selectedId;
      controller.closeDetail();
      [...root.querySelectorAll<HTMLElement>("[data-conversation-id]")]
        .find((item) => item.dataset.conversationId === id)
        ?.focus();
    } else if (action === "clear-draft") controller.clearDraft();
  }
  function input(event: Event) {
    const element = target(event) as HTMLInputElement | null;
    if (element?.name === "query") searchValue = element.value;
    if (element?.name === "draft") {
      controller.setDraft(element.value);
      const counter = root.querySelector("[data-draft-count]");
      if (counter)
        counter.textContent = `${controller.snapshot().draft.length}/4000 caracteres`;
    }
    if (element?.name === "assignee")
      assignmentChoice = {
        id: controller.snapshot().selectedId ?? "",
        value: element.value,
      };
  }
  function submit(event: Event) {
    const form = target(event) as HTMLFormElement | null;
    if (!form?.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "search") void controller.search(searchValue);
    if (form.dataset.form === "assignment") {
      const assignee = form.elements.namedItem(
        "assignee",
      ) as HTMLSelectElement | null;
      if (assignee && !assignee.disabled)
        void controller.assign(assignee.value || null);
    }
    if (form.dataset.form === "compose") controller.requestSend();
  }
  const unsubscribe = controller.subscribe(render);
  function resetScope() {
    searchValue = "";
    assignmentChoice = null;
    pendingFocusKey = undefined;
    controller.resetScope();
  }
  function userFocusChanged(event: Event) {
    if (event.target !== doc.body && event.target !== doc.documentElement)
      pendingFocusKey = undefined;
  }
  const unsubscribeScope = options.subscribeScope?.(resetScope);
  root.addEventListener("click", click);
  root.addEventListener("input", input);
  root.addEventListener("change", input);
  root.addEventListener("submit", submit);
  doc.addEventListener("focusin", userFocusChanged);
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    unsubscribeScope?.();
    controller.destroy();
    searchValue = "";
    assignmentChoice = null;
    pendingFocusKey = undefined;
    root.removeEventListener("click", click);
    root.removeEventListener("input", input);
    root.removeEventListener("change", input);
    root.removeEventListener("submit", submit);
    doc.removeEventListener("focusin", userFocusChanged);
    view?.removeEventListener("pagehide", destroy);
    root.replaceChildren();
  }
  view?.addEventListener("pagehide", destroy);
  render();
  void controller.refresh();
  return { destroy, resetScope, refresh: controller.refresh };
}
