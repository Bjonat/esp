/**
 * Freeze pré-évaluation évolution multi-génération ESP v0.2.
 * Aucune exécution de seedsEvaluation — contrat méthodologique uniquement.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { protocolesPartagentParametresScientifiquesV02 } from "./audit-parametres-scientifiques-v02.js";
import { compterSeedsEvaluationExecutees } from "./audit-calibration.js";
import type { PaireComparaison } from "./comparaisons.js";
import {
  CHEMIN_PROTOCOLE_CALIBRATION_E1_01,
  CHEMIN_PROTOCOLE_EVALUATION_V02,
  IDENTIFIANT_PROTOCOLE_EVALUATION_V02,
} from "./deriver-protocole-evaluation-v02.js";
import {
  COMPARAISON_PRIMAIRE_EVALUATION,
  COMPARAISONS_SECONDAIRES_EVALUATION,
  ETAT_FREEZE_GELE_NON_EXECUTE,
  FreezeEvaluationInvalideErreur,
  MOTIFS_RANKING_INTERDITS,
  assertSansRankingFitnessGlobale,
  type EtatFreezeEvaluation,
} from "./freeze-evaluation.js";
import {
  chargerProtocoleEvolutionV02DepuisObjet,
  empreinteProtocoleV02,
  type ProtocoleExperienceEvolutionV02,
  type ProtocoleExperienceEvolutionV02Json,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
} from "./protocole-evolution-v02.js";
import {
  ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2,
  IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2,
  NOMBRE_SEEDS_EVALUATION_V02,
  SEEDS_EVALUATION_FIGEES_V02,
  assertSeedsEvaluationV02SansCollision,
} from "./seeds-evolution-v02.js";

export const VERSION_FREEZE_EVOLUTION_EVALUATION_V02 =
  "freeze-evolution-evaluation-v02" as const;

/**
 * Tag Git prévu pour l'identité code canonique après merge.
 * Le SHA canonique ne peut pas être stocké dans le freeze (auto-référence).
 */
export const GIT_REF_FREEZE_CANONIQUE_V02 =
  "esp-evolution-evaluation-v02-freeze" as const;

export {
  COMPARAISON_PRIMAIRE_EVALUATION,
  COMPARAISONS_SECONDAIRES_EVALUATION,
  ETAT_FREEZE_GELE_NON_EXECUTE,
  FreezeEvaluationInvalideErreur,
  assertSansRankingFitnessGlobale,
  MOTIFS_RANKING_INTERDITS,
};

export type IdentifiantHypotheseEvaluationV02 = "H1" | "H2" | "H3" | "H4";

export const HYPOTHESES_EVALUATION_V02: Readonly<
  Record<
    IdentifiantHypotheseEvaluationV02,
    {
      readonly enonce: string;
      readonly comparaisonPrincipale: string;
      readonly note?: string;
    }
  >
> = {
  H1: {
    enonce:
      "Sous contrainte économique, la reproduction autonome produit une descendance différentielle entre agents/lignées.",
    comparaisonPrincipale: "B-A",
  },
  H2: {
    enonce:
      "Les mutations comportementales héritables, lorsqu'elles sont causalement exprimées par la chaîne décisionnelle v0.2, modifient les trajectoires cognitives, comportementales, économiques ou reproductives.",
    comparaisonPrincipale: "D-C",
    note: "La simple présence de mutations ne suffit pas à soutenir H2.",
  },
  H3: {
    enonce:
      "Des variantes héritables peuvent augmenter ou diminuer en fréquence à travers les générations sans mécanisme explicite de ranking fitness.",
    comparaisonPrincipale: "fréquences génotypiques / lignées",
    note: "Une hausse de fréquence seule ne constitue pas une preuve d'adaptation.",
  },
  H4: {
    enonce:
      "Un signal prudent d'adaptation économique requiert la convergence de variation héritable exprimée, descendance différentielle, changement de fréquence, avantage économique et réplication multi-seeds.",
    comparaisonPrincipale: "convergence multi-critères",
    note: "Ne jamais appeler cela causalité universelle. Distinguer variation / sélection différentielle / adaptation.",
  },
};

