// PIXEL — every cube is an instance. Its centre is bent along the spine
// (or carried by the head), the cube is oriented by the local frame, and
// the whole swarm can burst apart and snap back together.
#include "../lib/dragon_core.glsl"

attribute vec4 aVoxel;
attribute vec4 aVoxData;

uniform float uBurst;
uniform float uReveal;
uniform float uBeat;
uniform vec3 uHinge;
uniform float uDrift;

varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vUv;
varying vec4 vData;

void main() {
  int part = int(aVoxData.x + 0.5);
  vec3 center = aVoxel.xyz;
  if (part == P_JAW) center = rotZ(center - uHinge, uJaw) + uHinge;
  SpineFrame f;
  vec3 c;
  mat3 basis;
  if (isHeadPart(part)) {
    f = spineAt(0.0);
    c = spineRigid(f, uHeadRot * center);
    basis = mat3(f.T, f.N, f.B) * uHeadRot;
  } else {
    c = spineBend(center, f);
    basis = mat3(f.T, f.N, f.B);
  }
  vec3 rd = normalize(hash33(aVoxData.yzw * vec3(91.7, 13.3, 57.1) + 3.1) - 0.5);
  float burst = uBurst * (0.45 + aVoxData.y);
  c += rd * burst * 5.0 + vec3(0.0, burst * burst * 1.2, 0.0);
  // imagination: cubes float loose and drift like thoughts
  c += rd * uDrift * (0.6 + 0.6 * sin(uTime * 1.3 + aVoxData.y * 20.0));
  float beat = uBeat * (0.5 + 0.5 * sin(aVoxData.z * 0.9 - uTime * 9.0));
  float rv = smoothstep(0.0, 0.1, uReveal * 1.25 - aVoxData.w * 0.9 - aVoxData.y * 0.15);
  float size = aVoxel.w * f.scale * (1.0 + beat * 0.45) * (1.0 - uBurst * 0.35) * rv;
  vec3 wp = c + basis * (position * size);
  vNormal = basis * normal;
  vWorld = wp;
  vUv = uv;
  vData = aVoxData;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
