/**
 * Fitness descriptive ESP v0.1 — mesures multidimensionnelles.
 *
 * Aucun score scalaire, aucun ranking, aucune sélection.
 * Reconstructible depuis le registre en une passe O(événements).
 */

import {
  calculerValeurEconomiqueNette,
  creerEtatEconomiqueInitial,
  figerEtatEconomique,
  type BrouillonEtatEconomique,
  type EtatEconomiqueAgent,
} from "./etat-economique.js";
import type { EtatSurvie } from "./etat-survie.js";
import { transitionnerEtatSurvie } from "./etat-survie.js";
import { lireMontantChargeUtile } from "./evenements-economiques.js";
import { ajusterHighWaterMarkTransfert } from "./high-water-mark.js";
import type { MicroUsdc } from "./monnaie.js";
import { POINTS_DE_BASE_PAR_UNITE } from "./monnaie.js";
import {
  additionnerValeursAttenduesExactes,
  calculerRegretExAnte,
  calculerValeurAttendueAgir,
  calculerValeurAttendueAttendre,
  creerValeurAttendueExacte,
  determinerMeilleureActionExAnte,
  type ActionDecisionExAnte,
  type ValeurAttendueExacte,
} from "./valeur-attendue-decision.js";

export const VERSION_MESURES_FITNESS = "fitness-descriptive-v01" as const;

export type FenetreEvaluation = {
  readonly cycleDebut: number;
  readonly cycleFin: number;
};

export type RatioEntierDescriptif = {
  readonly numerateurMicroUsdc: MicroUsdc;
  readonly denominateurMicroUsdc: MicroUsdc;
  /** Quotient × 1_000_000 (échelle fixe, tronqué vers zéro). Null si dénominateur 0. */
  readonly quotientEchelleMillion: MicroUsdc | null;
};

export type PointHistoriqueFitness = {
  readonly numeroCycle: number;
  readonly venMicroUsdc: MicroUsdc;
  readonly drawdownDepuisPicMicroUsdc: MicroUsdc;
  readonly resultatOperationnelCumuleMicroUsdc: MicroUsdc;
  readonly resultatApresContratCumuleMicroUsdc: MicroUsdc;
  readonly computeCumuleMicroUsdc: MicroUsdc;
  /** Regret cumulé exact (numérateur BPS) ; pas de troncature. */
  readonly regretExAnteCumule: ValeurAttendueExacte;
};

export type MesuresEconomieFitness = {
  readonly venDebutMicroUsdc: MicroUsdc;
  readonly venFinMicroUsdc: MicroUsdc;
  readonly variationVenMicroUsdc: MicroUsdc;
  readonly capitalLiquideFin: MicroUsdc;
  readonly obligationsFin: MicroUsdc;
  /** Genesis + injections capital dans la fenêtre. */
  readonly capitalisationExogeneMicroUsdc: MicroUsdc;
  readonly transfertsInternesRecusMicroUsdc: MicroUsdc;
  readonly transfertsInternesEnvoyesMicroUsdc: MicroUsdc;
  /**
   * variationVen − capitalisation − reçus + envoyés.
   * Neutralise les injections/transferts ; conserve loyer/redevance.
   */
  readonly variationVenNeutraliseeExogenesMicroUsdc: MicroUsdc;
  readonly revenusActiviteMicroUsdc: MicroUsdc;
  readonly pertesActiviteMicroUsdc: MicroUsdc;
  readonly depensesComputeMicroUsdc: MicroUsdc;
  readonly depensesDonneesMicroUsdc: MicroUsdc;
  readonly fraisExecutionMicroUsdc: MicroUsdc;
  readonly loyersPayesMicroUsdc: MicroUsdc;
  readonly redevancesProprietairePayeesMicroUsdc: MicroUsdc;
  readonly resultatActiviteBrutMicroUsdc: MicroUsdc;
  readonly resultatOperationnelAvantContratMicroUsdc: MicroUsdc;
  readonly resultatApresContratMicroUsdc: MicroUsdc;
};

export type MesuresDecisionFitness = {
  readonly nombreDecisions: number;
  readonly nombreDecisionsAvecInference: number;
  readonly nombreDecisionsSansInference: number;
  readonly nombreActionsAgir: number;
  readonly nombreActionsAttendre: number;
  readonly nombreDecisionsOptimalesExAnte: number;
  /** BPS — null si aucune décision. */
  readonly tauxDecisionsOptimalesExAnteBps: number | null;
  /** Somme exacte des numérateurs de regret (dénominateur 10_000). */
  readonly regretExAnteCumule: ValeurAttendueExacte;
  /** Somme exacte des EV des actions choisies (dénominateur 10_000). */
  readonly valeurAttendueCumuleeActionChoisie: ValeurAttendueExacte;
  readonly nombreSuccesRealises: number;
  readonly nombreEchecsRealises: number;
  readonly resultatActiviteRealiseMicroUsdc: MicroUsdc;
  /** Null si aucune action « agir ». */
  readonly gainMoyenRealiseParActionAgirMicroUsdc: MicroUsdc | null;
  readonly tauxOptimalesAvecInferenceBps: number | null;
  readonly tauxOptimalesSansInferenceBps: number | null;
  readonly regretMoyenAvecInference: ValeurAttendueExacte | null;
  readonly regretMoyenSansInference: ValeurAttendueExacte | null;
  readonly coutCognitifAvecInferenceMicroUsdc: MicroUsdc;
  readonly coutCognitifSansInferenceMicroUsdc: MicroUsdc;
};

