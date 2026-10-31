import { Color, Vector3 } from 'three';
import { clamp, damp, lerp, smoothstep } from '../../../core/math';
import voxelFrag from '../../shaders/dragon/voxel.frag.glsl';
import voxelVert from '../../shaders/dragon/voxel.vert.glsl';
import type { FrameContext } from '../../types';
import { PIXEL, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';
import { headInfo } from '../heads';

/** One palette per hobby level: gaming, food, music, imagination, talking. */
export const HOBBY_PALETTES: [string, string][] = [
  ['#ff2bd6', '#2bf0ff'],
  ['#ff6a14', '#ffd23f'],
  ['#8a5bff', '#ff4fa3'],
  ['#20ffc8', '#4f7bff'],
  ['#ff5fa8', '#ffe6f3'],
];

/**
 * 02 · PIXEL — The Prism Wyrm, ~2,000 instanced cubes. Every time the reader
 * reaches a new hobby it bursts into pixels and re-forms in that hobby's
 * colours; it pulses to the beat on "music" and drifts apart on "imagination".
 */
export class Pixel extends Dragon {
  private readonly colA = new Color(HOBBY_PALETTES[0][0]);
  private readonly colB = new Color(HOBBY_PALETTES[0][1]);
  private readonly targetA = new Color();
  private readonly targetB = new Color();
  private level = -1;
  private changedAt = -10;
  private readonly focus = new Vector3();

  constructor() {
    super('pixel', 1, PIXEL.length, 96, {
      keyDir: new Vector3(0.3, 0.85, 0.45),
      key: new Color(1, 1, 1),
      sky: new Color(0.1, 0.02, 0.15),
      ground: new Color(0.02, 0.05, 0.1),
      rim: new Color(0.6, 0.2, 0.9),
      envTop: new Color(0.1, 0.02, 0.2),
      envHorizon: new Color(0.6, 0.1, 0.5),
      envBottom: new Color(0.02, 0.1, 0.2),
    });
  }

  build(result: BlueprintResult) {
    const info = headInfo({ len: 2.3, w: 0.62, h: 0.58, snout: 0.26, brow: 1.2, cheek: 1.0, jaw: 0.22, neck: 0, eye: 0.11 });
    Object.assign(this.uniforms, {
      uColA: { value: this.colA },
      uColB: { value: this.colB },
      uBurst: { value: 0 },
      uBeat: { value: 0 },
      uDrift: { value: 0 },
      uHinge: { value: new Vector3(...info.hinge) },
    });
    const material = this.material(voxelVert, voxelFrag);
    this.mesh(toGeometry(result.pack.voxels), material);
    this.ready = true;
  }

  /** Current hobby colours, for the sky and HUD to follow. */
  get palette(): [Color, Color] {
    return [this.colA, this.colB];
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, center, chapter } = ctx;
    const level = clamp(Math.round(chapter), 0, 4);
    if (level !== this.level) {
      if (this.level >= 0) this.changedAt = t;
      this.level = level;
    }
    const since = t - this.changedAt;
    const burst = smoothstep(0, 0.12, since) * (1 - smoothstep(0.3, 1.25, since));
    const [a, b] = HOBBY_PALETTES[level];
    this.targetA.set(a);
    this.targetB.set(b);
    const k = 1 - Math.exp(-dt * (since < 0.6 ? 10 : 3));
    this.colA.lerp(this.targetA, k);
    this.colB.lerp(this.targetB, k);
    const u = this.uniforms;
    u.uBurst.value = Math.max(burst, this.rage * 0.8);
    u.uBeat.value = (1 - clamp(Math.abs(chapter - 2))) * (0.6 + 0.4 * Math.sin(t * 8.5));
    u.uDrift.value = (1 - clamp(Math.abs(chapter - 3))) * 0.9;

    // swim in a playful loop on the right of the current level
    const portrait = ctx.aspect < 1;
    // circle the hobby visual on the right half of the screen
    this.focus.set(center.x + lerp(-6, 6, chapter / 4) * 0.6 + (portrait ? 0 : 6.2), center.y + (portrait ? -2.4 : 0.3), center.z - 2);
    this.uHead += dt * (3.4 + this.rage * 5);
    const f = this.focus;
    const rx = portrait ? 3.6 : 4.6;
    const ry = portrait ? 1.6 : 3.1;
    this.follow(
      (u2, out) => {
        const ang = u2 / 4.6;
        // a square-ish, game-like loop with zig-zag steps
        const sq = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), 0.6);
        out.set(
          f.x + sq(Math.cos(ang)) * rx,
          f.y + sq(Math.sin(ang)) * ry + Math.sin(ang * 5 + t) * 0.25,
          f.z + Math.sin(ang * 2) * 2.2,
        );
      },
      this.uHead,
      PIXEL.length / (96 * 3),
      center,
    );
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.6);
    this.track(this.lookTarget, dt, 0.8, 0.5, 5);
    u.uJaw.value = 0.1 + 0.08 * Math.max(0, Math.sin(t * 4)) + this.rage * 0.5;
    u.uFlow.value = damp(u.uFlow.value, Math.abs(ctx.velocity) * 0.03, 3, dt);
  }
}
