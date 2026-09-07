import type {
  DemandeInference,
  EstimationCoutInference,
  ReponseInference,
  TarifModeleInference,
} from "./types.js";

/**
 * Interface générique d'un fournisseur d'inférence.
 * Non liée à OpenAI / Anthropic / tout SDK externe.
 *
 * `inferer` est asynchrone pour permettre les adaptateurs réseau
 * sans coupler @esp/xway à un SDK.
 */
export interface FournisseurInference {
  estimerCout(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): EstimationCoutInference;

  inferer(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): Promise<ReponseInference>;
}
