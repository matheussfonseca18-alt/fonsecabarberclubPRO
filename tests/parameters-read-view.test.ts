import { test } from "node:test";
import assert from "node:assert/strict";
import { PARAMETERS_READ_CATALOG } from "../src/parameters-read/catalog.ts";
import { searchParameters } from "../src/parameters-read/model.ts";
import {
  renderParameterReadEntry,
  renderParametersRead,
  renderParametersReadResults,
  parametersReadStatus,
} from "../src/parameters-read/view.ts";
import type { ParametersReadState } from "../src/parameters-read/controller.ts";

const ready = (query = ""): ParametersReadState => ({
  phase: "ready",
  query,
  entries: PARAMETERS_READ_CATALOG,
  matches: searchParameters(PARAMETERS_READ_CATALOG, query),
});

test("all72 entries render exactly once, with explicit unavailable effective settings", () => {
  const html = renderParametersRead(ready());
  const ids = [...html.matchAll(/data-parameter-id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    ids,
    PARAMETERS_READ_CATALOG.map((entry) => entry.localId),
  );
  assert.equal(
    (html.match(/<dt>Configuração atual<\/dt><dd>Indisponível<\/dd>/g) ?? [])
      .length,
    72,
  );
  assert.ok(html.includes("72 de 72 parâmetros"));
  assert.equal((html.match(/Conjunto completo/g) ?? []).length, 35);
  assert.equal((html.match(/Conjunto incompleto/g) ?? []).length, 2);
  assert.equal(
    (html.match(/Opções não disponíveis nesta referência/g) ?? []).length,
    30,
  );
  assert.equal((html.match(/Campo de texto documentado/g) ?? []).length, 5);
});

test("only the query is editable: there are no setting fields, save or submit controls", () => {
  const html = renderParametersRead(ready());
  assert.equal((html.match(/<input\b/g) ?? []).length, 1);
  assert.ok(html.includes('type="search"'));
  assert.doesNotMatch(
    html,
    /<select\b|<textarea\b|type="(?:number|checkbox|radio|submit)"|\bchecked\b|\bselected\b/,
  );
  assert.doesNotMatch(html, />Salvar</);
});

test("placeholder is orientation text and never one of the business choices", () => {
  const html = renderParameterReadEntry(PARAMETERS_READ_CATALOG[2]);
  assert.ok(html.includes("Texto de orientação"));
  assert.ok(html.includes("Não representa um valor de configuração"));
  assert.doesNotMatch(html, /<li>Selecione uma Opção<\/li>/);
  assert.ok(html.includes("10 minutos"));
  assert.ok(html.includes("60 minutos"));
});

test("samples remain separate, with only the recovered times and no synthesized midnight", () => {
  for (const index of [53, 60]) {
    const html = renderParameterReadEntry(PARAMETERS_READ_CATALOG[index]);
    assert.ok(html.includes("Conjunto incompleto"));
    assert.ok(html.includes("Início da amostra"));
    assert.ok(html.includes("Final da amostra"));
    const choices = [...html.matchAll(/<li>(.*?)<\/li>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(choices, [
      "0:05",
      "0:10",
      "0:15",
      "0:20",
      "23:35",
      "23:40",
      "23:45",
      "23:50",
      "23:55",
    ]);
    assert.ok(!html.includes("0:00"));
    assert.ok(!html.includes("Conjunto completo"));
  }
});

test("minutes and pixels retain separate labels and choices", () => {
  const minutes = renderParameterReadEntry(PARAMETERS_READ_CATALOG[2]);
  const pixels = renderParameterReadEntry(PARAMETERS_READ_CATALOG[57]);
  assert.ok(minutes.includes("Minutos") || minutes.includes("minutos"));
  assert.ok(!minutes.includes("pixels"));
  assert.ok(pixels.includes("pixels"));
  assert.ok(!pixels.includes("minutos"));
});

test("unknown options never acquire a generic yes/no choice", () => {
  const html = renderParameterReadEntry(PARAMETERS_READ_CATALOG[0]);
  assert.ok(html.includes("Opções não disponíveis"));
  assert.doesNotMatch(html, /<li>(Sim|Não|Habilitado|Desabilitado)<\/li>/);
  assert.ok(!html.includes("<details"));
});

test("failed and unavailable catalogs remain distinct from a zero-match search", () => {
  for (const phase of ["loading", "error", "unavailable"] as const) {
    const html = renderParametersRead({ phase, query: "agenda" });
    assert.ok(html.includes(`data-parameters-state="${phase}"`));
    assert.ok(!html.includes("Nenhum parâmetro encontrado"));
    assert.ok(!html.includes('class="pr-card"'));
  }
  const html = renderParametersRead(ready("zzzz-sem-correspondencia"));
  assert.ok(html.includes('data-parameters-state="no-matches"'));
  assert.ok(html.includes("Limpar pesquisa"));
  assert.ok(!html.includes("Tentar novamente"));
});

test("queries escape both input attributes and empty-result text", () => {
  const html = renderParametersRead(ready('"><img src=x onerror="attack">&'));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&quot;&gt;&lt;img"));
  assert.ok(html.includes("&amp;"));
});

test("all metadata text is escaped, including option labels, identifiers and units", () => {
  const entry = {
    ...PARAMETERS_READ_CATALOG[2],
    localId: '" onmouseover="attack',
    label: '<script>alert("x")</script>',
    unit: {
      status: "declared" as const,
      kinds: ["minutes" as const],
      label: "<svg onload=attack>",
    },
    options: {
      completeness: "complete" as const,
      items: [{ label: "<img src=x onerror=attack>", kind: "choice" as const }],
    },
  };
  const html = renderParameterReadEntry(entry);
  assert.doesNotMatch(html, /<script|<svg|<img|id="" onmouseover/);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;svg"));
  assert.ok(html.includes("&lt;img"));
});

test("screen-reader result status follows load and query state", () => {
  assert.equal(
    parametersReadStatus({ phase: "loading", query: "" }),
    "Carregando catálogo de parâmetros.",
  );
  assert.ok(parametersReadStatus(ready("cortesia")).startsWith("1 de 72"));
  assert.equal(
    parametersReadStatus(ready("zzzz")),
    "Nenhum parâmetro corresponde à pesquisa.",
  );
  const html = renderParametersRead(ready());
  assert.ok(
    html.includes('role="status" aria-live="polite" aria-atomic="true"'),
  );
  assert.ok(html.includes('role="search" aria-label="Pesquisar parâmetros"'));
});

test("query does not remove context about unavailable settings or insert private provenance", () => {
  const html = renderParametersRead(ready("cortesia"));
  assert.ok(html.includes("Configuração atual indisponível"));
  assert.ok(html.includes("Esta tela não altera configurações"));
  assert.doesNotMatch(
    html,
    /tabId|325662031|Debugger|appbarber-parametros-recuperados|\/rows\//,
  );
  assert.ok(!renderParametersReadResults(ready()).includes("Dados fictícios"));
});