export type MesuresCognitionFitness = {
  readonly nombreDemandesInference: number;
  readonly nombreInferencesExecutees: number;
  readonly nombreRefusXway: number;
  readonly nombreSortiesInvalides: number;
  readonly coutCognitifTotalMicroUsdc: MicroUsdc;
  readonly coutCognitifMoyenParDecisionMicroUsdc: MicroUsdc | null;
  readonly coutCognitifMoyenParDecisionAvecInferenceMicroUsdc: MicroUsdc | null;
  readonly jetonsEntreeTotal: number;
  readonly jetonsSortieTotal: number;
  /**
   * NON CAUSAL — ratio descriptif résultat opérationnel / coût cognitif.
   * Absent si coût cognitif = 0.
   */
  readonly ratioResultatOperationnelSurCoutCognitif: RatioEntierDescriptif | null;
};

export type MesuresRisqueFitness = {
  readonly picVenMicroUsdc: MicroUsdc;
  readonly drawdownMaxMicroUsdc: MicroUsdc;
  /** BPS vs pic au moment du drawdown max — null si pic = 0. */
  readonly drawdownMaxBps: number | null;
  readonly cycleDuDrawdownMax: number | null;
  readonly runwayMinimumObserve: number | null;
};

export type MesuresSurvieFitness = {
  readonly cycleNaissance: number;
  readonly cyclesVecus: number;
  readonly etatCourant: EtatSurvie;
  readonly cycleMort: number | null;
  readonly causeMort: string | null;
};

export type MesuresResilienceFitness = {
  readonly nombreCyclesSain: number;
  readonly nombreCyclesContraint: number;
  readonly nombreCyclesCritique: number;
  readonly nombreCyclesDormant: number;
  readonly nombreCyclesMort: number;
  readonly nombreTransitionsEtat: number;
  readonly nombrePassagesCritiqueVersSain: number;
};

export type MesuresContributionFitness = {
  readonly loyersPayesMicroUsdc: MicroUsdc;
  readonly redevancesPayeesMicroUsdc: MicroUsdc;
  readonly contributionProprietaireTotaleMicroUsdc: MicroUsdc;
};

/**
 * Bundle multidimensionnel — PAS de champ `score` / `fitness` scalaire.
 */
export type MesuresFitnessAgent = {
  readonly versionMesuresFitness: typeof VERSION_MESURES_FITNESS;
  readonly identifiantAgent: string;
  readonly fenetre: FenetreEvaluation;
  readonly economie: MesuresEconomieFitness;
  readonly decision: MesuresDecisionFitness;
  readonly cognition: MesuresCognitionFitness;
  readonly risque: MesuresRisqueFitness;
  readonly survie: MesuresSurvieFitness;
  readonly resilience: MesuresResilienceFitness;
  readonly contribution: MesuresContributionFitness;
  readonly historiqueParCycle: readonly PointHistoriqueFitness[];
  /** Bannière méthodologique. */
  readonly avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE";
};

export type EvenementPourFitness = {
  readonly type: string;
  readonly identifiant: string;
  readonly identifiantAgent?: string;
  readonly numeroCycle: number;
  readonly sequence: number;
  readonly chargeUtile?: Readonly<Record<string, unknown>>;
};

function lireMontantSafe(
  charge: Readonly<Record<string, unknown>> | undefined,
  cle: string,
): MicroUsdc {
  if (charge === undefined || charge[cle] === undefined) {
    return 0n;
  }
  try {
    return lireMontantChargeUtile(charge as Record<string, unknown>, cle);
  } catch {
    return 0n;
  }
}

