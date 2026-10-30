import "./legacy-home.css";
import { homeContent } from "./home-content.ts";
import { homeGallery } from "./home-gallery.ts";
import { renderLegacyHome } from "./legacy-home-view.ts";
import { mountLegacyHomeInteractions } from "./legacy-home-interactions.ts";

let disposeHome: (() => void) | undefined;

// Presentation stays isolated from auth, data, booking and team modules.
export function startLanding() {
  disposeHome?.();
  document.title = "Fonseca Barber Club — Eleve o seu padrão.";
  document.body.classList.add("fc-home-document");
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Landing root unavailable");
  const today = new Date().toISOString().slice(0, 10);
  root.innerHTML = renderLegacyHome(homeContent, today, homeGallery);
  disposeHome = mountLegacyHomeInteractions(root);
}
