/**
 * Paramètres expérimentaux de mutation v0.1 — figés dans EXPERIENCE_CREEE.
 * Non héritables : un agent ne fait pas évoluer son propre taux.
 */

import {
  CATALOGUE_GENES_MUTABLES_V01,
  VERSION_CATALOGUE_GENES,
  type DefinitionGeneMutable,
} from "./genes-mutables.js";

export const VERSION_PARAMETRES_MUTATION = "parametres-mutation-v01" as const;

export type ParametresMutationExperience = {
  readonly version: typeof VERSION_PARAMETRES_MUTATION;
  readonly active: boolean;
  /** 0…10000 — probabilité qu'un gène mutable tente une mutation. */
  readonly tauxMutationParGeneBps: number;
  readonly versionCatalogueGenes: typeof VERSION_CATALOGUE_GENES;
  readonly genes: readonly DefinitionGeneMutable[];
};

export type ParametresMutationExperienceJson = {
  readonly version: string;
  readonly active: boolean;
  readonly tauxMutationParGeneBps: number;
  readonly versionCatalogueGenes: string;
  /** Absent → catalogue v01 par défaut. */
  readonly genes?: readonly Record<string, unknown>[];
};

export class ParametresMutationInvalidesErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParametresMutationInvalidesErreur";
  }
}

function parserGeneJson(brut: Record<string, unknown>): DefinitionGeneMutable {
  const cle = brut.cle;
  if (typeof cle !== "string") {
    throw new ParametresMutationInvalidesErreur("gène : cle requise");
  }
  if (brut.type === "micro_usdc") {
    if (
      cle !== "seuilEnjeuPourInferenceMicroUsdc" &&
      cle !== "plafondCognitifMicroUsdc"
    ) {
      throw new ParametresMutationInvalidesErreur(
        `gène micro_usdc cle invalide : ${cle}`,
      );
    }
    const min = BigInt(String(brut.minimumMicroUsdc ?? ""));
    const max = BigInt(String(brut.maximumMicroUsdc ?? ""));
    const pas = BigInt(String(brut.pasMutationMicroUsdc ?? ""));
    const def = BigInt(String(brut.defautMicroUsdc ?? ""));
    if (min > max || pas <= 0n || def < min || def > max) {
      throw new ParametresMutationInvalidesErreur(
        `bornes micro_usdc invalides pour ${cle}`,
      );
    }
    return {
      cle,
      type: "micro_usdc",
      minimumMicroUsdc: min,
      maximumMicroUsdc: max,
      pasMutationMicroUsdc: pas,
      defautMicroUsdc: def,
    };
  }
  if (brut.type === "bps") {
    if (cle !== "partMaxVenParCycleBps") {
      throw new ParametresMutationInvalidesErreur(`gène bps cle invalide : ${cle}`);
    }
    const minimum = Number(brut.minimum);
    const maximum = Number(brut.maximum);
    const pasMutation = Number(brut.pasMutation);
    const defaut = Number(brut.defaut);
    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      !Number.isInteger(pasMutation) ||
      !Number.isInteger(defaut) ||
      minimum > maximum ||
      pasMutation <= 0 ||
      defaut < minimum ||
      defaut > maximum
    ) {
      throw new ParametresMutationInvalidesErreur(
        `bornes bps invalides pour ${cle}`,
      );
    }
    return { cle, type: "bps", minimum, maximum, pasMutation, defaut };
  }
  if (brut.type === "categoriel") {
    if (cle !== "comportementSansInference") {
      throw new ParametresMutationInvalidesErreur(
        `gène catégoriel cle invalide : ${cle}`,
      );
    }
    const valeurs = brut.valeursAutorisees;
    if (!Array.isArray(valeurs) || valeurs.length < 1) {
      throw new ParametresMutationInvalidesErreur(
        "valeursAutorisees requises",
      );
    }
    const autorisees = valeurs.filter(
      (v): v is "attendre" | "agir_si_favorable" =>
        v === "attendre" || v === "agir_si_favorable",
    );
    if (autorisees.length !== valeurs.length) {
      throw new ParametresMutationInvalidesErreur(
        "valeurs catégorielles hors whitelist",
      );
    }
    const defaut = brut.defaut;
    if (defaut !== "attendre" && defaut !== "agir_si_favorable") {
      throw new ParametresMutationInvalidesErreur("défaut catégoriel invalide");
    }
    if (!autorisees.includes(defaut)) {
      throw new ParametresMutationInvalidesErreur("défaut hors whitelist");
    }
    return {
      cle,
      type: "categoriel",
      valeursAutorisees: autorisees,
      defaut,
    };
  }
  throw new ParametresMutationInvalidesErreur(
    `type de gène inconnu : ${String(brut.type)}`,
  );
}

