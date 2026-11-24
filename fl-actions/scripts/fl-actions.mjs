/**
 * Forbidden Lands – Barre d'actions
 * Un seul module, sans dépendance : la barre d'actions du token sélectionné.
 * Les jets passent par les fonctions de la fiche du système (mêmes fenêtres, mêmes bonus d'équipement).
 */
const MOD = "fl-actions";
const L = (k) => game.i18n.localize(k);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tr = (key, fallback) => { const t = key ? L(key) : ""; return t && t !== key ? t : (fallback ?? key ?? ""); };

const ATTRS = ["strength", "agility", "wits", "empathy"];
/* L = action lente, R = action rapide (Manuel des joueurs). Par tour : une lente et une rapide, ou deux rapides. */
const COMBAT = [
  ["unarmed", "ACTION.UNARMED_STRIKE", "À mains nues", "L"], ["grapple", "ACTION.GRAPPLE", "Empoigner", "L"],
  ["break-free", "ACTION.BREAK_FREE", "Se libérer", "L"], ["flee", "ACTION.FLEE", "Fuir", "L"],
  ["grapple-attack", "ACTION.GRAPPLE_ATTACK", "Attaque en lutte", "R"], ["parry", "ACTION.PARRY", "Parer", "R"],
  ["dodge", "ACTION.DODGE", "Esquiver", "R"], ["shove", "ACTION.SHOVE", "Bousculer", "R"], ["disarm", "ACTION.DISARM", "Désarmer", "R"],
  ["retreat", "ACTION.RETREAT", "Se replier", "R"], ["run", "ACTION.RUN", "Courir", "R"]
];
const OTHER = [["persuade", "ACTION.PERSUADE", "Persuader", "L"], ["taunt", "ACTION.TAUNT", "Provoquer", "L"], ["heal", "ACTION.HEAL", "Soigner", "L"]];
const TRAVEL = [
  ["travel-forced-march", "FLPS.TRAVEL_ROLL.FORCED_MARCH", "Marche forcée"], ["travel-hike-in-darkness", "FLPS.TRAVEL_ROLL.HIKE_IN_DARKNESS", "Marcher dans le noir"],
  ["travel-navigate", "FLPS.TRAVEL_ROLL.NAVIGATE", "Ouvrir la marche"], ["travel-sea-travel", "FLPS.TRAVEL_ROLL.SEA_TRAVEL", "Voyager en mer"],
  ["travel-keep-watch", "FLPS.TRAVEL_ROLL.KEEP_WATCH", "Monter la garde"], ["travel-make-camp", "FLPS.TRAVEL_ROLL.MAKE_CAMP", "Établir le camp"],
  ["travel-find-good-place", "FLPS.TRAVEL_ROLL.FIND_GOOD_PLACE", "Trouver un abri"], ["travel-find-food", "FLPS.TRAVEL_ROLL.FIND_FOOD", "Chercher des provisions"],
  ["travel-find-prey", "FLPS.TRAVEL_ROLL.FIND_PREY", "Chercher du gibier"], ["travel-kill-prey", "FLPS.TRAVEL_ROLL.KILL_PREY", "Abattre le gibier"],
  ["travel-catch-fish", "FLPS.TRAVEL_ROLL.CATCH_FISH", "Pêcher"]
];

/** Activités de la feuille de Groupe du système, et les jets de chacune. */
const ACTIVITIES = [
  { key: "hike", name: "FLPS.TRAVEL.HIKE", fb: "Marcher", rolls: ["travel-forced-march", "travel-hike-in-darkness"] },
  { key: "lead", name: "FLPS.TRAVEL.LEAD", fb: "Ouvrir la marche", rolls: ["travel-navigate", "travel-sea-travel"] },
  { key: "watch", name: "FLPS.TRAVEL.WATCH", fb: "Monter la garde", rolls: ["travel-keep-watch"] },
  { key: "camp", name: "FLPS.TRAVEL.CAMP", fb: "Préparer le camp", rolls: ["travel-make-camp"] },
  { key: "rest", name: "FLPS.TRAVEL.REST", fb: "Se reposer", rolls: ["rest"] },
  { key: "sleep", name: "FLPS.TRAVEL.SLEEP", fb: "Dormir", rolls: ["rest", "travel-find-good-place"] },
  { key: "forage", name: "FLPS.TRAVEL.FORAGE", fb: "Chercher des provisions", rolls: ["travel-find-food"] },
  { key: "hunt", name: "FLPS.TRAVEL.HUNT", fb: "Chasser", rolls: ["travel-find-prey", "travel-kill-prey"] },
  { key: "fish", name: "FLPS.TRAVEL.FISH", fb: "Pêcher", rolls: ["travel-catch-fish"] },
  { key: "other", name: "FLPS.TRAVEL.OTHER", fb: "Autre", rolls: [] }
];
const travelLabel = (k) => (k === "rest" ? tr("FLPS.TRAVEL.REST", "Se reposer") : tr(TRAVEL.find((t) => t[0] === k)?.[1], TRAVEL.find((t) => t[0] === k)?.[2] ?? k));
const travelRoll = (actor, k) => (k === "rest" ? actor.rest() : actor.sheet.rollAction(k));
const partiesOf = (actor) => game.actors.filter((a) => a.type === "party" && (a.system.members ?? []).includes(actor.id));

