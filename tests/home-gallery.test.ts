import { test } from "node:test";
import assert from "node:assert/strict";
import type { Verified } from "../src/home-content.ts";
import {
  homeGallery,
  renderHomeGallery,
  type HomeGalleryPhoto,
} from "../src/home-gallery.ts";

const today = "2026-10-30";
// Synthetic metadata only. These paths do not represent supplied business photos.
const fixture: HomeGalleryPhoto = {
  src: "/brand/synthetic-test.jpg",
  alt: "Imagem sintética para teste",
  width: 1200,
  height: 800,
};
function verified(
  value: HomeGalleryPhoto = fixture,
): Verified<HomeGalleryPhoto> {
  return {
    value,
    evidence: { source: "Synthetic test fixture only", checkedOn: today },
  };
}
function renderUnknown(value: unknown): string {
  return renderHomeGallery(
    value as readonly Verified<HomeGalleryPhoto>[],
    today,
  );
}

test("the real gallery configuration stays empty and produces no placeholders", () => {
  assert.deepEqual(homeGallery, []);
  assert.equal(renderHomeGallery(homeGallery, today), "");
  assert.equal(renderHomeGallery([], today), "");
});

test("malformed and unverified gallery metadata is omitted without throwing", () => {
  for (const collection of [null, undefined, {}, "photos", 1]) {
    assert.equal(renderUnknown(collection), "");
  }
  for (const item of [
    null,
    undefined,
    "photo",
    [],
    {},
    fixture,
    { value: fixture },
    { ...verified(), evidence: null },
    { ...verified(), evidence: {} },
    { ...verified(), value: null },
    { ...verified(), value: [] },
    { ...verified(), value: {} },
    { ...verified(), value: { ...fixture, src: null } },
    { ...verified(), value: { ...fixture, alt: null } },
    { ...verified(), value: { ...fixture, alt: " \n " } },
    { ...verified(), value: { ...fixture, caption: 1 } },
    { ...verified(), value: { ...fixture, caption: null } },
  ]) {
    assert.equal(renderUnknown([item]), "");
  }
});

test("evidence requires a source and a real calendar date no later than today", () => {
  for (const evidence of [
    { source: "", checkedOn: today },
    { source: "  ", checkedOn: today },
    { source: null, checkedOn: today },
    { source: "test", checkedOn: null },
    { source: "test", checkedOn: "2026-02-29" },
    { source: "test", checkedOn: "2026-02-30" },
    { source: "test", checkedOn: "2026-13-01" },
    { source: "test", checkedOn: "2026-10-31" },
    { source: "test", checkedOn: "2026-1-01" },
    { source: "test", checkedOn: "2026-10-30T00:00:00Z" },
  ]) {
    assert.equal(renderUnknown([{ value: fixture, evidence }]), "");
  }
  assert.match(
    renderHomeGallery(
      [
        {
          value: fixture,
          evidence: { source: "test", checkedOn: "2024-02-29" },
        },
      ],
      today,
    ),
    /id="galeria"/u,
  );
  for (const date of ["", "2026-02-30", "2026-1-01", "not a date"]) {
    assert.equal(renderHomeGallery([verified()], date), "");
  }
});

test("gallery permits only local brand raster paths without URL or attribute injection", () => {
  for (const src of [
    "https://example.com/photo.jpg",
    "http://example.com/photo.jpg",
    "//example.com/photo.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,test",
    "blob:synthetic",
    "/brand/../photo.jpg",
    "/brand/subfolder/photo.jpg",
    "/brand/%2e%2e/photo.jpg",
    "/brand/%2fphoto.jpg",
    "/brand\\photo.jpg",
    "/other/photo.jpg",
    "/brand/photo.svg",
    "/brand/photo.gif",
    "/brand/photo.jpg?tracking=1",
    "/brand/photo.jpg#fragment",
    '/brand/photo.jpg" onerror="alert(1)',
    "/brand/photo.jpg\n",
  ]) {
    assert.equal(renderHomeGallery([verified({ ...fixture, src })], today), "");
  }
  for (const extension of ["png", "webp", "jpg", "jpeg"]) {
    const src = `/brand/synthetic-test_2.${extension}`;
    assert.ok(
      renderHomeGallery([verified({ ...fixture, src })], today).includes(
        `src="${src}"`,
      ),
    );
  }
});

test("photos need positive exact integer dimensions", () => {
  for (const dimension of [
    0,
    -1,
    0.5,
    Number.NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "800",
    null,
  ]) {
    for (const property of ["width", "height"]) {
      assert.equal(
        renderUnknown([
          verified({ ...fixture, [property]: dimension } as HomeGalleryPhoto),
        ]),
        "",
      );
    }
  }
});

test("valid photos preserve their paths and dimensions and load lazily", () => {
  const html = renderHomeGallery(
    [verified({ ...fixture, caption: "Legenda de teste" })],
    today,
  );
  assert.match(
    html,
    /<section id="galeria" class="fc-home__gallery" aria-labelledby="fc-home-gallery-title">/u,
  );
  assert.match(html, /<h2 id="fc-home-gallery-title">/u);
  assert.match(html, /<figure class="fc-home__gallery-photo">/u);
  assert.match(html, /src="\/brand\/synthetic-test\.jpg"/u);
  assert.match(
    html,
    /alt="Imagem sintética para teste" width="1200" height="800" loading="lazy" decoding="async"/u,
  );
  assert.match(
    html,
    /<figcaption class="fc-home__gallery-caption">Legenda de teste<\/figcaption>/u,
  );
  assert.doesNotMatch(
    html,
    /<a |style=|filter|srcset|fetchpriority|Synthetic test fixture only/u,
  );
  assert.doesNotMatch(renderHomeGallery([verified()], today), /figcaption/u);
  assert.doesNotMatch(
    renderHomeGallery([verified({ ...fixture, caption: " \n " })], today),
    /figcaption/u,
  );
});

test("alt text and captions are escaped and evidence remains private", () => {
  const attack = "<script>alert(\"x\")</script> & 'test'";
  const html = renderHomeGallery(
    [
      {
        value: { ...fixture, alt: attack, caption: attack },
        evidence: { source: attack, checkedOn: today },
      },
    ],
    today,
  );
  assert.doesNotMatch(html, /<script>|alert\("x"\)/u);
  assert.match(
    html,
    /alt="&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;test&#39;"/u,
  );
  assert.match(
    html,
    /<figcaption[^>]*>&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;test&#39;<\/figcaption>/u,
  );
  assert.equal((html.match(/&lt;script&gt;/gu) ?? []).length, 2);
});

test("the presentation uses at most four valid photos in source order", () => {
  const photos = Array.from({ length: 6 }, (_, index) =>
    verified({
      ...fixture,
      src: `/brand/synthetic-${index}.jpg`,
      alt: `Synthetic ${index}`,
    }),
  );
  const html = renderUnknown([
    null,
    verified({ ...fixture, src: "/bad.jpg" }),
    ...photos,
  ]);
  assert.equal((html.match(/<figure /gu) ?? []).length, 4);
  for (let index = 0; index < 4; index += 1) {
    assert.ok(html.includes(`/brand/synthetic-${index}.jpg`));
    if (index > 0)
      assert.ok(
        html.indexOf(`synthetic-${index - 1}.jpg`) <
          html.indexOf(`synthetic-${index}.jpg`),
      );
  }
  assert.doesNotMatch(html, /synthetic-[45]\.jpg/u);
  assert.equal(photos.length, 6);
});
