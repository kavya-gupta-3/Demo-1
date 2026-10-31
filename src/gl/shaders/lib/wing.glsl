// Wing placement: flap (progressive along the span), sweep, mirror, then
// ride rigidly on the shoulder frame of the spine.

uniform float uWingS;
uniform vec3 uWingRoot;
uniform float uSide;
uniform float uFlap;
uniform float uFold;
uniform float uSweep;
uniform float uSpan;
uniform float uDihedral;

vec3 wRotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c + v.z * s, -v.y * s + v.z * c); }
vec3 wRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }

void wingTransform(vec3 pos, vec3 nor, float ripple, out vec3 wpos, out vec3 wnor, out float spanU) {
  vec3 p = pos;
  vec3 n = nor;
  float u = clamp(p.z / uSpan, 0.0, 1.0);
  spanU = u;
  float ang = uDihedral + uFlap * (0.35 + 0.65 * u) + uFold * smoothstep(0.3, 1.0, u) * u;
  p = wRotX(p, ang);
  n = wRotX(n, ang);
  p.y += sin(uTime * 7.0 + u * 9.0 + p.x * 2.0) * 0.035 * u * ripple;
  p = wRotY(p, uSweep);
  n = wRotY(n, uSweep);
  p.z *= uSide;
  n.z *= uSide;
  vec3 root = vec3(uWingRoot.x, uWingRoot.y, uWingRoot.z * uSide);
  SpineFrame f = spineAt(uWingS);
  wpos = spineRigid(f, root + p);
  wnor = spineDir(f, n);
}
