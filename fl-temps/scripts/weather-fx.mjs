/**
 * Effets visuels de la météo : nuages, pluie, neige, brouillard, feuilles, poussière et éclairs.
 * Chaque météo est une « ambiance » indépendante : quand la météo change, l'ancienne s'efface en fondu
 * pendant que la nouvelle apparaît (pas de coupure).
 */
const MOD = "fl-temps";
const TEX = (n) => `modules/${MOD}/assets/meteo/${n}.png`;
const FADE_MS = 3000; // durée du fondu enchaîné entre deux météos

const textures = {};
let active = null;   // ambiance en cours
let fading = [];     // ambiances en train de s'effacer
let current = "";    // signature de la météo affichée
let flashEl = null;
let building = null; // construction en cours (évite les doublons)
let strikeListener = null;

/** Fonction appelée à chaque éclair (pour le tonnerre). */
export function setStrikeListener(fn) { strikeListener = fn; }

async function tex(name) {
  if (textures[name]) return textures[name];
  const load = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
  textures[name] = await load(TEX(name));
  return textures[name];
}

/** Facteur de zoom : la pluie et la neige grossissent quand on zoome sur la carte. */
function zoomFactor() {
  const sc = canvas.stage?.scale?.x || 1;
  return Math.min(2.2, Math.max(0.75, Math.sqrt(sc)));
}

/** Rectangle de la carte (scène) en coordonnées du monde. */
function sceneRect() {
  const r = canvas.dimensions?.sceneRect ?? canvas.dimensions?.rect;
  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 4000, height: 3000 };
}

/** Multiplie deux teintes (0xRRGGBB). */
function mulTint(a, b) {
  const ch = (c, sh) => ((c >> sh) & 255) / 255;
  const r = Math.round(ch(a, 16) * ch(b, 16) * 255), g = Math.round(ch(a, 8) * ch(b, 8) * 255), bl = Math.round(ch(a, 0) * ch(b, 0) * 255);
  return (r << 16) | (g << 8) | bl;
}
const ADD = () => PIXI.BLEND_MODES?.ADD ?? "add";

function screen() {
  const r = canvas.app.renderer.screen;
  return { w: r.width, h: r.height };
}

function ensureFlash() {
  if (flashEl?.isConnected) return flashEl;
  flashEl = document.createElement("div");
  flashEl.id = "flt-flash";
  const board = document.getElementById("board");
  if (board) board.insertAdjacentElement("afterend", flashEl);
  else document.body.prepend(flashEl);
  return flashEl;
}

/* -------------------------------------------- */
/*  Une ambiance météo                          */
/* -------------------------------------------- */

class Ambience {
  constructor(fx) {
    this.fx = fx;
    this.parts = [];
    this.fog = [];
    this.clouds = [];
    this.opacity = 0;        // fondu global (0 → 1 à l'apparition, 1 → 0 à la disparition)
    this.target = 1;
    this.nextBolt = 6000 + Math.random() * 10000;
    this.dead = false;
    // couche « écran » (pluie, neige, feuilles, brouillard, éclairs)
    this.layer = new PIXI.Container();
    this.layer.eventMode = "none";
    this.layer.interactiveChildren = false;
    // couche « carte » (nuages et leurs ombres)
    this.cloudLayer = new PIXI.Container();
    this.cloudLayer.eventMode = "none";
    canvas.stage.addChild(this.cloudLayer);
    canvas.stage.addChild(this.layer);
    this.layer.alpha = 0; this.cloudLayer.alpha = 0;
    this.pin();
  }

  get alive() {
    return !this.dead && !!this.layer.parent && !this.layer.destroyed;
  }

  /** Garde la couche écran collée à l'écran malgré le déplacement et le zoom de la carte. */
  pin() {
    const st = canvas.stage;
    const sx = st.scale.x || 1, sy = st.scale.y || 1;
    this.layer.scale.set(1 / sx, 1 / sy);
    this.layer.position.set(st.pivot.x - st.position.x / sx, st.pivot.y - st.position.y / sy);
  }

