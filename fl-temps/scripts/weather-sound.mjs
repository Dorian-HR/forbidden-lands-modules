/**
 * Ambiance sonore : pluie, vent, tonnerre et sons de la nature selon le terrain, la saison et l'heure.
 * Plusieurs couches en boucle (météo, fond du terrain, animaux) dosées selon le terrain, le moment
 * de la journée, la saison et la météo ; elles passent de l'une à l'autre en fondu.
 * Le tonnerre est calé sur les éclairs.
 * Les sons passent par le canal « Environnement » de Foundry (son curseur de volume s'applique).
 */
const MOD = "fl-temps";
const SRC = (n) => `modules/${MOD}/assets/sons/${n}.ogg`;
const FADE = 4000; // ms

const layers = new Map(); // fichier -> { file, sound, vol, cancelled }
let master = 1;
let storming = false;
let distantTimer = null;
let enabled = true;
let selfBolts = false; // pas d'éclairs à l'écran : le tonnerre proche est déclenché ici
let lastPlan = {};

function audioContext() {
  return game.audio?.environment ?? game.audio?.context ?? undefined;
}

async function unlocked() {
  try {
    if (game.audio?.locked === false) return;
    const p = game.audio?.unlock ?? game.audio?.awaitFirstGesture?.();
    if (p?.then) await p;
  } catch { /* rien */ }
}

async function makeSound(file, { loop = true, volume = 0 } = {}) {
  await unlocked();
  const SoundCls = foundry.audio?.Sound;
  if (SoundCls) {
    const s = new SoundCls(SRC(file), { context: audioContext() });
    await s.load();
    await s.play({ loop, volume });
    return s;
  }
  return foundry.audio.AudioHelper.play({ src: SRC(file), volume, loop, channel: "environment" }, false);
}

function fade(sound, volume, duration = FADE) {
  if (!sound) return Promise.resolve();
  try {
    if (typeof sound.fade === "function") return Promise.resolve(sound.fade(volume, { duration }));
  } catch { /* rien */ }
  sound.volume = volume;
  return Promise.resolve();
}

async function stopLater(sound) {
  await fade(sound, 0);
  setTimeout(() => { try { sound.stop(); } catch { /* déjà arrêté */ } }, 150);
}

/** Applique un mélange { fichier: volume } : nouvelles couches en fondu, anciennes qui s'effacent. */
function applyMix(plan, duration = FADE) {
  lastPlan = plan;
  for (const [file, entry] of layers) {
    if (plan[file] > 0.01) continue;
    layers.delete(file);
    if (entry.sound) stopLater(entry.sound); else entry.cancelled = true;
  }
  for (const [file, v] of Object.entries(plan)) {
    const target = v * master;
    if (target <= 0.01) continue;
    const cur = layers.get(file);
    if (cur) {
      if (Math.abs(cur.vol - target) > 0.005) { cur.vol = target; if (cur.sound) fade(cur.sound, target, duration); }
      continue;
    }
    const entry = { file, vol: target, sound: null };
    layers.set(file, entry);
    makeSound(file).then((s) => {
      if (entry.cancelled || layers.get(file) !== entry) { try { s.stop(); } catch { /* rien */ } return; }
      entry.sound = s;
      fade(s, entry.vol, duration);
    }).catch((err) => {
      console.warn(`fl-temps | son ${file} indisponible`, err);
      if (layers.get(file) === entry) layers.delete(file);
    });
  }
}

/** Change le volume général tout de suite (curseur du panneau). */
export function setSoundVolume(v) {
  master = v;
  for (const entry of layers.values()) {
    entry.vol = (lastPlan[entry.file] ?? 0) * master;
    if (entry.sound) fade(entry.sound, entry.vol, 250);
  }
}

/* -------------------------------------------- */
/*  Le mélange : terrain × moment × saison × météo */
/* -------------------------------------------- */

