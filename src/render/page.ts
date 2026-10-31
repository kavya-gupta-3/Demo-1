/**
 * Build-time renderer. Turns src/data into the static HTML of the page —
 * loader, HUD, all seven sections and the overlays — which Vite injects into
 * index.html. JavaScript then upgrades this markup; it never has to create it.
 */
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_INTRO,
  CONTACT,
  DREAMS,
  DREAMS_INTRO,
  HERO,
  HOBBIES,
  HOBBIES_INTRO,
  MANIFESTO,
  PERSONAL_PROJECTS,
  PROFESSIONAL_PROJECTS,
  PROJECTS_INTRO,
  SKILLS,
  STAGES,
  VAULT,
  type Project,
  type Stage,
} from '../data/content.ts';
import { IDENTITY, PROGRAMME, ageOn, educationOn } from '../data/profile.ts';
import { sigil } from './logo.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const hex = (n: number, w = 4) => n.toString(16).toUpperCase().padStart(w, '0');

function stageAttrs(s: Stage) {
  return `id="${s.id}" class="stage stage--${s.id}" data-stage="${s.index}" style="--c1:${s.color};--c2:${s.color2}" aria-labelledby="${s.id}-title"`;
}

function secHead(s: Stage, title: string, sub: string, extra = '') {
  return `<header class="sec-head" data-reveal>
    <div class="sec-meta mono">
      <span class="sec-num">${pad(s.index + 1)}<i>/07</i></span>
      <span class="sec-line" aria-hidden="true"></span>
      <span class="sec-dragon">${esc(s.dragon)} · ${esc(s.epithet)}</span>
    </div>
    <h2 id="${s.id}-title" class="sec-title" data-split>${esc(title)}</h2>
    <p class="sec-sub">${esc(sub)}</p>${extra}
  </header>`;
}

