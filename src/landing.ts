import "./landing.css";
import "./home-enhancement.css";
import { homeContent } from "./home-content";
import {
  renderLogo,
  renderPlans,
  renderSocials,
  renderVisit,
} from "./home-sections";

// This page is presentation only. Links leave it through a full document
// navigation; no auth, data, booking, storage or agenda code is loaded here.
export function startLanding() {
  document.title = "Fonseca Barber Club — Seu estilo. Sua assinatura.";
  document.body.classList.add("fc-home-document");

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Landing root unavailable");

  const today = new Date().toISOString().slice(0, 10);
  const officialLogo = renderLogo(homeContent, today);
  const plans = renderPlans(homeContent, today);
  const visit = renderVisit(homeContent, today);

  root.innerHTML = `
    <div class="fc-home" id="inicio">
      <a class="fc-home__skip" href="#conteudo">Pular para o conteúdo</a>

      <header class="fc-home__header">
        <a class="fc-home__brand" href="/inicio" aria-label="Fonseca Barber Club — início">
          <span>FONSECA</span>
          <span class="fc-home__brand-sub">BARBER CLUB</span>
        </a>
        <nav class="fc-home__nav" aria-label="Navegação da página inicial">
          <a href="#clube">O clube</a>
          ${plans ? '<a href="#planos">Planos</a>' : ""}
          ${visit ? '<a href="#encontre">Onde estamos</a>' : ""}
          <a href="#experiencia">A experiência</a>
        </nav>
        <a class="fc-home__team-link" href="#equipe">
          Área da equipe <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="conteudo" class="fc-home__main" tabindex="-1">
        <section class="fc-home__hero" aria-labelledby="fc-home-title">
          <div class="fc-home__hero-copy">
            <p class="fc-home__eyebrow"><span aria-hidden="true"></span> A ESSÊNCIA FONSECA</p>
            <h1 id="fc-home-title">Seu estilo.<br><em>Sua assinatura.</em></h1>
            <p class="fc-home__intro">Mais que um visual, uma forma de se expressar.
              O encontro entre o clássico e a sua personalidade.</p>
            <div class="fc-home__hero-actions">
              <a class="fc-home__button fc-home__button--gold" href="#clube">
                Conheça o clube <span aria-hidden="true">↓</span>
              </a>
              <a class="fc-home__text-link" href="#experiencia">Explore a experiência <span aria-hidden="true">↗</span></a>
            </div>
            <div class="fc-home__hero-note" aria-hidden="true">
              <span class="fc-home__note-line"></span>
              <span>PERSONALIDADE EM CADA DETALHE</span>
            </div>
          </div>

          ${
            officialLogo ||
            `<div class="fc-home__art" aria-hidden="true">
            <div class="fc-home__art-top"><span>FONSECA</span><span>BARBER CLUB</span></div>
            <div class="fc-home__arch fc-home__arch--outer"></div>
            <div class="fc-home__arch fc-home__arch--inner"></div>
            <div class="fc-home__art-light"></div>
            <div class="fc-home__art-copy"><span>A arte</span><span>de ser</span><em>você.</em></div>
            <span class="fc-home__art-side">O SEU MOMENTO</span>
            <div class="fc-home__art-bottom"><span>CLÁSSICO NA ESSÊNCIA.</span><span>SEU NA EXPRESSÃO.</span></div>
          </div>`
          }
        </section>

        <section id="clube" class="fc-home__club" aria-labelledby="fc-home-club-title">
          <p class="fc-home__eyebrow">O CLUBE</p>
          <div class="fc-home__club-content">
            <h2 id="fc-home-club-title">O essencial,<br>com <em>personalidade.</em></h2>
            <p>Tem algo que nunca sai de moda: sentir-se bem com quem você é.
              Essa é a ideia que inspira o Fonseca Barber Club. Cuidado, estilo e
              espaço para ser você.</p>
          </div>
        </section>

        <section id="experiencia" class="fc-home__experience" aria-labelledby="fc-home-experience-title">
          <div class="fc-home__section-heading">
            <p class="fc-home__eyebrow">A EXPERIÊNCIA</p>
            <h2 id="fc-home-experience-title">Tudo começa nos detalhes.</h2>
          </div>
          <div class="fc-home__cards">
            <article class="fc-home__card">
              <span class="fc-home__card-number" aria-hidden="true">01 /</span>
              <div class="fc-home__card-detail fc-home__card-detail--identity" aria-hidden="true"><span></span><span></span></div>
              <h3>Seu estilo,<br>em primeiro lugar.</h3>
              <p>O clássico como inspiração. A sua personalidade como ponto de partida.</p>
              <span class="fc-home__card-label">IDENTIDADE</span>
            </article>
            <article class="fc-home__card">
              <span class="fc-home__card-number" aria-hidden="true">02 /</span>
              <div class="fc-home__card-detail fc-home__card-detail--care" aria-hidden="true"><span></span><span></span></div>
              <h3>O detalhe faz<br>a diferença.</h3>
              <p>Uma forma de olhar para o cuidado que valoriza cada escolha.</p>
              <span class="fc-home__card-label">CUIDADO</span>
            </article>
            <article class="fc-home__card">
              <span class="fc-home__card-number" aria-hidden="true">03 /</span>
              <div class="fc-home__card-detail fc-home__card-detail--time" aria-hidden="true"><span></span><span></span></div>
              <h3>Um tempo<br>para você.</h3>
              <p>Uma pausa na rotina. Um convite para cuidar da sua própria expressão.</p>
              <span class="fc-home__card-label">PRESENÇA</span>
            </article>
          </div>
        </section>

        ${plans}

        <section class="fc-home__booking" aria-labelledby="fc-home-booking-title">
          <div><p class="fc-home__eyebrow">SEU PRÓXIMO MOMENTO</p><h2 id="fc-home-booking-title">Seu estilo começa<br><em>com uma escolha.</em></h2></div>
          <a class="fc-home__button fc-home__button--gold" href="/agendar">Agendar meu horário <span aria-hidden="true">↗</span></a>
        </section>

        ${visit}

        <section id="equipe" class="fc-home__team" aria-labelledby="fc-home-team-title">
          <div>
            <p class="fc-home__eyebrow">ÁREA INTERNA</p>
            <h2 id="fc-home-team-title">Faz parte da equipe?</h2>
            <p>Conheça as áreas do sistema. Consultas reais e gravações ainda não estão liberadas.</p>
          </div>
          <nav class="fc-home__team-actions" aria-label="Áreas do sistema">
            <a class="fc-home__button fc-home__button--outline" href="/barbeiro">Área do barbeiro <span aria-hidden="true">↗</span></a>
            <a class="fc-home__button fc-home__button--outline" href="/?mode=real#Dashboard">Abrir gestão <span aria-hidden="true">↗</span></a>
            <a class="fc-home__text-link" href="/auth/login">Entrar com minha conta <span aria-hidden="true">↗</span></a>
          </nav>
        </section>
      </main>

      <footer class="fc-home__footer">
        <a class="fc-home__brand fc-home__brand--footer" href="/inicio" aria-label="Fonseca Barber Club — início">
          <span>FONSECA</span><span class="fc-home__brand-sub">BARBER CLUB</span>
        </a>
        <div class="fc-home__footer-connect"><p>Estilo é pessoal.</p>${renderSocials(homeContent, today)}</div>
        <a class="fc-home__back-top" href="#inicio">Voltar ao início <span aria-hidden="true">↑</span></a>
      </footer>
    </div>
  `;
}
