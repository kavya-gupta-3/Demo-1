import type { PerspectiveCamera, Vector2, Vector3 } from 'three';
import type { Quality } from '../core/quality';

export interface FrameContext {
  time: number;
  dt: number;
  /** Progress through this dragon's own section (0‥1). */
  local: number;
  /** Visibility: 1 when the camera is at this stage, 0 a full stage away. */
  weight: number;
  /** World-space centre of this dragon's stage. */
  center: Vector3;
  camera: PerspectiveCamera;
  /** Pointer in normalised device coordinates. */
  pointer: Vector2;
  /** Pointer projected onto the stage's z = 0 plane. */
  pointerWorld: Vector3;
  /** Smoothed scroll velocity (px per frame at 60fps). */
  velocity: number;
  /** Sub-progress used by sections with internal chapters (hobbies). */
  chapter: number;
  quality: Quality;
  /** Viewport aspect ratio. */
  aspect: number;
  /** Current renderer pixel ratio (for point sizes). */
  pixelRatio: number;
}
