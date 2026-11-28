/**
 * Forbidden Lands – Combat automatisé
 * Règles : Livre de base (Manuel des joueurs, chap. Combat & Dégâts ; Guide du MJ, Monstres au combat).
 *
 *  - Par round : une action lente et une action rapide, ou deux actions rapides.
 *  - ESQUIVE et PARADE sont des réactions (actions rapides) déclarées AVANT le jet d'attaque ;
 *    impossibles si le défenseur a déjà utilisé ses deux actions du round.
 *  - Chaque succès de défense élimine un succès de l'attaquant ; les succès en trop n'ont aucun effet.
 *  - Dégâts = dégâts de l'arme + 1 par succès au-delà du premier, sur la Force.
 *  - Armure (dégâts physiques sur la Force uniquement) : dés d'équipement = protection, chaque 6 retire 1 dégât ;
 *    si des dégâts passent, la protection baisse de 1 par 1 obtenu (pas les protections naturelles).
 *  - Monstres : on ne peut pas PARER leurs attaques (on peut esquiver) ; Brisé = mort ou agonie, pas de blessure critique.
 *  - Attaque de peur : chaque succès = 1 dégât d'Esprit, pas d'armure.
 *  - SOIGNER : action lente, chaque succès rend 1 point à l'attribut Brisé.
 */
const MOD = "fl-combat";
const SOCKET = `module.${MOD}`;
const L = (k) => game.i18n.localize(k);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Vitesse des actions (Manuel des joueurs, « Actions lentes & actions rapides ») */
const SPEED = {
  unarmed: "slow", grapple: "slow", "break-free": "slow", flee: "slow", persuade: "slow", taunt: "slow", heal: "slow", shoot: "slow",
  slash: "slow", stab: "slow", melee: "slow", ranged: "slow",
  "grapple-attack": "fast", parry: "fast", dodge: "fast", shove: "fast", disarm: "fast", retreat: "fast", run: "fast"
};
const ATTR_LABEL = { strength: "Force", agility: "Agilité", wits: "Esprit", empathy: "Empathie" };
const TYPE_LABEL = { slash: "coup de taille", stab: "coup d'estoc", punch: "coup à mains nues", shoot: "tir", monster: "attaque de monstre", fear: "attaque de peur" };
/* Tables de blessures critiques (Livre de base) : noms anglais d'origine et traduction française (Babele) */
const CRIT_TABLES = {
  slash: ["Critical Injuries - Slash Wounds", "Blessures Critiques - Plaies Béantes"],
  stab: ["Critical Injuries - Stab Wounds", "Blessures Critiques - Perforations"],
  blunt: ["Critical Injuries - Blunt Wounds", "Blessures Critiques - Chocs Violents"],
  other: ["Critical Injuries - Other", "Blessures Critiques - Autres"],
  horror: ["Horror Trauma", "Traumatismes Psychiques"]
};

/* -------------------------------------------- */
/*  Utilitaires                                  */
/* -------------------------------------------- */

const isActiveGM = () => game.users.activeGM?.isSelf ?? game.user.isGM;

function faces(roll) {
  const out = [];
  for (const d of roll?.dice ?? []) for (const r of d.results ?? []) if (r.active !== false && !r.discarded) out.push(r.result);
  return out;
}
/** Le jet a-t-il déjà été poussé ? (le système crée alors un nouveau message, les anciens dés y restent inactifs) */
function estPousse(r) { return !!(r?.pushed || r?.pushCount > 0 || r?.options?.pushed || (r?.dice ?? []).some((d) => (d.results ?? []).some((x) => x.active === false))); }
function successes(roll) {
  if (!roll) return 0;
  if (typeof roll.successCount === "number") return roll.successCount;
  return faces(roll).filter((x) => x === 6).length;
}
/** Nombre de 1 sur un jet d'armure (que des dés d'équipement) : usure de l'armure. */
function gearOnes(roll) { return faces(roll).filter((x) => x === 1).length; }

/**
 * La carte d'initiative (combattant) qui paie l'action.
 * Un monstre peut avoir plusieurs cartes d'initiative : chacune a sa propre action lente et rapide.
 *  - à son tour : la carte en train de jouer ;
 *  - sinon (une défense) : la première de ses cartes à qui il reste l'action voulue.
 */
function combatantsOf(actor, token) {
  const c = game.combat;
  if (!c?.started || !actor) return [];
  const byToken = token ? c.combatants.filter((x) => x.tokenId === token.id) : [];
  return byToken.length ? byToken : c.combatants.filter((x) => x.actorId === actor.id);
}
function combatantOf(actor, token, kind = null) {
  const list = combatantsOf(actor, token);
  if (!list.length) return null;
  const cur = game.combat.combatant;
  if (cur && list.includes(cur)) return cur;
  if (kind) {
    const ok = list.find((x) => { const r = remaining(x); return kind === "slow" ? r.canSlow : r.canFast; });
    if (ok) return ok;
  }
  return list[0];
}

/** Actions restantes du round : une lente et une rapide, ou deux rapides. */
function remaining(cbt) {
  if (!cbt || !game.combat?.started) return null;
  const f = cbt.getFlag(MOD, "actions");
  const used = f && f.round === game.combat.round ? f : { slow: 0, fast: 0 };
  const total = used.slow + used.fast;
  return { slow: used.slow, fast: used.fast, canSlow: used.slow < 1 && total < 2, canFast: total < 2, total };
}

