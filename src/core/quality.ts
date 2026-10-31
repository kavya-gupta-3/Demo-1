/**
 * Device tiering. Picks a starting budget from what the device tells us,
 * then the adaptive governor in the engine trims render scale at runtime if
 * frames run long. `?q=low|medium|high` forces a tier.
 */

export type Tier = 'low' | 'medium' | 'high';

export interface Quality {
  tier: Tier;
  /** Upper bound for the canvas pixel ratio. */
  maxDpr: number;
  /** MSAA samples on the HDR scene target. */
  msaa: number;
  /** Ambient particle count. */
  particles: number;
  /** Bloom mip levels. */
  bloomLevels: number;
  /** Geometry density multiplier for procedural meshes (0.5 – 1). */
  detail: number;
  /** Heavy CSS (backdrop blur) allowed. */
  glassBlur: boolean;
  touch: boolean;
  reducedMotion: boolean;
  gpu: string;
}

const PRESETS: Record<Tier, Omit<Quality, 'tier' | 'touch' | 'reducedMotion' | 'gpu'>> = {
  high: { maxDpr: 2, msaa: 4, particles: 26000, bloomLevels: 6, detail: 1, glassBlur: true },
  medium: { maxDpr: 1.5, msaa: 2, particles: 14000, bloomLevels: 5, detail: 0.8, glassBlur: true },
  low: { maxDpr: 1, msaa: 0, particles: 6000, bloomLevels: 4, detail: 0.6, glassBlur: false },
};

function gpuName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'unknown';
  }
}

export function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function detectQuality(): Quality {
  const params = new URLSearchParams(location.search);
  const forced = params.get('q') as Tier | null;
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gpu = gpuName();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const small = Math.min(screen.width, screen.height) < 600;

  let tier: Tier = 'high';
  const weakGpu = /swiftshader|llvmpipe|software|mali-[gt]?[4-7]\d|adreno \(tm\) [3-5]\d\d|powervr|intel\(r\) (hd|uhd) graphics [2-6]\d\d/i.test(gpu);
  if (weakGpu || cores <= 2 || memory <= 2) tier = 'low';
  else if (touch || small || cores <= 4 || memory <= 4) tier = 'medium';
  if (forced && forced in PRESETS) tier = forced;

  const preset = PRESETS[tier];
  return {
    tier,
    ...preset,
    maxDpr: Math.min(preset.maxDpr, window.devicePixelRatio || 1),
    // Phones get a smaller particle budget than desktops of the same tier.
    particles: touch && tier !== 'low' ? Math.round(preset.particles * 0.6) : preset.particles,
    touch,
    reducedMotion,
    gpu,
  };
}
