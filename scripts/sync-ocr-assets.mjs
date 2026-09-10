/**
 * Copie le moteur OCR (Tesseract) de node_modules vers public/ocr.
 *
 * L'app est une PWA installée sur un téléphone : elle doit servir son moteur
 * depuis son propre domaine, sans dépendre d'un CDN tiers au moment où
 * l'utilisateur photographie un ticket. Les fichiers sont volumineux et
 * régénérables, donc ignorés par git et recopiés à chaque build.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'ocr');

/**
 * Modèle de langue française. La variante « best_int » pèse 700 Ko contre
 * 6 Mo pour la complète, pour une qualité équivalente sur des tickets :
 * sur un téléphone, la différence de téléchargement compte plus que le
 * dernier pour cent de reconnaissance.
 */
const LANG_VARIANT = '4.0.0_best_int';

/**
 * Le moteur choisit sa variante selon ce que le processeur sait faire
 * (SIMD, SIMD relâché, ou rien). Impossible de deviner à l'avance depuis le
 * build : on embarque toutes les variantes, le navigateur n'en télécharge
 * qu'une.
 */
const CORE_PREFIX = 'tesseract-core';

/**
 * L'app demande le moteur LSTM uniquement (le plus précis, et le seul utile
 * ici) : les variantes héritées doublent le poids déployé pour rien.
 */
const CORE_SUFFIX = 'lstm';

async function main() {
  const workerSrc = join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
  const coreDir = join(root, 'node_modules', 'tesseract.js-core');

  if (!existsSync(workerSrc) || !existsSync(coreDir)) {
    console.warn('[ocr] tesseract.js absent — étape ignorée (npm install le fournira).');
    return;
  }

  await mkdir(target, { recursive: true });
  await copyFile(workerSrc, join(target, 'worker.min.js'));

  const available = await readdir(coreDir);
  let copied = 1;
  for (const file of available) {
    if (!file.startsWith(CORE_PREFIX) || !file.includes(CORE_SUFFIX)) continue;
    await copyFile(join(coreDir, file), join(target, file));
    copied++;
  }

  const langSrc = join(
    root, 'node_modules', '@tesseract.js-data', 'fra', LANG_VARIANT, 'fra.traineddata.gz',
  );
  if (existsSync(langSrc)) {
    await copyFile(langSrc, join(target, 'fra.traineddata.gz'));
    copied++;
  } else {
    console.warn('[ocr] modèle français absent — il sera téléchargé depuis le CDN au besoin.');
  }

  console.log(`[ocr] ${copied} fichiers copiés dans public/ocr`);
}

await main();
