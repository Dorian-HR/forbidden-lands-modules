/**
 * Forbidden Lands – Suivi de campagne (tableau du MJ)
 *
 * Le module ne contient AUCUN texte des livres. Le contenu de la campagne (sites, PNJ, acteurs majeurs, artefacts,
 * légendes, chronologie) s'importe une fois depuis un fichier privé ; l'état de la partie (où est qui, attitudes,
 * événements faits, sessions…) est gardé dans le monde.
 */
const MOD = "fl-campagne";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const uid = () => foundry.utils.randomID();

/* -------------------------------------------- */
/*  Vocabulaire                                  */
/* -------------------------------------------- */

const SITE_STATUS = [
  ["inconnu", "Inconnu des PJ"], ["rumeur", "Les PJ en ont entendu parler"], ["visite", "Les PJ y sont allés"],
  ["explore", "Exploré à fond"], ["conquis", "Conquis / forteresse des PJ"]
];
const ATTITUDES = [["hostile", "Hostile"], ["mefiant", "Méfiant"], ["neutre", "Neutre"], ["amical", "Amical"], ["allie", "Allié des PJ"], ["ennemi", "Ennemi juré"]];
const VIE = [["vivant", "Vivant"], ["blesse", "Blessé"], ["captif", "Captif"], ["disparu", "Disparu"], ["mort", "Mort"]];
const lab = (list, k) => list.find(([id]) => id === k)?.[1] ?? k ?? "—";
const attFromText = (t) => {
  const n = norm(t);
  if (/hostile/.test(n)) return "hostile";
  if (/mefian/.test(n)) return "mefiant";
  if (/amic|bienveill/.test(n)) return "amical";
  return "neutre";
};

/* -------------------------------------------- */
/*  Données : contenu importé + état de la partie */
/* -------------------------------------------- */

const contenu = () => game.settings.get(MOD, "contenu") ?? {};
const etat = () => foundry.utils.mergeObject(defaultEtat(), game.settings.get(MOD, "etat") ?? {}, { inplace: false });
function defaultEtat() {
  return { groupe: { site: "", lieu: "", hex: "", note: "" }, sites: {}, pnj: {}, acteurs: {}, artefacts: {}, legendes: {},
    horloges: [], evenements: [], sessions: [], preparation: {}, pj: {} };
}
let saveTimer = null, pendingEtat = null;
function saveEtat(e) {
  pendingEtat = e;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { game.settings.set(MOD, "etat", pendingEtat); pendingEtat = null; }, 300);
}
const current = () => pendingEtat ?? etat();

/** Index de tout le contenu, avec les clés uniques. */
function index() {
  const c = contenu();
  const sites = arr(c.sites).map((s) => ({ ...s.site, _pnj: arr(s.pnj), _ev: arr(s.evenements), _rum: arr(s.rumeurs) }));
  const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
  index.cache = { siteById };
  const pnj = [];
  for (const s of sites) for (const p of s._pnj) pnj.push({ ...p, _key: `${s.id}:${p.id}`, _site: s.id });
  const majeurs = arr(c.acteurs_majeurs).map((a) => ({ ...a, _key: `majeur:${a.id}` }));
  return (index.cache = { c, sites, siteById, pnj, majeurs, artefacts: arr(c.artefacts), legendes: arr(c.campagne?.legendes), campagne: c.campagne ?? {} });
}

/** Où est un PNJ maintenant (l'état de la partie l'emporte sur le livre). */
function lieuName(siteId, lieu) {
  if (lieu == null || lieu === "") return "";
  const s = index.cache?.siteById?.[siteId];
  const l = arr(s?.lieux).find((x) => String(x.id) === String(lieu));
  return l ? l.nom : String(lieu);
}
function wherePnj(p, e) {
  const s = e.pnj[p._key] ?? {};
  return { site: s.site ?? p._site ?? p.site, lieu: s.lieu ?? lieuName(p._site, p.lieu), attitude: s.attitude ?? attFromText(p.attitude_initiale), vie: s.vie ?? "vivant", rencontre: !!s.rencontre, notes: s.notes ?? "" };
}
function whereMajeur(a, e) {
  const s = e.acteurs[a.id] ?? {};
  return { ou: s.ou ?? a.ou_au_debut ?? "", relation: s.relation ?? attFromText(a.attitude_initiale), vie: s.vie ?? "vivant", rencontre: !!s.rencontre, notes: s.notes ?? "" };
}
const siteName = (I, id) => I.siteById[id]?.nom ?? id ?? "—";
function personName(I, ref) {
  if (!ref) return "";
  const r = String(ref);
  const m = I.majeurs.find((a) => a.id === r || norm(a.nom) === norm(r));
  if (m) return m.nom;
  const p = I.pnj.find((x) => x.id === r || x._key === r || norm(x.nom) === norm(r));
  return p?.nom ?? r;
}

/* -------------------------------------------- */
/*  Date du jeu (fl-temps)                        */
/* -------------------------------------------- */

function today() {
  const T = globalThis.FLTemps;
  if (!T?.getState) return { day: Math.floor(game.time.worldTime / 86400), label: "" };
  const st = T.getState();
  return { day: st.day, label: st.date?.label ?? "", short: st.date?.shortLabel ?? "" };
}
function dayLabel(day) {
  const T = globalThis.FLTemps;
  if (day == null || day === "") return "";
  return T?.dateFromDay ? (T.dateFromDay(Number(day))?.label ?? `jour ${day}`) : `jour ${day}`;
}
function monthNames() {
  const T = globalThis.FLTemps;
  if (!T?.dateFromDay) return [];
  return Array.from({ length: 8 }, (_, i) => T.dateFromDay(i * 45 + 1)?.month?.name ?? `Mois ${i + 1}`);
}

/* -------------------------------------------- */
/*  Ouvrir le livre, un acteur, montrer aux joueurs */
/* -------------------------------------------- */

async function findJournal(names) {
  const wanted = arr(names).filter(Boolean).map(norm);
  if (!wanted.length) return null;
  const hit = game.journal.find((j) => wanted.includes(norm(j.name)));
  if (hit) return hit;
  for (const pack of game.packs.filter((p) => p.documentName === "JournalEntry")) {
    const idx = await pack.getIndex();
    const e = idx.find((x) => wanted.includes(norm(x.name)) || wanted.includes(norm(x.originalName)));
    if (e) return pack.getDocument(e._id);
  }
  return null;
}
async function openBook(journals, pages) {
  const j = await findJournal(journals);
  if (!j) return ui.notifications.warn("Page du livre introuvable : importez le Châtiment du Corbeau (ou le livre de base) dans votre monde.");
  const wanted = arr(pages).filter(Boolean).map(norm);
  const page = wanted.length ? j.pages.find((p) => wanted.includes(norm(p.name)) || wanted.includes(norm(p.flags?.babele?.originalName))) : null;
  j.sheet.render(true, page ? { pageId: page.id } : {});
}
/** Les mots qui désignent quelqu'un dans un texte : son nom complet, puis son mot le plus distinctif. */
function nameKeys(names) {
  const stop = ["madame", "monsieur", "frere", "soeur", "dame", "sire", "capitaine", "maitre", "village", "rouille", "alias", "grand", "petit", "vieux", "vieille", "les", "des", "clan"];
  return [...new Set(arr(names).filter(Boolean).flatMap((n) => {
    const clean = norm(String(n).replace(/\(.*?\)/g, ""));
    const words = clean.split(" ").filter((w) => w.length > 3 && !stop.includes(w));
    return [clean, ...words.sort((x, y) => y.length - x.length).slice(0, 1)];
  }))].filter(Boolean);
}
/** Une référence (id ou nom) → clé de fiche « majeur:id » ou « pnj:site:id ». */
function refKey(I, ref, siteId) {
  if (!ref) return null;
  const r = String(ref), n = norm(r);
  const m = I.majeurs.find((a) => a.id === r || norm(a.nom) === n);
  if (m) return `majeur:${m.id}`;
  const local = I.pnj.find((p) => p._site === siteId && (p.id === r || norm(p.nom) === n));
  if (local) return `pnj:${local._key}`;
  const g = I.pnj.find((p) => p._key === r || norm(p.nom) === n);
  return g ? `pnj:${g._key}` : null;
}
/** Tout ce que le livre dit pouvoir arriver en lien avec quelqu'un (événements, fins, chronologie). */
function bookMentions(I, nom, id) {
  const keys = nameKeys([nom]);
  const hit = (...t) => { const x = norm(t.filter(Boolean).join(" ")); return keys.some((k) => x.includes(k)); };
  const out = [];
  for (const s of I.sites) for (const v of s._ev) if (hit(v.titre, v.resume, v.declencheur, v.consequences))
    out.push({ type: "Événement", lieu: s.nom, titre: v.titre, texte: v.consequences || v.resume || "" });
  for (const f of arr(I.campagne.fins_possibles)) if (arr(f.acteurs).includes(id) || hit(f.si, f.alors))
    out.push({ type: "Fin possible", lieu: "Vond", titre: f.si, texte: f.alors });
  for (const c of arr(I.campagne.chronologie)) if ((id && c.acteur === id) || hit(c.evenement, c.acteur))
    out.push({ type: "Chronologie", lieu: c.quand ?? "", titre: c.evenement, texte: "" });
  return out;
}

/** Ouvre la description officielle d'un personnage : la page du livre qui porte son nom, sinon la page qui en parle, sinon sa fiche de jeu. */
const strip = (html) => norm(String(html ?? "").replace(/<[^>]+>/g, " "));
async function openOfficial({ nom, nom_en, journals = [], acteur, acteurFr }) {
  const names = [nom, nom_en].filter(Boolean);
  // noms à chercher : le nom complet, puis le mot le plus distinctif (« Madame Pollmor » → « pollmor »)
  const keys = [...new Set(names.flatMap((n) => {
    const clean = norm(String(n).replace(/\(.*?\)/g, ""));
    const words = clean.split(" ").filter((w) => w.length > 3 && !["madame", "monsieur", "frere", "soeur", "dame", "sire", "capitaine", "maitre", "village", "rouille"].includes(w));
    return [clean, ...words.sort((x, y) => y.length - x.length).slice(0, 1)];
  }))].filter(Boolean);
  const seen = new Set();
  for (const jn of journals.filter(Boolean)) {
    const j = await findJournal([jn]);
    if (!j || seen.has(j.uuid)) continue;
    seen.add(j.uuid);
    const pages = [...j.pages];
    // 1. une page à son nom
    let page = pages.find((pg) => keys.slice(0, 2).some((k) => norm(pg.name) === k || norm(pg.flags?.babele?.originalName) === k))
      ?? pages.find((pg) => keys.some((k) => norm(pg.name).includes(k)));
    // 2. une page qui parle de lui (le plus de mentions)
    if (!page) {
      let best = 0;
      for (const pg of pages) {
        const t = strip(pg.text?.content);
        const n = keys.reduce((c, k) => c + (t.split(k).length - 1), 0);
        if (n > best) { best = n; page = pg; }
      }
    }
    if (page) {
      j.sheet.render(true, { pageId: page.id });
      return;
    }
  }
  if (acteur || acteurFr) return openActor(acteur, acteurFr);
  ui.notifications.warn(`Description officielle de « ${nom} » introuvable : importez le livre (Châtiment du Corbeau ou livre de base) dans votre monde.`);
}

