import type { Worker } from 'tesseract.js';

/**
 * Reconnaissance de texte, entièrement dans le navigateur.
 *
 * Le moteur (WebAssembly) et le modèle de langue pèsent plusieurs mégaoctets :
 * ils sont chargés à la première utilisation seulement, puis mis en cache par
 * le service worker. Aucune image ne quitte l'appareil.
 */

let workerPromise: Promise<Worker> | null = null;

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

/** Texte brut lu dans une image. */
export async function recognizeImage(
  source: Blob | string,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const worker = await getWorker(onProgress);
  onProgress?.({ stage: 'analyse', ratio: 0 });
  const { data } = await worker.recognize(source);
  onProgress?.({ stage: 'terminé', ratio: 1 });
  return data.text ?? '';
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
