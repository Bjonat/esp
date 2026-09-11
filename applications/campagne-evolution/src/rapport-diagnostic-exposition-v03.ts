/**
 * Critères et rapport du diagnostic d'exposition v03-E.
 *
 * Critères figés AVANT le premier diagnostic — ne pas les modifier
 * après observation des résultats.
 */

import type { CleGeneMutable } from "@esp/protocole";
import {
  empreinteSha256Canonique,
  serialiserJsonCanonique,
} from "./empreinte.js";
import type { IdentifiantCandidatExpositionV03 } from "./candidats-exposition-v03.js";
import type { AgregatSensibiliteGeneV03 } from "./diagnostic-sensibilite-gene-v03.js";
import type { ResultatControlePositifReproductionV03 } from "./controle-positif-reproduction-v03.js";

export const VERSION_RAPPORT_DIAGNOSTIC_EXPOSITION_V03 =
  "rapport-diagnostic-exposition-v03" as const;

/**
 * Critères d'exposition suffisante — définis AVANT exécution.
 *
 * A — les 4 gènes ont ≥ 1 contexte sensible
 * B — sensibilité sur 5/5 seeds diagnostiques
 * C — ≥ 10 contextes sensibles agrégés par gène
 * D — au moins un effet cognition OU décision par gène
 * E — effet économique immédiat : rapporté, non bloquant
 */
export const CRITERES_EXPOSITION_SUFFISANTE_V03 = {
  version: "criteres-exposition-suffisante-v03",
  seedsTotalAttendues: 5,
  seedsSensiblesMinimumParGene: 5,
  contextesSensiblesMinimumParGene: 10,
  exigerDifferenceCognitionOuDecision: true,
  effetEconomiqueBloquant: false,
  cyclesParSeed: 20,
  noteCritereE:
    "L'absence d'effet économique immédiat ne fait pas échouer le diagnostic si la chaîne politique/cognitive est exposée.",
} as const;

export type VerdictExpositionCandidatV03 =
  | "exposition_suffisante"
  | "insuffisante";

export type EvaluationCriteresExpositionV03 = {
  readonly critereA_quatreGenesSensibles: boolean;
  readonly critereB_seedsCompletes: boolean;
  readonly critereC_contextesMinimum: boolean;
  readonly critereD_cognitionOuDecision: boolean;
  readonly critereE_economiqueObserveParGene: Readonly<
    Record<string, boolean>
  >;
  readonly verdict: VerdictExpositionCandidatV03;
  readonly motifsEchec: readonly string[];
};

/**
 * Entrée de sélection — INTENTIONNELLEMENT sans VEN/D-C/descendants/fréquences.
 * Permet d'auditer structurellement l'anti-optimisation.
 */
export type EntreeSelectionCandidatExpositionV03 = {
  readonly identifiantCandidat: IdentifiantCandidatExpositionV03;
  readonly agregatsParGene: readonly AgregatSensibiliteGeneV03[];
};

