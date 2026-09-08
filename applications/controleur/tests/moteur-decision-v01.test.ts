import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  creerEnvironnementOpportunitesSimulees,
  parserConfigurationEnvironnementOpportunites,
} from "@esp/environnement";
import {
  executerMoteurDecision,
  parserPropositionDepuisTexte,
  validerPropositionDecision,
  type ExecuteurInferenceDecision,
} from "@esp/moteur-agent";
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

function repertoireTemp(): string {
  const repertoire = mkdtempSync(join(tmpdir(), "esp-decision-"));
  repertoires.push(repertoire);
  return repertoire;
}

const ENV_BASE = {
  identifiant: "environnement-opportunites-simulees" as const,
  version: "0.1.0",
  probabiliteSuccesBaseBps: 6000,
  amplitudeProbabiliteBps: 0,
  gainSiSuccesMicroUsdc: "800000",
  perteSiEchecMicroUsdc: "400000",
  fraisActionMicroUsdc: "20000",
  fraisAttendreMicroUsdc: "0",
};

const POLITIQUE_BASE = {
  identifiant: "politique-budget-cognitif-agent" as const,
  version: "0.1.0",
  seuilEnjeuPourInferenceMicroUsdc: "100000",
  partMaxVenParCycleBps: 50,
  plafondCognitifMicroUsdc: "10000",
  modeleLogique: "modele_standard",
  comportementSansInference: "agir_si_favorable" as const,
  refuserSiCritiqueOuDormant: true,
};

const XWAY_BASE = {
  active: true,
  plafondComputeParCycleMicroUsdc: "50000",
  modeles: [
    {
      identifiant: "modele_economique" as const,
      libelle: "éco",
      coutParMillionJetonsEntreeMicroUsdc: "500000",
      coutParMillionJetonsSortieMicroUsdc: "1500000",
      nombreMaxJetonsSortie: 256,
    },
    {
      identifiant: "modele_standard" as const,
      libelle: "std",
      coutParMillionJetonsEntreeMicroUsdc: "2000000",
      coutParMillionJetonsSortieMicroUsdc: "6000000",
      nombreMaxJetonsSortie: 512,
    },
    {
      identifiant: "modele_premium" as const,
      libelle: "prem",
      coutParMillionJetonsEntreeMicroUsdc: "20000000",
      coutParMillionJetonsSortieMicroUsdc: "60000000",
      nombreMaxJetonsSortie: 1024,
    },
  ],
  politiqueCognitive: {
    identifiant: "politique-budget-cognitif-agent" as const,
    version: "0.1.0",
  },
  fournisseur: {
    identifiant: "fournisseur-inference-simule" as const,
    version: "0.1.0",
  },
};

/**
 * Helper — configuration d'expérience en mode décision simulée.
 */
function construireConfigDecision(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ReturnType<typeof parserConfigurationExperience> {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-test-decision-v01",
    versionProtocole: "0.1.0",
    mode: "decision_simulee",
    graineSimulation: 424242,
    taillePopulationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-decision-test",
      loyerInfrastructureMicroUsdc: "50000",
      periodeLoyerEnCycles: 10,
      tauxRedevanceProprietairePointsDeBase: "500",
      coutOperationnelMinimalParCycleMicroUsdc: "30000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    environnementDecision: ENV_BASE,
    politiqueBudgetCognitif: POLITIQUE_BASE,
    xway: XWAY_BASE,
  };
  return parserConfigurationExperience({
    ...base,
    ...surcharges,
    parametresEconomiques: {
      ...base.parametresEconomiques,
      ...(surcharges.parametresEconomiques ?? {}),
    },
    environnementDecision: {
      ...ENV_BASE,
      ...(surcharges.environnementDecision ?? {}),
    },
    politiqueBudgetCognitif: {
      ...POLITIQUE_BASE,
      ...(surcharges.politiqueBudgetCognitif ?? {}),
    },
    xway:
      surcharges.xway === undefined
        ? XWAY_BASE
        : {
            ...XWAY_BASE,
            ...surcharges.xway,
            modeles: surcharges.xway.modeles ?? XWAY_BASE.modeles,
            politiqueCognitive:
              surcharges.xway.politiqueCognitive ??
              XWAY_BASE.politiqueCognitive,
            fournisseur: surcharges.xway.fournisseur ?? XWAY_BASE.fournisseur,
          },
  });
}

