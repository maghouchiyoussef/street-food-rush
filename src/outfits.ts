import * as THREE from 'three';

// Free customer variety: recolors the customer's texture in code (shirt, trousers,
// hair, skin tone). Each texture pixel is assigned to the nearest color group of the
// original artwork, then repainted with a new color keeping its shading.

type RGB = [number, number, number];

// Color groups measured on the original texture (sRGB)
const SHIRT: RGB = [178, 202, 240];
const PANTS: RGB = [43, 46, 65];
const HAIR: RGB = [96, 61, 40];
const SKIN: RGB = [247, 174, 125];
const WHITE: RGB = [242, 238, 239];
const GROUPS = [SHIRT, PANTS, HAIR, SKIN, WHITE];

export interface Outfit { shirt: RGB; pants: RGB; hair: RGB; skin: RGB }

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const SHIRTS = [0xe8564a, 0x5cbf6a, 0xf5c542, 0x9a6fe0, 0xf28cc0, 0xf7f3ea, 0xff9440, 0x3fbfb8, 0xb5d3f5].map(hex);
const PANTSC = [0x2b2f45, 0x1f1f22, 0x3c4a2e, 0x6b5a45, 0x4a2f3a, 0x2c4a6e].map(hex);
const HAIRS = [0x5a3820, 0x1c1410, 0xc89a52, 0x8a3a1c, 0x9a9a9a, 0x3a2418].map(hex);
const SKINS = [0xf7ae7d, 0xfcc9a4, 0xd99566, 0xa86a42, 0x7a4a30].map(hex);

/** Deterministic outfit list (variant 0 = original colors) */
export function outfits(n: number): Outfit[] {
  const list: Outfit[] = [{ shirt: SHIRT, pants: PANTS, hair: HAIR, skin: SKIN }];
  for (let i = 1; i < n; i++) {
    list.push({
      shirt: SHIRTS[(i * 4) % SHIRTS.length],
      pants: PANTSC[(i * 5) % PANTSC.length],
      hair: HAIRS[(i * 7) % HAIRS.length],
      skin: SKINS[(i * 3) % SKINS.length],
    });
  }
  return list;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Builds one texture per outfit from the original texture image */
export function recolorTextures(source: THREE.Texture, list: Outfit[], size = 1024): THREE.Texture[] {
  const img = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, size, size);
  const src = g.getImageData(0, 0, size, size);
  const px = src.data;
  const n = size * size;
  // classify once: group index + shading factor
  const group = new Uint8Array(n);
  const shade = new Float32Array(n);
  const groupLum = GROUPS.map(c => lum(...c));
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
    let best = 0, bd = Infinity;
    for (let k = 0; k < GROUPS.length; k++) {
      const c = GROUPS[k];
      const d = (r - c[0]) ** 2 + (gg - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    // very dark pixels (pupils, outlines) and far-off colors stay as they are
    if (Math.max(r, gg, b) < 32 || bd > 4200) best = 255;
    group[i] = best;
    shade[i] = best === 255 ? 1 : Math.min(1.6, lum(r, gg, b) / groupLum[best]);
  }
  return list.map((o, v) => {
    if (v === 0) return source;
    const out = g.createImageData(size, size);
    const d = out.data;
    const targets = [o.shirt, o.pants, o.hair, o.skin];
    for (let i = 0; i < n; i++) {
      const k = group[i];
      if (k === 255 || k === 4) {
        d[i * 4] = px[i * 4]; d[i * 4 + 1] = px[i * 4 + 1]; d[i * 4 + 2] = px[i * 4 + 2];
      } else {
        const t = targets[k], s = shade[i];
        d[i * 4] = Math.min(255, t[0] * s); d[i * 4 + 1] = Math.min(255, t[1] * s); d[i * 4 + 2] = Math.min(255, t[2] * s);
      }
      d[i * 4 + 3] = 255;
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = source.flipY;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = source.wrapS; tex.wrapT = source.wrapT;
    tex.anisotropy = 4;
    return tex;
  });
}