export function evaluerCriteresExpositionV03(
  agregats: readonly AgregatSensibiliteGeneV03[],
): EvaluationCriteresExpositionV03 {
  const motifs: string[] = [];
  const c = CRITERES_EXPOSITION_SUFFISANTE_V03;

  const critereA = agregats.every((g) => g.contextesSensibles >= 1);
  if (!critereA) {
    motifs.push("critereA: au moins un gène sans contexte sensible");
  }

  const critereB = agregats.every(
    (g) =>
      g.seedsTotal === c.seedsTotalAttendues &&
      g.seedsSensibles >= c.seedsSensiblesMinimumParGene,
  );
  if (!critereB) {
    motifs.push(
      `critereB: seeds sensibles < ${String(c.seedsSensiblesMinimumParGene)}/5 pour au moins un gène`,
    );
  }

  const critereC = agregats.every(
    (g) => g.contextesSensibles >= c.contextesSensiblesMinimumParGene,
  );
  if (!critereC) {
    motifs.push(
      `critereC: contextes sensibles < ${String(c.contextesSensiblesMinimumParGene)} pour au moins un gène`,
    );
  }

  const critereD = agregats.every(
    (g) =>
      g.auMoinsUneDifferenceCognition || g.auMoinsUneDifferenceDecision,
  );
  if (!critereD) {
    motifs.push(
      "critereD: au moins un gène sans effet cognition/décision",
    );
  }

  const critereE: Record<string, boolean> = {};
  for (const g of agregats) {
    critereE[g.cleGene] = g.auMoinsUneDifferenceEconomique;
  }

  const verdict: VerdictExpositionCandidatV03 =
    critereA && critereB && critereC && critereD
      ? "exposition_suffisante"
      : "insuffisante";

  return {
    critereA_quatreGenesSensibles: critereA,
    critereB_seedsCompletes: critereB,
    critereC_contextesMinimum: critereC,
    critereD_cognitionOuDecision: critereD,
    critereE_economiqueObserveParGene: critereE,
    verdict,
    motifsEchec: motifs,
  };
}

/**
 * Règle d'arrêt pure : premier candidat satisfaisant.
 * Ne lit aucun champ de performance économique / D−C.
 */
export function appliquerRegleArretPremierSatisfaisantV03(
  evaluations: readonly {
    readonly identifiantCandidat: IdentifiantCandidatExpositionV03;
    readonly evaluation: EvaluationCriteresExpositionV03;
  }[],
): {
  readonly candidatRetenu: IdentifiantCandidatExpositionV03 | null;
  readonly candidatsEvalues: readonly IdentifiantCandidatExpositionV03[];
  readonly candidatsNonEvalues: readonly IdentifiantCandidatExpositionV03[];
  readonly statut:
    | "exposition_suffisante"
    | "diagnostic_exposition_non_satisfaisant";
} {
  const evalues: IdentifiantCandidatExpositionV03[] = [];
  for (const ev of evaluations) {
    evalues.push(ev.identifiantCandidat);
    if (ev.evaluation.verdict === "exposition_suffisante") {
      const tous: IdentifiantCandidatExpositionV03[] = ["E0", "E1", "E2"];
      return {
        candidatRetenu: ev.identifiantCandidat,
        candidatsEvalues: evalues,
        candidatsNonEvalues: tous.filter((id) => !evalues.includes(id)),
        statut: "exposition_suffisante",
      };
    }
  }
  return {
    candidatRetenu: null,
    candidatsEvalues: evalues,
    candidatsNonEvalues: [],
    statut: "diagnostic_exposition_non_satisfaisant",
  };
}

/** Audit structurel anti-optimisation : clés interdites absentes. */
export const CLES_INTERDITES_SELECTION_EXPOSITION_V03 = [
  "venFinaleD",
  "deltaDC",
  "D-C",
  "nombreDescendantsD",
  "frequenceVariant",
  "avantageEconomiqueMutation",
  "classementGenotype",
  "scoreAdaptatif",
  "meilleurGene",
] as const;

export function assertEntreeSelectionSansPerformanceDC(
  entree: EntreeSelectionCandidatExpositionV03,
): void {
  const texte = serialiserJsonCanonique(entree);
  for (const cle of CLES_INTERDITES_SELECTION_EXPOSITION_V03) {
    if (texte.includes(cle)) {
      throw new Error(
        `sélection exposition v03-E refuse la clé de performance « ${cle} »`,
      );
    }
  }
  // Structure minimale attendue
  if (!("agregatsParGene" in entree) || !("identifiantCandidat" in entree)) {
    throw new Error("entrée sélection exposition mal formée");
  }
}