let el = null;            // la barre
let openGroup = null;     // onglet ouvert
let handlers = new Map(); // id d'action -> fonctions
let renderTimer = null;
let lastTurnKey = null;

/* -------------------------------------------- */
/*  Quel token ?                                 */
/* -------------------------------------------- */

function selection() {
  const toks = (canvas?.tokens?.controlled ?? []).filter((t) => t.actor && ["character", "monster", "party"].includes(t.actor.type) && t.actor.isOwner);
  return toks;
}

/* -------------------------------------------- */
/*  Les actions                                  */
/* -------------------------------------------- */

/** Lance une fonction du système en affichant proprement ses erreurs (personnage brisé, objet cassé…). */
async function safe(fn) {
  try { await fn(); }
  catch (e) {
    const msg = e?.message ?? String(e);
    if (msg) ui.notifications.warn(msg.length > 160 ? L("ERROR.UNKNOWN") : msg);
    console.warn(`${MOD} |`, e);
  }
}

function itemTip(item) {
  const s = item.system ?? {};
  const bits = [];
  if (s.bonus?.max) bits.push(`Bonus ${s.bonus.value}/${s.bonus.max}`);
  if (s.damage) bits.push(`Dégâts ${s.damage}`);
  if (s.range) bits.push(`Portée : ${tr(`RANGE.${String(s.range).toUpperCase()}`, s.range)}`);
  if (s.rank) bits.push(`Rang ${s.rank}`);
  if (s.ingredient) bits.push(`Ingrédient : ${s.ingredient}`);
  return bits.join(" · ");
}

function initiativeAction(actors) {
  return {
    label: "Initiative", icon: "fa-solid fa-bolt",
    active: actors.length > 0 && game.combat && actors.every((a) => game.combat.combatants.some((c) => c.actorId === a.id && c.initiative != null)),
    sub: (() => {
      if (actors.length !== 1 || !game.combat) return "";
      const c = game.combat.combatants.find((c) => c.actorId === actors[0].id);
      return c?.initiative != null ? String(c.initiative) : "";
    })(),
    tip: "Tirer l'initiative (ajoute le token au combat s'il n'y est pas)",
    run: async () => { for (const a of actors) await a.rollInitiative({ createCombatants: true }); }
  };
}

