// Forbidden Lands – Le Danger
// Estime la dangerosité d'une rencontre pour le groupe en simulant des centaines de combats, et propose des rencontres
// tirées des compendiums (monstres et PNJ), classées Facile / Tendu / Dangereux / Mortel.
import { estimer, niveau, NIVEAUX } from "./sim.mjs";

const MOD = "fl-danger";
const SYS_ART = "systems/forbidden-lands/assets/journal-art";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pct = (x) => `${Math.round(x * 100)} %`;
const pause = () => new Promise((r) => setTimeout(r, 0));
const N_TEST = 400, N_SUGG = 150;

/* ------------------------------------------------------------------ profils de combat lus sur les fiches */
const val = (o) => Number(o?.value) || 0;
function profilPersonnage(a, { pnj = false } = {}) {
  const s = a.system ?? {};
  const armes = a.items.filter((i) => i.type === "weapon");
  const offensives = armes.filter((w) => !w.system?.features?.shield);
  const note = (w) => (Number(w.system?.bonus?.value) || 0) + 1.5 * (Number(w.system?.damage) || 0);
  const best = offensives.sort((x, y) => note(y) - note(x))[0];
  const arme = best ? { nom: best.name, bonus: Number(best.system?.bonus?.value) || 0, degats: Number(best.system?.damage) || 1, distance: best.system?.category === "ranged" } : { nom: "mains nues", bonus: 0, degats: 1, distance: false };
  const bouclier = armes.filter((w) => w.system?.features?.shield).reduce((m, w) => Math.max(m, Number(w.system?.bonus?.value) || 0), -1);
  const parade = bouclier >= 0 ? bouclier : best?.system?.features?.parrying ? arme.bonus : null;
  const parts = {};
  for (const i of a.items.filter((x) => x.type === "armor")) { const p = i.system?.part || "body"; parts[p] = Math.max(parts[p] ?? 0, Number(i.system?.bonus?.value) || 0); }
  const armure = Object.values(parts).reduce((x, y) => x + y, 0);
  return { id: a.id, nom: a.name, img: a.img, pnj, F: val(s.attribute?.strength), A: val(s.attribute?.agility), E: val(s.attribute?.wits),
    melee: val(s.skill?.melee), tir: val(s.skill?.marksmanship), move: val(s.skill?.move), arme, parade, armure };
}
function profilMonstre(a) {
  const s = a.system ?? {};
  const attaques = a.items.filter((i) => i.type === "monsterAttack").map((i) => ({ nom: i.name, des: Number(i.system?.dice) || 0, degats: Number(i.system?.damage) || 0, peur: i.system?.damageType === "fear", force: !!i.system?.usingStrength }));
  return { id: a.id, nom: a.name, img: a.img, monstre: true, F: val(s.attribute?.strength), A: val(s.attribute?.agility) || 1, E: val(s.attribute?.wits) || 1, armure: Number(s.armor?.value) || 0, attaques, actions: 1 };
}
const profil = (a) => (a.type === "monster" ? profilMonstre(a) : profilPersonnage(a, { pnj: true }));
const valide = (p) => p.F > 0 && (p.monstre ? p.attaques.length > 0 : true);

/** Le groupe : membres de l'acteur « Groupe » et personnages des joueurs. */
function groupe() {
  const membres = new Set(game.actors.filter((a) => a.type === "party").flatMap((p) => p.system?.members ?? []));
  return game.actors.filter((a) => a.type === "character" && !a.getFlag?.("fl-marchand", "garde") && a.system?.subtype?.type !== "npc" && (membres.has(a.id) || a.hasPlayerOwner))
    .sort((x, y) => x.name.localeCompare(y.name));
}
/** Les gardes du corps engagés (fl-marchand) peuvent se battre aux côtés du groupe. */
const allies = () => game.actors.filter((a) => a.getFlag?.("fl-marchand", "garde"));

