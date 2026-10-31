// Shared lighting: a single key light, hemisphere ambient, rim light and an
// analytic environment for reflections. Each dragon sets its own colours, so
// the same model reads as molten obsidian in one stage and gold in another.

uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uRimColor;
uniform vec3 uEnvTop;
uniform vec3 uEnvHorizon;
uniform vec3 uEnvBottom;

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-5);
}

float V_SmithGGX(float NoV, float NoL, float a) {
  float k = a * 0.5;
  return 0.25 / ((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k) + 1e-5);
}

vec3 F_Schlick(vec3 f0, float c) { return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }

vec3 envAnalytic(vec3 r, float rough) {
  float y = r.y;
  vec3 c = y > 0.0 ? mix(uEnvHorizon, uEnvTop, pow(y, 0.55)) : mix(uEnvHorizon, uEnvBottom, pow(-y, 0.45));
  float sharp = mix(220.0, 6.0, rough);
  c += uKeyColor * pow(max(dot(r, uKeyDir), 0.0), sharp) * mix(5.0, 0.6, rough);
  // two long strip lights give metal its studio "streaks"
  float strip = smoothstep(0.82 + rough * 0.1, 1.0, abs(dot(r, normalize(vec3(0.9, 0.18, -0.35)))));
  float strip2 = smoothstep(0.86 + rough * 0.1, 1.0, abs(dot(r, normalize(vec3(-0.5, 0.65, 0.5)))));
  c += (strip * 0.5 + strip2 * 0.3) * (uEnvTop + uKeyColor * 0.25) * (1.0 - rough * 0.7);
  return c;
}

vec3 hemi(vec3 n) { return mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5); }

/**
 * Compact PBR: GGX specular + Lambert diffuse + hemisphere ambient +
 * analytic environment + rim. Returns linear HDR colour.
 */
vec3 shadePBR(vec3 albedo, float metal, float rough, vec3 N, vec3 V, float ao) {
  vec3 L = normalize(uKeyDir);
  vec3 H = normalize(L + V);
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 1e-3);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
  float a = max(rough * rough, 0.002);
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 F = F_Schlick(f0, VoH);
  vec3 spec = D_GGX(NoH, a) * V_SmithGGX(NoV, NoL, a) * F;
  vec3 kd = (1.0 - F) * (1.0 - metal);
  vec3 direct = (kd * albedo / PI + spec) * uKeyColor * NoL * PI;
  vec3 R = reflect(-V, N);
  vec3 Fe = F_Schlick(f0, NoV);
  vec3 env = envAnalytic(R, rough) * Fe * mix(1.0, 0.35, rough * (1.0 - metal));
  vec3 amb = hemi(N) * albedo * kd * ao;
  float rim = pow(1.0 - NoV, 3.0);
  return direct + amb + env * ao + uRimColor * rim;
}

/** Screen-space bump mapping (Mikkelsen): perturbs n by the gradient of height h. */
vec3 bumpNormal(vec3 p, vec3 n, float h, float strength) {
  vec3 dpdx = dFdx(p);
  vec3 dpdy = dFdy(p);
  float dhdx = dFdx(h);
  float dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - strength * grad);
}

/** Voronoi that tiles every `period` cells along y (wraps around a tube). */
vec3 voronoiWrap(vec2 x, float period) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 c = n + g;
    c.y = mod(c.y, period);
    vec2 o = hash22(c);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = hash12(c); }
    else if (d < f2) { f2 = d; }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

/** Soft wrap lighting for stylised, emissive-heavy materials. */
float wrapDiffuse(vec3 N, float wrap) {
  return max((dot(N, normalize(uKeyDir)) + wrap) / (1.0 + wrap), 0.0);
}
