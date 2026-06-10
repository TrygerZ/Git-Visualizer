import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitCommit, GraphElement, FoldedNode as IFoldedNode } from '../types';
import { CommitNode } from './CommitNode';
import { FoldedNode } from './FoldedNode';
import { ElkCustomEdge } from './ElkCustomEdge';
import { GraphPanels } from './GraphPanels';
import { NodeContextMenu } from './NodeContextMenu';
import { motion, AnimatePresence } from 'motion/react';
import { parseCommitData, ParsedCommit } from '../lib/commitParser';
import { getBranchColor } from '../lib/getBranchColor';
import { AiSummaryPanel, type FileStat } from './AiSummaryPanel';
import { useElkLayout } from '../hooks/useElkLayout';
import { useGraphFilter } from '../hooks/useGraphFilter';
import { useGraphBounds } from '../hooks/useGraphBounds';

interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface CommitGraphProps {
  elements: GraphElement[];
  repoName: string;
  language?: 'en' | 'id';
  githubToken?: string;
}

type NodeMapValue = string | { first: string; last: string };

interface BuildNodesResult {
  nodes: Node[];
  nodeMap: Map<string, NodeMapValue>;
}

function addUnfurledFoldedNodes(
  el: GraphElement & { type: 'folded' },
  index: number,
  toggleUnfurl: (id: string) => void,
  language: 'en' | 'id',
  nodes: Node[],
  nodeMap: Map<string, NodeMapValue>
): void {
  el.commits.forEach((commit) => {
    const nodeId = `commit-${commit.sha}`;
    nodes.push({ id: nodeId, type: 'commit', position: { x: 0, y: 0 },
      sourcePosition: Position.Right, targetPosition: Position.Left,
      data: { commit, onFold: () => toggleUnfurl(el.id), elementIndex: index, language } });
    nodeMap.set(commit.sha, nodeId);
  });
  if (el.commits.length > 0) {
    const first = `commit-${el.commits[0].sha}`;
    const last = `commit-${el.commits[el.commits.length - 1].sha}`;
    nodeMap.set(el.id, { first, last });
  }
}

