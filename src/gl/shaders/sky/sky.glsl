// The world's sky: seven skies blended by how close the camera is to each
// dragon's stage. Drawn first as a fullscreen triangle at the far plane.
#include "../lib/common.glsl"

varying vec3 vDir;

#ifdef VERTEX
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
void main() {
  vec4 view = uInvProj * vec4(position.xy, 1.0, 1.0);
  view /= view.w;
  vDir = (uCamWorld * vec4(view.xyz, 0.0)).xyz;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
#else

uniform float uW[7];
uniform float uTime;
uniform float uFlash;
uniform float uLocal[7];
uniform vec3 uMoonDir;
uniform vec3 uHobbyA;
uniform vec3 uHobbyB;

float starField(vec3 d, float density, float threshold, float size) {
  vec3 p = d * density;
  vec3 c = floor(p);
  vec3 f = fract(p) - 0.5;
  vec3 h = hash33(c);
  float b = step(threshold, h.x) * (h.x - threshold) / (1.0 - threshold);
  vec3 o = (h - 0.5) * 0.7;
  float dist = length(f - o);
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + h.y * 3.0) + h.z * TAU);
  return smoothstep(size, 0.0, dist) * b * tw;
}

vec3 skyIgnis(vec3 d) {
  float below = smoothstep(0.15, -0.85, d.y);
  vec3 c = mix(vec3(0.008, 0.005, 0.007), vec3(0.075, 0.016, 0.005), below);
  float smoke = fbmLite(d * 3.2 + vec3(0.0, -uTime * 0.05, uTime * 0.02));
  float smoke2 = fbmLite(d * 7.0 + vec3(uTime * 0.03, -uTime * 0.08, 0.0));
  c += vec3(0.4, 0.09, 0.015) * smoothstep(0.05, 0.7, smoke + smoke2 * 0.3) * below * 0.35;
  c += vec3(0.05, 0.014, 0.008) * smoothstep(-0.1, 0.6, smoke) * (1.0 - below) * 0.35;
  // distant ember sparks
  c += vec3(1.0, 0.45, 0.1) * starField(d + vec3(0.0, uTime * 0.01, 0.0), 90.0, 0.985, 0.18) * 1.5;
  return c;
}

vec3 skyPixel(vec3 d) {
  float h = d.y;
  vec3 c = mix(vec3(0.018, 0.003, 0.03), vec3(0.005, 0.002, 0.012), smoothstep(-0.1, 0.7, h));
  float horizon = exp(-abs(h + 0.05) * 9.0);
  c += mix(uHobbyA, uHobbyB, 0.5 + 0.5 * sin(atan(d.x, d.z) * 2.0 + uTime * 0.3)) * horizon * 0.16;
  // pixel stars on a square lattice
  vec2 q = vec2(atan(d.x, d.z) * 40.0, h * 40.0);
  vec2 cell = floor(q);
  float r = hash12(cell);
  vec2 f = abs(fract(q) - 0.5);
  float px = step(max(f.x, f.y), 0.12) * step(0.965, r) * (0.5 + 0.5 * sin(uTime * 3.0 + r * 40.0));
  c += mix(uHobbyA, uHobbyB, hash12(cell + 3.1)) * px * 1.2 * smoothstep(-0.05, 0.2, h);
  // scan bands
  c *= 0.92 + 0.08 * sin(h * 220.0 - uTime * 2.0);
  return c;
}

vec3 skyVolt(vec3 d) {
  float cl = fbmLite(d * 2.6 + vec3(uTime * 0.04, 0.0, uTime * 0.02));
  float cl2 = fbmLite(d * 6.0 - vec3(0.0, uTime * 0.03, 0.0));
  vec3 c = mix(vec3(0.006, 0.012, 0.025), vec3(0.03, 0.06, 0.1), smoothstep(-0.3, 0.6, cl));
  c += vec3(0.1, 0.5, 0.8) * pow(sat(cl2 + 0.2), 3.0) * 0.12;
  c += vec3(0.6, 0.85, 1.0) * uFlash * smoothstep(-0.2, 0.7, cl + cl2 * 0.5) * 1.6;
  c += vec3(0.5, 0.9, 1.0) * starField(d, 70.0, 0.992, 0.12) * 0.6;
  return c;
}

vec3 skyJade(vec3 d) {
  vec3 c = mix(vec3(0.0, 0.02, 0.018), vec3(0.0, 0.006, 0.01), smoothstep(-0.2, 0.8, d.y));
  float a = atan(d.x, d.z);
  float curtain = fbmLite(vec3(a * 3.0, d.y * 2.0, uTime * 0.08));
  float band = smoothstep(0.05, 0.35, d.y) * smoothstep(0.95, 0.4, d.y);
  float rays = pow(sat(0.5 + 0.5 * sin(a * 26.0 + curtain * 6.0 + uTime * 0.2)), 3.0);
  c += mix(vec3(0.05, 0.9, 0.5), vec3(0.6, 1.0, 0.3), sat(d.y * 1.5)) * band * rays * smoothstep(-0.2, 0.5, curtain) * 0.35;
  c += vec3(0.7, 1.0, 0.85) * starField(d, 80.0, 0.99, 0.13) * 0.7;
  return c;
}

