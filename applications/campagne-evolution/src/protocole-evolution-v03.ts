/**
 * Protocole expérimental évolution multi-génération ESP v0.3.
 *
 * Contrat versionné `protocole-experience-evolution-v03`.
 * Impossible d'activer les règles v0.3 depuis un protocole v0.1/v0.2.
 *
 * Chemin causal obligatoire : decision_simulee + provider simulé +
 * reproduction-economique-v03 (B/C/D).
 */

import {
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  type ParametresMutationExperienceJson,
  type ParametresReproductionExperienceJson,
  type PolitiqueReproductionAutonomeJson,
} from "@esp/protocole";
import type { ConfigurationExperienceJson } from "@esp/controleur";
import {
  CONDITIONS_EVOLUTION_V01,
  ProtocoleEvolutionInvalideErreur,
  type ConditionEvolution,
  type FournisseurProtocoleEvolutionJson,
} from "./protocole-evolution.js";
import {
  empreinteSha256DepuisTexte,
  FORMAT_EMPREINTE_PROTOCOLE,
  serialiserJsonCanonique,
} from "./empreinte.js";
import {
  assertSeedsDisjointesV03,
  assertUsageSeedsEvaluationV03,
  seedsPourUsageV03,
  type UsageSeedsEvolutionV03,
} from "./seeds-evolution-v03.js";
import {
  AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C,
  COMPARAISON_PRIMAIRE_V03,
  COMPARAISONS_SECONDAIRES_V03,
  HYPOTHESES_EVOLUTION_V03,
} from "./hypotheses-evolution-v03.js";

export const VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03 =
  "protocole-experience-evolution-v03" as const;

export const CONDITIONS_EVOLUTION_V03 = CONDITIONS_EVOLUTION_V01;

export type ModeCampagneEvolutionV03 = UsageSeedsEvolutionV03;

/**
 * Environnement d'exposition explicitement nommé/versionné.
 * Doit exposer les gènes héritables au chemin décisionnel (anti-régression v0.1).
 */
export type EnvironnementExpositionV03Json = {
  readonly identifiant: string;
  readonly version: string;
  readonly environnementDecision: NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
  /** Distribution/liste des enjeux si pertinente (micro-USDC). */
  readonly enjeuxPossiblesMicroUsdc?: readonly string[];
  /** Domaine RNG documenté (graine = seed expérimentale). */
  readonly domaineRng?: string;
};

export type ProtocoleExperienceEvolutionV03Json = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03 | string;
  readonly identifiantProtocole: string;
  readonly mode: ModeCampagneEvolutionV03;
  readonly seedsDiagnostic?: readonly number[];
  readonly seedsCalibration?: readonly number[];
  readonly seedsEvaluation?: readonly number[];
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: ConfigurationExperienceJson["parametresEconomiques"];
  readonly reproduction: ParametresReproductionExperienceJson;
  readonly reproductionAutonome: PolitiqueReproductionAutonomeJson;
  readonly mutationBase?: ParametresMutationExperienceJson;
  /** Taux non nul pour condition D — valeur calibrée en v03-F, pas ici. */
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly ConditionEvolution[];
  readonly fournisseur: FournisseurProtocoleEvolutionJson;
  readonly repertoireResultatsRelatif?: string;
  readonly exigerArbrePropre?: boolean;
  readonly dateLancementFixe?: string;
  readonly environnementExposition: EnvironnementExpositionV03Json;
  readonly politiqueBudgetCognitif: NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
  readonly xway?: ConfigurationExperienceJson["xway"];
  readonly identite?: ConfigurationExperienceJson["identite"];
  readonly criteresArret?: ConfigurationExperienceJson["criteresArret"];
  readonly modeleExperience?: Partial<ConfigurationExperienceJson>;
  /**
   * Si `"exemple_non_scientifique"`, le protocole est un artefact de
   * développement — mode evaluation interdit.
   */
  readonly statutArtefact?: "exemple_non_scientifique" | "scientifique";
};

