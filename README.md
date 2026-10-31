# KAVYA GUPTA — seven dragons, one developer

A full-3D, dragon-themed personal website. One page, seven sections, seven
procedurally generated dragons — each with its own anatomy, material, colour,
motion and power — choreographed by scroll.

| # | Section | Dragon | Built from | Power (click empty space) |
|---|---|---|---|---|
| 01 | Origin | **IGNIS** — The Obsidian Sovereign | obsidian scales split by lava veins, coils around the 3D name | breathes fire |
| 02 | Hobbies | **PIXEL** — The Prism Wyrm | ~2,000 instanced holographic voxels; recolours + bursts on every hobby | explodes into pixels |
| 03 | Skills | **VOLT** — The Circuit Serpent | 46 floating armour plates around a naked energy core | calls lightning |
| 04 | Projects | **JADE** — The Crystal Forgewyrm | faceted emerald, crystal clusters, parallax "inner veins" | sheds crystal shards |
| 05 | Achievements | **AURUM** — The Hoard King | polished gold (GGX + studio env), bat wings, rupee-coin rain | roars, coin shower |
| 06 | Dreams | **ASTRA** — The Star-Born | 15,000 stars + constellation lines + wings of light | stardust burst |
| 07 | Contact | **CRIMSON** — The Ember Herald | crimson wyvern with wings of living flame | fire; dives past the camera when a message is sent |

## Tech

- **TypeScript** (strict) + **Vite 8**
- **Three.js** with hand-written **GLSL** everywhere — no stock materials
  - GPU **spine deformation**: each dragon is modelled straight and bent along a
    live spine stored in a float texture (rotation-minimising frames, arclength
    re-spacing, banking)
  - **Signed-distance sculpting + Naive Surface Nets** meshing for every skull
  - Geometry built in a **Web Worker** so the loader never stutters
  - Custom post pipeline: HDR target with MSAA → 13-tap dual-filter **bloom**
    (Karis-weighted) → composite with chromatic aberration, glitch, grading,
    ACES, vignette, scanlines, grain
  - Procedural sky (7 skies blended by altitude), analytic GPU particle
    atmosphere, CPU particle emitters, screen-space lightning ribbons
  - Adaptive quality tiers + a frame-time governor that trims render scale
- **GSAP** (ScrollTrigger, SplitText, ScrambleText, DrawSVG) + **Lenis** smooth scroll
- **Web Audio API** — the whole soundtrack is synthesised live (drone per dragon,
  wind tied to scroll speed, roars, thunder, a generative melody on the music
  hobby driving a live equaliser). Zero audio files.
- **Canvas 2D** — generative project cover art and the *Ember Hunt* mini-game
- **Vercel Edge Functions** (`/api`) — contact form, live GitHub stats, visitor pulse
- Build-time HTML rendering: every word of the page is static HTML (fast, SEO,
  works without JavaScript), then upgraded by the 3D layer

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — the /api functions run inside Vite too
npm run build      # → dist/
npm run preview
npm run check      # typecheck + build
```

Handy URL flags: `?q=low|medium|high` force a quality tier, `?skip` skips the
intro, `?stage=0-6` pins the camera on one dragon.

## Edit the content

All text lives in **`src/data/content.ts`** (sections, hobbies, skills,
projects, achievements, dreams, contact). Identity, age and education logic
live in **`src/data/profile.ts`**.

Things that update themselves:

- **Age** — calculated from the date of birth in Indian Standard Time; only the
  age is ever shown on the page.
- **College year** — BCA at Shayona College (Gujarat University) starting in
  2026–27. It moves to the next year every **1 June** (after exams and results)
  and shows **"BCA graduate · Class of 2029"** from 1 June 2029 onward.
- The copyright year.

## Deploy (Vercel)

1. Import the repository at vercel.com → it detects Vite (`vercel.json` is included).
2. Optional environment variables (see `.env.example`):
   - `RESEND_API_KEY` (+ `CONTACT_TO`, `CONTACT_FROM`) — contact form emails you
   - `CONTACT_WEBHOOK_URL` — send messages to an n8n workflow instead / as well
   - `GITHUB_TOKEN` — live GitHub stats without rate limits
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the Vercel KV
     integration) — visitor counter + durable rate limiting
   - `SITE_URL` — canonical domain for SEO tags if you use a custom domain

Without any of them the site still works: the contact form opens the visitor's
mail app with the message pre-filled.

## Keyboard

`⌘K` / `Ctrl+K` command palette · `/` quick open · `M` toggle sound ·
↑ ↑ ↓ ↓ ← → ← → B A for Dragon Rage.

## Structure

```
api/                 Vercel Edge Functions (contact, github, pulse)
src/data/            all content + age/education logic
src/render/          build-time HTML (page sections, logo)
src/gl/              3D engine: Engine, Director, PostFX, Sky, TitlePlane
src/gl/dragon/       spine, SDF + surface nets, anatomy, wings, blueprints, worker
src/gl/dragon/species/  the seven dragons
src/gl/fx/           particles, lightning, props
src/gl/shaders/      GLSL (with a tiny #include system, see vite.config.ts)
src/ui/              loader, HUD, cursor, menu, command palette, reveals, game…
src/audio/           Web Audio synthesiser
```

© Kavya Gupta. All rights reserved.
