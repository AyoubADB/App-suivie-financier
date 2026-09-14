import { Camera, FileText, ImagePlus, Loader2, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCategories, useRules } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { suggestCategory } from '../../logic/categorizer';
import { LIMITS } from '../../logic/limits';
import { formatCents } from '../../logic/money';
import { createColorProbe } from '../../logic/imageColor';
import {
  ocrSupported,
  recognizeImage,
  releaseOcr,
  type OcrProgress,
  type OcrResult,
} from '../../logic/ocr';
import { readPdf } from '../../logic/pdf';
import { extractReceipt, type ReceiptFields } from '../../logic/receipt';
import { applyRules } from '../../logic/rules';
import {
  extractStatement,
  extractStatementFromLayout,
  looksLikeStatement,
  type StatementLine,
  type StatementParse,
} from '../../logic/statementShot';
import type { Scope } from '../../types';
import { getIcon } from '../ui/icons';
import { StatementReview } from './StatementReview';

/** Ce que la capture transmet au formulaire de transaction. */
export interface ReceiptPrefill {
  label?: string;
  amount?: number;
  date?: string;
  categoryId?: string;
  vatAmount?: number;
  vatRate?: number;
  receiptUrl?: string;
}

interface ReceiptCaptureProps {
  onUse: (prefill: ReceiptPrefill) => void;
  /** Portée des mouvements créés depuis une capture de compte. */
  scope: Scope;
  /** Appelé après un import groupé, avec le nombre d'écritures créées. */
  onImported: (added: number) => void;
}

/**
 * Photographier un ticket plutôt que de le saisir.
 *
 * Tout se passe sur l'appareil : lecture du texte, repérage du total, de la
 * date et de la TVA. Aucune image n'est envoyée nulle part, et l'app reste
 * utilisable hors ligne une fois le moteur téléchargé.
 */
