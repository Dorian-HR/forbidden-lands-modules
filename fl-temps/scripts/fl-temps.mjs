import {
  QUARTER, TOUR, SECONDS_PER_DAY, QUARTERS, SEASONS, DEFAULT_CONFIG, DAYS_PER_MONTH, YEAR_LENGTH, BLOCK,
  computeState, worldTimeFromDate, dateFromDay, ambientTint, moonSVG
} from "./calendar.mjs";
import { WEEKDAYS, MONTHS, FEASTS, MOON_CUSTOMS, RULES, OMENS, omenFor } from "./almanach.mjs";
import {
  registerAutomationSettings, installAutomation, addEffects, removeEffect, activeEffects, pruneEffects,
  noDarkness, rollHikeInDarkness, time
} from "./automation.mjs";
import {
  registerWeatherSettings, initWeather, ensureWeather, setRegion, rerollWeather, chooseWeatherDialog, announceWeather,
  weatherContext, weatherMods, enduranceReminders, refreshWeatherFx, clearWeatherFx, skyIsClear, weatherOn
} from "./weather-control.mjs";
import { setSoundVolume } from "./weather-sound.mjs";

const MOD = "fl-temps";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* -------------------------------------------- */
/*  Réglages                                    */
/* -------------------------------------------- */

function setting(key) {
  return game.settings.get(MOD, key);
}

function getConfig() {
  return {
    ...DEFAULT_CONFIG,
    startYear: Number(setting("startYear")) || DEFAULT_CONFIG.startYear,
    moonCycle: Number(setting("moonCycle")) || DEFAULT_CONFIG.moonCycle,
    moonOffset: Number(setting("moonOffset")) || 0,
    nightDarknessNewMoon: Number(setting("nightDarknessNewMoon")),
    nightDarknessFullMoon: Number(setting("nightDarknessFullMoon")),
    dayDarkness: Number(setting("dayDarkness")),
    transitionMinutes: Number(setting("transitionMinutes"))
  };
}

const state = () => {
  const st = computeState(game.time.worldTime, getConfig());
  // Règle maison : la pleine lune n'éclaire que par ciel dégagé (si la météo est active)
  try { if (st.moon.fullMoonNight && !skyIsClear()) st.moon.fullMoonNight = false; } catch { /* réglages pas encore prêts */ }
  return st;
};

function registerSettings() {
  const refresh = () => {
    FLTemps.panel?.rendered && FLTemps.panel.render();
    updateTint();
    queueLightingSync(true);
  };
  const world = (key, name, hint, type, def, extra = {}) =>
    game.settings.register(MOD, key, { name, hint, scope: "world", config: true, type, default: def, onChange: refresh, ...extra });
  const client = (key, name, hint, type, def, extra = {}) =>
    game.settings.register(MOD, key, { name, hint, scope: "client", config: true, type, default: def, onChange: refresh, ...extra });

  world("startYear", "Année de départ", "Année de la Mi-hiver qui correspond à worldTime = 0.", Number, 1165);
  world("era", "Suffixe d'ère", "Texte affiché après l'année (laisser vide si inutile).", String, "après la Fracture");
  world("moonCycle", "Cycle lunaire (jours)", "29,530588 reproduit exactement le tableau des lunes de 1165 de l'almanach (1re pleine lune le 7 de Thaw).", Number, DEFAULT_CONFIG.moonCycle);
  world("moonOffset", "Décalage de la lune (jours)", "0 = lunes de l'almanach. Un nombre positif retarde les pleines lunes.", Number, 0);
  world("manageDarkness", "Gérer l'obscurité des scènes", "Le niveau d'obscurité de la scène active suit les Quarts de jour, la saison et la lune.", Boolean, true);
  world("manageGlobalLight", "Gérer l'illumination globale",
    "Tout est visible pendant les Quarts lumineux ; pendant l'obscurité, seules les sources de lumière et la vision dans le noir fonctionnent.", Boolean, true);
  world("globalLightThreshold", "Seuil de l'illumination globale", "Au-delà de ce niveau d'obscurité, l'illumination globale s'éteint.", Number, 0.5,
    { range: { min: 0.1, max: 0.95, step: 0.05 } });
  world("dayDarkness", "Obscurité de jour", "", Number, 0, { range: { min: 0, max: 0.5, step: 0.05 } });
  world("nightDarknessNewMoon", "Obscurité de nuit – nouvelle lune", "", Number, 1, { range: { min: 0.5, max: 1, step: 0.05 } });
  world("nightDarknessFullMoon", "Obscurité de nuit – pleine lune", "", Number, 0.7, { range: { min: 0.3, max: 1, step: 0.05 } });
  world("transitionMinutes", "Durée de l'aube et du crépuscule (minutes)", "", Number, 90, { range: { min: 15, max: 240, step: 15 } });
  world("animateSeconds", "Durée de l'animation de l'obscurité (secondes)", "", Number, 3, { range: { min: 0, max: 10, step: 1 } });
  world("announceQuarters", "Annoncer chaque Quart de jour dans le tchat",
    "Désactivé : pas de message à chaque Quart. Les infos d'obscurité s'affichent dans le résultat des jets concernés (Ouvrir la marche, Chercher des provisions, Chasser).", Boolean, false);
  world("announceEvents", "Annoncer les fêtes et la pleine lune", "Message public le Matin d'un jour de fête et le soir de la pleine lune.", Boolean, true);
  world("gmWhispers", "Fiches de l'almanach en privé au MJ",
    "Les jours de fête, de pleine et de nouvelle lune, de Deuil, envoie au MJ seul les coutumes des peuples et les règles maison.", Boolean, true);
  world("playersSeeMoon", "Les joueurs voient la lune", "", Boolean, true);
  world("houseRules", "Afficher les règles maison", "Pleine lune (−1 au lieu de −2), Deuil, part de la fête, présage.", Boolean, true);

  client("tint", "Teinte d'aube et de crépuscule", "Colore l'écran en rose-orangé à l'aube et rouge-orangé au coucher du soleil.", Boolean, true);
  client("nightTint", "Teinte bleutée la nuit", "", Boolean, true);
  client("autoOpen", "Ouvrir le panneau au démarrage", "", Boolean, true);
  registerAutomationSettings(refresh);
  registerWeatherSettings(refresh);
  game.settings.register(MOD, "panelPos", { scope: "client", config: false, type: Object, default: {} });
}

