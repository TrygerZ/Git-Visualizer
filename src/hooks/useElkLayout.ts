import { useState, useRef, useCallback } from 'react';
import { Node, Edge, Position } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function useElkLayout() {
  const [isLayouting, setIsLayouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layoutGenRef = useRef(0);

  const runLayout = useCallback(async (
    nodes: Node[],
    edges: Edge[],
    direction: 'RIGHT' | 'DOWN'
  ): Promise<LayoutResult> => {
    const gen = ++layoutGenRef.current;
    setIsLayouting(true);
    setError(null);

    try {
      const isHorizontal = direction === 'RIGHT';
      const graph = {
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
        children: nodes.map((node) => ({
          id: node.id,
          width: node.type === 'folded' ? 128 : 256,
          height: node.type === 'folded' ? 40 : 80,
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
        })),
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

      if (gen !== layoutGenRef.current) {
        throw new Error('Stale layout');
      }

      const layoutedNodes = nodes.map((node) => {
        const layoutedChild = layoutedGraph.children?.find((n) => n.id === node.id);
        return {
          ...node,
          position: {
            x: layoutedChild?.x || 0,
            y: layoutedChild?.y || 0,
          },
          targetPosition: isHorizontal ? Position.Left : Position.Top,
          sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
          zIndex: 10,
        };
      });

      const layoutedEdges = edges.map((edge) => {
        const layoutedEdge = layoutedGraph.edges?.find((e) => e.id === edge.id);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute graph layout';
      if (message !== 'Stale layout') {
        setError(message);
      }
      throw err;
    } finally {
      setIsLayouting(false);
    }
  }, []);

  return { runLayout, isLayouting, layoutError: error, layoutGenRef };
}
