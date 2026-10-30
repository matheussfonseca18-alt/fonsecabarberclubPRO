import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoute, resolveSettingsSection, settingsSectionHash } from "../src/routing.ts";
import { realContent, realSections } from "../src/real-view.ts";
import { renderSettings, settingsDetail } from "../src/settings-view.ts";
import { defaultAdminState } from "../src/admin-ui.ts";

test("parameters deep link survives encoding without changing its parent route", () => {
  const hash = settingsSectionHash("Parâmetros");
  for (const value of [hash, "#Configurações/Parâmetros", "#/Configurações/Parâmetros"]) {
    assert.equal(resolveRoute(value), "Configurações");
    assert.equal(resolveSettingsSection(value), "Parâmetros");
  }
});

test("only documented settings sections can be addressed", () => {
  for (const value of ["#Configurações/Gravar", "#Configurações/Parâmetros/outro", "#Configurações/Parâmetros//outro", "#Configurações/Parâmetros/", "#Configurações/%E0%A4%A", "#Agenda/Parâmetros"]) {
    assert.equal(resolveSettingsSection(value), undefined);
    assert.equal(resolveRoute(value), "Dashboard");
  }
  assert.equal(settingsSectionHash("<script>"), "#Configura%C3%A7%C3%B5es");
});

test("existing settings and administrative entries retain their routes", () => {
  for (const section of ["Conexão", "Etapas", "Critérios de liberação", "Identidade", "Funcionamento", "Restrições", "Avaliações", "Conexões"]) {
    assert.equal(resolveSettingsSection(settingsSectionHash(section)), section);
    assert.equal(resolveRoute(settingsSectionHash(section)), "Configurações");
  }
  for (const route of ["Agenda", "Configurações", "Dashboard", "Serviços"]) {
    assert.equal(resolveRoute(`#${encodeURIComponent(route)}`), route);
    assert.equal(resolveSettingsSection(`#${encodeURIComponent(route)}`), undefined);
  }
});

test("real settings exposes a metadata host without operational fields", () => {
  assert.equal(realSections.Configurações[0], "Conexão");
  assert.ok(realSections.Configurações.includes("Parâmetros"));
  const html = realContent("Configurações", "Parâmetros", "Não conectado");
  assert.match(html, /data-real-section="Parâmetros" aria-pressed="true"/u);
  assert.equal((html.match(/data-parameters-read-host/gu) ?? []).length, 1);
  assert.doesNotMatch(html, /<input|<select|Salvar|fictíci|Definições pendentes/iu);
});

test("demo settings embeds the same documented reference without a fictitious table label", () => {
  const html = renderSettings(defaultAdminState({ tab: "Parâmetros" }));
  assert.equal((html.match(/data-parameters-read-host/gu) ?? []).length, 1);
  assert.doesNotMatch(html, /fictíci|<input|<select|Salvar|Definições pendentes/iu);
});

test("parameters explanation preserves unknown active values and denies saving", () => {
  const html = settingsDetail("settings:parameters")!;
  assert.match(html, /72 rótulos/u);
  assert.match(html, /Valores atuais, padrões, obrigatoriedade e efeitos continuam desconhecidos/u);
  assert.match(html, /não salva configurações/u);
  assert.doesNotMatch(html, /necessário confirmar rótulos/u);
});
