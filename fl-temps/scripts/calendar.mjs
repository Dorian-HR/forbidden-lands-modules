/**
 * Logique pure du temps (aucune dépendance à Foundry), selon l'Almanach des Contrées Interdites.
 *
 * Année de 360 jours : 8 blocs de 45 jours = 1 jour de fête (hors semaine) + 1 mois de 44 jours
 * (4 semaines de 11 jours). worldTime = 0 correspond au début du Matin de la Mi-hiver de l'année de départ.
 */
import { WEEKDAYS, MONTHS, FEASTS } from "./almanach.mjs";

export const SECONDS_PER_DAY = 86400;
export const QUARTER = 21600; // 6 heures
export const TOUR = 900; // un tour = 15 minutes
export const TOURS_PER_QUARTER = QUARTER / TOUR; // 24
export const DAY_START_HOUR = 6;

export const DAYS_PER_MONTH = 44;
export const DAYS_PER_WEEK = 11;
export const BLOCK = DAYS_PER_MONTH + 1; // fête + mois
export const YEAR_LENGTH = BLOCK * MONTHS.length; // 360

export const QUARTERS = [
  { key: "matin", label: "Matin", icon: "fa-solid fa-cloud-sun" },
  { key: "journee", label: "Journée", icon: "fa-solid fa-sun" },
  { key: "soiree", label: "Soirée", icon: "fa-solid fa-cloud-moon" },
  { key: "nuit", label: "Nuit", icon: "fa-solid fa-moon" }
];

export const SEASONS = {
  printemps: { label: "Printemps", icon: "fa-solid fa-seedling" },
  ete: { label: "Été", icon: "fa-solid fa-sun" },
  automne: { label: "Automne", icon: "fa-solid fa-leaf" },
  hiver: { label: "Hiver", icon: "fa-solid fa-snowflake" }
};

/** Tableau LUMINOSITÉ (Manuel du joueur) — Matin, Journée, Soirée, Nuit. */
export const LIGHT_TABLE = {
  printemps: [true, true, false, false],
  ete: [true, true, true, false],
  automne: [true, true, false, false],
  hiver: [false, true, false, false]
};

export const MOON_PHASES = [
  "Nouvelle lune", "Premier croissant", "Premier quartier", "Lune gibbeuse croissante",
  "Pleine lune", "Lune gibbeuse décroissante", "Dernier quartier", "Dernier croissant"
];

/** Almanach : la première pleine lune de 1165 tombe le 7 de Thaw (jour n° 7 de l'année, la Mi-hiver étant le n° 0). */
export const ALMANAC_YEAR = 1165;
export const ALMANAC_FIRST_FULL_MOON = 7.5; // instant de la pleine lune, au milieu du 7 de Thaw

export const DEFAULT_CONFIG = {
  startYear: 1165,
  moonCycle: 29.530588, // mois synodique : reproduit exactement le tableau des lunes de 1165 de l'almanach
  moonOffset: 0,
  dayDarkness: 0,
  nightDarknessNewMoon: 1,
  nightDarknessFullMoon: 0.7,
  transitionMinutes: 90
};

const mod = (n, m) => ((n % m) + m) % m;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const ordinal = (n) => (n === 1 ? "1re" : `${n}e`);

export function absoluteDay(worldTime) {
  return Math.floor(worldTime / SECONDS_PER_DAY);
}

