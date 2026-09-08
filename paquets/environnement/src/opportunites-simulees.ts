import type {
  ActionEnvironnementDecision,
  MicroUsdc,
  ObservationOpportunite,
  ResultatActiviteCycle,
} from "@esp/protocole";
import type { EnvironnementEconomique, StatutEnvironnement } from "./environnement.js";

/**
 * ============================================================================
 * ENVIRONNEMENT D'OPPORTUNITÉS SIMULÉES v0.1
 * ============================================================================
 * Hors @esp/protocole. Déterministe, auditable, sans trading réel.
 * Ne modifie JAMAIS le capital — retourne un résultat pour le noyau.
 */

export const IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES =
  "environnement-opportunites-simulees" as const;
export const VERSION_ENVIRONNEMENT_OPPORTUNITES_SIMULEES = "0.1.0" as const;

export type ConfigurationEnvironnementOpportunites = {
  readonly identifiant: typeof IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES;
  readonly version: string;
  /** Probabilité de succès de base en points de base (0–10_000). */
  readonly probabiliteSuccesBaseBps: number;
  /** Amplitude de variation déterministe de la proba (bps). */
  readonly amplitudeProbabiliteBps: number;
  readonly gainSiSuccesMicroUsdc: MicroUsdc;
  readonly perteSiEchecMicroUsdc: MicroUsdc;
  readonly fraisActionMicroUsdc: MicroUsdc;
  /**
   * Frais éventuels de l'action attendre — défaut 0 (aucun coût caché).
   * VALEUR DE DÉMONSTRATION si non nulle.
   */
  readonly fraisAttendreMicroUsdc: MicroUsdc;
};

export type ConfigurationEnvironnementOpportunitesJson = {
  readonly identifiant: typeof IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES;
  readonly version: string;
  readonly probabiliteSuccesBaseBps: number;
  readonly amplitudeProbabiliteBps: number;
  readonly gainSiSuccesMicroUsdc: string;
  readonly perteSiEchecMicroUsdc: string;
  readonly fraisActionMicroUsdc: string;
  readonly fraisAttendreMicroUsdc?: string;
};

export type IssueActionEnvironnement = "succes" | "echec" | "aucune";

export type ResultatActionEnvironnement = {
  readonly identifiantAction: string;
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly action: ActionEnvironnementDecision;
  readonly issue: IssueActionEnvironnement;
  /** Tirage en bps — JAMAIS exposé à l'agent avant action. */
  readonly tirageBps: number | null;
  readonly activite: ResultatActiviteCycle;
};

/**
 * Générateur pseudo-aléatoire déterministe (Mulberry32).
 * Aucun Math.random non seedé.
 */
