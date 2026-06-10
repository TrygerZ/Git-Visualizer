import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Octokit } from "octokit";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fetchCommitDiff, RawCommit } from "./src/server/github";
import { CommitNode, GraphElement } from "./src/server/types";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function foldTopological(commits: CommitNode[]): GraphElement[] {
  if (commits.length === 0) return [];

  const commitMap = new Map<string, CommitNode>();
  commits.forEach(c => commitMap.set(c.sha, { ...c, children: [] }));

  commits.forEach(c => {
    c.parents.forEach((parentSha: string) => {
      const parent = commitMap.get(parentSha);
      if (parent) {
        parent.children!.push(c.sha);
      }
    });
  });

  const isCritical = (sha: string) => {
    const c = commitMap.get(sha);
    if (!c) return true;
    return c.parents.length !== 1 || (c.children?.length ?? 0) !== 1;
  };

  const processed = new Set<string>();
  const elements: GraphElement[] = [];

  commits.forEach(commit => {
    if (processed.has(commit.sha)) return;

    if (isCritical(commit.sha)) {
      const node = commitMap.get(commit.sha);
      if (node) {
        elements.push({ type: 'commit', data: node });
      }
      processed.add(commit.sha);
    } else {
      const segment: CommitNode[] = [];
      let current = commitMap.get(commit.sha);
      
      while (current && !isCritical(current.sha)) {
        segment.unshift(current);
        processed.add(current.sha);
        current = commitMap.get(current.parents[0]);
        if (current && isCritical(current.sha)) break;
      }

      current = commitMap.get(commit.sha);
      if (!current || !current.children || current.children.length === 0) {
        processed.add(commit.sha);
        return;
      }
      let nextSha = current.children[0];
      let next = commitMap.get(nextSha);
      while (next && !isCritical(next.sha)) {
        if (processed.has(next.sha)) break;
        segment.push(next);
        processed.add(next.sha);
        nextSha = next.children![0];
        next = commitMap.get(nextSha);
        if (next && isCritical(next.sha)) break;
      }

      if (segment.length > 1) {
        elements.push({
          type: 'folded',
          id: `folded-${segment[0].sha}`,
          commits: segment,
          parents: segment[0].parents[0] ? [segment[0].parents[0]] : [],
          children: (segment[segment.length - 1].children ?? [])[0] ? [(segment[segment.length - 1].children ?? [])[0]] : []
        });
      } else if (segment.length === 1) {
        elements.push({ type: 'commit', data: segment[0] });
      }
    }
  });

  return elements;
}

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
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "avatars.githubusercontent.com"],
        connectSrc: ["'self'", "ws:", "https://api.github.com"],
      },
    },
  }));

  // API Route: Fetch Repo Data
  app.get("/api/repo", async (req, res) => {
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
      const urlObj = new URL(!url.startsWith('http') ? `https://${url}` : url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      
      if (urlObj.hostname !== 'github.com' || parts.length < 2) {
        return res.status(400).json({ error: "Invalid GitHub URL format" });
      }

      const owner = parts[0];
      const repo = parts[1].replace(".git", "");

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
               branch: "main"
             },
             {
               id: "demo1",
               sha: "demo1",
               parents: [],
               message: "Initial commit",
               author: "demo",
               date: new Date(Date.now() - 86400000).toISOString(),
               github_url: "https://github.com/demo/rate-limit",
               branch: "main"
             }
           ];
           return res.json({
             owner,
             repo,
             elements: foldTopological(mockNodes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
           });
        }
      }

      const { data: repoDetails } = await currentOctokit.rest.repos.get({ owner, repo });
      const defaultBranch = repoDetails.default_branch;

      const { data: branchesRaw } = await currentOctokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });

      const commitsMap = new Map<string, any>();
      
      const fetchCommits = async (shaOrBranch: string, pages: number = 1) => {
        try {
          for (let page = 1; page <= pages; page++) {
            const { data: branchCommits } = await currentOctokit.rest.repos.listCommits({
              owner,
              repo,
              sha: shaOrBranch,
              per_page: 100,
              page,
            });
            for (const commit of branchCommits) {
              commitsMap.set(commit.sha, commit);
            }
            if (branchCommits.length < 100) break; // no more pages
          }
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          console.warn(`Failed fetching commits for ${shaOrBranch}`, err.message);
          if (err.status === 403 || err.status === 429) {
             throw error;
          }
        }
      };

      await fetchCommits(defaultBranch, 3);
      
      const otherBranches = branchesRaw
        .map((b: { name: string }) => b.name)
        .filter((n: string) => n !== defaultBranch)
        .slice(0, 4);
        
      for (const branchName of otherBranches) {
        await fetchCommits(branchName, 1);
      }

      const commitsRaw = Array.from(commitsMap.values());

      const nodesMap = new Map<string, any>();
      const nodes = commitsRaw.map((commit: RawCommit) => {
        const node = {
          id: commit.sha,
          sha: commit.sha,
          parents: commit.parents.map((p: { sha: string }) => p.sha),
          message: commit.commit.message,
          author: commit.author?.login || commit.commit.author.name,
          author_avatar: commit.author?.avatar_url,
          author_url: commit.author?.html_url,
          date: commit.commit.author.date,
          github_url: commit.html_url,
          branch: "branch" // default to branch, will refine later
        };
        nodesMap.set(node.sha, node);
        return node;
      });

      // Trace the main line (following the first parent from the newest commit)
      if (nodes.length > 0) {
         let currentSha = nodes[0].sha;
         while (currentSha) {
           const node = nodesMap.get(currentSha);
           if (!node) break;
           node.branch = defaultBranch;
           // The first parent is the mainline parent
           currentSha = node.parents.length > 0 ? node.parents[0] : null;
         }
      }
      
      // Refine with actual branch names if they match branch heads
      branchesRaw.forEach((b: { name: string; commit: { sha: string } }) => {
        const node = nodesMap.get(b.commit.sha);
        if (node) {
          node.branch = b.name;
        }
      });

      nodes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json({
        owner,
        repo,
        elements: foldTopological(nodes)
      });
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

    // API Route: AI Summarize
    app.post("/api/summarize", async (req, res) => {
      const { message, rawDiff, language = 'en' } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      }

      if (!rawDiff) {
        return res.status(400).json({ error: "rawDiff is required" });
      }

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        let systemPrompt = `As a Senior Tech Lead, create a code review summary of the following commit.
Focus on business logic and architecture, not on trivial details.
Reply ONLY with the following standard Markdown format without any introductory text:

**TL;DR:**
(1 main summary sentence about what this commit does)

**Key Changes:**
* (Bullet point for changed functionality/new features)
* (Other bullet points if any)

**Impact/Context:**
(Why this change is important, its impact on the system, or release context)`;

        if (language === 'id') {
           systemPrompt = `Sebagai Senior Tech Lead, buat ringkasan tinjauan kode dari komit berikut.
Fokus pada logika bisnis dan arsitektur, bukan pada detail sepele.
Balas HANYA dengan format Markdown standar berikut tanpa teks pengantar, gunakan bahasa Indonesia yang natural dan tidak kaku (tetap gunakan istilah bahasa Inggris jika itu lebih umum di dunia pemrograman):

**Ringkasan Singkat:**
(1 kalimat utama ringkasan tentang apa yang dilakukan komit ini)

**Perubahan Utama:**
* (Poin penting untuk fungsionalitas/fitur baru yang diubah)
* (Poin penting lainnya jika ada)

**Dampak/Konteks:**
(Mengapa perubahan ini penting, dampaknya pada sistem, atau konteks rilis)`;
        }

        const userContent = `Commit Message:\n${message || "No commit message"}\n\nGit Diff:\n${rawDiff.substring(0, 15000)}`;
        const prompt = systemPrompt + "\n\n" + userContent;

        const tryModel = async (modelName: string) => {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          if (!response.text) throw new Error(`No response from model ${modelName}`);
          return response.text;
        };

        let summary = "";
        try {
          summary = await tryModel("gemini-2.5-flash");
        } catch (errTier1: unknown) {
          const msg1 = errTier1 instanceof Error ? errTier1.message : 'Unknown error';
          console.warn(`[TIER 1] gemini-2.5-flash failed:`, msg1);
          try {
            summary = await tryModel("gemini-2.0-flash");
          } catch (errTier2: unknown) {
            const msg2 = errTier2 instanceof Error ? errTier2.message : 'Unknown error';
            console.warn(`[TIER 2] gemini-2.0-flash failed:`, msg2);
            try {
              summary = await tryModel("gemini-1.5-flash");
            } catch (errTier3: unknown) {
              const msg3 = errTier3 instanceof Error ? errTier3.message : 'Unknown error';
              console.warn(`[TIER 3] gemini-1.5-flash failed:`, msg3);
              summary = `⚠️ **AI Review Unavailable**: Please check that your Gemini API key in the **Settings > Secrets** panel is valid.`;
            }
          }
        }

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
