import { Article } from '../types/index.js';

export function downloadRis(articles: Article[], filename: string): void {
  const content = articles.map(a => a.rawRis).join('\n\n');
  triggerDownload(content, filename, 'application/x-research-info-systems');
}

export function downloadCsv(articles: Article[], filename: string): void {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const headers = ['Title', 'Authors', 'Year', 'Journal', 'DOI', 'Decision', 'Confidence', 'AI Reasoning', 'Exclusion Reason', 'User Override'];
  const rows = articles.map(a => [
    esc(a.title),
    esc(a.authors.join('; ')),
    esc(a.year),
    esc(a.journal),
    esc(a.doi),
    esc(a.decision),
    esc(String(a.aiConfidence)),
    esc(a.aiReasoning),
    esc(a.primaryExclusionReason),
    esc(a.userOverride ? 'Yes' : 'No'),
  ].join(','));
  triggerDownload([headers.join(','), ...rows].join('\n'), filename, 'text/csv');
}

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSvg(svgElement: SVGElement, filename: string): void {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgElement);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
