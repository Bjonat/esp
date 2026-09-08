/**
 * Opérateur de mutation déterministe sur ConfigurationHeritableAgent.
 * Copie → mutation bornée → enfant. Parent immuable.
 */

import {
  copierConfigurationHeritable,
  creerConfigurationHeritableVide,
  type ConfigurationHeritableAgent,
} from "./configuration-heritable.js";
import type {
  CleGeneMutable,
  DefinitionGeneMutable,
} from "./genes-mutables.js";
import { parserMicroUsdc, serialiserMicroUsdc } from "./monnaie.js";
import type { ParametresMutationExperience } from "./parametres-mutation.js";
import {
  fabriquerHashGene,
  tirerBit,
  tirerBps,
  tirerEntierModulo,
} from "./tirage-deterministe.js";

export type MutationEffective = {
  readonly cleGene: CleGeneMutable;
  readonly valeurParent: string | number | boolean;
  readonly valeurEnfant: string | number | boolean;
  readonly operateur: "increment" | "decrement" | "remplacement_categoriel";
  readonly versionMutation: string;
};

export type ResultatMutationConfiguration = {
  readonly configurationEnfant: ConfigurationHeritableAgent;
  readonly mutations: readonly MutationEffective[];
};

function lireValeurGene(
  parametres: Readonly<Record<string, string | number | boolean>>,
  gene: DefinitionGeneMutable,
): string | number | boolean {
  const brut = parametres[gene.cle];
  if (brut !== undefined) {
    return brut;
  }
  if (gene.type === "micro_usdc") {
    return serialiserMicroUsdc(gene.defautMicroUsdc);
  }
  if (gene.type === "bps") {
    return gene.defaut;
  }
  return gene.defaut;
}

function muterGeneNumeriqueMicroUsdc(options: {
  readonly gene: Extract<DefinitionGeneMutable, { type: "micro_usdc" }>;
  readonly valeurParent: string | number | boolean;
  readonly hashDirection: bigint;
}): MutationEffective | null {
  let actuelle: bigint;
  try {
    actuelle = parserMicroUsdc(String(options.valeurParent));
  } catch {
    actuelle = options.gene.defautMicroUsdc;
  }
  const peutDec = actuelle - options.gene.pasMutationMicroUsdc >= options.gene.minimumMicroUsdc;
  const peutInc = actuelle + options.gene.pasMutationMicroUsdc <= options.gene.maximumMicroUsdc;
  if (!peutDec && !peutInc) {
    return null;
  }
  let operateur: "increment" | "decrement";
  let suivante: bigint;
  if (peutDec && peutInc) {
    if (tirerBit(options.hashDirection) === 0) {
      operateur = "decrement";
      suivante = actuelle - options.gene.pasMutationMicroUsdc;
    } else {
      operateur = "increment";
      suivante = actuelle + options.gene.pasMutationMicroUsdc;
    }
  } else if (peutInc) {
    operateur = "increment";
    suivante = actuelle + options.gene.pasMutationMicroUsdc;
  } else {
    operateur = "decrement";
    suivante = actuelle - options.gene.pasMutationMicroUsdc;
  }
  return {
    cleGene: options.gene.cle,
    valeurParent: serialiserMicroUsdc(actuelle),
    valeurEnfant: serialiserMicroUsdc(suivante),
    operateur,
    versionMutation: "parametres-mutation-v01",
  };
}

function muterGeneBps(options: {
  readonly gene: Extract<DefinitionGeneMutable, { type: "bps" }>;
  readonly valeurParent: string | number | boolean;
  readonly hashDirection: bigint;
}): MutationEffective | null {
  const actuelle =
    typeof options.valeurParent === "number"
      ? options.valeurParent
      : options.gene.defaut;
  const peutDec = actuelle - options.gene.pasMutation >= options.gene.minimum;
  const peutInc = actuelle + options.gene.pasMutation <= options.gene.maximum;
  if (!peutDec && !peutInc) {
    return null;
  }
  let operateur: "increment" | "decrement";
  let suivante: number;
  if (peutDec && peutInc) {
    if (tirerBit(options.hashDirection) === 0) {
      operateur = "decrement";
      suivante = actuelle - options.gene.pasMutation;
    } else {
      operateur = "increment";
      suivante = actuelle + options.gene.pasMutation;
    }
  } else if (peutInc) {
    operateur = "increment";
    suivante = actuelle + options.gene.pasMutation;
  } else {
    operateur = "decrement";
    suivante = actuelle - options.gene.pasMutation;
  }
  return {
    cleGene: options.gene.cle,
    valeurParent: actuelle,
    valeurEnfant: suivante,
    operateur,
    versionMutation: "parametres-mutation-v01",
  };
}

function muterGeneCategoriel(options: {
  readonly gene: Extract<DefinitionGeneMutable, { type: "categoriel" }>;
  readonly valeurParent: string | number | boolean;
  readonly hashDirection: bigint;
}): MutationEffective | null {
  const actuelle =
    options.valeurParent === "attendre" ||
    options.valeurParent === "agir_si_favorable"
      ? options.valeurParent
      : options.gene.defaut;
  const alternatives = options.gene.valeursAutorisees.filter((v) => v !== actuelle);
  if (alternatives.length === 0) {
    return null;
  }
  const idx = tirerEntierModulo(options.hashDirection, alternatives.length);
  const suivante = alternatives[idx]!;
  return {
    cleGene: options.gene.cle,
    valeurParent: actuelle,
    valeurEnfant: suivante,
    operateur: "remplacement_categoriel",
    versionMutation: "parametres-mutation-v01",
  };
}

