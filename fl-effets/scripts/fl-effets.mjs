/**
 * Forbidden Lands – Effets
 * Joue des animations (via Sequencer) quand un jet d'arme ou de sort du système Forbidden Lands arrive dans le tchat,
 * et quand un personnage ou un monstre perd des points d'attribut.
 */
import { FX, fileOf, SCHOOLS, SPELLS, WEAPONS, CREATURE, ELEMENTS, DEFAULTS, DAMAGE, CUSTOM_DB } from "./recipes.mjs";

const MOD = "fl-effets";
const setting = (k) => game.settings.get(MOD, k);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SPELL_INDEX = new Map();
for (const s of SPELLS) for (const n of s.names) if (!SPELL_INDEX.has(norm(n))) SPELL_INDEX.set(norm(n), s);

const KINDS = {
  auto: "Automatique",
  melee: "Mêlée (vers la cible)",
  projectile: "Projectile (vers la cible)",
  orb: "Orbe qui vole vers la cible",
  beam: "Rayon (du lanceur vers la cible)",
  beamback: "Rayon (de la cible vers le lanceur)",
  target: "Sur la cible",
  self: "Sur le lanceur",
  area: "Zone autour du lanceur",
  none: "Aucune animation"
};
const DIRECTIONAL = ["melee", "projectile", "orb", "beam", "beamback"];

/* -------------------------------------------- */
/*  Réglages et base d'effets                   */
/* -------------------------------------------- */

Hooks.once("init", () => {
  const reg = (key, name, hint, type, def, extra = {}) =>
    game.settings.register(MOD, key, { name, hint, scope: "world", config: true, type, default: def, ...extra });
  reg("weapons", "Animer les attaques d'armes", "", Boolean, true);
  reg("monsters", "Animer les attaques des monstres", "", Boolean, true);
  reg("spells", "Animer les sorts", "", Boolean, true);
  reg("castCircle", "Cercle d'incantation de l'école", "Un cercle magique aux couleurs de l'école apparaît sous le lanceur avant le sort.", Boolean, true);
  reg("hitImpact", "Impact quand l'attaque touche", "", Boolean, true);
  reg("missed", "Montrer les attaques ratées", "Une attaque sans succès part à côté de la cible.", Boolean, true);
  reg("pushes", "Rejouer l'animation quand on pousse un jet", "", Boolean, false);
  reg("blood", "Sang quand on perd de la Force", "Le sang gicle sur le jeton quand la Force (ou l'Agilité) baisse ; à 0 (Brisé), une flaque.", Boolean, true);
  reg("mindDamage", "Effets pour l'Esprit et l'Empathie", "Étoiles quand l'Esprit baisse, effroi quand l'Empathie baisse.", Boolean, true);
  reg("pushBlood", "Sang aussi quand on pousse un jet", "Les dégâts subis en poussant un jet font aussi saigner.", Boolean, false);
  reg("scale", "Taille des effets", "", Number, 1, { range: { min: 0.5, max: 2, step: 0.1 } });

  game.modules.get(MOD).api = { play: playForItem, resolve: resolveRecipe, FX, SPELLS, SCHOOLS };
  globalThis.FLEffets = game.modules.get(MOD).api;
});

Hooks.once("sequencerReady", () => {
  Sequencer.Database.registerEntries("fl", CUSTOM_DB);
});

Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  if (!game.modules.get("sequencer")?.active) {
    ui.notifications.error("Forbidden Lands – Effets : le module Sequencer doit être activé.");
    return;
  }
  // Le pack d'animations est-il activé ? (vérification sur le module lui-même, pas sur la base de Sequencer,
  // qui peut se remplir un peu après le chargement du monde)
  const packActive = ["JB2A_DnD5e", "jb2a_patreon"].some((id) => game.modules.get(id)?.active);
  if (!packActive) {
    ui.notifications.warn("Forbidden Lands – Effets : le pack d'animations requis n'est pas activé dans ce monde (Gérer les modules). Seuls les effets maison seront joués.");
  }
});

const has = (ref) => {
  const file = fileOf(ref);
  if (!file) return false;
  if (file.includes("/")) return true;
  try { return Sequencer.Database.entryExists(file); } catch { return false; }
};

/* -------------------------------------------- */
/*  Choix de l'animation                        */
/* -------------------------------------------- */

