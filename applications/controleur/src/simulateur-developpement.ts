import type { ResultatActiviteCycle } from "@esp/protocole";

/**
 * ============================================================================
 * SIMULATEUR DE DÉVELOPPEMENT
 * ============================================================================
 *
 * Générateur temporaire d'activité économique SIMULÉE et DÉTERMINISTE.
 * Hors protocole ESP (@esp/protocole) — ne décide PAS de la survie.
 * Produit uniquement des entrées ResultatActiviteCycle pour le noyau.
 *
 * Aucun Math.random non seedé.
 * Aucun flottant pour les montants économiques (micro-USDC entiers).
 */

export const IDENTIFIANT_SIMULATEUR_DEVELOPPEMENT =
  "simulateur-developpement" as const;
export const VERSION_SIMULATEUR_DEVELOPPEMENT = "0.1.0" as const;

export type OptionsSimulateurDeveloppement = {
  readonly graineSimulation: number;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
};

/**
 * Générateur pseudo-aléatoire déterministe (Mulberry32).
 * Retourne un entier non signé 32 bits.
 */
function creerGenerateurEntier(graine: number): () => number {
  let etat = graine >>> 0;
  return (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function hacherChaine(texte: string): number {
  let hachage = 2166136261;
  for (let index = 0; index < texte.length; index += 1) {
    hachage ^= texte.charCodeAt(index);
    hachage = Math.imul(hachage, 16777619);
  }
  return hachage >>> 0;
}

function melangerGraine(
  graineSimulation: number,
  identifiantAgent: string,
  numeroCycle: number,
): number {
  return (
    (graineSimulation >>> 0) ^
    hacherChaine(identifiantAgent) ^
    Math.imul(numeroCycle, 0x9e3779b9)
  ) >>> 0;
}

/**
 * Tire un entier dans [minimum, maximum] inclus — déterministe.
 */
function tirerEntierInclus(
  generer: () => number,
  minimum: number,
  maximum: number,
): number {
  if (maximum < minimum) {
    throw new Error("intervalle simulateur invalide");
  }
  const amplitude = maximum - minimum + 1;
  return minimum + (generer() % amplitude);
}

/**
 * Profil d'agent dérivé de l'identifiant — varie naturellement
 * profitabilité / équilibre / déficit sans truquer la survie.
 */
function profilAgent(identifiantAgent: string): "profitable" | "equilibre" | "deficitaire" {
  const reste = hacherChaine(identifiantAgent) % 3;
  if (reste === 0) {
    return "profitable";
  }
  if (reste === 1) {
    return "equilibre";
  }
  return "deficitaire";
}

/**
 * Produit un résultat d'activité déterministe pour un agent et un cycle.
 */
export function simulerActiviteCycle(
  options: OptionsSimulateurDeveloppement,
): ResultatActiviteCycle {
  const graine = melangerGraine(
    options.graineSimulation,
    options.identifiantAgent,
    options.numeroCycle,
  );
  const generer = creerGenerateurEntier(graine);
  const profil = profilAgent(options.identifiantAgent);

  const depenseCompute = BigInt(tirerEntierInclus(generer, 5_000, 40_000));
  const depenseDonnees = BigInt(tirerEntierInclus(generer, 2_000, 25_000));
  const fraisExecution = BigInt(tirerEntierInclus(generer, 1_000, 15_000));
  const coutsVariables = depenseCompute + depenseDonnees + fraisExecution;

  let revenuActivite = 0n;
  let perteActivite = 0n;

  if (profil === "profitable") {
    const marge = BigInt(tirerEntierInclus(generer, 20_000, 120_000));
    revenuActivite = coutsVariables + marge;
  } else if (profil === "equilibre") {
    const ecart = BigInt(tirerEntierInclus(generer, 0, 15_000));
    if (generer() % 2 === 0) {
      revenuActivite = coutsVariables + ecart;
    } else {
      revenuActivite = coutsVariables > ecart ? coutsVariables - ecart : 0n;
      if (revenuActivite === 0n && coutsVariables > 0n) {
        perteActivite = BigInt(tirerEntierInclus(generer, 0, 10_000));
      }
    }
  } else {
    const manque = BigInt(tirerEntierInclus(generer, 10_000, 80_000));
    revenuActivite = BigInt(tirerEntierInclus(generer, 0, 30_000));
    perteActivite = manque;
  }

  return {
    revenuActivite,
    perteActivite,
    depenseCompute,
    depenseDonnees,
    fraisExecution,
  };
}