export type ProtocoleExperienceEvolutionV03 = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03;
  readonly identifiantProtocole: string;
  readonly mode: ModeCampagneEvolutionV03;
  readonly seedsDiagnostic: readonly number[];
  readonly seedsCalibration: readonly number[];
  readonly seedsEvaluation: readonly number[];
  readonly seedsActives: readonly number[];
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: ConfigurationExperienceJson["parametresEconomiques"];
  readonly reproduction: ParametresReproductionExperienceJson;
  readonly reproductionAutonome: PolitiqueReproductionAutonomeJson & {
    readonly mecanisme: typeof MECANISME_REPRODUCTION_ECONOMIQUE_V03;
  };
  readonly mutationBase: ParametresMutationExperienceJson;
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly ConditionEvolution[];
  readonly fournisseur: FournisseurProtocoleEvolutionJson;
  readonly repertoireResultatsRelatif: string;
  readonly exigerArbrePropre: boolean;
  readonly dateLancementFixe?: string;
  readonly environnementExposition: EnvironnementExpositionV03Json;
  readonly environnementDecision: NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
  readonly politiqueBudgetCognitif: NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
  readonly xway: NonNullable<ConfigurationExperienceJson["xway"]>;
  readonly identite?: ConfigurationExperienceJson["identite"];
  readonly criteresArret?: ConfigurationExperienceJson["criteresArret"];
  readonly hypotheses: typeof HYPOTHESES_EVOLUTION_V03;
  readonly comparaisonPrimaire: typeof COMPARAISON_PRIMAIRE_V03;
  readonly comparaisonsSecondaires: typeof COMPARAISONS_SECONDAIRES_V03;
  readonly avertissementH4: typeof AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C;
  readonly statutArtefact: "exemple_non_scientifique" | "scientifique";
};

const MUTATION_BASE_DEFAUT_V03: ParametresMutationExperienceJson = {
  version: "parametres-mutation-v01",
  active: true,
  tauxMutationParGeneBps: 0,
  versionCatalogueGenes: "genes-mutables-v01",
};

