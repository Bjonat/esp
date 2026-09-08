import type {
  DecisionAgent,
  EvenementEsp,
  ObservationOpportunite,
  SourceDecisionAgent,
} from "@esp/protocole";
import { lireMontantChargeUtile } from "@esp/protocole";
import type { ResultatMoteurDecision } from "@esp/moteur-agent";
import type { ResultatActionEnvironnement } from "@esp/environnement";
import type { EtatRepriseCycleDecision } from "./cycle-decision.js";

/**
 * Détermine l'état de reprise d'un cycle décisionnel pour un agent.
 * Évite double observation / inférence / action / débit économique.
 */
export function reconstruireEtatRepriseCycleDecision(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
}): EtatRepriseCycleDecision | undefined {
  const pertinents = options.evenements.filter(
    (e) =>
      e.identifiantAgent === options.identifiantAgent &&
      e.numeroCycle === options.numeroCycle,
  );
  if (pertinents.length === 0) {
    return undefined;
  }

  const cycleEcoTermine = pertinents.some((e) => e.type === "CYCLE_TERMINE");
  if (cycleEcoTermine) {
    return { resultatDejaObserve: true, cycleEconomiqueDejaExecute: true };
  }

  const obsEvt = pertinents.find((e) => e.type === "OBSERVATION_AGENT_RECUE");
  if (obsEvt === undefined) {
    return undefined;
  }

  const observation = reconstruireObservationDepuisEvenement(obsEvt);
  const decisionValidee = [...pertinents]
    .reverse()
    .find((e) => e.type === "DECISION_AGENT_VALIDEE");
  const resultatEvt = pertinents.find(
    (e) => e.type === "RESULTAT_ACTION_OBSERVE",
  );
  const actionEvt = pertinents.find(
    (e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE",
  );
  const choixEvt = pertinents.find((e) => e.type === "CHOIX_COGNITIF_EFFECTUE");
  const propEvt = pertinents.find(
    (e) => e.type === "PROPOSITION_DECISION_PRODUITE",
  );
  const refuseeEvt = pertinents.find(
    (e) => e.type === "DECISION_AGENT_REFUSEE",
  );

  let resultatMoteur: ResultatMoteurDecision | undefined;
  if (decisionValidee !== undefined && choixEvt !== undefined) {
    const chargeDec = decisionValidee.chargeUtile ?? {};
    const chargeChoix = choixEvt.chargeUtile ?? {};
    const chargeProp = propEvt?.chargeUtile ?? {};
    const decision: DecisionAgent = {
      identifiantDecision: String(chargeDec.identifiantDecision ?? ""),
      identifiantObservation: String(chargeDec.identifiantObservation ?? ""),
      identifiantAgent: options.identifiantAgent,
      numeroCycle: options.numeroCycle,
      action: chargeDec.action === "agir" ? "agir" : "attendre",
      confianceBps:
        typeof chargeDec.confianceBps === "number" ? chargeDec.confianceBps : 0,
      resume: typeof chargeDec.resume === "string" ? chargeDec.resume : "",
      sourceDecision: (typeof chargeDec.sourceDecision === "string"
        ? chargeDec.sourceDecision
        : "sans_inference") as SourceDecisionAgent,
      coutCognitifMicroUsdc: lireMontantSafe(chargeDec.coutCognitifMicroUsdc),
      ...(typeof chargeDec.identifiantDemandeXway === "string"
        ? { identifiantDemandeXway: chargeDec.identifiantDemandeXway }
        : {}),
      ...(typeof chargeDec.modeleLogique === "string"
        ? { modeleLogique: chargeDec.modeleLogique }
        : {}),
    };
    resultatMoteur = {
      choixCognitif: {
        utiliserInference: chargeChoix.utiliserInference === true,
        modeleLogique:
          typeof chargeChoix.modeleLogique === "string"
            ? chargeChoix.modeleLogique
            : null,
        limiteDepenseAutoriseeMicroUsdc: lireMontantSafe(
          chargeChoix.limiteDepenseAutoriseeMicroUsdc,
        ),
        motif: typeof chargeChoix.motif === "string" ? chargeChoix.motif : "",
      },
      proposition:
        propEvt !== undefined
          ? {
              action: String(chargeProp.actionProposee ?? ""),
              confianceBps:
                typeof chargeProp.confianceBps === "number"
                  ? chargeProp.confianceBps
                  : 0,
              resume: String(chargeProp.resume ?? ""),
            }
          : null,
      decision,
      validationOk: refuseeEvt === undefined,
      motifRefus:
        refuseeEvt !== undefined &&
        typeof refuseeEvt.chargeUtile?.motifRefus === "string"
          ? refuseeEvt.chargeUtile.motifRefus
          : null,
      coutCognitifMicroUsdc: decision.coutCognitifMicroUsdc,
      identifiantDemandeXway:
        typeof chargeDec.identifiantDemandeXway === "string"
          ? chargeDec.identifiantDemandeXway
          : null,
      texteInference: null,
    };
  }

  let resultatAction: ResultatActionEnvironnement | undefined;
  if (resultatEvt !== undefined && actionEvt !== undefined && observation) {
    const cr = resultatEvt.chargeUtile ?? {};
    const ca = actionEvt.chargeUtile ?? {};
    const revenu = lireMontantSafe(cr.revenuActiviteMicroUsdc);
    const perte = lireMontantSafe(cr.perteActiviteMicroUsdc);
    const frais = lireMontantSafe(cr.fraisExecutionMicroUsdc);
    const cout =
      resultatMoteur?.coutCognitifMicroUsdc ??
      0n;
    resultatAction = {
      identifiantAction: String(ca.identifiantAction ?? cr.identifiantAction ?? ""),
      identifiantObservation: observation.identifiantObservation,
      identifiantAgent: options.identifiantAgent,
      numeroCycle: options.numeroCycle,
      action: ca.action === "agir" ? "agir" : "attendre",
      issue:
        cr.issue === "succes"
          ? "succes"
          : cr.issue === "echec"
            ? "echec"
            : "aucune",
      tirageBps: null,
      activite: {
        revenuActivite: revenu,
        perteActivite: perte,
        depenseCompute: cout,
        depenseDonnees: 0n,
        fraisExecution: frais,
      },
    };
  }

  return {
    observation,
    ...(resultatMoteur !== undefined ? { resultatMoteur } : {}),
    ...(resultatAction !== undefined ? { resultatAction } : {}),
    resultatDejaObserve: false,
    // Seul CYCLE_TERMINE marque l'exécution économique comme terminée.
    // CYCLE_DEMARRE seul (ou lot partiel) → le contrôleur complète le manquant.
    cycleEconomiqueDejaExecute: false,
  };
}

function reconstruireObservationDepuisEvenement(
  evenement: EvenementEsp,
): ObservationOpportunite {
  const charge = evenement.chargeUtile ?? {};
  const donnees =
    charge.donnees !== null &&
    typeof charge.donnees === "object" &&
    !Array.isArray(charge.donnees)
      ? (charge.donnees as Record<string, unknown>)
      : {};
  const actions = Array.isArray(donnees.actionsAutorisees)
    ? donnees.actionsAutorisees.filter(
        (a): a is "attendre" | "agir" => a === "attendre" || a === "agir",
      )
    : (["attendre", "agir"] as const);

  return {
    identifiantObservation: String(
      charge.identifiantObservation ??
        `${evenement.identifiantAgent}-obs-c${String(evenement.numeroCycle)}`,
    ),
    identifiantAgent: evenement.identifiantAgent!,
    numeroCycle: evenement.numeroCycle,
    typeObservation: "opportunite_simulee",
    probabiliteSuccesBps:
      typeof donnees.probabiliteSuccesBps === "number"
        ? donnees.probabiliteSuccesBps
        : 0,
    gainSiSuccesMicroUsdc: lireMontantSafe(donnees.gainSiSuccesMicroUsdc),
    perteSiEchecMicroUsdc: lireMontantSafe(donnees.perteSiEchecMicroUsdc),
    fraisActionMicroUsdc: lireMontantSafe(donnees.fraisActionMicroUsdc),
    description:
      typeof donnees.description === "string" ? donnees.description : "",
    actionsAutorisees: actions.length > 0 ? actions : ["attendre", "agir"],
  };
}

function lireMontantSafe(valeur: unknown): bigint {
  if (typeof valeur !== "string") {
    return 0n;
  }
  try {
    return lireMontantChargeUtile({ montant: valeur }, "montant");
  } catch {
    return 0n;
  }
}
