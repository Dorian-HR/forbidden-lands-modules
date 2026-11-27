// Forbidden Lands – Le Marchand
// Prix du Manuel du joueur, échoppes par lieu, disponibilité tirée chaque semaine, achats et ventes validés par le MJ,
// auberge pour le groupe, et l'explication de chaque prix.
import { TARIFS, CATEGORIES, ETABS, DISPO, FACTEURS } from "./tarifs.mjs";

const MOD = "fl-marchand";
const SYS_ART = "systems/forbidden-lands/assets/journal-art";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const T = new Map(TARIFS.map((t) => [t.id, t]));
const ETAB = Object.fromEntries(ETABS.map(([id, label]) => [id, label]));
const FACT = Object.fromEntries(FACTEURS.map(([id, label, pct]) => [id, { label, pct }]));
const CAT = Object.fromEntries(CATEGORIES.map(([id, label]) => [id, label]));
const rid = () => foundry.utils.randomID();

/* ------------------------------------------------------------------ argent */
/** 1 pièce d'or = 10 pièces d'argent = 100 pièces de cuivre (Manuel p. 37). */
function prixTxt(c, long = false) {
  c = Math.max(0, Math.round(c));
  if (!c) return long ? "gratuit" : "0";
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
  const a = Math.floor(reste / 10); const c = reste - a * 10;
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

/* ------------------------------------------------------------------ état */
const etat = () => foundry.utils.mergeObject({ lieux: {}, ordre: [], ouvert: null, semaine: 0 }, game.settings.get(MOD, "etat") ?? {}, { inplace: false });
const regles = () => foundry.utils.mergeObject({ rarete: true, I: 25, R: 50, revente: 50 }, game.settings.get(MOD, "regles") ?? {}, { inplace: false });
async function saveEtat(e) { if (game.user.isGM) await game.settings.set(MOD, "etat", e); }

/** Clé de la semaine : celle du calendrier (fl-temps) si le module est là, sinon un compteur que le MJ fait avancer. */
function semaine() {
  const FT = globalThis.FLTemps;
  if (FT?.getState && game.modules.get("fl-temps")?.active) {
    try {
      const d = FT.getState().date;
      const mois = d.month?.name ?? "";
      if (d.isFeast) return { cle: `t${d.year}-${d.monthIndex}-0`, label: `${d.feast?.name ?? "jour de fête"} ${d.year}`, auto: true };
      return { cle: `t${d.year}-${d.monthIndex}-${d.week}`, label: `${d.weekLabel ?? `semaine ${d.week}`} de ${mois} ${d.year}`, auto: true };
    } catch { /* calendrier indisponible */ }
  }
  const n = etat().semaine ?? 0;
  return { cle: `m${n}`, label: `semaine n° ${n + 1}`, auto: false };
}

/* ------------------------------------------------------------------ disponibilité (Manuel p. 179) */
const d6 = () => Math.ceil(Math.random() * 6);
function tirerStock(lieu, cle) {
  const jets = {};
  for (const t of TARIFS) {
    if (!t.enBoutique || (t.dispo !== "I" && t.dispo !== "R")) continue;
    const d = d6();
    if (t.dispo === "I") { const ok = d >= 4; jets[t.id] = { d, ok, qte: ok ? d6() : 0, vendu: 0 }; }
    else { const ok = d === 6; jets[t.id] = { d, ok, qte: ok ? 1 : 0, vendu: 0 }; }
  }
  lieu.stock = { cle, jets };
}
/** Le MJ actif tire le stock des lieux dont la semaine a changé. */
async function majStocks({ tous = false } = {}) {
  if (game.user !== game.users.activeGM) return false;
  const e = etat(); const { cle } = semaine(); let chg = false;
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
  if (t.dispo === "C") return { ok: true, why: "Courant : en vente en quantité raisonnable.", qte: null };
  if (!t.dispo) return { ok: true, why: "Le livre ne donne pas de disponibilité : traité comme courant.", qte: null };
  const j = lieu.stock?.jets?.[t.id];
  if (!j) return { ok: false, why: "Stock de la semaine pas encore tiré (le MJ ouvre l'échoppe pour le tirer)." };
  if (t.dispo === "I") {
    if (!j.ok) return { ok: false, why: `Inhabituel : 1d6 = ${j.d}, il fallait 4 ou plus. Rien cette semaine.` };
    const r = j.qte - (j.vendu ?? 0);
    return r > 0 ? { ok: true, qte: r, why: `Inhabituel : 1d6 = ${j.d} (4 ou plus), ${j.qte} lot${j.qte > 1 ? "s" : ""} cette semaine${j.vendu ? `, ${r} restant${r > 1 ? "s" : ""}` : ""}.` }
      : { ok: false, why: `Inhabituel : les ${j.qte} lot${j.qte > 1 ? "s" : ""} de la semaine sont vendus.` };
  }
  if (!j.ok) return { ok: false, why: `Rare : 1d6 = ${j.d}, il fallait un 6. Rien cette semaine.` };
  return (j.vendu ?? 0) < 1 ? { ok: true, qte: 1, why: "Rare : 1d6 = 6, un seul exemplaire cette semaine." } : { ok: false, why: "Rare : l'exemplaire de la semaine est vendu." };
}

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
  let c = t.prix * Math.max(0.1, 1 + pct / 100);
  if (vol > 0) { c *= Math.max(0.2, 1 - 0.2 * vol); lignes.push({ txt: `Voie de l'or : ${vol} VOL, −${20 * vol} %`, src: "Manuel p. 66" }); }
  c = Math.max(1, Math.round(c));
  return { c, lignes };
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
async function donnerObjet(actor, t, qte) {
  if (!t.objet) return { cree: false };
  const idx = await indexCompendiums();
  const hit = idx.get(norm(t.nom)) ?? idx.get(norm(t.nom.replace(/\s*\(.*\)$/, "")));
  let data;
  if (hit) {
    const doc = await game.packs.get(hit.pack)?.getDocument(hit.id);
    if (doc) data = doc.toObject();
  }
  const trouve = !!data;
  data ??= { name: t.nom, type: t.itemType, system: { cost: prixTxt(t.prix, true), supply: DISPO[t.dispo] ?? "", weight: t.weight } };
  delete data._id;
  const stack = ["gear", "rawMaterial"].includes(data.type);
  if (stack) {
    const deja = actor.items.find((i) => i.type === data.type && norm(i.name) === norm(data.name));
    if (deja) { await deja.update({ "system.quantity": (Number(deja.system.quantity) || 1) + qte }); return { cree: true, trouve }; }
    foundry.utils.setProperty(data, "system.quantity", qte);
    await actor.createEmbeddedDocuments("Item", [data]);
  } else await actor.createEmbeddedDocuments("Item", Array.from({ length: qte }, () => foundry.utils.deepClone(data)));
  return { cree: true, trouve };
}
const voieOr = (actor) => actor?.items?.find((i) => i.type === "talent" && /voie de l or|path of gold/.test(norm(i.name)));
/** Le MJ voit tous les personnages (ceux des joueurs d'abord) ; un joueur ne voit que les siens. */
const persos = () => game.actors.filter((a) => a.type === "character" && (game.user.isGM || a.isOwner))
  .sort((x, y) => (y.hasPlayerOwner - x.hasPlayerOwner) || x.name.localeCompare(y.name));
const vol = (actor) => Number(actor?.system?.bio?.willpower?.value) || 0;

/* ------------------------------------------------------------------ achats et ventes */
/** Le MJ applique un achat : argent, objets, stock, Volonté. Renvoie un compte rendu ou une erreur. */
async function appliquerAchat({ actorId, lignes, lieuId }, totalForce = null) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error("Personnage introuvable.");
  const e = etat(); const lieu = lieuId ? e.lieux[lieuId] : null;
  const du = totalForce ?? lignes.reduce((s, l) => s + l.prix * l.qte, 0);
  const b = payer(bourse(actor), du);
  if (!b) throw new Error(`${actor.name} n'a pas assez d'argent : il faut ${prixTxt(du, true)}, il a ${prixTxt(total(bourse(actor)), true)}.`);
  const volTot = lignes.reduce((s, l) => s + (l.vol || 0), 0);
  if (volTot > vol(actor)) throw new Error(`${actor.name} n'a que ${vol(actor)} point(s) de Volonté.`);
  await majBourse(actor, b);
  if (volTot) await actor.update({ "system.bio.willpower.value": vol(actor) - volTot });
  const sansFiche = [];
  for (const l of lignes) {
    const t = T.get(l.tid); if (!t) continue;
    const r = await donnerObjet(actor, t, l.qte);
    if (r.cree && !r.trouve) sansFiche.push(t.nom);
    const j = lieu?.stock?.jets?.[t.id];
    if (j) j.vendu = (j.vendu ?? 0) + l.qte;
  }
  if (lieu) await saveEtat(e);
  return { actor, du, reste: b, sansFiche };
}

