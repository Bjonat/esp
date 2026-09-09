/**
 * Vue d'audit reliant génotype → politique → choix → décision → action → résultat.
 * N'ajoute pas d'événements ; projette ceux déjà enregistrés.
 * Aucun chain-of-thought stocké.
 */

import type { EvenementEsp } from "@esp/protocole";

export type TracePhenotypiqueCycle = {
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly empreinteConfiguration?: string;
  readonly observationRecue: boolean;
  readonly choixCognitif?: {
    readonly utiliserInference: boolean;
    readonly modeleLogique: string | null;
    readonly limiteDepenseAutoriseeMicroUsdc: string;
    readonly motif: string;
  };
  readonly proposition?: {
    readonly actionProposee: string;
    readonly confianceBps: number;
  };
  readonly decision?: {
    readonly statut: "validee" | "refusee";
    readonly action?: string;
    readonly sourceDecision?: string;
  };
  readonly action?: {
    readonly action: string;
    readonly issue?: string;
  };
  readonly resultatObserve: boolean;
};

function charge(e: EvenementEsp): Record<string, unknown> {
  return e.chargeUtile as Record<string, unknown>;
}

/**
 * Construit la trace phénotypique d'un agent pour un cycle donné.
 */
export function extraireTracePhenotypiqueCycle(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly empreinteConfiguration?: string;
}): TracePhenotypiqueCycle {
  const { evenements, identifiantAgent, numeroCycle } = options;
  const duCycle = evenements.filter(
    (e) =>
      e.identifiantAgent === identifiantAgent && e.numeroCycle === numeroCycle,
  );

  const observation = duCycle.find((e) => e.type === "OBSERVATION_AGENT_RECUE");
  const choix = duCycle.find((e) => e.type === "CHOIX_COGNITIF_EFFECTUE");
  const proposition = duCycle.find(
    (e) => e.type === "PROPOSITION_DECISION_PRODUITE",
  );
  const validee = duCycle.find((e) => e.type === "DECISION_AGENT_VALIDEE");
  const refusee = duCycle.find((e) => e.type === "DECISION_AGENT_REFUSEE");
  const action = duCycle.find(
    (e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE",
  );
  const resultat = duCycle.find((e) => e.type === "RESULTAT_ACTION_OBSERVE");

  const trace: TracePhenotypiqueCycle = {
    identifiantAgent,
    numeroCycle,
    ...(options.empreinteConfiguration !== undefined
      ? { empreinteConfiguration: options.empreinteConfiguration }
      : {}),
    observationRecue: observation !== undefined,
    resultatObserve: resultat !== undefined,
  };

  if (choix !== undefined) {
    const c = charge(choix);
    Object.assign(trace, {
      choixCognitif: {
        utiliserInference: Boolean(c.utiliserInference),
        modeleLogique:
          c.modeleLogique === null || typeof c.modeleLogique === "string"
            ? (c.modeleLogique as string | null)
            : null,
        limiteDepenseAutoriseeMicroUsdc: String(
          c.limiteDepenseAutoriseeMicroUsdc ?? "0",
        ),
        motif: String(c.motif ?? ""),
      },
    });
  }

  if (proposition !== undefined) {
    const p = charge(proposition);
    Object.assign(trace, {
      proposition: {
        actionProposee: String(p.actionProposee ?? ""),
        confianceBps: Number(p.confianceBps ?? 0),
      },
    });
  }

  if (validee !== undefined) {
    const v = charge(validee);
    Object.assign(trace, {
      decision: {
        statut: "validee" as const,
        action: String(v.action ?? ""),
        ...(typeof v.sourceDecision === "string"
          ? { sourceDecision: v.sourceDecision }
          : {}),
      },
    });
  } else if (refusee !== undefined) {
    Object.assign(trace, {
      decision: { statut: "refusee" as const },
    });
  }

  if (action !== undefined) {
    const a = charge(action);
    Object.assign(trace, {
      action: {
        action: String(a.action ?? ""),
        ...(typeof a.issue === "string" ? { issue: a.issue } : {}),
      },
    });
  }

  return trace;
}

/**
 * Indique si deux traces montrent une expression phénotypique divergente
 * attribuable au génotype (choix, décision ou action différents).
 */
export function tracesPhenotypiquesDivergent(
  a: TracePhenotypiqueCycle,
  b: TracePhenotypiqueCycle,
): boolean {
  const choixA = a.choixCognitif;
  const choixB = b.choixCognitif;
  if (
    choixA !== undefined &&
    choixB !== undefined &&
    (choixA.utiliserInference !== choixB.utiliserInference ||
      choixA.limiteDepenseAutoriseeMicroUsdc !==
        choixB.limiteDepenseAutoriseeMicroUsdc ||
      choixA.motif !== choixB.motif)
  ) {
    return true;
  }
  if (
    a.decision?.action !== undefined &&
    b.decision?.action !== undefined &&
    a.decision.action !== b.decision.action
  ) {
    return true;
  }
  if (
    a.action?.action !== undefined &&
    b.action?.action !== undefined &&
    a.action.action !== b.action.action
  ) {
    return true;
  }
  return false;
}
