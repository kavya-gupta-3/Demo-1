// KAVYA GUPTA as molten metal in 3D space. The text mask comes from a
// canvas texture; the shader fills it with flowing heat and burns it away
// (uBurn) as the reader scrolls on. Bloom supplies the glow.
#include "./lib/common.glsl"

varying vec2 vUv;

#ifdef VERTEX
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
#else
uniform sampler2D tText;
uniform vec2 uTexel;
uniform float uTime;
uniform float uBurn;
uniform float uReveal;
uniform float uCut;
uniform vec3 uHot;
uniform vec3 uDeep;

void main() {
  vec4 tex = texture2D(tText, vUv);
  float mask = tex.r;
  float n = fbmLite(vec3(vUv * vec2(9.0, 3.0), uTime * 0.25));
  // burn front sweeps diagonally, ragged by noise
  float front = vUv.x * 0.35 + (1.0 - vUv.y) * 0.2 + n * 0.22;
  float burn = uBurn * 1.3 - 0.05;
  float alive = smoothstep(burn - 0.015, burn + 0.015, front);
  float edge = (1.0 - smoothstep(0.0, 0.07, abs(front - burn))) * step(0.001, uBurn);
  // load-in: letters condense left to right
  float rev = smoothstep(uReveal * 1.4 - 0.4, uReveal * 1.4 - 0.32, vUv.x + n * 0.12);
  float a = mask * alive * (1.0 - rev);
  float cov = smoothstep(0.32, 0.68, a);
  if (cov < uCut) discard;

  // bevel from the blurred height field
  vec2 px = uTexel * 2.0;
  float hl = texture2D(tText, vUv - vec2(px.x, 0.0)).g;
  float hr = texture2D(tText, vUv + vec2(px.x, 0.0)).g;
  float hd = texture2D(tText, vUv - vec2(0.0, px.y)).g;
  float hu = texture2D(tText, vUv + vec2(0.0, px.y)).g;
  vec3 N = normalize(vec3((hl - hr) * 3.2, (hd - hu) * 3.2, 1.0));
  float height = tex.g;

  // molten core in the thick of each stroke, hard metal at the bevel
  float core = smoothstep(0.55, 1.0, height);
  float flow = vnoise(vUv * vec2(26.0, 8.0) + vec2(uTime * 0.25, -uTime * 0.6));
  vec3 base = mix(uDeep * 0.35, mix(uDeep, uHot, smoothstep(0.1, 1.0, vUv.y + n * 0.25)), 0.7);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rimLight = pow(1.0 - N.z, 1.5);
  float sweep = fract(uTime * 0.12) * 1.8 - 0.4;
  float shine = pow(sat(1.0 - abs(vUv.x + (vUv.y - 0.5) * 0.35 - sweep) * 5.0), 6.0);
  vec3 col = base * (0.25 + 0.95 * diff);
  col += vec3(1.0, 0.78, 0.45) * spec * 1.1;
  col += uHot * rimLight * 0.9;
  col += mix(uDeep * 1.5, uHot, flow) * core * (0.45 + 0.55 * flow) * 0.55;
  col += vec3(1.0, 0.85, 0.6) * shine * (0.3 + spec) * 1.1;
  col += uHot * edge * 7.0 + vec3(1.0, 0.6, 0.2) * smoothstep(0.75, 0.0, abs(front - burn) * 8.0) * step(0.001, uBurn) * 2.0;
  gl_FragColor = vec4(col, cov);
}
#endif
