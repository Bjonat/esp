/**
 * Événements de planification reproduction économique v0.3.
 * Distincts de REPRODUCTION_AUTONOME_CYCLE_* (historique) pour éviter
 * toute ambiguïté de reprise.
 */

export const VERSION_SCHEMA_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03 = 1 as const;

export const TYPES_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03 = [
  "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
  "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE",
] as const;

export type TypeEvenementReproductionEconomiqueV03 =
  (typeof TYPES_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03)[number];

export type TentativeReproductionEconomiqueV03Planifiee = {
  readonly identifiantParent: string;
  readonly indexTentativeParent: number;
  readonly indexGlobal: number;
  readonly numeroEnfant: number;
  readonly identifiantEnfant: string;
  readonly identifiantReproduction: string;
};

export type ParentReproductionEconomiqueV03Planifie = {
  readonly identifiantParent: string;
  readonly nombreTentativesPlanifiees: number;
};

export type ChargeReproductionEconomiqueV03CyclePlanifiee = {
  readonly versionMecanisme: "reproduction-economique-v03";
  readonly numeroCycle: number;
  readonly versionPolitique: string;
  readonly populationAuSnapshot: number;
  readonly reproductionsDejaAuSnapshot: number;
  readonly placesGlobalesPlanifiees: number;
  readonly identifiantsParentsOrdonnes: readonly string[];
  readonly parents: readonly ParentReproductionEconomiqueV03Planifie[];
  /** Ordre d'exécution round-robin déterministe. */
  readonly tentatives: readonly TentativeReproductionEconomiqueV03Planifiee[];
};

export type ChargeReproductionEconomiqueV03CycleTerminee = {
  readonly versionMecanisme: "reproduction-economique-v03";
  readonly numeroCycle: number;
  readonly naissancesEffectuees: number;
  readonly tentativesPlanifiees: number;
  readonly tentativesExecutees: number;
};

export type EntreeEvenementReproductionEconomiqueV03 = {
  identifiant: string;
  type: TypeEvenementReproductionEconomiqueV03;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementReproductionEconomiqueV03(
  valeur: string,
): valeur is TypeEvenementReproductionEconomiqueV03 {
  return (
    TYPES_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03 as readonly string[]
  ).includes(valeur);
}

export function creerEntreeReproductionEconomiqueV03CyclePlanifiee(options: {
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly charge: ChargeReproductionEconomiqueV03CyclePlanifiee;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementReproductionEconomiqueV03 {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE-${options.identifiantExperience}-c${String(options.numeroCycle)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03,
    type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      versionMecanisme: options.charge.versionMecanisme,
      numeroCycle: options.charge.numeroCycle,
      versionPolitique: options.charge.versionPolitique,
      populationAuSnapshot: options.charge.populationAuSnapshot,
      reproductionsDejaAuSnapshot: options.charge.reproductionsDejaAuSnapshot,
      placesGlobalesPlanifiees: options.charge.placesGlobalesPlanifiees,
      identifiantsParentsOrdonnes: [
        ...options.charge.identifiantsParentsOrdonnes,
      ],
      parents: options.charge.parents.map((p) => ({ ...p })),
      tentatives: options.charge.tentatives.map((t) => ({ ...t })),
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

export function creerEntreeReproductionEconomiqueV03CycleTerminee(options: {
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly charge: ChargeReproductionEconomiqueV03CycleTerminee;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementReproductionEconomiqueV03 {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE-${options.identifiantExperience}-c${String(options.numeroCycle)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_REPRODUCTION_ECONOMIQUE_V03,
    type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE",
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      versionMecanisme: options.charge.versionMecanisme,
      numeroCycle: options.charge.numeroCycle,
      naissancesEffectuees: options.charge.naissancesEffectuees,
      tentativesPlanifiees: options.charge.tentativesPlanifiees,
      tentativesExecutees: options.charge.tentativesExecutees,
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}