/** Le MJ autorise-t-il une action de plus ? (le MJ lui-même confirme ; un joueur envoie la demande au MJ) */
async function gmAllows(actor, what) {
  const { DialogV2 } = foundry.applications.api;
  if (game.user.isGM) return DialogV2.confirm({
    window: { title: "Plus d'action ce tour" },
    content: `<p><b>${esc(actor.name)}</b> a déjà utilisé ses actions de ce tour (${esc(what)}).</p><p>Autoriser quand même ?</p>`,
    rejectClose: false
  });
  const gm = game.users.activeGM ?? game.users.find((u) => u.active && u.isGM);
  if (!gm) { ui.notifications.warn("Aucun MJ connecté pour donner son accord."); return false; }
  const ask = foundry.utils.randomID();
  ui.notifications.info("Demande envoyée au MJ…");
  game.socket.emit(SOCKET, { t: "allow?", ask, to: gm.id, actor: actor.name, what, from: game.user.name });
  const ok = await new Promise((resolve) => waiting.set(ask, resolve));
  waiting.delete(ask);
  ui.notifications[ok ? "info" : "warn"](ok ? "Le MJ autorise l'action." : "Le MJ refuse : plus d'action pour ce tour.");
  return ok;
}

/** Dépense une action du tour. Renvoie false si l'action est refusée. */
async function spend(actor, token, kind) {
  const cbt = combatantOf(actor, token, kind);
  if (!cbt || !kind) return true;
  const r = remaining(cbt);
  const blocked = kind === "slow" ? !r.canSlow : !r.canFast;
  if (blocked) {
    const what = r.total >= 2 ? "plus aucune action" : "plus d'action lente, seulement une rapide";
    ui.notifications.warn(r.total >= 2
      ? `${actor.name} a fait son action lente et son action rapide : plus rien pour ce tour, sauf accord du MJ.`
      : `${actor.name} n'a plus d'action lente ce tour (il lui reste une action rapide), sauf accord du MJ.`);
    if (!(await gmAllows(actor, what))) return false;
  }
  const next = { round: game.combat.round, slow: r.slow + (kind === "slow" ? 1 : 0), fast: r.fast + (kind === "fast" ? 1 : 0) };
  if (cbt.isOwner) await cbt.setFlag(MOD, "actions", next);
  else game.socket.emit(SOCKET, { t: "spend", combatId: game.combat.id, cbtId: cbt.id, next });
  // les deux actions sont faites : on le dit
  if (next.slow + next.fast >= 2 && !blocked) ui.notifications.info(`${actor.name} a utilisé toutes ses actions : plus rien pour ce tour, sauf accord du MJ.`);
  return true;
}

function tokenOf(actor) {
  return actor.token?.object ?? canvas.tokens?.controlled.find((t) => t.actor === actor) ?? actor.getActiveTokens?.()[0] ?? null;
}