function buildPartyGroups(party) {
  const groups = [];
  const members = (party.system.members ?? []).map((id) => game.actors.get(id)).filter(Boolean);
  // Voyage : chaque activité avec les personnages qui la font ; un clic lance le jet du personnage
  const sections = [];
  for (const act of ACTIVITIES) {
    const who = (party.system.travel?.[act.key] ?? []).map((id) => game.actors.get(id)).filter(Boolean);
    if (!who.length) continue;
    const actions = [];
    for (const pc of who) {
      if (!act.rolls.length) { actions.push({ label: pc.name, dim: true, run: () => pc.sheet.render(true) }); continue; }
      for (const k of act.rolls) actions.push({ label: act.rolls.length > 1 || who.length > 1 ? `${pc.name} : ${travelLabel(k)}` : `${pc.name}`,
        sub: act.rolls.length === 1 && who.length === 1 ? "" : "", tip: travelLabel(k), run: () => travelRoll(pc, k) });
    }
    sections.push({ title: tr(act.name, act.fb), actions });
  }
  if (!sections.length) sections.push({ actions: [{ label: "Personne n'est assigné : glissez les personnages sur la feuille de Groupe", dim: true, run: () => party.sheet.render(true) }] });
  groups.push({ id: "voyage", label: "Voyage", icon: "fa-solid fa-route", sections });

  // Rencontres : les tables réglées sur la feuille de Groupe
  let tables = {};
  try { tables = game.settings.get("forbidden-lands", "encounterTables") ?? {}; } catch (e) { tables = {}; }
  const enc = Object.entries(tables).filter(([, id]) => id && game.tables.get(id)).map(([k, id]) => ({ label: tr(k, k), bullet: true, run: () => game.tables.get(id).draw() }));
  if (enc.length) groups.push({ id: "rencontres", label: "Rencontres", icon: "fa-solid fa-dice", sections: [{ actions: enc }] });

  // Le groupe
  groups.push({ id: "membres", label: "Groupe", icon: "fa-solid fa-users", sections: [{ actions: [
    ...members.map((m) => ({ label: m.name, tip: "Ouvrir la fiche", run: () => m.sheet.render(true) })),
    { label: "Ouvrir la feuille de Groupe", run: () => party.sheet.render(true) }
  ] }] });
  return groups;
}