function addRegularNode(
  el: GraphElement,
  index: number,
  toggleUnfurl: (id: string) => void,
  language: 'en' | 'id',
  nodes: Node[],
  nodeMap: Map<string, NodeMapValue>
): void {
  const id = el.type === 'commit' ? el.data.sha : el.id;
  nodes.push({
    id,
    type: el.type,
    position: { x: 0, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data:
      el.type === 'commit'
        ? { commit: el.data, elementIndex: index, language }
        : { folded: el, onUnfold: () => toggleUnfurl(el.id), elementIndex: index, language },
  });
  nodeMap.set(id, id);
  if (el.type === 'folded') {
    el.commits.forEach((c) => nodeMap.set(c.sha, id));
  }
}

function buildNodes(
  elements: GraphElement[],
  unfurledIds: Set<string>,
  toggleUnfurl: (id: string) => void,
  language: 'en' | 'id'
): BuildNodesResult {
  const nodes: Node[] = [];
  const nodeMap = new Map<string, NodeMapValue>();

  elements.forEach((el, index) => {
    if (el.type === 'folded' && unfurledIds.has(el.id)) {
      addUnfurledFoldedNodes(el, index, toggleUnfurl, language, nodes, nodeMap);
    } else {
      addRegularNode(el, index, toggleUnfurl, language, nodes, nodeMap);
    }
  });

  return { nodes, nodeMap };
}

function addInternalEdges(
  el: GraphElement & { type: 'folded' },
  index: number,
  edges: Edge[]
): void {
  el.commits.forEach((commit, idx) => {
    if (idx === 0) return;
    edges.push({
      id: `edge-${el.id}-${idx}`,
      source: `commit-${el.commits[idx - 1].sha}`,
      target: `commit-${commit.sha}`,
      type: 'elk',
      style: {
        stroke: getBranchColor(commit.branch || 'unknown', commit.sha),
        strokeWidth: 2,
        opacity: 0.7,
      },
      data: { sameBranch: true, weight: 100, elementIndex: index },
    });
  });
}

function addParentEdgesForCommit(
  el: GraphElement & { type: 'commit' },
  index: number,
  nodeMap: Map<string, NodeMapValue>,
  edges: Edge[]
): void {
  const branchName = el.data.branch || 'unknown';
  const branchColor = getBranchColor(branchName, el.data.sha);
  const isMain = branchName === 'main' || branchName === 'master';

  el.data.parents.forEach((parentSha, parentIdx) => {
    const sourceId = nodeMap.get(parentSha);
    const targetId = nodeMap.get(el.data.sha);
    if (!sourceId || !targetId) return;
    const realSource = typeof sourceId === 'object' ? sourceId.last : sourceId;
    const weight = parentIdx === 0 ? (isMain ? 1000 : 100) : 1;
    edges.push({
      id: `e-${realSource}-${targetId}-${parentIdx}`,
      source: realSource,
      target: typeof targetId === 'object' ? targetId.last : targetId,
      type: 'elk',
      style: { stroke: branchColor, strokeWidth: 2, opacity: 0.8 },
      data: { sameBranch: parentIdx === 0, weight, elementIndex: index },
    });
  });
}

function addParentEdgesForFolded(
  el: GraphElement & { type: 'folded' },
  index: number,
  unfurledIds: Set<string>,
  nodeMap: Map<string, NodeMapValue>,
  edges: Edge[]
): void {
  const sha = el.commits[0]?.sha;
  const branchName = el.commits[0]?.branch || 'unknown';
  const branchColor = getBranchColor(branchName, sha);
  const isMain = branchName === 'main' || branchName === 'master';

  let targetId = el.id;
  if (unfurledIds.has(el.id)) {
    const mapped = nodeMap.get(el.id);
    if (mapped && typeof mapped === 'object') targetId = mapped.first;
  }

  el.parents.forEach((parentSha, parentIdx) => {
    const sourceId = nodeMap.get(parentSha);
    if (!sourceId) return;
    const realSource = typeof sourceId === 'object' ? sourceId.last : sourceId;
    const weight = parentIdx === 0 ? (isMain ? 1000 : 100) : 1;
    edges.push({ id: `e-${realSource}-${targetId}-${parentIdx}`,
      source: realSource, target: targetId, type: 'elk',
      style: { stroke: branchColor, strokeWidth: 2, opacity: 0.8 },
      data: { sameBranch: parentIdx === 0, weight, elementIndex: index } });
  });
}

function buildEdges(
  elements: GraphElement[],
  unfurledIds: Set<string>,
  nodeMap: Map<string, NodeMapValue>
): Edge[] {
  const edges: Edge[] = [];

  elements.forEach((el, index) => {
    if (el.type === 'folded' && unfurledIds.has(el.id)) {
      addInternalEdges(el, index, edges);
    }
  });

  elements.forEach((el, index) => {
    if (el.type === 'commit') {
      addParentEdgesForCommit(el, index, nodeMap, edges);
    } else {
      addParentEdgesForFolded(el, index, unfurledIds, nodeMap, edges);
    }
  });

  return edges;
}

function safeDate(dateStr: string | undefined, locale: 'en' | 'id'): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

const nodeTypes = { commit: CommitNode, folded: FoldedNode };
const edgeTypes = { elk: ElkCustomEdge };

function useTranslations(language: 'en' | 'id') {
  return useMemo(() => ({
    horizontal: language === 'en' ? 'Horizontal' : 'Mendatar',
    vertical: language === 'en' ? 'Vertical' : 'Vertikal',
    collapseAll: language === 'en' ? 'Collapse All Segments' : 'Tutup Semua Segmen',
    clickHint: language === 'en'
      ? 'Click capsule nodes to unfurl linear paths'
      : 'Klik node kapsul untuk membuka jalur linier',
    viewOnGithub: language === 'en' ? 'View on GitHub' : 'Lihat di GitHub',
    viewSummary: language === 'en' ? 'View Commit Summary' : 'Lihat Ringkasan Komit',
    optimizingLayout: language === 'en' ? 'Optimizing Layout...' : 'Mengoptimalkan Tata Letak...',
    contributingNow: language === 'en' ? 'Contributing now' : 'Sedang berkontribusi',
    segment: language === 'en' ? 'Segment:' : 'Segmen:',
    linearCommits: language === 'en' ? 'Linear Commits' : 'Komit Linear',
    foldedToSave: language === 'en' ? 'Folded to save space' : 'Dilipat untuk menghemat ruang',
    step: language === 'en' ? 'Step' : 'Langkah',
    of: language === 'en' ? 'of' : 'dari',
    emptyGraph: language === 'en' ? 'No commits found in this repository.' : 'Tidak ada komit ditemukan.',
  }), [language]);
}

const GraphInner = ({ elements, repoName, language = 'en', githubToken }: CommitGraphProps) => {
  const [layoutDirection, setLayoutDirection] = useState<'RIGHT' | 'DOWN'>('RIGHT');
  const [playbackIndex, setPlaybackIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unfurledIds, setUnfurledIds] = useState<Set<string>>(new Set());
  const [fullLayoutedNodes, setFullLayoutedNodes] = useState<Node[]>([]);
  const [fullLayoutedEdges, setFullLayoutedEdges] = useState<Edge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNodeMenu, setActiveNodeMenu] = useState<{
    commit: GitCommit; x: number; y: number;
  } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    repoName: string; commitSha: string; branch: string; githubUrl: string;
    message: string; parsedData: ParsedCommit; fileStats?: FileStat[];
    rawDiff: string; diffError?: string;
  } | null>(null);
  const [sliderX, setSliderX] = useState(0);
  const [sliderY, setSliderY] = useState(0);

  const lastFoldedIdRef = useRef<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveRef = useRef(0);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const elementsRef = useRef(elements);
  const languageRef = useRef(language);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { languageRef.current = language; }, [language]);
  const { setCenter } = useReactFlow();

  const t = useTranslations(language);
  const { runLayout, isLayouting, layoutError } = useElkLayout();
  const { bounds, lockedZoom, computeBounds } = useGraphBounds();
  const { visibleNodes, visibleEdges, firstMatch } = useGraphFilter(
    fullLayoutedNodes, fullLayoutedEdges, searchQuery, playbackIndex, elements.length, isPlaying
  );

  const contributors = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string; url?: string }>();
    elements.forEach((el) => {
      if (el.type === 'commit') {
        map.set(el.data.author, { name: el.data.author, avatar: el.data.author_avatar, url: el.data.author_url });
      } else {
        el.commits.forEach((c) => map.set(c.author, { name: c.author, avatar: c.author_avatar, url: c.author_url }));
      }
    });
    return Array.from(map.values());
  }, [elements]);

  const toggleUnfurl = useCallback((id: string) => {
    setUnfurledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        lastFoldedIdRef.current = id;
      } else {
        next.add(id);
        const el = elementsRef.current.find((e) => (e.type === 'commit' ? e.data.sha : e.id) === id);
        if (el && el.type === 'folded' && el.commits.length > 0) {
          lastFoldedIdRef.current = `commit-${el.commits[0].sha}`;
        } else {
          lastFoldedIdRef.current = id;
        }
      }
      return next;
    });
  }, []);

  const currentElement = elements.length > 0 ? elements[Math.min(playbackIndex, elements.length) - 1] : undefined;
  const activeContributorName = useMemo(() => {
    if (!currentElement) return null;
    return currentElement.type === 'commit' ? currentElement.data.author : currentElement.commits[0]?.author;
  }, [currentElement]);
  const activeAvatar = useMemo(() => {
    if (!currentElement) return null;
    return currentElement.type === 'commit' ? currentElement.data.author_avatar : currentElement.commits[0]?.author_avatar;
  }, [currentElement]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => setPlaybackIndex((prev) => Math.min(prev + 1, elements.length)), 600);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isPlaying, elements.length]);

  useEffect(() => {
    if (playbackIndex > elements.length) setIsPlaying(false);
  }, [playbackIndex, elements.length]);

  useEffect(() => {
    setPlaybackIndex(1);
    setIsPlaying(false);
    setUnfurledIds(new Set());
  }, [elements]);

  useEffect(() => {
    let cancelled = false;
    const performLayout = async () => {
      const { nodes: initialNodes, nodeMap } = buildNodes(elements, unfurledIds, toggleUnfurl, languageRef.current);
      const allEdges = buildEdges(elements, unfurledIds, nodeMap);
      try {
        const result = await runLayout(initialNodes, allEdges, layoutDirection);
        if (cancelled) return;
        setFullLayoutedNodes(result.nodes);
        setFullLayoutedEdges(result.edges);
        const resultBounds = computeBounds(result.nodes, layoutDirection);
        if (resultBounds && lastFoldedIdRef.current) {
          const target = result.nodes.find((n) => n.id === lastFoldedIdRef.current);
          if (target) {
            const isHorizontal = layoutDirection === 'RIGHT';
            const xs = result.nodes.map((n) => n.position.x);
            const ys = result.nodes.map((n) => n.position.y);
            const cX = isHorizontal
              ? target.position.x + (target.width || 256) / 2
              : (Math.min(...xs) + Math.max(...xs)) / 2;
            const cY = isHorizontal
              ? (Math.min(...ys) + Math.max(...ys)) / 2
              : target.position.y + (target.height || 80) / 2;
            const span = isHorizontal
              ? Math.max(...xs) - Math.min(...xs)
              : Math.max(...ys) - Math.min(...ys);
            const zoom = Math.min(1.5, span / (isHorizontal ? window.innerWidth : window.innerHeight));
            setCenter(cX, cY, { zoom: Math.min(zoom, resultBounds.optimalZoom), duration: 800 });
          }
          lastFoldedIdRef.current = null;
        }
        if (resultBounds && !lastFoldedIdRef.current && initialNodes.length <= 1) {
          setCenter(
            (resultBounds.bounds.minX + resultBounds.bounds.maxX) / 2,
            (resultBounds.bounds.minY + resultBounds.bounds.maxY) / 2,
            { zoom: resultBounds.optimalZoom, duration: 800 }
          );
        }
      } catch (e) {
        if (!cancelled) console.error('Layout failed:', e);
      }
    };
    performLayout();
    return () => { cancelled = true; };
  }, [elements, unfurledIds, layoutDirection, runLayout, computeBounds, setCenter]);

  useEffect(() => {
    const isHorizontal = layoutDirection === 'RIGHT';
    if (!currentElement) return;
    const targetNodeId = currentElement.type === 'commit' ? currentElement.data.sha : currentElement.id;
    const targetNode = visibleNodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return;
    const timeout = setTimeout(() => {
      const w = targetNode.width || 256;
      const h = targetNode.height || 80;
      setCenter(
        isHorizontal ? targetNode.position.x + w / 2 : (bounds.minX + bounds.maxX) / 2,
        isHorizontal ? (bounds.minY + bounds.maxY) / 2 : targetNode.position.y + h / 2,
        { zoom: lockedZoom, duration: 800 }
      );
    }, 100);
    return () => clearTimeout(timeout);
  }, [playbackIndex, isPlaying, unfurledIds, currentElement, visibleNodes, lockedZoom, bounds, setCenter, layoutDirection]);

  useEffect(() => {
    if (!firstMatch || searchQuery.trim().length === 0) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCenter(
        firstMatch.position.x + (firstMatch.width || 100) / 2,
        firstMatch.position.y + (firstMatch.height || 50) / 2,
        { zoom: 1.5, duration: 500 }
      );
    }, 100);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [firstMatch, searchQuery, setCenter]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.type !== 'commit') return;
    const data = node.data as Record<string, unknown>;
    _e.stopPropagation();
    setActiveNodeMenu({ commit: data.commit as GitCommit, x: _e.clientX, y: _e.clientY });
  }, []);

  const handlePaneClick = useCallback(() => setActiveNodeMenu(null), []);

  const handleMove = useCallback((_e: unknown, viewport: { x: number; y: number; zoom: number }) => {
    const now = Date.now();
    if (now - lastMoveRef.current < 50) return;
    lastMoveRef.current = now;
    setSliderX((window.innerWidth / 2 - viewport.x) / viewport.zoom);
    setSliderY((window.innerHeight / 2 - viewport.y) / viewport.zoom);
  }, []);

  const handleViewSummary = useCallback(async (commit: GitCommit) => {
    const { sha, branch, message, github_url } = commit;
    const commitId = sha;
    setActiveNodeMenu(null);
    const parsedData = parseCommitData(message || '');
    setSummaryData({
      repoName, commitSha: commitId, branch: branch || 'unknown', githubUrl: github_url || '',
      message: message || '', parsedData, fileStats: [], rawDiff: '',
    });
    setIsSummarizing(true);
    try {
      if (summaryAbortRef.current) summaryAbortRef.current.abort();
      const controller = new AbortController();
      summaryAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const headers: Record<string, string> = {};
      if (githubToken) headers['x-github-token'] = githubToken;
      const res = await fetch(
        `/api/commit-diff?repo=${encodeURIComponent(repoName)}&commitId=${encodeURIComponent(commitId)}`,
        { headers, signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const allFiles = data.files as CommitFile[];
        const validFiles = allFiles?.filter((f: CommitFile) => f.patch) || [];
        const rawDiff = validFiles
          .map((f: CommitFile) => `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
          .join('\n');
        const fileStats = allFiles?.map((f: CommitFile) => ({ name: f.filename, status: f.status, add: f.additions, del: f.deletions })) || [];
        const fileNames = allFiles?.map((f: CommitFile) => f.filename) || [];
        const stats = { additions: data.stats?.additions || 0, deletions: data.stats?.deletions || 0 };
        const updatedParsedData = parseCommitData(message || '', fileNames, stats);
        setSummaryData((prev) => prev ? { ...prev, parsedData: updatedParsedData, fileStats, rawDiff } : null);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch commit diff' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      const isAbort = (e as Error).name === 'AbortError';
      console.error(isAbort ? 'Request timed out' : 'Failed to fetch commit diff:', e);
      setSummaryData((prev) => prev ? {
        ...prev, rawDiff: '', fileStats: [],
        diffError: isAbort ? 'Request timed out after 15s' : (e as Error).message || 'Failed to load data',
      } : null);
    } finally {
      setIsSummarizing(false);
    }
  }, [repoName, githubToken]);

  const handleCollapseAll = useCallback(() => {
    setUnfurledIds(new Set());
    const firstEl = elements[0];
    if (firstEl) {
      lastFoldedIdRef.current = firstEl.type === 'commit' ? firstEl.data.sha : firstEl.id;
    }
  }, [elements]);

  if (elements.length === 0) {
    return (
      <div className="w-full h-full border border-hairline rounded-2xl overflow-hidden bg-surface relative flex items-center justify-center text-body text-lg">
        {t.emptyGraph}
      </div>
    );
  }

  return (
    <div className="w-full h-full border border-hairline rounded-2xl overflow-hidden bg-surface relative">
      {layoutError && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-xs text-rose-400 text-center">
          Layout error: {layoutError}
        </div>
      )}
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMove={handleMove}
        colorMode="dark"
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'elk', style: { strokeWidth: 2, stroke: '#505051' }, zIndex: -1 }}
      >
        <GraphPanels
          elements={elements}
          repoName={repoName}
          language={language}
          t={t}
          isLayouting={isLayouting}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          layoutDirection={layoutDirection}
          onLayoutDirectionChange={setLayoutDirection}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying((p) => !p)}
          playbackIndex={playbackIndex}
          onPlaybackIndexChange={setPlaybackIndex}
          onReset={() => { setPlaybackIndex(1); setIsPlaying(false); }}
          currentElement={currentElement}
          safeDate={safeDate}
          activeContributorName={activeContributorName}
          activeAvatar={activeAvatar}
          contributors={contributors}
          bounds={bounds}
          lockedZoom={lockedZoom}
          sliderX={sliderX}
          sliderY={sliderY}
          onSliderXChange={setSliderX}
          onSliderYChange={setSliderY}
          unfurledIdsCount={unfurledIds.size}
          onCollapseAll={handleCollapseAll}
        />
      </ReactFlow>

      <AnimatePresence>
        {activeNodeMenu && (
          <NodeContextMenu
            commit={activeNodeMenu.commit}
            x={activeNodeMenu.x}
            y={activeNodeMenu.y}
            t={t}
            onClose={() => setActiveNodeMenu(null)}
            onViewSummary={handleViewSummary}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryData && (
          <AiSummaryPanel
            commitSha={summaryData.commitSha}
            branch={summaryData.branch}
            githubUrl={summaryData.githubUrl}
            message={summaryData.message}
            parsedData={summaryData.parsedData}
            rawDiff={summaryData.rawDiff}
            fileStats={summaryData.fileStats}
            diffError={summaryData.diffError || null}
            isSummarizing={isSummarizing}
            language={language}
            onClose={() => setSummaryData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export const CommitGraph = (props: CommitGraphProps) => (
  <ReactFlowProvider>
    <GraphInner {...props} />
  </ReactFlowProvider>
);
