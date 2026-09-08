import type {
  EntreeEvenementDecision,
  EntreeEvenementEsp,
  EntreeEvenementXway,
  EtatEconomiqueAgent,
  MicroUsdc,
  ObservationOpportunite,
  ResultatActiviteCycle,
} from "@esp/protocole";
import {
  calculerRunwayEnCycles,
  creerEntreeActionEnvironnementExecutee,
  creerEntreeChoixCognitifEffectue,
  creerEntreeDecisionAgentRefusee,
  creerEntreeDecisionAgentValidee,
  creerEntreeDemandeInferenceAutorisee,
  creerEntreeDemandeInferenceRecue,
  creerEntreeDemandeInferenceRefusee,
  creerEntreeInferenceEchouee,
  creerEntreeInferenceExecutee,
  creerEntreeObservationAgentRecue,
  creerEntreePropositionDecisionProduite,
  creerEntreeResultatActionObserve,
  fabriquerIdentifiantExecutionEconomique,
  observationOpportuniteVersObservationAgent,
} from "@esp/protocole";
import type {
  ConfigurationPolitiqueBudgetCognitif,
  ExecuteurInferenceDecision,
  ResultatInferenceDecision,
  ResultatMoteurDecision,
  SignataireAgent,
} from "@esp/moteur-agent";
import { executerMoteurDecision } from "@esp/moteur-agent";
import type {
  ConfigurationXway,
  DemandeInference,
  DemandeInferenceSignee,
  PasserelleXway,
} from "@esp/xway";
import {
  construireMessageCanoniqueDemandeInference,
  trouverTarifModele,
} from "@esp/xway";
import type {
  EnvironnementOpportunitesSimulees,
  ResultatActionEnvironnement,
} from "@esp/environnement";

/**
 * Cycle décisionnel v0.1 — ordre déterministe documenté :
 * 1 observation → 2 choix cognitif → 3 inférence → 4 validation
 * → 5 action → 6 résultat → 7 consolidation coûts → (noyau hors de ce module)
 *
 * OpenAI réel : uniquement si l'exécuteur est injecté explicitement
 * (commande manuelle). Sur `avancer`, le contrôleur n'injecte l'exécuteur
 * que lorsque `selecteur === "simule"`.
 */

export type AttributionComputeDecision = {
  readonly identifiantDemande: string;
  readonly montantMicroUsdc: MicroUsdc;
};

export type ResultatCycleDecisionAgent = {
  readonly observation: ObservationOpportunite;
  readonly resultatMoteur: ResultatMoteurDecision;
  readonly resultatAction: ResultatActionEnvironnement;
  readonly activite: ResultatActiviteCycle;
  readonly attributionsComputeXway: readonly AttributionComputeDecision[];
  readonly evenements: EntreeEvenementEsp[];
};

export type EtatRepriseCycleDecision = {
  readonly observation?: ObservationOpportunite;
  readonly resultatMoteur?: ResultatMoteurDecision;
  readonly resultatAction?: ResultatActionEnvironnement;
  readonly resultatDejaObserve?: boolean;
  readonly cycleEconomiqueDejaExecute?: boolean;
};

