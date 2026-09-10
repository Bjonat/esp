/**
 * Étanchéité stricte des seeds par mode :
 * - diagnostic → uniquement seedsDiagnostic
 * - calibration → uniquement seedsCalibration
 * - evaluation → uniquement seedsEvaluation
 *
 * Pas de seedsExplicites (interdit en parseur v0.3).
 * Les trois listes doivent être disjointes (fail-closed).
 * Intersection vide avec les réserves v0.1 / v0.2.
 */

import {
  SEEDS_EVALUATION_FIGEES_V01,
} from "./freeze-evaluation.js";
import {
  SEEDS_CALIBRATION_EVOLUTION_V02,
  SEEDS_DIAGNOSTIC_EXPRESSION_V02,
  SEEDS_EVALUATION_FIGEES_V02,
  intersectionSeeds,
} from "./seeds-evolution-v02.js";

export type UsageSeedsEvolutionV03 =
  | "diagnostic"
  | "calibration"
  | "evaluation";

/**
 * Plages candidates (exemples de conception) — NON officielles.
 * Ne pas les traiter comme seeds d'évaluation gelées.
 */
export const PLAGES_SEEDS_CANDIDATES_V03 = {
  diagnostic: { debut: 401, fin: 410 },
  calibration: { debut: 501, fin: 510 },
  evaluation: { debut: 3001, fin: 3020 },
} as const;

/** Seeds de fixture test — hors toute plage scientifique. */
export const SEEDS_FIXTURE_NON_SCIENTIFIQUES_V03: readonly number[] = [
  91001, 91002, 91003,
] as const;

export function assertSeedsDisjointesV03(options: {
  readonly seedsDiagnostic: readonly number[];
  readonly seedsCalibration: readonly number[];
  readonly seedsEvaluation: readonly number[];
}): void {
  const { seedsDiagnostic, seedsCalibration, seedsEvaluation } = options;

  const diagCal = intersectionSeeds(seedsDiagnostic, seedsCalibration);
  if (diagCal.length > 0) {
    throw new Error(
      `collision seeds diagnostic ∩ calibration v03 : ${diagCal.join(",")}`,
    );
  }
  const diagEval = intersectionSeeds(seedsDiagnostic, seedsEvaluation);
  if (diagEval.length > 0) {
    throw new Error(
      `collision seeds diagnostic ∩ evaluation v03 : ${diagEval.join(",")}`,
    );
  }
  const calEval = intersectionSeeds(seedsCalibration, seedsEvaluation);
  if (calEval.length > 0) {
    throw new Error(
      `collision seeds calibration ∩ evaluation v03 : ${calEval.join(",")}`,
    );
  }

  // Pas de réutilisation silencieuse des réserves historiques.
  for (const [nom, seeds] of [
    ["diagnostic", seedsDiagnostic],
    ["calibration", seedsCalibration],
    ["evaluation", seedsEvaluation],
  ] as const) {
    const v01 = intersectionSeeds(seeds, SEEDS_EVALUATION_FIGEES_V01);
    if (v01.length > 0) {
      throw new Error(
        `collision seeds ${nom} v03 ∩ evaluation v01 : ${v01.join(",")}`,
      );
    }
    const v02Eval = intersectionSeeds(seeds, SEEDS_EVALUATION_FIGEES_V02);
    if (v02Eval.length > 0) {
      throw new Error(
        `collision seeds ${nom} v03 ∩ evaluation v02 : ${v02Eval.join(",")}`,
      );
    }
    const v02Diag = intersectionSeeds(seeds, SEEDS_DIAGNOSTIC_EXPRESSION_V02);
    if (v02Diag.length > 0) {
      throw new Error(
        `collision seeds ${nom} v03 ∩ diagnostic v02 : ${v02Diag.join(",")}`,
      );
    }
    const v02Cal = intersectionSeeds(seeds, SEEDS_CALIBRATION_EVOLUTION_V02);
    if (v02Cal.length > 0) {
      throw new Error(
        `collision seeds ${nom} v03 ∩ calibration v02 : ${v02Cal.join(",")}`,
      );
    }
  }
}

/**
 * Refuse qu'une campagne `evaluation` consomme des seeds définies
 * ailleurs comme diagnostic ou calibration dans le même protocole.
 */
export function assertUsageSeedsEvaluationV03(options: {
  readonly usage: UsageSeedsEvolutionV03;
  readonly seedsActives: readonly number[];
  readonly seedsDiagnostic: readonly number[];
  readonly seedsCalibration: readonly number[];
}): void {
  if (options.usage !== "evaluation") {
    return;
  }
  const fuiteDiag = intersectionSeeds(
    options.seedsActives,
    options.seedsDiagnostic,
  );
  if (fuiteDiag.length > 0) {
    throw new Error(
      `évaluation v03 refuse seeds de diagnostic : ${fuiteDiag.join(",")}`,
    );
  }
  const fuiteCal = intersectionSeeds(
    options.seedsActives,
    options.seedsCalibration,
  );
  if (fuiteCal.length > 0) {
    throw new Error(
      `évaluation v03 refuse seeds de calibration : ${fuiteCal.join(",")}`,
    );
  }
}

export function seedsPourUsageV03(options: {
  readonly usage: UsageSeedsEvolutionV03;
  readonly seedsDiagnostic: readonly number[];
  readonly seedsCalibration: readonly number[];
  readonly seedsEvaluation: readonly number[];
}): readonly number[] {
  switch (options.usage) {
    case "diagnostic":
      return options.seedsDiagnostic;
    case "calibration":
      return options.seedsCalibration;
    case "evaluation":
      return options.seedsEvaluation;
  }
}