function ouvrirMemoire(
  surcharges: Partial<ConfigurationExperienceJson> = {},
) {
  return ControleurExperience.ouvrir({
    configuration: construireConfigDecision(surcharges),
    registre: creerRegistreEvenementsMemoire(),
    cheminKeystoreIdentites: join(repertoireTemp(), "identites"),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

function evenementsExperience(controleur: ControleurExperience) {
  return controleur.registre.listerParExperience(
    controleur.configuration.identifiantExperience,
  );
}

describe("Moteur de décision agent v0.1", () => {
  it("A — observation : aucune donnée future (tirage) exposée", async () => {
    const env = creerEnvironnementOpportunitesSimulees(
      parserConfigurationEnvironnementOpportunites(ENV_BASE),
      424242,
    );
    const observation = env.produireObservation({
      identifiantAgent: "agent-a",
      numeroCycle: 1,
    });
    const cles = Object.keys(observation);
    expect(cles).not.toContain("tirageBps");
    expect(cles).not.toContain("resultat");
    expect(cles).not.toContain("issue");
    expect(observation).not.toHaveProperty("tirageBps");
    expect(cles.sort()).toEqual(
      [
        "actionsAutorisees",
        "description",
        "fraisActionMicroUsdc",
        "gainSiSuccesMicroUsdc",
        "identifiantAgent",
        "identifiantObservation",
        "numeroCycle",
        "perteSiEchecMicroUsdc",
        "probabiliteSuccesBps",
        "typeObservation",
      ].sort(),
    );
    expect(observation.description.toLowerCase()).not.toMatch(/tirage/);

    const controleur = ouvrirMemoire({ taillePopulationInitiale: 1 });
    await controleur.avancerUnCycle();
    const obsEvt = evenementsExperience(controleur).find(
      (e) => e.type === "OBSERVATION_AGENT_RECUE",
    );
    expect(obsEvt).toBeDefined();
    const donnees = obsEvt!.chargeUtile.donnees as Record<string, unknown>;
    expect(donnees).not.toHaveProperty("tirageBps");
    expect(Object.keys(donnees)).not.toContain("tirageBps");
    expect(JSON.stringify(donnees)).not.toMatch(/tirage/i);
  });

  it("B — agir succès : revenu exact via EnvironnementOpportunitesSimulees", () => {
    const conf = parserConfigurationEnvironnementOpportunites(ENV_BASE);
    const env = creerEnvironnementOpportunitesSimulees(conf, 99);
    const base = env.produireObservation({
      identifiantAgent: "agent-succes",
      numeroCycle: 3,
    });
    const observation = { ...base, probabiliteSuccesBps: 10_000 };
    const resultat = env.executerAction({
      observation,
      action: "agir",
      identifiantDecision: "dec-succes",
    });
    expect(resultat.issue).toBe("succes");
    expect(resultat.activite.revenuActivite).toBe(conf.gainSiSuccesMicroUsdc);
    expect(resultat.activite.perteActivite).toBe(0n);
    expect(resultat.activite.fraisExecution).toBe(conf.fraisActionMicroUsdc);
  });

  it("C — agir échec : perte exacte via EnvironnementOpportunitesSimulees", () => {
    const conf = parserConfigurationEnvironnementOpportunites(ENV_BASE);
    const env = creerEnvironnementOpportunitesSimulees(conf, 99);
    const base = env.produireObservation({
      identifiantAgent: "agent-echec",
      numeroCycle: 3,
    });
    const observation = { ...base, probabiliteSuccesBps: 0 };
    const resultat = env.executerAction({
      observation,
      action: "agir",
      identifiantDecision: "dec-echec",
    });
    expect(resultat.issue).toBe("echec");
    expect(resultat.activite.revenuActivite).toBe(0n);
    expect(resultat.activite.perteActivite).toBe(conf.perteSiEchecMicroUsdc);
    expect(resultat.activite.fraisExecution).toBe(conf.fraisActionMicroUsdc);
  });

  it("D — attendre : zéro revenu / perte / frais caché", () => {
    const conf = parserConfigurationEnvironnementOpportunites(ENV_BASE);
    const env = creerEnvironnementOpportunitesSimulees(conf, 7);
    const observation = env.produireObservation({
      identifiantAgent: "agent-att",
      numeroCycle: 1,
    });
    const resultat = env.executerAction({
      observation,
      action: "attendre",
      identifiantDecision: "dec-att",
    });
    expect(resultat.issue).toBe("aucune");
    expect(resultat.tirageBps).toBeNull();
    expect(resultat.activite.revenuActivite).toBe(0n);
    expect(resultat.activite.perteActivite).toBe(0n);
    expect(resultat.activite.fraisExecution).toBe(0n);
    expect(resultat.activite.depenseCompute).toBe(0n);
  });

  it("E — déterminisme environnement : même graine + action → même résultat", () => {
    const conf = parserConfigurationEnvironnementOpportunites(ENV_BASE);
    const executer = () => {
      const env = creerEnvironnementOpportunitesSimulees(conf, 12345);
      const observation = env.produireObservation({
        identifiantAgent: "agent-det",
        numeroCycle: 4,
      });
      return env.executerAction({
        observation,
        action: "agir",
        identifiantDecision: "dec-det",
      });
    };
    expect(executer()).toEqual(executer());
  });

  it("F — sans inférence : aucun DEPENSE_COMPUTE (seuilEnjeu très haut)", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "999999999999",
        comportementSansInference: "attendre",
      },
    });
    for (let i = 0; i < 5; i += 1) {
      await controleur.avancerUnCycle();
    }
    const evts = evenementsExperience(controleur);
    expect(evts.some((e) => e.type === "OBSERVATION_AGENT_RECUE")).toBe(true);
    expect(evts.some((e) => e.type === "DEPENSE_COMPUTE")).toBe(false);
    expect(evts.some((e) => e.type === "INFERENCE_EXECUTEE")).toBe(false);
    const decisions = controleur.projeterDecisionsAgent(
      controleur.obtenirAgents()[0]!.identite.identifiant,
    );
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((d) => d.choixCognitif?.utiliserInference !== true)).toBe(
      true,
    );
  });

  it("G — avec Xway simulé : compute + action", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "1",
        plafondCognitifMicroUsdc: "50000",
        comportementSansInference: "attendre",
      },
    });
    await controleur.avancerUnCycle();
    const evts = evenementsExperience(controleur);
    const executees = evts.filter((e) => e.type === "INFERENCE_EXECUTEE");
    const depenses = evts.filter((e) => e.type === "DEPENSE_COMPUTE");
    expect(executees.length).toBeGreaterThan(0);
    expect(depenses.length).toBeGreaterThan(0);
    expect(evts.some((e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE")).toBe(
      true,
    );
    let coutXway = 0n;
    for (const e of executees) {
      coutXway += BigInt(String(e.chargeUtile.coutFinalMicroUsdc));
    }
    let coutCompute = 0n;
    for (const e of depenses) {
      coutCompute += BigInt(String(e.chargeUtile.montantMicroUsdc));
    }
    expect(coutCompute).toBe(coutXway);
  });

  it("H — Xway refusé (plafond 0 côté capacité) → fallback attendre", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "1",
        plafondCognitifMicroUsdc: "50000",
        comportementSansInference: "agir_si_favorable",
      },
      xway: {
        ...XWAY_BASE,
        plafondComputeParCycleMicroUsdc: "1",
      },
    });
    await controleur.avancerUnCycle();
    const evts = evenementsExperience(controleur);
    expect(evts.some((e) => e.type === "DEMANDE_INFERENCE_REFUSEE")).toBe(true);
    const decisions = controleur.projeterDecisionsAgent(
      controleur.obtenirAgents()[0]!.identite.identifiant,
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.action).toBe("attendre");
    expect(decisions[0]!.decision?.sourceDecision).toMatch(/repli|invalide/);
  });

  it("I — sortie structurée invalide : compute conservé + attendre", async () => {
    const env = creerEnvironnementOpportunitesSimulees(
      parserConfigurationEnvironnementOpportunites(ENV_BASE),
      1,
    );
    const observation = env.produireObservation({
      identifiantAgent: "agent-inv",
      numeroCycle: 1,
    });
    const executeur: ExecuteurInferenceDecision = () => ({
      statut: "executee",
      texte: "ceci n'est pas une proposition JSON valide",
      coutFinalMicroUsdc: 1234n,
      identifiantDemande: "dem-inv",
    });
    const resultat = await executerMoteurDecision({
      observation,
      etatEconomique: {
        identifiantAgent: "agent-inv",
        capitalLiquide: 10_000_000n,
        obligationsDues: 0n,
        highWaterMarkProprietaire: 10_000_000n,
        totalRevenusActivite: 0n,
        totalPertesActivite: 0n,
        totalDepensesCompute: 0n,
        totalDepensesDonnees: 0n,
        totalFraisExecution: 0n,
        totalLoyersPayes: 0n,
        totalRedevancesProprietairePayees: 0n,
        etatSurvie: "sain",
        cyclesDormanceConsecutifs: 0,
        dernierNumeroCycle: 0,
      },
      runway: 50,
      configurationPolitique: {
        identifiant: "politique-budget-cognitif-agent",
        version: "0.1.0",
        seuilEnjeuPourInferenceMicroUsdc: 1n,
        plafondCognitifMicroUsdc: 50_000n,
        partMaxVenParCycleBps: 100,
        modeleLogique: "modele_standard",
        comportementSansInference: "attendre",
        refuserSiCritiqueOuDormant: true,
      },
      plafondXwayMicroUsdc: 50_000n,
      identifiantExperience: "exp-inv",
      executerInference: executeur,
    });
    expect(resultat.validationOk).toBe(false);
    expect(resultat.decision.action).toBe("attendre");
    expect(resultat.coutCognitifMicroUsdc).toBe(1234n);
    expect(resultat.motifRefus).toBe("sortie_structuree_invalide");
    expect(parserPropositionDepuisTexte("pas de json")).toBeNull();
  });

  it("J — whitelist : action invalide rejetée", () => {
    const env = creerEnvironnementOpportunitesSimulees(
      parserConfigurationEnvironnementOpportunites(ENV_BASE),
      1,
    );
    const observation = env.produireObservation({
      identifiantAgent: "agent-wl",
      numeroCycle: 2,
    });
    const validation = validerPropositionDecision({
      proposition: {
        action: "acheter",
        confianceBps: 5000,
        resume: "Action hors whitelist",
      },
      observation,
      identifiantAgent: observation.identifiantAgent,
      numeroCycle: observation.numeroCycle,
      identifiantDecision: "dec-wl",
      sourceDecision: "inference_xway",
      coutCognitifMicroUsdc: 100n,
    });
    expect(validation.validee).toBe(false);
    if (!validation.validee) {
      expect(validation.motifRefus).toBe("action_hors_whitelist");
    }
  });

  it("K — causalité : IDs lient observation → décision → demande → action → résultat → éco", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "1",
      },
    });
    await controleur.avancerUnCycle();
    const agentId = controleur.obtenirAgents()[0]!.identite.identifiant;
    const evts = evenementsExperience(controleur).filter(
      (e) => e.identifiantAgent === agentId && e.numeroCycle === 1,
    );
    const obs = evts.find((e) => e.type === "OBSERVATION_AGENT_RECUE")!;
    const dec = evts.find((e) => e.type === "DECISION_AGENT_VALIDEE")!;
    const action = evts.find((e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE")!;
    const resultat = evts.find((e) => e.type === "RESULTAT_ACTION_OBSERVE")!;
    const idObs = String(obs.chargeUtile.identifiantObservation);
    const idDec = String(dec.chargeUtile.identifiantDecision);
    expect(dec.chargeUtile.identifiantObservation).toBe(idObs);
    expect(action.chargeUtile.identifiantObservation).toBe(idObs);
    expect(action.chargeUtile.identifiantDecision).toBe(idDec);
    expect(resultat.chargeUtile.identifiantDecision).toBe(idDec);
    expect(resultat.chargeUtile.identifiantAction).toBe(
      action.chargeUtile.identifiantAction,
    );
    const demande = evts.find((e) => e.type === "DEMANDE_INFERENCE_RECUE");
    if (demande !== undefined) {
      expect(String(demande.chargeUtile.identifiantDemande)).toContain(agentId);
    }
    const eco = evts.find((e) => e.type === "CYCLE_TERMINE" || e.type === "REVENU_ACTIVITE" || e.type === "PERTE_ACTIVITE" || e.type === "DEPENSE_COMPUTE");
    expect(eco).toBeDefined();
  });

  it("L — reprise SQLite : pas de double action", async () => {
    const repertoire = repertoireTemp();
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const keystore = join(repertoire, "identites");
    const conf = construireConfigDecision({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "999999999999",
        comportementSansInference: "attendre",
      },
    });

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: keystore,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 5; i += 1) {
      await premier.avancerUnCycle();
    }
    const actionsAvant = evenementsExperience(premier).filter(
      (e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE",
    ).length;
    const empreinte = premier.capturerEmpreinteEconomique();
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: keystore,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(second.capturerEmpreinteEconomique()).toEqual(empreinte);
    const actionsApresOuverture = evenementsExperience(second).filter(
      (e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE",
    ).length;
    expect(actionsApresOuverture).toBe(actionsAvant);

    await second.avancerUnCycle();
    const actions = evenementsExperience(second).filter(
      (e) => e.type === "ACTION_ENVIRONNEMENT_EXECUTEE",
    );
    const parCle = new Map<string, number>();
    for (const a of actions) {
      const cle = `${a.identifiantAgent}|${String(a.numeroCycle)}`;
      parCle.set(cle, (parCle.get(cle) ?? 0) + 1);
    }
    for (const compte of parCle.values()) {
      expect(compte).toBe(1);
    }
    second.fermer();
  });

  it("M — multi-agents : aucun mélange observations / décisions / coûts", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 3,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "999999999999",
        comportementSansInference: "attendre",
      },
    });
    await controleur.avancerUnCycle();
    const agents = controleur.obtenirAgents().map((a) => a.identite.identifiant);
    expect(agents).toHaveLength(3);
    for (const id of agents) {
      const decisions = controleur.projeterDecisionsAgent(id);
      expect(decisions.every((d) => d.identifiantAgent === id)).toBe(true);
      expect(
        decisions.every((d) => d.identifiantObservation.startsWith(id)),
      ).toBe(true);
    }
    const obs = evenementsExperience(controleur).filter(
      (e) => e.type === "OBSERVATION_AGENT_RECUE",
    );
    expect(obs).toHaveLength(3);
    const idsObs = new Set(
      obs.map((e) => String(e.chargeUtile.identifiantObservation)),
    );
    expect(idsObs.size).toBe(3);
  });

  it("N — déterminisme expérience complète (même graine)", async () => {
    const executer = async () => {
      const c = ouvrirMemoire({
        graineSimulation: 424242,
        taillePopulationInitiale: 2,
        politiqueBudgetCognitif: {
          ...POLITIQUE_BASE,
          seuilEnjeuPourInferenceMicroUsdc: "1",
        },
      });
      for (let i = 0; i < 8; i += 1) {
        await c.avancerUnCycle();
      }
      return {
        empreinte: c.capturerEmpreinteEconomique(),
        decisions: evenementsExperience(c)
          .filter((e) => e.type === "DECISION_AGENT_VALIDEE")
          .map((e) => ({
            agent: e.identifiantAgent,
            cycle: e.numeroCycle,
            action: e.chargeUtile.action,
            source: e.chargeUtile.sourceDecision,
          })),
      };
    };
    expect(await executer()).toEqual(await executer());
  });

  it("O — mode simulation historique toujours fonctionnel", async () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: parserConfigurationExperience({
        identifiantExperience: "exp-sim-hist-o",
        versionProtocole: "0.1.0",
        mode: "simulation",
        graineSimulation: 12345,
        taillePopulationInitiale: 3,
        capitalInitialParAgentMicroUsdc: "10000000",
        parametresEconomiques: {
          version: "demo-sim",
          loyerInfrastructureMicroUsdc: "100000",
          periodeLoyerEnCycles: 5,
          tauxRedevanceProprietairePointsDeBase: "1000",
          coutOperationnelMinimalParCycleMicroUsdc: "50000",
          seuilRunwaySainEnCycles: 20,
          seuilRunwayContraintEnCycles: 5,
          cyclesDormanceAvantMort: 3,
        },
      }),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 5; i += 1) {
      await controleur.avancerUnCycle();
    }
    const evts = evenementsExperience(controleur);
    expect(evts.some((e) => e.type === "OBSERVATION_AGENT_RECUE")).toBe(false);
    expect(evts.some((e) => e.type === "CYCLE_TERMINE")).toBe(true);
    expect(controleur.obtenirAgents()).toHaveLength(3);
  });

  it("P — fournisseur openai en config : avancer ne déclenche pas de réseau", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "1",
      },
      xway: {
        ...XWAY_BASE,
        fournisseur: "openai",
        plafondDepenseFournisseurReelleMicroUsd: "100000",
        timeoutInferenceMs: 5000,
        baremeCoutInference: {
          fournisseur: "fournisseur-inference-openai",
          modeleLogique: "luna_reel_v01",
          modeleExterne: "gpt-5.6-luna",
          versionBareme: "openai-luna-v01-2026-09",
          deviseReference: "USD",
          coutParMillionJetonsEntreeMicroUsd: "200000",
          coutParMillionJetonsSortieMicroUsd: "1200000",
          coutParMillionJetonsEntreeCacheMicroUsd: "20000",
          dateReference: "2026-09-01",
        },
        modeles: [
          ...XWAY_BASE.modeles,
          {
            identifiant: "luna_reel_v01" as const,
            libelle: "Luna",
            coutParMillionJetonsEntreeMicroUsdc: "2000000",
            coutParMillionJetonsSortieMicroUsdc: "6000000",
            nombreMaxJetonsSortie: 128,
          },
        ],
      },
    });
    // Si un appel réseau était tenté, ce test échouerait / planterait.
    await controleur.avancerUnCycle();
    const evts = evenementsExperience(controleur);
    expect(evts.some((e) => e.type === "INFERENCE_EXECUTEE")).toBe(false);
    expect(evts.some((e) => e.type === "OBSERVATION_AGENT_RECUE")).toBe(true);
    const decisions = controleur.projeterDecisionsAgent(
      controleur.obtenirAgents()[0]!.identite.identifiant,
    );
    expect(decisions[0]!.choixCognitif?.utiliserInference).toBe(false);
    expect(decisions[0]!.decision?.sourceDecision).toBe("sans_inference");
  });

  it("Q — agent mort : aucune nouvelle observation", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 1,
      capitalInitialParAgentMicroUsdc: "100000",
      parametresEconomiques: {
        version: "demo-mort",
        loyerInfrastructureMicroUsdc: "50000",
        periodeLoyerEnCycles: 1,
        tauxRedevanceProprietairePointsDeBase: "0",
        coutOperationnelMinimalParCycleMicroUsdc: "40000",
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 2,
      },
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "999999999999",
        comportementSansInference: "attendre",
      },
      environnementDecision: {
        ...ENV_BASE,
        gainSiSuccesMicroUsdc: "1",
        perteSiEchecMicroUsdc: "1",
        fraisActionMicroUsdc: "0",
      },
    });
    let cyclesMort = 0;
    for (let i = 0; i < 40; i += 1) {
      await controleur.avancerUnCycle();
      if (controleur.obtenirAgents()[0]!.etatEconomique.etatSurvie === "mort") {
        cyclesMort = i + 1;
        break;
      }
    }
    expect(cyclesMort).toBeGreaterThan(0);
    const obsAvant = evenementsExperience(controleur).filter(
      (e) => e.type === "OBSERVATION_AGENT_RECUE",
    ).length;
    for (let i = 0; i < 5; i += 1) {
      await controleur.avancerUnCycle();
    }
    const obsApres = evenementsExperience(controleur).filter(
      (e) => e.type === "OBSERVATION_AGENT_RECUE",
    ).length;
    expect(obsApres).toBe(obsAvant);
    expect(controleur.obtenirAgents()[0]!.etatEconomique.etatSurvie).toBe(
      "mort",
    );
  });

  it("R — projections API correspondent au registre", async () => {
    const controleur = ouvrirMemoire({
      taillePopulationInitiale: 2,
      politiqueBudgetCognitif: {
        ...POLITIQUE_BASE,
        seuilEnjeuPourInferenceMicroUsdc: "999999999999",
        comportementSansInference: "attendre",
      },
    });
    for (let i = 0; i < 3; i += 1) {
      await controleur.avancerUnCycle();
    }
    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    const base = `http://127.0.0.1:${String(serveur.port)}`;
    try {
      const agentId = controleur.obtenirAgents()[0]!.identite.identifiant;
      const depuisRegistre = controleur.projeterDecisionsAgent(agentId);
      const activite = controleur.projeterActiviteDecisionnelle();

      const reponseDec = await fetch(
        `${base}/api/agents/${encodeURIComponent(agentId)}/decisions`,
      );
      expect(reponseDec.ok).toBe(true);
      const corpsDec = (await reponseDec.json()) as {
        decisions: typeof depuisRegistre;
      };
      expect(corpsDec.decisions).toEqual(depuisRegistre);

      const reponseAct = await fetch(`${base}/api/activite-decisionnelle`);
      expect(reponseAct.ok).toBe(true);
      expect(await reponseAct.json()).toEqual(activite);

      const obsRegistre = evenementsExperience(controleur).filter(
        (e) =>
          e.type === "OBSERVATION_AGENT_RECUE" && e.identifiantAgent === agentId,
      ).length;
      expect(depuisRegistre).toHaveLength(obsRegistre);
    } finally {
      await serveur.fermer();
    }
  });
});
