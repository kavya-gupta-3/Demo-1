import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import postSource from './shaders/post/post.glsl';

function pass(define: string, uniforms: Record<string, { value: unknown }>) {
  return new ShaderMaterial({
    defines: { [define]: '' },
    uniforms,
    vertexShader: `#define VERTEX\n${postSource}`,
    fragmentShader: postSource,
    depthTest: false,
    depthWrite: false,
  });
}

function target(w: number, h: number, samples = 0) {
  return new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: samples >= 0,
    samples: Math.max(0, samples),
  });
}

/**
 * HDR scene target → 13-tap dual-filter bloom (Jimenez, CoD: AW) →
 * one composite pass: chromatic aberration, glitch, exposure, grading,
 * ACES, vignette, scanlines, grain and dithering.
 */
export class PostFX {
  readonly scene: WebGLRenderTarget;
  private down: WebGLRenderTarget[] = [];
  private up: WebGLRenderTarget[] = [];
  private readonly quad: Mesh;
  private readonly cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly prefilter: ShaderMaterial;
  private readonly downMat: ShaderMaterial;
  private readonly upMat: ShaderMaterial;
  readonly composite: ShaderMaterial;
  private levels: number;
  enabledBloom = true;

  readonly params = {
    bloom: 1.0,
    exposure: 1.0,
    chroma: 0.2,
    glitch: 0,
    flash: 0,
    vignette: 0.85,
    grain: 0.045,
    saturation: 1.05,
    scan: 0.35,
    threshold: 1.15,
    radius: 1.0,
    tint: new Vector3(1, 1, 1),
    lift: new Vector3(0, 0, 0),
  };

  constructor(private readonly renderer: WebGLRenderer, msaa: number, levels: number) {
    this.levels = levels;
    this.scene = target(2, 2, msaa);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new Mesh(geo);
    this.quad.frustumCulled = false;
    this.prefilter = pass('PREFILTER', {
      tInput: { value: null },
      uTexel: { value: new Vector2() },
      uThreshold: { value: 0.9 },
      uKnee: { value: 0.6 },
    });
    this.downMat = pass('DOWN', { tInput: { value: null }, uTexel: { value: new Vector2() } });
    this.upMat = pass('UP', {
      tInput: { value: null },
      tBase: { value: null },
      uTexel: { value: new Vector2() },
      uRadius: { value: 1 },
    });
    this.composite = pass('COMPOSITE', {
      tScene: { value: this.scene.texture },
      tBloom: { value: null },
      uBloom: { value: 1 },
      uExposure: { value: 1 },
      uChroma: { value: 0 },
      uGlitch: { value: 0 },
      uFlash: { value: 0 },
      uVignette: { value: 0.85 },
      uGrain: { value: 0.04 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uTint: { value: new Vector3(1, 1, 1) },
      uLift: { value: new Vector3() },
      uSaturation: { value: 1 },
      uScan: { value: 0.3 },
    });
  }

  setSize(width: number, height: number) {
    this.scene.setSize(width, height);
    for (const t of [...this.down, ...this.up]) t.dispose();
    this.down = [];
    this.up = [];
    let w = Math.max(1, Math.floor(width / 2));
    let h = Math.max(1, Math.floor(height / 2));
    for (let i = 0; i < this.levels; i++) {
      this.down.push(target(w, h, -1));
      if (i < this.levels - 1) this.up.push(target(w, h, -1));
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
    this.composite.uniforms.uAspect.value = width / Math.max(1, height);
  }

  private blit(material: ShaderMaterial, out: WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(out);
    this.renderer.render(this.quad, this.cam);
  }

  render(scene: Scene, camera: Camera, time: number) {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);

    const p = this.params;
    let bloomTex: Texture | null = null;
    if (this.enabledBloom && p.bloom > 0.001) {
      const pf = this.prefilter.uniforms;
      pf.tInput.value = this.scene.texture;
      pf.uTexel.value.set(1 / this.scene.width, 1 / this.scene.height);
      pf.uThreshold.value = p.threshold;
      this.blit(this.prefilter, this.down[0]);
      for (let i = 1; i < this.down.length; i++) {
        const src = this.down[i - 1];
        this.downMat.uniforms.tInput.value = src.texture;
        this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.blit(this.downMat, this.down[i]);
      }
      let prev: WebGLRenderTarget = this.down[this.down.length - 1];
      for (let i = this.down.length - 2; i >= 0; i--) {
        const u = this.upMat.uniforms;
        u.tInput.value = prev.texture;
        u.tBase.value = this.down[i].texture;
        u.uTexel.value.set(1 / prev.width, 1 / prev.height);
        u.uRadius.value = p.radius;
        this.blit(this.upMat, this.up[i]);
        prev = this.up[i];
      }
      bloomTex = prev.texture;
    }

    const c = this.composite.uniforms;
    c.tBloom.value = bloomTex ?? this.scene.texture;
    c.uBloom.value = bloomTex ? p.bloom / this.levels : 0;
    c.uExposure.value = p.exposure;
    c.uChroma.value = p.chroma;
    c.uGlitch.value = p.glitch;
    c.uFlash.value = p.flash;
    c.uVignette.value = p.vignette;
    c.uGrain.value = p.grain;
    c.uTime.value = time;
    c.uSaturation.value = p.saturation;
    c.uScan.value = p.scan;
    c.uTint.value.copy(p.tint);
    c.uLift.value.copy(p.lift);
    this.blit(this.composite, null);
  }
}
