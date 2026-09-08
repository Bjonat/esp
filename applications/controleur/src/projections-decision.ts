/**
 * Projections d'activité décisionnelle — reconstruites depuis le registre.
 * Aucun score de fitness. Métriques descriptives uniquement.
 */

import type { EvenementEsp, MicroUsdc } from "@esp/protocole";
import { lireMontantChargeUtile } from "@esp/protocole";
import type { MontantApi } from "./serialisation-api.js";
import { serialiserMontantApi } from "./serialisation-api.js";

export type ProjectionDecisionAgent = {
  readonly identifiantDecision: string;
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly observation: {
    readonly typeObservation: string;
    readonly probabiliteSuccesBps: number | null;
    readonly gainSiSucces: MontantApi | null;
    readonly perteSiEchec: MontantApi | null;
    readonly fraisAction: MontantApi | null;
    readonly description: string | null;
    readonly actionsAutorisees: readonly string[];
  };
  readonly choixCognitif: {
    readonly utiliserInference: boolean;
    readonly modeleLogique: string | null;
    readonly limiteDepense: MontantApi | null;
    readonly motif: string | null;
  } | null;
  readonly proposition: {
    readonly action: string;
    readonly confianceBps: number;
    readonly resume: string;
  } | null;
  readonly decision: {
    readonly action: string;
    readonly confianceBps: number;
    readonly resume: string;
    readonly sourceDecision: string;
    readonly modeleLogique: string | null;
    readonly statutValidation: "validee" | "refusee_puis_repli";
  } | null;
  readonly action: string | null;
  readonly resultat: {
    readonly issue: string;
    readonly revenuActivite: MontantApi;
    readonly perteActivite: MontantApi;
    readonly fraisExecution: MontantApi;
  } | null;
  readonly coutCognitif: MontantApi;
  readonly identifiantDemandeXway: string | null;
  readonly identifiantAction: string | null;
};

export type ProjectionActiviteDecisionnelle = {
  readonly decisions: number;
  readonly decisionsAvecInference: number;
  readonly decisionsSansInference: number;
  readonly actionsAgir: number;
  readonly actionsAttendre: number;
  readonly succes: number;
  readonly echecs: number;
  readonly computeCognitif: MontantApi;
  readonly revenusActivite: MontantApi;
  readonly pertesActivite: MontantApi;
  /** Défini seulement si computeCognitif > 0. */
  readonly coutCognitifParDecision: MontantApi | null;
  /** Défini seulement si computeCognitif > 0. */
  readonly resultatActiviteSurCoutCognitif: string | null;
  readonly cycleCourant: {
    readonly decisions: number;
    readonly pourcentAvecInference: number | null;
    readonly coutCognitif: MontantApi;
    readonly actionsAgir: number;
    readonly actionsAttendre: number;
    readonly succes: number;
    readonly echecs: number;
  };
};

export type ProjectionDecisionAgentResume = {
  readonly nombreDecisions: number;
  readonly appelsCognitifs: number;
  readonly coutCognitifCumule: MontantApi;
  readonly actionsAgir: number;
  readonly actionsAttendre: number;
  readonly succes: number;
  readonly echecs: number;
  readonly resultatActiviteCumule: MontantApi;
};

type AccumulatuerDecision = {
  identifiantDecision: string;
  identifiantObservation: string;
  identifiantAgent: string;
  numeroCycle: number;
  observation: ProjectionDecisionAgent["observation"] | null;
  choixCognitif: ProjectionDecisionAgent["choixCognitif"];
  proposition: ProjectionDecisionAgent["proposition"];
  decision: ProjectionDecisionAgent["decision"];
  action: string | null;
  resultat: ProjectionDecisionAgent["resultat"];
  coutCognitif: MicroUsdc;
  identifiantDemandeXway: string | null;
  identifiantAction: string | null;
  refusee: boolean;
};

function lireMontantOptionnel(valeur: unknown): MicroUsdc | null {
  if (typeof valeur !== "string") {
    return null;
  }
  try {
    return lireMontantChargeUtile({ montant: valeur }, "montant");
  } catch {
    return null;
  }
}

