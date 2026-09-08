/**
 * Tirages déterministes indépendants par (gène, domaine).
 * Aucun PRNG séquentiel global — un nouveau gène ne décale pas les anciens.
 */

/**
 * FNV-1a 64 bits sur une concaténation de domaines (ordre explicite).
 */
export function hacherDomaines(parties: readonly string[]): bigint {
  let h = 0xcbf29ce484222325n;
  const premier = 0x100000001b3n;
  for (const partie of parties) {
    for (let i = 0; i < partie.length; i += 1) {
      h ^= BigInt(partie.charCodeAt(i));
      h = BigInt.asUintN(64, h * premier);
    }
    // séparateur de domaine
    h ^= 0xffn;
    h = BigInt.asUintN(64, h * premier);
  }
  return h;
}

/** Entier uniforme [0, modulo). */
export function tirerEntierModulo(
  hash: bigint,
  modulo: number,
): number {
  if (!Number.isInteger(modulo) || modulo <= 0) {
    throw new Error(`modulo invalide : ${String(modulo)}`);
  }
  return Number(hash % BigInt(modulo));
}

/** Points de base 0…9999. */
export function tirerBps(hash: bigint): number {
  return tirerEntierModulo(hash, 10_000);
}

export function tirerBit(hash: bigint): 0 | 1 {
  return (tirerEntierModulo(hash, 2) === 0 ? 0 : 1) as 0 | 1;
}

export function fabriquerHashGene(options: {
  readonly versionMutation: string;
  readonly graineExperience: number;
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
  readonly cleGene: string;
  readonly domaine: string;
}): bigint {
  return hacherDomaines([
    options.versionMutation,
    String(options.graineExperience),
    options.identifiantReproduction,
    options.identifiantParent,
    options.identifiantEnfant,
    options.cleGene,
    options.domaine,
  ]);
}
