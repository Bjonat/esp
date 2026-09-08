/**
 * Point de trajectoire par cycle — montants en chaînes micro-USDC.
 * Spec §14 + fréquences génotypes / lignées (§23–24).
 */

export type InstantaneFrequenceGenotype = {
  readonly empreinteConfiguration: string;
  readonly agentsVivants: number;
  readonly partPopulationVivanteBps: number;
};

export type InstantaneLignee = {
  readonly identifiantLignee: string;
  readonly membresVivants: number;
  readonly membresCumules: number;
  readonly partPopulationVivanteBps: number;
  readonly generationMaximale: number;
};

export type PointTrajectoireEvolution = {
  readonly cycle: number;
  readonly populationTotale: number;
  readonly populationVivante: number;
  readonly venPopulationMicroUsdc: string;
  readonly capitalLiquidePopulationMicroUsdc: string;
  readonly revenusActiviteMicroUsdc: string;
  readonly pertesActiviteMicroUsdc: string;
  readonly computeMicroUsdc: string;
  readonly donneesMicroUsdc: string;
  readonly fraisExecutionMicroUsdc: string;
  readonly loyersMicroUsdc: string;
  readonly redevancesMicroUsdc: string;
  readonly coutsReproductionMicroUsdc: string;
  readonly resultatApresContratMicroUsdc: string;
  readonly resultatApresReproductionMicroUsdc: string;
  readonly naissances: number;
  readonly deces: number;
  readonly generationsPresentes: readonly number[];
  readonly ligneesVivantes: number;
  readonly configurationsHeritablesDistinctes: number;
  readonly mutationsCumulees: number;
  readonly mutationsCycle: number;
  readonly demandesInference: number;
  readonly coutCognitifMicroUsdc: string;
  readonly regretExAnteCumuleNumerateur: string;
  readonly regretExAnteCumuleDenominateur: string;
  readonly tauxDecisionsOptimalesExAnteBps: number | null;
  readonly contributionProprietaireMicroUsdc: string;
  readonly eteinte: boolean;
  readonly frequencesGenotypes: readonly InstantaneFrequenceGenotype[];
  readonly lignees: readonly InstantaneLignee[];
};

export function serialiserPointTrajectoire(
  point: PointTrajectoireEvolution,
): string {
  return JSON.stringify(point);
}

export function parserPointTrajectoire(
  ligne: string,
): PointTrajectoireEvolution {
  return JSON.parse(ligne) as PointTrajectoireEvolution;
}
