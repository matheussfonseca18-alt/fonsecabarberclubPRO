import { test } from "node:test";
import assert from "node:assert/strict";
import type { EntityKind } from "../src/data/contracts.ts";
import {
  createDisconnectedAdapter,
  disconnectedAdapter,
} from "../src/data/disconnected-adapter.ts";
import {
  parseBRLCents,
  REGISTRATION_LIMITS,
  validateRegistration,
} from "../src/data/validation.ts";

test("BR money preserves cents and zero without floating-point rounding", () => {
  const cases = new Map([
    ["0", 0],
    ["0,00", 0],
    ["12,3", 1230],
    ["12,34", 1234],
    ["1.234", 123400],
    [" R$ 1.234,56 ", 123456],
    ["90.071.992.547.409,91", Number.MAX_SAFE_INTEGER],
  ]);
  for (const [raw, expected] of cases)
    assert.equal(parseBRLCents(raw), expected, raw);
  for (const raw of [
    "",
    "-1",
    "+1",
    "1.23",
    "12.34,56",
    "1,234",
    "1,",
    "1e3",
    "NaN",
    "Infinity",
    "90.071.992.547.409,92",
    "1".repeat(65),
    12.34,
    false,
    null,
    undefined,
    {},
    [],
  ])
    assert.equal(parseBRLCents(raw), null, String(raw));
});

test("people require only a bounded name and optional contacts remain absent", () => {
  for (const kind of ["clients", "professionals"] as const) {
    const raw = Object.freeze({
      name: "  Cadastro Sintético  ",
      phone: " ",
      email: null,
    });
    assert.deepEqual(validateRegistration(kind, raw), {
      valid: true,
      errors: {},
      value: { name: "Cadastro Sintético", phone: null, email: null },
    });
    assert.equal(raw.name, "  Cadastro Sintético  ");
    assert.equal(validateRegistration(kind, { name: "Á" }).valid, true);
    for (const name of [
      "",
      " ",
      "nome\ncontrole",
      "a".repeat(REGISTRATION_LIMITS.nameCharacters + 1),
      1,
      false,
    ]) {
      const result = validateRegistration(kind, { name });
      assert.equal(result.valid, false);
      assert.ok(result.errors.name);
      assert.equal(Object.hasOwn(result, "value"), false);
    }
  }
});

test("contact validation checks syntax without assuming verified contact data", () => {
  const result = validateRegistration("clients", {
    name: "Cadastro Sintético",
    email: " exemplo@EXAMPLE.TEST ",
    // All zeros are deliberately synthetic and cannot identify a real contact.
    phone: "0000-0000",
  });
  assert.deepEqual(result, {
    valid: true,
    errors: {},
    value: {
      name: "Cadastro Sintético",
      email: "exemplo@example.test",
      phone: "00000000",
    },
  });
  for (const email of [
    "sem-arroba",
    "a@@example.test",
    ".a@example.test",
    "a..b@example.test",
    "a@example",
    "a@-example.test",
    "a\n@example.test",
    true,
    {},
  ])
    assert.ok(
      validateRegistration("clients", { name: "Sintético", email }).errors
        .email,
    );
  for (const phone of [
    "abc00000000",
    "000",
    "0".repeat(16),
    "++00000000",
    "00000000\n",
    false,
    {},
  ])
    assert.ok(
      validateRegistration("clients", { name: "Sintético", phone }).errors
        .phone,
    );
});

