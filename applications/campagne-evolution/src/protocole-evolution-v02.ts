/**
 * Protocole expérimental évolution multi-génération ESP v0.2.
 *
 * Objectif scientifique : couplage causal génotype → phénotype via
 * mode `decision_simulee` et politique héritable effective.
 * La v0.1 reste intacte (`protocole-experience-evolution-v01`).
 */

import type {
  ParametresMutationExperienceJson,
  ParametresReproductionExperienceJson,
  PolitiqueReproductionAutonomeJson,
} from "@esp/protocole";
import type { ConfigurationExperienceJson } from "@esp/controleur";
import {
  CONDITIONS_EVOLUTION_V01,
  ProtocoleEvolutionInvalideErreur,
  type ConditionEvolution,
  type FournisseurProtocoleEvolutionJson,
  type ModeCampagneEvolution,
} from "./protocole-evolution.js";
import {
  empreinteSha256DepuisTexte,
  FORMAT_EMPREINTE_PROTOCOLE,
  serialiserJsonCanonique,
} from "./empreinte.js";

export const VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02 =
  "protocole-experience-evolution-v02" as const;

export const CONDITIONS_EVOLUTION_V02 = CONDITIONS_EVOLUTION_V01;

/**
 * Contrat sérialisable d'une campagne expérimentale v0.2.
 * `environnementDecision` est obligatoire (fail closed).
 */
export type ProtocoleExperienceEvolutionV02Json = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02 | string;
  readonly identifiantProtocole: string;
  readonly mode: ModeCampagneEvolution;
  readonly seedsCalibration?: readonly number[];
  readonly seedsEvaluation?: readonly number[];
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: ConfigurationExperienceJson["parametresEconomiques"];
  readonly reproduction: ParametresReproductionExperienceJson;
  readonly reproductionAutonome: PolitiqueReproductionAutonomeJson;
  readonly mutationBase?: ParametresMutationExperienceJson;
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly ConditionEvolution[];
  readonly fournisseur: FournisseurProtocoleEvolutionJson;
  readonly repertoireResultatsRelatif?: string;
  readonly exigerArbrePropre?: boolean;
  readonly dateLancementFixe?: string;
  /** Obligatoire v0.2 — environnement d'opportunités pour decision_simulee. */
  readonly environnementDecision: NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
  readonly politiqueBudgetCognitif: NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
  readonly xway?: ConfigurationExperienceJson["xway"];
  readonly identite?: ConfigurationExperienceJson["identite"];
  readonly criteresArret?: ConfigurationExperienceJson["criteresArret"];
  /** Gabarit partiel — ne doit pas forcer mode simulation. */
  readonly modeleExperience?: Partial<ConfigurationExperienceJson>;
};

export type ProtocoleExperienceEvolutionV02 = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02;
  readonly identifiantProtocole: string;
  readonly mode: ModeCampagneEvolution;
  readonly seedsCalibration: readonly number[];
  readonly seedsEvaluation: readonly number[];
  readonly seedsActives: readonly number[];
  readonly cyclesMaximum: number;
  readonly populationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: ConfigurationExperienceJson["parametresEconomiques"];
  readonly reproduction: ParametresReproductionExperienceJson;
  readonly reproductionAutonome: PolitiqueReproductionAutonomeJson;
  readonly mutationBase: ParametresMutationExperienceJson;
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly ConditionEvolution[];
  readonly fournisseur: FournisseurProtocoleEvolutionJson;
  readonly repertoireResultatsRelatif: string;
  readonly exigerArbrePropre: boolean;
  readonly dateLancementFixe?: string;
  readonly environnementDecision: NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
  readonly politiqueBudgetCognitif: NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
  readonly xway: NonNullable<ConfigurationExperienceJson["xway"]>;
  readonly identite?: ConfigurationExperienceJson["identite"];
  readonly criteresArret?: ConfigurationExperienceJson["criteresArret"];
};

const MUTATION_BASE_DEFAUT: ParametresMutationExperienceJson = {
  version: "parametres-mutation-v01",
  active: true,
  tauxMutationParGeneBps: 0,
  versionCatalogueGenes: "genes-mutables-v01",
};

