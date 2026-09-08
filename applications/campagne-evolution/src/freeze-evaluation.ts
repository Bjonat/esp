/**
 * Freeze pré-évaluation évolution multi-génération ESP v0.1.
 * Aucune exécution de seedsEvaluation ici — contrat méthodologique uniquement.
 */

import { readFileSync } from "node:fs";
import {
  chargerProtocoleEvolutionDepuisObjet,
  empreinteProtocole,
  type ProtocoleExperienceEvolutionV01,
  type ProtocoleExperienceEvolutionV01Json,
} from "./protocole-evolution.js";
import {
  protocolesPartagentParametresExperimentaux,
  compterSeedsEvaluationExecutees,
} from "./audit-calibration.js";
import type { PaireComparaison } from "./comparaisons.js";

export const VERSION_FREEZE_EVOLUTION_EVALUATION = "freeze-evolution-evaluation-v01";

export const ETAT_FREEZE_GELE_NON_EXECUTE = "gele_non_execute" as const;

export type EtatFreezeEvaluation = typeof ETAT_FREEZE_GELE_NON_EXECUTE;

export const COMPARAISON_PRIMAIRE_EVALUATION: PaireComparaison = "D-C";

export const COMPARAISONS_SECONDAIRES_EVALUATION: readonly PaireComparaison[] = [
  "B-A",
  "C-B",
  "D-B",
] as const;

export const SEEDS_EVALUATION_FIGEES_V01: readonly number[] = [
  1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013,
  1014, 1015, 1016, 1017, 1018, 1019, 1020,
] as const;

export type IdentifiantHypotheseEvaluation = "H1" | "H2" | "H3";

export const HYPOTHESES_EVALUATION_V01: Readonly<
  Record<
    IdentifiantHypotheseEvaluation,
    {
      readonly enonce: string;
      readonly comparaisonPrincipale: string;
      readonly note?: string;
    }
  >
> = {
  H1: {
    enonce:
      "La reproduction sous contrainte économique produit une descendance différentielle.",
    comparaisonPrincipale: "B versus A (descriptive)",
  },
  H2: {
    enonce:
      "La mutation héritable modifie les trajectoires économiques/reproductives.",
    comparaisonPrincipale: "D versus C",
  },
  H3: {
    enonce:
      "Certaines variantes comportementales peuvent augmenter en fréquence au fil des générations sans sélection fitness explicite.",
    comparaisonPrincipale: "trajectoires de fréquences génétiques",
    note: "Association évolutive — ne pas conclure automatiquement qu'un gène cause une meilleure performance.",
  },
};

/** Motifs d'échec technique (instrument) — pas des résultats expérimentaux. */
export const MOTIFS_ECHEC_TECHNIQUE_V01 = [
  "crash_processus",
  "registre_corrompu",
  "empreinte_protocole_mismatch",
  "artefact_run_incomplet_non_rejouable",
  "fournisseur_interdit",
  "erreur_io_persistante",
] as const;

export type MotifEchecTechnique = (typeof MOTIFS_ECHEC_TECHNIQUE_V01)[number];

/** Résultats expérimentaux — jamais classés comme échec technique. */
export const MOTIFS_RESULTAT_EXPERIMENTAL_V01 = [
  "ven_faible",
  "regret_eleve",
  "extinction",
  "garde_fou_atteint",
  "mutation_absente",
  "descendance_nulle",
  "mauvaise_performance_economique",
  "controle_negatif_BC_echoue",
] as const;

export type FreezeEvolutionEvaluationV01Json = {
  readonly version: typeof VERSION_FREEZE_EVOLUTION_EVALUATION;
  readonly identifiantFreeze: string;
  readonly etat: EtatFreezeEvaluation;
  readonly protocoleEvaluation: string;
  readonly protocoleCalibrationSource: string;
  readonly empreinteProtocole: string;
  readonly seedsEvaluation: readonly number[];
  readonly comparaisonPrimaire: PaireComparaison;
  readonly comparaisonsSecondaires: readonly PaireComparaison[];
  readonly hypotheses: readonly IdentifiantHypotheseEvaluation[];
  readonly regles: {
    readonly extinctionsJamaisExclues: true;
    readonly gardeFousJamaisExclus: true;
    readonly controleNegatifBCBloquant: true;
    readonly interdictionArretAnticipeSelonResultats: true;
    readonly interdictionModifierProtocoleApresVisionResultats: true;
    readonly retryUniquementMemeSeedMemeEmpreinteProtocole: true;
    readonly interdictionScoreRankingFitnessGlobale: true;
  };
  readonly documentPreenregistrement: string;
};