/* -------------------------------------------- */
/*  Contrôle du temps                           */
/* -------------------------------------------- */

const canControl = () => game.user.isGM;

async function advance(seconds) {
  if (!canControl()) return ui.notifications.warn("Seul le MJ peut faire avancer le temps.");
  if (!seconds) return;
  return game.time.advance(seconds);
}

const setWorldTime = (target) => advance(target - game.time.worldTime);

async function goToQuarter(index) {
  const t = game.time.worldTime;
  let target = Math.floor(t / SECONDS_PER_DAY) * SECONDS_PER_DAY + index * QUARTER;
  if (target <= t) target += SECONDS_PER_DAY;
  return setWorldTime(target);
}

async function nextQuarter(n = 1) {
  const start = Math.floor(game.time.worldTime / QUARTER) * QUARTER;
  return setWorldTime(start + n * QUARTER);
}

async function previousQuarter() {
  const t = game.time.worldTime;
  const start = Math.floor(t / QUARTER) * QUARTER;
  return setWorldTime(t > start ? start : start - QUARTER);
}

async function nextDay() {
  return setWorldTime((Math.floor(game.time.worldTime / SECONDS_PER_DAY) + 1) * SECONDS_PER_DAY);
}

async function setDateDialog() {
  if (!canControl()) return;
  const cfg = getConfig();
  const st = state();
  const monthOpts = MONTHS.map((m, i) =>
    `<option value="${i}" ${i === st.date.monthIndex ? "selected" : ""}>${m.name} (${m.bookPhase})</option>`).join("");
  const dayOpts = [`<option value="0" ${st.date.isFeast ? "selected" : ""}>Jour de fête (ouvre le mois)</option>`]
    .concat(Array.from({ length: DAYS_PER_MONTH }, (_, i) => {
      const d = i + 1;
      return `<option value="${d}" ${d === st.date.dayOfMonth ? "selected" : ""}>${d} – ${WEEKDAYS[(d - 1) % 11]}</option>`;
    })).join("");
  const quarterOpts = QUARTERS.map((q, i) => `<option value="${i}" ${i === st.quarterIndex ? "selected" : ""}>${q.label}</option>`).join("");
  const content = `
    <div class="flt-dialog">
      <div class="form-group"><label>Année</label><input type="number" name="year" value="${st.date.year}"></div>
      <div class="form-group"><label>Mois</label><select name="month">${monthOpts}</select></div>
      <div class="form-group"><label>Jour</label><select name="day">${dayOpts}</select></div>
      <div class="form-group"><label>Quart de jour</label><select name="quarter">${quarterOpts}</select></div>
      <p class="hint">Chaque mois est précédé de sa fête : ${FEASTS.map((f, i) => `${f.name} → ${MONTHS[i].name}`).join(", ")}.</p>
    </div>`;
  const { DialogV2 } = foundry.applications.api;
  const data = await DialogV2.prompt({
    window: { title: "Fixer la date" },
    content,
    ok: {
      label: "Valider",
      callback: (event, button) => {
        const f = button.form.elements;
        return { year: Number(f.year.value), month: Number(f.month.value), day: Number(f.day.value), quarter: Number(f.quarter.value) };
      }
    },
    rejectClose: false
  });
  if (!data) return;
  await setWorldTime(worldTimeFromDate(data.year, data.month, data.day, data.quarter, cfg));
}

/* -------------------------------------------- */
/*  Éclairage des scènes (MJ actif uniquement)  */
/* -------------------------------------------- */

function isActiveGM() {
  if (!game.user.isGM) return false;
  const active = game.users.activeGM;
  return active ? (active.isSelf ?? active.id === game.user.id) : true;
}

const sceneSynced = (scene) => !!scene && scene.getFlag(MOD, "sync") !== false;
const sceneDarkness = (scene) => scene.environment?.darknessLevel ?? scene.darkness ?? 0;

let _forceNext = false;
const _syncDebounced = foundry.utils.debounce(() => syncLighting(_forceNext).finally(() => (_forceNext = false)), 200);
function queueLightingSync(force = false) {
  if (force) _forceNext = true;
  _syncDebounced();
}

async function syncLighting(force = false) {
  if (!isActiveGM() || !setting("manageDarkness")) return;
  const scene = canvas?.scene;
  if (!sceneSynced(scene)) return;
  const st = state();
  const data = {};
  const target = Math.round(st.darkness * 1000) / 1000;
  if (force || Math.abs(sceneDarkness(scene) - target) >= 0.01) {
    if (scene.environment && "darknessLevel" in scene.environment) data["environment.darknessLevel"] = target;
    else if ("darkness" in scene) data.darkness = target;
  }
  if (setting("manageGlobalLight")) {
    const thr = Number(setting("globalLightThreshold"));
    if (scene.environment?.globalLight) {
      const gl = scene.environment.globalLight;
      if (!gl.enabled) data["environment.globalLight.enabled"] = true;
      if (gl.darkness?.max !== thr) data["environment.globalLight.darkness.max"] = thr;
    } else if ("globalLight" in scene) {
      if (!scene.globalLight) data.globalLight = true;
      if (scene.globalLightThreshold !== thr) data.globalLightThreshold = thr;
    }
  }
  if (foundry.utils.isEmpty(data)) return;
  await scene.update(data, { animateDarkness: Number(setting("animateSeconds")) * 1000 });
}

