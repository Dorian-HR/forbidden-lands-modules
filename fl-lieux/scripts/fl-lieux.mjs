/**
 * Forbidden Lands – Ambiances des lieux.
 * Les ambiances sont de vrais sons d'ambiance de Foundry (portée, murs, atténuation) posés sur la scène ;
 * le module change leur fichier selon le Quart de la journée et baisse les lieux en plein air sous la pluie.
 */
import { LIEUX, GROUPS, BOOK_SCENES, COMBATS } from "./lieux.mjs";

const MOD = "fl-lieux";
const SRC = (f) => `modules/${MOD}/assets/sons/${f}.ogg`;
const esc = (s) => foundry.utils.escapeHTML?.(String(s)) ?? String(s);

/* -------------------------------------------- */
/*  Le temps qu'il fait                         */
/* -------------------------------------------- */

/** Quart, saison et météo : du module « Le Temps des Contrées » s'il est là, sinon depuis l'heure du monde. */
function now() {
  const c = globalThis.flTemps?.current;
  if (c) return c;
  const s = ((game.time.worldTime % 86400) + 86400) % 86400;
  return { quarter: Math.floor(s / 21600), weather: null, season: null };
}

/** Volume du lieu selon la météo : la pluie et le vent couvrent les lieux en plein air. */
function weatherFactor(lieu, w) {
  if (!lieu.outdoor || !w) return 1;
  let k = 1;
  if (w.precip === 3) k *= 0.5; else if (w.precip === 2) k *= 0.75;
  if (w.wind === 3) k *= 0.6; else if (w.wind === 2) k *= 0.85;
  return k;
}

const master = () => (game.settings.get(MOD, "volume") ?? 100) / 100;

function wanted(doc, t = now()) {
  const f = doc.getFlag(MOD, "lieu");
  const lieu = LIEUX[f?.id];
  if (!lieu) return null;
  return { path: SRC(lieu.file(t.quarter, t.season, t.day ?? Math.floor(game.time.worldTime / 86400))), volume: Math.round((f.volume ?? 0.6) * master() * weatherFactor(lieu, t.weather) * 100) / 100 };
}

/* -------------------------------------------- */
/*  Mise à jour des sons de la scène (MJ)       */
/* -------------------------------------------- */

const isActiveGM = () => game.user.isGM && (game.users.activeGM ? game.users.activeGM.isSelf : true);
let lastQuarter = null;

async function sync(volumeOnly = false) {
  if (!isActiveGM() || !canvas.scene) return;
  const t = now();
  const updates = [];
  for (const doc of canvas.scene.sounds) {
    const w = wanted(doc, t);
    if (!w) continue;
    if (doc.path !== w.path || Math.abs((doc.volume ?? 0) - w.volume) > 0.01) updates.push({ _id: doc.id, path: w.path, volume: w.volume });
  }
  // la tension et la musique de combat suivent aussi le volume général
  for (const [flag, base] of [["tension", 0.55], ["combat", 0.5]]) {
    const tdoc = canvas.scene.sounds.find((d) => d.getFlag(MOD, flag));
    if (tdoc) { const v = Math.round(base * master() * 100) / 100; if (Math.abs(tdoc.volume - v) > 0.01) updates.push({ _id: tdoc.id, volume: v }); }
  }
  if (updates.length) await canvas.scene.updateEmbeddedDocuments("AmbientSound", updates);
  if (volumeOnly) return;

  // Cloches du Matin et du Soir, s'il y a un lieu à cloche sur la scène
  const key = `${t.day ?? Math.floor(game.time.worldTime / 86400)}-${t.quarter}`;
  if (lastQuarter !== null && lastQuarter !== key && (t.quarter === 0 || t.quarter === 2) && game.settings.get(MOD, "bells")) {
    const hasBell = canvas.scene.sounds.some((d) => LIEUX[d.getFlag(MOD, "lieu")?.id]?.bells);
    if (hasBell) ringBell("cloche");
  }
  lastQuarter = key;
}

function ringBell(kind = "cloche") {
  const data = { src: SRC(kind), volume: Math.min(1, (kind === "glas" ? 0.75 : 0.55) * master()), loop: false, channel: "environment" };
  foundry.audio.AudioHelper.play(data, true);
}

/* -------------------------------------------- */
/*  Création des sons                           */
/* -------------------------------------------- */

const gridDistance = () => canvas.scene.grid?.distance ?? canvas.scene.gridDistance ?? canvas.dimensions?.distance ?? 1;

