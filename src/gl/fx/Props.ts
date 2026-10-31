import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  ShaderMaterial,
  Sphere,
  Vector3,
  type BufferGeometry,
  type IUniform,
} from 'three';
import { mulberry32 } from '../../core/math';
import { stageCenter } from '../Director';
import type { EngineFrame } from '../Engine';
import propsSource from '../shaders/fx/props.glsl';

function program(kind: 'GRID' | 'CRYSTAL' | 'COIN', uniforms: Record<string, IUniform>, extra: Partial<ShaderMaterial> = {}) {
  return new ShaderMaterial({
    vertexShader: `#define VERTEX\n#define ${kind}\n${propsSource}`,
    fragmentShader: `#define ${kind}\n${propsSource}`,
    uniforms: { uTime: { value: 0 }, uWeight: { value: 0 }, uBurst: { value: 0 }, uCenter: { value: new Vector3() }, ...uniforms },
    ...extra,
  });
}

function instanced(base: BufferGeometry, count: number, seed: number) {
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes = base.attributes;
  const rnd = mulberry32(seed);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new Sphere(new Vector3(), 1e5);
  return geo;
}

function rupeeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '900 76px "JetBrains Mono", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', 64, 68);
  const t = new CanvasTexture(c);
  return t;
}

/**
 * Set dressing per world: a synthwave grid under the arcade (PIXEL), drifting
 * crystals around JADE, and a rain of rupee coins over AURUM's hoard.
 */
export class Props {
  readonly grid: Mesh;
  readonly crystals: Mesh;
  readonly coins: Mesh;
  private readonly gridMat: ShaderMaterial;
  private readonly crystalMat: ShaderMaterial;
  private readonly coinMat: ShaderMaterial;
  private coinBurst = 0;
  private crystalBurst = 0;
  readonly gridColors = { a: new Color('#ff2bd6'), b: new Color('#2bf0ff') };

  constructor(detail: number) {
    this.gridMat = program('GRID', { uColA: { value: this.gridColors.a }, uColB: { value: this.gridColors.b } }, { blending: AdditiveBlending, depthWrite: false, transparent: true });
    const plane = new PlaneGeometry(220, 220, 1, 1);
    plane.rotateX(-Math.PI / 2);
    this.grid = new Mesh(plane, this.gridMat);
    this.grid.frustumCulled = false;

    this.crystalMat = program('CRYSTAL', {});
    this.crystals = new Mesh(instanced(new OctahedronGeometry(1, 0), Math.round(46 * detail), 3), this.crystalMat);
    this.crystals.frustumCulled = false;

    this.coinMat = program('COIN', { tRupee: { value: rupeeTexture() } });
    this.coins = new Mesh(instanced(new CylinderGeometry(1, 1, 0.14, 28, 1), Math.round(96 * detail), 7), this.coinMat);
    this.coins.frustumCulled = false;
  }

  /** Extra coins on demand (Aurum provoked / achievements). */
  shower() {
    this.coinBurst = 1;
  }

  scatter() {
    this.crystalBurst = 1;
  }

  update(f: EngineFrame) {
    const w = f.weights;
    this.coinBurst = Math.max(0, this.coinBurst - f.dt * 0.4);
    this.crystalBurst = Math.max(0, this.crystalBurst - f.dt * 0.6);
    const set = (m: ShaderMaterial, weight: number, stage: number, burst = 0) => {
      m.uniforms.uTime.value = f.time;
      m.uniforms.uWeight.value = weight;
      m.uniforms.uBurst.value = burst;
      stageCenter(stage, m.uniforms.uCenter.value);
    };
    set(this.gridMat, w[1], 1);
    this.grid.visible = w[1] > 0.01;
    this.grid.position.set(0, stageCenter(1).y - 7.5, -20);
    this.grid.updateMatrixWorld();
    set(this.crystalMat, w[3], 3, this.crystalBurst);
    this.crystals.visible = w[3] > 0.01;
    set(this.coinMat, w[4], 4, this.coinBurst);
    this.coins.visible = w[4] > 0.01;
  }
}