/* -------------------------------------------- */
/*  Teinte d'ambiance (client)                  */
/* -------------------------------------------- */

function tintElement() {
  let el = document.getElementById("flt-tint");
  if (!el) {
    el = document.createElement("div");
    el.id = "flt-tint";
    const board = document.getElementById("board");
    if (board) {
      board.insertAdjacentElement("afterend", el);
      const z = getComputedStyle(board).zIndex;
      el.style.zIndex = z && z !== "auto" ? z : "0";
    } else document.body.prepend(el);
  }
  return el;
}

function updateTint() {
  const el = tintElement();
  if (!setting("tint") || !setting("manageDarkness") || !sceneSynced(canvas?.scene)) {
    el.style.opacity = "0";
    return;
  }
  const t = ambientTint(state(), setting("nightTint"));
  el.style.background = `rgb(${t.color})`;
  el.style.opacity = String(Math.max(0, Math.min(1, t.alpha)));
}

/* -------------------------------------------- */
/*  Fiches de l'almanach (HTML)                 */
/* -------------------------------------------- */

const tagHTML = (tag) => `<span class="flt-tag ${tag === "Livre" ? "book" : "home"}">${tag}</span>`;

function customsHTML(list) {
  return `<ul class="flt-customs">${list.map((c) =>
    `<li><strong>${esc(c.people)}</strong> ${tagHTML(c.tag)} ${esc(c.text)} <span class="flt-ref">${esc(c.ref)}</span></li>`).join("")}</ul>`;
}

function feastCardHTML(i) {
  const f = FEASTS[i];
  const m = MONTHS[i];
  return `<div class="flt-card">
    <h3><i class="fa-solid fa-star"></i> ${esc(f.name)} <small>fête ${i + 1} sur 8</small></h3>
    <p class="flt-card-sub">${esc(f.subtitle)} · ouvre ${esc(m.name)} (${esc(m.bookPhase.toLowerCase())})</p>
    <p class="flt-book">${tagHTML("Livre")} ${esc(f.book)}</p>
    ${customsHTML(f.customs)}
    <p class="flt-none"><strong>Ne fêtent rien :</strong> ${esc(f.none)}</p>
    ${setting("houseRules") ? `<div class="flt-part"><strong>La part de la fête · règle maison</strong><br>${esc(f.part)}${FEAST_BOONS[i] ? `<br><button type="button" data-flt-boon="${i}"><i class="fa-solid fa-gift"></i> Appliquer aux personnages</button>` : ""}</div>` : ""}
    <p class="flt-inbooks"><em>Dans les livres :</em> ${esc(f.inBooks)}</p>
  </div>`;
}

function moonCardHTML(kind) {
  const full = kind === "full";
  return `<div class="flt-card">
    <h3><i class="fa-${full ? "solid" : "regular"} fa-circle"></i> ${full ? "Pleine lune" : "Nouvelle lune"}</h3>
    ${customsHTML(MOON_CUSTOMS[kind])}
    ${full && setting("houseRules") ? `<div class="flt-part"><strong>Règle maison</strong><br>${esc(RULES.fullMoonNight)}</div>` : ""}
  </div>`;
}

async function showAlmanac(i) {
  const st = state();
  const idx = Number.isInteger(i) ? i : (st.date.isFeast ? st.date.feastIndex : st.nextFeast.index);
  const nav = FEASTS.map((f, k) => `<button type="button" class="flt-nav ${k === idx ? "active" : ""}" data-feast="${k}">${esc(f.name)}</button>`).join("");
  const moons = `<div class="flt-card-row">${moonCardHTML("full")}${moonCardHTML("new")}</div>`;
  const rules = setting("houseRules")
    ? `<div class="flt-part"><strong>Règles maison</strong><br>${esc(RULES.part)}<br>${esc(RULES.forageDark)}<br>${esc(RULES.deuil)}<br>${esc(RULES.omen)}<br>${esc(RULES.twoCounts.replace(" : les fidèles du Corbeau fêtent leur fête maintenant", ""))}</div>`
    : "";
  const content = `<div class="flt-almanac"><div class="flt-navbar">${nav}</div><div class="flt-feast-holder">${feastCardHTML(idx)}</div>
    <details><summary>La lune et les règles maison</summary>${moons}${rules}</details>
    <details><summary>Les présages (1d66)</summary><p class="flt-muted">${esc(RULES.omen)}</p>${omenButton}${omenTableHTML()}</details></div>`;
  const { DialogV2 } = foundry.applications.api;
  const dlg = new DialogV2({
    window: { title: "Almanach des Contrées Interdites", icon: "fa-solid fa-book-open" },
    position: { width: 560 },
    content,
    buttons: [{ action: "close", label: "Fermer", default: true }]
  });
  await dlg.render({ force: true });
  dlg.element.querySelectorAll("[data-flt-omen]").forEach((b) => b.addEventListener("click", () => rollOmen()));
  dlg.element.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-flt-boon]");
    if (b) grantFeastBoon(Number(b.dataset.fltBoon));
  });
  dlg.element.querySelectorAll(".flt-nav").forEach((b) => b.addEventListener("click", () => {
    dlg.element.querySelector(".flt-feast-holder").innerHTML = feastCardHTML(Number(b.dataset.feast));
    dlg.element.querySelectorAll(".flt-nav").forEach((x) => x.classList.toggle("active", x === b));
  }));
}