async function createLieu(id, { x, y, whole = false, volume = 0.6 }) {
  const lieu = LIEUX[id];
  const t = now();
  const d = canvas.dimensions;
  const r = d.sceneRect ?? d.rect;
  const data = {
    x: whole ? r.x + r.width / 2 : x,
    y: whole ? r.y + r.height / 2 : y,
    radius: whole ? (Math.hypot(r.width, r.height) / 2 / d.size) * gridDistance() * 1.05 : lieu.radius * gridDistance(),
    path: SRC(lieu.file(t.quarter, t.season, t.day ?? Math.floor(game.time.worldTime / 86400))),
    repeat: true,
    volume: Math.round(volume * master() * weatherFactor(lieu, t.weather) * 100) / 100,
    easing: !whole,
    walls: !whole,
    hidden: false,
    flags: { [MOD]: { lieu: { id, volume, whole } } }
  };
  const [doc] = await canvas.scene.createEmbeddedDocuments("AmbientSound", [data]);
  ui.notifications.info(`Ambiance « ${lieu.label} » ${whole ? "sur toute la scène" : "placée"}.`);
  return doc;
}

/** Attend un clic sur la carte et renvoie sa position. */
function pickPoint(label) {
  return new Promise((resolve) => {
    ui.notifications.info(`Cliquez sur la carte pour placer « ${label} » (clic droit ou Échap pour annuler).`);
    const stage = canvas.stage;
    const done = (pos) => {
      stage.off("pointerdown", onDown); window.removeEventListener("keydown", onKey);
      resolve(pos);
    };
    const onDown = (ev) => {
      if (ev.button === 2) return done(null);
      const p = ev.getLocalPosition?.(stage) ?? canvas.mousePosition;
      done(p ? { x: Math.round(p.x), y: Math.round(p.y) } : null);
    };
    const onKey = (ev) => { if (ev.key === "Escape") done(null); };
    stage.on("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
  });
}

/* -------------------------------------------- */
/*  Tension                                     */
/* -------------------------------------------- */

const tensionDoc = () => canvas.scene?.sounds.find((d) => d.getFlag(MOD, "tension"));
async function toggleTension() {
  const doc = tensionDoc();
  if (doc) { await doc.delete(); ui.notifications.info("La tension retombe."); return; }
  const d = canvas.dimensions, r = d.sceneRect ?? d.rect;
  await canvas.scene.createEmbeddedDocuments("AmbientSound", [{
    x: r.x + r.width / 2, y: r.y + r.height / 2, radius: (Math.hypot(r.width, r.height) / 2 / d.size) * gridDistance() * 1.05,
    path: SRC("tension"), repeat: true, volume: Math.round(0.55 * master() * 100) / 100, easing: false, walls: false, flags: { [MOD]: { tension: true } }
  }]);
  ui.notifications.info("La tension monte…");
}

/* -------------------------------------------- */
/*  Musique de combat                           */
/* -------------------------------------------- */

const combatDoc = () => canvas.scene?.sounds.find((d) => d.getFlag(MOD, "combat"));
/** Lance une musique de combat (au hasard, ou la n°idx) ; si une joue déjà et qu'on ne demande rien, l'arrête. */
async function toggleCombat(idx = null, { quiet = false } = {}) {
  if (!canvas.scene) return;
  const doc = combatDoc();
  if (doc && idx === null) { await doc.delete(); if (!quiet) ui.notifications.info("La musique de combat s'arrête."); return; }
  const prev = doc?.getFlag(MOD, "combat")?.idx;
  if (idx === null) { idx = Math.floor(Math.random() * COMBATS.length); if (idx === prev) idx = (idx + 1) % COMBATS.length; }
  const vol = Math.round(0.5 * master() * 100) / 100;
  if (doc) { await doc.update({ path: SRC(`combat_${idx}`), volume: vol, [`flags.${MOD}.combat`]: { idx } }); }
  else {
    const d = canvas.dimensions, r = d.sceneRect ?? d.rect;
    await canvas.scene.createEmbeddedDocuments("AmbientSound", [{
      x: r.x + r.width / 2, y: r.y + r.height / 2, radius: (Math.hypot(r.width, r.height) / 2 / d.size) * gridDistance() * 1.05,
      path: SRC(`combat_${idx}`), repeat: true, volume: vol, easing: false, walls: false, flags: { [MOD]: { combat: { idx } } }
    }]);
  }
  if (!quiet) ui.notifications.info(`Musique de combat : ${COMBATS[idx]}`);
}
async function stopCombat() { const doc = combatDoc(); if (doc) await doc.delete(); }

/* -------------------------------------------- */
/*  La fenêtre                                  */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class LieuxApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fl-lieux",
    classes: ["fl-lieux"],
    window: { title: "Ambiances des lieux", icon: "fa-solid fa-landmark", resizable: true },
    position: { width: 420, height: 640 },
    actions: {
      place: LieuxApp.#place,
      whole: LieuxApp.#whole,
      remove: LieuxApp.#remove,
      pan: LieuxApp.#pan,
      tension: () => toggleTension().then(() => app?.render()),
      combat: () => toggleCombat().then(() => app?.render()),
      combatNext: () => toggleCombat((((combatDoc()?.getFlag(MOD, "combat")?.idx ?? -1) + 1) % COMBATS.length)).then(() => app?.render()),
      cloche: () => ringBell("cloche"),
      glas: () => ringBell("glas")
    }
  };
  static PARTS = { main: { template: `modules/${MOD}/templates/lieux.hbs`, scrollable: [".fll-scroll"] } };

  async _prepareContext() {
    const t = now();
    const QN = ["Matin", "Journée", "Soir", "Nuit"];
    const sounds = (canvas.scene?.sounds ?? []).filter((d) => d.getFlag(MOD, "lieu")).map((d) => {
      const f = d.getFlag(MOD, "lieu"); const l = LIEUX[f.id];
      return { id: d.id, label: l?.label ?? f.id, icon: l?.icon ?? "fa-music", whole: f.whole, vol: Math.round((f.volume ?? 0.6) * 100),
        playing: d.path?.split("/").pop().replace(".ogg", "").replace(/_/g, " ") };
    });
    return {
      quarter: QN[t.quarter] ?? "",
      linked: !!globalThis.flTemps?.current,
      scene: canvas.scene?.name ?? "—",
      sounds,
      tension: !!tensionDoc(),
      combat: combatDoc() ? COMBATS[combatDoc().getFlag(MOD, "combat")?.idx ?? 0] : null,
      master: game.settings.get(MOD, "volume"),
      groups: GROUPS.map((g) => ({ ...g, lieux: Object.entries(LIEUX).filter(([, l]) => l.group === g.id).map(([id, l]) => ({ id, ...l })) }))
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    // volume général de toutes les ambiances de lieux
    const m = el.querySelector(".fll-master");
    if (m) {
      const lab = el.querySelector(".fll-master-val");
      m.addEventListener("input", () => { if (lab) lab.textContent = `${m.value} %`; });
      m.addEventListener("change", async () => { await game.settings.set(MOD, "volume", Number(m.value)); await sync(true); });
    }
    // volume de chaque ambiance placée
    for (const r of el.querySelectorAll(".fll-vol")) {
      const lab = r.parentElement.querySelector(".fll-vol-val");
      r.addEventListener("input", () => { if (lab) lab.textContent = `${r.value} %`; });
      r.addEventListener("change", async () => {
        const doc = canvas.scene.sounds.get(r.dataset.id);
        if (!doc) return;
        await doc.setFlag(MOD, "lieu", { ...doc.getFlag(MOD, "lieu"), volume: Number(r.value) / 100 });
        await sync(true);
      });
    }
  }

  static async #place(event, target) {
    const id = target.closest("[data-lieu]").dataset.lieu;
    this.minimize?.();
    const p = await pickPoint(LIEUX[id].label);
    this.maximize?.();
    if (p) { await createLieu(id, p); this.render(); }
  }
  static async #whole(event, target) {
    const id = target.closest("[data-lieu]").dataset.lieu;
    await createLieu(id, { whole: true }); this.render();
  }
  static async #remove(event, target) {
    const doc = canvas.scene.sounds.get(target.dataset.id);
    if (doc) await doc.delete();
    this.render();
  }
  static #pan(event, target) {
    const doc = canvas.scene.sounds.get(target.dataset.id);
    if (doc) canvas.animatePan({ x: doc.x, y: doc.y });
  }
}

