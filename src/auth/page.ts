import "../style.css";
import "./page.css";
import { h } from "../admin-ui.ts";
import { authConfiguration, getAuthFlow } from "./runtime.ts";
import type { CallbackInput } from "./callback.ts";

export async function startAuthPage(input?: CallbackInput) {
  const isCallback = Boolean(input);
  document.documentElement.dataset.dataMode = "real";
  document.title = "Fonseca Barber Club · Primeiro acesso";
  const root = document.querySelector<HTMLDivElement>("#app")!;
  const flow = getAuthFlow();
  let email = "";
  function render() {
    const state = flow.snapshot();
    const busy = state.status === "sending" || state.status === "checking";
    const authenticated = state.status === "authenticated";
    const maySend =
      !isCallback &&
      authConfiguration.enabled &&
      authConfiguration.dispatchEnabled &&
      state.status === "ready";
    root.innerHTML = `<main class="auth-page"><section class="auth-card" aria-labelledby="auth-title"><a class="auth-brand" href="/?mode=real#Dashboard">FONSECA <span>BARBER CLUB</span></a><span class="auth-label">VALIDAÇÃO PRIVADA · SOMENTE CONSULTA</span><h1 id="auth-title">${isCallback ? "Confirmar primeiro acesso" : "Acessar com seu e-mail"}</h1><p class="auth-intro">Use o link neste mesmo Chrome e computador. O endereço local não abre este sistema no celular.</p><div class="auth-state" data-auth-status="${state.status}" role="${state.status === "error" || state.status === "expired" ? "alert" : "status"}"><b>${authenticated ? "Identidade confirmada" : busy ? "Aguarde" : "Estado do acesso"}</b><p>${h(state.message)}</p></div>${!isCallback ? `<form id="auth-form"><label for="auth-email">E-mail autorizado</label><input id="auth-email" name="email" type="email" autocomplete="email" value="${h(email)}" required ${maySend ? "" : "disabled"}><button type="submit" ${maySend ? "" : "disabled"}>Solicitar primeiro link</button></form>` : ""}<div class="auth-actions">${authenticated ? '<button type="button" data-auth-continue>Continuar para os catálogos</button><button type="button" class="secondary" data-auth-out>Encerrar sessão</button>' : busy ? '<button type="button" class="secondary" data-auth-cancel>Interromper tentativa</button>' : '<a href="/?mode=real#Dashboard">Voltar ao sistema</a>'}</div><p class="auth-footnote">Nenhuma edição, cobrança ou acesso a dados é liberado somente por receber o link. Não compartilhe o link nem envie senhas pelo chat.</p></section></main>`;
    root
      .querySelector<HTMLInputElement>("#auth-email")
      ?.addEventListener("input", (event) => {
        email = (event.target as HTMLInputElement).value;
      });
    root.querySelector("#auth-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (maySend) void flow.send(email);
    });
    root
      .querySelector("[data-auth-cancel]")
      ?.addEventListener("click", () => flow.cancel());
    root.querySelector("[data-auth-out]")?.addEventListener("click", () => {
      void flow.signOut();
    });
    root
      .querySelector("[data-auth-continue]")
      ?.addEventListener("click", async () => {
        unsubscribe();
        history.replaceState(null, "", "/?mode=real#Profissionais");
        const { startRealApp } = await import("../real-app.ts");
        await startRealApp();
      });
  }
  const unsubscribe = flow.subscribe(render);
  render();
  try {
    if (input) await flow.callback(input);
  } finally {
    // Release the one-time code from this closure after the request settles.
    // eslint-disable-next-line no-useless-assignment
    input = undefined;
  }
}
