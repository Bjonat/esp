/**
 * Candidats d'exposition v03-E — définis AVANT toute observation de résultat.
 *
 * Règle anti-optimisation : aucun champ ici ne dépend de VEN(D), D−C,
 * descendants, fréquences génotypiques ou avantage d'une mutation.
 *
 * Seule la distribution d'enjeux / opportunités varie entre candidats.
 * Génotype fondateur, coûts de reproduction, taux mutation : inchangés.
 */

import type { ConfigurationEnvironnementOpportunitesJson } from "@esp/environnement";

export const VERSION_CANDIDATS_EXPOSITION_V03 =
  "candidats-exposition-v03" as const;

export type IdentifiantCandidatExpositionV03 = "E0" | "E1" | "E2";

export type DefinitionCandidatExpositionV03 = {
  readonly identifiant: IdentifiantCandidatExpositionV03;
  readonly libelle: string;
  readonly justificationAPriori: string;
  readonly environnementDecision: ConfigurationEnvironnementOpportunitesJson;
  readonly enjeuxPossiblesMicroUsdc: readonly string[];
  /**
   * Provenance documentaire — E0 hérite de la grille v0.2 E2.
   * Ne constitue pas une découverte indépendante v0.3.
   */
  readonly provenance?: {
    readonly origine: string;
    readonly references: readonly string[];
    readonly notes: readonly string[];
  };
};

const ENV_BASE = {
  identifiant: "environnement-opportunites-simulees",
  version: "0.1.0",
  probabiliteSuccesBaseBps: 6000,
  amplitudeProbabiliteBps: 2000,
  gainSiSuccesMicroUsdc: "800000",
  perteSiEchecMicroUsdc: "400000",
  fraisActionMicroUsdc: "20000",
  fraisAttendreMicroUsdc: "0",
} as const;

/**
 * E0 — grille d'enjeux héritée du diagnostic mécaniste v0.2 (E2).
 *
 * Identique à `ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2` /
 * `documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md` et
 * `documentation/DIAGNOSTIC_EXPOSITION_PHENOTYPIQUE_V02.md`.
 *
 * Ce n'est PAS une exposition découverte indépendamment en v0.3.
 * v0.3 lui applique ses propres critères A–E ; aucun D−C ni direction
 * de mutation favorable v0.2 n'entre dans la sélection.
 */
export const CANDIDAT_EXPOSITION_E0: DefinitionCandidatExpositionV03 = {
  identifiant: "E0",
  libelle: "exposition-reference-v03",
  justificationAPriori:
    "Grille d'enjeux héritée du diagnostic mécaniste v0.2 (E2) : 50k…250k — déjà identifiée pour exposer les frontières phénotypiques ; réévaluée sous critères v03-E indépendants.",
  provenance: {
    origine: "exposition héritée du diagnostic mécaniste v0.2",
    references: [
      "documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md",
      "documentation/DIAGNOSTIC_EXPOSITION_PHENOTYPIQUE_V02.md",
      "applications/campagne-evolution/src/seeds-evolution-v02.ts — ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2",
    ],
    notes: [
      "Identifiée en v0.2 pour exposer les frontières phénotypiques (seuils cognitifs), pas pour maximiser D−C.",
      "Aucun résultat D−C positif n'a été utilisé pour la sélectionner en v0.3.",
      "Aucune direction de mutation favorable observée en v0.2 n'a été utilisée.",
      "v0.3 lui applique ses propres critères diagnostiques indépendants (A–E).",
    ],
  },
  enjeuxPossiblesMicroUsdc: [
    "50000",
    "75000",
    "125000",
    "175000",
    "250000",
  ],
  environnementDecision: {
    ...ENV_BASE,
    enjeuxPossiblesMicroUsdc: [
      "50000",
      "75000",
      "125000",
      "175000",
      "250000",
    ],
  },
};

/**
 * E1 — enjeux plus densément répartis autour des frontières cognitives
 * (seuil 100k / voisin 50k ; plafonds cognitifs).
 */
export const CANDIDAT_EXPOSITION_E1: DefinitionCandidatExpositionV03 = {
  identifiant: "E1",
  libelle: "exposition-frontieres-cognitives-v03",
  justificationAPriori:
    "Ajoute des enjeux autour de 50k/100k/125k pour densifier les contextes où les politiques contrefactuelles divergent, sans changer le génotype fondateur.",
  enjeuxPossiblesMicroUsdc: [
    "25000",
    "50000",
    "75000",
    "100000",
    "125000",
    "200000",
    "300000",
  ],
  environnementDecision: {
    ...ENV_BASE,
    enjeuxPossiblesMicroUsdc: [
      "25000",
      "50000",
      "75000",
      "100000",
      "125000",
      "200000",
      "300000",
    ],
  },
};

/**
 * E2 — distribution plus étalée (bas → haut) pour maximiser la couverture
 * structurelle des seuils, toujours sans critère de performance.
 */
export const CANDIDAT_EXPOSITION_E2: DefinitionCandidatExpositionV03 = {
  identifiant: "E2",
  libelle: "exposition-etalee-v03",
  justificationAPriori:
    "Étend la plage (10k…400k) pour traverser davantage de frontières politiques ; dernier candidat prédéfini — pas d'E3 improvisé.",
  enjeuxPossiblesMicroUsdc: [
    "10000",
    "40000",
    "60000",
    "90000",
    "110000",
    "150000",
    "250000",
    "400000",
  ],
  environnementDecision: {
    ...ENV_BASE,
    enjeuxPossiblesMicroUsdc: [
      "10000",
      "40000",
      "60000",
      "90000",
      "110000",
      "150000",
      "250000",
      "400000",
    ],
  },
};

/**
 * Séquence ordonnée figée AVANT exécution.
 * Règle d'arrêt : retenir le premier satisfaisant ; ne pas chercher « mieux ».
 */
export const SEQUENCE_CANDIDATS_EXPOSITION_V03: readonly DefinitionCandidatExpositionV03[] =
  [CANDIDAT_EXPOSITION_E0, CANDIDAT_EXPOSITION_E1, CANDIDAT_EXPOSITION_E2];

export function candidatExpositionParIdentifiant(
  identifiant: IdentifiantCandidatExpositionV03,
): DefinitionCandidatExpositionV03 {
  const trouve = SEQUENCE_CANDIDATS_EXPOSITION_V03.find(
    (c) => c.identifiant === identifiant,
  );
  if (trouve === undefined) {
    throw new Error(`candidat exposition inconnu : ${identifiant}`);
  }
  return trouve;
}
