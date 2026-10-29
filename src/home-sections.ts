import type { ClubPlan, HomeContent, Verified } from "./home-content.ts";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function isVerified<T>(item: Verified<T>, today: string): boolean {
  return (
    Boolean(item.evidence.source.trim()) &&
    isDate(item.evidence.checkedOn) &&
    item.evidence.checkedOn <= today
  );
}

export function safePublicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function localImage(value: string): boolean {
  return /^\/brand\/[a-zA-Z0-9._-]+\.(?:png|webp|jpg|jpeg)$/u.test(value);
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function activePlans(
  content: HomeContent,
  today: string,
): readonly ClubPlan[] {
  const seen = new Set<string>();
  return content.plans
    .filter((item) => {
      const plan = item.value;
      const valid =
        isVerified(item, today) &&
        Boolean(plan.id.trim()) &&
        !seen.has(plan.id) &&
        Boolean(plan.name.trim()) &&
        Number.isSafeInteger(plan.priceCents) &&
        plan.priceCents > 0 &&
        (plan.cadence === "month" || plan.cadence === "year") &&
        isDate(plan.validFrom) &&
        isDate(plan.validThrough) &&
        plan.validFrom <= today &&
        plan.validThrough >= today &&
        plan.validFrom <= plan.validThrough &&
        plan.features.length > 0 &&
        plan.features.every((feature) => feature.trim()) &&
        Boolean(plan.terms.trim());
      if (valid) seen.add(plan.id);
      return valid;
    })
    .map((item) => item.value);
}

export function renderLogo(content: HomeContent, today: string): string {
  const item = content.logo;
  if (!item || !isVerified(item, today) || !localImage(item.value.src))
    return "";
  const logo = item.value;
  if (
    !logo.alt.trim() ||
    !Number.isSafeInteger(logo.width) ||
    !Number.isSafeInteger(logo.height) ||
    logo.width <= 0 ||
    logo.height <= 0
  )
    return "";
  return `<div class="fc-home__logo-stage"><div class="fc-home__logo-depth"><img class="fc-home__official-logo" src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.alt)}" width="${logo.width}" height="${logo.height}" fetchpriority="high" decoding="async"></div></div>`;
}

export function renderPlans(content: HomeContent, today: string): string {
  const plans = activePlans(content, today);
  if (!plans.length) return "";
  return `<section id="planos" class="fc-home__plans" aria-labelledby="fc-home-plans-title">
    <div class="fc-home__section-heading fc-home__plans-heading">
      <div><p class="fc-home__eyebrow">PLANOS DO CLUBE</p><h2 id="fc-home-plans-title">Seu cuidado.<br><em>No seu ritmo.</em></h2></div>
      <p>Compare os valores e o que está incluído em cada plano.</p>
    </div>
    <div class="fc-home__plan-grid">${plans
      .map(
        (plan, index) => `<article class="fc-home__plan">
      <div class="fc-home__plan-top"><span class="fc-home__plan-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(plan.name)}</h3></div>
      <p class="fc-home__price"><strong>${money.format(plan.priceCents / 100)}</strong><span>por ${plan.cadence === "month" ? "mês" : "ano"}</span></p>
      <ul>${plan.features.map((feature) => `<li><span aria-hidden="true">✓</span>${escapeHtml(feature)}</li>`).join("")}</ul>
      <p class="fc-home__plan-terms">${escapeHtml(plan.terms)}</p>
    </article>`,
      )
      .join("")}</div>
  </section>`;
}

export function renderVisit(content: HomeContent, today: string): string {
  const location = content.location;
  if (
    !location ||
    !isVerified(location, today) ||
    !location.value.lines.length ||
    !location.value.lines.every((line) => line.trim())
  )
    return "";
  const mapUrl = location.value.mapUrl && safePublicUrl(location.value.mapUrl);
  return `<section id="encontre" class="fc-home__visit" aria-labelledby="fc-home-visit-title">
    <div><p class="fc-home__eyebrow">ONDE ESTAMOS</p><h2 id="fc-home-visit-title">Seu próximo<br><em>ponto de encontro.</em></h2></div>
    <div class="fc-home__visit-detail"><address>${location.value.lines.map(escapeHtml).join("<br>")}</address>${mapUrl ? `<a class="fc-home__text-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Ver no mapa <span aria-hidden="true">↗</span><span class="fc-home__sr-only"> (abre em nova aba)</span></a>` : ""}</div>
  </section>`;
}

export function renderSocials(content: HomeContent, today: string): string {
  const links = content.socials.flatMap((item) => {
    const href = safePublicUrl(item.value.href);
    if (!isVerified(item, today) || !href || !item.value.label.trim())
      return [];
    return [
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.value.label)} <span aria-hidden="true">↗</span><span class="fc-home__sr-only"> (abre em nova aba)</span></a>`,
    ];
  });
  return links.length
    ? `<nav class="fc-home__socials" aria-label="Redes sociais">${links.join("")}</nav>`
    : "";
}
