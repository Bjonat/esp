import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  VERSION_MESURES_FITNESS,
  additionnerValeursAttenduesExactes,
  agregaterFitnessPopulation,
  arrondirValeurAttendueVersMicroUsdc,
  assertPasDeScoreScalaire,
  attribuerCapitalInitial,
  calculerMesuresFitnessAgent,
  calculerRegretExAnte,
  calculerValeurAttendueAgir,
  calculerValeurAttendueAttendre,
  creerTresorerieProprietaire,
  creerValeurAttendueExacte,
  determinerMeilleureActionExAnte,
  executerCycleEconomique,
  medianeEntiere,
  preparerTransfertInterne,
  reglerDette,
  usdcVersMicroUsdc,
  type EvenementPourFitness,
  type ParametresEconomiquesExperience,
} from "@esp/protocole";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
import {
  ControleurExperience,
  demarrerServeurApi,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
} from "../src/index.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) {
      rmSync(r, { recursive: true, force: true });
    }
  }
});

const parametres: ParametresEconomiquesExperience = {
  version: "fitness-test-v01",
  loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(10),
  periodeLoyerEnCycles: 1,
  tauxRedevanceProprietairePointsDeBase: 1000n,
  coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(1),
  seuilRunwaySainEnCycles: 20,
  seuilRunwayContraintEnCycles: 5,
  cyclesDormanceAvantMort: 3,
};

function avecSequence(
  evenements: readonly {
    identifiant: string;
    type: string;
    identifiantExperience: string;
    identifiantAgent?: string;
    numeroCycle: number;
    chargeUtile?: Readonly<Record<string, unknown>>;
  }[],
  sequenceDepart = 1,
): EvenementPourFitness[] {
  return evenements.map((e, i) => ({
    ...e,
    sequence: sequenceDepart + i,
  }));
}

