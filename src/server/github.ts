import { Octokit } from "octokit";
import { CommitNode, GraphElement, RepoDataResult } from "./types";

export interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  parents: Array<{ sha: string }>;
  author: { login: string; avatar_url: string; html_url: string } | null;
  html_url: string;
}

interface RawBranch {
  name: string;
  commit: { sha: string };
}

function buildChildMap(commits: CommitNode[]): Map<string, CommitNode> {
  const map = new Map<string, CommitNode>();
  commits.forEach(c => map.set(c.sha, { ...c, children: [] }));
  commits.forEach(c => {
    c.parents.forEach(parentSha => {
      const parent = map.get(parentSha);
      if (parent && parent.children) {
        parent.children.push(c.sha);
      }
    });
  });
  return map;
}

function isCritical(sha: string, commitMap: Map<string, CommitNode>): boolean {
  const c = commitMap.get(sha);
  if (!c) return true;
  return c.parents.length !== 1 || (c.children?.length ?? 0) !== 1;
}

function collectBackward(
  commitSha: string,
  commitMap: Map<string, CommitNode>,
  processed: Set<string>
): CommitNode[] {
  const segment: CommitNode[] = [];
  let current = commitMap.get(commitSha);
  let depth = 0;
  while (current && !isCritical(current.sha, commitMap)) {
    if (depth++ > 1000) break;
    segment.unshift(current);
    processed.add(current.sha);
    current = commitMap.get(current.parents[0]);
    if (current && isCritical(current.sha, commitMap)) break;
  }
  return segment;
}

function collectForward(
  commitSha: string,
  commitMap: Map<string, CommitNode>,
  processed: Set<string>
): CommitNode[] {
  const segment: CommitNode[] = [];
  const start = commitMap.get(commitSha);
  if (!start || !start.children || start.children.length === 0) return segment;
  let current = commitMap.get(start.children[0]);
  let depth = 0;
  while (current && !isCritical(current.sha, commitMap)) {
    if (depth++ > 1000) break;
    if (processed.has(current.sha)) break;
    segment.push(current);
    processed.add(current.sha);
    current = commitMap.get((current.children ?? [])[0]);
    if (current && isCritical(current.sha, commitMap)) break;
  }
  return segment;
}

function buildFoldedElement(
  commitSha: string,
  commitMap: Map<string, CommitNode>,
  processed: Set<string>
): GraphElement | undefined {
  const backward = collectBackward(commitSha, commitMap, processed);
  const forward = collectForward(commitSha, commitMap, processed);
  const segment = [...backward, ...forward];
  if (segment.length > 1) {
    const last = segment[segment.length - 1];
    return {
      type: 'folded',
      id: `folded-${segment[0].sha}`,
      commits: segment,
      parents: segment[0].parents[0] ? [segment[0].parents[0]] : [],
      children: (last.children ?? [])[0] ? [(last.children ?? [])[0]] : [],
    };
  }
  if (segment.length === 1) {
    return { type: 'commit', data: segment[0] };
  }
  return undefined;
}

