import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  PARAMETERS_READ_CATALOG,
  PARAMETERS_READ_PROVENANCE,
} from "../src/parameters-read/catalog.ts";
import {
  PARAMETER_PLACEHOLDER_LABEL,
  searchParameters,
  validateParameterCatalog,
  type ParameterReadEntry,
} from "../src/parameters-read/model.ts";

const catalog = PARAMETERS_READ_CATALOG;
const entryAt = (number: number) => {
  const entry = catalog.find((row) => row.sourceNumber === number);
  assert.ok(entry);
  return entry;
};

test("L17 contains exactly 72 distinct labels, 67 selects and five text inputs", () => {
  assert.equal(catalog.length, 72);
  assert.equal(new Set(catalog.map((row) => row.label)).size, 72);
  assert.equal(new Set(catalog.map((row) => row.localId)).size, 72);
  assert.deepEqual(
    catalog.map((row) => row.sourceNumber),
    Array.from({ length: 72 }, (_, index) => index + 1),
  );
  assert.equal(
    catalog.filter((row) => row.observedControl.tag === "select").length,
    67,
  );
  assert.deepEqual(
    catalog
      .filter((row) => row.observedControl.tag === "input")
      .map((row) => [row.sourceNumber, row.observedControl.inputType]),
    [
      [9, "text"],
      [19, "text"],
      [25, "text"],
      [48, "text"],
      [59, "text"],
    ],
  );
  assert.deepEqual(validateParameterCatalog(catalog), {
    valid: true,
    issues: [],
  });
});

test("all exact labels, control types, option strings, order and samples match the source digest", () => {
  // Independently calculated from the UTF-8 source's allowlisted row fields,
  // before catalog generation. No source file or machine-specific path is loaded here.
  const sourceProjectionSha256 =
    "0dea51be0980ebe49ea926d43b7f4cc292077d0c63f9f3017fdcac020ec741c2";
  const projection = catalog.map((row) => ({
    parameterNumberDisplayed: row.sourceNumber,
    label: row.label,
    tag: row.observedControl.tag,
    inputType: row.observedControl.inputType,
    optionsComplete: row.options.completeness === "complete" ? true : null,
    optionsAvailable:
      row.options.completeness === "complete"
        ? row.options.items.map((item) => item.label)
        : null,
    timeOptionSamples:
      row.options.completeness === "sampled"
        ? {
            first: row.options.samples.first.map((item) => item.label),
            last: row.options.samples.last.map((item) => item.label),
            allLabelsTimeOrPlaceholder: true,
          }
        : null,
  }));
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(projection), "utf8")
      .digest("hex"),
    sourceProjectionSha256,
  );
});

test("each row uses its own local identity and a precise documentary reference", () => {
  for (const [index, row] of catalog.entries()) {
    assert.equal(
      row.localId,
      `parameter-read-${String(index + 1).padStart(3, "0")}`,
    );
    assert.notEqual(row.localId, `P${row.sourceNumber}`);
    assert.deepEqual(row.sourceRef, {
      document: "appbarber-parametros-recuperados-2026-10-30.json",
      pointer: `/rows/${index}`,
    });
  }
  assert.deepEqual(PARAMETERS_READ_PROVENANCE, {
    contractRevision: "L17-PARAM-READ-01-v1",
    sourceDocument: "appbarber-parametros-recuperados-2026-10-30.json",
    sourceRevision: "2026-10-30",
    sourceSha256:
      "7950fd3693ba2bbb056d95a0159a69a2c4a7c79ac85b94337235b5be003ebde6",
  });
});

test("35 complete sets preserve 131 alternatives and 35 distinct placeholders", () => {
  const complete = catalog.filter(
    (row) => row.options.completeness === "complete",
  );
  assert.equal(complete.length, 35);
  let choices = 0;
  for (const row of complete) {
    assert.equal(row.options.completeness, "complete");
    if (row.options.completeness !== "complete") continue;
    assert.deepEqual(row.options.items[0], {
      label: PARAMETER_PLACEHOLDER_LABEL,
      kind: "placeholder",
    });
    assert.equal(
      row.options.items.filter((item) => item.kind === "placeholder").length,
      1,
    );
    choices += row.options.items.filter(
      (item) => item.kind === "choice",
    ).length;
    assert.ok(
      row.options.items.every(
        (item) => !("value" in item) && !("selected" in item),
      ),
    );
  }
  assert.equal(choices, 131);
});

