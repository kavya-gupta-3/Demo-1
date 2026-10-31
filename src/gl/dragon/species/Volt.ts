import { Color, Vector3 } from 'three';
import { damp, lerp } from '../../../core/math';
import dragonVert from '../../shaders/dragon/dragon.vert.glsl';
import eyeFrag from '../../shaders/dragon/eye.frag.glsl';
import eyeVert from '../../shaders/dragon/eye.vert.glsl';
import voltFrag from '../../shaders/dragon/volt.frag.glsl';
import { Lightning } from '../../fx/Lightning';
import type { FrameContext } from '../../types';
import { VOLT, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';

const a = new Vector3();
const b = new Vector3();

/**
 * 03 · VOLT — The Circuit Serpent. Forty-six armour plates float around a
 * naked energy core; arcs jump between them and the storm answers with
 * strikes when provoked. Moves in snappy, robotic bursts.
 */
export class Volt extends Dragon {
  readonly lightning = new Lightning(20, 24, new Color(0.45, 0.9, 1.0));
  private arcTimer = 0;
  private strikeTimer = 2;
  private burstPhase = 0;
  onStrike: (() => void) | null = null;

  constructor() {
    super('volt', 2, VOLT.length, 128, {
      keyDir: new Vector3(-0.3, 0.8, 0.5),
      key: new Color(0.75, 0.9, 1.0).multiplyScalar(1.6),
      sky: new Color(0.03, 0.06, 0.1),
      ground: new Color(0.0, 0.03, 0.05),
      rim: new Color(0.2, 0.8, 1.0).multiplyScalar(0.5),
      envTop: new Color(0.12, 0.2, 0.3),
      envHorizon: new Color(0.03, 0.08, 0.12),
      envBottom: new Color(0.0, 0.01, 0.02),
    });
    this.group.add(this.lightning.mesh);
  }

  build(result: BlueprintResult) {
    const m = this.material(dragonVert, voltFrag, {
      uVolt: { value: new Color(0.2, 0.85, 1.0) },
      uVolt2: { value: new Color(0.55, 0.42, 1.0) },
    });
    this.mesh(toGeometry(result.pack.main), m);
    const eyes = this.material(eyeVert, eyeFrag, {
      uEyeColor: { value: new Color(0.5, 0.95, 1.0) },
      uEyeColor2: { value: new Color(0.2, 0.4, 1.0) },
    });
    this.mesh(toGeometry(result.pack.eyes), eyes);
    this.ready = true;
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    // the storm answers: strikes from the sky onto the body
    for (let i = 0; i < 3; i++) {
      this.spine.sample(Math.random() * VOLT.length * 0.8, b);
      a.set(b.x + (Math.random() - 0.5) * 8, b.y + 18 + Math.random() * 6, b.z - 4);
      this.lightning.strike(a, b, { life: 0.45, width: 5, rough: 0.3 });
    }
    this.onStrike?.();
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, center, local } = ctx;
    // robotic gait: surge, hold, surge
    this.burstPhase += dt * 0.55;
    const surge = 0.35 + 1.65 * Math.pow(Math.max(0, Math.sin(this.burstPhase * Math.PI * 2)), 2);
    this.uHead += dt * (3.2 * surge + this.rage * 6);
    const portrait = ctx.aspect < 1;
    const rx = portrait ? 5.2 : 10.5;
    const ry = portrait ? 5.5 : 3.6;
    const cx = center.x;
    const cy = center.y + lerp(0.8, -0.6, local);
    const cz = center.z - 3.5;
    this.follow(
      (u, out) => {
        const ang = u / 7.2;
        // lemniscate (figure-8) with squared-off turns
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        out.set(cx + Math.sign(c) * Math.pow(Math.abs(c), 0.75) * rx, cy + s * c * ry * 1.3, cz + s * 3.2);
      },
      this.uHead,
      VOLT.length / (128 * 3),
      center,
    );
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.7);
    this.track(this.lookTarget, dt, 0.7, 0.45, 9);
    const u = this.uniforms;
    u.uJaw.value = 0.05 + this.rage * 0.45 + (Math.sin(t * 13) > 0.97 ? 0.15 : 0);
    u.uLegs.value.set(0.6, 0.6, 0.7, 0.7);
    u.uFlow.value = damp(u.uFlow.value, surge, 4, dt);

    // arcs between neighbouring plates
    this.arcTimer -= dt;
    while (this.arcTimer <= 0) {
      this.arcTimer += 0.04 + Math.random() * 0.08;
      const s0 = Math.random() * VOLT.length * 0.85;
      const r = VOLT.profile(s0 / VOLT.length) * 1.6;
      this.spine.sample(s0, a);
      this.spine.sample(s0 + 0.9 + Math.random() * 2.2, b);
      a.x += (Math.random() - 0.5) * r;
      a.y += (Math.random() - 0.2) * r;
      b.y += (Math.random() - 0.2) * r;
      b.z += (Math.random() - 0.5) * r;
      this.lightning.strike(a, b, { life: 0.16 + Math.random() * 0.14, width: 2.6 + this.rage * 3, rough: 0.4 });
    }
    // distant storm strikes
    this.strikeTimer -= dt;
    if (this.strikeTimer <= 0) {
      this.strikeTimer = 2.5 + Math.random() * 4;
      a.set(center.x + (Math.random() - 0.5) * 50, center.y + 25, center.z - 30 - Math.random() * 20);
      b.set(a.x + (Math.random() - 0.5) * 10, center.y - 20, a.z);
      this.lightning.strike(a, b, { life: 0.3, width: 3, rough: 0.25 });
      this.onStrike?.();
    }
    this.lightning.update(dt, window.innerWidth, window.innerHeight);
  }
}
