/**
 * Valeur attendue ex ante d'une décision — rationnel entier exact.
 *
 * EV_agir = numerateur / 10_000 où
 *   numerateur =
 *     p×gain − (10_000−p)×perte − 10_000×frais
 *   (p en points de base).
 *
 * Aucun float. Aucune division avant comparaison / agrégation.
 * Un arrondi éventuel vers µUSDC n'existe que pour l'affichage.
 */

import type { MicroUsdc } from "./monnaie.js";
import { POINTS_DE_BASE_PAR_UNITE } from "./monnaie.js";

/** Dénominateur commun des EV / regrets ex ante (points de base). */
export const DENOMINATEUR_VALEUR_ATTENDUE_BPS = POINTS_DE_BASE_PAR_UNITE;

/**
 * Valeur attendue (ou regret) exacte : fraction µUSDC / BPS.
 * `numerateurMicroUsdcBps / denominateurBps` = µUSDC exacte.
 * Convention v0.1 : `denominateurBps === 10_000`.
 */
export type ValeurAttendueExacte = {
  readonly numerateurMicroUsdcBps: bigint;
  readonly denominateurBps: bigint;
};

export type ParametresValeurAttendueAgir = {
  readonly probabiliteSuccesBps: number;
  readonly gainSiSuccesMicroUsdc: MicroUsdc;
  readonly perteSiEchecMicroUsdc: MicroUsdc;
  readonly fraisActionMicroUsdc: MicroUsdc;
};

export type ActionDecisionExAnte = "agir" | "attendre";

/**
 * Convention d'égalité EV_agir === EV_attendre :
 * → `attendre` (évite une action coûteuse inutile).
 */
export const CONVENTION_EGALITE_EX_ANTE: ActionDecisionExAnte = "attendre";

export function creerValeurAttendueExacte(
  numerateurMicroUsdcBps: bigint,
): ValeurAttendueExacte {
  return {
    numerateurMicroUsdcBps,
    denominateurBps: DENOMINATEUR_VALEUR_ATTENDUE_BPS,
  };
}

export function calculerValeurAttendueAgir(
  parametres: ParametresValeurAttendueAgir,
): ValeurAttendueExacte {
  if (
    !Number.isInteger(parametres.probabiliteSuccesBps) ||
    parametres.probabiliteSuccesBps < 0 ||
    parametres.probabiliteSuccesBps > Number(POINTS_DE_BASE_PAR_UNITE)
  ) {
    throw new Error(
      `probabiliteSuccesBps hors intervalle entier [0, 10000] : ${String(parametres.probabiliteSuccesBps)}`,
    );
  }
  const p = BigInt(parametres.probabiliteSuccesBps);
  const base = POINTS_DE_BASE_PAR_UNITE;
  const numerateurMicroUsdcBps =
    p * parametres.gainSiSuccesMicroUsdc -
    (base - p) * parametres.perteSiEchecMicroUsdc -
    base * parametres.fraisActionMicroUsdc;
  return creerValeurAttendueExacte(numerateurMicroUsdcBps);
}

/** EV_attendre = 0 / 10000 (v0.1). */
export function calculerValeurAttendueAttendre(): ValeurAttendueExacte {
  return creerValeurAttendueExacte(0n);
}

/**
 * Comparaison sur le numérateur exact (même dénominateur).
 * Ne convertit jamais en µUSDC tronqué avant de choisir.
 */
export function determinerMeilleureActionExAnte(
  valeurAttendueAgir: ValeurAttendueExacte,
  valeurAttendueAttendre: ValeurAttendueExacte = calculerValeurAttendueAttendre(),
): ActionDecisionExAnte {
  assertMemeDenominateur(valeurAttendueAgir, valeurAttendueAttendre);
  const nAgir = valeurAttendueAgir.numerateurMicroUsdcBps;
  const nAttendre = valeurAttendueAttendre.numerateurMicroUsdcBps;
  if (nAgir > nAttendre) {
    return "agir";
  }
  if (nAgir < nAttendre) {
    return "attendre";
  }
  return CONVENTION_EGALITE_EX_ANTE;
}

/**
 * regret = EV(meilleure) − EV(choisie), numérateurs exacts, ≥ 0.
 */
export function calculerRegretExAnte(options: {
  readonly valeurAttendueAgir: ValeurAttendueExacte;
  readonly valeurAttendueAttendre?: ValeurAttendueExacte;
  readonly actionChoisie: ActionDecisionExAnte;
}): ValeurAttendueExacte {
  const evAttendre =
    options.valeurAttendueAttendre ?? calculerValeurAttendueAttendre();
  assertMemeDenominateur(options.valeurAttendueAgir, evAttendre);
  const meilleure = determinerMeilleureActionExAnte(
    options.valeurAttendueAgir,
    evAttendre,
  );
  const numerateurMeilleure =
    meilleure === "agir"
      ? options.valeurAttendueAgir.numerateurMicroUsdcBps
      : evAttendre.numerateurMicroUsdcBps;
  const numerateurChoisie =
    options.actionChoisie === "agir"
      ? options.valeurAttendueAgir.numerateurMicroUsdcBps
      : evAttendre.numerateurMicroUsdcBps;
  const numerateurRegret = numerateurMeilleure - numerateurChoisie;
  return creerValeurAttendueExacte(
    numerateurRegret < 0n ? 0n : numerateurRegret,
  );
}

/** Somme exacte de numérateurs (dénominateur commun 10_000). */
export function additionnerValeursAttenduesExactes(
  ...valeurs: readonly ValeurAttendueExacte[]
): ValeurAttendueExacte {
  let somme = 0n;
  for (const valeur of valeurs) {
    if (valeur.denominateurBps !== DENOMINATEUR_VALEUR_ATTENDUE_BPS) {
      throw new Error(
        `Dénominateur EV inattendu : ${valeur.denominateurBps.toString(10)}`,
      );
    }
    somme += valeur.numerateurMicroUsdcBps;
  }
  return creerValeurAttendueExacte(somme);
}

/**
 * Approximation µUSDC tronquée vers zéro — affichage uniquement.
 * Ne jamais utiliser pour choisir l'action ou agréger le regret métier.
 */
export function arrondirValeurAttendueVersMicroUsdc(
  valeur: ValeurAttendueExacte,
): MicroUsdc {
  return valeur.numerateurMicroUsdcBps / valeur.denominateurBps;
}

function assertMemeDenominateur(
  a: ValeurAttendueExacte,
  b: ValeurAttendueExacte,
): void {
  if (
    a.denominateurBps !== DENOMINATEUR_VALEUR_ATTENDUE_BPS ||
    b.denominateurBps !== DENOMINATEUR_VALEUR_ATTENDUE_BPS
  ) {
    throw new Error("Dénominateur EV hors convention 10000 BPS");
  }
}