async function appliquerVente({ actorId, itemId, qte }, prixTotal) {
  const actor = game.actors.get(actorId); const item = actor?.items.get(itemId);
  if (!item) throw new Error("L'objet n'est plus sur la fiche.");
  const q = Number(item.system.quantity) || 1;
  if (q > qte) await item.update({ "system.quantity": q - qte }); else await item.delete();
  const b = bourse(actor);
  let o = b.o + Math.floor(prixTotal / 100), a = b.a + Math.floor((prixTotal % 100) / 10), c = b.c + (prixTotal % 10);
  if (c >= 10) { a += Math.floor(c / 10); c %= 10; }
  await majBourse(actor, { o, a, c });
  return { actor, item: item.name };
}

const resume = (lignes) => lignes.map((l) => `${l.qte > 1 ? `${l.qte} × ` : ""}${esc(T.get(l.tid)?.nom ?? "?")}${l.vol ? ` (Voie de l'or, ${l.vol} VOL)` : ""} — ${prixTxt(l.prix * l.qte)}`).join("<br>");
const gmIds = () => game.users.filter((u) => u.isGM).map((u) => u.id);

/** Demande d'un joueur : un message privé au MJ avec deux boutons. */
async function demander(type, data, html) {
  return ChatMessage.create({
    content: `<div class="flm-chat"><h3><i class="fa-solid fa-scale-balanced"></i> ${type === "achat" ? "Demande d'achat" : "Proposition de vente"}</h3>${html}
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
async function traiterDemande(msg, ok) {
  const f = msg.getFlag(MOD, "type") ? msg.flags[MOD] : null;
  if (!f || f.statut !== "attente") return;
  if (!ok) return clore(msg, `<i class="fa-solid fa-xmark"></i> Refusé par le MJ.`);
  const DV = foundry.applications.api.DialogV2;
  if (f.type === "achat") {
    const du = f.data.lignes.reduce((s, l) => s + l.prix * l.qte, 0);
    const res = await DV.prompt({ window: { title: "Accepter l'achat" }, content: `<p>${resume(f.data.lignes)}</p><p>Total demandé : <b>${prixTxt(du, true)}</b>.</p>
      <p>Vous pouvez changer le prix final (marchandage, geste du marchand…), en pièces de cuivre :</p><input type="number" name="c" min="0" value="${du}">`,
      ok: { label: "Encaisser", callback: (ev, btn) => Number(btn.form.elements.c.value) } }).catch(() => null);
    if (res == null) return;
    try {
      const r = await appliquerAchat(f.data, res);
      await clore(msg, `<i class="fa-solid fa-check"></i> Payé ${prixTxt(r.du, true)}. Il reste à ${esc(r.actor.name)} : ${prixTxt(total(r.reste), true) || "plus rien"}.${r.sansFiche.length ? `<br><span class="flm-hint">Créé sans caractéristiques (absent des compendiums) : ${esc(r.sansFiche.join(", "))}.</span>` : ""}`);
      appMaj();
    } catch (err) { ui.notifications.warn(err.message); }
  } else {
    const res = await DV.prompt({ window: { title: "Accepter la vente" }, content: `<p>${esc(f.data.label)}</p><p>Prix proposé : <b>${prixTxt(f.data.prix, true)}</b>. Prix final, en pièces de cuivre :</p><input type="number" name="c" min="0" value="${f.data.prix}">`,
      ok: { label: "Payer le joueur", callback: (ev, btn) => Number(btn.form.elements.c.value) } }).catch(() => null);
    if (res == null) return;
    try {
      const r = await appliquerVente(f.data, res);
      await clore(msg, `<i class="fa-solid fa-check"></i> ${esc(r.actor.name)} vend ${esc(r.item)} pour ${prixTxt(res, true)}.`);
    } catch (err) { ui.notifications.warn(err.message); }
  }
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
const TABS_MJ = [["boutique", "Boutique"], ["tarifs", "Tous les prix"], ["lieux", "Lieux"], ["auberge", "Auberge"], ["vendre", "Vendre"], ["explications", "Explications"]];
const TABS_PJ = [["boutique", "Boutique"], ["tarifs", "Tous les prix"], ["vendre", "Vendre"], ["explications", "Explications"]];

class MarchandApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fl-marchand", classes: ["fl-marchand"], tag: "div",
    window: { title: "Le Marchand", icon: "fa-solid fa-scale-balanced", resizable: true },
    position: { width: 980, height: 720 }
  };
  tab = "boutique";
  cat = "";
  q = "";
  lieuVu = null;      // lieu choisi pour « Tous les prix » / « Lieux » (MJ)
  ouverts = new Set(); // explications dépliées
  panier = [];        // { tid, qte, vol }
  acheteur = null;
  vendeur = null;
  aub = { persos: null, nuit: "Chambre d'auberge, dortoir", repas: "Bol de ragoût", boisson: "Chope de bière", bain: false, nuits: 1, matin: true };

  get lieuBoutique() { const e = etat(); return e.ouvert ? e.lieux[e.ouvert] : null; }

  async _renderHTML() {
    if (game.user.isGM) await majStocks();
    const tabs = game.user.isGM ? TABS_MJ : TABS_PJ;
    if (!tabs.some(([id]) => id === this.tab)) this.tab = "boutique";
    const nav = tabs.map(([id, label]) => `<a class="flm-tab${this.tab === id ? " active" : ""}" data-tab="${id}"><span>${label}</span></a>`).join("");
    const sem = semaine();
    const body = { boutique: () => this.#boutique(), tarifs: () => this.#tarifs(), lieux: () => this.#lieux(), auberge: () => this.#auberge(), vendre: () => this.#vendre(), explications: () => this.#explications() }[this.tab]();
    return `<nav class="flm-nav">${nav}<span class="flm-week" title="La disponibilité des objets inhabituels et rares est tirée chaque semaine (Manuel p. 179)."><i class="fa-regular fa-calendar"></i> ${esc(sem.label)}</span></nav><section class="flm-body">${body}</section>`;
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
  #cats(liste) {
    const n = (id) => liste.filter((t) => t.cat === id).length;
    return `<div class="flm-cats"><a class="${!this.cat ? "active" : ""}" data-cat="">Tout</a>${CATEGORIES.filter(([id]) => n(id)).map(([id, label, icon]) =>
      `<a class="${this.cat === id ? "active" : ""}" data-cat="${id}"><i class="${icon}"></i> ${label}</a>`).join("")}</div>
      <input type="search" class="flm-find" placeholder="Chercher un objet…" value="${esc(this.q)}" data-q>`;
  }
  #explique(t, lieu, st, p) {
    const dispo = t.dispo ? `${DISPO[t.dispo]} (Manuel p. 179)` : "non précisée par le livre";
    return `<tr class="flm-why" data-k="why:${esc(t.id)}"><td colspan="5"><div>
      <ul>${p.lignes.map((l) => `<li>${esc(l.txt)} <span class="flm-src">${esc(l.src)}</span></li>`).join("")}
      ${p.lignes.length > 1 ? `<li><b>Prix ici : ${prixTxt(p.c, true)}</b></li>` : ""}</ul>
      <p><b>Disponibilité :</b> ${dispo}.${lieu ? ` ${esc(st.why ?? "")}` : ""}</p>
      ${t.etabs.length ? `<p><b>Où l'acheter :</b> ${t.etabs.map((x) => ETAB[x]).join(" ou ")} <span class="flm-src">réglage maison</span></p>` : ""}
      ${t.note ? `<p><b>Note du livre :</b> ${esc(t.note)}</p>` : ""}
      ${game.user.isGM && lieu ? `<p class="flm-ovr"><b>Ici :</b> ${[["", "selon les règles"], ["off", "retirer de la vente"], ["on", "toujours en vente"]].map(([v, l]) =>
        `<a data-ovr="${v}" data-ovr-t="${esc(t.id)}" data-ovr-l="${lieu.id}" class="${(lieu.ovr?.[t.id] ?? "") === v ? "active" : ""}">${l}</a>`).join(" · ")}</p>` : ""}</div></td></tr>`;
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
    return `<table class="flm-table"><thead><tr><th>Objet <span class="flm-hint">(cliquez pour le détail du prix)</span></th><th>Prix${lieu ? " ici" : ""}</th><th>Disponibilité</th><th>${lieu ? "Cette semaine" : ""}</th><th></th></tr></thead>
      <tbody>${liste.map((t) => this.#ligne(t, lieu, opts)).join("")}</tbody></table>`;
  }
  #persoSelect(path, valeur, liste = persos()) {
    if (!liste.length) return `<p class="flm-alert">Aucun personnage ${game.user.isGM ? "" : "à vous"}.</p>`;
    return `<select data-path="${path}">${liste.map((a) => `<option value="${a.id}" ${a.id === valeur ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
  }

  /* ---------------- onglets */
  #boutique() {
    const e = etat(); const lieu = this.lieuBoutique;
    const ouvrir = game.user.isGM ? `<label class="flm-inline">Échoppe ouverte aux joueurs : <select data-path="ouvert"><option value="">— aucune —</option>${e.ordre.map((id) => `<option value="${id}" ${e.ouvert === id ? "selected" : ""}>${esc(e.lieux[id]?.nom)}</option>`).join("")}</select></label>` : "";
    if (!lieu) return `<div class="flm-scroll"><div class="flm-empty"><img class="flm-raven" src="${SYS_ART}/ravens/raven3.webp" alt=""><h2>Aucune échoppe ouverte</h2>
      ${game.user.isGM ? `<p>Créez un lieu dans l'onglet <a data-tab="lieux">Lieux</a> (ou importez ceux de la campagne), puis ouvrez-le ici : les joueurs le verront chez eux.</p>${ouvrir}` : `<p>Le MJ n'a ouvert aucune échoppe pour le moment. Vous pouvez consulter <a data-tab="tarifs">tous les prix</a>.</p>`}</div></div>`;
    const dispo = this.#chercher(TARIFS.filter((t) => t.enBoutique && statut(t, lieu).ok));
    const indispo = TARIFS.filter((t) => t.enBoutique && !statut(t, lieu).ok).length;
    const liste = persos();
    if (!liste.some((a) => a.id === this.acheteur)) this.acheteur = (game.user.character && liste.includes(game.user.character) ? game.user.character.id : liste[0]?.id) ?? null;
    const acheteur = game.actors.get(this.acheteur);
    const vo = voieOr(acheteur);
    this.panier = this.panier.filter((l) => T.has(l.tid));
    const lignes = this.panier.map((l) => { const t = T.get(l.tid); return { ...l, t, p: prix(t, lieu, l.vol || 0) }; });
    const du = lignes.reduce((s, l) => s + l.p.c * l.qte, 0);
    const a = acheteur ? total(bourse(acheteur)) : 0;
    const panier = `<div class="flm-card flm-cart"><h3>Panier</h3>
      <p>Acheteur : ${this.#persoSelect("acheteur", this.acheteur, liste)}</p>
      ${acheteur ? `<p class="flm-hint">Bourse : ${prixTxt(a, true) || "vide"}${vo ? ` · Voie de l'or : jusqu'à 4 VOL par objet, −20 % chacun (Volonté : ${vol(acheteur)})` : ""}</p>` : ""}
      ${lignes.length ? `<table class="flm-table flm-cart-t">${lignes.map((l, i) => `<tr data-k="cart:${i}"><td>${esc(l.t.nom)}</td>
        <td><input type="number" min="1" max="${statut(l.t, lieu).qte ?? 99}" value="${l.qte}" data-cart-qte="${i}"></td>
        ${vo ? `<td><select data-cart-vol="${i}" title="Voie de l'or">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${n === (l.vol || 0) ? "selected" : ""}>${n ? `${n} VOL` : "VOL"}</option>`).join("")}</select></td>` : ""}
        <td class="flm-price">${prixTxt(l.p.c * l.qte)}</td><td><a data-cart-del="${i}" title="Retirer"><i class="fa-solid fa-xmark"></i></a></td></tr>`).join("")}</table>
        <p class="flm-total">Total : ${prixTxt(du, true)}</p>
        ${a < du ? `<p class="flm-alert">Pas assez d'argent.</p>` : ""}
        <button type="button" data-act="acheter" ${!acheteur || a < du ? "disabled" : ""}><i class="fa-solid fa-coins"></i> ${game.user.isGM ? "Encaisser" : "Demander au MJ"}</button>`
      : `<p class="flm-hint">Cliquez sur <i class="fa-solid fa-plus"></i> pour ajouter un objet.</p>`}</div>`;
    return `<div class="flm-split"><div class="flm-scroll">
      <div class="flm-head"><h2>${esc(lieu.nom)}</h2>${ouvrir}
        <p class="flm-sub">${this.#lieuResume(lieu)}</p>
        ${indispo ? `<p class="flm-hint flm-center">${indispo} objets ne sont pas en vente ici cette semaine : voir <a data-tab="tarifs" data-lieu-voir="${lieu.id}">tous les prix</a> pour savoir pourquoi.</p>` : ""}</div>
      ${this.#cats(dispo.length || this.cat ? TARIFS.filter((t) => t.enBoutique && statut(t, lieu).ok) : [])}
      ${this.#table(dispo, lieu, { achat: true })}</div>
      <div class="flm-side">${panier}</div></div>`;
  }
  #lieuResume(l) {
    const et = ETABS.filter(([id]) => l.etabs?.[id]).map(([, label]) => label);
    const f = (l.facteurs ?? []).filter((x) => Number(x.pct)).map((x) => `${x.id === "perso" ? (x.texte || "autre") : x.id === "specialite" ? `spécialité : ${CAT[x.cat] ?? "?"}` : FACT[x.id]?.label.toLowerCase()} ${x.pct > 0 ? "+" : ""}${x.pct} %`);
    return `${esc(l.taille || "")}${et.length ? ` · ${esc(et.join(", "))}` : " · aucun établissement"}${f.length ? ` · prix : ${esc(f.join(", "))}` : ""}`;
  }
  #tarifs() {
    const e = etat();
    const lieu = this.lieuVu ? e.lieux[this.lieuVu] : null;
    const ids = game.user.isGM ? e.ordre : (e.ouvert ? [e.ouvert] : []);
    if (this.lieuVu && !ids.includes(this.lieuVu)) this.lieuVu = null;
    const choix = `<label class="flm-inline">Prix : <select data-path="lieuVu"><option value="">du livre (référence)</option>${ids.map((id) => `<option value="${id}" ${this.lieuVu === id ? "selected" : ""}>à ${esc(e.lieux[id]?.nom)}</option>`).join("")}</select></label>`;
    const liste = this.#chercher(TARIFS);
    return `<div class="flm-scroll"><div class="flm-head"><h2>Tous les prix</h2>${choix}
      <p class="flm-sub">${lieu ? this.#lieuResume(lieu) : "Prix moyens du Manuel du joueur, p. 179 à 195. 1 o = 10 a = 100 c."}</p></div>
      ${this.#cats(TARIFS)}${this.#table(liste, lieu)}</div>`;
  }
  #lieux() {
    const e = etat(); const sem = semaine();
    if (this.lieuVu && !e.lieux[this.lieuVu]) this.lieuVu = null;
    this.lieuVu ??= e.ordre[0] ?? null;
    const campagne = game.modules.get("fl-campagne")?.active && (game.settings.get("fl-campagne", "contenu")?.sites ?? []).length;
    const liste = e.ordre.map((id) => { const l = e.lieux[id]; return `<a class="flm-lieu${this.lieuVu === id ? " active" : ""}" data-lieu="${id}">
      <b>${esc(l.nom)}</b>${e.ouvert === id ? ` <span class="flm-tag">ouvert</span>` : ""}<br><span class="flm-hint">${esc(l.taille || "")}</span></a>`; }).join("");
    const l = this.lieuVu ? e.lieux[this.lieuVu] : null;
    const fiche = l ? `<div class="flm-card" data-k="fiche:${l.id}">
      <p><label>Nom <input type="text" data-path="l.nom" value="${esc(l.nom)}"></label>
        <label>Taille <select data-path="l.taille">${["Avant-poste", "Hameau", "Village", "Château ou forteresse", "Ville", "Camp", "Autre"].map((x) => `<option ${l.taille === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></p>
      ${l.suggere ? `<p class="flm-alert"><i class="fa-solid fa-circle-info"></i> Établissements devinés d'après les lieux du livre : vérifiez-les.</p>` : ""}
      <h4>Ce qu'on y trouve</h4>
      <div class="flm-etabs">${ETABS.map(([id, label, aide]) => `<label title="${esc(aide)}"><input type="checkbox" data-etab="${id}" ${l.etabs?.[id] ? "checked" : ""}> ${label}<span class="flm-hint">${esc(aide)}</span></label>`).join("")}</div>
      <p class="flm-hint">Le Guide du MJ (p. 170) tire les établissements d'un village : avant-poste 1 jet, hameau 3, village 1d6+5. Ce qui manque ici n'est pas en vente.</p>
      <h4>Pourquoi les prix changent ici <span class="flm-src">réglage maison</span></h4>
      ${(l.facteurs ?? []).map((f, i) => `<div class="flm-fact" data-k="f:${i}">
        <select data-fact="${i}" data-champ="id">${FACTEURS.map(([id, label]) => `<option value="${id}" ${f.id === id ? "selected" : ""}>${label}</option>`).join("")}</select>
        ${f.id === "specialite" ? `<select data-fact="${i}" data-champ="cat">${CATEGORIES.map(([id, label]) => `<option value="${id}" ${f.cat === id ? "selected" : ""}>${label}</option>`).join("")}</select>` : ""}
        ${f.id === "perso" ? `<input type="text" placeholder="Raison" data-fact="${i}" data-champ="texte" value="${esc(f.texte ?? "")}">` : ""}
        <input type="number" step="5" data-fact="${i}" data-champ="pct" value="${Number(f.pct) || 0}"> %
        <a data-fact-del="${i}" title="Retirer"><i class="fa-solid fa-trash"></i></a></div>`).join("") || `<p class="flm-hint">Prix du livre, sans changement.</p>`}
      <button type="button" data-act="fact-add"><i class="fa-solid fa-plus"></i> Ajouter une raison</button>
      <h4>Stock de la semaine</h4>
      <p class="flm-hint">${sem.auto ? `Suit le calendrier : ${esc(sem.label)}. Les objets inhabituels et rares sont retirés au changement de semaine.` : `Sans le module Le Temps des Contrées, c'est vous qui passez à la semaine suivante.`}</p>
      <p><button type="button" data-act="relancer"><i class="fa-solid fa-dice"></i> Relancer le stock</button>
        ${sem.auto ? "" : `<button type="button" data-act="semaine"><i class="fa-solid fa-forward"></i> Semaine suivante (tous les lieux)</button>`}
        <button type="button" data-act="ouvrir"><i class="fa-solid fa-store"></i> ${e.ouvert === l.id ? "Fermer l'échoppe" : "Ouvrir aux joueurs"}</button></p>
      <h4>Notes</h4><textarea data-path="l.notes" rows="3" placeholder="Le marchand, ses habitudes…">${esc(l.notes ?? "")}</textarea>
      <p class="flm-right"><a data-act="suppr" class="flm-danger"><i class="fa-solid fa-trash"></i> Supprimer ce lieu</a></p></div>` : `<p class="flm-hint">Créez un premier lieu.</p>`;
    return `<div class="flm-split flm-split-l"><div class="flm-scroll flm-list">${liste}
      <button type="button" data-act="lieu-add"><i class="fa-solid fa-plus"></i> Nouveau lieu</button>
      ${campagne ? `<button type="button" data-act="import-campagne" title="Crée un lieu pour chaque village et château de fl-campagne"><i class="fa-solid fa-feather"></i> Lieux de la campagne</button>` : ""}</div>
      <div class="flm-scroll">${fiche}</div></div>`;
  }
  #auberge() {
    const e = etat(); const lieu = this.lieuBoutique ?? (this.lieuVu ? e.lieux[this.lieuVu] : null);
    const liste = persos();
    this.aub.persos ??= liste.filter((a) => a.hasPlayerOwner).map((a) => a.id);
    const choix = (path, cat, noms, vide) => `<select data-aub="${path}"><option value="">${vide}</option>${noms.map((n) => { const t = T.get(`${cat}:${n}`); const st = statut(t, lieu);
      return `<option value="${esc(n)}" ${this.aub[path] === n ? "selected" : ""}>${esc(n)} — ${prixTxt(prix(t, lieu).c)}${st.ok ? "" : " (indisponible)"}</option>`; }).join("")}</select>`;
    const items = [[this.aub.nuit, "auberge"], [this.aub.repas, "auberge"], [this.aub.boisson, "auberge"], [this.aub.bain ? "Bain dans une auberge" : "", "auberge"]].filter(([n]) => n).map(([n, c]) => T.get(`${c}:${n}`));
    const n = Math.max(1, Number(this.aub.nuits) || 1);
    const parPers = items.reduce((s, t) => s + prix(t, lieu).c, 0) * n;
    const pb = items.filter((t) => !statut(t, lieu).ok).map((t) => `${t.nom} : ${statut(t, lieu).why}`);
    return `<div class="flm-scroll"><div class="flm-head"><h2>Une nuit à l'auberge</h2>
      <p class="flm-sub">Lieu : ${lieu ? `<b>${esc(lieu.nom)}</b> (l'échoppe ouverte, sinon le lieu choisi dans « Lieux »)` : "aucun : prix du livre"}</p></div>
      <div class="flm-board"><div class="flm-card"><h3>Pour chacun</h3>
        <p>Couchage : ${choix("nuit", "auberge", ["Chambre d'auberge, dortoir", "Chambre d'auberge individuelle", "Résidence luxueuse"], "pas de chambre")}</p>
        <p>Repas : ${choix("repas", "auberge", ["Bol de ragoût", "Repas copieux", "Festin"], "pas de repas")}</p>
        <p>Boisson : ${choix("boisson", "auberge", ["Chope de bière", "Coupe de vin"], "pas de boisson")}</p>
        <p><label><input type="checkbox" data-aub="bain" ${this.aub.bain ? "checked" : ""}> Un bain</label>
          <label>Nuits <input type="number" min="1" max="30" data-aub="nuits" value="${n}"></label></p>
        <p class="flm-hint">Ragoût : couvre la nourriture du jour. Repas copieux et festin : la nourriture et l'eau. Bière ou vin : l'eau (Manuel p. 180).</p>
        ${game.modules.get("fl-temps")?.active ? `<p><label><input type="checkbox" data-aub="matin" ${this.aub.matin ? "checked" : ""}> Avancer le temps jusqu'au Matin</label></p>` : ""}</div>
      <div class="flm-card"><h3>Le groupe</h3>
        ${liste.map((a) => { const t = total(bourse(a)); return `<label class="flm-pc"><input type="checkbox" data-aub-pc="${a.id}" ${this.aub.persos.includes(a.id) ? "checked" : ""}> ${esc(a.name)} <span class="flm-hint">${prixTxt(t) || "bourse vide"}${t < parPers ? " — pas assez" : ""}</span></label>`; }).join("") || `<p class="flm-hint">Aucun personnage de joueur.</p>`}
        <p class="flm-total">${prixTxt(parPers, true) || "Rien"} par personne${this.aub.persos.length > 1 ? `, ${prixTxt(parPers * this.aub.persos.length, true)} en tout` : ""}</p>
        ${pb.length ? `<p class="flm-alert">${pb.map(esc).join("<br>")}</p>` : ""}
        <button type="button" data-act="auberge" ${parPers ? "" : "disabled"}><i class="fa-solid fa-bed"></i> Faire payer et dormir</button></div></div></div>`;
  }
  #vendre() {
    const liste = persos();
    if (!liste.some((a) => a.id === this.vendeur)) this.vendeur = (game.user.character && liste.includes(game.user.character) ? game.user.character.id : liste[0]?.id) ?? null;
    const a = game.actors.get(this.vendeur);
    const R = regles();
    const objets = a ? a.items.filter((i) => ["gear", "weapon", "armor", "rawMaterial"].includes(i.type)) : [];
    const rows = objets.map((i) => { const est = estimer(i); return `<tr data-k="v:${i.id}"><td>${esc(i.name)}${(Number(i.system.quantity) || 1) > 1 ? ` <span class="flm-hint">× ${i.system.quantity}</span>` : ""}</td>
      <td class="flm-price">${est.base != null ? prixTxt(est.base) : "—"}</td><td class="flm-price"><b>${est.offre != null ? prixTxt(est.offre) : "à fixer"}</b></td>
      <td class="flm-hint">${esc(est.src)}</td><td><button type="button" data-vendre="${i.id}"><i class="fa-solid fa-hand-holding-dollar"></i> ${game.user.isGM ? "Vendre" : "Proposer"}</button></td></tr>`; }).join("");
    return `<div class="flm-scroll"><div class="flm-head"><h2>Vendre un objet</h2>
      <p class="flm-sub">Le livre ne donne pas de prix de revente : par défaut, le marchand propose ${R.revente} % du prix du livre (réglage maison, dans « Explications »). Le MJ peut toujours changer le prix.</p>
      <p class="flm-center">Vendeur : ${this.#persoSelect("vendeur", this.vendeur, liste)}</p></div>
      ${objets.length ? `<table class="flm-table"><thead><tr><th>Objet</th><th>Prix de base</th><th>Offre du marchand</th><th>D'où vient le prix</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="flm-hint flm-center">Rien à vendre.</p>`}</div>`;
  }
  #explications() {
    const R = regles(); const gm = game.user.isGM;
    const num = (k) => gm ? `<input type="number" step="5" data-regle="${k}" value="${R[k]}"> %` : `<b>${R[k]} %</b>`;
    return `<div class="flm-scroll flm-text">
      <h2>Comment marchent les prix</h2>
      <div class="flm-board">
      <div class="flm-card"><h3>Ce que dit le livre</h3><ul>
        <li><b>Monnaie</b> : 10 pièces de cuivre valent 1 pièce d'argent, 10 pièces d'argent valent 1 pièce d'or. On frappe peu de pièces dans les Contrées Interdites et l'on troque beaucoup (Manuel p. 37).</li>
        <li><b>Prix</b> : ceux des tableaux sont des prix moyens. Ils peuvent beaucoup changer d'un village à l'autre et selon la disponibilité (Manuel p. 104 et 180).</li>
        <li><b>Courant</b> : en vente en quantité raisonnable dans un village typique.</li>
        <li><b>Inhabituel</b> : 1d6 chaque semaine ; sur 4 ou plus, on peut en acheter 1d6 lots.</li>
        <li><b>Rare</b> : 1d6 chaque semaine ; sur un 6, il y en a un seul exemplaire (Manuel p. 179).</li>
        <li><b>Voie de l'or</b> (talent) : chaque point de Volonté dépensé baisse le prix d'un objet de 20 %, jusqu'à 4 points (Manuel p. 66).</li>
        <li><b>Établissements</b> : un avant-poste, un hameau ou un village n'a pas tout. Le Guide du MJ (p. 170) les tire : auberge, moulin, forgeron, scierie, comptoir, temple, milice, taverne, écurie… ou rien.</li></ul></div>
      <div class="flm-card"><h3>Ce qui est maison</h3>
        <p>Le livre ne chiffre pas les écarts de prix. Le module propose ces réglages, à votre goût :</p><ul>
        <li><label><input type="checkbox" data-regle="rarete" ${R.rarete ? "checked" : ""} ${gm ? "" : "disabled"}> Plus cher quand c'est moins courant</label> : inhabituel ${num("I")}, rare ${num("R")}.</li>
        <li>Offre du marchand quand on lui vend un objet : ${num("revente")} du prix du livre.</li>
        <li>Les <b>raisons propres à chaque lieu</b> (isolé, pénurie, abondance…), réglées dans l'onglet Lieux. Les valeurs proposées sont des points de départ.</li>
        <li><b>Qui vend quoi</b> : armes, armures et outils chez le forgeron, chambres à l'auberge, repas à l'auberge ou à la taverne, chevaux à l'écurie, farine au moulin, bois à la scierie, bateaux au port, le reste au marché ou au comptoir.</li>
        <li>Chaque prix affiche son détail : cliquez sur le nom d'un objet.</li></ul></div>
      <div class="flm-card"><h3>Pour jouer</h3><ul>
        <li>Le MJ crée les lieux (ou les importe de la campagne), coche ce qu'on y trouve, puis ouvre l'échoppe aux joueurs.</li>
        <li>Les joueurs ouvrent le Marchand (Alt+M ou le bouton <i class="fa-solid fa-scale-balanced"></i> des notes), remplissent leur panier et demandent l'achat.</li>
        <li>Le MJ reçoit la demande dans le tchat, peut changer le prix final (marchandage), puis accepte : l'argent est retiré, la monnaie rendue et les objets ajoutés à la fiche.</li>
        <li>À l'auberge, le MJ fait payer tout le groupe d'un clic.</li></ul></div></div></div>`;
  }

  /* ---------------- actions */
  async #click(ev) {
    const t = ev.target.closest("[data-ovr],[data-tab],[data-cat],[data-why],[data-add],[data-cart-del],[data-act],[data-lieu],[data-fact-del],[data-vendre]");
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.ovr != null) {
      const e = etat(); const l = e.lieux[d.ovrL]; if (!l || !game.user.isGM) return;
      l.ovr ??= {}; if (d.ovr) l.ovr[d.ovrT] = d.ovr; else delete l.ovr[d.ovrT];
      await saveEtat(e); return this.render();
    }
    if (d.tab) { this.tab = d.tab; if (d.lieuVoir) this.lieuVu = d.lieuVoir; return this.render(); }
    if (d.cat != null) { this.cat = d.cat; return this.render(); }
    if (d.why) { this.ouverts.has(d.why) ? this.ouverts.delete(d.why) : this.ouverts.add(d.why); return this.render(); }
    if (d.add) {
      const ex = this.panier.find((l) => l.tid === d.add);
      const max = statut(T.get(d.add), this.lieuBoutique).qte ?? 99;
      if (ex) ex.qte = Math.min(max, ex.qte + 1); else this.panier.push({ tid: d.add, qte: 1, vol: 0 });
      replay(t, "flm-pop");
      return this.render();
    }
    if (d.cartDel != null) { this.panier.splice(Number(d.cartDel), 1); return this.render(); }
    if (d.lieu) { this.lieuVu = d.lieu; return this.render(); }
    if (d.factDel != null) return this.#majLieu((l) => l.facteurs.splice(Number(d.factDel), 1));
    if (d.vendre) return this.#vendreObjet(d.vendre);
    switch (d.act) {
      case "acheter": return this.#acheter();
      case "lieu-add": return this.#nouveauLieu();
      case "import-campagne": return this.#importCampagne();
      case "fact-add": return this.#majLieu((l) => (l.facteurs ??= []).push({ id: "isole", pct: FACT.isole.pct }));
      case "relancer": return this.#majLieu((l) => tirerStock(l, semaine().cle));
      case "semaine": { const e = etat(); e.semaine = (e.semaine ?? 0) + 1; await saveEtat(e); await majStocks({ tous: true }); return this.render(); }
      case "ouvrir": return this.#ouvrir(etat().ouvert === this.lieuVu ? null : this.lieuVu);
      case "suppr": {
        const e = etat(); const l = e.lieux[this.lieuVu]; if (!l) return;
        const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer le lieu" }, content: `<p>Supprimer « ${esc(l.nom)} » ?</p>` });
        if (!ok) return;
        delete e.lieux[l.id]; e.ordre = e.ordre.filter((x) => x !== l.id); if (e.ouvert === l.id) e.ouvert = null;
        this.lieuVu = null; await saveEtat(e); return this.render();
      }
      case "auberge": return this.#payerAuberge();
    }
  }
  async #change(ev) {
    const el = ev.target; const d = el.dataset;
    const val = el.type === "checkbox" ? el.checked : el.value;
    if (d.path === "acheteur") { this.acheteur = val; return this.render(); }
    if (d.path === "vendeur") { this.vendeur = val; return this.render(); }
    if (d.path === "lieuVu") { this.lieuVu = val || null; return this.render(); }
    if (d.path === "ouvert") return this.#ouvrir(val || null);
    if (d.path?.startsWith("l.")) return this.#majLieu((l) => { l[d.path.slice(2)] = val; });
    if (d.etab) return this.#majLieu((l) => { (l.etabs ??= {})[d.etab] = val; delete l.suggere; });
    if (d.fact != null) return this.#majLieu((l) => {
      const f = l.facteurs[Number(d.fact)]; if (!f) return;
      if (d.champ === "pct") f.pct = Number(val) || 0;
      else if (d.champ === "id") { f.id = val; f.pct = FACT[val]?.pct ?? 0; if (val === "specialite") f.cat ??= "auberge"; }
      else f[d.champ] = val;
    });
    if (d.cartQte != null) { const l = this.panier[Number(d.cartQte)]; if (l) l.qte = Math.max(1, Math.min(Number(el.max) || 99, Number(val) || 1)); return this.render(); }
    if (d.cartVol != null) { const l = this.panier[Number(d.cartVol)]; if (l) l.vol = Number(val) || 0; return this.render(); }
    if (d.regle && game.user.isGM) { const R = regles(); R[d.regle] = d.regle === "rarete" ? val : Number(val) || 0; await game.settings.set(MOD, "regles", R); return; }
    if (d.aub) { this.aub[d.aub] = el.type === "checkbox" ? val : d.aub === "nuits" ? Number(val) || 1 : val; return this.render(); }
    if (d.aubPc) { const s = new Set(this.aub.persos ?? []); val ? s.add(d.aubPc) : s.delete(d.aubPc); this.aub.persos = [...s]; return this.render(); }
  }
  async #majLieu(fn) {
    if (!game.user.isGM) return;
    const e = etat(); const l = e.lieux[this.lieuVu]; if (!l) return;
    fn(l); await saveEtat(e); this.render();
  }
  async #nouveauLieu() {
    const e = etat(); const id = rid();
    e.lieux[id] = { id, nom: "Nouveau lieu", taille: "Village", etabs: { marche: true, auberge: true, forgeron: true }, facteurs: [], notes: "", ovr: {} };
    e.ordre.push(id); tirerStock(e.lieux[id], semaine().cle);
    this.lieuVu = id; await saveEtat(e); this.render();
  }
  async #importCampagne() {
    const sites = game.settings.get("fl-campagne", "contenu")?.sites ?? [];
    const e = etat(); const cle = semaine().cle; let n = 0;
    const guess = [[/auberge/, "auberge"], [/taverne|brasserie/, "taverne"], [/forge|armurerie/, "forgeron"], [/moulin/, "moulin"], [/scierie/, "scierie"],
      [/chapelle|temple|infirmerie/, "temple"], [/march|guilde|comptoir|place/, "marche"], [/ecurie|etable|chevaux/, "ecurie"], [/port|embarcadere|pecheur/, "port"], [/garde|baraquement|caserne|milice/, "milice"]];
    for (const s of sites) {
      const si = s.site ?? s; if (!["village", "château", "chateau"].includes(si.categorie)) continue;
      if (e.ordre.some((id) => e.lieux[id]?.campagne === si.id)) continue;
      const etabs = {};
      for (const lx of si.lieux ?? []) { const t = norm(lx.titre ?? lx.nom); for (const [re, k] of guess) if (re.test(t)) etabs[k] = true; }
      if (si.categorie === "village") etabs.marche = true;
      const id = rid();
      e.lieux[id] = { id, nom: si.nom, taille: si.categorie === "village" ? "Village" : "Château ou forteresse", etabs, facteurs: [], notes: "", ovr: {}, campagne: si.id, suggere: true };
      tirerStock(e.lieux[id], cle); e.ordre.push(id); n++;
    }
    await saveEtat(e);
    ui.notifications.info(n ? `${n} lieu(x) créé(s) d'après la campagne. Vérifiez les établissements cochés.` : "Tous les lieux de la campagne existent déjà.");
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
    const lignes = this.panier.map((l) => ({ tid: l.tid, qte: l.qte, vol: voieOr(actor) ? l.vol || 0 : 0, prix: Math.round(prix(T.get(l.tid), lieu, voieOr(actor) ? l.vol || 0 : 0).c) }));
    for (const l of lignes) { const st = statut(T.get(l.tid), lieu); if (!st.ok || (st.qte != null && l.qte > st.qte)) return ui.notifications.warn(`${T.get(l.tid).nom} : ${st.why ?? "plus assez en stock"}`); }
    const data = { actorId: actor.id, lignes, lieuId: lieu.id };
    if (game.user.isGM) {
      try {
        const r = await appliquerAchat(data);
        ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-coins"></i> ${esc(actor.name)} achète</h3><p>${resume(lignes)}</p><p>Total : <b>${prixTxt(r.du, true)}</b> à ${esc(lieu.nom)}.</p>${r.sansFiche.length ? `<p class="flm-hint">Créé sans caractéristiques : ${esc(r.sansFiche.join(", "))}.</p>` : ""}</div>`, speaker: ChatMessage.getSpeaker({ actor }) });
      } catch (err) { return ui.notifications.warn(err.message); }
    } else {
      const du = lignes.reduce((s, l) => s + l.prix * l.qte, 0);
      await demander("achat", data, `<p><b>${esc(actor.name)}</b> à ${esc(lieu.nom)} :</p><p>${resume(lignes)}</p><p>Total : <b>${prixTxt(du, true)}</b></p>`);
      ui.notifications.info("Demande envoyée au MJ.");
    }
    this.panier = []; this.render();
  }
  async #vendreObjet(itemId) {
    const actor = game.actors.get(this.vendeur); const item = actor?.items.get(itemId); if (!item) return;
    const est = estimer(item);
    const q = Number(item.system.quantity) || 1;
    const DV = foundry.applications.api.DialogV2;
    const res = await DV.prompt({ window: { title: `Vendre : ${item.name}` }, content: `<p>${esc(est.src)}</p>
      ${q > 1 ? `<p><label>Quantité <input type="number" name="q" min="1" max="${q}" value="1"></label></p>` : ""}
      <p><label>Prix ${q > 1 ? "unitaire " : ""}demandé, en pièces de cuivre <input type="number" name="c" min="0" value="${est.offre ?? 0}"></label></p>`,
      ok: { label: game.user.isGM ? "Vendre" : "Proposer au MJ", callback: (e, btn) => ({ q: Number(btn.form.elements.q?.value) || 1, c: Number(btn.form.elements.c.value) || 0 }) } }).catch(() => null);
    if (!res) return;
    const qte = Math.max(1, Math.min(q, res.q)); const prixTot = res.c * qte;
    const data = { actorId: actor.id, itemId, qte, prix: prixTot, label: `${actor.name} vend ${qte > 1 ? `${qte} × ` : ""}${item.name}` };
    if (game.user.isGM) {
      try { const r = await appliquerVente(data, prixTot); ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-hand-holding-dollar"></i> Vente</h3><p>${esc(r.actor.name)} vend ${esc(r.item)} pour <b>${prixTxt(prixTot, true)}</b>.</p></div>`, speaker: ChatMessage.getSpeaker({ actor }) }); }
      catch (err) { ui.notifications.warn(err.message); }
    } else { await demander("vente", data, `<p>${esc(data.label)}</p><p>Prix demandé : <b>${prixTxt(prixTot, true)}</b></p>`); ui.notifications.info("Proposition envoyée au MJ."); }
    this.render();
  }
  async #payerAuberge() {
    const e = etat(); const lieu = this.lieuBoutique ?? (this.lieuVu ? e.lieux[this.lieuVu] : null);
    const items = [this.aub.nuit, this.aub.repas, this.aub.boisson, this.aub.bain ? "Bain dans une auberge" : ""].filter(Boolean).map((n) => T.get(`auberge:${n}`));
    const n = Math.max(1, Number(this.aub.nuits) || 1);
    const parPers = items.reduce((s, t) => s + prix(t, lieu).c, 0) * n;
    const ok = [], ko = [];
    for (const id of this.aub.persos ?? []) {
      const a = game.actors.get(id); if (!a) continue;
      const b = payer(bourse(a), parPers);
      if (!b) { ko.push(a.name); continue; }
      await majBourse(a, b); ok.push(a.name);
    }
    if (!ok.length && !ko.length) return;
    ChatMessage.create({ content: `<div class="flm-chat"><h3><i class="fa-solid fa-bed"></i> ${lieu ? esc(lieu.nom) : "L'auberge"}</h3>
      <p>${esc(items.map((t) => t.nom).join(", "))}${n > 1 ? `, ${n} nuits` : ""} : <b>${prixTxt(parPers, true)}</b> chacun.</p>
      ${ok.length ? `<p>Ont payé : ${esc(ok.join(", "))}.</p>` : ""}${ko.length ? `<p class="flm-alert">Pas assez d'argent : ${esc(ko.join(", "))}.</p>` : ""}</div>` });
    if (this.aub.matin && ok.length && this.aub.nuit && globalThis.FLTemps?.goToQuarter) { try { await globalThis.FLTemps.goToQuarter(0); } catch { /* */ } }
    this.render();
  }
}

/** Prix d'un objet de la fiche : tarif du livre si le nom correspond, sinon le coût écrit sur l'objet. */
function estimer(item) {
  const R = regles(); const n = norm(item.name);
  const t = TARIFS.find((x) => norm(x.nom) === n) ?? TARIFS.find((x) => x.objet && n.length > 3 && (norm(x.nom).startsWith(n) || n.startsWith(norm(x.nom))));
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
  game.settings.register(MOD, "regles", { scope: "world", config: false, type: Object, default: {}, onChange: () => appMaj() });
  game.keybindings.register(MOD, "open", { name: "Ouvrir le Marchand", editable: [{ key: "KeyM", modifiers: ["Alt"] }], onDown: () => { open(); return true; } });
});
Hooks.once("ready", () => { globalThis.FLMarchand = { open, prix: (nom) => TARIFS.find((t) => norm(t.nom) === norm(nom)) }; });

Hooks.on("getSceneControlButtons", (controls) => {
  const notes = controls.notes ?? controls.journal;
  if (!notes?.tools) return;
  notes.tools["fl-marchand"] = { name: "fl-marchand", title: "Le Marchand (Alt/⌥+M)", icon: "fa-solid fa-scale-balanced", button: true, onChange: () => open(), order: 100 };
});

// Le calendrier avance : le MJ actif tire le stock de la nouvelle semaine.
Hooks.on("updateWorldTime", () => { clearTimeout(globalThis.__flmT); globalThis.__flmT = setTimeout(() => majStocks().then((c) => c && appMaj()), 800); });

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