export function topologicalSort(nodes: CommitNode[]): CommitNode[] {
  const nodeMap = new Map<string, CommitNode>();
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  for (const n of nodes) {
    nodeMap.set(n.sha, n);
    inDegree.set(n.sha, 0);
    adjList.set(n.sha, []);
  }
  for (const n of nodes) {
    for (const p of n.parents) {
      if (!nodeMap.has(p)) continue;
      adjList.get(p)!.push(n.sha);
      inDegree.set(n.sha, (inDegree.get(n.sha) || 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [sha, deg] of inDegree) {
    if (deg === 0) queue.push(sha);
  }
  const result: CommitNode[] = [];
  while (queue.length > 0) {
    const sha = queue.shift()!;
    const node = nodeMap.get(sha);
    if (node) result.push(node);
    for (const neighbor of adjList.get(sha) || []) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  return result;
}

export function foldTopological(commits: CommitNode[]): GraphElement[] {
  if (commits.length === 0) return [];
  const commitMap = buildChildMap(commits);
  const processed = new Set<string>();
  const elements: GraphElement[] = [];
  for (const commit of commits) {
    if (processed.has(commit.sha)) continue;
    if (isCritical(commit.sha, commitMap)) {
      elements.push({ type: 'commit', data: commitMap.get(commit.sha) });
      processed.add(commit.sha);
    } else {
      const element = buildFoldedElement(commit.sha, commitMap, processed);
      if (element) elements.push(element);
    }
  }
  return elements;
}

export function validateGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(!url.startsWith('http') ? `https://${url}` : url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (!urlObj.hostname.endsWith('github.com') || parts.length < 2) return null;
    const owner = parts[0];
    let repo = parts[1];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    return { owner, repo };
  } catch {
    console.warn('validateGithubUrl: Invalid URL');
    return null;
  }
}

export function createOctokit(clientToken?: string): Octokit {
  return new Octokit({ auth: clientToken || process.env.GITHUB_TOKEN });
}

export async function fetchBranchCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  pages: number
): Promise<RawCommit[]> {
  const allCommits: RawCommit[] = [];
  for (let page = 1; page <= pages; page++) {
    const { data } = await octokit.rest.repos.listCommits({
      owner, repo, sha: ref, per_page: 100, page,
    });
    allCommits.push(...(data as unknown as RawCommit[]));
    if (data.length < 100) break;
  }
  return allCommits;
}

export function toCommitNode(raw: RawCommit): CommitNode {
  return {
    id: raw.sha,
    sha: raw.sha,
    parents: raw.parents.map(p => p.sha),
    message: raw.commit.message,
    author: raw.author?.login || raw.commit.author.name,
    author_avatar: raw.author?.avatar_url,
    author_url: raw.author?.html_url,
    date: raw.commit.author.date,
    github_url: raw.html_url,
    branch: "unknown",
  };
}

export function resolveBranchNames(
  nodes: CommitNode[],
  branchesRaw: RawBranch[],
  defaultBranch: string
): CommitNode[] {
  const updated = nodes.map(n => ({ ...n }));
  const nodeMap = new Map(updated.map(n => [n.sha, n]));
  const head = branchesRaw.find(b => b.name === defaultBranch);
  const startSha = head?.commit?.sha || updated[0]?.sha;
  let current = nodeMap.get(startSha);
  while (current) {
    current.branch = defaultBranch;
    current = nodeMap.get(current.parents[0]);
  }
  for (const b of branchesRaw) {
    if (!b.commit?.sha) continue;
    const node = nodeMap.get(b.commit.sha);
    if (node && node.branch !== defaultBranch) {
      node.branch = b.name;
    }
  }
  return updated;
}

export async function fetchRepoData(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<RepoDataResult> {
  const { data: repoDetails } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoDetails.default_branch;
  const { data: branchesRaw } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 5 });
  const defaultCommits = await fetchBranchCommits(octokit, owner, repo, defaultBranch, 3);
  const otherBranches = branchesRaw
    .map(b => b.name)
    .filter(n => n !== defaultBranch)
    .slice(0, 4);
  const allCommitBatches: RawCommit[] = [...defaultCommits];
  for (const branchName of otherBranches) {
    const commits = await fetchBranchCommits(octokit, owner, repo, branchName, 1);
    allCommitBatches.push(...commits);
  }
  const seen = new Map<string, RawCommit>();
  for (const c of allCommitBatches) seen.set(c.sha, c);
  const commitsRaw = Array.from(seen.values());
  let nodes = commitsRaw.map(toCommitNode);
  nodes = resolveBranchNames(nodes, branchesRaw as unknown as RawBranch[], defaultBranch);
  try {
    nodes = topologicalSort(nodes);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Topological sort failed, falling back to date sort:', message);
    nodes.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  }
  return { owner, repo, elements: foldTopological(nodes) };
}

export function getMockRepoData(owner: string, repo: string): RepoDataResult {
  const mockNodes: CommitNode[] = [
    {
      id: "demo2", sha: "demo2", parents: ["demo1"],
      message: "Add support for GITHUB_TOKEN to bypass rate limits",
      author: "demo",
      date: new Date().toISOString(),
      github_url: "https://github.com/demo/rate-limit",
      branch: "main", author_avatar: null, author_url: null,
    },
    {
      id: "demo1", sha: "demo1", parents: [],
      message: "Initial commit", author: "demo",
      date: new Date(Date.now() - 86400000).toISOString(),
      github_url: "https://github.com/demo/rate-limit",
      branch: "main", author_avatar: null, author_url: null,
    },
  ];
  return {
    owner, repo,
    elements: foldTopological(topologicalSort(mockNodes)),
  };
}

export async function fetchCommitDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitId: string
): Promise<unknown> {
  const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: commitId });
  return data;
}
