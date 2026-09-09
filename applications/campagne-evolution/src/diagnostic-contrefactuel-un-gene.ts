/**
 * Contrefactuels un-gène déterministes (dry-run).
 * Aucun événement économique / décisionnel n'est écrit.
 */

import type {
  ConfigurationHeritableAgent,
  EtatEconomiqueAgent,
  MicroUsdc,
  ObservationOpportunite,
} from "@esp/protocole";
import {
  CATALOGUE_GENES_MUTABLES_V01,
  calculerRunwayEnCycles,
  calculerValeurEconomiqueNette,
  configurationHeritableDepuisPolitiqueBase,
  empreinteConfigurationHeritable,
  resoudrePolitiqueDepuisConfigurationHeritable,
  type CleGeneMutable,
} from "@esp/protocole";
import {
  calculerEnjeuOpportunite,
  deciderBudgetCognitif,
  deciderSansInference,
  type ConfigurationPolitiqueBudgetCognitif,
} from "@esp/moteur-agent";
import {
  creerEnvironnementOpportunitesSimulees,
  type ConfigurationEnvironnementOpportunites,
} from "@esp/environnement";
import { classifierBornesCognitives } from "./diagnostic-bornes-cognitives.js";

export type NiveauExpressionPhenotypique =
  | 0 // mutation génétique
  | 1 // occasion d'expression
  | 2 // expression cognitive
  | 3 // expression comportementale
  | 4; // conséquence économique immédiate

export type VoisinGene = {
  readonly cle: CleGeneMutable;
  readonly valeur: string | number;
  readonly direction: "moins" | "plus" | "alternatif" | "reference";
};

export type ResultatChoixSec = {
  readonly utiliserInference: boolean;
  readonly modeleLogique: string | null;
  readonly limiteDepenseAutoriseeMicroUsdc: string;
  readonly motif: string;
  readonly action: "agir" | "attendre" | null;
  readonly sourceDecision: "sans_inference" | "inference_autorisee" | "non_decidee";
};

export type ResultatContrefactuelUnGene = {
  readonly cleGene: CleGeneMutable;
  readonly typeContrefactuel: "reversion" | "sensibilite_locale";
  readonly valeurReelle: string | number;
  readonly valeurContrefactuelle: string | number;
  readonly identifiantAgent?: string;
  readonly numeroCycle?: number;
  readonly choixReel: ResultatChoixSec;
  readonly choixContrefactuel: ResultatChoixSec;
  readonly occasionExpression: boolean;
  readonly expressionCognitive: boolean;
  readonly expressionComportementale: boolean;
  readonly consequenceEconomiqueImmediate: boolean;
  readonly niveauMax: NiveauExpressionPhenotypique;
  readonly evenementsEconomiquesEcrits: 0;
};

function politiqueDepuisGenes(options: {
  readonly politiqueBase: ConfigurationPolitiqueBudgetCognitif;
  readonly parametres: Record<string, string | number | boolean>;
}): ConfigurationPolitiqueBudgetCognitif {
  const heritable: ConfigurationHeritableAgent = {
    version: "configuration-heritable-v01",
    parametres: options.parametres,
  };
  return resoudrePolitiqueDepuisConfigurationHeritable({
    politiqueBase: options.politiqueBase,
    configurationHeritable: heritable,
  });
}

function parametresDepuisPolitique(
  politique: ConfigurationPolitiqueBudgetCognitif,
): Record<string, string | number | boolean> {
  return configurationHeritableDepuisPolitiqueBase({
    seuilEnjeuPourInferenceMicroUsdc: politique.seuilEnjeuPourInferenceMicroUsdc,
    partMaxVenParCycleBps: politique.partMaxVenParCycleBps,
    plafondCognitifMicroUsdc: politique.plafondCognitifMicroUsdc,
    comportementSansInference: politique.comportementSansInference,
  }).parametres;
}

/**
 * Décision cognitive + action locale sans écrire d'événement.
 * Si l'inférence est autorisée, l'action reste `null` (non déterminée sans Xway)
 * — l'expression cognitive reste mesurable.
 */
