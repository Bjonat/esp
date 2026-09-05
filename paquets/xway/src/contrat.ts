/**
 * Frontières Xway — couche plateforme séparée du protocole ESP.
 * Aucun fournisseur d'inférence ni de paiement réel à ce stade.
 */
export type CapaciteXway =
  | "authentification"
  | "ressources-compute"
  | "inference-gateway"
  | "achat-donnees"
  | "metering"
  | "accounting";

export interface ContratXway {
  readonly capacites: readonly CapaciteXway[];
}

export const CAPACITES_XWAY: readonly CapaciteXway[] = [
  "authentification",
  "ressources-compute",
  "inference-gateway",
  "achat-donnees",
  "metering",
  "accounting",
] as const;

/**
 * Crée un contrat Xway déclaratif (stub fondation).
 * Aucune connexion externe n'est établie.
 */
export function creerContratXway(): ContratXway {
  return { capacites: CAPACITES_XWAY };
}
