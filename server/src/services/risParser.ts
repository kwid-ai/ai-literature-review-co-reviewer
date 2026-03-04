import { Article } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

type RisRecord = Record<string, string[]>;

function parseRisText(text: string): RisRecord[] {
  const records: RisRecord[] = [];
  let current: RisRecord = {};

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('ER')) {
      if (Object.keys(current).length > 0) {
        records.push(current);
        current = {};
      }
      continue;
    }

    if (trimmed === '') continue;

    // Standard RIS line: "TAG  - value" (2 chars + 2-3 spaces + dash + space)
    const match = trimmed.match(/^([A-Z][A-Z0-9])\s{1,3}-\s?(.*)$/);
    if (match) {
      const [, tag, value] = match;
      if (!current[tag]) current[tag] = [];
      if (value.trim()) current[tag].push(value.trim());
    } else if (trimmed && Object.keys(current).length > 0) {
      // Continuation line for multi-line abstract
      const lastTag = Object.keys(current).at(-1);
      if (lastTag && (lastTag === 'AB' || lastTag === 'N2')) {
        const arr = current[lastTag];
        arr[arr.length - 1] += ' ' + trimmed;
      }
    }
  }

  if (Object.keys(current).length > 0) records.push(current);
  return records;
}

function extractTitle(r: RisRecord): string {
  return r['TI']?.[0] || r['T1']?.[0] || r['CT']?.[0] || r['BT']?.[0] || 'Untitled';
}

function extractAbstract(r: RisRecord): string {
  return r['AB']?.[0] || r['N2']?.[0] || '';
}

function extractAuthors(r: RisRecord): string[] {
  return r['AU'] || r['A1'] || r['A2'] || [];
}

function extractYear(r: RisRecord): string {
  const raw = r['PY']?.[0] || r['Y1']?.[0] || r['DA']?.[0] || '';
  return raw.split(/[\/\-]/)[0].trim().slice(0, 4);
}

function extractJournal(r: RisRecord): string {
  return r['JO']?.[0] || r['JF']?.[0] || r['T2']?.[0] || r['J1']?.[0] || r['J2']?.[0] || '';
}

function extractDoi(r: RisRecord): string {
  return r['DO']?.[0] || r['M3']?.[0] || '';
}

function extractKeywords(r: RisRecord): string[] {
  return r['KW'] || r['DE'] || r['ID'] || [];
}

function recordToRis(r: RisRecord): string {
  const lines: string[] = [];
  const order = ['TY', 'TI', 'AU', 'AB', 'PY', 'JO', 'JF', 'T2', 'DO', 'KW', 'UR'];
  const seen = new Set<string>();

  for (const tag of order) {
    if (r[tag]) {
      for (const v of r[tag]) lines.push(`${tag}  - ${v}`);
      seen.add(tag);
    }
  }
  for (const [tag, vals] of Object.entries(r)) {
    if (!seen.has(tag)) {
      for (const v of vals) lines.push(`${tag}  - ${v}`);
    }
  }
  lines.push('ER  - ');
  return lines.join('\n');
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export function parseRisFile(content: string): { articles: Article[]; duplicatesRemoved: number } {
  const records = parseRisText(content);
  const seenTitles = new Map<string, string>();
  const articles: Article[] = [];
  let duplicatesRemoved = 0;

  for (const record of records) {
    const title = extractTitle(record);
    const norm = normalizeTitle(title);
    const isDuplicate = norm.length > 3 && seenTitles.has(norm);

    if (!isDuplicate && norm.length > 3) seenTitles.set(norm, title);
    if (isDuplicate) duplicatesRemoved++;

    articles.push({
      id: uuidv4(),
      title,
      abstract: extractAbstract(record),
      authors: extractAuthors(record),
      year: extractYear(record),
      journal: extractJournal(record),
      doi: extractDoi(record),
      keywords: extractKeywords(record),
      rawRis: recordToRis(record),
      decision: isDuplicate ? 'exclude' : 'pending',
      aiReasoning: isDuplicate ? 'Duplicate record removed before screening.' : '',
      aiConfidence: isDuplicate ? 100 : 0,
      primaryExclusionReason: isDuplicate ? 'Duplicate' : '',
      userOverride: false,
      originalAiDecision: null,
      isDuplicate,
    });
  }

  return { articles, duplicatesRemoved };
}
