import { Color, Vector3 } from 'three';
import { damp, lerp } from '../../../core/math';
import dragonVert from '../../shaders/dragon/dragon.vert.glsl';
import eyeFrag from '../../shaders/dragon/eye.frag.glsl';
import eyeVert from '../../shaders/dragon/eye.vert.glsl';
import jadeFrag from '../../shaders/dragon/jade.frag.glsl';
import { Emitter, Kind } from '../../fx/Emitter';
import type { FrameContext } from '../../types';
import { JADE, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';

const p = new Vector3();
const v = new Vector3();
const shard = new Color(0.4, 1.0, 0.65);

/**
 * 04 · JADE — The Crystal Forgewyrm. A heavy faceted drake that prowls a
 * slow orbit behind the project cards; provoked, it sheds a storm of
 * glittering shards.
 */
export class Jade extends Dragon {
  readonly shards = new Emitter(600, { gravity: 3.5, drag: 0.6, turbulence: 1.5 });

  constructor() {
    super('jade', 3, JADE.length, 112, {
      keyDir: new Vector3(0.5, 0.8, 0.35),
      key: new Color(0.85, 1.0, 0.9).multiplyScalar(1.4),
      sky: new Color(0.02, 0.12, 0.08),
      ground: new Color(0.0, 0.04, 0.03),
      rim: new Color(0.2, 1.0, 0.6).multiplyScalar(0.3),
      envTop: new Color(0.3, 0.6, 0.45),
      envHorizon: new Color(0.03, 0.15, 0.1),
      envBottom: new Color(0.0, 0.02, 0.015),
    });
    this.group.add(this.shards.points);
  }

  build(result: BlueprintResult) {
    const m = this.material(dragonVert, jadeFrag, {
      uGem: { value: new Color(0.03, 0.75, 0.38) },
      uGemHi: { value: new Color(0.6, 1.0, 0.75) },
    });
    this.mesh(toGeometry(result.pack.main), m);
    const eyes = this.material(eyeVert, eyeFrag, {
      uEyeColor: { value: new Color(0.75, 1.0, 0.4) },
      uEyeColor2: { value: new Color(0.1, 0.8, 0.4) },
    });
    this.mesh(toGeometry(result.pack.eyes), eyes);
    this.ready = true;
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    for (let i = 0; i < 160; i++) {
      this.spine.sample(Math.random() * JADE.length, p);
      v.set((Math.random() - 0.5) * 9, Math.random() * 9 + 2, (Math.random() - 0.5) * 9);
      this.shards.spawn(p, v, shard, 1.6 + Math.random(), 0.25 + Math.random() * 0.35, Math.random() < 0.7 ? Kind.Shard : Kind.Glint);
    }
  }

  protected animate(ctx: FrameContext) {
    const { dt, center, local } = ctx;
    this.uHead += dt * (1.7 + this.rage * 3);
    const portrait = ctx.aspect < 1;
    const cx = center.x;
    const cy = center.y + lerp(1.0, -1.0, local);
    const cz = center.z - 6;
    const rx = portrait ? 5.5 : 11;
    this.follow(
      (u, out) => {
        const ang = u / 8.5;
        out.set(cx + Math.cos(ang) * rx, cy + Math.sin(ang * 2.0) * 1.6 + Math.sin(ang * 0.5) * 1.2, cz + Math.sin(ang) * 5.5);
      },
      this.uHead,
      JADE.length / (112 * 3),
      center,
    );
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.5);
    this.track(this.lookTarget, dt, 0.65, 0.4, 2.5);
    const u = this.uniforms;
    u.uJaw.value = 0.04 + this.rage * 0.5;
    const t = ctx.time;
    u.uLegs.value.set(Math.sin(t * 1.6) * 0.4 + 0.2, Math.sin(t * 1.6 + Math.PI) * 0.4 + 0.2, Math.sin(t * 1.6 + Math.PI) * 0.4 + 0.25, Math.sin(t * 1.6) * 0.4 + 0.25);
    u.uFlow.value = damp(u.uFlow.value, 0, 2, dt);
    // a slow trickle of glints off the crystals
    if (Math.random() < dt * 14) {
      this.spine.sample(Math.random() * JADE.length * 0.9, p);
      p.y += 0.8;
      v.set((Math.random() - 0.5) * 0.6, 0.6 + Math.random(), (Math.random() - 0.5) * 0.6);
      this.shards.spawn(p, v, shard, 2.2, 0.35, Kind.Glint);
    }
    this.shards.update(dt, t, ctx.pixelRatio);
  }
}