/** Motifs d'échec technique (instrument) — pas des résultats expérimentaux. */
export const MOTIFS_ECHEC_TECHNIQUE_V02 = [
  "exception",
  "crash_processus",
  "sqlite_corrompu",
  "registre_corrompu",
  "artefact_manquant",
  "artefact_run_incomplet_non_rejouable",
  "empreinte_impossible",
  "empreinte_protocole_mismatch",
  "violation_BC",
  "fournisseur_interdit",
  "erreur_io_persistante",
] as const;

export type MotifEchecTechniqueV02 = (typeof MOTIFS_ECHEC_TECHNIQUE_V02)[number];

/** Résultats scientifiques défavorables — jamais classés comme échec technique. */
export const MOTIFS_RESULTAT_SCIENTIFIQUE_DEFAVORABLE_V02 = [
  "d_inferieur_c",
  "extinction",
  "aucune_adaptation",
  "mutation_deletere",
  "aucune_fixation",
  "aucun_avantage_economique",
  "ven_faible",
  "regret_eleve",
  "garde_fou_atteint",
  "mutation_absente",
  "descendance_nulle",
  "mauvaise_performance_economique",
] as const;

/**
 * Choix figé : les agrégats diagnostiques contrefactuels (diagnostic-exposition/)
 * ne sont PAS inclus dans empreinteResultatScientifique.
 * Les observables cognitives de trajectoire (demandesInference, coût, regret, etc.)
 * restent dans la charge scientifique canonique.
 */
export const EMPREINTE_RESULTAT_INCLUT_DIAGNOSTIC_EXPRESSION_V02 = false;

export type ResultatSuiteTestsFreezeV02 = {
  readonly commande: string;
  readonly statut: "vert" | "rouge";
  readonly nombreTestsEchoues: number;
  readonly note?: string;
};

export type FreezeEvolutionEvaluationV02Json = {
  readonly version: typeof VERSION_FREEZE_EVOLUTION_EVALUATION_V02;
  readonly identifiantFreeze: string;
  readonly etat: EtatFreezeEvaluation;
  readonly versionProtocole: typeof VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02;
  readonly identifiantProtocole: typeof IDENTIFIANT_PROTOCOLE_EVALUATION_V02;
  readonly protocoleEvaluation: string;
  readonly protocoleCalibrationSource: string;
  readonly referenceEnvironnementE2: typeof IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2;
  readonly empreinteProtocole: string;
  /**
   * HEAD observé pendant la préparation du freeze.
   * NE constitue PAS l'identité canonique du code v0.2.
   */
  readonly gitShaPreparation: string;
  /**
   * Référence (tag) vers laquelle pointera le SHA canonique après merge.
   */
  readonly gitRefFreezeCanonique: typeof GIT_REF_FREEZE_CANONIQUE_V02;
  readonly nombreSeedsEvaluation: number;
  readonly nombreSeedsEvaluationExecutees: number;
  readonly seedsEvaluation: readonly number[];
  readonly resultatSuiteTests: ResultatSuiteTestsFreezeV02;
  readonly comparaisonPrimaire: PaireComparaison;
  readonly comparaisonsSecondaires: readonly PaireComparaison[];
  readonly hypotheses: readonly IdentifiantHypotheseEvaluationV02[];
  readonly regles: {
    readonly extinctionsJamaisExclues: true;
    readonly gardeFousJamaisExclus: true;
    readonly controleNegatifBCBloquant: true;
    readonly interdictionArretAnticipeSelonResultats: true;
    readonly interdictionModifierProtocoleApresVisionResultats: true;
    readonly retryUniquementMemeSeedMemeEmpreinteProtocole: true;
    readonly interdictionScoreRankingFitnessGlobale: true;
    readonly runsPrevus: 80;
  };
  readonly empreinteResultatScientifiqueInclutDiagnosticExpression: false;
  readonly documentPreenregistrement: string;
};

export function estEchecTechniqueV02(motif: string): boolean {
  return (MOTIFS_ECHEC_TECHNIQUE_V02 as readonly string[]).includes(motif);
}

export function estResultatScientifiqueDefavorableV02(motif: string): boolean {
  return (
    MOTIFS_RESULTAT_SCIENTIFIQUE_DEFAVORABLE_V02 as readonly string[]
  ).includes(motif);
}