/* -------------------------------------------- */
/*  Présages (1d66)                             */
/* -------------------------------------------- */

function omenHTML(o) {
  return `<div class="flt-card flt-omen-card">
    <h3><i class="fa-solid fa-eye"></i> Présage ${o.code} <small>${esc(o.theme)}</small></h3>
    <p><strong>${esc(o.title)}.</strong> ${esc(o.text)}</p>
  </div>`;
}

async function rollOmen() {
  if (!game.user.isGM) return;
  const roll = await new Roll("2d6").evaluate();
  const [tens, units] = roll.dice[0].results.map((r) => r.result);
  const o = omenFor(tens, units);
  const applied = await applyOmen(o);
  await roll.toMessage({ speaker: { alias: "Almanach" }, flavor: `Présage (1d66) : ${tens}${units}` }, { rollMode: "gmroll" });
  await ChatMessage.create({
    content: `<div class="flt-chat flt-chat-gm">${omenHTML(o)}${applied ? `<p class="flt-applied"><i class="fa-solid fa-wand-magic-sparkles"></i> Appliqué automatiquement : ${esc(applied)}</p>` : ""}</div>`,
    speaker: { alias: "Almanach" },
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
  });
  return o;
}

/** Applique les effets chiffrés d'un présage. Retourne une description, ou "" si rien d'automatique. */
async function applyOmen(o) {
  const d6 = async () => (await new Roll("1d6").evaluate()).total;
  const st = state();
  const endOfMonth = (st.date.monthLastDay + 1) * SECONDS_PER_DAY;
  switch (o.code) {
    case "11": await addEffects({ label: "Lune rouge (auprès du camp adverse)", ids: ["manipulation"], value: -1, active: false, until: endOfMonth, source: "omen" });
      return "−1 Manipulation (à cocher, auprès du camp adverse) jusqu'à la fin du mois";
    case "14": await addEffects({ label: "Nuit sans ombre", kind: "noDark", until: time.endOfToday(), source: "omen" });
      return "aucun malus d'obscurité cette nuit";
    case "16": await addEffects({ label: "Ciel vert", ids: ["travel-navigate"], value: 1, ...time.tomorrow(), source: "omen" });
      return "+1 pour Ouvrir la marche demain";
    case "31": { const n = await d6(); await addEffects({ label: "Les bêtes fuient", ids: ["travel-find-prey", "travel-kill-prey"], value: -1, until: time.days(n), source: "omen" });
      return `−1 pour chasser pendant ${n} jour(s)`; }
    case "35": { const n = await d6(); await addEffects({ label: "Floraison hors saison", ids: ["travel-find-food"], value: 1, until: time.days(n), source: "omen" });
      return `+1 pour chercher des provisions pendant ${n} jour(s)`; }
    case "45": { const n = await d6(); await addEffects({ label: "Le mariage (dans ce village)", ids: ["manipulation"], value: 1, active: false, until: time.days(n), source: "omen" });
      return `+1 Manipulation (à cocher, dans ce village) pendant ${n} jour(s)`; }
    case "56": await addEffects({ label: "Le silence", ids: ["insight"], value: -1, ...time.tomorrowUntilEvening(), source: "omen" });
      return "−1 Intuition pour tous demain jusqu'au soir";
    default: return "";
  }
}

/* -------------------------------------------- */
/*  La part de la fête                          */
/* -------------------------------------------- */

const FEAST_BOONS = {
  0: { oath: true },
  2: { who: "Qui a reçu l'eau du Délice d'Ondée ?", label: "+1 aux Soins pendant 1d6 jours", effect: { label: "Eau du Délice d'Ondée", ids: ["healing"], value: 1 } },
  4: { who: "Qui a réussi le saut du feu ?", label: "+1 point de Volonté", willpower: 1 },
  6: { who: "Qui a apaisé les morts au cimetière ?", label: "+1 au premier jet contre un mort-vivant pendant 1d6 jours (à cocher)",
       effect: { label: "Morts apaisés (contre un mort-vivant)", ids: ["melee", "marksmanship"], value: 1, active: false } },
  7: { who: "Qui a fait une offrande au Rôdeur nocturne ?", label: "1 ration ou 1 point de dégât ; 1re mauvaise rencontre évitée pendant 1d6 jours",
       note: "le Rôdeur l'épargne : sa première mauvaise rencontre de voyage est évitée", days: true }
};

/* Le serment de la longue nuit (Mi-hiver) */
async function swearOaths() {
  const pcs = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
  if (!pcs.length) return ui.notifications.warn("Aucun personnage joueur trouvé.");
  const { DialogV2 } = foundry.applications.api;
  const rows = pcs.map((a) => {
    const old = a.getFlag(MOD, "serment")?.text ?? "";
    return `<div class="form-group"><label style="flex:0 0 9em">${esc(a.name)}</label>
      <input type="text" name="oath-${a.id}" value="${esc(old)}" placeholder="Son serment pour l'année (vide : aucun)"></div>`;
  }).join("");
  const res = await DialogV2.prompt({
    window: { title: "Mi-hiver : le serment de la longue nuit" },
    position: { width: 520 },
    content: `<p>Devant le brasier, chacun annonce un but pour l'année. Le jour où il l'accomplit, il gagne <b>1d6 points de Volonté</b>.</p>${rows}`,
    ok: { label: "Graver les serments", callback: (ev, btn) => Object.fromEntries(pcs.map((a) => [a.id, btn.form.elements[`oath-${a.id}`].value.trim()])) },
    rejectClose: false
  });
  if (!res) return;
  const lines = [];
  for (const a of pcs) {
    const text = res[a.id];
    if (!text) continue;
    await a.setFlag(MOD, "serment", { text, sworn: game.time.worldTime });
    lines.push(`<p><b>${esc(a.name)}</b> jure : « ${esc(text)} »<br><button type="button" data-flt-oath="${a.id}"><i class="fa-solid fa-check"></i> Serment accompli (1d6 Volonté)</button></p>`);
  }
  if (!lines.length) return;
  await ChatMessage.create({
    content: `<div class="flt-chat"><p><i class="fa-solid fa-fire"></i> <strong>Mi-hiver : les serments de la longue nuit</strong></p>${lines.join("")}</div>`,
    speaker: { alias: "Le Temps" }
  });
}

