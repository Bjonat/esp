/**
 * Projections diversité héritable / mutation — descriptives uniquement.
 * Aucune sélection, aucun ranking, aucune causalité fitness.
 */

import type {
  ConfigurationHeritableAgent,
  EvenementEsp,
  PolitiqueBudgetCognitifBase,
} from "@esp/protocole";
import {
  CATALOGUE_GENES_MUTABLES_V01,
  VERSION_CATALOGUE_GENES,
  configurationHeritableDepuisPolitiqueBase,
  differencesConfigurationsHeritables,
  empreinteConfigurationHeritable,
  resoudrePolitiqueDepuisConfigurationHeritable,
  serialiserMicroUsdc,
} from "@esp/protocole";
import type { AgentExperience } from "./projections.js";

export const AVERTISSEMENT_DIVERSITE_HERITABLE =
  "DIVERSITE_HERITABLE_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE" as const;

export type ProjectionMutationNaissance = {
  readonly cleGene: string;
  readonly valeurParent: string | number | boolean;
  readonly valeurEnfant: string | number | boolean;
  readonly operateur: string;
  readonly versionMutation: string;
  readonly identifiantReproduction: string;
};

export type ProjectionDifferenceGene = {
  readonly cle: string;
  readonly parent: string;
  readonly enfant: string;
};

export type ProjectionHeritageVariationAgent = {
  readonly avertissement: typeof AVERTISSEMENT_DIVERSITE_HERITABLE;
  readonly identifiantParent: string | null;
  readonly empreinteConfiguration: string;
  readonly configurationHeritable: ConfigurationHeritableAgent;
  readonly differencesAvecParent: readonly ProjectionDifferenceGene[] | null;
  readonly mutationsALaNaissance: readonly ProjectionMutationNaissance[];
};

export type ProjectionGeneNumeriqueMicroUsdc = {
  readonly cle: string;
  readonly type: "micro_usdc";
  readonly min: string | null;
  readonly mediane: string | null;
  readonly max: string | null;
};

export type ProjectionGeneNumeriqueBps = {
  readonly cle: string;
  readonly type: "bps";
  readonly min: number | null;
  readonly mediane: number | null;
  readonly max: number | null;
};

export type ProjectionGeneCategoriel = {
  readonly cle: string;
  readonly type: "categoriel";
  readonly comptesParValeur: Readonly<Record<string, number>>;
};

export type ProjectionGeneDiversite =
  | ProjectionGeneNumeriqueMicroUsdc
  | ProjectionGeneNumeriqueBps
  | ProjectionGeneCategoriel;

export type ProjectionDiversiteHeritablePopulation = {
  readonly avertissement: typeof AVERTISSEMENT_DIVERSITE_HERITABLE;
  readonly versionCatalogueGenes: typeof VERSION_CATALOGUE_GENES;
  readonly cycleCourant: number;
  readonly nombreConfigurationsHeritablesDistinctes: number;
  readonly nombreMutationsCumulees: number;
  readonly nombreMutationsCycle: number;
  readonly nombreAgentsAvecAuMoinsUneMutationDepuisParent: number;
  readonly genes: readonly ProjectionGeneDiversite[];
};

function politiqueBaseCatalogue(): PolitiqueBudgetCognitifBase {
  const seuil = CATALOGUE_GENES_MUTABLES_V01.find(
    (g) => g.cle === "seuilEnjeuPourInferenceMicroUsdc",
  );
  const part = CATALOGUE_GENES_MUTABLES_V01.find(
    (g) => g.cle === "partMaxVenParCycleBps",
  );
  const plafond = CATALOGUE_GENES_MUTABLES_V01.find(
    (g) => g.cle === "plafondCognitifMicroUsdc",
  );
  const comportement = CATALOGUE_GENES_MUTABLES_V01.find(
    (g) => g.cle === "comportementSansInference",
  );
  if (
    seuil?.type !== "micro_usdc" ||
    part?.type !== "bps" ||
    plafond?.type !== "micro_usdc" ||
    comportement?.type !== "categoriel"
  ) {
    throw new Error("Catalogue genes-mutables-v01 incomplet");
  }
  return {
    identifiant: "politique-budget-cognitif-agent",
    version: "catalogue-defaut",
    seuilEnjeuPourInferenceMicroUsdc: seuil.defautMicroUsdc,
    partMaxVenParCycleBps: part.defaut,
    plafondCognitifMicroUsdc: plafond.defautMicroUsdc,
    modeleLogique: "catalogue-defaut",
    comportementSansInference: comportement.defaut,
    refuserSiCritiqueOuDormant: true,
  };
}