const OPEN = ["plaine", "collines"];
const FOREST = ["foret", "foret_dense"];
const WET = ["lac", "marecages", "tourbiere"];

/**
 * Calcule le mélange à jouer.
 * @param {object|null} w météo en vigueur (null : temps ordinaire)
 * @param {object} where { region, season, quarter (0 Matin, 1 Journée, 2 Soir, 3 Nuit) }
 * @returns {object} { fichier: volume 0..1 }
 */
export function soundPlan(w, { region, season, quarter }) {
  const mix = {};
  const add = (f, v) => { if (v > 0.01) mix[f] = Math.min(1, (mix[f] ?? 0) + v); };
  const precip = w?.precip ?? 1, wind = w?.wind ?? 1, snow = !!w?.snow, temp = w?.temp ?? 0, fog = w?.fog ?? 0;
  const night = quarter === 3, dusk = quarter === 2, dawn = quarter === 0, day = quarter === 1;
  const open = OPEN.includes(region), forest = FOREST.includes(region), wet = WET.includes(region);

  // --- Météo ---
  if (precip >= 2 && !snow) add(precip === 3 ? "pluie_forte" : "pluie_fine", precip === 3 ? 0.85 : 0.55);
  if (w?.hail) add("grele", 0.8);
  let wl = wind + (region === "montagne" && wind < 3 ? 1 : 0);
  if (snow && precip === 3) wl = Math.max(wl, 1);
  if (forest && wl > 0 && wind < 3) wl = Math.max(1, wl - 1); // la forêt abrite du vent
  if (wl >= 1) add(`vent_${Math.min(3, wl)}`, [0, 0.3, 0.42, 0.75][Math.min(3, wl)]);

  // --- Fond du terrain (eau, feuillage, souffle, pierres) ---
  add(`fond_${region}`, night && !["lac", "ruines"].includes(region) ? 0.4 : 0.5);

  // --- Animaux : ce qui s'entend selon le moment et la saison ---
  const birds = { printemps: 1, ete: 0.75, automne: 0.45, hiver: 0.15 }[season];
  const bugs = { printemps: 0.3, ete: 1, automne: 0.35, hiver: 0 }[season];
  const frogs = { printemps: 1, ete: 0.8, automne: 0.3, hiver: 0 }[season];
  const f = {}; // volumes avant atténuation par la météo
  const put = (k, v) => { if (v > 0) f[k] = Math.max(f[k] ?? 0, v); };

  if (dawn) {
    // le chœur de l'aube, très fort au printemps
    put("chorus_aube", 0.75 * birds * (forest ? 1 : region === "montagne" ? 0.25 : region === "ruines" ? 0.35 : region === "tourbiere" ? 0.45 : 0.8));
    if (open && season !== "hiver") put("alouettes", 0.3);
    if (wet) put("grenouilles", 0.3 * frogs);
  }
  if (day) {
    if (forest) put("oiseaux_foret", 0.6 * birds * (region === "foret_dense" ? 0.7 : 1));
    else if (region !== "montagne") put("oiseaux_jour", 0.45 * birds * (region === "ruines" ? 0.5 : 1));
    if (open && ["printemps", "ete"].includes(season)) put("alouettes", 0.45);
    if (!forest && region !== "montagne") put("insectes_ete", 0.5 * bugs * (temp >= 1 ? 1.3 : 1));
    if (forest) put("insectes_ete", 0.2 * bugs);
    if (["montagne", "collines"].includes(region)) put("rapaces", 0.45);
    if (wet) put("grenouilles", 0.35 * frogs * (region === "lac" ? 0.6 : 1));
  }
  if (dawn || day) {
    if (region === "ruines") put("corbeaux", 0.55);
    else if (season === "hiver" || season === "automne") put("corbeaux", open || forest ? 0.35 : 0.2);
    if (["automne", "printemps"].includes(season) && (open || wet)) put("oies", 0.45); // migrations
  }
  if (dusk) {
    if (region !== "montagne") put("oiseaux_soir", 0.6 * birds * (region === "ruines" ? 0.5 : 1));
    if (!wet && region !== "montagne") put("grillons", 0.3 * bugs);
    if (wet) put("grenouilles_chorus", 0.4 * frogs);
    if (region === "ruines") put("corbeaux", 0.35);
    if (forest || region === "ruines") put("chouettes", 0.25);
  }
  if (night) {
    if (!wet && region !== "montagne") put("grillons", 0.55 * bugs * (forest ? 0.6 : 1));
    if (wet) put("grenouilles_chorus", 0.75 * frogs), put("grillons", 0.25 * bugs);
    put("chouettes", forest || region === "ruines" ? 0.55 : 0.2);
    // les loups : surtout l'hiver, au loin dans les forêts, les collines et la montagne
    const wolves = { hiver: 0.55, automne: 0.3, printemps: 0.12, ete: 0.08 }[season];
    if (region !== "lac") put("loups", wolves * (forest || region === "montagne" ? 1 : 0.6));
  }

  // --- La météo fait taire les bêtes ---
  let damp = 1;
  if (precip === 3) damp *= 0.12; else if (precip === 2) damp *= 0.45;
  if (wind === 3) damp *= 0.2; else if (wind === 2) damp *= 0.6;
  if (fog) damp *= 0.75; // le brouillard étouffe tout
  for (const [k, v] of Object.entries(f)) {
    let x = v * damp;
    if (k.startsWith("grenouilles") && precip >= 2) x = v * Math.min(1, damp * 3); // la pluie réveille les grenouilles
    if (snow && !["corbeaux", "loups", "chouettes"].includes(k)) x *= 0.15;     // la neige étouffe tout
    if (temp <= -2 && ["insectes_ete", "grillons", "grenouilles", "grenouilles_chorus"].includes(k)) x = 0;
    if (temp >= 2 && day && k.startsWith("oiseaux")) x *= 0.6; // canicule : les oiseaux se taisent à midi
    add(k, x);
  }
  return mix;
}