function creerGenerateurEntier(graine: number): () => number {
  let etat = graine >>> 0;
  return (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function hacherChaine(texte: string): number {
  let hachage = 2166136261;
  for (let index = 0; index < texte.length; index += 1) {
    hachage ^= texte.charCodeAt(index);
    hachage = Math.imul(hachage, 16777619);
  }
  return hachage >>> 0;
}

function melangerGraine(...parties: readonly (string | number)[]): number {
  let hachage = 0x811c9dc5;
  for (const partie of parties) {
    const texte = typeof partie === "number" ? String(partie) : partie;
    hachage ^= hacherChaine(texte);
    hachage = Math.imul(hachage, 0x01000193) >>> 0;
  }
  return hachage >>> 0;
}

function bornerBps(valeur: number): number {
  if (valeur < 0) {
    return 0;
  }
  if (valeur > 10_000) {
    return 10_000;
  }
  return valeur;
}

export class EnvironnementOpportunitesSimulees implements EnvironnementEconomique {
  readonly nom = IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES;
  readonly mode = "replay" as const;
  readonly transactionsReellesAutorisees = false;

  constructor(
    readonly configuration: ConfigurationEnvironnementOpportunites,
    readonly graineExperience: number,
  ) {}

  statut(): StatutEnvironnement {
    return {
      demarre: true,
      description:
        "Environnement d'opportunités simulées — déterministe, sans trading réel",
    };
  }

  /**
   * Produit une observation d'opportunité pour un agent vivant et un cycle.
   * Ne révèle jamais le tirage futur.
   */
  produireObservation(options: {
    readonly identifiantAgent: string;
    readonly numeroCycle: number;
  }): ObservationOpportunite {
    const identifiantObservation = `${options.identifiantAgent}-obs-c${String(options.numeroCycle)}`;
    const graine = melangerGraine(
      this.graineExperience,
      options.identifiantAgent,
      options.numeroCycle,
      identifiantObservation,
      "observation",
    );
    const generer = creerGenerateurEntier(graine);
    const delta =
      (generer() % (this.configuration.amplitudeProbabiliteBps * 2 + 1)) -
      this.configuration.amplitudeProbabiliteBps;
    const probabiliteSuccesBps = bornerBps(
      this.configuration.probabiliteSuccesBaseBps + delta,
    );

    return {
      identifiantObservation,
      identifiantAgent: options.identifiantAgent,
      numeroCycle: options.numeroCycle,
      typeObservation: "opportunite_simulee",
      probabiliteSuccesBps,
      gainSiSuccesMicroUsdc: this.configuration.gainSiSuccesMicroUsdc,
      perteSiEchecMicroUsdc: this.configuration.perteSiEchecMicroUsdc,
      fraisActionMicroUsdc: this.configuration.fraisActionMicroUsdc,
      description: `Opportunité simulée cycle ${String(options.numeroCycle)} — p=${String(probabiliteSuccesBps)} bps`,
      actionsAutorisees: ["attendre", "agir"],
    };
  }

  /**
   * Exécute une action validée. Le tirage est déterministe :
   * graine + agent + cycle + opportunité.
   */
  executerAction(options: {
    readonly observation: ObservationOpportunite;
    readonly action: ActionEnvironnementDecision;
    readonly identifiantDecision: string;
  }): ResultatActionEnvironnement {
    const identifiantAction = `${options.observation.identifiantAgent}-act-c${String(options.observation.numeroCycle)}`;

    if (options.action === "attendre") {
      const frais = this.configuration.fraisAttendreMicroUsdc;
      return {
        identifiantAction,
        identifiantObservation: options.observation.identifiantObservation,
        identifiantAgent: options.observation.identifiantAgent,
        numeroCycle: options.observation.numeroCycle,
        action: "attendre",
        issue: "aucune",
        tirageBps: null,
        activite: {
          revenuActivite: 0n,
          perteActivite: 0n,
          depenseCompute: 0n,
          depenseDonnees: 0n,
          fraisExecution: frais,
        },
      };
    }

    const graine = melangerGraine(
      this.graineExperience,
      options.observation.identifiantAgent,
      options.observation.numeroCycle,
      options.observation.identifiantObservation,
      "tirage",
    );
    const generer = creerGenerateurEntier(graine);
    const tirageBps = generer() % 10_001;
    const succes = tirageBps < options.observation.probabiliteSuccesBps;
    const frais = options.observation.fraisActionMicroUsdc;

    if (succes) {
      return {
        identifiantAction,
        identifiantObservation: options.observation.identifiantObservation,
        identifiantAgent: options.observation.identifiantAgent,
        numeroCycle: options.observation.numeroCycle,
        action: "agir",
        issue: "succes",
        tirageBps,
        activite: {
          revenuActivite: options.observation.gainSiSuccesMicroUsdc,
          perteActivite: 0n,
          depenseCompute: 0n,
          depenseDonnees: 0n,
          fraisExecution: frais,
        },
      };
    }

    return {
      identifiantAction,
      identifiantObservation: options.observation.identifiantObservation,
      identifiantAgent: options.observation.identifiantAgent,
      numeroCycle: options.observation.numeroCycle,
      action: "agir",
      issue: "echec",
      tirageBps,
      activite: {
        revenuActivite: 0n,
        perteActivite: options.observation.perteSiEchecMicroUsdc,
        depenseCompute: 0n,
        depenseDonnees: 0n,
        fraisExecution: frais,
      },
    };
  }
}

export function parserConfigurationEnvironnementOpportunites(
  brut: ConfigurationEnvironnementOpportunitesJson,
): ConfigurationEnvironnementOpportunites {
  if (brut.identifiant !== IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES) {
    throw new Error(`Environnement inconnu : ${brut.identifiant}`);
  }
  assertBps(brut.probabiliteSuccesBaseBps, "probabiliteSuccesBaseBps");
  if (
    !Number.isInteger(brut.amplitudeProbabiliteBps) ||
    brut.amplitudeProbabiliteBps < 0
  ) {
    throw new Error("amplitudeProbabiliteBps invalide");
  }
  return {
    identifiant: brut.identifiant,
    version: brut.version,
    probabiliteSuccesBaseBps: brut.probabiliteSuccesBaseBps,
    amplitudeProbabiliteBps: brut.amplitudeProbabiliteBps,
    gainSiSuccesMicroUsdc: parserMontant(brut.gainSiSuccesMicroUsdc),
    perteSiEchecMicroUsdc: parserMontant(brut.perteSiEchecMicroUsdc),
    fraisActionMicroUsdc: parserMontant(brut.fraisActionMicroUsdc),
    fraisAttendreMicroUsdc: parserMontant(brut.fraisAttendreMicroUsdc ?? "0"),
  };
}

export function serialiserConfigurationEnvironnementOpportunites(
  configuration: ConfigurationEnvironnementOpportunites,
): ConfigurationEnvironnementOpportunitesJson {
  return {
    identifiant: configuration.identifiant,
    version: configuration.version,
    probabiliteSuccesBaseBps: configuration.probabiliteSuccesBaseBps,
    amplitudeProbabiliteBps: configuration.amplitudeProbabiliteBps,
    gainSiSuccesMicroUsdc: configuration.gainSiSuccesMicroUsdc.toString(10),
    perteSiEchecMicroUsdc: configuration.perteSiEchecMicroUsdc.toString(10),
    fraisActionMicroUsdc: configuration.fraisActionMicroUsdc.toString(10),
    fraisAttendreMicroUsdc: configuration.fraisAttendreMicroUsdc.toString(10),
  };
}

export function creerEnvironnementOpportunitesSimulees(
  configuration: ConfigurationEnvironnementOpportunites,
  graineExperience: number,
): EnvironnementOpportunitesSimulees {
  return new EnvironnementOpportunitesSimulees(configuration, graineExperience);
}

function parserMontant(texte: string): MicroUsdc {
  if (!/^-?\d+$/.test(texte)) {
    throw new Error(`Montant micro-USDC invalide : ${texte}`);
  }
  const valeur = BigInt(texte);
  if (valeur < 0n) {
    throw new Error("Montant micro-USDC négatif interdit");
  }
  return valeur;
}

function assertBps(valeur: number, nom: string): void {
  if (!Number.isInteger(valeur) || valeur < 0 || valeur > 10_000) {
    throw new Error(`${nom} doit être un entier 0–10000`);
  }
}
