import { test } from "node:test";
import assert from "node:assert/strict";
import { homeContent } from "../src/home-content.ts";
import type { ClubPlan, HomeContent, Verified } from "../src/home-content.ts";
import {
  activePlans,
  renderLogo,
  renderPlans,
  renderSocials,
  renderVisit,
  safePublicUrl,
} from "../src/home-sections.ts";

const today = "2026-10-29";
const empty: HomeContent = {
  logo: null,
  location: null,
  socials: [],
  plans: [],
};
function verified<T>(value: T): Verified<T> {
  return {
    value,
    evidence: { source: "Synthetic test fixture only", checkedOn: today },
  };
}
const fixture: ClubPlan = {
  id: "synthetic",
  name: "Plano de teste",
  priceCents: 12345,
  cadence: "month",
  features: ["Serviço sintético"],
  terms: "Somente teste; não é uma oferta.",
  validFrom: today,
  validThrough: "2026-11-29",
};

test("missing evidence never produces logo, price, address or social placeholders", () => {
  assert.equal(renderLogo(empty, today), "");
  assert.equal(renderPlans(empty, today), "");
  assert.equal(renderVisit(empty, today), "");
  assert.equal(renderSocials(empty, today), "");
  assert.equal(renderPlans(homeContent, today), "");
});

test("only current and complete verified plans render; duplicates are omitted", () => {
  const invalid = [
    { ...fixture, priceCents: -1 },
    { ...fixture, priceCents: Number.NaN },
    { ...fixture, priceCents: 12.1 },
    { ...fixture, validThrough: "2026-10-28" },
    { ...fixture, validFrom: "2026-10-30" },
    { ...fixture, validFrom: "2026-02-30" },
    { ...fixture, features: [] },
    { ...fixture, features: [""] },
    { ...fixture, terms: "" },
  ];
  for (const plan of invalid)
    assert.deepEqual(
      activePlans({ ...empty, plans: [verified(plan)] }, today),
      [],
    );
  assert.deepEqual(
    activePlans(
      { ...empty, plans: [verified(fixture), verified(fixture)] },
      today,
    ),
    [fixture],
  );
  for (const evidence of [
    { source: "", checkedOn: today },
    { source: "source", checkedOn: "2026-12-01" },
  ]) {
    assert.equal(
      renderPlans({ ...empty, plans: [{ value: fixture, evidence }] }, today),
      "",
    );
  }
});

test("plan rendering uses BRL plus billing cadence, features and terms without invented claims", () => {
  const html = renderPlans({ ...empty, plans: [verified(fixture)] }, today);
  assert.match(html, /R\$\s*123,45/u);
  assert.match(html, /por mês/u);
  assert.match(html, /Somente teste; não é uma oferta\./u);
  assert.doesNotMatch(html, /mais popular|ilimitado|economize|assinar/iu);
});

test("source text is escaped and destinations reject active or credential-bearing URLs", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const html = renderPlans(
    {
      ...empty,
      plans: [
        verified({
          ...fixture,
          name: attack,
          features: [attack],
          terms: attack,
        }),
      ],
    },
    today,
  );
  assert.doesNotMatch(html, /<img/u);
  assert.match(html, /&lt;img/u);
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "https://user:pass@example.com",
    "//example.com",
  ]) {
    assert.equal(safePublicUrl(href), null);
    assert.equal(
      renderSocials(
        { ...empty, socials: [verified({ label: "Test", href })] },
        today,
      ),
      "",
    );
  }
  assert.match(
    renderSocials(
      {
        ...empty,
        socials: [verified({ label: attack, href: "https://example.com" })],
      },
      today,
    ),
    /noopener noreferrer/u,
  );
});

test("official logo uses a complete local image with original aspect ratio and no crop", () => {
  const logo = {
    src: "/brand/official.png",
    alt: "Marca & original",
    width: 600,
    height: 400,
  };
  const html = renderLogo({ ...empty, logo: verified(logo) }, today);
  assert.match(html, /width="600" height="400"/u);
  assert.match(html, /Marca &amp; original/u);
  for (const src of [
    "https://example.com/image.png",
    "/brand/../secret.png",
    "/brand/fake.svg",
  ])
    assert.equal(
      renderLogo({ ...empty, logo: verified({ ...logo, src }) }, today),
      "",
    );
});

test("location renders only approved lines and an independently safe map destination", () => {
  const html = renderVisit(
    {
      ...empty,
      location: verified({
        lines: ["Rua de teste", "<script>"],
        mapUrl: "javascript:alert(1)",
      }),
    },
    today,
  );
  assert.match(html, /Rua de teste<br>&lt;script&gt;/u);
  assert.doesNotMatch(html, /href=|<script>/u);
});
