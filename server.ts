import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Octokit } from "octokit";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fetchCommitDiff, foldTopological, fetchRepoData, validateGithubUrl } from "./src/server/github";
import { CacheStore } from "./src/server/cache";
import { generateSummary } from "./src/server/gemini";
import { CommitNode, RepoDataResult } from "./src/server/types";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const repoCache = new CacheStore<RepoDataResult>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "avatars.githubusercontent.com"],
        connectSrc: ["'self'", "ws:", "https://api.github.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
      },
    },
  }));

  const repoLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many requests, please try again later.' } });

  // API Route: Fetch Repo Data
  app.get("/api/repo", repoLimiter, async (req, res) => {
    const { url } = req.query;
    const clientToken = req.headers['x-github-token'] as string;
    
    // Use client token if provided, fallback to environment variable
    const currentOctokit = clientToken 
      ? new Octokit({ auth: clientToken }) 
      : octokit;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "GitHub URL is required" });
    }

    try {
      const parsed = validateGithubUrl(url);
      if (!parsed) return res.status(400).json({ error: "Invalid GitHub URL format" });
      const { owner, repo } = parsed;

      const cacheKey = `${owner}/${repo}`;
      const cached = repoCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Demo route to test rate limit banner
      if (owner === "demo" && repo === "rate-limit") {
        if (!clientToken) {
           return res.status(403).json({ error: "Batas permintaan (Rate Limit) GitHub API tercapai. Anda bisa menggunakan GitHub Personal Access Token (PAT) Anda sendiri lewat tombol Setting di samping tombol Visualize." });
        } else {
           const mockNodes = [
              {
                id: "demo2",
                sha: "demo2",
                parents: ["demo1"],
                message: "Add support for GITHUB_TOKEN to bypass rate limits",
                author: "demo",
                date: new Date().toISOString(),
                github_url: "https://github.com/demo/rate-limit",
                branch: "main",
                author_avatar: null,
                author_url: null,
              },
              {
                id: "demo1",
                sha: "demo1",
                parents: [],
                message: "Initial commit",
                author: "demo",
                date: new Date(Date.now() - 86400000).toISOString(),
                github_url: "https://github.com/demo/rate-limit",
                branch: "main",
                author_avatar: null,
                author_url: null,
              }
           ];
           return res.json({
             owner,
             repo,
             elements: foldTopological(mockNodes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
           });
        }
      }

      const result = await fetchRepoData(currentOctokit, owner, repo);
      repoCache.set(cacheKey, result);
      res.json(result);
    } catch (error: unknown) {
      console.error("GitHub API Error:", error);
      const err = error as { status?: number; message?: string };
      if (err.status === 401) {
        return res.status(401).json({ error: "Token GitHub (PAT) yang Anda masukkan tidak valid (Unauthorized)." });
      }
      if (err.status === 404) {
        return res.status(404).json({ error: "Repository not found or is private" });
      }
      if (err.status === 403 || err.status === 429) {
        return res.status(err.status).json({ error: "Batas permintaan (Rate Limit) GitHub API tercapai. Anda bisa menggunakan GitHub Personal Access Token (PAT) Anda sendiri lewat tombol Setting di samping tombol Visualize." });
      }
      res.status(500).json({ error: "Failed to fetch repository data" });
    }
  });

  const commitDiffLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please try again later.' },
  });

  app.get('/api/commit-diff', commitDiffLimiter, async (req, res) => {
    try {
      const repo = String(req.query.repo || '');
      const commitId = String(req.query.commitId || '');
      const token = (req.headers['x-github-token'] as string) || '';
      const parts = repo.split('/');
      if (parts.length !== 2) {
        return res.status(400).json({ error: 'Invalid repo format. Use owner/repo' });
      }
      const [owner, repoName] = parts;
      const currentOctokit = new Octokit({ auth: token || process.env.GITHUB_TOKEN });
      const diff = await fetchCommitDiff(currentOctokit, owner, repoName, commitId);
      res.json(diff);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch commit diff:', message);
      res.status(500).json({ error: 'Gagal mengambil diff commit' });
    }
  });

  const summarizeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many requests, please try again later.' } });

  // API Route: AI Summarize
  app.post("/api/summarize", summarizeLimiter, async (req, res) => {
    const { message, rawDiff, language = 'en' } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
    }

    if (!rawDiff) {
      return res.status(400).json({ error: "rawDiff is required" });
    }

    try {
      const summary = await generateSummary(process.env.GEMINI_API_KEY!, message, rawDiff, language);
      res.json({ summary });
    } catch (error: unknown) {
      console.error("AI summarization error:", error);
      res.status(500).json({ error: "Failed to generate AI summary" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