function buildGroups(token) {
  const actor = token.actor;
  if (actor.type === "party") return buildPartyGroups(actor);
  const sys = actor.system;
  const sheet = () => actor.sheet;
  const groups = [];
  const isChar = actor.type === "character";

  // --- Attributs ---
  const attrs = ATTRS.filter((k) => sys.attribute?.[k] && (isChar || sys.attribute[k].max > 0 || sys.attribute[k].value > 0)).map((k) => {
    const a = sys.attribute[k];
    return { label: tr(a.label, k), sub: `${a.value}/${a.max}`, low: a.value < a.max, run: () => sheet().rollAttribute(k) };
  });
  if (attrs.length) groups.push({ id: "attr", label: "Attributs", icon: "fa-solid fa-person", sections: [{ actions: attrs }] });

  // --- Compétences ---
  const byAttr = {};
  for (const [k, s] of Object.entries(sys.skill ?? {})) {
    if (!isChar && !(s.value > 0)) continue;
    const a = sys.attribute?.[s.attribute];
    (byAttr[s.attribute] ??= []).push({
      label: tr(s.label, k), sub: String((a?.value ?? 0) + (s.value ?? 0)), dim: !(s.value > 0),
      tip: `${tr(a?.label, s.attribute)} ${a?.value ?? 0} + ${tr(s.label, k)} ${s.value ?? 0}`,
      run: () => sheet().rollSkill(k)
    });
  }
  const skillSections = ATTRS.filter((k) => byAttr[k]).map((k) => ({ title: tr(sys.attribute[k]?.label, k), actions: byAttr[k] }));
  if (skillSections.length) groups.push({ id: "skill", label: "Compétences", icon: "fa-solid fa-dice-d6", sections: skillSections });

  // --- Combat ---
  const combat = [];
  if (isChar) {
    // Seulement ce qui est équipé (si rien n'est marqué « équipé » sur la fiche, on montre tout)
    const worn = (type) => {
      const all = actor.items.filter((i) => i.type === type);
      const eq = all.filter((i) => i.getFlag?.("forbidden-lands", "state") === "equipped");
      return eq.length ? eq : all;
    };
    // Parer et désarmer : seulement avec une arme de mêlée (comme dans le système)
    const weapons = worn("weapon").map((i) => {
      const melee = i.system.category === "melee";
      return {
        label: i.name, img: i.img, sub: i.system.damage ? `${i.system.damage}` : "", item: i, broken: i.isBroken, speed: "L",
        tip: itemTip(i) + (melee ? " — Maj : parer · Alt : désarmer · clic droit : fiche" : " — Maj : parer (risqué) · clic droit : fiche"),
        run: () => sheet().rollGear(i.id),
        ...(melee ? {
          shift: () => sheet().rollAction("parry", i.id), alt: () => sheet().rollAction("disarm", i.id),
          minis: [
            { icon: "fa-solid fa-shield-halved", tip: `Parer avec ${i.name} (action rapide)`, run: () => sheet().rollAction("parry", i.id) },
            { icon: "fa-solid fa-hand", tip: `Désarmer avec ${i.name} (action rapide)`, run: () => sheet().rollAction("disarm", i.id) }
          ]
        } : {
          // Règle maison : on peut parer avec une arme à distance, mais en cas d'échec elle se brise
          shift: () => riskyParry(actor, i),
          minis: [{ icon: "fa-solid fa-shield-halved", tip: `Parer avec ${i.name} (action rapide) — règle maison : sur un 1, ou sans aucun 6, l'arme se brise`, run: () => riskyParry(actor, i) }]
        })
      };
    });
    if (weapons.length) combat.push({ title: "Armes", actions: weapons });
    const armors = worn("armor");
    // Un bouclier sert aussi à parer et à bousculer
    const armorActs = armors.map((i) => {
      const shield = i.system.part === "shield";
      return { label: i.name, img: i.img, item: i, sub: i.system.bonus ? `${i.system.bonus.value}` : "", tip: itemTip(i) + (shield ? " — Maj : parer · Alt : bousculer" : ""), broken: i.isBroken,
        run: () => sheet().rollSpecificArmor(i.id),
        ...(shield ? {
          shift: () => sheet().rollAction("parry", i.id), alt: () => sheet().rollAction("shove", i.id),
          minis: [
            { icon: "fa-solid fa-shield-halved", tip: `Parer avec ${i.name} (action rapide)`, run: () => sheet().rollAction("parry", i.id) },
            { icon: "fa-solid fa-hand-back-fist", tip: `Bousculer avec ${i.name} (action rapide)`, run: () => sheet().rollAction("shove", i.id) }
          ]
        } : {}) };
    });
    if (armors.length) armorActs.unshift({ label: "Armure totale", icon: "fa-solid fa-shield", run: () => sheet().rollArmor() });
    if (armorActs.length) combat.push({ title: "Armure", actions: armorActs });
  } else {
    const attacks = actor.items.filter((i) => i.type === "monsterAttack");
    const acts = attacks.map((i) => ({ label: i.name, img: i.img, item: i, sub: i.system.damage ? `${i.system.damage}` : "", tip: itemTip(i), run: () => sheet().rollSpecificAttack(i.id) }));
    if (attacks.length) acts.unshift({ label: "Attaque au hasard", icon: "fa-solid fa-dice", run: () => sheet().rollAttack() });
    if (acts.length) combat.push({ title: "Attaques du monstre", actions: acts });
    combat.push({ title: "Armure", actions: [{ label: "Armure", sub: String(sys.armor?.value ?? 0), icon: "fa-solid fa-shield", run: () => sheet().rollArmor() }] });
  }
  combat.push({ title: "Actions", actions: COMBAT.map(([k, key, fb, sp]) => ({ label: tr(key, fb), speed: sp, run: () => sheet().rollAction(k) })) });
  if (isChar) combat.push({ title: "Autres", actions: OTHER.map(([k, key, fb, sp]) => ({ label: tr(key, fb), speed: sp, run: () => sheet().rollAction(k) })) });
  groups.push({ id: "combat", label: "Combat", icon: "fa-solid fa-khanda", sections: combat });

  // --- Sorts ---
  const spells = actor.items.filter((i) => i.type === "spell");
  if (spells.length) {
    const ranks = {};
    const wp = sys.bio?.willpower?.value ?? null;
    for (const i of spells) {
      const rank = Number(i.system.rank ?? 1);
      // Livre de base, Magie : « il faut dépenser minimum 1 point de Volonté pour lancer un sort » (quel que soit son rang)
      const short = wp !== null && wp < 1;
      (ranks[rank] ??= []).push({ label: i.name, img: i.img, item: i, bullet: true, speed: "L", dim: short,
        tip: itemTip(i) + (short ? " — il faut au moins 1 point de Volonté pour lancer un sort" : ""), run: () => sheet().rollSpell(i.id) });
    }
    groups.push({ id: "spell", label: "Sorts", icon: "fa-solid fa-wand-sparkles",
      top: wp !== null ? `Volonté : <b>${wp}</b>` : "",
      sections: Object.keys(ranks).sort().map((r) => ({ title: `Rang ${r}`, actions: ranks[r].sort((a, b) => a.label.localeCompare(b.label)) })) });
  }

  // --- Talents (envoyés au chat) ---
  const talents = actor.items.filter((i) => i.type === "talent" || i.type === "monsterTalent");
  if (talents.length) groups.push({ id: "talent", label: "Talents", icon: "fa-solid fa-star",
    sections: [{ actions: talents.sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({
      label: i.name, img: i.img, item: i, sub: i.system.rank ? `${i.system.rank}` : "", tip: "Clic : montrer au chat · clic droit : fiche",
      run: () => (i.sendToChat ? i.sendToChat() : i.sheet.render(true)) })) }] });

  if (isChar) {
    // --- Consommables & états ---
    const dice = CONFIG.fbl?.consumableDice ?? {};
    const cons = Object.entries(sys.consumable ?? {}).map(([k, c]) => ({
      label: tr(c.label, k), sub: dice[c.value] ?? "—", dim: !c.value, run: () => sheet().rollConsumable(k)
    }));
    const conds = Object.entries(sys.condition ?? {}).map(([k, c]) => ({
      label: tr(c.label, k), active: !!c.value, toggle: true, tip: c.value ? "Actif — cliquer pour retirer" : "Cliquer pour appliquer", run: () => actor.toggleCondition(k)
    }));
    groups.push({ id: "survie", label: "Survie", icon: "fa-solid fa-campground",
      sections: [{ title: "Consommables", actions: cons }, { title: "États", actions: conds }] });

    // --- Voyage : l'activité donnée sur la feuille de Groupe passe en premier ---
    const mine = [];
    for (const party of partiesOf(actor)) for (const act of ACTIVITIES)
      if ((party.system.travel?.[act.key] ?? []).includes(actor.id)) mine.push(act);
    const sections = [];
    const used = new Set();
    for (const act of mine) {
      act.rolls.forEach((k) => used.add(k));
      sections.push({ title: tr(act.name, act.fb), mine: true,
        actions: act.rolls.length ? act.rolls.map((k) => ({ label: travelLabel(k), active: true, run: () => travelRoll(actor, k) }))
          : [{ label: "Pas de jet", dim: true, run: () => {} }] });
    }
    const rest = TRAVEL.filter(([k]) => !used.has(k)).map(([k, key, fb]) => ({ label: tr(key, fb), dim: mine.length > 0, run: () => sheet().rollAction(k) }));
    sections.push({ title: mine.length ? "Autres jets" : "", actions: rest });
    groups.push({ id: "voyage", label: "Voyage", icon: "fa-solid fa-route", sections });
  }

  // --- Personnage / tour ---
  const util = [initiativeAction([actor])];
  if (game.combat?.combatant?.tokenId === token.id) util.push({ label: "Finir le tour", icon: "fa-solid fa-forward", run: () => game.combat.nextTurn() });
  if (isChar) {
    util.push({ label: tr("SHEET.HEADER.REST", "Se reposer"), icon: "fa-solid fa-bed", run: () => actor.rest() });
    if (sys.bio?.pride?.value) util.push({ label: tr("BIO.PRIDE", "Fierté"), icon: "fa-solid fa-crown", tip: sys.bio.pride.value, run: () => sheet().rollPride() });
    util.push({ label: tr("BIO.REPUTATION", "Réputation"), icon: "fa-solid fa-people-group", sub: String(sys.bio?.reputation?.value ?? 0), run: () => sheet().rollReputation() });
  }
  util.push({ label: "Ouvrir la fiche", icon: "fa-solid fa-id-card", run: () => actor.sheet.render(true) });
  groups.push({ id: "perso", label: isChar ? "Personnage" : "Monstre", icon: "fa-solid fa-user", sections: [{ actions: util }] });

  return groups;
}

