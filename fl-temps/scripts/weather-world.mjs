/**
 * Effets « sur le monde » : le sol (neige qui s'accumule, sol mouillé, givre, traces de pas),
 * les personnages (buée par grand froid, torches qui vacillent au vent),
 * et la carte elle-même (couleurs de saison, air qui tremble sous la chaleur).
 * Contrairement aux ambiances météo, ces effets évoluent en douceur et ne sont jamais coupés d'un coup.
 */
const MOD = "fl-temps";
const TEX = (n) => `modules/${MOD}/assets/meteo/${n}.png`;
const textures = {};
async function tex(name) {
  if (textures[name]) return textures[name];
  const load = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
  textures[name] = await load(TEX(name));
  return textures[name];
}

let state = null;          // état demandé
let built = null;          // objets PIXI en place
let tickerFn = null;
const lastPos = new Map(); // id du jeton -> position avant déplacement (vue avant la mise à jour)
const known = new Map();   // id du jeton -> dernière position connue (sur chaque ordinateur)
const breathAt = new Map();

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const approach = (cur, target, step) => cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);

function sceneRect() {
  const r = canvas.dimensions?.sceneRect ?? canvas.dimensions?.rect;
  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 4000, height: 3000 };
}
const grid = () => canvas.dimensions?.size ?? 100;
const BLEND = (k) => PIXI.BLEND_MODES?.[k] ?? k.toLowerCase();

/* -------------------------------------------- */
/*  Construction                                */
/* -------------------------------------------- */

async function build() {
  if (!canvas?.ready) return null;
  const R = sceneRect();
  const b = { ground: new PIXI.Container(), prints: new PIXI.Container(), air: new PIXI.Container(), puffs: [], cur: { cover: 0, veil: 0, wet: 0, frost: 0 } };
  const g = b.ground;
  g.eventMode = "none"; b.air.eventMode = "none";
  // la couche du sol se range juste au-dessus de la carte, sous les tuiles et les jetons
  g.elevation = 0; g.sortLayer = 100; g.sort = 0; g.zIndex = 0;
  const tiling = async (name, alpha = 0) => {
    const t = await tex(name);
    if (t.baseTexture) t.baseTexture.wrapMode = PIXI.WRAP_MODES?.REPEAT ?? 10497;
    const s = new PIXI.TilingSprite(t, R.width, R.height);
    s.position.set(R.x, R.y); s.tileScale.set(1.5); s.alpha = alpha;
    g.addChild(s);
    return s;
  };
  b.wet = await tiling("mouille"); b.wet.blendMode = BLEND("MULTIPLY");
  b.snow = await tiling("neige_sol");
  b.veil = await tiling("neige_voile"); b.veil.tileScale.set(2.2);
  b.frost = await tiling("givre"); b.frost.tileScale.set(1);
  g.addChild(b.prints);
  const parent = canvas.primary ?? canvas.stage;
  parent.addChild(g);
  if (canvas.primary) canvas.primary.sortDirty = true;
  // l'air (buée) se dessine au-dessus des jetons
  canvas.stage.addChild(b.air);
  b.printTex = await tex("pas"); b.pawTex = await tex("patte"); b.puffTex = await tex("souffle");

  // filtres posés sur la carte : couleurs de saison et chaleur
  const CMF = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
  if (CMF) { b.grade = new CMF(); b.gradeM = identity(); }
  const DF = PIXI.DisplacementFilter ?? PIXI.filters?.DisplacementFilter;
  if (DF) {
    const ht = await tex("chaleur");
    if (ht.baseTexture) ht.baseTexture.wrapMode = PIXI.WRAP_MODES?.REPEAT ?? 10497;
    b.heatSprite = new PIXI.Sprite(ht); b.heatSprite.renderable = false; b.heatSprite.scale.set(4);
    b.air.addChild(b.heatSprite);
    b.heat = new DF(b.heatSprite, 0); b.heatK = 0;
  }
  return b;
}

function destroy() {
  if (!built) return;
  try {
    removeFilter(built.grade); removeFilter(built.heat);
    built.ground.destroy({ children: true });
    built.air.destroy({ children: true });
  } catch { /* scène déjà détruite */ }
  built = null;
}

/* -------------------------------------------- */
/*  Couleurs de saison                          */
/* -------------------------------------------- */

