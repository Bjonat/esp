import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  creerEntreeCycleExperienceAvance,
  executerCycleEconomique,
  fabriquerIdentifiantExecutionEconomique,
  type EntreeEvenementEsp,
} from "@esp/protocole";
import {
  ControleurExperience,
  parserConfigurationExperience,
  simulerActiviteCycle,
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
  const repertoire = mkdtempSync(join(tmpdir(), "esp-atomicite-"));
  repertoires.push(repertoire);
  return repertoire;
}

function configurationBase(
  surcharges?: Partial<ConfigurationExperienceJson>,
): ReturnType<typeof parserConfigurationExperience> {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-atomicite-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 424242,
    taillePopulationInitiale: 1,
    capitalInitialParAgentMicroUsdc: "100000000",
    parametresEconomiques: {
      version: "atomicite-ctrl-v01",
      loyerInfrastructureMicroUsdc: "1000000",
      periodeLoyerEnCycles: 1,
      tauxRedevanceProprietairePointsDeBase: "1000",
      coutOperationnelMinimalParCycleMicroUsdc: "100000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
  };
  return parserConfigurationExperience({ ...base, ...surcharges });
}

function ouvrir(cheminSqlite: string, conf = configurationBase()) {
  return ControleurExperience.ouvrir({
    configuration: conf,
    cheminSqlite,
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

function empreinteAgent(controleur: ControleurExperience) {
  const agent = controleur.obtenirAgents()[0]!;
  return {
    capital: agent.etatEconomique.capitalLiquide.toString(10),
    revenus: agent.etatEconomique.totalRevenusActivite.toString(10),
    pertes: agent.etatEconomique.totalPertesActivite.toString(10),
    compute: agent.etatEconomique.totalDepensesCompute.toString(10),
    loyers: agent.etatEconomique.totalLoyersPayes.toString(10),
    redevances:
      agent.etatEconomique.totalRedevancesProprietairePayees.toString(10),
    hwm: agent.etatEconomique.highWaterMarkProprietaire.toString(10),
    survie: agent.etatEconomique.etatSurvie,
  };
}

function compterTypesEco(
  controleur: ControleurExperience,
  identifiantAgent: string,
  numeroCycle: number,
): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const e of controleur.registre.listerParExperience(
    controleur.configuration.identifiantExperience,
  )) {
    if (e.identifiantAgent !== identifiantAgent || e.numeroCycle !== numeroCycle) {
      continue;
    }
    const idEco = e.chargeUtile?.identifiantExecutionEconomique;
    const typesEco = new Set([
      "CYCLE_DEMARRE",
      "REVENU_ACTIVITE",
      "PERTE_ACTIVITE",
      "DEPENSE_COMPUTE",
      "DEPENSE_DONNEES",
      "FRAIS_EXECUTION",
      "LOYER_INFRASTRUCTURE_DU",
      "LOYER_INFRASTRUCTURE_PAYE",
      "REDEVANCE_PROPRIETAIRE_DUE",
      "REDEVANCE_PROPRIETAIRE_PAYEE",
      "DETTE_CREEE",
      "ETAT_SURVIE_MODIFIE",
      "AGENT_DORMANT",
      "AGENT_MORT",
      "CYCLE_TERMINE",
    ]);
    if (!typesEco.has(e.type)) {
      continue;
    }
    if (typeof idEco === "string") {
      expect(idEco).toBe(
        fabriquerIdentifiantExecutionEconomique({
          identifiantExperience: controleur.configuration.identifiantExperience,
          identifiantAgent,
          numeroCycle,
        }),
      );
    }
    const cle =
      e.type === "DETTE_CREEE"
        ? `DETTE:${String(e.chargeUtile?.motif ?? "")}`
        : e.type;
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  return comptes;
}

function produireLotEconomiqueComplet(
  controleur: ControleurExperience,
): EntreeEvenementEsp[] {
  const agent = controleur.obtenirAgents()[0]!;
  const activite = simulerActiviteCycle({
    graineSimulation: controleur.configuration.graineSimulation,
    identifiantAgent: agent.identite.identifiant,
    numeroCycle: 1,
  });
  const resultat = executerCycleEconomique({
    identifiantExperience: controleur.configuration.identifiantExperience,
    identifiantAgent: agent.identite.identifiant,
    numeroCycle: 1,
    parametres: controleur.configuration.parametresEconomiques,
    etat: agent.etatEconomique,
    tresorerie: controleur.obtenirTresorerie(),
    activite,
    prefixeIdentifiant: `${agent.identite.identifiant}-`,
    dateEnregistrement: "2020-01-01T00:00:00.000Z",
  });
  return [...resultat.evenements];
}

type PointCrash =
  | "A_avant_CYCLE_DEMARRE"
  | "B_apres_CYCLE_DEMARRE"
  | "C_apres_revenu_perte"
  | "D_apres_DEPENSE_COMPUTE"
  | "E_apres_loyer"
  | "F_apres_redevance"
  | "G_apres_CYCLE_TERMINE"
  | "H_apres_COMMIT";

function indexCoupe(lot: readonly EntreeEvenementEsp[], point: PointCrash): number {
  const indexOf = (type: string) => lot.findIndex((e) => e.type === type);
  switch (point) {
    case "A_avant_CYCLE_DEMARRE":
      return 0;
    case "B_apres_CYCLE_DEMARRE":
      return indexOf("CYCLE_DEMARRE") + 1;
    case "C_apres_revenu_perte": {
      let idx = indexOf("CYCLE_DEMARRE") + 1;
      for (let i = 0; i < lot.length; i += 1) {
        if (lot[i]!.type === "REVENU_ACTIVITE" || lot[i]!.type === "PERTE_ACTIVITE") {
          idx = i + 1;
        }
        if (
          lot[i]!.type === "DEPENSE_COMPUTE" ||
          lot[i]!.type === "DEPENSE_DONNEES" ||
          lot[i]!.type === "FRAIS_EXECUTION" ||
          lot[i]!.type === "LOYER_INFRASTRUCTURE_DU"
        ) {
          break;
        }
      }
      return idx;
    }
    case "D_apres_DEPENSE_COMPUTE": {
      const i = indexOf("DEPENSE_COMPUTE");
      return i >= 0 ? i + 1 : indexOf("FRAIS_EXECUTION") + 1;
    }
    case "E_apres_loyer": {
      const paye = indexOf("LOYER_INFRASTRUCTURE_PAYE");
      if (paye >= 0) return paye + 1;
      const dette = lot.findIndex(
        (e) =>
          e.type === "DETTE_CREEE" &&
          e.chargeUtile?.motif === "loyer_infrastructure",
      );
      if (dette >= 0) return dette + 1;
      return indexOf("LOYER_INFRASTRUCTURE_DU") + 1;
    }
    case "F_apres_redevance": {
      const paye = indexOf("REDEVANCE_PROPRIETAIRE_PAYEE");
      if (paye >= 0) return paye + 1;
      const dette = lot.findIndex(
        (e) =>
          e.type === "DETTE_CREEE" &&
          e.chargeUtile?.motif === "redevance_proprietaire",
      );
      if (dette >= 0) return dette + 1;
      const due = indexOf("REDEVANCE_PROPRIETAIRE_DUE");
      return due >= 0 ? due + 1 : lot.length - 1;
    }
    case "G_apres_CYCLE_TERMINE":
    case "H_apres_COMMIT":
      return lot.length;
    default:
      return 0;
  }
}

async function executerScenarioCrash(point: PointCrash): Promise<void> {
  const repertoire = repertoireTemp();
  const cheminRef = join(repertoire, "ref.sqlite");
  const cheminCrash = join(repertoire, "crash.sqlite");
  const conf = configurationBase();

  const ref = ouvrir(cheminRef, conf);
  await ref.avancerUnCycle();
  const empreinteRef = empreinteAgent(ref);
  const agentRef = ref.obtenirAgents()[0]!.identite.identifiant;
  const comptesRef = compterTypesEco(ref, agentRef, 1);
  ref.fermer();

  const crash = ouvrir(cheminCrash, conf);
  const agentId = crash.obtenirAgents()[0]!.identite.identifiant;
  const lot = produireLotEconomiqueComplet(crash);
  const coupe = indexCoupe(lot, point);

  crash.registre.ajouter(
    creerEntreeCycleExperienceAvance({
      identifiantExperience: conf.identifiantExperience,
      numeroCycle: 1,
      dateEnregistrement: "2020-01-01T00:00:00.000Z",
    }),
  );
  if (coupe > 0) {
    crash.registre.ajouterPlusieurs(lot.slice(0, coupe));
  }
  crash.fermer();

  const reprise = ouvrir(cheminCrash, conf);
  if (point === "G_apres_CYCLE_TERMINE" || point === "H_apres_COMMIT") {
    expect(empreinteAgent(reprise)).toEqual(empreinteRef);
    const avant = compterTypesEco(reprise, agentId, 1);
    await reprise.avancerUnCycle();
    const apres = compterTypesEco(reprise, agentId, 1);
    expect(apres).toEqual(avant);
    expect(reprise.obtenirNumeroCycleCourant()).toBe(2);
  } else {
    await reprise.avancerUnCycle();
    expect(reprise.obtenirNumeroCycleCourant()).toBe(1);
    expect(empreinteAgent(reprise)).toEqual(empreinteRef);
    expect(compterTypesEco(reprise, agentId, 1)).toEqual(comptesRef);
  }
  reprise.fermer();
}

describe("HARDENING — atomicité cycle économique v0.1", () => {
  const points: PointCrash[] = [
    "A_avant_CYCLE_DEMARRE",
    "B_apres_CYCLE_DEMARRE",
    "C_apres_revenu_perte",
    "D_apres_DEPENSE_COMPUTE",
    "E_apres_loyer",
    "F_apres_redevance",
    "G_apres_CYCLE_TERMINE",
    "H_apres_COMMIT",
  ];

  for (const point of points) {
    it(`crash ${point} → reprise ≡ exécution continue`, async () => {
      await executerScenarioCrash(point);
    });
  }

  it("multi-agents : crash A ne contamine pas B", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "multi.sqlite");
    const conf = configurationBase({
      identifiantExperience: "exp-atomicite-multi",
      taillePopulationInitiale: 2,
    });

    const ref = ouvrir(join(repertoire, "multi-ref.sqlite"), conf);
    await ref.avancerUnCycle();
    const empreintesRef = ref.obtenirAgents().map((a) => ({
      id: a.identite.identifiant,
      empreinte: {
        capital: a.etatEconomique.capitalLiquide.toString(10),
        compute: a.etatEconomique.totalDepensesCompute.toString(10),
      },
    }));
    ref.fermer();

    const c = ouvrir(chemin, conf);
    const agents = c.obtenirAgents();
    const agentA = agents[0]!;
    const agentB = agents[1]!;

    const lotA = executerCycleEconomique({
      identifiantExperience: conf.identifiantExperience,
      identifiantAgent: agentA.identite.identifiant,
      numeroCycle: 1,
      parametres: conf.parametresEconomiques,
      etat: agentA.etatEconomique,
      tresorerie: c.obtenirTresorerie(),
      activite: simulerActiviteCycle({
        graineSimulation: conf.graineSimulation,
        identifiantAgent: agentA.identite.identifiant,
        numeroCycle: 1,
      }),
      prefixeIdentifiant: `${agentA.identite.identifiant}-`,
      dateEnregistrement: "2020-01-01T00:00:00.000Z",
    }).evenements;

    const lotB = executerCycleEconomique({
      identifiantExperience: conf.identifiantExperience,
      identifiantAgent: agentB.identite.identifiant,
      numeroCycle: 1,
      parametres: conf.parametresEconomiques,
      etat: agentB.etatEconomique,
      tresorerie: c.obtenirTresorerie(),
      activite: simulerActiviteCycle({
        graineSimulation: conf.graineSimulation,
        identifiantAgent: agentB.identite.identifiant,
        numeroCycle: 1,
      }),
      prefixeIdentifiant: `${agentB.identite.identifiant}-`,
      dateEnregistrement: "2020-01-01T00:00:00.000Z",
    }).evenements;

    c.registre.ajouter(
      creerEntreeCycleExperienceAvance({
        identifiantExperience: conf.identifiantExperience,
        numeroCycle: 1,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    // A : crash après CYCLE_DEMARRE ; B : lot complet commit.
    c.registre.ajouterPlusieurs(
      lotA.slice(0, lotA.findIndex((e) => e.type === "CYCLE_DEMARRE") + 1),
    );
    c.registre.ajouterPlusieurs(lotB);
    c.fermer();

    const reprise = ouvrir(chemin, conf);
    await reprise.avancerUnCycle();
    const apres = new Map(
      reprise.obtenirAgents().map((a) => [
        a.identite.identifiant,
        {
          capital: a.etatEconomique.capitalLiquide.toString(10),
          compute: a.etatEconomique.totalDepensesCompute.toString(10),
        },
      ]),
    );
    for (const e of empreintesRef) {
      expect(apres.get(e.id)).toEqual(e.empreinte);
    }
    expect(compterTypesEco(reprise, agentA.identite.identifiant, 1).get("CYCLE_TERMINE")).toBe(1);
    expect(compterTypesEco(reprise, agentB.identite.identifiant, 1).get("CYCLE_TERMINE")).toBe(1);
    // Pas de doublon CYCLE_DEMARRE sur B
    expect(compterTypesEco(reprise, agentB.identite.identifiant, 1).get("CYCLE_DEMARRE")).toBe(1);
    reprise.fermer();
  });

  it("reconstruction : même état avant/après redémarrage", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "recon.sqlite");
    const c1 = ouvrir(chemin);
    await c1.avancerUnCycle();
    const emp = c1.capturerEmpreinteEconomique();
    c1.fermer();
    const c2 = ouvrir(chemin);
    expect(c2.capturerEmpreinteEconomique()).toEqual(emp);
    c2.fermer();
  });
});
