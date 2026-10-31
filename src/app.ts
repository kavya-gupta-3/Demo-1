import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Vector2 } from 'three';
import { Synth } from './audio/Synth';
import { damp } from './core/math';
import { detectQuality, supportsWebGL2, type Tier } from './core/quality';
import { Scroll } from './core/scroll';
import { CONTACT, STAGES } from './data/content';
import { Engine } from './gl/Engine';
import { TitlePlane } from './gl/TitlePlane';
import { Ambient } from './gl/fx/Ambient';
import { Props } from './gl/fx/Props';
import { Gates } from './gl/fx/Gates';
import type { Dragon } from './gl/dragon/Dragon';
import { Astra } from './gl/dragon/species/Astra';
import { Aurum } from './gl/dragon/species/Aurum';
import { Crimson } from './gl/dragon/species/Crimson';
import { Ignis } from './gl/dragon/species/Ignis';
import { Jade } from './gl/dragon/species/Jade';
import { Pixel, HOBBY_PALETTES } from './gl/dragon/species/Pixel';
import { Volt } from './gl/dragon/species/Volt';
import { CommandPalette, type Command } from './ui/CommandPalette';
import { initContact } from './ui/Contact';
import { initCursor } from './ui/Cursor';
import { $, $$, isTyping, store, toast } from './ui/dom';
import { initEaster } from './ui/Easter';
import { EmberHunt } from './ui/EmberHunt';
import { Hud } from './ui/Hud';
import { bindProfile, loadGithub, loadPulse } from './ui/Live';
import { Loader } from './ui/Loader';
import { Menu } from './ui/Menu';
import { initProjectArt } from './ui/ProjectArt';
import { initReveal } from './ui/Reveal';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const params = new URLSearchParams(location.search);
/** `?stage=N` pins the camera on one dragon (development/screenshots). */
const FORCE_STAGE = params.has('stage') ? Number(params.get('stage')) : null;
/** `?skip` bypasses the intro screen. */
const SKIP_INTRO = params.has('skip');

const INTERACTIVE = 'a, button, input, textarea, select, label, .panel, .proj, .pro-row, .vault-item, .social, .email-big, .hv, .hero-stats, .menu, .cmdk, .game';

