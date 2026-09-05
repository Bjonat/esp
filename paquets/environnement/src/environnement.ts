/**
 * Modes d'exécution de l'environnement économique.
 * Replay, Shadow et Live doivent rester strictement séparés.
 */
export type ModeEnvironnement = "replay" | "shadow" | "live";

/**
 * Abstraction remplaçable de l'environnement économique.
 * Le cœur ESP ne connaît pas Solana ni aucun marché particulier.
 */
export interface EnvironnementEconomique {
  readonly nom: string;
  readonly mode: ModeEnvironnement;
  /** Indique si des transactions réelles sont possibles. Toujours faux pour l'instant. */
  readonly transactionsReellesAutorisees: boolean;
  statut(): StatutEnvironnement;
}

export interface StatutEnvironnement {
  readonly demarre: boolean;
  readonly description: string;
}

/**
 * Environnement inactif de fondation — aucune activité économique.
 */
export function creerEnvironnementInactif(): EnvironnementEconomique {
  return {
    nom: "inactif",
    mode: "replay",
    transactionsReellesAutorisees: false,
    statut() {
      return {
        demarre: false,
        description: "Non démarré",
      };
    },
  };
}
