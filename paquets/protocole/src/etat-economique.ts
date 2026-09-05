import type { EtatSurvie } from "./etat-survie.js";
import type { MicroUsdc } from "./monnaie.js";

/**
 * État économique minimal d'un agent (ESP-ECO-014).
 * Distingue capital liquide, obligations dues et totaux d'activité.
 * Pas de portefeuille SOL, positions ou PnL latent en v0.1.
 */
export interface EtatEconomiqueAgent {
  readonly identifiantAgent: string;
  readonly capitalLiquide: MicroUsdc;
  readonly obligationsDues: MicroUsdc;
  readonly totalRevenusActivite: MicroUsdc;
  readonly totalPertesActivite: MicroUsdc;
  readonly totalDepensesCompute: MicroUsdc;
  readonly totalDepensesDonnees: MicroUsdc;
  readonly totalFraisExecution: MicroUsdc;
  readonly totalLoyersPayes: MicroUsdc;
  readonly totalRedevancesProprietairePayees: MicroUsdc;
  /** High-water mark propriétaire — pic de VEN déjà soumis à redevance. */
  readonly highWaterMarkProprietaire: MicroUsdc;
  readonly etatSurvie: EtatSurvie;
  readonly cyclesDormanceConsecutifs: number;
  readonly dernierNumeroCycle: number;
}

export type EntreeEtatEconomiqueInitial = {
  identifiantAgent: string;
  capitalLiquide?: MicroUsdc;
  etatSurvie?: EtatSurvie;
};

/**
 * Crée un état économique initial vide (sans revenu artificiel à la naissance).
 */
export function creerEtatEconomiqueInitial(
  entree: EntreeEtatEconomiqueInitial,
): EtatEconomiqueAgent {
  return {
    identifiantAgent: entree.identifiantAgent,
    capitalLiquide: entree.capitalLiquide ?? 0n,
    obligationsDues: 0n,
    totalRevenusActivite: 0n,
    totalPertesActivite: 0n,
    totalDepensesCompute: 0n,
    totalDepensesDonnees: 0n,
    totalFraisExecution: 0n,
    totalLoyersPayes: 0n,
    totalRedevancesProprietairePayees: 0n,
    highWaterMarkProprietaire: entree.capitalLiquide ?? 0n,
    etatSurvie: entree.etatSurvie ?? "sain",
    cyclesDormanceConsecutifs: 0,
    dernierNumeroCycle: 0,
  };
}

/**
 * Valeur économique nette v0.1.
 * Isolée pour pouvoir évoluer (actifs investis, etc.) sans casser les appels.
 */
export function calculerValeurEconomiqueNette(
  etat: Pick<EtatEconomiqueAgent, "capitalLiquide" | "obligationsDues">,
): MicroUsdc {
  return etat.capitalLiquide - etat.obligationsDues;
}

/** Brouillon mutable pour appliquer un cycle ou une reconstruction. */
export type BrouillonEtatEconomique = {
  -readonly [K in keyof EtatEconomiqueAgent]: EtatEconomiqueAgent[K];
};

export function clonerEtatEconomique(
  etat: EtatEconomiqueAgent,
): BrouillonEtatEconomique {
  return { ...etat };
}

export function figerEtatEconomique(
  brouillon: BrouillonEtatEconomique,
): EtatEconomiqueAgent {
  return { ...brouillon };
}