const identity = () => [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const SEASON_GRADE = {
  printemps: { s: 1.12, g: [0.98, 1.04, 0.97], b: 0.01 },
  ete: { s: 1.06, g: [1.05, 1.02, 0.93], b: 0.02 },
  automne: { s: 0.97, g: [1.07, 0.98, 0.87], b: 0 },
  hiver: { s: 0.72, g: [0.95, 0.99, 1.07], b: 0.01 }
};

function gradeMatrix(season, cover) {
  const p = SEASON_GRADE[season] ?? { s: 1, g: [1, 1, 1], b: 0 };
  const s = p.s * (1 - 0.3 * cover);
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  const sr = (1 - s) * lr, sg = (1 - s) * lg, sb = (1 - s) * lb;
  const sat = [[sr + s, sg, sb], [sr, sg + s, sb], [sr, sg, sb + s]];
  const off = p.b + 0.06 * cover;
  const m = identity();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) m[i * 5 + j] = sat[i][j] * p.g[i];
    m[i * 5 + 4] = off;
  }
  return m;
}

function addFilter(f) {
  const P = canvas.primary;
  if (!P || !f) return;
  const list = P.filters ?? [];
  if (!list.includes(f)) P.filters = [...list, f];
}
function removeFilter(f) {
  const P = canvas?.primary;
  if (!P?.filters || !f) return;
  const list = P.filters.filter((x) => x !== f);
  P.filters = list.length ? list : null;
}

/* -------------------------------------------- */
/*  Animation                                   */
/* -------------------------------------------- */

const TORCH_TYPES = new Set(["torch", "flame", "fire", "candlelight", "smokepatch"]);
const torchBase = new WeakMap();
let torchClock = 0;

function tick() {
  if (!built || !state) return;
  if (built.ground.destroyed) { built = null; return; }
  const dt = Math.min(canvas.app.ticker.deltaMS, 50);
  const step = dt / 2500; // les transitions durent environ 2,5 s
  const st = state, c = built.cur;

  // --- Sol ---
  const ground = st.ground !== false;
  c.cover = approach(c.cover, ground ? st.cover : 0, step);
  c.wet = approach(c.wet, ground ? st.wet : 0, step);
  c.frost = approach(c.frost, ground ? st.frost : 0, step);
  // la carte doit rester lisible même sous une neige épaisse
  built.snow.alpha = clamp(c.cover * 1.6) * 0.78;
  built.veil.alpha = clamp((c.cover - 0.5) * 1.1, 0, 0.42);
  built.wet.alpha = c.wet * 0.3;
  built.frost.alpha = c.frost * 0.85;

  // --- Traces de pas : elles restent tout le Quart, puis s'effacent au Quart suivant ---
  const now = performance.now();
  if (built.quarter !== undefined && st.quarter !== built.quarter) {
    for (const p of built.prints.children) p._fadeFrom ??= now;
  }
  built.quarter = st.quarter;
  const kids = built.prints.children;
  for (let i = kids.length - 1; i >= 0; i--) {
    const p = kids[i];
    if (p._fadeFrom === undefined) continue;
    const k = (now - p._fadeFrom) / 3000; // 3 secondes pour disparaître
    p.alpha = p._a0 * clamp(1 - k);
    if (k >= 1) p.destroy();
  }

  // --- Couleurs de saison ---
  if (built.grade) {
    const target = st.grade ? gradeMatrix(st.season, c.cover) : identity();
    const m = built.gradeM;
    let diff = 0;
    for (let i = 0; i < 20; i++) { const d = target[i] - m[i]; diff += Math.abs(d); m[i] += d * Math.min(1, dt / 1500); }
    built.grade.matrix = m;
    if (st.grade || diff > 0.002) addFilter(built.grade); else removeFilter(built.grade);
  }

  // --- Chaleur écrasante : l'air tremble ---
  if (built.heat) {
    built.heatK = approach(built.heatK, st.heat ? 1 : 0, dt / 3000);
    if (built.heatK > 0.001) {
      built.heatSprite.y -= 0.35 * dt / 16.67;
      built.heatSprite.x += 0.1 * dt / 16.67;
      const z = canvas.stage.scale.x || 1;
      built.heat.scale.set(5 * built.heatK * z, 9 * built.heatK * z);
      addFilter(built.heat);
    } else removeFilter(built.heat);
  }

  // --- Traces de pas : on surveille les déplacements ---
  watchTokens(dt);

  // --- Buée ---
  if (st.breath) breathe(now);
  for (let i = built.puffs.length - 1; i >= 0; i--) {
    const p = built.puffs[i];
    p.t += dt;
    const k = p.t / p.life;
    if (k >= 1 || p.s.destroyed) { if (!p.s.destroyed) p.s.destroy(); built.puffs.splice(i, 1); continue; }
    p.s.x += p.vx * dt / 1000; p.s.y += p.vy * dt / 1000;
    p.s.scale.set(p.sc * (0.6 + 0.8 * k));
    p.s.alpha = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
  }

  // --- Torches : plus le vent est fort, plus les flammes vacillent ---
  torchClock += dt;
  if (torchClock > 500) { torchClock = 0; windOnFlames(st.torches ? st.wind : 0); }
}