/** Le joueur qui doit répondre pour ce personnage : son joueur s'il est connecté, sinon le MJ. */
function responderFor(actor) {
  const players = game.users.filter((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  const own = players.find((u) => u.character?.id === actor.id) ?? players[0];
  return own ?? game.users.activeGM ?? game.users.find((u) => u.active && u.isGM) ?? null;
}

async function findTable(key) {
  const names = CRIT_TABLES[key] ?? [];
  for (const n of names) { const t = game.tables.getName(n); if (t) return t; }
  for (const pack of game.packs.filter((p) => p.documentName === "RollTable")) {
    const idx = await pack.getIndex();
    const hit = idx.find((e) => names.includes(e.name));
    if (hit) return pack.getDocument(hit._id);
  }
  return null;
}

/* -------------------------------------------- */
/*  Jets marqués : on relie chaque jet du système */
/*  à son combat (attaque, défense, armure, soin)  */
/* -------------------------------------------- */

const pending = new Map(); // acteur -> { fight, role, until } (un attaquant et un défenseur peuvent lancer en même temps)
function expect(fight, role, actor) { pending.set(actor.id, { fight, role, until: Date.now() + 3 * 60 * 1000 }); }

Hooks.on("preCreateChatMessage", (msg, data) => {
  if (!msg.rolls?.length) return;
  // l'auteur du jet : l'orateur du message, ou l'acteur noté dans le jet par le système
  let id = data.speaker?.actor ?? msg.speaker?.actor;
  if (!pending.has(id)) id = msg.rolls[0]?.options?.actorId ?? id;
  let p = pending.get(id);
  if (!p) {
    // Jet poussé : le système crée un nouveau message et supprime l'ancien. On reprend le lien de l'ancien.
    const r = msg.rolls[0];
    if (!estPousse(r)) return;
    const nomJet = (x) => x?.options?.name ?? x?.name ?? x?.formula ?? "";
    const nbDes = (x) => (x?.dice ?? []).reduce((n, d) => n + (d.results ?? []).filter((y) => y.active !== false).length, 0);
    const avant = game.messages.contents.filter((m) => m.flags?.[MOD]?.fight && m.flags[MOD].role && m.speaker?.actor === id
      && Date.now() - (m.timestamp ?? Date.now()) < 10 * 60 * 1000 && nomJet(m.rolls?.[0]) === nomJet(r) && nbDes(m.rolls?.[0]) === nbDes(r)).at(-1);
    if (!avant) return;
    msg.updateSource({ [`flags.${MOD}`]: { fight: avant.flags[MOD].fight, role: avant.flags[MOD].role } });
    return;
  }
  pending.delete(id);
  if (Date.now() > p.until) return;
  msg.updateSource({ [`flags.${MOD}`]: { fight: p.fight, role: p.role } });
});

function refreshCard(fight) {
  const card = game.messages.contents.find((m) => m.getFlag(MOD, "card") && m.getFlag(MOD, "id") === fight);
  if (!card) return;
  if (ui.chat?.updateMessage) ui.chat.updateMessage(card);
  else ui.chat?.render?.();
}
for (const h of ["createChatMessage", "updateChatMessage", "deleteChatMessage"]) Hooks.on(h, (msg) => {
  const f = msg.getFlag?.(MOD, "fight");
  if (f) refreshCard(f);
});

/* -------------------------------------------- */
/*  La fenêtre de défense (chez le défenseur)     */
/* -------------------------------------------- */

/** Défenses possibles contre ce type d'attaque, selon l'équipement du défenseur. */
function defenseOptions(actor, type) {
  const opts = [];
  if (type === "fear") return opts;
  // ESQUIVE : contre tout (corps-à-corps, tir, monstre)
  opts.push({ id: "dodge-ground", label: "Esquiver (vous finissez au sol)", note: type === "slash" ? "+2 contre un coup de taille" : "" });
  opts.push({ id: "dodge-stand", label: "Esquiver en restant debout", note: "−2" + (type === "slash" ? ", +2 contre un coup de taille" : "") });
  if (type === "monster") return opts; // « on ne peut pas PARER une attaque de monstre » (sauf indication contraire)
  const carried = (i) => ["equipped", "carried", ""].includes(i.getFlag?.("forbidden-lands", "state") ?? "");
  const equipped = (i) => i.getFlag?.("forbidden-lands", "state") === "equipped";
  const pick = (list) => (list.some(equipped) ? list.filter(equipped) : list.filter(carried));
  const shields = pick(actor.items.filter((i) => (i.type === "armor" && i.system.part === "shield") || (i.type === "weapon" && i.system.features?.shield)));
  const melee = pick(actor.items.filter((i) => i.type === "weapon" && i.system.category === "melee" && !i.system.features?.shield));
  const ranged = pick(actor.items.filter((i) => i.type === "weapon" && i.system.category === "ranged"));
  const broken = (i) => i.isBroken;
  for (const s of shields) if (!broken(s)) opts.push({ id: `parry:${s.id}`, label: `Parer avec ${s.name} (bouclier)`, note: ["stab", "punch"].includes(type) ? "+2" : "" });
  if (type === "shoot") {
    // Parer un tir : bouclier, ou arme dotée du trait PARADE avec le rang 2 du talent de l'arme
    for (const w of melee) if (!broken(w) && w.system.features?.parrying)
      opts.push({ id: `parry:${w.id}`, label: `Parer avec ${w.name}`, note: "seulement avec le rang 2 du talent de cette arme" });
    return opts;
  }
  for (const w of melee) if (!broken(w)) {
    const notes = [];
    if (!w.system.features?.parrying) notes.push("−2 sans le trait Parade");
    if (type === "stab") notes.push("−2 contre un estoc");
    if (type === "punch") notes.push("+2 contre un coup à mains nues");
    opts.push({ id: `parry:${w.id}`, label: `Parer avec ${w.name}`, note: notes.join(", ") });
  }
  // Règle maison (barre d'actions) : parer avec une arme à distance, qui se brise sur un 1 ou sans aucun 6
  if (globalThis.flActions?.riskyParry) for (const w of ranged) if (!broken(w))
    opts.push({ id: `risky:${w.id}`, label: `Parer avec ${w.name}`, note: "règle maison : se brise sur un 1 ou sans aucun 6" });
  return opts;
}

/** Coche, dans la fenêtre de jet du système, les modificateurs qui correspondent à l'attaque reçue. */
function withDefenseModifiers(actor, type, standing, fn) {
  const orig = actor.getRollModifierOptions;
  const names = {
    standing: L("ROLL.STANDING_DODGE"), dodgeSlash: L("ROLL.DODGE_SLASH"),
    shield: L("ROLL.PARRY_NON_SLASH"), stab: L("ROLL.PARRY_STAB"), punch: L("ROLL.PARRY_PUNCH")
  };
  actor.getRollModifierOptions = function (...ids) {
    const mods = orig.apply(this, ids);
    for (const m of mods) {
      if (m.name === names.standing) m.active = !!standing;
      else if (m.name === names.dodgeSlash) m.active = type === "slash";
      else if (m.name === names.shield) m.active = type === "stab" || type === "punch";
      else if (m.name === names.stab) m.active = type === "stab";
      else if (m.name === names.punch) m.active = type === "punch";
    }
    return mods;
  };
  try { return fn(); } finally { setTimeout(() => { actor.getRollModifierOptions = orig; }, 1500); }
}

async function askDefense(req) {
  const target = (await fromUuid(req.targetUuid))?.actor ?? (await fromUuid(req.targetUuid));
  if (!target) return "none";
  const opts = defenseOptions(target, req.type);
  if (!opts.length) return "none";
  const { DialogV2 } = foundry.applications.api;
  const choice = await new Promise((resolve) => {
    const dlg = new DialogV2({
      window: { title: `${target.name} est attaqué !`, icon: "fa-solid fa-shield-halved" },
      classes: ["fl-combat-defense"],
      position: { width: 420 },
      content: `<p><b>${esc(req.attacker)}</b> attaque <b>${esc(target.name)}</b> : ${esc(TYPE_LABEL[req.type] ?? "attaque")}${req.weapon ? ` avec <i>${esc(req.weapon)}</i>` : ""}.</p>
        <p class="flc-hint">Esquive et parade sont des actions rapides, à annoncer avant le jet d'attaque. Chaque 6 obtenu annule un 6 de l'attaquant.</p>`,
      buttons: [
        ...opts.map((o) => ({ action: o.id, label: o.note ? `${o.label} (${o.note})` : o.label })),
        { action: "none", label: "Encaisser", default: true }
      ],
      submit: (result) => resolve(result ?? "none")
    });
    dlg.addEventListener?.("close", () => resolve("none"));
    dlg.render({ force: true });
  });
  return choice;
}

/** Le défenseur a choisi : on lance son jet (sur son poste). */
async function rollDefense(req, choice) {
  if (!choice || choice === "none") return;
  const tok = await fromUuid(req.targetUuid);
  const actor = tok?.actor ?? tok;
  if (!actor) return;
  if (!(await spend(actor, tok?.object ?? null, "fast"))) return defensePerdue(req.fight, "action rapide refusée");
  expect(req.fight, "defense", actor);
  internal = true;
  try {
    if (choice.startsWith("dodge")) await withDefenseModifiers(actor, req.type, choice === "dodge-stand", () => actor.sheet.rollAction("dodge"));
    else if (choice.startsWith("parry:")) await withDefenseModifiers(actor, req.type, false, () => actor.sheet.rollAction("parry", choice.slice(6)));
    else if (choice.startsWith("risky:")) {
      const item = actor.items.get(choice.slice(6));
      await withDefenseModifiers(actor, req.type, false, () => globalThis.flActions.riskyParry(actor, item));
    }
  } catch (e) { ui.notifications.warn(e?.message ?? String(e)); }
  finally { internal = false; }
  // Le joueur a fermé la fenêtre de jet sans lancer : la carte ne doit pas attendre pour rien.
  await waitDefenseRoll(actor.id);
  if (pending.get(actor.id)?.fight === req.fight) { pending.delete(actor.id); await defensePerdue(req.fight, "jet de défense annulé"); }
}

/** Une fenêtre de jet du système est-elle ouverte ? (il n'en accepte qu'une à la fois) */
function rollDialogOpen() {
  const apps = [...(foundry.applications.instances?.values?.() ?? []), ...Object.values(ui.windows ?? {})];
  return apps.some((a) => /RollHandler/i.test(a?.constructor?.name ?? "") || /roll-handler|fbl-roll|roll-dialog/i.test(`${a?.id ?? ""} ${(a?.options?.classes ?? []).join(" ")}`));
}
/** Attend que le défenseur ait lancé (ou annulé) son jet, avant d'ouvrir celui de l'attaquant. */
async function waitDefenseRoll(actorId) {
  const t0 = Date.now();
  await sleep(400);
  while (pending.has(actorId) && rollDialogOpen() && Date.now() - t0 < 10 * 60 * 1000) await sleep(250);
  while (rollDialogOpen() && Date.now() - t0 < 10 * 60 * 1000) await sleep(250);
}

/* -------------------------------------------- */
/*  Communication entre les postes                */
/* -------------------------------------------- */

const waiting = new Map(); // fight -> resolve
Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data) => {
    if (data.t === "ask" && data.to === game.user.id) {
      const choice = await askDefense(data);
      game.socket.emit(SOCKET, { t: "answer", fight: data.fight, choice });
      await rollDefense(data, choice);
    } else if (data.t === "allow?" && data.to === game.user.id) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Demande d'action en plus" },
        content: `<p><b>${esc(data.from)}</b> : <b>${esc(data.actor)}</b> a déjà utilisé ses actions de ce tour (${esc(data.what)}).</p><p>Autoriser l'action ?</p>`,
        rejectClose: false
      });
      game.socket.emit(SOCKET, { t: "answer", fight: data.ask, choice: !!ok });
    } else if (data.t === "answer") {
      waiting.get(data.fight)?.(data.choice);
    } else if (data.t === "spend" && isActiveGM()) {
      const cbt = game.combats.get(data.combatId)?.combatants.get(data.cbtId);
      if (cbt) await cbt.setFlag(MOD, "actions", data.next);
    } else if (data.t === "cardUpdate" && isActiveGM()) {
      const m = game.messages.get(data.id);
      if (m) await m.update(data.update);
    }
  });
});

