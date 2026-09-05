import type { EtatSurvie } from "./etat-survie.js";

/**
 * Agent ESP minimal — identité et survie uniquement.
 * Pas de portefeuille, pas de clés, pas de comportement à ce stade.
 */
export interface Agent {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent?: string;
  readonly etatSurvie: EtatSurvie;
  /** Horodatage ISO 8601 de la naissance. */
  readonly dateNaissance: string;
}

export type EntreeCreationAgent = {
  identifiant: string;
  generation: number;
  identifiantParent?: string;
  etatSurvie?: EtatSurvie;
  dateNaissance: string;
};

/**
 * Crée un agent minimal avec l'état de survie `sain` par défaut.
 */
export function creerAgent(entree: EntreeCreationAgent): Agent {
  const agent: Agent = {
    identifiant: entree.identifiant,
    generation: entree.generation,
    etatSurvie: entree.etatSurvie ?? "sain",
    dateNaissance: entree.dateNaissance,
  };

  if (entree.identifiantParent !== undefined) {
    return { ...agent, identifiantParent: entree.identifiantParent };
  }

  return agent;
}
