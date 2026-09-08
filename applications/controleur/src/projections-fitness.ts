/**
 * Projections fitness descriptive — sérialisation API uniquement.
 * Aucun recalcul de formule métier ici : délégué à @esp/protocole.
 */

import type {
  AgregatsFitnessPopulation,
  EvenementEsp,
  FenetreEvaluation,
  MesuresFitnessAgent,
  MicroUsdc,
  ValeurAttendueExacte,
} from "@esp/protocole";
import {
  DENOMINATEUR_VALEUR_ATTENDUE_BPS,
  VERSION_MESURES_FITNESS,
  agregaterFitnessPopulation,
  arrondirValeurAttendueVersMicroUsdc,
  assertPasDeScoreScalaire,
  calculerMesuresFitnessAgent,
} from "@esp/protocole";
import type { MontantApi } from "./serialisation-api.js";
import { serialiserMontantApi } from "./serialisation-api.js";

function m(montant: MicroUsdc): MontantApi {
  return serialiserMontantApi(montant);
}

function mOpt(montant: MicroUsdc | null): MontantApi | null {
  return montant === null ? null : serialiserMontantApi(montant);
}

/** Rationnel exact + approximation µUSDC pour affichage uniquement. */
export type ProjectionValeurAttendueExacte = {
  readonly numerateurMicroUsdcBps: string;
  readonly denominateurBps: number;
  /** Troncature vers zéro — ne pas utiliser pour la logique métier. */
  readonly microUsdcArrondiAffichage: MontantApi;
};

function projeterValeurAttendueExacte(
  valeur: ValeurAttendueExacte,
): ProjectionValeurAttendueExacte {
  return {
    numerateurMicroUsdcBps: valeur.numerateurMicroUsdcBps.toString(10),
    denominateurBps: Number(DENOMINATEUR_VALEUR_ATTENDUE_BPS),
    microUsdcArrondiAffichage: m(arrondirValeurAttendueVersMicroUsdc(valeur)),
  };
}

function projeterValeurAttendueExacteOpt(
  valeur: ValeurAttendueExacte | null,
): ProjectionValeurAttendueExacte | null {
  return valeur === null ? null : projeterValeurAttendueExacte(valeur);
}

export type ProjectionRatioFitness = {
  readonly numerateur: MontantApi;
  readonly denominateur: MontantApi;
  readonly quotientEchelleMillion: string | null;
  readonly note: "descriptif_non_causal";
};

