import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  attribuerCapitalInitial,
  parserSnapshotCreationExperience,
} from "@esp/protocole";
import {
  creerRegistreEvenementsMemoire,
  creerRegistreEvenementsSqlite,
} from "@esp/registre-evenements";
import {
  ControleurExperience,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
} from "../src/index.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const repertoire = repertoires.pop();
    if (repertoire !== undefined) {
      rmSync(repertoire, { recursive: true, force: true });
    }
  }
});

function repertoireTemp(): string {
  const repertoire = mkdtempSync(join(tmpdir(), "esp-verite-"));
  repertoires.push(repertoire);
  return repertoire;
}

function configJson(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ConfigurationExperienceJson {
  return {
    identifiantExperience: "exp-verite-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 111,
    taillePopulationInitiale: 3,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-verite",
      loyerInfrastructureMicroUsdc: "100000",
      periodeLoyerEnCycles: 5,
      tauxRedevanceProprietairePointsDeBase: "1000",
      coutOperationnelMinimalParCycleMicroUsdc: "50000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    ...surcharges,
  };
}

describe("Source de vérité expérimentale (hardening)", () => {
  it("A — JSON modifié après création n'altère pas l'expérience historique", () => {
    const repertoire = repertoireTemp();
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const cheminConfig = join(repertoire, "config.json");

    const initiale = configJson({
      graineSimulation: 111,
      capitalInitialParAgentMicroUsdc: "10000000",
      parametresEconomiques: {
        version: "historique-v1",
        loyerInfrastructureMicroUsdc: "100000",
        periodeLoyerEnCycles: 5,
        tauxRedevanceProprietairePointsDeBase: "1000",
        coutOperationnelMinimalParCycleMicroUsdc: "50000",
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 3,
      },
    });
    writeFileSync(cheminConfig, `${JSON.stringify(initiale, null, 2)}\n`);

    const creation = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
    });
    expect(creation.configuration.graineSimulation).toBe(111);
    expect(creation.configuration.parametresEconomiques.version).toBe(
      "historique-v1",
    );
    creation.avancerUnCycle();
    creation.fermer();

    const modifiee = configJson({
      graineSimulation: 99999,
      capitalInitialParAgentMicroUsdc: "1",
      parametresEconomiques: {
        version: "json-altere-ne-doit-pas-compter",
        loyerInfrastructureMicroUsdc: "999999",
        periodeLoyerEnCycles: 1,
        tauxRedevanceProprietairePointsDeBase: "5000",
        coutOperationnelMinimalParCycleMicroUsdc: "1000",
        seuilRunwaySainEnCycles: 50,
        seuilRunwayContraintEnCycles: 10,
        cyclesDormanceAvantMort: 9,
      },
    });
    writeFileSync(cheminConfig, `${JSON.stringify(modifiee, null, 2)}\n`);

    const reprise = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
    });
    expect(reprise.configuration.graineSimulation).toBe(111);
    expect(reprise.configuration.parametresEconomiques.version).toBe(
      "historique-v1",
    );
    expect(
      reprise.configuration.parametresEconomiques.loyerInfrastructureMicroUsdc,
    ).toBe(100_000n);
    expect(reprise.obtenirNumeroCycleCourant()).toBe(1);
    reprise.fermer();
  });

  it("B — créer → démarrer → avancer → pause → redémarrer reconstruit statut et cycle", () => {
    const repertoire = repertoireTemp();
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const configuration = parserConfigurationExperience(configJson());

    const premier = ControleurExperience.ouvrir({
      configuration,
      cheminSqlite,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(premier.obtenirStatut()).toBe("prete");
    premier.demarrer();
    expect(premier.obtenirStatut()).toBe("en_cours");
    premier.avancerUnCycle();
    premier.avancerUnCycle();
    expect(premier.obtenirNumeroCycleCourant()).toBe(2);
    premier.mettreEnPause();
    expect(premier.obtenirStatut()).toBe("en_pause");
    premier.fermer();

    const second = ControleurExperience.ouvrirDepuisRegistre({
      cheminSqlite,
      identifiantExperience: configuration.identifiantExperience,
    });
    expect(second.obtenirStatut()).toBe("en_pause");
    expect(second.obtenirNumeroCycleCourant()).toBe(2);
    expect(second.obtenirAgents()).toHaveLength(3);
    second.fermer();
  });

  it("C — reconstruction sans fichier de configuration original", () => {
    const repertoire = repertoireTemp();
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const configuration = parserConfigurationExperience(
      configJson({ graineSimulation: 42, taillePopulationInitiale: 4 }),
    );

    const createur = ControleurExperience.ouvrir({
      configuration,
      cheminSqlite,
      dateCreationFixe: "2020-06-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-06-01T00:00:00.000Z",
    });
    createur.avancerUnCycle();
    createur.avancerUnCycle();
    createur.avancerUnCycle();
    const empreinte = createur.capturerEmpreinteEconomique();
    createur.fermer();

    const sansJson = ControleurExperience.ouvrirDepuisRegistre({
      cheminSqlite,
      identifiantExperience: "exp-verite-v01",
    });
    expect(sansJson.configuration.graineSimulation).toBe(42);
    expect(sansJson.configuration.taillePopulationInitiale).toBe(4);
    expect(sansJson.obtenirNumeroCycleCourant()).toBe(3);
    expect(sansJson.obtenirAgents()).toHaveLength(4);
    expect(sansJson.capturerEmpreinteEconomique().agents).toEqual(
      empreinte.agents,
    );
    expect(sansJson.obtenirSnapshotSimulateur()).toEqual({
      identifiant: "simulateur-developpement",
      version: "0.1.0",
    });
    sansJson.fermer();
  });

  it("D — AGENT_CREE respecte un payload métier canonique", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-agent-cree",
      identifiantAgent: "agent-x",
      montant: 5_000_000n,
      naissance: {
        generation: 0,
        indexPopulation: 2,
        dateNaissance: "cycle:0",
      },
    });
    const agentCree = naissance.evenements.find((e) => e.type === "AGENT_CREE");
    expect(agentCree).toBeDefined();
    expect(agentCree!.chargeUtile).toEqual({
      generation: 0,
      indexPopulation: 2,
      dateNaissance: "cycle:0",
    });

    const controleur = ControleurExperience.ouvrir({
      configuration: parserConfigurationExperience(configJson()),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const evenements = controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    );
    const crees = evenements.filter((e) => e.type === "AGENT_CREE");
    expect(crees).toHaveLength(3);
    for (const [index, evenement] of crees.entries()) {
      expect(evenement.chargeUtile.generation).toBe(0);
      expect(evenement.chargeUtile.indexPopulation).toBe(index);
      expect(typeof evenement.chargeUtile.dateNaissance).toBe("string");
      expect(evenement.chargeUtile.identifiantParent).toBeUndefined();
    }
  });

  it("EXPERIENCE_CREEE fige le snapshot exact des paramètres", () => {
    const controleur = ControleurExperience.ouvrir({
      configuration: parserConfigurationExperience(configJson()),
      registre: creerRegistreEvenementsMemoire(),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const creation = controleur.registre
      .listerParExperience(controleur.configuration.identifiantExperience)
      .find((e) => e.type === "EXPERIENCE_CREEE");
    expect(creation).toBeDefined();
    const snapshot = parserSnapshotCreationExperience(creation!.chargeUtile);
    expect(snapshot.graineSimulation).toBe(111);
    expect(snapshot.simulateur.identifiant).toBe("simulateur-developpement");
    expect(snapshot.parametresEconomiques.version).toBe("demo-verite");
  });

  it("ouvrirDepuisRegistre refuse un SQLite sans EXPERIENCE_CREEE", () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "legacy.sqlite");
    const registre = creerRegistreEvenementsSqlite(chemin);
    registre.ajouter({
      identifiant: "legacy-agent",
      type: "AGENT_CREE",
      identifiantExperience: "exp-legacy",
      identifiantAgent: "a0",
      numeroCycle: 0,
      chargeUtile: {
        generation: 0,
        indexPopulation: 0,
        dateNaissance: "x",
      },
    });
    registre.fermer();

    expect(() =>
      ControleurExperience.ouvrirDepuisRegistre({
        cheminSqlite: chemin,
        identifiantExperience: "exp-legacy",
      }),
    ).toThrow(/EXPERIENCE_CREEE/);
  });
});
