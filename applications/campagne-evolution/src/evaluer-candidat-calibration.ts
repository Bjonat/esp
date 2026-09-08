/**
 * Évalue un candidat de calibration → vue + suggestion de décision.
 */

import type { ResumeRunEvolution } from "./resume-run.js";
import type { ResultatCampagneEvolution } from "./runner-campagne.js";
import {
  extraireVueCalibration,
  type ResumeCalibrationBatch,
} from "./vue-calibration.js";
import type { DecisionCalibration } from "./journal-calibration.js";
import type { EtapeCalibration } from "./parametres-calibration-autorises.js";

export type EntreeEvaluationCandidatCalibration = {
  readonly resumes: readonly ResumeRunEvolution[];
  readonly controleNegatifOk: boolean;
  readonly dureeMsTotale: number;
  readonly etape?: EtapeCalibration;
};

export type ResultatEvaluationCandidatCalibration = {
  readonly vue: ResumeCalibrationBatch;
  readonly decision: DecisionCalibration;
  readonly motif?: string;
};

/**
 * Si contrôle négatif échoue → INVALIDE immédiatement (rejete / CONTROLE_NEGATIF).
 * Si critères de l'étape passent → candidat_suivant (étapes 1–2) ou retenu (étape 3).
 * Sinon → rejete.
 */
export function evaluerCandidatCalibration(
  entree: EntreeEvaluationCandidatCalibration,
): ResultatEvaluationCandidatCalibration {
  const etape = entree.etape ?? 3;
  if (!entree.controleNegatifOk) {
    const vue = extraireVueCalibration({
      ...entree,
      controleNegatifOk: false,
      etape,
    });
    return {
      vue: {
        ...vue,
        candidatValide: false,
        motifInvalidation: "CONTROLE_NEGATIF",
      },
      decision: "rejete",
      motif: "CONTROLE_NEGATIF",
    };
  }

  const vue = extraireVueCalibration({ ...entree, etape });
  if (vue.candidatValide) {
    return {
      vue,
      decision: etape === 3 ? "retenu" : "candidat_suivant",
    };
  }
  return {
    vue,
    decision: "rejete",
    ...(vue.motifInvalidation !== undefined
      ? { motif: vue.motifInvalidation }
      : {}),
  };
}

export function evaluerCandidatDepuisCampagne(
  resultat: ResultatCampagneEvolution,
  options: {
    readonly controleNegatifOk: boolean;
    readonly dureeMsTotale: number;
    readonly etape?: EtapeCalibration;
  },
): ResultatEvaluationCandidatCalibration {
  return evaluerCandidatCalibration({
    resumes: resultat.resumes,
    controleNegatifOk: options.controleNegatifOk,
    dureeMsTotale: options.dureeMsTotale,
    ...(options.etape !== undefined ? { etape: options.etape } : {}),
  });
}