test("service duration is a positive safe integer and product missing stock is not zero", () => {
  assert.deepEqual(
    validateRegistration("services", {
      name: " Serviço Sintético ",
      price: "0,00",
      durationMinutes: "30",
    }),
    {
      valid: true,
      errors: {},
      value: { name: "Serviço Sintético", priceCents: 0, durationMinutes: 30 },
    },
  );
  for (const durationMinutes of [
    undefined,
    null,
    "",
    0,
    "0",
    -1,
    1.5,
    "1.5",
    "1e2",
    Number.MAX_SAFE_INTEGER + 1,
    true,
  ])
    assert.ok(
      validateRegistration("services", {
        name: "Sintético",
        price: "1",
        durationMinutes,
      }).errors.durationMinutes,
    );
  for (const stockQuantity of [undefined, null, "", " "])
    assert.deepEqual(
      validateRegistration("products", {
        name: "Produto Sintético",
        price: "1,00",
        stockQuantity,
      }),
      {
        valid: true,
        errors: {},
        value: {
          name: "Produto Sintético",
          priceCents: 100,
          stockQuantity: null,
        },
      },
    );
  for (const stockQuantity of [0, "0"])
    assert.deepEqual(
      validateRegistration("products", {
        name: "Produto Sintético",
        price: "1,00",
        stockQuantity,
      }),
      {
        valid: true,
        errors: {},
        value: { name: "Produto Sintético", priceCents: 100, stockQuantity: 0 },
      },
    );
  for (const stockQuantity of [
    -1,
    0.5,
    "1,5",
    "1e2",
    "9007199254740992",
    false,
  ])
    assert.ok(
      validateRegistration("products", {
        name: "Sintético",
        price: "1",
        stockQuantity,
      }).errors.stockQuantity,
    );
  assert.ok(
    validateRegistration("products", { name: "Sintético" }).errors.price,
  );
});

test("registration rejects identity, tenant, arbitrary fields and accessors without executing them", () => {
  for (const key of [
    "id",
    "tenantId",
    "tenant_id",
    "tenant",
    "commissionPercent",
    "priceCents",
    "unknown",
  ])
    assert.ok(
      validateRegistration("clients", {
        name: "Sintético",
        [key]: "não permitido",
      }).errors._form,
    );
  let getterCalls = 0;
  const raw = {
    get name() {
      getterCalls++;
      return "Sintético";
    },
  };
  const accessor = validateRegistration("clients", raw);
  assert.equal(accessor.valid, false);
  assert.equal(getterCalls, 0);
  for (const raw of [
    undefined,
    null,
    [],
    "texto",
    new Date(0),
    Object.create({ name: "Herdado" }),
  ])
    assert.equal(validateRegistration("clients", raw).valid, false);
  assert.equal(
    validateRegistration("unknown" as EntityKind, { name: "Sintético" }).valid,
    false,
  );
});

test("uninspectable registration objects fail closed with a structured error", () => {
  const fail = () => {
    throw new Error("synthetic inspection failure");
  };
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const raw of [
    new Proxy({}, { getPrototypeOf: fail }),
    new Proxy({}, { ownKeys: fail }),
    new Proxy({ name: "Sintético" }, { getOwnPropertyDescriptor: fail }),
    revoked.proxy,
  ]) {
    const result = validateRegistration("clients", raw);
    assert.equal(result.valid, false);
    assert.ok(result.errors._form);
    assert.equal(Object.hasOwn(result, "value"), false);
  }
});

test("disconnected adapter never reads, saves, mutates payloads or returns an empty ready list", async () => {
  for (const adapter of [disconnectedAdapter, createDisconnectedAdapter()]) {
    const status = await adapter.status();
    assert.equal(status.state, "disconnected");
    assert.ok(status.reason);
    for (const kind of [
      "clients",
      "professionals",
      "services",
      "products",
    ] as const) {
      const result = await adapter.list(kind);
      assert.equal(result.state, "unavailable");
      assert.equal(Object.hasOwn(result, "records"), false);
    }
    const input = Object.freeze({
      name: "Cadastro Sintético",
      email: "exemplo@example.test",
      phone: null,
    });
    const write = await adapter.create("professionals", input);
    assert.equal(write.state, "unavailable");
    assert.equal(Object.hasOwn(write, "record"), false);
    assert.deepEqual(input, {
      name: "Cadastro Sintético",
      email: "exemplo@example.test",
      phone: null,
    });
    // Even a hostile getter is ignored: disconnected writes never inspect data.
    let reads = 0;
    await adapter.create("clients", {
      get name() {
        reads++;
        return "Sintético";
      },
    });
    assert.equal(reads, 0);
  }
});
