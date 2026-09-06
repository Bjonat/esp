import { VERSION_SCHEMA_EVENEMENT } from "./evenements-economiques.js";
import { ecrireMontantChargeUtile } from "./evenements-economiques.js";
import type { MicroUsdc } from "./monnaie.js";

/**
 * Taxonomie d'événements Xway — observation d'activité cognitive.
 * Distincte des événements économiques : INFERENCE_EXECUTEE ≠ DEPENSE_COMPUTE.
 */
export const TYPES_EVENEMENT_XWAY = [
  "DEMANDE_INFERENCE_RECUE",
  "DEMANDE_INFERENCE_AUTORISEE",
  "DEMANDE_INFERENCE_REFUSEE",
  "INFERENCE_EXECUTEE",
  "INFERENCE_ECHOUEE",
] as const;

export type TypeEvenementXway = (typeof TYPES_EVENEMENT_XWAY)[number];

export type EntreeEvenementXway = {
  identifiant: string;
  type: TypeEvenementXway;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export type NatureEchecInferenceProtocole =
  | "echec_certain"
  | "resultat_indetermine";

export type ChargeDemandeInference = {
  identifiantDemande: string;
  modeleDemande: string;
  limiteDepenseAutoriseeMicroUsdc: string;
  coutMaximumEstimeMicroUsdc?: string;
  motifRefus?: string;
  detail?: string;
  jetonsEntree?: number;
  jetonsSortie?: number;
  coutFinalMicroUsdc?: string;
  fournisseur?: string;
  /** Présent sur INFERENCE_ECHOUEE — distingue échec certain vs ambiguïté réseau. */
  natureEchec?: NatureEchecInferenceProtocole;
  /** Montant réservé à l'autorisation (capacité opérationnelle, pas une dépense). */
  reservationMicroUsdc?: string;
};

export function estTypeEvenementXway(
  valeur: string,
): valeur is TypeEvenementXway {
  return (TYPES_EVENEMENT_XWAY as readonly string[]).includes(valeur);
}

export function creerEntreeDemandeInferenceRecue(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantDemande: string;
  modeleDemande: string;
  limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementXway {
  return baseEntree(options, "DEMANDE_INFERENCE_RECUE", {
    identifiantDemande: options.identifiantDemande,
    modeleDemande: options.modeleDemande,
    limiteDepenseAutoriseeMicroUsdc: ecrireMontantChargeUtile(
      options.limiteDepenseAutoriseeMicroUsdc,
    ),
  });
}

export function creerEntreeDemandeInferenceAutorisee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantDemande: string;
  modeleDemande: string;
  limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  coutMaximumEstimeMicroUsdc: MicroUsdc;
  /** Égal au coût max estimé — capacité réservée, pas une dépense. */
  reservationMicroUsdc?: MicroUsdc;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementXway {
  const reservation =
    options.reservationMicroUsdc ?? options.coutMaximumEstimeMicroUsdc;
  return baseEntree(options, "DEMANDE_INFERENCE_AUTORISEE", {
    identifiantDemande: options.identifiantDemande,
    modeleDemande: options.modeleDemande,
    limiteDepenseAutoriseeMicroUsdc: ecrireMontantChargeUtile(
      options.limiteDepenseAutoriseeMicroUsdc,
    ),
    coutMaximumEstimeMicroUsdc: ecrireMontantChargeUtile(
      options.coutMaximumEstimeMicroUsdc,
    ),
    reservationMicroUsdc: ecrireMontantChargeUtile(reservation),
  });
}

export function creerEntreeDemandeInferenceRefusee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantDemande: string;
  modeleDemande: string;
  limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  motifRefus: string;
  detail: string;
  coutMaximumEstimeMicroUsdc?: MicroUsdc;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementXway {
  return baseEntree(options, "DEMANDE_INFERENCE_REFUSEE", {
    identifiantDemande: options.identifiantDemande,
    modeleDemande: options.modeleDemande,
    limiteDepenseAutoriseeMicroUsdc: ecrireMontantChargeUtile(
      options.limiteDepenseAutoriseeMicroUsdc,
    ),
    motifRefus: options.motifRefus,
    detail: options.detail,
    ...(options.coutMaximumEstimeMicroUsdc !== undefined
      ? {
          coutMaximumEstimeMicroUsdc: ecrireMontantChargeUtile(
            options.coutMaximumEstimeMicroUsdc,
          ),
        }
      : {}),
  });
}

export function creerEntreeInferenceExecutee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantDemande: string;
  modeleDemande: string;
  jetonsEntree: number;
  jetonsSortie: number;
  coutFinalMicroUsdc: MicroUsdc;
  fournisseur: string;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementXway {
  return baseEntree(options, "INFERENCE_EXECUTEE", {
    identifiantDemande: options.identifiantDemande,
    modeleDemande: options.modeleDemande,
    jetonsEntree: options.jetonsEntree,
    jetonsSortie: options.jetonsSortie,
    coutFinalMicroUsdc: ecrireMontantChargeUtile(options.coutFinalMicroUsdc),
    fournisseur: options.fournisseur,
  });
}

export function creerEntreeInferenceEchouee(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  identifiantDemande: string;
  modeleDemande: string;
  detail: string;
  natureEchec?: NatureEchecInferenceProtocole;
  coutMaximumEstimeMicroUsdc?: MicroUsdc;
  indiceUnicite: number;
  dateEnregistrement?: string;
}): EntreeEvenementXway {
  return baseEntree(options, "INFERENCE_ECHOUEE", {
    identifiantDemande: options.identifiantDemande,
    modeleDemande: options.modeleDemande,
    detail: options.detail,
    natureEchec: options.natureEchec ?? "echec_certain",
    ...(options.coutMaximumEstimeMicroUsdc !== undefined
      ? {
          coutMaximumEstimeMicroUsdc: ecrireMontantChargeUtile(
            options.coutMaximumEstimeMicroUsdc,
          ),
        }
      : {}),
  });
}

function baseEntree(
  options: {
    identifiantExperience: string;
    identifiantAgent: string;
    numeroCycle: number;
    identifiantDemande: string;
    indiceUnicite: number;
    dateEnregistrement?: string;
  },
  type: TypeEvenementXway,
  chargeUtile: Record<string, unknown>,
): EntreeEvenementXway {
  return {
    identifiant: `${type}-${options.identifiantDemande}-u${String(options.indiceUnicite)}`,
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
