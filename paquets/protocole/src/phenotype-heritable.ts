/**
 * Génotype héritable → phénotype PolitiqueBudgetCognitif.
 * Les clés absentes (legacy) retombent sur la politique d'expérience de base.
 */

import type { ConfigurationHeritableAgent } from "./configuration-heritable.js";
import type { MicroUsdc } from "./monnaie.js";
import { parserMicroUsdc } from "./monnaie.js";

export type PolitiqueBudgetCognitifBase = {
  readonly identifiant: "politique-budget-cognitif-agent";
  readonly version: string;
  readonly seuilEnjeuPourInferenceMicroUsdc: MicroUsdc;
  readonly partMaxVenParCycleBps: number;
  readonly plafondCognitifMicroUsdc: MicroUsdc;
  readonly modeleLogique: string;
  readonly comportementSansInference: "attendre" | "agir_si_favorable";
  readonly refuserSiCritiqueOuDormant: boolean;
};

/**
 * Résout la politique cognitive effective d'un agent.
 * modeleLogique : toujours celui de la base (non héritable / non mutable v0.1).
 */
export function resoudrePolitiqueDepuisConfigurationHeritable(options: {
  readonly politiqueBase: PolitiqueBudgetCognitifBase;
  readonly configurationHeritable?: ConfigurationHeritableAgent;
}): PolitiqueBudgetCognitifBase {
  const base = options.politiqueBase;
  const p = options.configurationHeritable?.parametres ?? {};

  let seuil = base.seuilEnjeuPourInferenceMicroUsdc;
  if (typeof p.seuilEnjeuPourInferenceMicroUsdc === "string") {
    try {
      seuil = parserMicroUsdc(p.seuilEnjeuPourInferenceMicroUsdc);
    } catch {
      // conserve base
    }
  }

  let part = base.partMaxVenParCycleBps;
  if (typeof p.partMaxVenParCycleBps === "number") {
    part = p.partMaxVenParCycleBps;
  }

  let plafond = base.plafondCognitifMicroUsdc;
  if (typeof p.plafondCognitifMicroUsdc === "string") {
    try {
      plafond = parserMicroUsdc(p.plafondCognitifMicroUsdc);
    } catch {
      // conserve base
    }
  }

  let comportement = base.comportementSansInference;
  if (
    p.comportementSansInference === "attendre" ||
    p.comportementSansInference === "agir_si_favorable"
  ) {
    comportement = p.comportementSansInference;
  }

  return {
    identifiant: base.identifiant,
    version: base.version,
    seuilEnjeuPourInferenceMicroUsdc: seuil,
    partMaxVenParCycleBps: part,
    plafondCognitifMicroUsdc: plafond,
    modeleLogique: base.modeleLogique,
    comportementSansInference: comportement,
    refuserSiCritiqueOuDormant: base.refuserSiCritiqueOuDormant,
  };
}