function schoolOf(item) {
  const forced = item.getFlag(MOD, "school");
  if (forced && SCHOOLS[forced]) return forced;
  const img = item.img ?? "";
  for (const [k, s] of Object.entries(SCHOOLS)) if (s.icon && img.includes(s.icon)) return k;
  return SPELL_INDEX.get(norm(item.name))?.school ?? "generic";
}

const elementOf = (name) => ELEMENTS.find((e) => e.re.test(name ?? "")) ?? null;

/**
 * Recette pour un objet (arme, attaque de monstre, sort) ou une attaque à mains nues (item = null).
 * Retour : { steps: [...], cast?, isSpell } ou null.
 */
export function resolveRecipe(item, { unarmed = false } = {}) {
  const override = item?.getFlag(MOD, "anim");
  if (override?.kind === "none") return null;
  let recipe;

  if (!item) {
    if (!unarmed) return null;
    recipe = { steps: [{ kind: "melee", fx: DEFAULTS.unarmed }] };
  } else if (item.type === "spell") {
    const school = schoolOf(item);
    const known = SPELL_INDEX.get(norm(item.name));
    recipe = { isSpell: true, school, cast: SCHOOLS[school].cast, steps: (known?.steps ?? SCHOOLS[school].fallback).map((s) => ({ ...s })) };
  } else {
    recipe = { steps: weaponSteps(item) };
  }

  if (override?.fx || (override?.kind && override.kind !== "auto")) {
    const main = recipe.steps.find((s) => !s.onHit) ?? recipe.steps[0];
    const kind = override.kind && override.kind !== "auto" ? override.kind : main.kind;
    const fxRef = override.fx || main.fx;
    recipe.steps = [{ kind, fx: fxRef, wait: DIRECTIONAL.includes(kind) ? -500 : undefined }];
    if (!recipe.isSpell && DIRECTIONAL.includes(kind)) recipe.steps.push({ kind: "target", fx: DEFAULTS.hit, onHit: true });
  }
  return recipe;
}

function weaponSteps(item) {
  const isMonster = item.type === "monsterAttack";
  const name = item.name ?? "";
  const el = elementOf(name);
  const category = item.system?.category ?? item.category;
  const breath = isMonster && /souffle|haleine|crach|breath|spit/i.test(name);
  const ranged = breath || category === "ranged" || (isMonster && /long|loin|distant|ranged/i.test(item.system?.range ?? ""));
  const table = isMonster ? CREATURE.concat(WEAPONS) : WEAPONS;
  const match = breath ? null : table.find((w) => w.re.test(name));
  const steps = [];
  const impact = el?.impact ?? DEFAULTS.hit;

  if (breath) {
    steps.push({ kind: "projectile", fx: el?.breath ?? "Feu.souffle", wait: -700 });
    steps.push({ kind: "target", fx: impact, onHit: true });
    if (el?.linger) steps.push({ kind: "target", fx: el.linger, onHit: true, delay: 200 });
  } else if (ranged) {
    const bolt = el?.bolt ?? match?.ranged ?? DEFAULTS.ranged;
    steps.push({ kind: el?.boltKind ?? "projectile", fx: bolt, wait: el?.boltKind === "orb" ? -50 : -500 });
    steps.push({ kind: "target", fx: impact, onHit: true });
    if (el?.linger) steps.push({ kind: "target", fx: el.linger, onHit: true, delay: 200 });
  } else {
    const melee = match?.melee ?? el?.melee ?? (isMonster ? DEFAULTS.creature : DEFAULTS.melee);
    steps.push({ kind: "melee", fx: melee, wait: -650 });
    steps.push({ kind: "target", fx: impact, onHit: true });
    if (el?.linger) steps.push({ kind: "target", fx: el.linger, onHit: true, delay: 200 });
  }
  return steps;
}

/* -------------------------------------------- */
/*  Lecture des jets du système                 */
/* -------------------------------------------- */

function resolveActor(o, speaker) {
  if (o?.sceneId && o?.tokenId) return game.scenes.get(o.sceneId)?.tokens.get(o.tokenId)?.actor ?? null;
  if (o?.actorId) return game.actors.get(o.actorId) ?? null;
  return ChatMessage.getSpeakerActor?.(speaker) ?? null;
}

function sourceToken(actor, o) {
  if (o?.tokenId) {
    const t = canvas.tokens?.get(o.tokenId);
    if (t) return t;
  }
  return actor?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled[0] ?? null;
}

