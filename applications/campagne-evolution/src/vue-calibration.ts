/**
 * Vue de calibration — métriques autorisées uniquement.
 * Aucune comparaison D−C, VEN, regret, fréquences gènes, contribution propriétaire.
 */

import {
  SEUILS_CALIBRATION_V01,
  estSaturePopulationTot,
  type IdentifiantCritereCalibration,
} from "./criteres-calibration.js";
import type { ResumeRunEvolution } from "./resume-run.js";
import type { ResultatCampagneEvolution } from "./runner-campagne.js";
import { medianeNombres } from "./statistiques.js";
import type { EtapeCalibration } from "./parametres-calibration-autorises.js";

/** Critères exigés pour valider un candidat selon l'étape (hors CONTROLE_NEGATIF toujours bloquant). */
export const CRITERES_PAR_ETAPE: Readonly<
  Record<EtapeCalibration, readonly IdentifiantCritereCalibration[]>
> = {
  1: [
    "CONTROLE_NEGATIF",
    "FRACTION_RUNS_CONTRAINTS",
    "FRACTION_CYCLES_POPULATION_MAX",
    "FRACTION_CYCLES_PLAFOND_NAISSANCES",
    "EXTINCTION_IMMEDIATE",
    "SATURATION_PRECOCE",
  ],
  2: [
    "CONTROLE_NEGATIF",
    "FRACTION_RUNS_CONTRAINTS",
    "FRACTION_CYCLES_POPULATION_MAX",
    "FRACTION_CYCLES_PLAFOND_NAISSANCES",
    "GENERATION_MEDIANE_BCD",
    "EXTINCTION_IMMEDIATE",
    "EXTINCTION_STRUCTURELLE",
    "SATURATION_PRECOCE",
  ],
  3: [
    "CONTROLE_NEGATIF",
    "FRACTION_RUNS_CONTRAINTS",
    "FRACTION_CYCLES_POPULATION_MAX",
    "FRACTION_CYCLES_PLAFOND_NAISSANCES",
    "GENERATION_MEDIANE_BCD",
    "FRACTION_D_MUTATION",
    "EXTINCTION_IMMEDIATE",
    "EXTINCTION_STRUCTURELLE",
    "SATURATION_PRECOCE",
  ],
};

export type EntreeVueCalibration = {
  readonly resumes: readonly ResumeRunEvolution[];
  readonly controleNegatifOk: boolean;
  readonly dureeMsTotale: number;
  /** Par défaut 3 = validation complète. */
  readonly etape?: EtapeCalibration;
};

/**
 * Résumé batch pour décision de calibration — champs whitelistés.
 * Interdit d'y ajouter : différence D−C, VEN, regret D−C, fréquences gènes
 * comme critère de sélection, contribution propriétaire D−C.
 */
export type ResumeCalibrationBatch = {
  readonly controleNegatifOk: boolean;
  readonly fractionRunsContraintsParGardeFou: number;
  readonly fractionCyclesPopulationMaxAtteinte: number;
  readonly fractionCyclesPlafondNaissancesAtteint: number;
  readonly generationMaximaleMedianeBCD: number | null;
  readonly fractionRunsDAvecAuMoinsUneMutation: number | null;
  readonly fractionRunsEteints: number | null;
  readonly fractionExtinctionImmediate: number | null;
  readonly naissancesPresentes: boolean;
  readonly dureeMsTotale: number;
  readonly nombreRuns: number;
  readonly criteresSatisfaits: Readonly<Record<string, boolean>>;
  readonly candidatValide: boolean;
  readonly motifInvalidation?: string;
};

const MOTIFS_BANIS_DANS_VUE = [
  "D-C",
  "D−C",
  "differenceVen",
  "differenceVEN",
  "regretDC",
  "regretD-C",
  "contributionProprietaireDC",
  "frequenceGeneSelection",
] as const;

function meanRatio(
  resumes: readonly ResumeRunEvolution[],
  numerateur: (r: ResumeRunEvolution) => number,
): number {
  if (resumes.length === 0) {
    return 0;
  }
  let somme = 0;
  for (const r of resumes) {
    const denom = r.cyclesMaximum;
    somme += denom > 0 ? numerateur(r) / denom : 0;
  }
  return somme / resumes.length;
}

function runsBCD(
  resumes: readonly ResumeRunEvolution[],
): readonly ResumeRunEvolution[] {
  return resumes.filter(
    (r) => r.condition === "B" || r.condition === "C" || r.condition === "D",
  );
}

