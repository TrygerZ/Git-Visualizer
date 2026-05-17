import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Octokit } from "octokit";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function foldTopological(commits: any[]) {
  if (commits.length === 0) return [];

  const commitMap = new Map<string, any>();
  commits.forEach(c => commitMap.set(c.sha, { ...c, children: [] }));

  // Build the full graph (parents and children)
  commits.forEach(c => {
    c.parents.forEach((parentSha: string) => {
      const parent = commitMap.get(parentSha);
      if (parent) {
        parent.children.push(c.sha);
      }
    });
  });

  const isCritical = (sha: string) => {
    const c = commitMap.get(sha);
    if (!c) return true;
    // Critical if: merge, branch point, tip, or root
    return c.parents.length !== 1 || c.children.length !== 1;
  };

  const processed = new Set<string>();
  const elements: any[] = [];

  commits.forEach(commit => {
    if (processed.has(commit.sha)) return;

    if (isCritical(commit.sha)) {
      elements.push({ type: 'commit', data: commitMap.get(commit.sha) });
      processed.add(commit.sha);
    } else {
      // Start of a potential linear segment
      const segment: any[] = [];
      let current = commitMap.get(commit.sha);
      
      // Move backwards to the start of the linear segment
      while (current && !isCritical(current.sha)) {
        segment.unshift(current);
        processed.add(current.sha);
        // Since it's linear, it has exactly one parent
        current = commitMap.get(current.parents[0]);
        // If the parent we just reached is critical, we stop
        if (current && isCritical(current.sha)) break;
      }

      // Move forwards from the initial commit to the end of the segment
      current = commitMap.get(commit.sha);
      let nextSha = current.children[0];
      let next = commitMap.get(nextSha);
      while (next && !isCritical(next.sha)) {
        if (processed.has(next.sha)) break;
        segment.push(next);
        processed.add(next.sha);
        nextSha = next.children[0];
        next = commitMap.get(nextSha);
        if (next && isCritical(next.sha)) break;
      }

      if (segment.length > 1) {
        elements.push({
          type: 'folded',
          id: `folded-${segment[0].sha}`,
          commits: segment,
          parents: [segment[0].parents[0]], // Link to the actual parent before the segment
          children: [segment[segment.length - 1].children[0]] // Link to the child after the segment
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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
      // Extract owner and repo from URL
      // Example: https://github.com/facebook/react
      const regex = /github\.com\/([^/]+)\/([^/]+)/;
      const match = url.match(regex);

      if (!match) {
        return res.status(400).json({ error: "Invalid GitHub URL format" });
      }

      const owner = match[1];
      const repo = match[2].replace(".git", "");

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

      // 1. Fetch repo details to get default branch
      const { data: repoDetails } = await currentOctokit.rest.repos.get({ owner, repo });
      const defaultBranch = repoDetails.default_branch;

      // 2. Fetch branches to identify branch names for commits
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
        } catch (err: any) {
          console.warn(`Failed fetching commits for ${shaOrBranch}`, err.message);
          if (err.status === 403 || err.status === 429) {
             throw err;
          }
        }
      };

      // 3. Fetch commits: up to 300 commits for default branch, and 100 for up to 4 other branches
      await fetchCommits(defaultBranch, 3);
      
      const otherBranches = branchesRaw
        .map((b: any) => b.name)
        .filter((n: string) => n !== defaultBranch)
        .slice(0, 4);
        
      for (const branchName of otherBranches) {
        await fetchCommits(branchName, 1);
      }

      const commitsRaw = Array.from(commitsMap.values());

      const nodesMap = new Map<string, any>();
      const nodes = commitsRaw.map((commit: any) => {
        const node = {
          id: commit.sha,
          sha: commit.sha,
          parents: commit.parents.map((p: any) => p.sha),
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
      // Since listCommits fetches from the default branch, the first commit (index 0) is the HEAD of default branch
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
      branchesRaw.forEach((b: any) => {
        const node = nodesMap.get(b.commit.sha);
        if (node) {
          node.branch = b.name;
        }
      });

      nodes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest first

      res.json({
        owner,
        repo,
        elements: foldTopological(nodes)
      });
    } catch (error: any) {
      console.error("GitHub API Error:", error);
      if (error.status === 401) {
        return res.status(401).json({ error: "Token GitHub (PAT) yang Anda masukkan tidak valid (Unauthorized)." });
      }
      if (error.status === 404) {
        return res.status(404).json({ error: "Repository not found or is private" });
      }
      if (error.status === 403 || error.status === 429) {
        return res.status(error.status).json({ error: "Batas permintaan (Rate Limit) GitHub API tercapai. Anda bisa menggunakan GitHub Personal Access Token (PAT) Anda sendiri lewat tombol Setting di samping tombol Visualize." });
      }
      res.status(500).json({ error: "Failed to fetch repository data" });
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
        } catch (errTier1: any) {
          console.warn(`[TIER 1] gemini-2.5-flash failed:`, errTier1.message);
          try {
            summary = await tryModel("gemini-2.0-flash");
          } catch (errTier2: any) {
            console.warn(`[TIER 2] gemini-2.0-flash failed:`, errTier2.message);
            try {
              summary = await tryModel("gemini-1.5-flash");
            } catch (errTier3: any) {
              console.warn(`[TIER 3] gemini-1.5-flash failed:`, errTier3.message);
              summary = `⚠️ **AI Review Unavailable**: Please check that your Gemini API key in the **Settings > Secrets** panel is valid. Original error: ${errTier1.message}`;
            }
          }
        }

        res.json({ summary });
      } catch (error: any) {
        console.error("AI summarization error:", error);
        res.status(500).json({ error: error.message || "Failed to generate AI summary" });
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
