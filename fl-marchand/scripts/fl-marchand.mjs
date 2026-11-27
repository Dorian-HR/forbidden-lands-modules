// Forbidden Lands – Le Marchand
// Prix du Manuel du joueur, échoppes par lieu avec stock et bourse du marchand, disponibilité tirée chaque semaine,
// achats, ventes, troc et commandes validés par le MJ, trouvailles à revendre, journaliers, auberge, carnet de dépenses,
// et l'explication de chaque prix.
import { TARIFS, CATEGORIES, ETABS, DISPO, FACTEURS, FAB, TRESORS, JOURNALIERS, statsSysteme } from "./tarifs.mjs";
import { GARDES, promptImage } from "./gardes.mjs";

const MOD = "fl-marchand";
const SYS_ART = "systems/forbidden-lands/assets/journal-art";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const T = new Map(TARIFS.map((t) => [t.id, t]));
const ETAB = Object.fromEntries(ETABS.map(([id, label]) => [id, label]));
const FACT = Object.fromEntries(FACTEURS.map(([id, label, pct]) => [id, { label, pct }]));
const CAT = Object.fromEntries(CATEGORIES.map(([id, label]) => [id, label]));
const JOUR = Object.fromEntries(JOURNALIERS.map(([nom, salaire, dispo, role]) => [nom, { nom, salaire, dispo, role }]));
const rid = () => foundry.utils.randomID();
/** « à » + nom de lieu, avec la contraction : aux Fossés, au Pic d'Ambre, à la Vallée, à Vond. */
const aLieu = (nom) => { const n = String(nom ?? ""); const m = n.match(/^(Les|Le|La|L')\s?(.*)$/); if (!m) return `à ${n}`;
  return { Les: `aux ${m[2]}`, Le: `au ${m[2]}`, La: `à la ${m[2]}`, "L'": `à l'${m[2]}` }[m[1]]; };
const GARDE = Object.fromEntries(GARDES.map((g) => [g.id, g]));
const DAY = 86400;

/** Réglages maison selon la taille du lieu : stock de chaque objet courant et bourse du marchand (en cuivre). */
const TAILLES = {
  "Avant-poste": { stock: 1, bourse: 100 }, "Camp": { stock: 2, bourse: 100 }, "Hameau": { stock: 3, bourse: 300 },
  "Village": { stock: 6, bourse: 1000 }, "Château ou forteresse": { stock: 6, bourse: 2000 }, "Ville": { stock: 12, bourse: 5000 },
  "Colporteur": { stock: 2, bourse: 500 }, "Autre": { stock: 6, bourse: 1000 }
};
const taille = (l) => TAILLES[l?.taille] ?? TAILLES.Autre;
/** Attitude du marchand envers les PJ : écart de prix (réglage maison). */
const ATT = { allie: ["Allié des PJ", -20], amical: ["Amical", -10], neutre: ["Neutre", 0], mefiant: ["Méfiant", 10], hostile: ["Hostile", 25], ennemi: ["Ennemi juré", 50] };
const attFromText = (t) => { const n = norm(t); return /hostile/.test(n) ? "hostile" : /mefian/.test(n) ? "mefiant" : /amical/.test(n) ? "amical" : /allie/.test(n) ? "allie" : /ennemi/.test(n) ? "ennemi" : "neutre"; };

/* ------------------------------------------------------------------ argent */
/** 1 pièce d'or = 10 pièces d'argent = 100 pièces de cuivre (Manuel p. 37). */
function prixTxt(c, long = false) {
  c = Math.max(0, Math.round(c));
  if (!c) return long ? "rien" : "0";
  const o = Math.floor(c / 100), a = Math.floor((c % 100) / 10), cu = c % 10;
  const parts = [];
  if (long) {
    if (o) parts.push(`${o} pièce${o > 1 ? "s" : ""} d'or`);
    if (a) parts.push(`${a} pièce${a > 1 ? "s" : ""} d'argent`);
    if (cu) parts.push(`${cu} pièce${cu > 1 ? "s" : ""} de cuivre`);
    return parts.join(", ");
  }
  if (o) parts.push(`${o} o`); if (a) parts.push(`${a} a`); if (cu) parts.push(`${cu} c`);
  return parts.join(" ");
}
const UNITE = { c: [1, "c"], a: [10, "a"], o: [100, "o"] };
const bourse = (actor) => {
  const cur = actor?.system?.currency ?? {};
  return { o: Number(cur.gold?.value) || 0, a: Number(cur.silver?.value) || 0, c: Number(cur.copper?.value) || 0 };
};
const total = (b) => b.o * 100 + b.a * 10 + b.c;
/** Paie « prix » cuivres : on garde l'or tant que possible, la monnaie est rendue en argent et en cuivre. */
function payer(b, prix) {
  let reste = total(b) - prix;
  if (reste < 0) return null;
  const o = Math.min(b.o, Math.floor(reste / 100)); reste -= o * 100;
  const a = Math.floor(reste / 10);
  return { o, a, c: reste - a * 10 };
}
function recevoir(b, p) {
  let o = b.o + Math.floor(p / 100), a = b.a + Math.floor((p % 100) / 10), c = b.c + (p % 10);
  if (c >= 10) { a += Math.floor(c / 10); c %= 10; }
  return { o, a, c };
}
const majBourse = (actor, b) => actor.update({ "system.currency.gold.value": b.o, "system.currency.silver.value": b.a, "system.currency.copper.value": b.c });
/** Lit un prix écrit sur un objet du système (« 12 », « 3 pièces d'or », « 5 silver »…). Un nombre seul est en argent (Manuel p. 104). */
function lirePrix(s) {
  if (s == null || s === "") return null;
  if (typeof s === "number") return s * 10;
  const mots = norm(s).split(" ");
  let c = 0, ok = false;
  for (let i = 0; i < mots.length; i++) {
    if (!/^\d+$/.test(mots[i])) continue;
    ok = true;
    const n = Number(mots[i]);
    let unite = 10;
    for (let j = i + 1; j < Math.min(mots.length, i + 4); j++) {
      const m = mots[j];
      if (/^(or|gold|po|o|g)$/.test(m)) { unite = 100; break; }
      if (/^(argent|silver|pa|a|s)$/.test(m)) { unite = 10; break; }
      if (/^(cuivre|copper|pc|c)$/.test(m)) { unite = 1; break; }
      if (/^\d+$/.test(m)) break;
    }
    c += n * unite;
  }
  return ok ? c : null;
}
const d6 = () => Math.ceil(Math.random() * 6);
const des = (n) => Array.from({ length: n }, d6);

/* ------------------------------------------------------------------ état */
const DEF_ETAT = { lieux: {}, ordre: [], ouvert: null, semaine: 0, commandes: [], contrats: [], carnet: [] };
const etat = () => foundry.utils.mergeObject(foundry.utils.deepClone(DEF_ETAT), game.settings.get(MOD, "etat") ?? {}, { inplace: false });
const regles = () => foundry.utils.mergeObject({ rarete: true, I: 25, R: 50, revente: 50, troc: 100, tresor: 100, attitude: true }, game.settings.get(MOD, "regles") ?? {}, { inplace: false });
async function saveEtat(e) { if (game.user.isGM) await game.settings.set(MOD, "etat", e); }
const isActiveGM = () => game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user);

const tempsActif = () => !!(globalThis.FLTemps?.getState && game.modules.get("fl-temps")?.active);
/** Longueur d'une semaine : celle du calendrier des Contrées (11 jours) avec fl-temps, sinon 7 jours. */
const jSemaine = () => (tempsActif() ? 11 : 7);
function dateTxt() {
  if (tempsActif()) { try { const l = globalThis.FLTemps.getState().date.label; if (l) return l; } catch { /* */ } }
  return new Date().toLocaleDateString("fr-FR");
}
/** Clé de la semaine : celle du calendrier (fl-temps) si le module est là, sinon un compteur que le MJ fait avancer. */
function semaine() {
  if (tempsActif()) {
    try {
      const d = globalThis.FLTemps.getState().date;
      const mois = d.month?.name ?? "";
      if (d.isFeast) return { cle: `t${d.year}-${d.monthIndex}-0`, label: `${d.feast?.name ?? "jour de fête"} ${d.year}`, auto: true };
      return { cle: `t${d.year}-${d.monthIndex}-${d.week}`, label: `${d.weekLabel ?? `semaine ${d.week}`} de ${mois} ${d.year}`, auto: true };
    } catch { /* calendrier indisponible */ }
  }
  const n = etat().semaine ?? 0;
  return { cle: `m${n}`, label: `semaine n° ${n + 1}`, auto: false };
}

/** Carnet de dépenses : chaque achat, vente, salaire… (gardé à 400 lignes). */
function noter(e, actor, type, txt, montant) {
  e.carnet.unshift({ id: rid(), w: game.time.worldTime, date: dateTxt(), actorId: actor?.id ?? null, nom: actor?.name ?? "Groupe", type, txt, montant });
  if (e.carnet.length > 400) e.carnet.length = 400;
}

/* ------------------------------------------------------------------ stock (Manuel p. 179 + réglages maison) */
function tirerStock(lieu, cle) {
  const jets = {};
  const base = taille(lieu).stock;
  for (const t of TARIFS) {
    if (!t.enBoutique) continue;
    if (t.dispo === "I" || t.dispo === "R") {
      const d = d6();
      if (t.dispo === "I") { const ok = d >= 4; jets[t.id] = { d, ok, qte: ok ? d6() : 0, vendu: 0 }; }
      else { const ok = d === 6; jets[t.id] = { d, ok, qte: ok ? 1 : 0, vendu: 0 }; }
    } else if (lieu.stockLimite !== false && t.objet) jets[t.id] = { courant: true, qte: base, vendu: 0 };
  }
  for (const [nom, j] of Object.entries(JOUR)) {
    if (j.dispo === "I") { const d = d6(); const ok = d >= 4; jets[`j:${nom}`] = { d, ok, qte: ok ? d6() : 0, vendu: 0 }; }
  }
  lieu.stock = { cle, jets };
  if (!lieu.bourseIllimitee && (lieu.bourse ?? 0) < taille(lieu).bourse) lieu.bourse = taille(lieu).bourse;
}
/** Le MJ actif tire le stock des lieux dont la semaine a changé. */
async function majStocks({ tous = false } = {}) {
  if (!isActiveGM()) return false;
  const e = etat(); const { cle } = semaine(); let chg = false;
  for (const id of e.ordre) if (e.lieux[id] && !e.lieux[id].gardes) { assignerGardes(e, e.lieux[id]); chg = true; }
  for (const id of e.ordre) {
    const l = e.lieux[id]; if (!l) continue;
    if (l.stock?.cle !== cle && (tous || id === e.ouvert || l.stock)) { tirerStock(l, cle); chg = true; }
  }
  if (chg) await saveEtat(e);
  return chg;
}

function statut(t, lieu) {
  if (!lieu) return { ok: true, ref: true };
  const ov = lieu.ovr?.[t.id];
  if (ov === "off") return { ok: false, why: "Retiré de la vente par le MJ." };
  if (ov === "on") return { ok: true, why: "Mis en vente par le MJ.", qte: null };
  if (!t.enBoutique) return { ok: false, why: "Se construit, ne s'achète pas en boutique." };
  const ici = t.etabs.filter((x) => lieu.etabs?.[x]);
  if (!ici.length) return { ok: false, manque: true, why: `Il faut ${t.etabs.map((x) => ETAB[x]).join(" ou ")} : il n'y en a pas ici.` };
  const j = lieu.stock?.jets?.[t.id];
  if (t.dispo === "C" || !t.dispo) {
    const base = t.dispo ? "Courant : en vente en quantité raisonnable." : "Le livre ne donne pas de disponibilité : traité comme courant.";
    if (!j?.courant) return { ok: true, why: base, qte: null };
    const r = j.qte - (j.vendu ?? 0);
    return r > 0 ? { ok: true, qte: r, why: `${base} Stock de la semaine : ${r} (réglage maison, selon la taille du lieu).` }
      : { ok: false, why: `${base} Le stock de la semaine est épuisé (réglage maison) ; il revient la semaine prochaine.` };
  }
  if (!j) return { ok: false, why: "Stock de la semaine pas encore tiré (le MJ ouvre l'échoppe pour le tirer)." };
  if (t.dispo === "I") {
    if (!j.ok) return { ok: false, why: `Inhabituel : 1d6 = ${j.d}, il fallait 4 ou plus. Rien cette semaine.` };
    const r = j.qte - (j.vendu ?? 0);
    return r > 0 ? { ok: true, qte: r, why: `Inhabituel : 1d6 = ${j.d} (4 ou plus), ${j.qte} lot${j.qte > 1 ? "s" : ""} cette semaine${j.vendu ? `, ${r} restant${r > 1 ? "s" : ""}` : ""}.` }
      : { ok: false, why: `Inhabituel : les ${j.qte} lot${j.qte > 1 ? "s" : ""} de la semaine sont vendus.` };
  }
  if (!j.ok) return { ok: false, why: `Rare : 1d6 = ${j.d}, il fallait un 6. Rien cette semaine.` };
  return (j.vendu ?? 0) < j.qte ? { ok: true, qte: 1, why: "Rare : 1d6 = 6, un seul exemplaire cette semaine." } : { ok: false, why: "Rare : l'exemplaire de la semaine est vendu." };
}
function statutJour(nom, lieu) {
  const j = JOUR[nom];
  if (!lieu) return { ok: true };
  if (j.dispo === "C") return { ok: true, why: "Courant." };
  const s = lieu.stock?.jets?.[`j:${nom}`];
  if (!s) return { ok: false, why: "Pas encore tiré cette semaine." };
  if (!s.ok) return { ok: false, why: `Inhabituel : 1d6 = ${s.d}, il fallait 4 ou plus.` };
  const r = s.qte - (s.vendu ?? 0);
  return r > 0 ? { ok: true, qte: r, why: `Inhabituel : 1d6 = ${s.d}, ${s.qte} disponible${s.qte > 1 ? "s" : ""} cette semaine.` } : { ok: false, why: "Tous déjà engagés cette semaine." };
}

/* ------------------------------------------------------------------ gardes du corps nommés */
/** Donne deux ou trois gardes du corps à un lieu (un au colporteur), sans reprendre ceux d'un autre lieu ni ceux déjà engagés. */
function assignerGardes(e, lieu, n = null) {
  n ??= lieu.colporteur ? 1 : 2 + (d6() >= 4 ? 1 : 0);
  const pris = new Set([...Object.values(e.lieux).filter((l) => l.id !== lieu.id).flatMap((l) => l.gardes ?? []), ...e.contrats.map((c) => c.garde).filter(Boolean)]);
  let libres = GARDES.filter((g) => !pris.has(g.id) && !(lieu.gardes ?? []).includes(g.id));
  if (libres.length < n) libres = GARDES.filter((g) => !e.contrats.some((c) => c.garde === g.id) && !(lieu.gardes ?? []).includes(g.id));
  const choix = [];
  while (choix.length < n && libres.length) choix.push(libres.splice(Math.floor(Math.random() * libres.length), 1)[0].id);
  lieu.gardes = choix;
}
/** Portraits des gardes : images déposées par le MJ dans un dossier de Foundry, nommées d'après le garde (brenna.webp…). */
async function chercherPortraits() {
  if (!game.user.isGM) return;
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    const r = await FP.browse("data", game.settings.get(MOD, "portraits"));
    const map = {};
    for (const f of r.files ?? []) { const b = decodeURIComponent(f.split("/").pop()).replace(/\.[^.]+$/, "").toLowerCase(); if (GARDE[b]) map[b] = f; }
    const e = etat();
    if (JSON.stringify(e.portraits ?? {}) !== JSON.stringify(map)) { e.portraits = map; await saveEtat(e); }
  } catch { /* dossier absent : pas de portraits */ }
}
/** Portrait : celui du dossier du MJ s'il y en a un, sinon celui fourni avec le module. */
const portraitDe = (id) => etat().portraits?.[id] ?? (GARDE[id] ? `modules/${MOD}/portraits/${id}.webp` : null);
const jetonDe = (id) => (etat().portraits?.[id] ? etat().portraits[id] : `modules/${MOD}/portraits/${id}-token.webp`);
const IMG_DEFAUT = (img) => !img || /mystery-man|icons\/svg\//.test(img);
/** Donne leur portrait et leur jeton aux fiches de gardes qui n'ont pas encore d'image choisie par le MJ. */
async function habillerGardes() {
  for (const a of game.actors.filter((x) => x.getFlag?.(MOD, "garde"))) {
    const id = a.getFlag(MOD, "garde"); const img = portraitDe(id); const tok = jetonDe(id);
    const maj = {};
    if (IMG_DEFAUT(a.img)) maj.img = img;
    if (IMG_DEFAUT(a.prototypeToken?.texture?.src)) maj["prototypeToken.texture.src"] = tok;
    if (Object.keys(maj).length) await a.update(maj);
    for (const sc of game.scenes ?? []) {
      const toks = sc.tokens.filter((t) => t.actorId === a.id && IMG_DEFAUT(t.texture?.src));
      if (toks.length) await sc.updateEmbeddedDocuments("Token", toks.map((t) => ({ _id: t.id, "texture.src": tok })));
    }
  }
}
const ATTR = ["strength", "agility", "wits", "empathy"];
const COMP = { melee: "Mêlée", marksmanship: "Tir", endurance: "Endurance", survival: "Survie", scouting: "Repérage", insight: "Intuition", might: "Puissance", move: "Mouvement", stealth: "Furtivité", healing: "Soins", manipulation: "Manipulation", lore: "Érudition", "animal-handling": "Dressage", crafting: "Artisanat", "sleight-of-hand": "Dextérité", performance: "Représentation" };
/** Crée la fiche de PNJ d'un garde : PNJ « Soldat » du Guide du MJ (p. 183) ajusté, avec son histoire et son équipement. */
async function dossierGardes() {
  return game.folders.find((f) => f.type === "Actor" && f.name === "Gardes du corps") ?? Folder.create({ name: "Gardes du corps", type: "Actor" });
}
async function ficheGarde(g, employeur = null, ouvrir = true) {
  const deja = game.actors.find((a) => a.getFlag?.(MOD, "garde") === g.id);
  if (deja) { if (ouvrir) deja.sheet?.render(true); return deja; }
  const folder = (await dossierGardes())?.id;
  const system = { subtype: { type: "npc" }, attribute: {}, skill: {}, bio: {
    kin: { value: g.peuple }, profession: { value: "Garde du corps" }, age: { value: g.age }, pride: { value: g.fierte }, darkSecret: { value: g.secret },
    face: { value: g.visage }, body: { value: g.corps }, clothing: { value: g.tenue },
    note: { value: `<p><b>Caractère :</b> ${g.traits}</p><p>${g.histoire}</p><p><b>Ce qu'il veut :</b> ${g.veut}</p><p><i>${g.replique}</i></p>${employeur ? `<p>Engagé par ${employeur}.</p>` : ""}` } } };
  ATTR.forEach((k, i) => { system.attribute[k] = { value: g.attr[i], max: g.attr[i] }; });
  for (const [k, v] of Object.entries(g.comp)) system.skill[k] = { value: v };
  const actor = await Actor.create({ name: g.nom, type: "character", system, folder, flags: { [MOD]: { garde: g.id } }, img: portraitDe(g.id), prototypeToken: { name: g.nom, texture: { src: jetonDe(g.id) } } });
  for (const nom of g.equip) { const t = TARIFS.find((x) => x.nom === nom); if (t) await donnerObjet(actor, t, 1); }
  if (ouvrir) actor.sheet?.render(true);
  return actor;
}

