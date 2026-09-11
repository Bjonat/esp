/**
 * Seeds diagnostiques d'exposition v0.3 (v03-E).
 *
 * Consommées exclusivement par le diagnostic — interdites ensuite en
 * calibration / évaluation officielle.
 *
 * Plage conception : 401–410 (PLAGES_SEEDS_CANDIDATES_V03.diagnostic).
 * Intersection vide avec v0.1/v0.2 et avec calibration/évaluation v0.3.
 */

import { SEEDS_EVALUATION_FIGEES_V01 } from "./freeze-evaluation.js";
import {
  SEEDS_CALIBRATION_EVOLUTION_V02,
  SEEDS_DIAGNOSTIC_EXPRESSION_V02,
  SEEDS_EVALUATION_FIGEES_V02,
  intersectionSeeds,
} from "./seeds-evolution-v02.js";
import { PLAGES_SEEDS_CANDIDATES_V03 } from "./seeds-evolution-v03.js";

/** Seeds diagnostiques v03-E — figées pour cette étape. */
export const SEEDS_DIAGNOSTIC_EXPOSITION_V03: readonly number[] = [
  401, 402, 403, 404, 405,
] as const;

export function assertSeedsDiagnosticExpositionV03Libres(
  seeds: readonly number[] = SEEDS_DIAGNOSTIC_EXPOSITION_V03,
): void {
  const plage = PLAGES_SEEDS_CANDIDATES_V03.diagnostic;
  for (const s of seeds) {
    if (!Number.isInteger(s) || s < plage.debut || s > plage.fin) {
      throw new Error(
        `seed diagnostic v03 hors plage ${String(plage.debut)}–${String(plage.fin)} : ${String(s)}`,
      );
    }
  }

  const reserves: readonly (readonly [string, readonly number[]])[] = [
    ["evaluation-v01", SEEDS_EVALUATION_FIGEES_V01],
    ["diagnostic-v02", SEEDS_DIAGNOSTIC_EXPRESSION_V02],
    ["calibration-v02", SEEDS_CALIBRATION_EVOLUTION_V02],
    ["evaluation-v02", SEEDS_EVALUATION_FIGEES_V02],
  ];

  for (const [nom, liste] of reserves) {
    const collision = intersectionSeeds(seeds, liste);
    if (collision.length > 0) {
      throw new Error(
        `collision seeds diagnostic v03 ∩ ${nom} : ${collision.join(",")}`,
      );
    }
  }

  // Ne pas chevaucher les plages calibration / évaluation v0.3 candidates.
  const cal = PLAGES_SEEDS_CANDIDATES_V03.calibration;
  const eval_ = PLAGES_SEEDS_CANDIDATES_V03.evaluation;
  for (const s of seeds) {
    if (s >= cal.debut && s <= cal.fin) {
      throw new Error(
        `seed diagnostic v03 en collision avec plage calibration : ${String(s)}`,
      );
    }
    if (s >= eval_.debut && s <= eval_.fin) {
      throw new Error(
        `seed diagnostic v03 en collision avec plage evaluation : ${String(s)}`,
      );
    }
  }
}

/**
 * Refuse qu'une liste calibration/évaluation réutilise les seeds diagnostiques.
 */
export function assertPasDeReutilisationSeedsDiagnosticV03(options: {
  readonly seedsCalibration?: readonly number[];
  readonly seedsEvaluation?: readonly number[];
}): void {
  if (options.seedsCalibration !== undefined) {
    const c = intersectionSeeds(
      options.seedsCalibration,
      SEEDS_DIAGNOSTIC_EXPOSITION_V03,
    );
    if (c.length > 0) {
      throw new Error(
        `calibration refuse seeds diagnostic v03 : ${c.join(",")}`,
      );
    }
  }
  if (options.seedsEvaluation !== undefined) {
    const c = intersectionSeeds(
      options.seedsEvaluation,
      SEEDS_DIAGNOSTIC_EXPOSITION_V03,
    );
    if (c.length > 0) {
      throw new Error(
        `évaluation refuse seeds diagnostic v03 : ${c.join(",")}`,
      );
    }
  }
}
