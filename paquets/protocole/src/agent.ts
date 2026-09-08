import type { EtatSurvie } from "./etat-survie.js";

/**
 * Agent ESP minimal — identité et survie uniquement.
 * Pas de portefeuille, pas de clés, pas de comportement à ce stade.
 */
export interface Agent {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent?: string;
  /** Fondateur Genesis de la lignée (stable). Absent uniquement legacy. */
  readonly identifiantLignee?: string;
  readonly etatSurvie: EtatSurvie;
  /** Horodatage ISO 8601 de la naissance. */
  readonly dateNaissance: string;
}

export type EntreeCreationAgent = {
  identifiant: string;
  generation: number;
  identifiantParent?: string;
  identifiantLignee?: string;
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

  let resultat = agent;
  if (entree.identifiantParent !== undefined) {
    resultat = { ...resultat, identifiantParent: entree.identifiantParent };
  }
  if (entree.identifiantLignee !== undefined) {
    resultat = { ...resultat, identifiantLignee: entree.identifiantLignee };
  }
  return resultat;
}