let app = null;
function open() {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ place les ambiances des lieux.");
  if (!canvas.scene) return ui.notifications.warn("Ouvrez d'abord une scène.");
  app ??= new LieuxApp();
  app.render({ force: true });
}

/* -------------------------------------------- */
/*  Scènes des livres                           */
/* -------------------------------------------- */

function suggestForBookScene() {
  if (!isActiveGM() || !canvas.scene || !game.settings.get(MOD, "suggest")) return;
  const scene = canvas.scene;
  if (scene.getFlag(MOD, "suggested")) return;
  if (scene.sounds.some((d) => d.getFlag(MOD, "lieu"))) return;
  const match = BOOK_SCENES.find(([re]) => re.test(scene.name));
  if (!match) return;
  scene.setFlag(MOD, "suggested", true);
  const lieu = LIEUX[match[1]];
  ChatMessage.create({
    content: `<div class="fll-chat"><h3><i class="fa-solid fa-landmark"></i> ${esc(scene.name)}</h3>
      <p>Cette scène vient des livres. Lui donner l'ambiance <b>${esc(lieu.label)}</b> ?</p>
      <p><button type="button" data-fll-add="${match[1]}" data-fll-scene="${scene.id}"><i class="fa-solid fa-volume-high"></i> Toute la scène</button>
      <button type="button" data-fll-open="1"><i class="fa-solid fa-landmark"></i> Choisir moi-même</button></p></div>`,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    speaker: { alias: "Ambiances des lieux" }
  });
}

