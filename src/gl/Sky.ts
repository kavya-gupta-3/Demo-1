import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import skySource from './shaders/sky/sky.glsl';

export class Sky {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.material = new ShaderMaterial({
      vertexShader: `#define VERTEX\n${skySource}`,
      fragmentShader: skySource,
      uniforms: {
        uInvProj: { value: new Matrix4() },
        uCamWorld: { value: new Matrix4() },
        uW: { value: [1, 0, 0, 0, 0, 0, 0] },
        uLocal: { value: [0, 0, 0, 0, 0, 0, 0] },
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uMoonDir: { value: new Vector3(-0.35, 0.42, -1).normalize() },
        uHobbyA: { value: new Color('#ff2bd6') },
        uHobbyB: { value: new Color('#2bf0ff') },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  update(camera: PerspectiveCamera, weights: number[], time: number, flash: number) {
    const u = this.material.uniforms;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    for (let i = 0; i < 7; i++) u.uW.value[i] = weights[i];
    u.uTime.value = time;
    u.uFlash.value = flash;
  }
}
