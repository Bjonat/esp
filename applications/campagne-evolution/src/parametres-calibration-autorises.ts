/**
 * Whitelist des paramètres modifiables en calibration (étapes 1→3).
 * Refuse seedsEvaluation comme seeds actives en mode calibration.
 */

import {
  ProtocoleEvolutionInvalideErreur,
  chargerProtocoleEvolutionDepuisObjet,
  parserProtocoleEvolution,
  type ProtocoleExperienceEvolutionV01,
  type ProtocoleExperienceEvolutionV01Json,
} from "./protocole-evolution.js";

export type EtapeCalibration = 1 | 2 | 3;

export type CleCalibrationAutorisee =
  | "cyclesMaximum"
  | "populationMaximale"
  | "nombreMaxNaissancesParCycle"
  | "dotationEnfantMicroUsdc"
  | "coutReproductionMicroUsdc"
  | "reserveMinimaleParentMicroUsdc"
  | "tauxMutationConditionDBps";

export type SurchargeCalibration = Partial<
  Record<CleCalibrationAutorisee, number | string>
>;

const CLES_ETAPE_1: readonly CleCalibrationAutorisee[] = [
  "cyclesMaximum",
  "populationMaximale",
  "nombreMaxNaissancesParCycle",
];

const CLES_ETAPE_2: readonly CleCalibrationAutorisee[] = [
  ...CLES_ETAPE_1,
  "dotationEnfantMicroUsdc",
  "coutReproductionMicroUsdc",
  "reserveMinimaleParentMicroUsdc",
];

const CLES_ETAPE_3: readonly CleCalibrationAutorisee[] = [
  ...CLES_ETAPE_2,
  "tauxMutationConditionDBps",
];

export function clesAutoriseesPourEtape(
  etape: EtapeCalibration,
): readonly CleCalibrationAutorisee[] {
  if (etape === 1) {
    return CLES_ETAPE_1;
  }
  if (etape === 2) {
    return CLES_ETAPE_2;
  }
  return CLES_ETAPE_3;
}

export class CalibrationParametreRefuseErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalibrationParametreRefuseErreur";
  }
}

function assertEtape(etape: number): asserts etape is EtapeCalibration {
  if (etape !== 1 && etape !== 2 && etape !== 3) {
    throw new CalibrationParametreRefuseErreur(
      `étape calibration invalide : ${String(etape)} (attendu 1|2|3)`,
    );
  }
}

/**
 * Applique une surcharge whitelistée sur un protocole JSON de base.
 * Rejette toute clé hors étape.
 */
export function appliquerSurchargeCalibration(
  baseJson: ProtocoleExperienceEvolutionV01Json,
  surcharge: SurchargeCalibration,
  etape: EtapeCalibration,
): ProtocoleExperienceEvolutionV01Json {
  assertEtape(etape);
  const autorisees = new Set(clesAutoriseesPourEtape(etape));
  for (const cle of Object.keys(surcharge) as CleCalibrationAutorisee[]) {
    if (!autorisees.has(cle)) {
      throw new CalibrationParametreRefuseErreur(
        `paramètre « ${cle} » non autorisé à l'étape ${String(etape)} de calibration`,
      );
    }
  }

  const reproduction = { ...baseJson.reproduction };
  const reproductionAutonome = { ...baseJson.reproductionAutonome };
  let cyclesMaximum = baseJson.cyclesMaximum;
  let tauxMutationConditionDBps = baseJson.tauxMutationConditionDBps;

  if (surcharge.cyclesMaximum !== undefined) {
    if (
      typeof surcharge.cyclesMaximum !== "number" ||
      !Number.isInteger(surcharge.cyclesMaximum)
    ) {
      throw new CalibrationParametreRefuseErreur(
        "cyclesMaximum doit être un entier",
      );
    }
    cyclesMaximum = surcharge.cyclesMaximum;
  }
  if (surcharge.populationMaximale !== undefined) {
    if (
      typeof surcharge.populationMaximale !== "number" ||
      !Number.isInteger(surcharge.populationMaximale)
    ) {
      throw new CalibrationParametreRefuseErreur(
        "populationMaximale doit être un entier",
      );
    }
    reproduction.populationMaximale = surcharge.populationMaximale;
  }
  if (surcharge.nombreMaxNaissancesParCycle !== undefined) {
    if (
      typeof surcharge.nombreMaxNaissancesParCycle !== "number" ||
      !Number.isInteger(surcharge.nombreMaxNaissancesParCycle)
    ) {
      throw new CalibrationParametreRefuseErreur(
        "nombreMaxNaissancesParCycle doit être un entier",
      );
    }
    reproductionAutonome.nombreMaxNaissancesParCycle =
      surcharge.nombreMaxNaissancesParCycle;
  }
  if (surcharge.dotationEnfantMicroUsdc !== undefined) {
    reproduction.dotationEnfantMicroUsdc = String(
      surcharge.dotationEnfantMicroUsdc,
    );
  }
  if (surcharge.coutReproductionMicroUsdc !== undefined) {
    reproduction.coutReproductionMicroUsdc = String(
      surcharge.coutReproductionMicroUsdc,
    );
  }
  if (surcharge.reserveMinimaleParentMicroUsdc !== undefined) {
    reproduction.reserveMinimaleParentMicroUsdc = String(
      surcharge.reserveMinimaleParentMicroUsdc,
    );
  }
  if (surcharge.tauxMutationConditionDBps !== undefined) {
    if (
      typeof surcharge.tauxMutationConditionDBps !== "number" ||
      !Number.isInteger(surcharge.tauxMutationConditionDBps)
    ) {
      throw new CalibrationParametreRefuseErreur(
        "tauxMutationConditionDBps doit être un entier",
      );
    }
    tauxMutationConditionDBps = surcharge.tauxMutationConditionDBps;
  }

  return {
    ...baseJson,
    cyclesMaximum,
    tauxMutationConditionDBps,
    reproduction,
    reproductionAutonome,
  };
}