function montantOuZero(valeur: MicroUsdc | null): MontantApi {
  return serialiserMontantApi(valeur ?? 0n);
}

/**
 * Reconstruit les décisions depuis les événements de décision du registre.
 */
export function projeterDecisionsDepuisRegistre(
  evenements: readonly EvenementEsp[],
  filtreAgent?: string,
): ProjectionDecisionAgent[] {
  const parCle = new Map<string, AccumulatuerDecision>();

  const cle = (agent: string, cycle: number) => `${agent}|${String(cycle)}`;

  for (const evenement of evenements) {
    const agent = evenement.identifiantAgent;
    if (agent === undefined) {
      continue;
    }
    if (filtreAgent !== undefined && agent !== filtreAgent) {
      continue;
    }
    const charge = evenement.chargeUtile ?? {};
    const k = cle(agent, evenement.numeroCycle);
    let acc = parCle.get(k);
    if (acc === undefined) {
      acc = {
        identifiantDecision:
          typeof charge.identifiantDecision === "string"
            ? charge.identifiantDecision
            : `${agent}-dec-c${String(evenement.numeroCycle)}`,
        identifiantObservation:
          typeof charge.identifiantObservation === "string"
            ? charge.identifiantObservation
            : `${agent}-obs-c${String(evenement.numeroCycle)}`,
        identifiantAgent: agent,
        numeroCycle: evenement.numeroCycle,
        observation: null,
        choixCognitif: null,
        proposition: null,
        decision: null,
        action: null,
        resultat: null,
        coutCognitif: 0n,
        identifiantDemandeXway: null,
        identifiantAction: null,
        refusee: false,
      };
      parCle.set(k, acc);
    }

    switch (evenement.type) {
      case "OBSERVATION_AGENT_RECUE": {
        const donnees =
          charge.donnees !== null &&
          typeof charge.donnees === "object" &&
          !Array.isArray(charge.donnees)
            ? (charge.donnees as Record<string, unknown>)
            : {};
        const actions = Array.isArray(donnees.actionsAutorisees)
          ? donnees.actionsAutorisees.filter(
              (a): a is string => typeof a === "string",
            )
          : [];
        acc.identifiantObservation =
          typeof charge.identifiantObservation === "string"
            ? charge.identifiantObservation
            : acc.identifiantObservation;
        acc.observation = {
          typeObservation:
            typeof charge.typeObservation === "string"
              ? charge.typeObservation
              : "inconnu",
          probabiliteSuccesBps:
            typeof donnees.probabiliteSuccesBps === "number"
              ? donnees.probabiliteSuccesBps
              : null,
          gainSiSucces: montantOuZero(
            lireMontantOptionnel(donnees.gainSiSuccesMicroUsdc),
          ),
          perteSiEchec: montantOuZero(
            lireMontantOptionnel(donnees.perteSiEchecMicroUsdc),
          ),
          fraisAction: montantOuZero(
            lireMontantOptionnel(donnees.fraisActionMicroUsdc),
          ),
          description:
            typeof donnees.description === "string"
              ? donnees.description
              : null,
          actionsAutorisees: actions,
        };
        break;
      }
      case "CHOIX_COGNITIF_EFFECTUE": {
        acc.choixCognitif = {
          utiliserInference: charge.utiliserInference === true,
          modeleLogique:
            typeof charge.modeleLogique === "string"
              ? charge.modeleLogique
              : null,
          limiteDepense: montantOuZero(
            lireMontantOptionnel(charge.limiteDepenseAutoriseeMicroUsdc),
          ),
          motif: typeof charge.motif === "string" ? charge.motif : null,
        };
        break;
      }
      case "PROPOSITION_DECISION_PRODUITE": {
        acc.proposition = {
          action:
            typeof charge.actionProposee === "string"
              ? charge.actionProposee
              : "?",
          confianceBps:
            typeof charge.confianceBps === "number" ? charge.confianceBps : 0,
          resume: typeof charge.resume === "string" ? charge.resume : "",
        };
        if (typeof charge.identifiantDemandeXway === "string") {
          acc.identifiantDemandeXway = charge.identifiantDemandeXway;
        }
        if (typeof charge.identifiantDecision === "string") {
          acc.identifiantDecision = charge.identifiantDecision;
        }
        break;
      }
      case "DECISION_AGENT_REFUSEE": {
        acc.refusee = true;
        const cout = lireMontantOptionnel(charge.coutCognitifMicroUsdc);
        if (cout !== null) {
          acc.coutCognitif = cout;
        }
        break;
      }
      case "DECISION_AGENT_VALIDEE": {
        if (typeof charge.identifiantDecision === "string") {
          acc.identifiantDecision = charge.identifiantDecision;
        }
        const cout = lireMontantOptionnel(charge.coutCognitifMicroUsdc);
        if (cout !== null) {
          acc.coutCognitif = cout;
        }
        if (typeof charge.identifiantDemandeXway === "string") {
          acc.identifiantDemandeXway = charge.identifiantDemandeXway;
        }
        acc.decision = {
          action: typeof charge.action === "string" ? charge.action : "?",
          confianceBps:
            typeof charge.confianceBps === "number" ? charge.confianceBps : 0,
          resume: typeof charge.resume === "string" ? charge.resume : "",
          sourceDecision:
            typeof charge.sourceDecision === "string"
              ? charge.sourceDecision
              : "?",
          modeleLogique:
            typeof charge.modeleLogique === "string"
              ? charge.modeleLogique
              : null,
          statutValidation: acc.refusee
            ? "refusee_puis_repli"
            : "validee",
        };
        break;
      }
      case "ACTION_ENVIRONNEMENT_EXECUTEE": {
        acc.action = typeof charge.action === "string" ? charge.action : null;
        if (typeof charge.identifiantAction === "string") {
          acc.identifiantAction = charge.identifiantAction;
        }
        break;
      }
      case "RESULTAT_ACTION_OBSERVE": {
        acc.resultat = {
          issue: typeof charge.issue === "string" ? charge.issue : "?",
          revenuActivite: montantOuZero(
            lireMontantOptionnel(charge.revenuActiviteMicroUsdc),
          ),
          perteActivite: montantOuZero(
            lireMontantOptionnel(charge.perteActiviteMicroUsdc),
          ),
          fraisExecution: montantOuZero(
            lireMontantOptionnel(charge.fraisExecutionMicroUsdc),
          ),
        };
        if (typeof charge.identifiantAction === "string") {
          acc.identifiantAction = charge.identifiantAction;
        }
        break;
      }
      default:
        break;
    }
  }

  return [...parCle.values()]
    .filter((a) => a.observation !== null)
    .map((a) => ({
      identifiantDecision: a.identifiantDecision,
      identifiantObservation: a.identifiantObservation,
      identifiantAgent: a.identifiantAgent,
      numeroCycle: a.numeroCycle,
      observation: a.observation!,
      choixCognitif: a.choixCognitif,
      proposition: a.proposition,
      decision: a.decision,
      action: a.action,
      resultat: a.resultat,
      coutCognitif: serialiserMontantApi(a.coutCognitif),
      identifiantDemandeXway: a.identifiantDemandeXway,
      identifiantAction: a.identifiantAction,
    }))
    .sort(
      (a, b) =>
        a.numeroCycle - b.numeroCycle ||
        a.identifiantAgent.localeCompare(b.identifiantAgent),
    );
}

