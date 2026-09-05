import type {
  EnvironnementEconomique,
  StatutEnvironnement,
} from "@esp/environnement";

/**
 * Adaptateur Solana — frontière future pour SOL/USDC.
 *
 * Aucune dépendance blockchain, aucune clé, aucune transaction réelle.
 * Les transactions réelles restent explicitement interdites.
 */
export function creerAdaptateurSolana(): EnvironnementEconomique {
  return {
    nom: "solana",
    mode: "shadow",
    transactionsReellesAutorisees: false,
    statut(): StatutEnvironnement {
      return {
        demarre: false,
        description: "Adaptateur Solana déclaré, aucune connexion réseau",
      };
    },
  };
}