function appliquerEvenementEconomique(
  brouillon: BrouillonEtatEconomique,
  evenement: EvenementPourFitness,
): void {
  const charge = evenement.chargeUtile ?? {};
  switch (evenement.type) {
    case "CAPITAL_INITIAL_ATTRIBUE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide += montant;
      if (montant > brouillon.highWaterMarkProprietaire) {
        brouillon.highWaterMarkProprietaire = montant;
      }
      break;
    }
    case "REVENU_ACTIVITE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide += montant;
      brouillon.totalRevenusActivite += montant;
      break;
    }
    case "PERTE_ACTIVITE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalPertesActivite += montant;
      break;
    }
    case "DEPENSE_COMPUTE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalDepensesCompute += montant;
      break;
    }
    case "DEPENSE_DONNEES": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalDepensesDonnees += montant;
      break;
    }
    case "FRAIS_EXECUTION": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalFraisExecution += montant;
      break;
    }
    case "LOYER_INFRASTRUCTURE_PAYE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalLoyersPayes += montant;
      break;
    }
    case "REDEVANCE_PROPRIETAIRE_DUE": {
      brouillon.highWaterMarkProprietaire = lireMontantSafe(
        charge,
        "highWaterMarkApresMicroUsdc",
      );
      break;
    }
    case "REDEVANCE_PROPRIETAIRE_PAYEE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.capitalLiquide -= montant;
      brouillon.totalRedevancesProprietairePayees += montant;
      break;
    }
    case "DETTE_CREEE": {
      brouillon.obligationsDues += lireMontantSafe(charge, "montantMicroUsdc");
      break;
    }
    case "DETTE_REGLEE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      brouillon.obligationsDues -= montant;
      brouillon.capitalLiquide -= montant;
      if (charge.motif === "loyer_infrastructure") {
        brouillon.totalLoyersPayes += montant;
      } else if (charge.motif === "redevance_proprietaire") {
        brouillon.totalRedevancesProprietairePayees += montant;
      }
      break;
    }
    case "TRANSFERT_INTERNE": {
      const montant = lireMontantSafe(charge, "montantMicroUsdc");
      if (charge.sens === "sortie") {
        brouillon.capitalLiquide -= montant;
        brouillon.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
          brouillon.highWaterMarkProprietaire,
          montant,
          "sortie",
        );
      } else if (charge.sens === "entree") {
        brouillon.capitalLiquide += montant;
        brouillon.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
          brouillon.highWaterMarkProprietaire,
          montant,
          "entree",
        );
      }
      break;
    }
    case "ETAT_SURVIE_MODIFIE": {
      const vers = charge.vers;
      if (
        vers === "sain" ||
        vers === "contraint" ||
        vers === "critique" ||
        vers === "dormant" ||
        vers === "mort"
      ) {
        brouillon.etatSurvie = transitionnerEtatSurvie(
          brouillon.etatSurvie,
          vers,
        );
      }
      break;
    }
    case "AGENT_DORMANT": {
      brouillon.etatSurvie = transitionnerEtatSurvie(
        brouillon.etatSurvie,
        "dormant",
      );
      if (typeof charge.cyclesDormanceConsecutifs === "number") {
        brouillon.cyclesDormanceConsecutifs = charge.cyclesDormanceConsecutifs;
      }
      break;
    }
    case "AGENT_MORT": {
      brouillon.etatSurvie = transitionnerEtatSurvie(
        brouillon.etatSurvie,
        "mort",
      );
      break;
    }
    case "CYCLE_TERMINE": {
      brouillon.dernierNumeroCycle = evenement.numeroCycle;
      if (
        typeof charge.etatSurvie === "string" &&
        (charge.etatSurvie === "sain" ||
          charge.etatSurvie === "contraint" ||
          charge.etatSurvie === "critique" ||
          charge.etatSurvie === "dormant" ||
          charge.etatSurvie === "mort")
      ) {
        brouillon.etatSurvie = charge.etatSurvie;
      }
      break;
    }
    default:
      break;
  }
}

function snapshotTotaux(etat: EtatEconomiqueAgent): {
  revenus: MicroUsdc;
  pertes: MicroUsdc;
  compute: MicroUsdc;
  donnees: MicroUsdc;
  frais: MicroUsdc;
  loyers: MicroUsdc;
  redevances: MicroUsdc;
  ven: MicroUsdc;
} {
  return {
    revenus: etat.totalRevenusActivite,
    pertes: etat.totalPertesActivite,
    compute: etat.totalDepensesCompute,
    donnees: etat.totalDepensesDonnees,
    frais: etat.totalFraisExecution,
    loyers: etat.totalLoyersPayes,
    redevances: etat.totalRedevancesProprietairePayees,
    ven: calculerValeurEconomiqueNette(etat),
  };
}

function fabriquerRatio(
  numerateur: MicroUsdc,
  denominateur: MicroUsdc,
): RatioEntierDescriptif | null {
  if (denominateur === 0n) {
    return null;
  }
  return {
    numerateurMicroUsdc: numerateur,
    denominateurMicroUsdc: denominateur,
    quotientEchelleMillion: (numerateur * 1_000_000n) / denominateur,
  };
}

function tauxBps(numerateur: number, denominateur: number): number | null {
  if (denominateur === 0) {
    return null;
  }
  return Number(
    (BigInt(numerateur) * POINTS_DE_BASE_PAR_UNITE) / BigInt(denominateur),
  );
}

type AccDecisionCycle = {
  observation?: {
    probabiliteSuccesBps: number;
    gain: MicroUsdc;
    perte: MicroUsdc;
    frais: MicroUsdc;
  };
  utiliserInference?: boolean;
  action?: ActionDecisionExAnte;
  coutCognitif: MicroUsdc;
  issue?: "succes" | "echec" | "aucune";
  revenu: MicroUsdc;
  perteRealisee: MicroUsdc;
};

