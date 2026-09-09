/**
 * Comparaison des paramètres scientifiques v0.2 (hors mode / seeds / id / métadonnées).
 */

import { serialiserJsonCanonique } from "./empreinte.js";
import type {
  ProtocoleExperienceEvolutionV02,
  ProtocoleExperienceEvolutionV02Json,
} from "./protocole-evolution-v02.js";

export type ParametresScientifiquesV02 = {
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly string[];
  readonly parametresEconomiques: Omit<
    ProtocoleExperienceEvolutionV02["parametresEconomiques"],
    "version"
  > & { readonly version?: undefined };
  readonly reproduction: ProtocoleExperienceEvolutionV02["reproduction"];
  readonly reproductionAutonome: ProtocoleExperienceEvolutionV02["reproductionAutonome"];
  readonly mutationBase: ProtocoleExperienceEvolutionV02["mutationBase"];
  readonly fournisseur: ProtocoleExperienceEvolutionV02["fournisseur"];
  readonly environnementDecision: ProtocoleExperienceEvolutionV02["environnementDecision"];
  readonly politiqueBudgetCognitif: ProtocoleExperienceEvolutionV02["politiqueBudgetCognitif"];
  readonly xway: {
    readonly active: boolean;
    readonly plafondComputeParCycleMicroUsdc: string;
    readonly modeles: ProtocoleExperienceEvolutionV02["xway"]["modeles"];
    readonly politiqueCognitive: ProtocoleExperienceEvolutionV02["xway"]["politiqueCognitive"];
    readonly fournisseur: ProtocoleExperienceEvolutionV02["xway"]["fournisseur"];
  };
  readonly exigerArbrePropre: boolean;
  readonly dateLancementFixe?: string;
};

type ProtocoleV02Comparable =
  | ProtocoleExperienceEvolutionV02
  | ProtocoleExperienceEvolutionV02Json;

function normaliserFournisseur(
  f: ProtocoleV02Comparable["fournisseur"],
): ProtocoleExperienceEvolutionV02["fournisseur"] {
  return {
    identifiant: "fournisseur-inference-simule",
    version: typeof f.version === "string" ? f.version : "0.1.0",
    selecteur: "simule",
  };
}

/**
 * Extrait les champs scientifiques à comparer calibration ↔ évaluation.
 * Exclus : mode, seeds, identifiantProtocole, repertoireResultatsRelatif,
 * version de parametresEconomiques (étiquette), commentaires.
 */
export function extraireParametresScientifiquesV02(
  protocole: ProtocoleV02Comparable,
): ParametresScientifiquesV02 {
  const eco = protocole.parametresEconomiques;
  const { version: _versionEco, ...ecoSansVersion } = eco;
  const mutationBase =
    "mutationBase" in protocole && protocole.mutationBase !== undefined
      ? protocole.mutationBase
      : {
          version: "parametres-mutation-v01" as const,
          active: true as const,
          tauxMutationParGeneBps: protocole.tauxMutationConditionDBps,
          versionCatalogueGenes: "genes-mutables-v01" as const,
        };
  const xwayBrut =
    "xway" in protocole && protocole.xway !== undefined
      ? protocole.xway
      : undefined;
  if (xwayBrut === undefined) {
    throw new Error(
      "extraireParametresScientifiquesV02 : xway requis pour comparaison",
    );
  }
  const environnementDecision =
    "environnementDecision" in protocole
      ? protocole.environnementDecision
      : undefined;
  const politiqueBudgetCognitif =
    "politiqueBudgetCognitif" in protocole
      ? protocole.politiqueBudgetCognitif
      : undefined;
  if (environnementDecision === undefined || politiqueBudgetCognitif === undefined) {
    throw new Error(
      "extraireParametresScientifiquesV02 : environnementDecision et politiqueBudgetCognitif requis",
    );
  }

  return {
    cyclesMaximum: protocole.cyclesMaximum,
    populationInitiale: protocole.populationInitiale,
    capitalInitialParAgentMicroUsdc: String(
      protocole.capitalInitialParAgentMicroUsdc,
    ),
    tauxMutationConditionDBps: protocole.tauxMutationConditionDBps,
    conditions: [...protocole.conditions],
    parametresEconomiques: ecoSansVersion as ParametresScientifiquesV02["parametresEconomiques"],
    reproduction: protocole.reproduction,
    reproductionAutonome: {
      ...protocole.reproductionAutonome,
      etatsSurvieEligibles: [
        ...protocole.reproductionAutonome.etatsSurvieEligibles,
      ],
    },
    mutationBase: {
      ...mutationBase,
      active: true,
      tauxMutationParGeneBps:
        mutationBase.tauxMutationParGeneBps ??
        protocole.tauxMutationConditionDBps,
    },
    fournisseur: normaliserFournisseur(protocole.fournisseur),
    environnementDecision,
    politiqueBudgetCognitif,
    xway: {
      active: xwayBrut.active === true,
      plafondComputeParCycleMicroUsdc: String(
        xwayBrut.plafondComputeParCycleMicroUsdc,
      ),
      modeles: xwayBrut.modeles ?? [],
      politiqueCognitive: {
        identifiant: "politique-budget-cognitif-agent",
        version:
          xwayBrut.politiqueCognitive?.version ??
          politiqueBudgetCognitif.version,
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: normaliserFournisseur(protocole.fournisseur).version,
      },
    },
    exigerArbrePropre: protocole.exigerArbrePropre === true,
    ...(protocole.dateLancementFixe !== undefined
      ? { dateLancementFixe: protocole.dateLancementFixe }
      : {}),
  };
}

export function protocolesPartagentParametresScientifiquesV02(
  a: ProtocoleV02Comparable,
  b: ProtocoleV02Comparable,
): boolean {
  const pa = extraireParametresScientifiquesV02(a);
  const pb = extraireParametresScientifiquesV02(b);
  return serialiserJsonCanonique(pa) === serialiserJsonCanonique(pb);
}
