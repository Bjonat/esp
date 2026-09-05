import type { Agent } from "@esp/protocole";

/**
 * Contrat minimal du moteur agent.
 * Boucle, mémoire, comportement et outils viendront plus tard.
 */
export interface MoteurAgent {
  /** Identité de l'agent géré par ce moteur. */
  readonly agent: Agent;
}

/**
 * Crée un moteur agent minimal autour d'un agent déjà défini.
 */
export function creerMoteurAgent(agent: Agent): MoteurAgent {
  return { agent };
}