export type ProjectionFitnessAgent = {
  readonly versionMesuresFitness: typeof VERSION_MESURES_FITNESS;
  readonly identifiantAgent: string;
  readonly fenetre: FenetreEvaluation;
  readonly avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE";
  readonly economie: {
    readonly venDebut: MontantApi;
    readonly venFin: MontantApi;
    readonly variationVen: MontantApi;
    readonly capitalLiquideFin: MontantApi;
    readonly obligationsFin: MontantApi;
    readonly capitalisationExogene: MontantApi;
    readonly transfertsInternesRecus: MontantApi;
    readonly transfertsInternesEnvoyes: MontantApi;
    readonly variationVenNeutraliseeExogenes: MontantApi;
    readonly revenusActivite: MontantApi;
    readonly pertesActivite: MontantApi;
    readonly depensesCompute: MontantApi;
    readonly depensesDonnees: MontantApi;
    readonly fraisExecution: MontantApi;
    readonly loyersPayes: MontantApi;
    readonly redevancesProprietairePayees: MontantApi;
    readonly resultatActiviteBrut: MontantApi;
    readonly resultatOperationnelAvantContrat: MontantApi;
    readonly resultatApresContrat: MontantApi;
    readonly coutsReproductionPayes: MontantApi;
    readonly resultatEconomiqueApresReproduction: MontantApi;
  };
  readonly decision: {
    readonly nombreDecisions: number;
    readonly nombreDecisionsAvecInference: number;
    readonly nombreDecisionsSansInference: number;
    readonly nombreActionsAgir: number;
    readonly nombreActionsAttendre: number;
    readonly nombreDecisionsOptimalesExAnte: number;
    readonly tauxDecisionsOptimalesExAnteBps: number | null;
    readonly regretExAnteCumule: ProjectionValeurAttendueExacte;
    readonly valeurAttendueCumuleeActionChoisie: ProjectionValeurAttendueExacte;
    readonly nombreSuccesRealises: number;
    readonly nombreEchecsRealises: number;
    readonly resultatActiviteRealise: MontantApi;
    readonly gainMoyenRealiseParActionAgir: MontantApi | null;
    readonly tauxOptimalesAvecInferenceBps: number | null;
    readonly tauxOptimalesSansInferenceBps: number | null;
    readonly regretMoyenAvecInference: ProjectionValeurAttendueExacte | null;
    readonly regretMoyenSansInference: ProjectionValeurAttendueExacte | null;
    readonly coutCognitifAvecInference: MontantApi;
    readonly coutCognitifSansInference: MontantApi;
  };
  readonly cognition: {
    readonly nombreDemandesInference: number;
    readonly nombreInferencesExecutees: number;
    readonly nombreRefusXway: number;
    readonly nombreSortiesInvalides: number;
    readonly coutCognitifTotal: MontantApi;
    readonly coutCognitifMoyenParDecision: MontantApi | null;
    readonly coutCognitifMoyenParDecisionAvecInference: MontantApi | null;
    readonly jetonsEntreeTotal: number;
    readonly jetonsSortieTotal: number;
    readonly ratioResultatOperationnelSurCoutCognitif: ProjectionRatioFitness | null;
  };
  readonly risque: {
    readonly picVen: MontantApi;
    readonly drawdownMax: MontantApi;
    readonly drawdownMaxBps: number | null;
    readonly cycleDuDrawdownMax: number | null;
    readonly runwayMinimumObserve: number | null;
  };
  readonly survie: MesuresFitnessAgent["survie"];
  readonly resilience: MesuresFitnessAgent["resilience"];
  readonly contribution: {
    readonly loyersPayes: MontantApi;
    readonly redevancesPayees: MontantApi;
    readonly contributionProprietaireTotale: MontantApi;
  };
  readonly historiqueParCycle: readonly {
    readonly numeroCycle: number;
    readonly ven: MontantApi;
    readonly drawdownDepuisPic: MontantApi;
    readonly resultatOperationnelCumule: MontantApi;
    readonly resultatApresContratCumule: MontantApi;
    readonly computeCumule: MontantApi;
    readonly regretExAnteCumule: ProjectionValeurAttendueExacte;
  }[];
};

export type ProjectionLigneFitnessPopulation = {
  readonly identifiantAgent: string;
  readonly etatSurvie: string;
  readonly venFin: MontantApi;
  readonly resultatApresContrat: MontantApi;
  readonly depensesCompute: MontantApi;
  readonly tauxDecisionsOptimalesExAnteBps: number | null;
  readonly regretExAnteCumule: ProjectionValeurAttendueExacte;
  readonly drawdownMax: MontantApi;
  readonly runwayMinimumObserve: number | null;
  readonly contributionProprietaire: MontantApi;
};

export type ProjectionFitnessPopulation = {
  readonly versionMesuresFitness: typeof VERSION_MESURES_FITNESS;
  readonly avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE";
  readonly fenetre: FenetreEvaluation;
  readonly agents: readonly ProjectionLigneFitnessPopulation[];
  readonly agregats: AgregatsFitnessPopulation;
};

