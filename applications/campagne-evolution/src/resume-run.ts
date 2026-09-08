/**
 * Résumé final d'un run — métriques multidimensionnelles, aucun score global.
 * Spec §18.
 */

import type { ConditionEvolution } from "./protocole-evolution.js";
import { calculerEmpreinteResultatScientifiqueDepuisRun } from "./empreinte.js";
import type {
  InstantaneFrequenceGenotype,
  PointTrajectoireEvolution,
} from "./trajectoire.js";

export type ResumeRunEvolution = {
  readonly identifiantRun: string;
  readonly identifiantBatch: string;
  readonly condition: ConditionEvolution;
  readonly seed: number;
  readonly empreinteProtocole: string;
  /** Intégrité d'exécution (peut différer B vs C sham). */
  readonly empreinteExecutionRun: string;
  /** Sorties observables (B ≡ C si taux mutation 0). */
  readonly empreinteResultatScientifique: string;
  /** @deprecated alias de empreinteExecutionRun */
  readonly empreinteRun: string;
  readonly versionProtocole: string;
  readonly metaCode: {
    readonly gitSha: string | null;
    readonly workingTreeDirty: boolean | null;
    readonly source: string;
  };
  readonly dateLancement: string;
  readonly statut: "termine";
  readonly dureeMs: number;
  readonly cyclesExecutes: number;
  readonly cyclesMaximum: number;
  // Économie
  readonly venPopulationFinaleMicroUsdc: string;
  readonly resultatActiviteBrutCumuleMicroUsdc: string;
  readonly resultatApresContratCumuleMicroUsdc: string;
  readonly resultatApresReproductionCumuleMicroUsdc: string;
  readonly computeCumuleMicroUsdc: string;
  readonly contributionProprietaireCumuleeMicroUsdc: string;
  // Survie
  readonly populationVivanteFinale: number;
  readonly eteinte: boolean;
  readonly cycleExtinction: number | null;
  // Reproduction
  readonly naissancesCumulees: number;
  readonly generationMaximale: number;
  readonly ligneesVivantes: number;
  readonly descendantsCumules: number;
  // Variation
  readonly mutationsCumulees: number;
  readonly configurationsDistinctesFinales: number;
  readonly frequencesGenotypiquesFinales: readonly InstantaneFrequenceGenotype[];
  // Décision / cognition
  readonly regretExAnteCumuleNumerateur: string;
  readonly regretExAnteCumuleDenominateur: string;
  readonly tauxDecisionsOptimalesExAnteBps: number | null;
  readonly demandesInference: number;
  readonly coutCognitionMicroUsdc: string;
  // Garde-fous
  readonly cyclesPopulationMaximaleAtteinte: number;
  readonly cyclesPlafondNaissancesAtteint: number;
  readonly runContraintParGardeFou: boolean;
};

export function fabriquerResumeDepuisTrajectoire(options: {
  readonly identifiantRun: string;
  readonly identifiantBatch: string;
  readonly condition: ConditionEvolution;
  readonly seed: number;
  readonly empreinteProtocole: string;
  readonly empreinteExecutionRun: string;
  readonly versionProtocole: string;
  readonly metaCode: ResumeRunEvolution["metaCode"];
  readonly dateLancement: string;
  readonly dureeMs: number;
  readonly cyclesMaximum: number;
  readonly points: readonly PointTrajectoireEvolution[];
  readonly cyclesPopulationMaximaleAtteinte: number;
  readonly cyclesPlafondNaissancesAtteint: number;
}): ResumeRunEvolution {
  const { points } = options;
  if (points.length === 0) {
    throw new Error("trajectoire vide — impossible de fabriquer le résumé");
  }
  const dernier = points[points.length - 1]!;
  let cycleExtinction: number | null = null;
  for (const p of points) {
    if (p.eteinte && cycleExtinction === null) {
      cycleExtinction = p.cycle;
    }
  }
  const eteinte = dernier.populationVivante === 0;

  const brouillon = {
    identifiantRun: options.identifiantRun,
    identifiantBatch: options.identifiantBatch,
    condition: options.condition,
    seed: options.seed,
    empreinteProtocole: options.empreinteProtocole,
    empreinteExecutionRun: options.empreinteExecutionRun,
    versionProtocole: options.versionProtocole,
    metaCode: options.metaCode,
    dateLancement: options.dateLancement,
    statut: "termine" as const,
    dureeMs: options.dureeMs,
    cyclesExecutes: points.length,
    cyclesMaximum: options.cyclesMaximum,
    venPopulationFinaleMicroUsdc: dernier.venPopulationMicroUsdc,
    resultatActiviteBrutCumuleMicroUsdc: (
      BigInt(dernier.revenusActiviteMicroUsdc) -
      BigInt(dernier.pertesActiviteMicroUsdc)
    ).toString(10),
    resultatApresContratCumuleMicroUsdc: dernier.resultatApresContratMicroUsdc,
    resultatApresReproductionCumuleMicroUsdc:
      dernier.resultatApresReproductionMicroUsdc,
    computeCumuleMicroUsdc: dernier.computeMicroUsdc,
    contributionProprietaireCumuleeMicroUsdc:
      dernier.contributionProprietaireMicroUsdc,
    populationVivanteFinale: dernier.populationVivante,
    eteinte,
    cycleExtinction,
    naissancesCumulees: points.reduce((acc, p) => acc + p.naissances, 0),
    generationMaximale: Math.max(
      0,
      ...points.flatMap((p) => p.generationsPresentes),
    ),
    ligneesVivantes: dernier.ligneesVivantes,
    descendantsCumules: points.reduce((acc, p) => acc + p.naissances, 0),
    mutationsCumulees: dernier.mutationsCumulees,
    configurationsDistinctesFinales: dernier.configurationsHeritablesDistinctes,
    frequencesGenotypiquesFinales: dernier.frequencesGenotypes,
    regretExAnteCumuleNumerateur: dernier.regretExAnteCumuleNumerateur,
    regretExAnteCumuleDenominateur: dernier.regretExAnteCumuleDenominateur,
    tauxDecisionsOptimalesExAnteBps: dernier.tauxDecisionsOptimalesExAnteBps,
    demandesInference: dernier.demandesInference,
    coutCognitionMicroUsdc: dernier.coutCognitifMicroUsdc,
    cyclesPopulationMaximaleAtteinte: options.cyclesPopulationMaximaleAtteinte,
    cyclesPlafondNaissancesAtteint: options.cyclesPlafondNaissancesAtteint,
    runContraintParGardeFou:
      options.cyclesPopulationMaximaleAtteinte > 0 ||
      options.cyclesPlafondNaissancesAtteint > 0,
  };

  const empreinteResultatScientifique =
    calculerEmpreinteResultatScientifiqueDepuisRun({
      empreinteProtocole: options.empreinteProtocole,
      seed: options.seed,
      points: points as unknown as readonly Readonly<Record<string, unknown>>[],
      resume: brouillon as unknown as Readonly<Record<string, unknown>>,
    });

  return {
    ...brouillon,
    empreinteResultatScientifique,
    empreinteRun: options.empreinteExecutionRun,
  };
}
