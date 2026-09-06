import { readFileSync } from "node:fs";
import type { ParametresEconomiquesExperience } from "@esp/protocole";
import { parserMicroUsdc, validerParametresEconomiques } from "@esp/protocole";
import type { MicroUsdc } from "@esp/protocole";

/**
 * Mode d'expérience v0.1 — simulation déterministe uniquement.
 * Replay / Shadow / Live restent des concepts futurs.
 */
export type ModeExperience = "simulation";

export type StatutExperience =
  | "configuree"
  | "prete"
  | "en_cours"
  | "en_pause"
  | "terminee";

/**
 * Configuration sérialisable d'une expérience (fichier JSON).
 * Les montants sont des chaînes décimales entières micro-USDC.
 */
export interface ConfigurationExperienceJson {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly mode: ModeExperience;
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: {
    readonly version: string;
    readonly loyerInfrastructureMicroUsdc: string;
    readonly periodeLoyerEnCycles: number;
    readonly tauxRedevanceProprietairePointsDeBase: string;
    readonly coutOperationnelMinimalParCycleMicroUsdc: string;
    readonly seuilRunwaySainEnCycles: number;
    readonly seuilRunwayContraintEnCycles: number;
    readonly cyclesDormanceAvantMort: number;
  };
}

export interface ConfigurationExperience {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly mode: ModeExperience;
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: MicroUsdc;
  readonly parametresEconomiques: ParametresEconomiquesExperience;
}

export class ConfigurationExperienceInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationExperienceInvalideErreur";
  }
}

function assertEntierPositif(valeur: number, nom: string): void {
  if (!Number.isInteger(valeur) || valeur < 1) {
    throw new ConfigurationExperienceInvalideErreur(
      `${nom} doit être un entier >= 1`,
    );
  }
}

/**
 * Parse et valide une configuration JSON d'expérience.
 */
export function parserConfigurationExperience(
  brut: ConfigurationExperienceJson,
): ConfigurationExperience {
  if (brut.identifiantExperience.trim() === "") {
    throw new ConfigurationExperienceInvalideErreur(
      "identifiantExperience requis",
    );
  }
  if (brut.versionProtocole.trim() === "") {
    throw new ConfigurationExperienceInvalideErreur("versionProtocole requise");
  }
  if (brut.mode !== "simulation") {
    throw new ConfigurationExperienceInvalideErreur(
      `mode non supporté en v0.1 : ${String(brut.mode)}`,
    );
  }
  if (!Number.isInteger(brut.graineSimulation)) {
    throw new ConfigurationExperienceInvalideErreur(
      "graineSimulation doit être un entier",
    );
  }
  assertEntierPositif(
    brut.taillePopulationInitiale,
    "taillePopulationInitiale",
  );

  const parametres: ParametresEconomiquesExperience = {
    version: brut.parametresEconomiques.version,
    loyerInfrastructureMicroUsdc: parserMicroUsdc(
      brut.parametresEconomiques.loyerInfrastructureMicroUsdc,
    ),
    periodeLoyerEnCycles: brut.parametresEconomiques.periodeLoyerEnCycles,
    tauxRedevanceProprietairePointsDeBase: parserMicroUsdc(
      brut.parametresEconomiques.tauxRedevanceProprietairePointsDeBase,
    ),
    coutOperationnelMinimalParCycleMicroUsdc: parserMicroUsdc(
      brut.parametresEconomiques.coutOperationnelMinimalParCycleMicroUsdc,
    ),
    seuilRunwaySainEnCycles:
      brut.parametresEconomiques.seuilRunwaySainEnCycles,
    seuilRunwayContraintEnCycles:
      brut.parametresEconomiques.seuilRunwayContraintEnCycles,
    cyclesDormanceAvantMort:
      brut.parametresEconomiques.cyclesDormanceAvantMort,
  };

  validerParametresEconomiques(parametres);

  return {
    identifiantExperience: brut.identifiantExperience,
    versionProtocole: brut.versionProtocole,
    mode: brut.mode,
    graineSimulation: brut.graineSimulation,
    taillePopulationInitiale: brut.taillePopulationInitiale,
    capitalInitialParAgentMicroUsdc: parserMicroUsdc(
      brut.capitalInitialParAgentMicroUsdc,
    ),
    parametresEconomiques: parametres,
  };
}

export function chargerConfigurationExperience(
  cheminFichier: string,
): ConfigurationExperience {
  const texte = readFileSync(cheminFichier, "utf8");
  const brut = JSON.parse(texte) as ConfigurationExperienceJson;
  return parserConfigurationExperience(brut);
}
