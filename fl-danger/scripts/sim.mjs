// Moteur de simulation d'un combat de Forbidden Lands (règles simplifiées du Manuel, chap. Combat).
// Chaque combattant : { nom, camp: "pj"|"ennemi", monstre, F, A, E, melee, tir, move, arme: {bonus, degats, distance}, parade, armure,
//   attaques: [{ des, degats, peur, force }] (monstres), actions (monstres) }.
// Simplifications assumées (pas dans le moteur) : pas de terrain, de portée, de fuite, de sorts, de talents ni de blessures critiques.

const d6 = () => (Math.random() * 6 | 0) + 1;
/** Lance n dés, renvoie le nombre de 6 et le nombre de 1. */
function lancer(n) { let s = 0, u = 0; for (let i = 0; i < n; i++) { const r = d6(); if (r === 6) s++; else if (r === 1) u++; } return { s, u }; }

function attaquePJ(a, cible) {
  // Dés de base = attribut actuel ; compétence ; dés d'équipement = bonus de l'arme.
  const attr = a.arme.distance ? "A" : "F";
  const base = Math.max(0, a[attr]), comp = a.arme.distance ? a.tir : a.melee, eq = a.arme.bonus;
  let r1 = lancer(base), r2 = lancer(comp), r3 = lancer(eq);
  let s = r1.s + r2.s + r3.s;
  if (!s && !a.pnj) {
    // Le PJ pousse son jet : on relance ce qui n'est ni 6 ni 1 (dés de base) ; chaque 1 des dés de base coûte 1 point de l'attribut.
    const rb = lancer(base - r1.s - r1.u), rc = lancer(comp - r2.s), re = lancer(eq - r3.s);
    s = rb.s + rc.s + re.s;
    a[attr] -= r1.u + rb.u;
  }
  return s;
}
function defendre(def, att, s) {
  if (!s || def.monstre || def.rapide) return s;
  def.rapide = true;
  // Esquive : Agilité + Mouvement. Parade : Force + Mêlée + arme qui pare ou bouclier, impossible contre un monstre.
  const esquive = Math.max(0, def.A) + def.move;
  const parade = !att.monstre && def.parade != null && !att.arme?.distance ? Math.max(0, def.F) + def.melee + def.parade : -1;
  const n = Math.max(esquive, parade);
  return Math.max(0, s - lancer(n).s);
}
function blesser(cible, degats, peur) {
  if (degats <= 0) return;
  if (peur) { cible.E -= degats; return; }
  const arm = lancer(cible.armure).s;
  cible.F -= Math.max(0, degats - arm);
}
const brise = (c) => c.F <= 0 || c.E <= 0 || c.A <= 0;

function agir(a, amis, ennemis) {
  const cibles = ennemis.filter((c) => !brise(c));
  if (!cibles.length) return;
  if (a.monstre) {
    for (let k = 0; k < (a.actions || 1); k++) {
      const vivants = ennemis.filter((c) => !brise(c)); if (!vivants.length) return;
      const cible = vivants[(Math.random() * vivants.length) | 0];
      const at = a.attaques[(Math.random() * a.attaques.length) | 0];
      let s = lancer(at.force ? Math.max(0, a.F) : at.des).s;
      s = defendre(cible, a, s);
      if (s > 0) blesser(cible, at.peur ? s : at.degats + s - 1, at.peur);
    }
    return;
  }
  // Les PJ s'acharnent sur l'ennemi le plus entamé ; les PNJ frappent au hasard.
  const cible = a.camp === "pj" ? cibles.reduce((m, c) => (c.F < m.F ? c : m)) : cibles[(Math.random() * cibles.length) | 0];
  let s = attaquePJ(a, cible);
  s = defendre(cible, a, s);
  if (s > 0) blesser(cible, a.arme.degats + s - 1, false);
}

/** Joue un combat. Renvoie { victoire, brises (PJ brisés), rounds }. */
export function combat(pjs, ennemis, maxRounds = 30) {
  const P = pjs.map((c) => ({ ...c, camp: "pj" })), E = ennemis.map((c) => ({ ...c, camp: "ennemi" }));
  const tous = [...P, ...E];
  let r = 0;
  while (r < maxRounds && P.some((c) => !brise(c)) && E.some((c) => !brise(c))) {
    r++;
    for (const c of tous) c.rapide = false;
    // Initiative : un ordre au hasard à chaque round (cartes d'initiative).
    const ordre = tous.filter((c) => !brise(c)).sort(() => Math.random() - 0.5);
    for (const c of ordre) { if (brise(c)) continue; c.camp === "pj" ? agir(c, P, E) : agir(c, E, P); }
  }
  const victoire = E.every(brise) && P.some((c) => !brise(c));
  return { victoire, brises: P.filter(brise).length, rounds: r };
}

/** Joue n combats et résume. */
export function estimer(pjs, ennemis, n = 300) {
  let v = 0, b = 0, unBrise = 0, rounds = 0, morts = 0;
  for (let i = 0; i < n; i++) {
    const r = combat(pjs, ennemis);
    if (r.victoire) v++;
    b += r.brises; if (r.brises) unBrise++; if (r.brises === pjs.length) morts++; rounds += r.rounds;
  }
  return { victoire: v / n, risque: unBrise / n, tpk: morts / n, brisesMoy: b / n, rounds: rounds / n };
}

/** Classe une rencontre (réglage maison). */
export function niveau(e) {
  if (e.victoire >= 0.95 && e.risque < 0.15) return "facile";
  if (e.victoire >= 0.85 && e.risque < 0.5) return "tendu";
  if (e.victoire >= 0.55) return "dangereux";
  return "mortel";
}
export const NIVEAUX = { facile: "Facile", tendu: "Tendu", dangereux: "Dangereux", mortel: "Mortel" };