function bindChat(msg, html) {
  if (!game.user.isGM || !html?.querySelectorAll) return;
  for (const b of html.querySelectorAll("[data-fll-add], [data-fll-open]")) {
    if (b.dataset.bound) continue;
    b.dataset.bound = "1";
    b.addEventListener("click", async () => {
      if (b.dataset.fllOpen) return open();
      if (canvas.scene?.id !== b.dataset.fllScene) return ui.notifications.warn("Ouvrez d'abord cette scène.");
      await createLieu(b.dataset.fllAdd, { whole: true });
      b.disabled = true;
    });
  }
}

/* -------------------------------------------- */
/*  Démarrage                                   */
/* -------------------------------------------- */

Hooks.once("init", () => {
  // Raccourci clavier (modifiable dans Paramètres → Configurer les contrôles)
  game.keybindings.register(MOD, "open", {
    name: "Ouvrir les ambiances des lieux",
    editable: [{ key: "KeyL", modifiers: ["Shift"] }],
    restricted: true,
    onDown: () => { open(); return true; }
  });
  game.settings.register(MOD, "volume", { name: "Volume des ambiances de lieux (%)", hint: "Volume général de toutes les ambiances de lieux, pour toute la table. Chaque joueur peut aussi régler son propre niveau avec le curseur « Environnement » de Foundry.", scope: "world", config: true, type: Number, default: 100, range: { min: 0, max: 150, step: 5 }, onChange: () => { sync(true); app?.rendered && app.render(); } });
  game.settings.register(MOD, "bells", { name: "Cloches du Matin et du Soir", hint: "Quand une scène contient un village, une chapelle ou un château, la cloche sonne au début du Matin et du Soir, pour tout le monde.", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(MOD, "suggest", { name: "Proposer l'ambiance des scènes des livres", hint: "À l'ouverture d'une scène des livres (Les Fossés, Âprepierre, Pélagie…), le MJ reçoit un message pour lui donner son ambiance.", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(MOD, "combatAuto", { name: "Musique de combat automatique", hint: "Quand le MJ lance un combat (Commencer le combat), une musique de combat démarre au hasard ; elle s'arrête quand le combat est terminé.", scope: "world", config: true, type: Boolean, default: true });
});

Hooks.on("combatStart", (combat) => { if (isActiveGM() && game.settings.get(MOD, "combatAuto") && combat.scene?.id === canvas.scene?.id) (combatDoc() ? Promise.resolve() : toggleCombat(null, { quiet: true })).then(() => app?.rendered && app.render()); });
Hooks.on("deleteCombat", (combat) => { if (isActiveGM() && game.settings.get(MOD, "combatAuto")) stopCombat().then(() => app?.rendered && app.render()); });

Hooks.once("ready", () => {
  globalThis.flLieux = { open, ringBell, toggleTension, toggleCombat, stopCombat, sync, LIEUX };
  sync(); suggestForBookScene();
});

Hooks.on("canvasReady", () => { lastQuarter = null; sync(); suggestForBookScene(); app?.rendered && app.render(); });
Hooks.on("flTempsRefresh", () => { sync(); app?.rendered && app.render(); });
Hooks.on("updateWorldTime", () => { if (!globalThis.flTemps?.current) sync(); });
Hooks.on("renderChatMessageHTML", bindChat);
for (const h of ["createAmbientSound", "deleteAmbientSound"]) Hooks.on(h, () => app?.rendered && app.render());

// Bouton dans les outils des sons d'ambiance (barre de gauche)
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const tool = { name: "flLieux", title: "Ambiances des lieux", icon: "fa-solid fa-landmark", order: 99, button: true, visible: true,
    onChange: () => open(), onClick: () => open() };
  if (Array.isArray(controls)) controls.find((c) => c.name === "sounds")?.tools.push(tool);
  else if (controls?.sounds?.tools) controls.sounds.tools.flLieux = tool;
});
