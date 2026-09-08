/**
 * Matrice expérimentale A/B/C/D → ConfigurationExperienceJson.
 */

import type { ConfigurationExperienceJson } from "@esp/controleur";
import type {
  ConditionEvolution,
  ProtocoleExperienceEvolutionV01,
} from "./protocole-evolution.js";
import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";

export const DATE_EVENEMENTS_FIXES_EVOLUTION =
  "2020-01-01T00:00:00.000Z" as const;

export function identifiantRun(
  condition: ConditionEvolution,
  seed: number,
): string {
  return `${condition}-seed-${seed}`;
}

export function identifiantExperienceRun(
  protocole: ProtocoleExperienceEvolutionV01,
  _condition: ConditionEvolution,
  seed: number,
): string {
  /**
   * Intentionnellement sans condition : le simulateur de développement
   * hashe `identifiantAgent` (préfixé par identifiantExperience).
   * Les seeds appariées B/C doivent partager le même espace d'identifiants
   * pour que le contrôle négatif (taux=0 vs inactive) soit causalement valide.
   * Isolation physique : chaque run a son propre SQLite / répertoire.
   */
  return `${protocole.identifiantProtocole}-seed-${seed}`;
}

const XWAY_SIMULE_DEFAUT: NonNullable<ConfigurationExperienceJson["xway"]> = {
  active: true,
  plafondComputeParCycleMicroUsdc: "50000",
  modeles: [
    {
      identifiant: "modele_economique",
      libelle: "Modèle économique (campagne)",
      coutParMillionJetonsEntreeMicroUsdc: "500000",
      coutParMillionJetonsSortieMicroUsdc: "1500000",
      nombreMaxJetonsSortie: 256,
    },
    {
      identifiant: "modele_standard",
      libelle: "Modèle standard (campagne)",
      coutParMillionJetonsEntreeMicroUsdc: "2000000",
      coutParMillionJetonsSortieMicroUsdc: "6000000",
      nombreMaxJetonsSortie: 512,
    },
    {
      identifiant: "modele_premium",
      libelle: "Modèle premium (campagne)",
      coutParMillionJetonsEntreeMicroUsdc: "20000000",
      coutParMillionJetonsSortieMicroUsdc: "60000000",
      nombreMaxJetonsSortie: 1024,
    },
  ],
  politiqueCognitive: {
    identifiant: "politique-budget-cognitif-agent",
    version: "0.1.0",
  },
  fournisseur: {
    identifiant: "fournisseur-inference-simule",
    version: "0.1.0",
  },
};

const POLITIQUE_BUDGET_DEFAUT: NonNullable<
  ConfigurationExperienceJson["politiqueBudgetCognitif"]
> = {
  identifiant: "politique-budget-cognitif-agent",
  version: "0.1.0",
  seuilEnjeuPourInferenceMicroUsdc: "100000",
  partMaxVenParCycleBps: 50,
  plafondCognitifMicroUsdc: "10000",
  modeleLogique: "modele_standard",
  comportementSansInference: "agir_si_favorable",
  refuserSiCritiqueOuDormant: true,
};

function refuserFournisseurOpenai(
  xway: ConfigurationExperienceJson["xway"],
): void {
  if (xway === undefined) {
    return;
  }
  const f = xway.fournisseur;
  if (f === "openai") {
    throw new ProtocoleEvolutionInvalideErreur(
      "selecteur openai interdit — fournisseur-inference-simule uniquement",
    );
  }
  if (typeof f === "object" && f !== null) {
    const obj = f as { selecteur?: string; identifiant?: string };
    if (
      obj.selecteur === "openai" ||
      obj.identifiant === "fournisseur-inference-openai"
    ) {
      throw new ProtocoleEvolutionInvalideErreur(
        "selecteur openai interdit — fournisseur-inference-simule uniquement",
      );
    }
  }
}

/**
 * Construit la configuration d'expérience pour une cellule (condition × seed).
 *
 * - A : autonome false, mutation inactive
 * - B : autonome true, mutation inactive
 * - C : autonome true, mutation active, taux=0 (sham)
 * - D : autonome true, mutation active, taux expérimental
 */
export function fabriquerConfigurationRun(
  protocole: ProtocoleExperienceEvolutionV01,
  condition: ConditionEvolution,
  seed: number,
): ConfigurationExperienceJson {
  const autonomeActive = condition !== "A";
  const mutationActive = condition === "C" || condition === "D";
  const tauxMutation =
    condition === "D" ? protocole.tauxMutationConditionDBps : 0;

  const xway = protocole.xway ?? XWAY_SIMULE_DEFAUT;
  refuserFournisseurOpenai(xway);

  const conf: ConfigurationExperienceJson = {
    identifiantExperience: identifiantExperienceRun(protocole, condition, seed),
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: seed,
    taillePopulationInitiale: protocole.populationInitiale,
    capitalInitialParAgentMicroUsdc: protocole.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: protocole.parametresEconomiques,
    reproduction: {
      ...protocole.reproduction,
      active: true,
    },
    reproductionAutonome: {
      ...protocole.reproductionAutonome,
      etatsSurvieEligibles: [...protocole.reproductionAutonome.etatsSurvieEligibles],
      active: autonomeActive,
    },
    criteresArret: {
      version: "criteres-arret-experience-v01",
      cycleMaximum: protocole.cyclesMaximum,
    },
    mutation: {
      version: protocole.mutationBase.version,
      active: mutationActive,
      tauxMutationParGeneBps: tauxMutation,
      versionCatalogueGenes: protocole.mutationBase.versionCatalogueGenes,
      ...(protocole.mutationBase.genes !== undefined
        ? { genes: protocole.mutationBase.genes }
        : {}),
    },
    politiqueBudgetCognitif:
      protocole.politiqueBudgetCognitif ?? POLITIQUE_BUDGET_DEFAUT,
    xway: {
      ...xway,
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: protocole.fournisseur.version,
      },
    },
    ...(protocole.identite !== undefined ? { identite: protocole.identite } : {}),
  };

  return conf;
}

export function listerRunsPlanifies(
  protocole: ProtocoleExperienceEvolutionV01,
): readonly { condition: ConditionEvolution; seed: number; identifiantRun: string }[] {
  const runs: { condition: ConditionEvolution; seed: number; identifiantRun: string }[] =
    [];
  for (const seed of protocole.seedsActives) {
    for (const condition of protocole.conditions) {
      runs.push({
        condition,
        seed,
        identifiantRun: identifiantRun(condition, seed),
      });
    }
  }
  return runs;
}