/** La défense n'aura pas lieu : la carte passe en « encaisse ». */
const perdues = new Set();
async function defensePerdue(fight, reason) {
  perdues.add(fight);
  const card = game.messages.contents.find((m) => m.getFlag(MOD, "card") && m.getFlag(MOD, "id") === fight);
  if (card) await updateCard(card, { [`flags.${MOD}.defense`]: { choice: "none", reason } });
}
async function updateCard(card, update) {
  if (card.isOwner) return card.update(update);
  game.socket.emit(SOCKET, { t: "cardUpdate", id: card.id, update });
}

/* -------------------------------------------- */
/*  L'attaque (sur le poste de l'attaquant)       */
/* -------------------------------------------- */

let internal = false; // nos propres appels ne repassent pas par le flux

function attackTypeOfWeapon(item) {
  if (!item) return "punch";
  if (item.type === "monsterAttack") return item.system.damageType === "fear" ? "fear" : "monster";
  if (item.system.category === "ranged") return "shoot";
  const f = item.system.features ?? {};
  if (f.pointed && !(f.edged || f.blunt)) return "stab";
  if ((f.edged || f.blunt) && !f.pointed) return "slash";
  if (f.pointed && (f.edged || f.blunt)) return "ask";
  return "slash";
}
function critKey(item, type) {
  if (type === "punch") return "blunt";
  if (type === "stab") return "stab";
  if (type === "fear") return "horror";
  if (item?.type === "monsterAttack") return { slash: "slash", stab: "stab", blunt: "blunt", fear: "horror" }[item.system.damageType] ?? "other";
  const f = item?.system.features ?? {};
  if (type === "shoot") return f.blunt ? "blunt" : "stab"; // arc, couteau de lancer : perforations ; fronde, caillou : chocs violents
  if (type === "slash") return f.edged ? "slash" : "blunt";
  return "other";
}

