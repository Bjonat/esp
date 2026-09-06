import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  creerRegistreEvenementsMemoire,
  creerRegistreEvenementsSqlite,
} from "@esp/registre-evenements";
import {
  ControleurExperience,
  demarrerServeurApi,
  parserConfigurationExperience,
  reconstruirePopulationDepuisEvenements,
  simulerActiviteCycle,
  type ConfigurationExperienceJson,
} from "../src/index.js";

const repertoiresTemporaires: string[] = [];

afterEach(() => {
  while (repertoiresTemporaires.length > 0) {
    const repertoire = repertoiresTemporaires.pop();
    if (repertoire !== undefined) {
      rmSync(repertoire, { recursive: true, force: true });
    }
  }
});

function repertoireTemp(): string {
  const repertoire = mkdtempSync(join(tmpdir(), "esp-controleur-"));
  repertoiresTemporaires.push(repertoire);
  return repertoire;
}

function configurationDemo(surcharges?: Partial<ConfigurationExperienceJson>) {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-test-population-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 12345,
    taillePopulationInitiale: 10,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-test-v01",
      loyerInfrastructureMicroUsdc: "100000",
      periodeLoyerEnCycles: 5,
      tauxRedevanceProprietairePointsDeBase: "1000",
      coutOperationnelMinimalParCycleMicroUsdc: "50000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
  };
  return parserConfigurationExperience({ ...base, ...surcharges });
}

