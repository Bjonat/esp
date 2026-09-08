import type {
  ActionEnvironnementDecision,
  DecisionAgent,
  ObservationOpportunite,
  PropositionDecision,
} from "@esp/protocole";

/**
 * Frontière critique : LLM → PROPOSITION → Validateur → DecisionAgent.
 * Le LLM n'exécute jamais directement dans l'environnement.
 */

export type ResultatValidationDecision =
  | {
      readonly validee: true;
      readonly decision: DecisionAgent;
    }
  | {
      readonly validee: false;
      readonly motifRefus: string;
      readonly actionProposee?: string;
    };

export type EntreeValidationDecision = {
  readonly proposition: PropositionDecision;
  readonly observation: ObservationOpportunite;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly identifiantDecision: string;
  readonly sourceDecision: DecisionAgent["sourceDecision"];
  readonly coutCognitifMicroUsdc: bigint;
  readonly identifiantDemandeXway?: string;
  readonly modeleLogique?: string;
};

const ACTIONS_CONNUES = new Set<string>(["attendre", "agir"]);

export function validerPropositionDecision(
  entree: EntreeValidationDecision,
): ResultatValidationDecision {
  const { proposition, observation } = entree;

  if (observation.identifiantAgent !== entree.identifiantAgent) {
    return {
      validee: false,
      motifRefus: "agent_observation_incoherent",
      actionProposee: proposition.action,
    };
  }

  if (observation.numeroCycle !== entree.numeroCycle) {
    return {
      validee: false,
      motifRefus: "cycle_observation_incoherent",
      actionProposee: proposition.action,
    };
  }

  if (!ACTIONS_CONNUES.has(proposition.action)) {
    return {
      validee: false,
      motifRefus: "action_hors_whitelist",
      actionProposee: proposition.action,
    };
  }

  const action = proposition.action as ActionEnvironnementDecision;
  if (!observation.actionsAutorisees.includes(action)) {
    return {
      validee: false,
      motifRefus: "action_non_autorisee_observation",
      actionProposee: proposition.action,
    };
  }

  if (
    !Number.isInteger(proposition.confianceBps) ||
    proposition.confianceBps < 0 ||
    proposition.confianceBps > 10_000
  ) {
    return {
      validee: false,
      motifRefus: "confiance_invalide",
      actionProposee: proposition.action,
    };
  }

  if (typeof proposition.resume !== "string" || proposition.resume.trim() === "") {
    return {
      validee: false,
      motifRefus: "resume_invalide",
      actionProposee: proposition.action,
    };
  }

  const decision: DecisionAgent = {
    identifiantDecision: entree.identifiantDecision,
    identifiantObservation: observation.identifiantObservation,
    identifiantAgent: entree.identifiantAgent,
    numeroCycle: entree.numeroCycle,
    action,
    confianceBps: proposition.confianceBps,
    resume: proposition.resume.trim().slice(0, 500),
    sourceDecision: entree.sourceDecision,
    coutCognitifMicroUsdc: entree.coutCognitifMicroUsdc,
    ...(entree.identifiantDemandeXway !== undefined
      ? { identifiantDemandeXway: entree.identifiantDemandeXway }
      : {}),
    ...(entree.modeleLogique !== undefined
      ? { modeleLogique: entree.modeleLogique }
      : {}),
  };

  return { validee: true, decision };
}

/**
 * Parse une proposition structurée depuis le texte fournisseur.
 * Accepte un objet JSON isolé ou une ligne `PROPOSITION_JSON:{...}`.
 */
export function parserPropositionDepuisTexte(
  texte: string,
): PropositionDecision | null {
  const marqueur = "PROPOSITION_JSON:";
  const index = texte.indexOf(marqueur);
  const candidat =
    index >= 0
      ? texte.slice(index + marqueur.length).trim()
      : texte.trim();

  try {
    const debut = candidat.indexOf("{");
    const fin = candidat.lastIndexOf("}");
    if (debut < 0 || fin <= debut) {
      return null;
    }
    const brut = JSON.parse(candidat.slice(debut, fin + 1)) as Record<
      string,
      unknown
    >;
    const confiance =
      typeof brut.confianceBps === "number"
        ? brut.confianceBps
        : typeof brut.confiance === "number"
          ? Math.round(brut.confiance * 10_000)
          : null;
    if (confiance === null || !Number.isInteger(confiance)) {
      return null;
    }
    const action =
      typeof brut.action === "string"
        ? brut.action
        : typeof brut.actionProposee === "string"
          ? brut.actionProposee
          : null;
    if (action === null) {
      return null;
    }
    const resume =
      typeof brut.resume === "string"
        ? brut.resume
        : typeof brut.raison === "string"
          ? brut.raison
          : null;
    if (resume === null) {
      return null;
    }
    return {
      action,
      confianceBps: confiance,
      resume,
    };
  } catch {
    return null;
  }
}