export async function executerCycleDecisionAgent(options: {
  readonly environnement: EnvironnementOpportunitesSimulees;
  readonly politique: ConfigurationPolitiqueBudgetCognitif;
  readonly agent: {
    readonly identifiant: string;
    readonly etatEconomique: EtatEconomiqueAgent;
  };
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly coutOperationnelMinimalParCycleMicroUsdc: MicroUsdc;
  readonly configurationXway?: ConfigurationXway;
  readonly passerelle?: PasserelleXway;
  readonly signataire?: SignataireAgent;
  readonly prochaineSequence: () => number;
  readonly dateEnregistrement?: string;
  readonly enregistrerImmediatement?: (
    evenements: readonly EntreeEvenementEsp[],
  ) => void;
  readonly etatReprise?: EtatRepriseCycleDecision;
  /**
   * Si true, autorise l'injection d'un exécuteur même pour selecteur openai
   * (commande manuelle opt-in uniquement).
   */
  readonly autoriserFournisseurReel?: boolean;
}): Promise<ResultatCycleDecisionAgent> {
  const dateOpts =
    options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {};
  const evenements: EntreeEvenementEsp[] = [];
  const persister = (lots: readonly EntreeEvenementEsp[]) => {
    evenements.push(...lots);
    options.enregistrerImmediatement?.(lots);
  };

  if (options.etatReprise?.resultatDejaObserve === true) {
    throw new Error(
      "Cycle décision déjà consolidé — le contrôleur doit sauter cet agent",
    );
  }

  const observation =
    options.etatReprise?.observation ??
    options.environnement.produireObservation({
      identifiantAgent: options.agent.identifiant,
      numeroCycle: options.numeroCycle,
    });

  if (options.etatReprise?.observation === undefined) {
    const canon = observationOpportuniteVersObservationAgent(observation);
    persister([
      creerEntreeObservationAgentRecue({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantObservation: canon.identifiantObservation,
        typeObservation: canon.typeObservation,
        donnees: canon.donnees,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    ]);
  }

  const runway = calculerRunwayEnCycles(
    options.agent.etatEconomique,
    options.coutOperationnelMinimalParCycleMicroUsdc,
  );

  let resultatMoteur = options.etatReprise?.resultatMoteur;
  if (resultatMoteur === undefined) {
    const peutInfererViaXway =
      options.configurationXway?.active === true &&
      options.passerelle !== undefined &&
      (options.configurationXway.fournisseur.selecteur === "simule" ||
        options.autoriserFournisseurReel === true);

    const executerInference = peutInfererViaXway
      ? creerExecuteurInferenceXway({
          configurationXway: options.configurationXway!,
          passerelle: options.passerelle!,
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identifiant,
          numeroCycle: options.numeroCycle,
          prochaineSequence: options.prochaineSequence,
          enregistrerImmediatement: (evts) => {
            persister(evts);
          },
          ...(options.signataire !== undefined
            ? { signataire: options.signataire }
            : {}),
          ...dateOpts,
        })
      : undefined;

    resultatMoteur = await executerMoteurDecision({
      observation,
      etatEconomique: options.agent.etatEconomique,
      runway,
      configurationPolitique: options.politique,
      identifiantExperience: options.identifiantExperience,
      ...(options.configurationXway !== undefined
        ? {
            plafondXwayMicroUsdc:
              options.configurationXway.plafondComputeParCycleMicroUsdc,
          }
        : {}),
      ...(executerInference !== undefined ? { executerInference } : {}),
    });

    const lotsDecision: EntreeEvenementDecision[] = [
      creerEntreeChoixCognitifEffectue({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantObservation: observation.identifiantObservation,
        utiliserInference: resultatMoteur.choixCognitif.utiliserInference,
        modeleLogique: resultatMoteur.choixCognitif.modeleLogique,
        limiteDepenseAutoriseeMicroUsdc:
          resultatMoteur.choixCognitif.limiteDepenseAutoriseeMicroUsdc,
        motif: resultatMoteur.choixCognitif.motif,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    ];

    if (resultatMoteur.proposition !== null) {
      lotsDecision.push(
        creerEntreePropositionDecisionProduite({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identifiant,
          numeroCycle: options.numeroCycle,
          identifiantObservation: observation.identifiantObservation,
          identifiantDecision: resultatMoteur.decision.identifiantDecision,
          ...(resultatMoteur.identifiantDemandeXway !== null
            ? { identifiantDemandeXway: resultatMoteur.identifiantDemandeXway }
            : {}),
          actionProposee: resultatMoteur.proposition.action,
          confianceBps: resultatMoteur.proposition.confianceBps,
          resume: resultatMoteur.proposition.resume,
          ...(resultatMoteur.decision.modeleLogique !== undefined
            ? { modeleLogique: resultatMoteur.decision.modeleLogique }
            : {}),
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
    }

    if (resultatMoteur.validationOk) {
      lotsDecision.push(
        creerEntreeDecisionAgentValidee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identifiant,
          numeroCycle: options.numeroCycle,
          identifiantObservation: observation.identifiantObservation,
          identifiantDecision: resultatMoteur.decision.identifiantDecision,
          action: resultatMoteur.decision.action,
          confianceBps: resultatMoteur.decision.confianceBps,
          resume: resultatMoteur.decision.resume,
          sourceDecision: resultatMoteur.decision.sourceDecision,
          coutCognitifMicroUsdc: resultatMoteur.coutCognitifMicroUsdc,
          ...(resultatMoteur.identifiantDemandeXway !== null
            ? { identifiantDemandeXway: resultatMoteur.identifiantDemandeXway }
            : {}),
          ...(resultatMoteur.decision.modeleLogique !== undefined
            ? { modeleLogique: resultatMoteur.decision.modeleLogique }
            : {}),
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
    } else {
      lotsDecision.push(
        creerEntreeDecisionAgentRefusee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identifiant,
          numeroCycle: options.numeroCycle,
          identifiantObservation: observation.identifiantObservation,
          identifiantDecision: resultatMoteur.decision.identifiantDecision,
          motifRefus: resultatMoteur.motifRefus ?? "inconnu",
          ...(resultatMoteur.proposition !== null
            ? { actionProposee: resultatMoteur.proposition.action }
            : {}),
          coutCognitifMicroUsdc: resultatMoteur.coutCognitifMicroUsdc,
          ...(resultatMoteur.identifiantDemandeXway !== null
            ? { identifiantDemandeXway: resultatMoteur.identifiantDemandeXway }
            : {}),
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
        creerEntreeDecisionAgentValidee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identifiant,
          numeroCycle: options.numeroCycle,
          identifiantObservation: observation.identifiantObservation,
          identifiantDecision: resultatMoteur.decision.identifiantDecision,
          action: resultatMoteur.decision.action,
          confianceBps: resultatMoteur.decision.confianceBps,
          resume: resultatMoteur.decision.resume,
          sourceDecision: resultatMoteur.decision.sourceDecision,
          coutCognitifMicroUsdc: resultatMoteur.coutCognitifMicroUsdc,
          ...(resultatMoteur.identifiantDemandeXway !== null
            ? { identifiantDemandeXway: resultatMoteur.identifiantDemandeXway }
            : {}),
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
    }

    persister(lotsDecision);
  }

  let resultatAction = options.etatReprise?.resultatAction;
  if (resultatAction === undefined) {
    resultatAction = options.environnement.executerAction({
      observation,
      action: resultatMoteur.decision.action,
      identifiantDecision: resultatMoteur.decision.identifiantDecision,
    });

    const identifiantExecutionEconomique =
      fabriquerIdentifiantExecutionEconomique({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identifiant,
        numeroCycle: options.numeroCycle,
      });
    persister([
      creerEntreeActionEnvironnementExecutee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantObservation: observation.identifiantObservation,
        identifiantDecision: resultatMoteur.decision.identifiantDecision,
        identifiantAction: resultatAction.identifiantAction,
        action: resultatAction.action,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
      creerEntreeResultatActionObserve({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantObservation: observation.identifiantObservation,
        identifiantDecision: resultatMoteur.decision.identifiantDecision,
        identifiantAction: resultatAction.identifiantAction,
        issue: resultatAction.issue,
        revenuActiviteMicroUsdc: resultatAction.activite.revenuActivite,
        perteActiviteMicroUsdc: resultatAction.activite.perteActivite,
        fraisExecutionMicroUsdc: resultatAction.activite.fraisExecution,
        identifiantExecutionEconomique,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    ]);
  }

  const activite: ResultatActiviteCycle = {
    revenuActivite: resultatAction.activite.revenuActivite,
    perteActivite: resultatAction.activite.perteActivite,
    depenseCompute: resultatMoteur.coutCognitifMicroUsdc,
    depenseDonnees: 0n,
    fraisExecution: resultatAction.activite.fraisExecution,
  };

  const attributionsComputeXway: AttributionComputeDecision[] =
    resultatMoteur.identifiantDemandeXway !== null &&
    resultatMoteur.coutCognitifMicroUsdc > 0n
      ? [
          {
            identifiantDemande: resultatMoteur.identifiantDemandeXway,
            montantMicroUsdc: resultatMoteur.coutCognitifMicroUsdc,
          },
        ]
      : [];

  return {
    observation,
    resultatMoteur,
    resultatAction,
    activite,
    attributionsComputeXway,
    evenements,
  };
}

function creerExecuteurInferenceXway(options: {
  readonly configurationXway: ConfigurationXway;
  readonly passerelle: PasserelleXway;
  readonly identifiantExperience: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly prochaineSequence: () => number;
  readonly enregistrerImmediatement: (
    evenements: readonly EntreeEvenementXway[],
  ) => void;
  readonly signataire?: SignataireAgent;
  readonly dateEnregistrement?: string;
}): ExecuteurInferenceDecision {
  return async (demandePartielle): Promise<ResultatInferenceDecision> => {
    const dateOpts =
      options.dateEnregistrement !== undefined
        ? { dateEnregistrement: options.dateEnregistrement }
        : {};
    const tarif = trouverTarifModele(
      options.configurationXway.modeles,
      demandePartielle.modeleDemande,
    );
    const nombreMaxJetonsSortie =
      demandePartielle.nombreMaxJetonsSortie ||
      tarif?.nombreMaxJetonsSortie ||
      256;

    const demande: DemandeInference = {
      identifiantDemande: demandePartielle.identifiantDemande,
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
      numeroCycle: options.numeroCycle,
      modeleDemande: demandePartielle.modeleDemande,
      messages: demandePartielle.messages,
      nombreMaxJetonsSortie,
      limiteDepenseAutoriseeMicroUsdc:
        demandePartielle.limiteDepenseAutoriseeMicroUsdc,
    };

    const evenements: EntreeEvenementXway[] = [
      creerEntreeDemandeInferenceRecue({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.identifiantAgent,
        numeroCycle: options.numeroCycle,
        identifiantDemande: demande.identifiantDemande,
        modeleDemande: demande.modeleDemande,
        limiteDepenseAutoriseeMicroUsdc:
          demande.limiteDepenseAutoriseeMicroUsdc,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    ];

    let presentation: DemandeInference | DemandeInferenceSignee = demande;
    if (options.signataire !== undefined) {
      if (options.signataire.statut !== "disponible") {
        evenements.push(
          creerEntreeDemandeInferenceRefusee({
            identifiantExperience: options.identifiantExperience,
            identifiantAgent: options.identifiantAgent,
            numeroCycle: options.numeroCycle,
            identifiantDemande: demande.identifiantDemande,
            modeleDemande: demande.modeleDemande,
            limiteDepenseAutoriseeMicroUsdc:
              demande.limiteDepenseAutoriseeMicroUsdc,
            motifRefus: "authentification_invalide",
            detail: `Signataire indisponible (statut=${options.signataire.statut})`,
            indiceUnicite: options.prochaineSequence(),
            ...dateOpts,
          }),
        );
        options.enregistrerImmediatement(evenements);
        return {
          statut: "refusee",
          detail: "signataire_indisponible",
          coutFinalMicroUsdc: 0n,
          identifiantDemande: demande.identifiantDemande,
        };
      }
      const message = construireMessageCanoniqueDemandeInference(demande);
      const signe = options.signataire.signer(message);
      presentation = {
        demande,
        clePubliqueBase64Url: signe.clePubliqueBase64Url,
        signatureBase64Url: signe.signatureBase64Url,
      };
    }

    const autorisation = options.passerelle.autoriser(presentation);
    if (!autorisation.autorisee) {
      evenements.push(
        creerEntreeDemandeInferenceRefusee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.identifiantAgent,
          numeroCycle: options.numeroCycle,
          identifiantDemande: demande.identifiantDemande,
          modeleDemande: demande.modeleDemande,
          limiteDepenseAutoriseeMicroUsdc:
            demande.limiteDepenseAutoriseeMicroUsdc,
          motifRefus: autorisation.motif,
          detail: autorisation.detail,
          ...(autorisation.estimation !== null
            ? {
                coutMaximumEstimeMicroUsdc:
                  autorisation.estimation.coutMaximumEstimeMicroUsdc,
              }
            : {}),
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
      options.enregistrerImmediatement(evenements);
      return {
        statut: "refusee",
        detail: autorisation.detail,
        coutFinalMicroUsdc: 0n,
        identifiantDemande: demande.identifiantDemande,
      };
    }

    evenements.push(
      creerEntreeDemandeInferenceAutorisee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.identifiantAgent,
        numeroCycle: options.numeroCycle,
        identifiantDemande: demande.identifiantDemande,
        modeleDemande: demande.modeleDemande,
        limiteDepenseAutoriseeMicroUsdc:
          demande.limiteDepenseAutoriseeMicroUsdc,
        coutMaximumEstimeMicroUsdc:
          autorisation.estimation.coutMaximumEstimeMicroUsdc,
        reservationMicroUsdc: autorisation.reservationMicroUsdc,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement(evenements);

    const resultat = await options.passerelle.executer(presentation);
    const finaux: EntreeEvenementXway[] = [];

    if (resultat.statut === "refusee") {
      finaux.push(
        creerEntreeDemandeInferenceRefusee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.identifiantAgent,
          numeroCycle: options.numeroCycle,
          identifiantDemande: demande.identifiantDemande,
          modeleDemande: demande.modeleDemande,
          limiteDepenseAutoriseeMicroUsdc:
            demande.limiteDepenseAutoriseeMicroUsdc,
          motifRefus: resultat.motif,
          detail: resultat.detail,
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
      options.enregistrerImmediatement(finaux);
      return {
        statut: "refusee",
        detail: resultat.detail,
        coutFinalMicroUsdc: 0n,
        identifiantDemande: demande.identifiantDemande,
      };
    }

    if (
      resultat.statut === "echouee" ||
      resultat.statut === "resultat_indetermine"
    ) {
      finaux.push(
        creerEntreeInferenceEchouee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.identifiantAgent,
          numeroCycle: options.numeroCycle,
          identifiantDemande: demande.identifiantDemande,
          modeleDemande: demande.modeleDemande,
          detail: resultat.detail,
          natureEchec: resultat.natureEchec,
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
      options.enregistrerImmediatement(finaux);
      return {
        statut:
          resultat.statut === "resultat_indetermine"
            ? "indeterminee"
            : "echouee",
        detail: resultat.detail,
        coutFinalMicroUsdc: 0n,
        identifiantDemande: demande.identifiantDemande,
      };
    }

    finaux.push(
      creerEntreeInferenceExecutee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.identifiantAgent,
        numeroCycle: options.numeroCycle,
        identifiantDemande: demande.identifiantDemande,
        modeleDemande: demande.modeleDemande,
        jetonsEntree: resultat.reponse.usage.jetonsEntree,
        jetonsSortie: resultat.reponse.usage.jetonsSortie,
        coutFinalMicroUsdc: resultat.coutFinalMicroUsdc,
        fournisseur: options.configurationXway.fournisseur.identifiant,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement(finaux);

    return {
      statut: "executee",
      texte: resultat.reponse.texte,
      coutFinalMicroUsdc: resultat.coutFinalMicroUsdc,
      identifiantDemande: demande.identifiantDemande,
    };
  };
}

export function creerExecuteurInferenceStub(
  resultat: ResultatInferenceDecision,
): ExecuteurInferenceDecision {
  return async () => resultat;
}
