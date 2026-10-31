import { CanvasTexture, Color, LinearFilter, Mesh, PlaneGeometry, ShaderMaterial, Vector2, type PerspectiveCamera } from 'three';
import { clamp, smoothstep } from '../core/math';
import titleSource from './shaders/title.glsl';
import type { EngineFrame } from './Engine';

/**
 * The name, rendered into the hero stage as a real 3D object so IGNIS can
 * coil in front of and behind the letters. The DOM <h1> stays in the page
 * for screen readers and search engines.
 */
export class TitlePlane {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private layout: 'wide' | 'stack' | null = null;
  private aspectText = 4;
  reveal = 0;

  constructor(msaa: boolean) {
    this.texture = new CanvasTexture(this.canvas);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new ShaderMaterial({
      vertexShader: `#define VERTEX\n${titleSource}`,
      fragmentShader: titleSource,
      uniforms: {
        tText: { value: this.texture },
        uTime: { value: 0 },
        uBurn: { value: 0 },
        uReveal: { value: 0 },
        uCut: { value: msaa ? 0.02 : 0.5 },
        uTexel: { value: new Vector2() },
        uHot: { value: new Color(1.0, 0.62, 0.2) },
        uDeep: { value: new Color(0.55, 0.06, 0.01) },
      },
      alphaToCoverage: msaa,
      transparent: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /**
   * Draw the text mask: red = crisp glyphs, green = blurred glyphs (a height
   * field the shader turns into a bevel). Called when the layout flips.
   */
  draw(stack: boolean) {
    const layout = stack ? 'stack' : 'wide';
    if (layout === this.layout) return;
    this.layout = layout;
    const lines = stack ? ['KAVYA', 'GUPTA'] : ['KAVYA GUPTA'];
    const size = 260;
    const spacing = size * 0.06;
    const probe = this.canvas.getContext('2d')!;
    probe.font = `900 ${size}px Cinzel, serif`;
    const widths = lines.map((l) => [...l].reduce((w, ch) => w + probe.measureText(ch).width, 0) + spacing * (l.length - 1));
    const w = Math.ceil(Math.max(...widths) + size * 0.5);
    const lineH = size * 1.02;
    const h = Math.ceil(lineH * lines.length + size * 0.4);
    const paint = (ctx: CanvasRenderingContext2D, blur: number) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `900 ${size}px Cinzel, serif`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      // shadow-only trick: glyphs drawn off-canvas, blurred shadow lands on it
      const off = blur > 0 ? w * 2 : 0;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = off;
      lines.forEach((line, i) => {
        let x = (w - widths[i]) / 2 - off;
        const y = h / 2 + (i - (lines.length - 1) / 2) * lineH + size * 0.04;
        for (const ch of line) {
          ctx.fillText(ch, x, y);
          x += ctx.measureText(ch).width + spacing;
        }
      });
    };
    const sharp = document.createElement('canvas');
    const soft = document.createElement('canvas');
    for (const c of [sharp, soft, this.canvas]) {
      c.width = w;
      c.height = h;
    }
    const sc = sharp.getContext('2d')!;
    const bc = soft.getContext('2d', { willReadFrequently: true })!;
    paint(sc, 0);
    paint(bc, size * 0.055);
    const a = sc.getImageData(0, 0, w, h).data;
    const b = bc.getImageData(0, 0, w, h).data;
    const out = probe.createImageData(w, h);
    for (let i = 0; i < a.length; i += 4) {
      out.data[i] = a[i];
      out.data[i + 1] = Math.min(255, b[i] * 1.25);
      out.data[i + 2] = 0;
      out.data[i + 3] = 255;
    }
    probe.putImageData(out, 0, 0);
    this.aspectText = w / h;
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.texture.needsUpdate = true;
  }

  /** Scale so the name spans a fixed share of the visible width at its depth. */
  fit(camera: PerspectiveCamera, distance: number) {
    const visH = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    const stack = camera.aspect < 0.95;
    this.draw(stack);
    let w = visW * (stack ? 0.86 : 0.74);
    let h = w / this.aspectText;
    if (h > visH * 0.42) {
      h = visH * 0.42;
      w = h * this.aspectText;
    }
    this.mesh.scale.set(w, h, 1);
    // tell the DOM how tall the letters are on screen (glyph band ≈ 72% of the plane)
    const px = (h / visH) * window.innerHeight * (stack ? 1.0 : 0.72);
    document.documentElement.style.setProperty('--title-h', `${Math.round(px)}px`);
  }

  update(f: EngineFrame) {
    const u = this.material.uniforms;
    u.uTime.value = f.time;
    u.uReveal.value = clamp(this.reveal);
    u.uBurn.value = smoothstep(0.02, 0.36, f.locals[0] ?? 0);
    this.mesh.visible = f.weights[0] > 0.01 && u.uBurn.value < 0.999;
    this.mesh.position.set(0, 0.3 + f.heroLift, 0);
    if (f.aspect !== this.lastAspect) {
      this.lastAspect = f.aspect;
      this.fit(f.camera, f.aspect < 1 ? 17 * 1.55 : f.aspect < 1.35 ? 17 * 1.2 : 17);
      this.measured = 0;
    }
    // where the title's centre lands on screen at the hero framing → DOM offset
    if (this.measured < 30 && (f.locals[0] ?? 0) < 0.01 && f.transit < 0.01) {
      this.measured++;
      const v = this.mesh.position.clone().project(f.camera);
      const dy = (-v.y * window.innerHeight) / 2;
      document.documentElement.style.setProperty('--title-dy', `${Math.round(dy)}px`);
    }
  }

  private lastAspect = 0;
  private measured = 0;
}
