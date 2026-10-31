import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Sphere, Vector3 } from 'three';
import { mulberry32 } from '../../core/math';
import { GAP } from '../Director';
import type { EngineFrame } from '../Engine';
import ambientSource from '../shaders/fx/ambient.glsl';

/** The stage-aware GPU particle atmosphere (one draw call for all seven worlds). */
export class Ambient {
  readonly points: Points;
  private readonly material: ShaderMaterial;
  private speed = 1;

  constructor(count: number) {
    const rnd = mulberry32(99);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
    geo.boundingSphere = new Sphere(new Vector3(), 1e5);
    this.material = new ShaderMaterial({
      vertexShader: `#define VERTEX\n${ambientSource}`,
      fragmentShader: ambientSource,
      uniforms: {
        uTime: { value: 0 },
        uGap: { value: GAP },
        uW: { value: [1, 0, 0, 0, 0, 0, 0] },
        uPixelRatio: { value: 1 },
        uSize: { value: 1 },
        uCam: { value: new Vector3() },
        uPhase: { value: 0 },
      },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  update(f: EngineFrame) {
    const u = this.material.uniforms;
    u.uTime.value = f.time;
    for (let i = 0; i < 7; i++) u.uW.value[i] = f.weights[i];
    u.uPixelRatio.value = f.pixelRatio;
    u.uSize.value = f.aspect < 1 ? 0.8 : 1;
    // embers rush upward while the reader scrolls fast
    this.speed += (1 + Math.min(4, Math.abs(f.velocity) * 0.08) - this.speed) * Math.min(1, f.dt * 3);
    u.uPhase.value += f.dt * this.speed;
  }
}