async function fulfillOath(actorId) {
  const a = game.actors.get(actorId);
  const oath = a?.getFlag(MOD, "serment");
  if (!oath) return ui.notifications.info("Ce serment a déjà été tenu (ou n'existe plus).");
  const roll = await new Roll("1d6").evaluate();
  const wp = a.system?.bio?.willpower;
  if (wp) await a.update({ "system.bio.willpower.value": Math.min((wp.value ?? 0) + roll.total, wp.max ?? 99) });
  await a.unsetFlag(MOD, "serment");
  await roll.toMessage({
    speaker: { alias: "Le Temps" },
    flavor: `<div class="flt-chat"><p><i class="fa-solid fa-fire"></i> <strong>${esc(a.name)} a tenu son serment</strong></p><p>« ${esc(oath.text)} »<br>+${roll.total} point${roll.total > 1 ? "s" : ""} de Volonté.</p></div>`
  });
}

async function grantFeastBoon(i) {
  if (!game.user.isGM) return;
  const boon = FEAST_BOONS[i];
  if (boon?.oath) return swearOaths();
  if (!boon) return ui.notifications.info("Cette part de fête se gère au récit : rien à appliquer aux jets.");
  const pcs = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
  if (!pcs.length) return ui.notifications.warn("Aucun personnage joueur trouvé.");
  const { DialogV2 } = foundry.applications.api;
  const ids = await DialogV2.prompt({
    window: { title: `${FEASTS[i].name} : la part de la fête` },
    content: `<p>${esc(boon.who)} <em>(${esc(boon.label)})</em></p>${pcs.map((a) =>
      `<div class="form-group"><label><input type="checkbox" name="pc" value="${a.id}" checked> ${esc(a.name)}</label></div>`).join("")}`,
    ok: { label: "Appliquer", callback: (ev, btn) => [...btn.form.querySelectorAll('input[name="pc"]:checked')].map((x) => x.value) },
    rejectClose: false
  });
  if (!ids?.length) return;
  const lines = [];
  for (const id of ids) {
    const a = game.actors.get(id);
    if (boon.willpower) {
      const wp = a.system?.bio?.willpower;
      if (wp) await a.update({ "system.bio.willpower.value": Math.min((wp.value ?? 0) + boon.willpower, wp.max ?? 99) });
      lines.push(`${esc(a.name)} : +${boon.willpower} Volonté`);
    }
    if (boon.note) {
      let txt = boon.note;
      if (boon.days) { const n = (await new Roll("1d6").evaluate()).total; txt += ` (pendant ${n} jour${n > 1 ? "s" : ""})`; }
      lines.push(`${esc(a.name)} : ${esc(txt)}`);
    }
    if (boon.effect) {
      const n = (await new Roll("1d6").evaluate()).total;
      await addEffects({ ...boon.effect, actors: [id], until: time.days(n), source: "feast" });
      lines.push(`${esc(a.name)} : ${esc(boon.effect.label)} (${n} jour${n > 1 ? "s" : ""})`);
    }
  }
  await ChatMessage.create({
    content: `<div class="flt-chat"><p><i class="fa-solid fa-gift"></i> <strong>${esc(FEASTS[i].name)} : la part de la fête</strong></p><p>${lines.join("<br>")}</p></div>`,
    speaker: { alias: "Le Temps" }
  });
}

function omenTableHTML() {
  return `<div class="flt-omen-table">${OMENS.map((t, i) => `<div class="flt-omen-theme"><h4>${i + 1}. ${esc(t.theme)}</h4><ol>${
    t.items.map(([title, text], j) => `<li><b>${i + 1}${j + 1}</b> <strong>${esc(title)}.</strong> ${esc(text)}</li>`).join("")}</ol></div>`).join("")}</div>`;
}

const omenButton = `<button type="button" class="flt-roll-omen" data-flt-omen><i class="fa-solid fa-dice"></i> Lancer 1d66 sur la table des présages</button>`;

/* -------------------------------------------- */
/*  Annonces dans le tchat                      */
/* -------------------------------------------- */

const era = () => (setting("era") ? " " + setting("era") : "");

/** Aujourd'hui est-il le jour de la seconde pleine lune du mois ? */
function isSecondFullMoon(st) {
  const fm = st.moon.fullMoonsThisMonth ?? [];
  return st.moon.isFullToday && fm.length >= 2 && st.day === fm[1];
}