/**
 * Retry autorisé uniquement pour échec technique documenté,
 * même condition / seed / protocole / empreinte / code.
 */
export function autoriserRetryMemeSeedMemeProtocoleV02(options: {
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
  // Violation B/C invalide la campagne entière — pas un retry de seed isolé.
  if (options.motif === "violation_BC") {
    return false;
  }
  return estEchecTechniqueV02(options.motif);
}

export function assertProtocoleEvaluationV02InchangeDepuisFreeze(
  freeze: FreezeEvolutionEvaluationV02Json,
  protocole:
    | ProtocoleExperienceEvolutionV02
    | ProtocoleExperienceEvolutionV02Json,
): void {
  const emp = empreinteProtocoleV02(
    "seedsActives" in protocole
      ? (protocole as ProtocoleExperienceEvolutionV02)
      : chargerProtocoleEvolutionV02DepuisObjet(protocole),
  );
  if (emp !== freeze.empreinteProtocole) {
    throw new FreezeEvaluationInvalideErreur(
      "protocole v0.2 modifié après freeze — empreinteProtocole divergente",
    );
  }
}

function assertEnjeuxE2(protocole: ProtocoleExperienceEvolutionV02): void {
  const enjeux = protocole.environnementDecision.enjeuxPossiblesMicroUsdc;
  if (enjeux === undefined) {
    throw new FreezeEvaluationInvalideErreur(
      "enjeuxPossiblesMicroUsdc E2 absents du protocole evaluation",
    );
  }
  if (
    enjeux.length !== ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2.length ||
    enjeux.some((e, i) => e !== ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "enjeuxPossiblesMicroUsdc ≠ distribution E2 figée",
    );
  }
}

export function parserFreezeEvolutionEvaluationV02(
  brut: unknown,
): FreezeEvolutionEvaluationV02Json {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    throw new FreezeEvaluationInvalideErreur("freeze v0.2 doit être un objet JSON");
  }
  const o = brut as Record<string, unknown>;
  if (o.version !== VERSION_FREEZE_EVOLUTION_EVALUATION_V02) {
    throw new FreezeEvaluationInvalideErreur(
      `version freeze attendue ${VERSION_FREEZE_EVOLUTION_EVALUATION_V02}`,
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
  if (o.versionProtocole !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02) {
    throw new FreezeEvaluationInvalideErreur(
      `versionProtocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02}`,
    );
  }
  if (o.identifiantProtocole !== IDENTIFIANT_PROTOCOLE_EVALUATION_V02) {
    throw new FreezeEvaluationInvalideErreur(
      `identifiantProtocole attendu ${IDENTIFIANT_PROTOCOLE_EVALUATION_V02}`,
    );
  }
  if (
    typeof o.empreinteProtocole !== "string" ||
    !o.empreinteProtocole.startsWith("sha256:")
  ) {
    throw new FreezeEvaluationInvalideErreur("empreinteProtocole sha256 requise");
  }
  // Interdit : un SHA « canonique » auto-référentiel dans le freeze.
  if ("gitSha" in o || "gitShaCanonique" in o || "shaGit" in o) {
    throw new FreezeEvaluationInvalideErreur(
      "gitSha / gitShaCanonique interdit dans le freeze v0.2 — utiliser gitShaPreparation + gitRefFreezeCanonique",
    );
  }
  if (
    typeof o.gitShaPreparation !== "string" ||
    !/^[0-9a-f]{40}$/i.test(o.gitShaPreparation)
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "gitShaPreparation requis (40 caractères hex) — HEAD de préparation, non canonique",
    );
  }
  if (o.gitRefFreezeCanonique !== GIT_REF_FREEZE_CANONIQUE_V02) {
    throw new FreezeEvaluationInvalideErreur(
      `gitRefFreezeCanonique attendu ${GIT_REF_FREEZE_CANONIQUE_V02}`,
    );
  }
  if (o.nombreSeedsEvaluation !== NOMBRE_SEEDS_EVALUATION_V02) {
    throw new FreezeEvaluationInvalideErreur(
      `nombreSeedsEvaluation doit être ${String(NOMBRE_SEEDS_EVALUATION_V02)}`,
    );
  }
  if (o.nombreSeedsEvaluationExecutees !== 0) {
    throw new FreezeEvaluationInvalideErreur(
      "nombreSeedsEvaluationExecutees doit être 0 au freeze",
    );
  }
  if (!Array.isArray(o.seedsEvaluation)) {
    throw new FreezeEvaluationInvalideErreur("seedsEvaluation requise");
  }
  const seeds = o.seedsEvaluation.map((s) => Number(s));
  if (
    seeds.length !== SEEDS_EVALUATION_FIGEES_V02.length ||
    seeds.some((s, i) => s !== SEEDS_EVALUATION_FIGEES_V02[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "seedsEvaluation ne correspondent pas à 2001..2020",
    );
  }
  assertSeedsEvaluationV02SansCollision();
  if (o.comparaisonPrimaire !== COMPARAISON_PRIMAIRE_EVALUATION) {
    throw new FreezeEvaluationInvalideErreur("comparaisonPrimaire doit être D-C");
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
  if (o.referenceEnvironnementE2 !== IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2) {
    throw new FreezeEvaluationInvalideErreur(
      `referenceEnvironnementE2 attendue ${IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2}`,
    );
  }
  if (o.empreinteResultatScientifiqueInclutDiagnosticExpression !== false) {
    throw new FreezeEvaluationInvalideErreur(
      "empreinteResultatScientifiqueInclutDiagnosticExpression doit être false (choix figé)",
    );
  }
  const regles = o.regles as FreezeEvolutionEvaluationV02Json["regles"] | undefined;
  if (
    regles === undefined ||
    regles.extinctionsJamaisExclues !== true ||
    regles.gardeFousJamaisExclus !== true ||
    regles.controleNegatifBCBloquant !== true ||
    regles.interdictionArretAnticipeSelonResultats !== true ||
    regles.interdictionModifierProtocoleApresVisionResultats !== true ||
    regles.retryUniquementMemeSeedMemeEmpreinteProtocole !== true ||
    regles.interdictionScoreRankingFitnessGlobale !== true ||
    regles.runsPrevus !== 80
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "regles freeze v0.2 incomplètes ou invalides",
    );
  }
  const tests = o.resultatSuiteTests as ResultatSuiteTestsFreezeV02 | undefined;
  if (
    tests === undefined ||
    typeof tests.commande !== "string" ||
    (tests.statut !== "vert" && tests.statut !== "rouge") ||
    typeof tests.nombreTestsEchoues !== "number"
  ) {
    throw new FreezeEvaluationInvalideErreur("resultatSuiteTests invalide");
  }
  if (!Array.isArray(o.hypotheses)) {
    throw new FreezeEvaluationInvalideErreur("hypotheses requises");
  }
  const hyp = o.hypotheses as string[];
  if (
    hyp.length !== 4 ||
    hyp[0] !== "H1" ||
    hyp[1] !== "H2" ||
    hyp[2] !== "H3" ||
    hyp[3] !== "H4"
  ) {
    throw new FreezeEvaluationInvalideErreur("hypotheses doivent être H1,H2,H3,H4");
  }

  return {
    version: VERSION_FREEZE_EVOLUTION_EVALUATION_V02,
    identifiantFreeze: o.identifiantFreeze,
    etat: ETAT_FREEZE_GELE_NON_EXECUTE,
    versionProtocole: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: IDENTIFIANT_PROTOCOLE_EVALUATION_V02,
    protocoleEvaluation: String(
      o.protocoleEvaluation ?? CHEMIN_PROTOCOLE_EVALUATION_V02,
    ),
    protocoleCalibrationSource: String(
      o.protocoleCalibrationSource ?? CHEMIN_PROTOCOLE_CALIBRATION_E1_01,
    ),
    referenceEnvironnementE2: IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2,
    empreinteProtocole: o.empreinteProtocole,
    gitShaPreparation: o.gitShaPreparation.toLowerCase(),
    gitRefFreezeCanonique: GIT_REF_FREEZE_CANONIQUE_V02,
    nombreSeedsEvaluation: NOMBRE_SEEDS_EVALUATION_V02,
    nombreSeedsEvaluationExecutees: 0,
    seedsEvaluation: SEEDS_EVALUATION_FIGEES_V02,
    resultatSuiteTests: tests,
    comparaisonPrimaire: COMPARAISON_PRIMAIRE_EVALUATION,
    comparaisonsSecondaires: COMPARAISONS_SECONDAIRES_EVALUATION,
    hypotheses: ["H1", "H2", "H3", "H4"],
    regles,
    empreinteResultatScientifiqueInclutDiagnosticExpression: false,
    documentPreenregistrement: String(
      o.documentPreenregistrement ??
        "documentation/PREENREGISTREMENT_EVOLUTION_V02.md",
    ),
  };
}

export function chargerFreezeEvolutionEvaluationV02DepuisFichier(
  chemin: string,
): FreezeEvolutionEvaluationV02Json {
  return parserFreezeEvolutionEvaluationV02(
    JSON.parse(readFileSync(chemin, "utf8")) as unknown,
  );
}

export function validerFreezeContreProtocolesV02(options: {
  readonly freeze: FreezeEvolutionEvaluationV02Json;
  readonly protocoleEvaluation: ProtocoleExperienceEvolutionV02;
  readonly protocoleCalibration: ProtocoleExperienceEvolutionV02;
}): void {
  const { freeze, protocoleEvaluation, protocoleCalibration } = options;
  if (protocoleEvaluation.mode !== "evaluation") {
    throw new FreezeEvaluationInvalideErreur(
      "protocole evaluation v0.2 exige mode=evaluation",
    );
  }
  if (
    protocoleEvaluation.identifiantProtocole !== IDENTIFIANT_PROTOCOLE_EVALUATION_V02
  ) {
    throw new FreezeEvaluationInvalideErreur(
      `identifiantProtocole evaluation attendu ${IDENTIFIANT_PROTOCOLE_EVALUATION_V02}`,
    );
  }
  assertProtocoleEvaluationV02InchangeDepuisFreeze(freeze, protocoleEvaluation);
  if (
    !protocolesPartagentParametresScientifiquesV02(
      protocoleCalibration,
      protocoleEvaluation,
    )
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "paramètres scientifiques evaluation ≠ calibration e1-01",
    );
  }
  assertEnjeuxE2(protocoleEvaluation);
  const actives = [...protocoleEvaluation.seedsActives];
  if (
    actives.length !== freeze.seedsEvaluation.length ||
    actives.some((s, i) => s !== freeze.seedsEvaluation[i])
  ) {
    throw new FreezeEvaluationInvalideErreur(
      "seedsActives evaluation ≠ seedsEvaluation figées 2001..2020",
    );
  }
  if (
    protocoleEvaluation.fournisseur.identifiant !== "fournisseur-inference-simule"
  ) {
    throw new FreezeEvaluationInvalideErreur("fournisseur simulé obligatoire");
  }
}

export function auditerAucuneSeedEvaluationV02Executee(options: {
  readonly repertoireResultats: string;
  readonly seedsEvaluation?: readonly number[];
}): number {
  return compterSeedsEvaluationExecutees({
    repertoireResultats: options.repertoireResultats,
    seedsEvaluation: options.seedsEvaluation ?? SEEDS_EVALUATION_FIGEES_V02,
  });
}

/**
 * Vérifie qu'aucun batch nommé evolution-evaluation-v02* n'existe.
 */
export function auditerAucunBatchEvaluationV02(
  repertoireResultats: string,
): void {
  if (!existsSync(repertoireResultats)) {
    return;
  }
  let entrees: string[];
  try {
    entrees = readdirSync(repertoireResultats);
  } catch {
    return;
  }
  for (const nom of entrees) {
    if (!nom.startsWith("evolution-evaluation-v02")) {
      continue;
    }
    const plein = join(repertoireResultats, nom);
    try {
      if (statSync(plein).isDirectory()) {
        throw new FreezeEvaluationInvalideErreur(
          `batch evaluation-v02 déjà présent : ${nom}`,
        );
      }
    } catch (e) {
      if (e instanceof FreezeEvaluationInvalideErreur) {
        throw e;
      }
    }
  }
}
