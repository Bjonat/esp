/**
 * Statistiques descriptives pour agrégats expérimentaux.
 *
 * Convention quartile (documentée, figée v0.1) :
 * - tableau trié de longueur n ≥ 1 ;
 * - Q1 = valeur à l'indice floor((n − 1) × 0,25) ;
 * - médiane : indice floor((n − 1) × 0,5) ;
 *   pour number[] de longueur paire : moyenne arithmétique des deux milieux ;
 *   pour bigint[] de longueur paire : médiane basse (élément inférieur des deux milieux) ;
 * - Q3 = valeur à l'indice floor((n − 1) × 0,75).
 *
 * Pas de p-values en v0.1.
 */

export type ResumeStatistiqueNombre = {
  readonly n: number;
  readonly mediane: number | null;
  readonly q1: number | null;
  readonly q3: number | null;
  readonly min: number | null;
  readonly max: number | null;
};

export type ResumeStatistiqueBigint = {
  readonly n: number;
  readonly mediane: bigint | null;
  readonly q1: bigint | null;
  readonly q3: bigint | null;
  readonly min: bigint | null;
  readonly max: bigint | null;
};

function indiceQuartile(n: number, fraction: number): number {
  return Math.floor((n - 1) * fraction);
}

export function medianeNombres(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => a - b);
  const n = tri.length;
  if (n % 2 === 1) {
    return tri[indiceQuartile(n, 0.5)]!;
  }
  const bas = tri[n / 2 - 1]!;
  const haut = tri[n / 2]!;
  return (bas + haut) / 2;
}

/** Médiane basse pour bigint lorsque n est pair. */
export function medianeBigints(valeurs: readonly bigint[]): bigint | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const n = tri.length;
  return tri[indiceQuartile(n, 0.5)]!;
}

export function quartile1Nombres(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[indiceQuartile(tri.length, 0.25)]!;
}

export function quartile3Nombres(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[indiceQuartile(tri.length, 0.75)]!;
}

export function quartile1Bigints(valeurs: readonly bigint[]): bigint | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return tri[indiceQuartile(tri.length, 0.25)]!;
}

export function quartile3Bigints(valeurs: readonly bigint[]): bigint | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tri = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return tri[indiceQuartile(tri.length, 0.75)]!;
}

export function resumeStatistiqueNombres(
  valeurs: readonly number[],
): ResumeStatistiqueNombre {
  if (valeurs.length === 0) {
    return { n: 0, mediane: null, q1: null, q3: null, min: null, max: null };
  }
  const tri = [...valeurs].sort((a, b) => a - b);
  return {
    n: tri.length,
    mediane: medianeNombres(tri),
    q1: quartile1Nombres(tri),
    q3: quartile3Nombres(tri),
    min: tri[0]!,
    max: tri[tri.length - 1]!,
  };
}

export function resumeStatistiqueBigints(
  valeurs: readonly bigint[],
): ResumeStatistiqueBigint {
  if (valeurs.length === 0) {
    return { n: 0, mediane: null, q1: null, q3: null, min: null, max: null };
  }
  const tri = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    n: tri.length,
    mediane: medianeBigints(tri),
    q1: quartile1Bigints(tri),
    q3: quartile3Bigints(tri),
    min: tri[0]!,
    max: tri[tri.length - 1]!,
  };
}