export type PressionGardeFousDiagnosticV03 = {
  readonly capaciteEconomiqueTheoriqueEligible: string | null;
  readonly opportunitesBloqueesParGardeFous: string | null;
  readonly capaciteBloqueeParPlafondParent: string | null;
  readonly capaciteBloqueeParPlafondsGlobaux: string | null;
  /** Unités : opportunités/capacités théoriques (comptes entiers), pas un %. */
  readonly pressionNumerateur: string | null;
  readonly pressionDenominateur: string | null;
  /**
   * Diagnostic grossier de domination structurelle (≥ 50 % bloqué).
   * ≠ critère futur de calibration ; ≠ « pression acceptable pour évaluation ».
   * Seuil officiel candidat <5 % non figé (v03-F).
   */
  readonly signalDominationGardeFous: boolean;
  readonly definitionSignalDomination: string;
  readonly note: string;
  readonly aSuivreEnCalibrationV03F: string;
};

export type NiveauxExpositionGeneRapportV03 = {
  readonly cleGene: string;
  readonly seedsSensiblesSurTotal: string;
  readonly contextesSensibles: number;
  readonly expositionPolitique: boolean;
  readonly expositionCognitiveOuDecisionnelle: boolean;
  readonly expositionEconomiqueObservee: boolean;
};

/**
 * Audit du silence économique des gènes numériques sous contrefactuel dry-run.
 * Motif principal : D (pipeline s'arrête avant l'étape économique résolue).
 */
export const AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03 = {
  genesConcernes: [
    "seuilEnjeuPourInferenceMicroUsdc",
    "partMaxVenParCycleBps",
    "plafondCognitifMicroUsdc",
  ] as const,
  motifPrincipal: "D" as const,
  motifsSecondaires: ["A"] as const,
  explication:
    "differenceEconomique n'est positionné que si les deux actions dry-run sont non-nulles et divergent, puis si le replay d'activité diverge. Sur la voie inférence, evaluerChoixSec renvoie action=null (pas d'exécution Xway) : le CF s'arrête avant l'étape économique qui pourrait diverger (D). Les gènes numériques divergent surtout via utiliserInference ou limiteDepenseAutorisee sans action résolue — éventuellement une différence d'autorisation/budget non comptabilisée en coût (A). Aucune divergence économique n'a été observée pour ces trois gènes dans ce diagnostic ; point à surveiller en calibration v03-F — pas un rejet post-hoc de E0.",
  noteComportementSansInference:
    "comportementSansInference produit des actions sans-inférence non-nulles → décision et économie observables.",
} as const;

export type ResultatCandidatDiagnosticExpositionV03 = {
  readonly identifiantCandidat: IdentifiantCandidatExpositionV03;
  readonly libelle: string;
  readonly execute: boolean;
  readonly agregatsParGene: readonly AgregatSensibiliteGeneV03[];
  readonly niveauxExpositionParGene: readonly NiveauxExpositionGeneRapportV03[];
  readonly evaluation: EvaluationCriteresExpositionV03;
};

