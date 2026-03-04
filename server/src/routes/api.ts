import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { parseRisFile } from '../services/risParser.js';
import { sessionStore } from '../services/sessionStore.js';
import { startReview } from '../services/aiReviewer.js';
import { ArticleDecisionOverride, ReviewSession, ReviewStartConfig } from '../types/index.js';

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ── POST /api/sessions ──────────────────────────────────────────────────────
// Create session with criteria + RIS file
router.post('/sessions', upload.single('risFile'), (req: Request, res: Response) => {
  try {
    const reviewTitle = String(req.body.reviewTitle || '');
    const reviewType = String(req.body.reviewType || 'systematic');
    const inclusionCriteria = String(req.body.inclusionCriteria || '[]');
    const exclusionCriteria = String(req.body.exclusionCriteria || '[]');

    if (!reviewTitle || !req.file) {
      res.status(400).json({ error: 'reviewTitle and risFile are required' });
      return;
    }

    const inc: string[] = JSON.parse(inclusionCriteria);
    const exc: string[] = JSON.parse(exclusionCriteria);

    const risContent = req.file.buffer.toString('utf-8');
    const { articles, duplicatesRemoved } = parseRisFile(risContent);

    if (articles.length === 0) {
      res.status(400).json({ error: 'No articles found in RIS file' });
      return;
    }

    const nonDuplicates = articles.filter(a => !a.isDuplicate);

    const session: ReviewSession = {
      id: uuidv4(),
      criteria: {
        reviewTitle,
        reviewType: (['systematic', 'scoping', 'narrative', 'other'].includes(reviewType) ? reviewType : 'systematic') as ReviewSession['criteria']['reviewType'],
        inclusionCriteria: inc,
        exclusionCriteria: exc,
      },
      articles,
      status: 'setup',
      reviewedCount: 0,
      totalCount: nonDuplicates.length,
      duplicatesRemoved,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    };

    sessionStore.set(session);
    res.json({
      sessionId: session.id,
      totalArticles: articles.length,
      uniqueArticles: nonDuplicates.length,
      duplicatesRemoved,
    });
  } catch (err) {
    console.error('[POST /sessions]', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/sessions/:id ───────────────────────────────────────────────────
router.get('/sessions/:id', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

// ── POST /api/sessions/:id/start ─────────────────────────────────────────
// Start AI review (non-blocking)
router.post('/sessions/:id/start', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (session.status === 'reviewing') { res.json({ message: 'Review already in progress' }); return; }

  const config: ReviewStartConfig = {
    apiKey:     req.body.apiKey     ? String(req.body.apiKey)     : undefined,
    apiBaseUrl: req.body.apiBaseUrl ? String(req.body.apiBaseUrl) : undefined,
    model:      req.body.model      ? String(req.body.model)      : undefined,
    sslBypass:  req.body.sslBypass  === true || req.body.sslBypass === 'true',
  };

  // Fire and forget; errors are emitted via SSE
  startReview(p(req.params.id), config).catch(err => {
    sessionStore.update(p(req.params.id), { status: 'error', errorMessage: String(err) });
    sessionStore.emit(p(req.params.id), 'error', { message: String(err) });
  });

  res.json({ started: true });
});

// ── GET /api/sessions/:id/stream ───────────────────────────────────────────
// Server-Sent Events stream for live updates
router.get('/sessions/:id/stream', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Immediately push current state
  send('init', session);

  const listener = (event: string, data: unknown) => send(event, data);
  sessionStore.addListener(p(req.params.id), listener);

  req.on('close', () => {
    sessionStore.removeListener(p(req.params.id), listener);
  });
});

// ── PATCH /api/sessions/:id/articles/:articleId ────────────────────────────
// Override AI decision
router.patch('/sessions/:id/articles/:articleId', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const override = req.body as ArticleDecisionOverride;
  if (!['include', 'exclude', 'maybe'].includes(override.decision)) {
    res.status(400).json({ error: 'Invalid decision value' });
    return;
  }

  const updatedArticles = session.articles.map(a => {
    if (a.id !== p(req.params.articleId)) return a;
    return {
      ...a,
      decision: override.decision,
      userOverride: true,
      primaryExclusionReason:
        override.decision === 'exclude' ? (override.reason || a.primaryExclusionReason) : '',
    };
  });

  sessionStore.update(p(req.params.id), { articles: updatedArticles });
  res.json({ updated: true });
});

// ── GET /api/sessions/:id/download ─────────────────────────────────────────
// Download included articles as RIS
router.get('/sessions/:id/download', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const included = session.articles.filter(
    a => a.decision === 'include' || a.decision === 'maybe',
  );

  const risContent = included.map(a => a.rawRis).join('\n\n');
  const filename = `included_articles_${session.criteria.reviewTitle.replace(/\s+/g, '_').slice(0, 40)}.ris`;

  res.setHeader('Content-Type', 'application/x-research-info-systems');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(risContent);
});

// ── GET /api/sessions/:id/export-csv ───────────────────────────────────────
// Export all articles with decisions as CSV
router.get('/sessions/:id/export-csv', (req: Request, res: Response) => {
  const session = sessionStore.get(p(req.params.id));
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

  const headers = ['Title', 'Authors', 'Year', 'Journal', 'DOI', 'Decision', 'AI Confidence', 'AI Reasoning', 'Exclusion Reason', 'User Override'];
  const rows = session.articles.map(a => [
    escape(a.title),
    escape(a.authors.join('; ')),
    escape(a.year),
    escape(a.journal),
    escape(a.doi),
    escape(a.decision),
    escape(String(a.aiConfidence)),
    escape(a.aiReasoning),
    escape(a.primaryExclusionReason),
    escape(a.userOverride ? 'Yes' : 'No'),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `review_decisions_${session.criteria.reviewTitle.replace(/\s+/g, '_').slice(0, 40)}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
