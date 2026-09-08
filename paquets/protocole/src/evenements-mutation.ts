/**
 * Taxonomie événements héritage / mutation v0.1.
 */

export const VERSION_SCHEMA_EVENEMENT_MUTATION = 1 as const;

export const TYPES_EVENEMENT_MUTATION = [
  "CONFIGURATION_HERITEE",
  "MUTATION_APPLIQUEE",
] as const;

export type TypeEvenementMutation = (typeof TYPES_EVENEMENT_MUTATION)[number];

export type EntreeEvenementMutation = {
  identifiant: string;
  type: TypeEvenementMutation;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementMutation(
  valeur: string,
): valeur is TypeEvenementMutation {
  return (TYPES_EVENEMENT_MUTATION as readonly string[]).includes(valeur);
}

export function creerEntreeConfigurationHeritee(options: {
  readonly identifiantExperience: string;
  readonly identifiantEnfant: string;
  readonly identifiantParent: string;
  readonly identifiantReproduction: string;
  readonly numeroCycle: number;
  readonly configurationHeritable: Readonly<Record<string, unknown>>;
  readonly empreinteConfiguration: string;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementMutation {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}CONFIGURATION_HERITEE-${options.identifiantReproduction}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_MUTATION,
    type: "CONFIGURATION_HERITEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantEnfant,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      identifiantReproduction: options.identifiantReproduction,
      identifiantParent: options.identifiantParent,
      identifiantEnfant: options.identifiantEnfant,
      configurationHeritable: options.configurationHeritable,
      empreinteConfiguration: options.empreinteConfiguration,
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

export function creerEntreeMutationAppliquee(options: {
  readonly identifiantExperience: string;
  readonly identifiantEnfant: string;
  readonly identifiantParent: string;
  readonly identifiantReproduction: string;
  readonly numeroCycle: number;
  readonly cleGene: string;
  readonly valeurParent: string | number | boolean;
  readonly valeurEnfant: string | number | boolean;
  readonly operateur: string;
  readonly versionMutation: string;
  readonly indice: number;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
}): EntreeEvenementMutation {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}MUTATION_APPLIQUEE-${options.identifiantReproduction}-${options.cleGene}-${String(options.indice)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT_MUTATION,
    type: "MUTATION_APPLIQUEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantEnfant,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      identifiantReproduction: options.identifiantReproduction,
      identifiantParent: options.identifiantParent,
      identifiantEnfant: options.identifiantEnfant,
      cleGene: options.cleGene,
      valeurParent: options.valeurParent,
      valeurEnfant: options.valeurEnfant,
      operateur: options.operateur,
      versionMutation: options.versionMutation,
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}
