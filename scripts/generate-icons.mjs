// Génère public/pwa-192.png et public/pwa-512.png sans dépendance externe.
// Dessine l'icône FLOW (fond quasi-noir arrondi + vague gradient violet→bleu)
// pixel par pixel, puis encode le PNG à la main (zlib est dans Node).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public');
mkdirSync(outDir, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtre "None"
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const VIOLET = [0x8b, 0x5c, 0xf6];
const BLUE = [0x38, 0xbd, 0xf8];
const BG = [0x0b, 0x0b, 0x0f];

// La vague : y(t) au fil de x, même geste que le favicon SVG.
function waveY(t) {
  return 0.55 - 0.16 * Math.sin(t * Math.PI * 1.7 + 0.4) - 0.1 * Math.sin(t * Math.PI * 3.4);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const stroke = size * 0.075;
  const margin = size * 0.14;
  // Échantillonne la courbe une fois pour la distance au trait.
  const samples = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    samples.push([margin + t * (size - margin * 2), waveY(t) * size, t]);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // coin arrondi (superellipse simple)
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const corner = Math.hypot(dx, dy) - radius;
      const alpha = corner <= 0 ? 255 : corner < 1.5 ? Math.round(255 * (1 - corner / 1.5)) : 0;
      if (alpha === 0) continue;
      let [r, g, b] = BG;
      let best = Infinity;
      let bestT = 0;
      for (const [sx, sy, t] of samples) {
        const d = Math.hypot(x - sx, y - sy);
        if (d < best) {
          best = d;
          bestT = t;
        }
      }
      const edge = best - stroke / 2;
      if (edge < 1.5) {
        const cover = edge <= 0 ? 1 : 1 - edge / 1.5;
        const cr = lerp(VIOLET[0], BLUE[0], bestT);
        const cg = lerp(VIOLET[1], BLUE[1], bestT);
        const cb = lerp(VIOLET[2], BLUE[2], bestT);
        r = Math.round(lerp(r, cr, cover));
        g = Math.round(lerp(g, cg, cover));
        b = Math.round(lerp(b, cb, cover));
      }
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = alpha;
    }
  }
  return encodePNG(size, rgba);
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `pwa-${size}.png`), drawIcon(size));
  console.log(`public/pwa-${size}.png`);
}
