/**
 * Taxonomie événements reproduction mécanique ESP v0.1.
 * Corrélation exclusivement via `identifiantReproduction` (jamais la proximité de séquence).
 */

export const VERSION_SCHEMA_EVENEMENT_REPRODUCTION = 1 as const;

export const TYPES_EVENEMENT_REPRODUCTION = [
  "REPRODUCTION_DEMANDEE",
  "REPRODUCTION_AUTORISEE",
  "REPRODUCTION_REFUSEE",
  "REPRODUCTION_TERMINEE",
] as const;

export type TypeEvenementReproduction =
  (typeof TYPES_EVENEMENT_REPRODUCTION)[number];

export type MotifRefusReproduction =
  | "agent_mort"
  | "capital_insuffisant"
  | "reserve_minimale"
  | "population_maximale"
  | "cooldown"
  | "nombre_enfants_max"
  | "reproductions_cycle_max"
  | "reproduction_desactivee"
  | "identifiant_ambigu"
  | "etat_survie_non_eligible"
  | "capacite_insuffisante"
  | "naissance_meme_cycle";

export type ChargeReproductionDemandee = {
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly dotationEnfantMicroUsdc: string;
  readonly coutReproductionMicroUsdc: string;
};

export type ChargeReproductionAutorisee = {
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
  readonly dotationEnfantMicroUsdc: string;
  readonly coutReproductionMicroUsdc: string;
};

export type ChargeReproductionRefusee = {
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly motif: MotifRefusReproduction;
};

export type ChargeReproductionTerminee = {
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
};

export type EntreeEvenementReproduction = {
  identifiant: string;
  type: TypeEvenementReproduction;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementReproduction(
  valeur: string,
): valeur is TypeEvenementReproduction {
  return (TYPES_EVENEMENT_REPRODUCTION as readonly string[]).includes(valeur);
}