async function attackFlow(actor, item, rollFn) {
  const targets = [...game.user.targets];
  const token = tokenOf(actor);
  if (!(await spend(actor, token, "slow"))) return;
  if (targets.length !== 1 || !game.settings.get(MOD, "enabled")) return rollFn();
  const tgt = targets[0];
  if (tgt.actor === actor) return rollFn();
  let type = attackTypeOfWeapon(item);
  if (type === "ask") {
    const { DialogV2 } = foundry.applications.api;
    type = await DialogV2.wait({
      window: { title: item.name }, content: `<p>Quelle attaque avec <b>${esc(item.name)}</b> ?</p>`,
      buttons: [{ action: "slash", label: "Coup de taille" }, { action: "stab", label: "Coup d'estoc" }], rejectClose: false
    }) ?? "slash";
  }
  const fight = foundry.utils.randomID();
  const damage = item?.type === "monsterAttack" ? Number(item.system.damage || 0) : item ? Number(item.system.damage || 0) : 1;
  const flags = {
    card: "attack", id: fight, type, crit: critKey(item, type),
    attacker: { name: token?.name ?? actor.name, uuid: actor.uuid },
    target: { name: tgt.name, uuid: tgt.document.uuid, monster: tgt.actor?.type === "monster" },
    weapon: { name: item?.name ?? "À mains nues", damage },
    defense: { choice: "pending" }
  };
  const card = await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor, token: token?.document }), content: "<p>…</p>", flags: { [MOD]: flags } });

  // La défense, déclarée avant le jet d'attaque
  let choice = "none", reason = "";
  const tcbt = combatantOf(tgt.actor, tgt, "fast");
  const rem = remaining(tcbt);
  if (type === "fear") reason = "on ne se défend pas contre la peur";
  else if (rem && !rem.canFast) reason = "plus d'action ce round";
  else if (!defenseOptions(tgt.actor, type).length) reason = "aucune défense possible";
  else {
    const who = responderFor(tgt.actor);
    const req = { t: "ask", to: who?.id, fight, attacker: flags.attacker.name, weapon: item?.name, type, targetUuid: tgt.document.uuid };
    ui.notifications.info(`${tgt.name} choisit sa défense…`);
    if (who?.id === game.user.id) {
      choice = await askDefense(req);
      await updateCard(card, { [`flags.${MOD}.defense`]: { choice, reason } });
      if (choice !== "none") await rollDefense(req, choice); // attend que le jet de défense soit lancé (une fenêtre de jet à la fois)
    } else if (who) {
      game.socket.emit(SOCKET, req);
      choice = await new Promise((resolve) => {
        waiting.set(fight, resolve);
        setTimeout(() => { if (waiting.has(fight)) { reason = "pas de réponse du joueur"; resolve("none"); } }, 2 * 60 * 1000);
      });
      waiting.delete(fight);
    }
  }
  if (!perdues.has(fight)) await updateCard(card, { [`flags.${MOD}.defense`]: { choice, reason } });
  expect(fight, "attack", actor);
  return rollFn();
}

/* -------------------------------------------- */
/*  Soins et sorts                                */
/* -------------------------------------------- */

async function careFlow(actor, kind, item, rollFn) {
  const targets = [...game.user.targets];
  const token = tokenOf(actor);
  if (!(await spend(actor, token, "slow"))) return;
  if (targets.length !== 1 || !game.settings.get(MOD, "enabled")) return rollFn();
  const tgt = targets[0];
  const fight = foundry.utils.randomID();
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor, token: token?.document }), content: "<p>…</p>",
    flags: { [MOD]: { card: "care", id: fight, kind, spell: item?.name ?? null,
      caster: { name: token?.name ?? actor.name, uuid: actor.uuid }, target: { name: tgt.name, uuid: tgt.document.uuid, monster: tgt.actor?.type === "monster" } } }
  });
  expect(fight, "care", actor);
  return rollFn();
}

/* -------------------------------------------- */
/*  Les fiches du système passent par le module   */
/* -------------------------------------------- */

function patchSheets() {
  const done = new Set();
  for (const type of ["character", "monster"]) {
    for (const entry of Object.values(CONFIG.Actor.sheetClasses?.[type] ?? {})) {
      const proto = entry.cls?.prototype;
      if (!proto || done.has(proto)) continue;
      done.add(proto);
      const wrap = (name, fn) => {
        const orig = proto[name];
        if (typeof orig !== "function" || orig.__flc) return;
        const w = function (...args) { return internal ? orig.apply(this, args) : fn.call(this, orig, ...args); };
        w.__flc = true;
        proto[name] = w;
      };
      wrap("rollGear", function (orig, itemId) {
        const item = this.actor.items.get(itemId);
        if (item?.type === "weapon") return attackFlow(this.actor, item, () => { internal = true; try { return orig.call(this, itemId); } finally { internal = false; } });
        return orig.call(this, itemId);
      });
      wrap("rollSpecificAttack", function (orig, attackId) {
        const item = this.actor.items.get(attackId);
        if (item?.type === "monsterAttack") return attackFlow(this.actor, item, () => { internal = true; try { return orig.call(this, attackId); } finally { internal = false; } });
        return orig.call(this, attackId);
      });
      wrap("rollAction", function (orig, name, itemId) {
        const call = () => { internal = true; try { return orig.call(this, name, itemId); } finally { internal = false; } };
        if (name === "unarmed") return attackFlow(this.actor, null, call);
        if (name === "heal") return careFlow(this.actor, "heal", null, call);
        if (SPEED[name]) return spend(this.actor, tokenOf(this.actor), SPEED[name]).then((ok) => (ok ? call() : undefined));
        return call();
      });
      wrap("rollSpell", function (orig, itemId) {
        const item = this.actor.items.get(itemId);
        return careFlow(this.actor, "spell", item, () => { internal = true; try { return orig.call(this, itemId); } finally { internal = false; } });
      });
    }
  }
}

/* -------------------------------------------- */
/*  La carte de combat dans le chat               */
/* -------------------------------------------- */

function related(fight) {
  const by = {};
  for (const m of game.messages.contents) {
    const f = m.flags?.[MOD];
    if (f?.fight === fight && f.role) by[f.role] = m; // le dernier l'emporte (un jet poussé crée un nouveau message)
  }
  return by;
}

async function targetActor(f) {
  const doc = await fromUuid(f.target.uuid);
  return doc?.actor ?? doc;
}

