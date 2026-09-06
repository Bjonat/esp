import type { ParametresEconomiquesExperience } from "./parametres-economiques.js";
import { validerParametresEconomiques } from "./parametres-economiques.js";
import { parserMicroUsdc, serialiserMicroUsdc, type MicroUsdc } from "./monnaie.js";
import { VERSION_SCHEMA_EVENEMENT } from "./evenements-economiques.js";

/**
 * Taxonomie d'événements de contrôle d'expérience — distincte du noyau économique.
 * Matérialise l'existence, le statut et l'orchestration sans créer de valeur.
 */
export const TYPES_EVENEMENT_EXPERIENCE = [
  "EXPERIENCE_CREEE",
  "EXPERIENCE_DEMARREE",
  "EXPERIENCE_MISE_EN_PAUSE",
  "EXPERIENCE_REPRISE",
  "EXPERIENCE_TERMINEE",
  "CYCLE_EXPERIENCE_AVANCE",
] as const;

export type TypeEvenementExperience =
  (typeof TYPES_EVENEMENT_EXPERIENCE)[number];

export type ModeExperienceProtocole = "simulation";

export type StatutExperienceProtocole =
  | "configuree"
  | "prete"
  | "en_cours"
  | "en_pause"
  | "terminee";

/** Identification figée du simulateur de développement au moment de la création. */
export type SnapshotSimulateurExperience = {
  readonly identifiant: string;
  readonly version: string;
};

/**
 * Snapshot exact figé à la création — source de vérité historique de l'expérience.
 * Le fichier JSON de configuration n'est qu'une entrée pour CRÉER, pas la vérité après coup.
 */
export type SnapshotCreationExperience = {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly mode: ModeExperienceProtocole;
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: MicroUsdc;
  readonly parametresEconomiques: ParametresEconomiquesExperience;
  readonly simulateur: SnapshotSimulateurExperience;
  readonly dateCreation: string;
};

export type ChargeExperienceCreee = {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly mode: ModeExperienceProtocole;
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly parametresEconomiques: {
    readonly version: string;
    readonly loyerInfrastructureMicroUsdc: string;
    readonly periodeLoyerEnCycles: number;
    readonly tauxRedevanceProprietairePointsDeBase: string;
    readonly coutOperationnelMinimalParCycleMicroUsdc: string;
    readonly seuilRunwaySainEnCycles: number;
    readonly seuilRunwayContraintEnCycles: number;
    readonly cyclesDormanceAvantMort: number;
  };
  readonly simulateur: SnapshotSimulateurExperience;
  readonly dateCreation: string;
};

export type ChargeCycleExperienceAvance = {
  readonly numeroCycle: number;
};