export function ReceiptCapture({ onUse, scope, onImported }: ReceiptCaptureProps) {
  const categories = useCategories();
  const rules = useRules();
  const { currency } = useSettings();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  /** Version allégée conservée avec la transaction, distincte de celle lue. */
  const [receipt, setReceipt] = useState<string | null>(null);
  const [fields, setFields] = useState<ReceiptFields | null>(null);
  /** Opérations trouvées quand l'image est une capture de compte. */
  const [statement, setStatement] = useState<StatementParse | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [mode, setMode] = useState<'ticket' | 'releve'>('ticket');
  /** Vignettes des captures lues, pour se repérer quand il y en a plusieurs. */
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Le moteur occupe plusieurs dizaines de mégaoctets de mémoire : on le
  // relâche dès que l'écran de capture disparaît.
  useEffect(() => () => void releaseOcr(), []);

  /**
   * Lit une ou plusieurs captures d'un coup.
   * Un relevé tient rarement sur un seul écran : autoriser plusieurs images
   * évite d'enchaîner les allers-retours, et les opérations de toutes les
   * captures se retrouvent dans une seule liste.
   */
  async function handle(files: FileList | null) {
    const list = files ? [...files] : [];
    if (list.length === 0) return;

    setError('');
    setFields(null);
    setStatement(null);
    setPreviews([]);
    setBusy(true);
    setProgress({ stage: 'chargement', ratio: 0 });

    try {
      const collected: StatementLine[] = [];
      const texts: string[] = [];
      const thumbs: string[] = [];
      let firstReceipt: { fields: ReceiptFields; text: string } | null = null;

      for (const [index, file] of list.entries()) {
        setProgress({ stage: 'chargement', ratio: index / list.length });
        const read = await readSource(file);
        thumbs.push(read.image);
        setPreviews([...thumbs]);
        if (index === 0) {
          setPreview(read.image);
          setReceipt(read.receipt);
        }
        if (!read.result.text.trim()) continue;

        texts.push(read.result.text);

        // La position des mots rattache chaque montant à son commerçant ;
        // la couleur du montant dit s'il s'agit d'un encaissement.
        const probe = read.canProbe ? await safeProbe(read.image) : undefined;
        const layout =
          read.result.lines.length > 0
            ? extractStatementFromLayout(read.result.lines, { colorAt: probe })
            : extractStatement(read.result.text);

        // Sans mise en page exploitable, la lecture ligne à ligne reste utile.
        const fallback = extractStatement(read.result.text);
        const best = layout.lines.length >= fallback.lines.length ? layout : fallback;
        collected.push(
          ...best.lines.map((line, i) => ({ ...line, id: `f${index}-${line.id}-${i}` })),
        );

        if (index === 0) firstReceipt = { fields: extractReceipt(read.result.text), text: read.result.text };
      }

      if (texts.length === 0) {
        setError('Aucun texte lisible. Reprends la photo à plat, bien éclairée et sans flou.');
        return;
      }

      const joined = texts.join('\n');
      const parsed: StatementParse = { lines: collected, skipped: 0 };
      setOcrText(joined);
      setStatement(parsed);
      setFields(firstReceipt?.fields ?? null);
      // Plusieurs images, c'est forcément un relevé : on ne scanne pas deux
      // tickets pour n'en garder qu'un.
      setMode(list.length > 1 || looksLikeStatement(parsed, joined) ? 'releve' : 'ticket');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const engineFailed = /worker|importscripts|network|fetch|wasm/i.test(message);
      setError(
        engineFailed
          ? "Le moteur de lecture n'a pas pu démarrer. Vérifie ta connexion le temps de son premier téléchargement, puis réessaie."
          : 'Lecture impossible. Essaie avec une photo plus nette et bien à plat, ou saisis le montant à la main.',
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /** Prépare une source : image réduite, version conservée, texte reconnu. */
  async function readSource(file: File): Promise<{
    image: string;
    receipt: string;
    result: OcrResult;
    canProbe: boolean;
  }> {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdf = await readPdf(file);
      const shrunk = await shrinkDataUrl(pdf.pageImage, 1000, 0.7);
      // Une facture générée par un logiciel contient déjà son texte :
      // inutile de la reconnaître, c'est plus rapide et sans erreur.
      if (pdf.text.length > 40) {
        return { image: pdf.pageImage, receipt: shrunk, result: { text: pdf.text, lines: [] }, canProbe: false };
      }
      return { image: pdf.pageImage, receipt: shrunk, result: await runOcr(pdf.pageImage), canProbe: true };
    }

    // Deux tailles : la grande sert à lire, la petite à conserver.
    const image = await downscale(file, 1500, 0.9);
    return {
      image,
      receipt: await downscale(file, 1000, 0.7),
      result: await runOcr(image),
      canProbe: true,
    };
  }

  /** Une couleur illisible ne doit pas faire échouer toute la lecture. */
  async function safeProbe(image: string) {
    try {
      return await createColorProbe(image);
    } catch {
      return undefined;
    }
  }

  async function runOcr(image: string): Promise<OcrResult> {
    if (!ocrSupported()) throw new Error('OCR indisponible sur ce navigateur.');
    return recognizeImage(image, setProgress);
  }

  function use() {
    if (!fields) return;
    const label = fields.merchant ?? 'Ticket';
    const suggestion = suggestCategory(label, { scope: 'perso', type: 'expense', categories });
    const { effects } = applyRules(rules, {
      label,
      amount: fields.total ?? 0,
      type: 'expense',
      scope: 'perso',
    });

    onUse({
      label: effects.renameTo ?? label,
      amount: fields.total,
      date: fields.dateISO,
      categoryId: effects.categoryId ?? suggestion.category.id,
      vatAmount: fields.vatAmount,
      vatRate: fields.vatRate,
      receiptUrl: receipt ? boundedReceipt(receipt) : undefined,
    });
  }

  /** Au-delà de la limite, on garde la transaction et on lâche la photo. */
  function boundedReceipt(url: string): string | undefined {
    return url.length <= LIMITS.receiptDataUrlMax ? url : undefined;
  }

  const suggested = fields
    ? suggestCategory(fields.merchant ?? '', {
        scope: 'perso',
        type: 'expense',
        categories,
      }).category
    : null;
  const SuggestedIcon = getIcon(suggested?.icon);

  return (
    <div className="flex flex-col gap-4">
      {!fields && !busy && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="bg-gradient-flow flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold text-white"
            >
              <Camera size={19} />
              Prendre en photo
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="glass flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-medium"
            >
              <ImagePlus size={18} />
              Images ou PDF
            </button>
          </div>

          <p className="text-xs leading-relaxed text-ink-3">
            Fonctionne avec un ticket de caisse, une facture, ou une{' '}
            <strong className="font-medium text-ink-2">capture d'écran de ton compte bancaire</strong> —
            dans ce cas toutes les opérations visibles sont extraites d'un coup. Tu peux
            sélectionner <strong className="font-medium text-ink-2">plusieurs captures</strong> à la
            fois : elles se retrouvent dans une seule liste. Tout est lu sur ton téléphone, rien
            n'est envoyé sur Internet. La première lecture télécharge le moteur (quelques
            mégaoctets), ensuite tout fonctionne hors ligne.
          </p>
        </>
      )}

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />

      {previews.length > 1 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {previews.map((src, i) => (
            <img
              key={`${src.slice(-24)}-${i}`}
              src={src}
              alt={`Capture ${i + 1}`}
              className="h-28 shrink-0 rounded-xl object-contain ring-1 ring-line"
            />
          ))}
        </div>
      ) : (
        preview && (
          <img
            src={preview}
            alt="Aperçu du justificatif"
            className="max-h-56 w-full rounded-2xl object-contain ring-1 ring-line"
          />
        )
      )}

      {busy && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 size={16} className="animate-spin text-accent-2" />
            {progress?.stage === 'analyse' ? 'Lecture du ticket…' : 'Préparation du moteur…'}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="bg-gradient-flow h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-3">
            La première lecture est la plus longue, le temps de charger le moteur.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-neg">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {statement && statement.lines.length > 0 && fields && (
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          <ModeTab active={mode === 'releve'} onClick={() => setMode('releve')}>
            Relevé · {statement.lines.length} opérations
          </ModeTab>
          <ModeTab active={mode === 'ticket'} onClick={() => setMode('ticket')}>
            Ticket unique
          </ModeTab>
        </div>
      )}

      {mode === 'releve' && statement && statement.lines.length > 0 && (
        <StatementReview
          lines={statement.lines}
          ocrText={ocrText}
          scope={scope}
          onDone={onImported}
        />
      )}

      {mode === 'ticket' && fields && (
        <>
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles size={15} className="text-accent-2" />
              Ce que j'ai lu
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  fields.confidence === 'haute'
                    ? 'bg-pos/15 text-pos'
                    : fields.confidence === 'moyenne'
                      ? 'bg-warn/15 text-warn'
                      : 'bg-neg/15 text-neg'
                }`}
              >
                confiance {fields.confidence}
              </span>
            </p>

            <Row label="Enseigne" value={fields.merchant ?? 'non trouvée'} />
            <Row
              label="Date"
              value={
                fields.dateISO
                  ? new Date(fields.dateISO).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'non trouvée'
              }
            />
            <Row
              label="Montant"
              value={fields.total !== undefined ? formatCents(fields.total, currency) : 'non trouvé'}
              strong
            />
            {fields.vatAmount !== undefined && (
              <Row
                label={`TVA${fields.vatRate ? ` (${String(fields.vatRate).replace('.', ',')} %)` : ''}`}
                value={formatCents(fields.vatAmount, currency)}
              />
            )}
            {suggested && (
              <Row
                label="Catégorie proposée"
                value={
                  <span className="flex items-center justify-end gap-1.5">
                    <SuggestedIcon size={14} style={{ color: suggested.color }} />
                    {suggested.label}
                  </span>
                }
              />
            )}
          </div>

          {fields.confidence !== 'haute' && (
            <p className="text-xs leading-relaxed text-warn">
              Le total n'a pas été trouvé par un mot-clé : vérifie-le à l'étape suivante.
              {fields.candidates.length > 1 &&
                ` Autres montants lus : ${fields.candidates
                  .slice(0, 4)
                  .map((c) => formatCents(c, currency))
                  .join(', ')}.`}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={use}
              className="bg-gradient-flow min-h-[52px] flex-1 cursor-pointer rounded-2xl font-semibold text-white"
            >
              Continuer
            </button>
            <button
              type="button"
              onClick={() => {
                setFields(null);
                setPreview(null);
                setReceipt(null);
              }}
              aria-label="Reprendre une photo"
              className="glass flex min-h-[52px] w-14 cursor-pointer items-center justify-center rounded-2xl text-ink-2"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-3">
            <FileText size={13} className="mt-0.5 shrink-0" />
            Tout reste modifiable à l'étape suivante, et la photo est conservée avec la transaction
            comme justificatif.
          </p>
        </>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] flex-1 cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors ${
        active ? 'bg-gradient-flow text-white' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className={strong ? 'amount text-base font-bold' : 'text-right font-medium'}>
        {value}
      </span>
    </div>
  );
}

/** Réduit une data-URL déjà chargée — cas du PDF rendu en image. */
async function shrinkDataUrl(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image invalide'));
    img.src = dataUrl;
  });
  // Jamais d'agrandissement : on ne crée pas de détail qui n'existe pas.
  let scale = Math.min(1, maxWidth / img.width);
  const maxPixels = 4_500_000;
  const pixels = img.width * scale * (img.height * scale);
  if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Réduit une image avant lecture.
 *
 * On borne la largeur, pas le plus grand côté : une capture d'écran de
 * téléphone est très haute et peu large, et la réduire sur sa hauteur
 * écraserait le texte au point de le rendre illisible. Un plafond en nombre
 * de pixels protège des photos d'appareil photo, énormes dans les deux sens.
 */
async function downscale(file: File, maxWidth: number, quality: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image invalide'));
    img.src = dataUrl;
  });

  // Jamais d'agrandissement : on ne crée pas de détail qui n'existe pas.
  let scale = Math.min(1, maxWidth / img.width);
  const maxPixels = 4_500_000;
  const pixels = img.width * scale * (img.height * scale);
  if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