function attackState(f) {
  const r = related(f.id);
  const atk = r.attack?.rolls?.[0];
  const A = atk ? successes(atk) : null;
  const choice = f.defense?.choice ?? "pending";
  const defending = choice !== "none" && choice !== "pending";
  const D = r.defense?.rolls?.[0] ? successes(r.defense.rolls[0]) : null;
  const fear = f.type === "fear";
  const physical = !fear;
  const base = Number(atk?.options?.damage ?? f.weapon.damage ?? 0);
  let net = A === null ? null : A - (defending ? (D ?? 0) : 0);
  let dmg = null;
  if (net !== null) dmg = fear ? Math.max(0, net) : net > 0 ? base + net - 1 : 0;
  const arm = r.armor?.rolls?.[0];
  const Ar = arm ? successes(arm) : null;
  const final = dmg === null ? null : physical && Ar !== null ? Math.max(0, dmg - Ar) : dmg;
  const ones = arm ? gearOnes(arm) : 0;
  return { r, A, D, choice, defending, net, dmg, Ar, final, ones, physical, fear, base };
}

function defenseLabel(choice) {
  if (!choice || choice === "pending") return "en attente…";
  if (choice === "none") return "encaisse";
  if (choice === "dodge-ground") return "esquive (finit au sol)";
  if (choice === "dodge-stand") return "esquive en restant debout";
  if (choice.startsWith("parry:") || choice.startsWith("risky:")) return "parade";
  return choice;
}

async function renderAttackCard(msg, f) {
  const s = attackState(f);
  const tgt = await targetActor(f);
  const attr = s.fear ? "wits" : "strength";
  const lines = [];
  lines.push(`<p class="flc-title"><b>${esc(f.attacker.name)}</b> → <b>${esc(f.target.name)}</b> <span class="flc-type">${esc(TYPE_LABEL[f.type] ?? "")}${f.weapon?.name ? ` · ${esc(f.weapon.name)}` : ""}</span></p>`);
  lines.push(`<p>Défense : <b>${esc(defenseLabel(s.choice))}</b>${f.defense?.reason ? ` <i>(${esc(f.defense.reason)})</i>` : ""}</p>`);
  if (s.A === null) lines.push(`<p class="flc-wait">En attente du jet d'attaque…</p>`);
  else {
    let txt = `Attaque : <b>${s.A}</b> succès`;
    if (s.defending) txt += s.D === null ? " — <i>en attente du jet de défense…</i>" : ` − ${s.D} (défense) = <b>${Math.max(0, s.net)}</b>`;
    lines.push(`<p>${txt}</p>`);
    if (s.net <= 0) lines.push(`<p class="flc-miss">${s.A === 0 ? "L'attaque rate." : "L'attaque est arrêtée."}</p>`);
    else {
      lines.push(s.fear ? `<p>Dégâts : <b>${s.dmg}</b> sur l'Esprit (1 par succès, pas d'armure)</p>`
        : `<p>Dégâts : ${s.base} (arme)${s.net > 1 ? ` + ${s.net - 1} (succès en plus)` : ""} = <b>${s.dmg}</b></p>`);
      if (s.physical) lines.push(s.Ar === null ? `<p class="flc-wait">Armure : pas encore lancée.</p>` : `<p>Armure : ${s.Ar} succès → <b>${s.final}</b> dégât${s.final > 1 ? "s" : ""} sur la Force</p>`);
    }
  }
  const btn = [];
  const canTarget = tgt?.isOwner;
  const applied = f.applied;
  if (s.net > 0 && s.physical && s.Ar === null && canTarget && !applied)
    btn.push(`<button type="button" data-flc="armor">Jet d'armure de ${esc(f.target.name)}</button>`);
  const attenteDefense = s.defending && s.D === null && s.A !== null && s.A > 0;
  if (attenteDefense && game.user.isGM && !applied)
    btn.push(`<p class="flc-hint">Les dégâts se calculeront quand la défense sera lancée.</p><button type="button" data-flc="nodef">La défense n'arrive pas : compter sans défense</button>`);
  const defRoll = s.r.defense?.rolls?.[0];
  if (s.net > 0 && game.user.isGM && !applied && defRoll && !estPousse(defRoll) && defRoll.options?.maxPush !== 0)
    btn.push(`<p class="flc-hint">${esc(f.target.name)} peut encore pousser sa défense : attendez sa décision avant d'appliquer.</p>`);
  if (s.net > 0 && game.user.isGM && !applied && !attenteDefense) {
    const v = s.final ?? s.dmg;
    btn.push(`<div class="flc-apply"><input type="number" min="0" value="${v}" data-flc-amount> <button type="button" data-flc="apply" data-attr="${attr}">Appliquer les dégâts (${ATTR_LABEL[attr]})</button></div>`);
    if (s.physical && s.Ar === null) btn.push(`<p class="flc-hint">Vous pouvez appliquer sans jet d'armure (cible sans armure, attaque qui l'ignore…).</p>`);
  }
  if (applied) lines.push(`<p class="flc-done">✔ ${esc(applied)}${game.user.isGM && f.appliedMJ ? ` — ${esc(f.appliedMJ)}` : ""}</p>`);
  // Usure de l'armure : si des dégâts passent, −1 par 1 obtenu (pas les protections naturelles)
  if (game.user.isGM && s.Ar !== null && s.final > 0 && s.ones > 0 && !f.worn && tgt && tgt.type !== "monster") {
    const pieces = tgt.items.filter((i) => i.type === "armor" && i.system.part !== "shield" && (i.system.bonus?.value ?? 0) > 0 && i.getFlag?.("forbidden-lands", "state") === "equipped");
    if (pieces.length) btn.push(`<p>L'armure s'use : −${s.ones}. ${pieces.map((p) => `<button type="button" data-flc="wear" data-item="${p.id}">Abîmer ${esc(p.name)}</button>`).join(" ")}</p>`);
  }
  return `<div class="flc-card">${lines.join("")}${btn.join("")}</div>`;
}