function chips(items: string[], cls = 'chips') {
  return `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

/* ------------------------------------------------------------------ loader */

function loader() {
  return `<div id="loader" class="loader" role="status" aria-live="polite" aria-label="Loading">
  <div class="ld-grid" aria-hidden="true"></div>
  <div class="ld-core">
    <div class="ld-sigil">${sigil({ className: 'ld-mark' })}</div>
    <p class="ld-name">${esc(IDENTITY.first)}<span>${esc(IDENTITY.last)}</span></p>
    <div class="ld-meter" aria-hidden="true"><i></i></div>
    <p class="ld-pct mono"><span id="ld-pct">000</span><small>%</small></p>
    <ol id="ld-log" class="ld-log mono" aria-hidden="true"></ol>
    <div class="ld-actions" hidden>
      <button type="button" class="btn btn--primary" data-enter="sound"><span>Enter with sound</span></button>
      <button type="button" class="btn btn--ghost" data-enter="silent"><span>Enter silently</span></button>
    </div>
  </div>
  <p class="ld-foot mono" aria-hidden="true"><span>SIGIL://KG-0001</span><span>7 DRAGONS · 7 SECTORS</span><span>WEBGL2 · GLSL 3.00</span></p>
</div>`;
}

/* --------------------------------------------------------------------- HUD */

function hud() {
  const nav = STAGES.map(
    (s) =>
      `<li><a href="#${s.id}" data-goto="${s.index}" style="--c1:${s.color}"><span class="mono">${pad(s.index + 1)}</span>${esc(s.label)}</a></li>`,
  ).join('');
  const spine = STAGES.map(
    (s) =>
      `<li><a href="#${s.id}" data-goto="${s.index}" style="--c1:${s.color}" aria-label="${esc(s.label)}"><i></i><span class="mono">${pad(s.index + 1)} ${esc(s.dragon)}</span></a></li>`,
  ).join('');
  return `<header class="hud-top" id="hud-top">
  <a class="brand" href="#origin" data-goto="0" aria-label="${esc(IDENTITY.name)} — back to top">
    ${sigil({ className: 'brand-mark' })}
    <span class="brand-word"><b>${esc(IDENTITY.first)}</b><i>${esc(IDENTITY.last)}</i></span>
  </a>
  <nav class="hud-nav" aria-label="Sections"><ol>${nav}</ol></nav>
  <div class="hud-actions">
    <button type="button" class="hud-btn hud-sound" data-action="sound" aria-pressed="false" aria-label="Toggle sound">
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="mono hud-btn-label">SND</span>
    </button>
    <button type="button" class="hud-btn hud-cmd" data-action="cmdk" aria-label="Open command palette">
      <span class="mono"><kbd>⌘</kbd><kbd>K</kbd></span>
    </button>
    <button type="button" class="hud-btn hud-menu" data-action="menu" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
      <span class="burger" aria-hidden="true"><i></i><i></i></span>
    </button>
  </div>
</header>
<nav class="hud-spine" aria-label="Section progress"><ol>${spine}</ol><div class="spine-rail" aria-hidden="true"><i id="spine-fill"></i></div></nav>
<div class="hud-frame" aria-hidden="true">
  <i class="hf-c hf-tl"></i><i class="hf-c hf-tr"></i><i class="hf-c hf-bl"></i><i class="hf-c hf-br"></i>
  <i class="hf-cross"></i>
  <div class="hf-ruler hf-ruler--l"></div><div class="hf-ruler hf-ruler--r"></div>
</div>
<aside class="hud-readout mono" aria-hidden="true">
  <p><span>SECTOR</span><b id="ro-sector">01/07</b></p>
  <p><span>ALT</span><b><em id="ro-alt">0000.0</em> m</b></p>
  <p><span>DEPTH</span><b><em id="ro-scroll">000.0</em> %</b></p>
  <p><span>FPS</span><b id="ro-fps">--</b></p>
  <p><span>IST</span><b id="ro-time">--:--:--</b></p>
  <p class="ro-pulse"><span>SIGNAL</span><b id="ro-signal">local</b></p>
</aside>
<aside class="hud-specimen" id="specimen" aria-live="polite">
  <p class="sp-k mono">SPECIMEN <b id="sp-num">01</b> · <span id="sp-class">${esc(STAGES[0].classification)}</span></p>
  <p class="sp-name" id="sp-name">${esc(STAGES[0].dragon)}</p>
  <p class="sp-epithet" id="sp-epithet">${esc(STAGES[0].epithet)}</p>
  <div class="sp-row mono"><span>ELEMENT</span><b id="sp-element">${esc(STAGES[0].element)}</b></div>
  <div class="sp-row mono"><span>THREAT</span><b class="sp-bar"><i id="sp-threat"></i></b></div>
  <p class="sp-lore" id="sp-lore">${esc(STAGES[0].lore)}</p>
  <p class="sp-hint mono">CLICK THE VOID TO PROVOKE IT</p>
</aside>
<div class="hud-ticker mono" aria-hidden="true"><div class="ticker-track" id="ticker"></div></div>`;
}

/* ---------------------------------------------------------------- sections */

function origin(now: Date) {
  const s = STAGES[0];
  const edu = educationOn(now);
  const age = ageOn(now);
  const eduValue = edu.status === 'studying' ? `${PROGRAMME.degree} · ${edu.ordinal} year` : `${PROGRAMME.degree} · Graduate`;
  return `<section ${stageAttrs(s)}>
  <div class="origin-hero">
    <p class="eyebrow mono" data-scramble>${esc(HERO.eyebrow)}</p>
    <h1 id="origin-title" class="hero-title" aria-label="${esc(IDENTITY.name)}"><span class="ht-word" data-text="${esc(IDENTITY.first)}">${esc(IDENTITY.first)}</span><span class="ht-word" data-text="${esc(IDENTITY.last)}">${esc(IDENTITY.last)}</span></h1>
    <div class="hero-meta">
    <p class="hero-role"><span data-bind="what">${esc(IDENTITY.role)}</span><i aria-hidden="true">/</i><span data-bind="edu-label">${esc(edu.label)}</span></p>
    <ul class="hero-stats mono">
      <li><span>Age</span><b data-bind="age">${age}</b></li>
      <li><span>Study</span><b data-bind="edu">${esc(eduValue)}</b></li>
      <li><span>College</span><b>${esc(PROGRAMME.college)}</b></li>
      <li><span>Timetable</span><b>None. Ever.</b></li>
    </ul>
    <p class="hero-kicker">${esc(HERO.kicker)}</p>
    </div>
    <a class="scroll-cue mono" href="#manifesto" aria-label="Scroll down"><span>Scroll to wake the dragons</span><i aria-hidden="true"></i></a>
  </div>
  <div class="manifesto" id="manifesto">
    <div class="mf-panel panel" data-reveal>
      <p class="panel-tag mono">${esc(MANIFESTO.tag)}</p>
      <h3 class="mf-title">${MANIFESTO.title.map((t) => `<span data-split>${esc(t)}</span>`).join('')}</h3>
      <p class="mf-lead">${esc(MANIFESTO.lead)}</p>
      <ol class="mf-rules">${MANIFESTO.rules
        .map(
          (r) =>
            `<li class="mf-rule" data-reveal><span class="mono">${esc(r.code)}</span><h4>${esc(r.title)}</h4><p>${esc(r.body)}</p></li>`,
        )
        .join('')}</ol>
    </div>
    <div class="mf-verdict" data-reveal>
      <p class="mf-verdict-main">${esc(MANIFESTO.verdict)}</p>
      <p class="mf-verdict-sub mono">${esc(MANIFESTO.verdictSub)}</p>
    </div>
  </div>
</section>`;
}

const HOBBY_VISUALS: Record<string, string> = {
  gaming: `<div class="hv hv-gaming" aria-hidden="true">
    <div class="hvg-screen"><span class="hvg-cross"></span><span class="hvg-hp"><i></i></span><span class="hvg-ammo mono">30/120</span><span class="hvg-kill mono">#1 WINNER</span></div>
    <svg class="hvg-pad" viewBox="0 0 200 120"><path d="M46 24h108c26 0 40 30 44 62 3 24-16 34-30 22l-22-20H54L32 108c-14 12-33 2-30-22 4-32 18-62 44-62z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M52 46v28M38 60h28" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="146" cy="48" r="7" fill="currentColor"/><circle cx="164" cy="64" r="7" fill="currentColor" opacity=".6"/><circle cx="128" cy="64" r="7" fill="currentColor" opacity=".6"/><circle cx="146" cy="80" r="7" fill="currentColor" opacity=".35"/></svg>
    <button type="button" class="btn btn--primary hv-play" data-action="game"><span>Play Ember Hunt</span></button>
  </div>`,
  food: `<div class="hv hv-food" aria-hidden="true">
    <div class="hvf-plate"><i></i><i></i><i></i></div>
    <ul class="hvf-orbit">${['🍕', '🍔', '🍜', '🍩', '🍨', '🌮', '🍟', '🥟']
      .map((f, i) => `<li style="--i:${i}">${f}</li>`)
      .join('')}</ul>
  </div>`,
  music: `<div class="hv hv-music" aria-hidden="true">
    <div class="hvm-disc"><i></i></div>
    <div class="hvm-eq" id="hobby-eq">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
    <p class="hvm-now mono"><span>NOW PLAYING</span> mostly Hindi</p>
  </div>`,
  imagination: `<div class="hv hv-imagination" aria-hidden="true">
    <div class="hvi-world">${Array.from({ length: 3 }, (_, i) => `<i class="hvi-orbit" style="--i:${i}"><b></b></i>`).join('')}<span class="hvi-core"></span></div>
    <ul class="hvi-thoughts mono"><li>what if…</li><li>imagine if…</li><li>one day…</li><li>but then…</li></ul>
  </div>`,
  talking: `<div class="hv hv-talking" aria-hidden="true">
    <p class="bubble bubble--them">hey! what are you working on?</p>
    <p class="bubble bubble--me">…oh! just a dragon website :)</p>
    <p class="bubble bubble--them">that’s sick. tell me more</p>
    <p class="bubble bubble--me bubble--typing"><i></i><i></i><i></i></p>
  </div>`,
};

function hobbies() {
  const s = STAGES[1];
  const levels = HOBBIES.map((h) => `<li data-level="${h.rank - 1}"><i></i><span class="mono">LV.${pad(h.rank)}</span></li>`).join('');
  const cards = HOBBIES.map(
    (h) => `<article class="hobby" id="hobby-${h.id}" data-hobby="${h.rank - 1}">
      <div class="hobby-copy">
        <p class="hobby-rank mono"><span>LV.${pad(h.rank)}</span><i>RANK #${h.rank} OF 5</i></p>
        <h3 class="hobby-title">${esc(h.title)}</h3>
        <p class="hobby-hook">${esc(h.hook)}</p>
        ${h.body.map((b) => `<p class="hobby-body">${esc(b)}</p>`).join('')}
        ${chips(h.chips)}
        <div class="hobby-stat"><b>${esc(h.stat.value)}</b><span class="mono">${esc(h.stat.label)}</span></div>
        ${h.id === 'talking' ? `<a class="btn btn--primary" href="#contact" data-goto="6"><span>Start a conversation</span></a>` : ''}
      </div>
      ${HOBBY_VISUALS[h.id] ?? ''}
    </article>`,
  ).join('');
  return `<section ${stageAttrs(s)}>
  ${secHead(s, HOBBIES_INTRO.title, HOBBIES_INTRO.sub, `<p class="sec-note mono">${esc(HOBBIES_INTRO.note)}</p>`)}
  <div class="hobby-pin">
    <div class="hobby-hud mono" aria-hidden="true"><ol class="hobby-levels">${levels}</ol><p class="hobby-xp"><span>XP</span><b><i id="hobby-xp"></i></b></p></div>
    <div class="hobby-track">${cards}</div>
  </div>
