/** Public presentation data only. Never put account or Library identifiers here. */
export type Evidence = Readonly<{ source: string; checkedOn: string }>;
export type Verified<T> = Readonly<{ value: T; evidence: Evidence }>;
export type BrandLogo = Readonly<{
  src: string;
  alt: string;
  width: number;
  height: number;
}>;
export type SocialLink = Readonly<{ label: string; href: string }>;
export type ClubLocation = Readonly<{
  lines: readonly string[];
  mapUrl?: string;
}>;
export type ClubPlan = Readonly<{
  id: string;
  name: string;
  priceCents: number;
  cadence: "month" | "year";
  features: readonly string[];
  terms: string;
  validFrom: string;
  validThrough: string;
}>;
export type HomeContent = Readonly<{
  logo: Verified<BrandLogo> | null;
  location: Verified<ClubLocation> | null;
  socials: readonly Verified<SocialLink>[];
  plans: readonly Verified<ClubPlan>[];
}>;

// Only publish approved original logo bytes and current, independently verified
// business details. Unknown values deliberately stay absent. The demo catalog
// and historic prices are not sources for this presentation.
export const homeContent: HomeContent = {
  logo: null,
  location: null,
  socials: [
    {
      value: {
        label: "Instagram",
        href: "https://www.instagram.com/fonsecabarberclub/",
      },
      evidence: {
        source: "https://www.instagram.com/fonsecabarberclub/",
        checkedOn: "2026-10-29",
      },
    },
  ],
  plans: [],
};
