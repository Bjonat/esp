/**
 * Taxonomie événements reproduction autonome ESP v0.1.
 * Planification et clôture de cycle — distincte de la reproduction mécanique unitaire.
 */

export const VERSION_SCHEMA_EVENEMENT_REPRODUCTION_AUTONOME = 1 as const;

export const TYPES_EVENEMENT_REPRODUCTION_AUTONOME = [
  "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE",
  "REPRODUCTION_AUTONOME_CYCLE_TERMINEE",
] as const;

export type TypeEvenementReproductionAutonome =
  (typeof TYPES_EVENEMENT_REPRODUCTION_AUTONOME)[number];

export type ChargeReproductionAutonomeCyclePlanifiee = {
  readonly numeroCycle: number;
  readonly versionPolitique: string;
  readonly placesDisponibles: number;
  /** Tous les économiquement éligibles, ordonnés par priorité neutre. */
  readonly identifiantsEligiblesOrdonnes: readonly string[];
  /** Premiers `placesDisponibles` retenus. */
  readonly identifiantsRetenus: readonly string[];
  /** Éligibles non retenus faute de capacité. */
  readonly identifiantsRefusCapacite: readonly string[];
  readonly populationAuSnapshot: number;
  readonly reproductionsDejaAuSnapshot: number;
};

export type ChargeReproductionAutonomeCycleTerminee = {
  readonly numeroCycle: number;
  readonly naissancesEffectuees: number;
  readonly refusCapacite: number;
};

export type EntreeEvenementReproductionAutonome = {
  identifiant: string;
  type: TypeEvenementReproductionAutonome;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementReproductionAutonome(
  valeur: string,
): valeur is TypeEvenementReproductionAutonome {
  return (
    TYPES_EVENEMENT_REPRODUCTION_AUTONOME as readonly string[]
  ).includes(valeur);
}

export function creerEntreeReproductionAutonomeCyclePlanifiee(options: {
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly charge: ChargeReproductionAutonomeCyclePlanifiee;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementReproductionAutonome {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE-${options.identifiantExperience}-c${String(options.numeroCycle)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_REPRODUCTION_AUTONOME,
    type: "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE",
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      numeroCycle: options.charge.numeroCycle,
      versionPolitique: options.charge.versionPolitique,
      placesDisponibles: options.charge.placesDisponibles,
      identifiantsEligiblesOrdonnes: [
        ...options.charge.identifiantsEligiblesOrdonnes,
      ],
      identifiantsRetenus: [...options.charge.identifiantsRetenus],
      identifiantsRefusCapacite: [...options.charge.identifiantsRefusCapacite],
      populationAuSnapshot: options.charge.populationAuSnapshot,
      reproductionsDejaAuSnapshot: options.charge.reproductionsDejaAuSnapshot,
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

export function creerEntreeReproductionAutonomeCycleTerminee(options: {
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly charge: ChargeReproductionAutonomeCycleTerminee;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementReproductionAutonome {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}REPRODUCTION_AUTONOME_CYCLE_TERMINEE-${options.identifiantExperience}-c${String(options.numeroCycle)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_REPRODUCTION_AUTONOME,
    type: "REPRODUCTION_AUTONOME_CYCLE_TERMINEE",
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      numeroCycle: options.charge.numeroCycle,
      naissancesEffectuees: options.charge.naissancesEffectuees,
      refusCapacite: options.charge.refusCapacite,
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}