vec3 skyAurum(vec3 d) {
  vec3 sun = normalize(vec3(0.15, 0.85, -0.5));
  float s = max(dot(d, sun), 0.0);
  vec3 c = mix(vec3(0.03, 0.014, 0.003), vec3(0.008, 0.004, 0.002), smoothstep(-0.3, 0.9, d.y));
  c += vec3(1.0, 0.65, 0.2) * pow(s, 10.0) * 0.28 + vec3(1.0, 0.85, 0.5) * pow(s, 96.0) * 1.4;
  // god rays radiating from the sun
  vec3 t = normalize(cross(sun, vec3(0.0, 0.0, 1.0)));
  vec3 bt = cross(sun, t);
  float ang = atan(dot(d, bt), dot(d, t));
  float rays = pow(sat(vnoise(vec2(ang * 9.0, uTime * 0.1)) * 1.2 - 0.2), 2.0);
  c += vec3(1.0, 0.7, 0.25) * rays * pow(s, 3.0) * 0.16;
  c += vec3(1.0, 0.8, 0.4) * starField(d + vec3(0.0, -uTime * 0.004, 0.0), 120.0, 0.985, 0.12) * 0.8;
  return c;
}

vec3 skyAstra(vec3 d) {
  vec3 c = vec3(0.004, 0.002, 0.012);
  float n = fbm(d * 1.6 + vec3(0.0, uTime * 0.01, 0.0));
  float n2 = fbmLite(d * 4.0 + n);
  c += mix(vec3(0.25, 0.05, 0.45), vec3(0.85, 0.2, 0.55), sat(n2 + 0.5)) * pow(sat(n + 0.35), 2.6) * 0.2;
  c += vec3(0.1, 0.25, 0.6) * pow(sat(-n + 0.1), 3.0) * 0.1;
  // galactic band
  float band = exp(-pow(dot(d, normalize(vec3(0.3, 1.0, 0.2))) * 3.2, 2.0));
  c += vec3(0.6, 0.45, 0.9) * band * (0.08 + 0.14 * sat(n2 + 0.4));
  c += vec3(1.0) * starField(d, 140.0, 0.97, 0.16) * 1.4;
  c += vec3(0.8, 0.85, 1.0) * starField(d.zxy, 60.0, 0.993, 0.1) * 2.5;
  return c;
}

vec3 skyCrimson(vec3 d) {
  vec3 c = mix(vec3(0.03, 0.002, 0.006), vec3(0.004, 0.0, 0.002), smoothstep(-0.2, 0.8, d.y));
  vec3 m = normalize(uMoonDir);
  float md = dot(d, m);
  float disc = smoothstep(0.9975, 0.9985, md);
  vec3 tn = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
  vec3 bn = cross(m, tn);
  vec2 mp = vec2(dot(d, tn), dot(d, bn)) * 40.0;
  float crater = vnoise(mp * 1.5) * 0.6 + vnoise(mp * 4.0) * 0.4;
  c += mix(vec3(0.9, 0.12, 0.05), vec3(1.0, 0.4, 0.2), crater) * disc * 2.2;
  c += vec3(1.0, 0.1, 0.05) * pow(max(md, 0.0), 160.0) * 0.9 + vec3(0.6, 0.03, 0.03) * pow(max(md, 0.0), 18.0) * 0.16;
  float haze = fbmLite(d * 3.0 + vec3(uTime * 0.03, 0.0, 0.0));
  c += vec3(0.2, 0.01, 0.02) * smoothstep(0.0, 0.7, haze) * 0.22;
  c += vec3(1.0, 0.5, 0.4) * starField(d, 90.0, 0.99, 0.12) * 0.5;
  return c;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 c = vec3(0.0);
  if (uW[0] > 0.001) c += skyIgnis(d) * uW[0];
  if (uW[1] > 0.001) c += skyPixel(d) * uW[1];
  if (uW[2] > 0.001) c += skyVolt(d) * uW[2];
  if (uW[3] > 0.001) c += skyJade(d) * uW[3];
  if (uW[4] > 0.001) c += skyAurum(d) * uW[4];
  if (uW[5] > 0.001) c += skyAstra(d) * uW[5];
  if (uW[6] > 0.001) c += skyCrimson(d) * uW[6];
  gl_FragColor = vec4(c, 1.0);
}
#endif
