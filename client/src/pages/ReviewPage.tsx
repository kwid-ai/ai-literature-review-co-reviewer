import { useState, useEffect, useCallback, useRef } from 'react';
import { Article, ReviewSession } from '../types/index.js';
import ArticleCard from '../components/ArticleCard.js';

interface Props {
  sessionId: string;
  onComplete: (session: ReviewSession) => void;
}

type FilterTab = 'all' | 'include' | 'exclude' | 'maybe' | 'pending';

const TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'bg-slate-100 text-slate-700' },
  { key: 'include', label: 'Include', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'exclude', label: 'Exclude', color: 'bg-red-100 text-red-700' },
  { key: 'maybe', label: 'Uncertain', color: 'bg-amber-100 text-amber-700' },
  { key: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-500' },
];

export default function ReviewPage({ sessionId, onComplete }: Props) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState<'connecting' | 'reviewing' | 'complete' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [reviewStarted, setReviewStarted] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Start the AI review
  const startReview = useCallback(async () => {
    if (reviewStarted) return;
    setReviewStarted(true);
    const config = {
      apiKey:     sessionStorage.getItem('apiKey')     || undefined,
      apiBaseUrl: sessionStorage.getItem('apiBaseUrl') || undefined,
      model:      sessionStorage.getItem('model')      || undefined,
      sslBypass:  sessionStorage.getItem('sslBypass')  === 'true',
    };
    try {
      const res = await fetch(`/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to start review');
      }
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, [sessionId, reviewStarted]);

  // Connect SSE stream
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    esRef.current = es;

    es.addEventListener('init', e => {
      const s: ReviewSession = JSON.parse(e.data);
      setSession(s);
      setArticles(s.articles);
      if (s.status === 'complete') {
        setStatus('complete');
      } else if (s.status === 'reviewing') {
        setStatus('reviewing');
      } else {
        setStatus('reviewing');
        startReview();
      }
    });

    es.addEventListener('article_reviewed', e => {
      const { article } = JSON.parse(e.data) as { article: Article; progress: { current: number; total: number } };
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, ...article } : a));
      setSession(prev => prev ? { ...prev, reviewedCount: prev.reviewedCount + 1 } : prev);
    });

    es.addEventListener('complete', () => {
      setStatus('complete');
      // Fetch final session
      fetch(`/api/sessions/${sessionId}`)
        .then(r => r.json())
        .then((s: ReviewSession) => {
          setSession(s);
          setArticles(s.articles);
          onComplete(s);
        });
      es.close();
    });

    es.addEventListener('error_event', (e: MessageEvent) => {
      const { message } = JSON.parse(e.data);
      setError(message);
      setStatus('error');
      es.close();
    });

    es.onerror = () => {
      if (status !== 'complete') {
        setError('Connection to server lost. Refresh to reconnect.');
      }
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleOverride = async (id: string, decision: 'include' | 'exclude' | 'maybe', reason?: string) => {
    await fetch(`/api/sessions/${sessionId}/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, decision, userOverride: true, primaryExclusionReason: decision === 'exclude' ? (reason || a.primaryExclusionReason) : '' } : a));
  };

  const nonDups = articles.filter(a => !a.isDuplicate);
  const counts = {
    include: nonDups.filter(a => a.decision === 'include').length,
    exclude: nonDups.filter(a => a.decision === 'exclude').length,
    maybe: nonDups.filter(a => a.decision === 'maybe').length,
    pending: nonDups.filter(a => a.decision === 'pending').length,
  };
  const reviewed = counts.include + counts.exclude + counts.maybe;
  const total = nonDups.length;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const filteredArticles = nonDups.filter(a => {
    if (filter !== 'all' && a.decision !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.abstract.toLowerCase().includes(q) || a.authors.some(au => au.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">📚</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">AI Review In Progress</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{session?.criteria.reviewTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700 animate-pulse'
              }`}>
                {status === 'connecting' ? 'Connecting…' :
                 status === 'reviewing' ? `Reviewing… ${pct}%` :
                 status === 'complete' ? 'Complete' : 'Error'}
              </span>
              {status === 'complete' && (
                <button
                  onClick={() => onComplete(session!)}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  View Results →
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Include', value: counts.include, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'Exclude', value: counts.exclude, color: 'text-red-700 bg-red-50 border-red-200' },
            { label: 'Uncertain', value: counts.maybe, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Pending', value: counts.pending, color: 'text-slate-500 bg-slate-50 border-slate-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter + search */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filter === tab.key
                    ? `${tab.color} border-current/30 shadow-sm`
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1 opacity-60">
                    ({tab.key === 'include' ? counts.include : tab.key === 'exclude' ? counts.exclude : tab.key === 'maybe' ? counts.maybe : counts.pending})
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, abstract, author…"
            className="flex-1 min-w-48 text-xs px-3 py-1.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          />
        </div>

        {/* Article list */}
        <div className="space-y-2">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {status === 'connecting' ? 'Connecting to review stream…' : 'No articles match this filter.'}
            </div>
          ) : (
            filteredArticles.map(a => (
              <ArticleCard key={a.id} article={a} onOverride={handleOverride} />
            ))
          )}
        </div>

        <p className="text-xs text-center text-slate-400 pb-4">
          Showing {filteredArticles.length} of {nonDups.length} articles (excluding {articles.filter(a => a.isDuplicate).length} duplicates)
        </p>
      </div>
    </div>
  );
}
