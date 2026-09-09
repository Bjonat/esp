/**
 * Réserves de seeds évolution v0.2 — diagnostic, calibration, évaluation.
 * Les plages sont disjointes et figées avant toute exécution d'évaluation.
 */

import { SEEDS_EVALUATION_FIGEES_V01 } from "./freeze-evaluation.js";

/** Seeds diagnostic d'expression phénotypique (E1/E2). */
export const SEEDS_DIAGNOSTIC_EXPRESSION_V02: readonly number[] = [
  201, 202, 203, 204, 205,
] as const;

/** Seeds calibration évolutive v0.2 (e1-01). */
export const SEEDS_CALIBRATION_EVOLUTION_V02: readonly number[] = [
  301, 302, 303, 304, 305,
] as const;

/** Seeds d'évaluation v0.2 — réservées, non exécutées au freeze. */
export const SEEDS_EVALUATION_FIGEES_V02: readonly number[] = [
  2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012,
  2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020,
] as const;

export const NOMBRE_SEEDS_EVALUATION_V02 = SEEDS_EVALUATION_FIGEES_V02.length;

/** Distribution d'enjeux E2 (micro-USDC), figée. */
export const ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2: readonly string[] = [
  "50000",
  "75000",
  "125000",
  "175000",
  "250000",
] as const;

export const IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2 =
  "environnement-exposition-v02-e2" as const;

export function intersectionSeeds(
  a: readonly number[],
  b: readonly number[],
): readonly number[] {
  const ensembleB = new Set(b);
  return a.filter((s) => ensembleB.has(s)).sort((x, y) => x - y);
}

export function assertSeedsEvaluationV02SansCollision(): void {
  const diagEval = intersectionSeeds(
    SEEDS_DIAGNOSTIC_EXPRESSION_V02,
    SEEDS_EVALUATION_FIGEES_V02,
  );
  if (diagEval.length > 0) {
    throw new Error(
      `collision seeds diagnostic ∩ evaluation : ${diagEval.join(",")}`,
    );
  }
  const calibEval = intersectionSeeds(
    SEEDS_CALIBRATION_EVOLUTION_V02,
    SEEDS_EVALUATION_FIGEES_V02,
  );
  if (calibEval.length > 0) {
    throw new Error(
      `collision seeds calibration ∩ evaluation : ${calibEval.join(",")}`,
    );
  }
  const v01v02 = intersectionSeeds(
    SEEDS_EVALUATION_FIGEES_V01,
    SEEDS_EVALUATION_FIGEES_V02,
  );
  if (v01v02.length > 0) {
    throw new Error(
      `collision seeds evaluation v01 ∩ v02 : ${v01v02.join(",")}`,
    );
  }
}
