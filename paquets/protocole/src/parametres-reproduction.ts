/**
 * Paramètres expérimentaux versionnés — capacité reproductive v0.1.
 * Aucune sélection par fitness.
 */

import type { MicroUsdc } from "./monnaie.js";
import { assertMicroUsdcNonNegatif, parserMicroUsdc } from "./monnaie.js";

export const VERSION_PARAMETRES_REPRODUCTION =
  "parametres-reproduction-v01" as const;

export type ParametresReproductionExperience = {
  readonly version: typeof VERSION_PARAMETRES_REPRODUCTION;
  /** Active la mécanique de reproduction (sinon tout refus). */
  readonly active: boolean;
  readonly dotationEnfantMicroUsdc: MicroUsdc;
  readonly coutReproductionMicroUsdc: MicroUsdc;
  /** VEN parent après reproduction (dotation + coût) doit rester ≥ cette réserve. */
  readonly reserveMinimaleParentMicroUsdc: MicroUsdc;
  readonly populationMaximale: number;
  readonly nombreMaxReproductionsParCycle: number;
  readonly nombreMaxEnfantsParAgent: number;
  /** Cycles minimum entre deux naissances du même parent (0 = aucun cooldown). */
  readonly cooldownCycles: number;
};

export type ParametresReproductionExperienceJson = {
  readonly version: string;
  readonly active: boolean;
  readonly dotationEnfantMicroUsdc: string;
  readonly coutReproductionMicroUsdc: string;
  readonly reserveMinimaleParentMicroUsdc: string;
  readonly populationMaximale: number;
  readonly nombreMaxReproductionsParCycle: number;
  readonly nombreMaxEnfantsParAgent: number;
  readonly cooldownCycles: number;
};

export class ParametresReproductionInvalidesErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParametresReproductionInvalidesErreur";
  }
}

export function parserParametresReproduction(
  brut: ParametresReproductionExperienceJson,
): ParametresReproductionExperience {
  if (brut.version !== VERSION_PARAMETRES_REPRODUCTION) {
    throw new ParametresReproductionInvalidesErreur(
      `version reproduction attendue ${VERSION_PARAMETRES_REPRODUCTION}, reçu ${brut.version}`,
    );
  }
  if (typeof brut.active !== "boolean") {
    throw new ParametresReproductionInvalidesErreur("active doit être booléen");
  }
  for (const nom of [
    "populationMaximale",
    "nombreMaxReproductionsParCycle",
    "nombreMaxEnfantsParAgent",
    "cooldownCycles",
  ] as const) {
    const valeur = brut[nom];
    if (!Number.isInteger(valeur) || valeur < 0) {
      throw new ParametresReproductionInvalidesErreur(
        `${nom} doit être un entier >= 0`,
      );
    }
  }
  if (brut.populationMaximale < 1) {
    throw new ParametresReproductionInvalidesErreur(
      "populationMaximale doit être >= 1",
    );
  }

  const parametres: ParametresReproductionExperience = {
    version: VERSION_PARAMETRES_REPRODUCTION,
    active: brut.active,
    dotationEnfantMicroUsdc: parserMicroUsdc(brut.dotationEnfantMicroUsdc),
    coutReproductionMicroUsdc: parserMicroUsdc(brut.coutReproductionMicroUsdc),
    reserveMinimaleParentMicroUsdc: parserMicroUsdc(
      brut.reserveMinimaleParentMicroUsdc,
    ),
    populationMaximale: brut.populationMaximale,
    nombreMaxReproductionsParCycle: brut.nombreMaxReproductionsParCycle,
    nombreMaxEnfantsParAgent: brut.nombreMaxEnfantsParAgent,
    cooldownCycles: brut.cooldownCycles,
  };

  assertMicroUsdcNonNegatif(
    parametres.dotationEnfantMicroUsdc,
    "dotationEnfant",
  );
  assertMicroUsdcNonNegatif(
    parametres.coutReproductionMicroUsdc,
    "coutReproduction",
  );
  assertMicroUsdcNonNegatif(
    parametres.reserveMinimaleParentMicroUsdc,
    "reserveMinimaleParent",
  );

  return parametres;
}

export function serialiserParametresReproduction(
  parametres: ParametresReproductionExperience,
): ParametresReproductionExperienceJson {
  return {
    version: parametres.version,
    active: parametres.active,
    dotationEnfantMicroUsdc: parametres.dotationEnfantMicroUsdc.toString(10),
    coutReproductionMicroUsdc: parametres.coutReproductionMicroUsdc.toString(10),
    reserveMinimaleParentMicroUsdc:
      parametres.reserveMinimaleParentMicroUsdc.toString(10),
    populationMaximale: parametres.populationMaximale,
    nombreMaxReproductionsParCycle: parametres.nombreMaxReproductionsParCycle,
    nombreMaxEnfantsParAgent: parametres.nombreMaxEnfantsParAgent,
    cooldownCycles: parametres.cooldownCycles,
  };
}

/** Paramètres désactivés par défaut — opt-in expérimental. */
export function creerParametresReproductionInactifs(): ParametresReproductionExperience {
  return {
    version: VERSION_PARAMETRES_REPRODUCTION,
    active: false,
    dotationEnfantMicroUsdc: 0n,
    coutReproductionMicroUsdc: 0n,
    reserveMinimaleParentMicroUsdc: 0n,
    populationMaximale: 1,
    nombreMaxReproductionsParCycle: 0,
    nombreMaxEnfantsParAgent: 0,
    cooldownCycles: 0,
  };
}