/**
 * Calcule les mesures fitness d'un agent depuis le registre.
 * Complexité : O(n) sur les événements de l'agent (une passe + fenêtrage).
 */
export function calculerMesuresFitnessAgent(options: {
  readonly identifiantAgent: string;
  readonly evenements: readonly EvenementPourFitness[];
  readonly fenetre?: FenetreEvaluation;
  readonly cycleCourant?: number;
}): MesuresFitnessAgent {
  const agentId = options.identifiantAgent;
  const ordonnes = [...options.evenements]
    .filter((e) => e.identifiantAgent === agentId)
    .sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return a.numeroCycle - b.numeroCycle;
    });

  let cycleMax = 0;
  let cycleNaissance = 0;
  for (const e of ordonnes) {
    if (e.numeroCycle > cycleMax) {
      cycleMax = e.numeroCycle;
    }
    if (e.type === "AGENT_CREE") {
      cycleNaissance = e.numeroCycle;
    }
  }
  const cycleCourant = options.cycleCourant ?? cycleMax;
  const fenetre: FenetreEvaluation = options.fenetre ?? {
    cycleDebut: cycleNaissance,
    cycleFin: cycleCourant,
  };
  if (fenetre.cycleDebut > fenetre.cycleFin) {
    throw new Error(
      `Fenêtre invalide : début ${String(fenetre.cycleDebut)} > fin ${String(fenetre.cycleFin)}`,
    );
  }

  const brouillon: BrouillonEtatEconomique = {
    ...creerEtatEconomiqueInitial({ identifiantAgent: agentId }),
    highWaterMarkProprietaire: 0n,
  };

  let snapshotAvantFenetre: ReturnType<typeof snapshotTotaux> | null = null;

  let capitalisationFenetre = 0n;
  let transfertsRecus = 0n;
  let transfertsEnvoyes = 0n;

  let picVen = 0n;
  let drawdownMax = 0n;
  let drawdownMaxBps: number | null = null;
  let cycleDrawdownMax: number | null = null;
  let runwayMin: number | null = null;

  let cycleMort: number | null = null;
  let causeMort: string | null = null;
  let nombreTransitions = 0;
  let passagesCritiqueVersSain = 0;

  const compteCycles: Record<EtatSurvie, number> = {
    sain: 0,
    contraint: 0,
    critique: 0,
    dormant: 0,
    mort: 0,
  };

  const historique: PointHistoriqueFitness[] = [];

  const decisionsParCycle = new Map<number, AccDecisionCycle>();

  let demandesInference = 0;
  let inferencesExecutees = 0;
  let refusXway = 0;
  let sortiesInvalides = 0;
  let jetonsEntree = 0;
  let jetonsSortie = 0;

  const dansFenetre = (cycle: number) =>
    cycle >= fenetre.cycleDebut && cycle <= fenetre.cycleFin;

  for (const evenement of ordonnes) {
    // Snapshot juste avant d'entrer dans la fenêtre
    if (
      snapshotAvantFenetre === null &&
      evenement.numeroCycle >= fenetre.cycleDebut
    ) {
      snapshotAvantFenetre = snapshotTotaux(figerEtatEconomique(brouillon));
      picVen = snapshotAvantFenetre.ven;
    }

    const etatAvantEvt = brouillon.etatSurvie;
    appliquerEvenementEconomique(brouillon, evenement);
    const charge = evenement.chargeUtile ?? {};

    if (
      evenement.type === "ETAT_SURVIE_MODIFIE" ||
      evenement.type === "AGENT_DORMANT" ||
      evenement.type === "AGENT_MORT"
    ) {
      if (dansFenetre(evenement.numeroCycle) && brouillon.etatSurvie !== etatAvantEvt) {
        nombreTransitions += 1;
        if (etatAvantEvt === "critique" && brouillon.etatSurvie === "sain") {
          passagesCritiqueVersSain += 1;
        }
      }
    }

    if (evenement.type === "AGENT_MORT" && dansFenetre(evenement.numeroCycle)) {
      cycleMort = evenement.numeroCycle;
      causeMort =
        typeof charge.motif === "string"
          ? charge.motif
          : typeof charge.cause === "string"
            ? charge.cause
            : "dormance_prolongee";
    }

    if (dansFenetre(evenement.numeroCycle)) {
      if (evenement.type === "CAPITAL_INITIAL_ATTRIBUE") {
        capitalisationFenetre += lireMontantSafe(charge, "montantMicroUsdc");
      }
      if (evenement.type === "TRANSFERT_INTERNE") {
        const m = lireMontantSafe(charge, "montantMicroUsdc");
        if (charge.sens === "entree") {
          transfertsRecus += m;
        } else if (charge.sens === "sortie") {
          transfertsEnvoyes += m;
        }
      }
      if (evenement.type === "DEMANDE_INFERENCE_RECUE") {
        demandesInference += 1;
      }
      if (evenement.type === "INFERENCE_EXECUTEE") {
        inferencesExecutees += 1;
        if (typeof charge.jetonsEntree === "number") {
          jetonsEntree += charge.jetonsEntree;
        }
        if (typeof charge.jetonsSortie === "number") {
          jetonsSortie += charge.jetonsSortie;
        }
      }
      if (evenement.type === "DEMANDE_INFERENCE_REFUSEE") {
        refusXway += 1;
      }
      if (
        evenement.type === "INFERENCE_ECHOUEE" ||
        (evenement.type === "DECISION_AGENT_REFUSEE" &&
          typeof charge.motifRefus === "string" &&
          charge.motifRefus.includes("invalide"))
      ) {
        sortiesInvalides += 1;
      }
    }

    // Décisions
    if (dansFenetre(evenement.numeroCycle)) {
      let acc = decisionsParCycle.get(evenement.numeroCycle);
      if (acc === undefined) {
        acc = { coutCognitif: 0n, revenu: 0n, perteRealisee: 0n };
        decisionsParCycle.set(evenement.numeroCycle, acc);
      }
      if (evenement.type === "OBSERVATION_AGENT_RECUE") {
        const donnees =
          charge.donnees !== null &&
          typeof charge.donnees === "object" &&
          !Array.isArray(charge.donnees)
            ? (charge.donnees as Record<string, unknown>)
            : {};
        if (typeof donnees.probabiliteSuccesBps === "number") {
          acc.observation = {
            probabiliteSuccesBps: donnees.probabiliteSuccesBps,
            gain: lireMontantSafe(donnees, "gainSiSuccesMicroUsdc"),
            perte: lireMontantSafe(donnees, "perteSiEchecMicroUsdc"),
            frais: lireMontantSafe(donnees, "fraisActionMicroUsdc"),
          };
        }
      }
      if (evenement.type === "CHOIX_COGNITIF_EFFECTUE") {
        acc.utiliserInference = charge.utiliserInference === true;
      }
      if (evenement.type === "DECISION_AGENT_VALIDEE") {
        acc.action = charge.action === "agir" ? "agir" : "attendre";
        acc.coutCognitif = lireMontantSafe(charge, "coutCognitifMicroUsdc");
      }
      if (evenement.type === "RESULTAT_ACTION_OBSERVE") {
        const issue = charge.issue;
        acc.issue =
          issue === "succes" || issue === "echec" || issue === "aucune"
            ? issue
            : "aucune";
        acc.revenu = lireMontantSafe(charge, "revenuActiviteMicroUsdc");
        acc.perteRealisee = lireMontantSafe(charge, "perteActiviteMicroUsdc");
      }
    }

    const venCourante = calculerValeurEconomiqueNette(brouillon);
    if (
      snapshotAvantFenetre !== null &&
      dansFenetre(evenement.numeroCycle) &&
      venCourante > picVen
    ) {
      picVen = venCourante;
    }
    if (snapshotAvantFenetre !== null && dansFenetre(evenement.numeroCycle)) {
      const dd = picVen - venCourante;
      if (dd > drawdownMax) {
        drawdownMax = dd;
        cycleDrawdownMax = evenement.numeroCycle;
        drawdownMaxBps =
          picVen === 0n
            ? null
            : Number((dd * POINTS_DE_BASE_PAR_UNITE) / picVen);
      }
    }

    if (evenement.type === "CYCLE_TERMINE" && dansFenetre(evenement.numeroCycle)) {
      const runway =
        typeof charge.runway === "number" ? charge.runway : null;
      if (runway !== null) {
        runwayMin =
          runwayMin === null ? runway : Math.min(runwayMin, runway);
      }
      const etatFin = brouillon.etatSurvie;
      compteCycles[etatFin] += 1;

      const tot = snapshotTotaux(figerEtatEconomique(brouillon));
      const base = snapshotAvantFenetre ?? {
        revenus: 0n,
        pertes: 0n,
        compute: 0n,
        donnees: 0n,
        frais: 0n,
        loyers: 0n,
        redevances: 0n,
        ven: 0n,
      };
      const op =
        tot.revenus -
        base.revenus -
        (tot.pertes - base.pertes) -
        (tot.compute - base.compute) -
        (tot.donnees - base.donnees) -
        (tot.frais - base.frais);
      const apres =
        op - (tot.loyers - base.loyers) - (tot.redevances - base.redevances);

      let regretJusqua = creerValeurAttendueExacte(0n);
      for (const [cyc, d] of decisionsParCycle) {
        if (cyc > evenement.numeroCycle) {
          continue;
        }
        if (d.observation !== undefined && d.action !== undefined) {
          const evAgir = calculerValeurAttendueAgir({
            probabiliteSuccesBps: d.observation.probabiliteSuccesBps,
            gainSiSuccesMicroUsdc: d.observation.gain,
            perteSiEchecMicroUsdc: d.observation.perte,
            fraisActionMicroUsdc: d.observation.frais,
          });
          regretJusqua = additionnerValeursAttenduesExactes(
            regretJusqua,
            calculerRegretExAnte({
              valeurAttendueAgir: evAgir,
              actionChoisie: d.action,
            }),
          );
        }
      }

      historique.push({
        numeroCycle: evenement.numeroCycle,
        venMicroUsdc: tot.ven,
        drawdownDepuisPicMicroUsdc: picVen - tot.ven < 0n ? 0n : picVen - tot.ven,
        resultatOperationnelCumuleMicroUsdc: op,
        resultatApresContratCumuleMicroUsdc: apres,
        computeCumuleMicroUsdc: tot.compute - base.compute,
        regretExAnteCumule: regretJusqua,
      });
    }
  }

  if (snapshotAvantFenetre === null) {
    snapshotAvantFenetre = snapshotTotaux(figerEtatEconomique(brouillon));
    picVen = snapshotAvantFenetre.ven;
  }

  const etatFinFenetre = reconstruireEtatJusquaCycle(ordonnes, agentId, fenetre.cycleFin);
  const etatDebutFenetre =
    fenetre.cycleDebut <= 0
      ? creerEtatEconomiqueInitial({ identifiantAgent: agentId })
      : reconstruireEtatJusquaCycle(ordonnes, agentId, fenetre.cycleDebut - 1);

  const totDebut = snapshotTotaux(etatDebutFenetre);
  const totFin = snapshotTotaux(etatFinFenetre);

  const revenus = totFin.revenus - totDebut.revenus;
  const pertes = totFin.pertes - totDebut.pertes;
  const compute = totFin.compute - totDebut.compute;
  const donnees = totFin.donnees - totDebut.donnees;
  const frais = totFin.frais - totDebut.frais;
  const loyers = totFin.loyers - totDebut.loyers;
  const redevances = totFin.redevances - totDebut.redevances;
  const resultatBrut = revenus - pertes;
  const resultatOp = resultatBrut - compute - donnees - frais;
  const resultatApres = resultatOp - loyers - redevances;
  const variationVen = totFin.ven - totDebut.ven;
  const variationNeutralisee =
    variationVen - capitalisationFenetre - transfertsRecus + transfertsEnvoyes;

  // Stats décisions
  let nombreDecisions = 0;
  let avecInf = 0;
  let sansInf = 0;
  let nbAgir = 0;
  let nbAttendre = 0;
  let nbOptimales = 0;
  let regretCumule = creerValeurAttendueExacte(0n);
  let evCumulee = creerValeurAttendueExacte(0n);
  let succes = 0;
  let echecs = 0;
  let resultatRealise = 0n;
  let sommeGainsAgir = 0n;
  let nbAgirAvecResultat = 0;

  let optAvecInf = 0;
  let optSansInf = 0;
  let nAvecInf = 0;
  let nSansInf = 0;
  let regretAvecInf = creerValeurAttendueExacte(0n);
  let regretSansInf = creerValeurAttendueExacte(0n);
  let coutAvecInf = 0n;
  let coutSansInf = 0n;

  for (const [, d] of decisionsParCycle) {
    if (d.action === undefined || d.observation === undefined) {
      continue;
    }
    nombreDecisions += 1;
    const evAgir = calculerValeurAttendueAgir({
      probabiliteSuccesBps: d.observation.probabiliteSuccesBps,
      gainSiSuccesMicroUsdc: d.observation.gain,
      perteSiEchecMicroUsdc: d.observation.perte,
      fraisActionMicroUsdc: d.observation.frais,
    });
    const evAtt = calculerValeurAttendueAttendre();
    const meilleure = determinerMeilleureActionExAnte(evAgir, evAtt);
    const regret = calculerRegretExAnte({
      valeurAttendueAgir: evAgir,
      valeurAttendueAttendre: evAtt,
      actionChoisie: d.action,
    });
    const evChoisie = d.action === "agir" ? evAgir : evAtt;
    regretCumule = additionnerValeursAttenduesExactes(regretCumule, regret);
    evCumulee = additionnerValeursAttenduesExactes(evCumulee, evChoisie);

    const avec = d.utiliserInference === true;
    if (avec) {
      avecInf += 1;
      nAvecInf += 1;
      regretAvecInf = additionnerValeursAttenduesExactes(regretAvecInf, regret);
      coutAvecInf += d.coutCognitif;
      if (d.action === meilleure) {
        optAvecInf += 1;
      }
    } else {
      sansInf += 1;
      nSansInf += 1;
      regretSansInf = additionnerValeursAttenduesExactes(regretSansInf, regret);
      coutSansInf += d.coutCognitif;
      if (d.action === meilleure) {
        optSansInf += 1;
      }
    }
    if (d.action === meilleure) {
      nbOptimales += 1;
    }
    if (d.action === "agir") {
      nbAgir += 1;
    } else {
      nbAttendre += 1;
    }
    if (d.issue === "succes") {
      succes += 1;
    }
    if (d.issue === "echec") {
      echecs += 1;
    }
    const net = d.revenu - d.perteRealisee;
    resultatRealise += net;
    if (d.action === "agir") {
      sommeGainsAgir += net;
      nbAgirAvecResultat += 1;
    }
  }

  const coutCognitifTotal = coutAvecInf + coutSansInf;

  const cyclesVecusExact = historique.length;

  return {
    versionMesuresFitness: VERSION_MESURES_FITNESS,
    identifiantAgent: agentId,
    fenetre,
    economie: {
      venDebutMicroUsdc: totDebut.ven,
      venFinMicroUsdc: totFin.ven,
      variationVenMicroUsdc: variationVen,
      capitalLiquideFin: etatFinFenetre.capitalLiquide,
      obligationsFin: etatFinFenetre.obligationsDues,
      capitalisationExogeneMicroUsdc: capitalisationFenetre,
      transfertsInternesRecusMicroUsdc: transfertsRecus,
      transfertsInternesEnvoyesMicroUsdc: transfertsEnvoyes,
      variationVenNeutraliseeExogenesMicroUsdc: variationNeutralisee,
      revenusActiviteMicroUsdc: revenus,
      pertesActiviteMicroUsdc: pertes,
      depensesComputeMicroUsdc: compute,
      depensesDonneesMicroUsdc: donnees,
      fraisExecutionMicroUsdc: frais,
      loyersPayesMicroUsdc: loyers,
      redevancesProprietairePayeesMicroUsdc: redevances,
      resultatActiviteBrutMicroUsdc: resultatBrut,
      resultatOperationnelAvantContratMicroUsdc: resultatOp,
      resultatApresContratMicroUsdc: resultatApres,
    },
    decision: {
      nombreDecisions,
      nombreDecisionsAvecInference: avecInf,
      nombreDecisionsSansInference: sansInf,
      nombreActionsAgir: nbAgir,
      nombreActionsAttendre: nbAttendre,
      nombreDecisionsOptimalesExAnte: nbOptimales,
      tauxDecisionsOptimalesExAnteBps: tauxBps(nbOptimales, nombreDecisions),
      regretExAnteCumule: regretCumule,
      valeurAttendueCumuleeActionChoisie: evCumulee,
      nombreSuccesRealises: succes,
      nombreEchecsRealises: echecs,
      resultatActiviteRealiseMicroUsdc: resultatRealise,
      gainMoyenRealiseParActionAgirMicroUsdc:
        nbAgirAvecResultat > 0
          ? sommeGainsAgir / BigInt(nbAgirAvecResultat)
          : null,
      tauxOptimalesAvecInferenceBps: tauxBps(optAvecInf, nAvecInf),
      tauxOptimalesSansInferenceBps: tauxBps(optSansInf, nSansInf),
      regretMoyenAvecInference:
        nAvecInf > 0
          ? creerValeurAttendueExacte(
              regretAvecInf.numerateurMicroUsdcBps / BigInt(nAvecInf),
            )
          : null,
      regretMoyenSansInference:
        nSansInf > 0
          ? creerValeurAttendueExacte(
              regretSansInf.numerateurMicroUsdcBps / BigInt(nSansInf),
            )
          : null,
      coutCognitifAvecInferenceMicroUsdc: coutAvecInf,
      coutCognitifSansInferenceMicroUsdc: coutSansInf,
    },
    cognition: {
      nombreDemandesInference: demandesInference,
      nombreInferencesExecutees: inferencesExecutees,
      nombreRefusXway: refusXway,
      nombreSortiesInvalides: sortiesInvalides,
      coutCognitifTotalMicroUsdc: coutCognitifTotal,
      coutCognitifMoyenParDecisionMicroUsdc:
        nombreDecisions > 0
          ? coutCognitifTotal / BigInt(nombreDecisions)
          : null,
      coutCognitifMoyenParDecisionAvecInferenceMicroUsdc:
        avecInf > 0 ? coutAvecInf / BigInt(avecInf) : null,
      jetonsEntreeTotal: jetonsEntree,
      jetonsSortieTotal: jetonsSortie,
      ratioResultatOperationnelSurCoutCognitif: fabriquerRatio(
        resultatOp,
        coutCognitifTotal,
      ),
    },
    risque: {
      picVenMicroUsdc: picVen,
      drawdownMaxMicroUsdc: drawdownMax,
      drawdownMaxBps,
      cycleDuDrawdownMax: cycleDrawdownMax,
      runwayMinimumObserve: runwayMin,
    },
    survie: {
      cycleNaissance,
      cyclesVecus: cyclesVecusExact,
      etatCourant: etatFinFenetre.etatSurvie,
      cycleMort,
      causeMort,
    },
    resilience: {
      nombreCyclesSain: compteCycles.sain,
      nombreCyclesContraint: compteCycles.contraint,
      nombreCyclesCritique: compteCycles.critique,
      nombreCyclesDormant: compteCycles.dormant,
      nombreCyclesMort: compteCycles.mort,
      nombreTransitionsEtat: nombreTransitions,
      nombrePassagesCritiqueVersSain: passagesCritiqueVersSain,
    },
    contribution: {
      loyersPayesMicroUsdc: loyers,
      redevancesPayeesMicroUsdc: redevances,
      contributionProprietaireTotaleMicroUsdc: loyers + redevances,
    },
    historiqueParCycle: historique,
    avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE",
  };
}

