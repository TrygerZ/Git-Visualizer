import { useState, useCallback } from 'react';
import { Node } from '@xyflow/react';

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ComputeResult {
  bounds: Bounds;
  optimalZoom: number;
}

export function useGraphBounds() {
  const [bounds, setBounds] = useState<Bounds>({ minX: 0, maxX: 1000, minY: 0, maxY: 100 });
  const [lockedZoom, setLockedZoom] = useState(1);

  const computeBounds = useCallback((nodes: Node[], direction: 'RIGHT' | 'DOWN'): ComputeResult | null => {
    if (nodes.length === 0) return null;

    const isHorizontal = direction === 'RIGHT';
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const w = node.width ?? 256;
      const h = node.height ?? 80;
      if (node.position.x < minX) minX = node.position.x;
      if (node.position.x + w > maxX) maxX = node.position.x + w;
      if (node.position.y < minY) minY = node.position.y;
      if (node.position.y + h > maxY) maxY = node.position.y + h;
    });

    const newBounds: Bounds = { minX, maxX, minY, maxY };
    setBounds(newBounds);

    let optimalZoom = 1;
    if (isHorizontal) {
      const totalHeight = Math.max(maxY - minY, 100);
      optimalZoom = (window.innerHeight - 250) / totalHeight;
    } else {
      const totalWidth = Math.max(maxX - minX, 100);
      optimalZoom = (window.innerWidth - 100) / totalWidth;
    }
    optimalZoom = Math.min(Math.max(optimalZoom, 0.1), 1.5);
    setLockedZoom(optimalZoom);

    return { bounds: newBounds, optimalZoom };
  }, []);

  return { bounds, lockedZoom, computeBounds };
}
