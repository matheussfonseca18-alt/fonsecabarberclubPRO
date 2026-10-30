import "./features/whatsapp/panel.css";
import "./whatsapp-page.css";
import { mountWhatsappPanel } from "./features/whatsapp/panel.ts";

/** The application entry never accepts a provider, identity, or active adapter. */
export function mountWhatsappPage(root: HTMLElement, pathname: string) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const found = pathname === "/whatsapp" || pathname === "/whatsapp/";
  doc.body.classList.add("wp-document");
  doc.title = "Fonseca Barber Club — WhatsApp";
  root.innerHTML = `
    <div class="wp-host">
      <a class="wp-host-skip" href="#wp-content">Pular para o conteúdo</a>
      <header class="wp-host-header">
        <a class="wp-host-brand" href="/inicio" aria-label="Fonseca Barber Club — página inicial"><span>FONSECA</span><small>BARBER CLUB</small></a>
        <nav aria-label="Navegação do WhatsApp">
          <a href="/inicio">Página inicial</a>
          <a href="/?mode=real#Dashboard">Abrir gestão</a>
          <a href="/?mode=real#Agenda">Agenda</a>
        </nav>
      </header>
      <p class="wp-host-state">Integração ainda não conectada</p>
      <main id="wp-content" tabindex="-1">${
        found
          ? "<div data-whatsapp-panel></div>"
          : '<section class="wp-host-missing"><h1>Página não encontrada</h1><p>Este endereço não corresponde a uma tela do painel.</p><a href="/whatsapp">Voltar ao painel WhatsApp</a></section>'
      }
      </main>
      <footer class="wp-host-footer">Nenhuma conversa real consultada. Leitura, atribuição e envio precisam de conexão e autorização próprias. O atendimento atual continua no AppBarber.</footer>
    </div>`;
  let panel: ReturnType<typeof mountWhatsappPanel> | null = null;
  let disposed = false;
  function mount() {
    if (disposed || !found || panel) return;
    const container = root.querySelector<HTMLElement>("[data-whatsapp-panel]");
    if (container) panel = mountWhatsappPanel(container);
  }
  function suspend() {
    panel?.destroy();
    panel = null;
  }
  function restore(event: PageTransitionEvent) {
    // pagehide clears conversation/draft memory; bfcache must mount a fresh panel.
    if (event.persisted) mount();
  }
  function skip(event: Event) {
    event.preventDefault();
    root.querySelector<HTMLElement>("#wp-content")?.focus();
  }
  const skipLink = root.querySelector<HTMLAnchorElement>(".wp-host-skip");
  skipLink?.addEventListener("click", skip);
  view?.addEventListener("pagehide", suspend);
  view?.addEventListener("pageshow", restore);
  mount();
  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      suspend();
      view?.removeEventListener("pagehide", suspend);
      view?.removeEventListener("pageshow", restore);
      skipLink?.removeEventListener("click", skip);
      doc.body.classList.remove("wp-document");
      root.replaceChildren();
    },
  };
}

export function startWhatsappPage() {
  const root = document.querySelector<HTMLElement>("#app");
  if (root) return mountWhatsappPage(root, location.pathname);
}
