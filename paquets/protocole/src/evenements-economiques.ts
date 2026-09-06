import type { MicroUsdc } from "./monnaie.js";
import { parserMicroUsdc, serialiserMicroUsdc } from "./monnaie.js";
import type { EtatSurvie } from "./etat-survie.js";

/** Version du schéma d'événements économiques ESP v0.1. */
export const VERSION_SCHEMA_EVENEMENT = 1 as const;

/**
 * Taxonomie versionnée des événements économiques (ESP-ECO-001).
 * Pas de chaîne libre pour les types économiques du noyau.
 */
export const TYPES_EVENEMENT_ECONOMIQUE = [
  "AGENT_CREE",
  "CYCLE_DEMARRE",
  "CYCLE_TERMINE",
  "CAPITAL_INITIAL_ATTRIBUE",
  "REVENU_ACTIVITE",
  "PERTE_ACTIVITE",
  "DEPENSE_COMPUTE",
  "DEPENSE_DONNEES",
  "FRAIS_EXECUTION",
  "LOYER_INFRASTRUCTURE_DU",
  "LOYER_INFRASTRUCTURE_PAYE",
  "REDEVANCE_PROPRIETAIRE_DUE",
  "REDEVANCE_PROPRIETAIRE_PAYEE",
  "DETTE_CREEE",
  "DETTE_REGLEE",
  "ETAT_SURVIE_MODIFIE",
  "AGENT_DORMANT",
  "AGENT_MORT",
  "TRANSFERT_INTERNE",
  "DEPENSE_INFRASTRUCTURE_PROPRIETAIRE",
] as const;

export type TypeEvenementEconomique =
  (typeof TYPES_EVENEMENT_ECONOMIQUE)[number];

/**
 * Événement économique du protocole ESP.
 * La vérité expérimentale est (numeroCycle, sequence), pas l'horloge système (ESP-ECO-013).
 */
export interface EvenementEconomique {
  readonly identifiant: string;
  readonly versionSchema: typeof VERSION_SCHEMA_EVENEMENT | number;
  readonly type: TypeEvenementEconomique;
  readonly identifiantExperience: string;
  readonly identifiantAgent?: string;
  readonly numeroCycle: number;
  readonly sequence: number;
  /**
   * Charge utile typée métier.
   * Les montants MicroUsdc y sont sérialisés en chaîne décimale.
   */
  readonly chargeUtile: Readonly<Record<string, unknown>>;
  /** Horodatage informatif uniquement — jamais une règle économique. */
  readonly dateEnregistrement?: string;
}

/**
 * Entrée d'événement avant persistance.
 * La `sequence` est attribuée exclusivement par le registre (par expérience).
 */
export type EntreeEvenementEconomique = {
  identifiant: string;
  type: TypeEvenementEconomique;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementEconomique(
  valeur: string,
): valeur is TypeEvenementEconomique {
  return (TYPES_EVENEMENT_ECONOMIQUE as readonly string[]).includes(valeur);
}

/** Lit un montant micro-USDC depuis une charge utile sérialisée. */
export function lireMontantChargeUtile(
  chargeUtile: Readonly<Record<string, unknown>>,
  cle: string,
): MicroUsdc {
  const brut = chargeUtile[cle];
  if (typeof brut !== "string") {
    throw new Error(
      `Charge utile : montant attendu (chaîne) pour « ${cle} », reçu ${typeof brut}`,
    );
  }
  return parserMicroUsdc(brut);
}

export function ecrireMontantChargeUtile(montant: MicroUsdc): string {
  return serialiserMicroUsdc(montant);
}

export type ChargeCapitalInitial = {
  montantMicroUsdc: string;
};

/**
 * Payload canonique de naissance d'un agent (domaine protocole).
 * Le contrôleur fournit les valeurs ; il ne fabrique pas une forme ad hoc.
 */
export type ChargeAgentCree = {
  generation: number;
  indexPopulation: number;
  dateNaissance: string;
  identifiantParent?: string;
};

export type ChargeMontantSimple = {
  montantMicroUsdc: string;
};

export type ChargeEtatSurvie = {
  depuis: EtatSurvie;
  vers: EtatSurvie;
};

export type ChargeTransfertInterne = {
  identifiantAgentSource: string;
  identifiantAgentDestinataire: string;
  montantMicroUsdc: string;
  sens: "sortie" | "entree";
  identifiantTransfert: string;
};

export type ChargeDette = {
  motif: "loyer_infrastructure" | "redevance_proprietaire" | "autre";
  montantMicroUsdc: string;
};

export type ChargeRedevance = {
  montantMicroUsdc: string;
  profitTaxableMicroUsdc: string;
  highWaterMarkAvantMicroUsdc: string;
  highWaterMarkApresMicroUsdc: string;
};