  async build() {
    const fx = this.fx;
    const { w, h } = screen();
    const windX = [0, 1.2, 3.5, 7][fx.wind] ?? 0;
    this.windX = windX;
    const L = this.layer;

    // Nuages (inspirés de FXMaster) avec ombre portée
    if (fx.clouds) {
      this.cloudTextures = await Promise.all([0, 1, 2, 3].map((k) => tex(`nuage${k}`)));
      this.cloudCfg = {
        dense: fx.clouds === 2, storm: !!fx.storm,
        speed: [[20, 50], [30, 80], [60, 140], [120, 240]][fx.wind] ?? [30, 80],
        count: fx.clouds === 2 ? 28 : 18
      };
      const R = sceneRect();
      for (let i = 0; i < this.cloudCfg.count; i++) this.spawnCloud(R, true);
    }

    // Pluie ou neige
    if (fx.precip >= 2) {
      const snow = fx.snow;
      const n = snow ? (fx.precip === 3 ? 380 : 140) : (fx.storm ? 750 : fx.precip === 3 ? 520 : 170);
      const t = await tex(snow ? "flocon" : "goutte");
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5);
        const depth = 0.4 + Math.random() * 0.6;
        let bx, by;
        if (snow) { bx = by = (0.35 + Math.random() * 0.5) * depth; s.alpha = 0.65 + 0.35 * depth; }
        else { bx = 0.9 * depth; by = (0.7 + Math.random() * 0.5) * depth; s.alpha = 0.45 + 0.4 * depth; s.rotation = -Math.atan2(windX * 1.6, 18); }
        s.scale.set(bx, by);
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: snow ? "snow" : "rain", bx, by, phase: Math.random() * 6.28,
          vy: snow ? (0.8 + 1.2 * depth) * (fx.precip === 3 ? 1.4 : 1) : (14 + 10 * depth), vx: snow ? windX * 0.6 : windX * 1.6 });
      }
    }

    // Feuilles de saison portées par le vent
    if (fx.leaves) {
      const season = fx.season ?? "automne";
      const count = { printemps: 4, ete: 4, automne: 5, hiver: 2 }[season] ?? 3;
      const ts = await Promise.all([...Array(count).keys()].map((k) => tex(`feuille_${season}${k}`)));
      for (let i = 0; i < fx.leaves; i++) {
        const s = new PIXI.Sprite(ts[Math.floor(Math.random() * ts.length)]);
        s.anchor.set(0.5); s.scale.set(0.3 + Math.random() * 0.3); s.alpha = 0.95;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "leaf", phase: Math.random() * 6.28, vx: 1.5 + windX * 1.1 + Math.random() * 2, vy: 0.5 + Math.random(), spin: (Math.random() - 0.5) * (0.04 + windX * 0.015) });
      }
    }
    // Brindilles arrachées par les rafales : plus lourdes, elles tournoient vite
    if (fx.twigs) {
      const ts = await Promise.all([0, 1, 2].map((k) => tex(`brindille${k}`)));
      for (let i = 0; i < fx.twigs; i++) {
        const s = new PIXI.Sprite(ts[i % 3]);
        s.anchor.set(0.5); s.scale.set(0.45 + Math.random() * 0.35); s.alpha = 0.95;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "leaf", phase: Math.random() * 6.28, vx: 2.5 + windX * 1.3 + Math.random() * 2, vy: 1.2 + Math.random() * 1.2, spin: (Math.random() < 0.5 ? -1 : 1) * (0.08 + windX * 0.02) });
      }
    }

    // Pollen du printemps : petits points dorés qui flottent et scintillent
    if (fx.pollen) {
      const t = await tex("pollen");
      for (let i = 0; i < fx.pollen; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(0.15 + Math.random() * 0.25);
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "pollen", phase: Math.random() * 6.28, base: 0.45 + Math.random() * 0.4,
          vx: 0.25 + windX * 0.5 + Math.random() * 0.4, vy: (Math.random() - 0.6) * 0.3 });
      }
    }

    // Akènes de pissenlit (prés) ou duvet de massette (marais) : légers, ils planent
    if (fx.seeds) {
      const t = await tex("akene");
      const duvet = fx.seedKind === "duvet";
      for (let i = 0; i < fx.seeds; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(duvet ? 0.5 + Math.random() * 0.3 : 0.35 + Math.random() * 0.3);
        if (duvet) s.tint = 0xe2d4b4;
        s.alpha = 0.9; s.rotation = (Math.random() - 0.5) * 0.6;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "seed", phase: Math.random() * 6.28, vx: 0.5 + windX * 0.9 + Math.random() * 0.6, vy: (Math.random() - 0.3) * 0.4 });
      }
    }

    // Lucioles : soirs et nuits d'été, elles errent et clignotent
    if (fx.fireflies) {
      const t = await tex("pollen");
      for (let i = 0; i < fx.fireflies; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(0.35 + Math.random() * 0.3); s.tint = 0xd4ff66; s.blendMode = ADD(); s.alpha = 0;
        s.x = Math.random() * w; s.y = h * (0.15 + Math.random() * 0.85);
        L.addChild(s);
        this.parts.push({ s, kind: "firefly", glow: true, phase: Math.random() * 6.28, speed: 0.01 + Math.random() * 0.025, ang: Math.random() * 6.28 });
      }
    }

    // Moucherons : deux ou trois essaims qui dansent au bord de l'eau
    if (fx.midges) {
      const t = await tex("moucheron");
      const swarms = [...Array(2 + Math.floor(Math.random() * 2))].map(() => ({ x: Math.random() * w, y: h * (0.3 + Math.random() * 0.6), vx: 0.15 + windX * 0.3, phase: Math.random() * 6 }));
      this.swarms = swarms;
      for (let i = 0; i < fx.midges; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(0.5 + Math.random() * 0.4); s.alpha = 0.85;
        const sw = swarms[i % swarms.length];
        L.addChild(s);
        this.parts.push({ s, kind: "midge", sw, ox: (Math.random() - 0.5) * 60, oy: (Math.random() - 0.5) * 40 });
      }
    }

    // Givre scintillant : cristaux en suspension, les matins d'hiver glacés
    if (fx.sparkles) {
      const t = await tex("cristal");
      for (let i = 0; i < fx.sparkles; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(0.15 + Math.random() * 0.25); s.blendMode = ADD(); s.alpha = 0;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "sparkle", glow: true, phase: Math.random() * 6.28, speed: 0.01 + Math.random() * 0.03, vx: 0.1 + windX * 0.2, vy: 0.12 + Math.random() * 0.15 });
      }
    }

    // Embruns sur le lac
    if (fx.spray) {
      const t = await tex("flocon");
      for (let i = 0; i < fx.spray; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); s.scale.set(0.12 + Math.random() * 0.15); s.tint = 0xd6e8ff; s.alpha = 0.5;
        s.x = Math.random() * w; s.y = h * (0.4 + Math.random() * 0.6);
        L.addChild(s);
        this.parts.push({ s, kind: "dust", phase: Math.random() * 6.28, vx: 3 + windX * 2 + Math.random() * 3, vy: (Math.random() - 0.2) * 0.8 });
      }
    }

    // Poudrerie (neige soulevée) et poussière
    if (fx.drift || fx.dust) {
      const t = await tex(fx.drift ? "flocon" : "poussiere");
      const n = fx.drift ? (fx.drift === true ? 130 : fx.drift) : 90;
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5);
        s.scale.set(fx.drift ? 0.2 + Math.random() * 0.35 : 0.6 + Math.random() * 1.2);
        s.alpha = fx.drift ? 0.7 : 0.35;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "dust", phase: Math.random() * 6.28,
          vx: fx.drift ? 1.5 + windX * 1.8 + Math.random() * 3 : 3 + windX + Math.random() * 3,
          vy: fx.drift ? (Math.random() - 0.3) * 1.2 : (Math.random() - 0.5) * 0.6 });
      }
    }

    // Brouillard
    if (fx.fog) {
      const t = await tex("brume");
      const n = fx.fog === 2 ? 14 : 7;
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5);
        s.scale.set((w / 512) * (0.9 + Math.random() * 0.8));
        s.alpha = fx.fog === 2 ? 0.55 : 0.32;
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.fog.push({ s, vx: 0.15 + Math.random() * 0.35 + windX * 0.1, base: s.alpha, phase: Math.random() * 6.28 });
      }
    }

    if (fx.storm) for (let k = 0; k < 4; k++) await tex(`eclair${k}`);

    await this.buildSky(w, h, windX);

    // lumière du moment : rosée le matin, dorée le soir, bleutée la nuit
    if (fx.tint && fx.tint !== 0xffffff) {
      for (const p of this.parts) if (!p.glow) p.s.tint = mulTint(p.s.tint ?? 0xffffff, fx.tint);
      for (const g of this.fog) g.s.tint = mulTint(0xffffff, fx.tint);
    }

    this.tick = this.tick.bind(this);
    canvas.app.ticker.add(this.tick);
  }

  /** Le ciel : grêle, arc-en-ciel, rayons de soleil, aurores, étoiles filantes, éclipse. */
  async buildSky(w, h, windX) {
    const fx = this.fx, L = this.layer;
    this.sky = {};

    // Grêle : billes de glace qui tombent vite et rebondissent
    if (fx.hail) {
      const t = await tex("grelon");
      for (let i = 0; i < 230; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5); const d = 0.5 + Math.random() * 0.5; s.scale.set(0.35 + 0.45 * d);
        s.x = Math.random() * w; s.y = Math.random() * h;
        L.addChild(s);
        this.parts.push({ s, kind: "hail", vy: 15 + 9 * d, vy0: 15 + 9 * d, vx: windX * 1.2, stop: h * (0.25 + Math.random() * 0.8) });
      }
    }

    // Rayons de soleil (à travers les feuillages ou les trouées des nuages)
    if (fx.rays) {
      const t = await tex("rayon");
      const n = 5 + Math.floor(Math.random() * 3);
      this.sky.rays = [];
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(t);
        s.anchor.set(0.5, 0); s.blendMode = ADD();
        s.rotation = -0.35 + (Math.random() - 0.5) * 0.12;
        s.x = w * (0.05 + 0.9 * (i + Math.random() * 0.6) / n); s.y = -h * 0.05;
        s.scale.set((w / 256) * (0.08 + Math.random() * 0.1), (h * 1.25) / 1024);
        s.tint = mulTint(0xfff3d6, fx.tint ?? 0xffffff);
        s.alpha = 0;
        L.addChild(s);
        this.sky.rays.push({ s, phase: Math.random() * 6.28, speed: 0.0003 + Math.random() * 0.0004, peak: 0.22 * fx.rays * (0.6 + Math.random() * 0.4) });
      }
    }

    // Arc-en-ciel : apparaît quand la pluie cesse, reste un moment puis s'efface
    if (fx.rainbow) {
      const t = await tex("arc_en_ciel");
      const s = new PIXI.Sprite(t);
      s.anchor.set(0.5, 0);
      const sc = (w * (0.7 + Math.random() * 0.25)) / 1024;
      s.scale.set(sc); s.x = w * (0.3 + Math.random() * 0.4); s.y = h * 0.04; s.alpha = 0;
      L.addChild(s);
      this.sky.rainbow = { s, t: 0, peak: 0.6 };
    }

    // Aurore boréale : un rideau vert et violet qui ondule en haut de l'écran
    if (fx.aurora) {
      const t = await tex("aurore");
      if (t.baseTexture) t.baseTexture.wrapMode = PIXI.WRAP_MODES?.REPEAT ?? 10497;
      this.sky.aurora = [];
      for (let k = 0; k < 2; k++) {
        const s = new PIXI.TilingSprite(t, w, h * 0.55);
        s.blendMode = ADD(); s.alpha = 0;
        s.tileScale.set(k ? 1.6 : 1.1, (h * 0.55) / 400);
        s.y = k ? h * 0.02 : 0;
        L.addChild(s);
        this.sky.aurora.push({ s, speed: (k ? -0.12 : 0.18), phase: Math.random() * 6.28, peak: k ? 0.35 : 0.55 });
      }
    }

    // Étoiles filantes
    if (fx.stars) {
      this.sky.starTex = await tex("filante");
      this.sky.nextStar = 3000 + Math.random() * 8000;
      this.sky.starRate = fx.stars;
      this.sky.shooting = [];
    }

    // Éclipse : le jour s'assombrit (soleil) ou la lune se teinte de sang
    if (fx.eclipse) {
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.width = w; s.height = h; s.alpha = 0;
      if (fx.eclipse === "solaire") { s.tint = 0x0a0c18; this.sky.eclipsePeak = 0.55; }
      else { s.tint = 0x7a1408; s.blendMode = PIXI.BLEND_MODES?.MULTIPLY ?? "multiply"; this.sky.eclipsePeak = 0.6; }
      L.addChildAt(s, 0);
      this.sky.eclipse = { s, t: 0 };
    }
  }

  tickSky(dt, W, H) {
    const sky = this.sky;
    if (!sky) return;
    if (sky.rays) for (const r of sky.rays) { r.phase += r.speed * dt; r.s.alpha = r.peak * (0.55 + 0.45 * Math.sin(r.phase)); }
    if (sky.rainbow) {
      const rb = sky.rainbow; rb.t += dt;
      const k = rb.t / 1000; // en secondes : 10 s d'apparition, 80 s de pleine couleur, 25 s d'effacement
      rb.s.alpha = rb.peak * (k < 10 ? k / 10 : k < 90 ? 1 : Math.max(0, 1 - (k - 90) / 25));
    }
    if (sky.aurora) for (const a of sky.aurora) {
      a.phase += 0.0004 * dt;
      a.s.tilePosition.x += a.speed * dt / 16.67;
      a.s.width = W;
      a.s.alpha = a.peak * (0.6 + 0.4 * Math.sin(a.phase)) * (0.85 + 0.15 * Math.sin(a.phase * 3.7));
    }
    if (sky.starTex && this.target > 0) {
      sky.nextStar -= dt;
      if (sky.nextStar <= 0) {
        sky.nextStar = (12000 + Math.random() * 30000) / sky.starRate;
        const s = new PIXI.Sprite(sky.starTex);
        s.anchor.set(1, 0.5); s.blendMode = ADD();
        const ang = 0.25 + Math.random() * 0.5, dir = Math.random() < 0.5 ? 1 : -1;
        s.rotation = dir > 0 ? ang : Math.PI - ang;
        s.scale.set(0.5 + Math.random() * 0.6, 0.7);
        s.x = W * (0.1 + Math.random() * 0.8); s.y = H * (0.03 + Math.random() * 0.35);
        this.layer.addChild(s);
        sky.shooting.push({ s, t: 0, life: 500 + Math.random() * 500, v: (0.9 + Math.random() * 0.8) * W / 1000, ang: s.rotation });
      }
    }
    if (sky.shooting) for (let i = sky.shooting.length - 1; i >= 0; i--) {
      const st = sky.shooting[i]; st.t += dt;
      st.s.x += Math.cos(st.ang) * st.v * dt; st.s.y += Math.sin(st.ang) * st.v * dt;
      const k = st.t / st.life;
      st.s.alpha = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85);
      if (k >= 1) { st.s.destroy(); sky.shooting.splice(i, 1); }
    }
    if (sky.eclipse) {
      const e = sky.eclipse; e.t += dt;
      e.s.width = W; e.s.height = H;
      e.s.alpha = sky.eclipsePeak * Math.min(1, e.t / 8000); // l'ombre gagne en 8 s
    }
  }

  /** Crée un nuage et son ombre. initial = n'importe où sur la carte, sinon il entre par l'ouest. */
  spawnCloud(R, initial = false) {
    const cfg = this.cloudCfg;
    const t = this.cloudTextures[Math.floor(Math.random() * this.cloudTextures.length)];
    const grid = canvas.dimensions?.size ?? 100;
    const width = Math.max(grid * 3, R.width * (0.06 + Math.random() * 0.24));
    const sc = width / 768;
    const flip = Math.random() < 0.5 ? -1 : 1;
    const rot = (Math.random() - 0.5) * 0.5;
    const shadow = new PIXI.Sprite(t);
    shadow.anchor.set(0.5); shadow.scale.set(sc * flip, sc * 0.9); shadow.rotation = rot;
    shadow.tint = 0x000000; shadow.alpha = 0;
    const cloud = new PIXI.Sprite(t);
    cloud.anchor.set(0.5); cloud.scale.set(sc * flip, sc * 0.9); cloud.rotation = rot;
    cloud.tint = mulTint(cfg.storm ? 0x8d939c : cfg.dense ? 0xc4c9d0 : 0xffffff, this.fx.tint ?? 0xffffff);
    cloud.alpha = 0;
    this.cloudLayer.addChild(shadow);
    this.cloudLayer.addChild(cloud);
    const [vmin, vmax] = cfg.speed;
    const v = vmin + Math.random() * (vmax - vmin);
    const angle = (Math.random() - 0.5) * 0.35;
    const life = (R.width + width * 2) / v;
    const c = {
      cloud, shadow, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life, age: initial ? Math.random() * life : 0,
      peak: cfg.dense ? 0.95 : 0.85, shadowPeak: cfg.dense ? 0.6 : 0.5, offset: grid * (1 + width / R.width * 6)
    };
    cloud.x = R.x - width + c.vx * c.age; cloud.y = R.y + Math.random() * R.height;
    this.clouds.push(c);
  }

  tick() {
    if (this.dead) return;
    if (!this.layer.parent || this.layer.destroyed) return this.destroy();
    const dt = Math.min(canvas.app.ticker.deltaMS, 50);
    const f = dt / 16.67;
    const { w: W, h: H } = screen();

    // fondu enchaîné
    const step = dt / FADE_MS;
    this.opacity = this.target > this.opacity ? Math.min(this.target, this.opacity + step) : Math.max(this.target, this.opacity - step);
    this.layer.alpha = this.opacity; this.cloudLayer.alpha = this.opacity;
    if (this.target === 0 && this.opacity <= 0) return this.destroy();

    this.pin();
    const st = canvas.stage, kids = st.children;
    if (this === active && kids[kids.length - 1] !== this.layer) { st.removeChild(this.cloudLayer); st.addChild(this.cloudLayer); st.removeChild(this.layer); st.addChild(this.layer); }

    this.tickSky(dt, W, H);
    const zf = zoomFactor();
    this._frame = (this._frame ?? 0) + 1;
    for (const p of this.parts) {
      const s = p.s;
      if (p.bx) s.scale.set(p.bx * zf, p.by * zf);
      if (p.kind === "rain") { s.x += p.vx * f; s.y += p.vy * f; }
      else if (p.kind === "snow") { p.phase += 0.02 * f; s.x += (p.vx + Math.sin(p.phase) * 0.6) * f; s.y += p.vy * f; }
      else if (p.kind === "hail") {
        s.x += p.vx * f; s.y += p.vy * f;
        if (!p.bounced && s.y >= p.stop) { p.bounced = true; p.vy = -p.vy0 * 0.22; s.alpha = 0.8; }
        else if (p.bounced) { p.vy += 1.4 * f; s.alpha -= 0.05 * f; if (s.alpha <= 0) { p.bounced = false; p.vy = p.vy0; s.alpha = 1; s.y = -10; s.x = Math.random() * W; p.stop = H * (0.25 + Math.random() * 0.8); } }
        continue;
      }
      else if (p.kind === "seed") { p.phase += 0.015 * f; s.x += (p.vx + Math.sin(p.phase) * 0.3) * f; s.y += (p.vy + Math.sin(p.phase * 1.7) * 0.25) * f; s.rotation = Math.sin(p.phase) * 0.35; }
      else if (p.kind === "firefly") {
        p.phase += p.speed * f; p.ang += (Math.random() - 0.5) * 0.15 * f;
        s.x += Math.cos(p.ang) * 0.45 * f; s.y += Math.sin(p.ang) * 0.3 * f;
        s.alpha = Math.pow(Math.max(0, Math.sin(p.phase)), 6) * 0.95;
      }
      else if (p.kind === "midge") {
        const sw = p.sw;
        if (sw._t !== this._frame) { sw._t = this._frame; sw.phase += 0.01 * f; sw.x += (sw.vx + Math.sin(sw.phase) * 0.3) * f; sw.y += Math.cos(sw.phase * 0.7) * 0.2 * f; if (sw.x > W + 60) sw.x = -60; }
        p.ox = Math.max(-40, Math.min(40, p.ox + (Math.random() - 0.5) * 4 * f));
        p.oy = Math.max(-28, Math.min(28, p.oy + (Math.random() - 0.5) * 4 * f));
        s.x = sw.x + p.ox; s.y = sw.y + p.oy;
        continue;
      }
      else if (p.kind === "sparkle") { p.phase += p.speed * f; s.x += p.vx * f; s.y += p.vy * f; s.alpha = Math.pow(Math.max(0, Math.sin(p.phase)), 8); }
      else if (p.kind === "pollen") { p.phase += 0.02 * f; s.x += (p.vx + Math.sin(p.phase * 0.7) * 0.4) * f; s.y += (p.vy + Math.cos(p.phase) * 0.35) * f; s.alpha = p.base * (0.6 + 0.4 * Math.sin(p.phase * 3)); }
      else if (p.kind === "leaf") { p.phase += 0.05 * f; s.x += p.vx * f; s.y += (p.vy + Math.sin(p.phase) * 1.2) * f; s.rotation += p.spin * f; }
      else { p.phase += 0.03 * f; s.x += p.vx * f; s.y += (p.vy + Math.sin(p.phase) * 0.4) * f; }
      if (s.y > H + 20) { s.y = -20; s.x = Math.random() * W; }
      if (s.y < -40) { s.y = H + 30; s.x = Math.random() * W; }
      if (s.x > W + 30) { s.x = -30; s.y = Math.random() * H; }
      if (s.x < -30) s.x = W + 30;
    }

    if (this.clouds.length) {
      const R = sceneRect();
      const dts = dt / 1000;
      for (let i = this.clouds.length - 1; i >= 0; i--) {
        const c = this.clouds[i];
        c.age += dts;
        c.cloud.x += c.vx * dts; c.cloud.y += c.vy * dts;
        c.shadow.x = c.cloud.x + c.offset; c.shadow.y = c.cloud.y + c.offset; // ombre vers le sud-est
        const t = c.age / c.life;
        const env = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1;
        c.cloud.alpha = c.peak * env;
        c.shadow.alpha = c.shadowPeak * env;
        if (t >= 1) {
          c.cloud.destroy(); c.shadow.destroy();
          this.clouds.splice(i, 1);
          if (this.target > 0) this.spawnCloud(R); // une ambiance qui s'efface ne crée plus de nuages
        }
      }
    }

    for (const g of this.fog) {
      g.phase += 0.004 * f;
      g.s.x += g.vx * f;
      g.s.alpha = g.base * (0.8 + 0.2 * Math.sin(g.phase));
      if (g.s.x - Math.abs(g.s.width) / 2 > W) { g.s.x = -Math.abs(g.s.width) / 2; g.s.y = Math.random() * H; }
    }

    // Éclairs : 2 à 4 par minute au maximum, à intervalles aléatoires (pas pendant le fondu de sortie)
    if (this.fx.storm && this.target > 0) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.strike();
        if (Math.random() < 0.25) setTimeout(() => this.strike(), 250 + Math.random() * 400);
        this.nextBolt = 15000 + Math.random() * 15000;
      }
    }
  }

  /** Un éclair : trait de foudre + grand flash lumineux. */
  strike() {
    if (!this.alive) return;
    try { strikeListener?.(); } catch { /* rien */ }
    const { w, h } = screen();
    const t = textures[`eclair${Math.floor(Math.random() * 4)}`];
    if (t) {
      const s = new PIXI.Sprite(t);
      s.anchor.set(0.5, 0);
      const sc = (h * (0.6 + Math.random() * 0.4)) / t.height;
      s.scale.set(sc * (Math.random() < 0.5 ? -1 : 1), sc);
      s.x = w * (0.1 + Math.random() * 0.8); s.y = 0;
      this.layer.addChild(s);
      let life = 0;
      const fade = () => {
        life += canvas.app.ticker.deltaMS;
        s.alpha = life < 120 ? 1 : life < 200 ? 0.3 : life < 280 ? 0.9 : Math.max(0, 0.9 - (life - 280) / 450);
        if (s.alpha <= 0 || s.destroyed) { canvas.app.ticker.remove(fade); if (!s.destroyed) s.destroy(); }
      };
      canvas.app.ticker.add(fade);
    }
    const el = ensureFlash();
    const peak = 0.6 * this.opacity;
    el.style.transition = "none";
    el.style.opacity = String(peak);
    requestAnimationFrame(() => {
      setTimeout(() => { el.style.opacity = String(peak * 0.25); }, 90);
      setTimeout(() => { el.style.opacity = String(peak * 0.75); }, 170);
      setTimeout(() => { el.style.transition = "opacity .7s ease-out"; el.style.opacity = "0"; }, 240);
    });
  }

  fadeOut() {
    this.target = 0;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    canvas?.app?.ticker?.remove(this.tick);
    if (!this.layer.destroyed) this.layer.destroy({ children: true });
    if (!this.cloudLayer.destroyed) this.cloudLayer.destroy({ children: true });
    fading = fading.filter((a) => a !== this);
    if (active === this) active = null;
  }
}