async function renderCareCard(msg, f) {
  const r = related(f.id);
  const roll = r.care?.rolls?.[0];
  const S = roll ? successes(roll) : null;
  const tgt = await targetActor(f);
  const lines = [`<p class="flc-title"><b>${esc(f.caster.name)}</b> → <b>${esc(f.target.name)}</b> <span class="flc-type">${f.kind === "heal" ? "soins" : `sort · ${esc(f.spell ?? "")}`}</span></p>`];
  let def = 0, attr = "strength";
  if (S === null) lines.push(`<p class="flc-wait">En attente du jet…</p>`);
  else if (f.kind === "heal") {
    const brokenAttr = ["strength", "agility", "wits", "empathy"].find((a) => tgt?.system.attribute?.[a] && tgt.system.attribute[a].max > 0 && tgt.system.attribute[a].value <= 0);
    attr = brokenAttr ?? "strength";
    def = S;
    lines.push(`<p>${S} succès → <b>${S}</b> point${S > 1 ? "s" : ""} rendu${S > 1 ? "s" : ""} à l'attribut Brisé.</p>`);
    if (!brokenAttr) lines.push(`<p class="flc-hint">${esc(f.target.name)} n'est pas Brisé : SOIGNER sert à relever un personnage Brisé (ou à abréger une blessure critique).</p>`);
    else if (["wits", "empathy"].includes(brokenAttr)) lines.push(`<p class="flc-hint">Pour l'Esprit et l'Empathie, le livre demande un jet de REPRÉSENTATION, pas de SOINS.</p>`);
  } else {
    const wp = Number(roll?.options?.willpower ?? 0);
    def = wp + S;
    lines.push(`<p>Puissance : ${wp} (Volonté) + ${S} (succès) = <b>${def}</b> <span class="flc-hint">(+1 avec un ingrédient)</span></p>`);
    lines.push(`<p class="flc-hint">Appliquez l'effet décrit dans le sort ; ces dégâts ne passent pas par l'armure.</p>`);
  }
  const btn = [];
  if (S !== null && game.user.isGM && !f.applied) {
    const sel = Object.entries(ATTR_LABEL).map(([k, v]) => `<option value="${k}"${k === attr ? " selected" : ""}>${v}</option>`).join("");
    btn.push(`<div class="flc-apply"><input type="number" min="0" value="${def}" data-flc-amount> <select data-flc-attr>${sel}</select>
      <button type="button" data-flc="heal">Rendre</button>${f.kind === "spell" ? ` <button type="button" data-flc="hurt">Infliger</button>` : ""}</div>`);
  }
  if (f.applied) lines.push(`<p class="flc-done">✔ ${esc(f.applied)}${game.user.isGM && f.appliedMJ ? ` — ${esc(f.appliedMJ)}` : ""}</p>`);
  return `<div class="flc-card">${lines.join("")}${btn.join("")}</div>`;
}

Hooks.on("renderChatMessageHTML", async (msg, html) => {
  const f = msg.flags?.[MOD];
  if (!f?.card) return;
  const box = html.querySelector(".message-content") ?? html;
  box.innerHTML = f.card === "attack" ? await renderAttackCard(msg, f) : await renderCareCard(msg, f);
  box.addEventListener("click", (ev) => onCardClick(ev, msg));
});

async function onCardClick(ev, msg) {
  const b = ev.target.closest("[data-flc]");
  if (!b) return;
  ev.preventDefault();
  const f = msg.flags[MOD];
  const tgt = await targetActor(f);
  const amount = Math.max(0, Number(b.closest(".flc-card")?.querySelector("[data-flc-amount]")?.value ?? 0));
  switch (b.dataset.flc) {
    case "armor": {
      if (!tgt?.isOwner) return;
      expect(f.id, "armor", tgt);
      internal = true;
      try { await tgt.sheet.rollArmor(); } catch (e) { ui.notifications.warn(e?.message ?? String(e)); } finally { internal = false; }
      break;
    }
    case "apply": return applyDelta(msg, f, tgt, b.dataset.attr, -amount);
    case "nodef": if (game.user.isGM) await msg.update({ [`flags.${MOD}.defense`]: { choice: "none", reason: "défense non reçue" } }); return;
    case "heal": return applyDelta(msg, f, tgt, b.closest(".flc-card").querySelector("[data-flc-attr]").value, +amount);
    case "hurt": return applyDelta(msg, f, tgt, b.closest(".flc-card").querySelector("[data-flc-attr]").value, -amount);
    case "wear": {
      const item = tgt?.items.get(b.dataset.item);
      const s = attackState(f);
      if (!item) return;
      const v = Math.max(0, (item.system.bonus?.value ?? 0) - s.ones);
      await item.update({ "system.bonus.value": v });
      await msg.update({ [`flags.${MOD}.worn`]: `${item.name} : protection ${v}` });
      ChatMessage.create({ speaker: msg.speaker, content: `<p><i class="fa-solid fa-shield-halved"></i> ${esc(item.name)} s'use : protection ${v}.</p>` });
      break;
    }
    case "crit": {
      const t = await findTable(b.dataset.table);
      if (!t) return ui.notifications.warn("Table de blessures critiques introuvable : activez le module du livre de base.");
      await t.draw();
      break;
    }
  }
}

async function applyDelta(msg, f, actor, attr, delta) {
  if (!game.user.isGM || !actor) return;
  const a = actor.system.attribute?.[attr];
  if (!a) return ui.notifications.warn(`${actor.name} n'a pas d'attribut ${ATTR_LABEL[attr]}.`);
  // une valeur au-dessus du maximum (fiche modifiée à la main) est d'abord ramenée au maximum
  const max = a.max > 0 ? a.max : 99;
  const before = Math.min(a.value, max);
  const after = Math.max(0, Math.min(max, before + delta));
  await actor.update({ [`system.attribute.${attr}.value`]: after });
  const what = delta < 0 ? `${-delta} dégât${-delta > 1 ? "s" : ""}` : `${delta} point${delta > 1 ? "s" : ""} rendu${delta > 1 ? "s" : ""}`;
  // Les joueurs voient ce qui est infligé ; seul le MJ voit les points qui restent.
  await msg.update({ [`flags.${MOD}.applied`]: what, [`flags.${MOD}.appliedMJ`]: `${ATTR_LABEL[attr]} de ${actor.name} : ${before} → ${after}` });
  if (after === 0 && before > 0) announceBroken(msg, f, actor, attr);
}

