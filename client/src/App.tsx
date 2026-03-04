import { useState } from 'react';
import { ReviewSession, AppPage } from './types/index.js';
import SetupPage from './pages/SetupPage.js';
import ReviewPage from './pages/ReviewPage.js';
import ResultsPage from './pages/ResultsPage.js';

export default function App() {
  const [page, setPage] = useState<AppPage>('setup');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<ReviewSession | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ totalArticles: number; duplicatesRemoved: number } | null>(null);

  const handleSessionCreated = (id: string, totalArticles: number, duplicatesRemoved: number) => {
    setSessionId(id);
    setSessionInfo({ totalArticles, duplicatesRemoved });
    setPage('review');
  };

  const handleReviewComplete = (session: ReviewSession) => {
    setCompletedSession(session);
    setPage('results');
  };

  const handleNewReview = () => {
    setPage('setup');
    setSessionId(null);
    setCompletedSession(null);
    setSessionInfo(null);
    sessionStorage.removeItem('sessionId');
    sessionStorage.removeItem('apiKey');
    sessionStorage.removeItem('apiBaseUrl');
    sessionStorage.removeItem('model');
    sessionStorage.removeItem('sslBypass');
  };

  // Breadcrumb
  const steps: { key: AppPage; label: string }[] = [
    { key: 'setup', label: '1. Setup' },
    { key: 'review', label: '2. Review' },
    { key: 'results', label: '3. Results' },
  ];

  return (
    <div>
      {/* Minimal top nav — only show when not on setup page */}
      {page !== 'setup' && (
        <div className="fixed top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 h-10 flex items-center px-4 gap-4">
          <span className="text-sm font-bold text-blue-600">📚 AI Co-Reviewer</span>
          <div className="flex items-center gap-1 text-xs">
            {steps.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">›</span>}
                <span className={
                  page === s.key
                    ? 'font-semibold text-blue-600'
                    : steps.indexOf(steps.find(st => st.key === page)!) > i
                      ? 'text-slate-400 line-through'
                      : 'text-slate-400'
                }>
                  {s.label}
                </span>
              </span>
            ))}
          </div>
          {sessionInfo && (
            <span className="ml-auto text-xs text-slate-400">
              {sessionInfo.totalArticles} articles · {sessionInfo.duplicatesRemoved} duplicates removed
            </span>
          )}
        </div>
      )}

      <div className={page !== 'setup' ? 'pt-10' : ''}>
        {page === 'setup' && (
          <SetupPage onSessionCreated={handleSessionCreated} />
        )}
        {page === 'review' && sessionId && (
          <ReviewPage sessionId={sessionId} onComplete={handleReviewComplete} />
        )}
        {page === 'results' && completedSession && (
          <ResultsPage session={completedSession} onNewReview={handleNewReview} />
        )}
      </div>
    </div>
  );
}
