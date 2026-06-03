import type { TrackedCard } from '@/types';

const CARD_W = 63;   // mm
const CARD_H = 88;   // mm
const GAP    = 1;    // mm — cut line space
const COLS   = 4;
const ROWS   = 2;
const PER_PAGE = COLS * ROWS;
const PAGE_W = 297;  // A4 landscape
const PAGE_H = 210;

// Centre the grid on the page
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP;
const LEFT   = (PAGE_W - GRID_W) / 2;
const TOP    = (PAGE_H - GRID_H) / 2;

async function fetchImageDataUrl(src: string): Promise<string | null> {
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateProxyPdf(
  cards: TrackedCard[],
  mode: 'full' | 'missing',
  onProgress: (pct: number) => void,
) {
  // Expand to individual instances
  const instances: TrackedCard[] = [];
  for (const card of cards) {
    const count = mode === 'missing' ? card.needed - card.collected : card.needed;
    for (let i = 0; i < count; i++) instances.push(card);
  }
  if (instances.length === 0) return;

  // Load unique images (with progress)
  const uniqueUrls = [...new Set(instances.map((c) => c.imageLarge || c.imageSmall))];
  const imageMap = new Map<string, string>();
  let done = 0;
  onProgress(0);

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const dataUrl = await fetchImageDataUrl(url);
      if (dataUrl) imageMap.set(url, dataUrl);
      onProgress(Math.round((++done / uniqueUrls.length) * 90)); // up to 90%
    }),
  );

  // Build PDF (dynamic import keeps jsPDF out of the main bundle)
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageCount = Math.ceil(instances.length / PER_PAGE);

  for (let p = 0; p < pageCount; p++) {
    if (p > 0) pdf.addPage();
    const pageCards = instances.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

    // Cut lines — thin dashed grey lines in the 1mm gaps between cards
    pdf.setDrawColor(160, 160, 160);
    pdf.setLineWidth(0.15);
    pdf.setLineDashPattern([0.8, 0.8], 0);

    for (let c = 1; c < COLS; c++) {
      const x = LEFT + c * CARD_W + (c - 1) * GAP + GAP / 2;
      pdf.line(x, TOP - 2, x, TOP + GRID_H + 2);
    }
    for (let r = 1; r < ROWS; r++) {
      const y = TOP + r * CARD_H + (r - 1) * GAP + GAP / 2;
      pdf.line(LEFT - 2, y, LEFT + GRID_W + 2, y);
    }

    pdf.setLineDashPattern([], 0);

    // Place card images
    for (let i = 0; i < pageCards.length; i++) {
      const card = pageCards[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = LEFT + col * (CARD_W + GAP);
      const y = TOP + row * (CARD_H + GAP);

      const imageUrl = card.imageLarge || card.imageSmall;
      const dataUrl = imageMap.get(imageUrl);
      if (dataUrl) {
        pdf.addImage(dataUrl, 'JPEG', x, y, CARD_W, CARD_H, undefined, 'FAST');
      } else {
        // Placeholder
        pdf.setFillColor(230, 230, 230);
        pdf.rect(x, y, CARD_W, CARD_H, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(card.name, x + CARD_W / 2, y + CARD_H / 2, { align: 'center' });
      }
    }
  }

  onProgress(100);
  pdf.save('proxy-print.pdf');
}
