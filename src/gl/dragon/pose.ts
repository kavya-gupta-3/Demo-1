import type { Vector3 } from 'three';

/**
 * Samples a centripetal-free (uniform) Catmull-Rom spline through `pts`
 * into `out` (xyz triplets). Returns the number of points written. Used to
 * pose hovering dragons without allocating per frame.
 */
export function catmullRom(pts: Vector3[], perSegment: number, out: Float32Array): number {
  const n = pts.length;
  let w = 0;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const steps = i === n - 2 ? perSegment + 1 : perSegment;
    for (let k = 0; k < steps; k++) {
      const t = k / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const a = -0.5 * t3 + t2 - 0.5 * t;
      const b = 1.5 * t3 - 2.5 * t2 + 1;
      const c = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const d = 0.5 * t3 - 0.5 * t2;
      if (w + 3 > out.length) return w / 3;
      out[w++] = a * p0.x + b * p1.x + c * p2.x + d * p3.x;
      out[w++] = a * p0.y + b * p1.y + c * p2.y + d * p3.y;
      out[w++] = a * p0.z + b * p1.z + c * p2.z + d * p3.z;
    }
  }
  return w / 3;
}