export type RapportDiagnosticExpositionV03 = {
  readonly version: typeof VERSION_RAPPORT_DIAGNOSTIC_EXPOSITION_V03;
  readonly statut: "diagnostic";
  readonly statutScientifique: "non_freeze";
  readonly sensVerdictExposition:
    "EXPOSITION_PHENOTYPIQUE_CAUSALE_SUFFISANTE_selon_criteres_A_D_preenregistres";
  readonly horsPerimetre:
    "CALIBRATION_ECONOMIQUE_REPRODUCTIVE_reste_v03_F — pas environnement optimal, pas validation H4, pas preuve d'adaptation";
  readonly mentionAntiOptimisation: "aucune performance D-C utilisée pour cette sélection";
  readonly regleArret: "premier_candidat_satisfaisant_STOP";
  readonly seedsDiagnostiques: readonly number[];
  readonly criteresPredefinis: typeof CRITERES_EXPOSITION_SUFFISANTE_V03;
  readonly regleVoisin:
    "premier voisin valide de voisinsUnPasGene (moins avant plus ; catégoriel = ordre catalogue)";
  readonly candidatsDefinisAvantExecution: readonly IdentifiantCandidatExpositionV03[];
  readonly candidatsExecutes: readonly IdentifiantCandidatExpositionV03[];
  readonly candidatsNonExecutesApresSucces: readonly IdentifiantCandidatExpositionV03[];
  readonly statutCandidatsNonExecutes: "non_executes_apres_succes_e0" | "aucun" | "tous_executes_insuffisants";
  readonly resultatsCandidats: readonly ResultatCandidatDiagnosticExpositionV03[];
  readonly candidatRetenu: IdentifiantCandidatExpositionV03 | null;
  readonly definitionEnvironnementRetenu: unknown | null;
  readonly provenanceCandidatRetenu: unknown | null;
  readonly auditSilenceEconomiqueGenesNumeriques: typeof AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03;
  readonly observationEconomiqueE0: string;
  readonly controlePositifReproduction: ResultatControlePositifReproductionV03;
  readonly pressionGardeFous: PressionGardeFousDiagnosticV03;
  readonly controleNegatifBc: {
    readonly ok: boolean | null;
    readonly detail: string;
  };
  readonly verdictGlobal:
    | "EXPOSITION_SUFFISANTE"
    | "EXPOSITION_INSUFFISANTE";
  readonly raisons: readonly string[];
  readonly empreinteSha256: string;
};

export function niveauxExpositionDepuisAgregats(
  agregats: readonly AgregatSensibiliteGeneV03[],
): readonly NiveauxExpositionGeneRapportV03[] {
  return agregats.map((g) => ({
    cleGene: g.cleGene,
    seedsSensiblesSurTotal: `${String(g.seedsSensibles)}/${String(g.seedsTotal)}`,
    contextesSensibles: g.contextesSensibles,
    expositionPolitique: g.auMoinsUneDifferencePolitique,
    expositionCognitiveOuDecisionnelle:
      g.auMoinsUneDifferenceCognition || g.auMoinsUneDifferenceDecision,
    expositionEconomiqueObservee: g.auMoinsUneDifferenceEconomique,
  }));
}

export function construireRapportDiagnosticExpositionV03(
  corps: Omit<RapportDiagnosticExpositionV03, "empreinteSha256" | "version"> & {
    readonly version?: typeof VERSION_RAPPORT_DIAGNOSTIC_EXPOSITION_V03;
  },
): RapportDiagnosticExpositionV03 {
  const sansEmpreinte = {
    version: VERSION_RAPPORT_DIAGNOSTIC_EXPOSITION_V03,
    ...corps,
  };
  const empreinteSha256 = empreinteSha256Canonique(sansEmpreinte);
  return { ...sansEmpreinte, empreinteSha256 };
}

export function resumeSensibiliteParGenePourRapport(
  agregats: readonly AgregatSensibiliteGeneV03[],
): Readonly<
  Record<
    CleGeneMutable,
    {
      seedsSensiblesSurTotal: string;
      contextesSensibles: number;
      expositionPolitique: boolean;
      expositionCognitiveOuDecisionnelle: boolean;
      expositionEconomiqueObservee: boolean;
    }
  >
> {
  const out = {} as Record<
    CleGeneMutable,
    {
      seedsSensiblesSurTotal: string;
      contextesSensibles: number;
      expositionPolitique: boolean;
      expositionCognitiveOuDecisionnelle: boolean;
      expositionEconomiqueObservee: boolean;
    }
  >;
  for (const n of niveauxExpositionDepuisAgregats(agregats)) {
    out[n.cleGene as CleGeneMutable] = {
      seedsSensiblesSurTotal: n.seedsSensiblesSurTotal,
      contextesSensibles: n.contextesSensibles,
      expositionPolitique: n.expositionPolitique,
      expositionCognitiveOuDecisionnelle: n.expositionCognitiveOuDecisionnelle,
      expositionEconomiqueObservee: n.expositionEconomiqueObservee,
    };
  }
  return out;
}
