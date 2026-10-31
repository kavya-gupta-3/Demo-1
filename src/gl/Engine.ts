import {
  NoToneMapping,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Quality } from '../core/quality';
import { clamp, damp } from '../core/math';
import { Director, STAGE_COUNT, stageCenter } from './Director';
import { PostFX } from './PostFX';
import { Sky } from './Sky';
import type { Dragon } from './dragon/Dragon';
import { GeometryFactory } from './dragon/geometry';
import type { FrameContext } from './types';

export interface FrameInput {
  time: number;
  dt: number;
  /** Unclamped frame time, for the fps readout and the resolution governor. */
  rawDt: number;
  /** Page scroll position in CSS pixels. */
  scrollY: number;
  stage: number;
  locals: number[];
  chapter: number;
  velocity: number;
  pointer: Vector2;
}

/** `?cam=x,y,z,tx,ty,tz` pins the camera (inspection/screenshots). */
const DEBUG_CAM = (() => {
  const v = new URLSearchParams(location.search).get('cam');
  const n = v?.split(',').map(Number);
  return n && n.length === 6 && n.every(Number.isFinite) ? n : null;
})();

/** Per-stage colour grade applied in the composite pass. */
const GRADES: [number, number, number][] = [
  [1.06, 0.97, 0.92],
  [1.02, 0.95, 1.08],
  [0.94, 1.0, 1.08],
  [0.94, 1.06, 1.0],
  [1.08, 1.02, 0.9],
  [1.0, 0.95, 1.1],
  [1.1, 0.94, 0.95],
];

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 600);
  readonly post: PostFX;
  readonly sky = new Sky();
  readonly director = new Director();
  readonly dragons: Dragon[] = [];
  readonly factory = new GeometryFactory();
  /** Extra per-frame hooks (particles, stage props). */
  readonly systems: { update(ctx: EngineFrame): void }[] = [];
  fps = 60;
  renderScale = 1;
  flash = 0;
  private frameTimes: number[] = [];
  private width = 1;
  private height = 1;
  private readonly raycaster = new Raycaster();
  private readonly plane = new Plane(new Vector3(0, 0, 1), 0);
  private readonly pointerWorld = new Vector3();
  private readonly center = new Vector3();
  private readonly ctx: FrameContext;
  private lastScaleChange = 0;
  private readonly frameState = {} as EngineFrame;
  private rageUntil = 0;
  private now = 0;

  constructor(readonly canvas: HTMLCanvasElement, readonly quality: Quality) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x050407, 1);
    this.post = new PostFX(this.renderer, quality.msaa, quality.bloomLevels);
    this.scene.add(this.sky.mesh);
    this.ctx = {
      time: 0,
      dt: 0,
      local: 0,
      weight: 0,
      center: this.center,
      camera: this.camera,
      pointer: new Vector2(),
      pointerWorld: this.pointerWorld,
      velocity: 0,
      chapter: 0,
      quality,
      aspect: 1,
      pixelRatio: 1,
      heroLift: 0,
    };
    this.resize();
  }

  addDragon(d: Dragon) {
    this.dragons[d.stage] = d;
    this.scene.add(d.group);
  }

  resize() {
    const w = window.innerWidth;
    // match the CSS size of the canvas (100lvh on phones)
    const h = Math.max(window.innerHeight, this.canvas.clientHeight || 0);
    this.width = w;
    this.height = h;
    const dpr = Math.min(this.quality.maxDpr, window.devicePixelRatio || 1) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(Math.round(w * dpr), Math.round(h * dpr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Adaptive resolution: trims render scale when frames run long. */
  private govern(dt: number, time: number) {
    // a tab switch or a GC pause is not a slow GPU
    if (dt > 0.25) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 45) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = damp(this.fps, 1 / Math.max(avg, 1e-3), 4, dt);
    if (this.frameTimes.length < 45 || time - this.lastScaleChange < 2.5) return;
    let next = this.renderScale;
    if (avg > 1 / 44) next = Math.max(0.55, this.renderScale - 0.12);
    else if (avg < 1 / 58 && this.renderScale < 1) next = Math.min(1, this.renderScale + 0.08);
    if (next !== this.renderScale) {
      this.renderScale = next;
      this.lastScaleChange = time;
      this.frameTimes.length = 0;
      this.resize();
    }
  }

  /** Dragon Rage: every dragon furious, the image tearing for a few seconds. */
  rage(seconds: number) {
    this.rageUntil = this.now + seconds;
  }

  frame(input: FrameInput) {
    const { time, dt } = input;
    this.now = time;
    this.govern(input.rawDt, time);
    const reduced = this.quality.reducedMotion;
    const aspect = this.width / this.height;
    const d = this.director;
    d.update(input.stage, input.locals, input.chapter, input.pointer, aspect, dt, reduced);

    const cam = this.camera;
    cam.position.copy(d.camPos);
    cam.lookAt(d.camTarget);
    if (DEBUG_CAM) {
      cam.position.set(DEBUG_CAM[0], DEBUG_CAM[1], DEBUG_CAM[2]);
      cam.lookAt(DEBUG_CAM[3], DEBUG_CAM[4], DEBUG_CAM[5]);
    }
    if (Math.abs(cam.fov - d.fov) > 0.01) {
      cam.fov = d.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    // pointer → world, on the plane through the nearest stage
    const near = clamp(Math.round(input.stage), 0, STAGE_COUNT - 1);
    stageCenter(near, this.center);
    this.plane.constant = -this.center.z;
    this.raycaster.setFromCamera(input.pointer, cam);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld)) this.pointerWorld.copy(this.center);

    this.flash = Math.max(0, this.flash - dt * 3);
    this.sky.update(cam, d.weights, time, this.flash);

    const ctx = this.ctx;
    ctx.time = time;
    ctx.dt = dt;
    ctx.pointer.copy(input.pointer);
    ctx.velocity = input.velocity;
    ctx.chapter = input.chapter;
    ctx.aspect = aspect;
    ctx.pixelRatio = this.renderer.getPixelRatio();
    // hero framing distance → world units per CSS pixel at the title's depth
    const heroDist = aspect < 1 ? 17 * 1.55 : aspect < 1.35 ? 17 * 1.2 : 17;
    const worldPerPx = (2 * heroDist * Math.tan((40 * Math.PI) / 360)) / this.height;
    ctx.heroLift = Math.min(input.scrollY, this.height * 1.5) * worldPerPx;
    for (let i = 0; i < STAGE_COUNT; i++) {
      const dragon = this.dragons[i];
      if (!dragon) continue;
      ctx.local = input.locals[i] ?? 0;
      ctx.weight = d.weights[i];
      stageCenter(i, this.center);
      dragon.update(ctx);
    }
    stageCenter(near, this.center);
    const frame = Object.assign(this.frameState, ctx, {
      stage: input.stage,
      weights: d.weights,
      transit: d.transit,
      locals: input.locals,
      engine: this,
    });
    for (const s of this.systems) s.update(frame);

    // grade + transition energy
    const p = this.post.params;
    const tr = reduced ? 0 : d.transit;
    const raging = time < this.rageUntil ? Math.min(1, (this.rageUntil - time) * 0.8) : 0;
    p.chroma = 0.15 + tr * 1.6 + raging * 1.8;
    p.glitch = (tr > 0.35 ? (tr - 0.35) * 1.1 : 0) + (reduced ? 0 : raging * (0.35 + 0.3 * Math.sin(time * 23)));
    p.flash = this.flash * 0.6;
    p.tint.set(0, 0, 0);
    for (let i = 0; i < STAGE_COUNT; i++) {
      const w = d.weights[i];
      if (w <= 0) continue;
      p.tint.x += GRADES[i][0] * w;
      p.tint.y += GRADES[i][1] * w;
      p.tint.z += GRADES[i][2] * w;
    }
    if (raging > 0) p.tint.set(p.tint.x * (1 + raging * 0.4), p.tint.y * (1 - raging * 0.25), p.tint.z * (1 - raging * 0.3));
    this.post.render(this.scene, cam, time);
  }

  /** Click on empty space: provoke the dragon of the current stage. */
  provoke() {
    const i = clamp(Math.round(this.director.stage), 0, STAGE_COUNT - 1);
    const dragon = this.dragons[i];
    if (!dragon || !dragon.ready) return null;
    dragon.provoke(this.ctx);
    return dragon;
  }

  async compile() {
    for (const d of this.dragons) if (d) d.group.visible = true;
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      this.renderer.compile(this.scene, this.camera);
    }
    for (const d of this.dragons) if (d) d.group.visible = false;
  }
}

export interface EngineFrame extends FrameContext {
  stage: number;
  weights: number[];
  locals: number[];
  transit: number;
  engine: Engine;
}