function evaluerCriteres(options: {
  readonly resumes: readonly ResumeRunEvolution[];
  readonly controleNegatifOk: boolean;
  readonly fractionRunsContraintsParGardeFou: number;
  readonly fractionCyclesPopulationMaxAtteinte: number;
  readonly fractionCyclesPlafondNaissancesAtteint: number;
  readonly generationMaximaleMedianeBCD: number | null;
  readonly fractionRunsDAvecAuMoinsUneMutation: number | null;
  readonly fractionRunsEteints: number | null;
  readonly fractionExtinctionImmediate: number | null;
  readonly etape: EtapeCalibration;
}): {
  readonly criteresSatisfaits: Record<IdentifiantCritereCalibration, boolean>;
  readonly candidatValide: boolean;
  readonly motifInvalidation?: string;
} {
  const s = SEUILS_CALIBRATION_V01;
  const controle = options.controleNegatifOk === true;
  const fractionRuns = options.fractionRunsContraintsParGardeFou < s.fractionRunsContraintsParGardeFouMax;
  const fractionPop =
    options.fractionCyclesPopulationMaxAtteinte <
    s.fractionCyclesPopulationMaxAtteinteMax;
  const fractionNaiss =
    options.fractionCyclesPlafondNaissancesAtteint <
    s.fractionCyclesPlafondNaissancesAtteintMax;
  const genOk =
    options.generationMaximaleMedianeBCD !== null &&
    options.generationMaximaleMedianeBCD >= s.generationMedianeBCDMin;
  const mutOk =
    options.fractionRunsDAvecAuMoinsUneMutation !== null &&
    options.fractionRunsDAvecAuMoinsUneMutation >
      s.fractionRunsDAvecMutationMin;
  const extinImmOk =
    options.fractionExtinctionImmediate !== null &&
    options.fractionExtinctionImmediate < s.fractionExtinctionImmediateMax;

  const gardeFousOk = fractionRuns && fractionPop && fractionNaiss;
  // H : soft — gens≥3 + garde-fous OK → passe même à 0 extinction (doc H).
  let extinctionStructurelleOk = false;
  if (genOk && gardeFousOk) {
    extinctionStructurelleOk = true;
  } else if (
    options.fractionRunsEteints !== null &&
    options.fractionRunsEteints > 0 &&
    options.fractionRunsEteints < 1
  ) {
    extinctionStructurelleOk = true;
  }

  const bcd = runsBCD(options.resumes);
  const fractionSaturesTot =
    bcd.length === 0
      ? 0
      : bcd.filter((r) =>
          estSaturePopulationTot({
            cyclesExecutes: r.cyclesExecutes,
            cyclesPopulationMaximaleAtteinte: r.cyclesPopulationMaximaleAtteinte,
          }),
        ).length / bcd.length;
  const saturationOk = fractionSaturesTot < s.fractionSaturationPrecoceMax;

  const criteresSatisfaits: Record<IdentifiantCritereCalibration, boolean> = {
    CONTROLE_NEGATIF: controle,
    FRACTION_RUNS_CONTRAINTS: fractionRuns,
    FRACTION_CYCLES_POPULATION_MAX: fractionPop,
    FRACTION_CYCLES_PLAFOND_NAISSANCES: fractionNaiss,
    GENERATION_MEDIANE_BCD: genOk,
    FRACTION_D_MUTATION: mutOk,
    EXTINCTION_IMMEDIATE: extinImmOk,
    EXTINCTION_STRUCTURELLE: extinctionStructurelleOk,
    SATURATION_PRECOCE: saturationOk,
  };

  if (!controle) {
    return {
      criteresSatisfaits,
      candidatValide: false,
      motifInvalidation: "CONTROLE_NEGATIF",
    };
  }

  const exiges = CRITERES_PAR_ETAPE[options.etape];
  const echecs = exiges.filter((id) => !criteresSatisfaits[id]);

  if (echecs.length > 0) {
    const premier = echecs[0]!;
    return {
      criteresSatisfaits,
      candidatValide: false,
      motifInvalidation: premier,
    };
  }

  return { criteresSatisfaits, candidatValide: true };
}

/**
 * Extrait la vue calibration depuis resumes + contrôle + durée.
 * N'accepte / n'expose que les champs autorisés.
 */
