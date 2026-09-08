/**
 * Protocole expérimental évolution multi-génération ESP v0.1.
 * Contrat versionné, parseur fail-closed, sans fournisseur réseau.
 */

import type {
  ParametresMutationExperienceJson,
  ParametresReproductionExperienceJson,
  PolitiqueReproductionAutonomeJson,
} from "@esp/protocole";
import type { ConfigurationExperienceJson } from "@esp/controleur";
import { empreinteSha256DepuisTexte, serialiserJsonCanonique } from "./empreinte.js";
import { FORMAT_EMPREINTE_PROTOCOLE } from "./empreinte.js";

export const VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION =
  "protocole-experience-evolution-v01" as const;

export const CONDITIONS_EVOLUTION_V01 = ["A", "B", "C", "D"] as const;

export type ConditionEvolution = (typeof CONDITIONS_EVOLUTION_V01)[number];

export type ModeCampagneEvolution = "calibration" | "evaluation";

export type FournisseurProtocoleEvolutionJson = {
  readonly identifiant: "fournisseur-inference-simule";
  readonly version: string;
  readonly selecteur?: "simule";
};

/**
 * Contrat sérialisable d'une campagne expérimentale v0.1.
 * Les montants monétaires restent des chaînes décimales micro-USDC.
 */
export type ProtocoleExperienceEvolutionV01Json = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION | string;
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
  /**
   * Base mutation pour condition D (taux écrasé par tauxMutationConditionDBps).
   * Condition C force taux=0 ; A/B désactivent.
   */
  readonly mutationBase?: ParametresMutationExperienceJson;
  readonly tauxMutationConditionDBps: number;
  readonly conditions: readonly ConditionEvolution[];
  readonly fournisseur: FournisseurProtocoleEvolutionJson;
  readonly repertoireResultatsRelatif?: string;
  /** Si true, évaluation refuse un working tree dirty (sinon marquage NON_CANONIQUE). */
  readonly exigerArbrePropre?: boolean;
  /** Horodatage fixe pour identifiantBatch déterministe (tests). */
  readonly dateLancementFixe?: string;
  /** Gabarit expérience partiel (xway, politique, identité…). */
  readonly modeleExperience?: Partial<ConfigurationExperienceJson>;
  readonly xway?: ConfigurationExperienceJson["xway"];
  readonly politiqueBudgetCognitif?: ConfigurationExperienceJson["politiqueBudgetCognitif"];
  readonly identite?: ConfigurationExperienceJson["identite"];
};

export type ProtocoleExperienceEvolutionV01 = {
  readonly version: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION;
  readonly identifiantProtocole: string;
  readonly mode: ModeCampagneEvolution;
  readonly seedsCalibration: readonly number[];
  readonly seedsEvaluation: readonly number[];
  /** Seeds actives selon le mode. */
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
  readonly xway?: ConfigurationExperienceJson["xway"];
  readonly politiqueBudgetCognitif?: ConfigurationExperienceJson["politiqueBudgetCognitif"];
  readonly identite?: ConfigurationExperienceJson["identite"];
};

export class ProtocoleEvolutionInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocoleEvolutionInvalideErreur";
  }
}

const MUTATION_BASE_DEFAUT: ParametresMutationExperienceJson = {
  version: "parametres-mutation-v01",
  active: true,
  tauxMutationParGeneBps: 0,
  versionCatalogueGenes: "genes-mutables-v01",
};

function assertEntierPositif(valeur: unknown, nom: string): asserts valeur is number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur) || valeur < 1) {
    throw new ProtocoleEvolutionInvalideErreur(
      `${nom} doit être un entier >= 1`,
    );
  }
}