const XWAY_SIMULE_DEFAUT_V03: NonNullable<ConfigurationExperienceJson["xway"]> =
  {
    active: true,
    plafondComputeParCycleMicroUsdc: "50000",
    modeles: [
      {
        identifiant: "modele_economique",
        libelle: "Modèle économique (campagne v0.3)",
        coutParMillionJetonsEntreeMicroUsdc: "500000",
        coutParMillionJetonsSortieMicroUsdc: "1500000",
        nombreMaxJetonsSortie: 256,
      },
      {
        identifiant: "modele_standard",
        libelle: "Modèle standard (campagne v0.3)",
        coutParMillionJetonsEntreeMicroUsdc: "2000000",
        coutParMillionJetonsSortieMicroUsdc: "6000000",
        nombreMaxJetonsSortie: 512,
      },
      {
        identifiant: "modele_premium",
        libelle: "Modèle premium (campagne v0.3)",
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

function assertEntierPositif(valeur: unknown, nom: string): asserts valeur is number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur) || valeur < 1) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${nom} doit être un entier >= 1`,
    );
  }
}

function assertSeedsUniques(seeds: readonly number[], nom: string): void {
  const vus = new Set<number>();
  for (const seed of seeds) {
    if (!Number.isInteger(seed)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `${nom} : seed non entière ${String(seed)}`,
      );
    }
    if (vus.has(seed)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `${nom} : seed dupliquée ${String(seed)}`,
      );
    }
    vus.add(seed);
  }
}

function texteContientInterdit(valeur: unknown): string | undefined {
  const texte = JSON.stringify(valeur).toLowerCase();
  if (texte.includes("openai")) {
    return "OpenAI";
  }
  if (texte.includes('"live"') || texte.includes("environnementlive")) {
    return "Live";
  }
  if (texte.includes("solana")) {
    return "Solana";
  }
  return undefined;
}

function validerFournisseurSimule(
  fournisseur: unknown,
  contexte: string,
): FournisseurProtocoleEvolutionJson {
  if (fournisseur === "simule" || fournisseur === "fournisseur-inference-simule") {
    return {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    };
  }
  if (typeof fournisseur !== "object" || fournisseur === null) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${contexte} : fournisseur simulé requis`,
    );
  }
  const f = fournisseur as Record<string, unknown>;
  if (f.selecteur === "openai" || f.identifiant === "fournisseur-inference-openai") {
    throw new ProtocoleEvolutionInvalideErreur(
      `${contexte} : fournisseur OpenAI / réseau interdit en campagne évolution v0.3`,
    );
  }
  if (
    f.identifiant !== undefined &&
    f.identifiant !== "fournisseur-inference-simule"
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${contexte} : seul fournisseur-inference-simule est autorisé`,
    );
  }
  if (f.selecteur !== undefined && f.selecteur !== "simule") {
    throw new ProtocoleEvolutionInvalideErreur(
      `${contexte} : selecteur fournisseur doit être simule`,
    );
  }
  return {
    identifiant: "fournisseur-inference-simule",
    version: typeof f.version === "string" ? f.version : "0.1.0",
    selecteur: "simule",
  };
}

function validerEnvironnementExposition(
  brut: unknown,
): EnvironnementExpositionV03Json {
  if (brut === undefined || brut === null || typeof brut !== "object") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementExposition obligatoire pour protocole-experience-evolution-v03",
    );
  }
  const env = brut as Record<string, unknown>;
  if (typeof env.identifiant !== "string" || env.identifiant.trim() === "") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementExposition.identifiant requis",
    );
  }
  if (typeof env.version !== "string" || env.version.trim() === "") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementExposition.version requise",
    );
  }
  const decision = env.environnementDecision;
  if (decision === undefined || decision === null || typeof decision !== "object") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementExposition.environnementDecision obligatoire",
    );
  }
  const d = decision as Record<string, unknown>;
  if (d.identifiant !== "environnement-opportunites-simulees") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision.identifiant doit être environnement-opportunites-simulees",
    );
  }
  if (typeof d.version !== "string" || d.version.trim() === "") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision.version requise",
    );
  }
  for (const cle of [
    "probabiliteSuccesBaseBps",
    "amplitudeProbabiliteBps",
  ] as const) {
    if (typeof d[cle] !== "number" || !Number.isInteger(d[cle])) {
      throw new ProtocoleEvolutionInvalideErreur(
        `environnementDecision.${cle} doit être un entier`,
      );
    }
  }
  for (const cle of [
    "gainSiSuccesMicroUsdc",
    "perteSiEchecMicroUsdc",
    "fraisActionMicroUsdc",
  ] as const) {
    if (typeof d[cle] !== "string" || !/^-?\d+$/.test(d[cle] as string)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `environnementDecision.${cle} doit être une chaîne entière`,
      );
    }
  }

  let enjeux: readonly string[] | undefined;
  if (env.enjeuxPossiblesMicroUsdc !== undefined) {
    if (
      !Array.isArray(env.enjeuxPossiblesMicroUsdc) ||
      env.enjeuxPossiblesMicroUsdc.length === 0
    ) {
      throw new ProtocoleEvolutionInvalideErreur(
        "enjeuxPossiblesMicroUsdc doit être un tableau non vide",
      );
    }
    for (const v of env.enjeuxPossiblesMicroUsdc) {
      if (typeof v !== "string" || !/^-?\d+$/.test(v)) {
        throw new ProtocoleEvolutionInvalideErreur(
          "enjeuxPossiblesMicroUsdc : chaque entrée doit être une chaîne entière",
        );
      }
    }
    enjeux = env.enjeuxPossiblesMicroUsdc as string[];
  } else if (d.enjeuxPossiblesMicroUsdc !== undefined) {
    enjeux = d.enjeuxPossiblesMicroUsdc as string[];
  }

  const environnementDecision = {
    ...(decision as NonNullable<
      ConfigurationExperienceJson["environnementDecision"]
    >),
    ...(enjeux !== undefined ? { enjeuxPossiblesMicroUsdc: [...enjeux] } : {}),
  };

  return {
    identifiant: env.identifiant,
    version: env.version,
    environnementDecision,
    ...(enjeux !== undefined ? { enjeuxPossiblesMicroUsdc: [...enjeux] } : {}),
    ...(typeof env.domaineRng === "string"
      ? { domaineRng: env.domaineRng }
      : {
          domaineRng:
            "graineSimulation = seed expérimentale ; opportunités indépendantes de la condition",
        }),
  };
}

function validerPolitiqueBudget(
  brut: unknown,
): NonNullable<ConfigurationExperienceJson["politiqueBudgetCognitif"]> {
  if (brut === undefined || brut === null || typeof brut !== "object") {
    throw new ProtocoleEvolutionInvalideErreur(
      "politiqueBudgetCognitif obligatoire pour protocole-experience-evolution-v03",
    );
  }
  const p = brut as Record<string, unknown>;
  if (p.identifiant !== "politique-budget-cognitif-agent") {
    throw new ProtocoleEvolutionInvalideErreur(
      "politiqueBudgetCognitif.identifiant doit être politique-budget-cognitif-agent",
    );
  }
  if (
    p.comportementSansInference !== "attendre" &&
    p.comportementSansInference !== "agir_si_favorable"
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "politiqueBudgetCognitif.comportementSansInference invalide",
    );
  }
  return brut as NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
}

/**
 * Parse et valide un protocole évolution v0.3 (fail closed).
 */
export function parserProtocoleEvolutionV03(
  brut: ProtocoleExperienceEvolutionV03Json,
): ProtocoleExperienceEvolutionV03 {
  if (brut.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03) {
    throw new ProtocoleEvolutionInvalideErreur(
      `version protocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03}, reçu ${String(brut.version)}`,
    );
  }
  if (
    typeof brut.identifiantProtocole !== "string" ||
    brut.identifiantProtocole.trim() === ""
  ) {
    throw new ProtocoleEvolutionInvalideErreur("identifiantProtocole requis");
  }
  if (
    brut.mode !== "diagnostic" &&
    brut.mode !== "calibration" &&
    brut.mode !== "evaluation"
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      `mode invalide : ${String(brut.mode)} (diagnostic|calibration|evaluation)`,
    );
  }

  assertEntierPositif(brut.cyclesMaximum, "cyclesMaximum");
  assertEntierPositif(brut.populationInitiale, "populationInitiale");

  if (
    typeof brut.capitalInitialParAgentMicroUsdc !== "string" ||
    !/^-?\d+$/.test(brut.capitalInitialParAgentMicroUsdc)
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "capitalInitialParAgentMicroUsdc doit être une chaîne entière",
    );
  }

  const seedsDiagnostic = [...(brut.seedsDiagnostic ?? [])];
  const seedsCalibration = [...(brut.seedsCalibration ?? [])];
  const seedsEvaluation = [...(brut.seedsEvaluation ?? [])];
  assertSeedsUniques(seedsDiagnostic, "seedsDiagnostic");
  assertSeedsUniques(seedsCalibration, "seedsCalibration");
  assertSeedsUniques(seedsEvaluation, "seedsEvaluation");

  try {
    assertSeedsDisjointesV03({
      seedsDiagnostic,
      seedsCalibration,
      seedsEvaluation,
    });
  } catch (erreur) {
    throw new ProtocoleEvolutionInvalideErreur(
      erreur instanceof Error ? erreur.message : String(erreur),
    );
  }

  // Étanchéité stricte : le mode sélectionne UNIQUEMENT sa liste canonique.
  // Aucun seedsExplicites — la liste gelée future est seedsEvaluation.
  if ("seedsExplicites" in brut) {
    throw new ProtocoleEvolutionInvalideErreur(
      "seedsExplicites interdit en v0.3 — utiliser seedsDiagnostic|seedsCalibration|seedsEvaluation selon le mode",
    );
  }

  const seedsActives = [
    ...seedsPourUsageV03({
      usage: brut.mode,
      seedsDiagnostic,
      seedsCalibration,
      seedsEvaluation,
    }),
  ];

  if (seedsActives.length === 0) {
    throw new ProtocoleEvolutionInvalideErreur(
      `mode ${brut.mode} exige seeds${brut.mode === "diagnostic" ? "Diagnostic" : brut.mode === "calibration" ? "Calibration" : "Evaluation"} non vide`,
    );
  }

  // Aucune fuite inter-catégories (y compris evaluation → diagnostic/calibration).
  try {
    assertUsageSeedsEvaluationV03({
      usage: brut.mode,
      seedsActives,
      seedsDiagnostic,
      seedsCalibration,
    });
  } catch (erreur) {
    throw new ProtocoleEvolutionInvalideErreur(
      erreur instanceof Error ? erreur.message : String(erreur),
    );
  }

  if (brut.statutArtefact === "exemple_non_scientifique") {
    if (brut.mode === "evaluation") {
      throw new ProtocoleEvolutionInvalideErreur(
        "artefact exemple_non_scientifique interdit en mode evaluation",
      );
    }
  }

  if (!Array.isArray(brut.conditions) || brut.conditions.length === 0) {
    throw new ProtocoleEvolutionInvalideErreur("conditions requises");
  }
  const conditionsVues = new Set<string>();
  for (const c of brut.conditions) {
    if (c !== "A" && c !== "B" && c !== "C" && c !== "D") {
      throw new ProtocoleEvolutionInvalideErreur(`condition inconnue : ${String(c)}`);
    }
    if (conditionsVues.has(c)) {
      throw new ProtocoleEvolutionInvalideErreur(`condition dupliquée : ${c}`);
    }
    conditionsVues.add(c);
  }
  for (const requise of CONDITIONS_EVOLUTION_V03) {
    if (!conditionsVues.has(requise)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `matrice v0.3 incomplete : condition ${requise} manquante (A,B,C,D requis)`,
      );
    }
  }
  // Ensemble exact A,B,C,D une fois chacun — ordre d'entrée ignoré ;
  // l'ordre canonique CONDITIONS_EVOLUTION_V03 est imposé en sortie.

  if (
    typeof brut.tauxMutationConditionDBps !== "number" ||
    !Number.isInteger(brut.tauxMutationConditionDBps) ||
    brut.tauxMutationConditionDBps < 0 ||
    brut.tauxMutationConditionDBps > 10_000
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "tauxMutationConditionDBps doit être un entier 0…10000",
    );
  }
  if (brut.tauxMutationConditionDBps <= 0) {
    throw new ProtocoleEvolutionInvalideErreur(
      "tauxMutationConditionDBps doit être > 0 pour la condition D",
    );
  }

  const reproduction = brut.reproduction;
  if (reproduction === undefined || typeof reproduction !== "object") {
    throw new ProtocoleEvolutionInvalideErreur("reproduction requise");
  }
  if (reproduction.active !== true) {
    throw new ProtocoleEvolutionInvalideErreur(
      "reproduction.active doit être true (mécanique requise pour B/C/D)",
    );
  }
  if (
    !Number.isInteger(reproduction.populationMaximale) ||
    reproduction.populationMaximale < 1
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "populationMaximale invalide (entier >= 1)",
    );
  }
  if (reproduction.populationMaximale < brut.populationInitiale) {
    throw new ProtocoleEvolutionInvalideErreur(
      "populationMaximale doit être >= populationInitiale",
    );
  }

  const reproductionAutonome = brut.reproductionAutonome;
  if (reproductionAutonome === undefined || typeof reproductionAutonome !== "object") {
    throw new ProtocoleEvolutionInvalideErreur("reproductionAutonome requise");
  }
  if ("cycleMaximum" in reproductionAutonome) {
    throw new ProtocoleEvolutionInvalideErreur(
      "cycleMaximum interdit dans reproductionAutonome — utiliser cyclesMaximum du protocole",
    );
  }
  if (reproductionAutonome.mecanisme !== MECANISME_REPRODUCTION_ECONOMIQUE_V03) {
    throw new ProtocoleEvolutionInvalideErreur(
      `reproductionAutonome.mecanisme doit être ${MECANISME_REPRODUCTION_ECONOMIQUE_V03} (reçu ${String(reproductionAutonome.mecanisme)})`,
    );
  }

  const environnementExposition = validerEnvironnementExposition(
    brut.environnementExposition,
  );
  const politiqueBudgetCognitif = validerPolitiqueBudget(
    brut.politiqueBudgetCognitif ?? brut.modeleExperience?.politiqueBudgetCognitif,
  );

  const modele = brut.modeleExperience;
  if (modele?.mode === "simulation") {
    throw new ProtocoleEvolutionInvalideErreur(
      "mode simulation interdit — decision_simulee requis pour v0.3",
    );
  }
  if (modele?.mode !== undefined && modele.mode !== "decision_simulee") {
    throw new ProtocoleEvolutionInvalideErreur(
      `mode incompatible : ${String(modele.mode)} — decision_simulee requis`,
    );
  }

  const mutationBase: ParametresMutationExperienceJson = {
    ...MUTATION_BASE_DEFAUT_V03,
    ...(brut.mutationBase ?? {}),
    version: brut.mutationBase?.version ?? MUTATION_BASE_DEFAUT_V03.version,
    active: true,
    tauxMutationParGeneBps:
      brut.mutationBase?.tauxMutationParGeneBps ??
      brut.tauxMutationConditionDBps,
    versionCatalogueGenes:
      brut.mutationBase?.versionCatalogueGenes ??
      MUTATION_BASE_DEFAUT_V03.versionCatalogueGenes,
    ...(brut.mutationBase?.genes !== undefined
      ? { genes: brut.mutationBase.genes }
      : {}),
  };

  const fournisseur = validerFournisseurSimule(brut.fournisseur, "protocole");

  const xwayBrut = brut.xway ?? modele?.xway ?? XWAY_SIMULE_DEFAUT_V03;
  const interditXway = texteContientInterdit(xwayBrut);
  if (interditXway !== undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      `xway : ${interditXway} interdit en campagne évolution v0.3`,
    );
  }
  if (xwayBrut.fournisseur !== undefined) {
    validerFournisseurSimule(xwayBrut.fournisseur, "xway");
  }
  const xway: NonNullable<ConfigurationExperienceJson["xway"]> = {
    ...xwayBrut,
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: fournisseur.version,
    },
    politiqueCognitive: {
      identifiant: "politique-budget-cognitif-agent",
      version:
        xwayBrut.politiqueCognitive?.version ??
        politiqueBudgetCognitif.version,
    },
  };

  const interditGlobal = texteContientInterdit({
    parametresEconomiques: brut.parametresEconomiques,
    modeleExperience: modele,
    politiqueBudgetCognitif,
    environnementExposition,
  });
  if (
    interditGlobal === "Solana" ||
    interditGlobal === "Live" ||
    interditGlobal === "OpenAI"
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${interditGlobal} interdit en campagne évolution v0.3`,
    );
  }

  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
    identifiantProtocole: brut.identifiantProtocole,
    mode: brut.mode,
    seedsDiagnostic,
    seedsCalibration,
    seedsEvaluation,
    seedsActives,
    cyclesMaximum: brut.cyclesMaximum,
    populationInitiale: brut.populationInitiale,
    capitalInitialParAgentMicroUsdc: brut.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: brut.parametresEconomiques,
    reproduction,
    reproductionAutonome: {
      ...reproductionAutonome,
      etatsSurvieEligibles: [...reproductionAutonome.etatsSurvieEligibles],
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    },
    mutationBase,
    tauxMutationConditionDBps: brut.tauxMutationConditionDBps,
    conditions: [...CONDITIONS_EVOLUTION_V03],
    fournisseur,
    repertoireResultatsRelatif:
      brut.repertoireResultatsRelatif ?? "experiences/resultats",
    exigerArbrePropre: brut.exigerArbrePropre === true,
    ...(brut.dateLancementFixe !== undefined
      ? { dateLancementFixe: brut.dateLancementFixe }
      : {}),
    environnementExposition,
    environnementDecision: environnementExposition.environnementDecision,
    politiqueBudgetCognitif,
    xway,
    ...(brut.identite !== undefined || modele?.identite !== undefined
      ? { identite: brut.identite ?? modele?.identite }
      : {}),
    ...(brut.criteresArret !== undefined
      ? { criteresArret: brut.criteresArret }
      : {}),
    hypotheses: HYPOTHESES_EVOLUTION_V03,
    comparaisonPrimaire: COMPARAISON_PRIMAIRE_V03,
    comparaisonsSecondaires: COMPARAISONS_SECONDAIRES_V03,
    avertissementH4: AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C,
    statutArtefact:
      brut.statutArtefact === "exemple_non_scientifique"
        ? "exemple_non_scientifique"
        : "scientifique",
  };
}

