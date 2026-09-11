/**
 * Sensibilité un-gène v03-E — contrefactuels structuraux.
 *
 * Règle de voisin (AVANT exécution) :
 *   premier voisin valide renvoyé par `voisinsUnPasGene` —
 *   ordre canonique du domaine (moins avant plus ; catégoriel = ordre
 *   `valeursAutorisees` du catalogue, filtrées ≠ valeur courante).
 *
 * Niveaux de sensibilité (séparés) :
 *   1. politique — génotype → politique résolue différente
 *   2. cognition/décision — choix sec divergent
 *   3. économique — conséquence d'action différente
 *
 * Une différence de configuration sans effet aval ≠ sensibilité.
 */

import {
  configurationHeritableDepuisPolitiqueBase,
  empreinteConfigurationHeritable,
  resoudrePolitiqueDepuisConfigurationHeritable,
  type CleGeneMutable,
  type EtatEconomiqueAgent,
} from "@esp/protocole";
import {
  parserConfigurationEnvironnementOpportunites,
  creerEnvironnementOpportunitesSimulees,
  type ConfigurationEnvironnementOpportunitesJson,
} from "@esp/environnement";
import type { ConfigurationPolitiqueBudgetCognitif } from "@esp/moteur-agent";
import {
  executerContrefactuelUnGene,
  parametresDepuisPolitique,
  voisinsUnPasGene,
  type VoisinGene,
} from "./diagnostic-contrefactuel-un-gene.js";

export const VERSION_SENSIBILITE_GENE_V03 =
  "diagnostic-sensibilite-gene-v03" as const;

export const GENES_DIAGNOSTIC_EXPOSITION_V03: readonly CleGeneMutable[] = [
  "seuilEnjeuPourInferenceMicroUsdc",
  "partMaxVenParCycleBps",
  "plafondCognitifMicroUsdc",
  "comportementSansInference",
] as const;

/** Politique fondatrice de référence (neutre historique — pas un biais D−C). */
export const POLITIQUE_FONDATRICE_DIAGNOSTIC_V03: ConfigurationPolitiqueBudgetCognitif =
  {
    identifiant: "politique-budget-cognitif-agent",
    version: "0.1.0",
    seuilEnjeuPourInferenceMicroUsdc: 100_000n,
    partMaxVenParCycleBps: 50,
    plafondCognitifMicroUsdc: 10_000n,
    modeleLogique: "modele_standard",
    comportementSansInference: "agir_si_favorable",
    refuserSiCritiqueOuDormant: true,
  };

export const ETAT_ECONOMIQUE_DIAGNOSTIC_VEN_HAUTE_V03: EtatEconomiqueAgent = {
  identifiantAgent: "diag-v03-agent",
  capitalLiquide: 8_000_000n,
  obligationsDues: 0n,
  highWaterMarkProprietaire: 8_000_000n,
  totalRevenusActivite: 0n,
  totalPertesActivite: 0n,
  totalDepensesCompute: 0n,
  totalDepensesDonnees: 0n,
  totalFraisExecution: 0n,
  totalLoyersPayes: 0n,
  totalRedevancesProprietairePayees: 0n,
  etatSurvie: "sain",
  cyclesDormanceConsecutifs: 0,
  dernierNumeroCycle: 0,
};

/**
 * États économiques diagnostiques prédéfinis AVANT exécution.
 * VEN haute → plafond cognitif souvent liant ;
 * VEN basse → partMaxVen souvent liante.
 * Aucune sélection selon D−C.
 */
export const ETATS_ECONOMIQUES_DIAGNOSTIC_V03: readonly {
  readonly libelle: "ven_haute" | "ven_basse";
  readonly etat: EtatEconomiqueAgent;
}[] = [
  { libelle: "ven_haute", etat: ETAT_ECONOMIQUE_DIAGNOSTIC_VEN_HAUTE_V03 },
  {
    libelle: "ven_basse",
    etat: {
      ...ETAT_ECONOMIQUE_DIAGNOSTIC_VEN_HAUTE_V03,
      capitalLiquide: 1_000_000n,
      highWaterMarkProprietaire: 1_000_000n,
    },
  },
] as const;

/** @deprecated alias → état VEN haute */
export const ETAT_ECONOMIQUE_DIAGNOSTIC_V03 =
  ETAT_ECONOMIQUE_DIAGNOSTIC_VEN_HAUTE_V03;

export const COUT_OPERATIONNEL_DIAGNOSTIC_V03 = 20_000n;

export type NiveauxSensibiliteV03 = {
  readonly differencePolitique: boolean;
  readonly differenceCognition: boolean;
  readonly differenceDecision: boolean;
  readonly differenceEconomique: boolean;
};

export type ContexteSensibiliteGeneV03 = {
  readonly seed: number;
  readonly numeroCycle: number;
  readonly cleGene: CleGeneMutable;
  readonly voisin: VoisinGene;
  readonly libelleEtatEconomique: "ven_haute" | "ven_basse";
  readonly niveaux: NiveauxSensibiliteV03;
  readonly sensible: boolean;
  readonly identifiantObservation: string;
};

