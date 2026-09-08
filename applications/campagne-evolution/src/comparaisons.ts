/**
 * Comparaisons appariées D−C, B−A, C−B, D−B.
 * Différences bigint exactes pour montants micro-USDC.
 */

import type { ResumeRunEvolution } from "./resume-run.js";
import {
  medianeBigints,
  medianeNombres,
  quartile1Bigints,
  quartile1Nombres,
  quartile3Bigints,
  quartile3Nombres,
} from "./statistiques.js";

export type PaireComparaison = "D-C" | "B-A" | "C-B" | "D-B";

export type ResumeComparaisonNombre = {
  readonly metrique: string;
  readonly paire: PaireComparaison;
  readonly n: number;
  readonly mediane: number | null;
  readonly q1: number | null;
  readonly q3: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly nPos: number;
  readonly nNul: number;
  readonly nNeg: number;
};

export type ResumeComparaisonBigint = {
  readonly metrique: string;
  readonly paire: PaireComparaison;
  readonly n: number;
  readonly mediane: string | null;
  readonly q1: string | null;
  readonly q3: string | null;
  readonly min: string | null;
  readonly max: string | null;
  readonly nPos: number;
  readonly nNul: number;
  readonly nNeg: number;
};

const METRIQUES_BIGINT = [
  "venPopulationFinaleMicroUsdc",
  "resultatActiviteBrutCumuleMicroUsdc",
  "resultatApresContratCumuleMicroUsdc",
  "resultatApresReproductionCumuleMicroUsdc",
  "computeCumuleMicroUsdc",
  "contributionProprietaireCumuleeMicroUsdc",
  "coutCognitionMicroUsdc",
] as const;

const METRIQUES_NOMBRE = [
  "populationVivanteFinale",
  "naissancesCumulees",
  "generationMaximale",
  "ligneesVivantes",
  "mutationsCumulees",
  "configurationsDistinctesFinales",
  "demandesInference",
] as const;

type CleBigint = (typeof METRIQUES_BIGINT)[number];
type CleNombre = (typeof METRIQUES_NOMBRE)[number];

function indexerParSeedCondition(
  resumes: readonly ResumeRunEvolution[],
): Map<string, ResumeRunEvolution> {
  const map = new Map<string, ResumeRunEvolution>();
  for (const r of resumes) {
    map.set(`${r.condition}:${r.seed}`, r);
  }
  return map;
}

function pairesPour(
  paire: PaireComparaison,
  resumes: readonly ResumeRunEvolution[],
): readonly { gauche: ResumeRunEvolution; droite: ResumeRunEvolution }[] {
  const [a, b] = paire.split("-") as [string, string];
  const index = indexerParSeedCondition(resumes);
  const seeds = [
    ...new Set(resumes.filter((r) => r.condition === a).map((r) => r.seed)),
  ].sort((x, y) => x - y);
  const out: { gauche: ResumeRunEvolution; droite: ResumeRunEvolution }[] = [];
  for (const seed of seeds) {
    const gauche = index.get(`${a}:${seed}`);
    const droite = index.get(`${b}:${seed}`);
    if (gauche !== undefined && droite !== undefined) {
      out.push({ gauche, droite });
    }
  }
  return out;
}

function resumeDiffsBigint(
  metrique: string,
  paire: PaireComparaison,
  diffs: readonly bigint[],
): ResumeComparaisonBigint {
  if (diffs.length === 0) {
    return {
      metrique,
      paire,
      n: 0,
      mediane: null,
      q1: null,
      q3: null,
      min: null,
      max: null,
      nPos: 0,
      nNul: 0,
      nNeg: 0,
    };
  }
  const tri = [...diffs].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  let nPos = 0;
  let nNul = 0;
  let nNeg = 0;
  for (const d of diffs) {
    if (d > 0n) nPos += 1;
    else if (d === 0n) nNul += 1;
    else nNeg += 1;
  }
  return {
    metrique,
    paire,
    n: diffs.length,
    mediane: medianeBigints(tri)?.toString(10) ?? null,
    q1: quartile1Bigints(tri)?.toString(10) ?? null,
    q3: quartile3Bigints(tri)?.toString(10) ?? null,
    min: tri[0]!.toString(10),
    max: tri[tri.length - 1]!.toString(10),
    nPos,
    nNul,
    nNeg,
  };
}

function resumeDiffsNombre(
  metrique: string,
  paire: PaireComparaison,
  diffs: readonly number[],
): ResumeComparaisonNombre {
  if (diffs.length === 0) {
    return {
      metrique,
      paire,
      n: 0,
      mediane: null,
      q1: null,
      q3: null,
      min: null,
      max: null,
      nPos: 0,
      nNul: 0,
      nNeg: 0,
    };
  }
  const tri = [...diffs].sort((x, y) => x - y);
  let nPos = 0;
  let nNul = 0;
  let nNeg = 0;
  for (const d of diffs) {
    if (d > 0) nPos += 1;
    else if (d === 0) nNul += 1;
    else nNeg += 1;
  }
  return {
    metrique,
    paire,
    n: diffs.length,
    mediane: medianeNombres(tri),
    q1: quartile1Nombres(tri),
    q3: quartile3Nombres(tri),
    min: tri[0]!,
    max: tri[tri.length - 1]!,
    nPos,
    nNul,
    nNeg,
  };
}

export function calculerComparaisonsAppariees(
  resumes: readonly ResumeRunEvolution[],
): {
  readonly bigint: ResumeComparaisonBigint[];
  readonly nombre: ResumeComparaisonNombre[];
} {
  const paires: PaireComparaison[] = ["D-C", "B-A", "C-B", "D-B"];
  const bigint: ResumeComparaisonBigint[] = [];
  const nombre: ResumeComparaisonNombre[] = [];

  for (const paire of paires) {
    const couples = pairesPour(paire, resumes);
    for (const metrique of METRIQUES_BIGINT) {
      const diffs = couples.map(
        (c) =>
          BigInt(c.gauche[metrique as CleBigint]) -
          BigInt(c.droite[metrique as CleBigint]),
      );
      bigint.push(resumeDiffsBigint(metrique, paire, diffs));
    }
    for (const metrique of METRIQUES_NOMBRE) {
      const diffs = couples.map(
        (c) =>
          Number(c.gauche[metrique as CleNombre]) -
          Number(c.droite[metrique as CleNombre]),
      );
      nombre.push(resumeDiffsNombre(metrique, paire, diffs));
    }
  }

  return { bigint, nombre };
}

/** Différence bigint exacte entre deux montants string. */
export function differenceBigintExacte(a: string, b: string): bigint {
  return BigInt(a) - BigInt(b);
}
