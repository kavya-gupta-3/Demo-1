import { AdditiveBlending, Color, LineSegments, Points, Vector3 } from 'three';
import { damp, lerp } from '../../../core/math';
import astraSource from '../../shaders/dragon/astra.glsl';
import { Emitter, Kind } from '../../fx/Emitter';
import type { FrameContext } from '../../types';
import { ASTRA, type BlueprintResult } from '../blueprints';
import { Dragon } from '../Dragon';
import { toGeometry } from '../geometry';

const p = new Vector3();
const v = new Vector3();
const dust = new Color(0.8, 0.6, 1.0);

function program(kind: 'BODY' | 'WING' | 'LINES') {
  return {
    vertexShader: `#define VERTEX\n#define ${kind}\n${astraSource}`,
    fragmentShader: `#define ${kind}\n${astraSource}`,
  };
}

/**
 * 06 · ASTRA — The Star-Born. Fifteen thousand stars hold the shape of a
 * dragon; constellation lines run down its back and its wings are made of
 * light. It spirals upward as the reader climbs through the dreams.
 */
export class Astra extends Dragon {
  readonly dust = new Emitter(700, { gravity: -0.15, drag: 0.4, turbulence: 0.8 });
  private beat = 0;

  constructor() {
    super('astra', 5, ASTRA.length, 112, {
      keyDir: new Vector3(0, 1, 0),
      key: new Color(1, 1, 1),
      sky: new Color(0, 0, 0),
      ground: new Color(0, 0, 0),
      rim: new Color(0, 0, 0),
      envTop: new Color(0, 0, 0),
      envHorizon: new Color(0, 0, 0),
      envBottom: new Color(0, 0, 0),
    });
    this.uniforms.uPixelRatio = { value: 1 };
    this.uniforms.uSize = { value: 1 };
    this.uniforms.uStarA = { value: new Color(0.62, 0.38, 1.0) };
    this.uniforms.uStarB = { value: new Color(1.0, 0.45, 0.85) };
    this.uniforms.uStarC = { value: new Color(0.85, 0.95, 1.0) };
    this.group.add(this.dust.points);
  }

  build(result: BlueprintResult) {
    const additive = { blending: AdditiveBlending, depthWrite: false, transparent: true };
    const body = this.material(program('BODY').vertexShader, program('BODY').fragmentShader, {}, additive);
    this.add(new Points(toGeometry(result.pack.body), body));
    const wingGeo = toGeometry(result.pack.wing);
    for (const side of [1, -1]) {
      const wm = this.material(
        program('WING').vertexShader,
        program('WING').fragmentShader,
        {
          uSide: { value: side },
          uWingS: { value: ASTRA.shoulder },
          uWingRoot: { value: new Vector3(0, 0.35, 0.35) },
          uSweep: { value: 0.45 },
          uSpan: { value: 7 },
          uDihedral: { value: 0.25 },
        },
        additive,
      );
      this.add(new Points(wingGeo, wm));
    }
    const lines = this.material(program('LINES').vertexShader, program('LINES').fragmentShader, {}, additive);
    this.add(new LineSegments(toGeometry(result.pack.lines), lines));
    this.ready = true;
  }

  override provoke(ctx: FrameContext) {
    super.provoke(ctx);
    for (let i = 0; i < 220; i++) {
      this.spine.sample(Math.random() * ASTRA.length, p);
      v.set((Math.random() - 0.5) * 6, (Math.random() - 0.3) * 6, (Math.random() - 0.5) * 6);
      this.dust.spawn(p, v, dust, 2 + Math.random() * 2, 0.2 + Math.random() * 0.3, Math.random() < 0.3 ? Kind.Glint : Kind.Dust);
    }
  }

  protected animate(ctx: FrameContext) {
    const { time: t, dt, center, local } = ctx;
    const portrait = ctx.aspect < 1;
    this.uHead += dt * (2.2 + this.rage * 4);
    const R = portrait ? 3.6 : 5.6;
    const cx = center.x + (portrait ? 0 : 1.5);
    const cz = center.z - 2.5;
    const yHead = center.y + lerp(-5, 12, local) + 1.5;
    const uh = this.uHead;
    this.follow(
      (u, out) => {
        const ang = u / R;
        out.set(cx + Math.cos(ang) * R, yHead + (u - uh) * 0.22 + Math.sin(ang * 3) * 0.3, cz + Math.sin(ang) * R);
      },
      uh,
      ASTRA.length / (112 * 3),
      center,
    );
    this.lookTarget.copy(ctx.camera.position).lerp(ctx.pointerWorld, 0.5);
    this.track(this.lookTarget, dt, 0.7, 0.5, 2.5);
    this.beat += dt * 1.6;
    const u = this.uniforms;
    u.uFlap.value = 0.25 + Math.sin(this.beat) * 0.5;
    u.uFold.value = -0.25 * Math.max(0, Math.cos(this.beat));
    u.uJaw.value = 0.08 + this.rage * 0.5;
    u.uPixelRatio.value = ctx.pixelRatio;
    u.uSize.value = portrait ? 0.8 : 1;
    u.uLegs.value.set(0.4, 0.4, 0.5, 0.5);
    u.uFlow.value = damp(u.uFlow.value, 0, 2, dt);
    // stardust shed from the tail
    if (Math.random() < dt * 40) {
      this.spine.sample(ASTRA.length * (0.6 + Math.random() * 0.4), p);
      v.set((Math.random() - 0.5) * 0.5, -0.3 - Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
      this.dust.spawn(p, v, dust, 2.5, 0.18 + Math.random() * 0.2, Kind.Dust);
    }
    this.dust.update(dt, t, ctx.pixelRatio);
  }
}
