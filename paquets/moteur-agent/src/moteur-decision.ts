import type {
  ChoixCognitifAgent,
  DecisionAgent,
  EtatEconomiqueAgent,
  MicroUsdc,
  ObservationOpportunite,
  PropositionDecision,
} from "@esp/protocole";
import type { IdentifiantModeleInference } from "@esp/xway";
import {
  type ConfigurationPolitiqueBudgetCognitif,
  calculerEnjeuOpportunite,
  deciderBudgetCognitif,
  deciderSansInference,
} from "./politique-budget-cognitif.js";
import {
  parserPropositionDepuisTexte,
  validerPropositionDecision,
} from "./validateur-decision.js";

/**
 * ============================================================================
 * MOTEUR DE DÉCISION AGENT ESP v0.1
 * ============================================================================
 * Pipeline : observation → choix cognitif → (Xway) → proposition → validation → DecisionAgent
 * Le LLM ne produit jamais d'action environnementale directe.
 */

export type ResultatInferenceDecision =
  | {
      readonly statut: "executee";
      readonly texte: string;
      readonly coutFinalMicroUsdc: MicroUsdc;
      readonly identifiantDemande: string;
    }
  | {
      readonly statut: "refusee" | "echouee" | "indeterminee";
      readonly detail: string;
      readonly coutFinalMicroUsdc: MicroUsdc;
      readonly identifiantDemande: string;
    };

/**
 * Port injecté par le contrôleur — exécute Xway sans exposer la clé privée au moteur.
 * Asynchrone pour les adaptateurs réseau (OpenAI) via le contrat FournisseurInference.
 */
export type ExecuteurInferenceDecision = (demande: {
  readonly identifiantDemande: string;
  readonly modeleDemande: IdentifiantModeleInference;
  readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  readonly messages: readonly {
    readonly role: "systeme" | "utilisateur" | "assistant";
    readonly contenu: string;
  }[];
  readonly nombreMaxJetonsSortie: number;
}) => Promise<ResultatInferenceDecision>;

export type ResultatMoteurDecision = {
  readonly choixCognitif: ChoixCognitifAgent;
  readonly proposition: PropositionDecision | null;
  readonly decision: DecisionAgent;
  readonly validationOk: boolean;
  readonly motifRefus: string | null;
  readonly coutCognitifMicroUsdc: MicroUsdc;
  readonly identifiantDemandeXway: string | null;
  readonly texteInference: string | null;
};

export type OptionsMoteurDecision = {
  readonly observation: ObservationOpportunite;
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly runway: number;
  readonly configurationPolitique: ConfigurationPolitiqueBudgetCognitif;
  readonly plafondXwayMicroUsdc?: MicroUsdc;
  readonly identifiantExperience: string;
  /** Callback Xway — absent = aucune inférence possible même si politique l'autorise. */
  readonly executerInference?: ExecuteurInferenceDecision;
  readonly nombreMaxJetonsSortie?: number;
};

function estModeleXway(valeur: string): valeur is IdentifiantModeleInference {
  return (
    valeur === "modele_economique" ||
    valeur === "modele_standard" ||
    valeur === "modele_premium" ||
    valeur === "luna_reel_v01"
  );
}

function construireMessagesDecision(
  observation: ObservationOpportunite,
): Array<{ role: "systeme" | "utilisateur"; contenu: string }> {
  const payload = {
    type: "opportunite_simulee",
    probabiliteSuccesBps: observation.probabiliteSuccesBps,
    gainSiSuccesMicroUsdc: observation.gainSiSuccesMicroUsdc.toString(10),
    perteSiEchecMicroUsdc: observation.perteSiEchecMicroUsdc.toString(10),
    fraisActionMicroUsdc: observation.fraisActionMicroUsdc.toString(10),
    actionsAutorisees: observation.actionsAutorisees,
    description: observation.description,
  };
  return [
    {
      role: "systeme",
      contenu:
        "ESP décision v0.1. Réponds UNIQUEMENT avec une ligne PROPOSITION_JSON:{\"action\":\"agir|attendre\",\"confianceBps\":0-10000,\"resume\":\"...\"}. Aucune clé privée. Aucune exécution.",
    },
    {
      role: "utilisateur",
      contenu: `OBSERVATION_DECISION:${JSON.stringify(payload)}`,
    },
  ];
}

/**
 * Produit une DecisionAgent validée. En cas d'échec cognitif / validation :
 * repli → attendre, compute déjà consommé conservé.
 */