export type AgregatSensibiliteGeneV03 = {
  readonly cleGene: CleGeneMutable;
  readonly voisinRetenu: VoisinGene;
  readonly seedsTotal: number;
  readonly seedsSensibles: number;
  readonly contextesTestes: number;
  readonly contextesSensibles: number;
  readonly cyclesSensibles: number;
  readonly auMoinsUneDifferencePolitique: boolean;
  readonly auMoinsUneDifferenceCognition: boolean;
  readonly auMoinsUneDifferenceDecision: boolean;
  readonly auMoinsUneDifferenceEconomique: boolean;
  readonly typesEffetsObserves: readonly string[];
};

/**
 * Premier voisin valide — règle mécanique déterministe pré-définie.
 */
export function premierVoisinCanoniqueGeneV03(
  cle: CleGeneMutable,
  valeurActuelle: string | number | boolean,
): VoisinGene {
  const voisins = voisinsUnPasGene(cle, valeurActuelle);
  const premier = voisins[0];
  if (premier === undefined) {
    throw new Error(`aucun voisin valide pour le gène ${cle}`);
  }
  return premier;
}

export function voisinsCanoniquesFondateurV03(): Record<
  CleGeneMutable,
  VoisinGene
> {
  const params = parametresDepuisPolitique(POLITIQUE_FONDATRICE_DIAGNOSTIC_V03);
  const out = {} as Record<CleGeneMutable, VoisinGene>;
  for (const cle of GENES_DIAGNOSTIC_EXPOSITION_V03) {
    out[cle] = premierVoisinCanoniqueGeneV03(cle, params[cle]!);
  }
  return out;
}

/**
 * Sensibilité : au moins une différence causale après le génotype.
 * Génotype différent + politique+cognition+décision+éco identiques → non sensible.
 */
export function estContexteSensibleV03(
  niveaux: NiveauxSensibiliteV03,
): boolean {
  return (
    niveaux.differencePolitique ||
    niveaux.differenceCognition ||
    niveaux.differenceDecision ||
    niveaux.differenceEconomique
  );
}

function politiquesDifferentes(
  a: ConfigurationPolitiqueBudgetCognitif,
  b: ConfigurationPolitiqueBudgetCognitif,
): boolean {
  return (
    a.seuilEnjeuPourInferenceMicroUsdc !== b.seuilEnjeuPourInferenceMicroUsdc ||
    a.partMaxVenParCycleBps !== b.partMaxVenParCycleBps ||
    a.plafondCognitifMicroUsdc !== b.plafondCognitifMicroUsdc ||
    a.comportementSansInference !== b.comportementSansInference
  );
}

export function evaluerContexteSensibiliteGeneV03(options: {
  readonly seed: number;
  readonly numeroCycle: number;
  readonly cleGene: CleGeneMutable;
  readonly voisin: VoisinGene;
  readonly environnementDecision: ConfigurationEnvironnementOpportunitesJson;
  readonly etatEconomique?: EtatEconomiqueAgent;
  readonly libelleEtatEconomique?: "ven_haute" | "ven_basse";
  readonly identifiantAgent?: string;
}): ContexteSensibiliteGeneV03 {
  const agent =
    options.identifiantAgent ?? `diag-v03-seed-${String(options.seed)}`;
  const envConf = parserConfigurationEnvironnementOpportunites(
    options.environnementDecision,
  );
  const env = creerEnvironnementOpportunitesSimulees(envConf, options.seed);
  const observation = env.produireObservation({
    identifiantAgent: agent,
    numeroCycle: options.numeroCycle,
  });

  const etatEconomique =
    options.etatEconomique ?? ETAT_ECONOMIQUE_DIAGNOSTIC_VEN_HAUTE_V03;
  const libelleEtatEconomique = options.libelleEtatEconomique ?? "ven_haute";

  const paramsReels = parametresDepuisPolitique(
    POLITIQUE_FONDATRICE_DIAGNOSTIC_V03,
  );
  const paramsCf = {
    ...paramsReels,
    [options.cleGene]: options.voisin.valeur,
  };

  // Vérifie qu'un seul gène change dans l'empreinte génotypique.
  const empRef = empreinteConfigurationHeritable(
    configurationHeritableDepuisPolitiqueBase({
      seuilEnjeuPourInferenceMicroUsdc: BigInt(
        String(paramsReels.seuilEnjeuPourInferenceMicroUsdc),
      ),
      partMaxVenParCycleBps: Number(paramsReels.partMaxVenParCycleBps),
      plafondCognitifMicroUsdc: BigInt(
        String(paramsReels.plafondCognitifMicroUsdc),
      ),
      comportementSansInference: paramsReels.comportementSansInference as
        | "attendre"
        | "agir_si_favorable",
    }),
  );
  const empCf = empreinteConfigurationHeritable({
    version: "configuration-heritable-v01",
    parametres: paramsCf,
  });
  if (empRef === empCf) {
    throw new Error(`voisin non distinct pour ${options.cleGene}`);
  }

  const politiqueRef = resoudrePolitiqueDepuisConfigurationHeritable({
    politiqueBase: POLITIQUE_FONDATRICE_DIAGNOSTIC_V03,
    configurationHeritable: {
      version: "configuration-heritable-v01",
      parametres: paramsReels,
    },
  });
  const politiqueCf = resoudrePolitiqueDepuisConfigurationHeritable({
    politiqueBase: POLITIQUE_FONDATRICE_DIAGNOSTIC_V03,
    configurationHeritable: {
      version: "configuration-heritable-v01",
      parametres: paramsCf,
    },
  });

  const cf = executerContrefactuelUnGene({
    cleGene: options.cleGene,
    typeContrefactuel: "sensibilite_locale",
    valeurContrefactuelle: options.voisin.valeur,
    politiqueBase: POLITIQUE_FONDATRICE_DIAGNOSTIC_V03,
    parametresReels: paramsReels,
    etatEconomique,
    observation,
    coutOperationnelMinimalParCycleMicroUsdc: COUT_OPERATIONNEL_DIAGNOSTIC_V03,
    environnementDecision: envConf,
    graineExperience: options.seed,
    identifiantAgent: agent,
    numeroCycle: options.numeroCycle,
  });

  const niveaux: NiveauxSensibiliteV03 = {
    differencePolitique: politiquesDifferentes(politiqueRef, politiqueCf),
    differenceCognition: cf.expressionCognitive,
    differenceDecision: cf.expressionComportementale,
    differenceEconomique: cf.consequenceEconomiqueImmediate,
  };

  return {
    seed: options.seed,
    numeroCycle: options.numeroCycle,
    cleGene: options.cleGene,
    voisin: options.voisin,
    libelleEtatEconomique,
    niveaux,
    sensible: estContexteSensibleV03(niveaux),
    identifiantObservation: observation.identifiantObservation,
  };
}