describe("Fitness descriptive v0.1", () => {
  it("A — capital Genesis n'est pas de la performance", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(100),
    });
    const evts = avecSequence(
      naissance.evenements.map((e) => ({
        ...e,
        type: e.type,
      })),
    );
    // AGENT_CREE manquant dans attribuerCapital — ajouter
    const avecCree: EvenementPourFitness[] = [
      {
        identifiant: "cree",
        type: "AGENT_CREE",
        identifiantAgent: "a1",
        numeroCycle: 0,
        sequence: 1,
        chargeUtile: {},
      },
      ...evts.map((e, i) => ({ ...e, sequence: 2 + i })),
    ];
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements: avecCree,
      fenetre: { cycleDebut: 0, cycleFin: 0 },
    });
    expect(m.economie.capitalisationExogeneMicroUsdc).toBe(usdcVersMicroUsdc(100));
    expect(m.economie.variationVenMicroUsdc).toBe(usdcVersMicroUsdc(100));
    expect(m.economie.variationVenNeutraliseeExogenesMicroUsdc).toBe(0n);
    expect(m.economie.resultatOperationnelAvantContratMicroUsdc).toBe(0n);
    expect(m.economie.resultatApresContratMicroUsdc).toBe(0n);
  });

  it("B — résultat opérationnel exact", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(100),
    });
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
      parametres: { ...parametres, loyerInfrastructureMicroUsdc: 0n, tauxRedevanceProprietairePointsDeBase: 0n },
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: usdcVersMicroUsdc(30),
        perteActivite: usdcVersMicroUsdc(5),
        depenseCompute: usdcVersMicroUsdc(4),
        depenseDonnees: usdcVersMicroUsdc(2),
        fraisExecution: usdcVersMicroUsdc(1),
      },
    });
    const evenements = avecSequence([
      { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
      ...naissance.evenements,
      ...cycle.evenements,
    ]);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 1, cycleFin: 1 },
    });
    // 30 - 5 - 4 - 2 - 1 = 18
    expect(m.economie.resultatActiviteBrutMicroUsdc).toBe(usdcVersMicroUsdc(25));
    expect(m.economie.resultatOperationnelAvantContratMicroUsdc).toBe(
      usdcVersMicroUsdc(18),
    );
  });

  it("C — résultat après contrat exact", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(100),
    });
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: usdcVersMicroUsdc(30),
        perteActivite: 0n,
        depenseCompute: usdcVersMicroUsdc(5),
        depenseDonnees: usdcVersMicroUsdc(3),
        fraisExecution: usdcVersMicroUsdc(2),
      },
    });
    const evenements = avecSequence([
      { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
      ...naissance.evenements,
      ...cycle.evenements,
    ]);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 1, cycleFin: 1 },
    });
    // op = 30-5-3-2 = 20 ; loyer 10 ; redevance 1 (HWM) → 9
    expect(m.economie.loyersPayesMicroUsdc).toBe(usdcVersMicroUsdc(10));
    expect(m.economie.redevancesProprietairePayeesMicroUsdc).toBe(
      usdcVersMicroUsdc(1),
    );
    expect(m.economie.resultatApresContratMicroUsdc).toBe(usdcVersMicroUsdc(9));
    expect(m.contribution.contributionProprietaireTotaleMicroUsdc).toBe(
      usdcVersMicroUsdc(11),
    );
  });

  it("D — dette créée puis réglée : pas de double perte", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(5),
    });
    // Cycle avec loyer 10 > capital → dette
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
      parametres: {
        ...parametres,
        tauxRedevanceProprietairePointsDeBase: 0n,
      },
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: 0n,
        perteActivite: 0n,
        depenseCompute: 0n,
        depenseDonnees: 0n,
        fraisExecution: 0n,
      },
    });
    expect(cycle.etat.obligationsDues).toBe(usdcVersMicroUsdc(10));
    // Injecter capital puis régler
    const apresCapital = {
      ...cycle.etat,
      capitalLiquide: cycle.etat.capitalLiquide + usdcVersMicroUsdc(20),
    };
    const reglement = reglerDette({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 2,
      etat: apresCapital,
      motif: "loyer_infrastructure",
      montant: usdcVersMicroUsdc(10),
      tresorerie: cycle.tresorerie,
    });
    const evenements = avecSequence([
      { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
      ...naissance.evenements,
      ...cycle.evenements,
      {
        identifiant: "cap2",
        type: "CAPITAL_INITIAL_ATTRIBUE",
        identifiantExperience: "exp",
        identifiantAgent: "a1",
        numeroCycle: 2,
        chargeUtile: { montantMicroUsdc: "20000000" },
      },
      ...reglement.evenements,
    ]);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 0, cycleFin: 2 },
    });
    // Loyer payé une seule fois (via DETTE_REGLEE)
    expect(m.economie.loyersPayesMicroUsdc).toBe(usdcVersMicroUsdc(10));
    // VEN : genesis 5 - dette 10 (+ven) puis +20 capital -10 cash = net cohérent
    expect(m.economie.obligationsFin).toBe(0n);
  });

  it("E — EV agir exacte sans float", () => {
    // p=6000, gain=800000, perte=400000, frais=20000
    // numerateur = 6000*800000 - 4000*400000 - 10000*20000 = 3_000_000_000
    // EV exacte = 300000 µUSDC
    const ev = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 6000,
      gainSiSuccesMicroUsdc: 800_000n,
      perteSiEchecMicroUsdc: 400_000n,
      fraisActionMicroUsdc: 20_000n,
    });
    expect(ev.numerateurMicroUsdcBps).toBe(3_000_000_000n);
    expect(ev.denominateurBps).toBe(10_000n);
    expect(arrondirValeurAttendueVersMicroUsdc(ev)).toBe(300_000n);
    expect(calculerValeurAttendueAttendre()).toEqual(creerValeurAttendueExacte(0n));
  });

  it("F — décision optimale ex ante", () => {
    expect(
      determinerMeilleureActionExAnte(creerValeurAttendueExacte(300_000n * 10_000n)),
    ).toBe("agir");
    expect(
      determinerMeilleureActionExAnte(creerValeurAttendueExacte(-100n * 10_000n)),
    ).toBe("attendre");
    expect(determinerMeilleureActionExAnte(creerValeurAttendueExacte(0n))).toBe(
      "attendre",
    );
  });

  it("G — bonne décision + mauvais tirage reste optimale", () => {
    const evAgir = creerValeurAttendueExacte(300_000n * 10_000n);
    const regret = calculerRegretExAnte({
      valeurAttendueAgir: evAgir,
      actionChoisie: "agir",
    });
    expect(regret.numerateurMicroUsdcBps).toBe(0n);
    expect(determinerMeilleureActionExAnte(evAgir)).toBe("agir");
  });

  it("H — mauvaise décision + bon tirage conserve regret", () => {
    const evAgir = creerValeurAttendueExacte(300_000n * 10_000n);
    const regret = calculerRegretExAnte({
      valeurAttendueAgir: evAgir,
      actionChoisie: "attendre",
    });
    expect(regret.numerateurMicroUsdcBps).toBe(3_000_000_000n);
  });

  it("I — regret >= 0", () => {
    for (const action of ["agir", "attendre"] as const) {
      for (const numerateur of [-500n * 10_000n, 0n, 500n * 10_000n]) {
        const r = calculerRegretExAnte({
          valeurAttendueAgir: creerValeurAttendueExacte(numerateur),
          actionChoisie: action,
        });
        expect(r.numerateurMicroUsdcBps >= 0n).toBe(true);
      }
    }
  });

  it("J — attendre favorable / défavorable", () => {
    expect(
      determinerMeilleureActionExAnte(creerValeurAttendueExacte(-1n * 10_000n)),
    ).toBe("attendre");
    expect(
      calculerRegretExAnte({
        valeurAttendueAgir: creerValeurAttendueExacte(-1n * 10_000n),
        actionChoisie: "attendre",
      }).numerateurMicroUsdcBps,
    ).toBe(0n);
    expect(
      calculerRegretExAnte({
        valeurAttendueAgir: creerValeurAttendueExacte(-1n * 10_000n),
        actionChoisie: "agir",
      }).numerateurMicroUsdcBps,
    ).toBe(10_000n);
  });

  it("K — cognition zéro → ratio absent", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(50),
    });
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
      parametres: { ...parametres, loyerInfrastructureMicroUsdc: 0n, tauxRedevanceProprietairePointsDeBase: 0n },
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: usdcVersMicroUsdc(10),
        perteActivite: 0n,
        depenseCompute: 0n,
        depenseDonnees: 0n,
        fraisExecution: 0n,
      },
    });
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements: avecSequence([
        { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
        ...naissance.evenements,
        ...cycle.evenements,
      ]),
    });
    expect(m.cognition.coutCognitifTotalMicroUsdc).toBe(0n);
    expect(m.cognition.ratioResultatOperationnelSurCoutCognitif).toBeNull();
  });

  it("L — avec/sans inférence séparés", () => {
    const evenements: EvenementPourFitness[] = [
      { identifiant: "c", type: "AGENT_CREE", identifiantAgent: "a1", numeroCycle: 0, sequence: 1, chargeUtile: {} },
      {
        identifiant: "o1",
        type: "OBSERVATION_AGENT_RECUE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: {
          donnees: {
            probabiliteSuccesBps: 6000,
            gainSiSuccesMicroUsdc: "800000",
            perteSiEchecMicroUsdc: "400000",
            fraisActionMicroUsdc: "20000",
          },
        },
      },
      {
        identifiant: "ch1",
        type: "CHOIX_COGNITIF_EFFECTUE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 3,
        chargeUtile: { utiliserInference: true },
      },
      {
        identifiant: "d1",
        type: "DECISION_AGENT_VALIDEE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 4,
        chargeUtile: { action: "agir", coutCognitifMicroUsdc: "1000" },
      },
      {
        identifiant: "r1",
        type: "RESULTAT_ACTION_OBSERVE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 5,
        chargeUtile: {
          issue: "succes",
          revenuActiviteMicroUsdc: "800000",
          perteActiviteMicroUsdc: "0",
          fraisExecutionMicroUsdc: "20000",
        },
      },
      {
        identifiant: "o2",
        type: "OBSERVATION_AGENT_RECUE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 6,
        chargeUtile: {
          donnees: {
            probabiliteSuccesBps: 1000,
            gainSiSuccesMicroUsdc: "100",
            perteSiEchecMicroUsdc: "900000",
            fraisActionMicroUsdc: "0",
          },
        },
      },
      {
        identifiant: "ch2",
        type: "CHOIX_COGNITIF_EFFECTUE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 7,
        chargeUtile: { utiliserInference: false },
      },
      {
        identifiant: "d2",
        type: "DECISION_AGENT_VALIDEE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 8,
        chargeUtile: { action: "attendre", coutCognitifMicroUsdc: "0" },
      },
      {
        identifiant: "r2",
        type: "RESULTAT_ACTION_OBSERVE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 9,
        chargeUtile: {
          issue: "aucune",
          revenuActiviteMicroUsdc: "0",
          perteActiviteMicroUsdc: "0",
          fraisExecutionMicroUsdc: "0",
        },
      },
    ];
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 1, cycleFin: 2 },
    });
    expect(m.decision.nombreDecisionsAvecInference).toBe(1);
    expect(m.decision.nombreDecisionsSansInference).toBe(1);
    expect(m.decision.tauxOptimalesAvecInferenceBps).toBe(10_000);
    expect(m.decision.tauxOptimalesSansInferenceBps).toBe(10_000);
    expect(m.decision.coutCognitifAvecInferenceMicroUsdc).toBe(1000n);
    expect(m.decision.coutCognitifSansInferenceMicroUsdc).toBe(0n);
  });

  it("M — drawdown exact", () => {
    const evenements: EvenementPourFitness[] = [
      { identifiant: "c", type: "AGENT_CREE", identifiantAgent: "a1", numeroCycle: 0, sequence: 1, chargeUtile: {} },
      {
        identifiant: "cap",
        type: "CAPITAL_INITIAL_ATTRIBUE",
        identifiantAgent: "a1",
        numeroCycle: 0,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "1000000" },
      },
      {
        identifiant: "rev",
        type: "REVENU_ACTIVITE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 3,
        chargeUtile: { montantMicroUsdc: "500000" },
      },
      {
        identifiant: "ct1",
        type: "CYCLE_TERMINE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 4,
        chargeUtile: { runway: 10, etatSurvie: "sain" },
      },
      {
        identifiant: "perte",
        type: "PERTE_ACTIVITE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 5,
        chargeUtile: { montantMicroUsdc: "800000" },
      },
      {
        identifiant: "ct2",
        type: "CYCLE_TERMINE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 6,
        chargeUtile: { runway: 5, etatSurvie: "contraint" },
      },
    ];
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 0, cycleFin: 2 },
    });
    // pic = 1.5e6, bas = 700000, dd = 800000
    expect(m.risque.picVenMicroUsdc).toBe(1_500_000n);
    expect(m.risque.drawdownMaxMicroUsdc).toBe(800_000n);
    expect(m.risque.cycleDuDrawdownMax).toBe(2);
  });

  it("N — survie / résilience", () => {
    const evenements: EvenementPourFitness[] = [
      { identifiant: "c", type: "AGENT_CREE", identifiantAgent: "a1", numeroCycle: 0, sequence: 1, chargeUtile: {} },
      {
        identifiant: "m1",
        type: "ETAT_SURVIE_MODIFIE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { depuis: "sain", vers: "critique" },
      },
      {
        identifiant: "ct1",
        type: "CYCLE_TERMINE",
        identifiantAgent: "a1",
        numeroCycle: 1,
        sequence: 3,
        chargeUtile: { runway: 1, etatSurvie: "critique" },
      },
      {
        identifiant: "m2",
        type: "ETAT_SURVIE_MODIFIE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 4,
        chargeUtile: { depuis: "critique", vers: "sain" },
      },
      {
        identifiant: "ct2",
        type: "CYCLE_TERMINE",
        identifiantAgent: "a1",
        numeroCycle: 2,
        sequence: 5,
        chargeUtile: { runway: 8, etatSurvie: "sain" },
      },
    ];
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 0, cycleFin: 2 },
    });
    expect(m.survie.cycleNaissance).toBe(0);
    expect(m.survie.cyclesVecus).toBe(2);
    expect(m.resilience.nombreCyclesCritique).toBe(1);
    expect(m.resilience.nombreCyclesSain).toBe(1);
    expect(m.resilience.nombrePassagesCritiqueVersSain).toBe(1);
    expect(m.risque.runwayMinimumObserve).toBe(1);
  });

  it("O — contribution propriétaire", () => {
    // repris de C
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(100),
    });
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: usdcVersMicroUsdc(30),
        perteActivite: 0n,
        depenseCompute: usdcVersMicroUsdc(5),
        depenseDonnees: usdcVersMicroUsdc(3),
        fraisExecution: usdcVersMicroUsdc(2),
      },
    });
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements: avecSequence([
        { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
        ...naissance.evenements,
        ...cycle.evenements,
      ]),
      fenetre: { cycleDebut: 1, cycleFin: 1 },
    });
    expect(m.contribution.loyersPayesMicroUsdc + m.contribution.redevancesPayeesMicroUsdc).toBe(
      m.contribution.contributionProprietaireTotaleMicroUsdc,
    );
  });

  it("P — transfert interne ne crée aucune valeur population", () => {
    const n1 = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(50),
    });
    const n2 = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a2",
      montant: usdcVersMicroUsdc(50),
    });
    const transfert = preparerTransfertInterne({
      identifiantExperience: "exp",
      identifiantAgentSource: "a1",
      identifiantAgentDestinataire: "a2",
      montant: usdcVersMicroUsdc(10),
      identifiantTransfert: "t1",
      numeroCycle: 1,
    });
    const base = [
      { identifiant: "c1", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
      ...n1.evenements,
      { identifiant: "c2", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a2", numeroCycle: 0, chargeUtile: {} },
      ...n2.evenements,
      ...transfert.evenements,
    ];
    const evts = avecSequence(base);
    const m1 = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements: evts,
      fenetre: { cycleDebut: 0, cycleFin: 1 },
    });
    const m2 = calculerMesuresFitnessAgent({
      identifiantAgent: "a2",
      evenements: evts,
      fenetre: { cycleDebut: 0, cycleFin: 1 },
    });
    expect(
      m1.economie.venFinMicroUsdc + m2.economie.venFinMicroUsdc,
    ).toBe(usdcVersMicroUsdc(100));
    expect(m1.economie.transfertsInternesEnvoyesMicroUsdc).toBe(usdcVersMicroUsdc(10));
    expect(m2.economie.transfertsInternesRecusMicroUsdc).toBe(usdcVersMicroUsdc(10));
  });

  it("Q — reconstruction après redémarrage identique", async () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-fit-"));
    repertoires.push(repertoire);
    const chemin = join(repertoire, "e.sqlite");
    const conf = parserConfigurationExperience({
      identifiantExperience: "exp-fit-q",
      versionProtocole: "0.1.0",
      mode: "simulation",
      graineSimulation: 7,
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "10000000",
      parametresEconomiques: {
        version: "t",
        loyerInfrastructureMicroUsdc: "100000",
        periodeLoyerEnCycles: 5,
        tauxRedevanceProprietairePointsDeBase: "1000",
        coutOperationnelMinimalParCycleMicroUsdc: "50000",
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 3,
      },
    } satisfies ConfigurationExperienceJson);
    const c1 = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite: chemin,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await c1.avancerUnCycle();
    await c1.avancerUnCycle();
    const avant = c1.projeterFitnessPopulation();
    c1.fermer();
    const c2 = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite: chemin,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(c2.projeterFitnessPopulation()).toEqual(avant);
    c2.fermer();
  });

  it("R — fenêtre de cycles correcte", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      montant: usdcVersMicroUsdc(100),
    });
    let etat = naissance.etat;
    let tresorerie = creerTresorerieProprietaire();
    const lots = [];
    for (let c = 1; c <= 3; c += 1) {
      const r = executerCycleEconomique({
        identifiantExperience: "exp",
        identifiantAgent: "a1",
        numeroCycle: c,
        parametres: { ...parametres, loyerInfrastructureMicroUsdc: 0n, tauxRedevanceProprietairePointsDeBase: 0n },
        etat,
        tresorerie,
        activite: {
          revenuActivite: usdcVersMicroUsdc(10),
          perteActivite: 0n,
          depenseCompute: 0n,
          depenseDonnees: 0n,
          fraisExecution: 0n,
        },
      });
      etat = r.etat;
      tresorerie = r.tresorerie;
      lots.push(...r.evenements);
    }
    const evenements = avecSequence([
      { identifiant: "c", type: "AGENT_CREE", identifiantExperience: "exp", identifiantAgent: "a1", numeroCycle: 0, chargeUtile: {} },
      ...naissance.evenements,
      ...lots,
    ]);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a1",
      evenements,
      fenetre: { cycleDebut: 2, cycleFin: 3 },
    });
    expect(m.economie.revenusActiviteMicroUsdc).toBe(usdcVersMicroUsdc(20));
    expect(m.fenetre).toEqual({ cycleDebut: 2, cycleFin: 3 });
  });

  it("S — population min/médiane/max déterministes", () => {
    expect(medianeEntiere([1n, 3n, 2n])).toBe(2n);
    expect(medianeEntiere([1n, 2n, 3n, 4n])).toBe(2n); // (2+3)/2
    const agregats = agregaterFitnessPopulation([
      calculerMesuresFitnessAgent({
        identifiantAgent: "a",
        evenements: [
          { identifiant: "1", type: "AGENT_CREE", identifiantAgent: "a", numeroCycle: 0, sequence: 1, chargeUtile: {} },
          {
            identifiant: "2",
            type: "CAPITAL_INITIAL_ATTRIBUE",
            identifiantAgent: "a",
            numeroCycle: 0,
            sequence: 2,
            chargeUtile: { montantMicroUsdc: "100" },
          },
        ],
      }),
      calculerMesuresFitnessAgent({
        identifiantAgent: "b",
        evenements: [
          { identifiant: "1", type: "AGENT_CREE", identifiantAgent: "b", numeroCycle: 0, sequence: 1, chargeUtile: {} },
          {
            identifiant: "2",
            type: "CAPITAL_INITIAL_ATTRIBUE",
            identifiantAgent: "b",
            numeroCycle: 0,
            sequence: 2,
            chargeUtile: { montantMicroUsdc: "300" },
          },
        ],
      }),
      calculerMesuresFitnessAgent({
        identifiantAgent: "c",
        evenements: [
          { identifiant: "1", type: "AGENT_CREE", identifiantAgent: "c", numeroCycle: 0, sequence: 1, chargeUtile: {} },
          {
            identifiant: "2",
            type: "CAPITAL_INITIAL_ATTRIBUE",
            identifiantAgent: "c",
            numeroCycle: 0,
            sequence: 2,
            chargeUtile: { montantMicroUsdc: "200" },
          },
        ],
      }),
    ]);
    expect(agregats.venFin.min).toBe("100");
    expect(agregats.venFin.mediane).toBe("200");
    expect(agregats.venFin.max).toBe("300");
  });

  it("T — agent mort reste mesurable", () => {
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "mort",
      evenements: [
        { identifiant: "1", type: "AGENT_CREE", identifiantAgent: "mort", numeroCycle: 0, sequence: 1, chargeUtile: {} },
        {
          identifiant: "2",
          type: "CAPITAL_INITIAL_ATTRIBUE",
          identifiantAgent: "mort",
          numeroCycle: 0,
          sequence: 2,
          chargeUtile: { montantMicroUsdc: "1000" },
        },
        {
          identifiant: "3",
          type: "AGENT_MORT",
          identifiantAgent: "mort",
          numeroCycle: 2,
          sequence: 3,
          chargeUtile: {},
        },
        {
          identifiant: "4",
          type: "CYCLE_TERMINE",
          identifiantAgent: "mort",
          numeroCycle: 2,
          sequence: 4,
          chargeUtile: { runway: 0, etatSurvie: "mort" },
        },
      ],
    });
    expect(m.survie.etatCourant).toBe("mort");
    expect(m.survie.cycleMort).toBe(2);
    expect(m.economie.venFinMicroUsdc).toBe(1000n);
  });

  it("U — aucun score scalaire / ranking", () => {
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: "a",
      evenements: [
        { identifiant: "1", type: "AGENT_CREE", identifiantAgent: "a", numeroCycle: 0, sequence: 1, chargeUtile: {} },
      ],
    });
    expect(m.versionMesuresFitness).toBe(VERSION_MESURES_FITNESS);
    expect(m.avertissement).toBe("FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE");
    expect("score" in m).toBe(false);
    expect("fitness" in m).toBe(false);
    expect("rang" in m).toBe(false);
    assertPasDeScoreScalaire(m);
  });

  it("V — API fitness correspond aux projections", async () => {
    const registre = creerRegistreEvenementsMemoire();
    const conf = parserConfigurationExperience({
      identifiantExperience: "exp-fit-api",
      versionProtocole: "0.1.0",
      mode: "simulation",
      graineSimulation: 3,
      taillePopulationInitiale: 1,
      capitalInitialParAgentMicroUsdc: "5000000",
      parametresEconomiques: {
        version: "t",
        loyerInfrastructureMicroUsdc: "0",
        periodeLoyerEnCycles: 5,
        tauxRedevanceProprietairePointsDeBase: "0",
        coutOperationnelMinimalParCycleMicroUsdc: "10000",
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 3,
      },
    });
    const controleur = ControleurExperience.ouvrir({
      configuration: conf,
      registre,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await controleur.avancerUnCycle();
    const agentId = controleur.obtenirAgents()[0]!.identite.identifiant;
    const projection = controleur.projeterFitnessAgent(agentId)!;
    const population = controleur.projeterFitnessPopulation();

    const serveur = await demarrerServeurApi({ controleur, port: 0 });
    try {
      const base = `http://${serveur.hote}:${String(serveur.port)}`;
      const rPop = await fetch(`${base}/api/fitness`);
      expect(rPop.status).toBe(200);
      const corpsPop = (await rPop.json()) as typeof population;
      expect(corpsPop).toEqual(JSON.parse(JSON.stringify(population, (_k, v) =>
        typeof v === "bigint" ? v.toString(10) : v,
      )));

      const rAgent = await fetch(
        `${base}/api/agents/${encodeURIComponent(agentId)}/fitness`,
      );
      expect(rAgent.status).toBe(200);
      const corpsAgent = await rAgent.json();
      expect(corpsAgent).toEqual(
        JSON.parse(
          JSON.stringify(projection, (_k, v) =>
            typeof v === "bigint" ? v.toString(10) : v,
          ),
        ),
      );
      expect(corpsAgent.avertissement).toBe(
        "FITNESS_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE",
      );
      expect(corpsAgent.score).toBeUndefined();
    } finally {
      await serveur.fermer();
    }
  });
});

