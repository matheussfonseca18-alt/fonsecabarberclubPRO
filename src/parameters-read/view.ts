import type { ParameterReadEntry } from "./model.ts";
import type { ParametersReadState } from "./controller.ts";

const text = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

function labels(
  items: readonly { label: string; kind: "placeholder" | "choice" }[],
) {
  const choices = items.filter((item) => item.kind === "choice");
  const placeholders = items.filter((item) => item.kind === "placeholder");
  return `<ul class="pr-options">${choices.map((item) => `<li>${text(item.label)}</li>`).join("")}</ul>${placeholders.map((item) => `<p class="pr-placeholder">Texto de orientação: <q>${text(item.label)}</q>. Não representa um valor de configuração.</p>`).join("")}`;
}

function options(entry: ParameterReadEntry) {
  const data = entry.options;
  if (data.completeness === "complete")
    return `<details class="pr-details"><summary>Consultar opções documentadas <span class="pr-coverage">Conjunto completo</span></summary><div class="pr-option-body">${labels(data.items)}</div></details>`;
  if (data.completeness === "sampled")
    return `<details class="pr-details"><summary>Consultar amostras de horários <span class="pr-coverage pr-partial">Conjunto incompleto</span></summary><div class="pr-option-body"><p>Somente algumas opções foram documentadas. Os horários intermediários não estão disponíveis nesta consulta.</p><h4>Início da amostra</h4>${labels(data.samples.first)}<h4>Final da amostra</h4>${labels(data.samples.last)}</div></details>`;
  if (data.completeness === "not-applicable")
    return '<p class="pr-unknown">Campo de texto documentado. Formato e validações de negócio não confirmados.</p>';
  return '<p class="pr-unknown">Opções não disponíveis nesta referência.</p>';
}

export function renderParameterReadEntry(entry: ParameterReadEntry): string {
  return `<li class="pr-card" data-parameter-id="${text(entry.localId)}"><article aria-labelledby="pr-label-${text(entry.localId)}"><div class="pr-card-top"><span class="pr-reference">Referência P${text(entry.sourceNumber)}</span><span class="pr-control">${entry.observedControl.tag === "select" ? "Lista de opções" : "Campo de texto"}</span></div><h3 id="pr-label-${text(entry.localId)}">${text(entry.label)}</h3><dl class="pr-facts"><div><dt>Configuração atual</dt><dd>Indisponível</dd></div><div><dt>Unidade declarada</dt><dd>${entry.unit.status === "declared" ? text(entry.unit.label) : "Não confirmada"}</dd></div></dl>${options(entry)}</article></li>`;
}

export function parametersReadStatus(state: ParametersReadState): string {
  if (state.phase === "loading") return "Carregando catálogo de parâmetros.";
  if (state.phase === "error")
    return "Não foi possível carregar o catálogo de parâmetros.";
  if (state.phase === "unavailable")
    return "Catálogo de parâmetros indisponível.";
  if (!state.matches.length) return "Nenhum parâmetro corresponde à pesquisa.";
  return `${state.matches.length} de ${state.entries.length} parâmetros${state.query.trim() ? " encontrados" : " disponíveis para consulta"}.`;
}

export function renderParametersReadResults(
  state: ParametersReadState,
): string {
  if (state.phase === "loading")
    return '<div class="pr-state" data-parameters-state="loading" aria-busy="true"><span class="pr-state-mark" aria-hidden="true">…</span><h3>Carregando parâmetros</h3><p>Aguarde a leitura do catálogo local.</p></div>';
  if (state.phase === "error" || state.phase === "unavailable")
    return `<div class="pr-state" data-parameters-state="${state.phase}"><h3>${state.phase === "error" ? "Não foi possível carregar o catálogo" : "Catálogo indisponível"}</h3><p>${state.phase === "error" ? "A referência local não pôde ser lida. Tente carregar novamente." : "A referência não está disponível neste momento."}</p><button class="pr-button" type="button" data-parameters-retry>Tentar novamente</button></div>`;
  if (!state.matches.length)
    return `<div class="pr-state" data-parameters-state="no-matches"><span class="pr-state-mark" aria-hidden="true">⌕</span><h3>Nenhum parâmetro encontrado</h3><p>Não há rótulos correspondentes a <strong>${text(state.query)}</strong>. Tente outro termo ou limpe a pesquisa.</p><button class="pr-button" type="button" data-parameters-clear>Limpar pesquisa</button></div>`;
  return `<div data-parameters-state="ready"><p class="pr-context">As opções abaixo descrevem os campos; nenhuma está selecionada como configuração atual.</p><ul class="pr-list">${state.matches.map(renderParameterReadEntry).join("")}</ul></div>`;
}

/** Self-contained markup: it does not inherit the demo table's fictitious-data label. */
export function renderParametersRead(state: ParametersReadState): string {
  return `<section class="pr-root" aria-label="Consulta de parâmetros"><header class="pr-heading"><div><p class="pr-eyebrow">CONFIGURAÇÕES · CONSULTA</p><h2>Parâmetros</h2><p class="pr-intro">Encontre os campos e consulte suas opções documentadas.</p></div><span class="pr-mode">Somente leitura</span></header><div class="pr-notice" role="note" aria-label="Limites da consulta"><strong>Configuração atual indisponível</strong><p>Os valores em uso, os padrões e os efeitos ainda não foram confirmados. Esta tela não altera configurações.</p></div><form class="pr-search" role="search" aria-label="Pesquisar parâmetros"><label>Pesquisar pelo nome do parâmetro<input class="pr-query" type="search" name="parameter-query" value="${text(state.query)}" placeholder="Ex.: agenda, comissão, cliente" autocomplete="off" data-parameters-query></label><button class="pr-button pr-button-secondary" type="button" data-parameters-clear ${state.query ? "" : "disabled"}>Limpar</button></form><p class="pr-count" role="status" aria-live="polite" aria-atomic="true" data-parameters-status>${text(parametersReadStatus(state))}</p><div data-parameters-results>${renderParametersReadResults(state)}</div><footer class="pr-footer">Referência documentada em 30/10/2026. Campos e opções não confirmam regras operacionais.</footer></section>`;
}
