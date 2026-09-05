import {
  calculerValeurEconomiqueNette,
  type EtatEconomiqueAgent,
} from "./etat-economique.js";
import type { MicroUsdc, PointsDeBase } from "./monnaie.js";
import { appliquerTauxPointsDeBase } from "./monnaie.js";

export type CalculRedevanceProprietaire = {
  readonly profitTaxable: MicroUsdc;
  readonly montantRedevance: MicroUsdc;
  readonly highWaterMarkAvant: MicroUsdc;
  readonly highWaterMarkApres: MicroUsdc;
};

/**
 * Calcule la redevance propriétaire sur nouveau profit (high-water mark).
 *
 * Le high-water mark est le pic de valeur économique nette déjà atteint.
 * Un même profit n'est jamais taxé deux fois.
 * Le HWM est mis à jour au pic AVANT paiement de la redevance
 * (ex. 100→120, redevance 2, capital 118, HWM=120).
 */
export function calculerRedevanceProprietaire(
  etat: Pick<
    EtatEconomiqueAgent,
    "capitalLiquide" | "obligationsDues" | "highWaterMarkProprietaire"
  >,
  tauxPointsDeBase: PointsDeBase,
): CalculRedevanceProprietaire {
  const highWaterMarkAvant = etat.highWaterMarkProprietaire;
  const valeurNette = calculerValeurEconomiqueNette(etat);

  if (valeurNette <= highWaterMarkAvant) {
    return {
      profitTaxable: 0n,
      montantRedevance: 0n,
      highWaterMarkAvant,
      highWaterMarkApres: highWaterMarkAvant,
    };
  }

  const profitTaxable = valeurNette - highWaterMarkAvant;
  const montantRedevance = appliquerTauxPointsDeBase(
    profitTaxable,
    tauxPointsDeBase,
  );

  return {
    profitTaxable,
    montantRedevance,
    highWaterMarkAvant,
    highWaterMarkApres: valeurNette,
  };
}