async function announce(st, { whispers = true, force = false } = {}) {
  const events = [];
  if (st.date.isFeast && st.quarterIndex === 0) events.push(`<p class="flt-chat-feast"><i class="fa-solid fa-star"></i> Jour de fête : <strong>${esc(st.date.feast.name)}</strong> — ${esc(st.date.feast.subtitle)}</p>`);
  if (st.quarterIndex === 2 && st.moon.isFullToday) events.push(`<p class="flt-chat-moon"><i class="fa-solid fa-circle"></i> La pleine lune se lève.</p>`);
  const everyQuarter = force || setting("announceQuarters");
  if (everyQuarter || (events.length && setting("announceEvents"))) {
    const lines = [];
    lines.push(`<h3 class="flt-chat-title"><i class="${st.quarter.icon}"></i> ${st.quarter.label}</h3>`);
    lines.push(`<p class="flt-chat-date">${esc(st.date.label)}${esc(era())} — ${st.seasonLabel}</p>`);
    lines.push(...events);
    if (everyQuarter) lines.push(st.isLight || noDarkness()
      ? `<p class="flt-chat-light"><i class="fa-solid fa-sun"></i> <strong>Lumière</strong></p>`
      : `<p class="flt-chat-dark"><i class="fa-solid fa-eye-slash"></i> <strong>Obscurité</strong></p>`);
    await ChatMessage.create({ content: `<div class="flt-chat">${lines.join("")}</div>`, speaker: { alias: "Le Temps" } });
  }

  if (!whispers || !setting("gmWhispers")) return;
  const gm = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
  const whisper = (html) => ChatMessage.create({ content: `<div class="flt-chat flt-chat-gm">${html}</div>`, speaker: { alias: "Almanach" }, whisper: gm });
  const house = setting("houseRules");
  if (st.quarterIndex === 0) {
    if (st.date.isFeast) await whisper(feastCardHTML(st.date.feastIndex));
    if (st.date.isDeuil && house) await whisper(`<p><strong>Deuil</strong> — ${esc(RULES.deuil)}</p>`);
    if (st.crowFeast && house) await whisper(`<p><strong>Deux comptes des jours</strong> — Chez les fidèles du Corbeau, c'est peut-être aujourd'hui leur ${esc(st.crowFeast.name)} (4 ou 5 jours après les Frères du Rouillé).</p>`);
  }
  if (st.quarterIndex === 2) {
    if (st.moon.isFullToday) await whisper(moonCardHTML("full"));
    // seconde pleine lune du mois : le présage se tire le soir où elle se lève
    if (house && isSecondFullMoon(st)) {
      if (setting("autoOmen")) await rollOmen();
      else await whisper(`<p><strong><i class="fa-solid fa-eye"></i> Présage</strong> — Seconde pleine lune de ${esc(st.date.month.name)}. ${esc(RULES.omen)}</p>${omenButton}`);
    }
    if (st.moon.isNewToday) await whisper(moonCardHTML("new"));
  }
}

/* -------------------------------------------- */
/*  Panneau                                     */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class FLTimePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fl-temps-panel",
    classes: ["fl-temps"],
    tag: "section",
    window: { title: "Le Temps des Contrées", icon: "fa-solid fa-hourglass-half", resizable: false, minimizable: true },
    position: { width: 350, height: "auto" },
    actions: {
      advance: FLTimePanel.onAdvance,
      quarter: FLTimePanel.onQuarter,
      nextQuarter: () => nextQuarter(1),
      prevQuarter: () => previousQuarter(),
      nextDay: () => nextDay(),
      setDate: () => setDateDialog(),
      toggleSync: FLTimePanel.onToggleSync,
      announce: () => announce(state(), { force: true }),
      almanac: () => showAlmanac(),
      omen: () => rollOmen(),
      removeEffect: (ev, target) => removeEffect(target.dataset.id),
      weatherAnnounce: () => announceWeather(),
      weatherReroll: () => rerollWeather(0),
      weatherChoose: () => chooseWeatherDialog(),
      weatherRerollTomorrow: () => rerollWeather(1),
      weatherChooseTomorrow: () => chooseWeatherDialog("Choisir la météo de demain", 1),
      weatherRegion: (ev, target) => setRegion(target.dataset.region),
      weatherToggle: () => game.settings.set(MOD, "weatherEnabled", !weatherOn()),
      soundToggle: () => game.settings.set(MOD, "weatherSound", !game.settings.get(MOD, "weatherSound")),
      openLieux: () => globalThis.flLieux?.open()
    }
  };

  static PARTS = { main: { template: `modules/${MOD}/templates/panel.hbs` } };

  constructor(options = {}) {
    const pos = game.settings.get(MOD, "panelPos") ?? {};
    if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) options.position = { ...(options.position ?? {}), left: pos.left, top: pos.top };
    super(options);
  }

  static async onAdvance(event, target) {
    await advance(Number(target.dataset.seconds));
  }

  static async onQuarter(event, target) {
    if (canControl()) await goToQuarter(Number(target.dataset.index));
  }

  static async onToggleSync() {
    const scene = canvas?.scene;
    if (!scene || !canControl()) return;
    await scene.setFlag(MOD, "sync", !sceneSynced(scene));
    this.render();
    updateTint();
    queueLightingSync(true);
  }

  async _prepareContext() {
    const st = state();
    const isGM = game.user.isGM;
    const house = setting("houseRules");
    const months = MONTHS.map((m, i) => ({
      name: m.name, season: m.season, feast: FEASTS[i].name,
      current: i === st.date.monthIndex,
      marker: i === st.date.monthIndex ? ((st.date.dayOfMonth + 0.5) / BLOCK) * 100 : null
    }));
    const weekDots = WEEKDAYS.map((w, i) => ({ name: w, abbr: w.slice(0, 2), current: !st.date.isFeast && i === st.date.weekdayIndex, deuil: i === 10 }));
    const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const dark = house ? st.forageDark : 0;
    const forage = sign(st.forage + dark);
    const forageDetail = !st.isLight && house ? `saison ${sign(st.forage)}, lune ${sign(dark)}` : "";
    return {
      isGM, st, house,
      era: setting("era"),
      seasonIcon: SEASONS[st.season].icon,
      quarters: QUARTERS.map((q, i) => ({ ...q, index: i, light: st.lightRow[i], current: i === st.quarterIndex })),
      progressPct: Math.round(st.quarterProgress * 100),
      months, weekDots, forage, forageDetail,
      darkMalus: st.moon.fullMoonNight && house ? "–1" : "–2",
      showMoon: isGM || setting("playersSeeMoon"),
      moonSvg: moonSVG(st.moon.phase, 46),
      moonPct: Math.round(st.moon.illumination * 100),
      moonWaxing: st.moon.phase < 0.5,
      sunMode: { dawn: "Aube", dusk: "Crépuscule", day: "Soleil haut", night: "Nuit noire" }[st.sun.mode],
      synced: sceneSynced(canvas?.scene),
      manage: setting("manageDarkness"),
      darknessPct: Math.round(st.darkness * 100),
      feastPart: st.date.isFeast && house ? st.date.feast.partShort : "",
      crowFeast: isGM && house ? st.crowFeast?.name : null,
      weather: weatherContext(isGM),
      lieuxOn: isGM && !!game.modules.get("fl-lieux")?.active,
      sound: {
        available: weatherOn(),
        on: game.settings.get(MOD, "weatherSound"),
        vol: game.settings.get(MOD, "weatherSoundVolume"),
        low: game.settings.get(MOD, "weatherSoundVolume") < 40
      },
      effects: activeEffects().map((e) => ({
        id: e.id,
        label: e.label,
        value: e.kind === "noDark" ? "" : (e.value > 0 ? `+${e.value}` : `${e.value}`),
        who: e.actors?.length ? e.actors.map((id) => game.actors.get(id)?.name ?? "?").join(", ") : "tous",
        optional: e.active === false,
        left: Math.max(1, Math.ceil((e.until - game.time.worldTime) / SECONDS_PER_DAY))
      })),
      omenDue: isGM && house && isSecondFullMoon(st)
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const input = this.element.querySelector(".flt-vol");
    if (!input) return;
    const label = this.element.querySelector(".flt-vol-val");
    // pendant qu'on glisse : volume changé en direct ; au relâchement : réglage enregistré
    input.addEventListener("input", () => {
      const v = Number(input.value);
      if (label) label.textContent = `${v} %`;
      setSoundVolume(v / 100);
    });
    input.addEventListener("change", () => game.settings.set(MOD, "weatherSoundVolume", Number(input.value)));
  }

  setPosition(pos) {
    const r = super.setPosition(pos);
    if (r && Number.isFinite(r.left) && Number.isFinite(r.top)) this._savePos?.(r);
    return r;
  }

  _savePos = foundry.utils.debounce((r) => game.settings.set(MOD, "panelPos", { left: r.left, top: r.top }), 500);
}

