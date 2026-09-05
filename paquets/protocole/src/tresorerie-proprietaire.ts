import type { MicroUsdc } from "./monnaie.js";
import { assertMicroUsdcNonNegatif } from "./monnaie.js";

/**
 * Trésorerie propriétaire — extérieure à la population des agents.
 * Distingue loyers et redevances encaissés des dépenses d'infrastructure.
 * Les coûts variables agent (compute, données, frais) ne sont PAS recomptés ici.
 */
export interface TresorerieProprietaire {
  readonly revenusLoyers: MicroUsdc;
  readonly revenusRedevances: MicroUsdc;
  readonly depensesInfrastructure: MicroUsdc;
}

export function creerTresorerieProprietaire(): TresorerieProprietaire {
  return {
    revenusLoyers: 0n,
    revenusRedevances: 0n,
    depensesInfrastructure: 0n,
  };
}

/** Solde net = loyers + redevances − dépenses infrastructure. */
export function calculerSoldeNetTresorerie(
  tresorerie: TresorerieProprietaire,
): MicroUsdc {
  return (
    tresorerie.revenusLoyers +
    tresorerie.revenusRedevances -
    tresorerie.depensesInfrastructure
  );
}

export function enregistrerLoyerEncaisse(
  tresorerie: TresorerieProprietaire,
  montant: MicroUsdc,
): TresorerieProprietaire {
  assertMicroUsdcNonNegatif(montant, "loyer encaissé");
  return {
    ...tresorerie,
    revenusLoyers: tresorerie.revenusLoyers + montant,
  };
}

export function enregistrerRedevanceEncaissee(
  tresorerie: TresorerieProprietaire,
  montant: MicroUsdc,
): TresorerieProprietaire {
  assertMicroUsdcNonNegatif(montant, "redevance encaissée");
  return {
    ...tresorerie,
    revenusRedevances: tresorerie.revenusRedevances + montant,
  };
}

export function enregistrerDepenseInfrastructureProprietaire(
  tresorerie: TresorerieProprietaire,
  montant: MicroUsdc,
): TresorerieProprietaire {
  assertMicroUsdcNonNegatif(montant, "dépense infrastructure propriétaire");
  return {
    ...tresorerie,
    depensesInfrastructure: tresorerie.depensesInfrastructure + montant,
  };
}
