// IGNIS — obsidian plates split by rivers of lava. A heartbeat of heat
// travels from head to tail; the mane and whiskers burn.
#include "../lib/common.glsl"
#include "../lib/lighting.glsl"

uniform float uTime;
uniform float uReveal;
uniform float uHeat;
uniform float uLen;
uniform vec3 uLavaA;
uniform vec3 uLavaB;

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

  // dissolve-in from the head, edges burning
  float n0 = vnoise(vRest * 2.7 + 3.0);
  float front = uReveal * 1.7 - vS * 0.7 - n0 * 0.45;
  if (front < 0.0) discard;
  float burn = smoothstep(0.14, 0.0, front);

  float pulse = 0.55 + 0.45 * sin(vS * 34.0 - uTime * 2.8);
  float heat = 1.0 + uHeat * 1.8;
  vec3 albedo = vec3(0.016, 0.013, 0.018);
  float rough = 0.3;
  vec3 emissive = vec3(0.0);
  float height = 0.0;

  if (part == 0) {
    vec2 g = vec2(vUv.x * uLen * 3.6, vUv.y * 22.0);
    vec3 vo = voronoiWrap(g, 22.0);
    float edge = vo.y - vo.x;
    height = 1.0 - smoothstep(0.0, 0.7, vo.x);
    float belly = 1.0 - smoothstep(0.07, 0.15, abs(vUv.y - 0.5));
    float plate = fract(vUv.x * uLen * 2.4);
    float plateEdge = smoothstep(0.14, 0.0, min(plate, 1.0 - plate));
    float flow = 0.55 + 0.45 * vnoise(vec3(g * 0.32, uTime * 0.7));
    float crack = smoothstep(0.055 + 0.05 * uHeat, 0.008, edge);
    // only some fissures run hot: large-scale veins that drift along the body
    float veins = smoothstep(0.42, 0.78, vnoise(vec3(g.x * 0.09 - uTime * 0.25, g.y * 0.22, 1.7)) + uHeat * 0.4);
    float dorsal = smoothstep(0.02, 0.12, min(vUv.y, 1.0 - vUv.y));
    float glow = crack * flow * (0.35 + 0.65 * pulse) * mix(0.25, 1.0, dorsal) * mix(0.12, 1.0, veins);
    glow = mix(glow, plateEdge * (0.35 + 0.65 * pulse) * flow * 0.8, belly);
    vec3 lava = mix(uLavaA, uLavaB, smoothstep(0.03, 0.0, edge) * flow);
    emissive = lava * glow * 2.4 * heat;
    albedo = mix(vec3(0.02, 0.016, 0.02), vec3(0.055, 0.032, 0.026), vo.z * 0.7);
    albedo = mix(albedo, vec3(0.09, 0.045, 0.022), belly);
    height = mix(height, 1.0 - plateEdge, belly);
    rough = mix(0.2, 0.42, vo.z);
  } else if (part == 1 || part == 2) {
    vec2 g = vRest.xy * 6.5 + vec2(vRest.z * 4.0, vRest.z * 2.0);
    vec3 vo = voronoi(g);
    float edge = vo.y - vo.x;
    height = 1.0 - smoothstep(0.0, 0.8, vo.x);
    float crack = smoothstep(0.05, 0.01, edge) * (0.6 + 0.4 * pulse) * smoothstep(0.3, 0.7, vnoise(vRest * 3.0));
    emissive = mix(uLavaA, uLavaB, 0.4) * crack * 1.4 * heat;
    albedo = mix(vec3(0.02, 0.017, 0.022), vec3(0.06, 0.035, 0.028), vo.z * 0.6);
    rough = 0.26;
    // mouth glows from within when it opens
    if (part == 2) emissive += uLavaB * smoothstep(-0.2, -0.35, vRest.y) * uHeat * 2.0;
  } else if (part == 3) {
    float tip = smoothstep(0.45, 1.0, vUv.x);
    albedo = vec3(0.025, 0.02, 0.024);
    rough = 0.18;
    height = 0.5 + 0.25 * sin(vUv.x * 60.0);
    emissive = mix(uLavaA, uLavaB, tip) * tip * tip * 3.5 * (0.6 + 0.4 * pulse) * heat;
  } else if (part == 4) {
    float tip = smoothstep(0.35, 1.0, vUv.x);
    albedo = vec3(0.02, 0.016, 0.02);
    rough = 0.22;
    emissive = mix(uLavaA, uLavaB, tip) * tip * 2.6 * (0.5 + 0.5 * pulse) * heat;
  } else if (part == 5) {
    vec3 vo = voronoi(vUv * vec2(9.0, 7.0));
    height = 1.0 - vo.x;
    albedo = vec3(0.02, 0.017, 0.02);
    emissive = uLavaA * smoothstep(0.08, 0.02, vo.y - vo.x) * 0.8 * heat;
  } else if (part == 11) {
    albedo = vec3(0.12, 0.1, 0.09);
    rough = 0.35;
  } else if (part == 6) {
    float t = vUv.x;
    emissive = mix(uLavaB, uLavaA, t) * (1.1 + 0.8 * sin(t * 18.0 - uTime * 5.0)) * (1.0 - t * 0.7) * heat;
    albedo = vec3(0.02);
  } else if (part == 7 || part == 8) {
    albedo = vec3(0.75, 0.68, 0.58);
    rough = 0.4;
    emissive = uLavaB * 0.15;
  } else if (part == 10) {
    float t = vUv.x;
    float flick = 0.7 + 0.3 * sin(uTime * 9.0 + vPivot.w * 40.0 + t * 6.0);
    emissive = mix(uLavaA * 0.6, uLavaB * 1.6, t) * (1.5 + 3.0 * t) * flick * heat;
    albedo = vec3(0.03, 0.01, 0.0);
  }

  N = bumpNormal(vWorld, N, height * 0.06, 1.0);
  vec3 col = shadePBR(albedo, 0.0, rough, N, V, 1.0);
  col += emissive;
  col += uLavaB * burn * 7.0;
  gl_FragColor = vec4(col, 1.0);
}