export function evaluerChoixSec(options: {
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly observation: ObservationOpportunite;
  readonly politique: ConfigurationPolitiqueBudgetCognitif;
  readonly coutOperationnelMinimalParCycleMicroUsdc: MicroUsdc;
  readonly plafondXwayMicroUsdc?: MicroUsdc;
}): ResultatChoixSec {
  const runway = calculerRunwayEnCycles(
    options.etatEconomique,
    options.coutOperationnelMinimalParCycleMicroUsdc,
  );
  const choix = deciderBudgetCognitif({
    etatEconomique: options.etatEconomique,
    runway,
    observation: options.observation,
    configuration: options.politique,
    ...(options.plafondXwayMicroUsdc !== undefined
      ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
      : {}),
  });

  if (!choix.utiliserInference) {
    const locale = deciderSansInference({
      observation: options.observation,
      comportement: options.politique.comportementSansInference,
    });
    return {
      utiliserInference: false,
      modeleLogique: null,
      limiteDepenseAutoriseeMicroUsdc:
        choix.limiteDepenseAutoriseeMicroUsdc.toString(10),
      motif: choix.motif,
      action: locale.action,
      sourceDecision: "sans_inference",
    };
  }

  return {
    utiliserInference: true,
    modeleLogique: choix.modeleLogique,
    limiteDepenseAutoriseeMicroUsdc:
      choix.limiteDepenseAutoriseeMicroUsdc.toString(10),
    motif: choix.motif,
    action: null,
    sourceDecision: "inference_autorisee",
  };
}

export function voisinsUnPasGene(
  cle: CleGeneMutable,
  valeurActuelle: string | number | boolean,
): readonly VoisinGene[] {
  const def = CATALOGUE_GENES_MUTABLES_V01.find((g) => g.cle === cle);
  if (def === undefined) {
    return [];
  }
  if (def.type === "categoriel") {
    const actuelle =
      valeurActuelle === "attendre" || valeurActuelle === "agir_si_favorable"
        ? valeurActuelle
        : def.defaut;
    return def.valeursAutorisees
      .filter((v) => v !== actuelle)
      .map((v) => ({
        cle,
        valeur: v,
        direction: "alternatif" as const,
      }));
  }
  if (def.type === "bps") {
    const actuelle =
      typeof valeurActuelle === "number" ? valeurActuelle : Number(valeurActuelle);
    const voisins: VoisinGene[] = [];
    const moins = actuelle - def.pasMutation;
    if (moins >= def.minimum) {
      voisins.push({ cle, valeur: moins, direction: "moins" });
    }
    const plus = actuelle + def.pasMutation;
    if (plus <= def.maximum) {
      voisins.push({ cle, valeur: plus, direction: "plus" });
    }
    return voisins;
  }
  // micro_usdc
  const actuelle =
    typeof valeurActuelle === "bigint"
      ? valeurActuelle
      : BigInt(String(valeurActuelle));
  const voisins: VoisinGene[] = [];
  const moins = actuelle - def.pasMutationMicroUsdc;
  if (moins >= def.minimumMicroUsdc) {
    voisins.push({
      cle,
      valeur: moins.toString(10),
      direction: "moins",
    });
  }
  const plus = actuelle + def.pasMutationMicroUsdc;
  if (plus <= def.maximumMicroUsdc) {
    voisins.push({
      cle,
      valeur: plus.toString(10),
      direction: "plus",
    });
  }
  return voisins;
}

function remplacerGene(
  parametres: Record<string, string | number | boolean>,
  cle: CleGeneMutable,
  valeur: string | number | boolean,
): Record<string, string | number | boolean> {
  return { ...parametres, [cle]: valeur };
}

function choicesCognitifsDivergent(
  a: ResultatChoixSec,
  b: ResultatChoixSec,
): boolean {
  return (
    a.utiliserInference !== b.utiliserInference ||
    a.modeleLogique !== b.modeleLogique ||
    a.limiteDepenseAutoriseeMicroUsdc !== b.limiteDepenseAutoriseeMicroUsdc ||
    a.motif !== b.motif
  );
}

/**
 * Occasion d'expression : le contexte est dans une zone où le gène
 * pourrait modifier le calcul (heuristique par gène).
 */