/** Configuration stockée ou matérialisée depuis la politique de base. */
export function configurationHeritableEffective(options: {
  readonly configurationHeritable?: ConfigurationHeritableAgent;
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): ConfigurationHeritableAgent {
  const stockee = options.configurationHeritable;
  if (stockee !== undefined && Object.keys(stockee.parametres).length > 0) {
    return stockee;
  }
  const base = options.politiqueBase ?? politiqueBaseCatalogue();
  const resolue = resoudrePolitiqueDepuisConfigurationHeritable({
    politiqueBase: base,
    ...(stockee !== undefined ? { configurationHeritable: stockee } : {}),
  });
  return configurationHeritableDepuisPolitiqueBase({
    seuilEnjeuPourInferenceMicroUsdc: resolue.seuilEnjeuPourInferenceMicroUsdc,
    partMaxVenParCycleBps: resolue.partMaxVenParCycleBps,
    plafondCognitifMicroUsdc: resolue.plafondCognitifMicroUsdc,
    comportementSansInference: resolue.comportementSansInference,
  });
}

export function empreinteConfigurationAgent(options: {
  readonly configurationHeritable?: ConfigurationHeritableAgent;
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): string {
  return empreinteConfigurationHeritable(
    configurationHeritableEffective(options),
  );
}

function identifiantEnfantMutation(
  evenement: EvenementEsp,
): string | undefined {
  const charge = evenement.chargeUtile;
  if (typeof charge.identifiantEnfant === "string") {
    return charge.identifiantEnfant;
  }
  return evenement.identifiantAgent;
}

/**
 * Indexe les MUTATION_APPLIQUEE par enfant (naissance).
 */
export function indexerMutationsNaissance(
  evenements: readonly EvenementEsp[],
): ReadonlyMap<string, readonly ProjectionMutationNaissance[]> {
  const parEnfant = new Map<string, ProjectionMutationNaissance[]>();
  const ordonnes = [...evenements].sort((a, b) => a.sequence - b.sequence);
  for (const evenement of ordonnes) {
    if (evenement.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    const enfant = identifiantEnfantMutation(evenement);
    if (enfant === undefined) {
      continue;
    }
    const charge = evenement.chargeUtile;
    const mutation: ProjectionMutationNaissance = {
      cleGene: String(charge.cleGene ?? ""),
      valeurParent: charge.valeurParent as string | number | boolean,
      valeurEnfant: charge.valeurEnfant as string | number | boolean,
      operateur: String(charge.operateur ?? ""),
      versionMutation: String(charge.versionMutation ?? ""),
      identifiantReproduction: String(charge.identifiantReproduction ?? ""),
    };
    const liste = parEnfant.get(enfant);
    if (liste === undefined) {
      parEnfant.set(enfant, [mutation]);
    } else {
      liste.push(mutation);
    }
  }
  return parEnfant;
}

export function compterMutationsNaissanceParAgent(
  evenements: readonly EvenementEsp[],
): ReadonlyMap<string, number> {
  const index = indexerMutationsNaissance(evenements);
  const comptes = new Map<string, number>();
  for (const [identifiant, mutations] of index) {
    comptes.set(identifiant, mutations.length);
  }
  return comptes;
}

function medianeBigint(valeurs: readonly bigint[]): bigint | null {
  if (valeurs.length === 0) {
    return null;
  }
  const triees = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const milieu = Math.floor(triees.length / 2);
  if (triees.length % 2 === 1) {
    return triees[milieu]!;
  }
  return (triees[milieu - 1]! + triees[milieu]!) / 2n;
}

function medianeNombre(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) {
    return null;
  }
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  if (triees.length % 2 === 1) {
    return triees[milieu]!;
  }
  return (triees[milieu - 1]! + triees[milieu]!) / 2;
}

/**
 * Agrégats population de diversité héritable (descriptifs).
 * `nombreMutationsCycle` : MUTATION_APPLIQUEE dont numeroCycle === cycleCourant
 * (même notion que naissancesCycle / fitness cycleCourant).
 */
export function projeterDiversiteHeritablePopulation(options: {
  readonly agents: readonly AgentExperience[];
  readonly evenements: readonly EvenementEsp[];
  readonly cycleCourant: number;
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): ProjectionDiversiteHeritablePopulation {
  const politiqueBase = options.politiqueBase ?? politiqueBaseCatalogue();
  const empreintes = new Set<string>();
  const seuils: bigint[] = [];
  const parts: number[] = [];
  const plafonds: bigint[] = [];
  const comportements: Record<string, number> = {};

  for (const agent of options.agents) {
    const config = configurationHeritableEffective({
      ...(agent.configurationHeritable !== undefined
        ? { configurationHeritable: agent.configurationHeritable }
        : {}),
      politiqueBase,
    });
    empreintes.add(empreinteConfigurationHeritable(config));

    const resolue = resoudrePolitiqueDepuisConfigurationHeritable({
      politiqueBase,
      ...(agent.configurationHeritable !== undefined
        ? { configurationHeritable: agent.configurationHeritable }
        : {}),
    });
    seuils.push(resolue.seuilEnjeuPourInferenceMicroUsdc);
    parts.push(resolue.partMaxVenParCycleBps);
    plafonds.push(resolue.plafondCognitifMicroUsdc);
    const cleComportement = resolue.comportementSansInference;
    comportements[cleComportement] = (comportements[cleComportement] ?? 0) + 1;
  }

  let nombreMutationsCumulees = 0;
  let nombreMutationsCycle = 0;
  const agentsMutés = new Set<string>();
  for (const evenement of options.evenements) {
    if (evenement.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    nombreMutationsCumulees += 1;
    if (evenement.numeroCycle === options.cycleCourant) {
      nombreMutationsCycle += 1;
    }
    const enfant = identifiantEnfantMutation(evenement);
    if (enfant !== undefined) {
      agentsMutés.add(enfant);
    }
  }

  const genes: ProjectionGeneDiversite[] = [];
  for (const gene of CATALOGUE_GENES_MUTABLES_V01) {
    if (gene.type === "micro_usdc") {
      const valeurs =
        gene.cle === "seuilEnjeuPourInferenceMicroUsdc" ? seuils : plafonds;
      const med = medianeBigint(valeurs);
      genes.push({
        cle: gene.cle,
        type: "micro_usdc",
        min:
          valeurs.length === 0
            ? null
            : serialiserMicroUsdc(
                valeurs.reduce((a, b) => (a < b ? a : b)),
              ),
        mediane: med === null ? null : serialiserMicroUsdc(med),
        max:
          valeurs.length === 0
            ? null
            : serialiserMicroUsdc(
                valeurs.reduce((a, b) => (a > b ? a : b)),
              ),
      });
      continue;
    }
    if (gene.type === "bps") {
      const med = medianeNombre(parts);
      genes.push({
        cle: gene.cle,
        type: "bps",
        min: parts.length === 0 ? null : Math.min(...parts),
        mediane: med,
        max: parts.length === 0 ? null : Math.max(...parts),
      });
      continue;
    }
    genes.push({
      cle: gene.cle,
      type: "categoriel",
      comptesParValeur: { ...comportements },
    });
  }

  return {
    avertissement: AVERTISSEMENT_DIVERSITE_HERITABLE,
    versionCatalogueGenes: VERSION_CATALOGUE_GENES,
    cycleCourant: options.cycleCourant,
    nombreConfigurationsHeritablesDistinctes: empreintes.size,
    nombreMutationsCumulees,
    nombreMutationsCycle,
    nombreAgentsAvecAuMoinsUneMutationDepuisParent: agentsMutés.size,
    genes,
  };
}

export function projeterHeritageVariationAgent(options: {
  readonly agent: AgentExperience;
  readonly agents: readonly AgentExperience[];
  readonly evenements: readonly EvenementEsp[];
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): ProjectionHeritageVariationAgent {
  const politiqueBase = options.politiqueBase ?? politiqueBaseCatalogue();
  const configurationHeritable = configurationHeritableEffective({
    ...(options.agent.configurationHeritable !== undefined
      ? { configurationHeritable: options.agent.configurationHeritable }
      : {}),
    politiqueBase,
  });
  const identifiantParent = options.agent.identite.identifiantParent ?? null;
  let differencesAvecParent: readonly ProjectionDifferenceGene[] | null = null;
  if (identifiantParent !== null) {
    const parent = options.agents.find(
      (a) => a.identite.identifiant === identifiantParent,
    );
    if (parent !== undefined) {
      const configParent = configurationHeritableEffective({
        ...(parent.configurationHeritable !== undefined
          ? { configurationHeritable: parent.configurationHeritable }
          : {}),
        politiqueBase,
      });
      differencesAvecParent = differencesConfigurationsHeritables(
        configParent,
        configurationHeritable,
      );
    } else {
      differencesAvecParent = [];
    }
  }

  const mutations =
    indexerMutationsNaissance(options.evenements).get(
      options.agent.identite.identifiant,
    ) ?? [];

  return {
    avertissement: AVERTISSEMENT_DIVERSITE_HERITABLE,
    identifiantParent,
    empreinteConfiguration: empreinteConfigurationHeritable(
      configurationHeritable,
    ),
    configurationHeritable,
    differencesAvecParent,
    mutationsALaNaissance: mutations,
  };
}

export function enrichirNoeudsArbreGenealogiqueMutation(options: {
  readonly agents: readonly AgentExperience[];
  readonly evenements: readonly EvenementEsp[];
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): ReadonlyMap<
  string,
  { readonly nombreMutationsNaissance: number; readonly empreinteConfiguration: string }
> {
  const politiqueBase = options.politiqueBase ?? politiqueBaseCatalogue();
  const comptes = compterMutationsNaissanceParAgent(options.evenements);
  const resultat = new Map<
    string,
    { readonly nombreMutationsNaissance: number; readonly empreinteConfiguration: string }
  >();
  for (const agent of options.agents) {
    resultat.set(agent.identite.identifiant, {
      nombreMutationsNaissance:
        comptes.get(agent.identite.identifiant) ?? 0,
      empreinteConfiguration: empreinteConfigurationAgent({
        ...(agent.configurationHeritable !== undefined
          ? { configurationHeritable: agent.configurationHeritable }
          : {}),
        politiqueBase,
      }),
    });
  }
  return resultat;
}