/* -------------------------------------------- */
/*  API                                         */
/* -------------------------------------------- */

/** Coupe tout immédiatement (changement de scène, etc.). */
export function clearWeatherFx() {
  for (const a of [active, ...fading]) a?.destroy();
  active = null; fading = []; current = "";
}

/**
 * Applique un état visuel, avec fondu enchaîné depuis l'état précédent.
 * @param {object|null} fx description de la météo visible, ou null pour tout effacer (en fondu)
 * @param {object} opts { instant: true } pour couper sans fondu
 */
export async function setWeatherFx(fx, { instant = false } = {}) {
  if (!canvas?.ready) return;
  const sig = fx ? JSON.stringify(fx) : "";
  if (sig === current && (!active || active.alive)) return;
  current = sig;
  const old = active;
  active = null;
  if (old) {
    if (instant) old.destroy();
    else { old.fadeOut(); fading.push(old); }
  }
  if (!fx) return;
  // la pluie cesse (et il fait jour) : un arc-en-ciel apparaît
  const prevFx = old?.fx;
  if (prevFx && prevFx.precip >= 2 && !prevFx.snow && fx.precip <= 1 && fx.quarter !== 3 && !fx.rainbow) fx = { ...fx, rainbow: true };
  const amb = new Ambience(fx);
  active = amb;
  const job = amb.build();
  building = job;
  await job;
  if (active !== amb && !fading.includes(amb)) amb.destroy(); // une autre météo a été demandée entre-temps
  if (instant) amb.opacity = 1;
}