/**
 * Pipeline : copie exacte → mutations indépendantes par gène trié.
 */
export function appliquerMutationConfigurationHeritable(options: {
  readonly configurationParent: ConfigurationHeritableAgent;
  readonly parametresMutation: ParametresMutationExperience;
  readonly graineExperience: number;
  readonly identifiantReproduction: string;
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
}): ResultatMutationConfiguration {
  const copie = copierConfigurationHeritable(options.configurationParent);
  if (!options.parametresMutation.active) {
    return { configurationEnfant: copie, mutations: [] };
  }

  const parametres: Record<string, string | number | boolean> = {
    ...copie.parametres,
  };
  // Matérialiser les gènes mutables absents (legacy vide → défauts catalogue)
  const genesTries = [...options.parametresMutation.genes].sort((a, b) =>
    a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0,
  );
  for (const gene of genesTries) {
    if (parametres[gene.cle] === undefined) {
      parametres[gene.cle] = lireValeurGene({}, gene);
    }
  }

  const mutations: MutationEffective[] = [];
  const ctxBase = {
    versionMutation: options.parametresMutation.version,
    graineExperience: options.graineExperience,
    identifiantReproduction: options.identifiantReproduction,
    identifiantParent: options.identifiantParent,
    identifiantEnfant: options.identifiantEnfant,
  };

  for (const gene of genesTries) {
    const hashDeclenchement = fabriquerHashGene({
      ...ctxBase,
      cleGene: gene.cle,
      domaine: "declenchement",
    });
    if (tirerBps(hashDeclenchement) >= options.parametresMutation.tauxMutationParGeneBps) {
      continue;
    }
    const hashDirection = fabriquerHashGene({
      ...ctxBase,
      cleGene: gene.cle,
      domaine: "direction",
    });
    const valeurParent = lireValeurGene(parametres, gene);
    let mutation: MutationEffective | null = null;
    if (gene.type === "micro_usdc") {
      mutation = muterGeneNumeriqueMicroUsdc({
        gene,
        valeurParent,
        hashDirection,
      });
    } else if (gene.type === "bps") {
      mutation = muterGeneBps({ gene, valeurParent, hashDirection });
    } else {
      mutation = muterGeneCategoriel({ gene, valeurParent, hashDirection });
    }
    if (mutation !== null) {
      parametres[gene.cle] = mutation.valeurEnfant;
      mutations.push(mutation);
    }
  }

  return {
    configurationEnfant: {
      version: copie.version,
      parametres,
    },
    mutations,
  };
}

/**
 * Empreinte déterministe (sérialisation canonique triée).
 * Pas une identité cryptographique d'agent.
 */
export function empreinteConfigurationHeritable(
  configuration: ConfigurationHeritableAgent,
): string {
  const cles = Object.keys(configuration.parametres).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const corps = cles
    .map((cle) => `${cle}=${String(configuration.parametres[cle])}`)
    .join("|");
  const canonique = `${configuration.version}|${corps}`;
  // FNV-1a 64 → hex
  let h = 0xcbf29ce484222325n;
  const premier = 0x100000001b3n;
  for (let i = 0; i < canonique.length; i += 1) {
    h ^= BigInt(canonique.charCodeAt(i));
    h = BigInt.asUintN(64, h * premier);
  }
  return h.toString(16).padStart(16, "0");
}

export function differencesConfigurationsHeritables(
  parent: ConfigurationHeritableAgent,
  enfant: ConfigurationHeritableAgent,
): readonly { readonly cle: string; readonly parent: string; readonly enfant: string }[] {
  const cles = new Set([
    ...Object.keys(parent.parametres),
    ...Object.keys(enfant.parametres),
  ]);
  const diffs: { cle: string; parent: string; enfant: string }[] = [];
  for (const cle of [...cles].sort()) {
    const vp = parent.parametres[cle];
    const ve = enfant.parametres[cle];
    if (String(vp) !== String(ve)) {
      diffs.push({
        cle,
        parent: vp === undefined ? "∅" : String(vp),
        enfant: ve === undefined ? "∅" : String(ve),
      });
    }
  }
  return diffs;
}

/** Matérialise une config depuis une politique d'expérience (Genesis). */
export function configurationHeritableDepuisPolitiqueBase(options: {
  readonly seuilEnjeuPourInferenceMicroUsdc: bigint;
  readonly partMaxVenParCycleBps: number;
  readonly plafondCognitifMicroUsdc: bigint;
  readonly comportementSansInference: "attendre" | "agir_si_favorable";
}): ConfigurationHeritableAgent {
  const vide = creerConfigurationHeritableVide();
  return {
    version: vide.version,
    parametres: {
      seuilEnjeuPourInferenceMicroUsdc: serialiserMicroUsdc(
        options.seuilEnjeuPourInferenceMicroUsdc,
      ),
      partMaxVenParCycleBps: options.partMaxVenParCycleBps,
      plafondCognitifMicroUsdc: serialiserMicroUsdc(
        options.plafondCognitifMicroUsdc,
      ),
      comportementSansInference: options.comportementSansInference,
    },
  };
}
