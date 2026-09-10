/**
 * Matrice A/B/C/D → ConfigurationExperienceJson pour campagne évolution v0.3.
 *
 * Construction centralisée depuis un socle commun.
 * Différences autorisées testables structurellement.
 *
 * Toujours :
 * - mode: decision_simulee
 * - mécanisme B/C/D: reproduction-economique-v03
 * - fournisseur simulé
 * - même graine / environnement exogène pour une seed donnée
 */

import { MECANISME_REPRODUCTION_ECONOMIQUE_V03 } from "@esp/protocole";
import type { ConfigurationExperienceJson } from "@esp/controleur";
import {
  DATE_EVENEMENTS_FIXES_EVOLUTION,
  identifiantRun,
} from "./conditions.js";
import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";
import type { ConditionEvolution } from "./protocole-evolution.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
  XWAY_SIMULE_DEFAUT_V03,
  type ProtocoleExperienceEvolutionV03,
} from "./protocole-evolution-v03.js";
import { serialiserJsonCanonique } from "./empreinte.js";

export { DATE_EVENEMENTS_FIXES_EVOLUTION, identifiantRun };

export type DifferenceStructurelleAutoriseeV03 =
  | "reproduction_autonome_active"
  | "mutation_sham_declarative"
  | "taux_mutation";

/**
 * Intentionnellement sans condition : même espace d'identifiants pour B/C
 * (contrôle négatif causalement valide).
 */
export function identifiantExperienceRunV03(
  protocole: ProtocoleExperienceEvolutionV03,
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
      "xway obligatoire pour fabriquer une configuration v0.3",
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

type GenesMutationV03 = NonNullable<
  NonNullable<ConfigurationExperienceJson["mutation"]>["genes"]
>;

/**
 * Socle commun A/B/C/D — hors champs de traitement expérimental.
 */
export function construireSocleCommunConfigurationV03(
  protocole: ProtocoleExperienceEvolutionV03,
  seed: number,
): Omit<
  ConfigurationExperienceJson,
  "reproductionAutonome" | "mutation"
> & {
  readonly reproductionAutonomeBase: {
    readonly version: string;
    readonly etatsSurvieEligibles: readonly string[];
    readonly nombreMaxNaissancesParCycle: number;
    readonly mecanisme: typeof MECANISME_REPRODUCTION_ECONOMIQUE_V03;
  };
  readonly mutationBase: {
    readonly version: string;
    readonly versionCatalogueGenes: string;
    readonly genes?: GenesMutationV03;
  };
} {
  if (protocole.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03) {
    throw new ProtocoleEvolutionInvalideErreur(
      `socle v0.3 exige ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03}`,
    );
  }

  const xway = protocole.xway ?? XWAY_SIMULE_DEFAUT_V03;
  refuserFournisseurReseau(xway);

  return {
    identifiantExperience: identifiantExperienceRunV03(protocole, "A", seed),
    versionProtocole: "0.3.0",
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
    criteresArret: protocole.criteresArret ?? {
      version: "criteres-arret-experience-v01",
      cycleMaximum: protocole.cyclesMaximum,
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
    reproductionAutonomeBase: {
      version: protocole.reproductionAutonome.version,
      etatsSurvieEligibles: [
        ...protocole.reproductionAutonome.etatsSurvieEligibles,
      ],
      nombreMaxNaissancesParCycle:
        protocole.reproductionAutonome.nombreMaxNaissancesParCycle,
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    },
    mutationBase: {
      version: protocole.mutationBase.version,
      versionCatalogueGenes: protocole.mutationBase.versionCatalogueGenes,
      ...(protocole.mutationBase.genes !== undefined
        ? { genes: protocole.mutationBase.genes }
        : {}),
    },
  };
}

/**
 * Construit la configuration d'expérience pour une cellule (condition × seed) v0.3.
 *
 * A : autonome false, mutation inactive
 * B : autonome true (reproduction-economique-v03), mutation inactive
 * C : autonome true, mutation active, taux=0 (sham)
 * D : autonome true, mutation active, taux = tauxMutationConditionDBps
 */
export function fabriquerConfigurationRunV03(
  protocole: ProtocoleExperienceEvolutionV03,
  condition: ConditionEvolution,
  seed: number,
): ConfigurationExperienceJson {
  const socle = construireSocleCommunConfigurationV03(protocole, seed);

  const autonomeActive = condition !== "A";
  const mutationActive = condition === "C" || condition === "D";
  const tauxMutation =
    condition === "D" ? protocole.tauxMutationConditionDBps : 0;

  const {
    reproductionAutonomeBase,
    mutationBase,
    ...reste
  } = socle;

  const conf: ConfigurationExperienceJson = {
    ...reste,
    reproductionAutonome: {
      ...reproductionAutonomeBase,
      etatsSurvieEligibles: [...reproductionAutonomeBase.etatsSurvieEligibles],
      active: autonomeActive,
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    },
    mutation: {
      version: mutationBase.version,
      active: mutationActive,
      tauxMutationParGeneBps: tauxMutation,
      versionCatalogueGenes: mutationBase.versionCatalogueGenes,
      ...(mutationBase.genes !== undefined ? { genes: mutationBase.genes } : {}),
    },
  };

  if (conf.mode !== "decision_simulee") {
    throw new ProtocoleEvolutionInvalideErreur(
      "invariant violé : configuration v0.3 doit être en mode decision_simulee",
    );
  }
  if (conf.environnementDecision === undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      "invariant violé : environnementDecision manquant après fabrication v0.3",
    );
  }
  if (
    autonomeActive &&
    conf.reproductionAutonome?.mecanisme !== MECANISME_REPRODUCTION_ECONOMIQUE_V03
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "invariant violé : B/C/D exigent reproduction-economique-v03",
    );
  }

  return conf;
}

