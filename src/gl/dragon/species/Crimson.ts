import { Color, DoubleSide, Vector3 } from 'three';
import { clamp, damp, lerp, smoothstep } from '../../../core/math';
import crimsonFrag from '../../shaders/dragon/crimson.frag.glsl';
import dragonVert from '../../shaders/dragon/dragon.vert.glsl';
import eyeFrag from '../../shaders/dragon/eye.frag.glsl';
import eyeVert from '../../shaders/dragon/eye.vert.glsl';
import wingFrag from '../../shaders/dragon/wing.frag.glsl';
import wingVert from '../../shaders/dragon/wing.vert.glsl';
import { Emitter, Kind } from '../../fx/Emitter';
import type { FrameContext } from '../../types';
import { CRIMSON, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';

const p = new Vector3();
const v = new Vector3();
const T = new Vector3();
const N = new Vector3();
const B = new Vector3();
const fire = new Color(1.0, 0.25, 0.06);
const ember = new Color(1.0, 0.5, 0.15);

/**
 * 07 · CRIMSON — The Ember Herald. A wyvern with wings of living flame that
 * circles the contact form. Send a message and it carries it: a roar, a
 * blast of fire and a dive straight past the camera.
 */
export class Crimson extends Dragon {
  readonly fire = new Emitter(1400, { gravity: -1.2, drag: 1.4, turbulence: 2.5, buoyancy: 2 });
  private beat = 0;
  private swoopAt = -100;
  private breath = 0;

  constructor() {
    super('crimson', 6, CRIMSON.length, 112, {
      keyDir: new Vector3(-0.4, 0.7, 0.6),
      key: new Color(1.0, 0.75, 0.65).multiplyScalar(1.6),
      sky: new Color(0.12, 0.02, 0.03),
      ground: new Color(0.3, 0.05, 0.02),
      rim: new Color(1.0, 0.15, 0.1).multiplyScalar(0.4),
      envTop: new Color(0.25, 0.05, 0.06),
      envHorizon: new Color(0.35, 0.04, 0.03),
      envBottom: new Color(0.6, 0.12, 0.03),
    });
    this.spine.bankGain = 3.5;
    this.group.add(this.fire.points);
  }

  build(result: BlueprintResult) {
    const m = this.material(dragonVert, crimsonFrag, {
      uLen: { value: CRIMSON.length },
      uRed: { value: new Color(0.62, 0.03, 0.05) },
      uEmber: { value: new Color(1.0, 0.32, 0.06) },
    });
    this.mesh(toGeometry(result.pack.main), m);
    const eyes = this.material(eyeVert, eyeFrag, {
      uEyeColor: { value: new Color(1.0, 0.85, 0.3) },
      uEyeColor2: { value: new Color(1.0, 0.15, 0.05) },
    });
    this.mesh(toGeometry(result.pack.eyes), eyes);
    const wingGeo = toGeometry(result.pack.wing);
    for (const side of [1, -1]) {
      const wm = this.material(
        wingVert,
        wingFrag,
        {
          uSide: { value: side },
          uWingS: { value: CRIMSON.shoulder },
          uWingRoot: { value: new Vector3(0.05, 0.36, 0.34) },
          uSweep: { value: 0.38 },
          uSpan: { value: 6.8 },
          uDihedral: { value: 0.1 },
          uTintA: { value: new Color(0.9, 0.08, 0.04) },
          uTintB: { value: new Color(1.0, 0.45, 0.08) },
        },
        { side: DoubleSide, defines: { FIRE: '' } },
      );
      this.mesh(wingGeo, wm);
    }
    this.ready = true;
  }

  /** The message has been sent: roar, breathe fire, dive past the camera. */
  swoop(time: number) {
    this.swoopAt = time;
    this.rage = 1;
    this.breath = 1.6;
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    this.breath = 1.2;
  }

  private wingTip(side: number, out: Vector3) {
    const s = CRIMSON.shoulder;
    this.spine.sample(s, out);
    this.spine.tangent(s, T);
    this.spine.normal(s, N);
    B.crossVectors(T, N);
    const flap = this.uniforms.uFlap.value as number;
    const span = 6.0;
    return out
      .addScaledVector(B, side * span * Math.cos(flap))
      .addScaledVector(N, span * Math.sin(flap) * 0.9)
      .addScaledVector(T, span * 0.45);
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, center } = ctx;
    const portrait = ctx.aspect < 1;
    this.beat += dt * (3 + this.rage * 3);
    this.uHead += dt * (3.6 + this.rage * 4);
    const since = t - this.swoopAt;
    const dive = smoothstep(0, 0.6, since) * (1 - smoothstep(1.6, 3.2, since));
    // arrive circling the open right side of the heading, drift over the form as it is read
    const k = smoothstep(0.15, 0.85, ctx.local);
    const cx = center.x + (portrait ? 0 : lerp(4.5, 1.5, k));
    const cy = center.y + lerp(2.6, 1.6, k);
    const cz = lerp(center.z - lerp(3, 7, k), ctx.camera.position.z - 6, dive);
    const rx = lerp(portrait ? 4.5 : 7, 3, dive);
    const rz = lerp(5, 2, dive);
    this.follow(
      (u, out) => {
        const ang = u / 7;
        out.set(cx + Math.cos(ang) * rx, cy + Math.sin(ang * 2) * 1.4 + Math.cos(ang * 0.5) * 0.8, cz + Math.sin(ang) * rz);
      },
      this.uHead,
      CRIMSON.length / (112 * 3),
      center,
    );
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.6);
    this.track(this.lookTarget, dt, 0.7, 0.5, 3.5);
    const u = this.uniforms;
    const w = Math.sin(this.beat);
    u.uFlap.value = 0.15 + w * 0.6;
    u.uFold.value = -0.3 * Math.max(0, Math.cos(this.beat));
    this.breath = Math.max(0, this.breath - dt);
    u.uJaw.value = damp(u.uJaw.value, 0.06 + (this.breath > 0 ? 0.55 : 0) + this.rage * 0.2, 10, dt);
    u.uLegs.value.set(0, 0, 0.9, 0.9);
    u.uHeat.value = this.rage;

    // flame trails from the wingtips
    const rate = 70 + this.rage * 120;
    for (const side of [1, -1]) {
      if (Math.random() < clamp(dt * rate * 0.5, 0, 1)) {
        this.wingTip(side, p);
        v.set((Math.random() - 0.5) * 0.6, Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
        this.fire.spawn(p, v, Math.random() < 0.7 ? fire : ember, 0.7 + Math.random() * 0.5, 0.5 + Math.random() * 0.6, Kind.Fire);
      }
    }
    // fire breath
    if (this.breath > 0) {
      for (let i = 0; i < 6; i++) {
        this.snout(p, 2.1);
        this.spine.tangent(0, T);
        v.copy(T).multiplyScalar(-9 - Math.random() * 6);
        v.x += (Math.random() - 0.5) * 3;
        v.y += (Math.random() - 0.5) * 3;
        v.z += (Math.random() - 0.5) * 3;
        this.fire.spawn(p, v, fire, 0.6 + Math.random() * 0.5, 0.9 + Math.random() * 0.9, Kind.Fire);
      }
    }
    this.fire.update(dt, t, ctx.pixelRatio);
  }
}