function reconstruireEtatJusquaCycle(
  evenements: readonly EvenementPourFitness[],
  identifiantAgent: string,
  cycleMaxInclus: number,
): EtatEconomiqueAgent {
  const brouillon: BrouillonEtatEconomique = {
    ...creerEtatEconomiqueInitial({ identifiantAgent }),
    highWaterMarkProprietaire: 0n,
  };
  for (const evenement of evenements) {
    if (evenement.identifiantAgent !== identifiantAgent) {
      continue;
    }
    if (evenement.numeroCycle > cycleMaxInclus) {
      continue;
    }
    appliquerEvenementEconomique(brouillon, evenement);
  }
  return figerEtatEconomique(brouillon);
}

/**
 * Médiane déterministe :
 * - impair : élément central ;
 * - pair : moyenne tronquée vers zéro des deux valeurs centrales ((a+b)/2).
 */
export function medianeEntiere(valeurs: readonly bigint[]): bigint | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tries = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const milieu = Math.floor(tries.length / 2);
  if (tries.length % 2 === 1) {
    return tries[milieu]!;
  }
  return (tries[milieu - 1]! + tries[milieu]!) / 2n;
}

export function medianeNombre(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) {
    return null;
  }
  const tries = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tries.length / 2);
  if (tries.length % 2 === 1) {
    return tries[milieu]!;
  }
  return Math.trunc((tries[milieu - 1]! + tries[milieu]!) / 2);
}