const XWAY_SIMULE_DEFAUT_V02: NonNullable<ConfigurationExperienceJson["xway"]> =
  {
    active: true,
    plafondComputeParCycleMicroUsdc: "50000",
    modeles: [
      {
        identifiant: "modele_economique",
        libelle: "Modèle économique (campagne v0.2)",
        coutParMillionJetonsEntreeMicroUsdc: "500000",
        coutParMillionJetonsSortieMicroUsdc: "1500000",
        nombreMaxJetonsSortie: 256,
      },
      {
        identifiant: "modele_standard",
        libelle: "Modèle standard (campagne v0.2)",
        coutParMillionJetonsEntreeMicroUsdc: "2000000",
        coutParMillionJetonsSortieMicroUsdc: "6000000",
        nombreMaxJetonsSortie: 512,
      },
      {
        identifiant: "modele_premium",
        libelle: "Modèle premium (campagne v0.2)",
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
      `${contexte} : fournisseur OpenAI / réseau interdit en campagne évolution v0.2`,
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

function validerEnvironnementDecision(
  brut: unknown,
): NonNullable<ConfigurationExperienceJson["environnementDecision"]> {
  if (brut === undefined || brut === null || typeof brut !== "object") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision obligatoire pour protocole-experience-evolution-v02",
    );
  }
  const env = brut as Record<string, unknown>;
  if (env.identifiant !== "environnement-opportunites-simulees") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision.identifiant doit être environnement-opportunites-simulees",
    );
  }
  if (typeof env.version !== "string" || env.version.trim() === "") {
    throw new ProtocoleEvolutionInvalideErreur(
      "environnementDecision.version requise",
    );
  }
  for (const cle of [
    "probabiliteSuccesBaseBps",
    "amplitudeProbabiliteBps",
  ] as const) {
    if (typeof env[cle] !== "number" || !Number.isInteger(env[cle])) {
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
    if (typeof env[cle] !== "string" || !/^-?\d+$/.test(env[cle] as string)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `environnementDecision.${cle} doit être une chaîne entière`,
      );
    }
  }
  if (env.enjeuxPossiblesMicroUsdc !== undefined) {
    if (
      !Array.isArray(env.enjeuxPossiblesMicroUsdc) ||
      env.enjeuxPossiblesMicroUsdc.length === 0
    ) {
      throw new ProtocoleEvolutionInvalideErreur(
        "environnementDecision.enjeuxPossiblesMicroUsdc doit être un tableau non vide",
      );
    }
    for (const v of env.enjeuxPossiblesMicroUsdc) {
      if (typeof v !== "string" || !/^-?\d+$/.test(v)) {
        throw new ProtocoleEvolutionInvalideErreur(
          "enjeuxPossiblesMicroUsdc : chaque entrée doit être une chaîne entière",
        );
      }
    }
  }
  return brut as NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
}