/**
 * Applique l'ambiance sonore.
 * @param {object|null} w météo en vigueur
 * @param {object|null} where { region, season, quarter } ou null pour tout couper
 */
export async function setWeatherSound(w, where, { volume = 1, ownBolts = false } = {}) {
  enabled = !!where;
  master = volume;
  selfBolts = ownBolts;
  applyMix(where ? soundPlan(w, where) : {});
  setStorm(!!where && !!w?.storm);
}

/* -------------------------------------------- */
/*  Tonnerre                                    */
/* -------------------------------------------- */

async function thunder(distant) {
  if (!enabled) return;
  const file = distant ? `tonnerre_loin_${Math.floor(Math.random() * 2)}` : `tonnerre_${Math.floor(Math.random() * 3)}`;
  try {
    const vol = Math.min(1, (distant ? 0.55 + Math.random() * 0.2 : 0.95 + Math.random() * 0.05) * Math.max(master, 0.8));
    await makeSound(file, { loop: false, volume: vol });
  } catch (err) { console.warn("fl-temps | tonnerre", err); }
}

/** Appelé à chaque éclair visible : le tonnerre suit, avec un petit délai (la foudre est plus ou moins loin). */
export function onLightning() {
  if (!enabled || !storming) return;
  setTimeout(() => thunder(false), 300 + Math.random() * 2200);
}

/** Pendant un orage, grondements lointains de temps en temps, même sans éclair à l'écran. */
function setStorm(on) {
  if (on === storming) return;
  storming = on;
  clearTimeout(distantTimer);
  if (!on) return;
  const next = () => {
    const close = selfBolts && Math.random() < 0.6;
    const wait = close ? 15000 + Math.random() * 20000 : 25000 + Math.random() * 35000;
    distantTimer = setTimeout(() => { if (storming) { thunder(!close); next(); } }, wait);
  };
  next();
}

export function stopWeatherSound() {
  setWeatherSound(null, null);
}