/* ------------------------------------------------------------------ marchands */
function attitudeDe(m) {
  if (m?.pnj && game.modules.get("fl-campagne")?.active) {
    try { const a = game.settings.get("fl-campagne", "etat")?.pnj?.[m.pnj]?.attitude; if (a && ATT[a]) return { att: a, campagne: true }; } catch { /* */ }
  }
  return { att: ATT[m?.attitude] ? m.attitude : "neutre", campagne: false };
}
const marchandPour = (t, lieu) => (lieu?.marchands ?? []).find((m) => t.etabs.includes(m.etab)) ?? null;

/* ------------------------------------------------------------------ prix */
/** Prix d'un objet dans un lieu, avec chaque étape expliquée. */
function prix(t, lieu, vol = 0) {
  const R = regles();
  const lignes = [{ txt: `Prix du livre : ${prixTxt(t.prix, true)}`, src: `Manuel p. ${t.page}` }];
  let pct = 0;
  if (lieu) for (const f of lieu.facteurs ?? []) {
    if (f.id === "specialite" && f.cat !== t.cat) continue;
    const p = Number(f.pct) || 0; if (!p) continue;
    pct += p;
    const nom = f.id === "perso" ? (f.texte || "Autre raison") : f.id === "specialite" ? `Spécialité locale : ${CAT[f.cat] ?? ""}` : FACT[f.id]?.label;
    lignes.push({ txt: `${nom} : ${p > 0 ? "+" : ""}${p} %`, src: "réglage maison du lieu" });
  }
  if (lieu && R.rarete && (t.dispo === "I" || t.dispo === "R")) {
    const p = Number(R[t.dispo]) || 0;
    if (p) { pct += p; lignes.push({ txt: `${DISPO[t.dispo]} : ${p > 0 ? "+" : ""}${p} %`, src: "réglage maison (le livre dit que le prix varie selon la disponibilité, p. 104)" }); }
  }
  const m = marchandPour(t, lieu);
  if (m && R.attitude) {
    const { att, campagne } = attitudeDe(m); const p = ATT[att][1];
    if (p) { pct += p; lignes.push({ txt: `${m.nom || "Le marchand"} est ${ATT[att][0].toLowerCase()} : ${p > 0 ? "+" : ""}${p} %`, src: `réglage maison${campagne ? ", attitude tirée de fl-campagne" : ""}` }); }
  }
  let c = t.prix * Math.max(0.1, 1 + pct / 100);
  if (vol > 0) { c *= Math.max(0.2, 1 - 0.2 * vol); lignes.push({ txt: `Voie de l'or : ${vol} VOL, −${20 * vol} %`, src: "Manuel p. 66" }); }
  c = Math.max(1, Math.round(c));
  return { c, lignes };
}

/* ------------------------------------------------------------------ fabrication sur commande */
/** Délai d'un objet, en jours : le temps du livre (deux Quarts de travail par jour, Manuel p. 179). */
function delai(temps) {
  const n = norm(temps);
  if (/quart/.test(n)) return 0.25;
  if (/deux semaines/.test(n)) return 2 * jSemaine();
  if (/semaine/.test(n)) return jSemaine();
  if (/deux jours/.test(n)) return 2;
  if (/jour/.test(n)) return 1;
  return 1;
}
const delaiTxt = (j) => (j < 1 ? "un Quart de jour" : j === 1 ? "un jour" : `${j} jours`);
/** L'artisan qui peut le faire ici : forgeron si la fabrication demande une forge, sinon un artisan du marché. */
function artisan(t, lieu) {
  const f = FAB[t.nom]; if (!f) return null;
  const forge = /forge/.test(norm(f[3]));
  const besoin = forge ? ["forgeron"] : ["marche", "forgeron"];
  const ok = !lieu || besoin.some((x) => lieu.etabs?.[x]);
  return { ok, besoin: forge ? "Forgeron" : "Artisan (marché ou forgeron)", f };
}

/* ------------------------------------------------------------------ objets */
let INDEX = null;
async function indexCompendiums() {
  if (INDEX) return INDEX;
  INDEX = new Map();
  for (const p of game.packs.filter((p) => p.documentName === "Item")) {
    try {
      const idx = await p.getIndex({ fields: ["type"] });
      for (const e of idx) if (["gear", "weapon", "armor", "rawMaterial"].includes(e.type) && !INDEX.has(norm(e.name))) INDEX.set(norm(e.name), { pack: p.collection, id: e._id });
    } catch { /* compendium illisible */ }
  }
  return INDEX;
}
async function creerObjet(actor, data, qte) {
  data = foundry.utils.deepClone(data); delete data._id;
  if (["gear", "rawMaterial"].includes(data.type)) {
    const deja = actor.items.find((i) => i.type === data.type && norm(i.name) === norm(data.name));
    if (deja) { await deja.update({ "system.quantity": (Number(deja.system.quantity) || 1) + qte }); return; }
    foundry.utils.setProperty(data, "system.quantity", qte);
    await actor.createEmbeddedDocuments("Item", [data]);
  } else await actor.createEmbeddedDocuments("Item", Array.from({ length: qte }, () => foundry.utils.deepClone(data)));
}
async function donnerObjet(actor, t, qte) {
  if (!t.objet) return { cree: false };
  const idx = await indexCompendiums();
  const hit = idx.get(norm(t.nom)) ?? idx.get(norm(t.nom.replace(/\s*\(.*\)$/, "")));
  let data;
  if (hit) { const doc = await game.packs.get(hit.pack)?.getDocument(hit.id); if (doc) data = doc.toObject(); }
  const trouve = !!data;
  if (!data) {
    const st = statsSysteme(t.nom);
    data = { name: t.nom, type: st?.type ?? t.itemType, system: { ...(st?.system ?? {}), cost: prixTxt(t.prix, true), supply: DISPO[t.dispo] ?? "", weight: t.weight } };
  }
  await creerObjet(actor, data, qte);
  return { cree: true, trouve: trouve || !!statsSysteme(t.nom) };
}
const voieOr = (actor) => actor?.items?.find((i) => i.type === "talent" && /voie de l or|path of gold/.test(norm(i.name)));
/** Le MJ voit tous les personnages (ceux des joueurs d'abord) ; un joueur ne voit que les siens. */
const persos = () => game.actors.filter((a) => a.type === "character" && (game.user.isGM || a.isOwner))
  .sort((x, y) => (y.hasPlayerOwner - x.hasPlayerOwner) || x.name.localeCompare(y.name));
const vol = (actor) => Number(actor?.system?.bio?.willpower?.value) || 0;
const MATIERES = TARIFS.filter((t) => t.cat === "matieres");
const matiereDe = (item) => item.type === "rawMaterial" || MATIERES.some((t) => norm(t.nom) === norm(item.name)) ? MATIERES.find((t) => norm(t.nom) === norm(item.name) || norm(item.name).startsWith(norm(t.nom))) : null;
const tresorDe = (item) => { const n = norm(item.name); return TRESORS.find((x) => norm(x.nom) === n) ?? TRESORS.find((x) => norm(x.nom.replace(/\s*\(.*\)$/, "")) === n) ?? null; };
const tresorDes = (x) => `${x.d}d6 ${x.u === "c" ? "pièces de cuivre" : x.u === "a" ? "pièces d'argent" : "pièces d'or"}`;
function lancerTresor(x) { const r = des(x.d); const s = r.reduce((a, b) => a + b, 0); return { r, s, c: s * UNITE[x.u][0] }; }

/* ------------------------------------------------------------------ opérations (faites par le MJ) */
async function appliquerAchat({ actorId, lignes, lieuId, troc = [] }, totalForce = null) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error("Personnage introuvable.");
  const e = etat(); const lieu = lieuId ? e.lieux[lieuId] : null;
  const brut = lignes.reduce((s, l) => s + l.prix * l.qte, 0);
  const valTroc = troc.reduce((s, l) => s + l.val, 0);
  const du = totalForce ?? Math.max(0, brut - valTroc);
  const b = payer(bourse(actor), du);
  if (!b) throw new Error(`${actor.name} n'a pas assez d'argent : il faut ${prixTxt(du, true)}, il a ${prixTxt(total(bourse(actor)), true)}.`);
  const volTot = lignes.reduce((s, l) => s + (l.vol || 0), 0);
  if (volTot > vol(actor)) throw new Error(`${actor.name} n'a que ${vol(actor)} point(s) de Volonté.`);
  for (const l of troc) { const it = actor.items.get(l.itemId); if (!it || (Number(it.system.quantity) || 1) < l.qte) throw new Error(`Troc : ${l.nom} n'est plus en quantité suffisante sur la fiche.`); }
  await majBourse(actor, b);
  if (volTot) await actor.update({ "system.bio.willpower.value": vol(actor) - volTot });
  for (const l of troc) { const it = actor.items.get(l.itemId); const q = Number(it.system.quantity) || 1; if (q > l.qte) await it.update({ "system.quantity": q - l.qte }); else await it.delete(); }
  const sansFiche = [];
  for (const l of lignes) {
    if (l.occ) {
      const o = lieu?.occasion?.find((x) => x.id === l.occ);
      if (o) { await creerObjet(actor, o.data, l.qte); o.qte -= l.qte; }
      continue;
    }
    const t = T.get(l.tid); if (!t) continue;
    const r = await donnerObjet(actor, t, l.qte);
    if (r.cree && !r.trouve) sansFiche.push(t.nom);
    const j = lieu?.stock?.jets?.[t.id];
    if (j) j.vendu = (j.vendu ?? 0) + l.qte;
  }
  if (lieu) {
    lieu.occasion = (lieu.occasion ?? []).filter((o) => o.qte > 0);
    if (!lieu.bourseIllimitee) lieu.bourse = (lieu.bourse ?? taille(lieu).bourse) + du;
  }
  noter(e, actor, "achat", `${lignes.map((l) => `${l.qte > 1 ? `${l.qte} × ` : ""}${l.nom ?? T.get(l.tid)?.nom}`).join(", ")}${troc.length ? ` (troc : ${troc.map((l) => `${l.qte} ${l.nom}`).join(", ")})` : ""}${lieu ? ` — ${lieu.nom}` : ""}`, -du);
  await saveEtat(e);
  return { actor, du, reste: b, sansFiche };
}

async function appliquerVente({ actorId, itemId, qte }, prixTotal) {
  const actor = game.actors.get(actorId); const item = actor?.items.get(itemId);
  if (!item) throw new Error("L'objet n'est plus sur la fiche.");
  const e = etat(); const lieu = e.ouvert ? e.lieux[e.ouvert] : null;
  if (lieu && !lieu.bourseIllimitee && (lieu.bourse ?? 0) < prixTotal) throw new Error(`Le marchand de ${lieu.nom} n'a que ${prixTxt(lieu.bourse ?? 0, true)} (réglez sa bourse dans l'onglet Lieux).`);
  const data = item.toObject(); const estimation = estimer(item);
  const q = Number(item.system.quantity) || 1;
  if (q > qte) await item.update({ "system.quantity": q - qte }); else await item.delete();
  await majBourse(actor, recevoir(bourse(actor), prixTotal));
  if (lieu) {
    if (!lieu.bourseIllimitee) lieu.bourse = (lieu.bourse ?? 0) - prixTotal;
    const R = regles(); const est = estimation;
    const unit = prixTotal > 0 ? Math.max(1, Math.round(prixTotal / qte * (R.revente > 0 ? 100 / R.revente : 2))) : Math.max(1, est.base ?? 1);
    delete data._id; foundry.utils.setProperty(data, "system.quantity", 1);
    (lieu.occasion ??= []).push({ id: rid(), nom: data.name, data, qte, prix: unit });
  }
  noter(e, actor, "vente", `${qte > 1 ? `${qte} × ` : ""}${item.name}${lieu ? ` — ${lieu.nom}` : ""}`, prixTotal);
  await saveEtat(e);
  return { actor, item: item.name };
}

