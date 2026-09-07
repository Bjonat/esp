import type { MicroUsdc, MicroUsd } from "@esp/protocole";

/**
 * Catalogue de modèles d'inférence — tarifs expérimentaux ESP (coût agent).
 * Inclut le modèle logique réel v0.1 (`luna_reel_v01`) distinct du nom OpenAI.
 */
export type IdentifiantModeleInference =
  | "modele_economique"
  | "modele_standard"
  | "modele_premium"
  | "luna_reel_v01";

export type TarifModeleInference = {
  readonly identifiant: IdentifiantModeleInference;
  readonly libelle: string;
  /** Coût micro-USDC par million de jetons d'entrée (imputation agent). */
  readonly coutParMillionJetonsEntreeMicroUsdc: MicroUsdc;
  /** Coût micro-USDC par million de jetons de sortie (imputation agent). */
  readonly coutParMillionJetonsSortieMicroUsdc: MicroUsdc;
  readonly nombreMaxJetonsSortie: number;
};

/**
 * Barème figé d'estimation du coût FOURNISSEUR externe (USD).
 * Figé dans EXPERIENCE_CREEE — ne change jamais pour une expérience commencée.
 * ESTIMATION uniquement — pas une facture exacte.
 */
export type BaremeCoutInference = {
  readonly fournisseur: IdentifiantFournisseurInference;
  readonly modeleLogique: IdentifiantModeleInference;
  /** Nom externe à la frontière fournisseur (ex. gpt-5.6-luna). */
  readonly modeleExterne: string;
  readonly versionBareme: string;
  readonly deviseReference: "USD";
  readonly coutParMillionJetonsEntreeMicroUsd: MicroUsd;
  readonly coutParMillionJetonsSortieMicroUsd: MicroUsd;
  readonly coutParMillionJetonsEntreeCacheMicroUsd: MicroUsd;
  /** Date / référence informative du barème (non opérationnelle). */
  readonly dateReference: string;
};

export type BaremeCoutInferenceJson = {
  readonly fournisseur: IdentifiantFournisseurInference;
  readonly modeleLogique: IdentifiantModeleInference;
  readonly modeleExterne: string;
  readonly versionBareme: string;
  readonly deviseReference: "USD";
  readonly coutParMillionJetonsEntreeMicroUsd: string;
  readonly coutParMillionJetonsSortieMicroUsd: string;
  readonly coutParMillionJetonsEntreeCacheMicroUsd: string;
  readonly dateReference: string;
};

export type MessageInference = {
  readonly role: "systeme" | "utilisateur" | "assistant";
  readonly contenu: string;
};

export type DemandeInference = {
  readonly identifiantDemande: string;
  readonly identifiantExperience: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly modeleDemande: IdentifiantModeleInference;
  readonly messages: readonly MessageInference[];
  readonly nombreMaxJetonsSortie: number;
  readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
};

/**
 * Usage mesuré côté domaine ESP (après appel fournisseur).
 * `coutMicroUsdc` = coût imputé agent (protocole), PAS le coût fournisseur.
 */
export type UsageInference = {
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly jetonsEntreeCache?: number;
  readonly coutMicroUsdc: MicroUsdc;
};

/**
 * Métriques fournisseur génériques — aucune structure OpenAI brute.
 * Extensible sans exposer la réponse SDK.
 */
export type UsageFournisseurMesure = {
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly jetonsEntreeCache?: number;
  readonly identifiantReponseFournisseur?: string;
  readonly modeleEffectif?: string;
  readonly statut: "complete" | "incomplete" | "echec" | "indetermine";
  /** Jetons de raisonnement fournisseur si exposés (sous-ensemble sortie). */
  readonly jetonsRaisonnement?: number;
  /** Ex. max_output_tokens lorsque statut=incomplete. */
  readonly motifIncomplet?: string;
};

/**
 * État de sortie structurée — distinct du statut économique executee.
 * Une consommation facturable peut coexister avec une proposition invalide.
 */
export type EtatResultatFournisseur =
  | "resultat_fournisseur_complet"
  | "resultat_fournisseur_incomplet"
  | "refus_fournisseur"
  | "sortie_structuree_invalide"
  | "echec_fournisseur";

/** Métadonnées fournisseur non sensibles (pas de prompt / pas de texte brut). */
export type MetadonneesFournisseurInference = {
  readonly identifiantReponse: string;
  readonly statut: string;
  readonly incompleteDetails: { readonly reason?: string } | null;
  readonly modele: string;
  readonly longueurOutputText: number;
  readonly typesOutputItems: readonly string[];
  readonly typesContent: readonly string[];
  readonly presenceRefusal: boolean;
  readonly inputTokens: number;
  readonly cachedTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number | null;
};

export type EstimationCoutInference = {
  readonly jetonsEntreeEstimes: number;
  readonly jetonsSortieMax: number;
  readonly coutMaximumEstimeMicroUsdc: MicroUsdc;
  /** Estimation conservatrice du coût externe (si barème présent). */
  readonly coutMaximumEstimeFournisseurMicroUsd?: MicroUsd;
};

export type EtatDemandeInference =
  | "recue"
  | "autorisee"
  | "refusee"
  | "executee"
  | "echouee";

/**
 * Distinction préparatoire aux appels réseau réels.
 * - echec_certain : aucune consommation fournisseur ; réservation libérable.
 * - resultat_indetermine : le fournisseur a pu consommer ; ne pas relancer
 *   automatiquement la même DemandeInference.
 */
export type NatureEchecInference = "echec_certain" | "resultat_indetermine";

export type MotifRefusInference =
  | "budget_insuffisant"
  | "modele_inconnu"
  | "demande_deja_consommee"
  | "demande_invalide"
  | "capacite_reservee_insuffisante"
  | "authentification_invalide"
  | "plafond_fournisseur_reel_atteint"
  | "fournisseur_indisponible";