function ouvrirControleurMemoire(
  surcharges?: Partial<ConfigurationExperienceJson>,
) {
  return ControleurExperience.ouvrir({
    configuration: configurationDemo(surcharges),
    registre: creerRegistreEvenementsMemoire(),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

describe("Population, contrôleur et dashboard v0.1", () => {
  it("A — Population Genesis : N agents, capitalisations, génération 0", () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 7,
    });
    const agents = controleur.obtenirAgents();
    expect(agents).toHaveLength(7);

    const evenements = controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    );
    const crees = evenements.filter((e) => e.type === "AGENT_CREE");
    const capitaux = evenements.filter(
      (e) => e.type === "CAPITAL_INITIAL_ATTRIBUE",
    );
    expect(crees).toHaveLength(7);
    expect(capitaux).toHaveLength(7);

    for (const agent of agents) {
      expect(agent.identite.generation).toBe(0);
      expect(agent.identite.identifiantParent).toBeUndefined();
      expect(agent.etatEconomique.capitalLiquide).toBe(10_000_000n);
      expect(agent.etatEconomique.highWaterMarkProprietaire).toBe(10_000_000n);
      expect(agent.etatEconomique.totalRevenusActivite).toBe(0n);
    }

    const capitalTotal = agents.reduce(
      (somme, agent) => somme + agent.etatEconomique.capitalLiquide,
      0n,
    );
    expect(capitalTotal).toBe(70_000_000n);
  });

  it("B — Déterminisme : même config + graine + cycles → mêmes résultats", () => {
    const executer = () => {
      const controleur = ouvrirControleurMemoire({
        graineSimulation: 12345,
        taillePopulationInitiale: 10,
      });
      for (let cycle = 0; cycle < 100; cycle += 1) {
        controleur.avancerUnCycle();
      }
      return controleur.capturerEmpreinteEconomique();
    };

    const empreinteA = executer();
    const empreinteB = executer();
    expect(empreinteA).toEqual(empreinteB);
  });

  it("C — Multi-agents : états séparés, séquences monotones", () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 5,
    });
    controleur.avancerUnCycle();
    controleur.avancerUnCycle();

    const evenements = controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    );
    const sequences = evenements.map((e) => e.sequence);
    for (let index = 1; index < sequences.length; index += 1) {
      const precedente = sequences[index - 1];
      const courante = sequences[index];
      expect(precedente).toBeDefined();
      expect(courante).toBeDefined();
      expect(courante!).toBe(precedente! + 1);
    }

    const agents = controleur.obtenirAgents();
    expect(new Set(agents.map((a) => a.identite.identifiant)).size).toBe(5);
    for (const agent of agents) {
      expect(agent.etatEconomique.dernierNumeroCycle).toBe(2);
    }
  });

  it("D — Mort : reste visible, plus d'activité, jamais réactivé", () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 3,
      capitalInitialParAgentMicroUsdc: "80000",
      parametresEconomiques: {
        version: "demo-mort",
        loyerInfrastructureMicroUsdc: "50000",
        periodeLoyerEnCycles: 1,
        tauxRedevanceProprietairePointsDeBase: "0",
        coutOperationnelMinimalParCycleMicroUsdc: "50000",
        seuilRunwaySainEnCycles: 5,
        seuilRunwayContraintEnCycles: 2,
        cyclesDormanceAvantMort: 2,
      },
    });

    for (let cycle = 0; cycle < 40; cycle += 1) {
      controleur.avancerUnCycle();
      if (
        controleur
          .obtenirAgents()
          .some((agent) => agent.etatEconomique.etatSurvie === "mort")
      ) {
        break;
      }
    }

    const morts = controleur
      .obtenirAgents()
      .filter((agent) => agent.etatEconomique.etatSurvie === "mort");
    expect(morts.length).toBeGreaterThan(0);

    const populationAvant = controleur.projeterPopulation().populationTotale;
    expect(populationAvant).toBe(3);

    const mort = morts[0]!;
    const cycleMort = mort.etatEconomique.dernierNumeroCycle;
    const evenementsAvant = controleur.registre
      .listerParAgent(mort.identite.identifiant)
      .filter((e) => e.numeroCycle > cycleMort).length;

    controleur.avancerUnCycle();
    controleur.avancerUnCycle();

    const mortApres = controleur
      .obtenirAgents()
      .find((a) => a.identite.identifiant === mort.identite.identifiant);
    expect(mortApres?.etatEconomique.etatSurvie).toBe("mort");
    expect(controleur.projeterPopulation().populationTotale).toBe(3);
    expect(controleur.projeterAgent(mort.identite.identifiant)).toBeDefined();

    const evenementsApres = controleur.registre
      .listerParAgent(mort.identite.identifiant)
      .filter((e) => e.numeroCycle > cycleMort);
    expect(evenementsApres.length).toBe(evenementsAvant);
  });

  it("E — Reconstruction : population mémoire == population depuis événements", () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 4,
    });
    for (let cycle = 0; cycle < 15; cycle += 1) {
      controleur.avancerUnCycle();
    }

    const memoire = controleur.capturerEmpreinteEconomique();
    const reconstruite = reconstruirePopulationDepuisEvenements(
      controleur.registre.listerParExperience(
        controleur.configuration.identifiantExperience,
      ),
    );

    expect(reconstruite).toHaveLength(memoire.agents.length);
    for (let index = 0; index < memoire.agents.length; index += 1) {
      expect(reconstruite[index]?.etatEconomique).toEqual(
        memoire.agents[index]?.etat,
      );
      expect(reconstruite[index]?.identite.identifiant).toBe(
        memoire.agents[index]?.identifiant,
      );
    }
  });

  it("F — Redémarrage : 20 cycles + reprise cycle 21 == 21 cycles continus", () => {
    const repertoire = repertoireTemp();
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const configuration = configurationDemo({
      taillePopulationInitiale: 5,
      graineSimulation: 4242,
    });

    const continu = ControleurExperience.ouvrir({
      configuration,
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let cycle = 0; cycle < 21; cycle += 1) {
      continu.avancerUnCycle();
    }
    const empreinteContinue = continu.capturerEmpreinteEconomique();

    const premier = ControleurExperience.ouvrir({
      configuration,
      cheminSqlite,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let cycle = 0; cycle < 20; cycle += 1) {
      premier.avancerUnCycle();
    }
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration,
      cheminSqlite,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(second.obtenirNumeroCycleCourant()).toBe(20);
    second.avancerUnCycle();
    const empreinteReprise = second.capturerEmpreinteEconomique();
    second.fermer();

    expect(empreinteReprise.numeroCycle).toBe(21);
    expect(empreinteReprise.agents).toEqual(empreinteContinue.agents);
    expect(empreinteReprise.tresorerie).toEqual(empreinteContinue.tresorerie);
    expect(empreinteReprise.typesEvenements).toEqual(
      empreinteContinue.typesEvenements,
    );
  });

  it("G — API population : agrégats = projections reconstruites", async () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 6,
    });
    for (let cycle = 0; cycle < 8; cycle += 1) {
      controleur.avancerUnCycle();
    }

    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    const adresse = await adresseEcoute(serveur);
    try {
      const populationApi = await fetchJson(
        `http://${adresse}/api/population`,
      );
      expect(populationApi).toEqual(controleur.projeterPopulation());
    } finally {
      await serveur.fermer();
    }
  });

  it("H — API agent : fiche = registre reconstruit", async () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 3,
    });
    for (let cycle = 0; cycle < 5; cycle += 1) {
      controleur.avancerUnCycle();
    }
    const identifiant = controleur.obtenirAgents()[0]!.identite.identifiant;

    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    const adresse = await adresseEcoute(serveur);
    try {
      const agentApi = await fetchJson(
        `http://${adresse}/api/agents/${encodeURIComponent(identifiant)}`,
      );
      expect(agentApi).toEqual(controleur.projeterAgent(identifiant));

      const evenementsApi = (await fetchJson(
        `http://${adresse}/api/agents/${encodeURIComponent(identifiant)}/evenements`,
      )) as { evenements: unknown[] };
      expect(evenementsApi.evenements).toEqual(
        controleur.projeterEvenementsAgent(identifiant),
      );
    } finally {
      await serveur.fermer();
    }
  });

  it("I — Trésorerie API = TresorerieProprietaire", async () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 4,
    });
    for (let cycle = 0; cycle < 12; cycle += 1) {
      controleur.avancerUnCycle();
    }

    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    const adresse = await adresseEcoute(serveur);
    try {
      const tresorerieApi = await fetchJson(
        `http://${adresse}/api/tresorerie`,
      );
      expect(tresorerieApi).toEqual(controleur.projeterTresorerie());
      expect(controleur.projeterTresorerie().revenusLoyers.microUsdc).toBe(
        controleur.obtenirTresorerie().revenusLoyers.toString(10),
      );
    } finally {
      await serveur.fermer();
    }
  });

  it("J — Arbre : N racines Genesis, 0 relation", () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 8,
    });
    const arbre = controleur.projeterArbre();
    expect(arbre.racines).toHaveLength(8);
    expect(arbre.relations).toHaveLength(0);
    expect(arbre.reproductionActivee).toBe(false);
    expect(arbre.message).toBe("Reproduction non activée");
  });

  it("K — Absence de mocks : pas d'activité fictive hors registre", async () => {
    const controleur = ouvrirControleurMemoire({
      taillePopulationInitiale: 2,
    });
    expect(controleur.projeterActiviteRecente()).toEqual([]);

    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    const adresse = await adresseEcoute(serveur);
    try {
      const activite = (await fetchJson(
        `http://${adresse}/api/activite-recente`,
      )) as { evenements: unknown[] };
      expect(activite.evenements).toEqual([]);

      controleur.avancerUnCycle();
      const apres = (await fetchJson(
        `http://${adresse}/api/activite-recente`,
      )) as { evenements: Array<{ identifiant: string }> };
      const idsRegistre = new Set(
        controleur.registre
          .listerParExperience(controleur.configuration.identifiantExperience)
          .map((e) => e.identifiant),
      );
      expect(apres.evenements.length).toBeGreaterThan(0);
      for (const evenement of apres.evenements) {
        expect(idsRegistre.has(evenement.identifiant)).toBe(true);
      }
    } finally {
      await serveur.fermer();
    }

    await expect(
      fetch("http://127.0.0.1:59999/api/activite-recente"),
    ).rejects.toThrow();
  });

  it("L — Temps wall-clock : vitesse d'exécution sans effet économique", async () => {
    const executerAvecDelai = async (delaiMs: number) => {
      const controleur = ouvrirControleurMemoire({
        graineSimulation: 777,
        taillePopulationInitiale: 4,
      });
      for (let cycle = 0; cycle < 10; cycle += 1) {
        controleur.avancerUnCycle();
        if (delaiMs > 0) {
          await new Promise((r) => setTimeout(r, delaiMs));
        }
      }
      return controleur.capturerEmpreinteEconomique();
    };

    const rapide = await executerAvecDelai(0);
    const lente = await executerAvecDelai(5);
    expect(rapide).toEqual(lente);
  });

  it("Simulateur de développement : déterministe et hors protocole", () => {
    const a = simulerActiviteCycle({
      graineSimulation: 12345,
      identifiantAgent: "agent-a",
      numeroCycle: 7,
    });
    const b = simulerActiviteCycle({
      graineSimulation: 12345,
      identifiantAgent: "agent-a",
      numeroCycle: 7,
    });
    const c = simulerActiviteCycle({
      graineSimulation: 12345,
      identifiantAgent: "agent-b",
      numeroCycle: 7,
    });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.revenuActivite + a.perteActivite).toBeGreaterThanOrEqual(0n);
  });

  it("Reprise SQLite isolee : reconstruction après fermeture", () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "seul.sqlite");
    const configuration = configurationDemo({
      taillePopulationInitiale: 3,
      graineSimulation: 99,
    });

    const premier = ControleurExperience.ouvrir({
      configuration,
      cheminSqlite: chemin,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    premier.avancerUnCycle();
    premier.avancerUnCycle();
    const empreinte = premier.capturerEmpreinteEconomique();
    premier.fermer();

    const registre = creerRegistreEvenementsSqlite(chemin);
    const evenements = registre.listerParExperience(
      configuration.identifiantExperience,
    );
    const population = reconstruirePopulationDepuisEvenements(evenements);
    registre.fermer();

    expect(population).toHaveLength(3);
    expect(population.map((a) => a.etatEconomique)).toEqual(
      empreinte.agents.map((a) => a.etat),
    );
  });
});

async function adresseEcoute(serveur: {
  hote: string;
  port: number;
}): Promise<string> {
  return `${serveur.hote}:${String(serveur.port)}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const reponse = await fetch(url);
  expect(reponse.ok).toBe(true);
  return reponse.json();
}
