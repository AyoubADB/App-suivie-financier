import type { Worker } from 'tesseract.js';

/**
 * Reconnaissance de texte, entièrement dans le navigateur.
 *
 * Le moteur (WebAssembly) et le modèle de langue pèsent plusieurs mégaoctets :
 * ils sont chargés à la première utilisation seulement, puis mis en cache par
 * le service worker. Aucune image ne quitte l'appareil.
 */

let workerPromise: Promise<Worker> | null = null;

export interface OcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  box: OcrBox;
}

/** Ligne de texte reconnue, avec la position de chacun de ses mots. */
export interface OcrLine {
  text: string;
  box: OcrBox;
  words: OcrWord[];
}

export interface OcrResult {
  text: string;
  /**
   * Mise en page reconnue. Indispensable pour une capture d'écran bancaire :
   * le montant y est souvent sur sa propre ligne, et seule sa position permet
   * de le rattacher au bon commerçant — et d'aller lire sa couleur.
   */
  lines: OcrLine[];
}

export type OcrStage = 'chargement' | 'analyse' | 'terminé';

export interface OcrProgress {
  stage: OcrStage;
  /** Avancée de l'étape en cours, 0 à 1. */
  ratio: number;
}

/** Le moteur a besoin de WebAssembly et des workers. */
export function ocrSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
}

async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('fra', 1, {
        // Moteur servi par l'app elle-même : pas de dépendance à un CDN
        // au moment où l'utilisateur photographie un ticket.
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        // Modèle français servi par l'app : la reconnaissance fonctionne
        // dès la première utilisation, y compris hors ligne.
        langPath: '/ocr',
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (!onProgress) return;
          const stage: OcrStage = m.status === 'recognizing text' ? 'analyse' : 'chargement';
          onProgress({ stage, ratio: m.progress ?? 0 });
        },
      });
    })().catch((err) => {
      // Un échec de chargement ne doit pas condamner les tentatives suivantes.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Texte et mise en page lus dans une image. */
export async function recognizeImage(
  source: Blob | string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const worker = await getWorker(onProgress);
  onProgress?.({ stage: 'analyse', ratio: 0 });
  const { data } = await worker.recognize(source, {}, { text: true, blocks: true });
  onProgress?.({ stage: 'terminé', ratio: 1 });
  return { text: data.text ?? '', lines: flattenLines(data.blocks) };
}

/** Aplatit l'arbre blocs → paragraphes → lignes rendu par le moteur. */
function flattenLines(blocks: unknown): OcrLine[] {
  const out: OcrLine[] = [];
  const tree = blocks as
    | Array<{ paragraphs: Array<{ lines: Array<{ text: string; bbox: OcrBox; words: Array<{ text: string; bbox: OcrBox }> }> }> }>
    | null
    | undefined;
  if (!tree) return out;

  for (const block of tree) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? [])
          .filter((w) => w.text.trim())
          .map((w) => ({ text: w.text.trim(), box: w.bbox }));
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (text) out.push({ text, box: line.bbox, words });
      }
    }
  }
  return out;
}

/**
 * Efface le moteur mis en cache et le relâche.
 *
 * Un téléchargement interrompu laisse un moteur inutilisable en cache, et
 * comme il est servi en « cache d'abord », il le reste indéfiniment : la
 * lecture échoue alors sur toutes les captures, alors qu'elle marchait la
 * veille. C'est la seule panne que l'utilisateur ne peut pas contourner
 * lui-même, d'où ce bouton de remise à zéro.
 */
export async function resetOcrEngine(): Promise<void> {
  await releaseOcr();

  if (typeof caches !== 'undefined') {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes('ocr')).map((n) => caches.delete(n)));
  }

  // Le moteur conserve aussi le modèle de langue dans une base locale.
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('keyval-store');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
}

/** Libère le moteur — appelé quand l'écran de capture se ferme. */
export async function releaseOcr(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Le moteur n'a jamais démarré : rien à libérer.
  }
}