Hooks.on("createChatMessage", async (message) => {
  try {
    if (!(message.isAuthor ?? message.author?.id === game.user.id)) return;
    if (!game.modules.get("sequencer")?.active || !canvas?.ready) return;
    const roll = message.rolls?.[0];
    const o = roll?.options;
    if (!o) return;
    if (roll.pushed && !setting("pushes")) return;

    const isSpell = o.type === "spell";
    const isAttack = !!o.isAttack || (o.damage && !isSpell);
    if (!isSpell && !isAttack) return;

    const actor = resolveActor(o, message.speaker);
    if (!actor) return;
    const itemId = Array.isArray(o.itemId) ? null : o.itemId;
    const item = itemId ? actor.items.get(itemId) : null;

    if (isSpell && !setting("spells")) return;
    if (isAttack && item?.type === "monsterAttack" && !setting("monsters")) return;
    if (isAttack && item?.type !== "monsterAttack" && !setting("weapons")) return;

    // Un sort prend toujours effet (un 1 ou le hasard = incident magique) ; une attaque touche avec au moins un succès.
    const hit = isSpell ? true : (roll.successCount ?? 0) > 0;
    const mishap = isSpell && !!roll.isMishap;

    await play({ item, source: sourceToken(actor, o), targets: [...game.user.targets], hit, mishap, unarmed: isAttack && !item });
  } catch (err) {
    console.error("fl-effets |", err);
  }
});

/* -------------------------------------------- */
/*  Construction de la séquence                 */
/* -------------------------------------------- */

async function play({ item, source, targets = [], hit = true, mishap = false, unarmed = false, recipe = null }) {
  recipe ??= resolveRecipe(item, { unarmed });
  if (!recipe || !source) return;
  const scale = Number(setting("scale")) || 1;
  const seq = new Sequence({ moduleName: MOD });
  let count = 0;

  // Cercle d'incantation de l'école
  if (recipe.isSpell && setting("castCircle") && has(recipe.cast)) {
    seq.effect().file(fileOf(recipe.cast)).atLocation(source).belowTokens().scaleToObject(2.4 * scale).fadeIn(250).fadeOut(500);
    seq.wait(800);
    count++;
  }

  let first = true;
  for (const step of recipe.steps) {
    if (step.onHit && (!hit || (!setting("hitImpact") && step.fx === DEFAULTS.hit))) continue;
    if (!has(step.fx)) {
      console.warn(`fl-effets | effet introuvable : ${fileOf(step.fx)}`);
      continue;
    }
    // Sort sans cible : les effets « sur la cible » se jouent sur le lanceur (soin de soi, etc.)
    const tg = targets.length ? targets : recipe.isSpell && step.kind === "target" ? [source] : [];
    count += addStep(seq, step, { source, targets: tg, hit, isAttack: !recipe.isSpell, main: first && DIRECTIONAL.includes(step.kind), scale });
    if (!step.onHit) first = false;
  }

  // Incident magique : contrecoup rouge sur le lanceur
  if (mishap && has(DEFAULTS.mishap)) {
    seq.wait(300);
    seq.effect().file(fileOf(DEFAULTS.mishap)).atLocation(source).scaleToObject(1.8 * scale).fadeOut(400);
    count++;
  }
  if (count) return seq.play();
}

/** Ajoute une étape à la séquence ; renvoie le nombre d'effets ajoutés. */
function addStep(seq, step, { source, targets, hit, isAttack, main, scale }) {
  const s = (step.scale ?? 1) * scale;
  const file = fileOf(step.fx);
  const showMiss = isAttack && main && setting("missed");
  const made = [];
  const base = (e) => {
    if (step.below) e.belowTokens();
    if (step.delay) e.delay(step.delay);
    made.push(e);
    return e;
  };

  switch (step.kind) {
    case "self":
      base(seq.effect().file(file).atLocation(source).scaleToObject(1.8 * s).fadeOut(500));
      break;
    case "area":
      base(seq.effect().file(file).atLocation(source).scaleToObject(4 * s).fadeIn(200).fadeOut(600));
      break;
    case "target":
      for (const t of targets) base(seq.effect().file(file).atLocation(t).scaleToObject(1.6 * s).fadeOut(500));
      break;
    case "beamback":
      for (const t of targets) base(seq.effect().file(file).atLocation(t).stretchTo(source));
      break;
    case "orb":
      for (const t of targets) {
        const e = base(seq.effect().file(file).atLocation(source).moveTowards(t, { ease: "easeInOutSine" }).moveSpeed(500)
          .scaleToObject(0.8 * s).fadeIn(100).fadeOut(150));
        if (showMiss) e.missed(!hit);
      }
      break;
    default: // melee, projectile, beam
      for (const t of targets) {
        const e = base(seq.effect().file(file).atLocation(source).stretchTo(t));
        if (showMiss) e.missed(!hit);
      }
  }
  if (made.length && step.wait != null) made[made.length - 1].waitUntilFinished(step.wait);
  return made.length;
}

