import type { HomeContent, Verified } from "./home-content.ts";
import {
  renderLogo,
  renderPlans,
  renderSocials,
  renderVisit,
} from "./home-sections.ts";
import { renderHomeGallery, type HomeGalleryPhoto } from "./home-gallery.ts";

/** Legacy composition with current verified content and current destinations. */
export function renderLegacyHome(
  content: HomeContent,
  today: string,
  gallery: readonly Verified<HomeGalleryPhoto>[] = [],
): string {
  const logo = renderLogo(content, today);
  const plans = renderPlans(content, today);
  const photos = renderHomeGallery(gallery, today);
  const visit = renderVisit(content, today);
  const socials = renderSocials(content, today);
  // Ordinary identifying text; never a reconstructed wordmark or substitute logo.
  const identity =
    logo || '<span class="fc-home__identity-text">Fonseca Barber Club</span>';
  const navigation = `<a href="#clube">O clube</a><a href="#experiencia">Diferenciais</a>${plans ? '<a href="#planos">Planos</a>' : ""}${photos ? '<a href="/inicio#galeria">Galeria</a>' : ""}${visit || socials ? '<a href="#encontre">Contato</a>' : ""}<a href="#equipe">Área da equipe</a>`;
  return `<div class="fc-home" id="inicio">
    <a class="fc-home__skip" href="#conteudo">Pular para o conteúdo</a>
    <header class="fc-home__header"><div class="fc-home__header-inner">
      <a class="fc-home__brand" href="/inicio" aria-label="Fonseca Barber Club — início">${identity}</a>
      <nav class="fc-home__nav" aria-label="Navegação da página inicial">${navigation}</nav>
      <div class="fc-home__header-actions"><a class="fc-home__button fc-home__button--small" href="/agendar">Agendar</a><button class="fc-home__menu-toggle" type="button" aria-label="Abrir menu" aria-controls="fc-home-menu" aria-expanded="false" data-home-open-menu><span aria-hidden="true">☰</span></button></div>
    </div></header>
    <dialog id="fc-home-menu" class="fc-home__menu" aria-labelledby="fc-home-menu-title"><div class="fc-home__menu-top"><h2 id="fc-home-menu-title">Navegue pela Fonseca</h2><button class="fc-home__menu-close" type="button" aria-label="Fechar menu" data-home-close-menu>×</button></div><nav aria-label="Navegação no celular">${navigation}</nav><a class="fc-home__button" href="/agendar">Agendar meu horário <span aria-hidden="true">↗</span></a></dialog>
    <main class="fc-home__main" id="conteudo" tabindex="-1">
      <section class="fc-home__hero" aria-labelledby="fc-home-title"><div class="fc-home__hero-atmosphere" aria-hidden="true"></div><div class="fc-home__hero-copy"><p class="fc-home__hero-label"><span aria-hidden="true"></span> FONSECA BARBER CLUB</p><h1 id="fc-home-title">Eleve o seu<br><em>padrão.</em></h1><p class="fc-home__intro">Mais que um visual, uma forma de se expressar.<br class="fc-home__desktop-break"> O clássico encontra a sua personalidade.</p><div class="fc-home__hero-actions"><a class="fc-home__button" href="/agendar">Agendar meu horário <span aria-hidden="true">↗</span></a><a class="fc-home__button fc-home__button--outline" href="${plans ? "#planos" : "#clube"}">${plans ? "Conhecer os planos" : "Conheça o clube"} <span aria-hidden="true">↓</span></a></div></div><a class="fc-home__scroll-cue" href="#clube"><span>DESCUBRA A FONSECA</span><span aria-hidden="true">↓</span></a></section>
      <section class="fc-home__club" id="clube" aria-labelledby="fc-home-club-title" tabindex="-1"><div class="fc-home__container fc-home__club-inner"><p class="fc-home__eyebrow">O CLUBE</p><h2 id="fc-home-club-title">O essencial, com<br><em>personalidade.</em></h2><p>Tem algo que nunca sai de moda: sentir-se bem com quem você é. Essa é a ideia que inspira a Fonseca. Cuidado, estilo e espaço para ser você.</p></div></section>
      <section class="fc-home__experience fc-home__container" id="experiencia" aria-labelledby="fc-home-experience-title" tabindex="-1"><div class="fc-home__section-heading"><p class="fc-home__eyebrow">DIFERENCIAIS</p><h2 id="fc-home-experience-title">Tudo começa<br>nos <em>detalhes.</em></h2></div><div class="fc-home__cards">
        <article class="fc-home__card"><span class="fc-home__card-number" aria-hidden="true">01</span><p class="fc-home__card-label">IDENTIDADE</p><h3>Seu estilo,<br>em primeiro lugar.</h3><p>O clássico como inspiração. A sua personalidade como ponto de partida.</p></article>
        <article class="fc-home__card"><span class="fc-home__card-number" aria-hidden="true">02</span><p class="fc-home__card-label">CUIDADO</p><h3>O detalhe faz<br>a diferença.</h3><p>Uma forma de olhar para o cuidado que valoriza cada escolha.</p></article>
        <article class="fc-home__card"><span class="fc-home__card-number" aria-hidden="true">03</span><p class="fc-home__card-label">PRESENÇA</p><h3>Um tempo<br>para você.</h3><p>Uma pausa na rotina. Um convite para cuidar da sua própria expressão.</p></article>
      </div></section>
      ${plans ? `<div class="fc-home__band"><div class="fc-home__container">${plans}</div></div>` : ""}
      ${photos ? `<div class="fc-home__container">${photos}</div>` : ""}
      <section class="fc-home__booking" aria-labelledby="fc-home-booking-title"><div class="fc-home__container"><p class="fc-home__eyebrow">SEU PRÓXIMO MOMENTO</p><h2 id="fc-home-booking-title">Pronto para renovar<br>o seu <em>visual?</em></h2><p>Seu estilo começa com uma escolha.</p><a class="fc-home__button" href="/agendar">Agendar meu horário <span aria-hidden="true">↗</span></a></div></section>
      ${visit ? `<div class="fc-home__container">${visit}</div>` : ""}
      ${socials ? `<section ${visit ? "" : 'id="encontre"'} class="fc-home__contact fc-home__container" aria-labelledby="fc-home-contact-title" tabindex="-1"><div><p class="fc-home__eyebrow">CONTINUE POR AQUI</p><h2 id="fc-home-contact-title">A Fonseca,<br><em>mais perto.</em></h2><p>Acompanhe nossos canais.</p></div>${socials}</section>` : ""}
      <section class="fc-home__team fc-home__container" id="equipe" aria-labelledby="fc-home-team-title" tabindex="-1"><div><p class="fc-home__eyebrow">ÁREAS DO SISTEMA</p><h2 id="fc-home-team-title">Seu espaço<br>na <em>Fonseca.</em></h2><p>Conheça as áreas da equipe. Consultas reais e gravações ainda não estão liberadas.</p></div><nav class="fc-home__team-actions" aria-label="Áreas do sistema"><a href="/barbeiro"><span>Área do barbeiro</span><span aria-hidden="true">↗</span></a><a href="/?mode=real#Dashboard"><span>Abrir gestão</span><span aria-hidden="true">↗</span></a><a href="/whatsapp"><span>WhatsApp <small>Não conectado</small></span><span aria-hidden="true">↗</span></a><a href="/auth/login"><span>Entrar com minha conta</span><span aria-hidden="true">↗</span></a></nav></section>
    </main>
    <footer class="fc-home__footer"><div class="fc-home__container"><a class="fc-home__brand" href="/inicio" aria-label="Fonseca Barber Club — início">${identity}</a><p>Estilo é pessoal.</p>${socials}<a class="fc-home__back-top" href="#inicio">Voltar ao início <span aria-hidden="true">↑</span></a></div></footer>
  </div>`;
}
