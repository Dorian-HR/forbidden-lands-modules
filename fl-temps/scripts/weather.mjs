/**
 * Météo des Contrées (logique pure, sans Foundry).
 *
 * Inspirée des tables du Livre des Bêtes (vent, précipitations, température) mais adaptée :
 *  - à la saison et au terrain, d'après le climat de l'Europe du Nord (tempéré froid à boréal) ;
 *  - avec une persistance d'un jour à l'autre, et pas trop de jours de pluie d'affilée ;
 *  - avec le brouillard (lacs, marécages, tourbières) et les orages.
 *
 * Valeurs :
 *  precip : 0 dégagé · 1 couvert · 2 bruine/neige légère · 3 averse/neige forte
 *  wind   : 0 calme · 1 brise · 2 coups de vent · 3 tempête
 *  temp   : -2 glacial · -1 froid · 0 doux · 1 chaud · 2 canicule
 *  fog    : 0 aucun · 1 brume du matin · 2 brouillard épais (toute la journée)
 */
import { PHRASES, REGION_PHRASES } from "./weather-phrases.mjs";

export const REGIONS = {
  plaine: { label: "Plaine", wet: 1.0, wind: 1.25, temp: 0, fog: 0.8 },
  foret: { label: "Forêt", wet: 1.0, wind: 0.7, temp: 0, fog: 1.0 },
  foret_dense: { label: "Forêt dense", wet: 1.1, wind: 0.45, temp: 0, fog: 1.4 },
  collines: { label: "Collines", wet: 1.05, wind: 1.2, temp: 0, fog: 1.0 },
  montagne: { label: "Montagne", wet: 1.3, wind: 1.6, temp: -1, fog: 1.3 },
  lac: { label: "Lac", wet: 1.15, wind: 1.3, temp: 0, fog: 2.2 },
  marecages: { label: "Marécages", wet: 1.2, wind: 0.9, temp: 0.3, fog: 2.5 },
  tourbiere: { label: "Tourbière", wet: 1.25, wind: 1.1, temp: -0.4, fog: 2.8 },
  ruines: { label: "Ruines", wet: 1.0, wind: 1.0, temp: 0, fog: 1.2 }
};

const PRECIP = { printemps: [32, 40, 19, 9], ete: [44, 34, 12, 10], automne: [26, 40, 23, 11], hiver: [34, 42, 16, 8] };
const WIND = { printemps: [32, 46, 17, 5], ete: [40, 45, 12, 3], automne: [28, 44, 21, 7], hiver: [30, 44, 20, 6] };
const TEMP = { hiver: [11, 52, 35, 2, 0], printemps: [3, 24, 60, 12, 1], ete: [0, 5, 58, 31, 6], automne: [4, 34, 54, 7, 1] };
const FOG = { printemps: 0.12, ete: 0.06, automne: 0.2, hiver: 0.12 };

export const LABELS = {
  precip: ["Ciel dégagé", "Couvert", "Bruine", "Averse"],
  precipSnow: ["Ciel dégagé", "Couvert", "Neige légère", "Forte neige"],
  wind: ["Calme", "Brise", "Coups de vent", "Tempête"],
  temp: ["Glacial", "Froid", "Doux", "Chaud", "Canicule"],
  fog: ["", "Brume matinale", "Brouillard épais"]
};
export const ICONS = {
  precip: ["fa-sun", "fa-cloud", "fa-cloud-rain", "fa-cloud-showers-heavy"],
  precipSnow: ["fa-sun", "fa-cloud", "fa-snowflake", "fa-snowflake"],
  wind: ["fa-leaf", "fa-wind", "fa-wind", "fa-tornado"],
  temp: ["fa-temperature-empty", "fa-temperature-quarter", "fa-temperature-half", "fa-temperature-three-quarters", "fa-temperature-full"]
};

/* -------------------------------------------- */
/*  Hasard reproductible (même jour = même météo) */
/* -------------------------------------------- */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(weights, r) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    if ((x -= weights[i]) < 0) return i;
  }
  return weights.length - 1;
}

