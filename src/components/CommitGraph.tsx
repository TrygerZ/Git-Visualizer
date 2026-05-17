import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
  Position,
  BaseEdge,
  EdgeProps,
  getSmoothStepPath
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { GitCommit, GraphElement, FoldedNode as IFoldedNode } from '../types';
import { CommitNode } from './CommitNode';
import { FoldedNode } from './FoldedNode';
import { Info, Play, Pause, RotateCcw, Clock, Minimize2, User, ExternalLink, X, FileText } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { ContributorPanel } from './ContributorPanel';
import { ContributorLeaderboard } from './ContributorLeaderboard';
import { SearchBar } from './SearchBar';
import { parseCommitData, ParsedCommit } from '../lib/commitParser';
import { AiSummaryPanel } from './AiSummaryPanel';

interface CommitGraphProps {
  elements: GraphElement[];
  repoName: string;
  language?: 'en' | 'id';
}

const filterPoints = (points: {x: number, y: number}[]) => {
  if (points.length === 0) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = result[result.length - 1];
    if (Math.abs(p.x - prev.x) > 0.1 || Math.abs(p.y - prev.y) > 0.1) {
      result.push(p);
    }
  }
  return result;
};

const roundedPolyline = (rawPoints: {x: number, y: number}[], r: number) => {
  const points = filterPoints(rawPoints);
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    const dx1 = p1.x - p2.x;
    const dy1 = p1.y - p2.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 === 0 || len2 === 0) {
       d += ` L ${p2.x} ${p2.y}`;
       continue;
    }

    const radius = Math.min(r, len1 / 2, len2 / 2);
    if (radius < 1) {
      d += ` L ${p2.x} ${p2.y}`;
      continue;
    }

    const p2p1Ratio = radius / len1;
    const p2p3Ratio = radius / len2;

    const startX = p2.x + dx1 * p2p1Ratio;
    const startY = p2.y + dy1 * p2p1Ratio;

    const endX = p2.x + dx2 * p2p3Ratio;
    const endY = p2.y + dy2 * p2p3Ratio;

    d += ` L ${startX} ${startY}`;
    d += ` Q ${p2.x} ${p2.y} ${endX} ${endY}`;
  }
  
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

export const ElkCustomEdge = ({
  id,
  style,
  markerEnd,
  animated,
  data,
}: EdgeProps) => {
  const layoutedEdge = data?.layoutedEdge as any;

  let pathData = '';
  if (layoutedEdge?.sections?.length > 0) {
    const section = layoutedEdge.sections[0];
    const { startPoint, bendPoints = [], endPoint } = section;
    const points = [startPoint, ...bendPoints, endPoint];
    pathData = roundedPolyline(points, 15);
  }

  return (
    <BaseEdge 
      id={id} 
      path={pathData} 
      style={style} 
      markerEnd={markerEnd} 
      className={animated ? "react-flow__edge-path animated" : "react-flow__edge-path"} 
    />
  );
};

const nodeTypes = {
  commit: CommitNode,
  folded: FoldedNode,
};

export const getBranchColor = (branchName: string, fallbackId: string = '') => {
  if (branchName === 'main' || branchName === 'master') return '#3b82f6';
  if (branchName === 'develop') return '#10b981';

  const seed = (branchName === 'commit' || branchName === 'unknown') && fallbackId ? fallbackId : branchName;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
};

const edgeTypes = {
  elk: ElkCustomEdge,
};

const elk = new ELK();