async function openActor(name, frName) {
  const base = (n) => String(n ?? "").replace(/^\[base\]\s*/, "").trim();
  const map = contenu().acteurs_fr ?? {};
  const raw = [frName, name, map[name], map[base(name)]].filter(Boolean).map(base);
  const wanted = [...new Set(raw.map(norm))].filter(Boolean);
  const label = raw[0] || "ce PNJ";
  if (!wanted.length) return ui.notifications.info("Pas de fiche de jeu pour ce PNJ.");
  const same = (n) => wanted.includes(norm(n));
  const close = (n) => { const x = norm(n); return x && wanted.some((w) => x.startsWith(w) || w.startsWith(x)); };
  const orig = (a) => a?.flags?.babele?.originalName ?? a?.originalName;
  let a = game.actors.find((x) => same(x.name) || same(orig(x))) ?? game.actors.find((x) => close(x.name));
  if (!a) {
    for (const pass of [same, close]) {
      for (const pack of game.packs.filter((p) => p.documentName === "Actor")) {
        const idx = await pack.getIndex({ fields: ["flags.babele.originalName"] });
        const e = idx.find((x) => pass(x.name) || (pass === same && same(orig(x))));
        if (e) { a = await pack.getDocument(e._id); break; }
      }
      if (a) break;
    }
  }
  if (!a) return ui.notifications.warn(`Fiche de jeu « ${label} » introuvable dans le monde ou les compendiums.`);
  a.sheet.render(true);
}
async function showToPlayers(journals, pages) {
  const j = await findJournal(journals);
  if (!j) return ui.notifications.warn("Légende introuvable.");
  if (j.pack) return ui.notifications.warn("Cette page est dans un compendium : importez le journal dans le monde pour pouvoir la montrer aux joueurs.");
  const wanted = arr(pages).filter(Boolean).map(norm);
  const page = wanted.length ? j.pages.find((p) => wanted.includes(norm(p.name))) : null;
  const target = page ?? j;
  const J = foundry.documents?.collections?.Journal ?? globalThis.Journal;
  if (J?.show) await J.show(target, { force: true });
  else await target.show?.("text", true);
  ui.notifications.info("Montré aux joueurs.");
}

/** Où lire un lieu : son journal « - Lieux » (ou « Journal :: Page » pour Vond), puis le journal du site. */
function lieuBook(s, l) {
  const journals = [], pages = [];
  for (const raw of [l.page_en, l.page_fr]) {
    if (!raw) continue;
    const [j, p] = String(raw).includes("::") ? String(raw).split("::").map((x) => x.trim()) : [null, raw];
    if (j) journals.push(j);
    pages.push(p);
  }
  journals.push(s.journal_lieux_en, s.journal_lieux_fr, `${s.journal_en} - Locations`, `${s.journal_fr} - Lieux`, s.journal_en, s.journal_fr);
  for (const part of arr(s.parties)) journals.push(part.journal_en, part.journal_fr, `${part.journal_en} - Locations`);
  return { journals: journals.filter(Boolean), pages: pages.filter(Boolean) };
}

/* -------------------------------------------- */
/*  La fenêtre                                   */
/* -------------------------------------------- */

/** Demande un jour du calendrier : dans N jours, ou à une date précise (fl-temps). Renvoie le numéro de jour. */
async function askDay(titre, indication) {
  const t = today();
  const T = globalThis.FLTemps;
  const cur = T?.dateFromDay ? T.dateFromDay(t.day) : null;
  const months = monthNames();
  const dateUI = cur && months.length ? `<p>ou à la date : <select name="m">${months.map((m, i) => `<option value="${i}"${i === cur.monthIndex ? " selected" : ""}>${esc(m)}</option>`).join("")}</select>
    jour <input type="number" name="d" min="1" max="45" value="${cur.dayOfMonth}" style="width:55px"> an <input type="number" name="y" value="${cur.year}" style="width:75px">
    <label><input type="checkbox" name="exact"> utiliser cette date</label></p>` : "";
  return foundry.applications.api.DialogV2.prompt({
    window: { title: "Mettre au calendrier" },
    content: `<div class="flc-dlg"><p><b>${esc(titre)}</b>${indication ? `<br><span class="flc-hint">Livre : ${esc(indication)}</span>` : ""}</p>
      <p class="flc-hint">Aujourd'hui : ${esc(t.label || `jour ${t.day}`)}. Un rappel vous sera chuchoté le jour venu.</p>
      <p>Dans <input type="number" name="n" value="7" min="0" style="width:60px"> jours</p>${dateUI}</div>`,
    ok: { label: "Ajouter", callback: (_e, b) => {
      const f = b.form.elements;
      if (f.exact?.checked && cur) return t.day + (Number(f.y.value) - cur.year) * 360 + (Number(f.m.value) - cur.monthIndex) * 45 + (Number(f.d.value) - cur.dayOfMonth);
      return t.day + Number(f.n.value || 0);
    } },
    rejectClose: false
  });
}

/** Le jour d'un événement daté est arrivé : rappel chuchoté au MJ (une seule fois). */
async function checkRappels() {
  if (!game.user.isGM || (game.users.activeGM && !game.users.activeGM.isSelf)) return;
  const e = etat();
  const t = today();
  const due = e.evenements.filter((v) => !v.fait && !v.rappele && v.jour != null && v.jour !== "" && v.jour <= t.day);
  if (!due.length) return;
  for (const v of due) {
    v.rappele = true;
    ui.notifications.info(`Campagne : « ${v.titre} » arrive aujourd'hui.`, { permanent: true });
    await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), speaker: { alias: "Suivi de campagne" },
      content: `<p><i class="fa-solid fa-bell"></i> <b>${esc(v.titre)}</b></p>${v.notes ? `<p>${esc(v.notes)}</p>` : ""}<p><em>Prévu pour ${esc(dayLabel(v.jour))}.</em></p>` });
  }
  await game.settings.set(MOD, "etat", e);
}

const TABS = [
  ["tableau", "Tableau", "fa-solid fa-chess-rook"], ["qui", "Qui est où", "fa-solid fa-users"], ["sites", "Sites", "fa-solid fa-map-location-dot"],
  ["acteurs", "Acteurs majeurs", "fa-solid fa-crown"], ["relations", "Relations", "fa-solid fa-diagram-project"], ["vond", "Vers Vond", "fa-solid fa-chess-king"], ["artefacts", "Artefacts", "fa-solid fa-gem"], ["legendes", "Légendes", "fa-solid fa-scroll"],
  ["temps", "Horloges & événements", "fa-solid fa-hourglass-half"], ["sessions", "Sessions", "fa-solid fa-book-open"], ["pj", "Les PJ", "fa-solid fa-user-shield"]
];

class CampagneApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fl-campagne", classes: ["fl-campagne"], tag: "div",
    window: { title: "Suivi de campagne — Le Châtiment du Corbeau", icon: "fa-solid fa-feather", resizable: true },
    position: { width: 1100, height: 760 }
  };
  tab = "tableau";
  sel = null;           // élément ouvert dans le panneau de droite
  filtre = { texte: "", site: "", attitude: "", vie: "" };
  relSite = "";

  async _renderHTML() {
    const I = index();
    const e = current();
    if (!I.sites.length && !I.majeurs.length) return this.#empty();
    const nav = TABS.map(([id, label, icon]) => `<a class="flc-tab${this.tab === id ? " active" : ""}" data-tab="${id}"><i class="${icon}"></i> ${label}</a>`).join("");
    const body = ({ tableau: () => this.#tableau(I, e), qui: () => this.#qui(I, e), sites: () => this.#sites(I, e), acteurs: () => this.#acteurs(I, e), relations: () => this.#relations(I, e), vond: () => this.#vond(I, e),
      artefacts: () => this.#artefacts(I, e), legendes: () => this.#legendes(I, e), temps: () => this.#temps(I, e), sessions: () => this.#sessions(I, e), pj: () => this.#pj(I, e) })[this.tab]();
    return `<nav class="flc-nav">${nav}</nav><section class="flc-body">${body}</section>`;
  }
  _replaceHTML(html, content) {
    const scroll = content.querySelector(".flc-scroll")?.scrollTop ?? 0;
    const scroll2 = content.querySelector(".flc-detail")?.scrollTop ?? 0;
    content.innerHTML = html;
    const a = content.querySelector(".flc-scroll"); if (a) a.scrollTop = scroll;
    const b = content.querySelector(".flc-detail"); if (b) b.scrollTop = scroll2;
  }

  #empty() {
    return `<div class="flc-empty"><h2>Aucune campagne chargée</h2>
      <p>Importez le fichier de campagne (<code>campagne-corbeau.json</code>) que Claude vous a préparé. Il reste dans votre monde, jamais en ligne.</p>
      <button type="button" data-act="import"><i class="fa-solid fa-file-import"></i> Importer la campagne</button></div>`;
  }

  /* ---------- Tableau ---------- */
  #tableau(I, e) {
    const t = today();
    const g = e.groupe;
    const siteOpts = `<option value="">— où sont les PJ ? —</option>` + I.sites.map((s) => `<option value="${s.id}"${g.site === s.id ? " selected" : ""}>${esc(s.nom)}</option>`).join("");
    const here = I.sites.find((s) => s.id === g.site);
    const ici = here ? I.pnj.filter((p) => wherePnj(p, e).site === here.id && wherePnj(p, e).vie !== "mort") : [];
    const majeursIci = here ? I.majeurs.filter((a) => norm(whereMajeur(a, e).ou).includes(norm(here.nom))) : [];
    // Le monde bouge : horloges presque pleines et événements datés proches
    const clocks = e.horloges.filter((h) => h.rempli < h.segments).sort((a, b) => b.rempli / b.segments - a.rempli / a.segments).slice(0, 5);
    const soon = e.evenements.filter((v) => !v.fait && v.jour !== "" && v.jour != null).sort((a, b) => a.jour - b.jour).slice(0, 6);
    const lateDue = soon.filter((v) => v.jour <= t.day);
    // Légende de la session
    const nextLegend = I.legendes.find((l, i) => !e.legendes[i]?.lue);
    const nextLegendIdx = I.legendes.indexOf(nextLegend);
    // Conditions de la confrontation finale
    const cond = arr(I.campagne.conditions_confrontation_finale);
    const condDone = e.preparation.conditions ?? {};
    return `<div class="flc-scroll flc-board">
      <div class="flc-card flc-wide">
        <h3>Où en est la partie</h3>
        <p class="flc-date">${t.label ? esc(t.label) : "<i>Date : activez fl-temps pour dater les sessions.</i>"}</p>
        <div class="flc-row"><label>Les PJ sont à</label><select data-path="groupe.site">${siteOpts}</select>
          <input type="text" placeholder="lieu précis / hexagone" value="${esc(g.lieu)}" data-path="groupe.lieu"></div>
        ${here ? `<p class="flc-lead">${esc(here.resume_mj ?? "")}</p>
          <p><b>Qui est ici :</b> ${[...majeursIci.map((a) => `<a data-sel="majeur:${a.id}">${esc(a.nom)}</a> <span class="flc-tag">majeur</span>`), ...ici.map((p) => `<a data-sel="pnj:${p._key}">${esc(p.nom)}</a>`)].join(", ") || "<i>personne de connu</i>"}</p>
          <div class="flc-buttons"><button type="button" data-sel="site:${here.id}"><i class="fa-solid fa-map"></i> Ouvrir la fiche du site</button>
          <button type="button" data-rumeur="${here.id}"><i class="fa-solid fa-comments"></i> Tirer une rumeur</button></div>` : `<p class="flc-hint">Choisissez où sont les PJ : le tableau vous montre alors qui est là et ce qui peut arriver.</p>`}
      </div>
      <div class="flc-card">
        <h3>Le monde bouge</h3>
        ${lateDue.length ? `<p class="flc-alert"><i class="fa-solid fa-bell"></i> ${lateDue.length} événement${lateDue.length > 1 ? "s" : ""} arrivé${lateDue.length > 1 ? "s" : ""} à échéance !</p>` : ""}
        ${soon.length ? `<ul class="flc-list">${soon.map((v) => `<li class="${v.jour <= t.day ? "due" : ""}"><b>${esc(v.titre)}</b><br><span class="flc-hint">${esc(dayLabel(v.jour))}</span></li>`).join("")}</ul>` : `<p class="flc-hint">Aucun événement daté. Ajoutez-en dans « Horloges & événements ».</p>`}
        ${clocks.length ? `<h4>Horloges</h4>${clocks.map((h) => this.#clock(h)).join("")}` : ""}
      </div>
      <div class="flc-card">
        <h3>Pour la prochaine session</h3>
        ${nextLegend ? `<p><b>Légende à présenter</b> (le livre conseille une par session) : <a data-tab-go="legendes">${esc(nextLegend.titre)}</a></p>` : I.legendes.length ? `<p class="flc-hint">Toutes les légendes ont été lues.</p>` : ""}
        <p><b>Préparation :</b> ${Object.values(e.preparation).filter((v) => typeof v === "string" && v.trim()).length ? "en cours" : "à faire"} — <a data-tab-go="sessions">ouvrir la préparation</a></p>
        ${e.sessions.length ? `<p><b>Dernière session :</b> ${esc(e.sessions.at(-1).titre || `Session ${e.sessions.length}`)}</p>` : ""}
      </div>
      <div class="flc-card">
        <h3>Fichiers</h3>
        <p class="flc-hint">Le contenu du livre vient de votre fichier privé ; votre partie (qui est où, notes, sessions…) est gardée dans le monde.</p>
        <div class="flc-buttons">
          <button type="button" data-act="import"><i class="fa-solid fa-file-import"></i> Mettre à jour la campagne</button>
          <button type="button" data-act="export"><i class="fa-solid fa-floppy-disk"></i> Sauvegarder ma partie</button>
          <button type="button" data-act="restore"><i class="fa-solid fa-clock-rotate-left"></i> Restaurer une sauvegarde</button>
        </div>
      </div>
      ${cond.length ? `<div class="flc-card">
        <h3>Vers la confrontation finale à Vond</h3>
        <p class="flc-hint">Elle peut avoir lieu quand ces conditions sont remplies :</p>
        ${cond.map((c, i) => `<label class="flc-check"><input type="checkbox" data-path="preparation.conditions.${i}" ${condDone[i] ? "checked" : ""}> ${esc(c)}</label>`).join("")}
      </div>` : ""}
    </div>`;
  }

  #clock(h) {
    const segs = Array.from({ length: h.segments }, (_, i) => `<span class="${i < h.rempli ? "on" : ""}"></span>`).join("");
    return `<div class="flc-clock"><span class="flc-clock-name">${esc(h.nom)}</span><span class="flc-clock-segs" data-clock="${h.id}">${segs}</span><span class="flc-hint">${h.rempli}/${h.segments}</span></div>`;
  }

  /* ---------- Qui est où ---------- */
  #qui(I, e) {
    const f = this.filtre;
    const rows = [];
    for (const a of I.majeurs) {
      const w = whereMajeur(a, e);
      rows.push({ key: `majeur:${a.id}`, nom: a.nom, role: a.role, majeur: true, site: "", ou: w.ou, veut: arr(a.veut)[0] ?? "", attitude: w.relation, vie: w.vie, rencontre: w.rencontre });
    }
    for (const p of I.pnj) {
      const w = wherePnj(p, e);
      rows.push({ key: `pnj:${p._key}`, nom: p.nom, role: p.role, majeur: !!p.majeur, site: w.site, ou: `${siteName(I, w.site)}${w.lieu ? ` — ${w.lieu}` : ""}`, veut: arr(p.veut)[0] ?? "", attitude: w.attitude, vie: w.vie, rencontre: w.rencontre });
    }
    const t = norm(f.texte);
    const list = rows.filter((r) => (!t || norm(`${r.nom} ${r.role} ${r.ou} ${r.veut}`).includes(t)) && (!f.site || r.site === f.site || (r.majeur && norm(r.ou).includes(norm(siteName(I, f.site)))))
      && (!f.attitude || r.attitude === f.attitude) && (!f.vie || r.vie === f.vie));
    const opt = (list, v, all) => `<option value="">${all}</option>` + list.map(([id, l]) => `<option value="${id}"${v === id ? " selected" : ""}>${l}</option>`).join("");
    return `<div class="flc-split"><div class="flc-scroll">
      <div class="flc-filters">
        <input type="search" placeholder="Chercher un nom, un lieu, un objectif…" value="${esc(f.texte)}" data-filter="texte">
        <select data-filter="site">${opt(I.sites.map((s) => [s.id, s.nom]), f.site, "Tous les lieux")}</select>
        <select data-filter="attitude">${opt(ATTITUDES, f.attitude, "Toutes attitudes")}</select>
        <select data-filter="vie">${opt(VIE, f.vie, "Morts et vivants")}</select>
      </div>
      <p class="flc-hint">${list.length} personnage${list.length > 1 ? "s" : ""}. Un clic : la fiche résumée à droite. Un second clic sur le même nom : sa description officielle dans le livre.</p>
      <table class="flc-table"><thead><tr><th>Qui</th><th>Où maintenant</th><th>Ce qu'il veut</th><th>Envers les PJ</th></tr></thead><tbody>
      ${list.map((r) => `<tr class="${this.sel === r.key ? "sel" : ""} ${r.vie === "mort" ? "dead" : ""}" data-sel="${r.key}">
        <td><b>${esc(r.nom)}</b>${r.majeur ? ` <span class="flc-tag">majeur</span>` : ""}${r.rencontre ? ` <i class="fa-solid fa-eye" data-tooltip="Déjà rencontré par les PJ"></i>` : ""}<br><span class="flc-hint">${esc(r.role ?? "")}</span></td>
        <td>${esc(r.ou)}${r.vie !== "vivant" ? `<br><span class="flc-tag ${r.vie}">${lab(VIE, r.vie)}</span>` : ""}</td>
        <td>${esc(r.veut)}</td><td><span class="flc-att ${r.attitude}">${lab(ATTITUDES, r.attitude)}</span></td></tr>`).join("")}
      </tbody></table></div>
      <aside class="flc-detail">${this.#detail(I, e)}</aside></div>`;
  }

  /* ---------- Fiches ---------- */
  #detail(I, e) {
    if (!this.sel) return `<p class="flc-hint">Choisissez quelqu'un ou quelque chose à gauche.</p>`;
    const [type, ...rest] = this.sel.split(":");
    const id = rest.join(":");
    if (type === "majeur") return this.#ficheMajeur(I, e, I.majeurs.find((a) => a.id === id));
    if (type === "pnj") return this.#fichePnj(I, e, I.pnj.find((p) => p._key === id));
    if (type === "site") return this.#ficheSite(I, e, I.siteById[id]);
    return "";
  }

  #people(I, list) { return arr(list).map((x) => esc(personName(I, x))).join(", ") || "—"; }
  #bullets(list) { const l = arr(list).filter(Boolean); return l.length ? `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="flc-hint">Le livre ne le précise pas.</p>`; }

  #fichePnj(I, e, p) {
    if (!p) return "";
    const w = wherePnj(p, e);
    const k = p._key;
    const siteOpts = I.sites.map((s) => `<option value="${s.id}"${w.site === s.id ? " selected" : ""}>${esc(s.nom)}</option>`).join("") + `<option value="ailleurs"${w.site === "ailleurs" ? " selected" : ""}>Ailleurs (voir lieu)</option>`;
    const site = I.siteById[p._site];
    return `<div class="flc-fiche">
      <h2><a data-official="pnj:${k}" data-tooltip="Ouvrir la description officielle du livre">${esc(p.nom)} <i class="fa-solid fa-book-open flc-official-ico"></i></a></h2>
      <p class="flc-sub">${esc([p.peuple, p.role, p.faction].filter(Boolean).join(" · "))}</p>
      <button type="button" class="flc-official" data-official="pnj:${k}"><i class="fa-solid fa-book-open"></i> Description officielle (le livre)</button>
      <div class="flc-key">
        <p><span>Où</span> ${esc(siteName(I, w.site))}${w.lieu ? ` — ${esc(w.lieu)}` : ""}</p>
        <p><span>Veut</span> ${esc(arr(p.veut).join(" ; ") || "—")}</p>
        <p><span>Envers les PJ</span> <b class="flc-att ${w.attitude}">${lab(ATTITUDES, w.attitude)}</b></p>
      </div>
      <h4>Ce qu'il sait</h4>${this.#bullets(p.sait)}
      <h4>Alliés</h4><p>${this.#people(I, p.allies)}</p>
      <h4>Ennemis</h4><p>${this.#people(I, p.ennemis)}</p>
      ${p.notes ? `<h4>Pour le jouer</h4><p>${esc(p.notes)}</p>` : ""}
      <h4>Dans votre partie</h4>
      <div class="flc-edit">
        <label>Où il est maintenant <select data-path="pnj.${k}.site">${siteOpts}</select></label>
        <label>Lieu précis <input type="text" value="${esc(w.lieu)}" data-path="pnj.${k}.lieu"></label>
        <label>Attitude <select data-path="pnj.${k}.attitude">${ATTITUDES.map(([v, l]) => `<option value="${v}"${w.attitude === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>État <select data-path="pnj.${k}.vie">${VIE.map(([v, l]) => `<option value="${v}"${w.vie === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="flc-check"><input type="checkbox" data-path="pnj.${k}.rencontre" ${w.rencontre ? "checked" : ""}> Déjà rencontré par les PJ</label>
        <label>Vos notes <textarea data-path="pnj.${k}.notes" rows="3">${esc(w.notes)}</textarea></label>
      </div>
      <div class="flc-buttons">
        ${p.acteur_foundry ? `<button type="button" data-actor="${esc(p.acteur_foundry)}" data-actor-fr="${esc(p.acteur_foundry_fr ?? "")}"><i class="fa-solid fa-id-card"></i> Fiche de jeu</button>` : ""}
        ${site ? `<button type="button" data-book="${esc(site.journal_en)}|${esc(site.journal_fr)}"><i class="fa-solid fa-book"></i> Page du site</button>` : ""}
        ${site ? `<button type="button" data-sel="site:${site.id}"><i class="fa-solid fa-map"></i> Fiche du site</button>` : ""}
      </div></div>`;
  }

  #ficheMajeur(I, e, a) {
    if (!a) return "";
    const w = whereMajeur(a, e);
    const k = a.id;
    return `<div class="flc-fiche">
      <h2><a data-official="majeur:${k}" data-tooltip="Ouvrir la description officielle du livre">${esc(a.nom)} <i class="fa-solid fa-book-open flc-official-ico"></i></a> <span class="flc-tag">acteur majeur</span></h2>
      <p class="flc-sub">${esc([a.type === "faction" ? "Faction" : a.peuple, a.role].filter(Boolean).join(" · "))}</p>
      <button type="button" class="flc-official" data-official="majeur:${k}"><i class="fa-solid fa-book-open"></i> Description officielle (le livre)</button>
      <div class="flc-key">
        <p><span>Où</span> ${esc(w.ou || "—")}</p>
        <p><span>Veut</span> ${esc(arr(a.veut).join(" ; ") || "—")}</p>
        <p><span>Si les PJ ne font rien</span> ${esc(a.plan || "—")}</p>
        <p><span>Envers les PJ</span> <b class="flc-att ${w.relation}">${lab(ATTITUDES, w.relation)}</b></p>
      </div>
      <h4>Ce qu'il sait</h4>${this.#bullets(a.sait)}
      <h4>Ce qu'il possède</h4>${this.#bullets(a.possede)}
      <h4>Alliés</h4><p>${this.#people(I, a.allies)}</p>
      <h4>Ennemis</h4><p>${this.#people(I, a.ennemis)}</p>
      ${a.comment_les_pj_le_rencontrent ? `<h4>Comment les PJ le rencontrent</h4><p>${esc(a.comment_les_pj_le_rencontrent)}</p>` : ""}
      ${a.ce_qu_il_propose_aux_pj ? `<h4>Ce qu'il propose aux PJ</h4><p>${esc(a.ce_qu_il_propose_aux_pj)}</p>` : ""}
      ${arr(a.sites_lies).length ? `<h4>Sites liés</h4><p>${arr(a.sites_lies).map((s) => `<a data-sel="site:${s}">${esc(siteName(I, s))}</a>`).join(", ")}</p>` : ""}
      ${a.notes_mj ? `<h4>Notes du livre</h4><p>${esc(a.notes_mj)}</p>` : ""}
      <h4>Dans votre partie</h4>
      <div class="flc-edit">
        <label>Où il est maintenant <input type="text" value="${esc(w.ou)}" data-path="acteurs.${k}.ou"></label>
        <label>Relation aux PJ <select data-path="acteurs.${k}.relation">${ATTITUDES.map(([v, l]) => `<option value="${v}"${w.relation === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>État <select data-path="acteurs.${k}.vie">${VIE.map(([v, l]) => `<option value="${v}"${w.vie === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="flc-check"><input type="checkbox" data-path="acteurs.${k}.rencontre" ${w.rencontre ? "checked" : ""}> Déjà rencontré par les PJ</label>
        <label>Vos notes <textarea data-path="acteurs.${k}.notes" rows="3">${esc(w.notes)}</textarea></label>
      </div>
      <div class="flc-buttons">
        ${a.acteur_foundry ? `<button type="button" data-actor="${esc(a.acteur_foundry)}" data-actor-fr="${esc(a.acteur_foundry_fr ?? "")}"><i class="fa-solid fa-id-card"></i> Fiche de jeu</button>` : ""}
        ${a.journal_en ? `<button type="button" data-book="${esc(a.journal_en)}|${esc(a.journal_fr ?? "")}" data-page="${esc(a.page_en ?? "")}|${esc(a.page_fr ?? "")}"><i class="fa-solid fa-book"></i> Dans le livre</button>` : ""}
      </div></div>`;
  }

  /* ---------- Sites ---------- */
  #sites(I, e) {
    const list = I.sites.map((s) => {
      const st = e.sites[s.id]?.statut ?? "inconnu";
      const n = I.pnj.filter((p) => wherePnj(p, e).site === s.id && wherePnj(p, e).vie !== "mort").length;
      return `<tr class="${this.sel === `site:${s.id}` ? "sel" : ""}" data-sel="site:${s.id}"><td><b>${esc(s.nom)}</b><br><span class="flc-hint">${esc(s.categorie ?? "")}${s.terrain ? ` · ${esc(s.terrain)}` : ""}</span></td>
        <td><span class="flc-status ${st}">${lab(SITE_STATUS, st)}</span></td><td>${n}</td></tr>`;
    }).join("");
    return `<div class="flc-split"><div class="flc-scroll">
      <table class="flc-table"><thead><tr><th>Site</th><th>Pour les PJ</th><th>PNJ sur place</th></tr></thead><tbody>${list}</tbody></table></div>
      <aside class="flc-detail">${this.sel?.startsWith("site:") ? this.#detail(I, e) : `<p class="flc-hint">Choisissez un site.</p>`}</aside></div>`;
  }

  #ficheSite(I, e, s) {
    if (!s) return "";
    const st = e.sites[s.id] ?? {};
    const k = s.id;
    const faits = st.evenementsFaits ?? {};
    const dites = st.rumeursDites ?? {};
    const vus = st.lieuxVisites ?? {};
    const present = I.pnj.filter((p) => wherePnj(p, e).site === s.id);
    const venus = present.filter((p) => p._site !== s.id);
    const partis = I.pnj.filter((p) => p._site === s.id && wherePnj(p, e).site !== s.id);
    const majeurs = I.majeurs.filter((a) => arr(a.sites_lies).includes(s.id));
    return `<div class="flc-fiche">
      <h2>${esc(s.nom)}</h2>
      <p class="flc-sub">${esc([s.categorie, s.terrain].filter(Boolean).join(" · "))}</p>
      <div class="flc-edit flc-inline">
        <label>Pour les PJ <select data-path="sites.${k}.statut">${SITE_STATUS.map(([v, l]) => `<option value="${v}"${(st.statut ?? "inconnu") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Hexagone <input type="text" value="${esc(st.hex ?? "")}" data-path="sites.${k}.hex" placeholder="ex. N12"></label>
      </div>
      <div class="flc-key">
        <p><span>En bref</span> ${esc(s.resume_mj ?? "")}</p>
        ${s.acces ? `<p><span>Comment y aller</span> ${esc(s.acces)}</p>` : ""}
        ${s.legende ? `<p><span>Légende</span> ${esc(s.legende)}</p>` : ""}
      </div>
      ${arr(s.secrets_mj).length ? `<h4>Secrets (MJ)</h4>${this.#bullets(s.secrets_mj)}` : ""}
      ${arr(s.artefacts).filter(Boolean).length ? `<h4>Artefacts</h4>${this.#bullets(s.artefacts)}` : ""}
      ${majeurs.length ? `<h4>Acteurs majeurs liés</h4><p>${majeurs.map((a) => `<a data-sel="majeur:${a.id}">${esc(a.nom)}</a>`).join(", ")}</p>` : ""}
      <h4>Qui est ici maintenant (${present.length})</h4>
      <ul class="flc-people">${present.map((p) => { const w = wherePnj(p, e); return `<li class="${w.vie === "mort" ? "dead" : ""}"><a data-sel="pnj:${p._key}">${esc(p.nom)}</a> — <span class="flc-hint">${esc(w.lieu || p.role || "")}</span> <span class="flc-att ${w.attitude}">${lab(ATTITUDES, w.attitude)}</span>${w.vie !== "vivant" ? ` <span class="flc-tag">${lab(VIE, w.vie)}</span>` : ""}</li>`; }).join("") || "<li class='flc-hint'>personne</li>"}</ul>
      ${venus.length ? `<p class="flc-hint">Arrivés d'ailleurs : ${venus.map((p) => esc(p.nom)).join(", ")}</p>` : ""}
      ${partis.length ? `<p class="flc-hint">Partis d'ici : ${partis.map((p) => `${esc(p.nom)} (→ ${esc(siteName(I, wherePnj(p, e).site))})`).join(", ")}</p>` : ""}
      <h4>Lieux (${arr(s.lieux).length})</h4>
      ${arr(s.lieux).map((l) => `<details class="flc-lieu"><summary><label class="flc-check" onclick="event.stopPropagation()"><input type="checkbox" data-path="sites.${k}.lieuxVisites.${esc(l.id)}" ${vus[l.id] ? "checked" : ""}></label> <b>${esc(l.id)}. ${esc(l.nom)}</b></summary>
        <p>${esc(l.resume ?? "")}</p>
        ${arr(l.pnj).length ? `<p><span class="flc-hint">PNJ :</span> ${arr(l.pnj).map((x) => esc(personName(I, x))).join(", ")}</p>` : ""}
        ${l.tresor ? `<p><span class="flc-hint">Trésor :</span> ${esc(l.tresor)}</p>` : ""}
        ${l.page_en || l.page_fr ? (() => { const b = lieuBook(s, l); return `<button type="button" class="flc-small" data-book="${esc(b.journals.join("|"))}" data-page="${esc(b.pages.join("|"))}"><i class="fa-solid fa-book"></i> Lire dans le livre</button>`; })() : ""}
      </details>`).join("")}
      <h4>Événements</h4>
      ${arr(s._ev).map((v) => `<details class="flc-lieu"><summary><label class="flc-check" onclick="event.stopPropagation()"><input type="checkbox" data-path="sites.${k}.evenementsFaits.${esc(v.id)}" ${faits[v.id] ? "checked" : ""}></label> <b>${esc(v.titre)}</b></summary>
        ${v.declencheur ? `<p><span class="flc-hint">Quand :</span> ${esc(v.declencheur)}</p>` : ""}<p>${esc(v.resume ?? "")}</p>${v.consequences ? `<p><span class="flc-hint">Ensuite :</span> ${esc(v.consequences)}</p>` : ""}</details>`).join("") || "<p class='flc-hint'>—</p>"}
      <h4>Rumeurs à glisser <button type="button" class="flc-small" data-rumeur="${s.id}"><i class="fa-solid fa-dice"></i> Tirer une rumeur</button></h4>
      ${arr(s._rum).map((r, i) => `<label class="flc-check flc-rumeur"><input type="checkbox" data-path="sites.${k}.rumeursDites.${i}" ${dites[i] ? "checked" : ""}> ${esc(r.texte)} ${r.vraie === false ? `<span class="flc-tag faux">fausse</span>` : ""}${r.menant_a ? ` <span class="flc-hint">→ ${esc(I.siteById[r.menant_a]?.nom ?? s._pnj.find((p) => p.id === r.menant_a)?.nom ?? personName(I, r.menant_a))}</span>` : ""}</label>`).join("") || "<p class='flc-hint'>—</p>"}
      ${arr(s.liens).length ? `<h4>Liens avec le reste de la campagne</h4><ul>${arr(s.liens).map((l) => `<li><a data-sel="${I.siteById[l.vers] ? `site:${l.vers}` : I.majeurs.find((a) => a.id === l.vers) ? `majeur:${l.vers}` : ""}">${esc(siteName(I, l.vers) !== l.vers ? siteName(I, l.vers) : personName(I, l.vers))}</a> : ${esc(l.pourquoi)}</li>`).join("")}</ul>` : ""}
      <h4>Vos notes</h4><textarea data-path="sites.${k}.notes" rows="4">${esc(st.notes ?? "")}</textarea>
      <div class="flc-buttons"><button type="button" data-book="${esc(s.journal_en)}|${esc(s.journal_fr)}"><i class="fa-solid fa-book"></i> Ouvrir le site dans le livre</button></div>
    </div>`;
  }

  /* ---------- Acteurs majeurs ---------- */
  #acteurs(I, e) {
    const cards = I.majeurs.map((a) => {
      const w = whereMajeur(a, e);
      return `<div class="flc-card flc-click ${this.sel === `majeur:${a.id}` ? "sel" : ""} ${w.vie === "mort" ? "dead" : ""}" data-sel="majeur:${a.id}">
        <h3>${esc(a.nom)}</h3><p class="flc-hint">${esc(a.role ?? "")}</p>
        <p><b>Où :</b> ${esc(w.ou || "—")}</p><p><b>Veut :</b> ${esc(arr(a.veut)[0] ?? "—")}</p>
        <p><span class="flc-att ${w.relation}">${lab(ATTITUDES, w.relation)}</span> ${w.rencontre ? `<i class="fa-solid fa-eye" data-tooltip="Déjà rencontré"></i>` : ""}</p></div>`;
    }).join("");
    return `<div class="flc-split"><div class="flc-scroll flc-cards">${cards}</div><aside class="flc-detail">${this.sel?.startsWith("majeur:") ? this.#detail(I, e) : `<p class="flc-hint">Choisissez un acteur majeur.</p>`}</aside></div>`;
  }

  /* ---------- Artefacts ---------- */
  #artefacts(I, e) {
    return `<div class="flc-scroll flc-cards">${I.artefacts.map((a) => {
      const s = e.artefacts[a.id] ?? {};
      return `<div class="flc-card flc-wide2"><h3>${esc(a.nom)}</h3><p>${esc(a.description_courte ?? "")}</p>
        ${arr(a.pouvoirs).length ? `<h4>Pouvoirs</h4>${this.#bullets(a.pouvoirs)}` : ""}
        <p><b>Dans le livre :</b> ${esc(a.emplacement_par_defaut ?? "—")}</p>
        <p><b>Qui le cherche :</b> ${this.#people(I, a.qui_le_cherche)}</p>
        <div class="flc-edit">
          <label>Où il est dans votre partie <input type="text" value="${esc(s.ou ?? "")}" placeholder="${esc(a.emplacement_par_defaut ?? "")}" data-path="artefacts.${a.id}.ou"></label>
          <label>Qui le détient <input type="text" value="${esc(s.detenteur ?? "")}" placeholder="personne" data-path="artefacts.${a.id}.detenteur"></label>
          <label>Notes <textarea rows="2" data-path="artefacts.${a.id}.notes">${esc(s.notes ?? "")}</textarea></label>
        </div>
        ${a.journal_en ? `<button type="button" class="flc-small" data-book="${esc(a.journal_en)}|${esc(a.journal_fr ?? "")}" data-page="${esc(a.page_en ?? "")}|${esc(a.page_fr ?? "")}"><i class="fa-solid fa-book"></i> Dans le livre</button>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  /* ---------- Légendes ---------- */
  #legendes(I, e) {
    return `<div class="flc-scroll">
      <p class="flc-hint">Le livre conseille de présenter <b>une légende par session</b> : c'est ainsi que les joueurs apprennent ce qui se joue. Cochez-les au fur et à mesure.</p>
      <table class="flc-table"><thead><tr><th></th><th>Légende</th><th>Sujet</th><th></th></tr></thead><tbody>
      ${I.legendes.map((l, i) => { const s = e.legendes[i] ?? {}; return `<tr class="${s.lue ? "done" : ""}"><td><input type="checkbox" data-path="legendes.${i}.lue" ${s.lue ? "checked" : ""}></td>
        <td><b>${esc(l.titre)}</b></td><td>${esc(l.sujet ?? "")}<br><span class="flc-hint">${esc(l.site_ou_acteur ?? "")}</span></td>
        <td class="flc-nowrap">${l.journal_en ? `<button type="button" class="flc-small" data-book="${esc(l.journal_en)}|${esc(l.journal_fr ?? "")}" data-page="${esc(l.page_en ?? "")}|${esc(l.page_fr ?? "")}">Lire</button>
          <button type="button" class="flc-small" data-show="${esc(l.journal_en)}|${esc(l.journal_fr ?? "")}" data-page="${esc(l.page_en ?? "")}|${esc(l.page_fr ?? "")}">Montrer aux joueurs</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }

  /* ---------- Horloges & événements ---------- */
  #temps(I, e) {
    const t = today();
    const chrono = arr(I.campagne.chronologie);
    return `<div class="flc-scroll flc-board">
      <div class="flc-card flc-wide">
        <h3>Horloges</h3>
        <p class="flc-hint">Une horloge = une menace ou un projet qui avance. Cliquez sur une case pour la remplir ou la vider.</p>
        ${e.horloges.map((h) => `<div class="flc-clock-row">${this.#clock(h)}<button type="button" class="flc-small" data-del-clock="${h.id}" data-tooltip="Supprimer"><i class="fa-solid fa-trash"></i></button></div>`).join("") || "<p class='flc-hint'>Aucune horloge.</p>"}
        <div class="flc-row"><input type="text" placeholder="Nom de l'horloge (ex. « Zytera rassemble son armée »)" data-new="clock-nom"><select data-new="clock-seg">${[4, 6, 8, 10, 12].map((n) => `<option value="${n}"${n === 6 ? " selected" : ""}>${n} cases</option>`).join("")}</select><button type="button" data-act="add-clock">Ajouter</button></div>
      </div>
      <div class="flc-card flc-wide">
        <h3>Événements datés</h3>
        <p class="flc-hint">Aujourd'hui : ${esc(t.label || `jour ${t.day}`)}. Un événement daté s'affiche sur le tableau quand sa date approche, et un rappel vous est chuchoté le jour venu.</p>
        <table class="flc-table"><tbody>${e.evenements.sort((a, b) => (a.jour ?? 1e9) - (b.jour ?? 1e9)).map((v) => `<tr class="${v.fait ? "done" : v.jour <= t.day ? "due" : ""}">
          <td><input type="checkbox" data-ev-done="${v.id}" ${v.fait ? "checked" : ""}></td><td><b>${esc(v.titre)}</b>${v.notes ? `<br><span class="flc-hint">${esc(v.notes)}</span>` : ""}</td>
          <td>${esc(dayLabel(v.jour))}</td><td><button type="button" class="flc-small" data-del-ev="${v.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("") || "<tr><td class='flc-hint'>Aucun événement daté.</td></tr>"}</tbody></table>
        <div class="flc-row"><input type="text" placeholder="Ce qui arrive" data-new="ev-titre"><button type="button" data-act="add-ev">Mettre au calendrier…</button></div>
      </div>
      ${chrono.length ? `<div class="flc-card flc-wide"><h3>Chronologie du livre</h3><p class="flc-hint">Ce qui se passe dans le monde si les PJ n'interviennent pas. Ajoutez-en à votre calendrier avec le bouton.</p>
        <table class="flc-table"><tbody>${chrono.map((c, i) => `<tr><td>${esc(c.quand ?? "")}</td><td>${esc(c.evenement ?? "")}${c.acteur ? `<br><span class="flc-hint">${esc(personName(I, c.acteur))}</span>` : ""}</td>
          <td><button type="button" class="flc-small" data-chrono="${i}">Dater</button></td></tr>`).join("")}</tbody></table></div>` : ""}
    </div>`;
  }

  /* ---------- Sessions ---------- */
  #sessions(I, e) {
    const p = e.preparation;
    const t = today();
    const here = I.siteById[e.groupe.site];
    const ideas = [];
    const nl = I.legendes.findIndex((l, i) => !e.legendes[i]?.lue);
    if (nl >= 0) ideas.push(`Légende à présenter : <b>${esc(I.legendes[nl].titre)}</b>`);
    if (here) {
      const ev = arr(here._ev).filter((v) => !(e.sites[here.id]?.evenementsFaits ?? {})[v.id]);
      if (ev.length) ideas.push(`Événements pas encore joués à ${esc(here.nom)} : ${ev.slice(0, 4).map((v) => esc(v.titre)).join(", ")}`);
      const rum = arr(here._rum).filter((r, i) => !(e.sites[here.id]?.rumeursDites ?? {})[i]);
      if (rum.length) ideas.push(`Rumeurs à glisser ici : ${rum.length}`);
    }
    const near = e.horloges.filter((h) => h.rempli >= h.segments - 1 && h.rempli < h.segments);
    if (near.length) ideas.push(`Horloges presque pleines : ${near.map((h) => esc(h.nom)).join(", ")}`);
    const soon = e.evenements.filter((v) => !v.fait && v.jour != null && v.jour <= t.day + 7);
    if (soon.length) ideas.push(`Événements datés dans la semaine : ${soon.map((v) => esc(v.titre)).join(", ")}`);
    const f = (key, label, hint) => `<label class="flc-prep"><b>${label}</b><span class="flc-hint">${hint}</span><textarea rows="2" data-path="preparation.${key}">${esc(p[key] ?? "")}</textarea></label>`;
    return `<div class="flc-split flc-split-even"><div class="flc-scroll">
      <h3>Préparer la prochaine session</h3>
      <p class="flc-hint">Les étapes que conseille le Guide du MJ, avec ce que l'outil a repéré pour vous.</p>
      ${ideas.length ? `<div class="flc-card flc-ideas"><h4>À ne pas oublier</h4><ul>${ideas.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
      ${f("suite", "1. Un événement qui découle de la dernière session", "Une conséquence directe de ce que les PJ ont fait.")}
      ${f("sites", "2. Le site où ils vont, ou un ou deux sites proches", "Relisez-le ; faites-leur entendre la légende. Présentez-leur des choix.")}
      ${f("rencontre", "3. Une rencontre prête", "Choisie ou tirée aux dés à l'avance, pour ne pas vous interrompre.")}
      ${f("pj", "4. Un ou deux événements pour un PJ précis", "Son passé, son serment, sa quête personnelle.")}
      ${f("legende", "5. La légende de la session", "Une par session, comme le conseille Le Châtiment du Corbeau.")}
      ${f("notes", "Autres notes", "")}
      <div class="flc-buttons"><button type="button" data-act="session-end"><i class="fa-solid fa-flag-checkered"></i> Clore la session et l'inscrire au journal</button></div>
    </div>
    <div class="flc-scroll"><h3>Journal des sessions</h3>
      ${e.sessions.slice().reverse().map((s) => `<div class="flc-card flc-session"><h4>Session ${s.numero} — ${esc(s.titre || "")}</h4><p class="flc-hint">${esc(s.dateLabel || "")}${s.lieu ? ` · ${esc(s.lieu)}` : ""}</p>
        <label class="flc-hint">Pour vous (privé)</label>
        <textarea rows="3" data-session="${s.id}" placeholder="Ce qui s'est passé, vos notes de MJ…">${esc(s.resume ?? "")}</textarea>
        <label class="flc-hint">Pour les joueurs (publié dans la chronique)</label>
        <textarea rows="2" data-session-j="${s.id}" placeholder="Ce que les PJ ont vécu, sans secret…">${esc(s.resumeJoueurs ?? "")}</textarea></div>`).join("") || "<p class='flc-hint'>Aucune session au journal.</p>"}
      <div class="flc-buttons"><button type="button" data-act="chronique"><i class="fa-solid fa-book-journal-whills"></i> Publier la chronique aux joueurs</button></div>
      <p class="flc-hint">La chronique est un journal visible par les joueurs : vos textes « pour les joueurs », les personnes rencontrées, les lieux visités et les légendes entendues. Jamais vos notes privées ni les secrets.</p>
    </div></div>`;
  }

  /* ---------- Les PJ ---------- */
  #pj(I, e) {
    const pcs = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
    return `<div class="flc-scroll flc-cards">${pcs.map((a) => {
      const s = e.pj[a.id] ?? {};
      const serment = a.getFlag("fl-temps", "serment")?.text;
      return `<div class="flc-card flc-wide2"><h3>${esc(a.name)}</h3><p class="flc-hint">${esc([a.system.bio?.kin?.value, a.system.bio?.profession?.value].filter(Boolean).join(" · "))}</p>
        ${serment ? `<p><b>Serment de la Mi-hiver :</b> « ${esc(serment)} »</p>` : ""}
        <div class="flc-edit">
          <label>Son passé et ses secrets <textarea rows="3" data-path="pj.${a.id}.passe">${esc(s.passe ?? "")}</textarea></label>
          <label>Ce qu'il cherche <textarea rows="2" data-path="pj.${a.id}.buts">${esc(s.buts ?? "")}</textarea></label>
          <label>Fils à tirer pour lui <textarea rows="2" data-path="pj.${a.id}.fils">${esc(s.fils ?? "")}</textarea></label>
        </div></div>`;
    }).join("") || "<p class='flc-hint'>Aucun personnage joueur.</p>"}</div>`;
  }

  /* ---------- Interactions ---------- */
  _onRender() {
    const el = this.element;
    el.addEventListener("click", (ev) => this.#click(ev));
    el.addEventListener("change", (ev) => this.#change(ev));
    el.addEventListener("mouseover", (ev) => {
      const n = ev.target.closest?.(".flc-node");
      const svg = el.querySelector(".flc-graph");
      if (!svg) return;
      svg.querySelectorAll(".hi").forEach((x) => x.classList.remove("hi"));
      svg.classList.toggle("focus", !!n);
      if (!n) return;
      const k = n.dataset.node;
      n.classList.add("hi");
      svg.querySelectorAll(".flc-edge").forEach((l) => {
        if (l.dataset.a !== k && l.dataset.b !== k) return;
        l.classList.add("hi");
        svg.querySelector(`.flc-node[data-node="${CSS.escape(l.dataset.a === k ? l.dataset.b : l.dataset.a)}"]`)?.classList.add("hi");
      });
    });
    el.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.dataset.filter === "texte") { this.filtre.texte = t.value; clearTimeout(this._ft); this._ft = setTimeout(() => this.render(), 250); }
    });
  }

  /* ---------- Relations ---------- */
  #relations(I, e) {
    const site = this.relSite;
    const keys = new Set();
    if (site) {
      for (const p of I.pnj) if (p._site === site) keys.add(`pnj:${p._key}`);
      for (const a of I.majeurs) if (arr(a.sites_lies).includes(site)) keys.add(`majeur:${a.id}`);
    } else for (const a of I.majeurs) keys.add(`majeur:${a.id}`);
    const info = (k) => {
      const [type, ...r] = k.split(":"); const id = r.join(":");
      if (type === "majeur") { const a = I.majeurs.find((x) => x.id === id); const w = whereMajeur(a, e); return { k, nom: a.nom, allies: a.allies, ennemis: a.ennemis, site: null, att: w.relation, vie: w.vie, majeur: true }; }
      const p = I.pnj.find((x) => x._key === id); const w = wherePnj(p, e); return { k, nom: p.nom, allies: p.allies, ennemis: p.ennemis, site: p._site, att: w.attitude, vie: w.vie, majeur: !!p.majeur };
    };
    // ajoute les acteurs majeurs cités par les PNJ du site
    if (site) for (const k of [...keys]) { const n = info(k); for (const r of [...arr(n.allies), ...arr(n.ennemis)]) { const rk = refKey(I, r, n.site ?? site); if (rk?.startsWith("majeur:")) keys.add(rk); } }
    const nodes = [...keys].map(info);
    const byKey = Object.fromEntries(nodes.map((n) => [n.k, n]));
    const edges = new Map();
    for (const n of nodes) for (const [list, kind] of [[n.allies, "allie"], [n.ennemis, "ennemi"]]) for (const r of arr(list)) {
      const rk = refKey(I, r, n.site ?? site);
      if (!rk || !byKey[rk] || rk === n.k) continue;
      const id = [n.k, rk].sort().join("|");
      const prev = edges.get(id);
      edges.set(id, { a: n.k, b: rk, kind: prev && prev.kind !== kind ? "mixte" : kind });
    }
    const W = 1000, H = 660, cx = W / 2, cy = H / 2;
    const linked = new Set([...edges.values()].flatMap((x) => [x.a, x.b]));
    const shown = nodes.filter((n) => linked.has(n.k) || n.majeur || site);
    const inner = shown.filter((n) => n.majeur && site), outer = shown.filter((n) => !(n.majeur && site));
    const place = (list, rx, ry) => list.forEach((n, i) => { const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2; n.x = cx + rx * Math.cos(a); n.y = cy + ry * Math.sin(a); });
    place(outer, W / 2 - 110, H / 2 - 50); place(inner, 170, 120);
    const pos = Object.fromEntries(shown.map((n) => [n.k, n]));
    const lines = [...edges.values()].filter((x) => pos[x.a] && pos[x.b]).map((x) => `<line class="flc-edge ${x.kind}" data-a="${esc(x.a)}" data-b="${esc(x.b)}" x1="${pos[x.a].x}" y1="${pos[x.a].y}" x2="${pos[x.b].x}" y2="${pos[x.b].y}"/>`).join("");
    const dots = shown.map((n) => `<g class="flc-node ${n.vie === "mort" ? "dead" : ""}" data-node="${esc(n.k)}" transform="translate(${n.x},${n.y})">
      <circle r="${n.majeur ? 9 : 6}" class="att-${n.att}"/><text y="${n.majeur ? -14 : -10}" text-anchor="middle">${esc(n.nom.replace(/\s*\(.*\)$/, "").slice(0, 28))}</text></g>`).join("");
    const opts = `<option value="">Acteurs majeurs (toute la campagne)</option>` + I.sites.map((x) => `<option value="${x.id}"${site === x.id ? " selected" : ""}>${esc(x.nom)}</option>`).join("");
    return `<div class="flc-scroll">
      <div class="flc-row"><label>Montrer</label><select data-rel-site>${opts}</select>
        <span class="flc-legend"><i class="l allie"></i> alliés <i class="l ennemi"></i> ennemis <i class="l mixte"></i> les deux</span></div>
      <p class="flc-hint">D'après le livre (champs alliés/ennemis des fiches). La couleur du point = leur attitude envers les PJ dans votre partie. Survolez pour isoler ses liens, cliquez pour ouvrir sa fiche.</p>
      <svg class="flc-graph" viewBox="0 0 ${W} ${H}">${lines}${dots}</svg></div>`;
  }

  /* ---------- Vers Vond : assaut et fins ---------- */
  #vond(I, e) {
    const A = I.campagne.assaut_vond ?? {};
    const st = e.assaut ?? {};
    const maj = (id) => I.majeurs.find((a) => a.id === id);
    const etatDe = (id) => { const a = maj(id); return a ? whereMajeur(a, e) : null; };
    const vivant = (id) => { const w = etatDe(id); return !w || !["mort", "captif", "disparu"].includes(w.vie); };
    const defOn = (x, i) => st.def?.[i] ?? (x.acteur ? vivant(x.acteur) && etatDe(x.acteur)?.relation !== "allie" : true);
    const attOn = (x, i) => st.att?.[i] ?? (x.acteur ? (etatDe(x.acteur)?.relation === "allie" && vivant(x.acteur)) : false);
    const badge = (id) => { const w = etatDe(id); if (!w) return ""; return `<span class="flc-att ${w.relation}">${lab(ATTITUDES, w.relation)}</span>${w.vie !== "vivant" ? ` <span class="flc-tag">${lab(VIE, w.vie)}</span>` : ""}`; };
    const row = (side, x, i, on) => `<tr class="${on ? "" : "off"}"><td><input type="checkbox" data-path="assaut.${side}.${i}" ${on ? "checked" : ""}></td>
      <td><b>${x.acteur && maj(x.acteur) ? `<a data-sel="majeur:${x.acteur}">${esc(x.qui)}</a>` : esc(x.qui)}</b>${x.condition ? `<br><span class="flc-hint">${esc(x.condition)}</span>` : ""}</td>
      <td>${x.acteur ? badge(x.acteur) : ""}</td><td class="flc-bonus">${x.bonus > 0 ? "+" : ""}${x.bonus ?? ""}</td><td class="flc-hint">${x.page ? `p. ${x.page}` : ""}</td></tr>`;
    const def = arr(A.defense), att = arr(A.attaque);
    const totDef = (A.defense_base ?? 0) + def.reduce((t, x, i) => t + (defOn(x, i) ? Number(x.bonus) || 0 : 0), 0);
    const totAtt = (A.attaque_base ?? 0) + att.reduce((t, x, i) => t + (attOn(x, i) ? Number(x.bonus) || 0 : 0), 0);
    const fins = arr(I.campagne.fins_possibles);
    const touche = (f) => arr(f.acteurs).some((id) => { const w = etatDe(id); return w && (w.vie !== "vivant" || ["allie", "ennemi"].includes(w.relation)); });
    const cond = arr(I.campagne.conditions_confrontation_finale);
    const condDone = e.preparation.conditions ?? {};
    return `<div class="flc-scroll flc-board">
      ${cond.length ? `<div class="flc-card flc-wide"><h3>Conditions de la confrontation finale</h3>
        ${cond.map((c, i) => `<label class="flc-check"><input type="checkbox" data-path="preparation.conditions.${i}" ${condDone[i] ? "checked" : ""}> ${esc(c)}</label>`).join("")}</div>` : ""}
      ${A.defense || A.attaque ? `<div class="flc-card flc-wide"><h3>L'assaut de Vond</h3>
        ${A.regles ? `<p>${esc(A.regles)}</p>` : ""}
        <p class="flc-hint">Cochez qui participe. Par défaut : les défenseurs encore en vie, et les attaquants que vous avez marqués « Allié des PJ ». Les bonus sont ceux du livre.</p>
        <div class="flc-assaut">
          <div><h4>Défense de Vond — total <b class="flc-total">${totDef}</b></h4>
            <p class="flc-hint">Base : ${A.defense_base ?? "—"}</p>
            <table class="flc-table"><tbody>${def.map((x, i) => row("def", x, i, defOn(x, i))).join("")}</tbody></table></div>
          <div><h4>Attaque des alliés — total <b class="flc-total">${totAtt}</b></h4>
            <p class="flc-hint">${A.attaque_base != null ? `Base : ${A.attaque_base}` : "Pas de base : la somme des forces rassemblées."}</p>
            <table class="flc-table"><tbody>${att.map((x, i) => row("att", x, i, attOn(x, i))).join("")}</tbody></table></div>
        </div>
        ${A.seuils_pertes ? `<p><b>Résultats :</b> ${esc(A.seuils_pertes)}</p>` : ""}
      </div>` : `<div class="flc-card flc-wide"><p class="flc-hint">Le tableau de l'assaut n'est pas dans votre fichier de campagne : importez la dernière version.</p></div>`}
      <div class="flc-card flc-wide"><h3>Les fins possibles (${fins.length})</h3>
        <p class="flc-hint">Ce que le livre prévoit selon ce qui arrive à Vond. <span class="flc-touche-ex">Surlignées</span> : un personnage concerné a changé dans votre partie (mort, allié, ennemi…).</p>
        ${fins.map((f, i) => `<div class="flc-fin ${touche(f) ? "touche" : ""} ${e.fins?.[i] ? "done" : ""}">
          <label class="flc-check"><input type="checkbox" data-path="fins.${i}" ${e.fins?.[i] ? "checked" : ""}> <span><b>Si</b> ${esc(f.si)}<br><b>Alors</b> ${esc(f.alors)}</span></label>
          ${arr(f.acteurs).length ? `<p class="flc-fin-who">${arr(f.acteurs).map((id) => maj(id) ? `<a data-sel="majeur:${id}">${esc(maj(id).nom.replace(/\s*\(.*\)$/, ""))}</a> ${badge(id)}` : esc(id)).join(" · ")}</p>` : ""}
        </div>`).join("")}
      </div></div>`;
  }

  /* ---------- Ce que le livre prévoit ensuite ---------- */
  async #suitesEvenement(siteId, evId) {
    const I = index();
    const s = I.siteById[siteId];
    const v = arr(s?._ev).find((x) => String(x.id) === String(evId));
    if (!v?.consequences) return;
    const choix = await foundry.applications.api.DialogV2.wait({
      window: { title: `Ensuite — ${v.titre}` },
      content: `<div class="flc-dlg"><p class="flc-hint">D'après le livre (${esc(s.nom)}) :</p><p>${esc(v.consequences)}</p></div>`,
      buttons: [{ action: "date", label: "Mettre au calendrier", icon: "fa-solid fa-calendar-plus" }, { action: "clock", label: "Créer une horloge", icon: "fa-solid fa-clock" }, { action: "close", label: "Fermer", default: true }],
      rejectClose: false
    });
    const e = current();
    if (choix === "date") {
      const jour = await askDay(`Suite : ${v.titre}`);
      if (jour == null) return;
      e.evenements.push({ id: uid(), titre: `Suite : ${v.titre}`, notes: v.consequences, jour, fait: false });
    } else if (choix === "clock") e.horloges.push({ id: uid(), nom: `Suite : ${v.titre}`, segments: 6, rempli: 0 });
    else return;
    saveEtat(e); this.render();
  }

  async #suitesPersonne(key, value) {
    const I = index();
    const [type, ...r] = key.split(":"); const id = r.join(":");
    const who = type === "majeur" ? I.majeurs.find((a) => a.id === id) : I.pnj.find((p) => p._key === id);
    if (!who) return;
    const list = bookMentions(I, who.nom, type === "majeur" ? who.id : null);
    if (!list.length) return;
    const quoi = lab([...VIE, ...ATTITUDES], value).toLowerCase();
    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: `${who.nom} : ${quoi}` },
      content: `<div class="flc-dlg"><p class="flc-hint">Le livre parle de ${esc(who.nom)} ici. Vérifiez ce qui change dans votre partie ; cochez ce que vous voulez mettre au calendrier.</p>
        ${list.slice(0, 14).map((m, i) => `<label class="flc-check"><input type="checkbox" name="m${i}"> <span><b>${esc(m.type)}</b> — ${esc(m.lieu)} : ${esc(m.titre)}${m.texte ? `<br><span class="flc-hint">${esc(m.texte)}</span>` : ""}</span></label>`).join("")}</div>`,
      buttons: [{ action: "date", label: "Mettre les cochés au calendrier", icon: "fa-solid fa-calendar-plus", callback: (_e, b) => list.filter((_, i) => b.form.elements[`m${i}`]?.checked) }, { action: "close", label: "Fermer", default: true }],
      rejectClose: false, position: { width: 560 }
    });
    if (!Array.isArray(res) || !res.length) return;
    const jour = await askDay(`${res.length} élément(s) liés à ${who.nom}`);
    if (jour == null) return;
    const e = current();
    for (const m of res) e.evenements.push({ id: uid(), titre: m.titre, notes: `${m.type} — ${m.lieu}${m.texte ? ` : ${m.texte}` : ""}`, jour, fait: false });
    saveEtat(e); this.render();
  }

  /* ---------- Tirer une rumeur ---------- */
  async #rumeur(siteId) {
    const I = index();
    const s0 = I.siteById[siteId];
    if (!s0) return;
    const voisins = arr(s0.liens).map((l) => I.siteById[l.vers]).filter(Boolean);
    for (;;) {
      const e = current();
      const pool = [s0, ...voisins.filter((v, i, a) => a.indexOf(v) === i)].flatMap((s) => s._rum.map((r, i) => ({ s, r, i })).filter(({ i }) => !(e.sites[s.id]?.rumeursDites ?? {})[i]));
      if (!pool.length) return ui.notifications.info("Toutes les rumeurs de ce site et des sites liés ont déjà été dites.");
      const { s, r, i } = pool[Math.floor(Math.random() * pool.length)];
      const vrai = r.vraie === true ? "vraie" : r.vraie === false ? "fausse" : "ni confirmée ni démentie par le livre";
      const choix = await foundry.applications.api.DialogV2.wait({
        window: { title: "Une rumeur circule…" },
        content: `<div class="flc-dlg"><p class="flc-rumeur-txt">« ${esc(r.texte)} »</p>
          <p class="flc-hint">Rumeur ${s.id === s0.id ? "d'ici" : `venue de ${esc(s.nom)}`} · pour le MJ : ${vrai}${r.menant_a ? ` · mène vers ${esc(I.siteById[r.menant_a]?.nom ?? personName(I, r.menant_a))}` : ""}${r.note ? ` · ${esc(r.note)}` : ""}</p>
          <p class="flc-hint">Encore ${pool.length - 1} rumeur(s) non dite(s) ici et aux alentours.</p></div>`,
        buttons: [{ action: "dite", label: "Dite aux joueurs", icon: "fa-solid fa-check", default: true }, { action: "autre", label: "Une autre", icon: "fa-solid fa-dice" }, { action: "close", label: "Fermer" }],
        rejectClose: false
      });
      if (choix === "dite") { foundry.utils.setProperty(e, `sites.${s.id}.rumeursDites.${i}`, true); saveEtat(e); this.render(); return; }
      if (choix !== "autre") return;
    }
  }

  /* ---------- Chronique pour les joueurs ---------- */
  async #chronique() {
    const I = index(), e = current();
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Publier la chronique" },
      content: `<p>Créer ou mettre à jour le journal <b>« Chronique de campagne »</b>, visible par tous les joueurs ?</p><p class="flc-hint">Il contiendra : vos textes « pour les joueurs », les noms des personnes déjà rencontrées, les lieux visités et les titres des légendes entendues. Aucun secret, aucune note privée.</p>` });
    if (!ok) return;
    const li = (x) => `<li>${esc(x)}</li>`;
    const sessions = e.sessions.filter((x) => x.resumeJoueurs?.trim()).map((x) => `<h2>Session ${x.numero}${x.titre ? ` — ${esc(x.titre)}` : ""}</h2>${x.dateLabel ? `<p><em>${esc(x.dateLabel)}</em></p>` : ""}${esc(x.resumeJoueurs).split(/\n+/).map((p) => `<p>${p}</p>`).join("")}`).join("");
    const gens = [...I.majeurs.filter((a) => whereMajeur(a, e).rencontre).map((a) => a.nom), ...I.pnj.filter((p) => wherePnj(p, e).rencontre).map((p) => `${p.nom} (${siteName(I, p._site)})`)];
    const lieux = I.sites.filter((s) => ["visite", "explore", "conquis"].includes(e.sites[s.id]?.statut)).map((s) => s.nom);
    const leg = I.legendes.filter((l, i) => e.legendes[i]?.lue).map((l) => l.titre);
    const pages = [
      { name: "Le récit", type: "text", text: { content: sessions || "<p><em>Pas encore de récit.</em></p>" } },
      { name: "Personnes rencontrées", type: "text", text: { content: gens.length ? `<ul>${gens.map(li).join("")}</ul>` : "<p><em>Personne pour l'instant.</em></p>" } },
      { name: "Lieux visités", type: "text", text: { content: lieux.length ? `<ul>${lieux.map(li).join("")}</ul>` : "<p><em>Aucun.</em></p>" } },
      { name: "Légendes entendues", type: "text", text: { content: leg.length ? `<ul>${leg.map(li).join("")}</ul>` : "<p><em>Aucune.</em></p>" } }
    ];
    const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    let j = game.journal.find((x) => x.getFlag(MOD, "chronique"));
    if (j) {
      await j.deleteEmbeddedDocuments("JournalEntryPage", j.pages.map((p) => p.id));
      await j.createEmbeddedDocuments("JournalEntryPage", pages);
    } else j = await JournalEntry.create({ name: "Chronique de campagne", ownership: { default: OBS }, flags: { [MOD]: { chronique: true } }, pages });
    ui.notifications.info("Chronique publiée : les joueurs la trouvent dans leurs journaux.");
    j.sheet.render(true);
  }

  #official(ref) {
    const I = index();
    const [type, ...rest] = ref.split(":");
    const id = rest.join(":");
    if (type === "majeur") {
      const a = I.majeurs.find((x) => x.id === id);
      if (!a) return;
      const sites = arr(a.sites_lies).map((s) => I.siteById[s]).filter(Boolean);
      return openOfficial({ nom: a.nom, nom_en: a.nom_en, acteur: a.acteur_foundry, acteurFr: a.acteur_foundry_fr,
        journals: [a.journal_en, a.journal_fr, "4. Key Players", "4. Acteurs Majeurs", ...sites.flatMap((s) => [s.journal_en, s.journal_fr, s.journal_lieux_en, s.journal_lieux_fr])] });
    }
    const p = I.pnj.find((x) => x._key === id);
    if (!p) return;
    const s = I.siteById[p._site] ?? {};
    const parts = arr(s.parties).flatMap((x) => [x.journal_en, x.journal_fr, x.journal_lieux_en, x.journal_lieux_fr]);
    return openOfficial({ nom: p.nom, nom_en: p.nom_en ?? p.acteur_foundry?.replace(/^\[base\]\s*/, ""), acteur: p.acteur_foundry, acteurFr: p.acteur_foundry_fr,
      journals: [s.journal_en, s.journal_fr, s.journal_lieux_en, s.journal_lieux_fr, ...parts, ...(p.majeur ? ["4. Key Players", "4. Acteurs Majeurs"] : [])] });
  }

  async #click(ev) {
    const t = ev.target.closest("[data-rumeur],[data-node],[data-official],[data-tab],[data-tab-go],[data-sel],[data-act],[data-book],[data-show],[data-actor],[data-clock] span,[data-del-clock],[data-del-ev],[data-chrono]");
    if (!t) return;
    if (t.matches("input, select, textarea, label")) return;
    const d = t.dataset;
    if (d.tab || d.tabGo) { this.tab = d.tab ?? d.tabGo; this.sel = null; return this.render(); }
    if (d.official) return this.#official(d.official);
    if (d.rumeur) return this.#rumeur(d.rumeur);
    if (d.node) { this.sel = d.node; this.tab = "qui"; return this.render(); }
    if (d.sel !== undefined && d.sel) {
      // deuxième clic sur la personne déjà ouverte : la description officielle
      if (this.sel === d.sel && /^(pnj|majeur):/.test(d.sel)) return this.#official(d.sel);
      this.sel = d.sel;
      if (d.sel.startsWith("site:") && !["sites", "tableau"].includes(this.tab)) this.tab = "sites";
      else if (d.sel.startsWith("site:") && this.tab === "tableau") this.tab = "sites";
      else if (d.sel.startsWith("majeur:") && !["qui", "acteurs"].includes(this.tab)) this.tab = "qui";
      else if (d.sel.startsWith("pnj:") && this.tab !== "qui") this.tab = "qui";
      return this.render();
    }
    if (d.book) return openBook(d.book.split("|"), (d.page ?? "").split("|"));
    if (d.show) return showToPlayers(d.show.split("|"), (d.page ?? "").split("|"));
    if (d.actor) return openActor(d.actor, d.actorFr);
    const e = current();
    if (t.parentElement?.dataset?.clock !== undefined && t.tagName === "SPAN") {
      const h = e.horloges.find((x) => x.id === t.parentElement.dataset.clock);
      const i = [...t.parentElement.children].indexOf(t);
      if (h) { h.rempli = h.rempli === i + 1 ? i : i + 1; saveEtat(e); this.render(); }
      return;
    }
    if (d.delClock) { e.horloges = e.horloges.filter((h) => h.id !== d.delClock); saveEtat(e); return this.render(); }
    if (d.delEv) { e.evenements = e.evenements.filter((v) => v.id !== d.delEv); saveEtat(e); return this.render(); }
    if (d.chrono !== undefined) {
      const c = arr(index().campagne.chronologie)[Number(d.chrono)];
      const jour = await askDay(c?.evenement ?? "", c?.quand);
      if (jour == null) return;
      e.evenements.push({ id: uid(), titre: c?.evenement ?? "Événement", notes: c?.quand ?? "", jour, fait: false });
      saveEtat(e); return this.render();
    }
    switch (d.act) {
      case "import": return importCampagne(this);
      case "chronique": return this.#chronique();
      case "export": {
        const blob = JSON.stringify(current(), null, 1);
        const name = `fl-campagne-partie-${new Date().toISOString().slice(0, 10)}.json`;
        return (foundry.utils.saveDataToFile ?? globalThis.saveDataToFile)(blob, "application/json", name);
      }
      case "restore": {
        const input = document.createElement("input");
        input.type = "file"; input.accept = ".json";
        input.addEventListener("change", async () => {
          try {
            const data = JSON.parse(await input.files[0].text());
            if (!data.sites || !data.pnj) throw new Error("ce n'est pas une sauvegarde de partie");
            const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Restaurer la partie" }, content: "<p>Remplacer l'état actuel de la partie par cette sauvegarde ?</p>" });
            if (!ok) return;
            await game.settings.set(MOD, "etat", data); this.render();
            ui.notifications.info("Partie restaurée.");
          } catch (err) { ui.notifications.error(`Restauration impossible : ${err.message}`); }
        });
        return input.click();
      }
      case "add-clock": {
        const nom = this.element.querySelector("[data-new='clock-nom']").value.trim();
        if (!nom) return;
        e.horloges.push({ id: uid(), nom, segments: Number(this.element.querySelector("[data-new='clock-seg']").value), rempli: 0 });
        saveEtat(e); return this.render();
      }
      case "add-ev": {
        const titre = this.element.querySelector("[data-new='ev-titre']").value.trim();
        if (!titre) return;
        const jour = await askDay(titre);
        if (jour == null) return;
        e.evenements.push({ id: uid(), titre, jour, fait: false });
        saveEtat(e); return this.render();
      }
      case "session-end": {
        const I = index();
        const t = today();
        const titre = await foundry.applications.api.DialogV2.prompt({ window: { title: "Clore la session" }, content: `<label>Titre de la session <input type="text" name="t" placeholder="ex. L'arrivée aux Fossés"></label>`, ok: { callback: (_e, b) => b.form.elements.t.value }, rejectClose: false });
        if (titre == null) return;
        const prep = Object.entries(e.preparation).filter(([k, v]) => typeof v === "string" && v.trim()).map(([k, v]) => `${k} : ${v}`).join("\n");
        e.sessions.push({ id: uid(), numero: e.sessions.length + 1, titre, jour: t.day, dateLabel: t.label, lieu: siteName(I, e.groupe.site), resume: "", preparation: prep });
        const conditions = e.preparation.conditions;
        e.preparation = conditions ? { conditions } : {};
        saveEtat(e); return this.render();
      }
    }
  }

  #change(ev) {
    const t = ev.target;
    if (t.dataset.filter) { this.filtre[t.dataset.filter] = t.value; return this.render(); }
    const e = current();
    if (t.dataset.evDone) { const v = e.evenements.find((x) => x.id === t.dataset.evDone); if (v) v.fait = t.checked; saveEtat(e); return this.render(); }
    if (t.dataset.session) { const s = e.sessions.find((x) => x.id === t.dataset.session); if (s) s.resume = t.value; saveEtat(e); return; }
    if (t.dataset.sessionJ) { const s = e.sessions.find((x) => x.id === t.dataset.sessionJ); if (s) s.resumeJoueurs = t.value; saveEtat(e); return; }
    if (t.dataset.relSite !== undefined) { this.relSite = t.value; return this.render(); }
    const path = t.dataset.path;
    if (!path) return;
    const value = t.type === "checkbox" ? t.checked : t.value;
    foundry.utils.setProperty(e, path, value);
    saveEtat(e);
    // Ces changements modifient d'autres parties de l'affichage : on redessine
    if (/\.(site|attitude|vie|relation|statut|rencontre|lue)$|^groupe\.site$|^legendes\./.test(path) || t.type === "checkbox" || t.tagName === "SELECT") this.render();
    // Ce que le livre prévoit ensuite
    let m;
    if ((m = path.match(/^sites\.([^.]+)\.evenementsFaits\.(.+)$/)) && value) this.#suitesEvenement(m[1], m[2]);
    else if ((m = path.match(/^(pnj|acteurs)\.([^.]+)\.(vie|attitude|relation)$/)) && ["mort", "captif", "disparu", "allie", "ennemi"].includes(value))
      this.#suitesPersonne(m[1] === "pnj" ? `pnj:${m[2]}` : `majeur:${m[2]}`, value);
  }
}