/* ------------------------------------------------------------------ catalogue des adversaires */
let CATALOGUE = null;
async function catalogue(force = false) {
  if (CATALOGUE && !force) return CATALOGUE;
  const vus = new Map();
  const ajouter = (a, source, uuid) => {
    if (!["monster", "character"].includes(a.type) || a.getFlag?.("fl-marchand", "garde") || a.hasPlayerOwner) return;
    if (a.type === "character" && a.system?.subtype?.type !== "npc" && source === "Monde") return; // dans le monde : seulement les vrais PNJ
    const p = profil(a); if (!valide(p)) return;
    const cle = norm(a.name); if (vus.has(cle)) return;
    vus.set(cle, { ...p, uuid, source, type: a.type === "monster" ? "monstre" : "humanoide" });
  };
  for (const pack of game.packs.filter((p) => p.documentName === "Actor" && !p.collection.includes("fl-marchand-gardes"))) {
    try { for (const a of await pack.getDocuments()) ajouter(a, pack.metadata?.label ?? pack.collection, a.uuid); } catch (err) { console.warn("fl-danger | compendium illisible", pack.collection, err); }
  }
  for (const a of game.actors) ajouter(a, "Monde", a.uuid);
  CATALOGUE = [...vus.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  return CATALOGUE;
}

/* ------------------------------------------------------------------ placer sur la scène */
async function placer(uuid, n) {
  if (!canvas?.scene) return ui.notifications.warn("Ouvrez d'abord une scène.");
  let actor = await fromUuid(uuid);
  if (!actor) return;
  if (actor.pack) {
    const deja = game.actors.find((a) => a.getFlag?.(MOD, "source") === uuid);
    if (deja) actor = deja;
    else {
      const folder = (game.folders.find((f) => f.type === "Actor" && f.name === "Rencontres") ?? await Folder.create({ name: "Rencontres", type: "Actor" }))?.id;
      actor = await Actor.create({ ...actor.toObject(), folder, flags: { ...(actor.toObject().flags ?? {}), [MOD]: { source: uuid } } });
    }
  }
  const g = canvas.grid.size; const c = canvas.stage.pivot;
  const toks = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2, r = n > 1 ? g * (1 + Math.floor(i / 8)) : 0;
    const td = await actor.getTokenDocument({ x: Math.round((c.x + Math.cos(ang) * r) / g) * g, y: Math.round((c.y + Math.sin(ang) * r) / g) * g, hidden: true });
    toks.push(td.toObject());
  }
  await canvas.scene.createEmbeddedDocuments("Token", toks);
  ui.notifications.info(`${n} × ${actor.name} placé${n > 1 ? "s" : ""} sur la scène (cachés : révélez-les quand vous voulez).`);
}

/* ------------------------------------------------------------------ rendu sans clignotement (repris de fl-campagne) */
function morphKey(n) { if (n.nodeType !== 1) return null; for (const a of ["data-k", "data-tab", "data-path"]) { const v = n.getAttribute(a); if (v != null) return `${n.tagName}|${a}|${v}`; } return null; }
const sameKind = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName);
function morphNode(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  const focused = from === document.activeElement;
  if (from.tagName === "INPUT") {
    if (from.type === "checkbox") { const c = to.hasAttribute("checked"); if (from.checked !== c) from.checked = c; }
    else if (!focused) { const v = to.getAttribute("value") ?? ""; if (from.value !== v) from.value = v; }
    return;
  }
  morphChildren(from, to);
  if (from.tagName === "SELECT" && !focused) { const o = [...to.options].find((x) => x.hasAttribute("selected")) ?? to.options[0]; if (o && from.value !== o.value) from.value = o.value; }
}
function morphChildren(from, to) {
  const keyed = new Map();
  for (let n = from.firstChild; n; n = n.nextSibling) { const k = morphKey(n); if (k && !keyed.has(k)) keyed.set(k, n); }
  let cur = from.firstChild;
  for (const t of [...to.childNodes]) {
    const k = morphKey(t); let m = null;
    if (k && keyed.has(k)) { m = keyed.get(k); keyed.delete(k); } else if (!k && cur && !morphKey(cur) && sameKind(cur, t)) m = cur;
    if (m && !sameKind(m, t)) m = null;
    if (m) { if (m === cur) cur = cur.nextSibling; else from.insertBefore(m, cur); morphNode(m, t); } else from.insertBefore(t, cur);
  }
  while (cur) { const nx = cur.nextSibling; from.removeChild(cur); cur = nx; }
}

