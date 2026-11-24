/**
 * Automatisation des jets du système Forbidden Lands (forbidden-lands 14.x).
 *
 * Le système demande les modificateurs d'un jet à l'acteur via
 * Actor#getRollModifierOptions(...identifiants) : on y ajoute ceux du temps.
 * Identifiants utiles : "travel-navigate" (Ouvrir la marche), "travel-find-food" (Chercher des provisions),
 * "travel-find-prey" / "travel-kill-prey" (Chasser), "marksmanship" (Tir), "healing" (Soins), "insight", "manipulation"…
 *
 * Format d'un modificateur du système : { name, value: "-2" | "+1", active: bool }.
 */
import { SECONDS_PER_DAY, QUARTER } from "./calendar.mjs";

const MOD = "fl-temps";
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
// Le système construit l'id des cases à cocher avec « _ » : on l'évite dans les noms.
const clean = (s) => String(s).replace(/_/g, " ");

let ctx = null; // { state, setting, isActiveGM }

/* -------------------------------------------- */
/*  Effets temporisés (stockés dans le monde)   */
/* -------------------------------------------- */

export function getEffects() {
  const list = game.settings.get(MOD, "effects");
  return Array.isArray(list) ? list : [];
}

export function activeEffects(t = game.time.worldTime) {
  return getEffects().filter((e) => (e.from ?? -Infinity) <= t && t < e.until);
}

export async function addEffects(...effects) {
  if (!game.user.isGM) return;
  const list = getEffects().filter((e) => e.until > game.time.worldTime);
  for (const e of effects) list.push({ id: foundry.utils.randomID(), ...e });
  await game.settings.set(MOD, "effects", list);
}

export async function removeEffect(id) {
  if (!game.user.isGM) return;
  await game.settings.set(MOD, "effects", getEffects().filter((e) => e.id !== id));
}

export async function pruneEffects() {
  if (!ctx?.isActiveGM()) return;
  const list = getEffects();
  const kept = list.filter((e) => e.until > game.time.worldTime);
  if (kept.length !== list.length) await game.settings.set(MOD, "effects", kept);
}

const dayStart = (t) => Math.floor(t / SECONDS_PER_DAY) * SECONDS_PER_DAY;
export const time = {
  endOfToday: (t = game.time.worldTime) => dayStart(t) + SECONDS_PER_DAY,
  tomorrow: (t = game.time.worldTime) => ({ from: dayStart(t) + SECONDS_PER_DAY, until: dayStart(t) + 2 * SECONDS_PER_DAY }),
  tomorrowUntilEvening: (t = game.time.worldTime) => ({ from: dayStart(t) + SECONDS_PER_DAY, until: dayStart(t) + SECONDS_PER_DAY + 2 * QUARTER }),
  days: (n, t = game.time.worldTime) => t + n * SECONDS_PER_DAY
};

/** « Nuit sans ombre » (présage 14) en cours ? */
export function noDarkness(t = game.time.worldTime) {
  return activeEffects(t).some((e) => e.kind === "noDark");
}

/* -------------------------------------------- */
/*  Modificateurs injectés dans les jets        */
/* -------------------------------------------- */