function validerPolitiqueBudget(
  brut: unknown,
): NonNullable<ConfigurationExperienceJson["politiqueBudgetCognitif"]> {
  if (brut === undefined || brut === null || typeof brut !== "object") {
    throw new ProtocoleEvolutionInvalideErreur(
      "politiqueBudgetCognitif obligatoire pour protocole-experience-evolution-v02",
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
 * Parse et valide un protocole évolution v0.2 (fail closed).
 * Refuse silencieuse retombée sur simulation / fournisseur réseau.
 */
export function parserProtocoleEvolutionV02(
  brut: ProtocoleExperienceEvolutionV02Json,
): ProtocoleExperienceEvolutionV02 {
  if (brut.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02) {
    throw new ProtocoleEvolutionInvalideErreur(
      `version protocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02}, reçu ${String(brut.version)}`,
    );
  }
  if (
    typeof brut.identifiantProtocole !== "string" ||
    brut.identifiantProtocole.trim() === ""
  ) {
    throw new ProtocoleEvolutionInvalideErreur("identifiantProtocole requis");
  }
  if (brut.mode !== "calibration" && brut.mode !== "evaluation") {
    throw new ProtocoleEvolutionInvalideErreur(
      `mode invalide : ${String(brut.mode)}`,
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

  const seedsCalibration = [...(brut.seedsCalibration ?? [])];
  const seedsEvaluation = [...(brut.seedsEvaluation ?? [])];
  assertSeedsUniques(seedsCalibration, "seedsCalibration");
  assertSeedsUniques(seedsEvaluation, "seedsEvaluation");

  if (brut.mode === "calibration") {
    if (seedsCalibration.length === 0) {
      throw new ProtocoleEvolutionInvalideErreur(
        "mode calibration exige seedsCalibration non vide",
      );
    }
  } else if (seedsEvaluation.length === 0) {
    throw new ProtocoleEvolutionInvalideErreur(
      "mode evaluation exige seedsEvaluation non vide",
    );
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
  for (const requise of CONDITIONS_EVOLUTION_V02) {
    if (!conditionsVues.has(requise)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `matrice v0.2 incomplete : condition ${requise} manquante (A,B,C,D requis)`,
      );
    }
  }

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

  const environnementDecision = validerEnvironnementDecision(
    brut.environnementDecision ?? brut.modeleExperience?.environnementDecision,
  );
  const politiqueBudgetCognitif = validerPolitiqueBudget(
    brut.politiqueBudgetCognitif ?? brut.modeleExperience?.politiqueBudgetCognitif,
  );

  const modele = brut.modeleExperience;
  if (modele?.mode === "simulation") {
    throw new ProtocoleEvolutionInvalideErreur(
      "mode simulation interdit dans modeleExperience pour protocole v0.2 — decision_simulee requis",
    );
  }

  const mutationBase: ParametresMutationExperienceJson = {
    ...MUTATION_BASE_DEFAUT,
    ...(brut.mutationBase ?? {}),
    version: brut.mutationBase?.version ?? MUTATION_BASE_DEFAUT.version,
    active: true,
    tauxMutationParGeneBps:
      brut.mutationBase?.tauxMutationParGeneBps ??
      brut.tauxMutationConditionDBps,
    versionCatalogueGenes:
      brut.mutationBase?.versionCatalogueGenes ??
      MUTATION_BASE_DEFAUT.versionCatalogueGenes,
    ...(brut.mutationBase?.genes !== undefined
      ? { genes: brut.mutationBase.genes }
      : {}),
  };

  const fournisseur = validerFournisseurSimule(brut.fournisseur, "protocole");

  const xwayBrut = brut.xway ?? modele?.xway ?? XWAY_SIMULE_DEFAUT_V02;
  const interditXway = texteContientInterdit(xwayBrut);
  if (interditXway !== undefined) {
    throw new ProtocoleEvolutionInvalideErreur(
      `xway : ${interditXway} interdit en campagne évolution v0.2`,
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
    environnementDecision,
  });
  if (
    interditGlobal === "Solana" ||
    interditGlobal === "Live" ||
    interditGlobal === "OpenAI"
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${interditGlobal} interdit en campagne évolution v0.2`,
    );
  }

  const seedsActives =
    brut.mode === "calibration" ? seedsCalibration : seedsEvaluation;

  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: brut.identifiantProtocole,
    mode: brut.mode,
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
    },
    mutationBase,
    tauxMutationConditionDBps: brut.tauxMutationConditionDBps,
    conditions: [...CONDITIONS_EVOLUTION_V02],
    fournisseur,
    repertoireResultatsRelatif:
      brut.repertoireResultatsRelatif ?? "experiences/resultats",
    exigerArbrePropre: brut.exigerArbrePropre === true,
    ...(brut.dateLancementFixe !== undefined
      ? { dateLancementFixe: brut.dateLancementFixe }
      : {}),
    environnementDecision,
    politiqueBudgetCognitif,
    xway,
    ...(brut.identite !== undefined || modele?.identite !== undefined
      ? { identite: brut.identite ?? modele?.identite }
      : {}),
    ...(brut.criteresArret !== undefined
      ? { criteresArret: brut.criteresArret }
      : {}),
  };
}

export function chargerProtocoleEvolutionV02DepuisObjet(
  brut: unknown,
): ProtocoleExperienceEvolutionV02 {
  if (typeof brut !== "object" || brut === null) {
    throw new ProtocoleEvolutionInvalideErreur("protocole JSON objet requis");
  }
  return parserProtocoleEvolutionV02(brut as ProtocoleExperienceEvolutionV02Json);
}

export function empreinteProtocoleV02(
  protocole: ProtocoleExperienceEvolutionV02 | ProtocoleExperienceEvolutionV02Json,
): string {
  const corps =
    "seedsActives" in protocole
      ? serialiserPourEmpreinteProtocoleV02(
          protocole as ProtocoleExperienceEvolutionV02,
        )
      : serialiserJsonCanonique(protocole);
  return empreinteSha256DepuisTexte(
    serialiserJsonCanonique({
      format: FORMAT_EMPREINTE_PROTOCOLE,
      protocole: JSON.parse(corps) as unknown,
    }),
  );
}

function serialiserPourEmpreinteProtocoleV02(
  protocole: ProtocoleExperienceEvolutionV02,
): string {
  return serialiserJsonCanonique({
    version: protocole.version,
    identifiantProtocole: protocole.identifiantProtocole,
    mode: protocole.mode,
    seedsCalibration: protocole.seedsCalibration,
    seedsEvaluation: protocole.seedsEvaluation,
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
    environnementDecision: protocole.environnementDecision,
    politiqueBudgetCognitif: protocole.politiqueBudgetCognitif,
    xway: protocole.xway,
    ...(protocole.identite !== undefined ? { identite: protocole.identite } : {}),
    ...(protocole.criteresArret !== undefined
      ? { criteresArret: protocole.criteresArret }
      : {}),
  });
}

export { XWAY_SIMULE_DEFAUT_V02 };