export class FreezeEvaluationInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreezeEvaluationInvalideErreur";
  }
}

export function estEchecTechnique(motif: string): boolean {
  return (MOTIFS_ECHEC_TECHNIQUE_V01 as readonly string[]).includes(motif);
}

export function estResultatExperimental(motif: string): boolean {
  return (MOTIFS_RESULTAT_EXPERIMENTAL_V01 as readonly string[]).includes(motif);
}

/**
 * Retry autorisé uniquement pour la même seed et la même empreinte protocole,
 * et uniquement en cas d'échec technique. Une mauvaise performance économique
 * n'autorise jamais un retry.
 */
export function autoriserRetryMemeSeedMemeProtocole(options: {
  readonly seedDemandee: number;
  readonly seedOriginale: number;
  readonly empreinteProtocoleActuelle: string;
  readonly empreinteProtocoleFreeze: string;
  readonly motif: string;
}): boolean {
  if (options.seedDemandee !== options.seedOriginale) {
    return false;
  }
  if (options.empreinteProtocoleActuelle !== options.empreinteProtocoleFreeze) {
    return false;
  }
  return estEchecTechnique(options.motif);
}

/**
 * Refuse toute modification du protocole après gel (empreinte différente).
 */
export function assertProtocoleEvaluationInchangeDepuisFreeze(
  freeze: FreezeEvolutionEvaluationV01Json,
  protocole: ProtocoleExperienceEvolutionV01 | ProtocoleExperienceEvolutionV01Json,
): void {
  const emp = empreinteProtocole(
    "seedsActives" in protocole
      ? (protocole as ProtocoleExperienceEvolutionV01)
      : chargerProtocoleEvolutionDepuisObjet(protocole),
  );
  if (emp !== freeze.empreinteProtocole) {
    throw new FreezeEvaluationInvalideErreur(
      "protocole modifié après freeze — empreinteProtocole divergente (modification refusée)",
    );
  }
}

