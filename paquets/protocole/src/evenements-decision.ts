import { VERSION_SCHEMA_EVENEMENT } from "./evenements-economiques.js";
import { ecrireMontantChargeUtile } from "./evenements-economiques.js";
import type { MicroUsdc } from "./monnaie.js";

/**
 * Taxonomie minimale des événements de décision agent.
 * Chaîne causale : OBSERVATION → CHOIX → PROPOSITION → DÉCISION → ACTION → RÉSULTAT.
 * Aucun chain-of-thought brut stocké.
 */
export const TYPES_EVENEMENT_DECISION = [
  "OBSERVATION_AGENT_RECUE",
  "CHOIX_COGNITIF_EFFECTUE",
  "PROPOSITION_DECISION_PRODUITE",
  "DECISION_AGENT_VALIDEE",
  "DECISION_AGENT_REFUSEE",
  "ACTION_ENVIRONNEMENT_EXECUTEE",
  "RESULTAT_ACTION_OBSERVE",
] as const;

export type TypeEvenementDecision = (typeof TYPES_EVENEMENT_DECISION)[number];

export type EntreeEvenementDecision = {
  identifiant: string;
  type: TypeEvenementDecision;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export function estTypeEvenementDecision(
  valeur: string,
): valeur is TypeEvenementDecision {
  return (TYPES_EVENEMENT_DECISION as readonly string[]).includes(valeur);
}

function baseEntree(
  options: {
    identifiantExperience: string;
    identifiantAgent: string;
    numeroCycle: number;
    indiceUnicite: number;
    dateEnregistrement?: string;
  },
  type: TypeEvenementDecision,
  chargeUtile: Readonly<Record<string, unknown>>,
): EntreeEvenementDecision {
  return {
    identifiant: `${options.identifiantAgent}-${type}-c${String(options.numeroCycle)}-u${String(options.indiceUnicite)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type,
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantAgent,
    numeroCycle: options.numeroCycle,
    chargeUtile,
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}

export function creerEntreeObservationAgentRecue(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  typeObservation: string;
  donnees: Readonly<Record<string, unknown>>;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "OBSERVATION_AGENT_RECUE", {
    identifiantObservation: options.identifiantObservation,
    typeObservation: options.typeObservation,
    donnees: options.donnees,
  });
}

export function creerEntreeChoixCognitifEffectue(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  utiliserInference: boolean;
  modeleLogique: string | null;
  limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  motif: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "CHOIX_COGNITIF_EFFECTUE", {
    identifiantObservation: options.identifiantObservation,
    utiliserInference: options.utiliserInference,
    modeleLogique: options.modeleLogique,
    limiteDepenseAutoriseeMicroUsdc: ecrireMontantChargeUtile(
      options.limiteDepenseAutoriseeMicroUsdc,
    ),
    motif: options.motif,
  });
}

export function creerEntreePropositionDecisionProduite(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  identifiantDecision: string;
  identifiantDemandeXway?: string;
  actionProposee: string;
  confianceBps: number;
  resume: string;
  modeleLogique?: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "PROPOSITION_DECISION_PRODUITE", {
    identifiantObservation: options.identifiantObservation,
    identifiantDecision: options.identifiantDecision,
    ...(options.identifiantDemandeXway !== undefined
      ? { identifiantDemandeXway: options.identifiantDemandeXway }
      : {}),
    actionProposee: options.actionProposee,
    confianceBps: options.confianceBps,
    resume: options.resume,
    ...(options.modeleLogique !== undefined
      ? { modeleLogique: options.modeleLogique }
      : {}),
  });
}

export function creerEntreeDecisionAgentValidee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  identifiantDecision: string;
  action: string;
  confianceBps: number;
  resume: string;
  sourceDecision: string;
  coutCognitifMicroUsdc: MicroUsdc;
  identifiantDemandeXway?: string;
  modeleLogique?: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "DECISION_AGENT_VALIDEE", {
    identifiantObservation: options.identifiantObservation,
    identifiantDecision: options.identifiantDecision,
    action: options.action,
    confianceBps: options.confianceBps,
    resume: options.resume,
    sourceDecision: options.sourceDecision,
    coutCognitifMicroUsdc: ecrireMontantChargeUtile(
      options.coutCognitifMicroUsdc,
    ),
    ...(options.identifiantDemandeXway !== undefined
      ? { identifiantDemandeXway: options.identifiantDemandeXway }
      : {}),
    ...(options.modeleLogique !== undefined
      ? { modeleLogique: options.modeleLogique }
      : {}),
  });
}

export function creerEntreeDecisionAgentRefusee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  identifiantDecision: string;
  motifRefus: string;
  actionProposee?: string;
  coutCognitifMicroUsdc: MicroUsdc;
  identifiantDemandeXway?: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "DECISION_AGENT_REFUSEE", {
    identifiantObservation: options.identifiantObservation,
    identifiantDecision: options.identifiantDecision,
    motifRefus: options.motifRefus,
    ...(options.actionProposee !== undefined
      ? { actionProposee: options.actionProposee }
      : {}),
    coutCognitifMicroUsdc: ecrireMontantChargeUtile(
      options.coutCognitifMicroUsdc,
    ),
    ...(options.identifiantDemandeXway !== undefined
      ? { identifiantDemandeXway: options.identifiantDemandeXway }
      : {}),
  });
}

export function creerEntreeActionEnvironnementExecutee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  identifiantDecision: string;
  identifiantAction: string;
  action: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "ACTION_ENVIRONNEMENT_EXECUTEE", {
    identifiantObservation: options.identifiantObservation,
    identifiantDecision: options.identifiantDecision,
    identifiantAction: options.identifiantAction,
    action: options.action,
  });
}

export function creerEntreeResultatActionObserve(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantObservation: string;
  identifiantDecision: string;
  identifiantAction: string;
  issue: "succes" | "echec" | "aucune";
  revenuActiviteMicroUsdc: MicroUsdc;
  perteActiviteMicroUsdc: MicroUsdc;
  fraisExecutionMicroUsdc: MicroUsdc;
  /** Relie le résultat d'action à l'exécution économique du même cycle. */
  identifiantExecutionEconomique?: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementDecision {
  return baseEntree(options, "RESULTAT_ACTION_OBSERVE", {
    identifiantObservation: options.identifiantObservation,
    identifiantDecision: options.identifiantDecision,
    identifiantAction: options.identifiantAction,
    issue: options.issue,
    revenuActiviteMicroUsdc: ecrireMontantChargeUtile(
      options.revenuActiviteMicroUsdc,
    ),
    perteActiviteMicroUsdc: ecrireMontantChargeUtile(
      options.perteActiviteMicroUsdc,
    ),
    fraisExecutionMicroUsdc: ecrireMontantChargeUtile(
      options.fraisExecutionMicroUsdc,
    ),
    ...(options.identifiantExecutionEconomique !== undefined
      ? {
          identifiantExecutionEconomique:
            options.identifiantExecutionEconomique,
        }
      : {}),
  });
}
