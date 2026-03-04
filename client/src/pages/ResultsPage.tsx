import { useState, useMemo } from 'react';
import { ReviewSession, PrismaStats } from '../types/index.js';
import PrismaFlowDiagram from '../components/PrismaFlowDiagram.js';
import ArticleCard from '../components/ArticleCard.js';
import { downloadRis, downloadCsv } from '../utils/risExporter.js';

interface Props {
  session: ReviewSession;
  onNewReview: () => void;
}

type Tab = 'prisma' | 'included' | 'excluded' | 'maybe' | 'all';

export default function ResultsPage({ session, onNewReview }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('prisma');
  const [articles, setArticles] = useState(session.articles);

  const nonDups = articles.filter(a => !a.isDuplicate);

  const stats: PrismaStats = useMemo(() => {
    const excluded = nonDups.filter(a => a.decision === 'exclude');
    const reasons: Record<string, number> = {};
    for (const a of excluded) {
      const r = a.primaryExclusionReason?.trim() || 'Other';
      reasons[r] = (reasons[r] ?? 0) + 1;
    }
    return {
      identified: articles.length,
      duplicatesRemoved: session.duplicatesRemoved,
      screened: nonDups.length,
      included: nonDups.filter(a => a.decision === 'include').length,
      excluded: excluded.length,
      maybe: nonDups.filter(a => a.decision === 'maybe').length,
      exclusionReasons: reasons,
    };
  }, [articles, nonDups, session.duplicatesRemoved]);

  const handleOverride = async (id: string, decision: 'include' | 'exclude' | 'maybe', reason?: string) => {
    await fetch(`/api/sessions/${session.id}/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    });
    setArticles(prev => prev.map(a =>
      a.id === id
        ? { ...a, decision, userOverride: true, primaryExclusionReason: decision === 'exclude' ? (reason || a.primaryExclusionReason) : '' }
        : a,
    ));
  };

  const reviewSlug = session.criteria.reviewTitle.replace(/\s+/g, '_').slice(0, 40);

  const TABS: { key: Tab; label: string; count?: number; color: string }[] = [
    { key: 'prisma', label: 'PRISMA Diagram', color: 'text-blue-700' },
    { key: 'included', label: 'Included', count: stats.included, color: 'text-emerald-700' },
    { key: 'maybe', label: 'Uncertain', count: stats.maybe, color: 'text-amber-700' },
    { key: 'excluded', label: 'Excluded', count: stats.excluded, color: 'text-red-700' },
    { key: 'all', label: 'All Articles', count: nonDups.length, color: 'text-slate-700' },
  ];

  const tabArticles = nonDups.filter(a => {
    if (activeTab === 'included') return a.decision === 'include';
    if (activeTab === 'excluded') return a.decision === 'exclude';
    if (activeTab === 'maybe') return a.decision === 'maybe';
    if (activeTab === 'all') return true;
    return false;
  });

  const overriddenCount = nonDups.filter(a => a.userOverride).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Review Complete</p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">{session.criteria.reviewTitle}</h1>
              <p className="text-xs text-slate-500 mt-1 capitalize">
                {session.criteria.reviewType} review
                {overriddenCount > 0 && ` · ${overriddenCount} decisions overridden by reviewer`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadRis(nonDups.filter(a => a.decision === 'include' || a.decision === 'maybe'), `included_${reviewSlug}.ris`)}
                className="text-xs px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
              >
                Download Included (.ris)
              </button>
              <button
                onClick={() => downloadCsv(nonDups, `decisions_${reviewSlug}.csv`)}
                className="text-xs px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors"
              >
                Export All (.csv)
              </button>
              <button
                onClick={onNewReview}
                className="text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                New Review
              </button>
            </div>
          </div>

          {/* Summary chips */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: 'Identified', v: stats.identified, color: 'bg-slate-100 text-slate-700' },
              { label: 'Duplicates removed', v: stats.duplicatesRemoved, color: 'bg-slate-100 text-slate-500' },
              { label: 'Screened', v: stats.screened, color: 'bg-blue-50 text-blue-700' },
              { label: 'Include', v: stats.included, color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Uncertain', v: stats.maybe, color: 'bg-amber-50 text-amber-700' },
              { label: 'Exclude', v: stats.excluded, color: 'bg-red-50 text-red-700' },
            ].map(c => (
              <div key={c.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${c.color}`}>
                {c.label}: {c.v}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 border-b border-slate-200 -mb-px">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === t.key
                    ? `${t.color} border-current`
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-current/10 text-current text-xs">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'prisma' ? (
          <div className="space-y-6">
            <PrismaFlowDiagram stats={stats} reviewTitle={session.criteria.reviewTitle} />

            {/* Criteria recap */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">Inclusion Criteria</h3>
                <ul className="space-y-1.5">
                  {session.criteria.inclusionCriteria.length > 0
                    ? session.criteria.inclusionCriteria.map((c, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-2">
                          <span className="text-emerald-500 shrink-0">✓</span>{c}
                        </li>
                      ))
                    : <li className="text-xs text-slate-400 italic">No criteria specified</li>
                  }
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Exclusion Criteria</h3>
                <ul className="space-y-1.5">
                  {session.criteria.exclusionCriteria.length > 0
                    ? session.criteria.exclusionCriteria.map((c, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-2">
                          <span className="text-red-400 shrink-0">✗</span>{c}
                        </li>
                      ))
                    : <li className="text-xs text-slate-400 italic">No criteria specified</li>
                  }
                </ul>
              </div>
            </div>

            {/* Exclusion reason breakdown */}
            {Object.keys(stats.exclusionReasons).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Exclusion Reasons Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(stats.exclusionReasons)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <div key={reason} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="truncate text-slate-700">{reason}</span>
                            <span className="text-slate-500 shrink-0 ml-2">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{ width: `${(count / stats.excluded) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tabArticles.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                No articles in this category.
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  {tabArticles.length} article{tabArticles.length !== 1 ? 's' : ''} — click any card to see AI reasoning and override the decision.
                </p>
                {tabArticles.map(a => (
                  <ArticleCard key={a.id} article={a} onOverride={handleOverride} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