export function listerRunsPlanifiesV03(
  protocole: ProtocoleExperienceEvolutionV03,
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

/**
 * Projection structurelle pour comparaison — normalise les seules
 * différences de traitement autorisées.
 */
export function projeterStructureHorsTraitementV03(
  conf: ConfigurationExperienceJson,
): unknown {
  return {
    mode: conf.mode,
    graineSimulation: conf.graineSimulation,
    taillePopulationInitiale: conf.taillePopulationInitiale,
    capitalInitialParAgentMicroUsdc: conf.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: conf.parametresEconomiques,
    environnementDecision: conf.environnementDecision,
    politiqueBudgetCognitif: conf.politiqueBudgetCognitif,
    reproduction: conf.reproduction,
    criteresArret: conf.criteresArret,
    xway: conf.xway,
    identite: conf.identite,
    reproductionAutonome: {
      version: conf.reproductionAutonome?.version,
      etatsSurvieEligibles: conf.reproductionAutonome?.etatsSurvieEligibles,
      nombreMaxNaissancesParCycle:
        conf.reproductionAutonome?.nombreMaxNaissancesParCycle,
      mecanisme: conf.reproductionAutonome?.mecanisme,
      // active exclu — traitement A vs B
    },
    mutation: {
      version: conf.mutation?.version,
      versionCatalogueGenes: conf.mutation?.versionCatalogueGenes,
      genes: conf.mutation?.genes,
      // active + taux exclus — traitements B/C/D
    },
  };
}

export type ResultatComparaisonStructurelleV03 = {
  readonly ok: boolean;
  readonly paire: string;
  readonly differencesDetectees: readonly string[];
  readonly differencesAutorisees: readonly DifferenceStructurelleAutoriseeV03[];
};

function listerDifferencesChemins(
  a: unknown,
  b: unknown,
  chemin: string,
): string[] {
  if (serialiserJsonCanonique(a) === serialiserJsonCanonique(b)) {
    return [];
  }
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null ||
    Array.isArray(a) ||
    Array.isArray(b)
  ) {
    return [chemin];
  }
  const cles = new Set([
    ...Object.keys(a as object),
    ...Object.keys(b as object),
  ]);
  const diffs: string[] = [];
  for (const cle of [...cles].sort()) {
    diffs.push(
      ...listerDifferencesChemins(
        (a as Record<string, unknown>)[cle],
        (b as Record<string, unknown>)[cle],
        chemin === "" ? cle : `${chemin}.${cle}`,
      ),
    );
  }
  return diffs;
}

/**
 * B ↔ C : uniquement l'état déclaratif de la mutation sham.
 */