export function projeterActiviteDecisionnelle(
  decisions: readonly ProjectionDecisionAgent[],
  numeroCycleCourant: number,
): ProjectionActiviteDecisionnelle {
  let avecInference = 0;
  let sansInference = 0;
  let agir = 0;
  let attendre = 0;
  let succes = 0;
  let echecs = 0;
  let compute = 0n;
  let revenus = 0n;
  let pertes = 0n;

  let cycleDecisions = 0;
  let cycleInference = 0;
  let cycleAgir = 0;
  let cycleAttendre = 0;
  let cycleSucces = 0;
  let cycleEchecs = 0;
  let cycleCompute = 0n;

  for (const d of decisions) {
    const cout = BigInt(d.coutCognitif.microUsdc);
    compute += cout;
    if (d.choixCognitif?.utiliserInference === true) {
      avecInference += 1;
    } else {
      sansInference += 1;
    }
    if (d.action === "agir") {
      agir += 1;
    } else if (d.action === "attendre") {
      attendre += 1;
    }
    if (d.resultat?.issue === "succes") {
      succes += 1;
    } else if (d.resultat?.issue === "echec") {
      echecs += 1;
    }
    if (d.resultat !== null) {
      revenus += BigInt(d.resultat.revenuActivite.microUsdc);
      pertes += BigInt(d.resultat.perteActivite.microUsdc);
    }

    if (d.numeroCycle === numeroCycleCourant) {
      cycleDecisions += 1;
      cycleCompute += cout;
      if (d.choixCognitif?.utiliserInference === true) {
        cycleInference += 1;
      }
      if (d.action === "agir") {
        cycleAgir += 1;
      } else if (d.action === "attendre") {
        cycleAttendre += 1;
      }
      if (d.resultat?.issue === "succes") {
        cycleSucces += 1;
      } else if (d.resultat?.issue === "echec") {
        cycleEchecs += 1;
      }
    }
  }

  const total = decisions.length;
  const coutParDecision =
    total > 0 && compute > 0n
      ? serialiserMontantApi(compute / BigInt(total))
      : null;
  const resultatNet = revenus - pertes;
  const ratio =
    compute > 0n
      ? (Number(resultatNet) / Number(compute)).toFixed(6)
      : null;

  return {
    decisions: total,
    decisionsAvecInference: avecInference,
    decisionsSansInference: sansInference,
    actionsAgir: agir,
    actionsAttendre: attendre,
    succes,
    echecs,
    computeCognitif: serialiserMontantApi(compute),
    revenusActivite: serialiserMontantApi(revenus),
    pertesActivite: serialiserMontantApi(pertes),
    coutCognitifParDecision: coutParDecision,
    resultatActiviteSurCoutCognitif: ratio,
    cycleCourant: {
      decisions: cycleDecisions,
      pourcentAvecInference:
        cycleDecisions > 0
          ? Math.round((cycleInference * 10000) / cycleDecisions) / 100
          : null,
      coutCognitif: serialiserMontantApi(cycleCompute),
      actionsAgir: cycleAgir,
      actionsAttendre: cycleAttendre,
      succes: cycleSucces,
      echecs: cycleEchecs,
    },
  };
}