/** Brisé : effets selon l'attribut (Manuel des joueurs, « Brisé ») ; les monstres meurent ou agonisent. */
function announceBroken(msg, f, actor, attr) {
  let body;
  if (actor.type === "monster") body = `<p><b>${esc(actor.name)}</b> est Brisé : le monstre meurt ou agonise (pas de blessure critique).</p>`;
  else if (attr === "strength") {
    const key = f.crit ?? "other";
    const label = { slash: "Plaies béantes", stab: "Perforations", blunt: "Chocs violents", other: "Autres blessures" }[key] ?? "Autres blessures";
    body = `<p><b>${esc(actor.name)}</b> est <b>Brisé</b> (Force) : assommé, il ne peut plus que RAMPER.</p>
      <p><button type="button" data-flc="crit" data-table="${key}">Blessure critique : ${label}</button></p>
      <p class="flc-hint">Avec un casque, sur 65 (plaie béante), 64 (perforation) ou 64-66 (choc violent) : lancez les dés du casque.</p>`;
  } else if (attr === "wits") body = `<p><b>${esc(actor.name)}</b> est <b>Brisé</b> (Esprit) : paralysé par la peur, il ne peut que COURIR se mettre à l'abri.</p>
      <p><button type="button" data-flc="crit" data-table="horror">Traumatisme psychique</button></p>`;
  else if (attr === "agility") body = `<p><b>${esc(actor.name)}</b> est <b>Brisé</b> (Agilité) : épuisé, il ne peut que RAMPER. Pas de blessure critique.</p>`;
  else body = `<p><b>${esc(actor.name)}</b> est <b>Brisé</b> (Empathie) : plus de communication possible avant d'avoir récupéré 1 point.</p>`;
  ChatMessage.create({ speaker: msg.speaker, content: `<div class="flc-card flc-broken">${body}</div>`, flags: { [MOD]: { broken: true } } });
}
// les boutons « Blessure critique » des messages Brisé
Hooks.on("renderChatMessageHTML", (msg, html) => {
  if (!msg.flags?.[MOD]?.broken) return;
  html.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-flc='crit']");
    if (!b) return;
    ev.preventDefault();
    const t = await findTable(b.dataset.table);
    if (!t) return ui.notifications.warn("Table de blessures critiques introuvable : activez le module du livre de base.");
    await t.draw();
  });
});

/* -------------------------------------------- */
/*  Actions restantes dans le suivi de combat     */
/* -------------------------------------------- */

Hooks.on("renderCombatTracker", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || !game.combat?.started) return;
  for (const li of root.querySelectorAll("[data-combatant-id]")) {
    const cbt = game.combat.combatants.get(li.dataset.combatantId);
    const r = remaining(cbt);
    li.querySelector(".flc-pips")?.remove();
    if (!r) continue;
    const span = document.createElement("span");
    span.className = "flc-pips";
    const left = r.total >= 2 ? "aucune action" : r.canSlow ? (r.total === 0 ? "une lente et une rapide, ou deux rapides" : "une lente ou une rapide") : "une rapide";
    span.dataset.tooltip = `Reste ce round : ${left}${game.user.isGM ? " — clic : remettre à zéro" : ""}`;
    span.innerHTML = `<b class="${r.canSlow ? "" : "used"}">L</b><b class="${r.canFast ? "" : "used"}">R</b>`;
    if (game.user.isGM) span.addEventListener("click", (ev) => { ev.stopPropagation(); cbt.unsetFlag(MOD, "actions"); });
    (li.querySelector(".token-name, .combatant-name, h4") ?? li).appendChild(span);
  }
});
for (const h of ["updateCombatant", "updateCombat"]) Hooks.on(h, () => ui.combat?.render?.());

/* -------------------------------------------- */
/*  Réglages                                     */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MOD, "enabled", { name: "Automatiser les attaques ciblées", hint: "Quand un personnage attaque un token ciblé : fenêtre de défense, calcul des dégâts et de l'armure, bouton d'application pour le MJ.", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(MOD, "barresMJ", { name: "Points de vie cachés aux joueurs", hint: "Les barres de vie des jetons ne sont visibles que par leur propriétaire et le MJ (monstres et PNJ : seulement le MJ). Dans les cartes de combat, les joueurs voient les dégâts infligés, jamais les points qui restent.", scope: "world", config: true, type: Boolean, default: true, onChange: (v) => v && cacherBarres() });
});
/** Barres de vie des jetons : visibles seulement par le propriétaire du jeton et le MJ. */
const MODE_PROPRIO = () => CONST.TOKEN_DISPLAY_MODES?.OWNER ?? 40;
Hooks.on("preCreateToken", (doc) => {
  if (game.settings.get(MOD, "barresMJ") && doc.displayBars !== CONST.TOKEN_DISPLAY_MODES?.NONE) doc.updateSource({ displayBars: MODE_PROPRIO() });
});
async function cacherBarres() {
  if (!isActiveGM() || !game.settings.get(MOD, "barresMJ")) return;
  const visibles = [CONST.TOKEN_DISPLAY_MODES?.HOVER ?? 30, CONST.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50];
  for (const sc of game.scenes ?? []) {
    const maj = sc.tokens.filter((t) => visibles.includes(t.displayBars)).map((t) => ({ _id: t.id, displayBars: MODE_PROPRIO() }));
    if (maj.length) await sc.updateEmbeddedDocuments("Token", maj);
  }
  for (const a of game.actors ?? []) if (visibles.includes(a.prototypeToken?.displayBars)) await a.update({ "prototypeToken.displayBars": MODE_PROPRIO() });
}
Hooks.once("ready", () => {
  patchSheets();
  cacherBarres();
  globalThis.flCombat = { remaining: (actor) => remaining(combatantOf(actor, tokenOf(actor), "fast")), spend };
});