</section>`;
}

function skills() {
  const s = STAGES[2];
  const branches = SKILLS.branches
    .map(
      (b, i) => `<article class="branch panel" data-branch="${i}" data-reveal>
      <p class="panel-tag mono"><span>${esc(b.code)}</span><i>${pad(b.items.length)} NODES</i></p>
      <h3>${esc(b.title)}</h3>
      <ul class="nodes">${b.items.map((it, k) => `<li style="--k:${k}"><i aria-hidden="true"></i>${esc(it)}</li>`).join('')}</ul>
    </article>`,
    )
    .join('');
  const arsenal = SKILLS.arsenal
    .map(
      (g) => `<div class="ars-group" data-reveal><p class="mono">${esc(g.group)}</p>${chips(g.items, 'ars-items')}</div>`,
    )
    .join('');
  const all = SKILLS.arsenal.flatMap((g) => g.items);
  const marquee = (offset: number) =>
    `<div class="marquee-row"><div class="marquee-track">${[...all.slice(offset), ...all.slice(0, offset), ...all.slice(offset), ...all.slice(0, offset)]
      .map((t) => `<span>${esc(t)}</span>`)
      .join('<i aria-hidden="true">✦</i>')}</div></div>`;
  return `<section ${stageAttrs(s)}>
  ${secHead(s, SKILLS.title, SKILLS.sub)}
  <div class="skill-tree" id="skill-tree">
    <svg class="skill-wires" aria-hidden="true"></svg>
    <div class="skill-root panel" data-reveal>
      <p class="panel-tag mono"><span>${esc(SKILLS.core.label)}</span><i>∞</i></p>
      <h3>${esc(SKILLS.core.title)}</h3>
      <p>${esc(SKILLS.core.body)}</p>
    </div>
    <div class="branches">${branches}</div>
  </div>
  <div class="arsenal">
    <h3 class="arsenal-title mono" data-reveal>Tech arsenal <i>// ${all.length} tools across my projects</i></h3>
    <div class="ars-grid">${arsenal}</div>
  </div>
  <div class="marquee" aria-hidden="true">${marquee(0)}${marquee(9)}</div>
  <div class="gh-live panel" id="gh-live" data-reveal hidden>
    <p class="panel-tag mono"><span>Live // github.com/kavya-gupta-3</span><i class="gh-dot">ONLINE</i></p>
    <div class="gh-stats mono" id="gh-stats"></div>
    <div class="gh-langs" id="gh-langs"></div>
  </div>
