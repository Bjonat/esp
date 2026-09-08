/**
 * Catalogue versionné des gènes comportementaux mutables v0.1.
 * Uniquement des paramètres qui alimentent PolitiqueBudgetCognitifAgent.
 * modeleLogique : NON mutable en v0.1.
 */

export const VERSION_CATALOGUE_GENES = "genes-mutables-v01" as const;

export type ComportementSansInferenceGene =
  | "attendre"
  | "agir_si_favorable";

export const VALEURS_COMPORTEMENT_SANS_INFERENCE: readonly ComportementSansInferenceGene[] =
  ["attendre", "agir_si_favorable"];

export type GeneEntierMicroUsdc = {
  readonly cle: "seuilEnjeuPourInferenceMicroUsdc" | "plafondCognitifMicroUsdc";
  readonly type: "micro_usdc";
  readonly minimumMicroUsdc: bigint;
  readonly maximumMicroUsdc: bigint;
  readonly pasMutationMicroUsdc: bigint;
  readonly defautMicroUsdc: bigint;
};

export type GeneEntierBps = {
  readonly cle: "partMaxVenParCycleBps";
  readonly type: "bps";
  readonly minimum: number;
  readonly maximum: number;
  readonly pasMutation: number;
  readonly defaut: number;
};

export type GeneCategoriel = {
  readonly cle: "comportementSansInference";
  readonly type: "categoriel";
  readonly valeursAutorisees: readonly ComportementSansInferenceGene[];
  readonly defaut: ComportementSansInferenceGene;
};

export type DefinitionGeneMutable =
  | GeneEntierMicroUsdc
  | GeneEntierBps
  | GeneCategoriel;

export type CleGeneMutable = DefinitionGeneMutable["cle"];

/** Définitions de démonstration — NON CANONIQUES. */
export const CATALOGUE_GENES_MUTABLES_V01: readonly DefinitionGeneMutable[] = [
  {
    cle: "seuilEnjeuPourInferenceMicroUsdc",
    type: "micro_usdc",
    minimumMicroUsdc: 0n,
    maximumMicroUsdc: 10_000_000n,
    pasMutationMicroUsdc: 50_000n,
    defautMicroUsdc: 100_000n,
  },
  {
    cle: "partMaxVenParCycleBps",
    type: "bps",
    minimum: 0,
    maximum: 10_000,
    pasMutation: 25,
    defaut: 50,
  },
  {
    cle: "plafondCognitifMicroUsdc",
    type: "micro_usdc",
    minimumMicroUsdc: 0n,
    maximumMicroUsdc: 1_000_000n,
    pasMutationMicroUsdc: 5_000n,
    defautMicroUsdc: 10_000n,
  },
  {
    cle: "comportementSansInference",
    type: "categoriel",
    valeursAutorisees: VALEURS_COMPORTEMENT_SANS_INFERENCE,
    defaut: "agir_si_favorable",
  },
];

export function clesGenesMutablesTriees(): CleGeneMutable[] {
  return [...CATALOGUE_GENES_MUTABLES_V01.map((g) => g.cle)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

export function trouverDefinitionGene(
  cle: string,
): DefinitionGeneMutable | undefined {
  return CATALOGUE_GENES_MUTABLES_V01.find((g) => g.cle === cle);
}

export function estCleGeneMutable(cle: string): cle is CleGeneMutable {
  return trouverDefinitionGene(cle) !== undefined;
}