/* -------------------------------------------- */
/*  Parer avec une arme à distance (règle maison) */
/* -------------------------------------------- */

let pendingParry = null;           // la parade qu'on vient de lancer (sur ce poste)
const watched = new Map();         // message de chat -> arme à surveiller
const warned = new Set();

function riskyParry(actor, item) {
  pendingParry = { actorId: actor.id, uuid: item.uuid, name: item.name, until: Date.now() + 5 * 60 * 1000 };
  return actor.sheet.rollAction("parry", item.id);
}

/** Dés d'un jet : résultats actifs (après poussée, les 1 et les 6 restent). */
function faces(roll) {
  const out = [];
  for (const d of roll.dice ?? []) for (const r of d.results ?? []) if (r.active !== false && !r.discarded) out.push(r.result);
  return out;
}

async function breakWeapon(uuid, speaker) {
  const item = await fromUuid(uuid);
  if (!item || !item.isOwner) return false;
  if ((item.system.bonus?.value ?? 0) > 0) await item.update({ "system.bonus.value": 0 });
  await ChatMessage.create({ speaker, content: `<div class="fla-chat"><p><i class="fa-solid fa-heart-crack"></i> <b>${esc(item.name)} se brise</b> (bonus à 0) : ce n'est pas fait pour parer. Il faudra le réparer.</p></div>` });
  return true;
}