test("P54/P61 keep only their ten observed samples, outside complete items", () => {
  const sampled = catalog.filter(
    (row) => row.options.completeness === "sampled",
  );
  assert.deepEqual(
    sampled.map((row) => row.sourceNumber),
    [54, 61],
  );
  for (const row of sampled) {
    assert.equal(row.options.completeness, "sampled");
    if (row.options.completeness !== "sampled") continue;
    assert.equal("items" in row.options, false);
    assert.deepEqual(
      row.options.samples.first.map((item) => item.label),
      ["Selecione uma Opção", "0:05", "0:10", "0:15", "0:20"],
    );
    assert.deepEqual(
      row.options.samples.last.map((item) => item.label),
      ["23:35", "23:40", "23:45", "23:50", "23:55"],
    );
    assert.equal(row.options.samples.first[0].kind, "placeholder");
    assert.deepEqual(row.unit, { status: "unknown" });
  }
});

test("unrecovered selects and non-enumerated inputs remain distinct unknowns", () => {
  const missing = catalog.filter(
    (row) => row.options.completeness === "not-recovered",
  );
  const inputs = catalog.filter(
    (row) => row.options.completeness === "not-applicable",
  );
  assert.equal(missing.length, 30);
  assert.equal(inputs.length, 5);
  for (const row of [...missing, ...inputs]) {
    assert.deepEqual(Object.keys(row.options), ["completeness"]);
  }
  assert.equal(entryAt(49).options.completeness, "not-recovered");
});

test("units come from text and preserve mixed duration units without conversion", () => {
  const declared = catalog.filter((row) => row.unit.status === "declared");
  assert.deepEqual(
    declared.map((row) => row.sourceNumber),
    [1, 2, 3, 5, 9, 19, 25, 58],
  );
  assert.deepEqual(entryAt(2).unit, {
    status: "declared",
    kinds: ["minutes", "hours"],
    label: "minutos e horas",
  });
  assert.deepEqual(entryAt(5).unit, {
    status: "declared",
    kinds: ["minutes", "hours", "days"],
    label: "minutos, horas e dias",
  });
  assert.deepEqual(entryAt(3).unit, {
    status: "declared",
    kinds: ["minutes"],
    label: "minutos",
  });
  assert.deepEqual(entryAt(58).unit, {
    status: "declared",
    kinds: ["pixels"],
    label: "pixels",
  });
  for (const number of [48, 59, 68, 72])
    assert.deepEqual(entryAt(number).unit, { status: "unknown" });
});

test("P3 minutes and P58 pixels keep their exact textual alternatives", () => {
  const labels = (number: number) => {
    const options = entryAt(number).options;
    assert.equal(options.completeness, "complete");
    return options.completeness === "complete"
      ? options.items
          .filter((item) => item.kind === "choice")
          .map((item) => item.label)
      : [];
  };
  assert.deepEqual(labels(3), [
    "10 minutos",
    "15 minutos",
    "20 minutos",
    "30 minutos",
    "40 minutos",
    "45 minutos",
    "60 minutos",
  ]);
  assert.deepEqual(labels(58), [
    "20px",
    "30px",
    "40px",
    "50px",
    "60px",
    "70px",
    "80px",
    "90px",
    "100px",
  ]);
});

test("catalog metadata has no effective settings, optionality, effects or capture context", () => {
  const allowed = [
    "label",
    "localId",
    "observedControl",
    "options",
    "sourceNumber",
    "sourceRef",
    "unit",
  ];
  for (const row of catalog) assert.deepEqual(Object.keys(row).sort(), allowed);
  const serialized = JSON.stringify({
    catalog,
    provenance: PARAMETERS_READ_PROVENANCE,
  });
  for (const field of [
    "currentValue",
    "defaultValue",
    "requiredHTML",
    "declaredLimits",
    "tabId",
    "browser",
    "origin",
    "safeRoute",
    "selected",
    "optionCount",
  ])
    assert.equal(serialized.includes(`"${field}":`), false, field);
});

test("literal label search supports accents, case, clearing and confirmed no matches", () => {
  assert.deepEqual(
    searchParameters(catalog, "  FUSO HORARIO  ").map(
      (row) => row.sourceNumber,
    ),
    [49],
  );
  assert.deepEqual(
    searchParameters(catalog, "comissões").map((row) => row.sourceNumber),
    [15, 57],
  );
  assert.equal(searchParameters(catalog, "").length, 72);
  assert.equal(searchParameters(catalog, " \n ").length, 72);
  assert.deepEqual(searchParameters(catalog, "parâmetro ausente xyz"), []);
  assert.deepEqual(searchParameters(catalog, ".*"), []);
  assert.deepEqual(searchParameters(catalog, "20px"), []); // Labels only, no option-value search.
});

