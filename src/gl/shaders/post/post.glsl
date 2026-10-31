// Post-processing passes, selected with #defines. One file, five programs:
// PREFILTER → DOWN × n → UP × n → COMPOSITE (plus the shared fullscreen VERTEX).
#include "../lib/common.glsl"

varying vec2 vUv;

#ifdef VERTEX
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
#else

#if defined(PREFILTER) || defined(DOWN) || defined(UP)
uniform sampler2D tInput;
uniform vec2 uTexel;
#endif

#if defined(PREFILTER) || defined(DOWN)
vec3 tap(vec2 uv) { return texture2D(tInput, uv).rgb; }

vec3 downsample13(vec2 uv) {
  vec2 t = uTexel;
  vec3 a = tap(uv + t * vec2(-2.0, 2.0));
  vec3 b = tap(uv + t * vec2(0.0, 2.0));
  vec3 c = tap(uv + t * vec2(2.0, 2.0));
  vec3 d = tap(uv + t * vec2(-2.0, 0.0));
  vec3 e = tap(uv);
  vec3 f = tap(uv + t * vec2(2.0, 0.0));
  vec3 g = tap(uv + t * vec2(-2.0, -2.0));
  vec3 h = tap(uv + t * vec2(0.0, -2.0));
  vec3 i = tap(uv + t * vec2(2.0, -2.0));
  vec3 j = tap(uv + t * vec2(-1.0, 1.0));
  vec3 k = tap(uv + t * vec2(1.0, 1.0));
  vec3 l = tap(uv + t * vec2(-1.0, -1.0));
  vec3 m = tap(uv + t * vec2(1.0, -1.0));
#ifdef PREFILTER
  // Karis average per 2x2 block kills single-pixel fireflies.
  vec3 g0 = (a + b + d + e) * 0.25;
  vec3 g1 = (b + c + e + f) * 0.25;
  vec3 g2 = (d + e + g + h) * 0.25;
  vec3 g3 = (e + f + h + i) * 0.25;
  vec3 g4 = (j + k + l + m) * 0.25;
  float w0 = 1.0 / (1.0 + luma(g0));
  float w1 = 1.0 / (1.0 + luma(g1));
  float w2 = 1.0 / (1.0 + luma(g2));
  float w3 = 1.0 / (1.0 + luma(g3));
  float w4 = 1.0 / (1.0 + luma(g4));
  return (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5)
    / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
#else
  return e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
#endif
}
#endif

#ifdef PREFILTER
uniform float uThreshold;
uniform float uKnee;
void main() {
  vec3 c = min(downsample13(vUv), vec3(64.0));
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * uKnee + 1e-4;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}
#endif

#ifdef DOWN
void main() { gl_FragColor = vec4(downsample13(vUv), 1.0); }
#endif

#ifdef UP
uniform sampler2D tBase;
uniform float uRadius;
void main() {
  vec4 d = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0) * uRadius;
  vec3 s = texture2D(tInput, vUv - d.xy).rgb;
  s += texture2D(tInput, vUv - d.wy).rgb * 2.0;
  s += texture2D(tInput, vUv - d.zy).rgb;
  s += texture2D(tInput, vUv + d.zw).rgb * 2.0;
  s += texture2D(tInput, vUv).rgb * 4.0;
  s += texture2D(tInput, vUv + d.xw).rgb * 2.0;
  s += texture2D(tInput, vUv + d.zy).rgb;
  s += texture2D(tInput, vUv + d.wy).rgb * 2.0;
  s += texture2D(tInput, vUv + d.xy).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0, 1.0);
}
#endif

#ifdef COMPOSITE
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uChroma;
uniform float uGlitch;
uniform float uFlash;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uAspect;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uSaturation;
uniform float uScan;

vec3 aces(vec3 x) {
  return sat((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = vUv;
  float tq = floor(uTime * 20.0);
  if (uGlitch > 0.001) {
    float band = floor(uv.y * 28.0);
    float r = hash12(vec2(band, tq));
    float shift = step(1.0 - uGlitch * 0.45, r) * (hash12(vec2(band + 7.0, tq)) - 0.5) * 0.14 * uGlitch;
    uv.x += shift;
    // occasional vertical tear
    uv.y += step(0.985, hash12(vec2(tq, 3.0))) * uGlitch * 0.02;
  }
  vec2 dir = uv - 0.5;
  float d2 = dot(dir, dir);
  vec2 off = dir * (0.001 + uChroma * (0.003 + d2 * 0.03) + uGlitch * 0.012);
  vec3 col;
  col.r = texture2D(tScene, uv + off).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - off).b;
  vec3 bloom;
  bloom.r = texture2D(tBloom, uv + off * 1.5).r;
  bloom.g = texture2D(tBloom, uv).g;
  bloom.b = texture2D(tBloom, uv - off * 1.5).b;
  col += bloom * uBloom;
  col = col * uExposure * uTint + uLift;
  col += uFlash * vec3(0.75, 0.85, 1.0);
  float l = luma(col);
  col = max(mix(vec3(l), col, uSaturation), 0.0);
  col = aces(col);
  float vig = smoothstep(1.25, 0.2, length(dir * vec2(uAspect, 1.0)) * 1.1);
  col *= mix(1.0, vig, uVignette);
  col = toSRGB(col);
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.6 + uTime * 30.0);
  col *= 1.0 - uScan * scan * 0.08;
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 913.0) - 0.5) * uGrain;
  col += (hash12(gl_FragCoord.xy * 1.371) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
#endif
#endif // VERTEX