/* Règle maison : parer avec une arme à distance.
   - un 1 sur n'importe quel dé : l'arme casse (un 1 ne se relance pas en poussant, donc c'est définitif) ;
   - aucun 6 : l'arme casse (on attend : le joueur peut encore pousser) ;
   - au moins un 6 et aucun 1 : l'arme tient. */
async function checkParry(msg) {
  const w = watched.get(msg.id);
  const roll = msg.rolls?.[0];
  if (!w || !roll || w.done) return;
  const f = faces(roll);
  const ones = f.filter((x) => x === 1).length;
  const succ = roll.successCount ?? f.filter((x) => x === 6).length;
  if (ones > 0) {
    w.done = true;
    if (!(await breakWeapon(w.uuid, msg.speaker))) warnBreak(msg, w, `un 1 est sorti`);
    return;
  }
  if (succ > 0) return;                       // un 6 et aucun 1 : l'arme tient
  if (warned.has(msg.id)) return;
  warned.add(msg.id);
  warnBreak(msg, w, "aucun succès", true);
}

function warnBreak(msg, w, why, canPush = false) {
  return ChatMessage.create({
    speaker: msg.speaker,
    content: `<div class="fla-chat"><p><b>Parade avec ${esc(w.name)} : ${why}.</b> L'arme se brise.</p>
      <p><button type="button" data-fla-break="${esc(w.uuid)}"><i class="fa-solid fa-heart-crack"></i> Briser ${esc(w.name)}</button></p>
      ${canPush ? `<p class="fla-chat-note">Le joueur peut encore pousser son jet : s'il obtient un 6 sans aucun 1, ignorez ce message.</p>` : ""}</div>`
  });
}

Hooks.on("createChatMessage", (msg) => {
  const p = pendingParry;
  if (!p || Date.now() > p.until || msg.speaker?.actor !== p.actorId || !msg.rolls?.length) return;
  pendingParry = null;
  watched.set(msg.id, p);
  checkParry(msg);
});
Hooks.on("updateChatMessage", (msg) => { if (watched.has(msg.id)) checkParry(msg); });
Hooks.on("renderChatMessageHTML", (msg, html) => {
  for (const btn of html.querySelectorAll?.("[data-fla-break]") ?? []) {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const ok = await breakWeapon(btn.dataset.flaBreak, msg.speaker);
      if (!ok) return ui.notifications.warn("Seul le MJ ou le joueur du personnage peut briser l'arme.");
      btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-heart-crack"></i> Brisée`;
    });
  }
});

/* -------------------------------------------- */
/*  Affichage                                    */
/* -------------------------------------------- */

function actionHTML(a) {
  const id = foundry.utils.randomID();
  const pic = game.settings.get(MOD, "icons") && a.img && !a.img.includes("mystery-man") ? `<img src="${esc(a.img)}" alt="">` : "";
  const cls = ["fla-act", a.active ? "active" : "", a.toggle ? "toggle" : "", a.dim ? "dim" : "", a.broken ? "broken" : "", a.low ? "low" : ""].filter(Boolean).join(" ");
  if (a.broken) a = { ...a, run: () => ui.notifications.warn(`${a.label} est brisé : il faut le réparer (Artisanat) avant de s'en servir.`), shift: null, alt: null, minis: [] };
  const tip = [a.broken ? "Brisé, à réparer" : "", a.tip].filter(Boolean).join(" — ");
  handlers.set(id, a);
  const speed = a.speed ? `<span class="fla-speed ${a.speed === "L" ? "slow" : "fast"}" data-tooltip="${a.speed === "L" ? "Action lente" : "Action rapide"}">${a.speed === "L" ? "lente" : "rapide"}</span>` : "";
  const minis = (a.minis ?? []).map((m) => { const mid = foundry.utils.randomID(); handlers.set(mid, m); return `<button type="button" class="fla-mini" data-fla="${mid}" data-tooltip="${esc(m.tip)}"><i class="${m.icon}"></i></button>`; }).join("");
  const mark = a.toggle ? `<span class="fla-dot"></span>` : "";
  const bullet = a.bullet ? `<span class="fla-bullet">✣</span>` : "";
  return `<div class="fla-row"><button type="button" class="${cls}" data-fla="${id}"${tip ? ` data-tooltip="${esc(tip)}"` : ""}>${bullet}${pic}<span class="fla-name">${esc(a.label)}</span>${speed}${a.sub ? `<span class="fla-sub">${esc(a.sub)}</span>` : ""}${mark}</button>${minis}</div>`;
}