describe("EV rationnelle exacte — frontières de précision", () => {
  it("A — EV +0,5 µUSDC → agir malgré quotient entier 0", () => {
    // numerateur = 5000 → EV exacte = +0,5 ; 5000n/10000n = 0n si tronqué trop tôt
    const ev = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 1n,
      perteSiEchecMicroUsdc: 0n,
      fraisActionMicroUsdc: 0n,
    });
    expect(ev.numerateurMicroUsdcBps).toBe(5000n);
    expect(arrondirValeurAttendueVersMicroUsdc(ev)).toBe(0n);
    expect(determinerMeilleureActionExAnte(ev)).toBe("agir");
  });

  it("B — EV -0,5 µUSDC → attendre", () => {
    const ev = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 0n,
      perteSiEchecMicroUsdc: 1n,
      fraisActionMicroUsdc: 0n,
    });
    expect(ev.numerateurMicroUsdcBps).toBe(-5000n);
    expect(arrondirValeurAttendueVersMicroUsdc(ev)).toBe(0n);
    expect(determinerMeilleureActionExAnte(ev)).toBe("attendre");
  });

  it("C — EV exacte 0 → convention attendre", () => {
    const ev = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 100n,
      perteSiEchecMicroUsdc: 100n,
      fraisActionMicroUsdc: 0n,
    });
    expect(ev.numerateurMicroUsdcBps).toBe(0n);
    expect(determinerMeilleureActionExAnte(ev)).toBe("attendre");
  });

  it("D — frais inclus avant comparaison (brut + / net −)", () => {
    // Sans frais : numerateur = 5000 (+0,5) → agir serait favorable
    // Avec frais 1 : numerateur = 5000 - 10000 = -5000 → attendre
    const brut = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 1n,
      perteSiEchecMicroUsdc: 0n,
      fraisActionMicroUsdc: 0n,
    });
    expect(brut.numerateurMicroUsdcBps).toBe(5000n);
    expect(determinerMeilleureActionExAnte(brut)).toBe("agir");

    const net = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 1n,
      perteSiEchecMicroUsdc: 0n,
      fraisActionMicroUsdc: 1n,
    });
    expect(net.numerateurMicroUsdcBps).toBe(-5000n);
    expect(determinerMeilleureActionExAnte(net)).toBe("attendre");
  });

  it("E — regret fractionnaire conservé exactement", () => {
    const evAgir = calculerValeurAttendueAgir({
      probabiliteSuccesBps: 5000,
      gainSiSuccesMicroUsdc: 1n,
      perteSiEchecMicroUsdc: 0n,
      fraisActionMicroUsdc: 0n,
    });
    const regret = calculerRegretExAnte({
      valeurAttendueAgir: evAgir,
      actionChoisie: "attendre",
    });
    expect(regret.numerateurMicroUsdcBps).toBe(5000n);
    expect(regret.denominateurBps).toBe(10_000n);
    expect(arrondirValeurAttendueVersMicroUsdc(regret)).toBe(0n);
  });

  it("F — somme de regrets fractionnaires sans perte de précision", () => {
    const r1 = creerValeurAttendueExacte(5000n);
    const r2 = creerValeurAttendueExacte(5000n);
    const r3 = creerValeurAttendueExacte(1n);
    const somme = additionnerValeursAttenduesExactes(r1, r2, r3);
    expect(somme.numerateurMicroUsdcBps).toBe(10_001n);
    expect(somme.denominateurBps).toBe(10_000n);
    // Affichage tronqué ≠ canonique
    expect(arrondirValeurAttendueVersMicroUsdc(somme)).toBe(1n);
  });
});