/**
 * Réponse domaine générique (simulée ou réelle).
 * Alias historique `ReponseInferenceSimulee` conservé pour compatibilité.
 */
export type ReponseInference = {
  readonly texte: string;
  readonly usage: UsageInference;
  readonly usageFournisseur?: UsageFournisseurMesure;
  /** ESTIMATION coût fournisseur externe — distinct du coût agent. */
  readonly coutFournisseurEstimeMicroUsd?: MicroUsd;
  readonly latenceMs?: number;
  readonly propositionStructuree?: PropositionCognitiveV01;
  /** État explicite de la sortie structurée (≠ validité économique). */
  readonly etatResultatFournisseur?: EtatResultatFournisseur;
  readonly detailResultatFournisseur?: string;
  readonly metadonneesFournisseur?: MetadonneesFournisseurInference;
};

export type ReponseInferenceSimulee = ReponseInference;

/**
 * Proposition cognitive v0.1 — OBSERVATION uniquement, jamais une action exécutable.
 */
export type PropositionCognitiveV01 = {
  readonly resume: string;
  readonly actionProposee: "attendre" | "agir";
  readonly confiance: number;
  readonly valide: boolean;
};

export type ResultatAutorisationInference =
  | {
      readonly autorisee: true;
      readonly estimation: EstimationCoutInference;
      readonly reservationMicroUsdc: MicroUsdc;
      /** true si l'autorisation existait déjà (idempotence). */
      readonly dejaConnue?: boolean;
    }
  | {
      readonly autorisee: false;
      readonly motif: MotifRefusInference;
      readonly estimation: EstimationCoutInference | null;
      readonly detail: string;
    };

export type ResultatExecutionInference =
  | {
      readonly statut: "executee";
      readonly reponse: ReponseInference;
      readonly coutFinalMicroUsdc: MicroUsdc;
      readonly estimation: EstimationCoutInference;
      /** true si résultat reconstruit — aucun second appel fournisseur. */
      readonly dejaConnue?: boolean;
      /** Montant de réservation libéré au-delà du coût final. */
      readonly reservationLibereeMicroUsdc?: MicroUsdc;
      readonly coutFournisseurEstimeMicroUsd?: MicroUsd;
    }
  | {
      readonly statut: "refusee";
      readonly motif: MotifRefusInference;
      readonly detail: string;
      readonly estimation: EstimationCoutInference | null;
    }
  | {
      readonly statut: "echouee";
      readonly detail: string;
      readonly estimation: EstimationCoutInference | null;
      readonly natureEchec: NatureEchecInference;
      readonly dejaConnue?: boolean;
    }
  | {
      /**
       * Demande autorisée reprise sans confirmation fournisseur :
       * ne pas relancer automatiquement (préparation réseau).
       */
      readonly statut: "resultat_indetermine";
      readonly detail: string;
      readonly estimation: EstimationCoutInference | null;
      readonly natureEchec: "resultat_indetermine";
    };

/** Identifiant logique du fournisseur — jamais un SDK. */
export type IdentifiantFournisseurInference =
  | "fournisseur-inference-simule"
  | "fournisseur-inference-openai";

/** Sélecteur de configuration : simule (défaut) | openai (opt-in). */
export type SelecteurFournisseurXway = "simule" | "openai";

/**
 * Configuration Xway figée dans EXPERIENCE_CREEE.
 * VALEURS DE DÉMONSTRATION — non canoniques.
 */
export type ConfigurationXway = {
  readonly active: boolean;
  readonly plafondComputeParCycleMicroUsdc: MicroUsdc;
  readonly modeles: readonly TarifModeleInference[];
  readonly politiqueCognitive: {
    readonly identifiant: "politique-cognitive-developpement";
    readonly version: string;
  };
  readonly fournisseur: {
    readonly identifiant: IdentifiantFournisseurInference;
    readonly selecteur: SelecteurFournisseurXway;
    readonly version: string;
  };
  /**
   * Barème figé d'estimation fournisseur (requis si selecteur=openai).
   * Ne change jamais après EXPERIENCE_CREEE.
   */
  readonly baremeCoutInference?: BaremeCoutInference;
  /**
   * Plafond propriétaire de dépense fournisseur réelle (session/expérience).
   * Distinct de la richesse agent / VEN / crédit Xway.
   */
  readonly plafondDepenseFournisseurReelleMicroUsd?: MicroUsd;
  /** Timeout réseau configurable (ms). Défaut adaptateur si absent. */
  readonly timeoutInferenceMs?: number;
};

export type ConfigurationXwayJson = {
  readonly active: boolean;
  readonly plafondComputeParCycleMicroUsdc: string;
  readonly modeles: readonly {
    readonly identifiant: IdentifiantModeleInference;
    readonly libelle: string;
    readonly coutParMillionJetonsEntreeMicroUsdc: string;
    readonly coutParMillionJetonsSortieMicroUsdc: string;
    readonly nombreMaxJetonsSortie: number;
  }[];
  readonly politiqueCognitive: {
    readonly identifiant: "politique-cognitive-developpement";
    readonly version: string;
  };
  /**
   * Forme courte `simule` | `openai` OU forme objet legacy.
   */
  readonly fournisseur:
    | SelecteurFournisseurXway
    | {
        readonly identifiant: IdentifiantFournisseurInference;
        readonly version: string;
        readonly selecteur?: SelecteurFournisseurXway;
      };
  readonly baremeCoutInference?: BaremeCoutInferenceJson;
  readonly plafondDepenseFournisseurReelleMicroUsd?: string;
  readonly timeoutInferenceMs?: number;
};
