/**
 * Lecture des factures PDF.
 *
 * Une facture émise par un logiciel contient déjà son texte : on le lit
 * directement, ce qui est instantané et sans erreur de reconnaissance. Un PDF
 * scanné, lui, n'est qu'une image — on le rend alors en bitmap pour le passer
 * à l'OCR.
 */

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

export interface PdfExtraction {
  /** Texte trouvé dans le PDF ; vide si le document est un scan. */
  text: string;
  /** Première page rendue en image, pour l'OCR ou l'aperçu. */
  pageImage: string;
}

/** Extrait le texte et l'aperçu de la première page d'un PDF. */
export async function readPdf(file: File | Blob): Promise<PdfExtraction> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  let text = '';
  // Une facture tient presque toujours sur une page ou deux ; au-delà, le
  // total cherché est de toute façon sur les premières.
  const pageCount = Math.min(doc.numPages, 3);
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ');
    text += '\n';
  }

  const first = await doc.getPage(1);
  // Échelle 2 : un ticket rendu à 1 est trop granuleux pour l'OCR.
  const viewport = first.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1600, Math.round(viewport.width));
  canvas.height = Math.round((canvas.width / viewport.width) * viewport.height);
  const context = canvas.getContext('2d');
  if (context) {
    const scaled = first.getViewport({ scale: canvas.width / first.getViewport({ scale: 1 }).width });
    await first.render({ canvas, canvasContext: context, viewport: scaled }).promise;
  }

  return { text: text.trim(), pageImage: canvas.toDataURL('image/jpeg', 0.82) };
}
