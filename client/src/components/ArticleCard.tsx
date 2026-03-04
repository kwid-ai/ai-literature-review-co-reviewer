import { useState } from 'react';
import { Article } from '../types/index.js';

interface Props {
  article: Article;
  onOverride: (id: string, decision: 'include' | 'exclude' | 'maybe', reason?: string) => void;
}

const DECISION_STYLES: Record<string, string> = {
  include: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  exclude: 'bg-red-50 border-red-300 text-red-900',
  maybe: 'bg-amber-50 border-amber-300 text-amber-900',
  pending: 'bg-slate-50 border-slate-300 text-slate-600',
};

const BADGE_STYLES: Record<string, string> = {
  include: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
  exclude: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  maybe: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  pending: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
};

const DECISION_LABEL: Record<string, string> = {
  include: 'Include',
  exclude: 'Exclude',
  maybe: 'Uncertain',
  pending: 'Pending',
};

export default function ArticleCard({ article, onOverride }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const confidenceColor =
    article.aiConfidence >= 80
      ? 'text-emerald-600'
      : article.aiConfidence >= 60
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className={`border rounded-lg p-4 transition-all ${DECISION_STYLES[article.decision]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE_STYLES[article.decision]}`}>
              {DECISION_LABEL[article.decision]}
              {article.userOverride && <span className="ml-1 opacity-70">(overridden)</span>}
            </span>
            {article.isDuplicate && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">
                Duplicate
              </span>
            )}
            {article.aiConfidence > 0 && (
              <span className={`text-xs font-medium ${confidenceColor}`}>
                {article.aiConfidence}% confidence
              </span>
            )}
          </div>

          <h3 className="font-medium text-sm leading-snug line-clamp-2">
            {article.title}
          </h3>

          <div className="text-xs text-current opacity-60 mt-1 space-x-2">
            {article.authors.length > 0 && (
              <span>{article.authors[0]}{article.authors.length > 1 ? ' et al.' : ''}</span>
            )}
            {article.year && <span>{article.year}</span>}
            {article.journal && <span className="italic">{article.journal}</span>}
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-xs px-2 py-1 rounded bg-white/60 hover:bg-white border border-current/20 transition-colors"
        >
          {expanded ? 'Collapse' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-current/10 pt-3">
          {article.abstract && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Abstract</p>
              <p className="text-xs leading-relaxed opacity-80">{article.abstract}</p>
            </div>
          )}

          {article.aiReasoning && (
            <div className="bg-white/50 rounded p-3">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">AI Reasoning</p>
              <p className="text-xs leading-relaxed">{article.aiReasoning}</p>
              {article.primaryExclusionReason && (
                <p className="text-xs mt-1 font-medium">
                  Primary reason: <span className="italic">{article.primaryExclusionReason}</span>
                </p>
              )}
            </div>
          )}

          {!article.isDuplicate && article.decision !== 'pending' && (
            <div className="bg-white/60 rounded p-3">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">Override Decision</p>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex gap-1">
                  {(['include', 'exclude', 'maybe'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => onOverride(article.id, d, overrideReason || undefined)}
                      disabled={article.decision === d && article.userOverride}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                        article.decision === d
                          ? 'opacity-50 cursor-default border-current/20 bg-white/30'
                          : d === 'include'
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                            : d === 'exclude'
                              ? 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                      }`}
                    >
                      {DECISION_LABEL[d]}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 bg-white min-w-0"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