export function projeterMesuresFitnessAgent(
  mesures: MesuresFitnessAgent,
): ProjectionFitnessAgent {
  assertPasDeScoreScalaire(mesures);
  const ratio = mesures.cognition.ratioResultatOperationnelSurCoutCognitif;
  return {
    versionMesuresFitness: mesures.versionMesuresFitness,
    identifiantAgent: mesures.identifiantAgent,
    fenetre: mesures.fenetre,
    avertissement: mesures.avertissement,
    economie: {
      venDebut: m(mesures.economie.venDebutMicroUsdc),
      venFin: m(mesures.economie.venFinMicroUsdc),
      variationVen: m(mesures.economie.variationVenMicroUsdc),
      capitalLiquideFin: m(mesures.economie.capitalLiquideFin),
      obligationsFin: m(mesures.economie.obligationsFin),
      capitalisationExogene: m(mesures.economie.capitalisationExogeneMicroUsdc),
      transfertsInternesRecus: m(
        mesures.economie.transfertsInternesRecusMicroUsdc,
      ),
      transfertsInternesEnvoyes: m(
        mesures.economie.transfertsInternesEnvoyesMicroUsdc,
      ),
      variationVenNeutraliseeExogenes: m(
        mesures.economie.variationVenNeutraliseeExogenesMicroUsdc,
      ),
      revenusActivite: m(mesures.economie.revenusActiviteMicroUsdc),
      pertesActivite: m(mesures.economie.pertesActiviteMicroUsdc),
      depensesCompute: m(mesures.economie.depensesComputeMicroUsdc),
      depensesDonnees: m(mesures.economie.depensesDonneesMicroUsdc),
      fraisExecution: m(mesures.economie.fraisExecutionMicroUsdc),
      loyersPayes: m(mesures.economie.loyersPayesMicroUsdc),
      redevancesProprietairePayees: m(
        mesures.economie.redevancesProprietairePayeesMicroUsdc,
      ),
      resultatActiviteBrut: m(mesures.economie.resultatActiviteBrutMicroUsdc),
      resultatOperationnelAvantContrat: m(
        mesures.economie.resultatOperationnelAvantContratMicroUsdc,
      ),
      resultatApresContrat: m(mesures.economie.resultatApresContratMicroUsdc),
      coutsReproductionPayes: m(mesures.economie.coutsReproductionPayesMicroUsdc),
      resultatEconomiqueApresReproduction: m(
        mesures.economie.resultatEconomiqueApresReproductionMicroUsdc,
      ),
    },
    decision: {
      nombreDecisions: mesures.decision.nombreDecisions,
      nombreDecisionsAvecInference:
        mesures.decision.nombreDecisionsAvecInference,
      nombreDecisionsSansInference:
        mesures.decision.nombreDecisionsSansInference,
      nombreActionsAgir: mesures.decision.nombreActionsAgir,
      nombreActionsAttendre: mesures.decision.nombreActionsAttendre,
      nombreDecisionsOptimalesExAnte:
        mesures.decision.nombreDecisionsOptimalesExAnte,
      tauxDecisionsOptimalesExAnteBps:
        mesures.decision.tauxDecisionsOptimalesExAnteBps,
      regretExAnteCumule: projeterValeurAttendueExacte(
        mesures.decision.regretExAnteCumule,
      ),
      valeurAttendueCumuleeActionChoisie: projeterValeurAttendueExacte(
        mesures.decision.valeurAttendueCumuleeActionChoisie,
      ),
      nombreSuccesRealises: mesures.decision.nombreSuccesRealises,
      nombreEchecsRealises: mesures.decision.nombreEchecsRealises,
      resultatActiviteRealise: m(
        mesures.decision.resultatActiviteRealiseMicroUsdc,
      ),
      gainMoyenRealiseParActionAgir: mOpt(
        mesures.decision.gainMoyenRealiseParActionAgirMicroUsdc,
      ),
      tauxOptimalesAvecInferenceBps:
        mesures.decision.tauxOptimalesAvecInferenceBps,
      tauxOptimalesSansInferenceBps:
        mesures.decision.tauxOptimalesSansInferenceBps,
      regretMoyenAvecInference: projeterValeurAttendueExacteOpt(
        mesures.decision.regretMoyenAvecInference,
      ),
      regretMoyenSansInference: projeterValeurAttendueExacteOpt(
        mesures.decision.regretMoyenSansInference,
      ),
      coutCognitifAvecInference: m(
        mesures.decision.coutCognitifAvecInferenceMicroUsdc,
      ),
      coutCognitifSansInference: m(
        mesures.decision.coutCognitifSansInferenceMicroUsdc,
      ),
    },
    cognition: {
      nombreDemandesInference: mesures.cognition.nombreDemandesInference,
      nombreInferencesExecutees: mesures.cognition.nombreInferencesExecutees,
      nombreRefusXway: mesures.cognition.nombreRefusXway,
      nombreSortiesInvalides: mesures.cognition.nombreSortiesInvalides,
      coutCognitifTotal: m(mesures.cognition.coutCognitifTotalMicroUsdc),
      coutCognitifMoyenParDecision: mOpt(
        mesures.cognition.coutCognitifMoyenParDecisionMicroUsdc,
      ),
      coutCognitifMoyenParDecisionAvecInference: mOpt(
        mesures.cognition.coutCognitifMoyenParDecisionAvecInferenceMicroUsdc,
      ),
      jetonsEntreeTotal: mesures.cognition.jetonsEntreeTotal,
      jetonsSortieTotal: mesures.cognition.jetonsSortieTotal,
      ratioResultatOperationnelSurCoutCognitif:
        ratio === null
          ? null
          : {
              numerateur: m(ratio.numerateurMicroUsdc),
              denominateur: m(ratio.denominateurMicroUsdc),
              quotientEchelleMillion:
                ratio.quotientEchelleMillion?.toString(10) ?? null,
              note: "descriptif_non_causal",
            },
    },
    risque: {
      picVen: m(mesures.risque.picVenMicroUsdc),
      drawdownMax: m(mesures.risque.drawdownMaxMicroUsdc),
      drawdownMaxBps: mesures.risque.drawdownMaxBps,
      cycleDuDrawdownMax: mesures.risque.cycleDuDrawdownMax,
      runwayMinimumObserve: mesures.risque.runwayMinimumObserve,
    },
    survie: mesures.survie,
    resilience: mesures.resilience,
    contribution: {
      loyersPayes: m(mesures.contribution.loyersPayesMicroUsdc),
      redevancesPayees: m(mesures.contribution.redevancesPayeesMicroUsdc),
      contributionProprietaireTotale: m(
        mesures.contribution.contributionProprietaireTotaleMicroUsdc,
      ),
    },
    historiqueParCycle: mesures.historiqueParCycle.map((p) => ({
      numeroCycle: p.numeroCycle,
      ven: m(p.venMicroUsdc),
      drawdownDepuisPic: m(p.drawdownDepuisPicMicroUsdc),
      resultatOperationnelCumule: m(p.resultatOperationnelCumuleMicroUsdc),
      resultatApresContratCumule: m(p.resultatApresContratCumuleMicroUsdc),
      computeCumule: m(p.computeCumuleMicroUsdc),
      regretExAnteCumule: projeterValeurAttendueExacte(p.regretExAnteCumule),
    })),
  };
}