/** Décale une distribution de température vers le froid (shift < 0) ou le chaud (shift > 0). */
function shiftTemp(w, shift) {
  let out = [...w];
  const steps = Math.abs(shift);
  for (let s = 0; s < Math.ceil(steps); s++) {
    const f = Math.min(1, steps - s) * 0.6;
    const n = out.map(() => 0);
    for (let i = 0; i < out.length; i++) {
      const j = Math.max(0, Math.min(out.length - 1, i + Math.sign(shift)));
      n[i] += out[i] * (1 - f);
      n[j] += out[i] * f;
    }
    out = n;
  }
  return out;
}

/**
 * Génère la météo d'un jour.
 * @param {object} p { day, season, region, prev (météo de la veille ou null), prev2 (avant-veille), seed }
 */
/** Réglages du MJ (en %, 100 = normal) : rain, wind, fog, storm, extreme. */
export const DEFAULT_TUNING = { rain: 100, wind: 100, fog: 100, storm: 100, extreme: 100 };

export function generate({ day, season, region, prev = null, prev2 = null, seed = 0, tuning = DEFAULT_TUNING }) {
  const R = REGIONS[region] ?? REGIONS.plaine;
  const T = (k) => Math.max(0, (tuning?.[k] ?? 100) / 100);
  const r = rng((day * 2654435761) ^ seed ^ (region.length * 97));

  // Précipitations : persistance + pas plus de 2 jours de pluie d'affilée en général
  let pw = [...PRECIP[season]];
  pw[2] *= R.wet * T("rain"); pw[3] *= R.wet * T("rain");
  if (region === "montagne") pw[0] *= 0.85;
  const rainy = (w) => w && w.precip >= 2;
  if (rainy(prev) && rainy(prev2)) { pw[2] *= 0.35 * Math.max(1, T("rain")); pw[3] *= 0.25 * Math.max(1, T("rain")); }     // deux jours de pluie : on éclaircit
  let precip;
  if (prev && r() < (prev.precip >= 2 ? 0.35 : 0.45)) {
    precip = Math.max(0, Math.min(3, prev.precip + (r() < 0.5 ? 0 : (r() < 0.6 ? -1 : 1))));
    if (rainy(prev) && rainy(prev2) && r() > (T("rain") - 1) * 0.5) precip = Math.min(precip, 1);
  } else precip = pick(pw, r);
  // le réglage du MJ s'applique aussi quand la météo prolonge celle de la veille
  const kr = T("rain");
  if (precip >= 2 && kr < 1 && r() > Math.min(1, kr * 1.3)) precip = 1;
  else if (precip < 2 && kr > 1 && r() < (kr - 1) * 0.17) precip = r() < 0.7 ? 2 : 3;

  // Vent
  let ww = [...WIND[season]];
  ww[2] *= R.wind * T("wind"); ww[3] *= R.wind * R.wind * T("wind"); ww[0] /= R.wind;
  let wind = pick(ww, r);
  if (prev && r() < 0.4) wind = Math.round((wind + prev.wind) / 2);
  if (prev?.wind === 3 && wind === 3 && r() < 0.6) wind = 2; // une tempête dure rarement deux jours

  // Température (relative à la saison) ; la pluie et le vent rafraîchissent un peu
  let tw = shiftTemp(TEMP[season], R.temp + (precip >= 2 ? -0.3 : 0) + (wind >= 2 ? -0.2 : 0));
  tw[0] *= T("extreme"); tw[4] *= T("extreme");
  let temp = pick(tw, r) - 2;
  if (prev && r() < 0.5) temp = Math.trunc((temp + prev.temp) / 2); // tendance de la veille, sans dériver vers les extrêmes
  if (season === "hiver") temp = Math.min(temp, 0);
  if (season === "ete") temp = Math.max(temp, -1);
  if (T("extreme") === 0) temp = Math.max(-1, Math.min(1, temp));

  // Neige ou pluie
  const snow = precip >= 2 && (
    (season === "hiver" && temp <= 0) ||
    (season !== "ete" && temp <= -1) ||
    (region === "montagne" && (season === "ete" ? temp <= -1 : temp <= 0)));

  // Orage (pluie forte par temps doux ou chaud)
  const storm = precip === 3 && !snow && temp >= 0 && season !== "hiver" && r() < Math.min(1, (season === "ete" ? 0.7 : 0.35) * T("storm"));
  if (storm && wind < 2) wind = 2;

  // Brouillard (seulement sans vent fort)
  let fog = 0;
  if (wind <= 1 && r() < Math.min(0.9, FOG[season] * R.fog * T("fog"))) fog = r() < 0.25 ? 2 : 1;
  if (precip === 0 && fog === 2) precip = 1; // un brouillard épais cache le ciel

  const phraseSeed = Math.floor(r() * 1e6);

  // Météo rare
  // grêle : surtout dans les orages de printemps et d'été
  const hail = precip === 3 && !snow && ["printemps", "ete"].includes(season) &&
    r() < Math.min(1, (storm ? 0.2 : 0.04) * T("storm"));
  // nuit glaciale : ciel clair d'hiver (ou de fin d'automne froide), le froid tombe d'un coup à la nuit
  const coldNight = precip === 0 && wind <= 1 && temp > -2 && (season === "hiver" || (season === "automne" && temp <= -1)) &&
    r() < Math.min(1, 0.22 * T("extreme"));

  return { day, season, region, precip, wind, temp, fog, snow, storm, hail, coldNight, phraseSeed };
}

