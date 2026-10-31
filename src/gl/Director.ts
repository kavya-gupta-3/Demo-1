import { Vector2, Vector3 } from 'three';
import { clamp, damp, lerp, smoothstep } from '../core/math';

/** Vertical distance between dragon stages: the journey climbs from magma to the stars. */
export const GAP = 70;
export const STAGE_COUNT = 7;

export function stageCenter(i: number, out = new Vector3()) {
  return out.set(0, i * GAP, 0);
}

interface Rig {
  pos: Vector3;
  target: Vector3;
  fov: number;
}

const rig: Rig = { pos: new Vector3(), target: new Vector3(), fov: 40 };

/**
 * Camera framing for each stage as a function of how far the reader is
 * through that section. Positions are relative to the stage centre.
 */
function stageRig(i: number, l: number, aspect: number, chapter: number, out: Rig) {
  const portrait = aspect < 1;
  const back = portrait ? 1.55 : aspect < 1.35 ? 1.2 : 1;
  switch (i) {
    case 0: {
      const k = smoothstep(0.05, 0.6, l);
      out.pos.set(lerp(0, -2.5, k), lerp(1.2, 2.4, k), lerp(17, 19, k) * back);
      out.target.set(lerp(0, 3.2, k) * (portrait ? 0.4 : 1), lerp(0, 0.6, k), 0);
      out.fov = 40;
      break;
    }
    case 1: {
      // Hobbies: a lateral dolly that follows the five levels.
      const x = lerp(-6, 6, chapter / 4) * 0.6;
      out.pos.set(x, 1.0 + Math.sin(l * Math.PI) * 1.2, 21 * back);
      out.target.set(x, 0.3, 0);
      out.fov = 42;
      break;
    }
    case 2: {
      const a = lerp(-0.35, 0.35, l);
      out.pos.set(Math.sin(a) * 22 * back, lerp(3, -1, l), Math.cos(a) * 22 * back);
      out.target.set(0, lerp(1.5, -0.5, l), 0);
      out.fov = 42;
      break;
    }
    case 3: {
      out.pos.set(lerp(4, -4, l), lerp(4, -3, l), 24 * back);
      out.target.set(lerp(1, -1, l), lerp(1.5, -1.5, l), 0);
      out.fov = 40;
      break;
    }
    case 4: {
      out.pos.set(lerp(-3, 3, l), lerp(-1.5, 2.5, l), lerp(23, 20, l) * back);
      out.target.set(0, lerp(2.2, 1.0, l), 0);
      out.fov = 40;
      break;
    }
    case 5: {
      out.pos.set(Math.sin(l * 1.2) * 6, lerp(-6, 10, l), 22 * back);
      out.target.set(0, lerp(-3, 13, l), 0);
      out.fov = 44;
      break;
    }
    default: {
      out.pos.set(lerp(1, -1.5, l), lerp(2, 0.5, l), 22 * back);
      out.target.set(portrait ? 0 : lerp(0.5, -1, l), lerp(1.2, 0.5, l), 0);
      out.fov = 40;
    }
  }
  return out;
}

export class Director {
  readonly camPos = new Vector3(0, 0, 23);
  readonly camTarget = new Vector3();
  readonly weights = new Array<number>(STAGE_COUNT).fill(0);
  fov = 40;
  /** 0 at a stage, peaks to 1 halfway between two stages. */
  transit = 0;
  stage = 0;
  private readonly wantPos = new Vector3();
  private readonly wantTarget = new Vector3();
  private readonly tmp = new Vector3();
  private first = true;

  /** Jump straight to the framing (no fly-in) on the next update. */
  snap() {
    this.first = true;
  }

  update(stage: number, locals: number[], chapter: number, pointer: Vector2, aspect: number, dt: number, reduced: boolean) {
    this.stage = stage;
    for (let i = 0; i < STAGE_COUNT; i++) this.weights[i] = clamp(1 - Math.abs(stage - i));
    const f = stage - Math.floor(stage);
    this.transit = Math.sin(f * Math.PI);

    const i0 = Math.min(STAGE_COUNT - 1, Math.floor(stage));
    const i1 = Math.min(STAGE_COUNT - 1, i0 + 1);
    const blend = i0 === i1 ? 0 : smoothstep(0, 1, f);

    stageRig(i0, locals[i0] ?? 0, aspect, chapter, rig);
    this.wantPos.copy(rig.pos).add(stageCenter(i0, this.tmp));
    this.wantTarget.copy(rig.target).add(this.tmp);
    let fov = rig.fov;
    if (blend > 0) {
      stageRig(i1, locals[i1] ?? 0, aspect, chapter, rig);
      const p1 = rig.pos.add(stageCenter(i1, this.tmp));
      const t1 = rig.target.add(this.tmp);
      this.wantPos.lerp(p1, blend);
      this.wantTarget.lerp(t1, blend);
      fov = lerp(fov, rig.fov, blend);
      // swing outward mid-flight so the climb reads as a flight, not a lift
      this.wantPos.z += this.transit * 9;
      this.wantPos.x += this.transit * 4 * Math.sin(stage * 2.1);
    }
    const par = reduced ? 0 : 1;
    this.wantPos.x += pointer.x * 1.3 * par;
    this.wantPos.y += pointer.y * 0.8 * par;
    this.fov = damp(this.fov, fov + this.transit * 14 * par, 4, dt);

    if (this.first) {
      this.camPos.copy(this.wantPos);
      this.camTarget.copy(this.wantTarget);
      this.first = false;
    }
    const k = reduced ? 10 : 3.2;
    this.camPos.x = damp(this.camPos.x, this.wantPos.x, k, dt);
    this.camPos.y = damp(this.camPos.y, this.wantPos.y, k * 1.4, dt);
    this.camPos.z = damp(this.camPos.z, this.wantPos.z, k, dt);
    this.camTarget.x = damp(this.camTarget.x, this.wantTarget.x, k, dt);
    this.camTarget.y = damp(this.camTarget.y, this.wantTarget.y, k * 1.4, dt);
    this.camTarget.z = damp(this.camTarget.z, this.wantTarget.z, k, dt);
  }
}
