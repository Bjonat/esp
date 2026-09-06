import {
  calculerUsageInference,
  estimerCoutInference,
} from "./couts.js";
import type { FournisseurInference } from "./fournisseur.js";
import type {
  DemandeInference,
  EstimationCoutInference,
  ReponseInferenceSimulee,
  TarifModeleInference,
} from "./types.js";

/**
 * ============================================================================
 * FOURNISSEUR D'INFÉRENCE SIMULÉ — DÉVELOPPEMENT
 * ============================================================================
 * Déterministe, sans réseau, sans SDK.
 * La « réponse » n'est PAS une pensée intelligente — pure charge utile technique.
 */
export class FournisseurInferenceSimule implements FournisseurInference {
  estimerCout(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): EstimationCoutInference {
    return estimerCoutInference(demande, tarif);
  }

  inferer(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): ReponseInferenceSimulee {
    const usage = calculerUsageInference({ demande, tarif });
    const texte = [
      "[FOURNISSEUR SIMULÉ — aucune IA réelle]",
      `demande=${demande.identifiantDemande}`,
      `modele=${demande.modeleDemande}`,
      `jetonsEntree=${String(usage.jetonsEntree)}`,
      `jetonsSortie=${String(usage.jetonsSortie)}`,
      `coutMicroUsdc=${usage.coutMicroUsdc.toString(10)}`,
    ].join(" | ");

    return { texte, usage };
  }
}

export function creerFournisseurInferenceSimule(): FournisseurInferenceSimule {
  return new FournisseurInferenceSimule();
}