</section>`;
}

function projectCard(p: Project, i: number, featured: boolean) {
  const link = p.url
    ? `<a class="proj-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" data-cursor="OPEN">${esc(p.linkLabel ?? new URL(p.url).hostname.replace(/^www\./, ''))}<i aria-hidden="true">↗</i></a>`
    : '';
  if (!featured) {
    return `<li class="pro-row" style="--h:${p.hue}" data-reveal>
      <span class="pro-idx mono">${pad(i + 1)}</span>
      <span class="pro-name">${esc(p.name)}</span>
      <span class="pro-kind mono">${esc(p.kind)}</span>
      <span class="pro-sum">${esc(p.summary)}</span>
      ${link}
    </li>`;
  }
  return `<article class="proj panel" style="--h:${p.hue}" data-tilt data-reveal>
    <div class="proj-art" aria-hidden="true" data-glyph="${esc(p.glyph)}"><canvas class="proj-canvas" data-seed="${i + 1}" data-hue="${p.hue}"></canvas><span class="proj-glyph">${esc(p.glyph)}</span></div>
    <div class="proj-body">
      <p class="panel-tag mono"><span>P-${hex((i + 1) * 4099, 4)}</span><i>${esc(p.kind)}</i></p>
      <h3>${esc(p.name)}</h3>
      <p class="proj-sum">${esc(p.summary)}</p>
      ${chips(p.tags, 'tags')}
      ${link}
    </div>
  </article>`;
}

function projects() {
  const s = STAGES[3];
  return `<section ${stageAttrs(s)}>
  ${secHead(s, PROJECTS_INTRO.title, PROJECTS_INTRO.sub)}
  <div class="proj-block">
    <h3 class="block-title mono" data-reveal><span>A</span>Personal projects <i>// built for me</i></h3>
    <div class="proj-grid">${PERSONAL_PROJECTS.map((p, i) => projectCard(p, i, true)).join('')}</div>
  </div>
  <div class="proj-block">
    <h3 class="block-title mono" data-reveal><span>B</span>Professional projects <i>// built for clients</i></h3>
    <ol class="pro-list">${PROFESSIONAL_PROJECTS.map((p, i) => projectCard(p, i, false)).join('')}</ol>
  </div>
  <div class="proj-block">
    <h3 class="block-title mono" data-reveal><span>C</span>The vault <i>// more work, no public links</i></h3>
    <ul class="vault">${VAULT.map(
      (v, i) =>
        `<li class="vault-item" data-reveal><span class="mono">V-${pad(i + 1)}</span><h4>${esc(v.name)}</h4><p>${esc(v.body)}</p></li>`,
    ).join('')}</ul>
  </div>
