import { useState, useRef } from 'react';

interface Props {
  onSessionCreated: (sessionId: string, totalArticles: number, duplicatesRemoved: number) => void;
}

const PRESET_MODELS = [
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini — Fast & affordable (recommended)' },
  { value: 'gpt-4o',        label: 'GPT-4o — Balanced' },
  { value: 'gpt-5-nano',    label: 'GPT-5 nano — Lightweight' },
  { value: 'o1-mini',       label: 'o1-mini — Reasoning model' },
  { value: '__custom__',    label: 'Custom model ID…' },
];

export default function SetupPage({ onSessionCreated }: Props) {
  const [reviewTitle, setReviewTitle]   = useState('');
  const [reviewType,  setReviewType]    = useState<'systematic' | 'scoping' | 'narrative' | 'other'>('systematic');
  const [inclusionText, setInclusionText] = useState('');
  const [exclusionText, setExclusionText] = useState('');
  const [risFile,  setRisFile]  = useState<File | null>(null);

  // AI config
  const [apiKey,      setApiKey]      = useState('');
  const [apiBaseUrl,  setApiBaseUrl]  = useState('');
  const [modelPreset, setModelPreset] = useState(PRESET_MODELS[0].value);
  const [customModel, setCustomModel] = useState('');
  const [sslBypass, setSslBypass] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveModel = modelPreset === '__custom__' ? customModel.trim() : modelPreset;

  const parseCriteria = (text: string) =>
    text.split('\n').map(l => l.replace(/^[-•*\d.]+\s*/, '').trim()).filter(Boolean);

  const handleSubmit = async () => {
    setError('');
    if (!reviewTitle.trim()) { setError('Please enter a review title.'); return; }
    if (!risFile)             { setError('Please upload a RIS file.'); return; }
    if (modelPreset === '__custom__' && !customModel.trim()) {
      setError('Please enter a custom model ID.'); return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('reviewTitle',       reviewTitle.trim());
      fd.append('reviewType',        reviewType);
      fd.append('inclusionCriteria', JSON.stringify(parseCriteria(inclusionText)));
      fd.append('exclusionCriteria', JSON.stringify(parseCriteria(exclusionText)));
      fd.append('risFile',           risFile);

      const res  = await fetch('/api/sessions', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');

      // Store AI config in sessionStorage for use when starting the review
      sessionStorage.setItem('sessionId',   data.sessionId);
      sessionStorage.setItem('apiKey',      apiKey);
      sessionStorage.setItem('apiBaseUrl',  apiBaseUrl);
      sessionStorage.setItem('model',       effectiveModel);
      sessionStorage.setItem('sslBypass',   String(sslBypass));

      onSessionCreated(data.sessionId, data.totalArticles, data.duplicatesRemoved);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-3xl mb-4 shadow-lg">
            📚
          </div>
          <h1 className="text-3xl font-bold text-slate-900">AI Literature Review Co-Reviewer</h1>
          <p className="mt-2 text-slate-500 text-sm max-w-lg mx-auto">
            Upload your search results and criteria. The AI will screen each article at the title
            and abstract level — just like a second reviewer in Covidence.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Step indicators */}
          <div className="grid grid-cols-3 border-b border-slate-200">
            {['Review Details', 'Criteria', 'Upload & Start'].map((s, i) => (
              <div key={s} className={`py-3 text-center text-xs font-semibold ${i === 0 ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                <span className="mr-1 opacity-60">{i + 1}.</span>{s}
              </div>
            ))}
          </div>

          <div className="p-8 space-y-8">
            {/* ── Review Details ── */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Review Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Review Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={e => setReviewTitle(e.target.value)}
                    placeholder="e.g. Effectiveness of mindfulness interventions in reducing anxiety"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Review Type</label>
                  <select
                    value={reviewType}
                    onChange={e => setReviewType(e.target.value as typeof reviewType)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="systematic">Systematic Review</option>
                    <option value="scoping">Scoping Review</option>
                    <option value="narrative">Narrative Review</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            {/* ── Criteria ── */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Screening Criteria</h2>
              <p className="text-xs text-slate-500 mb-4">Enter one criterion per line. You can use bullet points (-, •) or numbers.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-1">Inclusion Criteria</label>
                  <textarea
                    value={inclusionText}
                    onChange={e => setInclusionText(e.target.value)}
                    rows={6}
                    placeholder="- Human participants&#10;- Randomised controlled trials&#10;- Published after 2010&#10;- English language"
                    className="w-full rounded-lg border border-emerald-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-emerald-50/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">Exclusion Criteria</label>
                  <textarea
                    value={exclusionText}
                    onChange={e => setExclusionText(e.target.value)}
                    rows={6}
                    placeholder="- Animal studies&#10;- Case reports&#10;- Conference abstracts only&#10;- Non-English articles"
                    className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-red-50/30"
                  />
                </div>
              </div>
            </section>

            {/* ── RIS Upload ── */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Upload Search Results</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RIS File <span className="text-red-500">*</span>
                  <span className="ml-2 font-normal text-slate-400">(exported from PubMed, Scopus, Web of Science, etc.)</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    risFile ? 'border-blue-300 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {risFile ? (
                    <div>
                      <p className="text-sm font-medium text-blue-700">{risFile.name}</p>
                      <p className="text-xs text-blue-500 mt-1">{(risFile.size / 1024).toFixed(1)} KB — click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl mb-2">📄</p>
                      <p className="text-sm text-slate-600">Click to select your .ris file</p>
                      <p className="text-xs text-slate-400 mt-1">Supports any standard RIS export</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef} type="file" accept=".ris,.txt" className="hidden"
                  onChange={e => setRisFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </section>

            {/* ── AI Configuration ── */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">AI Configuration</h2>
              <div className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    API Key
                    <span className="ml-2 font-normal text-slate-400">(or set OPENAI_API_KEY in server .env)</span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-proj-…"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">Never stored — held in browser memory for this session only.</p>
                </div>

                {/* Model selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <select
                    value={modelPreset}
                    onChange={e => setModelPreset(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {PRESET_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {modelPreset === '__custom__' && (
                    <input
                      type="text"
                      value={customModel}
                      onChange={e => setCustomModel(e.target.value)}
                      placeholder="e.g. claude-haiku-4-5-20251001 or gpt-4o"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  )}
                </div>

                {/* Advanced toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                    Advanced: base URL / SSL options
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          API Base URL
                          <span className="ml-2 font-normal text-slate-400">leave blank to use the default OpenAI endpoint</span>
                        </label>
                        <input
                          type="url"
                          value={apiBaseUrl}
                          onChange={e => setApiBaseUrl(e.target.value)}
                          placeholder="https://api.openai.com/v1  (default)"
                          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Override to use OpenRouter, Azure OpenAI, a local proxy, or any OpenAI-compatible endpoint.
                        </p>
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sslBypass}
                          onChange={e => setSslBypass(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <div>
                          <p className="text-xs font-medium text-slate-700">Disable SSL certificate verification</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Enable if you get <code className="bg-slate-100 px-1 rounded">UNABLE_TO_GET_ISSUER_CERT_LOCALLY</code> errors.
                            Required on some university or corporate networks with SSL inspection.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
            >
              {loading ? 'Processing RIS file…' : 'Start AI Review →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
