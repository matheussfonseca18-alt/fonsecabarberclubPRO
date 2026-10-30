import type { Evidence, Verified } from "./home-content.ts";
import { escapeHtml } from "./home-sections.ts";

export type HomeGalleryPhoto = Readonly<{
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}>;

// Add only approved original photos with their exact pixel dimensions and
// evidence. No verified gallery photos were supplied with the legacy layout.
export const homeGallery: readonly Verified<HomeGalleryPhoto>[] = [];

// Four photos are a presentation choice for the optional 2-by-2 gallery,
// not an assertion about how many photos or locations the business has.
const galleryPhotoLimit = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function hasEvidence(value: unknown, today: string): value is Evidence {
  return (
    isRecord(value) &&
    typeof value.source === "string" &&
    Boolean(value.source.trim()) &&
    isCalendarDate(value.checkedOn) &&
    value.checkedOn <= today
  );
}

function isVerifiedPhoto(
  item: unknown,
  today: string,
): item is Verified<HomeGalleryPhoto> {
  if (!isRecord(item) || !hasEvidence(item.evidence, today)) return false;
  const photo = item.value;
  return (
    isRecord(photo) &&
    typeof photo.src === "string" &&
    /^\/brand\/[a-zA-Z0-9._-]+\.(?:png|webp|jpg|jpeg)$/u.test(photo.src) &&
    typeof photo.alt === "string" &&
    Boolean(photo.alt.trim()) &&
    typeof photo.width === "number" &&
    Number.isSafeInteger(photo.width) &&
    photo.width > 0 &&
    typeof photo.height === "number" &&
    Number.isSafeInteger(photo.height) &&
    photo.height > 0 &&
    (photo.caption === undefined || typeof photo.caption === "string")
  );
}

export function renderHomeGallery(
  photos: readonly Verified<HomeGalleryPhoto>[],
  today: string,
): string {
  if (!Array.isArray(photos) || !isCalendarDate(today)) return "";
  const visiblePhotos = photos
    .filter((item) => isVerifiedPhoto(item, today))
    .slice(0, galleryPhotoLimit);
  if (!visiblePhotos.length) return "";

  return `<section id="galeria" class="fc-home__gallery" aria-labelledby="fc-home-gallery-title">
    <div class="fc-home__section-heading fc-home__gallery-heading"><div><p class="fc-home__eyebrow">GALERIA</p><h2 id="fc-home-gallery-title">Um olhar sobre o clube.</h2></div></div>
    <div class="fc-home__gallery-grid">${visiblePhotos
      .map(({ value: photo }) => {
        const caption = photo.caption?.trim();
        return `<figure class="fc-home__gallery-photo"><img class="fc-home__gallery-image" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">${caption ? `<figcaption class="fc-home__gallery-caption">${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
      })
      .join("")}</div>
  </section>`;
}
