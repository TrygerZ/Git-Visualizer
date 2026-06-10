# GitVisualizer — Agent Guide

Interactive DAG commit graph visualizer for GitHub repos.

**Stack:** React 19, Vite 6, Tailwind CSS v4, TypeScript 5, Express 4, `@xyflow/react` 12, ELK layout, Google Gemini AI.

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (tsx) on port 3000 (NODE_ENV=development) |
| `npm run build` | Vite build + esbuild server bundle (no sourcemaps) |
| `npm start` | Production via `cross-env NODE_ENV=production node dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` (validates src/ + server.ts) |
| `npm run clean` | Remove dist/ |

No test framework or test script is configured.

## Project Structure

```
server.ts               Express bootstrap + middleware + routes (thin layer)
src/
  server/               Server logic modules
    types.ts            CommitNode, GraphElement, RepoDataResult interfaces
    cache.ts            Generic CacheStore<T> (5-min TTL, 100-entry max)
    github.ts           GitHub API, topological sort, foldTopological, branch tracing
    gemini.ts           AI summarization with tiered model fallback
  hooks/                React hooks (Clean Code: single responsibility)
    useElkLayout.ts     ELK graph layout computation
    useGraphBounds.ts   Bounds + zoom calculation
    useGraphFilter.ts   Search + playback filtering
  lib/
    commitParser.ts     Parse conventional commit messages
    getBranchColor.ts   Deterministic branch color from name hash
  components/           11 components
    CommitGraph.tsx     Main graph orchestration (~540 lines, was 1046)
    GraphPanels.tsx     All React Flow panel UIs
    NodeContextMenu.tsx Floating context menu
    ElkCustomEdge.tsx   Custom edge with rounded polyline
    CommitNode.tsx      Single commit visual node
    FoldedNode.tsx      Collapsed linear segment capsule
    AiSummaryPanel.tsx  AI code review panel (+ hook)
    ErrorBoundary.tsx   Error boundary wrapping the graph
    SearchBar.tsx       Animated search input
    RepoInput.tsx       Repository URL + settings input
    ContributorPanel.tsx + ContributorLeaderboard.tsx
  App.tsx               Root component (language toggle, search, error, graph mount)
  main.tsx              Entry point
  types.ts              Shared frontend interfaces (GitCommit, FoldedNode, RepoData)
  index.css             Tailwind v4 imports + theme + React Flow overrides
index.html              Vite entry HTML
AGENTS.md               This file
```

## Critical Gotchas

- **Tailwind v4** syntax: use `@import "tailwindcss"`, NOT `@tailwind base/...`
- **`motion`** library (v12), not framer-motion — import from `'motion/react'`
- **`@xyflow/react`** (v12), not the older `reactflow` package
- **No ESLint, Prettier, or Biome** — only `tsc --noEmit` for validation
- **No test framework** exists — add from scratch if needed
- **Bilingual UI** via inline translation objects per component (en/id), no i18n library
- **Gemini API** requires `GEMINI_API_KEY` env var for AI summaries
- **Server listens on `0.0.0.0`** (all interfaces)
- **NODE_ENV** is set by scripts: `npm run dev` → development, `npm start` → production
- **In-memory cache** (`src/server/cache.ts`) — generic CacheStore<T> with 5-min TTL, 100-entry max
- **Zero `any` types** in server code and hooks — all proper TypeScript interfaces
- **cross-env** required for cross-platform NODE_ENV in start script

## Build Quirks

- Dev: `set NODE_ENV=development&& tsx server.ts` (Windows CMD — npm uses CMD by default)
- Prod: `vite build` (frontend to dist/) + `esbuild server.ts --bundle --platform=node --format=cjs --packages=external` to dist/server.cjs
- No sourcemaps in production build
- Server expects node_modules at runtime in production

## Security

- **Helmet** middleware with CSP (img-src includes avatars.githubusercontent.com)
- **Body size limited** to 1mb (prevents DoS)
- **Rate limiters** (express-rate-limit): `/api/summarize` 10/min, `/api/repo` 30/min, `/api/commit-diff` 60/min
- **Input validation** on all string parameters (length-bounded)
- **SSRF protection** via `endsWith('github.com')` hostname check
- **Global error handler** catches unhandled errors, returns generic messages
- **No credential leakage** — error.message never sent to client

## Data Flow

1. `GET /api/repo?url=...` → GitHub API → topological sort → `foldTopological` (linear segment folding) → ELK layout (client-side) → React Flow rendering
2. `GET /api/commit-diff?repo=...&commitId=...` → GitHub API → diff display + AI summarization
3. `POST /api/summarize` → Gemini API (tiered model fallback: 2.5-flash → 2.0-flash → 1.5-flash)
4. AbortController + 15s timeout on all frontend fetch calls
5. Prompt injection protection via `[COMMIT_MESSAGE_START]/[COMMIT_MESSAGE_END]` delimiters

## Debugging

- **`tsc --noEmit`** validates both `src/` and `server.ts` (via `"include": ["src", "server.ts"]`)
- **Centralized error handler** catches unhandled Express errors
- **No React ErrorBoundary** — errors are caught only at App level via try/catch. Wrap graph area in ErrorBoundary for resilience.
- **Logging** uses raw `console.log/warn/error` — no structured logger. Add server-side request logging when debugging API issues.
- **Gemini API fallback:** Model tries `2.5-flash` → `2.0-flash` → `1.5-flash`. Each failure logs `[TIER N]` prefix via console.warn.
- **In-memory cache:** `src/server/cache.ts` — `CacheStore<T>` with TTL + LRU eviction. Lost on restart.
- **`tsx` remote inspect:** `npx tsx --inspect server.ts` for Node.js inspector debugging
- **TypeScript:** `tsconfig.json` has `"include": ["src", "server.ts"]` — server code is type-checked

## Testing

No test framework is configured. To add tests:

- **Frontend:** Install vitest + @testing-library/react (project uses Vite, so vitest integrates naturally)
- **Backend:** Use node:test, vitest, or jest
- **Demo route:** `GET /api/repo?url=https://github.com/demo/rate-limit&demo=true` returns mock data — useful for UI testing without hitting GitHub API
- **Rate-limit testing:** Hit `/api/repo` without a PAT to trigger the rate-limit error banner UI