async function appliquerCommande({ actorId, tid, qte, lieuId, prix: pu }) {
  const actor = game.actors.get(actorId); const t = T.get(tid);
  if (!actor || !t) throw new Error("Commande impossible.");
  const du = pu * qte;
  const b = payer(bourse(actor), du);
  if (!b) throw new Error(`${actor.name} n'a pas assez d'argent : il faut ${prixTxt(du, true)}.`);
  await majBourse(actor, b);
  const e = etat(); const lieu = e.lieux[lieuId];
  const jours = delai(FAB[t.nom][1]) * qte;
  e.commandes.push({ id: rid(), actorId, nom: actor.name, tid, qte, lieuId, lieu: lieu?.nom ?? "", prix: du, jours, debut: game.time.worldTime, pret: game.time.worldTime + jours * DAY, statut: "en cours" });
  if (lieu && !lieu.bourseIllimitee) lieu.bourse = (lieu.bourse ?? 0) + du;
  noter(e, actor, "commande", `${qte > 1 ? `${qte} × ` : ""}${t.nom} — ${lieu?.nom ?? ""}, prêt dans ${delaiTxt(jours)}`, -du);
  await saveEtat(e);
  return { actor, du, jours };
}

async function appliquerEmbauche({ actorId, nom, n, lieuId, garde }) {
  const actor = game.actors.get(actorId); const j = JOUR[nom];
  if (!actor || !j) throw new Error("Embauche impossible.");
  const e = etat(); const lieu = e.lieux[lieuId];
  if (garde) {
    const g = GARDE[garde]; if (!g) throw new Error("Garde inconnu.");
    if (e.contrats.some((c) => c.garde === garde)) throw new Error(`${g.nom} est déjà engagé.`);
    if (lieu) lieu.gardes = (lieu.gardes ?? []).filter((x) => x !== garde);
    const jour = Math.floor(game.time.worldTime / DAY);
    e.contrats.push({ id: rid(), nom: g.nom, garde, salaire: j.salaire, actorId, employeur: actor.name, lieu: lieu?.nom ?? "", lieuId, depuis: jour, paye: jour - 1 });
    noter(e, actor, "embauche", `${g.nom}, garde du corps (${prixTxt(j.salaire)} par jour)${lieu ? ` — ${lieu.nom}` : ""}`, 0);
    await saveEtat(e); await payerSalaires();
    return { actor };
  }
  const s = lieu?.stock?.jets?.[`j:${nom}`]; if (s) s.vendu = (s.vendu ?? 0) + n;
  const jour = Math.floor(game.time.worldTime / DAY);
  for (let i = 0; i < n; i++) e.contrats.push({ id: rid(), nom, salaire: j.salaire, actorId, employeur: actor.name, lieu: lieu?.nom ?? "", depuis: jour, paye: jour - 1 });
  noter(e, actor, "embauche", `${n > 1 ? `${n} × ` : ""}${nom} (${prixTxt(j.salaire)} par jour)${lieu ? ` — ${lieu.nom}` : ""}`, 0);
  await saveEtat(e);
  await payerSalaires();
  return { actor };
}
/** Paie les journaliers jusqu'à aujourd'hui. Ceux qu'on ne peut pas payer sont signalés (retard de paiement, Manuel p. 162). */
async function payerSalaires({ force = false } = {}) {
  if (!isActiveGM()) return;
  const e = etat(); if (!e.contrats.length) return;
  const today = Math.floor(game.time.worldTime / DAY);
  const impayes = []; const payes = [];
  for (const c of e.contrats) {
    const dus = force ? Math.max(1, today - c.paye) : today - c.paye;
    if (dus <= 0) continue;
    const a = game.actors.get(c.actorId); if (!a) continue;
    const b = payer(bourse(a), c.salaire * dus);
    if (!b) { impayes.push(`${c.nom} (${a.name})`); c.retard = (c.retard ?? 0) + dus; c.paye = force ? c.paye + dus : today; continue; }
    await majBourse(a, b); c.paye = force ? c.paye + dus : today;
    payes.push(`${c.nom} : ${prixTxt(c.salaire * dus)}`);
    noter(e, a, "salaire", `${c.nom}, ${dus} jour${dus > 1 ? "s" : ""}`, -c.salaire * dus);
  }
  if (!payes.length && !impayes.length) return;
  await saveEtat(e);
  ChatMessage.create({ whisper: gmIds(), content: `<div class="flm-chat"><h3><i class="fa-solid fa-people-carry-box"></i> Salaires des journaliers</h3>${payes.length ? `<p>${esc(payes.join(" · "))}</p>` : ""}${impayes.length ? `<p class="flm-alert">Pas assez d'argent pour payer : ${esc(impayes.join(", "))}. Retard de paiement : voir Manuel p. 162.</p>` : ""}</div>` });
  appMaj();
}
/** Commandes arrivées à terme : le MJ est prévenu, le joueur aussi. */
async function verifierCommandes() {
  if (!isActiveGM()) return;
  const e = etat(); let chg = false;
  for (const c of e.commandes) {
    if (c.statut !== "en cours" || c.pret > game.time.worldTime) continue;
    c.statut = "prête"; chg = true;
    const a = game.actors.get(c.actorId);
    const owners = game.users.filter((u) => !u.isGM && a?.testUserPermission?.(u, "OWNER")).map((u) => u.id);
    ChatMessage.create({ whisper: [...gmIds(), ...owners], content: `<div class="flm-chat"><h3><i class="fa-solid fa-hammer"></i> Commande prête</h3><p>${esc(c.nom)} : ${c.qte > 1 ? `${c.qte} × ` : ""}${esc(T.get(c.tid)?.nom)} attend ${esc(aLieu(c.lieu))}.</p></div>` });
  }
  if (chg) { await saveEtat(e); appMaj(); }
}
async function remettreCommande(id) {
  const e = etat(); const c = e.commandes.find((x) => x.id === id); if (!c) return;
  const a = game.actors.get(c.actorId); const t = T.get(c.tid);
  if (a && t) await donnerObjet(a, t, c.qte);
  c.statut = "livrée";
  e.commandes = e.commandes.filter((x) => x.statut !== "livrée" || x.id === id).slice(-60);
  await saveEtat(e);
  ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-hammer"></i> Commande remise</h3><p>${esc(c.nom)} reçoit ${c.qte > 1 ? `${c.qte} × ` : ""}${esc(t?.nom)}.</p></div>`, speaker: ChatMessage.getSpeaker({ actor: a }) });
}

const resume = (lignes) => lignes.map((l) => `${l.qte > 1 ? `${l.qte} × ` : ""}${esc(l.nom ?? T.get(l.tid)?.nom ?? "?")}${l.vol ? ` (Voie de l'or, ${l.vol} VOL)` : ""} — ${prixTxt(l.prix * l.qte)}`).join("<br>");
const gmIds = () => game.users.filter((u) => u.isGM).map((u) => u.id);

/** Demande d'un joueur : un message privé au MJ avec deux boutons. */
const TITRES = { achat: "Demande d'achat", vente: "Proposition de vente", commande: "Commande à un artisan", embauche: "Embauche" };
async function demander(type, data, html) {
  return ChatMessage.create({
    content: `<div class="flm-chat"><h3><i class="fa-solid fa-scale-balanced"></i> ${TITRES[type]}</h3>${html}
      <div class="flm-chat-act"><button type="button" data-flm="ok"><i class="fa-solid fa-check"></i> Accepter</button><button type="button" data-flm="non"><i class="fa-solid fa-xmark"></i> Refuser</button></div></div>`,
    whisper: gmIds(), speaker: ChatMessage.getSpeaker({ actor: game.actors.get(data.actorId) }),
    flags: { [MOD]: { type, data, statut: "attente" } }
  });
}
async function clore(msg, txt) {
  const div = document.createElement("div"); div.innerHTML = msg.content;
  div.querySelector(".flm-chat-act")?.remove();
  div.querySelector(".flm-chat")?.insertAdjacentHTML("beforeend", `<p class="flm-chat-res">${txt}</p>`);
  await msg.update({ content: div.innerHTML, [`flags.${MOD}.statut`]: "clos" });
}
const DV = () => foundry.applications.api.DialogV2;
async function demanderPrix(titre, html, valeur, label) {
  return DV().prompt({ window: { title: titre }, content: `${html}<p>Prix final, en pièces de cuivre :</p><input type="number" name="c" min="0" value="${valeur}">`,
    ok: { label, callback: (ev, btn) => Number(btn.form.elements.c.value) } }).catch(() => null);
}
async function traiterDemande(msg, ok) {
  const f = msg.flags?.[MOD];
  if (!f?.type || f.statut !== "attente") return;
  if (!ok) return clore(msg, `<i class="fa-solid fa-xmark"></i> Refusé par le MJ.`);
  try {
    if (f.type === "achat") {
      const brut = f.data.lignes.reduce((s, l) => s + l.prix * l.qte, 0) - (f.data.troc ?? []).reduce((s, l) => s + l.val, 0);
      const res = await demanderPrix("Accepter l'achat", `<p>${resume(f.data.lignes)}</p><p>À payer en pièces : <b>${prixTxt(Math.max(0, brut), true)}</b>. Vous pouvez changer ce prix (marchandage).</p>`, Math.max(0, brut), "Encaisser");
      if (res == null) return;
      const r = await appliquerAchat(f.data, res);
      await clore(msg, `<i class="fa-solid fa-check"></i> Payé ${prixTxt(r.du, true)}. Il reste à ${esc(r.actor.name)} : ${prixTxt(total(r.reste), true)}.${r.sansFiche.length ? `<br><span class="flm-hint">Créé sans caractéristiques (absent des compendiums) : ${esc(r.sansFiche.join(", "))}.</span>` : ""}`);
    } else if (f.type === "vente") {
      let val = f.data.prix; let info = "";
      const item = game.actors.get(f.data.actorId)?.items.get(f.data.itemId);
      const x = item && tresorDe(item);
      if (x && !val) {
        const v = item.getFlag?.(MOD, "valeur") ?? (() => { const l = lancerTresor(x); item.setFlag?.(MOD, "valeur", l.c); info = `<p>Valeur lancée : ${x.d}d6 = ${l.r.join(" + ")} = ${l.s} ${UNITE[x.u][1]}.</p>`; return l.c; })();
        val = Math.round(v * f.data.qte * regles().tresor / 100);
      }
      const res = await demanderPrix("Accepter la vente", `<p>${esc(f.data.label)}</p>${info}<p>Prix proposé : <b>${prixTxt(val, true)}</b>.</p>`, val, "Payer le joueur");
      if (res == null) return;
      const r = await appliquerVente(f.data, res);
      await clore(msg, `<i class="fa-solid fa-check"></i> ${esc(r.actor.name)} vend ${esc(r.item)} pour ${prixTxt(res, true)}.`);
    } else if (f.type === "commande") {
      const r = await appliquerCommande(f.data);
      await clore(msg, `<i class="fa-solid fa-check"></i> Commande passée : ${prixTxt(r.du, true)} payés, prête dans ${delaiTxt(r.jours)}.`);
    } else if (f.type === "embauche") {
      await appliquerEmbauche(f.data);
      await clore(msg, `<i class="fa-solid fa-check"></i> Embauché. Le salaire est payé chaque jour par ${esc(game.actors.get(f.data.actorId)?.name)}.`);
    }
    appMaj();
  } catch (err) { ui.notifications.warn(err.message); }
}

/* ------------------------------------------------------------------ rendu sans clignotement (repris de fl-campagne) */
const MORPH_KEYS = ["data-k", "data-tab", "data-path", "data-lieu", "data-tid"];
function morphKey(n) {
  if (n.nodeType !== 1) return null;
  for (const a of MORPH_KEYS) { const v = n.getAttribute(a); if (v != null) return `${n.tagName}|${a}|${v}`; }
  return null;
}
const sameKind = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName);
function morphNode(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name) && !(name === "open" && from.tagName === "DETAILS")) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  const focused = from === document.activeElement;
  if (from.tagName === "INPUT") {
    if (from.type === "checkbox" || from.type === "radio") { const c = to.hasAttribute("checked"); if (from.checked !== c) from.checked = c; }
    else if (!focused) { const v = to.getAttribute("value") ?? ""; if (from.value !== v) from.value = v; }
    return;
  }
  if (from.tagName === "TEXTAREA") { if (!focused && from.value !== to.value) from.value = to.value; return; }
  morphChildren(from, to);
  if (from.tagName === "SELECT" && !focused) {
    const opt = [...to.options].find((o) => o.hasAttribute("selected")) ?? to.options[0];
    if (opt && from.value !== opt.value) from.value = opt.value;
  }
}
function morphChildren(from, to) {
  const keyed = new Map();
  for (let n = from.firstChild; n; n = n.nextSibling) { const k = morphKey(n); if (k && !keyed.has(k)) keyed.set(k, n); }
  let cur = from.firstChild;
  for (const t of [...to.childNodes]) {
    const k = morphKey(t);
    let match = null;
    if (k && keyed.has(k)) { match = keyed.get(k); keyed.delete(k); }
    else if (!k && cur && !morphKey(cur) && sameKind(cur, t)) match = cur;
    if (match && !sameKind(match, t)) match = null;
    if (match) { if (match === cur) cur = cur.nextSibling; else from.insertBefore(match, cur); morphNode(match, t); }
    else from.insertBefore(t, cur);
  }
  while (cur) { const next = cur.nextSibling; from.removeChild(cur); cur = next; }
}
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
}

/* ------------------------------------------------------------------ fenêtre */
const TABS_MJ = [["boutique", "Boutique"], ["tarifs", "Tous les prix"], ["lieux", "Lieux"], ["auberge", "Auberge"], ["vendre", "Vendre"], ["commandes", "Commandes"], ["journaliers", "Journaliers"], ["carnet", "Carnet"], ["explications", "Aide"]];
const TABS_PJ = [["boutique", "Boutique"], ["tarifs", "Tous les prix"], ["vendre", "Vendre"], ["commandes", "Commandes"], ["journaliers", "Journaliers"], ["carnet", "Carnet"], ["explications", "Aide"]];

class MarchandApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fl-marchand", classes: ["fl-marchand"], tag: "div",
    window: { title: "Le Marchand", icon: "fa-solid fa-scale-balanced", resizable: true },
    position: { width: 1040, height: 740 }
  };
  tab = "boutique";
  cat = "";
  q = "";
  lieuVu = null;
  ouverts = new Set();
  panier = [];        // { tid | occ, qte, vol }
  troc = {};          // itemId -> quantité donnée en troc
  acheteur = null;
  vendeur = null;
  carnetPerso = "";
  aub = { persos: null, nuit: "Chambre d'auberge, dortoir", repas: "Bol de ragoût", boisson: "Chope de bière", bain: false, nuits: 1, matin: true };

  get lieuBoutique() { const e = etat(); return e.ouvert ? e.lieux[e.ouvert] : null; }
  #lieuCourant() { const e = etat(); return this.tab === "tarifs" && this.lieuVu ? e.lieux[this.lieuVu] : (this.lieuBoutique ?? (game.user.isGM && this.lieuVu ? e.lieux[this.lieuVu] : null)); }

  async _renderHTML() {
    if (game.user.isGM) await majStocks();
    const tabs = game.user.isGM ? TABS_MJ : TABS_PJ;
    if (!tabs.some(([id]) => id === this.tab)) this.tab = "boutique";
    const nav = tabs.map(([id, label]) => `<a class="flm-tab${this.tab === id ? " active" : ""}" data-tab="${id}"><span>${label}</span></a>`).join("");
    const sem = semaine();
    const body = { boutique: () => this.#boutique(), tarifs: () => this.#tarifs(), lieux: () => this.#lieux(), auberge: () => this.#auberge(), vendre: () => this.#vendre(),
      commandes: () => this.#commandes(), journaliers: () => this.#journaliers(), carnet: () => this.#carnet(), explications: () => this.#explications() }[this.tab]();
    return `<nav class="flm-nav">${nav}<span class="flm-week" title="La disponibilité est tirée chaque semaine (Manuel p. 179)."><i class="fa-regular fa-calendar"></i> ${esc(sem.label)}</span></nav><section class="flm-body">${body}</section>`;
  }
  _replaceHTML(html, content) {
    const changed = this._lastTab !== this.tab;
    const act = content.contains(document.activeElement) ? document.activeElement : null;
    const fsel = act?.dataset?.path ? `[data-path="${CSS.escape(act.dataset.path)}"]` : act?.hasAttribute?.("data-q") ? "[data-q]" : null;
    let caret = null; try { if (act && typeof act.selectionStart === "number") caret = [act.selectionStart, act.selectionEnd]; } catch { caret = null; }
    const tpl = document.createElement("template"); tpl.innerHTML = html;
    morphChildren(content, tpl.content);
    if (changed) { for (const el of content.querySelectorAll(".flm-scroll")) el.scrollTop = 0; replay(content.querySelector(".flm-body"), "flm-enter"); }
    if (fsel && !content.contains(document.activeElement)) { const f = content.querySelector(fsel); if (f) { f.focus({ preventScroll: true }); if (caret) try { f.setSelectionRange(...caret); } catch { /* */ } } }
    this._lastTab = this.tab;
  }
  _onRender() {
    const el = this.element;
    if (el.dataset.flmBound) return;
    el.dataset.flmBound = "1";
    el.addEventListener("click", (ev) => this.#click(ev));
    el.addEventListener("change", (ev) => this.#change(ev));
    el.addEventListener("input", (ev) => {
      if (ev.target.matches("[data-q]")) { this.q = ev.target.value; clearTimeout(this._qt); this._qt = setTimeout(() => this.render(), 150); }
    });
  }

  /* ---------------- morceaux communs */
  #chercher(liste) {
    const q = norm(this.q);
    return liste.filter((t) => (!this.cat || t.cat === this.cat) && (!q || norm(t.nom).includes(q) || norm(t.note).includes(q)));
  }
  #cats(liste, tresors = false) {
    const n = (id) => liste.filter((t) => t.cat === id).length;
    return `<div class="flm-cats"><a class="${!this.cat ? "active" : ""}" data-cat="">Tout</a>${CATEGORIES.filter(([id]) => n(id)).map(([id, label, icon]) =>
      `<a class="${this.cat === id ? "active" : ""}" data-cat="${id}"><i class="${icon}"></i> ${label}</a>`).join("")}${tresors ? `<a class="${this.cat === "tresors" ? "active" : ""}" data-cat="tresors"><i class="fa-solid fa-gem"></i> Trouvailles</a>` : ""}</div>
      <input type="search" class="flm-find" placeholder="Chercher…" value="${esc(this.q)}" data-q>`;
  }
  #explique(t, lieu, st, p) {
    const dispo = t.dispo ? `${DISPO[t.dispo]} (Manuel p. 179)` : "non précisée par le livre";
    const fab = FAB[t.nom]; const art = artisan(t, lieu);
    const j = lieu?.stock?.jets?.[t.id];
    const m = marchandPour(t, lieu);
    return `<tr class="flm-why" data-k="why:${esc(t.id)}"><td colspan="5"><div>
      <ul>${p.lignes.map((l) => `<li>${esc(l.txt)} <span class="flm-src">${esc(l.src)}</span></li>`).join("")}
      ${p.lignes.length > 1 ? `<li><b>Prix ici : ${prixTxt(p.c, true)}</b></li>` : ""}</ul>
      <p><b>Disponibilité :</b> ${dispo}.${lieu ? ` ${esc(st.why ?? "")}` : ""}</p>
      ${t.etabs.length ? `<p><b>Où l'acheter :</b> ${t.etabs.map((x) => ETAB[x]).join(" ou ")}${m ? `, chez ${esc(m.nom)}` : ""} <span class="flm-src">réglage maison</span></p>` : ""}
      ${fab ? `<p><b>Fabrication :</b> ${esc(fab[0])} · ${esc(fab[1])}${fab[2] ? ` · talent ${esc(fab[2])}` : ""}${fab[3] ? ` · ${esc(fab[3])}` : ""} <span class="flm-src">Manuel p. ${t.page}</span></p>` : ""}
      ${t.note ? `<p><b>Note du livre :</b> ${esc(t.note)}</p>` : ""}
      ${fab && lieu ? `<p>${art.ok ? `<button type="button" class="flm-small" data-commander="${esc(t.id)}"><i class="fa-solid fa-hammer"></i> Commander à un artisan</button> <span class="flm-hint">prêt dans ${delaiTxt(delai(fab[1]))} par objet (réglage maison : prix d'ici, payé d'avance)</span>` : `<span class="flm-hint">Pas d'artisan pour le fabriquer ici (il faut : ${esc(art.besoin)}).</span>`}</p>` : ""}
      ${game.user.isGM && lieu ? `<p class="flm-ovr"><b>Ici :</b> ${[["", "selon les règles"], ["off", "retirer de la vente"], ["on", "toujours en vente"]].map(([v, l]) =>
        `<a data-ovr="${v}" data-ovr-t="${esc(t.id)}" data-ovr-l="${lieu.id}" class="${(lieu.ovr?.[t.id] ?? "") === v ? "active" : ""}">${l}</a>`).join(" · ")}
        ${j ? ` · stock de la semaine <input type="number" min="0" data-stock="${esc(t.id)}" data-stock-l="${lieu.id}" value="${Math.max(0, j.qte - (j.vendu ?? 0))}">` : ""}</p>` : ""}</div></td></tr>`;
  }
  #ligne(t, lieu, { achat = false } = {}) {
    const st = statut(t, lieu); const p = prix(t, lieu);
    const ouvert = this.ouverts.has(t.id);
    const badge = `<span class="flm-dispo flm-d${t.dispo || "X"}">${DISPO[t.dispo]}</span>`;
    const ici = lieu ? (st.ok ? `<span class="flm-ok">${st.qte ? `${st.qte} en stock` : "En vente"}</span>` : `<span class="flm-no" title="${esc(st.why)}">${st.manque ? "Pas ici" : "Indisponible"}</span>`) : "";
    const btn = achat && st.ok ? `<button type="button" class="flm-add" data-add="${esc(t.id)}" title="Ajouter au panier"><i class="fa-solid fa-plus"></i></button>` : "";
    const diff = p.c !== t.prix ? `<s>${prixTxt(t.prix)}</s> ` : "";
    return `<tr class="flm-ligne${st.ok ? "" : " flm-off"}${ouvert ? " open" : ""}" data-tid="${esc(t.id)}">
      <td><a class="flm-name" data-why="${esc(t.id)}"><i class="fa-solid fa-caret-right"></i> ${esc(t.nom)}</a></td>
      <td class="flm-price">${diff}<b>${prixTxt(p.c)}</b></td><td>${badge}</td><td>${ici}</td><td>${btn}</td></tr>${ouvert ? this.#explique(t, lieu, st, p) : ""}`;
  }
  #table(liste, lieu, opts) {
    if (!liste.length) return `<p class="flm-hint flm-center">Rien ne correspond.</p>`;
    return `<table class="flm-table"><thead><tr><th>Objet <span class="flm-hint">(cliquez pour le détail)</span></th><th>Prix${lieu ? " ici" : ""}</th><th>Disponibilité</th><th>${lieu ? "Cette semaine" : ""}</th><th></th></tr></thead>
      <tbody>${liste.map((t) => this.#ligne(t, lieu, opts)).join("")}</tbody></table>`;
  }
  #persoSelect(path, valeur, liste = persos()) {
    if (!liste.length) return `<span class="flm-alert">Aucun personnage${game.user.isGM ? "" : " à vous"}.</span>`;
    return `<select data-path="${path}">${liste.map((a) => `<option value="${a.id}" ${a.id === valeur ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
  }
  #defaut(champ) {
    const liste = persos();
    if (!liste.some((a) => a.id === this[champ])) this[champ] = (game.user.character && liste.includes(game.user.character) ? game.user.character.id : liste[0]?.id) ?? null;
    return liste;
  }
  #lieuResume(l) {
    const et = ETABS.filter(([id]) => l.etabs?.[id]).map(([, label]) => label);
    const f = (l.facteurs ?? []).filter((x) => Number(x.pct)).map((x) => `${x.id === "perso" ? (x.texte || "autre") : x.id === "specialite" ? `spécialité : ${CAT[x.cat] ?? "?"}` : FACT[x.id]?.label.toLowerCase()} ${x.pct > 0 ? "+" : ""}${x.pct} %`);
    const m = (l.marchands ?? []).map((x) => `${x.nom} (${ETAB[x.etab] ?? ""})`);
    return `${esc(l.taille || "")}${et.length ? ` · ${esc(et.join(", "))}` : " · aucun établissement"}${f.length ? ` · prix : ${esc(f.join(", "))}` : ""}${m.length ? `<br>Marchands : ${esc(m.join(", "))}` : ""}`;
  }

  /* ---------------- boutique */
  #boutique() {
    const e = etat(); const lieu = this.lieuBoutique;
    const ouvrir = game.user.isGM ? `<label class="flm-inline">Échoppe ouverte aux joueurs : <select data-path="ouvert"><option value="">— aucune —</option>${e.ordre.map((id) => `<option value="${id}" ${e.ouvert === id ? "selected" : ""}>${esc(e.lieux[id]?.nom)}</option>`).join("")}</select></label>` : "";
    if (!lieu) return `<div class="flm-scroll"><div class="flm-empty"><img class="flm-raven" src="${SYS_ART}/ravens/raven3.webp" alt=""><h2>Aucune échoppe ouverte</h2>
      ${game.user.isGM ? `<p>Créez un lieu dans l'onglet <a data-tab="lieux">Lieux</a> (ou importez ceux de la campagne, ou faites passer un colporteur), puis ouvrez-le ici : les joueurs le verront chez eux.</p>${ouvrir}` : `<p>Le MJ n'a ouvert aucune échoppe pour le moment. Vous pouvez consulter <a data-tab="tarifs">tous les prix</a>.</p>`}</div></div>`;
    const enVente = TARIFS.filter((t) => t.enBoutique && statut(t, lieu).ok);
    const dispo = this.#chercher(enVente);
    const indispo = TARIFS.filter((t) => t.enBoutique && !statut(t, lieu).ok).length;
    const occ = (lieu.occasion ?? []).filter((o) => o.qte > 0 && (!this.q || norm(o.nom).includes(norm(this.q))));
    const liste = this.#defaut("acheteur");
    const acheteur = game.actors.get(this.acheteur);
    const vo = voieOr(acheteur);
    this.panier = this.panier.filter((l) => (l.occ ? occ.some((o) => o.id === l.occ) || (lieu.occasion ?? []).some((o) => o.id === l.occ) : T.has(l.tid)));
    const lignes = this.panier.map((l) => {
      if (l.occ) { const o = (lieu.occasion ?? []).find((x) => x.id === l.occ); return { ...l, nom: o?.nom, pu: o?.prix ?? 0, max: o?.qte ?? 1 }; }
      const t = T.get(l.tid); return { ...l, nom: t.nom, pu: prix(t, lieu, vo ? l.vol || 0 : 0).c, max: statut(t, lieu).qte ?? 99 };
    });
    const brut = lignes.reduce((s, l) => s + l.pu * l.qte, 0);
    // troc : les matières premières de l'acheteur
    const R = regles();
    const matieres = acheteur ? acheteur.items.map((i) => ({ i, t: matiereDe(i) })).filter((x) => x.t) : [];
    for (const k of Object.keys(this.troc)) if (!matieres.some((x) => x.i.id === k)) delete this.troc[k];
    const valTroc = matieres.reduce((s, x) => s + Math.round((this.troc[x.i.id] || 0) * x.t.prix * R.troc / 100), 0);
    const du = Math.max(0, brut - valTroc);
    const a = acheteur ? total(bourse(acheteur)) : 0;
    const trocHtml = matieres.length && lignes.length ? `<details class="flm-troc" ${valTroc ? "open" : ""}><summary>Payer en partie en troc</summary>
      <p class="flm-hint">Les matières premières de la fiche, au prix du livre${R.troc !== 100 ? ` × ${R.troc} %` : ""} (réglage maison). Le marchand ne rend pas la monnaie sur un troc.</p>
      ${matieres.map((x) => `<label class="flm-trocl" data-k="troc:${x.i.id}">${esc(x.i.name)} <span class="flm-hint">(${Number(x.i.system.quantity) || 1} · ${prixTxt(x.t.prix)} pièce)</span>
        <input type="number" min="0" max="${Number(x.i.system.quantity) || 1}" value="${this.troc[x.i.id] || 0}" data-troc="${x.i.id}"></label>`).join("")}
      ${valTroc ? `<p>Troc : <b>${prixTxt(valTroc, true)}</b>${valTroc > brut ? ` <span class="flm-alert">(plus que le prix : le surplus est perdu)</span>` : ""}</p>` : ""}</details>` : "";
    const panier = `<div class="flm-card flm-cart"><h3>Panier</h3>
      <p>Acheteur : ${this.#persoSelect("acheteur", this.acheteur, liste)}</p>
      ${acheteur ? `<p class="flm-hint">Bourse : ${prixTxt(a, true)}${vo ? ` · Voie de l'or : jusqu'à 4 VOL par objet, −20 % chacun (Volonté : ${vol(acheteur)})` : ""}</p>` : ""}
      ${lignes.length ? `<table class="flm-table flm-cart-t">${lignes.map((l, i) => `<tr data-k="cart:${i}"><td>${esc(l.nom)}${l.occ ? ` <span class="flm-tag">occasion</span>` : ""}</td>
        <td><input type="number" min="1" max="${l.max}" value="${l.qte}" data-cart-qte="${i}"></td>
        ${vo && !l.occ ? `<td><select data-cart-vol="${i}" title="Voie de l'or">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${n === (l.vol || 0) ? "selected" : ""}>${n ? `${n} VOL` : "VOL"}</option>`).join("")}</select></td>` : vo ? "<td></td>" : ""}
        <td class="flm-price">${prixTxt(l.pu * l.qte)}</td><td><a data-cart-del="${i}" title="Retirer"><i class="fa-solid fa-xmark"></i></a></td></tr>`).join("")}</table>
        ${trocHtml}
        <p class="flm-total">À payer : ${prixTxt(du, true)}</p>
        ${a < du ? `<p class="flm-alert">Pas assez d'argent.</p>` : ""}
        <button type="button" data-act="acheter" ${!acheteur || a < du ? "disabled" : ""}><i class="fa-solid fa-coins"></i> ${game.user.isGM ? "Encaisser" : "Demander au MJ"}</button>`
      : `<p class="flm-hint">Cliquez sur <i class="fa-solid fa-plus"></i> pour ajouter un objet.</p>`}</div>`;
    const marchands = (lieu.marchands ?? []).map((m) => { const { att } = attitudeDe(m); return `<span class="flm-mchd"><b>${esc(m.nom)}</b> · ${esc(ETAB[m.etab] ?? "")} · <span class="flm-att ${att}">${ATT[att][0]}</span></span>`; }).join("");
    const bourseM = lieu.bourseIllimitee ? "" : ` · le marchand a ${prixTxt(lieu.bourse ?? 0, true)} en caisse`;
    return `<div class="flm-split"><div class="flm-scroll">
      <div class="flm-head"><h2>${esc(lieu.nom)}</h2>${ouvrir}
        <p class="flm-sub">${esc(lieu.taille || "")}${esc(bourseM)}</p>${marchands ? `<p class="flm-center">${marchands}</p>` : ""}
        ${lieu.notes ? `<p class="flm-hint flm-center">${esc(lieu.notes)}</p>` : ""}
        ${indispo ? `<p class="flm-hint flm-center">${indispo} objets ne sont pas en vente ici cette semaine : voir <a data-tab="tarifs" data-lieu-voir="${lieu.id}">tous les prix</a> pour savoir pourquoi, ou les commander à un artisan.</p>` : ""}</div>
      ${occ.length ? `<h4>D'occasion</h4><table class="flm-table">${occ.map((o) => `<tr data-k="occ:${o.id}"><td>${esc(o.nom)}${o.qte > 1 ? ` <span class="flm-hint">× ${o.qte}</span>` : ""}</td><td class="flm-price"><b>${prixTxt(o.prix)}</b></td><td><span class="flm-hint">racheté aux aventuriers</span></td><td><button type="button" class="flm-add" data-add-occ="${o.id}" title="Ajouter au panier"><i class="fa-solid fa-plus"></i></button></td></tr>`).join("")}</table>` : ""}
      ${this.#cats(enVente)}${this.#table(dispo, lieu, { achat: true })}</div>
      <div class="flm-side">${panier}</div></div>`;
  }

  /* ---------------- tous les prix */
  #tarifs() {
    const e = etat();
    const ids = game.user.isGM ? e.ordre : (e.ouvert ? [e.ouvert] : []);
    if (this.lieuVu && !ids.includes(this.lieuVu)) this.lieuVu = null;
    const lieu = this.lieuVu ? e.lieux[this.lieuVu] : null;
    const choix = `<label class="flm-inline">Prix : <select data-path="lieuVu"><option value="">du livre (référence)</option>${ids.map((id) => `<option value="${id}" ${this.lieuVu === id ? "selected" : ""}>${esc(aLieu(e.lieux[id]?.nom))}</option>`).join("")}</select></label>`;
    const tete = `<div class="flm-head"><h2>Tous les prix</h2>${choix}<p class="flm-sub">${lieu ? this.#lieuResume(lieu) : "Prix moyens du Manuel du joueur, p. 179 à 195. 1 o = 10 a = 100 c."}</p></div>${this.#cats(TARIFS, true)}`;
    if (this.cat === "tresors") {
      const q = norm(this.q);
      const tr = TRESORS.filter((x) => !q || norm(x.nom).includes(q));
      return `<div class="flm-scroll">${tete}<p class="flm-hint flm-center">Les trouvailles des sites d'aventure (Guide du MJ p. 186-192). Leur valeur se lance quand on les trouve ; certaines particularités la réduisent de moitié (brûlé, tordu, rayé…, p. 192).</p>
        <table class="flm-table"><thead><tr><th>Trouvaille</th><th>Valeur</th><th>Poids</th><th>Table</th></tr></thead><tbody>${tr.map((x) => `<tr><td>${esc(x.nom)}</td><td class="flm-price"><b>${x.d}d6 ${UNITE[x.u][1]}</b></td><td>${esc(x.poids)}</td><td class="flm-hint">${esc(x.table)}, p. ${x.page}</td></tr>`).join("")}</tbody></table></div>`;
    }
    return `<div class="flm-scroll">${tete}${this.#table(this.#chercher(TARIFS), lieu)}</div>`;
  }

  /* ---------------- lieux */
  #lieux() {
    const e = etat(); const sem = semaine();
    if (this.lieuVu && !e.lieux[this.lieuVu]) this.lieuVu = null;
    this.lieuVu ??= e.ordre[0] ?? null;
    const campagne = game.modules.get("fl-campagne")?.active && (game.settings.get("fl-campagne", "contenu")?.sites ?? []).length;
    const liste = e.ordre.map((id) => { const l = e.lieux[id]; return `<a class="flm-lieu${this.lieuVu === id ? " active" : ""}" data-lieu="${id}">
      <b>${esc(l.nom)}</b>${e.ouvert === id ? ` <span class="flm-tag">ouvert</span>` : ""}<br><span class="flm-hint">${esc(l.taille || "")}</span></a>`; }).join("");
    const l = this.lieuVu ? e.lieux[this.lieuVu] : null;
    const pnjs = campagne && l?.campagne ? ((game.settings.get("fl-campagne", "contenu").sites ?? []).find((s) => (s.site ?? s).id === l.campagne)?.pnj ?? []) : [];
    const fiche = l ? `<div class="flm-card" data-k="fiche:${l.id}">
      <p><label>Nom <input type="text" data-path="l.nom" value="${esc(l.nom)}"></label>
        <label>Taille <select data-path="l.taille">${Object.keys(TAILLES).map((x) => `<option ${l.taille === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></p>
      ${l.colporteur ? `<p class="flm-hint">Un colporteur peut vendre tout ce qui est dans les tableaux d'équipement du Manuel, avec les règles habituelles de disponibilité ; il rachète et fait du troc (Guide du MJ p. 13).</p>` : ""}
      ${l.suggere ? `<p class="flm-alert"><i class="fa-solid fa-circle-info"></i> Établissements et marchands devinés d'après le livre : vérifiez-les.</p>` : ""}
      <h4>Ce qu'on y trouve</h4>
      <div class="flm-etabs">${ETABS.map(([id, label, aide]) => `<label title="${esc(aide)}"><input type="checkbox" data-etab="${id}" ${l.etabs?.[id] ? "checked" : ""}> ${label}<span class="flm-hint">${esc(aide)}</span></label>`).join("")}</div>
      <p class="flm-hint">Le Guide du MJ (p. 170) tire les établissements d'un village : avant-poste 1 jet, hameau 3, village 1d6+5. Ce qui manque ici n'est pas en vente.</p>
      <h4>Les marchands</h4>
      ${(l.marchands ?? []).map((m, i) => { const { att, campagne: c } = attitudeDe(m); return `<div class="flm-fact" data-k="m:${i}">
        <input type="text" placeholder="Nom" data-mch="${i}" data-champ="nom" value="${esc(m.nom)}" list="flm-pnj">
        <select data-mch="${i}" data-champ="etab">${ETABS.map(([id, label]) => `<option value="${id}" ${m.etab === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        <select data-mch="${i}" data-champ="attitude" ${c ? "disabled title=\"Suit l'attitude notée dans fl-campagne\"" : ""}>${Object.entries(ATT).map(([id, [lab, p]]) => `<option value="${id}" ${att === id ? "selected" : ""}>${lab} (${p > 0 ? "+" : ""}${p} %)</option>`).join("")}</select>
        <a data-mch-del="${i}" title="Retirer"><i class="fa-solid fa-trash"></i></a></div>`; }).join("") || `<p class="flm-hint">Aucun marchand nommé.</p>`}
      ${pnjs.length ? `<datalist id="flm-pnj">${pnjs.map((p) => `<option value="${esc(p.nom)}">`).join("")}</datalist>` : ""}
      <button type="button" data-act="mch-add"><i class="fa-solid fa-user-plus"></i> Ajouter un marchand</button>
      <p class="flm-hint">Son attitude envers les PJ change ses prix (réglage maison). Un marchand lié à un PNJ de fl-campagne suit l'attitude notée là-bas.</p>
      <h4>Pourquoi les prix changent ici <span class="flm-src">réglage maison</span></h4>
      ${(l.facteurs ?? []).map((f, i) => `<div class="flm-fact" data-k="f:${i}">
        <select data-fact="${i}" data-champ="id">${FACTEURS.map(([id, label]) => `<option value="${id}" ${f.id === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        ${f.id === "specialite" ? `<select data-fact="${i}" data-champ="cat">${CATEGORIES.map(([id, label]) => `<option value="${id}" ${f.cat === id ? "selected" : ""}>${label}</option>`).join("")}</select>` : ""}
        ${f.id === "perso" ? `<input type="text" placeholder="Raison" data-fact="${i}" data-champ="texte" value="${esc(f.texte ?? "")}">` : ""}
        <input type="number" step="5" data-fact="${i}" data-champ="pct" value="${Number(f.pct) || 0}"> %
        <a data-fact-del="${i}" title="Retirer"><i class="fa-solid fa-trash"></i></a></div>`).join("") || `<p class="flm-hint">Prix du livre, sans changement.</p>`}
      <button type="button" data-act="fact-add"><i class="fa-solid fa-plus"></i> Ajouter une raison</button>
      <h4>Stock et caisse <span class="flm-src">réglage maison</span></h4>
      <p><label><input type="checkbox" data-path="l.stockLimite" ${l.stockLimite !== false ? "checked" : ""}> Stock limité aussi pour les objets courants</label>
        <span class="flm-hint">: ${taille(l).stock} de chaque par semaine pour un lieu de cette taille. Les objets inhabituels et rares suivent toujours la règle du livre.</span></p>
      <p><label><input type="checkbox" data-path="l.bourseIllimitee" ${l.bourseIllimitee ? "checked" : ""}> Caisse illimitée</label>
        ${l.bourseIllimitee ? "" : `<label>Caisse du marchand (pièces de cuivre) <input type="number" min="0" data-path="l.bourse" value="${l.bourse ?? taille(l).bourse}"></label> <span class="flm-hint">= ${prixTxt(l.bourse ?? taille(l).bourse, true)}. Les achats la remplissent, les rachats la vident ; elle remonte à ${prixTxt(taille(l).bourse)} chaque semaine si elle est plus basse.</span>`}</p>
      <p class="flm-hint">${sem.auto ? `Le stock suit le calendrier : ${esc(sem.label)}.` : `Sans le module Le Temps des Contrées, c'est vous qui passez à la semaine suivante.`}</p>
      <p><button type="button" data-act="relancer"><i class="fa-solid fa-dice"></i> Relancer le stock</button>
        ${sem.auto ? "" : `<button type="button" data-act="semaine"><i class="fa-solid fa-forward"></i> Semaine suivante (tous les lieux)</button>`}
        <button type="button" data-act="ouvrir"><i class="fa-solid fa-store"></i> ${e.ouvert === l.id ? "Fermer l'échoppe" : "Ouvrir aux joueurs"}</button></p>
      <h4>Notes</h4><textarea data-path="l.notes" rows="2" placeholder="Le marchand, ses habitudes… (visible par les joueurs dans la boutique)">${esc(l.notes ?? "")}</textarea>
      <p class="flm-right"><a data-act="suppr" class="flm-danger"><i class="fa-solid fa-trash"></i> ${l.colporteur ? "Le colporteur repart (supprimer)" : "Supprimer ce lieu"}</a></p></div>` : `<p class="flm-hint">Créez un premier lieu.</p>`;
    return `<div class="flm-split flm-split-l"><div class="flm-scroll flm-list">${liste}
      <button type="button" data-act="lieu-add"><i class="fa-solid fa-plus"></i> Nouveau lieu</button>
      <button type="button" data-act="colporteur" title="Un marchand itinérant (Guide du MJ p. 13)"><i class="fa-solid fa-horse-head"></i> Un colporteur passe</button>
      ${campagne ? `<button type="button" data-act="import-campagne" title="Crée un lieu pour chaque village et château de fl-campagne, avec ses marchands"><i class="fa-solid fa-feather"></i> Lieux de la campagne</button>` : ""}</div>
      <div class="flm-scroll">${fiche}</div></div>`;
  }

  /* ---------------- auberge */
  #auberge() {
    const lieu = this.#lieuCourant();
    const liste = persos();
    this.aub.persos ??= liste.filter((a) => a.hasPlayerOwner).map((a) => a.id);
    const choix = (path, noms, vide) => `<select data-aub="${path}"><option value="">${vide}</option>${noms.map((n) => { const t = T.get(`auberge:${n}`); const st = statut(t, lieu);
      return `<option value="${esc(n)}" ${this.aub[path] === n ? "selected" : ""}>${esc(n)} — ${prixTxt(prix(t, lieu).c)}${st.ok ? "" : " (indisponible)"}</option>`; }).join("")}</select>`;
    const items = [this.aub.nuit, this.aub.repas, this.aub.boisson, this.aub.bain ? "Bain dans une auberge" : ""].filter(Boolean).map((n) => T.get(`auberge:${n}`));
    const n = Math.max(1, Number(this.aub.nuits) || 1);
    const parPers = items.reduce((s, t) => s + prix(t, lieu).c, 0) * n;
    const pb = items.filter((t) => !statut(t, lieu).ok).map((t) => `${t.nom} : ${statut(t, lieu).why}`);
    return `<div class="flm-scroll"><div class="flm-head"><h2>Une nuit à l'auberge</h2>
      <p class="flm-sub">Lieu : ${lieu ? `<b>${esc(lieu.nom)}</b> (l'échoppe ouverte, sinon le lieu choisi dans « Lieux »)` : "aucun : prix du livre"}</p></div>
      <div class="flm-board"><div class="flm-card"><h3>Pour chacun</h3>
        <p>Couchage : ${choix("nuit", ["Chambre d'auberge, dortoir", "Chambre d'auberge individuelle", "Résidence luxueuse"], "pas de chambre")}</p>
        <p>Repas : ${choix("repas", ["Bol de ragoût", "Repas copieux", "Festin"], "pas de repas")}</p>
        <p>Boisson : ${choix("boisson", ["Chope de bière", "Coupe de vin"], "pas de boisson")}</p>
        <p><label><input type="checkbox" data-aub="bain" ${this.aub.bain ? "checked" : ""}> Un bain</label>
          <label>Nuits <input type="number" min="1" max="30" data-aub="nuits" value="${n}"></label></p>
        <p class="flm-hint">Ragoût : couvre la nourriture du jour. Repas copieux et festin : la nourriture et l'eau. Bière ou vin : l'eau (Manuel p. 180).</p>
        ${tempsActif() ? `<p><label><input type="checkbox" data-aub="matin" ${this.aub.matin ? "checked" : ""}> Avancer le temps jusqu'au Matin</label></p>` : ""}</div>
      <div class="flm-card"><h3>Le groupe</h3>
        ${liste.map((a) => { const t = total(bourse(a)); return `<label class="flm-pc"><input type="checkbox" data-aub-pc="${a.id}" ${this.aub.persos.includes(a.id) ? "checked" : ""}> ${esc(a.name)} <span class="flm-hint">${prixTxt(t)}${t < parPers ? " — pas assez" : ""}</span></label>`; }).join("") || `<p class="flm-hint">Aucun personnage.</p>`}
        <p class="flm-total">${prixTxt(parPers, true)} par personne${this.aub.persos.length > 1 ? `, ${prixTxt(parPers * this.aub.persos.length, true)} en tout` : ""}</p>
        ${pb.length ? `<p class="flm-alert">${pb.map(esc).join("<br>")}</p>` : ""}
        <button type="button" data-act="auberge" ${parPers ? "" : "disabled"}><i class="fa-solid fa-bed"></i> Faire payer et dormir</button></div></div></div>`;
  }

  /* ---------------- vendre */
  #vendre() {
    const liste = this.#defaut("vendeur");
    const a = game.actors.get(this.vendeur);
    const R = regles(); const lieu = this.lieuBoutique;
    const objets = a ? a.items.filter((i) => ["gear", "weapon", "armor", "rawMaterial"].includes(i.type)) : [];
    const rows = objets.map((i) => { const est = estimer(i); return `<tr data-k="v:${i.id}"><td>${esc(i.name)}${(Number(i.system.quantity) || 1) > 1 ? ` <span class="flm-hint">× ${i.system.quantity}</span>` : ""}</td>
      <td class="flm-price">${est.base != null ? prixTxt(est.base) : est.des ?? "—"}</td><td class="flm-price"><b>${est.offre != null ? prixTxt(est.offre) : "à estimer"}</b></td>
      <td class="flm-hint">${esc(est.src)}</td><td><button type="button" data-vendre="${i.id}"><i class="fa-solid fa-hand-holding-dollar"></i> ${game.user.isGM ? "Vendre" : "Proposer"}</button></td></tr>`; }).join("");
    return `<div class="flm-scroll"><div class="flm-head"><h2>Vendre un objet</h2>
      <p class="flm-sub">Le livre ne donne pas de prix de revente : le marchand propose ${R.revente} % du prix du livre, et ${R.tresor} % de la valeur d'une trouvaille (réglages maison, dans « Aide »). Le MJ peut toujours changer le prix.</p>
      <p class="flm-center">Vendeur : ${this.#persoSelect("vendeur", this.vendeur, liste)}${lieu ? ` · Acheteur : <b>${esc(lieu.nom)}</b>${lieu.bourseIllimitee ? "" : ` (${prixTxt(lieu.bourse ?? 0, true)} en caisse)`}` : ""}</p></div>
      ${objets.length ? `<table class="flm-table"><thead><tr><th>Objet</th><th>Prix de base</th><th>Offre du marchand</th><th>D'où vient le prix</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="flm-hint flm-center">Rien à vendre.</p>`}</div>`;
  }

  /* ---------------- commandes */
  #commandes() {
    const e = etat(); const gm = game.user.isGM;
    const mien = (c) => gm || game.actors.get(c.actorId)?.isOwner;
    const liste = e.commandes.filter(mien).slice().reverse();
    const reste = (c) => { const j = (c.pret - game.time.worldTime) / DAY; return j <= 0 ? "prête" : j < 1 ? "moins d'un jour" : `${Math.ceil(j)} jour${Math.ceil(j) > 1 ? "s" : ""}`; };
    return `<div class="flm-scroll"><div class="flm-head"><h2>Commandes à un artisan</h2>
      <p class="flm-sub">Pour commander : dans la boutique ou « Tous les prix », cliquez sur un objet puis sur « Commander ». Le délai est le temps de fabrication du livre (deux Quarts de travail par jour, Manuel p. 179), compté sur le calendrier${tempsActif() ? "" : " (sans fl-temps, le MJ remet l'objet quand il le veut)"}.</p></div>
      ${liste.length ? `<table class="flm-table"><thead><tr><th>Pour</th><th>Objet</th><th>Où</th><th>Payé</th><th>État</th><th></th></tr></thead><tbody>${liste.map((c) => `<tr data-k="c:${c.id}" class="${c.statut === "livrée" ? "flm-off" : ""}">
        <td>${esc(c.nom)}</td><td>${c.qte > 1 ? `${c.qte} × ` : ""}${esc(T.get(c.tid)?.nom)}</td><td>${esc(c.lieu)}</td><td class="flm-price">${prixTxt(c.prix)}</td>
        <td>${c.statut === "en cours" ? `en cours, ${reste(c)}` : esc(c.statut)}</td>
        <td>${gm && c.statut !== "livrée" ? `<button type="button" class="flm-small" data-remettre="${c.id}"><i class="fa-solid fa-hand-holding"></i> Remettre</button>` : ""}${gm && c.statut === "en cours" ? ` <a data-annuler="${c.id}" title="Annuler et rembourser"><i class="fa-solid fa-xmark"></i></a>` : ""}</td></tr>`).join("")}</tbody></table>`
      : `<p class="flm-hint flm-center">Aucune commande.</p>`}</div>`;
  }

  /* ---------------- journaliers */
  #journaliers() {
    const e = etat(); const gm = game.user.isGM; const lieu = this.lieuBoutique;
    const liste = this.#defaut("acheteur");
    const contrats = e.contrats.filter((c) => gm || game.actors.get(c.actorId)?.isOwner);
    const today = Math.floor(game.time.worldTime / DAY);
    return `<div class="flm-scroll"><div class="flm-head"><h2>Engager des journaliers</h2>
      <p class="flm-sub">Salaire par jour du Manuel (p. 172-174 ; garde du corps p. 180). La disponibilité est celle des objets : courant, ou inhabituel (1d6 chaque semaine)${lieu ? ` — ${esc(lieu.nom)}` : " — ouvrez une échoppe pour engager"}.</p>
      <p class="flm-center">Employeur : ${this.#persoSelect("acheteur", this.acheteur, liste)}</p></div>
      ${this.#gardes(e)}
      <div class="flm-board">
      <div class="flm-card flm-wide2"><h3>Autres journaliers</h3><table class="flm-table"><thead><tr><th>Métier</th><th>Salaire</th><th>Rôle</th><th>Ici</th><th></th></tr></thead><tbody>
        ${JOURNALIERS.map(([nom, sal, dispo, role]) => { const st = statutJour(nom, lieu); return `<tr data-k="jr:${esc(nom)}" class="${st.ok ? "" : "flm-off"}"><td>${esc(nom)}</td><td class="flm-price">${prixTxt(sal)}/jour</td><td class="flm-hint">${esc(role)}</td>
          <td><span class="flm-dispo flm-d${dispo}">${DISPO[dispo]}</span>${lieu && !st.ok ? ` <span class="flm-no" title="${esc(st.why)}">non</span>` : lieu && st.qte ? ` <span class="flm-ok">${st.qte}</span>` : ""}</td>
          <td>${lieu && st.ok ? `<button type="button" class="flm-small" data-engager="${esc(nom)}">Engager</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <div class="flm-card"><h3>Sous contrat</h3>
        ${contrats.length ? contrats.map((c) => `<p data-k="ct:${c.id}"><b>${esc(c.nom)}</b> pour ${esc(c.employeur)} · ${prixTxt(c.salaire)}/jour${c.retard ? ` · <span class="flm-alert">${c.retard} jour(s) impayé(s)</span>` : ""}${today - c.paye > 0 ? ` · ${today - c.paye} jour(s) dû(s)` : ""}
          ${gm ? `<a data-renvoyer="${c.id}" title="Fin du contrat"><i class="fa-solid fa-user-xmark"></i></a>` : ""}</p>`).join("")
          + (gm ? `<button type="button" data-act="salaires"><i class="fa-solid fa-coins"></i> Payer une journée</button><p class="flm-hint">${tempsActif() ? "Les salaires sont aussi payés tout seuls à chaque nouveau jour du calendrier." : "Sans fl-temps, payez à la main chaque jour."} Retard de paiement : Manuel p. 162.</p>` : "")
          : `<p class="flm-hint">Personne pour le moment.</p>`}</div></div></div>`;
  }

  #gardes(e) {
    const lieu = game.user.isGM ? this.#lieuCourant() : this.lieuBoutique;
    if (!lieu) return "";
    const gm = game.user.isGM;
    const ids = (lieu.gardes ?? []).filter((id) => GARDE[id] && !e.contrats.some((c) => c.garde === id));
    const carte = (g) => `<div class="flm-card flm-garde" data-k="g:${g.id}">
      ${portraitDe(g.id) ? `<img class="flm-portrait" src="${esc(portraitDe(g.id))}" alt="">` : ""}<h3>${esc(g.nom)}</h3><p class="flm-sub">${esc(g.peuple)}, ${g.age} ans · ${prixTxt(JOUR["Garde du corps"].salaire)} par jour</p>
      <p class="flm-quote">${esc(g.replique)}</p>
      <p><b>Allure :</b> ${esc(g.visage)} ${esc(g.corps)} ${esc(g.tenue)}</p>
      <p><b>Caractère :</b> ${esc(g.traits)}</p>
      <p>${esc(g.histoire)}</p>
      <p><b>Ce qu'il veut :</b> ${esc(g.veut)} · <b>Sa fierté :</b> ${esc(g.fierte)}</p>
      ${gm ? `<p class="flm-secret"><b>Secret (MJ) :</b> ${esc(g.secret)}</p>` : ""}
      <p class="flm-hint">Force ${g.attr[0]}, Agilité ${g.attr[1]}, Esprit ${g.attr[2]}, Empathie ${g.attr[3]} · ${esc(Object.entries(g.comp).map(([k, v]) => `${COMP[k] ?? k} ${v}`).join(", "))} · ${esc(g.equip.join(", "))}</p>
      <div class="flm-buttons"><button type="button" data-garde="${g.id}"><i class="fa-solid fa-handshake"></i> ${gm ? "Engager" : "Demander à l'engager"}</button>
        ${gm ? `<button type="button" data-fiche-garde="${g.id}"><i class="fa-solid fa-id-card"></i> Créer sa fiche</button><button type="button" data-prompt-garde="${g.id}" title="Copie un texte à coller dans ChatGPT pour créer son portrait"><i class="fa-solid fa-image"></i> Prompt image</button>` : ""}</div></div>`;
    return `<h3 class="flm-center">Gardes du corps — ${esc(lieu.nom)}</h3>
      <p class="flm-hint flm-center">Personnages inventés pour le module ; prix du service du livre (Manuel p. 180), chiffres d'après le Soldat du Guide du MJ (p. 183).${gm ? ` <a data-act="autres-gardes"><i class="fa-solid fa-shuffle"></i> D'autres gardes</a> · <a data-act="toutes-fiches"><i class="fa-solid fa-users"></i> Créer les fiches des ${GARDES.length} gardes</a>` : ""}</p>
      ${ids.length ? `<div class="flm-gardes">${ids.map((id) => carte(GARDE[id])).join("")}</div>` : `<p class="flm-hint flm-center">Plus de garde du corps disponible ici.</p>`}`;
  }

  /* ---------------- carnet */
  #carnet() {
    const e = etat(); const gm = game.user.isGM;
    const mes = persos();
    const lignes = e.carnet.filter((x) => (gm || mes.some((a) => a.id === x.actorId)) && (!this.carnetPerso || x.actorId === this.carnetPerso));
    const dep = lignes.filter((x) => x.montant < 0).reduce((s, x) => s - x.montant, 0);
    const rec = lignes.filter((x) => x.montant > 0).reduce((s, x) => s + x.montant, 0);
    return `<div class="flm-scroll"><div class="flm-head"><h2>Carnet de dépenses</h2>
      <p class="flm-center"><label class="flm-inline">Personnage : <select data-path="carnetPerso"><option value="">tous</option>${mes.map((a) => `<option value="${a.id}" ${this.carnetPerso === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label></p>
      <p class="flm-sub">Dépensé : ${prixTxt(dep, true)} · Gagné : ${prixTxt(rec, true)}</p></div>
      ${lignes.length ? `<table class="flm-table"><thead><tr><th>Date</th><th>Qui</th><th>Quoi</th><th>Montant</th></tr></thead><tbody>${lignes.slice(0, 200).map((x) => `<tr data-k="cb:${x.id}"><td class="flm-hint">${esc(x.date)}</td><td>${esc(x.nom)}</td><td><span class="flm-tag">${esc(x.type)}</span> ${esc(x.txt)}</td>
        <td class="flm-price ${x.montant < 0 ? "flm-moins" : x.montant > 0 ? "flm-plus" : ""}">${x.montant ? `${x.montant < 0 ? "−" : "+"}${prixTxt(Math.abs(x.montant))}` : ""}</td></tr>`).join("")}</tbody></table>`
      : `<p class="flm-hint flm-center">Rien pour le moment.</p>`}
      ${gm && e.carnet.length ? `<p class="flm-right"><a class="flm-danger" data-act="carnet-vider"><i class="fa-solid fa-broom"></i> Vider le carnet</a></p>` : ""}</div>`;
  }

  /* ---------------- aide */
  #explications() {
    const R = regles(); const gm = game.user.isGM;
    const num = (k) => gm ? `<input type="number" step="5" data-regle="${k}" value="${R[k]}"> %` : `<b>${R[k]} %</b>`;
    const chk = (k) => `<input type="checkbox" data-regle="${k}" ${R[k] ? "checked" : ""} ${gm ? "" : "disabled"}>`;
    return `<div class="flm-scroll flm-text">
      <h2>Comment marchent les prix</h2>
      <div class="flm-board">
      <div class="flm-card"><h3>Ce que dit le livre</h3><ul>
        <li><b>Monnaie</b> : 10 pièces de cuivre valent 1 pièce d'argent, 10 pièces d'argent valent 1 pièce d'or. On frappe peu de pièces dans les Contrées Interdites et l'on troque beaucoup (Manuel p. 37).</li>
        <li><b>Prix</b> : ceux des tableaux sont des prix moyens. Ils peuvent beaucoup changer d'un village à l'autre et selon la disponibilité (Manuel p. 104 et 180).</li>
        <li><b>Courant</b> : en vente en quantité raisonnable dans un village typique. <b>Inhabituel</b> : 1d6 chaque semaine ; sur 4 ou plus, 1d6 lots. <b>Rare</b> : 1d6 chaque semaine ; sur un 6, un seul exemplaire (Manuel p. 179).</li>
        <li><b>Fabrication</b> : chaque objet a ses matières premières, son temps (deux Quarts de travail par jour), son talent et ses outils (Manuel p. 179-193).</li>
        <li><b>Voie de l'or</b> (talent) : chaque point de Volonté dépensé baisse le prix d'un objet de 20 %, jusqu'à 4 points (Manuel p. 66).</li>
        <li><b>Établissements</b> : le Guide du MJ (p. 170) tire ceux d'un village : auberge, moulin, forgeron, scierie, comptoir, temple, milice, taverne, écurie… ou rien.</li>
        <li><b>Colporteur</b> : il vend tout l'équipement du Manuel, avec les règles de disponibilité, rachète et fait du troc (Guide du MJ p. 13).</li>
        <li><b>Trouvailles</b> : leur valeur se lance quand on les trouve (Guide du MJ p. 186-192).</li>
        <li><b>Journaliers</b> : salaire par jour, disponibilité comme les objets (Manuel p. 172-174) ; s'ils ne sont pas payés, voir le retard de paiement (p. 162).</li></ul></div>
      <div class="flm-card"><h3>Ce qui est maison</h3>
        <p>Le livre ne chiffre pas tout. Ces réglages sont à votre goût :</p><ul>
        <li><label>${chk("rarete")} Plus cher quand c'est moins courant</label> : inhabituel ${num("I")}, rare ${num("R")}.</li>
        <li><label>${chk("attitude")} L'attitude du marchand change ses prix</label> : allié −20 %, amical −10 %, méfiant +10 %, hostile +25 %, ennemi +50 %.</li>
        <li>Offre du marchand pour un objet : ${num("revente")} du prix du livre ; pour une trouvaille : ${num("tresor")} de sa valeur. Il revend ensuite l'objet d'occasion.</li>
        <li>Valeur du troc : ${num("troc")} du prix du livre des matières premières.</li>
        <li><b>Stock des objets courants</b> et <b>caisse du marchand</b> selon la taille du lieu (avant-poste 1 de chaque et 1 o, hameau 3 et 3 o, village 6 et 10 o, château 6 et 20 o, ville 12 et 50 o, colporteur 2 et 5 o), renouvelés chaque semaine.</li>
        <li>Les <b>raisons propres à chaque lieu</b> (isolé, pénurie, abondance…), réglées dans l'onglet Lieux.</li>
        <li><b>Commandes</b> : on paie d'avance le prix d'ici ; le forgeron fait ce qui demande une forge, un artisan du marché le reste. Plusieurs objets prennent plusieurs fois le temps.</li>
        <li><b>Qui vend quoi</b> : armes, armures et outils chez le forgeron, chambres à l'auberge, repas à l'auberge ou à la taverne, chevaux à l'écurie, farine au moulin, bois à la scierie, bateaux au port, le reste au marché ou au comptoir.</li></ul></div>
      <div class="flm-card"><h3>Pour jouer</h3><ul>
        <li>Le MJ crée les lieux (ou importe ceux de la campagne avec leurs marchands, ou fait passer un colporteur), puis ouvre l'échoppe aux joueurs.</li>
        <li>Les joueurs ouvrent le Marchand (Alt+M ou le bouton <i class="fa-solid fa-scale-balanced"></i> des notes), remplissent leur panier, peuvent payer en partie en troc, et demandent l'achat.</li>
        <li>Le MJ reçoit chaque demande dans le tchat, peut changer le prix (marchandage), puis accepte : argent, objets, stock et caisse sont mis à jour, et tout va au carnet.</li>
        <li>Un objet absent cette semaine peut se commander à un artisan ; il est prêt après son temps de fabrication.</li>
        <li>Cliquez sur le nom d'un objet pour voir le détail de son prix.</li></ul></div></div></div>`;
  }

  /* ---------------- actions */
  async #click(ev) {
    const t = ev.target.closest("[data-ovr],[data-tab],[data-cat],[data-why],[data-add],[data-add-occ],[data-cart-del],[data-act],[data-lieu],[data-fact-del],[data-mch-del],[data-vendre],[data-commander],[data-remettre],[data-annuler],[data-engager],[data-renvoyer],[data-garde],[data-fiche-garde],[data-prompt-garde]");
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.ovr != null) {
      const e = etat(); const l = e.lieux[d.ovrL]; if (!l || !game.user.isGM) return;
      l.ovr ??= {}; if (d.ovr) l.ovr[d.ovrT] = d.ovr; else delete l.ovr[d.ovrT];
      await saveEtat(e); return this.render();
    }
    if (d.tab === "journaliers" && game.user.isGM) chercherPortraits().then(appMaj);
    if (d.tab) { this.tab = d.tab; if (d.lieuVoir) this.lieuVu = d.lieuVoir; return this.render(); }
    if (d.cat != null) { this.cat = d.cat; return this.render(); }
    if (d.why) { this.ouverts.has(d.why) ? this.ouverts.delete(d.why) : this.ouverts.add(d.why); return this.render(); }
    if (d.add) {
      const ex = this.panier.find((l) => l.tid === d.add);
      const max = statut(T.get(d.add), this.lieuBoutique).qte ?? 99;
      if (ex) ex.qte = Math.min(max, ex.qte + 1); else this.panier.push({ tid: d.add, qte: 1, vol: 0 });
      replay(t, "flm-pop"); return this.render();
    }
    if (d.addOcc) {
      const o = this.lieuBoutique?.occasion?.find((x) => x.id === d.addOcc); if (!o) return;
      const ex = this.panier.find((l) => l.occ === d.addOcc);
      if (ex) ex.qte = Math.min(o.qte, ex.qte + 1); else this.panier.push({ occ: d.addOcc, qte: 1 });
      replay(t, "flm-pop"); return this.render();
    }
    if (d.cartDel != null) { this.panier.splice(Number(d.cartDel), 1); return this.render(); }
    if (d.lieu) { this.lieuVu = d.lieu; return this.render(); }
    if (d.factDel != null) return this.#majLieu((l) => l.facteurs.splice(Number(d.factDel), 1));
    if (d.mchDel != null) return this.#majLieu((l) => l.marchands.splice(Number(d.mchDel), 1));
    if (d.vendre) return this.#vendreObjet(d.vendre);
    if (d.commander) return this.#commander(d.commander);
    if (d.remettre) { await remettreCommande(d.remettre); return this.render(); }
    if (d.annuler) return this.#annulerCommande(d.annuler);
    if (d.engager) return this.#engager(d.engager);
    if (d.renvoyer) {
      const e = etat(); const c = e.contrats.find((x) => x.id === d.renvoyer);
      e.contrats = e.contrats.filter((x) => x.id !== d.renvoyer);
      if (c?.garde && e.lieux[c.lieuId]) (e.lieux[c.lieuId].gardes ??= []).push(c.garde); // il retourne là où on l'a trouvé
      await saveEtat(e); return this.render();
    }
    if (d.garde) return this.#engagerGarde(d.garde);
    if (d.ficheGarde) { await ficheGarde(GARDE[d.ficheGarde]); return; }
    if (d.promptGarde) {
      const txt = promptImage(GARDE[d.promptGarde]);
      try { await navigator.clipboard.writeText(txt); ui.notifications.info("Prompt copié : collez-le dans ChatGPT."); }
      catch { DV().prompt({ window: { title: "Prompt image" }, content: `<textarea rows="12" style="width:100%">${esc(txt)}</textarea>` }).catch(() => null); }
      return;
    }
    switch (d.act) {
      case "acheter": return this.#acheter();
      case "lieu-add": return this.#nouveauLieu();
      case "colporteur": return this.#colporteur();
      case "import-campagne": return this.#importCampagne();
      case "fact-add": return this.#majLieu((l) => (l.facteurs ??= []).push({ id: "isole", pct: FACT.isole.pct }));
      case "mch-add": return this.#majLieu((l) => (l.marchands ??= []).push({ nom: "", etab: ETABS.find(([id]) => l.etabs?.[id])?.[0] ?? "marche", attitude: "neutre" }));
      case "relancer": return this.#majLieu((l) => tirerStock(l, semaine().cle));
      case "semaine": { const e = etat(); e.semaine = (e.semaine ?? 0) + 1; await saveEtat(e); await majStocks({ tous: true }); return this.render(); }
      case "ouvrir": return this.#ouvrir(etat().ouvert === this.lieuVu ? null : this.lieuVu);
      case "salaires": await payerSalaires({ force: true }); return this.render();
      case "toutes-fiches": {
        if (!(await DV().confirm({ window: { title: "Fiches des gardes du corps" }, content: `<p>Créer les fiches de PNJ des ${GARDES.length} gardes du corps (dans un dossier « Gardes du corps ») ? Celles qui existent déjà ne sont pas refaites.</p>` }))) return;
        let n = 0;
        for (const g of GARDES) { if (!game.actors.find((a) => a.getFlag?.(MOD, "garde") === g.id)) { await ficheGarde(g, null, false); n++; } }
        return ui.notifications.info(`${n} fiche(s) créée(s) dans le dossier « Gardes du corps ».`);
      }
      case "autres-gardes": { const e = etat(); const l = e.lieux[this.#lieuCourant()?.id]; if (!l) return; assignerGardes(e, l); await saveEtat(e); return this.render(); }
      case "carnet-vider": {
        if (!(await DV().confirm({ window: { title: "Vider le carnet" }, content: "<p>Effacer tout le carnet de dépenses ?</p>" }))) return;
        const e = etat(); e.carnet = []; await saveEtat(e); return this.render();
      }
      case "suppr": {
        const e = etat(); const l = e.lieux[this.lieuVu]; if (!l) return;
        if (!(await DV().confirm({ window: { title: "Supprimer le lieu" }, content: `<p>Supprimer « ${esc(l.nom)} » ?</p>` }))) return;
        delete e.lieux[l.id]; e.ordre = e.ordre.filter((x) => x !== l.id); if (e.ouvert === l.id) e.ouvert = null;
        this.lieuVu = null; await saveEtat(e); return this.render();
      }
      case "auberge": return this.#payerAuberge();
    }
  }
  async #change(ev) {
    const el = ev.target; const d = el.dataset;
    const val = el.type === "checkbox" ? el.checked : el.value;
    if (d.path === "acheteur") { this.acheteur = val; this.troc = {}; return this.render(); }
    if (d.path === "vendeur") { this.vendeur = val; return this.render(); }
    if (d.path === "carnetPerso") { this.carnetPerso = val; return this.render(); }
    if (d.path === "lieuVu") { this.lieuVu = val || null; return this.render(); }
    if (d.path === "ouvert") return this.#ouvrir(val || null);
    if (d.path?.startsWith("l.")) return this.#majLieu((l) => { const k = d.path.slice(2); l[k] = k === "bourse" ? Math.max(0, Number(val) || 0) : val; });
    if (d.etab) return this.#majLieu((l) => { (l.etabs ??= {})[d.etab] = val; delete l.suggere; });
    if (d.fact != null) return this.#majLieu((l) => {
      const f = l.facteurs[Number(d.fact)]; if (!f) return;
      if (d.champ === "pct") f.pct = Number(val) || 0;
      else if (d.champ === "id") { f.id = val; f.pct = FACT[val]?.pct ?? 0; if (val === "specialite") f.cat ??= "auberge"; }
      else f[d.champ] = val;
    });
    if (d.mch != null) return this.#majLieu((l) => {
      const m = l.marchands[Number(d.mch)]; if (!m) return;
      m[d.champ] = val;
      if (d.champ === "nom" && l.campagne && game.modules.get("fl-campagne")?.active) {
        const s = (game.settings.get("fl-campagne", "contenu").sites ?? []).find((x) => (x.site ?? x).id === l.campagne);
        const p = (s?.pnj ?? []).find((x) => x.nom === val);
        if (p) { m.pnj = `${l.campagne}:${p.id}`; m.attitude = attFromText(p.attitude_initiale); } else delete m.pnj;
      }
    });
    if (d.stock) {
      const e = etat(); const l = e.lieux[d.stockL]; const j = l?.stock?.jets?.[d.stock]; if (!j) return;
      j.qte = (j.vendu ?? 0) + Math.max(0, Number(val) || 0); if (!j.courant) j.ok = j.qte > 0;
      await saveEtat(e); return this.render();
    }
    if (d.cartQte != null) { const l = this.panier[Number(d.cartQte)]; if (l) l.qte = Math.max(1, Math.min(Number(el.max) || 99, Number(val) || 1)); return this.render(); }
    if (d.cartVol != null) { const l = this.panier[Number(d.cartVol)]; if (l) l.vol = Number(val) || 0; return this.render(); }
    if (d.troc) { this.troc[d.troc] = Math.max(0, Math.min(Number(el.max) || 0, Number(val) || 0)); return this.render(); }
    if (d.regle && game.user.isGM) { const R = regles(); R[d.regle] = el.type === "checkbox" ? val : Number(val) || 0; await game.settings.set(MOD, "regles", R); return this.render(); }
    if (d.aub) { this.aub[d.aub] = el.type === "checkbox" ? val : d.aub === "nuits" ? Number(val) || 1 : val; return this.render(); }
    if (d.aubPc) { const s = new Set(this.aub.persos ?? []); val ? s.add(d.aubPc) : s.delete(d.aubPc); this.aub.persos = [...s]; return this.render(); }
  }
  async #majLieu(fn) {
    if (!game.user.isGM) return;
    const e = etat(); const l = e.lieux[this.lieuVu]; if (!l) return;
    fn(l); await saveEtat(e); this.render();
  }
  async #nouveauLieu(data = {}) {
    const e = etat(); const id = rid();
    e.lieux[id] = { id, nom: "Nouveau lieu", taille: "Village", etabs: { marche: true, auberge: true, forgeron: true }, facteurs: [], marchands: [], notes: "", ovr: {}, occasion: [], ...data };
    e.ordre.push(id); tirerStock(e.lieux[id], semaine().cle); assignerGardes(e, e.lieux[id]);
    this.lieuVu = id; await saveEtat(e); this.render();
    return id;
  }
  async #colporteur() {
    const etabs = Object.fromEntries(ETABS.filter(([id]) => !["auberge", "taverne", "temple", "milice"].includes(id)).map(([id]) => [id, true]));
    const id = await this.#nouveauLieu({ nom: "Le colporteur", taille: "Colporteur", etabs, colporteur: true, marchands: [{ nom: "Le colporteur", etab: "marche", attitude: "neutre" }], notes: "Un marchand itinérant de passage." });
    const ok = await DV().confirm({ window: { title: "Un colporteur passe" }, content: "<p>Ouvrir tout de suite son étal aux joueurs ?</p>" });
    if (ok) await this.#ouvrir(id);
  }
  async #importCampagne() {
    const sites = game.settings.get("fl-campagne", "contenu")?.sites ?? [];
    const e = etat(); const cle = semaine().cle; let n = 0;
    const guess = [[/auberge/, "auberge"], [/taverne|brasserie/, "taverne"], [/forge|armurerie/, "forgeron"], [/moulin/, "moulin"], [/scierie/, "scierie"],
      [/chapelle|temple|infirmerie/, "temple"], [/march|guilde|comptoir|place/, "marche"], [/ecurie|etable|chevaux/, "ecurie"], [/port|embarcadere|pecheur/, "port"], [/garde|baraquement|caserne|milice/, "milice"]];
    const metiers = [[/^aubergiste|aubergiste/, "auberge"], [/brasseur|taverne/, "taverne"], [/^forgeron|maitre forgeron|forgeron (?!.*du forgeron)/, "forgeron"], [/boulanger|marchand|negociant|garde chasse|potier|tanneur|tailleur/, "marche"], [/meunier/, "moulin"]];
    for (const s of sites) {
      const si = s.site ?? s; if (!["village", "château", "chateau"].includes(si.categorie)) continue;
      if (e.ordre.some((id) => e.lieux[id]?.campagne === si.id)) continue;
      const etabs = {};
      for (const lx of si.lieux ?? []) { const t = norm(lx.titre ?? lx.nom); for (const [re, k] of guess) if (re.test(t)) etabs[k] = true; }
      if (si.categorie === "village") etabs.marche = true;
      const marchands = [];
      for (const p of s.pnj ?? []) {
        const r = norm(p.role); if (/du forgeron|fille|epouse|fils|defunt|assassine|prisonnier|esclave/.test(r)) continue;
        const hit = metiers.find(([re]) => re.test(r)); if (!hit) continue;
        etabs[hit[1]] = true;
        marchands.push({ nom: p.nom, etab: hit[1], attitude: attFromText(p.attitude_initiale), pnj: `${si.id}:${p.id}` });
      }
      const id = rid();
      e.lieux[id] = { id, nom: si.nom, taille: si.categorie === "village" ? "Village" : "Château ou forteresse", etabs, facteurs: [], marchands, notes: "", ovr: {}, occasion: [], campagne: si.id, suggere: true };
      tirerStock(e.lieux[id], cle); e.ordre.push(id); assignerGardes(e, e.lieux[id]); n++;
    }
    await saveEtat(e);
    ui.notifications.info(n ? `${n} lieu(x) créé(s) d'après la campagne. Vérifiez les établissements et les marchands.` : "Tous les lieux de la campagne existent déjà.");
    this.render();
  }
  async #ouvrir(id) {
    const e = etat(); e.ouvert = id || null;
    if (id && e.lieux[id]?.stock?.cle !== semaine().cle) tirerStock(e.lieux[id], semaine().cle);
    await saveEtat(e);
    if (id) ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-store"></i> ${esc(e.lieux[id].nom)} : l'échoppe est ouverte</h3><p><button type="button" data-flm="voir"><i class="fa-solid fa-scale-balanced"></i> Voir la boutique</button> <span class="flm-hint">(ou Alt+M)</span></p></div>` });
    this.render();
  }
  async #acheter() {
    const lieu = this.lieuBoutique; const actor = game.actors.get(this.acheteur);
    if (!lieu || !actor || !this.panier.length) return;
    const vo = !!voieOr(actor);
    const lignes = [];
    for (const l of this.panier) {
      if (l.occ) {
        const o = lieu.occasion?.find((x) => x.id === l.occ); if (!o || o.qte < l.qte) return ui.notifications.warn("Cet objet d'occasion n'est plus disponible.");
        lignes.push({ occ: l.occ, nom: o.nom, qte: l.qte, prix: o.prix, vol: 0 }); continue;
      }
      const t = T.get(l.tid); const st = statut(t, lieu);
      if (!st.ok || (st.qte != null && l.qte > st.qte)) return ui.notifications.warn(`${t.nom} : ${st.why ?? "plus assez en stock"}`);
      const v = vo ? l.vol || 0 : 0;
      lignes.push({ tid: l.tid, nom: t.nom, qte: l.qte, vol: v, prix: prix(t, lieu, v).c });
    }
    const R = regles();
    const troc = Object.entries(this.troc).filter(([, q]) => q > 0).map(([itemId, qte]) => { const it = actor.items.get(itemId); const t = it && matiereDe(it); return t ? { itemId, qte, nom: it.name, val: Math.round(qte * t.prix * R.troc / 100) } : null; }).filter(Boolean);
    const data = { actorId: actor.id, lignes, lieuId: lieu.id, troc };
    const brut = lignes.reduce((s, l) => s + l.prix * l.qte, 0); const valTroc = troc.reduce((s, l) => s + l.val, 0);
    if (game.user.isGM) {
      try {
        const r = await appliquerAchat(data);
        ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-coins"></i> ${esc(actor.name)} achète</h3><p>${resume(lignes)}</p>${troc.length ? `<p>Troc : ${esc(troc.map((l) => `${l.qte} ${l.nom}`).join(", "))} (${prixTxt(valTroc)})</p>` : ""}<p>Payé : <b>${prixTxt(r.du, true)}</b> ${esc(aLieu(lieu.nom))}.</p>${r.sansFiche.length ? `<p class="flm-hint">Créé sans caractéristiques : ${esc(r.sansFiche.join(", "))}.</p>` : ""}</div>`, speaker: ChatMessage.getSpeaker({ actor }) });
      } catch (err) { return ui.notifications.warn(err.message); }
    } else {
      await demander("achat", data, `<p><b>${esc(actor.name)}</b> ${esc(aLieu(lieu.nom))} :</p><p>${resume(lignes)}</p>${troc.length ? `<p>Troc proposé : ${esc(troc.map((l) => `${l.qte} ${l.nom}`).join(", "))} (${prixTxt(valTroc)})</p>` : ""}<p>À payer : <b>${prixTxt(Math.max(0, brut - valTroc), true)}</b></p>`);
      ui.notifications.info("Demande envoyée au MJ.");
    }
    this.panier = []; this.troc = {}; this.render();
  }
  async #commander(tid) {
    const t = T.get(tid); const lieu = this.#lieuCourant();
    const liste = this.#defaut("acheteur"); const actor = game.actors.get(this.acheteur);
    if (!t || !lieu || !actor) return ui.notifications.warn("Choisissez un lieu (échoppe ouverte) et un personnage.");
    const pu = prix(t, lieu).c; const j = delai(FAB[t.nom][1]);
    const res = await DV().prompt({ window: { title: `Commander : ${t.nom}` }, content: `<p>À ${esc(lieu.nom)}, ${prixTxt(pu, true)} pièce, prêt dans ${delaiTxt(j)} par objet.</p>
      <p><label>Pour ${liste.length > 1 ? `<select name="a">${liste.map((a) => `<option value="${a.id}" ${a.id === actor.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : esc(actor.name)}</label></p>
      <p><label>Quantité <input type="number" name="q" min="1" max="20" value="1"></label></p>`,
      ok: { label: game.user.isGM ? "Commander" : "Demander au MJ", callback: (ev, btn) => ({ q: Math.max(1, Number(btn.form.elements.q.value) || 1), a: btn.form.elements.a?.value ?? actor.id }) } }).catch(() => null);
    if (!res) return;
    const a = game.actors.get(res.a);
    const data = { actorId: a.id, tid, qte: res.q, lieuId: lieu.id, prix: pu };
    if (game.user.isGM) {
      try { const r = await appliquerCommande(data); ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-hammer"></i> Commande</h3><p>${esc(a.name)} commande ${res.q > 1 ? `${res.q} × ` : ""}${esc(t.nom)} ${esc(aLieu(lieu.nom))} : ${prixTxt(r.du, true)}, prêt dans ${delaiTxt(r.jours)}.</p></div>`, speaker: ChatMessage.getSpeaker({ actor: a }) }); }
      catch (err) { return ui.notifications.warn(err.message); }
    } else { await demander("commande", data, `<p><b>${esc(a.name)}</b> commande ${res.q > 1 ? `${res.q} × ` : ""}${esc(t.nom)} ${esc(aLieu(lieu.nom))}.</p><p>${prixTxt(pu * res.q, true)}, prêt dans ${delaiTxt(j * res.q)}.</p>`); ui.notifications.info("Commande envoyée au MJ."); }
    this.render();
  }
  async #annulerCommande(id) {
    const e = etat(); const c = e.commandes.find((x) => x.id === id); if (!c) return;
    if (!(await DV().confirm({ window: { title: "Annuler la commande" }, content: `<p>Annuler et rembourser ${prixTxt(c.prix, true)} à ${esc(c.nom)} ?</p>` }))) return;
    const a = game.actors.get(c.actorId); if (a) await majBourse(a, recevoir(bourse(a), c.prix));
    e.commandes = e.commandes.filter((x) => x.id !== id);
    noter(e, a, "remboursement", `Commande annulée : ${T.get(c.tid)?.nom}`, c.prix);
    await saveEtat(e); this.render();
  }
  async #engager(nom) {
    const lieu = this.lieuBoutique; const actor = game.actors.get(this.acheteur); if (!lieu || !actor) return;
    const st = statutJour(nom, lieu);
    const res = await DV().prompt({ window: { title: `Engager : ${nom}` }, content: `<p>${esc(JOUR[nom].role)}</p><p>${prixTxt(JOUR[nom].salaire, true)} par jour, payé par ${esc(actor.name)}.</p>
      <p><label>Combien <input type="number" name="n" min="1" max="${st.qte ?? 10}" value="1"></label></p>`,
      ok: { label: game.user.isGM ? "Engager" : "Demander au MJ", callback: (ev, btn) => Math.max(1, Math.min(st.qte ?? 10, Number(btn.form.elements.n.value) || 1)) } }).catch(() => null);
    if (!res) return;
    const data = { actorId: actor.id, nom, n: res, lieuId: lieu.id };
    if (game.user.isGM) { try { await appliquerEmbauche(data); } catch (err) { return ui.notifications.warn(err.message); } }
    else { await demander("embauche", data, `<p><b>${esc(actor.name)}</b> veut engager ${res > 1 ? `${res} × ` : ""}${esc(nom)} ${esc(aLieu(lieu.nom))} (${prixTxt(JOUR[nom].salaire)} par jour chacun).</p>`); ui.notifications.info("Demande envoyée au MJ."); }
    this.render();
  }
  async #engagerGarde(id) {
    const g = GARDE[id]; const lieu = game.user.isGM ? this.#lieuCourant() : this.lieuBoutique;
    const liste = this.#defaut("acheteur"); const actor = game.actors.get(this.acheteur);
    if (!g || !lieu || !actor) return ui.notifications.warn("Choisissez un employeur.");
    const res = await DV().prompt({ window: { title: `Engager ${g.nom}` }, content: `<p>${esc(g.nom)} demande ${prixTxt(JOUR["Garde du corps"].salaire, true)} par jour.</p>
      <p><label>Employeur ${liste.length > 1 ? `<select name="a">${liste.map((a) => `<option value="${a.id}" ${a.id === actor.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : esc(actor.name)}</label></p>
      ${game.user.isGM ? `<p><label><input type="checkbox" name="fiche" checked> Créer aussi sa fiche de PNJ</label></p>` : ""}`,
      ok: { label: game.user.isGM ? "Engager" : "Demander au MJ", callback: (ev, btn) => ({ a: btn.form.elements.a?.value ?? actor.id, fiche: !!btn.form.elements.fiche?.checked }) } }).catch(() => null);
    if (!res) return;
    const a = game.actors.get(res.a);
    const data = { actorId: a.id, nom: "Garde du corps", n: 1, lieuId: lieu.id, garde: id };
    if (game.user.isGM) {
      try { await appliquerEmbauche(data); if (res.fiche) await ficheGarde(g, a.name); ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-handshake"></i> ${esc(g.nom)} rejoint ${esc(a.name)}</h3><p><i>${esc(g.replique)}</i></p></div>` }); }
      catch (err) { return ui.notifications.warn(err.message); }
    } else { await demander("embauche", data, `<p><b>${esc(a.name)}</b> veut engager <b>${esc(g.nom)}</b> comme garde du corps ${esc(aLieu(lieu.nom))} (${prixTxt(JOUR["Garde du corps"].salaire)} par jour).</p>`); ui.notifications.info("Demande envoyée au MJ."); }
    this.render();
  }
  async #vendreObjet(itemId) {
    const actor = game.actors.get(this.vendeur); const item = actor?.items.get(itemId); if (!item) return;
    const est = estimer(item); const x = tresorDe(item);
    const q = Number(item.system.quantity) || 1;
    let offre = est.offre ?? 0; let info = "";
    if (x && game.user.isGM && item.getFlag?.(MOD, "valeur") == null) {
      const l = lancerTresor(x); await item.setFlag?.(MOD, "valeur", l.c);
      offre = Math.round(l.c * regles().tresor / 100);
      info = `<p>Valeur lancée : ${x.d}d6 = ${l.r.join(" + ")} = ${l.s} ${UNITE[x.u][1]} (Guide du MJ p. ${x.page}). Pensez aux particularités qui la réduisent de moitié (p. 192).</p>`;
    }
    const res = await DV().prompt({ window: { title: `Vendre : ${item.name}` }, content: `<p>${esc(est.src)}</p>${info}
      ${q > 1 ? `<p><label>Quantité <input type="number" name="q" min="1" max="${q}" value="1"></label></p>` : ""}
      <p><label>Prix ${q > 1 ? "unitaire " : ""}demandé, en pièces de cuivre <input type="number" name="c" min="0" value="${offre}"></label></p>
      ${x && !game.user.isGM && est.offre == null ? `<p class="flm-hint">Laissez 0 : le MJ lancera la valeur de la trouvaille.</p>` : ""}`,
      ok: { label: game.user.isGM ? "Vendre" : "Proposer au MJ", callback: (e, btn) => ({ q: Number(btn.form.elements.q?.value) || 1, c: Number(btn.form.elements.c.value) || 0 }) } }).catch(() => null);
    if (!res) return;
    const qte = Math.max(1, Math.min(q, res.q)); const prixTot = res.c * qte;
    const data = { actorId: actor.id, itemId, qte, prix: prixTot, label: `${actor.name} vend ${qte > 1 ? `${qte} × ` : ""}${item.name}` };
    if (game.user.isGM) {
      try { const r = await appliquerVente(data, prixTot); ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-hand-holding-dollar"></i> Vente</h3><p>${esc(r.actor.name)} vend ${esc(r.item)} pour <b>${prixTxt(prixTot, true)}</b>.</p></div>`, speaker: ChatMessage.getSpeaker({ actor }) }); }
      catch (err) { ui.notifications.warn(err.message); }
    } else { await demander("vente", data, `<p>${esc(data.label)}</p><p>Prix demandé : <b>${prixTot ? prixTxt(prixTot, true) : "valeur de la trouvaille à lancer"}</b></p>`); ui.notifications.info("Proposition envoyée au MJ."); }
    this.render();
  }
  async #payerAuberge() {
    const lieu = this.#lieuCourant();
    const items = [this.aub.nuit, this.aub.repas, this.aub.boisson, this.aub.bain ? "Bain dans une auberge" : ""].filter(Boolean).map((n) => T.get(`auberge:${n}`));
    const n = Math.max(1, Number(this.aub.nuits) || 1);
    const parPers = items.reduce((s, t) => s + prix(t, lieu).c, 0) * n;
    const ok = [], ko = [];
    const e = etat();
    for (const id of this.aub.persos ?? []) {
      const a = game.actors.get(id); if (!a) continue;
      const b = payer(bourse(a), parPers);
      if (!b) { ko.push(a.name); continue; }
      await majBourse(a, b); ok.push(a.name);
      noter(e, a, "auberge", `${items.map((t) => t.nom).join(", ")}${n > 1 ? `, ${n} nuits` : ""}${lieu ? ` — ${lieu.nom}` : ""}`, -parPers);
    }
    if (!ok.length && !ko.length) return;
    if (lieu && ok.length && !lieu.bourseIllimitee && e.lieux[lieu.id]) e.lieux[lieu.id].bourse = (e.lieux[lieu.id].bourse ?? 0) + parPers * ok.length;
    await saveEtat(e);
    ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-bed"></i> ${lieu ? esc(lieu.nom) : "L'auberge"}</h3>
      <p>${esc(items.map((t) => t.nom).join(", "))}${n > 1 ? `, ${n} nuits` : ""} : <b>${prixTxt(parPers, true)}</b> chacun.</p>
      ${ok.length ? `<p>Ont payé : ${esc(ok.join(", "))}.</p>` : ""}${ko.length ? `<p class="flm-alert">Pas assez d'argent : ${esc(ko.join(", "))}.</p>` : ""}</div>` });
    if (this.aub.matin && ok.length && this.aub.nuit && globalThis.FLTemps?.goToQuarter) { try { await globalThis.FLTemps.goToQuarter(0); } catch { /* */ } }
    this.render();
  }
}

/** Prix d'un objet de la fiche : trouvaille, tarif du livre si le nom correspond, sinon le coût écrit sur l'objet. */
function estimer(item) {
  const R = regles(); const n = norm(item.name);
  const x = tresorDe(item);
  if (x) {
    const v = item.getFlag?.(MOD, "valeur");
    return v != null ? { base: v, offre: Math.round(v * R.tresor / 100), src: `Trouvaille (${x.table}, Guide du MJ p. ${x.page}) : valeur déjà lancée.` }
      : { base: null, des: `${x.d}d6 ${UNITE[x.u][1]}`, offre: null, src: `Trouvaille (${x.table}, Guide du MJ p. ${x.page}) : valeur ${tresorDes(x)}, lancée à la vente.` };
  }
  const t = TARIFS.find((y) => norm(y.nom) === n) ?? TARIFS.find((y) => y.objet && n.length > 3 && (norm(y.nom).startsWith(n) || n.startsWith(norm(y.nom))));
  if (t) return { base: t.prix, offre: Math.round(t.prix * R.revente / 100), src: `Tarif du livre : ${t.nom} (Manuel p. ${t.page}), offre ${R.revente} %.` };
  const c = lirePrix(item.system?.cost);
  if (c != null) return { base: c, offre: Math.round(c * R.revente / 100), src: `Coût écrit sur l'objet, offre ${R.revente} %.` };
  return { base: null, offre: null, src: "Pas de prix connu : à fixer avec le MJ." };
}

let app = null;
const appMaj = () => app?.rendered && app.render();
function open() { app ??= new MarchandApp(); app.render({ force: true }); }

Hooks.once("init", () => {
  game.settings.register(MOD, "etat", { scope: "world", config: false, type: Object, default: {}, onChange: () => appMaj() });
  game.settings.register(MOD, "portraits", { name: "Dossier des portraits des gardes", hint: "Les portraits sont fournis avec le module. Pour en mettre d'autres, indiquez ici un dossier de vos données Foundry avec des images nommées comme les gardes (brenna.webp, orvik.png…).", scope: "world", config: true, type: String, default: "fl-portraits/gardes", onChange: () => chercherPortraits().then(appMaj) });
  game.settings.register(MOD, "gardesCrees", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(MOD, "regles", { scope: "world", config: false, type: Object, default: {}, onChange: () => appMaj() });
  game.keybindings.register(MOD, "open", { name: "Ouvrir le Marchand", editable: [{ key: "KeyM", modifiers: ["Alt"] }], onDown: () => { open(); return true; } });
});
Hooks.once("ready", () => {
  globalThis.FLMarchand = { open, prix: (nom) => TARIFS.find((t) => norm(t.nom) === norm(nom)) };
  if (isActiveGM()) setTimeout(async () => {
    verifierCommandes(); payerSalaires(); await chercherPortraits();
    // Première fois : les fiches des gardes du corps sont créées toutes seules, dans le dossier « Gardes du corps ».
    if (!game.settings.get(MOD, "gardesCrees")) {
      let n = 0;
      for (const g of GARDES) if (!game.actors.find((a) => a.getFlag?.(MOD, "garde") === g.id)) { await ficheGarde(g, null, false); n++; }
      await game.settings.set(MOD, "gardesCrees", true);
      if (n) ui.notifications.info(`Le Marchand : ${n} fiches de gardes du corps créées dans le dossier « Gardes du corps ».`);
    }
    await habillerGardes();
  }, 2000);
});

Hooks.on("getSceneControlButtons", (controls) => {
  const notes = controls.notes ?? controls.journal;
  if (!notes?.tools) return;
  notes.tools["fl-marchand"] = { name: "fl-marchand", title: "Le Marchand (Alt/⌥+M)", icon: "fa-solid fa-scale-balanced", button: true, onChange: () => open(), order: 100 };
});

// Le temps passe : nouveau stock à chaque semaine, commandes prêtes, salaires des journaliers.
Hooks.on("updateWorldTime", () => {
  clearTimeout(globalThis.__flmT);
  globalThis.__flmT = setTimeout(async () => { const c = await majStocks(); await verifierCommandes(); await payerSalaires(); if (c) appMaj(); }, 800);
});

// Boutons des messages du Marchand
Hooks.on("renderChatMessageHTML", (msg, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelector?.(".flm-chat")) return;
  for (const b of root.querySelectorAll("[data-flm]")) {
    if ((b.dataset.flm === "ok" || b.dataset.flm === "non") && !game.user.isGM) { b.closest(".flm-chat-act")?.remove(); continue; }
    b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (b.dataset.flm === "voir") return open();
      b.disabled = true;
      try { await traiterDemande(msg, b.dataset.flm === "ok"); } finally { b.disabled = false; }
    });
  }
});
