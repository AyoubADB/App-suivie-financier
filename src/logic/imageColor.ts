import type { OcrBox } from './ocr';
import type { AmountColor } from './statementShot';

/**
 * Lecture de la couleur d'un texte dans l'image d'origine.
 *
 * Dans une application bancaire, le vert signale un encaissement. Cette
 * information ne survit pas à la reconnaissance de texte, qui ne rend que des
 * caractères : il faut retourner la chercher dans les pixels, à l'endroit
 * exact où le montant est écrit.
 */

export type ColorProbe = (box: OcrBox) => AmountColor;

/** Nombre de pixels de texte en dessous duquel on préfère ne pas conclure. */
const MIN_TEXT_PIXELS = 12;

/** Écart minimum entre le vert et les autres canaux pour parler de vert. */
const GREEN_MARGIN = 18;

/**
 * Prépare une sonde de couleur sur une image.
 * Les coordonnées attendues sont celles de l'image passée à la
 * reconnaissance : c'est la même, donc elles coïncident.
 */
export async function createColorProbe(dataUrl: string): Promise<ColorProbe> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image illisible'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return () => 'inconnu';
  context.drawImage(image, 0, 0);

  return (box: OcrBox): AmountColor => {
    // Une petite marge autour du texte donne de quoi mesurer le fond.
    const pad = 2;
    const x = Math.max(0, Math.floor(box.x0) - pad);
    const y = Math.max(0, Math.floor(box.y0) - pad);
    const w = Math.min(canvas.width - x, Math.ceil(box.x1 - box.x0) + pad * 2);
    const h = Math.min(canvas.height - y, Math.ceil(box.y1 - box.y0) + pad * 2);
    if (w <= 0 || h <= 0) return 'inconnu';

    let data: Uint8ClampedArray;
    try {
      data = context.getImageData(x, y, w, h).data;
    } catch {
      return 'inconnu';
    }

    return classify(data);
  };
}

/**
 * Sépare le texte du fond, puis juge la couleur du texte.
 * Le fond est la couleur la plus répandue de la zone ; le texte, ce qui s'en
 * écarte le plus. Ce raisonnement vaut aussi bien sur fond clair que sombre,
 * ce qui évite de traiter les deux thèmes séparément.
 */
function classify(data: Uint8ClampedArray): AmountColor {
  const count = data.length / 4;
  if (count === 0) return 'inconnu';

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  for (let i = 0; i < data.length; i += 4) {
    bgR += data[i];
    bgG += data[i + 1];
    bgB += data[i + 2];
  }
  bgR /= count;
  bgG /= count;
  bgB /= count;

  // Distance de chaque pixel au fond moyen ; les plus éloignés sont le texte.
  const distances = new Float32Array(count);
  let maxDistance = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const d =
      Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB);
    distances[p] = d;
    if (d > maxDistance) maxDistance = d;
  }
  if (maxDistance < 30) return 'inconnu';

  const threshold = maxDistance * 0.55;
  let r = 0;
  let g = 0;
  let b = 0;
  let kept = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (distances[p] < threshold) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    kept++;
  }
  if (kept < MIN_TEXT_PIXELS) return 'inconnu';

  r /= kept;
  g /= kept;
  b /= kept;

  return g > r + GREEN_MARGIN && g > b + GREEN_MARGIN ? 'vert' : 'autre';
}
