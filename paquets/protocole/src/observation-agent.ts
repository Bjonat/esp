import type { MicroUsdc } from "./monnaie.js";

/**
 * Contrat canonique d'observation agent.
 * Contient UNIQUEMENT ce que l'agent est autorisé à connaître.
 * Interdit : tirage futur, résultat caché, secrets, clés, données économiques futures.
 */
export type ObservationAgent = {
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly typeObservation: string;
  /** Charge utile typée par l'environnement — jamais de secret. */
  readonly donnees: Readonly<Record<string, unknown>>;
};

/**
 * Actions autorisées dans l'environnement d'opportunités simulées v0.1.
 */
export type ActionEnvironnementDecision = "attendre" | "agir";

/**
 * Observation d'opportunité — vue agent (pas le tirage).
 * Les montants restent en micro-USDC / bigint côté runtime ;
 * la sérialisation événementielle utilise des chaînes.
 */
export type ObservationOpportunite = {
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly typeObservation: "opportunite_simulee";
  readonly probabiliteSuccesBps: number;
  readonly gainSiSuccesMicroUsdc: MicroUsdc;
  readonly perteSiEchecMicroUsdc: MicroUsdc;
  readonly fraisActionMicroUsdc: MicroUsdc;
  readonly description: string;
  readonly actionsAutorisees: readonly ActionEnvironnementDecision[];
};

export function observationOpportuniteVersObservationAgent(
  observation: ObservationOpportunite,
): ObservationAgent {
  return {
    identifiantObservation: observation.identifiantObservation,
    identifiantAgent: observation.identifiantAgent,
    numeroCycle: observation.numeroCycle,
    typeObservation: observation.typeObservation,
    donnees: {
      probabiliteSuccesBps: observation.probabiliteSuccesBps,
      gainSiSuccesMicroUsdc: observation.gainSiSuccesMicroUsdc.toString(10),
      perteSiEchecMicroUsdc: observation.perteSiEchecMicroUsdc.toString(10),
      fraisActionMicroUsdc: observation.fraisActionMicroUsdc.toString(10),
      description: observation.description,
      actionsAutorisees: [...observation.actionsAutorisees],
    },
  };
}