export type AgregatDimensionFitness = {
  readonly min: string | null;
  readonly mediane: string | null;
  readonly max: string | null;
  readonly quartile1: string | null;
  readonly quartile3: string | null;
  readonly nombre: number;
};

function agregatBigint(valeurs: readonly bigint[]): AgregatDimensionFitness {
  if (valeurs.length === 0) {
    return {
      min: null,
      mediane: null,
      max: null,
      quartile1: null,
      quartile3: null,
      nombre: 0,
    };
  }
  const tries = [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const q1Index = Math.floor((tries.length - 1) / 4);
  const q3Index = Math.floor((3 * (tries.length - 1)) / 4);
  return {
    min: tries[0]!.toString(10),
    mediane: medianeEntiere(tries)!.toString(10),
    max: tries[tries.length - 1]!.toString(10),
    quartile1: tries[q1Index]!.toString(10),
    quartile3: tries[q3Index]!.toString(10),
    nombre: tries.length,
  };
}

/**
 * Agrégats population — dimensions séparées, aucun score synthétique.
 */
export type AgregatsFitnessPopulation = {
  readonly versionMesuresFitness: typeof VERSION_MESURES_FITNESS;
  readonly nombreAgents: number;
  readonly venFin: AgregatDimensionFitness;
  readonly resultatApresContrat: AgregatDimensionFitness;
  readonly depensesCompute: AgregatDimensionFitness;
  readonly regretExAnteCumule: AgregatDimensionFitness;
  readonly drawdownMax: AgregatDimensionFitness;
  readonly tauxDecisionsOptimalesBps: AgregatDimensionFitness;
  readonly contributionProprietaire: AgregatDimensionFitness;
  readonly avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE";
};

export function agregaterFitnessPopulation(
  mesures: readonly MesuresFitnessAgent[],
): AgregatsFitnessPopulation {
  return {
    versionMesuresFitness: VERSION_MESURES_FITNESS,
    nombreAgents: mesures.length,
    venFin: agregatBigint(mesures.map((m) => m.economie.venFinMicroUsdc)),
    resultatApresContrat: agregatBigint(
      mesures.map((m) => m.economie.resultatApresContratMicroUsdc),
    ),
    depensesCompute: agregatBigint(
      mesures.map((m) => m.economie.depensesComputeMicroUsdc),
    ),
    regretExAnteCumule: agregatBigint(
      mesures.map((m) => m.decision.regretExAnteCumule.numerateurMicroUsdcBps),
    ),
    drawdownMax: agregatBigint(
      mesures.map((m) => m.risque.drawdownMaxMicroUsdc),
    ),
    tauxDecisionsOptimalesBps: agregatBigint(
      mesures
        .map((m) => m.decision.tauxDecisionsOptimalesExAnteBps)
        .filter((t): t is number => t !== null)
        .map((t) => BigInt(t)),
    ),
    contributionProprietaire: agregatBigint(
      mesures.map((m) => m.contribution.contributionProprietaireTotaleMicroUsdc),
    ),
    avertissement: "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE",
  };
}

/** Garde-fou : aucune clé de score scalaire dans l'objet mesures. */
export function assertPasDeScoreScalaire(
  mesures: MesuresFitnessAgent,
): void {
  const interdit = [
    "score",
    "fitness",
    "rang",
    "ranking",
    "scoreGlobal",
    "fitnessGlobale",
  ];
  for (const cle of Object.keys(mesures)) {
    if (interdit.includes(cle)) {
      throw new Error(`Clé de score scalaire interdite : ${cle}`);
    }
  }
}
