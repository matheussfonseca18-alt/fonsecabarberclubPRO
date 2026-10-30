import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderLegacyHome } from "../src/legacy-home-view.ts";
import {
  homeContent,
  type HomeContent,
  type Verified,
} from "../src/home-content.ts";

const today = "2026-10-30";
const empty: HomeContent = {
  logo: null,
  location: null,
  plans: [],
  socials: [],
};
const verified = <T>(value: T): Verified<T> => ({
  value,
  evidence: { source: "Synthetic test only", checkedOn: today },
});

test("legacy composition uses the current routes and keeps unavailable areas honest", () => {
  const html = renderLegacyHome(homeContent, today);
  for (const href of [
    "/inicio",
    "/agendar",
    "/barbeiro",
    "/?mode=real#Dashboard",
    "/whatsapp",
    "/auth/login",
  ])
    assert.ok(html.includes(`href="${href}"`));
  assert.ok(html.includes("Eleve o seu"));
  assert.ok(
    html.includes("Consultas reais e gravações ainda não estão liberadas"),
  );
  assert.ok(html.includes("Não conectado"));
  assert.doesNotMatch(html, /\/app\/|wa\.me|api\/content|Assinar Agora/);
});

test("unverified legacy business claims and media do not become current presentation", () => {
  const html = renderLegacyHome(homeContent, today);
  assert.doesNotMatch(
    html,
    /100\+|100%|Top 1|5\.0|Satisfação Garantida|Mais Escolhido|74,90|154,90|134,90|Caiena|9h|20h|559499|Carlos Eduardo|Rafael Mendes|Bruno Alves|Melhor Barbearia|Resposta rápida/i,
  );
  assert.doesNotMatch(
    html,
    /<video\b|<iframe\b|<img\b|supabase\.co|facebook\.com|fonsecabarbearia\.pbs/,
  );
  assert.ok(html.includes("https://www.instagram.com/fonsecabarberclub/"));
});

test("absent verified plans, photos and location have no fake section or dead anchor", () => {
  const html = renderLegacyHome(empty, today);
  assert.doesNotMatch(
    html,
    /id="(?:planos|galeria|encontre)"|href="(?:#planos|\/inicio#galeria|#encontre)"/,
  );
  assert.ok(html.includes('href="#clube"'));
  assert.doesNotMatch(html, /Em breve|R\$|<address/);
});

test("verified content retains amounts, conditions, original logo path and safe links", () => {
  const html = renderLegacyHome(
    {
      ...empty,
      logo: verified({
        src: "/brand/synthetic-original.png",
        alt: "Logo sintética de teste",
        width: 1200,
        height: 500,
      }),
      location: verified({
        lines: ["Endereço sintético"],
        mapUrl: "https://example.com/test-map",
      }),
      plans: [
        verified({
          id: "test",
          name: "Plano sintético",
          priceCents: 12345,
          cadence: "month",
          features: ["Item de teste"],
          terms: "Não é uma oferta",
          validFrom: today,
          validThrough: "2026-12-31",
        }),
      ],
    },
    today,
  );
  assert.match(html, /R\$\s*123,45/);
  assert.ok(html.includes("por mês"));
  assert.ok(html.includes("Não é uma oferta"));
  assert.ok(html.includes('src="/brand/synthetic-original.png"'));
  assert.ok(html.includes('width="1200" height="500"'));
  assert.ok(html.includes('href="https://example.com/test-map"'));
  assert.doesNotMatch(
    html,
    /Mais Escolhido|economia|ilimitado|brightness|contrast/,
  );
});

test("expired plans stay absent and an external logo is never silently adopted", () => {
  const html = renderLegacyHome(
    {
      ...empty,
      logo: verified({
        src: "https://example.com/unverified-logo.png",
        alt: "Logo",
        width: 100,
        height: 100,
      }),
      plans: [
        verified({
          id: "expired",
          name: "Expired",
          priceCents: 100,
          cadence: "month",
          features: ["Test"],
          terms: "Test",
          validFrom: "2026-01-01",
          validThrough: "2026-10-29",
        }),
      ],
    },
    today,
  );
  assert.doesNotMatch(html, /<img|id="planos"|Expired/);
  assert.ok(html.includes('class="fc-home__identity-text"'));
});

test("verified gallery is conditional and its new anchor uses explicit /inicio", () => {
  const html = renderLegacyHome(empty, today, [
    verified({
      src: "/brand/test-photo.webp",
      alt: "Foto sintética",
      width: 600,
      height: 600,
    }),
  ]);
  assert.ok(html.includes('id="galeria"'));
  assert.ok(html.includes('href="/inicio#galeria"'));
  assert.ok(!html.includes('href="#galeria"'));
});

test("brand configuration remains immutable through rendering", () => {
  const before = structuredClone(homeContent);
  renderLegacyHome(homeContent, today);
  assert.deepEqual(homeContent, before);
});

test("content strings remain escaped and contact anchor stays unique", () => {
  const html = renderLegacyHome(
    {
      ...empty,
      location: verified({ lines: ['<img src=x onerror="attack">'] }),
      socials: [
        verified({
          label: '<script>alert("x")</script>',
          href: "https://example.com/",
        }),
      ],
    },
    today,
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.doesNotMatch(html, /<script\b|<img\b/);
  assert.equal((html.match(/id="encontre"/g) ?? []).length, 1);
});

test("drawer has named native dialog, explicit controls and no hidden admin trigger", () => {
  const html = renderLegacyHome(homeContent, today);
  assert.ok(html.includes('<dialog id="fc-home-menu"'));
  assert.ok(html.includes('aria-labelledby="fc-home-menu-title"'));
  assert.ok(
    html.includes('aria-controls="fc-home-menu" aria-expanded="false"'),
  );
  assert.ok(html.includes('aria-label="Fechar menu"'));
  assert.doesNotMatch(
    html,
    /onclick=|AdminPanel|Atualizar Dados|dangerouslySetInnerHTML/,
  );
});

test("the home bundle imports no backend, auth, admin or legacy dependencies", () => {
  const paths = [
    "landing.ts",
    "legacy-home-view.ts",
    "legacy-home-interactions.ts",
    "home-gallery.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(
      new URL(`../src/${path}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /from ["'](?:react|motion|lucide|@supabase)|fetch\(|localStorage|sessionStorage|dangerouslySetInnerHTML|createClient|import\s.*(?:auth\/|real-app|demo-app|whatsapp-page|booking-page)/,
    );
  }
  const css = readFileSync(
    new URL("../src/legacy-home.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    css,
    /@import|https?:\/\/|brightness\(|contrast\(|infinite/,
  );
  assert.ok(css.includes("prefers-reduced-motion"));
});
