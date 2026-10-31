// ASTRA — a dragon made of stars. Body points bend along the spine; wing
// points use the wing transform; constellation lines join the major stars.
// One file, three programs: BODY, WING, LINES (each with VERTEX/FRAGMENT).
#include "../lib/dragon_core.glsl"
#ifdef WING
#include "../lib/wing.glsl"
#endif

uniform float uReveal;
uniform float uRage;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uStarC;

varying vec4 vRand;
varying float vGlow;
varying float vPartF;

#ifdef VERTEX
#if defined(BODY)
attribute float aPart;
attribute vec4 aPivot;
#endif
#if defined(BODY) || defined(WING)
attribute vec4 aRand;
#endif
#ifdef WING
attribute float aExtra;
#endif

void main() {
  vec3 wp;
  vec3 wn;
#if defined(BODY)
  deformPart(int(aPart + 0.5), aPivot, position, vec3(0.0, 1.0, 0.0), wp, wn);
  vRand = aRand;
  vPartF = aPart;
  float bright = aRand.z;
#elif defined(WING)
  float span;
  wingTransform(position, vec3(0.0, 1.0, 0.0), 1.0, wp, wn, span);
  vRand = aRand;
  vPartF = 20.0 + aExtra;
  float bright = aRand.z;
#else
  SpineFrame f;
  wp = spineBend(position, f);
  vRand = vec4(0.5, 0.5, 1.0, 0.5);
  vPartF = 30.0;
  float bright = 1.0;
#endif
  // stars breathe and drift a little around their place
  vec3 jitter = (hash33(vRand.xyw * 97.0) - 0.5) * 0.08;
  wp += jitter * sin(uTime * 0.6 + vRand.w * TAU);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float order = vRand.x * 0.6 + vRand.y * 0.4;
  float rv = smoothstep(order, order + 0.15, uReveal * 1.2);
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + vRand.y * 4.0) + vRand.w * TAU);
  vGlow = rv * tw * (1.0 + uRage * 1.5);
  float size = uSize * (0.45 + bright * 2.4) * (0.7 + 0.3 * tw);
  gl_PointSize = max(1.0, size * uPixelRatio * 48.0 / max(-mv.z, 0.5)) * rv;
  gl_Position = projectionMatrix * mv;
}
#else
void main() {
#ifdef LINES
  gl_FragColor = vec4(mix(uStarB, uStarC, 0.5) * 1.6 * uReveal * (1.0 + uRage), 1.0);
#else
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = pow(smoothstep(0.5, 0.0, d), 2.6);
  float bright = vRand.z;
  float flare = (smoothstep(0.06, 0.0, abs(c.x)) + smoothstep(0.06, 0.0, abs(c.y))) * smoothstep(0.5, 0.05, d) * smoothstep(0.85, 1.0, bright);
  vec3 col = mix(uStarA, uStarB, vRand.x);
  col = mix(col, uStarC, smoothstep(0.7, 1.0, bright) * 0.8);
  if (vPartF > 8.5 && vPartF < 9.5) col = vec3(1.0, 0.85, 1.0) * 3.0;
  float k = core * (0.35 + bright * 2.0) + flare * 1.5;
  gl_FragColor = vec4(col * k * vGlow * 1.4, 1.0);
#endif
}
#endif