function render() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, 40);
}

function doRender() {
  if (!game.settings.get(MOD, "enabled") || !canvas?.ready) return hide();
  const toks = selection();
  if (!toks.length) return hide();
  handlers = new Map();
  let groups, head;
  if (toks.length === 1) {
    const t = toks[0];
    groups = buildGroups(t);
    head = `<span>${esc(t.name)}</span>`;
  } else {
    groups = [{ id: "groupe", label: `${toks.length} tokens`, icon: "fa-solid fa-users", sections: [{ actions: [initiativeAction(toks.map((t) => t.actor).filter((a) => a.type !== "party"))] }] }];
    head = `<span>${toks.length} tokens</span>`;
  }
  if (!groups.some((g) => g.id === openGroup)) openGroup = game.settings.get(MOD, "hover") ? null : openGroup;
  // Avec le module de combat : actions lente et rapide déjà faites ?
  const rem = toks.length === 1 ? globalThis.flCombat?.remaining?.(toks[0].actor) : null;
  const spent = !!rem && rem.total >= 2;
  // C'est son tour ? La barre s'éclaire, et l'onglet Combat s'ouvre une fois par tour.
  const myTurn = toks.length === 1 && !!game.combat?.started && game.combat.combatant?.tokenId === toks[0].id;


  if (!el) {
    el = document.createElement("div");
    el.id = "fl-actions";
    document.body.appendChild(el);
    bind();
  }
  const pos = game.settings.get(MOD, "position") ?? {};
  el.style.left = `${pos.left ?? 120}px`;
  el.style.top = `${pos.top ?? 70}px`;
  el.style.setProperty("--fla-scale", (game.settings.get(MOD, "scale") ?? 100) / 100);
  el.classList.toggle("hover-mode", !!game.settings.get(MOD, "hover"));
  el.classList.toggle("my-turn", myTurn && !spent);
  el.innerHTML = `
    <div class="fla-head"><span class="fla-grip" data-tooltip="Déplacer la barre"><i class="fa-solid fa-grip-vertical"></i></span>${head}${myTurn ? `<span class="fla-turn">— à toi de jouer</span>` : ""}${spent ? `<span class="fla-turn fla-spent">— plus d'action ce tour (sauf accord du MJ)</span>` : ""}</div>
    <div class="fla-tabs">${groups.map((g) => `
      <div class="fla-group${g.id === openGroup ? " open" : ""}" data-group="${g.id}">
        <button type="button" class="fla-tab">${esc(g.label)}</button>
        <div class="fla-panel">${g.top ? `<div class="fla-top">${g.top}</div>` : ""}${g.sections.map((s) => `
          <div class="fla-section${s.mine ? " mine" : ""}">${s.title ? `<h4>${s.mine ? `<span class="fla-mine-tag">Ton activité</span>` : ""}${esc(s.title)}</h4>` : ""}<div class="fla-list">${s.actions.map(actionHTML).join("")}</div></div>`).join("")}
        </div>
      </div>`).join("")}
    </div>`;
  el.hidden = false;
  if (openGroup) setOpen(openGroup);
}

function hide() { if (el) el.hidden = true; }

/** Ouvre l'onglet demandé ; son menu se place sous l'onglet, décalé vers la gauche s'il sortirait de l'écran. */
function setOpen(id) {
  openGroup = id;
  for (const x of el.querySelectorAll(".fla-group")) {
    const on = x.dataset.group === openGroup;
    x.classList.toggle("open", on);
    const panel = x.querySelector(".fla-panel");
    if (!panel) continue;
    panel.style.left = "0px";
    if (!on) continue;
    const scale = (game.settings.get(MOD, "scale") ?? 100) / 100;
    const r = panel.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 8);
    if (over > 0) panel.style.left = `${-Math.min(over, r.left - 4) / scale}px`;
  }
}

function bind() {
  // ouvrir / fermer un onglet
  el.addEventListener("click", (ev) => {
    const tab = ev.target.closest(".fla-tab");
    if (tab) {
      const g = tab.closest(".fla-group").dataset.group;
      if (game.settings.get(MOD, "hover")) return setOpen(g);
      return setOpen(openGroup === g ? null : g);
    }
    const b = ev.target.closest("[data-fla]");
    if (!b) return;
    const a = handlers.get(b.dataset.fla);
    if (!a) return;
    const fn = (ev.shiftKey && a.shift) || (ev.altKey && a.alt) || a.run;
    safe(fn).then(() => { if (a.toggle) render(); });
  });
  // clic droit : fiche de l'objet
  el.addEventListener("contextmenu", (ev) => {
    const b = ev.target.closest("[data-fla]");
    const a = b && handlers.get(b.dataset.fla);
    if (a?.item) { ev.preventDefault(); a.item.sheet.render(true); }
  });
  // mode survol : l'onglet s'ouvre sous la souris, et se referme quand elle quitte la barre (petit délai)
  let closeTimer = null;
  const show = (id) => setOpen(id);
  el.addEventListener("mouseover", (ev) => {
    if (!game.settings.get(MOD, "hover")) return;
    clearTimeout(closeTimer);
    const tab = ev.target.closest(".fla-tab");
    if (tab) { const g = tab.closest(".fla-group").dataset.group; if (g !== openGroup) show(g); }
  });
  el.addEventListener("mouseleave", () => {
    if (!game.settings.get(MOD, "hover")) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => show(null), 300);
  });
  // déplacer la barre
  el.addEventListener("pointerdown", (ev) => {
    if (!ev.target.closest(".fla-grip")) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const move = (e) => {
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, e.clientY - dy))}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      game.settings.set(MOD, "position", { left: parseInt(el.style.left), top: parseInt(el.style.top) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

/* -------------------------------------------- */
/*  Réglages et crochets                         */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MOD, "enabled", { name: "Afficher la barre d'actions", hint: "Montre la barre quand vous sélectionnez un de vos tokens.", scope: "client", config: true, type: Boolean, default: true, onChange: render });
  game.settings.register(MOD, "hover", { name: "Ouvrir les onglets au survol", hint: "L'onglet s'ouvre quand la souris passe dessus et se referme quand elle quitte la barre. Décoché : il faut cliquer.", scope: "client", config: true, type: Boolean, default: true, onChange: render });
  game.settings.register(MOD, "icons", { name: "Afficher les images des objets", hint: "Petites images à côté des armes, sorts et talents. Désactivé : barre plus sobre.", scope: "client", config: true, type: Boolean, default: false, onChange: render });
  game.settings.register(MOD, "scale", { name: "Taille de la barre (%)", scope: "client", config: true, type: Number, range: { min: 70, max: 150, step: 5 }, default: 100, onChange: render });
  game.settings.register(MOD, "position", { scope: "client", config: false, type: Object, default: { left: 120, top: 70 } });
  game.keybindings.register(MOD, "toggle", {
    name: "Afficher / masquer la barre d'actions", editable: [{ key: "KeyH", modifiers: ["Shift"] }],
    onDown: () => { game.settings.set(MOD, "enabled", !game.settings.get(MOD, "enabled")); return true; }
  });
});

for (const h of ["controlToken", "updateActor", "updateToken", "createItem", "updateItem", "deleteItem",
  "createActiveEffect", "deleteActiveEffect", "updateActiveEffect", "updateCombat", "createCombatant", "updateCombatant",
  "deleteCombatant", "deleteCombat", "createCombat", "canvasReady"]) Hooks.on(h, render);
Hooks.on("canvasTearDown", hide);
// Nouvelle sélection : la barre s'affiche fermée (on ouvre l'onglet voulu soi-même)
Hooks.on("controlToken", () => { openGroup = null; });
Hooks.once("ready", () => { globalThis.flActions = { render, riskyParry }; render(); });
