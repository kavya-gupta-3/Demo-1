import {
  Color,
  Group,
  Matrix3,
  Mesh,
  ShaderMaterial,
  Vector3,
  Vector4,
  type BufferGeometry,
  type IUniform,
  type Material,
  type Object3D,
} from 'three';
import { clamp, damp } from '../../core/math';
import type { FrameContext } from '../types';
import type { BlueprintResult } from './blueprints';
import type { Species } from './registry';
import { Spine, type Track } from './Spine';

export interface Lighting {
  keyDir: Vector3;
  key: Color;
  sky: Color;
  ground: Color;
  rim: Color;
  envTop: Color;
  envHorizon: Color;
  envBottom: Color;
}

const tmpA = new Vector3();
const tmpT = new Vector3();
const tmpN = new Vector3();
const tmpB = new Vector3();
const tmpD = new Vector3();

/** `?inspect` lays every dragon along a fixed S-curve for close-up checks. */
const INSPECT = new URLSearchParams(location.search).has('inspect');

/**
 * Base for all seven dragons: owns the spine, the uniforms every material
 * of this dragon shares, head tracking and the provoke/rage envelope.
 */
export abstract class Dragon {
  readonly group = new Group();
  readonly spine: Spine;
  readonly uniforms: Record<string, IUniform>;
  ready = false;
  weight = 0;
  /** 0‥1, spikes on click and decays. */
  rage = 0;
  protected uHead = 0;
  protected yaw = 0;
  protected pitch = 0;
  private readonly headRot = new Matrix3();
  protected readonly lookTarget = new Vector3();

  constructor(
    readonly species: Species,
    readonly stage: number,
    length: number,
    samples: number,
    lighting: Lighting,
  ) {
    this.spine = new Spine(samples, length);
    this.uniforms = {
      uSpine: { value: this.spine.texture },
      uSpineCount: { value: samples },
      uSpineLen: { value: length },
      uHeadRot: { value: this.headRot },
      uJaw: { value: 0.05 },
      uLegs: { value: new Vector4() },
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uReveal: { value: 0 },
      uRage: { value: 0 },
      uHeat: { value: 0 },
      uFlap: { value: 0 },
      uFold: { value: 0 },
      uKeyDir: { value: lighting.keyDir.clone().normalize() },
      uKeyColor: { value: lighting.key },
      uSkyColor: { value: lighting.sky },
      uGroundColor: { value: lighting.ground },
      uRimColor: { value: lighting.rim },
      uEnvTop: { value: lighting.envTop },
      uEnvHorizon: { value: lighting.envHorizon },
      uEnvBottom: { value: lighting.envBottom },
    };
    this.group.visible = false;
    this.group.name = species;
  }

  abstract build(result: BlueprintResult): void;
  protected abstract animate(ctx: FrameContext): void;

  /** Click reaction. Subclasses add their own flourish. */
  provoke(_ctx: FrameContext) {
    this.rage = 1;
  }

  update(ctx: FrameContext) {
    this.weight = ctx.weight;
    const visible = this.ready && ctx.weight > 0.002;
    this.group.visible = visible;
    if (!visible) return;
    this.rage = Math.max(0, this.rage - ctx.dt * 0.45);
    const u = this.uniforms;
    u.uTime.value = ctx.time;
    u.uReveal.value = clamp(ctx.weight * 1.25);
    u.uRage.value = this.rage;
    this.animate(ctx);
    u.uHeadRot.value = this.headRot;
  }

  /** Lay the spine along a track (or the inspection curve). */
  protected follow(track: Track, uHead: number, du: number, center?: Vector3) {
    if (INSPECT && center) {
      const c = center.clone();
      this.spine.follow((u, out) => out.set(c.x + 4 + u, c.y + Math.sin(u * 0.35) * 0.8, c.z + Math.sin(u * 0.22) * 2.5), 0, du);
      return;
    }
    this.spine.follow(track, uHead, du);
  }

  protected material(vertexShader: string, fragmentShader: string, extra: Record<string, IUniform> = {}, opts: Partial<ShaderMaterial> = {}) {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...this.uniforms, ...extra },
      ...opts,
    });
  }

  protected add<T extends Object3D>(obj: T): T {
    obj.frustumCulled = false;
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
    this.group.add(obj);
    return obj;
  }

  protected mesh(geometry: BufferGeometry, material: Material) {
    return this.add(new Mesh(geometry, material));
  }

  /**
   * Turn the head toward `target` within limits. Builds the head rotation
   * in neck-frame coordinates (x = tailward, y = dorsal, z = side).
   */
  protected track(target: Vector3, dt: number, maxYaw = 0.65, maxPitch = 0.45, speed = 4) {
    const sp = this.spine;
    sp.sample(0, tmpA);
    sp.tangent(0, tmpT);
    sp.normal(0, tmpN);
    tmpB.crossVectors(tmpT, tmpN);
    const d = tmpD.copy(target).sub(tmpA).normalize();
    const dx = d.dot(tmpT);
    const dy = d.dot(tmpN);
    const dz = d.dot(tmpB);
    const yaw = clamp(Math.atan2(dz, -dx), -maxYaw, maxYaw);
    const pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -maxPitch, maxPitch);
    this.yaw = damp(this.yaw, yaw, speed, dt);
    this.pitch = damp(this.pitch, pitch, speed, dt);
    // R = Ry(yaw) · Rz(−pitch); column-major for Matrix3.set (row-major args)
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(-this.pitch), spn = Math.sin(-this.pitch);
    // Rz(b) = [[c,-s,0],[s,c,0],[0,0,1]]; Ry(a) = [[c,0,s],[0,1,0],[-s,0,c]]
    this.headRot.set(
      cy * cp, -cy * spn, sy,
      spn, cp, 0,
      -sy * cp, sy * spn, cy,
    );
  }

  /** World-space point near the snout (for fire breath etc.). */
  snout(out: Vector3, ahead = 2.4) {
    this.spine.sample(0, out);
    this.spine.tangent(0, tmpT);
    return out.addScaledVector(tmpT, -ahead);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as Material | undefined)?.dispose?.();
    });
  }
}
