export interface Vec2 {
  x: number;
  y: number;
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(distSq(x1, y1, x2, y2));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function projectPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; t: number; distSq: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return { x: ax, y: ay, t: 0, distSq: distSq(px, py, ax, ay) };
  }

  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const projX = ax + t * abx;
  const projY = ay + t * aby;

  return {
    x: projX,
    y: projY,
    t,
    distSq: distSq(px, py, projX, projY),
  };
}
