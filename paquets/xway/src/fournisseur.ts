import type {
  DemandeInference,
  EstimationCoutInference,
  ReponseInferenceSimulee,
  TarifModeleInference,
} from "./types.js";

/**
 * Interface générique d'un fournisseur d'inférence.
 * Non liée à OpenAI / Anthropic / tout SDK externe.
 */
export interface FournisseurInference {
  estimerCout(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): EstimationCoutInference;

  inferer(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): ReponseInferenceSimulee;
}
