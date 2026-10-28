import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRoute } from "../src/routing.ts";
test("root, hash routes and encoded labels resolve safely", () => {
  assert.equal(resolveRoute(""), "Dashboard");
  assert.equal(resolveRoute("#Agenda"), "Agenda");
  assert.equal(resolveRoute("#/Agenda"), "Agenda");
  assert.equal(resolveRoute("#Configura%C3%A7%C3%B5es"), "Configurações");
  assert.equal(resolveRoute("#%"), "Dashboard");
  assert.equal(resolveRoute("#%E0%A4"), "Dashboard");
  assert.equal(resolveRoute("#inexistente"), "Dashboard");
  assert.equal(resolveRoute("#Servi%C3%A7os%20%2F%20Produtos"), "Serviços");
  assert.equal(resolveRoute("#Produtos"), "Produtos");
});