test("search treats markup as inert text and preserves the input metadata", () => {
  const synthetic: ParameterReadEntry = {
    ...entryAt(1),
    label: '<img src=x onerror="alert(1)">',
  };
  const input = [synthetic];
  const before = structuredClone(input);
  assert.deepEqual(searchParameters(input, "onerror"), input);
  assert.equal(validateParameterCatalog(input).valid, true);
  assert.deepEqual(input, before);
  assert.notEqual(searchParameters(input, ""), input);
});

test("search and validation do not mutate rows or frozen catalog metadata", () => {
  const before = JSON.stringify(catalog);
  searchParameters(catalog, "agenda");
  validateParameterCatalog(catalog);
  assert.equal(JSON.stringify(catalog), before);
  const frozenTree = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true);
    Object.values(value).forEach(frozenTree);
  };
  frozenTree(catalog);
  assert.throws(() => {
    (entryAt(3) as { label: string }).label = "changed";
  }, TypeError);
  assert.equal(Object.isFrozen(PARAMETERS_READ_PROVENANCE), true);
});

test("validation rejects duplicate references and unsupported operational fields", () => {
  assert.equal(validateParameterCatalog([entryAt(1), entryAt(1)]).valid, false);
  assert.equal(
    validateParameterCatalog([{ ...entryAt(1), localId: "P1" }]).valid,
    false,
  );
  assert.equal(
    validateParameterCatalog([
      { ...entryAt(1), sourceRef: { document: "source", pointer: "/rows/9" } },
    ]).valid,
    false,
  );
  for (const field of [
    "currentValue",
    "defaultValue",
    "required",
    "effect",
    "save",
    "backendId",
  ])
    assert.equal(
      validateParameterCatalog([{ ...entryAt(1), [field]: false }]).valid,
      false,
      field,
    );
  assert.equal(
    validateParameterCatalog([
      {
        ...entryAt(1),
        sourceRef: { ...entryAt(1).sourceRef, tabId: "private" },
      },
    ]).valid,
    false,
  );
});

test("validation rejects promoted samples, placeholder choices and fabricated control units", () => {
  const sampled = entryAt(54);
  assert.equal(
    validateParameterCatalog([
      { ...sampled, options: { ...sampled.options, items: [] } },
    ]).valid,
    false,
  );
  assert.equal(
    validateParameterCatalog([
      {
        ...entryAt(3),
        options: {
          completeness: "complete",
          items: [{ label: PARAMETER_PLACEHOLDER_LABEL, kind: "choice" }],
        },
      },
    ]).valid,
    false,
  );
  assert.equal(
    validateParameterCatalog([
      { ...entryAt(9), options: { completeness: "not-recovered" } },
    ]).valid,
    false,
  );
  assert.equal(
    validateParameterCatalog([
      {
        ...entryAt(58),
        unit: { status: "declared", kinds: ["capacity"], label: "capacidade" },
      },
    ]).valid,
    false,
  );
  assert.equal(
    validateParameterCatalog([
      { ...entryAt(1), observedControl: { tag: "button", inputType: null } },
    ]).valid,
    false,
  );
});

test("malformed catalog input is reported separately from an empty search result", () => {
  for (const value of [
    null,
    undefined,
    "bad",
    {},
    [null],
    [{ label: "incomplete" }],
  ])
    assert.equal(validateParameterCatalog(value).valid, false);
  assert.deepEqual(validateParameterCatalog([]), { valid: true, issues: [] });
  assert.deepEqual(searchParameters(catalog, "no-match-xyz"), []);
});

test("metadata modules contain no transport, persistence, DOM or effect execution", () => {
  for (const path of [
    "../src/parameters-read/model.ts",
    "../src/parameters-read/catalog.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|globalThis|window|eval)\b/,
    );
    assert.doesNotMatch(source, /from\s+["'](?!\.\/model\.ts["'])/);
    assert.doesNotMatch(
      source,
      /\b(innerHTML|outerHTML|insertAdjacentHTML|createElement)\b/,
    );
  }
});
