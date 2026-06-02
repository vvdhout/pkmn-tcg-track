import type { TrackedCard } from '@/types';

// Standard Pokémon card dimensions and A4 landscape layout
const CARD_W = 63; // mm
const CARD_H = 88; // mm
const GAP = 1;     // mm — cut line space
const COLS = 4;
const ROWS = 2;
const PER_PAGE = COLS * ROWS;

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function openProxyPrint(cards: TrackedCard[], mode: 'full' | 'missing') {
  const instances: TrackedCard[] = [];
  for (const card of cards) {
    const count = mode === 'missing' ? card.needed - card.collected : card.needed;
    for (let i = 0; i < count; i++) instances.push(card);
  }
  if (instances.length === 0) return;

  const pageCount = Math.ceil(instances.length / PER_PAGE);
  const pagesHtml: string[] = [];

  for (let p = 0; p < pageCount; p++) {
    const slice = instances.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    // Pad last page with empty slots
    while (slice.length < PER_PAGE) slice.push(null as unknown as TrackedCard);

    const cardsHtml = slice
      .map((card) =>
        card
          ? `<div class="card"><img src="${escapeHtml(card.imageLarge || card.imageSmall)}" alt="${escapeHtml(card.name)}" /></div>`
          : `<div class="card empty"></div>`
      )
      .join('');

    pagesHtml.push(`<div class="page">${cardsHtml}</div>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Proxy Print</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page {
    width: 297mm;
    height: 210mm;
    display: grid;
    grid-template-columns: repeat(${COLS}, ${CARD_W}mm);
    grid-template-rows: repeat(${ROWS}, ${CARD_H}mm);
    gap: ${GAP}mm;
    justify-content: center;
    align-content: center;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: avoid; }
  .card {
    width: ${CARD_W}mm;
    height: ${CARD_H}mm;
    overflow: hidden;
    position: relative;
  }
  /* Dashed cut line at each card edge */
  .card::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 0.3mm dashed #aaa;
    pointer-events: none;
  }
  .card img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }
  .card.empty { background: #f0f0f0; }
</style>
</head>
<body>
${pagesHtml.join('\n')}
<script>
  const imgs = Array.from(document.querySelectorAll('img'));
  if (imgs.length === 0) { window.print(); }
  else {
    let pending = imgs.length;
    function done() { if (--pending === 0) window.print(); }
    imgs.forEach(img => {
      if (img.complete) done();
      else { img.onload = done; img.onerror = done; }
    });
  }
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke after a delay to give the new tab time to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