export type EntreeEvenementExperience = {
  identifiant: string;
  type: TypeEvenementExperience;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementExperience(
  valeur: string,
): valeur is TypeEvenementExperience {
  return (TYPES_EVENEMENT_EXPERIENCE as readonly string[]).includes(valeur);
}

export function serialiserSnapshotCreationExperience(
  snapshot: SnapshotCreationExperience,
): ChargeExperienceCreee {
  const p = snapshot.parametresEconomiques;
  return {
    identifiantExperience: snapshot.identifiantExperience,
    versionProtocole: snapshot.versionProtocole,
    mode: snapshot.mode,
    graineSimulation: snapshot.graineSimulation,
    taillePopulationInitiale: snapshot.taillePopulationInitiale,
    capitalInitialParAgentMicroUsdc: serialiserMicroUsdc(
      snapshot.capitalInitialParAgentMicroUsdc,
    ),
    parametresEconomiques: {
      version: p.version,
      loyerInfrastructureMicroUsdc: serialiserMicroUsdc(
        p.loyerInfrastructureMicroUsdc,
      ),
      periodeLoyerEnCycles: p.periodeLoyerEnCycles,
      tauxRedevanceProprietairePointsDeBase: serialiserMicroUsdc(
        p.tauxRedevanceProprietairePointsDeBase,
      ),
      coutOperationnelMinimalParCycleMicroUsdc: serialiserMicroUsdc(
        p.coutOperationnelMinimalParCycleMicroUsdc,
      ),
      seuilRunwaySainEnCycles: p.seuilRunwaySainEnCycles,
      seuilRunwayContraintEnCycles: p.seuilRunwayContraintEnCycles,
      cyclesDormanceAvantMort: p.cyclesDormanceAvantMort,
    },
    simulateur: snapshot.simulateur,
    dateCreation: snapshot.dateCreation,
  };
}

export function parserSnapshotCreationExperience(
  chargeUtile: Readonly<Record<string, unknown>>,
): SnapshotCreationExperience {
  const parametresBruts = chargeUtile.parametresEconomiques;
  if (parametresBruts === null || typeof parametresBruts !== "object") {
    throw new Error("EXPERIENCE_CREEE : parametresEconomiques manquants");
  }
  const p = parametresBruts as Record<string, unknown>;
  const simulateurBrut = chargeUtile.simulateur;
  if (simulateurBrut === null || typeof simulateurBrut !== "object") {
    throw new Error("EXPERIENCE_CREEE : simulateur manquant");
  }
  const simulateur = simulateurBrut as Record<string, unknown>;

  assertChaine(chargeUtile.identifiantExperience, "identifiantExperience");
  assertChaine(chargeUtile.versionProtocole, "versionProtocole");
  if (chargeUtile.mode !== "simulation") {
    throw new Error("EXPERIENCE_CREEE : mode invalide");
  }
  if (typeof chargeUtile.graineSimulation !== "number") {
    throw new Error("EXPERIENCE_CREEE : graineSimulation invalide");
  }
  if (typeof chargeUtile.taillePopulationInitiale !== "number") {
    throw new Error("EXPERIENCE_CREEE : taillePopulationInitiale invalide");
  }
  assertChaine(
    chargeUtile.capitalInitialParAgentMicroUsdc,
    "capitalInitialParAgentMicroUsdc",
  );
  assertChaine(chargeUtile.dateCreation, "dateCreation");
  assertChaine(p.version, "parametresEconomiques.version");
  assertChaine(p.loyerInfrastructureMicroUsdc, "loyerInfrastructureMicroUsdc");
  assertChaine(
    p.tauxRedevanceProprietairePointsDeBase,
    "tauxRedevanceProprietairePointsDeBase",
  );
  assertChaine(
    p.coutOperationnelMinimalParCycleMicroUsdc,
    "coutOperationnelMinimalParCycleMicroUsdc",
  );
  assertChaine(simulateur.identifiant, "simulateur.identifiant");
  assertChaine(simulateur.version, "simulateur.version");

  const parametresEconomiques: ParametresEconomiquesExperience = {
    version: p.version,
    loyerInfrastructureMicroUsdc: parserMicroUsdc(
      p.loyerInfrastructureMicroUsdc,
    ),
    periodeLoyerEnCycles: assertEntier(p.periodeLoyerEnCycles, "periodeLoyer"),
    tauxRedevanceProprietairePointsDeBase: parserMicroUsdc(
      p.tauxRedevanceProprietairePointsDeBase,
    ),
    coutOperationnelMinimalParCycleMicroUsdc: parserMicroUsdc(
      p.coutOperationnelMinimalParCycleMicroUsdc,
    ),
    seuilRunwaySainEnCycles: assertEntier(
      p.seuilRunwaySainEnCycles,
      "seuilRunwaySain",
    ),
    seuilRunwayContraintEnCycles: assertEntier(
      p.seuilRunwayContraintEnCycles,
      "seuilRunwayContraint",
    ),
    cyclesDormanceAvantMort: assertEntier(
      p.cyclesDormanceAvantMort,
      "cyclesDormance",
    ),
  };
  validerParametresEconomiques(parametresEconomiques);

  return {
    identifiantExperience: chargeUtile.identifiantExperience,
    versionProtocole: chargeUtile.versionProtocole,
    mode: "simulation",
    graineSimulation: chargeUtile.graineSimulation,
    taillePopulationInitiale: chargeUtile.taillePopulationInitiale,
    capitalInitialParAgentMicroUsdc: parserMicroUsdc(
      chargeUtile.capitalInitialParAgentMicroUsdc,
    ),
    parametresEconomiques,
    simulateur: {
      identifiant: simulateur.identifiant,
      version: simulateur.version,
    },
    dateCreation: chargeUtile.dateCreation,
  };
}

export function creerEntreeExperienceCreee(options: {
  snapshot: SnapshotCreationExperience;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
}): EntreeEvenementExperience {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}EXPERIENCE_CREEE-${options.snapshot.identifiantExperience}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "EXPERIENCE_CREEE",
    identifiantExperience: options.snapshot.identifiantExperience,
    numeroCycle: 0,
    chargeUtile: serialiserSnapshotCreationExperience(options.snapshot),
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : { dateEnregistrement: options.snapshot.dateCreation }),
  };
}