const getLayoutedElements = async (nodes: Node[], edges: Edge[], direction: 'RIGHT' | 'DOWN' = 'RIGHT') => {
  const isHorizontal = direction === 'RIGHT';

  const graph: any = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.mergeEdges': 'false',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.spacing.portPort': '15',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.nodePlacement.favorStraightEdges': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '80',
      'elk.spacing.edgeEdge': '20',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
      'elk.spacing.edgeNode': '30',
    },
    children: nodes.map((node) => {
      const isFolded = node.type === 'folded';
      return {
        id: node.id,
        width: isFolded ? 128 : 256,
        height: isFolded ? 40 : 80,
        ports: [
          {
            id: `${node.id}-in`,
            properties: {
              'port.side': isHorizontal ? 'WEST' : 'NORTH',
              'port.alignment': 'CENTER',
            }
          },
          {
            id: `${node.id}-out`,
            properties: {
              'port.side': isHorizontal ? 'EAST' : 'SOUTH',
              'port.alignment': 'CENTER',
            }
          }
        ]
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [`${edge.source}-out`],
      targets: [`${edge.target}-in`],
      layoutOptions: {
        'elk.layered.priority.straightness': edge.data?.weight ? String(edge.data.weight) : '1',
      }
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const layoutedNode = layoutedGraph.children?.find((n: any) => n.id === node.id);
    return {
      ...node,
      position: {
        x: layoutedNode?.x || 0,
        y: layoutedNode?.y || 0,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      zIndex: 10,
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const layoutedEdge = layoutedGraph.edges?.find((e: any) => e.id === edge.id);
    return {
      ...edge,
      type: 'elk', 
      data: {
        ...edge.data,
        layoutedEdge,
      },
      zIndex: -1,
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

const GraphInner = ({ elements, repoName, language = 'en' }: CommitGraphProps) => {
  const [layoutDirection, setLayoutDirection] = useState<'RIGHT' | 'DOWN'>('RIGHT');
  const [playbackIndex, setPlaybackIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unfurledIds, setUnfurledIds] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fullLayoutedNodes, setFullLayoutedNodes] = useState<Node[]>([]);
  const [fullLayoutedEdges, setFullLayoutedEdges] = useState<Edge[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeNodeMenu, setActiveNodeMenu] = useState<{ commit: any, x: number, y: number } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<{ repoName: string; commitSha: string; branch: string; githubUrl: string; message: string; parsedData: ParsedCommit; fileStats?: any[]; rawDiff: string } | null>(null);

  const lastFoldedIdRef = useRef<string | null>(null);
  const { setCenter, getViewport } = useReactFlow();
  
  const t = {
    horizontal: language === 'en' ? 'Horizontal' : 'Horizontal',
    vertical: language === 'en' ? 'Vertical' : 'Vertikal',
    collapseAll: language === 'en' ? 'Collapse All Segments' : 'Tutup Semua Segmen',
    clickHint: language === 'en' ? 'Click capsule nodes to unfurl linear paths' : 'Klik node kapsul untuk membuka jalur linier',
    viewOnGithub: language === 'en' ? 'View on GitHub' : 'Lihat di GitHub',
    viewSummary: language === 'en' ? 'View Commit Summary' : 'Lihat Ringkasan Komit',
  };
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [graphBounds, setGraphBounds] = useState({ minX: 0, maxX: 1000, minY: 0, maxY: 100 });
  const [lockedZoom, setLockedZoom] = useState(1);
  const [sliderX, setSliderX] = useState(0);
  const [sliderY, setSliderY] = useState(0);

  const contributors = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string; url?: string }>();
    elements.forEach(el => {
      if (el.type === 'commit') {
        map.set(el.data.author, { 
          name: el.data.author, 
          avatar: el.data.author_avatar,
          url: el.data.author_url
        });
      } else {
        el.commits.forEach(c => {
          map.set(c.author, { 
            name: c.author, 
            avatar: c.author_avatar,
            url: c.author_url
          });
        });
      }
    });
    return Array.from(map.values());
  }, [elements]);

  const currentElement = elements[playbackIndex - 1];
  const activeContributorName = useMemo(() => {
    if (!currentElement) return null;
    return currentElement.type === 'commit' ? currentElement.data.author : currentElement.commits[0]?.author;
  }, [currentElement]);

  const activeAvatar = useMemo(() => {
    if (!currentElement) return null;
    return currentElement.type === 'commit' ? currentElement.data.author_avatar : currentElement.commits[0]?.author_avatar;
  }, [currentElement]);

  const toggleUnfurl = (id: string) => {
    setUnfurledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        lastFoldedIdRef.current = id;
      } else {
        next.add(id);
        const el = elements.find(e => (e.type === 'commit' ? e.data.sha : e.id) === id);
        if (el && el.type === 'folded' && el.commits.length > 0) {
           lastFoldedIdRef.current = `commit-${el.commits[0].sha}`;
        } else {
           lastFoldedIdRef.current = id;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= elements.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 600);
      timerRef.current = interval;
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timerRef.current === interval) timerRef.current = null;
    };
  }, [isPlaying, elements.length]);

  useEffect(() => {
    if (fullLayoutedNodes.length > 0 && !isLayouting) {
      const isHorizontal = layoutDirection === 'RIGHT';
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      fullLayoutedNodes.forEach(node => {
        const w = (node.width as number) || 256;
        const h = (node.height as number) || 80;
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x + w);
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y + h);
      });
      setGraphBounds({ minX, maxX, minY, maxY });

      let optimalZoom = 1;
      if (isHorizontal) {
        const totalHeight = Math.max(maxY - minY, 100);
        const availableHeight = window.innerHeight - 250; 
        optimalZoom = availableHeight / totalHeight;
      } else {
        const totalWidth = Math.max(maxX - minX, 100);
        const availableWidth = window.innerWidth - 100;
        optimalZoom = availableWidth / totalWidth;
      }

      optimalZoom = Math.min(Math.max(optimalZoom, 0.1), 1.5);
      setLockedZoom(optimalZoom);

      if (!lastFoldedIdRef.current && nodes.length <= 1) {
         setCenter(
           (minX + maxX) / 2,
           (minY + maxY) / 2,
           { zoom: optimalZoom, duration: 800 }
         );
      }
    }
  }, [fullLayoutedNodes, isLayouting, layoutDirection, setCenter]);

  useEffect(() => {
    const isHorizontal = layoutDirection === 'RIGHT';

    if (lastFoldedIdRef.current) {
      const id = lastFoldedIdRef.current;
      const targetNode = nodes.find(n => n.id === id);
      if (targetNode) {
        const timeout = setTimeout(() => {
          const w = (targetNode.width as number) || 256;
          const h = (targetNode.height as number) || 80;
          setCenter(
            isHorizontal ? targetNode.position.x + w / 2 : (graphBounds.minX + graphBounds.maxX) / 2,
            isHorizontal ? (graphBounds.minY + graphBounds.maxY) / 2 : targetNode.position.y + h / 2,
            { zoom: lockedZoom, duration: 800 }
          );
          lastFoldedIdRef.current = null;
        }, 150);
        return () => clearTimeout(timeout);
      }
    }

    if (currentElement) {
      const targetNodeId = currentElement.type === 'commit' ? currentElement.data.sha : currentElement.id;
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode) {
        const timeout = setTimeout(() => {
          const w = (targetNode.width as number) || 256;
          const h = (targetNode.height as number) || 80;
          setCenter(
             isHorizontal ? targetNode.position.x + w / 2 : (graphBounds.minX + graphBounds.maxX) / 2,
             isHorizontal ? (graphBounds.minY + graphBounds.maxY) / 2 : targetNode.position.y + h / 2,
            { zoom: lockedZoom, duration: 800 }
          );
        }, 100);
        return () => clearTimeout(timeout);
      }
    }
  }, [playbackIndex, isPlaying, unfurledIds, currentElement, nodes, lockedZoom, graphBounds, setCenter, layoutDirection]);

  useEffect(() => {
    const calcFullLayout = async () => {
      const initialNodes: Node[] = [];
      const initialEdges: Edge[] = [];
      const nodeMap = new Map<string, any>();

      elements.forEach((el, index) => {
        if (el.type === 'folded' && unfurledIds.has(el.id)) {
          el.commits.forEach((commit, idx) => {
            const nodeId = `commit-${commit.sha}`;
            initialNodes.push({
              id: nodeId,
              type: 'commit',
              position: { x: 0, y: 0 },
              sourcePosition: 'right' as any,
              targetPosition: 'left' as any,
              data: { 
                commit,
                onFold: () => toggleUnfurl(el.id),
                elementIndex: index 
              },
            });
            nodeMap.set(commit.sha, nodeId);

            if (idx > 0) {
              initialEdges.push({
                id: `edge-${el.id}-${idx}`,
                source: `commit-${el.commits[idx-1].sha}`,
                target: nodeId,
                type: 'elk',
                style: { stroke: getBranchColor(commit.branch || 'unknown', commit.sha), strokeWidth: 2, opacity: 0.7 },
                data: { sameBranch: true, weight: 100, elementIndex: index },
              });
            }
          });
          
          nodeMap.set(el.id, { 
            first: `commit-${el.commits[0].sha}`, 
            last: `commit-${el.commits[el.commits.length - 1].sha}` 
          });
        } else {
          const id = el.type === 'commit' ? el.data.sha : el.id;
          initialNodes.push({
            id,
            type: el.type,
            position: { x: 0, y: 0 },
            sourcePosition: 'right' as any,
            targetPosition: 'left' as any,
            data: el.type === 'commit' 
              ? { commit: el.data, elementIndex: index } 
              : { folded: el, onUnfold: () => toggleUnfurl(el.id), elementIndex: index },
          });
          nodeMap.set(id, id);
          
          if (el.type === 'folded') {
            el.commits.forEach(c => nodeMap.set(c.sha, id));
          }
        }
      });

      elements.forEach((el, index) => {
        if (el.type === 'commit') {
          const branchName = el.data.branch || 'unknown';
          const branchColor = getBranchColor(branchName, el.data.sha);
          const isMain = branchName === 'main' || branchName === 'master';
          
          el.data.parents.forEach((parentSha, parentIdx) => {
            const sourceId = nodeMap.get(parentSha);
            const targetId = nodeMap.get(el.data.sha);
            
            if (sourceId && targetId) {
              const realSource = typeof sourceId === 'object' ? sourceId.last : sourceId;
              const weight = parentIdx === 0 ? (isMain ? 1000 : 100) : 1;
              initialEdges.push({
                id: `e-${realSource}-${targetId}`,
                source: realSource,
                target: targetId,
                type: 'elk',
                style: { stroke: branchColor, strokeWidth: 2, opacity: 0.8 },
                data: { sameBranch: parentIdx === 0, weight, elementIndex: index },
              });
            }
          });
        } else if (el.type === 'folded') {
          const branchName = el.commits[0]?.branch || 'unknown';
          const branchColor = getBranchColor(branchName, el.commits[0]?.sha);
          const isMain = branchName === 'main' || branchName === 'master';
          const isUnfurled = unfurledIds.has(el.id);
          const targetId = isUnfurled ? nodeMap.get(el.id).first : el.id;

          el.parents.forEach((parentSha, parentIdx) => {
            const sourceId = nodeMap.get(parentSha);
            if (sourceId && targetId) {
              const realSource = typeof sourceId === 'object' ? sourceId.last : sourceId;
              const weight = parentIdx === 0 ? (isMain ? 1000 : 100) : 1;
              initialEdges.push({
                id: `e-${realSource}-${targetId}`,
                source: realSource,
                target: targetId,
                type: 'elk',
                style: { stroke: branchColor, strokeWidth: 2, opacity: 0.8 },
                data: { sameBranch: parentIdx === 0, weight, elementIndex: index },
              });
            }
          });
        }
      });

      setIsLayouting(true);
      const layouted = await getLayoutedElements(initialNodes, initialEdges, layoutDirection);
      setFullLayoutedNodes(layouted.nodes);
      setFullLayoutedEdges(layouted.edges);
      setIsLayouting(false);
    };

    calcFullLayout();
  }, [elements, unfurledIds, layoutDirection]);

  useEffect(() => {
    const isSearching = searchQuery.trim().length > 0;
    const lowerQuery = searchQuery.toLowerCase();

    const visibleNodes = fullLayoutedNodes
      .filter(n => typeof n.data?.elementIndex === 'number' && n.data.elementIndex < Math.min(playbackIndex, elements.length + 1))
      .map(n => {
        let isMatched = false;
        
        if (isSearching) {
          if (n.type === 'commit') {
            const c = n.data.commit as GitCommit;
            isMatched = !!(c.message?.toLowerCase().includes(lowerQuery) || 
                          c.author?.toLowerCase().includes(lowerQuery) ||
                          c.sha?.toLowerCase().includes(lowerQuery));
          } else if (n.type === 'folded') {
            const folded = n.data.folded as IFoldedNode;
            isMatched = folded.commits.some(c => 
              c.message?.toLowerCase().includes(lowerQuery) || 
              c.author?.toLowerCase().includes(lowerQuery) ||
              c.sha?.toLowerCase().includes(lowerQuery)
            );
          }
        }

        return {
          ...n,
          style: {
            ...n.style,
            opacity: isSearching ? (isMatched ? 1 : 0.2) : 1,
            zIndex: isSearching && isMatched ? 100 : n.style?.zIndex || 0,
            filter: isSearching && !isMatched ? 'grayscale(80%)' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease'
          },
          className: isSearching && isMatched ? (n.className + ' ring-4 ring-accent-blue/50 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)]') : n.className
        };
      });

    const visibleEdges = fullLayoutedEdges
      .filter(e => typeof e.data?.elementIndex === 'number' && e.data.elementIndex < Math.min(playbackIndex, elements.length + 1))
      .map(e => {
        const isLastCommit = e.data?.elementIndex === playbackIndex - 1;
        return { 
          ...e, 
          animated: isPlaying && isLastCommit,
          style: {
            ...e.style,
            opacity: isSearching ? 0.2 : (e.style?.opacity ?? 0.8),
            transition: 'opacity 0.3s ease'
          }
        };
    });

    setNodes(visibleNodes);
    setEdges(visibleEdges);

    if (isSearching) {
      const firstMatch = visibleNodes.find(n => n.style?.opacity === 1);
      if (firstMatch) {
         const isHorizontal = layoutDirection === 'RIGHT';
         const w = (firstMatch.width as number) || 256;
         const h = (firstMatch.height as number) || 80;
         setTimeout(() => {
           setCenter(
             firstMatch.position.x + w / 2,
             firstMatch.position.y + h / 2,
             { zoom: 1.2, duration: 800 }
           );
         }, 100);
      }
    }
  }, [fullLayoutedNodes, fullLayoutedEdges, playbackIndex, isPlaying, searchQuery, layoutDirection, setCenter, elements.length]);

  return (
    <div className="w-full h-full border border-hairline rounded-2xl overflow-hidden bg-surface relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(e, node) => {
          if (node.type === 'commit') {
            e.stopPropagation();
            setActiveNodeMenu({
              commit: node.data.commit,
              x: e.clientX,
              y: e.clientY
            });
          }
        }}
        onPaneClick={() => setActiveNodeMenu(null)}
        onMove={(e, viewport) => {
          if (typeof window !== 'undefined') {
             const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
             const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
             setSliderX(centerX);
             setSliderY(centerY);
          }
        }}
        colorMode="dark"
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'elk', style: { strokeWidth: 2, stroke: '#505051' }, zIndex: -1 }}
      >
        <AnimatePresence>
          {isLayouting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-surface/50 backdrop-blur-[2px] flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-ash uppercase tracking-widest font-bold">Optimizing Layout...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Background gap={20} color="#161718" />
        <Controls position="bottom-left" style={{ marginBottom: '80px' }} className="!bg-surface-elevated !border-hairline !rounded-lg !fill-white" />
        
        <Panel position="top-left" className="m-4 flex flex-col gap-4 items-start">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-4 py-3 bg-surface-card border border-hairline rounded-xl flex items-center gap-3 shadow-xl"
          >
            <div className="w-8 h-8 bg-accent-blue/10 rounded-lg flex items-center justify-center text-accent-blue font-bold">
              {elements.length}
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink leading-tight">{repoName}</h3>
              <p className="text-[10px] text-ash uppercase tracking-widest">
                Topological View • Step {playbackIndex}/{elements.length}
              </p>
            </div>
          </motion.div>
          
          <ContributorLeaderboard nodes={elements} />
        </Panel>

        <Panel position="top-center" className="mt-6 z-50">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </Panel>

        <Panel position="top-right" className="m-4 flex flex-col gap-4 items-end">
          <ContributorPanel 
            contributors={contributors} 
            activeContributorName={activeContributorName} 
          />
        </Panel>

        <Panel position="bottom-center" className="w-full max-w-xl px-4 sm:px-6 mb-8 z-50 pointer-events-none">
          <div className="relative pointer-events-auto">
            <AnimatePresence>
              {isPlaying && activeContributorName && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: -20, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-accent-blue/90 text-white rounded-full shadow-2xl backdrop-blur-md border border-white/20 whitespace-nowrap z-50"
                >
                  <div className="w-8 h-8 rounded-full border border-white/30 overflow-hidden shadow-inner">
                    {activeAvatar ? (
                      <img src={activeAvatar} alt={activeContributorName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="m-auto mt-2" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider">Contributing now</span>
                    <span className="text-xs font-bold leading-none">{activeContributorName}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface/90 backdrop-blur-2xl border border-hairline/60 rounded-3xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-4 pointer-events-auto"
            >
              <div className="flex items-center gap-3 sm:gap-5">
                <button
                  onClick={() => setIsPlaying(prev => !prev)}
                  className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-white/20 shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] cursor-pointer"
                >
                  {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} className="ml-1" fill="currentColor" />}
                </button>
                
                <button
                  onClick={() => { setPlaybackIndex(1); setIsPlaying(false); }}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-95 cursor-pointer"
                  title="Reset"
                >
                  <RotateCcw size={20} />
                </button>

                <div className="flex-1 px-2">
                  <input
                    type="range"
                    min="1"
                    max={elements.length}
                    value={playbackIndex}
                    onChange={(e) => setPlaybackIndex(parseInt(e.target.value))}
                    className="w-full accent-white h-1.5 sm:h-2 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-colors"
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div 
                  key={playbackIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-3 px-3 py-2 bg-surface-card/50 rounded-lg border border-hairline/30"
                >
                  <Clock size={14} className="text-accent-blue" />
                  <div className="flex-1 min-w-0">
                    {currentElement?.type === 'commit' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-ash">{currentElement.data.sha.substring(0, 7)}</span>
                          <span className="text-xs text-ink font-medium truncate">{currentElement.data.message}</span>
                        </div>
                        <div className="text-[10px] text-ash">
                          {currentElement.data.author} • {new Date(currentElement.data.date).toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                         <span className="text-xs font-bold text-ink">Segment: {currentElement?.commits.length} Linear Commits</span>
                         <span className="text-[10px] text-ash italic">Folded to save space</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Slider for Panning */}
              <div className="pt-3 border-t border-hairline/30 flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-ash tracking-widest min-w-[50px]">
                  {layoutDirection === 'RIGHT' ? 'Pan X' : 'Pan Y'}
                </span>
                <input
                  type="range"
                  min={layoutDirection === 'RIGHT' ? graphBounds.minX : graphBounds.minY}
                  max={layoutDirection === 'RIGHT' ? graphBounds.maxX : graphBounds.maxY}
                  value={layoutDirection === 'RIGHT' ? sliderX : sliderY}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (layoutDirection === 'RIGHT') {
                      setSliderX(val);
                      setCenter(val, (graphBounds.minY + graphBounds.maxY) / 2, { zoom: lockedZoom, duration: 0 });
                    } else {
                      setSliderY(val);
                      setCenter((graphBounds.minX + graphBounds.maxX) / 2, val, { zoom: lockedZoom, duration: 0 });
                    }
                  }}
                  className="w-full h-1 bg-surface-card rounded-lg appearance-none cursor-pointer accent-accent-blue"
                />
              </div>
            </motion.div>
          </div>
        </Panel>
        
        <Panel position="bottom-left" className="m-4">
          <div className="flex items-center p-1 bg-surface-card border border-hairline rounded-xl shadow-lg backdrop-blur-md">
            <button 
              onClick={() => setLayoutDirection('RIGHT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${layoutDirection === 'RIGHT' ? 'bg-accent-blue text-white shadow-sm' : 'text-ash hover:text-white'}`}
            >
              {t.horizontal}
            </button>
            <button 
              onClick={() => setLayoutDirection('DOWN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${layoutDirection === 'DOWN' ? 'bg-accent-blue text-white shadow-sm' : 'text-ash hover:text-white'}`}
            >
              {t.vertical}
            </button>
          </div>
        </Panel>

        <Panel position="bottom-right" className="m-4">
          <div className="flex flex-col gap-2">
            {unfurledIds.size > 0 && (
              <button 
                onClick={() => {
                  setUnfurledIds(new Set());
                  const firstEl = elements[0];
                  const firstId = firstEl.type === 'commit' ? firstEl.data.sha : firstEl.id;
                  lastFoldedIdRef.current = firstId;
                }}
                className="flex items-center gap-2 p-2 bg-accent-blue/10 border border-accent-blue/20 rounded-lg text-accent-blue text-[10px] hover:bg-accent-blue/20 transition-colors"
              >
                <Minimize2 size={12} />
                <span>{t.collapseAll}</span>
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 p-2 bg-surface-elevated border border-hairline rounded-lg text-ash text-[10px]">
              <Info size={12} className="shrink-0" />
              <span>{t.clickHint}</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Node Action Menu */}
      <AnimatePresence>
        {activeNodeMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="fixed z-50 bg-surface-elevated/90 backdrop-blur-md border border-hairline rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[160px]"
            style={{ 
              left: Math.min(activeNodeMenu.x, window.innerWidth - 200),
              top: Math.min(activeNodeMenu.y + 10, window.innerHeight - 150)
            }}
          >
            <button
              onClick={() => {
                window.open(activeNodeMenu.commit.github_url, '_blank');
                setActiveNodeMenu(null);
              }}
              className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-ash hover:text-white hover:bg-white/5 transition-colors text-left"
            >
              <ExternalLink size={14} /> {t.viewOnGithub}
            </button>
            <div className="h-px w-full bg-hairline" />
            <button
              onClick={async () => {
                const commitId = activeNodeMenu.commit.sha;
                const branchName = activeNodeMenu.commit.branch || 'unknown';
                const message = activeNodeMenu.commit.message || '';
                const githubUrl = activeNodeMenu.commit.github_url || '';
                setActiveNodeMenu(null);
                
                const parsedData = parseCommitData(message);
                setSummaryData({ repoName, commitSha: commitId, branch: branchName, githubUrl, message, parsedData, fileStats: [], rawDiff: '' });
                setIsSummarizing(true);
                
                try {
                  const res = await fetch(`https://api.github.com/repos/${repoName}/commits/${commitId}`);
                  if (res.ok) {
                     const data = await res.json();
                     
                     const validFiles = data.files?.filter((f: any) => f.patch) || [];
                     const rawDiff = validFiles.map((f: any) => {
                       return `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`;
                     }).join('\n');
                     
                     const fileStats = data.files?.map((f: any) => ({
                       name: f.filename,
                       status: f.status,
                       add: f.additions,
                       del: f.deletions
                     })) || [];

                     const fileNames = data.files?.map((f: any) => f.filename) || [];
                     const stats = { additions: data.stats?.additions || 0, deletions: data.stats?.deletions || 0 };
                     const updatedParsedData = parseCommitData(message, fileNames, stats);
                     
                     setSummaryData(prev => prev ? { ...prev, parsedData: updatedParsedData, fileStats, rawDiff } : null);
                  }
                } catch (e) {
                  console.error("Failed to fetch commit diff:", e);
                } finally {
                  setIsSummarizing(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-accent-blue hover:text-white hover:bg-accent-blue/20 transition-colors text-left"
            >
              <FileText size={14} /> {t.viewSummary}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Commit Summary Panel */}
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