/** API : joue l'animation d'un objet depuis le jeton sélectionné vers les cibles (pour tester). */
export async function playForItem(item, hit = true) {
  const source = canvas.tokens.controlled[0] ?? item?.actor?.getActiveTokens()[0];
  if (!source) return ui.notifications.warn("Sélectionnez un jeton.");
  return play({ item, source, targets: [...game.user.targets], hit });
}

/* -------------------------------------------- */
/*  Bouton « Animation » sur la fiche d'objet   */
/* -------------------------------------------- */

const ANIMATED_TYPES = ["weapon", "spell", "monsterAttack"];

function fxOptions(selected) {
  const groups = {};
  for (const [id, f] of Object.entries(FX)) (groups[f.group] ??= []).push([id, f.label]);
  return Object.entries(groups).map(([g, list]) =>
    `<optgroup label="${esc(g)}">${list.map(([id, label]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(label)}</option>`).join("")}</optgroup>`).join("");
}

function describe(recipe) {
  if (!recipe) return "aucune";
  return recipe.steps.filter((s) => !s.onHit).map((s) => FX[s.fx]?.label ?? "effet personnalisé").join(" → ");
}

async function openAnimationDialog(item) {
  const ov = item.getFlag(MOD, "anim") ?? {};
  const isSpell = item.type === "spell";
  const known = FX[ov.fx] ? ov.fx : "";
  const custom = ov.fx && !FX[ov.fx] ? ov.fx : "";
  const kindOpts = Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${k === (ov.kind ?? "auto") ? "selected" : ""}>${l}</option>`).join("");
  const schoolOpts = isSpell
    ? `<div class="form-group"><label>École</label><select name="school"><option value="">Automatique</option>${Object.entries(SCHOOLS).filter(([k]) => k !== "generic")
      .map(([k, sc]) => `<option value="${k}" ${item.getFlag(MOD, "school") === k ? "selected" : ""}>${sc.label}</option>`).join("")}</select></div>`
    : "";
  const content = `
    <div class="fle-dialog">
      <p class="hint">Animation actuelle : <strong>${esc(describe(resolveRecipe(item)))}</strong></p>
      ${schoolOpts}
      <div class="form-group"><label>Effet</label><select name="fx"><option value="">Automatique</option>${fxOptions(known)}</select></div>
      <div class="form-group"><label>Type</label><select name="kind">${kindOpts}</select></div>
      <details ${custom ? "open" : ""}><summary>Avancé</summary>
        <div class="form-group"><label>Chemin</label><input type="text" name="custom" value="${esc(custom)}" placeholder="chemin d'un effet de la base Sequencer"></div>
      </details>
      <p class="hint">Choisir un effet remplace l'animation automatique par cet effet seul.
      Pour tester : sélectionnez un jeton, ciblez-en un autre, puis « Tester ».</p>
    </div>`;
  const { DialogV2 } = foundry.applications.api;
  const read = (btn) => {
    const f = btn.form.elements;
    return { kind: f.kind.value, fx: f.custom.value.trim() || f.fx.value, school: f.school?.value ?? null };
  };
  const result = await DialogV2.wait({
    window: { title: `Animation : ${item.name}`, icon: "fa-solid fa-wand-sparkles" },
    position: { width: 500 },
    content,
    buttons: [
      { action: "test", icon: "fa-solid fa-play", label: "Tester", callback: async (ev, btn) => {
        const d = read(btn);
        const source = canvas.tokens.controlled[0] ?? item.actor?.getActiveTokens()[0];
        if (!source) { ui.notifications.warn("Sélectionnez un jeton."); return "test"; }
        // recette temporaire (sans enregistrer)
        const fake = { ...item, name: item.name, type: item.type, img: item.img, system: item.system,
          getFlag: (m, k) => (k === "anim" ? { kind: d.kind, fx: d.fx } : k === "school" ? d.school : item.getFlag(m, k)) };
        await play({ item: fake, source, targets: [...game.user.targets], hit: true, recipe: d.kind === "none" ? null : resolveRecipe(fake) });
        return "test";
      } },
      { action: "save", icon: "fa-solid fa-floppy-disk", label: "Enregistrer", default: true, callback: (ev, btn) => ({ save: read(btn) }) },
      { action: "reset", icon: "fa-solid fa-rotate-left", label: "Automatique", callback: () => ({ reset: true }) }
    ],
    rejectClose: false
  });
  if (result === "test") return openAnimationDialog(item);
  if (result?.reset) {
    await item.unsetFlag(MOD, "anim");
    await item.unsetFlag(MOD, "school");
    return ui.notifications.info(`${item.name} : animation automatique.`);
  }
  if (result?.save) {
    const { kind, fx, school } = result.save;
    if (kind === "auto" && !fx) await item.unsetFlag(MOD, "anim");
    else await item.setFlag(MOD, "anim", { kind, fx });
    if (school !== null) school ? await item.setFlag(MOD, "school", school) : await item.unsetFlag(MOD, "school");
    ui.notifications.info(`${item.name} : animation enregistrée.`);
  }
}

