import OpenAI from 'openai';
import https from 'node:https';
import { Article, ReviewCriteria, ReviewStartConfig } from '../types/index.js';
import { sessionStore } from './sessionStore.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

interface AiDecision {
  decision: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reasoning: string;
  primaryExclusionReason: string;
}

async function reviewSingleArticle(
  article: Article,
  criteria: ReviewCriteria,
  client: OpenAI,
  model: string,
): Promise<AiDecision> {
  const inc = criteria.inclusionCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const exc = criteria.exclusionCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const userPrompt = `You are an expert academic literature reviewer conducting title and abstract screening for a ${criteria.reviewType} review titled: "${criteria.reviewTitle}".

INCLUSION CRITERIA (article must satisfy all applicable criteria to be included):
${inc || '1. Relevant to the review topic'}

EXCLUSION CRITERIA (article is excluded if any criterion applies):
${exc || 'None specified'}

ARTICLE:
Title: ${article.title}
Abstract: ${article.abstract || '[No abstract available – base decision on title only]'}${article.year ? `\nYear: ${article.year}` : ''}${article.journal ? `\nJournal: ${article.journal}` : ''}

Decision options:
- "include": article clearly meets inclusion criteria and does not trigger any exclusion criteria
- "exclude": article clearly fails inclusion criteria or triggers an exclusion criterion
- "maybe": abstract is too vague or absent to make a confident decision (moves to full-text review)

Respond with this JSON object and nothing else:
{
  "decision": "include" | "exclude" | "maybe",
  "confidence": <integer 50-100>,
  "reasoning": "<2-3 sentence justification referencing specific criteria>",
  "primaryExclusionReason": "<brief phrase if excluded, empty string otherwise>"
}`;

  const isGpt5 = /^gpt-5/i.test(model);
  const response = await client.chat.completions.create({
    model,
    ...(isGpt5 ? { max_completion_tokens: 512 } : { max_tokens: 512 }),
    messages: [
      {
        role: 'system',
        content: 'You are an expert academic literature reviewer. Respond only with valid JSON.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Unexpected AI response: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);
  const decision = ['include', 'exclude', 'maybe'].includes(parsed.decision)
    ? (parsed.decision as 'include' | 'exclude' | 'maybe')
    : 'maybe';

  return {
    decision,
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
    reasoning: String(parsed.reasoning || 'No reasoning provided.'),
    primaryExclusionReason: String(parsed.primaryExclusionReason || ''),
  };
}

export async function startReview(sessionId: string, config: ReviewStartConfig = {}): Promise<void> {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error('Session not found');

  const key = config.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No API key provided');

  const model = config.model?.trim() || DEFAULT_MODEL;

  // SSL bypass — needed on corporate/university networks with certificate inspection
  const sslBypass =
    config.sslBypass === true ||
    process.env.SSL_BYPASS === 'true' ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';

  const clientOpts: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: key,
    baseURL: config.apiBaseUrl?.trim() || undefined,
  };

  if (sslBypass) {
    clientOpts.httpAgent = new https.Agent({ rejectUnauthorized: false });
    console.warn('[AI] SSL verification disabled (SSL_BYPASS=true)');
  }

  const client = new OpenAI(clientOpts);

  sessionStore.update(sessionId, { status: 'reviewing', startedAt: new Date().toISOString() });
  sessionStore.emit(sessionId, 'status', { status: 'reviewing' });

  const toReview = session.articles.filter(a => !a.isDuplicate);
  let reviewed = 0;

  for (const article of toReview) {
    let decision: AiDecision;

    try {
      decision = await reviewSingleArticle(article, session.criteria, client, model);
    } catch (err) {
      console.error(`[AI] Failed to review "${article.title}":`, err);
      decision = {
        decision: 'maybe',
        confidence: 0,
        reasoning: 'Automatic review failed. Please assess manually.',
        primaryExclusionReason: '',
      };
    }

    reviewed++;
    const current = sessionStore.get(sessionId)!;
    const updatedArticles = current.articles.map(a =>
      a.id !== article.id
        ? a
        : {
            ...a,
            decision: decision.decision,
            aiReasoning: decision.reasoning,
            aiConfidence: decision.confidence,
            primaryExclusionReason: decision.primaryExclusionReason,
            originalAiDecision: decision.decision,
          },
    );

    sessionStore.update(sessionId, { articles: updatedArticles, reviewedCount: reviewed });
    sessionStore.emit(sessionId, 'article_reviewed', {
      article: { ...article, ...decision, originalAiDecision: decision.decision },
      progress: { current: reviewed, total: toReview.length },
    });

    // Throttle to avoid rate limits (~3 req/s)
    await new Promise(r => setTimeout(r, 350));
  }

  sessionStore.update(sessionId, { status: 'complete', completedAt: new Date().toISOString() });
  sessionStore.emit(sessionId, 'complete', { status: 'complete' });
}
