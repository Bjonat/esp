/**
 * Helpers d'audit méthodologique calibration — sans lancer de runs.
 */

import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ProtocoleExperienceEvolutionV01,
  ProtocoleExperienceEvolutionV01Json,
} from "./protocole-evolution.js";

/** Paramètres expérimentaux que calibration et évaluation doivent partager. */
export type ParametresExperimentauxPartages = {
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly tauxMutationConditionDBps: number;
  readonly populationMaximale: number;
  readonly nombreMaxNaissancesParCycle: number;
  readonly dotationEnfantMicroUsdc: string;
  readonly coutReproductionMicroUsdc: string;
  readonly reserveMinimaleParentMicroUsdc: string;
  readonly tauxMutationParGeneBps: number;
  readonly coutOperationnelMinimalParCycleMicroUsdc: string;
  readonly seuilRunwaySainEnCycles: number;
  readonly seuilRunwayContraintEnCycles: number;
  readonly cyclesDormanceAvantMort: number;
};

export function extraireParametresExperimentauxPartages(
  protocole:
    | ProtocoleExperienceEvolutionV01
    | ProtocoleExperienceEvolutionV01Json,
): ParametresExperimentauxPartages {
  const reproduction =
    "reproduction" in protocole && protocole.reproduction !== undefined
      ? protocole.reproduction
      : undefined;
  const reproductionAutonome =
    "reproductionAutonome" in protocole &&
    protocole.reproductionAutonome !== undefined
      ? protocole.reproductionAutonome
      : undefined;
  const mutationBase =
    "mutationBase" in protocole && protocole.mutationBase !== undefined
      ? protocole.mutationBase
      : undefined;
  const eco = protocole.parametresEconomiques;

  const popMax =
    typeof reproduction?.populationMaximale === "number"
      ? reproduction.populationMaximale
      : -1;
  const naiss =
    typeof reproductionAutonome?.nombreMaxNaissancesParCycle === "number"
      ? reproductionAutonome.nombreMaxNaissancesParCycle
      : -1;
  const tauxGene =
    typeof mutationBase?.tauxMutationParGeneBps === "number"
      ? mutationBase.tauxMutationParGeneBps
      : -1;

  return {
    cyclesMaximum: protocole.cyclesMaximum,
    populationInitiale: protocole.populationInitiale,
    capitalInitialParAgentMicroUsdc: String(
      protocole.capitalInitialParAgentMicroUsdc,
    ),
    tauxMutationConditionDBps: protocole.tauxMutationConditionDBps,
    populationMaximale: popMax,
    nombreMaxNaissancesParCycle: naiss,
    dotationEnfantMicroUsdc: String(reproduction?.dotationEnfantMicroUsdc ?? ""),
    coutReproductionMicroUsdc: String(
      reproduction?.coutReproductionMicroUsdc ?? "",
    ),
    reserveMinimaleParentMicroUsdc: String(
      reproduction?.reserveMinimaleParentMicroUsdc ?? "",
    ),
    tauxMutationParGeneBps: tauxGene,
    coutOperationnelMinimalParCycleMicroUsdc: String(
      eco.coutOperationnelMinimalParCycleMicroUsdc,
    ),
    seuilRunwaySainEnCycles: eco.seuilRunwaySainEnCycles,
    seuilRunwayContraintEnCycles: eco.seuilRunwayContraintEnCycles,
    cyclesDormanceAvantMort: eco.cyclesDormanceAvantMort,
  };
}

export function protocolesPartagentParametresExperimentaux(
  a:
    | ProtocoleExperienceEvolutionV01
    | ProtocoleExperienceEvolutionV01Json,
  b:
    | ProtocoleExperienceEvolutionV01
    | ProtocoleExperienceEvolutionV01Json,
): boolean {
  const pa = extraireParametresExperimentauxPartages(a);
  const pb = extraireParametresExperimentauxPartages(b);
  return JSON.stringify(pa) === JSON.stringify(pb);
}

const RE_RUN_SEED = /^(?:[A-D]-)?seed-(\d+)$/i;

/**
 * Parcourt un arbre de résultats et collecte les seeds présentes dans les
 * répertoires de runs (`…/runs/A-seed-101`, etc.).
 */
export function collecterSeedsExecuteesDansResultats(
  repertoireResultats: string,
): readonly number[] {
  if (!existsSync(repertoireResultats)) {
    return [];
  }
  const trouvees = new Set<number>();

  function visiter(chemin: string): void {
    let entrees;
    try {
      entrees = readdirSync(chemin);
    } catch {
      return;
    }
    for (const nom of entrees) {
      const plein = join(chemin, nom);
      let estDir = false;
      try {
        estDir = statSync(plein).isDirectory();
      } catch {
        continue;
      }
      if (!estDir) {
        continue;
      }
      const m = RE_RUN_SEED.exec(nom);
      if (m?.[1] !== undefined) {
        trouvees.add(Number(m[1]));
      }
      visiter(plein);
    }
  }

  visiter(repertoireResultats);
  return [...trouvees].sort((x, y) => x - y);
}

/**
 * Compte combien de seeds d'évaluation apparaissent comme runs exécutés.
 */
export function compterSeedsEvaluationExecutees(options: {
  readonly repertoireResultats: string;
  readonly seedsEvaluation: readonly number[];
}): number {
  const executees = new Set(
    collecterSeedsExecuteesDansResultats(options.repertoireResultats),
  );
  let n = 0;
  for (const s of options.seedsEvaluation) {
    if (executees.has(s)) {
      n += 1;
    }
  }
  return n;
}