export function agregerSensibiliteGeneV03(options: {
  readonly cleGene: CleGeneMutable;
  readonly voisin: VoisinGene;
  readonly contextes: readonly ContexteSensibiliteGeneV03[];
  readonly seeds: readonly number[];
}): AgregatSensibiliteGeneV03 {
  const duGene = options.contextes.filter((c) => c.cleGene === options.cleGene);
  const seedsSensibles = new Set(
    duGene.filter((c) => c.sensible).map((c) => c.seed),
  );
  const cyclesSensibles = new Set(
    duGene
      .filter((c) => c.sensible)
      .map((c) => `${String(c.seed)}:${String(c.numeroCycle)}`),
  );
  const types: string[] = [];
  const hasPol = duGene.some((c) => c.niveaux.differencePolitique);
  const hasCog = duGene.some((c) => c.niveaux.differenceCognition);
  const hasDec = duGene.some((c) => c.niveaux.differenceDecision);
  const hasEco = duGene.some((c) => c.niveaux.differenceEconomique);
  if (hasPol) types.push("politique");
  if (hasCog) types.push("cognition");
  if (hasDec) types.push("decision");
  if (hasEco) types.push("economique");

  return {
    cleGene: options.cleGene,
    voisinRetenu: options.voisin,
    seedsTotal: options.seeds.length,
    seedsSensibles: seedsSensibles.size,
    contextesTestes: duGene.length,
    contextesSensibles: duGene.filter((c) => c.sensible).length,
    cyclesSensibles: cyclesSensibles.size,
    auMoinsUneDifferencePolitique: hasPol,
    auMoinsUneDifferenceCognition: hasCog,
    auMoinsUneDifferenceDecision: hasDec,
    auMoinsUneDifferenceEconomique: hasEco,
    typesEffetsObserves: types,
  };
}

/**
 * Évalue la sensibilité des 4 gènes sur un candidat d'exposition.
 */
export function evaluerSensibiliteCandidatExpositionV03(options: {
  readonly seeds: readonly number[];
  readonly cyclesParSeed: number;
  readonly environnementDecision: ConfigurationEnvironnementOpportunitesJson;
}): {
  readonly contextes: readonly ContexteSensibiliteGeneV03[];
  readonly parGene: readonly AgregatSensibiliteGeneV03[];
} {
  const voisins = voisinsCanoniquesFondateurV03();
  const contextes: ContexteSensibiliteGeneV03[] = [];

  for (const seed of options.seeds) {
    for (let cycle = 1; cycle <= options.cyclesParSeed; cycle += 1) {
      for (const { libelle, etat } of ETATS_ECONOMIQUES_DIAGNOSTIC_V03) {
        for (const cle of GENES_DIAGNOSTIC_EXPOSITION_V03) {
          contextes.push(
            evaluerContexteSensibiliteGeneV03({
              seed,
              numeroCycle: cycle,
              cleGene: cle,
              voisin: voisins[cle],
              environnementDecision: options.environnementDecision,
              etatEconomique: etat,
              libelleEtatEconomique: libelle,
            }),
          );
        }
      }
    }
  }

  const parGene = GENES_DIAGNOSTIC_EXPOSITION_V03.map((cle) =>
    agregerSensibiliteGeneV03({
      cleGene: cle,
      voisin: voisins[cle],
      contextes,
      seeds: options.seeds,
    }),
  );

  return { contextes, parGene };
}
