import { AdditiveBlending, Color, Mesh, ShaderMaterial, TorusGeometry } from 'three';
import { STAGES } from '../../data/content';
import { GAP } from '../Director';
import type { EngineFrame } from '../Engine';

const vertexShader = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uGlow;
uniform float uTime;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  float around = vUv.x;
  float pulse = 0.55 + 0.45 * sin(around * 37.699 - uTime * 6.0);
  vec3 col = mix(uColA, uColB, 0.5 + 0.5 * sin(around * 6.2832 + uTime));
  gl_FragColor = vec4(col * (1.5 + 2.5 * pulse) * uGlow, 1.0);
}`;

/**
 * Hexagonal gates — the crest of the sigil — hung between every pair of
 * worlds. The camera flies up through each one while it travels from one
 * dragon to the next.
 */
export class Gates {
  readonly meshes: Mesh[] = [];
  private readonly mats: ShaderMaterial[] = [];

  constructor() {
    const outer = new TorusGeometry(15, 0.11, 6, 6);
    outer.rotateX(Math.PI / 2);
    const inner = new TorusGeometry(13.6, 0.04, 4, 6);
    inner.rotateX(Math.PI / 2);
    for (let i = 0; i < STAGES.length - 1; i++) {
      const m = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColA: { value: new Color(STAGES[i].color) },
          uColB: { value: new Color(STAGES[i + 1].color) },
          uGlow: { value: 0 },
          uTime: { value: 0 },
        },
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      this.mats.push(m);
      for (const g of [outer, inner]) {
        const mesh = new Mesh(g, m);
        mesh.frustumCulled = false;
        mesh.visible = false;
        this.meshes.push(mesh);
      }
    }
  }

  update(f: EngineFrame) {
    const cam = f.camera.position;
    for (let i = 0; i < this.mats.length; i++) {
      const y = (i + 0.5) * GAP;
      // brightest as the camera crosses the gate's plane
      const near = Math.max(0, 1 - Math.abs(cam.y - y) / 22);
      const glow = near * near;
      const m = this.mats[i];
      m.uniforms.uGlow.value = glow;
      m.uniforms.uTime.value = f.time;
      for (const mesh of [this.meshes[i * 2], this.meshes[i * 2 + 1]]) {
        mesh.visible = glow > 0.01;
        mesh.position.set(cam.x, y, cam.z - 4);
        mesh.rotation.y = f.time * 0.15 + i;
        mesh.updateMatrixWorld();
      }
    }
  }
}