export function evaluerOccasionExpression(options: {
  readonly cleGene: CleGeneMutable;
  readonly politiqueReelle: ConfigurationPolitiqueBudgetCognitif;
  readonly politiqueContrefactuelle: ConfigurationPolitiqueBudgetCognitif;
  readonly observation: ObservationOpportunite;
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly plafondXwayMicroUsdc?: MicroUsdc;
}): boolean {
  const enjeu = calculerEnjeuOpportunite(options.observation);
  const ven = calculerValeurEconomiqueNette(options.etatEconomique);
  const venPositive = ven > 0n ? ven : 0n;

  if (options.cleGene === "seuilEnjeuPourInferenceMicroUsdc") {
    const s0 = options.politiqueReelle.seuilEnjeuPourInferenceMicroUsdc;
    const s1 = options.politiqueContrefactuelle.seuilEnjeuPourInferenceMicroUsdc;
    const bas = s0 < s1 ? s0 : s1;
    const haut = s0 > s1 ? s0 : s1;
    return enjeu >= bas && enjeu < haut;
  }

  if (options.cleGene === "comportementSansInference") {
    // Exposé seulement sans inférence sous la politique réelle OU contrefactuelle.
    const runway = 20; // approximatif pour occasion ; le choix sec précis vient après
    const c0 = deciderBudgetCognitif({
      etatEconomique: options.etatEconomique,
      runway,
      observation: options.observation,
      configuration: options.politiqueReelle,
      ...(options.plafondXwayMicroUsdc !== undefined
        ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
        : {}),
    });
    const c1 = deciderBudgetCognitif({
      etatEconomique: options.etatEconomique,
      runway,
      observation: options.observation,
      configuration: options.politiqueContrefactuelle,
      ...(options.plafondXwayMicroUsdc !== undefined
        ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
        : {}),
    });
    return !c0.utiliserInference || !c1.utiliserInference;
  }

  if (
    options.cleGene === "partMaxVenParCycleBps" ||
    options.cleGene === "plafondCognitifMicroUsdc"
  ) {
    // Occasion si au moins une des deux politiques autorise l'inférence
    // et que les bornes candidates diffèrent.
    const b0 = classifierBornesCognitives({
      etatEconomique: options.etatEconomique,
      observation: options.observation,
      configuration: options.politiqueReelle,
      ...(options.plafondXwayMicroUsdc !== undefined
        ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
        : {}),
    });
    const b1 = classifierBornesCognitives({
      etatEconomique: options.etatEconomique,
      observation: options.observation,
      configuration: options.politiqueContrefactuelle,
      ...(options.plafondXwayMicroUsdc !== undefined
        ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
        : {}),
    });
    if (venPositive <= 0n) {
      return false;
    }
    return (
      b0.limiteFinaleMicroUsdc !== b1.limiteFinaleMicroUsdc ||
      b0.borneDominante !== b1.borneDominante ||
      b0.partVenMicroUsdc !== b1.partVenMicroUsdc ||
      b0.plafondCognitifMicroUsdc !== b1.plafondCognitifMicroUsdc
    );
  }

  return false;
}

function activiteDifferente(options: {
  readonly observation: ObservationOpportunite;
  readonly actionReelle: "agir" | "attendre";
  readonly actionContrefactuelle: "agir" | "attendre";
  readonly environnement: ConfigurationEnvironnementOpportunites;
  readonly graineExperience: number;
}): boolean {
  if (options.actionReelle === options.actionContrefactuelle) {
    return false;
  }
  const env = creerEnvironnementOpportunitesSimulees(
    options.environnement,
    options.graineExperience,
  );
  const r0 = env.executerAction({
    observation: options.observation,
    action: options.actionReelle,
    identifiantDecision: "diag-reel",
  });
  const r1 = env.executerAction({
    observation: options.observation,
    action: options.actionContrefactuelle,
    identifiantDecision: "diag-cf",
  });
  return (
    r0.issue !== r1.issue ||
    r0.activite.revenuActivite !== r1.activite.revenuActivite ||
    r0.activite.perteActivite !== r1.activite.perteActivite ||
    r0.activite.fraisExecution !== r1.activite.fraisExecution
  );
}

