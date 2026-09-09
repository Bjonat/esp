/**
 * Matrice A/B/C/D → ConfigurationExperienceJson pour campagne évolution v0.2.
 * Force mode decision_simulee et refuse toute retombée silencieuse sur simulation.
 */

import type { ConfigurationExperienceJson } from "@esp/controleur";
import {
  DATE_EVENEMENTS_FIXES_EVOLUTION,
  identifiantRun,
} from "./conditions.js";
import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";
import type { ConditionEvolution } from "./protocole-evolution.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  XWAY_SIMULE_DEFAUT_V02,
  type ProtocoleExperienceEvolutionV02,
} from "./protocole-evolution-v02.js";

export { DATE_EVENEMENTS_FIXES_EVOLUTION, identifiantRun };

/**
 * Intentionnellement sans condition : même espace d'identifiants pour B/C
 * (contrôle négatif causalement valide), comme en v0.1.
 */
export function identifiantExperienceRunV02(
  protocole: ProtocoleExperienceEvolutionV02,
  _condition: ConditionEvolution,
  seed: number,
): string {
  return `${protocole.identifiantProtocole}-seed-${seed}`;
}

function refuserFournisseurReseau(
  xway: ConfigurationExperienceJson["xway"],
): void {
  if (xway === undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      "xway obligatoire pour fabriquer une configuration v0.2",
    );
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
      obj.identifiant === "fournisseur-inference-openai" ||
      (obj.identifiant !== undefined &&
        obj.identifiant !== "fournisseur-inference-simule")
    ) {
      throw new ProtocoleEvolutionInvalideErreur(
        "fournisseur réseau interdit — fournisseur-inference-simule uniquement",
      );
    }
  }
}

/**
 * Construit la configuration d'expérience pour une cellule (condition × seed) v0.2.
 *
 * Toujours :
 * - mode: decision_simulee
 * - environnementDecision injecté
 * - politiqueBudgetCognitif injectée (génotype genesis)
 * - xway fournisseur-inference-simule
 *
 * Matrice A/B/C/D inchangée par rapport à v0.1.
 */
export function fabriquerConfigurationRunV02(
  protocole: ProtocoleExperienceEvolutionV02,
  condition: ConditionEvolution,
  seed: number,
): ConfigurationExperienceJson {
  if (protocole.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02) {
    throw new ProtocoleEvolutionInvalideErreur(
      `fabriquerConfigurationRunV02 exige ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02}`,
    );
  }

  if (protocole.environnementDecision === undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision absent — impossible de construire decision_simulee",
    );
  }
  if (protocole.politiqueBudgetCognitif === undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      "politiqueBudgetCognitif absente — chaîne génotype→phénotype impossible",
    );
  }

  const autonomeActive = condition !== "A";
  const mutationActive = condition === "C" || condition === "D";
  const tauxMutation =
    condition === "D" ? protocole.tauxMutationConditionDBps : 0;

  const xway = protocole.xway ?? XWAY_SIMULE_DEFAUT_V02;
  refuserFournisseurReseau(xway);

  const conf: ConfigurationExperienceJson = {
    identifiantExperience: identifiantExperienceRunV02(
      protocole,
      condition,
      seed,
    ),
    versionProtocole: "0.2.0",
    mode: "decision_simulee",
    graineSimulation: seed,
    taillePopulationInitiale: protocole.populationInitiale,
    capitalInitialParAgentMicroUsdc: protocole.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: protocole.parametresEconomiques,
    environnementDecision: protocole.environnementDecision,
    politiqueBudgetCognitif: protocole.politiqueBudgetCognitif,
    reproduction: {
      ...protocole.reproduction,
      active: true,
    },
    reproductionAutonome: {
      ...protocole.reproductionAutonome,
      etatsSurvieEligibles: [
        ...protocole.reproductionAutonome.etatsSurvieEligibles,
      ],
      active: autonomeActive,
    },
    criteresArret: protocole.criteresArret ?? {
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
    xway: {
      ...xway,
      politiqueCognitive: {
        identifiant: "politique-budget-cognitif-agent",
        version:
          xway.politiqueCognitive?.version ??
          protocole.politiqueBudgetCognitif.version,
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: protocole.fournisseur.version,
      },
    },
    ...(protocole.identite !== undefined ? { identite: protocole.identite } : {}),
  };

  if (conf.mode !== "decision_simulee") {
    throw new ProtocoleEvolutionInvalideErreur(
      "invariant violé : configuration v0.2 doit être en mode decision_simulee",
    );
  }
  if (conf.environnementDecision === undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      "invariant violé : environnementDecision manquant après fabrication v0.2",
    );
  }

  return conf;
}

export function listerRunsPlanifiesV02(
  protocole: ProtocoleExperienceEvolutionV02,
): readonly {
  condition: ConditionEvolution;
  seed: number;
  identifiantRun: string;
}[] {
  const runs: {
    condition: ConditionEvolution;
    seed: number;
    identifiantRun: string;
  }[] = [];
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
