import type {
  EntityCreateInput,
  EntityCreateMap,
  EntityKind,
  ValidationResult,
} from "./contracts.ts";

/** Technical input limits, not recovered business rules or verified contacts. */
export const REGISTRATION_LIMITS = Object.freeze({
  nameCharacters: 120,
  emailCharacters: 254,
  phoneCharacters: 32,
  numericCharacters: 64,
});

const fields: Record<EntityKind, readonly string[]> = {
  clients: ["name", "phone", "email"],
  professionals: ["name", "phone", "email"],
  services: ["name", "price", "durationMinutes"],
  products: ["name", "price", "stockQuantity"],
};

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}

/**
 * BR reais string -> integer cents. Optional R$, grouped thousands and 1–2
 * decimals are accepted. Dot decimals, signs and exponent notation are not.
 * No floating-point multiplication, rounding or implicit currency conversion.
 */
export function parseBRLCents(raw: unknown): number | null {
  if (
    typeof raw !== "string" ||
    raw.length > REGISTRATION_LIMITS.numericCharacters
  )
    return null;
  const value = raw.trim().replace(/^R\$\s*/u, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/u.test(value)) return null;
  const [whole, fraction = ""] = value.split(",");
  const cents =
    BigInt(whole.replaceAll(".", "")) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= maxSafeInteger ? Number(cents) : null;
}

function integer(raw: unknown, minimum: number): number | null {
  if (typeof raw === "number")
    return Number.isSafeInteger(raw) && raw >= minimum ? raw : null;
  if (
    typeof raw !== "string" ||
    raw.length > REGISTRATION_LIMITS.numericCharacters
  )
    return null;
  const value = raw.trim();
  if (!/^\d+$/u.test(value)) return null;
  const parsed = BigInt(value);
  return parsed >= BigInt(minimum) && parsed <= maxSafeInteger
    ? Number(parsed)
    : null;
}

function optionalText(
  raw: unknown,
  key: string,
  errors: Record<string, string>,
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    errors[key] = "Informe um texto ou deixe o campo vazio.";
    return null;
  }
  if (hasControlCharacters(raw)) {
    errors[key] = "Remova os caracteres de controle deste campo.";
    return null;
  }
  return raw.trim() || null;
}

function email(raw: unknown, errors: Record<string, string>): string | null {
  const value = optionalText(raw, "email", errors);
  if (value === null) return null;
  const parts = value.split("@");
  const [local = "", domain = ""] = parts;
  if (
    value.length > REGISTRATION_LIMITS.emailCharacters ||
    parts.length !== 2 ||
    local.length === 0 ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[^\s@<>()[\]\\,;:"]+$/u.test(local) ||
    !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/iu.test(
      domain,
    )
  ) {
    errors.email = "Informe um e-mail com formato válido ou deixe vazio.";
    return null;
  }
  return `${local}@${domain.toLowerCase()}`;
}

function phone(raw: unknown, errors: Record<string, string>): string | null {
  const value = optionalText(raw, "phone", errors);
  if (value === null) return null;
  const normalized = value.replace(/[\s().-]/gu, "");
  if (
    value.length > REGISTRATION_LIMITS.phoneCharacters ||
    !/^[+\d\s().-]+$/u.test(value) ||
    !/^\+?\d{8,15}$/u.test(normalized)
  ) {
    errors.phone =
      "Informe de 8 a 15 dígitos, com formatação opcional, ou deixe vazio.";
    return null;
  }
  // Syntax only: no inferred country, verified ownership or contact delivery.
  return normalized;
}

/**
 * Form boundary: `price` is a BR reais string; returned `priceCents` is an
 * integer. Optional contact/stock fields normalize to null. Inputs cannot set
 * id, tenant, commissions or arbitrary fields. Never mutates or persists raw.
 */
export function validateRegistration<K extends EntityKind>(
  kind: K,
  raw: unknown,
): ValidationResult<EntityCreateInput<K>>;
export function validateRegistration(
  kind: EntityKind,
  raw: unknown,
): ValidationResult<EntityCreateMap[EntityKind]> {
  const errors: Record<string, string> = {};
  if (!Object.hasOwn(fields, kind) || typeof raw !== "object" || raw === null)
    return { valid: false, errors: { _form: "Cadastro inválido." } };

  let descriptors: Record<string, PropertyDescriptor>;
  let keys: (string | symbol)[];
  try {
    const prototype = Object.getPrototypeOf(raw);
    if (
      Array.isArray(raw) ||
      (prototype !== Object.prototype && prototype !== null)
    )
      return { valid: false, errors: { _form: "Cadastro inválido." } };
    descriptors = Object.getOwnPropertyDescriptors(raw);
    keys = Reflect.ownKeys(raw);
  } catch {
    // Unknown callers may supply revoked/throwing proxies instead of form data.
    return { valid: false, errors: { _form: "Cadastro inválido." } };
  }
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !fields[kind].includes(key) ||
        descriptors[key]?.get !== undefined ||
        descriptors[key]?.set !== undefined,
    )
  )
    errors._form =
      "O cadastro contém campos não permitidos. Identidade e empresa são definidas pelo servidor.";

  // Reading descriptor values avoids invoking getters supplied as input.
  const get = (key: string): unknown => descriptors[key]?.value;
  const rawName = get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (
    typeof rawName !== "string" ||
    hasControlCharacters(rawName) ||
    name.length === 0 ||
    Array.from(name).length > REGISTRATION_LIMITS.nameCharacters
  )
    errors.name = `Informe um nome de 1 a ${REGISTRATION_LIMITS.nameCharacters} caracteres, sem caracteres de controle.`;

  let value: EntityCreateMap[EntityKind];
  if (kind === "clients" || kind === "professionals") {
    value = {
      name,
      phone: phone(get("phone"), errors),
      email: email(get("email"), errors),
    };
  } else {
    const priceCents = parseBRLCents(get("price"));
    if (priceCents === null)
      errors.price =
        "Informe um valor em reais não negativo, como 1.234,56, com até duas casas decimais e sem exceder o limite seguro.";
    if (kind === "services") {
      const durationMinutes = integer(get("durationMinutes"), 1);
      if (durationMinutes === null)
        errors.durationMinutes =
          "Informe uma duração inteira e positiva em minutos.";
      value = {
        name,
        priceCents: priceCents ?? 0,
        durationMinutes: durationMinutes ?? 0,
      };
    } else {
      const rawStock = get("stockQuantity");
      const absent =
        rawStock === undefined ||
        rawStock === null ||
        (typeof rawStock === "string" && rawStock.trim() === "");
      const stockQuantity = absent ? null : integer(rawStock, 0);
      if (!absent && stockQuantity === null)
        errors.stockQuantity =
          "Informe uma quantidade inteira não negativa ou deixe vazio.";
      value = { name, priceCents: priceCents ?? 0, stockQuantity };
    }
  }
  return Object.keys(errors).length > 0
    ? { valid: false, errors }
    : { valid: true, errors: {}, value };
}