export function creerEntreeControleExperience(options: {
  type: Exclude<TypeEvenementExperience, "EXPERIENCE_CREEE" | "CYCLE_EXPERIENCE_AVANCE">;
  identifiantExperience: string;
  numeroCycle: number;
  /** Indice d'unicité (ex. prochaine séquence registre) — requis pour reprise après redémarrage. */
  indiceUnicite: number;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
}): EntreeEvenementExperience {
  const prefixe = options.prefixeIdentifiant ?? "";
  return {
    identifiant: `${prefixe}${options.type}-${options.identifiantExperience}-c${String(options.numeroCycle)}-u${String(options.indiceUnicite)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: options.type,
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: {},
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

/**
 * Matérialise l'orchestration d'un cycle.
 * Ne constitue pas une comptabilité parallèle : numeroCycleCourant =
 * max(numeroCycle) sur l'ensemble du registre (y compris économiques).
 */
export function creerEntreeCycleExperienceAvance(options: {
  identifiantExperience: string;
  numeroCycle: number;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
}): EntreeEvenementExperience {
  const prefixe = options.prefixeIdentifiant ?? "";
  const charge: ChargeCycleExperienceAvance = {
    numeroCycle: options.numeroCycle,
  };
  return {
    identifiant: `${prefixe}CYCLE_EXPERIENCE_AVANCE-${options.identifiantExperience}-${String(options.numeroCycle)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "CYCLE_EXPERIENCE_AVANCE",
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    chargeUtile: charge,
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

/**
 * Reconstruit le statut expérimental exclusivement depuis les événements de contrôle.
 */
export function reconstruireStatutExperience(
  evenements: readonly { type: string }[],
): StatutExperienceProtocole {
  let statut: StatutExperienceProtocole = "configuree";
  for (const evenement of evenements) {
    switch (evenement.type) {
      case "EXPERIENCE_CREEE":
        statut = "prete";
        break;
      case "EXPERIENCE_DEMARREE":
      case "EXPERIENCE_REPRISE":
        statut = "en_cours";
        break;
      case "EXPERIENCE_MISE_EN_PAUSE":
        statut = "en_pause";
        break;
      case "EXPERIENCE_TERMINEE":
        statut = "terminee";
        break;
      case "CYCLE_EXPERIENCE_AVANCE":
        if (statut !== "terminee") {
          statut = "en_cours";
        }
        break;
      default:
        break;
    }
  }
  return statut;
}

function assertChaine(valeur: unknown, nom: string): asserts valeur is string {
  if (typeof valeur !== "string" || valeur.trim() === "") {
    throw new Error(`EXPERIENCE_CREEE : ${nom} invalide`);
  }
}

function assertEntier(valeur: unknown, nom: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    throw new Error(`EXPERIENCE_CREEE : ${nom} invalide`);
  }
  return valeur;
}