/* -------------------------------------------- */
/*  Import du fichier de campagne (privé)         */
/* -------------------------------------------- */

async function importCampagne(app) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.sites) && !Array.isArray(data.acteurs_majeurs)) throw new Error("Ce fichier n'est pas un fichier de campagne.");
      await game.settings.set(MOD, "contenu", data);
      ui.notifications.info(`Campagne importée : ${arr(data.sites).length} sites, ${arr(data.acteurs_majeurs).length} acteurs majeurs, ${arr(data.sites).reduce((n, s) => n + arr(s.pnj).length, 0)} PNJ.`);
      app?.render();
    } catch (e) { ui.notifications.error(`Import impossible : ${e.message}`); }
  });
  input.click();
}

/* -------------------------------------------- */
/*  Réglages, raccourci, bouton                  */
/* -------------------------------------------- */

let app = null;
function open() {
  if (!game.user.isGM) return ui.notifications.warn("Le suivi de campagne est réservé au MJ.");
  app ??= new CampagneApp();
  app.render({ force: true });
}

Hooks.once("init", () => {
  game.settings.register(MOD, "contenu", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(MOD, "etat", { scope: "world", config: false, type: Object, default: {}, onChange: () => { if (app?.rendered && !pendingEtat) app.render(); } });
  game.keybindings.register(MOD, "open", { name: "Ouvrir le suivi de campagne", editable: [{ key: "KeyC", modifiers: ["Alt"] }], restricted: true, onDown: () => { open(); return true; } });
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const notes = controls.notes ?? controls.journal;
  if (!notes?.tools) return;
  notes.tools["fl-campagne"] = { name: "fl-campagne", title: "Suivi de campagne (Alt/⌥+C)", icon: "fa-solid fa-feather", button: true, onChange: () => open(), order: 99 };
});

Hooks.once("ready", () => {
  globalThis.flCampagne = { open, importer: () => importCampagne(app) };
  checkRappels();
});
// la date avance (fl-temps) : le tableau se met à jour
Hooks.on("updateWorldTime", () => { checkRappels(); if (app?.rendered && ["tableau", "temps"].includes(app.tab)) app.render(); });
