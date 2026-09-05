import type {
  EnvironnementEconomique,
  StatutEnvironnement,
} from "@esp/environnement";

/**
 * Adaptateur Replay — rejoue une expérience sans effet de bord externe.
 * Aucune donnée de marché réelle à ce stade.
 */
export function creerAdaptateurReplay(): EnvironnementEconomique {
  return {
    nom: "replay",
    mode: "replay",
    transactionsReellesAutorisees: false,
    statut(): StatutEnvironnement {
      return {
        demarre: false,
        description: "Adaptateur replay prêt, non démarré",
      };
    },
  };
}