/* ------------------------------------------------------------------ fenêtre */
const TABS = [["suggestions", "Suggestions"], ["tester", "Tester une rencontre"], ["groupe", "Le groupe"], ["aide", "Comment ça marche"]];
const COULEUR = { facile: "fld-facile", tendu: "fld-tendu", dangereux: "fld-dangereux", mortel: "fld-mortel" };

class DangerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "fl-danger", classes: ["fl-danger"], tag: "div", window: { title: "Le Danger", icon: "fa-solid fa-skull-crossbones", resizable: true }, position: { width: 980, height: 720 } };
  tab = "suggestions";
  exclus = new Set();     // PJ décochés
  avec = new Set();       // gardes engagés qui combattent
  rencontre = [];         // { uuid, n, actions }
  resultat = null;
  sugg = null;            // { cle, liste }
  calcul = null;          // progression
  voulu = "tendu";
  filtre = "tous";
  q = "";

  #equipe() {
    const pjs = groupe().filter((a) => !this.exclus.has(a.id)).map((a) => profilPersonnage(a));
    const al = allies().filter((a) => this.avec.has(a.id)).map((a) => ({ ...profilPersonnage(a), pnj: true }));
    return [...pjs, ...al];
  }
  #cleEquipe() { return JSON.stringify(this.#equipe().map((p) => [p.id, p.F, p.A, p.E, p.melee, p.tir, p.move, p.arme.bonus, p.arme.degats, p.parade, p.armure])); }

  async _renderHTML() {
    const nav = TABS.map(([id, l]) => `<a class="fld-tab${this.tab === id ? " active" : ""}" data-tab="${id}"><span>${l}</span></a>`).join("");
    const body = await { suggestions: () => this.#suggestions(), tester: () => this.#tester(), groupe: () => this.#groupe(), aide: () => this.#aide() }[this.tab]();
    return `<nav class="fld-nav">${nav}</nav><section class="fld-body">${body}</section>`;
  }
  _replaceHTML(html, content) {
    const tpl = document.createElement("template"); tpl.innerHTML = html;
    const changed = this._last !== this.tab;
    morphChildren(content, tpl.content);
    if (changed) { content.querySelector(".fld-scroll")?.scrollTo?.(0, 0); const b = content.querySelector(".fld-body"); b?.classList.remove("fld-enter"); void b?.offsetWidth; b?.classList.add("fld-enter"); }
    this._last = this.tab;
  }
  _onRender() {
    const el = this.element; if (el.dataset.fldBound) return; el.dataset.fldBound = "1";
    el.addEventListener("click", (ev) => this.#click(ev));
    el.addEventListener("change", (ev) => this.#change(ev));
    el.addEventListener("input", (ev) => { if (ev.target.matches("[data-q]")) { this.q = ev.target.value; clearTimeout(this._t); this._t = setTimeout(() => this.render(), 200); } });
  }

  /* ---------------- le groupe */
  #carteEquipe() {
    const eq = this.#equipe();
    return eq.length ? `<p class="fld-hint fld-center">Groupe pris en compte : ${eq.map((p) => esc(p.nom)).join(", ")} — <a data-tab="groupe">changer</a></p>`
      : `<p class="fld-alert fld-center">Aucun personnage dans le groupe : voyez l'onglet <a data-tab="groupe">Le groupe</a>.</p>`;
  }
  #groupe() {
    const ligne = (a, coche, cle) => { const p = profilPersonnage(a);
      return `<tr data-k="g:${a.id}"><td><label><input type="checkbox" data-${cle}="${a.id}" ${coche ? "checked" : ""}> <b>${esc(a.name)}</b></label></td>
        <td>F ${p.F} · A ${p.A} · E ${p.E}</td><td>Mêlée ${p.melee} · Tir ${p.tir} · Mouv. ${p.move}</td>
        <td>${esc(p.arme.nom)} (+${p.arme.bonus}, dég. ${p.arme.degats}${p.arme.distance ? ", distance" : ""})</td><td>${p.parade != null ? `parade +${p.parade}` : "—"}</td><td>armure ${p.armure}</td></tr>`; };
    const pj = groupe(); const al = allies();
    return `<div class="fld-scroll"><div class="fld-head"><h2>Le groupe</h2><p class="fld-sub">Ce que le module lit sur les fiches. Les valeurs actuelles comptent : un PJ blessé est plus fragile.</p></div>
      <table class="fld-table"><thead><tr><th>Personnage</th><th>Attributs</th><th>Compétences</th><th>Meilleure arme</th><th>Défense</th><th>Protection</th></tr></thead>
      <tbody>${pj.map((a) => ligne(a, !this.exclus.has(a.id), "pj")).join("") || `<tr><td colspan="6" class="fld-hint">Aucun personnage joueur trouvé (membres de l'acteur « Groupe » ou personnages ayant un joueur).</td></tr>`}</tbody></table>
      ${al.length ? `<h3 class="fld-center">Gardes du corps (fl-marchand)</h3><table class="fld-table"><tbody>${al.map((a) => ligne(a, this.avec.has(a.id), "allie")).join("")}</tbody></table><p class="fld-hint fld-center">Cochez ceux qui combattent avec le groupe.</p>` : ""}</div>`;
  }

  /* ---------------- tester */
  async #tester() {
    const cat = await catalogue();
    const q = norm(this.q);
    const choix = q ? cat.filter((c) => norm(c.nom).includes(q)).slice(0, 30) : [];
    const lignes = this.rencontre.map((r, i) => { const c = cat.find((x) => x.uuid === r.uuid); if (!c) return "";
      return `<tr data-k="r:${i}"><td>${c.img ? `<img class="fld-ico" src="${esc(c.img)}" alt="">` : ""} <b>${esc(c.nom)}</b> <span class="fld-hint">${c.monstre ? "monstre" : "PNJ"} · F ${c.F}${c.armure ? ` · armure ${c.armure}` : ""}</span></td>
        <td>× <input type="number" min="1" max="30" value="${r.n}" data-n="${i}"></td>
        <td>${c.monstre ? `<select data-actions="${i}" title="Guide du MJ p. 75 : un monstre trop vite vaincu peut agir deux ou trois fois par round">${[1, 2, 3].map((k) => `<option value="${k}" ${r.actions === k ? "selected" : ""}>${k} action${k > 1 ? "s" : ""}/round</option>`).join("")}</select>` : ""}</td>
        <td><button type="button" class="fld-small" data-placer="${i}"><i class="fa-solid fa-chess-pawn"></i> Placer</button> <a data-del="${i}"><i class="fa-solid fa-xmark"></i></a></td></tr>`; }).join("");
    const R = this.resultat;
    return `<div class="fld-scroll"><div class="fld-head"><h2>Tester une rencontre</h2>${this.#carteEquipe()}</div>
      <div class="fld-board"><div class="fld-card"><h3>Les adversaires</h3>
        <input type="search" class="fld-find" placeholder="Chercher un monstre ou un PNJ…" value="${esc(this.q)}" data-q>
        ${choix.length ? `<div class="fld-choix">${choix.map((c) => `<a data-ajout="${esc(c.uuid)}" data-k="c:${esc(c.uuid)}">${esc(c.nom)} <span class="fld-hint">${esc(c.source)}</span></a>`).join("")}</div>` : q ? `<p class="fld-hint">Rien trouvé.</p>` : ""}
        ${lignes ? `<table class="fld-table">${lignes}</table><p class="fld-center"><button type="button" data-act="simuler"><i class="fa-solid fa-dice"></i> Simuler ${N_TEST} combats</button></p>` : `<p class="fld-hint">Cherchez un adversaire et cliquez dessus pour l'ajouter.</p>`}</div>
      ${R ? `<div class="fld-card fld-res ${COULEUR[R.niv]}" data-k="res"><h3>${NIVEAUX[R.niv]}</h3>
        <p class="fld-gros">Victoire du groupe : <b>${pct(R.e.victoire)}</b></p>
        <p>Au moins un PJ brisé : <b>${pct(R.e.risque)}</b> · tous brisés : ${pct(R.e.tpk)}</p>
        <p>En moyenne ${R.e.brisesMoy.toFixed(1)} PJ brisé(s), ${R.e.rounds.toFixed(1)} rounds.</p>
        <p class="fld-hint">${esc(R.txt)}</p></div>` : ""}</div></div>`;
  }

  /* ---------------- suggestions */
  async #suggestions() {
    const eq = this.#equipe();
    const prete = this.sugg && this.sugg.cle === this.#cleEquipe();
    const niv = Object.entries(NIVEAUX).map(([k, l]) => `<a class="${this.voulu === k ? "active" : ""} ${COULEUR[k]}" data-voulu="${k}">${l}</a>`).join("");
    const filt = [["tous", "Tout"], ["monstre", "Monstres"], ["humanoide", "PNJ et humanoïdes"]].map(([k, l]) => `<a class="${this.filtre === k ? "active" : ""}" data-filtre="${k}">${l}</a>`).join("");
    let corps;
    if (this.calcul) corps = `<p class="fld-center fld-gros"><i class="fa-solid fa-dice fa-spin"></i> Simulation : ${this.calcul.fait} / ${this.calcul.total} adversaires…</p>`;
    else if (!prete) corps = `<div class="fld-empty"><img class="fld-raven" src="${SYS_ART}/ravens/raven5.webp" alt=""><p>Le module va jouer, pour chaque monstre et PNJ de vos compendiums, des centaines de combats contre votre groupe.</p>
      <button type="button" data-act="suggerer" ${eq.length ? "" : "disabled"}><i class="fa-solid fa-wand-magic-sparkles"></i> Proposer des rencontres</button><p class="fld-hint">Quelques secondes. À refaire quand le groupe progresse ou change d'équipement.</p></div>`;
    else {
      const q = norm(this.q);
      const liste = this.sugg.liste.filter((s) => s.niv === this.voulu && (this.filtre === "tous" || s.type === this.filtre) && (!q || norm(s.nom).includes(q)));
      corps = liste.length ? `<table class="fld-table"><thead><tr><th>Rencontre</th><th>Victoire</th><th>Un PJ brisé</th><th>Source</th><th></th></tr></thead><tbody>${liste.map((s) => `<tr data-k="s:${esc(s.uuid)}:${s.n}:${s.actions}">
        <td>${s.img ? `<img class="fld-ico" src="${esc(s.img)}" alt="">` : ""} <b>${s.n > 1 ? `${s.n} × ` : ""}${esc(s.nom)}</b>${s.actions > 1 ? ` <span class="fld-tag" title="Guide du MJ p. 75">${s.actions} actions/round</span>` : ""}</td>
        <td>${pct(s.e.victoire)}</td><td>${pct(s.e.risque)}</td><td class="fld-hint">${esc(s.source)}</td>
        <td><button type="button" class="fld-small" data-essayer="${esc(s.uuid)}|${s.n}|${s.actions}">Tester</button> <button type="button" class="fld-small" data-poser="${esc(s.uuid)}|${s.n}"><i class="fa-solid fa-chess-pawn"></i></button></td></tr>`).join("")}</tbody></table>`
        : `<p class="fld-hint fld-center">Aucune rencontre de ce niveau${this.filtre !== "tous" ? " dans ce filtre" : ""}.</p>`;
      corps += `<p class="fld-center"><a data-act="suggerer"><i class="fa-solid fa-rotate"></i> Recalculer</a></p>`;
    }
    return `<div class="fld-scroll"><div class="fld-head"><h2>Des rencontres à la mesure du groupe</h2>${this.#carteEquipe()}
      <div class="fld-niv">${niv}</div><div class="fld-cats">${filt}</div>${prete ? `<input type="search" class="fld-find" placeholder="Filtrer…" value="${esc(this.q)}" data-q>` : ""}</div>${corps}</div>`;
  }

  /* ---------------- aide */
  #aide() {
    return `<div class="fld-scroll fld-text"><h2>Comment ça marche</h2><div class="fld-board">
      <div class="fld-card"><h3>Le principe</h3><p>Forbidden Lands n'a pas de règle d'équilibrage des rencontres. Le module estime donc le danger en jouant, en une fraction de seconde, des centaines de combats entre votre groupe et les adversaires, avec les règles de base du Manuel :</p><ul>
        <li>attaque : attribut actuel + compétence + bonus de l'arme, on ne garde que les 6 ; un PJ qui n'a rien pousse son jet (les 1 des dés de base lui coûtent un point) ;</li>
        <li>défense : l'action rapide sert à esquiver (Agilité + Mouvement) ou à parer (Force + Mêlée + arme qui pare ou bouclier, jamais contre un monstre) ;</li>
        <li>dégâts : ceux de l'arme + 1 par succès en plus ; l'armure se lance et chaque 6 retire 1 ; la peur des monstres touche l'Esprit sans armure ;</li>
        <li>les monstres tirent une attaque au hasard sur leur table ; un monstre peut agir deux ou trois fois par round (Guide du MJ p. 75) ;</li>
        <li>un combattant à 0 en Force, Agilité ou Esprit est brisé.</li></ul></div>
      <div class="fld-card"><h3>Les niveaux <span class="fld-src">réglage maison</span></h3><ul>
        <li><b class="fld-facile">Facile</b> : victoire 95 % ou plus, un PJ brisé moins de 15 % du temps.</li>
        <li><b class="fld-tendu">Tendu</b> : victoire 85 % ou plus, un PJ brisé moins d'une fois sur deux.</li>
        <li><b class="fld-dangereux">Dangereux</b> : victoire 55 % ou plus.</li>
        <li><b class="fld-mortel">Mortel</b> : en dessous.</li></ul></div>
      <div class="fld-card"><h3>Ce que le module ne voit pas</h3><ul>
        <li>le terrain, la portée, l'embuscade, la fuite, la ruse ;</li>
        <li>les sorts, les talents, les capacités spéciales des monstres, les blessures critiques ;</li>
        <li>une fiche de compendium mal remplie donne une estimation fausse.</li></ul>
        <p>C'est un ordre de grandeur pour préparer, pas une vérité : à vous d'ajuster autour de la table.</p></div></div></div>`;
  }

  /* ---------------- actions */
  async #click(ev) {
    const t = ev.target.closest("[data-tab],[data-act],[data-ajout],[data-del],[data-placer],[data-voulu],[data-filtre],[data-essayer],[data-poser]");
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.tab) { this.tab = d.tab; this.q = ""; return this.render(); }
    if (d.voulu) { this.voulu = d.voulu; return this.render(); }
    if (d.filtre) { this.filtre = d.filtre; return this.render(); }
    if (d.ajout) { this.rencontre.push({ uuid: d.ajout, n: 1, actions: 1 }); this.q = ""; this.resultat = null; return this.render(); }
    if (d.del != null) { this.rencontre.splice(Number(d.del), 1); this.resultat = null; return this.render(); }
    if (d.placer != null) { const r = this.rencontre[Number(d.placer)]; return placer(r.uuid, r.n); }
    if (d.poser) { const [uuid, n] = d.poser.split("|"); return placer(uuid, Number(n)); }
    if (d.essayer) { const [uuid, n, a] = d.essayer.split("|"); this.rencontre = [{ uuid, n: Number(n), actions: Number(a) }]; this.tab = "tester"; await this.render(); return this.#simuler(); }
    if (d.act === "simuler") return this.#simuler();
    if (d.act === "suggerer") return this.#suggerer();
  }
  #change(ev) {
    const el = ev.target; const d = el.dataset;
    if (d.pj) { el.checked ? this.exclus.delete(d.pj) : this.exclus.add(d.pj); this.sugg = null; return this.render(); }
    if (d.allie) { el.checked ? this.avec.add(d.allie) : this.avec.delete(d.allie); this.sugg = null; return this.render(); }
    if (d.n != null) { this.rencontre[Number(d.n)].n = Math.max(1, Math.min(30, Number(el.value) || 1)); this.resultat = null; return this.render(); }
    if (d.actions != null) { this.rencontre[Number(d.actions)].actions = Number(el.value) || 1; this.resultat = null; return this.render(); }
  }
  async #simuler() {
    const eq = this.#equipe(); if (!eq.length) return ui.notifications.warn("Aucun personnage dans le groupe.");
    const cat = await catalogue();
    const ennemis = this.rencontre.flatMap((r) => { const c = cat.find((x) => x.uuid === r.uuid); return c ? Array.from({ length: r.n }, () => ({ ...c, actions: r.actions })) : []; });
    if (!ennemis.length) return;
    const e = estimer(eq, ennemis, N_TEST); const niv = niveau(e);
    const conseil = niv === "facile" && this.rencontre.some((r) => cat.find((x) => x.uuid === r.uuid)?.monstre && r.actions < 3)
      ? "Trop facile ? Le Guide du MJ (p. 75) suggère de faire agir le monstre deux ou trois fois par round." : niv === "mortel" ? "Mortel : prévoyez une issue (fuite, aide extérieure, négociation) ou réduisez le nombre." : "";
    this.resultat = { e, niv, txt: conseil };
    this.render();
  }
  async #suggerer() {
    const eq = this.#equipe(); if (!eq.length) return;
    this.calcul = { fait: 0, total: 0 }; this.render();
    const cat = await catalogue(true);
    this.calcul.total = cat.length; this.render();
    const liste = [];
    for (const c of cat) {
      if (c.monstre && c.F > 6) {
        // Grand monstre : seul, une à trois actions par round.
        for (const actions of [1, 2, 3]) { const e = estimer(eq, [{ ...c, actions }], N_SUGG); liste.push({ ...c, n: 1, actions, e, niv: niveau(e) }); }
      } else {
        const vus = new Set();
        for (let n = 1; n <= 12; n++) {
          const e = estimer(eq, Array.from({ length: n }, () => c), N_SUGG); const nv = niveau(e);
          // Pour chaque niveau, on garde le plus grand nombre d'adversaires qui y reste.
          const deja = liste.findIndex((s) => s.uuid === c.uuid && s.niv === nv);
          if (deja >= 0) liste[deja] = { ...c, n, actions: 1, e, niv: nv }; else liste.push({ ...c, n, actions: 1, e, niv: nv });
          vus.add(nv);
          if (nv === "mortel") break;
        }
      }
      this.calcul.fait++;
      if (this.calcul.fait % 5 === 0) { this.render(); await pause(); }
    }
    // Un monstre seul et ses variantes : on garde une ligne par niveau.
    const uniq = new Map(); for (const s of liste) { const k = `${s.uuid}|${s.niv}`; if (!uniq.has(k) || (s.actions < uniq.get(k).actions)) uniq.set(k, s); }
    this.sugg = { cle: this.#cleEquipe(), liste: [...uniq.values()].sort((x, y) => y.e.victoire - x.e.victoire || x.nom.localeCompare(y.nom)) };
    this.calcul = null; this.render();
  }
}

let app = null;
function open() { if (!game.user.isGM) return ui.notifications.warn("Le Danger est réservé au MJ."); app ??= new DangerApp(); app.render({ force: true }); }
Hooks.once("init", () => {
  game.keybindings.register(MOD, "open", { name: "Ouvrir Le Danger", editable: [{ key: "KeyD", modifiers: ["Alt"] }], restricted: true, onDown: () => { open(); return true; } });
});
Hooks.once("ready", () => { globalThis.FLDanger = { open, estimer, profil }; });
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
  tokens.tools["fl-danger"] = { name: "fl-danger", title: "Le Danger (Alt/⌥+D)", icon: "fa-solid fa-skull-crossbones", button: true, onChange: () => open(), order: 100 };
});
// Les fiches changent : le catalogue sera relu.
for (const h of ["createActor", "deleteActor", "updateActor"]) Hooks.on(h, () => { CATALOGUE = null; });
