// Wing membranes. GOLD: translucent amber with veins and gold bones.
// FIRE: a living sheet of flame with a burning, tattered trailing edge.
#include "../lib/common.glsl"
#include "../lib/lighting.glsl"

uniform float uTime;
uniform float uReveal;
uniform float uRage;
uniform float uSide;
uniform vec3 uTintA;
uniform vec3 uTintB;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vKind;
varying float vSpan;
varying vec3 vLocal;

void main() {
  bool front = gl_FrontFacing;
  if (uSide < 0.0) front = !front;
  vec3 N = normalize(vNormal);
  if (!front) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  float n0 = vnoise(vLocal * 1.7);
  float reveal = uReveal * 1.5 - vSpan * 0.5 - n0 * 0.35;
  if (reveal < 0.0) discard;
  float burn = smoothstep(0.12, 0.0, reveal);
  vec3 L = normalize(uKeyDir);
  float back = pow(max(dot(-N, L), 0.0), 1.2) + pow(max(dot(-V, L), 0.0), 3.0) * 0.6;

  if (vKind > 1.5) {
    // bones
#ifdef FIRE
    vec3 col = shadePBR(vec3(0.08, 0.01, 0.01), 0.2, 0.35, N, V, 1.0) + uTintA * 0.25;
#else
    vec3 col = shadePBR(uTintB, 1.0, 0.28, N, V, 1.0);
#endif
    col += uTintA * burn * 5.0;
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  float edge = vUv.y;
#ifdef FIRE
  float f = fbm(vec3(vUv.x * 7.0, vUv.y * 2.4 - uTime * 1.3, uTime * 0.35));
  float tatter = 0.84 + f * 0.13 + vnoise(vec2(vUv.x * 60.0, uTime)) * 0.04;
  if (edge > tatter) discard;
  float heat = sat(edge * 0.9 + f * 0.6 + 0.15);
  vec3 c0 = vec3(0.05, 0.0, 0.0);
  vec3 c1 = uTintA * 0.9;
  vec3 c2 = uTintB * 1.6;
  vec3 c3 = vec3(1.0, 0.85, 0.45) * 3.0;
  vec3 col = mix(c0, c1, smoothstep(0.1, 0.45, heat));
  col = mix(col, c2, smoothstep(0.45, 0.75, heat));
  col = mix(col, c3, smoothstep(0.82, 1.0, heat));
  col += c2 * smoothstep(tatter - 0.06, tatter, edge) * 2.0;
  col *= 1.0 + uRage * 0.8;
  col += shadePBR(vec3(0.15, 0.01, 0.01), 0.0, 0.45, N, V, 1.0) * 0.4;
#else
  // veins: along fingers (uv.x lines) and fine branching
  float fingerVein = smoothstep(0.012, 0.0, abs(fract(vUv.x * 5.0) - 0.5) - 0.48);
  vec3 vo = voronoi(vec2(vUv.x * 40.0, vUv.y * 9.0));
  float fine = smoothstep(0.06, 0.0, vo.y - vo.x);
  vec3 skin = mix(uTintA * 0.25, uTintA, 0.3 + 0.4 * (1.0 - edge));
  vec3 col = shadePBR(skin, 0.3, 0.42, N, V, 1.0);
  vec3 glow = uTintB * (0.6 + 0.6 * back) * (0.6 + 0.4 * (1.0 - fine * 0.7));
  col += glow * back * 1.8;
  col = mix(col, col * 0.45, fine * 0.6 + fingerVein * 0.4);
  col += uTintB * smoothstep(0.86, 1.0, edge) * 0.6;
#endif
  col += uTintB * burn * 5.0;
  gl_FragColor = vec4(col, 1.0);
}
