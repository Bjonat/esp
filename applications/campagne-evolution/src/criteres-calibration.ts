/**
 * Critères de calibration évolution multi-génération v0.1 — seuils fixes.
 *
 * Formules exactes (sur les runs fournis à la vue) :
 *
 * A — contrôle négatif
 *   controleNegatifOk === true (exigence 100 %).
 *
 * B — fractionRunsContraintsParGardeFou
 *   |{ run | runContraintParGardeFou }| / nombreRuns  <  0.20
 *   (tous les runs A/B/C/D).
 *
 * C — fractionCyclesPopulationMaxAtteinte
 *   mean_r ( cyclesPopulationMaximaleAtteinte_r / cyclesMaximum_r )  <  0.10
 *   (tous les runs ; cyclesMaximum_r tiré du résumé).
 *
 * D — fractionCyclesPlafondNaissancesAtteint
 *   mean_r ( cyclesPlafondNaissancesAtteint_r / cyclesMaximum_r )  <  0.10
 *   (tous les runs).
 *
 * E — generationMedianeBCD
 *   mediane( generationMaximale des runs B∪C∪D )  >=  3
 *
 * F — fractionRunsDAvecMutation
 *   |{ D | mutationsCumulees > 0 }| / |runs D|  >  0.50
 *
 * G — extinction immédiate (universelle précoce)
 *   fractionExtinctionImmediate =
 *     |{ BCD | cycleExtinction !== null && cycleExtinction <= 2 }| / |BCD|
 *   exigence : fractionExtinctionImmediate < 0.8
 *
 * H — absence structurelle d'extinctions (« immortalité »)
 *   Soft : si generationMedianeBCD >= 3 ET B/C/D garde-fous OK
 *   (fractionRunsContraints < 0.20 et mean pop/naissances < 0.10),
 *   alors H passe même avec 0 extinction.
 *   Sinon : 0 < fractionRunsEteintsBCD < 1.
 *
 * I — saturation précoce population max
 *   Un run BCD est « saturé tôt » si cyclesPopulationMaximaleAtteinte > 0
 *   et (cyclesExecutes - cyclesPopulationMaximaleAtteinte + 1) <= 3
 *   (borne haute du premier cycle touché ≤ 3, sans trajectoire).
 *   fractionSaturesTot : |saturés tôt BCD| / |BCD|  <  0.5
 *
 * Interdit : toute métrique D−C, VEN, regret, fréquences gènes, contribution propriétaire.
 */

export const VERSION_CRITERES_CALIBRATION = "criteres-calibration-v01" as const;

export const SEUILS_CALIBRATION_V01 = {
  fractionRunsContraintsParGardeFouMax: 0.2,
  fractionCyclesPopulationMaxAtteinteMax: 0.1,
  fractionCyclesPlafondNaissancesAtteintMax: 0.1,
  generationMedianeBCDMin: 3,
  fractionRunsDAvecMutationMin: 0.5,
  fractionExtinctionImmediateMax: 0.8,
  fractionSaturationPrecoceMax: 0.5,
  cycleExtinctionImmediateMax: 2,
  cycleSaturationPrecoceMax: 3,
} as const;

export type IdentifiantCritereCalibration =
  | "CONTROLE_NEGATIF"
  | "FRACTION_RUNS_CONTRAINTS"
  | "FRACTION_CYCLES_POPULATION_MAX"
  | "FRACTION_CYCLES_PLAFOND_NAISSANCES"
  | "GENERATION_MEDIANE_BCD"
  | "FRACTION_D_MUTATION"
  | "EXTINCTION_IMMEDIATE"
  | "EXTINCTION_STRUCTURELLE"
  | "SATURATION_PRECOCE";

export const IDENTIFIANTS_CRITERES_CALIBRATION: readonly IdentifiantCritereCalibration[] =
  [
    "CONTROLE_NEGATIF",
    "FRACTION_RUNS_CONTRAINTS",
    "FRACTION_CYCLES_POPULATION_MAX",
    "FRACTION_CYCLES_PLAFOND_NAISSANCES",
    "GENERATION_MEDIANE_BCD",
    "FRACTION_D_MUTATION",
    "EXTINCTION_IMMEDIATE",
    "EXTINCTION_STRUCTURELLE",
    "SATURATION_PRECOCE",
  ];

/**
 * Borne haute du premier cycle où populationMax a pu être touchée :
 * cyclesExecutes - cyclesPopulationMaximaleAtteinte + 1 (si hits > 0).
 */
export function borneHautePremierCyclePopulationMax(options: {
  readonly cyclesExecutes: number;
  readonly cyclesPopulationMaximaleAtteinte: number;
}): number | null {
  if (options.cyclesPopulationMaximaleAtteinte <= 0) {
    return null;
  }
  return (
    options.cyclesExecutes - options.cyclesPopulationMaximaleAtteinte + 1
  );
}

export function estSaturePopulationTot(
  options: {
    readonly cyclesExecutes: number;
    readonly cyclesPopulationMaximaleAtteinte: number;
  },
  cycleMax = SEUILS_CALIBRATION_V01.cycleSaturationPrecoceMax,
): boolean {
  const borne = borneHautePremierCyclePopulationMax(options);
  return borne !== null && borne <= cycleMax;
}