export function extraireVueCalibration(
  entree: EntreeVueCalibration,
): ResumeCalibrationBatch {
  const { resumes, controleNegatifOk, dureeMsTotale } = entree;
  const etape = entree.etape ?? 3;
  const nombreRuns = resumes.length;
  const fractionRunsContraintsParGardeFou =
    nombreRuns === 0
      ? 0
      : resumes.filter((r) => r.runContraintParGardeFou).length / nombreRuns;

  const fractionCyclesPopulationMaxAtteinte = meanRatio(
    resumes,
    (r) => r.cyclesPopulationMaximaleAtteinte,
  );
  const fractionCyclesPlafondNaissancesAtteint = meanRatio(
    resumes,
    (r) => r.cyclesPlafondNaissancesAtteint,
  );

  const bcd = runsBCD(resumes);
  const generationMaximaleMedianeBCD = medianeNombres(
    bcd.map((r) => r.generationMaximale),
  );

  const runsD = resumes.filter((r) => r.condition === "D");
  const fractionRunsDAvecAuMoinsUneMutation =
    runsD.length === 0
      ? null
      : runsD.filter((r) => r.mutationsCumulees > 0).length / runsD.length;

  const fractionRunsEteints =
    bcd.length === 0
      ? null
      : bcd.filter((r) => r.eteinte).length / bcd.length;

  const fractionExtinctionImmediate =
    bcd.length === 0
      ? null
      : bcd.filter(
          (r) =>
            r.cycleExtinction !== null &&
            r.cycleExtinction <=
              SEUILS_CALIBRATION_V01.cycleExtinctionImmediateMax,
        ).length / bcd.length;

  const naissancesPresentes = bcd.some((r) => r.naissancesCumulees > 0);

  const evalue = evaluerCriteres({
    resumes,
    controleNegatifOk,
    fractionRunsContraintsParGardeFou,
    fractionCyclesPopulationMaxAtteinte,
    fractionCyclesPlafondNaissancesAtteint,
    generationMaximaleMedianeBCD,
    fractionRunsDAvecAuMoinsUneMutation,
    fractionRunsEteints,
    fractionExtinctionImmediate,
    etape,
  });

  const vue: ResumeCalibrationBatch = {
    controleNegatifOk,
    fractionRunsContraintsParGardeFou,
    fractionCyclesPopulationMaxAtteinte,
    fractionCyclesPlafondNaissancesAtteint,
    generationMaximaleMedianeBCD,
    fractionRunsDAvecAuMoinsUneMutation,
    fractionRunsEteints,
    fractionExtinctionImmediate,
    naissancesPresentes,
    dureeMsTotale,
    nombreRuns,
    criteresSatisfaits: evalue.criteresSatisfaits,
    candidatValide: evalue.candidatValide,
    ...(evalue.motifInvalidation !== undefined
      ? { motifInvalidation: evalue.motifInvalidation }
      : {}),
  };

  assertVueCalibrationSansDC(vue);
  return vue;
}

/**
 * Variante depuis un résultat de campagne + métadonnées contrôle / durée
 * (le runner ne renvoie pas encore controleNegatifOk dans ResultatCampagneEvolution).
 */
export function extraireVueCalibrationDepuisCampagne(
  resultat: ResultatCampagneEvolution,
  options: {
    readonly controleNegatifOk: boolean;
    readonly dureeMsTotale: number;
  },
): ResumeCalibrationBatch {
  return extraireVueCalibration({
    resumes: resultat.resumes,
    controleNegatifOk: options.controleNegatifOk,
    dureeMsTotale: options.dureeMsTotale,
  });
}

/**
 * Garde-fou tests : la sérialisation ne doit contenir aucune métrique D−C interdite.
 */
export function assertVueCalibrationSansDC(vue: ResumeCalibrationBatch): void {
  const texte = JSON.stringify(vue);
  for (const motif of MOTIFS_BANIS_DANS_VUE) {
    if (texte.includes(motif)) {
      throw new Error(
        `vue calibration contient motif interdit « ${motif} » — métriques D−C refusées`,
      );
    }
  }
  const clesAutorisees = new Set([
    "controleNegatifOk",
    "fractionRunsContraintsParGardeFou",
    "fractionCyclesPopulationMaxAtteinte",
    "fractionCyclesPlafondNaissancesAtteint",
    "generationMaximaleMedianeBCD",
    "fractionRunsDAvecAuMoinsUneMutation",
    "fractionRunsEteints",
    "fractionExtinctionImmediate",
    "naissancesPresentes",
    "dureeMsTotale",
    "nombreRuns",
    "criteresSatisfaits",
    "candidatValide",
    "motifInvalidation",
  ]);
  for (const cle of Object.keys(vue)) {
    if (!clesAutorisees.has(cle)) {
      throw new Error(`vue calibration : clé non autorisée « ${cle} »`);
    }
  }
}