/* -------------------------------------------- */
/*  Effets de jeu (Livre des Bêtes + règles maison) */
/* -------------------------------------------- */

/**
 * Modificateurs et jets imposés par la météo.
 * @param {number} quarterIndex 0 Matin … 3 Nuit (la brume matinale ne gêne qu'au Matin)
 */
export function effects(w, quarterIndex = 0) {
  if (!w) return { mods: [], endurance: [] };
  const mods = [];
  const add = (ids, value, name) => value && mods.push({ ids, value, name });
  const fogNow = w.fog === 2 || (w.fog === 1 && quarterIndex === 0);

  // Ouvrir la marche : précipitations (Livre des Bêtes) + brouillard (maison)
  add(["travel-navigate"], [1, 0, -1, -2][w.precip], `Météo : ${label(w, "precip").toLowerCase()}`);
  if (fogNow) add(["travel-navigate"], -1, `Météo : ${LABELS.fog[w.fog].toLowerCase()}`);
  // Préparer le camp : vent (Livre des Bêtes)
  add(["travel-make-camp"], [1, 0, -1, -2][w.wind], `Météo : ${LABELS.wind[w.wind].toLowerCase()}`);
  // Tir : averse, tempête, brouillard épais (maison)
  if (w.precip === 3) add(["marksmanship"], -1, `Météo : ${label(w, "precip").toLowerCase()}`);
  if (w.wind === 3) add(["marksmanship"], -1, "Météo : tempête");
  if (w.fog === 2) add(["marksmanship"], -1, "Météo : brouillard épais");

  // Jets d'Endurance par Quart (Livre des Bêtes)
  const endurance = [];
  if (w.wind === 3 && w.precip === 3) endurance.push({ when: "march", text: "Tempête et averse : un seul jet d'ENDURANCE à –2 pour continuer à avancer.", mod: -2 });
  else if (w.wind === 3) endurance.push({ when: "march", text: "Tempête : jet d'ENDURANCE pour continuer à avancer." });
  else if (w.precip === 3) endurance.push({ when: "march", text: `${label(w, "precip")} : jet d'ENDURANCE pour continuer à avancer.` });
  if (w.temp === 2) endurance.push({ when: "march", text: "Canicule : jet d'ENDURANCE pour ne pas devenir ASSOIFFÉ." });
  if (w.temp === -2) endurance.push({ when: "outside", text: "Froid glacial : jet d'ENDURANCE hors du camp pour ne pas devenir GLACÉ." });
  if (w.hail) endurance.push({ when: "outside", text: "Grêle : qui reste à découvert fait un jet d'ENDURANCE ou subit 1 point de dégât." });
  if (w.coldNight && w.temp > -2 && quarterIndex === 3) endurance.push({ when: "outside", text: "Nuit glaciale : jet d'ENDURANCE pour ne pas devenir GLACÉ, sauf au chaud près d'un feu." });
  return { mods, endurance };
}