function timeModifiers(actor, ids) {
  const { state, setting } = ctx;
  if (!setting("autoModifiers") || !ids.length) return [];
  if (!["character", "monster"].includes(actor.type)) return [];
  const st = state();
  const house = setting("houseRules");
  const dark = !st.isLight && !noDarkness();
  const fullMoon = house && st.moon.fullMoonNight;
  const has = (...k) => k.some((x) => ids.includes(x));
  const out = [];
  const push = (name, value, active = true) => value && out.push({ name: clean(name), value: signed(value), active, type: "fl-temps" });

  // OUVRIR LA MARCHE dans l'obscurité : −2 (livre), −1 une nuit de pleine lune (règle maison)
  if (has("travel-navigate") && dark) push(fullMoon ? "Obscurité, pleine lune" : "Obscurité", fullMoon ? -1 : -2);

  // CHERCHER DES PROVISIONS : saison (livre) + lune de nuit (règle maison)
  if (has("travel-find-food")) {
    push(`Saison (${st.seasonLabel})`, st.forage);
    if (house && dark) push(`Nuit, ${st.moon.name.toLowerCase()}`, st.forageDark);
  }

  // TIR dans l'obscurité, sur une scène synchronisée avec le temps (extérieur)
  if (has("marksmanship") && dark && ctx.sceneSynced()) push(fullMoon ? "Tir dans l'obscurité, pleine lune" : "Tir dans l'obscurité", fullMoon ? -1 : -2);

  // Deuil : +1 aux Soins sur une tombe ou près d'un mort (à cocher)
  if (house && st.date.isDeuil && has("healing")) push("Deuil (sur une tombe ou près d'un mort)", 1, false);

  // Météo annoncée (s'applique à tout le monde, monstres et PNJ compris)
  for (const m of ctx.weatherMods?.() ?? []) if (has(...m.ids)) push(m.name, m.value);

  // Effets en cours : part de la fête, présages…
  for (const e of activeEffects()) {
    if (e.kind === "noDark" || !e.ids?.length) continue;
    if (e.actors?.length && !e.actors.includes(actor.id)) continue;
    if (has(...e.ids)) push(e.label, e.value, e.active !== false);
  }
  return out;
}

/* -------------------------------------------- */
/*  Installation                                */
/* -------------------------------------------- */

export function registerAutomationSettings(refresh) {
  game.settings.register(MOD, "effects", { scope: "world", config: false, type: Array, default: [], onChange: refresh });
  game.settings.register(MOD, "autoModifiers", {
    name: "Modificateurs automatiques dans les jets",
    hint: "Ajoute dans la fenêtre de jet du système : obscurité pour Ouvrir la marche et le Tir, saison et lune pour Chercher des provisions, Deuil, parts de fête et présages en cours.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "autoOmen", {
    name: "Tirer les présages automatiquement",
    hint: "Après un mois à deux pleines lunes, lance 1d66 au Matin de la fête suivante et applique les effets chiffrés (MJ seul).",
    scope: "world", config: true, type: Boolean, default: true
  });
}

export function installAutomation(context) {
  ctx = context;
  if (game.system.id !== "forbidden-lands") return;
  const cls = CONFIG.Actor.documentClass;
  const original = cls?.prototype?.getRollModifierOptions;
  if (typeof original !== "function") {
    console.warn("fl-temps | getRollModifierOptions introuvable : modificateurs automatiques désactivés.");
    return;
  }
  if (original.__flTemps) return;
  const wrapped = function (...ids) {
    const base = original.apply(this, ids) ?? [];
    try {
      return base.concat(timeModifiers(this, ids));
    } catch (err) {
      console.error("fl-temps | modificateurs", err);
      return base;
    }
  };
  wrapped.__flTemps = true;
  cls.prototype.getRollModifierOptions = wrapped;
}

/* -------------------------------------------- */
/*  Jet « Marcher dans l'obscurité »            */
/* -------------------------------------------- */

export function rollHikeInDarkness() {
  const actors = game.user.isGM
    ? canvas.tokens?.controlled.map((t) => t.actor).filter(Boolean) ?? []
    : [game.user.character].filter(Boolean);
  if (!actors.length) {
    return ui.notifications.warn(game.user.isGM
      ? "Sélectionnez les jetons des personnages qui marchent dans l'obscurité."
      : "Aucun personnage n'est assigné à votre joueur (Configuration du joueur).");
  }
  for (const a of actors) {
    try {
      a.sheet.rollAction("travel-hike-in-darkness");
    } catch (err) {
      ui.notifications.warn(`${a.name} ne peut pas lancer ce jet.`);
    }
  }
}