export function parserFreezeEvolutionEvaluation(
  brut: unknown,
): FreezeEvolutionEvaluationV01Json {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    throw new FreezeEvaluationInvalideErreur("freeze doit être un objet JSON");
  }
  const o = brut as Record<string, unknown>;
  if (o.version !== VERSION_FREEZE_EVOLUTION_EVALUATION) {
    throw new FreezeEvaluationInvalideErreur(
      `version freeze attendue ${VERSION_FREEZE_EVOLUTION_EVALUATION}`,
    );
  }
  if (typeof o.identifiantFreeze !== "string" || o.identifiantFreeze.trim() === "") {
    throw new FreezeEvaluationInvalideErreur("identifiantFreeze requis");
  }
  if (o.etat !== ETAT_FREEZE_GELE_NON_EXECUTE) {
    throw new FreezeEvaluationInvalideErreur(
      `etat freeze attendu ${ETAT_FREEZE_GELE_NON_EXECUTE}`,
    );
  }
  if (typeof o.empreinteProtocole !== "string" || !o.empreinteProtocole.startsWith("sha256:")) {
    throw new FreezeEvaluationInvalideErreur("empreinteProtocole sha256 requise");
  }
  if (o.comparaisonPrimaire !== COMPARAISON_PRIMAIRE_EVALUATION) {
    throw new FreezeEvaluationInvalideErreur("comparaisonPrimaire doit être D-C");
  }
  if (!Array.isArray(o.seedsEvaluation)) {
    throw new FreezeEvaluationInvalideErreur("seedsEvaluation requise");
  }
  const seeds = o.seedsEvaluation.map((s) => Number(s));
  if (
    seeds.length !== SEEDS_EVALUATION_FIGEES_V01.length ||
    seeds.some((s, i) => s !== SEEDS_EVALUATION_FIGEES_V01[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "seedsEvaluation ne correspondent pas à la liste figée v0.1",
    );
  }
  if (!Array.isArray(o.comparaisonsSecondaires)) {
    throw new FreezeEvaluationInvalideErreur("comparaisonsSecondaires requises");
  }
  const sec = o.comparaisonsSecondaires as string[];
  if (
    sec.length !== COMPARAISONS_SECONDAIRES_EVALUATION.length ||
    sec.some((p, i) => p !== COMPARAISONS_SECONDAIRES_EVALUATION[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "comparaisonsSecondaires doivent être B-A, C-B, D-B",
    );
  }
  const regles = o.regles as FreezeEvolutionEvaluationV01Json["regles"] | undefined;
  if (
    regles === undefined ||
    regles.extinctionsJamaisExclues !== true ||
    regles.gardeFousJamaisExclus !== true ||
    regles.controleNegatifBCBloquant !== true ||
    regles.interdictionArretAnticipeSelonResultats !== true ||
    regles.interdictionModifierProtocoleApresVisionResultats !== true ||
    regles.retryUniquementMemeSeedMemeEmpreinteProtocole !== true ||
    regles.interdictionScoreRankingFitnessGlobale !== true
  ) {
    throw new FreezeEvaluationInvalideErreur("regles freeze incomplètes ou invalides");
  }
  // Interdit de stocker un SHA Git auto-référentiel dans le freeze.
  if ("gitSha" in o || "gitShaAuFreeze" in o || "shaGit" in o) {
    throw new FreezeEvaluationInvalideErreur(
      "SHA Git interdit dans le freeze protocole (non auto-référentiel)",
    );
  }

  return {
    version: VERSION_FREEZE_EVOLUTION_EVALUATION,
    identifiantFreeze: o.identifiantFreeze,
    etat: ETAT_FREEZE_GELE_NON_EXECUTE,
    protocoleEvaluation: String(o.protocoleEvaluation ?? ""),
    protocoleCalibrationSource: String(o.protocoleCalibrationSource ?? ""),
    empreinteProtocole: o.empreinteProtocole,
    seedsEvaluation: SEEDS_EVALUATION_FIGEES_V01,
    comparaisonPrimaire: COMPARAISON_PRIMAIRE_EVALUATION,
    comparaisonsSecondaires: COMPARAISONS_SECONDAIRES_EVALUATION,
    hypotheses: ["H1", "H2", "H3"],
    regles,
    documentPreenregistrement: String(
      o.documentPreenregistrement ??
        "documentation/PREENREGISTREMENT_EVOLUTION_V01.md",
    ),
  };
}

export function chargerFreezeEvolutionEvaluationDepuisFichier(
  chemin: string,
): FreezeEvolutionEvaluationV01Json {
  return parserFreezeEvolutionEvaluation(
    JSON.parse(readFileSync(chemin, "utf8")) as unknown,
  );
}

export function validerFreezeContreProtocoles(options: {
  readonly freeze: FreezeEvolutionEvaluationV01Json;
  readonly protocoleEvaluation: ProtocoleExperienceEvolutionV01;
  readonly protocoleCalibration: ProtocoleExperienceEvolutionV01;
}): void {
  const { freeze, protocoleEvaluation, protocoleCalibration } = options;
  if (protocoleEvaluation.mode !== "evaluation") {
    throw new FreezeEvaluationInvalideErreur("protocole evaluation exige mode=evaluation");
  }
  assertProtocoleEvaluationInchangeDepuisFreeze(freeze, protocoleEvaluation);
  if (
    !protocolesPartagentParametresExperimentaux(
      protocoleCalibration,
      protocoleEvaluation,
    )
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "paramètres expérimentaux evaluation ≠ calibration",
    );
  }
  const actives = [...protocoleEvaluation.seedsActives];
  if (
    actives.length !== freeze.seedsEvaluation.length ||
    actives.some((s, i) => s !== freeze.seedsEvaluation[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "seedsActives evaluation ≠ seedsEvaluation figées",
    );
  }
}

/**
 * Audit : aucune seed d'évaluation ne doit apparaître dans les résultats.
 */
export function auditerAucuneSeedEvaluationExecutee(options: {
  readonly repertoireResultats: string;
  readonly seedsEvaluation?: readonly number[];
}): number {
  return compterSeedsEvaluationExecutees({
    repertoireResultats: options.repertoireResultats,
    seedsEvaluation: options.seedsEvaluation ?? SEEDS_EVALUATION_FIGEES_V01,
  });
}

/** Textes interdits dans artefacts d'évaluation v0.1. */
export const MOTIFS_RANKING_INTERDITS = [
  "scoreEvolution",
  "fitnessGlobale",
  "indiceAdaptationGlobal",
  "classementAgents",
  "rankingFitness",
] as const;

export function assertSansRankingFitnessGlobale(texte: string): void {
  for (const motif of MOTIFS_RANKING_INTERDITS) {
    if (texte.includes(motif)) {
      throw new FreezeEvaluationInvalideErreur(
        `artefact contient motif ranking interdit « ${motif} »`,
      );
    }
  }
}
