/**
 * Hypothèses H1–H4 du protocole évolution v0.3 — déclarations uniquement.
 * Aucun verdict automatique. Aucun score. D > C global ≠ H4.
 */

export const VERSION_HYPOTHESES_EVOLUTION_V03 =
  "hypotheses-evolution-v03" as const;

export type IdentifiantHypotheseEvolutionV03 = "H1" | "H2" | "H3" | "H4";

export type DeclarationHypotheseEvolutionV03 = {
  readonly identifiant: IdentifiantHypotheseEvolutionV03;
  readonly enonce: string;
  readonly comparaisonPrincipale: string;
  readonly noteMethodologique: string;
};

/**
 * Hypothèses visées par la campagne v0.3.
 * v03-D documente ; v03-G/H pré-enregistrent et évaluent.
 */
export const HYPOTHESES_EVOLUTION_V03: readonly DeclarationHypotheseEvolutionV03[] =
  [
    {
      identifiant: "H1",
      enonce:
        "Le mécanisme de reproduction économique permet une reproduction différentielle multi-générationnelle.",
      comparaisonPrincipale: "B - A",
      noteMethodologique:
        "Indicateurs descriptifs : naissances, génération maximale, population vivante, descendance. Aucun score fitness.",
    },
    {
      identifiant: "H2",
      enonce:
        "Les mutations héritées sont causalement exprimées dans les décisions et conséquences économiques.",
      comparaisonPrincipale: "D - C",
      noteMethodologique:
        "La seule présence de mutations ne suffit pas ; l'évidence inclut expression cognitive / comportementale.",
    },
    {
      identifiant: "H3",
      enonce:
        "Les mutations produisent une dynamique persistante de fréquences génotypiques.",
      comparaisonPrincipale: "D (descriptif)",
      noteMethodologique:
        "Une hausse de fréquence seule n'est pas une preuve d'adaptation.",
    },
    {
      identifiant: "H4",
      enonce:
        "Un signal adaptatif nécessite la chaîne : mutation héritée → expression phénotypique → avantage économique hors reproduction → avantage en enfants directs → augmentation de représentation → réplication indépendante.",
      comparaisonPrincipale: "paires contrefactuelles C/D (pas D > C global)",
      noteMethodologique:
        "D > C global n'est ni nécessaire ni suffisant pour H4. Aucun verdict automatique dans v03-D.",
    },
  ] as const;

/** Avertissement figé — à reproduire dans les rapports de campagne. */
export const AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C =
  "D > C global n'est ni nécessaire ni suffisant pour H4. La campagne conserve les données individuelles permettant plus tard des comparaisons C/D appariées." as const;

export type AvertissementH4EvolutionV03 =
  typeof AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C;

export const COMPARAISON_PRIMAIRE_V03 = "D - C" as const;
export const COMPARAISONS_SECONDAIRES_V03 = [
  "B - A",
  "C - B",
  "D - B",
] as const;