export function projeterResumeDecisionAgent(
  decisions: readonly ProjectionDecisionAgent[],
): ProjectionDecisionAgentResume {
  let appels = 0;
  let cout = 0n;
  let agir = 0;
  let attendre = 0;
  let succes = 0;
  let echecs = 0;
  let resultat = 0n;

  for (const d of decisions) {
    cout += BigInt(d.coutCognitif.microUsdc);
    if (d.choixCognitif?.utiliserInference === true) {
      appels += 1;
    }
    if (d.action === "agir") {
      agir += 1;
    } else if (d.action === "attendre") {
      attendre += 1;
    }
    if (d.resultat?.issue === "succes") {
      succes += 1;
    } else if (d.resultat?.issue === "echec") {
      echecs += 1;
    }
    if (d.resultat !== null) {
      resultat +=
        BigInt(d.resultat.revenuActivite.microUsdc) -
        BigInt(d.resultat.perteActivite.microUsdc) -
        BigInt(d.resultat.fraisExecution.microUsdc);
    }
  }

  return {
    nombreDecisions: decisions.length,
    appelsCognitifs: appels,
    coutCognitifCumule: serialiserMontantApi(cout),
    actionsAgir: agir,
    actionsAttendre: attendre,
    succes,
    echecs,
    resultatActiviteCumule: serialiserMontantApi(resultat),
  };
}
