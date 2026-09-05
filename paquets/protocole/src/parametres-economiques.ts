import type { MicroUsdc, PointsDeBase } from "./monnaie.js";
import { POINTS_DE_BASE_PAR_UNITE } from "./monnaie.js";

/**
 * Contrat économique versionné d'une expérience (ESP-ECO-011).
 * Aucune valeur métier importante n'est hardcodée dans le moteur.
 */
export interface ParametresEconomiquesExperience {
  readonly version: string;
  readonly loyerInfrastructureMicroUsdc: MicroUsdc;
  readonly periodeLoyerEnCycles: number;
  /** Taux en points de base (10_000 = 100 %). */
  readonly tauxRedevanceProprietairePointsDeBase: PointsDeBase;
  readonly coutOperationnelMinimalParCycleMicroUsdc: MicroUsdc;
  readonly seuilRunwaySainEnCycles: number;
  readonly seuilRunwayContraintEnCycles: number;
  readonly cyclesDormanceAvantMort: number;
}

/** Alias explicite du contrat économique versionné. */
export type ContratEconomique = ParametresEconomiquesExperience;

export class ParametresEconomiquesInvalidesErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParametresEconomiquesInvalidesErreur";
  }
}

function assertEntierStrictementPositif(
  valeur: number,
  nom: string,
): void {
  if (!Number.isInteger(valeur) || valeur < 1) {
    throw new ParametresEconomiquesInvalidesErreur(
      `${nom} doit être un entier >= 1`,
    );
  }
}

/**
 * Valide un contrat économique sans choisir de valeurs métier définitives.
 * Appelée obligatoirement par le moteur de cycle.
 */
export function validerParametresEconomiques(
  parametres: ParametresEconomiquesExperience,
): void {
  if (parametres.version.trim() === "") {
    throw new ParametresEconomiquesInvalidesErreur(
      "version du contrat économique requise",
    );
  }
  if (parametres.loyerInfrastructureMicroUsdc < 0n) {
    throw new ParametresEconomiquesInvalidesErreur(
      "loyerInfrastructureMicroUsdc ne peut pas être négatif",
    );
  }
  assertEntierStrictementPositif(
    parametres.periodeLoyerEnCycles,
    "periodeLoyerEnCycles",
  );
  if (parametres.tauxRedevanceProprietairePointsDeBase < 0n) {
    throw new ParametresEconomiquesInvalidesErreur(
      "tauxRedevanceProprietairePointsDeBase ne peut pas être négatif",
    );
  }
  if (
    parametres.tauxRedevanceProprietairePointsDeBase >
    POINTS_DE_BASE_PAR_UNITE
  ) {
    throw new ParametresEconomiquesInvalidesErreur(
      `tauxRedevanceProprietairePointsDeBase doit être <= ${POINTS_DE_BASE_PAR_UNITE.toString(10)} (100 %)`,
    );
  }
  if (parametres.coutOperationnelMinimalParCycleMicroUsdc < 0n) {
    throw new ParametresEconomiquesInvalidesErreur(
      "coutOperationnelMinimalParCycleMicroUsdc ne peut pas être négatif",
    );
  }
  // Coût nul rend le runway non borné : interdit pour un calcul de survie cohérent.
  if (parametres.coutOperationnelMinimalParCycleMicroUsdc === 0n) {
    throw new ParametresEconomiquesInvalidesErreur(
      "coutOperationnelMinimalParCycleMicroUsdc doit être > 0 pour un runway déterministe",
    );
  }
  assertEntierStrictementPositif(
    parametres.seuilRunwaySainEnCycles,
    "seuilRunwaySainEnCycles",
  );
  assertEntierStrictementPositif(
    parametres.seuilRunwayContraintEnCycles,
    "seuilRunwayContraintEnCycles",
  );
  if (
    parametres.seuilRunwayContraintEnCycles >=
    parametres.seuilRunwaySainEnCycles
  ) {
    throw new ParametresEconomiquesInvalidesErreur(
      "seuilRunwayContraintEnCycles doit être < seuilRunwaySainEnCycles",
    );
  }
  assertEntierStrictementPositif(
    parametres.cyclesDormanceAvantMort,
    "cyclesDormanceAvantMort",
  );
}