export function chargerProtocoleEvolutionV03DepuisObjet(
  brut: unknown,
): ProtocoleExperienceEvolutionV03 {
  if (typeof brut !== "object" || brut === null) {
    throw new ProtocoleEvolutionInvalideErreur("protocole JSON objet requis");
  }
  return parserProtocoleEvolutionV03(brut as ProtocoleExperienceEvolutionV03Json);
}

export function empreinteProtocoleV03(
  protocole: ProtocoleExperienceEvolutionV03 | ProtocoleExperienceEvolutionV03Json,
): string {
  const corps =
    "seedsActives" in protocole
      ? serialiserPourEmpreinteProtocoleV03(
          protocole as ProtocoleExperienceEvolutionV03,
        )
      : serialiserJsonCanonique(protocole);
  return empreinteSha256DepuisTexte(
    serialiserJsonCanonique({
      format: FORMAT_EMPREINTE_PROTOCOLE,
      protocole: JSON.parse(corps) as unknown,
    }),
  );
}

function serialiserPourEmpreinteProtocoleV03(
  protocole: ProtocoleExperienceEvolutionV03,
): string {
  return serialiserJsonCanonique({
    version: protocole.version,
    identifiantProtocole: protocole.identifiantProtocole,
    mode: protocole.mode,
    seedsDiagnostic: protocole.seedsDiagnostic,
    seedsCalibration: protocole.seedsCalibration,
    seedsEvaluation: protocole.seedsEvaluation,
    seedsActives: protocole.seedsActives,
    cyclesMaximum: protocole.cyclesMaximum,
    populationInitiale: protocole.populationInitiale,
    capitalInitialParAgentMicroUsdc: protocole.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: protocole.parametresEconomiques,
    reproduction: protocole.reproduction,
    reproductionAutonome: protocole.reproductionAutonome,
    mutationBase: protocole.mutationBase,
    tauxMutationConditionDBps: protocole.tauxMutationConditionDBps,
    conditions: protocole.conditions,
    fournisseur: protocole.fournisseur,
    repertoireResultatsRelatif: protocole.repertoireResultatsRelatif,
    exigerArbrePropre: protocole.exigerArbrePropre,
    environnementExposition: {
      identifiant: protocole.environnementExposition.identifiant,
      version: protocole.environnementExposition.version,
      environnementDecision: protocole.environnementDecision,
      ...(protocole.environnementExposition.enjeuxPossiblesMicroUsdc !==
      undefined
        ? {
            enjeuxPossiblesMicroUsdc:
              protocole.environnementExposition.enjeuxPossiblesMicroUsdc,
          }
        : {}),
      ...(protocole.environnementExposition.domaineRng !== undefined
        ? { domaineRng: protocole.environnementExposition.domaineRng }
        : {}),
    },
    politiqueBudgetCognitif: protocole.politiqueBudgetCognitif,
    xway: protocole.xway,
    ...(protocole.identite !== undefined ? { identite: protocole.identite } : {}),
    ...(protocole.criteresArret !== undefined
      ? { criteresArret: protocole.criteresArret }
      : {}),
  });
}

export { XWAY_SIMULE_DEFAUT_V03, MUTATION_BASE_DEFAUT_V03 };