/** Décompose un jour absolu en date de l'almanach. */
export function dateFromDay(day, cfg = DEFAULT_CONFIG) {
  const yearIndex = Math.floor(day / YEAR_LENGTH);
  const doy = mod(day, YEAR_LENGTH);
  const monthIndex = Math.floor(doy / BLOCK);
  const r = doy % BLOCK;
  const month = MONTHS[monthIndex];
  const year = cfg.startYear + yearIndex;
  const blockStart = day - r; // jour absolu de la fête qui ouvre ce mois

  const base = {
    year, dayOfYear: doy + 1, monthIndex, month, season: month.season,
    blockStart, monthFirstDay: blockStart + 1, monthLastDay: blockStart + DAYS_PER_MONTH
  };

  if (r === 0) {
    const feast = FEASTS[monthIndex];
    return {
      ...base, isFeast: true, feastIndex: monthIndex, feast, dayOfMonth: 0, weekday: null, weekdayIndex: null, week: null,
      isDeuil: false, label: `${feast.name} ${year}`, shortLabel: feast.name
    };
  }
  const dayOfMonth = r;
  const weekdayIndex = (dayOfMonth - 1) % DAYS_PER_WEEK;
  const week = Math.floor((dayOfMonth - 1) / DAYS_PER_WEEK) + 1;
  const weekday = WEEKDAYS[weekdayIndex];
  return {
    ...base, isFeast: false, feastIndex: null, feast: null, dayOfMonth, weekdayIndex, weekday, week,
    isDeuil: weekdayIndex === DAYS_PER_WEEK - 1,
    weekLabel: `${ordinal(week)} semaine`,
    label: `${weekday}, ${ordinal(week)} semaine de ${month.name} ${year}`,
    shortLabel: `${weekday} ${dayOfMonth} ${month.name}`
  };
}

/** Jour absolu depuis (année, mois 0-7, jour du mois 1-44 ; 0 = fête qui ouvre le mois). */
export function dayFromDate(year, monthIndex, dayOfMonth, cfg = DEFAULT_CONFIG) {
  return (year - cfg.startYear) * YEAR_LENGTH + monthIndex * BLOCK + dayOfMonth;
}

export function worldTimeFromDate(year, monthIndex, dayOfMonth, quarterIndex = 0, cfg = DEFAULT_CONFIG) {
  return dayFromDate(year, monthIndex, dayOfMonth, cfg) * SECONDS_PER_DAY + quarterIndex * QUARTER;
}

/** Prochaine fête après le jour donné. */
export function nextFeast(day, cfg = DEFAULT_CONFIG) {
  const doy = mod(day, YEAR_LENGTH);
  const r = doy % BLOCK;
  const inDays = BLOCK - r;
  const idx = (Math.floor(doy / BLOCK) + 1) % FEASTS.length;
  return { index: idx, feast: FEASTS[idx], inDays, month: MONTHS[idx] };
}

/* -------------------------------------------- */
/*  Lune                                        */
/* -------------------------------------------- */

/** Instant (en jours absolus) d'une pleine lune de référence. */
function fullMoonRef(cfg) {
  return (ALMANAC_YEAR - cfg.startYear) * YEAR_LENGTH + ALMANAC_FIRST_FULL_MOON + (cfg.moonOffset || 0);
}

/** Fraction du cycle lunaire (0 = nouvelle lune, 0.5 = pleine lune). */
export function moonPhaseAt(dayFloat, cfg = DEFAULT_CONFIG) {
  return mod((dayFloat - fullMoonRef(cfg)) / cfg.moonCycle + 0.5, 1);
}

export function moonIllumination(p) {
  return (1 - Math.cos(2 * Math.PI * p)) / 2;
}

export function moonPhaseIndex(p) {
  return Math.floor(p * 8 + 0.5) % 8;
}

/** La pleine lune (ou la nouvelle lune) a-t-elle lieu pendant le jour absolu `day` ? */
function eventOnDay(day, ref, cfg) {
  const P = cfg.moonCycle;
  const k = Math.round((day + 0.5 - ref) / P);
  for (const kk of [k - 1, k, k + 1]) {
    if (Math.floor(ref + kk * P + 1e-9) === day) return true;
  }
  return false;
}

export function isFullMoonDay(day, cfg = DEFAULT_CONFIG) {
  return eventOnDay(day, fullMoonRef(cfg), cfg);
}

export function isNewMoonDay(day, cfg = DEFAULT_CONFIG) {
  return eventOnDay(day, fullMoonRef(cfg) + cfg.moonCycle / 2, cfg);
}

/**
 * Éclipse ce jour-là ? Rares et liées à la vraie lune du calendrier :
 * éclipse de soleil un jour de nouvelle lune (environ une fois par an),
 * éclipse de lune (lune de sang) une nuit de pleine lune (un peu plus d'une fois par an).
 * @returns {"solaire"|"lunaire"|null}
 */