function togglePanel(force) {
  FLTemps.panel ??= new FLTimePanel();
  const open = FLTemps.panel.rendered;
  if (force === true || (force === undefined && !open)) FLTemps.panel.render({ force: true });
  else if (open) FLTemps.panel.close();
}

/* -------------------------------------------- */
/*  API publique (macros)                       */
/* -------------------------------------------- */

const FLTemps = {
  panel: null,
  getState: (t = game.time.worldTime) => computeState(t, getConfig()),
  advance,
  advanceTours: (n = 1) => advance(n * TOUR),
  nextQuarter, previousQuarter, goToQuarter, nextDay,
  /** setDate(1165, 4, 16, 0) = Orden 16 Lannis 1165, au Matin. Jour 0 = fête qui ouvre le mois. */
  setDate: (year, monthIndex, dayOfMonth, quarterIndex = 0) => setWorldTime(worldTimeFromDate(year, monthIndex, dayOfMonth, quarterIndex, getConfig())),
  setDateDialog, togglePanel, showAlmanac, rollOmen, grantFeastBoon, rollHikeInDarkness, addEffects, removeEffect, activeEffects,
  syncLighting: () => syncLighting(true),
  announce: () => announce(state(), { force: true }),
  dateFromDay: (d) => dateFromDay(d, getConfig())
};

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  game.keybindings.register(MOD, "toggle", {
    name: "Afficher / masquer le panneau du Temps",
    editable: [{ key: "KeyT", modifiers: ["Shift"] }],
    onDown: () => { togglePanel(); return true; }
  });
  game.modules.get(MOD).api = FLTemps;
  globalThis.FLTemps = FLTemps;
});

Hooks.once("setup", () => {
  installAutomation({ state, setting, isActiveGM, sceneSynced: () => sceneSynced(canvas?.scene), weatherMods });
  initWeather({ getConfig, isActiveGM, sceneSynced: (sc = canvas?.scene) => sceneSynced(sc) });
});

Hooks.once("ready", () => {
  ensureWeather().then(() => refreshWeatherFx());
  tintElement();
  updateTint();
  queueLightingSync(true);
  if (setting("autoOpen")) togglePanel(true);
});

Hooks.on("canvasTearDown", () => clearWeatherFx());
Hooks.on("canvasReady", () => {
  clearWeatherFx(); // nouvelle scène : on repart à neuf, sans fondu
  refreshWeatherFx();
  updateTint();
  queueLightingSync(true);
  FLTemps.panel?.rendered && FLTemps.panel.render();
});

Hooks.on("updateWorldTime", (worldTime, delta) => {
  updateTint();
  if (FLTemps.panel?.rendered) FLTemps.panel.render();
  queueLightingSync();
  pruneEffects();
  if (delta && Math.floor(worldTime / SECONDS_PER_DAY) !== Math.floor((worldTime - delta) / SECONDS_PER_DAY)) ensureWeather();
  refreshWeatherFx();
  if (isActiveGM() && delta) {
    const prevQ = Math.floor((worldTime - delta) / QUARTER);
    const nowQ = Math.floor(worldTime / QUARTER);
    if (nowQ !== prevQ) announce(computeState(worldTime, getConfig()));
  }
});