export function label(w, kind) {
  if (kind === "precip") return w.storm ? "Orage" : (w.snow ? LABELS.precipSnow : LABELS.precip)[w.precip];
  if (kind === "wind") return LABELS.wind[w.wind];
  if (kind === "temp") return LABELS.temp[w.temp + 2];
  if (kind === "fog") return LABELS.fog[w.fog];
  return "";
}

export function icon(w, kind) {
  if (kind === "precip") return w.storm ? "fa-cloud-bolt" : (w.snow ? ICONS.precipSnow : ICONS.precip)[w.precip];
  if (kind === "wind") return ICONS.wind[w.wind];
  if (kind === "temp") return ICONS.temp[w.temp + 2];
  return "fa-smog";
}

/** Le ciel est-il dégagé (pour la règle de la pleine lune) ? */
export const clearSky = (w) => !w || (w.precip === 0 && w.fog !== 2);

/* -------------------------------------------- */
/*  Phrases d'ambiance                          */
/* -------------------------------------------- */

export function phrases(w, { firstSnow = false } = {}) {
  const r = rng(w.phraseSeed || w.day);
  const one = (key) => PHRASES[key][Math.floor(r() * PHRASES[key].length)];
  const out = [];
  let windSaid = false;
  if (firstSnow) out.push(one("firstsnow"));
  if (w.fog === 2) out.push(one("thickfog"));
  // précipitations (avec les combinaisons vent + pluie/neige)
  if (w.storm) { out.push(one("storm")); windSaid = true; }
  else if (w.snow && w.precip === 3 && w.wind >= 2) { out.push(one("blizzard")); windSaid = true; }
  else if (!w.snow && w.precip === 3 && w.wind >= 2) { out.push(one("rainwind")); windSaid = true; }
  else if (w.precip >= 2) out.push(one(w.snow ? (w.precip === 3 ? "snow" : "drizzle_snow") : (w.precip === 3 ? "rain" : "drizzle_rain")));
  else if (w.fog !== 2) {
    if (w.fog === 1) out.push(one("mist")); // la brume du matin, puis le ciel de la journée
    out.push(one(w.precip === 0 ? "clear" : "cloudy"));
  }
  if (w.fog === 1 && w.precip >= 2) out.push(one("mist"));
  if (w.hail) out.push(one("hail"));
  // vent
  if (!windSaid) {
    if (w.wind === 3) out.push(one("gale"));
    else if (w.wind === 2) out.push(one("gusts"));
    else if (out.length < 2) out.push(one(w.wind === 0 ? "calm" : "breeze"));
  }
  // température
  if (w.coldNight && w.temp > -2) out.push(one("coldnight"));
  else if (w.temp === -2) out.push(one("glacial"));
  else if (w.temp === 2) out.push(one("scorching"));
  else if (w.temp === 1 && w.season === "ete") out.push(one("hot"));
  else if (w.temp === -1 && out.length < 3) out.push(one("cold"));
  else if (out.length < 2 && w.precip <= 1 && w.wind <= 1) out.push(one("mild")); // pas de « temps doux » sous l'averse
  // une ligne propre au terrain, une fois sur deux
  const reg = REGION_PHRASES[w.region];
  if (reg && r() < 0.5) out.push(reg[Math.floor(r() * reg.length)]);
  return out;
}
