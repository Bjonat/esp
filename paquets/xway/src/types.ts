import type { MicroUsdc } from "@esp/protocole";

/**
 * Catalogue de modèles d'inférence simulés — tarifs de DÉVELOPPEMENT uniquement.
 * Aucune prétention de réalisme marché ou de canonicité ESP.
 */
export type IdentifiantModeleInference =
  | "modele_economique"
  | "modele_standard"
  | "modele_premium";

export type TarifModeleInference = {
  readonly identifiant: IdentifiantModeleInference;
  readonly libelle: string;
  /** Coût micro-USDC par million de jetons d'entrée. */
  readonly coutParMillionJetonsEntreeMicroUsdc: MicroUsdc;
  /** Coût micro-USDC par million de jetons de sortie. */
  readonly coutParMillionJetonsSortieMicroUsdc: MicroUsdc;
  readonly nombreMaxJetonsSortie: number;
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

export type UsageInference = {
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly coutMicroUsdc: MicroUsdc;
};

export type EstimationCoutInference = {
  readonly jetonsEntreeEstimes: number;
  readonly jetonsSortieMax: number;
  readonly coutMaximumEstimeMicroUsdc: MicroUsdc;
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
  | "capacite_reservee_insuffisante";

export type ReponseInferenceSimulee = {
  readonly texte: string;
  readonly usage: UsageInference;
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
      readonly reponse: ReponseInferenceSimulee;
      readonly coutFinalMicroUsdc: MicroUsdc;
      readonly estimation: EstimationCoutInference;
      /** true si résultat reconstruit — aucun second appel fournisseur. */
      readonly dejaConnue?: boolean;
      /** Montant de réservation libéré au-delà du coût final. */
      readonly reservationLibereeMicroUsdc?: MicroUsdc;
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
    readonly identifiant: "fournisseur-inference-simule";
    readonly version: string;
  };
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
  readonly fournisseur: {
    readonly identifiant: "fournisseur-inference-simule";
    readonly version: string;
  };
};
