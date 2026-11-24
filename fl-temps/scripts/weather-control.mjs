/**
 * Météo dans Foundry : stockage, annonce par le MJ, effets dans les jets, effets visuels.
 */
import { SECONDS_PER_DAY, QUARTER, dateFromDay, eclipseOn } from "./calendar.mjs";
import { REGIONS, generate, effects, label, icon, phrases, clearSky } from "./weather.mjs";
import { setWeatherFx, setStrikeListener } from "./weather-fx.mjs";
import { setWeatherSound, onLightning } from "./weather-sound.mjs";
import { setWorldFx, initWorldFx, clearWorldFx } from "./weather-world.mjs";
setStrikeListener(onLightning);

const MOD = "fl-temps";
const setting = (k) => game.settings.get(MOD, k);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let ctx = null; // { getConfig, isActiveGM, sceneSynced, refresh }

export function registerWeatherSettings(refresh) {
  const reg = (key, data) => game.settings.register(MOD, key, { onChange: () => { refresh(); refreshWeatherFx(); }, ...data });
  reg("weatherEnabled", { name: "Météo", hint: "Active la météo des Contrées (tirée chaque jour selon la saison et le terrain).", scope: "world", config: true, type: Boolean, default: true });
  reg("weatherAutoAnnounce", { name: "Annoncer la météo automatiquement", hint: "Sinon, le MJ l'annonce lui-même chaque jour (bouton du panneau). Les effets ne s'appliquent qu'une fois la météo annoncée.", scope: "world", config: true, type: Boolean, default: false });
  reg("weatherFx", { name: "Effets visuels de la météo", hint: "Pluie, neige, brouillard, éclairs sur la carte (réglage propre à chaque joueur).", scope: "client", config: true, type: Boolean, default: true });
  reg("weatherSound", { name: "Sons d'ambiance", hint: "Pluie, vent, tonnerre et bruits de la nature selon le terrain, la saison et l'heure (réglage propre à chaque joueur). Le curseur « Environnement » de Foundry règle aussi leur volume.", scope: "client", config: true, type: Boolean, default: true });
  reg("weatherSoundVolume", { name: "Volume des sons d'ambiance (%)", scope: "client", config: true, type: Number, default: 70, range: { min: 0, max: 100, step: 5 } });
  // Fréquences réglables par le MJ (100 % = climat normal des Contrées)
  const slider = (key, name, hint) => game.settings.register(MOD, key, {
    name, hint, scope: "world", config: true, type: Number, default: 100,
    range: { min: 0, max: 200, step: 10 },
    onChange: () => { if (game.user.isGM) ensureWeather({ regenerate: true }); refresh(); }
  });
  slider("tuneRain", "Météo : fréquence de la pluie et de la neige (%)", "100 = normal. 0 = jamais de pluie ni de neige, 200 = deux fois plus souvent. S'applique aux jours pas encore annoncés.");
  slider("tuneWind", "Météo : fréquence du vent fort et des tempêtes (%)", "100 = normal. Plus bas : temps plus calme. Plus haut : coups de vent et tempêtes plus fréquents.");
  slider("tuneFog", "Météo : fréquence du brouillard (%)", "100 = normal. 0 = jamais de brouillard.");
  slider("tuneStorm", "Météo : fréquence des orages (%)", "Chance qu'une averse tourne à l'orage (éclairs). 100 = normal, 0 = jamais.");
  slider("tuneExtreme", "Météo : températures extrêmes (%)", "Froid glacial et canicule (jets d'ENDURANCE). 100 = normal, 0 = jamais.");
  reg("weatherWorldFx", { name: "Effets au sol et sur les personnages", hint: "Neige qui s'accumule, sol mouillé, givre, traces de pas dans la neige, buée par grand froid (réglage propre à chaque joueur).", scope: "client", config: true, type: Boolean, default: true });
  reg("weatherGrade", { name: "Couleurs de saison", hint: "La carte prend une teinte légère selon la saison : vive au printemps, chaude en été, rousse en automne, pâle et froide en hiver ; l'air tremble sous la canicule (réglage propre à chaque joueur).", scope: "client", config: true, type: Boolean, default: true });
  reg("weatherTorchWind", { name: "Les flammes vacillent avec le vent", hint: "Torches et feux (lumières animées en torche ou en flamme) s'agitent davantage quand le vent forcit (réglage propre à chaque joueur).", scope: "client", config: true, type: Boolean, default: true });
  reg("weatherTorchPrompt", { name: "Torches sous la pluie", hint: "Sous une averse, le MJ reçoit un message pour éteindre les torches allumées des jetons.", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(MOD, "eclipseSaid", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MOD, "dousePrompted", { scope: "world", config: false, type: String, default: "" });
  reg("weatherRegion", { scope: "world", config: false, type: String, default: "plaine" });
  reg("weatherDays", { scope: "world", config: false, type: Object, default: {} });
}

export function initWeather(context) {
  ctx = context;
  initWorldFx();
  Hooks.on("renderChatMessageHTML", (msg, html) => bindDouseButtons(msg, html));
}

export const weatherOn = () => setting("weatherEnabled");
const today = () => Math.floor(game.time.worldTime / SECONDS_PER_DAY);
const quarterNow = () => Math.floor((((game.time.worldTime % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY) / QUARTER);
const days = () => setting("weatherDays") ?? {};

const tuning = () => ({
  rain: setting("tuneRain"), wind: setting("tuneWind"), fog: setting("tuneFog"),
  storm: setting("tuneStorm"), extreme: setting("tuneExtreme")
});

export function getStored(day = today()) {
  return days()[day] ?? null;
}

function makeDay(day, region, store) {
  const season = dateFromDay(day, ctx.getConfig()).season;
  const prev = store[day - 1] ?? null;
  const prev2 = store[day - 2] ?? null;
  return { ...generate({ day, season, region, prev, prev2, seed: Math.floor(Math.random() * 1e9), tuning: tuning() }), announced: false };
}

/** MJ : s'assure que la météo d'aujourd'hui et de demain existe. */
export async function ensureWeather({ regenerate = false } = {}) {
  if (!weatherOn() || !ctx?.isActiveGM()) return;
  const d = today();
  const region = setting("weatherRegion");
  const store = foundry.utils.deepClone(days());
  let changed = false;
  for (const day of [d, d + 1]) {
    const w = store[day];
    const stale = w && !w.announced && !w.manual && (w.region !== region || regenerate);
    if (!w || stale) { store[day] = makeDay(day, region, store); changed = true; }
  }
  // on ne garde qu'une fenêtre de jours (pour revenir en arrière sans tout perdre)
  for (const k of Object.keys(store)) if (Number(k) < d - 40 || Number(k) > d + 2) { delete store[k]; changed = true; }
  if (changed) await game.settings.set(MOD, "weatherDays", store);
  if (setting("weatherAutoAnnounce") && store[d] && !store[d].announced) await announceWeather();
}

export async function setRegion(region) {
  if (!game.user.isGM || !REGIONS[region]) return;
  await game.settings.set(MOD, "weatherRegion", region);
  await ensureWeather();
}

/** MJ : relance la météo du jour (offset 0) ou du lendemain (offset 1). */
export async function rerollWeather(offset = 0) {
  if (!game.user.isGM) return;
  const d = today() + offset;
  const store = foundry.utils.deepClone(days());
  const wasAnnounced = store[d]?.announced;
  store[d] = makeDay(d, setting("weatherRegion"), store);
  if (offset === 0) store[d + 1] = makeDay(d + 1, setting("weatherRegion"), store);
  await game.settings.set(MOD, "weatherDays", store);
  if (offset === 0 && wasAnnounced) await announceWeather();
}

/** MJ : impose une météo (dialogue). */
export async function chooseWeatherDialog(title = "Choisir la météo", offset = 0) {
  if (!game.user.isGM) return;
  const w = getStored(today() + offset) ?? makeDay(today() + offset, setting("weatherRegion"), days());
  const opt = (arr, v) => arr.map((l, i) => `<option value="${i}" ${i === v ? "selected" : ""}>${l}</option>`).join("");
  const content = `<div class="flt-dialog">
    <div class="form-group"><label>Précipitations</label><select name="precip">${opt(["Ciel dégagé", "Couvert", "Bruine / neige légère", "Averse / forte neige"], w.precip)}</select></div>
    <div class="form-group"><label>Neige plutôt que pluie</label><input type="checkbox" name="snow" ${w.snow ? "checked" : ""}></div>
    <div class="form-group"><label>Orage (éclairs)</label><input type="checkbox" name="storm" ${w.storm ? "checked" : ""}></div>
    <div class="form-group"><label>Vent</label><select name="wind">${opt(["Calme", "Brise", "Coups de vent", "Tempête"], w.wind)}</select></div>
    <div class="form-group"><label>Température</label><select name="temp">${opt(["Glacial", "Froid", "Doux", "Chaud", "Canicule"], w.temp + 2)}</select></div>
    <div class="form-group"><label>Grêle (avec une averse)</label><input type="checkbox" name="hail" ${w.hail ? "checked" : ""}></div>
    <div class="form-group"><label>Nuit glaciale (ciel dégagé)</label><input type="checkbox" name="coldNight" ${w.coldNight ? "checked" : ""}></div>
    <div class="form-group"><label>Brouillard</label><select name="fog">${opt(["Aucun", "Brume matinale", "Brouillard épais"], w.fog)}</select></div>
  </div>`;
  const { DialogV2 } = foundry.applications.api;
  const data = await DialogV2.prompt({
    window: { title, icon: "fa-solid fa-cloud-sun-rain" },
    content,
    ok: { label: "Appliquer", callback: (ev, btn) => {
      const f = btn.form.elements;
      return { precip: Number(f.precip.value), snow: f.snow.checked, storm: f.storm.checked, wind: Number(f.wind.value), temp: Number(f.temp.value) - 2, fog: Number(f.fog.value),
        hail: f.hail.checked, coldNight: f.coldNight.checked };
    } },
    rejectClose: false
  });
  if (!data) return;
  const d = today() + offset;
  const store = foundry.utils.deepClone(days());
  const was = store[d]?.announced;
  store[d] = { ...w, ...data, storm: data.storm && data.precip === 3, snow: data.snow && data.precip >= 2,
    hail: data.hail && data.precip === 3 && !data.snow, coldNight: data.coldNight && data.precip === 0, manual: true, announced: false };
  await game.settings.set(MOD, "weatherDays", store);
  if (offset === 0 && (was || setting("weatherAutoAnnounce"))) await announceWeather();
}

/** MJ : annonce la météo du jour aux joueurs (et active ses effets). */
export async function announceWeather() {
  if (!game.user.isGM) return;
  const d = today();
  const store = foundry.utils.deepClone(days());
  const w = store[d];
  if (!w) return;
  w.announced = true;
  await game.settings.set(MOD, "weatherDays", store);
  const firstSnow = w.snow && !Object.entries(store).some(([k, x]) => Number(k) < d && Number(k) >= d - 120 && x.snow);
  const lines = phrases(w, { firstSnow });
  const tags = weatherTags(w).map((t) => `<span class="flt-wtag"><i class="fa-solid ${t.icon}"></i> ${esc(t.label)}</span>`).join(" ");
  await ChatMessage.create({
    content: `<div class="flt-chat flt-weather-card"><h3><i class="fa-solid fa-cloud-sun-rain"></i> Le temps aujourd'hui</h3>
      <p class="flt-wtags">${tags}</p>${lines.map((l) => `<p class="flt-wphrase">${esc(l)}</p>`).join("")}</div>`,
    speaker: { alias: "Le Temps" }
  });
}

/** Étiquettes affichables (icône + texte). */
export function weatherTags(w) {
  const t = [{ icon: icon(w, "precip"), label: label(w, "precip") }, { icon: icon(w, "wind"), label: label(w, "wind") }, { icon: icon(w, "temp"), label: label(w, "temp") }];
  if (w.fog) t.push({ icon: "fa-smog", label: label(w, "fog") });
  if (w.hail) t.push({ icon: "fa-cloud-meatball", label: "Grêle" });
  if (w.coldNight && w.temp > -2) t.push({ icon: "fa-snowflake", label: "Nuit glaciale" });
  return t;
}

/**
 * Météo en vigueur : celle d'aujourd'hui si elle est annoncée ; sinon la dernière annoncée
 * (hier, avant-hier…) continue jusqu'à l'annonce de la nouvelle, pour ne pas casser l'ambiance.
 */
export function activeWeather() {
  if (!weatherOn()) return null;
  const d = today();
  const store = days();
  for (let k = d; k >= d - 3; k--) if (store[k]?.announced) return store[k];
  return null;
}

/** Modificateurs de jets dus à la météo, au format { ids, value, name }. */
export function weatherMods() {
  const w = activeWeather();
  if (!w) return [];
  const e = effects(w, quarterNow());
  const mods = [...e.mods];
  const both = e.endurance.find((x) => x.mod);
  if (both) mods.push({ ids: ["endurance"], value: both.mod, name: "Météo : tempête et averse" });
  return mods;
}

/** Rappels des jets d'Endurance par Quart. */
export function enduranceReminders() {
  const w = activeWeather();
  return w ? effects(w, quarterNow()).endurance : [];
}

/** La pleine lune ne compte que par ciel dégagé. */
export const skyIsClear = () => clearSky(activeWeather());

/** Données pour le panneau. */
export function weatherContext(isGM) {
  if (!weatherOn()) return { on: false };
  const todayW = getStored();
  const live = activeWeather();
  const carried = !!live && live !== todayW && !todayW?.announced; // météo de la veille qui continue
  // le MJ voit la météo du jour (même non annoncée) ; les joueurs voient celle en vigueur
  const w = isGM ? todayW : live;
  const tomorrow = getStored(today() + 1);
  const region = setting("weatherRegion");
  return {
    on: true,
    show: !!w && (isGM || !!live),
    announced: !!todayW?.announced,
    carried: isGM && carried,
    carriedTags: isGM && carried ? weatherTags(live).map((t) => t.label).join(" · ") : "",
    tags: w ? weatherTags(w) : [],
    phrase: w ? phrases(w)[0] : "",
    endurance: w && (live || isGM) ? effects(w, quarterNow()).endurance.map((e) => e.text) : [],
    regions: Object.entries(REGIONS).map(([k, r]) => ({ key: k, label: r.label, current: k === region })),
    regionLabel: REGIONS[region]?.label ?? "",
    forecast: isGM && tomorrow ? weatherTags(tomorrow).map((t) => t.label).join(" · ") : "",
    forecastManual: !!tomorrow?.manual,
    eclipseNote: isGM ? eclipseNote() : "",
    mods: isGM && w ? modsSummary(w) : []
  };
}

const ACTIONS = {
  "travel-navigate": "Ouvrir la marche", "travel-make-camp": "Préparer le camp", marksmanship: "Tir", endurance: "Endurance"
};

/** Résumé des bonus et malus de la météo sur les jets (pour le MJ), regroupés par action. */
export function modsSummary(w) {
  const e = effects(w, quarterNow());
  const list = [...e.mods];
  const both = e.endurance.find((x) => x.mod);
  if (both) list.push({ ids: ["endurance"], value: both.mod, name: "tempête et averse" });
  const byAction = new Map();
  for (const m of list) {
    const action = ACTIONS[m.ids[0]] ?? m.ids[0];
    const cur = byAction.get(action) ?? { action, total: 0, why: [] };
    cur.total += m.value;
    cur.why.push(`${m.name.replace(/^Météo : /, "")} ${m.value > 0 ? "+" : ""}${m.value}`);
    byAction.set(action, cur);
  }
  return [...byAction.values()].map((m) => ({
    action: m.action, value: (m.total > 0 ? "+" : "") + m.total, bonus: m.total > 0, why: m.why.join(", ")
  }));
}

/* -------------------------------------------- */
/*  Effets visuels                              */
/* -------------------------------------------- */

export { clearWeatherFx } from "./weather-fx.mjs";
export function refreshWeatherSound() {
  try {
    const synced = ctx?.sceneSynced();
    if (!weatherOn() || !setting("weatherSound") || !synced || !(setting("weatherSoundVolume") > 0)) return setWeatherSound(null, null);
    const w = activeWeather();
    const season = dateFromDay(today(), ctx.getConfig()).season;
    setWeatherSound(w, { region: setting("weatherRegion"), season, quarter: quarterNow() },
      { volume: setting("weatherSoundVolume") / 100, ownBolts: !setting("weatherFx") });
  } catch (err) {
    console.error("fl-temps | sons", err);
  }
}

/**
 * Ce que le vent emporte, selon la saison, le moment de la journée et le terrain.
 * Saison : printemps (jeunes feuilles, pétales, pollen), été (feuilles vertes), automne (feuilles rousses en masse),
 * hiver (neige soulevée, rares feuilles mortes).
 * Moment : pollen le jour, lucioles le soir et la nuit d'été, moucherons à l'aube et au crépuscule,
 * givre scintillant les matins d'hiver ; lumière rosée le matin, dorée le soir, bleutée la nuit.
 * Terrain : peu de feuilles en plaine (des akènes à la place), aucune en montagne (neige des cimes),
 * embruns sur le lac, duvet des roseaux dans les marais, poussière dans les ruines.
 */
const LEAF_BY_REGION = { plaine: 0.5, collines: 0.5, foret: 1.3, foret_dense: 1.1, montagne: 0.1, lac: 0.5, marecages: 0.4, tourbiere: 0.25, ruines: 0.7 };
const TINT_BY_QUARTER = [0xffe6dc, 0xffffff, 0xffd6a0, 0x7d87a8]; // Matin, Journée, Soir, Nuit

function windParticles(w, q) {
  const wind = w.wind ?? 0, season = w.season, region = w.region ?? "plaine", temp = w.temp ?? 0;
  const base = [0, 8, 22, 40][wind];
  const heavySnow = w.precip === 3 && w.snow;
  const wet = w.precip >= 2 && !w.snow;          // sous la pluie, tout reste collé
  const dry = w.precip < 2;
  const forest = ["foret", "foret_dense"].includes(region);
  const marsh = ["marecages", "tourbiere"].includes(region);
  const water = region === "lac" || marsh;
  const open = ["plaine", "collines"].includes(region);
  const day = q <= 1, dusk = q === 2, night = q === 3, dawn = q === 0;
  const leafK = { printemps: 0.4, ete: 0.75, automne: 1.5, hiver: 0.12 }[season] ?? 1;
  let leaves = heavySnow ? 0 : Math.round(base * leafK * (wet ? 0.5 : 1) * (LEAF_BY_REGION[region] ?? 1));
  if (!wind && season === "automne" && forest && !wet) leaves = 6; // en forêt, les feuilles tombent même sans vent

  const pollenK = forest ? 0.6 : open ? 1.2 : region === "montagne" ? 0.3 : water ? 0.8 : 0.5;
  const pollen = season === "printemps" && dry && wind < 3 && !night ? Math.round([25, 55, 40][wind] * pollenK * (dusk ? 0.5 : 1)) : 0;

  // akènes de pissenlit dans les prés ; duvet de massette dans les marais en automne-hiver
  let seeds = 0, seedKind = "akene";
  if (open && ["printemps", "ete"].includes(season) && dry && !night) seeds = [4, 12, 10, 0][wind];
  if (marsh && ["automne", "hiver"].includes(season) && !heavySnow && wind) seeds = [0, 8, 12, 8][wind], seedKind = "duvet";

  const twigK = forest ? 2 : region === "montagne" ? 0 : open || water ? 0.5 : 1;
  const twigs = wind >= 2 && !heavySnow ? Math.round((wind === 2 ? 4 : 10) * twigK) : 0;

  // neige soulevée : tout l'hiver, et sur les cimes dès l'automne et jusqu'au printemps
  const peaks = region === "montagne" && season !== "ete";
  const drift = (season === "hiver" || peaks) && w.precip < 3 && wind >= 1 ? Math.round([0, 50, 130, 200][wind] * (peaks && season !== "hiver" ? 0.6 : 1)) : 0;

  // lucioles : soirs et nuits d'été (et fin de printemps), au calme
  const ffK = forest || marsh || region === "lac" ? 1 : open ? 0.6 : 0;
  const fireflies = ["ete", "printemps"].includes(season) && (dusk || night) && dry && wind <= 1 && temp >= 0
    ? Math.round((night ? 30 : 16) * ffK * (season === "printemps" ? 0.4 : 1)) : 0;

  // moucherons : essaims au bord de l'eau, à l'aube et au crépuscule, par temps doux et calme
  const midges = water && ["ete", "printemps"].includes(season) && (dawn || dusk) && dry && wind <= 1 ? 40 : 0;

  // givre scintillant (poussière de diamant) : matins d'hiver glacés et clairs
  const sparkles = season === "hiver" && temp <= -1 && w.precip === 0 && wind <= 1 && q <= 1 ? (dawn ? 70 : 40) : 0;

  // embruns soulevés sur le lac par les rafales
  const spray = region === "lac" && wind >= 2 ? (wind === 2 ? 40 : 90) : 0;

  return { leaves, pollen, seeds, seedKind, twigs, drift, fireflies, midges, sparkles, spray, tint: TINT_BY_QUARTER[q] ?? 0xffffff };
}

/** Le sol : enneigement (accumulé sur les jours passés), sol mouillé, givre. */
function groundState(w, q) {
  const store = days(), d = today();
  let cover = 0, prevRain = false;
  for (let k = d - 14; k <= d; k++) {
    const x = k === d ? w : store[k];
    if (!x) { cover = Math.max(0, cover - 0.1); continue; }
    const part = k === d ? (q + 1) / 4 : 1; // aujourd'hui, la neige tombe au fil des Quarts
    if (x.snow && x.precip >= 2) cover += (x.precip === 3 ? 0.6 : 0.3) * part;
    else if (x.precip >= 2) cover -= 0.35 * part;
    cover -= ({ 2: 0.6, 1: 0.5, 0: 0.2, "-1": 0.05, "-2": 0 }[x.temp] ?? 0.2) * part * (x.snow ? 0.3 : 1);
    cover = Math.max(0, Math.min(1, cover));
    if (k === d - 1) prevRain = x.precip >= 2 && !x.snow;
  }
  const region = setting("weatherRegion"), season = w?.season ?? dateFromDay(d, ctx.getConfig()).season;
  if (region === "montagne") cover = Math.max(cover, { hiver: 0.7, automne: 0.3, printemps: 0.35, ete: 0 }[season]);
  const rainNow = w && w.precip >= 2 && !w.snow;
  let wet = rainNow ? (w.precip === 3 ? 1 : 0.6) : prevRain && q <= 1 && !(w?.temp >= 1) ? 0.4 : 0;
  if (cover > 0.05 && w?.temp >= 1) wet = Math.max(wet, 0.35); // la neige fond : boue
  const cold = (w?.temp ?? 0) <= -1;
  let frost = q === 0 && cold && (w?.precip ?? 0) <= 1 ? 0.7 : 0;
  if (w?.coldNight && w.temp > -2 && (q === 3 || q === 0)) frost = 1;
  if (cover > 0.8) frost *= 0.3;
  const mud = wet >= 0.4 && !["montagne", "ruines"].includes(region);
  return { cover, wet, frost, mud, falling: !!w && w.precip >= 2, snowing: !!w && w.snow && w.precip >= 2, season, region };
}

/** Ciel : rayons, aurore, étoiles filantes, arc-en-ciel du matin, éclipse. */
function skyState(w, q, region, eclipse) {
  const forest = ["foret", "foret_dense"].includes(region);
  const precip = w?.precip ?? 0, fog = w?.fog ?? 0;
  let rays = 0;
  if (precip <= 1 && fog !== 2 && q <= 2) {
    if (forest && q <= 1) rays = q === 0 ? 1 : 0.7;
    else if (precip === 1 && (q === 0 || q === 2)) rays = 0.7;
    else if (forest && q === 2) rays = 0.5;
  }
  const clearNight = q === 3 && precip === 0 && fog === 0;
  const season = w?.season;
  const auroraNight = clearNight && (season === "hiver" || (season === "automne" && (w?.temp ?? 0) <= -1)) && (w?.temp ?? 0) <= -1 &&
    ((Math.imul(today() + 11, 2654435761) >>> 0) % 3 === 0);
  const stars = clearNight ? (season === "ete" ? 1 : 0.3) : 0;
  // arc-en-ciel au matin quand il a plu la veille et que le ciel s'est calmé
  const y = days()[today() - 1];
  const rainbow = q === 0 && precip <= 1 && fog !== 2 && y && y.precip >= 2 && !y.snow;
  const ecl = eclipse === "solaire" && q === 1 ? "solaire" : eclipse === "lunaire" && q === 3 && precip <= 1 ? "lunaire" : null;
  return { rays, aurora: auroraNight, stars, rainbow: !!rainbow, eclipse: ecl };
}

export function refreshWeatherFx() {
  refreshWeatherSound();
  try {
    const synced = ctx?.sceneSynced();
    const w = activeWeather();
    const q = quarterNow();
    const region = setting("weatherRegion");
    const eclipse = weatherOn() ? eclipseOn(today(), ctx.getConfig()) : null;
    const sky = skyState(w, q, region, eclipse);
    // partagé avec les autres modules (ambiances des lieux…)
    const season = w?.season ?? dateFromDay(today(), ctx.getConfig()).season;
    const current = { quarter: q, day: today(), season, region, weather: w ? { ...w } : null };
    const changed = JSON.stringify(current) !== JSON.stringify(globalThis.flTemps?.current ?? null);
    globalThis.flTemps = Object.assign(globalThis.flTemps ?? {}, { current });
    if (changed) Hooks.callAll("flTempsRefresh", current);
    if (sky.eclipse && game.user.isGM && ctx?.isActiveGM?.()) announceEclipse(sky.eclipse);

    // Le sol, les personnages et la carte
    if (weatherOn() && synced && (setting("weatherWorldFx") || setting("weatherGrade") || setting("weatherTorchWind"))) {
      const g = groundState(w, q);
      setWorldFx({
        ...g,
        ground: setting("weatherWorldFx"), tracks: setting("weatherWorldFx"),
        breath: setting("weatherWorldFx") && (((w?.temp ?? 0) <= -1) || (w?.coldNight && q >= 2) || (g.season === "hiver" && q !== 1)),
        wind: w?.wind ?? 0, torches: setting("weatherTorchWind"),
        quarter: today() * 4 + q, // les traces de pas s'effacent à chaque nouveau Quart
        grade: setting("weatherGrade"),
        heat: setting("weatherGrade") && w?.temp === 2 && q === 1 && (w?.precip ?? 0) === 0
      });
    } else setWorldFx(null);
    if (w && game.user.isGM && ctx?.isActiveGM?.()) promptDouse(w);

    if (!setting("weatherFx") || !synced) return setWeatherFx(null);
    if (!w) return setWeatherFx(sky.eclipse ? { precip: 0, wind: 0, fog: 0, quarter: q, eclipse: sky.eclipse } : null);
    const fogNow = w.fog === 2 ? 2 : (w.fog === 1 && q === 0 ? 1 : 0);
    setWeatherFx({
      precip: w.precip, snow: w.snow, storm: w.storm, wind: w.wind, fog: fogNow, season: w.season, quarter: q,
      clouds: w.precip === 1 ? 1 : w.precip >= 2 ? 2 : 0,
      hail: !!w.hail,
      ...windParticles(w, q),
      ...sky,
      dust: w.precip === 0 && w.wind >= 2 && (
        (w.season === "ete" && ["plaine", "collines"].includes(w.region)) || (w.region === "ruines" && w.season !== "hiver"))
    });
  } catch (err) {
    console.error("fl-temps | météo", err);
  }
}

/* -------------------------------------------- */
/*  Éclipses                                    */
/* -------------------------------------------- */

/** Pour le MJ : une éclipse dans les 10 prochains jours ? */
function eclipseNote() {
  const d0 = today();
  for (let k = 0; k <= 10; k++) {
    const e = eclipseOn(d0 + k, ctx.getConfig());
    if (!e) continue;
    const what = e === "solaire" ? "Éclipse de soleil (en Journée)" : "Lune de sang (la Nuit, si le ciel est dégagé)";
    return k === 0 ? `${what} aujourd'hui` : `${what} dans ${k} jour${k > 1 ? "s" : ""}`;
  }
  return "";
}

const ECLIPSE_TEXT = {
  solaire: [
    "En plein jour, une ombre ronde mord le soleil. La lumière devient grise et froide, les oiseaux se taisent, les bêtes se couchent. Les anciens se signent et murmurent le nom de Rust.",
    "Le soleil s'éteint lentement, comme une braise qu'on étouffe. Une nuit sans étoiles tombe en plein midi. Dans les Contrées, nul ne se souvient d'un bon présage né d'un tel jour.",
    "La lumière se retire du monde. Le soleil n'est plus qu'un anneau pâle dans un ciel de cendre. Les chiens hurlent, et le vent lui-même semble retenir son souffle."
  ],
  lunaire: [
    "La pleine lune se teinte de sang. Une lumière rouge et malade baigne la terre, et les vieux parlent à voix basse de la Brume Écarlate.",
    "Une ombre glisse sur la lune et la noie de rouge. Cette nuit, les loups ne hurlent pas, et c'est pire encore.",
    "La lune devient rouge comme une plaie ouverte. Les démons, dit-on, regardent le monde par cet œil sanglant."
  ]
};
function announceEclipse(kind) {
  const key = `${today()}-${kind}`;
  if (setting("eclipseSaid") === key) return;
  game.settings.set(MOD, "eclipseSaid", key);
  const list = ECLIPSE_TEXT[kind];
  const text = list[today() % list.length];
  ChatMessage.create({
    content: `<div class="flt-chat flt-weather-card"><h3><i class="fa-solid ${kind === "solaire" ? "fa-sun" : "fa-moon"}"></i> ${kind === "solaire" ? "Éclipse de soleil" : "Lune de sang"}</h3><p class="flt-wphrase">${esc(text)}</p></div>`,
    speaker: { alias: "Le Ciel" }
  });
}

/* -------------------------------------------- */
/*  Torches sous la pluie                       */
/* -------------------------------------------- */

const TORCHY = new Set(["torch", "flame", "fire", "candlelight"]);
function litTorches() {
  return (canvas.tokens?.placeables ?? []).filter((t) => {
    const l = t.document.light;
    return l && (l.dim > 0 || l.bright > 0) && TORCHY.has(l.animation?.type);
  });
}

function promptDouse(w) {
  if (!setting("weatherTorchPrompt") || !(w.precip === 3 && !w.snow)) return;
  const key = `${today()}-${canvas.scene?.id}`;
  if (setting("dousePrompted") === key) return;
  const lit = litTorches();
  if (!lit.length) return;
  game.settings.set(MOD, "dousePrompted", key);
  const rows = lit.map((t) => `<li>${esc(t.name)} <button type="button" data-flt-douse="${t.id}"><i class="fa-solid fa-fire-flame-simple"></i> Éteindre</button></li>`).join("");
  ChatMessage.create({
    content: `<div class="flt-chat flt-douse"><h3><i class="fa-solid fa-cloud-showers-heavy"></i> L'averse et les torches</h3>
      <p>La pluie bat les flammes. Ces torches risquent de s'éteindre :</p><ul>${rows}</ul>
      <p><button type="button" data-flt-douse="all"><i class="fa-solid fa-droplet"></i> Les éteindre toutes</button>
      <button type="button" data-flt-relight="all"><i class="fa-solid fa-fire"></i> Tout rallumer</button></p></div>`,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    speaker: { alias: "Le Temps" }
  });
}

async function douse(token) {
  const l = token.document.light;
  if (!(l.dim > 0 || l.bright > 0)) return;
  await token.document.update({ "light.dim": 0, "light.bright": 0, [`flags.${MOD}.doused`]: { dim: l.dim, bright: l.bright } });
}
async function relight(token) {
  const saved = token.document.getFlag(MOD, "doused");
  if (!saved) return;
  await token.document.update({ "light.dim": saved.dim, "light.bright": saved.bright, [`flags.${MOD}.-=doused`]: null });
}

function bindDouseButtons(msg, html) {
  if (!game.user.isGM || !html?.querySelectorAll) return;
  for (const b of html.querySelectorAll("[data-flt-douse], [data-flt-relight]")) {
    if (b.dataset.bound) continue;
    b.dataset.bound = "1";
    b.addEventListener("click", async () => {
      const id = b.dataset.fltDouse ?? b.dataset.fltRelight;
      const tokens = id === "all" ? (b.dataset.fltRelight ? canvas.tokens.placeables.filter((t) => t.document.getFlag(MOD, "doused")) : litTorches())
        : [canvas.tokens.get(id)].filter(Boolean);
      for (const t of tokens) await (b.dataset.fltRelight ? relight(t) : douse(t));
      ui.notifications.info(b.dataset.fltRelight ? "Torches rallumées." : "Torches éteintes par la pluie.");
    });
  }
}
