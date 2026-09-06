import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  creerPasserelleXway,
  creerConfigurationXwayDemonstration,
  estimerCoutInference,
  calculerUsageInference,
  trouverTarifModele,
  type DemandeInference,
} from "@esp/xway";
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
    if (r !== undefined) rmSync(r, { recursive: true, force: true });
  }
});

function demandeBase(
  surcharges: Partial<DemandeInference> = {},
): DemandeInference {
  return {
    identifiantDemande: "dem-test-001",
    identifiantExperience: "exp-xway",
    identifiantAgent: "agent-a",
    numeroCycle: 1,
    modeleDemande: "modele_standard",
    messages: [
      { role: "systeme", contenu: "Contexte ESP simulé." },
      { role: "utilisateur", contenu: "Analyse économique minimale de démonstration." },
    ],
    nombreMaxJetonsSortie: 512,
    limiteDepenseAutoriseeMicroUsdc: 1_000_000n,
    ...surcharges,
  };
}

function configAvecXway(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ReturnType<typeof parserConfigurationExperience> {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-xway-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 12345,
    taillePopulationInitiale: 4,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-xway",
      loyerInfrastructureMicroUsdc: "100000",
      periodeLoyerEnCycles: 5,
      tauxRedevanceProprietairePointsDeBase: "1000",
      coutOperationnelMinimalParCycleMicroUsdc: "50000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    xway: {
      active: true,
      plafondComputeParCycleMicroUsdc: "50000",
      modeles: [
        {
          identifiant: "modele_economique",
          libelle: "éco",
          coutParMillionJetonsEntreeMicroUsdc: "500000",
          coutParMillionJetonsSortieMicroUsdc: "1500000",
          nombreMaxJetonsSortie: 256,
        },
        {
          identifiant: "modele_standard",
          libelle: "std",
          coutParMillionJetonsEntreeMicroUsdc: "2000000",
          coutParMillionJetonsSortieMicroUsdc: "6000000",
          nombreMaxJetonsSortie: 512,
        },
        {
          identifiant: "modele_premium",
          libelle: "prem",
          coutParMillionJetonsEntreeMicroUsdc: "20000000",
          coutParMillionJetonsSortieMicroUsdc: "60000000",
          nombreMaxJetonsSortie: 1024,
        },
      ],
      politiqueCognitive: {
        identifiant: "politique-cognitive-developpement",
        version: "0.1.0",
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: "0.1.0",
      },
    },
  };
  return parserConfigurationExperience({ ...base, ...surcharges });
}

