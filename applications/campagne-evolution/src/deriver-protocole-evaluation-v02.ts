/**
 * Dérivation déterministe du protocole d'évaluation v0.2 depuis la calibration e1-01.
 * Ne copie pas manuellement les paramètres scientifiques — les hérite.
 */

import {
  chargerProtocoleEvolutionV02DepuisObjet,
  type ProtocoleExperienceEvolutionV02,
  type ProtocoleExperienceEvolutionV02Json,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
} from "./protocole-evolution-v02.js";
import {
  SEEDS_CALIBRATION_EVOLUTION_V02,
  SEEDS_EVALUATION_FIGEES_V02,
} from "./seeds-evolution-v02.js";

export const IDENTIFIANT_PROTOCOLE_EVALUATION_V02 =
  "evolution-evaluation-v02" as const;

export const CHEMIN_PROTOCOLE_CALIBRATION_E1_01 =
  "experiences/protocoles/evolution-calibration-v02-e1-01.json" as const;

export const CHEMIN_PROTOCOLE_EVALUATION_V02 =
  "experiences/protocoles/evolution-evaluation-v02.json" as const;

/**
 * Construit le JSON d'évaluation à partir du protocole calibré parsé.
 * Différences autorisées uniquement : mode, seeds, identifiant, commentaires,
 * version étiquette parametresEconomiques.
 */
export function deriverProtocoleEvaluationV02DepuisCalibration(
  calibration: ProtocoleExperienceEvolutionV02,
  options?: {
    readonly identifiantProtocole?: string;
    readonly seedsEvaluation?: readonly number[];
    readonly seedsCalibrationReference?: readonly number[];
  },
): ProtocoleExperienceEvolutionV02Json {
  if (calibration.mode !== "calibration") {
    throw new Error(
      "deriverProtocoleEvaluationV02DepuisCalibration exige un protocole mode=calibration",
    );
  }
  const seedsEvaluation = [
    ...(options?.seedsEvaluation ?? SEEDS_EVALUATION_FIGEES_V02),
  ];
  const seedsCalibration = [
    ...(options?.seedsCalibrationReference ??
      (calibration.seedsCalibration.length > 0
        ? calibration.seedsCalibration
        : SEEDS_CALIBRATION_EVOLUTION_V02)),
  ];
  const identifiant =
    options?.identifiantProtocole ?? IDENTIFIANT_PROTOCOLE_EVALUATION_V02;

  const ecoVersion =
    typeof calibration.parametresEconomiques.version === "string"
      ? calibration.parametresEconomiques.version.replace(
          /calibration/g,
          "evaluation",
        )
      : "demo-evolution-evaluation-v02";

  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: identifiant,
    mode: "evaluation",
    seedsCalibration,
    seedsEvaluation,
    cyclesMaximum: calibration.cyclesMaximum,
    populationInitiale: calibration.populationInitiale,
    capitalInitialParAgentMicroUsdc:
      calibration.capitalInitialParAgentMicroUsdc,
    tauxMutationConditionDBps: calibration.tauxMutationConditionDBps,
    conditions: [...calibration.conditions],
    ...(calibration.dateLancementFixe !== undefined
      ? { dateLancementFixe: calibration.dateLancementFixe }
      : {}),
    exigerArbrePropre: calibration.exigerArbrePropre,
    fournisseur: { ...calibration.fournisseur },
    repertoireResultatsRelatif: calibration.repertoireResultatsRelatif,
    parametresEconomiques: {
      ...calibration.parametresEconomiques,
      version: ecoVersion,
    },
    reproduction: { ...calibration.reproduction },
    reproductionAutonome: {
      ...calibration.reproductionAutonome,
      etatsSurvieEligibles: [
        ...calibration.reproductionAutonome.etatsSurvieEligibles,
      ],
    },
    mutationBase: { ...calibration.mutationBase },
    environnementDecision: { ...calibration.environnementDecision },
    politiqueBudgetCognitif: { ...calibration.politiqueBudgetCognitif },
    xway: {
      ...calibration.xway,
      modeles: calibration.xway.modeles.map((m) => ({ ...m })),
      politiqueCognitive: {
        identifiant: calibration.xway.politiqueCognitive.identifiant,
        version: calibration.xway.politiqueCognitive.version,
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule" as const,
        version: calibration.fournisseur.version,
      },
    },
    ...(calibration.identite !== undefined
      ? { identite: calibration.identite }
      : {}),
    ...(calibration.criteresArret !== undefined
      ? { criteresArret: calibration.criteresArret }
      : {}),
  };
}

export function deriverProtocoleEvaluationV02DepuisObjetCalibration(
  brut: unknown,
): ProtocoleExperienceEvolutionV02Json {
  return deriverProtocoleEvaluationV02DepuisCalibration(
    chargerProtocoleEvolutionV02DepuisObjet(brut),
  );
}