export function comparerStructureBC_V03(
  confB: ConfigurationExperienceJson,
  confC: ConfigurationExperienceJson,
): ResultatComparaisonStructurelleV03 {
  const differencesAutorisees: DifferenceStructurelleAutoriseeV03[] = [
    "mutation_sham_declarative",
  ];
  const hors = listerDifferencesChemins(
    projeterStructureHorsTraitementV03(confB),
    projeterStructureHorsTraitementV03(confC),
    "",
  );
  const diffs: string[] = [...hors];

  if (confB.reproductionAutonome?.active !== confC.reproductionAutonome?.active) {
    diffs.push("reproductionAutonome.active");
  }
  if (confB.mutation?.tauxMutationParGeneBps !== confC.mutation?.tauxMutationParGeneBps) {
    diffs.push("mutation.tauxMutationParGeneBps");
  }
  // active B=false, C=true est la seule différence mutation autorisée
  if (confB.mutation?.active !== false || confC.mutation?.active !== true) {
    diffs.push("mutation.active (attendu B=false C=true)");
  }
  if (
    confB.mutation?.tauxMutationParGeneBps !== 0 ||
    confC.mutation?.tauxMutationParGeneBps !== 0
  ) {
    diffs.push("mutation.taux attendu 0 pour B et C");
  }

  return {
    ok: hors.length === 0 &&
      confB.reproductionAutonome?.active === true &&
      confC.reproductionAutonome?.active === true &&
      confB.mutation?.active === false &&
      confC.mutation?.active === true &&
      confB.mutation?.tauxMutationParGeneBps === 0 &&
      confC.mutation?.tauxMutationParGeneBps === 0,
    paire: "B-C",
    differencesDetectees: diffs.filter(
      (d) =>
        d !== "mutation.active (attendu B=false C=true)" ||
        confB.mutation?.active !== false ||
        confC.mutation?.active !== true,
    ),
    differencesAutorisees,
  };
}

/**
 * C ↔ D : uniquement le taux de mutation (D > 0).
 */
export function comparerStructureCD_V03(
  confC: ConfigurationExperienceJson,
  confD: ConfigurationExperienceJson,
  tauxDAttendu: number,
): ResultatComparaisonStructurelleV03 {
  const differencesAutorisees: DifferenceStructurelleAutoriseeV03[] = [
    "taux_mutation",
  ];
  const hors = listerDifferencesChemins(
    projeterStructureHorsTraitementV03(confC),
    projeterStructureHorsTraitementV03(confD),
    "",
  );

  const ok =
    hors.length === 0 &&
    confC.reproductionAutonome?.active === true &&
    confD.reproductionAutonome?.active === true &&
    confC.mutation?.active === true &&
    confD.mutation?.active === true &&
    confC.mutation?.tauxMutationParGeneBps === 0 &&
    confD.mutation?.tauxMutationParGeneBps === tauxDAttendu &&
    tauxDAttendu > 0;

  const diffs: string[] = [...hors];
  if (confC.mutation?.tauxMutationParGeneBps === confD.mutation?.tauxMutationParGeneBps) {
    diffs.push("taux_mutation identique (D doit différer)");
  }
  if (confC.mutation?.active !== confD.mutation?.active) {
    diffs.push("mutation.active");
  }
  if (confC.reproductionAutonome?.active !== confD.reproductionAutonome?.active) {
    diffs.push("reproductionAutonome.active");
  }

  return {
    ok,
    paire: "C-D",
    differencesDetectees: diffs,
    differencesAutorisees,
  };
}

/**
 * A ↔ B : uniquement l'activation de la reproduction autonome économique.
 */
export function comparerStructureAB_V03(
  confA: ConfigurationExperienceJson,
  confB: ConfigurationExperienceJson,
): ResultatComparaisonStructurelleV03 {
  const differencesAutorisees: DifferenceStructurelleAutoriseeV03[] = [
    "reproduction_autonome_active",
  ];
  const hors = listerDifferencesChemins(
    projeterStructureHorsTraitementV03(confA),
    projeterStructureHorsTraitementV03(confB),
    "",
  );

  const ok =
    hors.length === 0 &&
    confA.reproductionAutonome?.active === false &&
    confB.reproductionAutonome?.active === true &&
    confA.mutation?.active === false &&
    confB.mutation?.active === false &&
    confA.mutation?.tauxMutationParGeneBps === confB.mutation?.tauxMutationParGeneBps;

  return {
    ok,
    paire: "A-B",
    differencesDetectees: hors,
    differencesAutorisees,
  };
}

/**
 * Même seed → même environnement exogène (graine + décision + enjeux).
 */
export function memeEnvironnementExogeneV03(
  configs: readonly ConfigurationExperienceJson[],
): boolean {
  if (configs.length === 0) {
    return true;
  }
  const ref = configs[0]!;
  const cle = serialiserJsonCanonique({
    graine: ref.graineSimulation,
    environnementDecision: ref.environnementDecision,
  });
  return configs.every(
    (c) =>
      serialiserJsonCanonique({
        graine: c.graineSimulation,
        environnementDecision: c.environnementDecision,
      }) === cle,
  );
}