export function calculerEtProjeterFitnessAgent(options: {
  readonly identifiantAgent: string;
  readonly evenements: readonly EvenementEsp[];
  readonly fenetre?: FenetreEvaluation;
  readonly cycleCourant?: number;
}): ProjectionFitnessAgent {
  const mesures = calculerMesuresFitnessAgent({
    identifiantAgent: options.identifiantAgent,
    evenements: options.evenements,
    ...(options.fenetre !== undefined ? { fenetre: options.fenetre } : {}),
    ...(options.cycleCourant !== undefined
      ? { cycleCourant: options.cycleCourant }
      : {}),
  });
  return projeterMesuresFitnessAgent(mesures);
}

export function projeterFitnessPopulation(options: {
  readonly identifiantsAgents: readonly string[];
  readonly evenements: readonly EvenementEsp[];
  readonly fenetre?: FenetreEvaluation;
  readonly cycleCourant?: number;
}): ProjectionFitnessPopulation {
  const mesures = options.identifiantsAgents.map((id) =>
    calculerMesuresFitnessAgent({
      identifiantAgent: id,
      evenements: options.evenements,
      ...(options.fenetre !== undefined ? { fenetre: options.fenetre } : {}),
      ...(options.cycleCourant !== undefined
        ? { cycleCourant: options.cycleCourant }
        : {}),
    }),
  );
  const fenetre = mesures[0]?.fenetre ??
    options.fenetre ?? { cycleDebut: 0, cycleFin: options.cycleCourant ?? 0 };
  return {
    versionMesuresFitness: VERSION_MESURES_FITNESS,
    avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE",
    fenetre,
    agents: mesures.map((mes) => ({
      identifiantAgent: mes.identifiantAgent,
      etatSurvie: mes.survie.etatCourant,
      venFin: m(mes.economie.venFinMicroUsdc),
      resultatApresContrat: m(mes.economie.resultatApresContratMicroUsdc),
      depensesCompute: m(mes.economie.depensesComputeMicroUsdc),
      tauxDecisionsOptimalesExAnteBps:
        mes.decision.tauxDecisionsOptimalesExAnteBps,
      regretExAnteCumule: projeterValeurAttendueExacte(
        mes.decision.regretExAnteCumule,
      ),
      drawdownMax: m(mes.risque.drawdownMaxMicroUsdc),
      runwayMinimumObserve: mes.risque.runwayMinimumObserve,
      contributionProprietaire: m(
        mes.contribution.contributionProprietaireTotaleMicroUsdc,
      ),
    })),
    agregats: agregaterFitnessPopulation(mesures),
  };
}