export function eclipseOn(day, cfg = DEFAULT_CONFIG) {
  const P = cfg.moonCycle, ref = fullMoonRef(cfg);
  const hash = (k, salt) => (Math.imul(k + salt, 2654435761) >>> 0) % 1000;
  if (isNewMoonDay(day, cfg)) {
    const k = Math.round((day + 0.5 - ref - P / 2) / P);
    if (hash(k, 7) < 80) return "solaire";
  }
  if (isFullMoonDay(day, cfg)) {
    const k = Math.round((day + 0.5 - ref) / P);
    if (hash(k, 3) < 115) return "lunaire";
  }
  return null;
}

export function fullMoonDays(fromDay, toDay, cfg = DEFAULT_CONFIG) {
  const out = [];
  for (let d = fromDay; d <= toDay; d++) if (isFullMoonDay(d, cfg)) out.push(d);
  return out;
}

export function newMoonDays(fromDay, toDay, cfg = DEFAULT_CONFIG) {
  const out = [];
  for (let d = fromDay; d <= toDay; d++) if (isNewMoonDay(d, cfg)) out.push(d);
  return out;
}

/* -------------------------------------------- */
/*  Soleil, luminosité, aube & crépuscule       */
/* -------------------------------------------- */

export function sunLevel(s, season, cfg = DEFAULT_CONFIG) {
  const table = LIGHT_TABLE[season];
  const first = table.indexOf(true);
  const last = table.lastIndexOf(true);
  const rise = first * QUARTER;
  const set = (last + 1) * QUARTER;
  const T = Math.max(1, cfg.transitionMinutes * 60);

  if (s >= set - T && s < set) {
    const t = (set - s) / T;
    return { level: smooth(t), mode: "dusk", progress: 1 - t };
  }
  if (s >= rise && s < set - T) return { level: 1, mode: "day", progress: 0 };
  let untilRise = rise - s;
  if (untilRise <= 0) untilRise += SECONDS_PER_DAY;
  if (untilRise <= T) {
    const t = 1 - untilRise / T;
    return { level: smooth(t), mode: "dawn", progress: t };
  }
  return { level: 0, mode: "night", progress: 0 };
}

