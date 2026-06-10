import { BaseEdge, EdgeProps } from '@xyflow/react';

interface Point {
  x: number;
  y: number;
}

function filterPoints(points: Point[]): Point[] {
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
}

function roundedPolyline(rawPoints: Point[], r: number): string {
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
}

interface ElkSection {
  startPoint: Point;
  endPoint: Point;
  bendPoints?: Point[];
}

interface LayoutedEdge {
  sections?: ElkSection[];
}

export function ElkCustomEdge({
  id,
  style,
  markerEnd,
  animated,
  data,
}: EdgeProps) {
  const layoutedEdge = (data as { layoutedEdge?: LayoutedEdge })?.layoutedEdge;
  let pathData = '';

  if (layoutedEdge?.sections != null && layoutedEdge.sections.length > 0) {
    const section = layoutedEdge.sections[0];
    if (!section?.startPoint || !section?.endPoint) {
      return <BaseEdge id={id} path="" style={style} markerEnd={markerEnd} />;
    }
    const { startPoint, bendPoints = [], endPoint } = section;
    const points = [startPoint, ...bendPoints, endPoint].filter(
      (p) => p && typeof p.x === 'number' && typeof p.y === 'number'
    );
    if (points.length < 2) {
      return <BaseEdge id={id} path="" style={style} markerEnd={markerEnd} />;
    }
    pathData = roundedPolyline(points, 15);
  }

  return (
    <BaseEdge
      id={id}
      path={pathData}
      style={style}
      markerEnd={markerEnd}
      className="react-flow__edge-path"
    />
  );
}