/** Souffle visible : une petite bouffée de buée régulière devant chaque créature visible. */
function breathe(now) {
  const g = grid();
  for (const t of canvas.tokens?.placeables ?? []) {
    if (!t.visible || !t.actor || t.document.hidden) continue;
    const id = t.id;
    const next = breathAt.get(id) ?? now + Math.random() * 3000;
    if (now < next) { breathAt.set(id, next); continue; }
    breathAt.set(id, now + 2600 + Math.random() * 1800);
    if (built.puffs.length > 120) continue;
    const s = new PIXI.Sprite(built.puffTex);
    s.anchor.set(0.5);
    const w = t.w ?? t.document.width * g, h = t.h ?? t.document.height * g;
    const rot = ((t.document.rotation ?? 0) + 90) * Math.PI / 180; // devant le visage, dans le sens du jeton
    s.x = t.x + w / 2 + Math.cos(rot) * w * 0.32; s.y = t.y + h / 2 + Math.sin(rot) * h * 0.32 - h * 0.1;
    const sc = (g * 0.3) / 96;
    s.scale.set(sc); s.alpha = 0;
    built.air.addChild(s);
    const wind = [0, 18, 45, 90][state.wind ?? 0];
    built.puffs.push({ s, t: 0, life: 1500 + Math.random() * 600, sc, vx: Math.cos(rot) * g * 0.15 + wind, vy: Math.sin(rot) * g * 0.15 - g * 0.12 });
  }
}

function windOnFlames(wind) {
  const boost = [0, 1, 3, 5][wind] ?? 0, speed = [0, 1, 2, 4][wind] ?? 0;
  const sources = [
    ...(canvas.tokens?.placeables ?? []).map((t) => t.light),
    ...(canvas.lighting?.placeables ?? []).map((l) => l.lightSource ?? l.source)
  ];
  for (const src of sources) {
    const anim = src?.animation;
    if (!anim || !TORCH_TYPES.has(anim.type)) continue;
    let base = torchBase.get(src);
    if (!base || (base.boosted !== anim.intensity && base.boosted !== undefined)) base = { intensity: anim.intensity ?? 5, speed: anim.speed ?? 5 };
    anim.intensity = Math.min(10, base.intensity + boost);
    anim.speed = Math.min(10, base.speed + speed);
    base.boosted = anim.intensity;
    torchBase.set(src, base);
  }
}

/* -------------------------------------------- */
/*  Traces de pas                               */
/* -------------------------------------------- */

function onPreUpdate(doc, changes) {
  if (!("x" in changes) && !("y" in changes)) return;
  lastPos.set(doc.id, { x: doc.x, y: doc.y });
}

let moves = 0;
/** Surveillance : toutes les 200 ms, chaque jeton qui a changé de place laisse ses traces. */
let watchClock = 0;
function watchTokens(dt) {
  watchClock += dt;
  if (watchClock < 200) return;
  watchClock = 0;
  for (const t of canvas.tokens?.placeables ?? []) {
    const d = t.document;
    const prev = known.get(d.id);
    if (!prev) { known.set(d.id, { x: d.x, y: d.y }); continue; }
    if (prev.x === d.x && prev.y === d.y) continue;
    known.set(d.id, { x: d.x, y: d.y });
    drawTracks(d, prev);
  }
}

function onUpdate(doc, changes) {
  if (!("x" in changes) && !("y" in changes)) return;
  // position de départ : vue avant la mise à jour, sinon dernière position connue, sinon le jeton tel qu'il est
  // encore affiché (il n'a pas fini de glisser). Fonctionne sur l'ordinateur de chaque joueur.
  const obj = doc.object;
  const from = lastPos.get(doc.id) ?? known.get(doc.id) ?? (obj ? { x: obj.x, y: obj.y } : null);
  lastPos.delete(doc.id);
  known.set(doc.id, { x: doc.x, y: doc.y });
  if (from) drawTracks(doc, from);
}