export async function boot() {
  const html = document.documentElement;
  const quality = detectQuality();
  html.dataset.tier = quality.tier;
  html.classList.toggle('touch', quality.touch);
  html.classList.toggle('reduced', quality.reducedMotion);
  html.classList.toggle('glass', quality.glassBlur);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (params.has('og')) html.classList.add('og-mode');

  bindProfile();
  const loader = new Loader();
  loader.line('kg-os 7.0 :: boot sequence');
  loader.line(`gpu :: ${quality.gpu.replace(/\s*\(.*?\)\s*/g, ' ').slice(0, 48) || 'unknown'}`);
  loader.line(`quality :: ${quality.tier} · dpr ${quality.maxDpr} · msaa ${quality.msaa}x`, true);
  loader.progress(0.05);

  const scroll = new Scroll(!quality.reducedMotion);
  scroll.attach($$('main > .stage'));
  scroll.stop();
  window.scrollTo(0, 0);

  const synth = new Synth();
  const hud = new Hud();
  hud.setStage(0);

  /* ---------------------------------------------------------- 3D world */
  const canvas = $<HTMLCanvasElement>('#gl')!;
  let engine: Engine | null = null;
  let title: TitlePlane | null = null;
  let props: Props | null = null;
  const dragons: Dragon[] = [];
  const pixel = new Pixel();
  const volt = new Volt();
  const crimson = new Crimson();
  if (supportsWebGL2()) {
    try {
      engine = new Engine(canvas, quality);
      dragons.push(new Ignis(), pixel, volt, new Jade(), new Aurum(), new Astra(), crimson);
      for (const d of dragons) engine.addDragon(d);
      for (const [i, d] of dragons.entries()) {
        const s = STAGES[i];
        const li = loader.line(`summon ${s.dragon.toLowerCase()} :: ${s.classification.toLowerCase()}`);
        const t0 = performance.now();
        d.build(await engine.factory.build(d.species, quality.detail));
        if (li) {
          li.textContent += ` · ${Math.round(performance.now() - t0)}ms`;
          li.className = 'ok';
        }
        loader.progress(0.08 + ((i + 1) / dragons.length) * 0.62);
      }
      engine.factory.dispose();
      loader.line('fonts :: cinzel · chakra petch · jetbrains mono');
      await Promise.race([document.fonts.load('900 100px Cinzel'), new Promise((r) => setTimeout(r, 2500))]);
      title = new TitlePlane(quality.msaa > 0);
      engine.scene.add(title.mesh);
      engine.systems.push(title);
      const ambient = new Ambient(quality.particles);
      props = new Props(quality.detail);
      const gates = new Gates();
      engine.scene.add(ambient.points, props.grid, props.crystals, props.coins, ...gates.meshes);
      engine.systems.push(ambient, props, gates);
      html.classList.add('gl-title');
      loader.progress(0.78);
      loader.line('compile :: glsl programs (spine, skin, sky, post)');
      await engine.compile();
      loader.line('compile :: done', true);
      // phones: the URL bar sliding in/out changes the height a little —
      // the canvas is sized to 100lvh, so only real resizes rebuild targets
      let lastW = window.innerWidth;
      let lastH = window.innerHeight;
      window.addEventListener('resize', () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (quality.touch && w === lastW && Math.abs(h - lastH) < 160) return;
        lastW = w;
        lastH = h;
        engine?.resize();
      });
    } catch (error) {
      console.warn('[kg] WebGL disabled:', error);
      engine = null;
      html.classList.remove('gl-title');
      html.classList.add('no-webgl');
    }
  } else {
    html.classList.add('no-webgl');
    loader.line('webgl2 :: unavailable — falling back to 2D');
  }
  await document.fonts.ready;
  loader.progress(0.95);

  /* --------------------------------------------------------------- UI */
  let chapter = 0;
  let paused = false;
  let hudStage = 0;
  initReveal({ onChapter: (c) => (chapter = c) }, quality.reducedMotion);
  initProjectArt(quality.touch);
  initCursor();

  const goTo = (i: number) => {
    const el = $$('main > .stage')[i];
    if (!el) return;
    synth.click();
    scroll.to(el);
  };

  const soundBtn = $<HTMLButtonElement>('[data-action="sound"]');
  const setSound = async (on: boolean) => {
    if (on) await synth.enable();
    else synth.disable();
    soundBtn?.setAttribute('aria-pressed', String(synth.enabled));
    store.set('kg-sound', synth.enabled ? '1' : '0');
  };
  soundBtn?.addEventListener('click', () => setSound(!synth.enabled));

  const provokeSound = (d: Dragon | null) => {
    if (!d) return;
    if (d.species === 'volt') synth.zap();
    else if (d.species === 'aurum') {
      synth.roar(0.8);
      synth.chime();
    } else if (d.species === 'pixel') synth.blip(880, 0.08);
    else if (d.species === 'astra') synth.chime();
    else synth.roar(d.species === 'crimson' ? 1.15 : 1);
  };
  const provoke = () => {
    const d = engine?.provoke() ?? null;
    if (d?.species === 'aurum') props?.shower();
    if (d?.species === 'jade') props?.scatter();
    provokeSound(d);
  };

  const rage = () => {
    if (!engine) return;
    for (const d of dragons) d.rage = 1;
    engine.rage(5);
    props?.shower();
    props?.scatter();
    synth.roar(0.7);
    synth.zap();
  };

  volt.onStrike = () => {
    if (engine) engine.flash = Math.max(engine.flash, 0.9);
    synth.zap();
  };

  const menu = new Menu((open) => (open ? scroll.stop() : scroll.start()));
  const game = new EmberHunt({
    open: () => {
      paused = true;
      scroll.stop();
    },
    close: () => {
      paused = false;
      scroll.start();
    },
    sound: (k) => (k === 'eat' ? synth.blip(1200) : k === 'gold' ? synth.chime() : k === 'die' ? synth.roar(1.4) : synth.whoosh()),
  });

  const setQuality = (tier: Tier) => {
    const url = new URL(location.href);
    url.searchParams.set('q', tier);
    location.href = url.toString();
  };
  const commands: Command[] = [
    ...STAGES.map((s) => ({ id: `go-${s.id}`, label: `Go to ${s.label}`, hint: s.dragon, keywords: `${s.id} ${s.dragon} section`, run: () => goTo(s.index) })),
    { id: 'sound', label: 'Toggle sound', hint: 'M', keywords: 'music mute audio', run: () => setSound(!synth.enabled) },
    { id: 'email', label: 'Copy email address', hint: CONTACT.email, keywords: 'mail contact', run: () => navigator.clipboard?.writeText(CONTACT.email).then(() => toast('Email copied')) },
    ...CONTACT.socials.map((s) => ({ id: `open-${s.id}`, label: `Open ${s.label}`, hint: s.handle, keywords: 'social profile link', run: () => window.open(s.url, '_blank', 'noopener') })),
    { id: 'provoke', label: 'Provoke the dragon', hint: 'click void', keywords: 'roar fire attack', run: provoke },
    { id: 'game', label: 'Play Ember Hunt', hint: 'mini-game', keywords: 'game play arcade', run: () => game.open() },
    { id: 'rage', label: 'Unleash Dragon Rage', hint: 'secret', keywords: 'konami easter egg', run: rage },
    { id: 'hud', label: 'Toggle HUD', hint: 'clean view', keywords: 'hide interface zen', run: () => html.classList.toggle('hud-hidden') },
    { id: 'q-high', label: 'Quality: high', hint: 'reload', keywords: 'graphics performance', run: () => setQuality('high') },
    { id: 'q-med', label: 'Quality: balanced', hint: 'reload', keywords: 'graphics performance medium', run: () => setQuality('medium') },
    { id: 'q-low', label: 'Quality: low', hint: 'reload', keywords: 'graphics performance battery', run: () => setQuality('low') },
    { id: 'top', label: 'Back to the fire', hint: 'top', keywords: 'home start', run: () => goTo(0) },
  ];
  new CommandPalette(commands, (open) => (open ? scroll.stop() : scroll.start()));

  initContact({
    onSent: () => {
      goTo(6);
      crimson.swoop(gsap.ticker.time);
      synth.roar(1.2);
    },
    onSound: (k) => (k === 'send' ? synth.chime() : synth.blip(200, 0.08)),
  });
  initEaster(rage);

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const goto = target.closest<HTMLElement>('[data-goto]');
    if (goto) {
      e.preventDefault();
      menu.toggle(false);
      goTo(Number(goto.dataset.goto));
      return;
    }
    if (!target.closest(INTERACTIVE) && !window.getSelection()?.toString()) provoke();
  });
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'm') void setSound(!synth.enabled);
  });
  document.addEventListener('pointerover', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) synth.blip(1800, 0.015);
  });

  /* ------------------------------------------------------------ enter */
  const choice = SKIP_INTRO ? 'silent' : await loader.ready(store.get('kg-sound') === '1' ? 4000 : 9000);
  if (choice === 'sound') await setSound(true);
  if (SKIP_INTRO) loader.remove();
  else await loader.leave();
  scroll.start();
  ScrollTrigger.refresh();
  if (location.hash) {
    const el = document.querySelector<HTMLElement>(location.hash);
    if (el) scroll.to(el, true);
  }
  if (title) gsap.to(title, { reveal: 1, duration: SKIP_INTRO ? 0.01 : 2.4, ease: 'power2.inOut', delay: 0.15 });
  if (!quality.reducedMotion && !SKIP_INTRO) {
    gsap.from('.origin-hero > :not(.hero-title)', { y: 30, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', delay: 0.5 });
    gsap.from('.hud-top, .hud-spine, .hud-readout, .hud-specimen, .hud-ticker', { opacity: 0, duration: 1.4, delay: 0.9, stagger: 0.1 });
  }
  void loadGithub();
  void loadPulse((t) => hud.signal(t));

  /* ------------------------------------------------------------- loop */
  const pointer = new Vector2();
  const pointerSmooth = new Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });
  const eqBars = $$('#hobby-eq i');
  const levels = new Uint8Array(32);
  const musicVisual = $('.hv-music');

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time, deltaMs) => {
    const rawDt = Math.max(1e-4, deltaMs / 1000);
    const dt = Math.min(rawDt, 1 / 20);
    scroll.raf(time * 1000);
    scroll.update(dt);
    const stage = FORCE_STAGE ?? scroll.stage;
    const active = Math.max(0, Math.min(6, Math.round(stage)));
    if (active !== hudStage) {
      hudStage = active;
      hud.setStage(active);
      synth.setStage(active);
    }
    pointerSmooth.x = damp(pointerSmooth.x, pointer.x, 4, dt);
    pointerSmooth.y = damp(pointerSmooth.y, pointer.y, 4, dt);
    if (engine && !paused) {
      // the voxel dragon's palette tints the arcade sky
      const [a, b] = pixel.palette;
      engine.sky.material.uniforms.uHobbyA.value.copy(a);
      engine.sky.material.uniforms.uHobbyB.value.copy(b);
      props?.gridColors.a.copy(a);
      props?.gridColors.b.copy(b);
      engine.frame({ time, dt, rawDt, scrollY: scroll.y, stage, locals: scroll.local, chapter, velocity: scroll.velocity, pointer: pointerSmooth });
    }
    hud.update(scroll.progress, engine ? engine.camera.position.y : scroll.progress * 420, engine?.fps ?? 60, time);
    // music hobby: melody + live equaliser
    const onMusic = active === 1 ? Math.max(0, 1 - Math.abs(chapter - 2) * 1.6) : 0;
    synth.music = onMusic;
    synth.tick(scroll.velocity);
    if (onMusic > 0.3 && synth.levels(levels)) {
      musicVisual?.classList.add('music-live');
      for (let i = 0; i < eqBars.length; i++) eqBars[i].style.setProperty('--h', String((levels[(i % 24) + 2] ?? 0) / 255));
    } else musicVisual?.classList.remove('music-live');
  });

  (window as unknown as Record<string, unknown>).__kg = { engine, scroll, ready: true, palettes: HOBBY_PALETTES };
}
