# GitVisualizer — Interactive DAG commit graph visualizer for GitHub repos

**Stack:** React 19, Vite 6, Tailwind CSS v4, TypeScript 5, Express 4, @xyflow/react 12, ELKJS, Google Gemini AI, Octokit, motion v12, lucide-react

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server (tsx) on port 3000 (NODE_ENV=development) |
| `npm run build` | Vite build + esbuild server bundle (no sourcemaps) |
| `npm start` | Production via `cross-env NODE_ENV=production node dist/server.cjs` |
| `npm run lint` | `tsc --noEmit` (validates src/ + server.ts) |
| `npm run clean` | Remove dist/ |

## Key Conventions

- naming: PascalCase components (CommitNode.tsx), camelCase hooks (useElkLayout.ts), camelCase lib/utils
- styling: Tailwind CSS v4 only — use @import "tailwindcss" (NOT @tailwind base/...)
- animation: motion/react v12 library (NOT framer-motion)
- i18n: inline translation objects per component (en={}, id={}), no i18n library
- errors: try/catch on all async ops, ErrorBoundary wrapping graph area
- types: zero any in server and hooks — all proper TypeScript interfaces
- server-routes: Express async handlers with try/catch + centralized error handler

## Project Layout

server.ts              Express entry (routes + middleware + vite middleware)
src/
  server/              Backend API (github.ts, gemini.ts, cache.ts, types.ts)
  components/          11 React components (CommitGraph orchestrator, panels, nodes)
  hooks/               3 custom hooks (useElkLayout, useGraphBounds, useGraphFilter)
  lib/                 2 utilities (commitParser, getBranchColor)
  App.tsx              Root component (search, language toggle, error, graph mount)
  types.ts             Shared frontend interfaces
  index.css            Tailwind v4 imports + theme + React Flow overrides

## Critical Gotchas

- tailwind-v4: use @import "tailwindcss" (NOT @tailwind base/...)
- animation: use motion/react v12 (NOT framer-motion)
- react-flow: use @xyflow/react v12 (NOT reactflow)
- validation: tsc --noEmit only (NO ESLint, Prettier, or Biome)
- testing: no test framework configured
- i18n: inline translation objects per component (no i18n library)
- gemini: requires GEMINI_API_KEY env var
- server-host: listens on 0.0.0.0 (all interfaces)
- node-env: set via npm scripts (development/production)
- cache: in-memory CacheStore<T> (5-min TTL, 100-entry max, lost on restart)
- cross-env: required for cross-platform NODE_ENV in start script
- path-alias: @/ maps to project root (tsconfig + vite config)

## Data Flow

1. GET /api/repo?url=... → GitHub API (Octokit) → topological sort → foldTopological → ELK layout (client) → React Flow render
2. GET /api/commit-diff?repo=...&commitId=... → GitHub API → diff + AI summary
3. POST /api/summarize → Gemini AI (tiered fallback: 2.5-flash → 2.0-flash → 1.5-flash)
4. Frontend fetch: AbortController + 15s timeout on all calls
5. Prompt injection protection: [COMMIT_MESSAGE_START]/[COMMIT_MESSAGE_END] delimiters

## API Endpoints

- GET /api/repo — rate: 30/min — fetch repo commits + topology
- GET /api/commit-diff — rate: 60/min — fetch commit diff (+AI summary)
- POST /api/summarize — rate: 10/min — AI summary via Gemini
- Demo: /api/repo?url=https://github.com/demo/rate-limit&demo=true — mock data for UI testing

## Security

- helmet: CSP headers (img-src includes avatars.githubusercontent.com)
- rate-limit: per-endpoint (10/30/60 per min)
- ssrf: hostname must endWith('github.com')
- input-validation: all string params length-bounded
- no-credential-leakage: error.message never sent to client

## Debugging

- lint: tsc --noEmit validates src/ + server.ts
- logging: console.{log/warn/error} only (no structured logger)
- gemini-fallback: logs [TIER N] prefix per model failure
- cache: lost on server restart (in-memory)
- inspect: npx tsx --inspect server.ts for Node.js debugger
- rate-limit-test: hit /api/repo without PAT to trigger rate-limit banner

## Build

- dev: cross-env NODE_ENV=development tsx server.ts (port 3000)
- prod: vite build → esbuild server bundle → cross-env NODE_ENV=production node dist/server.cjs
- sourcemaps: NOT generated in production build
- runtime: server expects node_modules in production