function drawTracks(doc, from) {
  moves++;
  if (!from || !built || !state?.tracks) return;
  // des traces seulement dans la neige (au sol ou en train de tomber)
  if (!(state.cover > 0.08 || state.snowing)) return;
  const kind = "snow";
  const g = grid();
  const w = doc.width * g, h = doc.height * g;
  const a = { x: from.x + w / 2, y: from.y + h / 2 }, b = { x: doc.x + w / 2, y: doc.y + h / 2 };
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  if (dist < g * 0.3 || dist > g * 60) return; // pas de traces pour une téléportation
  const beast = ["monster"].includes(doc.actor?.type);
  const t = beast ? built.pawTex : built.printTex;
  const stride = g * (beast ? 0.28 : 0.33);
  const ang = Math.atan2(dy, dx);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const n = Math.floor(dist / stride);
  const now = performance.now();
  const size = g * (beast ? 0.16 : 0.2) * Math.sqrt(Math.max(1, doc.width));
  for (let i = 1; i <= n; i++) {
    const side = i % 2 ? 1 : -1;
    const p = new PIXI.Sprite(t);
    p.anchor.set(0.5);
    p.x = a.x + dx * i / n + nx * side * g * 0.07;
    p.y = a.y + dy * i / n + ny * side * g * 0.07;
    p.rotation = ang + Math.PI / 2;
    p.scale.set(size / (beast ? 40 : 64));
    p.tint = kind === "snow" ? 0x8fa3c4 : 0x3a2a1a;
    p._a0 = kind === "snow" ? 0.6 : 0.5; p.alpha = p._a0;
    p._born = now - (n - i) * 40;
    built.prints.addChild(p);
  }
  const kids = built.prints.children;
  while (kids.length > 700) kids[0].destroy();
}

/* -------------------------------------------- */
/*  API                                         */
/* -------------------------------------------- */

let hooked = false;
export function initWorldFx() {
  if (hooked) return;
  hooked = true;
  Hooks.on("preUpdateToken", onPreUpdate);
  Hooks.on("updateToken", onUpdate);
  Hooks.on("canvasTearDown", () => { clearWorldFx(); known.clear(); });
  Hooks.on("canvasReady", () => { for (const t of canvas.tokens?.placeables ?? []) known.set(t.id, { x: t.document.x, y: t.document.y }); });
  Hooks.on("createToken", (doc) => known.set(doc.id, { x: doc.x, y: doc.y }));
}

let building = null;
/**
 * @param {object|null} s { cover, wet, frost, mud, falling, breath, wind, season, heat, grade, ground, tracks, torches }
 */
export async function setWorldFx(s) {
  state = s;
  if (!s) { clearWorldFx(); return; }
  if (!canvas?.ready) return;
  if (!built && !building) {
    building = build().then((b) => { built = b; building = null; })
      .catch((err) => { building = null; console.error("fl-temps | effets au sol impossibles à installer", err); });
  }
  await building;
  if (built && !tickerFn) { tickerFn = tick; canvas.app.ticker.add(tickerFn); }
}

export function clearWorldFx() {
  if (tickerFn) { canvas?.app?.ticker?.remove(tickerFn); tickerFn = null; }
  // rendre aux torches leur réglage normal
  try { windOnFlames(0); } catch { /* rien */ }
  destroy();
  breathAt.clear();
}

/** Diagnostic, à taper dans la console (F12) : flTemps.diagnostic() */
globalThis.flTemps = Object.assign(globalThis.flTemps ?? {}, {
  diagnostic() {
    const r = {
      effetsInstalles: !!built,
      coucheDansLaCarte: !!built && built.ground.parent === canvas.primary,
      neigeAuSol: state ? Math.round(state.cover * 100) + " %" : "—",
      neigeQuiTombe: !!state?.snowing,
      boue: !!state?.mud,
      tracesActivees: !!state?.tracks,
      tracesPresentes: built?.prints.children.length ?? 0,
      deplacementsVus: moves,
      bouffeesDeBuee: built?.puffs.length ?? 0
    };
    console.table(r);
    return r;
  }
});