export async function executerMoteurDecision(
  options: OptionsMoteurDecision,
): Promise<ResultatMoteurDecision> {
  const { observation } = options;
  const identifiantDecision = `${observation.identifiantAgent}-dec-c${String(observation.numeroCycle)}`;

  const choixCognitif = deciderBudgetCognitif({
    etatEconomique: options.etatEconomique,
    runway: options.runway,
    observation,
    configuration: options.configurationPolitique,
    ...(options.plafondXwayMicroUsdc !== undefined
      ? { plafondXwayMicroUsdc: options.plafondXwayMicroUsdc }
      : {}),
  });

  // Chemin sans inférence — aucun coût cognitif.
  if (!choixCognitif.utiliserInference || options.executerInference === undefined) {
    const locale = deciderSansInference({
      observation,
      comportement: options.configurationPolitique.comportementSansInference,
    });
    const motifSansExec =
      choixCognitif.utiliserInference && options.executerInference === undefined
        ? "inference_non_disponible"
        : choixCognitif.motif;
    const validation = validerPropositionDecision({
      proposition: {
        action: locale.action,
        confianceBps: locale.confianceBps,
        resume: locale.resume,
      },
      observation,
      identifiantAgent: observation.identifiantAgent,
      numeroCycle: observation.numeroCycle,
      identifiantDecision,
      sourceDecision: "sans_inference",
      coutCognitifMicroUsdc: 0n,
    });
    if (!validation.validee) {
      return repliAttendre({
        observation,
        identifiantDecision,
        coutCognitifMicroUsdc: 0n,
        choixCognitif: { ...choixCognitif, motif: motifSansExec },
        sourceDecision: "proposition_invalide_repli",
        motifRefus: validation.motifRefus,
        identifiantDemandeXway: null,
        texteInference: null,
        proposition: null,
      });
    }
    return {
      choixCognitif: { ...choixCognitif, motif: motifSansExec, utiliserInference: false },
      proposition: {
        action: locale.action,
        confianceBps: locale.confianceBps,
        resume: locale.resume,
      },
      decision: validation.decision,
      validationOk: true,
      motifRefus: null,
      coutCognitifMicroUsdc: 0n,
      identifiantDemandeXway: null,
      texteInference: null,
    };
  }

  // Chemin avec inférence Xway.
  const modele = choixCognitif.modeleLogique ?? "modele_standard";
  if (!estModeleXway(modele)) {
    return repliAttendre({
      observation,
      identifiantDecision,
      coutCognitifMicroUsdc: 0n,
      choixCognitif,
      sourceDecision: "repli_echec_cognitif",
      motifRefus: "modele_logique_inconnu",
      identifiantDemandeXway: null,
      texteInference: null,
      proposition: null,
    });
  }

  const identifiantDemande = `${options.identifiantExperience}-${observation.identifiantAgent}-c${String(observation.numeroCycle)}-decision`;
  const resultat = await options.executerInference({
    identifiantDemande,
    modeleDemande: modele,
    limiteDepenseAutoriseeMicroUsdc:
      choixCognitif.limiteDepenseAutoriseeMicroUsdc,
    messages: construireMessagesDecision(observation),
    nombreMaxJetonsSortie: options.nombreMaxJetonsSortie ?? 256,
  });

  const cout = resultat.coutFinalMicroUsdc;

  if (resultat.statut !== "executee") {
    return repliAttendre({
      observation,
      identifiantDecision,
      coutCognitifMicroUsdc: cout,
      choixCognitif,
      sourceDecision: "repli_echec_cognitif",
      motifRefus: `inference_${resultat.statut}:${resultat.detail}`,
      identifiantDemandeXway: identifiantDemande,
      texteInference: null,
      proposition: null,
    });
  }

  const proposition = parserPropositionDepuisTexte(resultat.texte);
  if (proposition === null) {
    return repliAttendre({
      observation,
      identifiantDecision,
      coutCognitifMicroUsdc: cout,
      choixCognitif,
      sourceDecision: "proposition_invalide_repli",
      motifRefus: "sortie_structuree_invalide",
      identifiantDemandeXway: identifiantDemande,
      texteInference: resultat.texte,
      proposition: null,
    });
  }

  const validation = validerPropositionDecision({
    proposition,
    observation,
    identifiantAgent: observation.identifiantAgent,
    numeroCycle: observation.numeroCycle,
    identifiantDecision,
    sourceDecision: "inference_xway",
    coutCognitifMicroUsdc: cout,
    identifiantDemandeXway: identifiantDemande,
    modeleLogique: modele,
  });

  if (!validation.validee) {
    return repliAttendre({
      observation,
      identifiantDecision,
      coutCognitifMicroUsdc: cout,
      choixCognitif,
      sourceDecision: "proposition_invalide_repli",
      motifRefus: validation.motifRefus,
      identifiantDemandeXway: identifiantDemande,
      texteInference: resultat.texte,
      proposition,
    });
  }

  return {
    choixCognitif,
    proposition,
    decision: validation.decision,
    validationOk: true,
    motifRefus: null,
    coutCognitifMicroUsdc: cout,
    identifiantDemandeXway: identifiantDemande,
    texteInference: resultat.texte,
  };
}

function repliAttendre(options: {
  readonly observation: ObservationOpportunite;
  readonly identifiantDecision: string;
  readonly coutCognitifMicroUsdc: MicroUsdc;
  readonly choixCognitif: ChoixCognitifAgent;
  readonly sourceDecision: DecisionAgent["sourceDecision"];
  readonly motifRefus: string;
  readonly identifiantDemandeXway: string | null;
  readonly texteInference: string | null;
  readonly proposition: PropositionDecision | null;
}): ResultatMoteurDecision {
  const decision: DecisionAgent = {
    identifiantDecision: options.identifiantDecision,
    identifiantObservation: options.observation.identifiantObservation,
    identifiantAgent: options.observation.identifiantAgent,
    numeroCycle: options.observation.numeroCycle,
    action: "attendre",
    confianceBps: 0,
    resume: `Repli cognitif → attendre (${options.motifRefus})`,
    sourceDecision: options.sourceDecision,
    coutCognitifMicroUsdc: options.coutCognitifMicroUsdc,
    ...(options.identifiantDemandeXway !== null
      ? { identifiantDemandeXway: options.identifiantDemandeXway }
      : {}),
  };
  return {
    choixCognitif: options.choixCognitif,
    proposition: options.proposition,
    decision,
    validationOk: false,
    motifRefus: options.motifRefus,
    coutCognitifMicroUsdc: options.coutCognitifMicroUsdc,
    identifiantDemandeXway: options.identifiantDemandeXway,
    texteInference: options.texteInference,
  };
}

export { calculerEnjeuOpportunite };
