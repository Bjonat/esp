/**
 * Critères de calibration évolution multi-génération v0.2 — seuils figés.
 * Voir documentation/CALIBRATION_EVOLUTION_V02.md.
 *
 * Interdit pour la sélection : toute métrique D−C / VEN / profit.
 */

export const VERSION_CRITERES_CALIBRATION_V02 =
  "criteres-calibration-v02" as const;

export const SEUILS_CALIBRATION_V02 = {
  seedsCalibrationAttendues: [301, 302, 303, 304, 305] as const,
  generationMedianeBCDMin: 3,
  seedsAvecNaissanceMinParConditionBcd: 5,
  seedsDescendanceDifferentielleMinParCondition: 3,
  runsDAvecMutationMin: 3,
  runsDExpressionCognitiveMin: 3,
  runsDExpressionComportementOuEcoMin: 2,
  fractionCyclesPopulationMaxAtteinteMax: 0.1,
  fractionCyclesPlafondNaissancesAtteintMax: 0.1,
  fractionRunsContraintsParGardeFouMax: 0.2,
  generationMinAvantExtinctionTotale: 2,
} as const;

export type IdentifiantCritereCalibrationV02 =
  | "A_INTEGRITE"
  | "B_COUVERTURE_PHENOTYPIQUE"
  | "C_PORTEE_MULTI_GENERATION"
  | "D_DESCENDANCE_DIFFERENTIELLE"
  | "E_MUTATIONS_PRESENTES"
  | "F_EXPRESSION_COGNITIVE"
  | "G_TRAVERSEE_COMPORTEMENT_ECO"
  | "GARDE_FOUS"
  | "EXTINCTION_PRECOCE_TOTALE";

export const IDENTIFIANTS_CRITERES_CALIBRATION_V02: readonly IdentifiantCritereCalibrationV02[] =
  [
    "A_INTEGRITE",
    "B_COUVERTURE_PHENOTYPIQUE",
    "C_PORTEE_MULTI_GENERATION",
    "D_DESCENDANCE_DIFFERENTIELLE",
    "E_MUTATIONS_PRESENTES",
    "F_EXPRESSION_COGNITIVE",
    "G_TRAVERSEE_COMPORTEMENT_ECO",
    "GARDE_FOUS",
    "EXTINCTION_PRECOCE_TOTALE",
  ];

export type VerdictCritereCalibration = {
  readonly identifiant: IdentifiantCritereCalibrationV02;
  readonly atteint: boolean;
  readonly detail: string;
};

/**
 * Descendance différentielle sur un instantané de lignées :
 * max(membresCumules) - min(membresCumules) > 0.
 */
export function descendanceDifferentiellePresente(
  lignees: readonly { readonly membresCumules: number }[],
): boolean {
  if (lignees.length < 2) {
    return false;
  }
  let min = lignees[0]!.membresCumules;
  let max = min;
  for (const l of lignees) {
    if (l.membresCumules < min) {
      min = l.membresCumules;
    }
    if (l.membresCumules > max) {
      max = l.membresCumules;
    }
  }
  return max - min > 0;
}
