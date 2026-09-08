import {
  calculerUsageInference,
  estimerCoutInference,
} from "./couts.js";
import type { FournisseurInference } from "./fournisseur.js";
import type {
  DemandeInference,
  EstimationCoutInference,
  ReponseInference,
  TarifModeleInference,
} from "./types.js";

/**
 * ============================================================================
 * FOURNISSEUR D'INFÉRENCE SIMULÉ — DÉVELOPPEMENT
 * ============================================================================
 * Déterministe, sans réseau, sans SDK.
 * La « réponse » n'est PAS une pensée intelligente — pure charge utile technique.
 * Si le message contient OBSERVATION_DECISION, émet une PROPOSITION_JSON déterministe.
 */
export class FournisseurInferenceSimule implements FournisseurInference {
  estimerCout(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): EstimationCoutInference {
    return estimerCoutInference(demande, tarif);
  }

  async inferer(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): Promise<ReponseInference> {
    const usage = calculerUsageInference({ demande, tarif });
    const meta = [
      "[FOURNISSEUR SIMULÉ — aucune IA réelle]",
      `demande=${demande.identifiantDemande}`,
      `modele=${demande.modeleDemande}`,
      `jetonsEntree=${String(usage.jetonsEntree)}`,
      `jetonsSortie=${String(usage.jetonsSortie)}`,
      `coutMicroUsdc=${usage.coutMicroUsdc.toString(10)}`,
    ].join(" | ");

    const proposition = produirePropositionSimulee(demande);
    const texte =
      proposition === null
        ? meta
        : `${meta}\nPROPOSITION_JSON:${JSON.stringify(proposition)}`;

    return { texte, usage };
  }
}

function produirePropositionSimulee(
  demande: DemandeInference,
): { action: string; confianceBps: number; resume: string } | null {
  const messageObs = demande.messages.find((m) =>
    m.contenu.includes("OBSERVATION_DECISION:"),
  );
  if (messageObs === undefined) {
    return null;
  }
  const index = messageObs.contenu.indexOf("OBSERVATION_DECISION:");
  const jsonTexte = messageObs.contenu.slice(index + "OBSERVATION_DECISION:".length);
  try {
    const obs = JSON.parse(jsonTexte) as {
      probabiliteSuccesBps?: number;
      gainSiSuccesMicroUsdc?: string;
      perteSiEchecMicroUsdc?: string;
      fraisActionMicroUsdc?: string;
    };
    const p = BigInt(obs.probabiliteSuccesBps ?? 0);
    const gain = BigInt(obs.gainSiSuccesMicroUsdc ?? "0");
    const perte = BigInt(obs.perteSiEchecMicroUsdc ?? "0");
    const frais = BigInt(obs.fraisActionMicroUsdc ?? "0");
    const esperance = (gain * p - perte * (10_000n - p)) / 10_000n - frais;
    if (esperance > 0n) {
      return {
        action: "agir",
        confianceBps: Number(p > 10_000n ? 10_000n : p),
        resume: "Proposition simulée : EV positive → agir",
      };
    }
    return {
      action: "attendre",
      confianceBps: Number(10_000n - (p > 10_000n ? 10_000n : p)),
      resume: "Proposition simulée : EV non positive → attendre",
    };
  } catch {
    return {
      action: "attendre",
      confianceBps: 5000,
      resume: "Proposition simulée : observation illisible → attendre",
    };
  }
}

export function creerFournisseurInferenceSimule(): FournisseurInferenceSimule {
  return new FournisseurInferenceSimule();
}