function addHeaderButton(sheet, buttons) {
  const item = sheet.item ?? sheet.document;
  if (!item || !ANIMATED_TYPES.includes(item.type) || !item.isOwner) return;
  if (buttons.some((b) => b.class === "fl-effets-anim")) return;
  buttons.unshift({ label: "Animation", class: "fl-effets-anim", icon: "fas fa-wand-sparkles", onclick: () => openAnimationDialog(item) });
}
Hooks.on("getItemSheetHeaderButtons", addHeaderButton);

/* -------------------------------------------- */
/*  Sang et dégâts                              */
/* -------------------------------------------- */

const ATTRS = ["strength", "agility", "wits", "empathy"];
let lastPushAt = 0;

// Repère le clic sur « Pousser » dans le tchat pour reconnaître les dégâts dus à un jet poussé.
document.addEventListener("click", (ev) => {
  if (ev.target?.closest?.(".fbl-button.push")) lastPushAt = Date.now();
}, true);

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (!ATTRS.some((a) => foundry.utils.hasProperty(changes, `system.attribute.${a}.value`))) return;
  options.flEffetsPrev = Object.fromEntries(ATTRS.map((a) => [a, actor.system?.attribute?.[a]?.value ?? null]));
  options.flEffetsPush = Date.now() - lastPushAt < 4000;
});

Hooks.on("updateActor", (actor, changes, options, userId) => {
  try {
    if (userId !== game.user.id || !options.flEffetsPrev) return;
    if (!game.modules.get("sequencer")?.active || !canvas?.ready) return;
    if (options.flEffetsPush && !setting("pushBlood")) return;
    const token = actor.getActiveTokens?.()[0];
    if (!token) return;
    const scale = Number(setting("scale")) || 1;
    const seq = new Sequence({ moduleName: MOD });
    let any = false;
    for (const a of ATTRS) {
      const before = options.flEffetsPrev[a];
      const after = actor.system?.attribute?.[a]?.value;
      if (before == null || after == null || after >= before) continue;
      const physical = a === "strength" || a === "agility";
      if (physical ? !setting("blood") : !setting("mindDamage")) continue;
      const loss = before - after;
      const size = Math.min(1 + 0.25 * (loss - 1), 2) * scale;
      for (const ref of DAMAGE[a]) {
        if (!has(ref)) continue;
        seq.effect().file(fileOf(ref)).atLocation(token).scaleToObject((physical ? 1.3 : 1.1) * size).randomRotation().fadeOut(500);
        any = true;
      }
      if (after === 0 && physical && has(DAMAGE.broken)) {
        seq.effect().file(fileOf(DAMAGE.broken)).atLocation(token).belowTokens().scaleToObject(2.4 * scale).randomRotation().fadeOut(1500);
      }
    }
    if (any) seq.play();
  } catch (err) {
    console.error("fl-effets |", err);
  }
});
