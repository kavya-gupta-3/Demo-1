import { Color, DoubleSide, Vector3 } from 'three';
import { clamp, damp, lerp } from '../../../core/math';
import aurumFrag from '../../shaders/dragon/aurum.frag.glsl';
import dragonVert from '../../shaders/dragon/dragon.vert.glsl';
import eyeFrag from '../../shaders/dragon/eye.frag.glsl';
import eyeVert from '../../shaders/dragon/eye.vert.glsl';
import wingFrag from '../../shaders/dragon/wing.frag.glsl';
import wingVert from '../../shaders/dragon/wing.vert.glsl';
import type { FrameContext } from '../../types';
import { AURUM, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';
import { catmullRom } from '../pose';

/**
 * 05 · AURUM — The Hoard King. A heraldic golden dragon that hovers over
 * the achievements, rearing with wings spread and beating slowly. Provoked,
 * it roars and throws its wings wide.
 */
export class Aurum extends Dragon {
  private readonly ctrl = Array.from({ length: 9 }, () => new Vector3());
  private readonly dense = new Float32Array(9 * 40 * 3);
  private beat = 0;
  private spread = 0;
  onRoar: (() => void) | null = null;

  constructor() {
    super('aurum', 4, AURUM.length, 112, {
      keyDir: new Vector3(0.45, 0.75, 0.6),
      key: new Color(1.0, 0.9, 0.72).multiplyScalar(2.4),
      sky: new Color(0.35, 0.25, 0.12),
      ground: new Color(0.08, 0.04, 0.01),
      rim: new Color(1.0, 0.75, 0.35).multiplyScalar(0.35),
      envTop: new Color(1.1, 0.95, 0.7),
      envHorizon: new Color(0.55, 0.32, 0.1),
      envBottom: new Color(0.05, 0.025, 0.01),
    });
    this.spine.up.set(0, 0.35, -1).normalize();
    this.spine.upRelax = 0.12;
  }

  build(result: BlueprintResult) {
    const m = this.material(dragonVert, aurumFrag, {
      uLen: { value: AURUM.length },
      uGold: { value: new Color(1.0, 0.74, 0.3) },
      uGoldPale: { value: new Color(1.0, 0.88, 0.6) },
    });
    this.mesh(toGeometry(result.pack.main), m);
    const eyes = this.material(eyeVert, eyeFrag, {
      uEyeColor: { value: new Color(1.0, 0.2, 0.12) },
      uEyeColor2: { value: new Color(1.0, 0.75, 0.2) },
    });
    this.mesh(toGeometry(result.pack.eyes), eyes);
    const wingGeo = toGeometry(result.pack.wing);
    for (const side of [1, -1]) {
      const wm = this.material(
        wingVert,
        wingFrag,
        {
          uSide: { value: side },
          uWingS: { value: AURUM.shoulder },
          uWingRoot: { value: new Vector3(0.1, 0.42, 0.42) },
          uFlap: this.uniforms.uFlap,
          uFold: this.uniforms.uFold,
          uSweep: { value: 0.32 },
          uSpan: { value: 7.6 },
          uDihedral: { value: 0.15 },
          uTintA: { value: new Color(0.85, 0.42, 0.08) },
          uTintB: { value: new Color(1.0, 0.78, 0.35) },
        },
        { side: DoubleSide, defines: { GOLD: '' } },
      );
      this.mesh(wingGeo, wm);
    }
    this.ready = true;
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    this.onRoar?.();
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, center, local } = ctx;
    const portrait = ctx.aspect < 1;
    this.beat += dt * (2.1 + this.rage * 2.5);
    const w = Math.sin(this.beat);
    this.spread = damp(this.spread, this.rage, 3, dt);
    const bob = -w * 0.35;
    const sway = Math.sin(t * 0.5) * 0.6;
    const c = center;
    const ox = portrait ? 0 : lerp(2.2, -2.2, clamp(local * 1.2));
    const oy = portrait ? 3.4 : 1.6;
    const p = this.ctrl;
    p[0].set(c.x + ox + 1.2 + sway, c.y + oy + 3.6 + bob, c.z + 2.2);
    p[1].set(c.x + ox + 0.6 + sway * 0.5, c.y + oy + 2.6 + bob, c.z + 1.4);
    p[2].set(c.x + ox + 0.1, c.y + oy + 1.3 + bob * 0.8, c.z + 0.3);
    p[3].set(c.x + ox - 0.1, c.y + oy - 0.3 + bob * 0.6, c.z - 0.2);
    p[4].set(c.x + ox - 0.4, c.y + oy - 1.9 + bob * 0.4, c.z - 0.2);
    p[5].set(c.x + ox - 1.8, c.y + oy - 3.0 + bob * 0.2, c.z + 0.6);
    p[6].set(c.x + ox - 1.2 + Math.sin(t * 0.9) * 0.4, c.y + oy - 4.3, c.z + 1.9);
    p[7].set(c.x + ox + 1.2, c.y + oy - 4.6 + Math.sin(t * 1.1) * 0.3, c.z + 1.6);
    p[8].set(c.x + ox + 2.7 + Math.sin(t * 1.3) * 0.5, c.y + oy - 3.7, c.z + 0.4);
    const n = catmullRom(p, 40, this.dense);
    this.spine.fromPoints(this.dense, n);

    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.6);
    this.track(this.lookTarget, dt, 0.7, 0.5, 3);
    const u = this.uniforms;
    u.uFlap.value = lerp(0.2 + w * 0.6, 0.85 + w * 0.12, this.spread);
    u.uFold.value = lerp(-0.35 * Math.max(0, Math.cos(this.beat)), -0.1, this.spread);
    u.uJaw.value = 0.05 + this.rage * 0.6;
    u.uLegs.value.set(0.25 + w * 0.08, 0.25 + w * 0.08, -0.25 + w * 0.05, -0.25 + w * 0.05);
  }
}