/**
 * Refuse l'usage de seedsEvaluation comme seeds actives en calibration.
 */
export function refuserSeedsEvaluationEnCalibration(
  protocole:
    | ProtocoleExperienceEvolutionV01
    | ProtocoleExperienceEvolutionV01Json
    | {
        readonly mode?: string;
        readonly seedsActives?: readonly number[];
        readonly seedsCalibration?: readonly number[];
        readonly seedsEvaluation?: readonly number[];
      },
): void {
  if (protocole.mode !== "calibration") {
    return;
  }
  const seedsEval = protocole.seedsEvaluation ?? [];
  if (seedsEval.length === 0) {
    return;
  }
  if ("seedsActives" in protocole && Array.isArray(protocole.seedsActives)) {
    const actives = protocole.seedsActives;
    const ensembleEval = new Set(seedsEval);
    const utiliseEval = actives.some((s) => ensembleEval.has(s));
    const calibration = protocole.seedsCalibration ?? [];
    const memeQueEval =
      actives.length === seedsEval.length &&
      actives.every((s, i) => s === seedsEval[i]);
    if (utiliseEval && (memeQueEval || calibration.length === 0)) {
      throw new CalibrationParametreRefuseErreur(
        "seedsEvaluation interdites comme seeds actives en mode calibration",
      );
    }
  }
}

/**
 * Construit un protocole candidat calibration :
 * mode forcé = calibration ; seeds actives = seedsCalibration uniquement.
 */
export function construireProtocoleCandidatCalibration(
  baseJson: ProtocoleExperienceEvolutionV01Json,
  surcharge: SurchargeCalibration,
  etape: EtapeCalibration,
): ProtocoleExperienceEvolutionV01 {
  const surchargé = appliquerSurchargeCalibration(baseJson, surcharge, etape);
  const seedsCalibration = [...(surchargé.seedsCalibration ?? [])];
  const force: ProtocoleExperienceEvolutionV01Json = {
    ...surchargé,
    mode: "calibration",
    seedsCalibration,
    // Conservées pour empreinte / séparation, jamais actives en calibration.
    seedsEvaluation: [...(surchargé.seedsEvaluation ?? [])],
  };
  if (seedsCalibration.length === 0) {
    throw new CalibrationParametreRefuseErreur(
      "protocole calibration exige seedsCalibration non vide",
    );
  }
  const parse = parserProtocoleEvolution(force);
  refuserSeedsEvaluationEnCalibration(parse);
  if (parse.seedsActives.join(",") !== parse.seedsCalibration.join(",")) {
    throw new CalibrationParametreRefuseErreur(
      "seeds actives doivent être seedsCalibration en mode calibration",
    );
  }
  return parse;
}

/**
 * Variante qui charge depuis objet inconnu puis force calibration.
 */
export function chargerProtocoleCalibrationDepuisObjet(
  brut: unknown,
): ProtocoleExperienceEvolutionV01 {
  const protocole = chargerProtocoleEvolutionDepuisObjet(brut);
  if (protocole.mode !== "calibration") {
    throw new ProtocoleEvolutionInvalideErreur(
      "outil de calibration exige mode=calibration",
    );
  }
  refuserSeedsEvaluationEnCalibration(protocole);
  return protocole;
}
