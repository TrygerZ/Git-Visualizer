import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { GitCommit, FoldedNode as IFoldedNode } from '../types';

function matchNode(node: Node, query: string): boolean {
  if (!query) return false;
  const lowerQuery = query.toLowerCase();
  const data = node.data as Record<string, unknown>;

  if (node.type === 'commit') {
    const commit = data.commit as GitCommit | undefined;
    return (
      commit?.message?.toLowerCase().includes(lowerQuery) ||
      commit?.author?.toLowerCase().includes(lowerQuery) ||
      commit?.sha?.toLowerCase().includes(lowerQuery)
    );
  }

  if (node.type === 'folded') {
    const folded = data.folded as IFoldedNode | undefined;
    return folded?.commits?.some((c) =>
      c.message?.toLowerCase().includes(lowerQuery) ||
      c.author?.toLowerCase().includes(lowerQuery) ||
      c.sha?.toLowerCase().includes(lowerQuery)
    ) ?? false;
  }

  return false;
}

interface FilterResult {
  visibleNodes: Node[];
  visibleEdges: Edge[];
  firstMatch: Node | undefined;
}

export function useGraphFilter(
  fullLayoutedNodes: Node[],
  fullLayoutedEdges: Edge[],
  searchQuery: string,
  playbackIndex: number,
  elementsLength: number,
  isPlaying: boolean
): FilterResult {
  return useMemo(() => {
    const isSearching = searchQuery.trim().length > 0;
    const maxIndex = Math.min(playbackIndex, elementsLength + 1);

    const matchedNodeIds = new Set<string>();
    if (isSearching) {
      fullLayoutedNodes.forEach((n) => {
        if (matchNode(n, searchQuery)) {
          matchedNodeIds.add(n.id);
        }
      });
    }

    const visibleNodes = fullLayoutedNodes
      .filter((n) => {
        const data = n.data as Record<string, unknown>;
        return typeof data.elementIndex === 'number' && (data.elementIndex as number) < maxIndex;
      })
      .map((n) => {
        const isMatched = matchedNodeIds.has(n.id);
        return {
          ...n,
          zIndex: isSearching && isMatched ? 100 : (n.zIndex ?? 10),
          style: {
            ...(n.style ?? {}),
            opacity: isSearching ? (isMatched ? 1 : 0.2) : 1,
            filter: isSearching && !isMatched ? 'grayscale(80%)' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease',
          },
          className: isSearching && isMatched
            ? `${n.className || ''} ring-4 ring-accent-blue/50 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)]`
            : (n.className || ''),
        } as Node;
      });

    const visibleEdges = fullLayoutedEdges
      .filter((e) => {
        const data = e.data as Record<string, unknown>;
        return typeof data.elementIndex === 'number' && (data.elementIndex as number) < maxIndex;
      })
      .map((e) => {
        const data = e.data as Record<string, unknown>;
        const isLastCommit = data.elementIndex === playbackIndex - 1;
        const sourceMatched = matchedNodeIds.has(e.source);
        const targetMatched = matchedNodeIds.has(e.target);
        return {
          ...e,
          animated: isPlaying && isLastCommit,
          style: {
            ...(e.style ?? {}),
            opacity: isSearching && !sourceMatched && !targetMatched ? 0.2 : (e.style?.opacity ?? 0.8),
            transition: 'opacity 0.3s ease',
          },
        } as Edge;
      });

    const firstMatch = isSearching
      ? visibleNodes.find((n) => {
          const style = n.style as Record<string, unknown> | undefined;
          return style?.opacity === 1;
        })
      : undefined;

    return { visibleNodes, visibleEdges, firstMatch };
  }, [fullLayoutedNodes, fullLayoutedEdges, searchQuery, playbackIndex, elementsLength, isPlaying]);
}