</section>`;
}

function achievements() {
  const s = STAGES[4];
  return `<section ${stageAttrs(s)}>
  ${secHead(s, ACHIEVEMENTS_INTRO.title, ACHIEVEMENTS_INTRO.sub)}
  <div class="ach-grid">${ACHIEVEMENTS.map(
    (a, i) => `<article class="ach panel" data-reveal>
      <p class="panel-tag mono"><span>TROPHY ${pad(i + 1)}</span><i>UNLOCKED</i></p>
      <p class="ach-value" data-count="${a.value}" data-prefix="${esc(a.prefix ?? '')}" data-suffix="${esc(a.suffix ?? '')}">${esc(a.display)}</p>
      <h3>${esc(a.title)}</h3>
      <p class="ach-body">${esc(a.body)}</p>
      <i class="ach-shine" aria-hidden="true"></i>
    </article>`,
  ).join('')}</div>
</section>`;
}

function dreams() {
  const s = STAGES[5];
  return `<section ${stageAttrs(s)}>
  ${secHead(s, DREAMS_INTRO.title, DREAMS_INTRO.sub)}
  <ol class="dreams">${DREAMS.map(
    (d, i) => `<li class="dream dream--${d.id}" data-reveal style="--i:${i}">
      <span class="dream-star" aria-hidden="true"></span>
      <p class="dream-label mono">${esc(d.label)}</p>
      <h3 data-split>${esc(d.title)}</h3>
      <p class="dream-body">${esc(d.body)}</p>
    </li>`,
  ).join('')}</ol>
</section>`;
}

function contact(now: Date) {
  const s = STAGES[6];
  const [user, domain] = CONTACT.email.split('@');
  const socials = CONTACT.socials
    .map(
      (so, i) => `<li><a class="social social--${so.id}" href="${esc(so.url)}" target="_blank" rel="noopener noreferrer me" data-cursor="OPEN">
        <span class="mono">${pad(i + 1)}</span><b>${esc(so.label)}</b><i>${esc(so.handle)}</i><em aria-hidden="true">↗</em></a></li>`,
    )
    .join('');
  return `<section ${stageAttrs(s)}>
  ${secHead(s, CONTACT.title, CONTACT.sub)}
  <div class="contact-grid">
    <div class="contact-main" data-reveal>
      <p class="contact-lead">${esc(CONTACT.lead)}</p>
      <a class="email-big" href="mailto:${esc(user)}&#64;${esc(domain)}" data-email data-cursor="COPY"><span class="mono">Primary channel</span><b>${esc(user)}<i>@</i>${esc(domain)}</b></a>
      <ul class="socials">${socials}</ul>
    </div>
    <form class="contact-form panel" id="contact-form" novalidate data-reveal>
      <p class="panel-tag mono"><span>Transmission // dragon post</span><i id="cf-status">READY</i></p>
      <label class="field"><span class="mono">Your name</span><input name="name" autocomplete="name" required maxlength="80" placeholder="Who is summoning?"></label>
      <label class="field"><span class="mono">Your email</span><input name="email" type="email" autocomplete="email" required maxlength="120" placeholder="Where should I reply?"></label>
      <label class="field"><span class="mono">Message</span><textarea name="message" rows="5" required maxlength="4000" placeholder="Say hi — I mean it."></textarea></label>
      <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
      <button type="submit" class="btn btn--primary btn--wide"><span>Release the dragon</span></button>
      <p class="cf-note mono" id="cf-note" role="status" aria-live="polite"></p>
    </form>
  </div>
  <footer class="site-foot">
    <div class="foot-brand">${sigil({ className: 'foot-mark' })}<p><b>${esc(IDENTITY.name)}</b><span>${esc(IDENTITY.role)} · ${esc(IDENTITY.location)}</span></p></div>
    <p class="foot-built mono">Forged with TypeScript · Three.js · GLSL · GSAP · Lenis · Web Audio · Vercel Edge</p>
    <p class="foot-copy mono">© <span data-bind="year">${now.getFullYear()}</span> ${esc(IDENTITY.name)} — seven dragons, zero timetables.</p>
    <a class="foot-top mono" href="#origin" data-goto="0">Back to the fire ↑</a>
  </footer>