export function parserParametresMutation(
  brut: ParametresMutationExperienceJson,
): ParametresMutationExperience {
  if (brut.version !== VERSION_PARAMETRES_MUTATION) {
    throw new ParametresMutationInvalidesErreur(
      `version mutation attendue ${VERSION_PARAMETRES_MUTATION}`,
    );
  }
  if (typeof brut.active !== "boolean") {
    throw new ParametresMutationInvalidesErreur("active doit être booléen");
  }
  if (
    !Number.isInteger(brut.tauxMutationParGeneBps) ||
    brut.tauxMutationParGeneBps < 0 ||
    brut.tauxMutationParGeneBps > 10_000
  ) {
    throw new ParametresMutationInvalidesErreur(
      "tauxMutationParGeneBps doit être entier [0, 10000]",
    );
  }
  if (brut.versionCatalogueGenes !== VERSION_CATALOGUE_GENES) {
    throw new ParametresMutationInvalidesErreur(
      `versionCatalogueGenes attendue ${VERSION_CATALOGUE_GENES}`,
    );
  }
  const genes =
    brut.genes === undefined
      ? CATALOGUE_GENES_MUTABLES_V01
      : brut.genes.map((g) => parserGeneJson(g));
  if (genes.length === 0) {
    throw new ParametresMutationInvalidesErreur("catalogue genes vide");
  }
  return {
    version: VERSION_PARAMETRES_MUTATION,
    active: brut.active,
    tauxMutationParGeneBps: brut.tauxMutationParGeneBps,
    versionCatalogueGenes: VERSION_CATALOGUE_GENES,
    genes,
  };
}

export function serialiserParametresMutation(
  parametres: ParametresMutationExperience,
): ParametresMutationExperienceJson {
  return {
    version: parametres.version,
    active: parametres.active,
    tauxMutationParGeneBps: parametres.tauxMutationParGeneBps,
    versionCatalogueGenes: parametres.versionCatalogueGenes,
    genes: parametres.genes.map((g) => {
      if (g.type === "micro_usdc") {
        return {
          cle: g.cle,
          type: g.type,
          minimumMicroUsdc: g.minimumMicroUsdc.toString(10),
          maximumMicroUsdc: g.maximumMicroUsdc.toString(10),
          pasMutationMicroUsdc: g.pasMutationMicroUsdc.toString(10),
          defautMicroUsdc: g.defautMicroUsdc.toString(10),
        };
      }
      if (g.type === "bps") {
        return {
          cle: g.cle,
          type: g.type,
          minimum: g.minimum,
          maximum: g.maximum,
          pasMutation: g.pasMutation,
          defaut: g.defaut,
        };
      }
      return {
        cle: g.cle,
        type: g.type,
        valeursAutorisees: [...g.valeursAutorisees],
        defaut: g.defaut,
      };
    }),
  };
}

export function creerParametresMutationInactifs(): ParametresMutationExperience {
  return {
    version: VERSION_PARAMETRES_MUTATION,
    active: false,
    tauxMutationParGeneBps: 0,
    versionCatalogueGenes: VERSION_CATALOGUE_GENES,
    genes: CATALOGUE_GENES_MUTABLES_V01,
  };
}
