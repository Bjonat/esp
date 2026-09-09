/**
 * Événements de planification reproduction économique v0.3.
 * Distincts de REPRODUCTION_AUTONOME_CYCLE_* (historique) pour éviter
 * toute ambiguïté de reprise.
 *
 * v03-C : champs d'observabilité purement descriptifs dans les charges
 * PLANIFIEE / TERMINEE. Ils ne sont jamais des entrées de décision.
 * Les stripper laisse la trajectoire causale v03-B inchangée.
 */

import type { MotifRefusFenetreReproductiveV03 } from "./reproduction-economique-v03.js";

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

/**
 * Snapshot descriptif d'un parent candidat au moment de la planification.
 * `capaciteTheorique` reste une chaîne décimale de `bigint` (jamais float).
 */
export type ObservabiliteParentReproductionEconomiqueV03 = {
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly venMicroUsdc: string;
  readonly reserveMinimaleMicroUsdc: string;
  readonly surplusReproductifMicroUsdc: string;
  readonly coutNaissanceMicroUsdc: string;
  /** Capacité économique brute — bigint sérialisé décimal. */
  readonly capaciteTheorique: string;
  readonly nombreEnfantsParent: number;
  readonly nombreEnfantsRestants: number;
  /** Capacité après garde-fou `nombreMaxEnfantsParAgent` — bigint décimal. */
  readonly capaciteBorneeParEnfants: string;
  readonly fenetre:
    | { readonly ouverte: true }
    | {
        readonly ouverte: false;
        readonly motif: MotifRefusFenetreReproductiveV03;
      };
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
  /**
   * Observabilité v03-C — descriptive uniquement.
   * Inclut les parents à fenêtre fermée (capacité contrefactuelle locale).
   */
  readonly observabiliteParents?: readonly ObservabiliteParentReproductionEconomiqueV03[];
};

/**
 * Motifs d'arrêt d'une fenêtre parent après consommation du plan.
 * Pas de `fitness_insuffisante`.
 */
export type MotifArretFenetreReproductionEconomiqueV03 =
  | "capacite_planifiee_epuisee"
  | "capital_insuffisant"
  | "reserve_minimale"
  | "nombre_enfants_max"
  | "population_maximale"
  | "reproductions_cycle_max"
  | "agent_mort";

export type ArretFenetreParentReproductionEconomiqueV03 = {
  readonly identifiantParent: string;
  readonly motifArret: MotifArretFenetreReproductionEconomiqueV03;
};

export type ChargeReproductionEconomiqueV03CycleTerminee = {
  readonly versionMecanisme: "reproduction-economique-v03";
  readonly numeroCycle: number;
  readonly naissancesEffectuees: number;
  readonly tentativesPlanifiees: number;
  readonly tentativesExecutees: number;
  /** v03-C — places planifiées non utilisées (= planifiées − naissances). */
  readonly placesPlanifieesNonUtilisees?: number;
  /** v03-C — motif d'arrêt par parent ayant eu au moins une tentative. */
  readonly arretsFenetreParParent?: readonly ArretFenetreParentReproductionEconomiqueV03[];
  /** v03-C — refus unitaires réellement évalués (hors propagation). */
  readonly refusEvaluesParMotif?: Readonly<Record<string, number>>;
  /** v03-C — refus clôturés par propagation monotone. */
  readonly refusPropagationParMotif?: Readonly<Record<string, number>>;
};

/**
 * Charge d'observation attachée à DEMANDEE / AUTORISEE / REFUSEE (v03 path).
 * Corrélée par `identifiantReproduction`. Jamais une entrée décisionnelle.
 */
export type ObservabiliteTentativeReproductionEconomiqueV03 = {
  readonly versionObservabilite: "observabilite-reproduction-economique-v03";
  readonly numeroCycle: number;
  readonly identifiantParent: string;
  readonly indexTentativeParent: number;
  readonly indexGlobal: number;
  readonly identifiantEnfant: string;
  readonly identifiantReproduction: string;
  readonly capitalLiquideAvantMicroUsdc: string;
  readonly venAvantMicroUsdc: string;
  readonly nombreEnfantsCourant: number;
  readonly populationCourante: number;
  readonly reproductionsDejaRealiseesCycle: number;
  readonly coutNaissanceMicroUsdc: string;
  /**
   * `evaluee` : autorisation économique réellement calculée.
   * `propagation_monotone` : clôture des tentatives restantes du même parent.
   */
  readonly modeEvaluation: "evaluee" | "propagation_monotone";
  readonly autorisation:
    | {
        readonly autorisee: true;
        readonly venApresProjeteeMicroUsdc: string;
        readonly capitalLiquideApresProjeteMicroUsdc: string;
      }
    | {
        readonly autorisee: false;
        readonly motif: string;
      };
  readonly resultatFinal: "naissance_realisee" | "refusee";
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

/** Clés de charge purement descriptives v03-C (stripables). */
export const CLES_OBSERVABILITE_CHARGE_V03 = [
  "observabiliteParents",
  "placesPlanifieesNonUtilisees",
  "arretsFenetreParParent",
  "refusEvaluesParMotif",
  "refusPropagationParMotif",
  "observabiliteTentativeV03",
] as const;

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
      ...(options.charge.observabiliteParents !== undefined
        ? {
            observabiliteParents: options.charge.observabiliteParents.map(
              (o) => ({
                ...o,
                fenetre: { ...o.fenetre },
              }),
            ),
          }
        : {}),
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
      ...(options.charge.placesPlanifieesNonUtilisees !== undefined
        ? {
            placesPlanifieesNonUtilisees:
              options.charge.placesPlanifieesNonUtilisees,
          }
        : {}),
      ...(options.charge.arretsFenetreParParent !== undefined
        ? {
            arretsFenetreParParent: options.charge.arretsFenetreParParent.map(
              (a) => ({ ...a }),
            ),
          }
        : {}),
      ...(options.charge.refusEvaluesParMotif !== undefined
        ? {
            refusEvaluesParMotif: {
              ...options.charge.refusEvaluesParMotif,
            },
          }
        : {}),
      ...(options.charge.refusPropagationParMotif !== undefined
        ? {
            refusPropagationParMotif: {
              ...options.charge.refusPropagationParMotif,
            },
          }
        : {}),
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}
