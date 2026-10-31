// CRIMSON — glossy blood-red scales, a black dorsal stripe and a belly of
// ember plates that breathe with the dragon's fire.
#include "../lib/common.glsl"
#include "../lib/lighting.glsl"

uniform float uTime;
uniform float uReveal;
uniform float uRage;
uniform float uLen;
uniform vec3 uRed;
uniform vec3 uEmber;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vPart;
varying vec3 vRest;
varying float vS;
varying vec4 vPivot;
varying float vExtra;

void main() {
  int part = int(vPart + 0.5);
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  float n0 = vnoise(vRest * 2.6 + 9.0);
  float front = uReveal * 1.7 - vS * 0.7 - n0 * 0.45;
  if (front < 0.0) discard;
  float burn = smoothstep(0.12, 0.0, front);
  float breath = 0.6 + 0.4 * sin(uTime * 2.0 - vS * 12.0);

  vec3 albedo = uRed;
  float rough = 0.28;
  float h = 0.0;
  vec3 emissive = vec3(0.0);

  if (part == 0) {
    vec2 g = vec2(vUv.x * uLen * 4.4, vUv.y * 22.0);
    vec3 vo = voronoiWrap(g, 22.0);
    h = 1.0 - smoothstep(0.0, 0.7, vo.x);
    float topBand = 1.0 - smoothstep(0.06, 0.2, min(vUv.y, 1.0 - vUv.y));
    float belly = 1.0 - smoothstep(0.07, 0.16, abs(vUv.y - 0.5));
    albedo = mix(uRed, uRed * vec3(0.55, 0.25, 0.3), vo.z * 0.6);
    albedo = mix(albedo, vec3(0.03, 0.005, 0.008), topBand);
    float plate = fract(vUv.x * uLen * 2.8);
    float seam = smoothstep(0.16, 0.0, min(plate, 1.0 - plate));
    emissive = uEmber * belly * (0.35 + seam * 1.5) * breath * (1.0 + uRage * 2.5);
    albedo = mix(albedo, vec3(0.25, 0.05, 0.02), belly);
    h = mix(h, 1.0 - seam, belly);
    rough = mix(0.22, 0.4, vo.z);
  } else if (part == 1 || part == 2) {
    vec3 vo = voronoi(vRest.xy * 7.5 + vRest.z * 4.0);
    h = 1.0 - smoothstep(0.0, 0.8, vo.x);
    albedo = mix(uRed, uRed * 0.5, vo.z);
    if (part == 2) emissive = uEmber * smoothstep(-0.18, -0.32, vRest.y) * uRage * 2.0;
  } else if (part == 3) {
    albedo = vec3(0.02, 0.012, 0.014);
    rough = 0.16;
    emissive = uEmber * smoothstep(0.7, 1.0, vUv.x) * 1.5;
  } else if (part == 4) {
    albedo = vec3(0.02, 0.01, 0.012);
    rough = 0.18;
    emissive = uEmber * smoothstep(0.5, 1.0, vUv.x) * 1.6 * breath;
  } else if (part == 5) {
    albedo = uRed * 0.6;
  } else if (part == 11) {
    albedo = vec3(0.04);
    rough = 0.25;
  } else if (part == 7 || part == 8) {
    albedo = vec3(0.9, 0.85, 0.78);
    emissive = uEmber * 0.15;
  }

  N = bumpNormal(vWorld, N, h * 0.05, 1.0);
  vec3 col = shadePBR(albedo, 0.0, rough, N, V, 1.0);
  col += emissive;
  col += uEmber * burn * 6.0;
  gl_FragColor = vec4(col, 1.0);
}
