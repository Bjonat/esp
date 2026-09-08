/**
 * Identité causale d'une exécution économique agent×cycle.
 * Relie RESULTAT_ACTION (éventuel) → CYCLE_DEMARRE → … → CYCLE_TERMINE.
 */

export function fabriquerIdentifiantExecutionEconomique(options: {
  readonly identifiantExperience: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
}): string {
  return `ecoexec:${options.identifiantExperience}:${options.identifiantAgent}:c${String(options.numeroCycle)}`;
}

export type StatutExecutionEconomique =
  | "absente"
  | "partielle"
  | "terminee";

export type AnalyseExecutionEconomique = {
  readonly identifiantExecutionEconomique: string;
  readonly statut: StatutExecutionEconomique;
  readonly typesPresents: ReadonlySet<string>;
  readonly evenements: readonly {
    readonly type: string;
    readonly identifiant: string;
    readonly chargeUtile: Readonly<Record<string, unknown>>;
  }[];
};

const TYPES_ECONOMIQUES_CYCLE = new Set([
  "CYCLE_DEMARRE",
  "REVENU_ACTIVITE",
  "PERTE_ACTIVITE",
  "DEPENSE_COMPUTE",
  "DEPENSE_DONNEES",
  "FRAIS_EXECUTION",
  "LOYER_INFRASTRUCTURE_DU",
  "LOYER_INFRASTRUCTURE_PAYE",
  "REDEVANCE_PROPRIETAIRE_DUE",
  "REDEVANCE_PROPRIETAIRE_PAYEE",
  "DETTE_CREEE",
  "ETAT_SURVIE_MODIFIE",
  "AGENT_DORMANT",
  "AGENT_MORT",
  "CYCLE_TERMINE",
]);

/**
 * Analyse le statut d'une exécution économique pour un agent/cycle.
 * Compatible legacy : si pas d'identifiant dans la charge, corrélation
 * (agent, cycle) + types économiques.
 */
export function analyserExecutionEconomique(options: {
  readonly evenements: readonly {
    readonly type: string;
    readonly identifiant: string;
    readonly identifiantAgent?: string;
    readonly numeroCycle: number;
    readonly chargeUtile?: Readonly<Record<string, unknown>>;
  }[];
  readonly identifiantExperience: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
}): AnalyseExecutionEconomique {
  const identifiantExecutionEconomique =
    fabriquerIdentifiantExecutionEconomique(options);

  const pertinents = options.evenements.filter((e) => {
    if (e.identifiantAgent !== options.identifiantAgent) {
      return false;
    }
    if (e.numeroCycle !== options.numeroCycle) {
      return false;
    }
    if (!TYPES_ECONOMIQUES_CYCLE.has(e.type)) {
      return false;
    }
    const charge = e.chargeUtile ?? {};
    const idCharge = charge.identifiantExecutionEconomique;
    if (typeof idCharge === "string") {
      return idCharge === identifiantExecutionEconomique;
    }
    // Legacy sans champ : corrélation agent+cycle.
    return true;
  });

  const typesPresents = new Set(pertinents.map((e) => e.type));
  let statut: StatutExecutionEconomique = "absente";
  if (typesPresents.has("CYCLE_TERMINE")) {
    statut = "terminee";
  } else if (pertinents.length > 0) {
    statut = "partielle";
  }

  return {
    identifiantExecutionEconomique,
    statut,
    typesPresents,
    evenements: pertinents.map((e) => ({
      type: e.type,
      identifiant: e.identifiant,
      chargeUtile: e.chargeUtile ?? {},
    })),
  };
}

export function lireIdentifiantExecutionEconomique(
  chargeUtile: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const valeur = chargeUtile?.identifiantExecutionEconomique;
  return typeof valeur === "string" ? valeur : undefined;
}
