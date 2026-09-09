/**
 * Sélection explicite du mécanisme de reproduction autonome.
 * Défaut historique : `reproduction-autonome-v01` (comportement v0.1/v0.2).
 * Opt-in : `reproduction-economique-v03`.
 */

export const MECANISME_REPRODUCTION_AUTONOME_V01 =
  "reproduction-autonome-v01" as const;
export const MECANISME_REPRODUCTION_ECONOMIQUE_V03 =
  "reproduction-economique-v03" as const;

export const MECANISMES_REPRODUCTION_AUTONOME = [
  MECANISME_REPRODUCTION_AUTONOME_V01,
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
] as const;

export type MecanismeReproductionAutonome =
  (typeof MECANISMES_REPRODUCTION_AUTONOME)[number];

export const MECANISME_REPRODUCTION_AUTONOME_DEFAUT =
  MECANISME_REPRODUCTION_AUTONOME_V01;

export function estMecanismeReproductionAutonome(
  valeur: string,
): valeur is MecanismeReproductionAutonome {
  return (MECANISMES_REPRODUCTION_AUTONOME as readonly string[]).includes(
    valeur,
  );
}
