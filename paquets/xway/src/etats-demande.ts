import type { MicroUsdc } from "@esp/protocole";
import type {
  EtatDemandeInference,
  MotifRefusInference,
  NatureEchecInference,
} from "./types.js";

/**
 * État persistant d'une DemandeInference, reconstructible depuis le registre.
 * Aucune cohérence économique ne doit dépendre d'un état RAM non dérivable.
 */
export type EtatPersistantDemandeXway = {
  readonly identifiantDemande: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly etat: EtatDemandeInference;
  readonly coutMaximumEstimeMicroUsdc?: MicroUsdc;
  readonly coutFinalMicroUsdc?: MicroUsdc;
  readonly jetonsEntree?: number;
  readonly jetonsSortie?: number;
  readonly motifRefus?: MotifRefusInference;
  readonly detail?: string;
  readonly natureEchec?: NatureEchecInference;
  /**
   * true si l'état « autorisee » provient du registre sans confirmation
   * d'exécution locale — l'appel fournisseur ne doit pas être relancé
   * automatiquement (prépare RESULTAT_INDETERMINE réseau).
   */
  readonly repriseSansConfirmationFournisseur?: boolean;
};

export type FaitEvenementDemandeXway = {
  readonly type:
    | "DEMANDE_INFERENCE_RECUE"
    | "DEMANDE_INFERENCE_AUTORISEE"
    | "DEMANDE_INFERENCE_REFUSEE"
    | "INFERENCE_EXECUTEE"
    | "INFERENCE_ECHOUEE";
  readonly identifiantDemande: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly coutMaximumEstimeMicroUsdc?: MicroUsdc;
  readonly coutFinalMicroUsdc?: MicroUsdc;
  readonly jetonsEntree?: number;
  readonly jetonsSortie?: number;
  readonly motifRefus?: string;
  readonly detail?: string;
  readonly natureEchec?: NatureEchecInference;
};

/**
 * Reconstruit l'état terminal (ou ouvert) de chaque demande depuis les faits registre.
 */
export function reconstruireEtatsDemandesXway(
  faits: readonly FaitEvenementDemandeXway[],
): Map<string, EtatPersistantDemandeXway> {
  const etats = new Map<string, EtatPersistantDemandeXway>();

  for (const fait of faits) {
    const precedent = etats.get(fait.identifiantDemande);
    switch (fait.type) {
      case "DEMANDE_INFERENCE_RECUE":
        etats.set(fait.identifiantDemande, {
          identifiantDemande: fait.identifiantDemande,
          identifiantAgent: fait.identifiantAgent,
          numeroCycle: fait.numeroCycle,
          etat: "recue",
        });
        break;
      case "DEMANDE_INFERENCE_AUTORISEE":
        etats.set(fait.identifiantDemande, {
          identifiantDemande: fait.identifiantDemande,
          identifiantAgent: fait.identifiantAgent,
          numeroCycle: fait.numeroCycle,
          etat: "autorisee",
          ...(fait.coutMaximumEstimeMicroUsdc !== undefined
            ? { coutMaximumEstimeMicroUsdc: fait.coutMaximumEstimeMicroUsdc }
            : {}),
          // Ouverte dans le registre : pas de confirmation fournisseur locale.
          repriseSansConfirmationFournisseur: true,
        });
        break;
      case "DEMANDE_INFERENCE_REFUSEE":
        etats.set(fait.identifiantDemande, {
          identifiantDemande: fait.identifiantDemande,
          identifiantAgent: fait.identifiantAgent,
          numeroCycle: fait.numeroCycle,
          etat: "refusee",
          ...(fait.coutMaximumEstimeMicroUsdc !== undefined
            ? { coutMaximumEstimeMicroUsdc: fait.coutMaximumEstimeMicroUsdc }
            : {}),
          ...(estMotifRefus(fait.motifRefus)
            ? { motifRefus: fait.motifRefus }
            : {}),
          ...(fait.detail !== undefined ? { detail: fait.detail } : {}),
        });
        break;
      case "INFERENCE_EXECUTEE":
        etats.set(fait.identifiantDemande, {
          identifiantDemande: fait.identifiantDemande,
          identifiantAgent: fait.identifiantAgent,
          numeroCycle: fait.numeroCycle,
          etat: "executee",
          ...(precedent?.coutMaximumEstimeMicroUsdc !== undefined
            ? {
                coutMaximumEstimeMicroUsdc:
                  precedent.coutMaximumEstimeMicroUsdc,
              }
            : {}),
          ...(fait.coutFinalMicroUsdc !== undefined
            ? { coutFinalMicroUsdc: fait.coutFinalMicroUsdc }
            : {}),
          ...(fait.jetonsEntree !== undefined
            ? { jetonsEntree: fait.jetonsEntree }
            : {}),
          ...(fait.jetonsSortie !== undefined
            ? { jetonsSortie: fait.jetonsSortie }
            : {}),
        });
        break;
      case "INFERENCE_ECHOUEE": {
        const nature = fait.natureEchec ?? "echec_certain";
        etats.set(fait.identifiantDemande, {
          identifiantDemande: fait.identifiantDemande,
          identifiantAgent: fait.identifiantAgent,
          numeroCycle: fait.numeroCycle,
          etat: "echouee",
          natureEchec: nature,
          ...(precedent?.coutMaximumEstimeMicroUsdc !== undefined
            ? {
                coutMaximumEstimeMicroUsdc:
                  precedent.coutMaximumEstimeMicroUsdc,
              }
            : {}),
          ...(fait.detail !== undefined ? { detail: fait.detail } : {}),
          ...(nature === "resultat_indetermine"
            ? { repriseSansConfirmationFournisseur: true }
            : {}),
        });
        break;
      }
      default:
        break;
    }
  }

  return etats;
}

function estMotifRefus(valeur: string | undefined): valeur is MotifRefusInference {
  return (
    valeur === "budget_insuffisant" ||
    valeur === "modele_inconnu" ||
    valeur === "demande_deja_consommee" ||
    valeur === "demande_invalide" ||
    valeur === "capacite_reservee_insuffisante"
  );
}
