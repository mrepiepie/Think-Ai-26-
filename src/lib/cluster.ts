export interface ScreenPoint<T> {
  x: number;
  y: number;
  item: T;
}

export interface Cluster<T> {
  id: string;
  x: number;
  y: number;
  items: T[];
}

/**
 * Greedy screen-space clustering. Points closer than `radius` pixels to
 * an existing cluster centre join it. Because it runs on projected screen
 * positions, clusters split naturally as the user zooms in.
 */
export function clusterPoints<T>(
  points: ScreenPoint<T>[],
  radius: number,
  idOf: (item: T) => string,
): Cluster<T>[] {
  const r2 = radius * radius;
  const clusters: { sx: number; sy: number; x: number; y: number; items: T[] }[] = [];

  for (const p of points) {
    let best: (typeof clusters)[number] | null = null;
    let bestD = r2;
    for (const c of clusters) {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      best.items.push(p.item);
      best.sx += p.x;
      best.sy += p.y;
      best.x = best.sx / best.items.length;
      best.y = best.sy / best.items.length;
    } else {
      clusters.push({ sx: p.x, sy: p.y, x: p.x, y: p.y, items: [p.item] });
    }
  }

  return clusters.map((c) => ({
    id: c.items.map(idOf).sort()[0] + ":" + c.items.length,
    x: c.x,
    y: c.y,
    items: c.items,
  }));
}

/** Circle radius for a cluster of `count` markers. */
export function clusterRadius(count: number): number {
  return count <= 1 ? 4.5 : 8 + Math.sqrt(count) * 3.2;
}