</section>`;
}

/* ---------------------------------------------------------------- overlays */

function overlays() {
  const items = STAGES.map(
    (s) => `<li style="--c1:${s.color};--c2:${s.color2}"><a href="#${s.id}" data-goto="${s.index}">
      <span class="mono">${pad(s.index + 1)}</span><b>${esc(s.label)}</b><i class="mono">${esc(s.dragon)} — ${esc(s.epithet)}</i></a></li>`,
  ).join('');
  return `<div class="menu" id="menu" hidden>
  <div class="menu-inner">
    <p class="menu-k mono">NAVIGATE // 7 SECTORS</p>
    <ol class="menu-list">${items}</ol>
    <ul class="menu-socials mono">${CONTACT.socials
      .map((so) => `<li><a href="${esc(so.url)}" target="_blank" rel="noopener noreferrer">${esc(so.label)} ↗</a></li>`)
      .join('')}</ul>
  </div>
</div>
<div class="cmdk" id="cmdk" hidden role="dialog" aria-modal="true" aria-label="Command palette">
  <div class="cmdk-box">
    <div class="cmdk-input"><span class="mono">&gt;</span><input id="cmdk-input" type="text" placeholder="Type a command or search…" autocomplete="off" spellcheck="false" aria-controls="cmdk-list"></div>
    <ul id="cmdk-list" class="cmdk-list" role="listbox"></ul>
    <p class="cmdk-foot mono"><span>↑↓ navigate</span><span>↵ run</span><span>esc close</span></p>
  </div>
</div>
<div class="game" id="game" hidden role="dialog" aria-modal="true" aria-label="Ember Hunt mini-game">
  <canvas id="game-canvas"></canvas>
  <div class="game-ui mono">
    <p class="game-score">SCORE <b id="game-score">0</b></p>
    <p class="game-best">BEST <b id="game-best">0</b></p>
    <button type="button" class="game-close" data-action="game-close" aria-label="Close game">✕</button>
  </div>
  <div class="game-card" id="game-card">
    <p class="mono">MINI-GAME // EMBER HUNT</p>
    <h3>Feed the wyrm.</h3>
    <p>Steer with your mouse or finger. Eat embers, grow longer, dodge the void mines. Your own tail is fine — it’s a dragon.</p>
    <button type="button" class="btn btn--primary" data-action="game-start"><span>Start</span></button>
  </div>
</div>
<div class="toast mono" id="toast" role="status" aria-live="polite"></div>
<div class="cursor" aria-hidden="true"><i class="cursor-dot"></i><i class="cursor-ring"><span class="cursor-label mono"></span></i></div>`;
}

export function renderBody(now: Date = new Date()): string {
  return [
    loader(),
    hud(),
    `<main id="main">`,
    origin(now),
    hobbies(),
    skills(),
    projects(),
    achievements(),
    dreams(),
    contact(now),
    `</main>`,
    overlays(),
  ].join('\n');
}

/** JSON-LD for search engines. */
export function personSchema(siteUrl: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: IDENTITY.name,
    url: siteUrl,
    jobTitle: IDENTITY.role,
    affiliation: { '@type': 'CollegeOrUniversity', name: `${PROGRAMME.college} (${PROGRAMME.university})` },
    sameAs: CONTACT.socials.map((s) => s.url),
    knowsAbout: SKILLS.branches.flatMap((b) => b.items).slice(0, 20),
  });
}