export function executerContrefactuelUnGene(options: {
  readonly cleGene: CleGeneMutable;
  readonly typeContrefactuel: "reversion" | "sensibilite_locale";
  readonly valeurContrefactuelle: string | number | boolean;
  readonly politiqueBase: ConfigurationPolitiqueBudgetCognitif;
  readonly parametresReels: Record<string, string | number | boolean>;
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly observation: ObservationOpportunite;
  readonly coutOperationnelMinimalParCycleMicroUsdc: MicroUsdc;
  readonly plafondXwayMicroUsdc?: MicroUsdc;
  readonly environnementDecision?: ConfigurationEnvironnementOpportunites;
  readonly graineExperience?: number;
  readonly actionReelleObservee?: "agir" | "attendre";
  readonly identifiantAgent?: string;
  readonly numeroCycle?: number;
}): ResultatContrefactuelUnGene {
  const valeurReelle = options.parametresReels[options.cleGene] as
    | string
    | number
    | boolean;
  const parametresCf = remplacerGene(
    options.parametresReels,
    options.cleGene,
    options.valeurContrefactuelle,
  );
  const politiqueReelle = politiqueDepuisGenes({
    politiqueBase: options.politiqueBase,
    parametres: options.parametresReels,
  });
  const politiqueCf = politiqueDepuisGenes({
    politiqueBase: options.politiqueBase,
    parametres: parametresCf,
  });

  const choixReel = evaluerChoixSec({
    etatEconomique: options.etatEconomique,
    observation: options.observation,
    politique: politiqueReelle,
    coutOperationnelMinimalParCycleMicroUsdc:
      options.coutOperationnelMinimalParCycleMicroUsdc,
    ...(options.plafondXwayMicroUsdc !== undefined
      ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
      : {}),
  });
  const choixCf = evaluerChoixSec({
    etatEconomique: options.etatEconomique,
    observation: options.observation,
    politique: politiqueCf,
    coutOperationnelMinimalParCycleMicroUsdc:
      options.coutOperationnelMinimalParCycleMicroUsdc,
    ...(options.plafondXwayMicroUsdc !== undefined
      ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
      : {}),
  });

  const occasionExpression = evaluerOccasionExpression({
    cleGene: options.cleGene,
    politiqueReelle,
    politiqueContrefactuelle: politiqueCf,
    observation: options.observation,
    etatEconomique: options.etatEconomique,
    ...(options.plafondXwayMicroUsdc !== undefined
      ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
      : {}),
  });

  const expressionCognitive = choicesCognitifsDivergent(choixReel, choixCf);

  const actionReelEffective =
    options.actionReelleObservee ?? choixReel.action;
  const actionCf = choixCf.action;
  const expressionComportementale =
    actionReelEffective !== null &&
    actionCf !== null &&
    actionReelEffective !== actionCf;

  let consequenceEconomiqueImmediate = false;
  if (
    expressionComportementale &&
    options.environnementDecision !== undefined &&
    options.graineExperience !== undefined &&
    actionReelEffective !== null &&
    actionCf !== null
  ) {
    consequenceEconomiqueImmediate = activiteDifferente({
      observation: options.observation,
      actionReelle: actionReelEffective,
      actionContrefactuelle: actionCf,
      environnement: options.environnementDecision,
      graineExperience: options.graineExperience,
    });
  }

  let niveauMax: NiveauExpressionPhenotypique = 0;
  if (consequenceEconomiqueImmediate) {
    niveauMax = 4;
  } else if (expressionComportementale) {
    niveauMax = 3;
  } else if (expressionCognitive) {
    niveauMax = 2;
  } else if (occasionExpression) {
    niveauMax = 1;
  }

  return {
    cleGene: options.cleGene,
    typeContrefactuel: options.typeContrefactuel,
    valeurReelle:
      typeof valeurReelle === "boolean" ? String(valeurReelle) : valeurReelle,
    valeurContrefactuelle:
      typeof options.valeurContrefactuelle === "boolean"
        ? String(options.valeurContrefactuelle)
        : options.valeurContrefactuelle,
    ...(options.identifiantAgent !== undefined
      ? { identifiantAgent: options.identifiantAgent }
      : {}),
    ...(options.numeroCycle !== undefined
      ? { numeroCycle: options.numeroCycle }
      : {}),
    choixReel,
    choixContrefactuel: choixCf,
    occasionExpression,
    expressionCognitive,
    expressionComportementale,
    consequenceEconomiqueImmediate,
    niveauMax,
    evenementsEconomiquesEcrits: 0,
  };
}

export function empreinteGenes(
  parametres: Record<string, string | number | boolean>,
): string {
  return empreinteConfigurationHeritable({
    version: "configuration-heritable-v01",
    parametres,
  });
}

export { parametresDepuisPolitique, politiqueDepuisGenes };
