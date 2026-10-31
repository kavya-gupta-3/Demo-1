import { Color, Vector3 } from 'three';
import { clamp, damp, lerp, smoothstep } from '../../../core/math';
import eyeFrag from '../../shaders/dragon/eye.frag.glsl';
import eyeVert from '../../shaders/dragon/eye.vert.glsl';
import ignisFrag from '../../shaders/dragon/ignis.frag.glsl';
import dragonVert from '../../shaders/dragon/dragon.vert.glsl';
import type { FrameContext } from '../../types';
import { IGNIS, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';
import { Emitter, Kind } from '../../fx/Emitter';

const p = new Vector3();
const v = new Vector3();
const T = new Vector3();
const fireCol = new Color(1.0, 0.32, 0.05);
const emberCol = new Color(1.0, 0.6, 0.18);

/**
 * 01 · IGNIS — The Obsidian Sovereign. A long celestial serpent that coils
 * around the name in the hero, then drifts right and spirals while the
 * manifesto is read.
 */
export class Ignis extends Dragon {
  private flow = 0;
  private center = new Vector3();
  private breath = 0;
  readonly fire = new Emitter(1600, { gravity: -0.6, drag: 1.2, turbulence: 2.2, buoyancy: 2.5 });

  constructor() {
    super('ignis', 0, IGNIS.length, 128, {
      keyDir: new Vector3(0.35, 0.8, 0.55),
      key: new Color(1.0, 0.78, 0.6).multiplyScalar(1.5),
      sky: new Color(0.03, 0.025, 0.035),
      ground: new Color(0.3, 0.07, 0.015),
      rim: new Color(1.0, 0.3, 0.05).multiplyScalar(0.22),
      envTop: new Color(0.015, 0.014, 0.02),
      envHorizon: new Color(0.06, 0.025, 0.015),
      envBottom: new Color(0.32, 0.07, 0.012),
    });
    this.spine.upRelax = 0.06;
    this.group.add(this.fire.points);
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    this.breath = 1.4;
  }

  build(result: BlueprintResult) {
    const body = this.material(dragonVert, ignisFrag, {
      uLen: { value: IGNIS.length },
      uLavaA: { value: new Color(1.0, 0.18, 0.02) },
      uLavaB: { value: new Color(1.0, 0.72, 0.22) },
    });
    this.mesh(toGeometry(result.pack.main), body);
    const eyes = this.material(eyeVert, eyeFrag, {
      uEyeColor: { value: new Color(1.0, 0.62, 0.12) },
      uEyeColor2: { value: new Color(1.0, 0.2, 0.02) },
    });
    this.mesh(toGeometry(result.pack.eyes), eyes);
    this.ready = true;
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, local, center } = ctx;
    // 0 = hero ring around the name, 1 = tilted orbit on the right for the manifesto
    const k = smoothstep(0.08, 0.55, local);
    const speedBoost = clamp(Math.abs(ctx.velocity) * 0.04, 0, 3);
    this.flow = damp(this.flow, speedBoost, 3, ctx.dt);
    this.uHead += dt * (2.4 + this.flow * 2 + this.rage * 4);
    const wide = ctx.aspect < 1 ? 0.55 : ctx.aspect < 1.4 ? 0.78 : 1;
    this.center.set(center.x + lerp(0, 6.2 * wide, k), center.y + lerp(0.55, 0.6, k), center.z + lerp(0, -3, k));
    const rx = lerp(9.4 * wide + 0.4, 5.2 * wide + 0.8, k);
    const rz = lerp(5.2, 4.2, k);
    const roll = lerp(0.04, 0.55, k);
    const pitch = lerp(0.3, 0.2, k);
    const amp = lerp(0.9, 2.4, k);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const c = this.center;
    const R = 7.6;
    this.follow(
      (u, out) => {
        const a = u / R;
        const x0 = Math.cos(a) * rx;
        const z0 = Math.sin(a) * rz;
        const y0 = Math.sin(a * 2 + 0.6) * amp + Math.sin(a * 3.7 + t * 0.4) * 0.3;
        // pitch the ring toward the camera so it reads as a loop, then roll it
        const y1 = y0 * cp + z0 * sp;
        const z1 = -y0 * sp + z0 * cp;
        out.set(c.x + x0 * cr - y1 * sr, c.y + x0 * sr + y1 * cr, c.z + z1);
      },
      this.uHead,
      IGNIS.length / (128 * 3),
      center,
    );
    // look at the viewer, nudged by the pointer
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.55);
    this.track(this.lookTarget, dt, 0.7, 0.5, 3.5);
    const u = this.uniforms;
    u.uJaw.value = 0.06 + 0.05 * Math.sin(t * 1.3) + this.rage * 0.55;
    u.uHeat.value = this.rage;
    u.uFlow.value = this.flow;
    // fire breath on provoke, and embers that stream off the burning mane
    this.breath = Math.max(0, this.breath - dt);
    if (this.breath > 0) {
      for (let i = 0; i < 8; i++) {
        this.snout(p, 2.5);
        this.spine.tangent(0, T);
        v.copy(T).multiplyScalar(-10 - Math.random() * 6);
        v.x += (Math.random() - 0.5) * 3.5;
        v.y += (Math.random() - 0.5) * 3.5;
        v.z += (Math.random() - 0.5) * 3.5;
        this.fire.spawn(p, v, fireCol, 0.7 + Math.random() * 0.5, 1 + Math.random(), Kind.Fire);
      }
    }
    if (Math.random() < dt * (30 + this.flow * 40)) {
      this.spine.sample(0.3 + Math.random() * 3.2, p);
      p.y += 0.5;
      v.set((Math.random() - 0.5) * 0.8, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8);
      this.fire.spawn(p, v, emberCol, 1.4 + Math.random(), 0.25 + Math.random() * 0.3, Kind.Spark);
    }
    this.fire.update(dt, t, ctx.pixelRatio);
    const legs = u.uLegs.value;
    legs.set(Math.sin(t * 2.1) * 0.35 + 0.25, Math.sin(t * 2.1 + 1.6) * 0.35 + 0.25, Math.sin(t * 2.1 + 3.1) * 0.35 + 0.35, Math.sin(t * 2.1 + 4.7) * 0.35 + 0.35);
  }
}