Hooks.on("updateScene", (scene, changes) => {
  if (scene.id === canvas?.scene?.id && foundry.utils.hasProperty(changes, `flags.${MOD}`)) {
    refreshWeatherFx();
    updateTint();
    FLTemps.panel?.rendered && FLTemps.panel.render();
  }
});

/* -------------------------------------------- */
/*  Infos du temps dans le résultat des jets    */
/* -------------------------------------------- */

const TRAVEL_NOTES = ["travel-navigate", "travel-find-food", "travel-find-prey", "travel-kill-prey", "travel-catch-fish", "travel-forced-march", "travel-hike-in-darkness", "travel-make-camp"];

// Au moment où le jet est créé, on mémorise l'état du temps sur le message.
Hooks.on("preCreateChatMessage", (message) => {
  const type = message.rolls?.[0]?.options?.mishapType;
  if (!TRAVEL_NOTES.includes(type)) return;
  const st = state();
  const dark = !st.isLight && !noDarkness();
  message.updateSource({
    [`flags.${MOD}.travel`]: {
      type, dark, quarter: st.quarter.label, moon: st.moon.name,
      weather: ["travel-navigate", "travel-forced-march", "travel-hike-in-darkness"].includes(type) ? enduranceReminders().map((e) => e.text) : [],
      fullMoon: st.moon.fullMoonNight && setting("houseRules")
    }
  });
});

function travelNoteHTML(info) {
  const parts = [];
  if (info?.dark) {
    if (info.type === "travel-navigate") {
      parts.push(`<i class="fa-solid fa-eye-slash"></i> <strong>${esc(info.quarter)} dans l'obscurité</strong> (${esc(info.moon.toLowerCase())}) :
        malus ${info.fullMoon ? "–1" : "–2"} déjà compté. Ceux qui marchent sans voir dans le noir font un jet de PERCEPTION (échec : 1 point de dégâts de Force).
        <button type="button" data-flt-hike><i class="fa-solid fa-person-hiking"></i> Marcher dans l'obscurité (PERCEPTION)</button>`);
    } else {
      const counted = info.type === "travel-find-food" ? " : modificateur de lune déjà compté" : "";
      parts.push(`<i class="fa-solid fa-moon"></i> ${esc(info.quarter)} dans l'obscurité, ${esc(info.moon.toLowerCase())}${counted}.`);
    }
  }
  for (const t of info?.weather ?? []) parts.push(`<i class="fa-solid fa-cloud-showers-heavy"></i> ${esc(t)}`);
  return parts.length ? `<div class="flt-roll-note">${parts.join("<br>")}</div>` : "";
}

// Maître des cieux : le MJ peut changer la météo quand le sort est lancé
Hooks.on("createChatMessage", (message) => {
  try {
    if (!isActiveGM() || !weatherOn()) return;
    const o = message.rolls?.[0]?.options;
    if (o?.type !== "spell" || Array.isArray(o.itemId)) return;
    const actor = o.actorId ? game.actors.get(o.actorId) : null;
    const item = actor?.items.get(o.itemId);
    if (item && /ma[iî]tre des cieux|weathermaster/i.test(item.name)) chooseWeatherDialog(`${item.name} : changer la météo`);
  } catch (err) { console.error("fl-temps |", err); }
});

function bindChatButtons(message, html) {
  const root0 = html instanceof HTMLElement ? html : html?.[0];
  const info = message?.getFlag?.(MOD, "travel");
  if (root0 && (info?.dark || info?.weather?.length) && !root0.querySelector(".flt-roll-note")) {
    const target = root0.querySelector(".message-content") ?? root0;
    target.insertAdjacentHTML("beforeend", travelNoteHTML(info));
  }
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll?.("[data-flt-omen]").forEach((b) => {
    if (!game.user.isGM) return b.remove();
    b.addEventListener("click", (ev) => { ev.preventDefault(); rollOmen(); });
  });
  root?.querySelectorAll?.("[data-flt-boon]").forEach((b) => {
    if (!game.user.isGM) return b.remove();
    b.addEventListener("click", (ev) => { ev.preventDefault(); grantFeastBoon(Number(b.dataset.fltBoon)); });
  });
  root?.querySelectorAll?.("[data-flt-oath]").forEach((b) => {
    if (!game.user.isGM) return b.remove();
    if (!game.actors.get(b.dataset.fltOath)?.getFlag(MOD, "serment")) { b.disabled = true; b.innerHTML = '<i class="fa-solid fa-check-double"></i> Serment tenu'; return; }
    b.addEventListener("click", (ev) => { ev.preventDefault(); fulfillOath(b.dataset.fltOath).then(() => ui.chat?.render?.()); });
  });
  root?.querySelectorAll?.("[data-flt-hike]").forEach((b) => {
    b.addEventListener("click", (ev) => { ev.preventDefault(); rollHikeInDarkness(); });
  });
}
Hooks.on("renderChatMessageHTML", bindChatButtons); // v13

Hooks.on("getSceneControlButtons", (controls) => {
  const tool = { name: "fl-temps", title: "Le Temps des Contrées", icon: "fa-solid fa-hourglass-half", button: true, visible: true };
  if (Array.isArray(controls)) {
    controls.find((c) => c.name === "token")?.tools.push({ ...tool, onClick: () => togglePanel() });
  } else {
    const token = controls.tokens ?? controls.token;
    if (token?.tools) token.tools["fl-temps"] = { ...tool, order: Object.keys(token.tools).length, onChange: () => togglePanel() };
  }
});
