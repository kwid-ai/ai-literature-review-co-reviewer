# AI Literature Review Co-Reviewer

An AI-assisted title and abstract screening tool for systematic, scoping, and narrative literature reviews — inspired by Covidence. Upload your RIS search export and screening criteria; AI screens every article and streams decisions back in real time.

---

## Features

- **AI screening** — each article's title and abstract is evaluated against your criteria by Claude, with a decision (Include / Exclude / Uncertain), confidence score, and written justification
- **Live streaming** — decisions appear as they are made via Server-Sent Events; no waiting for a batch to finish
- **Duplicate detection** — articles with identical normalised titles are flagged and removed before screening
- **Reviewer override** — expand any article card to read the AI's reasoning and change the decision; overrides are tracked separately
- **PRISMA 2020 diagram** — a compliant SVG flow diagram is generated automatically and can be downloaded
- **Exports** — download included articles as `.ris` (ready for your reference manager) or all decisions as `.csv`
- **Flexible AI backend** — choose from preset Claude models, enter a custom model ID, or point to any Anthropic-compatible base URL

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

---

## Installation

```bash
npm install
```

---

## Running

### Development (hot reload)

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| React UI (Vite) | http://localhost:5173 |
| API server | http://localhost:3001 |

### Production (single process)

```bash
npm run build        # compiles client → client/dist  and  server → server/dist
npm start            # serves everything from http://localhost:3001
```

Or in one step:

```bash
npm run build:start
```

Set `PORT=8080` (or any value) in `.env` to change the listening port.

---

## Usage

### 1 — Setup

| Field | Notes |
|-------|-------|
| **Review Title** | Used in file names and the PRISMA diagram |
| **Review Type** | Systematic / Scoping / Narrative / Other — influences the AI's framing |
| **Inclusion Criteria** | One criterion per line; bullet points and numbers are stripped automatically |
| **Exclusion Criteria** | Same format; the AI excludes an article if *any* criterion applies |
| **RIS File** | Export from PubMed, Scopus, Web of Science, CINAHL, Embase, etc. |
| **API Key** | Anthropic key — held only in browser `sessionStorage`, never sent to any server except the local one you're running |
| **Model** | Model of choice|
| **API Base URL** | Advanced — leave blank for the standard openai endpoint; set to route through a proxy or OpenRouter |

### 2 — Review

The AI reviews articles sequentially and streams each result as it completes. For every article you can see:

- **Decision badge** — Include (green), Exclude (red), or Uncertain (amber)
- **Confidence score** — 50–100 %; reflects how clearly the abstract matched the criteria
- **AI reasoning** — 2–3 sentence justification referencing the specific criteria that drove the decision
- **Primary exclusion reason** — short phrase for excluded articles, aggregated in the PRISMA diagram

Click **Details** on any card to read the full abstract and override the AI's decision. Overrides are flagged so you can distinguish human and AI decisions in the export.

**Decision definitions:**

| Decision | Meaning |
|----------|---------|
| Include | Article clearly meets inclusion criteria and does not trigger any exclusion criterion |
| Exclude | Article clearly fails inclusion criteria or triggers an exclusion criterion |
| Uncertain | Abstract is too vague or absent to decide — included for full-text review |

### 3 — Results

- **PRISMA diagram** — shows the full identification → screening → included flow with counts and exclusion reason breakdown; download as SVG
- **Article tabs** — browse Included / Excluded / Uncertain / All with override capability still available
- **Download Included (.ris)** — includes both *Include* and *Uncertain* articles (both advance to full-text review)
- **Export All (.csv)** — every article with title, authors, year, journal, DOI, decision, confidence, AI reasoning, exclusion reason, and override flag

---

## Configuration

### Adjusting the request delay

The reviewer pauses 350 ms between articles to stay within API rate limits. Change the value in `aiReviewer.ts` if needed:

```ts
await new Promise(r => setTimeout(r, 350));
```

---

## Project structure

```
review-system/
├── package.json                 root — npm workspaces + dev/build/start scripts
├── .env.example
│
├── server/                      Express API + AI reviewer
│   └── src/
│       ├── index.ts             entry point; serves built client in production
│       ├── types/index.ts       shared types
│       ├── routes/api.ts        REST endpoints + SSE stream
│       └── services/
│           ├── risParser.ts     parses RIS files; detects duplicates
│           ├── sessionStore.ts  in-memory session store + SSE listener registry
│           └── aiReviewer.ts    Claude API calls; streams results per article
│
└── client/                      React + Vite + Tailwind
    └── src/
        ├── App.tsx              state machine: setup → review → results
        ├── pages/
        │   ├── SetupPage.tsx    criteria input, RIS upload, AI config
        │   ├── ReviewPage.tsx   live SSE dashboard, filter tabs, override UI
        │   └── ResultsPage.tsx  PRISMA diagram, article tabs, downloads
        ├── components/
        │   ├── ArticleCard.tsx      expandable card with reasoning + override buttons
        │   └── PrismaFlowDiagram.tsx  custom SVG PRISMA 2020 diagram
        └── utils/risExporter.ts  client-side RIS / CSV / SVG download helpers
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create session (multipart: `risFile` + criteria fields) |
| `GET` | `/api/sessions/:id` | Get full session state |
| `POST` | `/api/sessions/:id/start` | Start AI review — body: `{ apiKey?, apiBaseUrl?, model? }` |
| `GET` | `/api/sessions/:id/stream` | SSE stream — events: `init`, `article_reviewed`, `complete`, `error` |
| `PATCH` | `/api/sessions/:id/articles/:articleId` | Override decision — body: `{ decision, reason? }` |
| `GET` | `/api/sessions/:id/download` | Download included articles as `.ris` |
| `GET` | `/api/sessions/:id/export-csv` | Export all decisions as `.csv` |

---

## Notes

- Sessions are held **in memory** — they are lost if the server restarts. For a long review, keep the server running until you have downloaded your results.
- The browser stores `sessionId`, `apiKey`, `apiBaseUrl`, and `model` in `sessionStorage` (tab-scoped, cleared on tab close). Your API key is never written to disk.
- The PRISMA diagram treats *Uncertain* articles as included (they proceed to full-text review). The legend notes the split between confirmed *Include* and *Uncertain* counts.