function assertSeedsUniques(
  seeds: readonly number[],
  nom: string,
): void {
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
      `${contexte} : fournisseur OpenAI interdit en campagne évolution v0.1`,
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

/**
 * Parse et valide un protocole évolution v0.1 (fail closed).
 */
export function parserProtocoleEvolution(
  brut: ProtocoleExperienceEvolutionV01Json,
): ProtocoleExperienceEvolutionV01 {
  if (brut.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION) {
    throw new ProtocoleEvolutionInvalideErreur(
      `version protocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION}, reçu ${String(brut.version)}`,
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
  // Matrice v0.1 complète : A,B,C,D obligatoires (contrôle A et C si D).
  for (const requise of CONDITIONS_EVOLUTION_V01) {
    if (!conditionsVues.has(requise)) {
      throw new ProtocoleEvolutionInvalideErreur(
        `matrice v0.1 incomplete : condition ${requise} manquante (A,B,C,D requis)`,
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
  };

  // Interdiction : définir C avec un taux > 0 dans le protocole (C construit à 0).
  const modele = brut.modeleExperience;
  if (modele?.mutation !== undefined && modele.mutation.active === true) {
    if (
      modele.mutation.tauxMutationParGeneBps !== undefined &&
      modele.mutation.tauxMutationParGeneBps > 0
    ) {
      // Autorisé uniquement comme gabarit D — signaler si étiqueté C
      const commentaire = JSON.stringify(modele);
      if (commentaire.includes('"condition":"C"') || commentaire.includes("conditionC")) {
        throw new ProtocoleEvolutionInvalideErreur(
          "mutation taux > 0 interdit dans la définition de la condition C",
        );
      }
    }
  }

  const fournisseur = validerFournisseurSimule(brut.fournisseur, "protocole");

  const xwayBrut = brut.xway ?? modele?.xway;
  if (xwayBrut !== undefined) {
    const interdit = texteContientInterdit(xwayBrut);
    if (interdit !== undefined) {
      throw new ProtocoleEvolutionInvalideErreur(
        `xway : ${interdit} interdit en campagne évolution v0.1`,
      );
    }
    if (xwayBrut.fournisseur !== undefined) {
      validerFournisseurSimule(xwayBrut.fournisseur, "xway");
    }
  }

  const interditGlobal = texteContientInterdit({
    parametresEconomiques: brut.parametresEconomiques,
    modeleExperience: modele,
    politiqueBudgetCognitif: brut.politiqueBudgetCognitif,
  });
  if (interditGlobal === "Solana" || interditGlobal === "Live") {
    throw new ProtocoleEvolutionInvalideErreur(
      `${interditGlobal} interdit en campagne évolution v0.1`,
    );
  }

  const seedsActives =
    brut.mode === "calibration" ? seedsCalibration : seedsEvaluation;

  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
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
    conditions: [...CONDITIONS_EVOLUTION_V01],
    fournisseur,
    repertoireResultatsRelatif:
      brut.repertoireResultatsRelatif ?? "experiences/resultats",
    exigerArbrePropre: brut.exigerArbrePropre === true,
    ...(brut.dateLancementFixe !== undefined
      ? { dateLancementFixe: brut.dateLancementFixe }
      : {}),
    ...(xwayBrut !== undefined ? { xway: xwayBrut } : {}),
    ...(brut.politiqueBudgetCognitif !== undefined ||
    modele?.politiqueBudgetCognitif !== undefined
      ? {
          politiqueBudgetCognitif:
            brut.politiqueBudgetCognitif ?? modele?.politiqueBudgetCognitif,
        }
      : {}),
    ...(brut.identite !== undefined || modele?.identite !== undefined
      ? { identite: brut.identite ?? modele?.identite }
      : {}),
  };
}

export function chargerProtocoleEvolutionDepuisObjet(
  brut: unknown,
): ProtocoleExperienceEvolutionV01 {
  if (typeof brut !== "object" || brut === null) {
    throw new ProtocoleEvolutionInvalideErreur("protocole JSON objet requis");
  }
  return parserProtocoleEvolution(brut as ProtocoleExperienceEvolutionV01Json);
}

/**
 * Empreinte déterministe du protocole (JSON canonique trié + SHA-256).
 * Format : `sha256:<hex>` — version `empreinte-protocole-sha256-v01`.
 */
export function empreinteProtocole(
  protocole: ProtocoleExperienceEvolutionV01 | ProtocoleExperienceEvolutionV01Json,
): string {
  const corps =
    "seedsActives" in protocole
      ? serialiserPourEmpreinteProtocole(protocole as ProtocoleExperienceEvolutionV01)
      : serialiserJsonCanonique(protocole);
  return empreinteSha256DepuisTexte(
    serialiserJsonCanonique({
      format: FORMAT_EMPREINTE_PROTOCOLE,
      protocole: JSON.parse(corps) as unknown,
    }),
  );
}

function serialiserPourEmpreinteProtocole(
  protocole: ProtocoleExperienceEvolutionV01,
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
    ...(protocole.xway !== undefined ? { xway: protocole.xway } : {}),
    ...(protocole.politiqueBudgetCognitif !== undefined
      ? { politiqueBudgetCognitif: protocole.politiqueBudgetCognitif }
      : {}),
    ...(protocole.identite !== undefined ? { identite: protocole.identite } : {}),
  });
}

export function seedsDuMode(
  protocole: ProtocoleExperienceEvolutionV01,
): readonly number[] {
  return protocole.seedsActives;
}