export function computeState(worldTime, cfg = DEFAULT_CONFIG) {
  const day = absoluteDay(worldTime);
  const s = mod(worldTime, SECONDS_PER_DAY);
  const date = dateFromDay(day, cfg);
  const season = date.season;
  const quarterIndex = Math.floor(s / QUARTER);
  const inQuarter = s - quarterIndex * QUARTER;
  const tour = Math.floor(inQuarter / TOUR) + 1;
  const isLight = LIGHT_TABLE[season][quarterIndex];

  const hourFloat = mod(s / 3600 + DAY_START_HOUR, 24);
  const hh = Math.floor(hourFloat);
  const mm = Math.floor((hourFloat - hh) * 60);

  const moonP = moonPhaseAt(day + s / SECONDS_PER_DAY, cfg);
  const illum = moonIllumination(moonP);
  const moonIdx = moonPhaseIndex(moonP);
  // « Pleine lune » / « Nouvelle lune » : à moins d'un jour de l'instant exact.
  // C'est aussi la fenêtre des règles de pleine lune (2 nuits : celle qui précède et celle qui suit).
  const daysFromFull = Math.abs(moonP - 0.5) * cfg.moonCycle;
  const daysFromNew = Math.min(moonP, 1 - moonP) * cfg.moonCycle;
  const nearFull = daysFromFull <= 1;
  const nearNew = daysFromNew <= 1;
  let moonName;
  if (nearFull) moonName = MOON_PHASES[4];
  else if (nearNew) moonName = MOON_PHASES[0];
  else if (moonIdx === 4) moonName = moonP < 0.5 ? MOON_PHASES[3] : MOON_PHASES[5];
  else if (moonIdx === 0) moonName = moonP < 0.5 ? MOON_PHASES[1] : MOON_PHASES[7];
  else moonName = MOON_PHASES[moonIdx];

  const sun = sunLevel(s, season, cfg);
  const nightDark = lerp(cfg.nightDarknessNewMoon, cfg.nightDarknessFullMoon, illum);
  const darkness = clamp(lerp(nightDark, cfg.dayDarkness, sun.level));

  // Pleines lunes du mois en cours (le jour de fête compte avec le mois qu'il ouvre)
  const fullMoons = fullMoonDays(date.monthFirstDay, date.monthLastDay, cfg);
  const isFullToday = isFullMoonDay(day, cfg);

  // Deux comptes des jours : les Sœurs du Corbeau fêtent 4 ou 5 jours après les Frères
  const crowFeast = !date.isFeast && (date.dayOfMonth === 4 || date.dayOfMonth === 5) ? FEASTS[date.monthIndex] : null;

  const fullMoonNight = nearFull && !isLight;
  // Règle maison : chercher à manger dans l'obscurité dépend de la lune :
  // 0 à la pleine lune, −1 aux quartiers, −2 à la nouvelle lune (progressif selon la part éclairée).
  const moonForage = -Math.round(2 * (1 - illum)) || 0;
  const forageDark = isLight ? 0 : moonForage;

  return {
    worldTime, day, secondsInDay: s, date, season,
    forageDark,
    seasonLabel: SEASONS[season].label,
    forage: date.month.forage,
    quarterIndex, quarter: QUARTERS[quarterIndex],
    tour, toursPerQuarter: TOURS_PER_QUARTER, quarterProgress: inQuarter / QUARTER,
    time: `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`,
    isLight, lightRow: LIGHT_TABLE[season], sun,
    nextFeast: nextFeast(day, cfg),
    crowFeast,
    moon: {
      phase: moonP, illumination: illum, index: moonIdx, name: moonName, isFull: nearFull, isNew: nearNew,
      isFullToday, isNewToday: isNewMoonDay(day, cfg),
      fullMoonsThisMonth: fullMoons,
      omen: fullMoons.length >= 2,
      // Règle maison : nuit de pleine lune, le −2 d'obscurité passe à −1 (par ciel dégagé)
      fullMoonNight
    },
    darkness
  };
}

/* -------------------------------------------- */
/*  Teinte d'aube / de crépuscule               */
/* -------------------------------------------- */

export function ambientTint(state, nightTint = true) {
  const { mode, progress } = state.sun;
  if (mode === "dawn") return { color: "255, 150, 110", alpha: 0.38 * Math.sin(Math.PI * progress) };
  if (mode === "dusk") return { color: "255, 105, 40", alpha: 0.45 * Math.sin(Math.PI * progress) };
  if (mode === "night" && nightTint) return { color: "70, 90, 170", alpha: 0.1 + 0.08 * state.moon.illumination };
  return { color: "0, 0, 0", alpha: 0 };
}

/* -------------------------------------------- */
/*  Icône SVG de la lune                        */
/* -------------------------------------------- */

export function moonSVG(p, size = 44) {
  const r = 18, cx = 22, cy = 22;
  const k = Math.cos(2 * Math.PI * p);
  const rx = Math.max(0.01, Math.abs(k) * r).toFixed(2);
  const top = `${cx},${cy - r}`, bottom = `${cx},${cy + r}`;
  const d = p < 0.5
    ? `M${top} A${r},${r} 0 0 1 ${bottom} A${rx},${r} 0 0 ${k > 0 ? 0 : 1} ${top} Z`
    : `M${top} A${r},${r} 0 0 0 ${bottom} A${rx},${r} 0 0 ${k > 0 ? 1 : 0} ${top} Z`;
  return `<svg class="flt-moon-svg" viewBox="0 0 44 44" width="${size}" height="${size}" aria-hidden="true">
    <defs><radialGradient id="flt-moonlit" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#d9cfae"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1d2233" stroke="#5b6480" stroke-width="1"/>
    <path d="${d}" fill="url(#flt-moonlit)"/>
  </svg>`;
}