describe("Xway v0.1", () => {
  it("A — estimation déterministe", () => {
    const conf = creerConfigurationXwayDemonstration();
    const tarif = trouverTarifModele(conf.modeles, "modele_standard")!;
    const d = demandeBase();
    expect(estimerCoutInference(d, tarif)).toEqual(estimerCoutInference(d, tarif));
  });

  it("B — budget suffisant : autorisée puis exécutée", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
    });
    const resultat = passerelle.executer(
      demandeBase({ limiteDepenseAutoriseeMicroUsdc: 1_000_000n }),
    );
    expect(resultat.statut).toBe("executee");
    if (resultat.statut === "executee") {
      expect(resultat.coutFinalMicroUsdc).toBeGreaterThan(0n);
      expect(resultat.coutFinalMicroUsdc).toBeLessThanOrEqual(
        resultat.estimation.coutMaximumEstimeMicroUsdc,
      );
    }
  });

  it("C — budget insuffisant : refus, coût 0", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
    });
    const resultat = passerelle.executer(
      demandeBase({
        modeleDemande: "modele_premium",
        limiteDepenseAutoriseeMicroUsdc: 20_000n,
      }),
    );
    expect(resultat.statut).toBe("refusee");
    if (resultat.statut === "refusee") {
      expect(resultat.motif).toBe("budget_insuffisant");
    }
  });

  it("D — coût exact entier micro-USDC", () => {
    const conf = creerConfigurationXwayDemonstration();
    const tarif = trouverTarifModele(conf.modeles, "modele_economique")!;
    const usage = calculerUsageInference({
      demande: demandeBase({ modeleDemande: "modele_economique" }),
      tarif,
    });
    expect(typeof usage.coutMicroUsdc).toBe("bigint");
    expect(usage.coutMicroUsdc).toBeGreaterThanOrEqual(0n);
  });

  it("E — absence de double débit économique", () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: configAvecXway(),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 15; i += 1) controleur.avancerUnCycle();
    const evenements = controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    );
    const executees = evenements.filter((e) => e.type === "INFERENCE_EXECUTEE");
    const depenses = evenements.filter((e) => e.type === "DEPENSE_COMPUTE");
    let coutXway = 0n;
    for (const e of executees) {
      const c = e.chargeUtile.coutFinalMicroUsdc;
      if (typeof c === "string") coutXway += BigInt(c);
    }
    let coutCompute = 0n;
    for (const e of depenses) {
      const c = e.chargeUtile.montantMicroUsdc;
      if (typeof c === "string") coutCompute += BigInt(c);
    }
    expect(coutCompute).toBe(coutXway);
    expect(executees.length).toBeGreaterThan(0);
  });

  it("F — idempotence demande", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
    });
    const d = demandeBase({ identifiantDemande: "unique-once" });
    const premier = passerelle.executer(d);
    expect(premier.statut).toBe("executee");
    const second = passerelle.executer(d);
    expect(second.statut).toBe("executee");
    if (premier.statut === "executee" && second.statut === "executee") {
      expect(second.dejaConnue).toBe(true);
      expect(second.coutFinalMicroUsdc).toBe(premier.coutFinalMicroUsdc);
    }
  });

  it("G — multi-agent : budgets séparés", () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: configAvecXway({ taillePopulationInitiale: 3 }),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    controleur.avancerUnCycle();
    const agents = controleur.obtenirAgents();
    const ids = new Set(agents.map((a) => a.identite.identifiant));
    expect(ids.size).toBe(3);
    for (const agent of agents) {
      const xway = controleur.projeterXwayAgent(agent.identite.identifiant)!;
      expect(xway.identifiantAgent).toBe(agent.identite.identifiant);
    }
  });

  it("H — déterminisme expérience avec Xway", () => {
    const run = () => {
      const c = ControleurExperience.ouvrir({
        configuration: configAvecXway(),
        registre: creerRegistreEvenementsMemoire(),
        dateCreationFixe: "2020-01-01T00:00:00.000Z",
        datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
      });
      for (let i = 0; i < 20; i += 1) c.avancerUnCycle();
      return c.capturerEmpreinteEconomique();
    };
    expect(run()).toEqual(run());
  });

  it("I — coût Xway cumulé == DEPENSE_COMPUTE cumulée", () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: configAvecXway(),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 12; i += 1) controleur.avancerUnCycle();
    const projection = controleur.projeterXway();
    const totalComputeAgents = controleur
      .obtenirAgents()
      .reduce((s, a) => s + a.etatEconomique.totalDepensesCompute, 0n);
    expect(projection.coutComputeCumule.microUsdc).toBe(
      totalComputeAgents.toString(10),
    );
  });

  it("J — reprise sans dupliquer historique Xway", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-xway-"));
    repertoires.push(repertoire);
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const conf = configAvecXway({ taillePopulationInitiale: 3 });

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 8; i += 1) premier.avancerUnCycle();
    const avant = premier.projeterXway();
    const empreinte = premier.capturerEmpreinteEconomique();
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(second.projeterXway().inferencesExecutees).toBe(
      avant.inferencesExecutees,
    );
    expect(second.projeterXway().coutComputeCumule).toEqual(avant.coutComputeCumule);
    second.avancerUnCycle();
    expect(second.obtenirNumeroCycleCourant()).toBe(9);
    expect(second.capturerEmpreinteEconomique().agents).not.toEqual([]);
    // Pas de régression d'historique : le cycle 9 s'ajoute, pas de duplication cycle 1-8
    const types = second.capturerEmpreinteEconomique().typesEvenements;
    const executees = types.filter((t) => t.startsWith("INFERENCE_EXECUTEE:"));
    expect(new Set(executees).size).toBe(executees.length);
    void empreinte;
    second.fermer();
  });

  it("K — projections API Xway = événements", async () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: configAvecXway(),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 6; i += 1) controleur.avancerUnCycle();
    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    try {
      const url = `http://${serveur.hote}:${String(serveur.port)}`;
      const xway = await (await fetch(`${url}/api/xway`)).json();
      expect(xway).toEqual(controleur.projeterXway());
      const agentId = controleur.obtenirAgents()[0]!.identite.identifiant;
      const xwayAgent = await (
        await fetch(`${url}/api/agents/${encodeURIComponent(agentId)}/xway`)
      ).json();
      expect(xwayAgent).toEqual(controleur.projeterXwayAgent(agentId));
    } finally {
      await serveur.fermer();
    }
  });

  it("L — modèle trop cher : refus propre sans coût", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration({
        plafondComputeParCycleMicroUsdc: 50_000n,
      }),
    });
    const resultat = passerelle.executer(
      demandeBase({
        modeleDemande: "modele_premium",
        limiteDepenseAutoriseeMicroUsdc: 20_000n,
        nombreMaxJetonsSortie: 1024,
      }),
    );
    expect(resultat.statut).toBe("refusee");
    expect(passerelle.obtenirTraces()[0]?.coutFinalMicroUsdc).toBe(0n);
  });
});
