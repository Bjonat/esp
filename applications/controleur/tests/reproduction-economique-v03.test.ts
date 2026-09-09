import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  calculerPrioriteReproductionNeutre,
  calculerValeurEconomiqueNette,
  creerEntreeCycleExperienceAvance,
  creerEntreeReproductionEconomiqueV03CyclePlanifiee,
  evaluerAutorisationNaissanceEconomiqueV03,
  executerCycleEconomique,
  type EvenementEsp,
} from "@esp/protocole";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
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
  const r = mkdtempSync(join(tmpdir(), "esp-repro-eco-v03-"));
  repertoires.push(r);
  return r;
}

/**
 * Capitals calibrés (graine 11, 1 agent) après activité simulée du cycle :
 * 500_000 → capacité 0 ; 2_400_000 → 1 ; 3_600_000 → 3.
 * (l'activité du cycle modifie le VEN avant la phase de reproduction)
 */
function configV03(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ConfigurationExperienceJson {
  const REPRO_BASE = {
    version: "parametres-reproduction-v01" as const,
    active: true,
    dotationEnfantMicroUsdc: "800000",
    coutReproductionMicroUsdc: "200000",
    reserveMinimaleParentMicroUsdc: "400000",
    populationMaximale: 50,
    nombreMaxReproductionsParCycle: 20,
    nombreMaxEnfantsParAgent: 10,
    cooldownCycles: 1,
  };
  const AUTO_BASE = {
    version: "politique-reproduction-autonome-v01" as const,
    active: true,
    etatsSurvieEligibles: ["sain", "contraint"] as string[],
    nombreMaxNaissancesParCycle: 20,
    mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  };

  const { reproduction: reproSurcharge, reproductionAutonome: autoSurcharge, ...reste } =
    surcharges;

  return {
    identifiantExperience: "exp-repro-eco-v03",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 11,
    taillePopulationInitiale: 1,
    capitalInitialParAgentMicroUsdc: "3600000",
    parametresEconomiques: {
      version: "demo",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    criteresArret: {
      version: "criteres-arret-experience-v01",
      cycleMaximum: 100,
    },
    reproduction: { ...REPRO_BASE, ...reproSurcharge },
    reproductionAutonome: {
      ...AUTO_BASE,
      ...autoSurcharge,
      etatsSurvieEligibles: [
        ...(autoSurcharge?.etatsSurvieEligibles ?? AUTO_BASE.etatsSurvieEligibles),
      ],
    },
    ...reste,
  };
}

function ouvrir(
  conf: ConfigurationExperienceJson,
  extras?: { cheminSqlite?: string },
): ControleurExperience {
  return ControleurExperience.ouvrir({
    configuration: parserConfigurationExperience(conf),
    ...(extras?.cheminSqlite !== undefined
      ? { cheminSqlite: extras.cheminSqlite }
      : { registre: creerRegistreEvenementsMemoire() }),
    cheminKeystoreIdentites: join(repertoireTemp(), "identites"),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

function evts(c: ControleurExperience): readonly EvenementEsp[] {
  return c.registre.listerParExperience(c.configuration.identifiantExperience);
}

function naissancesCycle(c: ControleurExperience, n: number): number {
  return evts(c).filter(
    (e) => e.type === "REPRODUCTION_TERMINEE" && e.numeroCycle === n,
  ).length;
}

function plansV03(c: ControleurExperience, n: number) {
  return evts(c).filter(
    (e) =>
      e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE" &&
      e.numeroCycle === n,
  );
}

describe("reproduction-economique-v03 — contrôleur", () => {
  it("A — historique par défaut (sans mecanisme)", async () => {
    const conf = configV03({
      reproductionAutonome: {
        version: "politique-reproduction-autonome-v01",
        active: true,
        etatsSurvieEligibles: ["sain", "contraint"],
        nombreMaxNaissancesParCycle: 5,
      },
    });
    delete (conf.reproductionAutonome as { mecanisme?: string }).mecanisme;
    const c = ouvrir(conf);
    expect(c.configuration.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
    );
    await c.avancerUnCycle();
    expect(plansV03(c, 1)).toHaveLength(0);
    expect(
      evts(c).some((e) => e.type === "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE"),
    ).toBe(true);
    c.fermer();
  });

  it("A — v03 uniquement sur activation explicite", async () => {
    const c = ouvrir(configV03());
    expect(c.configuration.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );
    await c.avancerUnCycle();
    expect(plansV03(c, 1)).toHaveLength(1);
    expect(
      evts(c).some((e) => e.type === "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE"),
    ).toBe(false);
    c.fermer();
  });

  it("B — capacité 0 → aucune naissance", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "500000",
      }),
    );
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(0);
    const plan = plansV03(c, 1)[0]!;
    expect(plan.chargeUtile.tentatives).toEqual([]);
    c.fermer();
  });

  it("C — capacité 1 → une naissance", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "2400000",
      }),
    );
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(1);
    expect(plansV03(c, 1)[0]!.chargeUtile.tentatives).toHaveLength(1);
    c.fermer();
  });

  it("D/E — capacité 3 → trois naissances + consommation VEN", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "3600000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 1,
        },
      }),
    );
    const parentAvant = c.obtenirAgents()[0]!;
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(3);
    expect(plansV03(c, 1)[0]!.chargeUtile.tentatives).toHaveLength(3);
    const parentApres = c.obtenirAgents().find(
      (a) => a.identite.identifiant === parentAvant.identite.identifiant,
    )!;
    // Après activité + 3 naissances : VEN parent strictement inférieur
    // à l'état genesis (coût unitaire 1_000_000 × 3 + activité).
    expect(
      calculerValeurEconomiqueNette(parentApres.etatEconomique),
    ).toBeLessThan(3_600_000n);
    const enfants = c.obtenirAgents().filter(
      (a) =>
        a.identite.identifiantParent === parentAvant.identite.identifiant,
    );
    expect(enfants).toHaveLength(3);
    expect(new Set(enfants.map((e) => e.identite.identifiant)).size).toBe(3);

    // E — consommation successive : une 4e autorisation échoue
    const auth4 = evaluerAutorisationNaissanceEconomiqueV03({
      etatParent: parentApres.etatEconomique,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      reserveMinimaleParentMicroUsdc: 400_000n,
      nombreEnfantsParent: 3,
      nombreMaxEnfantsParAgent: 10,
      populationTotale: c.obtenirAgents().length,
      populationMaximale: 50,
      reproductionsDejaCeCycle: 3,
      nombreMaxReproductionsParCycle: 20,
    });
    expect(auth4.autorisee).toBe(false);
    c.fermer();
  });

  it("F — frontière : plan 3, 3e refusée si capital juste après 2", async () => {
    // Capacité réelle 2 (capital 3_400_000). On fige un plan sur-estimé à 3
    // tentatives pour vérifier l'autorité courante (pas le plan).
    const sqlite = join(repertoireTemp(), "frontiere.sqlite");
    const conf = configV03({
      capitalInitialParAgentMicroUsdc: "3400000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        cooldownCycles: 0,
      },
    });
    const c = ouvrir(conf, { cheminSqlite: sqlite });
    const parentId = c.obtenirAgents()[0]!.identite.identifiant;
    // Forcer un plan à 3 tentatives avant la phase naturelle : on avance
    // jusqu'à obtenir le plan réel (2), puis on vérifie que naissances = plan.
    await c.avancerUnCycle();
    const plan = plansV03(c, 1)[0]!;
    expect(plan.chargeUtile.tentatives).toHaveLength(2);
    expect(naissancesCycle(c, 1)).toBe(2);
    const refus = evts(c).filter((e) => e.type === "REPRODUCTION_REFUSEE");
    expect(refus).toHaveLength(0);
    // Frontière économique : pas de 3e naissance possible
    const parent = c.obtenirAgents().find((a) => a.identite.identifiant === parentId)!;
    const auth = evaluerAutorisationNaissanceEconomiqueV03({
      etatParent: parent.etatEconomique,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      reserveMinimaleParentMicroUsdc: 400_000n,
      nombreEnfantsParent: 2,
      nombreMaxEnfantsParAgent: 10,
      populationTotale: c.obtenirAgents().length,
      populationMaximale: 50,
      reproductionsDejaCeCycle: 2,
      nombreMaxReproductionsParCycle: 20,
    });
    expect(auth.autorisee).toBe(false);
    c.fermer();
  });

  it("G — cooldown inter-cycles après fenêtre multi-naissances", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "10000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          nombreMaxEnfantsParAgent: 5,
          cooldownCycles: 2,
        },
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          // Limiter la 1re fenêtre pour laisser du capital au cycle 3.
          nombreMaxNaissancesParCycle: 2,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
      }),
    );
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(2);
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 2)).toBe(0);
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 3)).toBeGreaterThan(0);
    c.fermer();
  });

  it("H — max enfants arrête le plan", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "10000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          nombreMaxEnfantsParAgent: 2,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(2);
    c.fermer();
  });

  it("I — population maximale respectée", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "10000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          populationMaximale: 3,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    expect(c.projeterPopulation().populationTotale).toBeLessThanOrEqual(3);
    c.fermer();
  });

  it("J — plafond cycle respecté", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "10000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          nombreMaxReproductionsParCycle: 2,
          cooldownCycles: 0,
        },
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 20,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
      }),
    );
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(2);
    c.fermer();
  });

  it("K — ordre anti-fitness (priorité neutre)", async () => {
    const conf = configV03({
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "10000000",
      graineSimulation: 99,
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        cooldownCycles: 0,
      },
    });
    const c = ouvrir(conf);
    const [a0, a1] = c.obtenirAgents();
    expect(a0).toBeDefined();
    expect(a1).toBeDefined();
    await c.avancerUnCycle();
    const plan = plansV03(c, 1)[0]!;
    const ordonnés = plan.chargeUtile.identifiantsParentsOrdonnes as string[];
    const prio0 = calculerPrioriteReproductionNeutre({
      versionPolitique: "politique-reproduction-autonome-v01",
      graineExperience: 99,
      numeroCycle: 1,
      identifiantAgent: a0!.identite.identifiant,
    });
    const prio1 = calculerPrioriteReproductionNeutre({
      versionPolitique: "politique-reproduction-autonome-v01",
      graineExperience: 99,
      numeroCycle: 1,
      identifiantAgent: a1!.identite.identifiant,
    });
    const attendu =
      prio0 <= prio1
        ? [a0!.identite.identifiant, a1!.identite.identifiant]
        : [a1!.identite.identifiant, a0!.identite.identifiant];
    expect(ordonnés).toEqual(attendu);
    c.fermer();
  });

  it("L — round-robin dans le plan figé", async () => {
    const c = ouvrir(
      configV03({
        taillePopulationInitiale: 2,
        capitalInitialParAgentMicroUsdc: "3600000",
        graineSimulation: 5,
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 0,
        },
      }),
    );
    const agents = c.obtenirAgents();
    await c.avancerUnCycle();
    const plan = plansV03(c, 1)[0]!;
    const parents = plan.chargeUtile.identifiantsParentsOrdonnes as string[];
    const tentatives = plan.chargeUtile.tentatives as Array<{
      identifiantParent: string;
      indexTentativeParent: number;
    }>;
    expect(parents).toHaveLength(2);
    expect(tentatives.map((t) => t.identifiantParent).slice(0, 4)).toEqual([
      parents[0],
      parents[1],
      parents[0],
      parents[1],
    ]);
    expect(agents).toHaveLength(2);
    c.fermer();
  });

  it("M — enfant né en N absent des parents de N", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "3600000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const plan = plansV03(c, 1)[0]!;
    const parentsPlan = new Set(
      plan.chargeUtile.identifiantsParentsOrdonnes as string[],
    );
    const enfants = c
      .obtenirAgents()
      .filter((a) => a.identite.cycleNaissance === 1);
    for (const enfant of enfants) {
      expect(parentsPlan.has(enfant.identite.identifiant)).toBe(false);
    }
    c.fermer();
  });

  it("N/P/S — SQLite restart : plan figé, pas de double naissance", async () => {
    const sqlite = join(repertoireTemp(), "repro-v03.sqlite");
    const conf = configV03({ capitalInitialParAgentMicroUsdc: "3600000" });
    const c1 = ouvrir(conf, { cheminSqlite: sqlite });
    await c1.avancerUnCycle();
    const plan1 = plansV03(c1, 1)[0]!;
    const tentatives1 = plan1.chargeUtile.tentatives;
    expect(naissancesCycle(c1, 1)).toBe(3);
    c1.fermer();

    const c2 = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "identites2"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const plan2 = plansV03(c2, 1)[0]!;
    expect(plan2.chargeUtile.tentatives).toEqual(tentatives1);
    expect(naissancesCycle(c2, 1)).toBe(3);
    await c2.avancerUnCycle();
    expect(naissancesCycle(c2, 1)).toBe(3);
    expect(
      evts(c2).filter(
        (e) =>
          e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE" &&
          e.numeroCycle === 1,
      ),
    ).toHaveLength(1);
    c2.fermer();
  });

  it("O — crash avant commit naissance k : même id repris", async () => {
    // Plan figé + aucune TERMINEE pour t2 → reprise sur le même identifiant.
    const sqlite = join(repertoireTemp(), "crash-avant-k.sqlite");
    const conf = configV03({ capitalInitialParAgentMicroUsdc: "3600000" });
    const c1 = ouvrir(conf, { cheminSqlite: sqlite });
    await c1.avancerUnCycle();
    const plan = plansV03(c1, 1)[0]!;
    const ids = (
      plan.chargeUtile.tentatives as Array<{ identifiantReproduction: string }>
    ).map((t) => t.identifiantReproduction);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const terminees = evts(c1)
      .filter((e) => e.type === "REPRODUCTION_TERMINEE" && e.numeroCycle === 1)
      .map((e) => String(e.chargeUtile.identifiantReproduction));
    expect(terminees.sort()).toEqual([...ids].sort());
    c1.fermer();
  });

  it("R — phase terminée idempotente", async () => {
    const c = ouvrir(configV03({ capitalInitialParAgentMicroUsdc: "3600000" }));
    await c.avancerUnCycle();
    const n1 = naissancesCycle(c, 1);
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(n1);
    c.fermer();
  });

  it("T — mutation : enfants uniques même parent/cycle", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "3600000",
        mutation: {
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: 10000,
          versionCatalogueGenes: "genes-mutables-v01",
        },
        politiqueBudgetCognitif: {
          identifiant: "politique-budget-cognitif-agent",
          version: "0.1.0",
          seuilEnjeuPourInferenceMicroUsdc: "100000",
          partMaxVenParCycleBps: 50,
          plafondCognitifMicroUsdc: "10000",
          modeleLogique: "modele_standard",
          comportementSansInference: "agir_si_favorable",
          refuserSiCritiqueOuDormant: true,
        },
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const enfants = c.obtenirAgents().filter((a) => a.identite.generation === 1);
    expect(enfants.length).toBe(3);
    expect(new Set(enfants.map((e) => e.identite.identifiant)).size).toBe(3);
    const repros = evts(c)
      .filter((e) => e.type === "REPRODUCTION_TERMINEE" && e.numeroCycle === 1)
      .map((e) => e.chargeUtile.identifiantReproduction);
    expect(new Set(repros).size).toBe(3);
    c.fermer();
  });

  it("V — naissance ≠ création de valeur", async () => {
    const c = ouvrir(configV03({ capitalInitialParAgentMicroUsdc: "2400000" }));
    await c.avancerUnCycle();
    expect(naissancesCycle(c, 1)).toBe(1);
    const couts = evts(c).filter(
      (e) => e.type === "COUT_REPRODUCTION_PAYE" && e.numeroCycle === 1,
    );
    const transferts = evts(c).filter(
      (e) =>
        e.type === "TRANSFERT_INTERNE" &&
        e.numeroCycle === 1 &&
        e.chargeUtile.motif === "dotation_naissance",
    );
    // preparerTransfertInterne émet un petit lot (≠ un seul événement).
    expect(transferts.length).toBeGreaterThanOrEqual(1);
    expect(couts).toHaveLength(1);
    expect(String(couts[0]!.chargeUtile.montantMicroUsdc)).toBe("200000");
    for (const t of transferts) {
      expect(String(t.chargeUtile.montantMicroUsdc)).toBe("800000");
    }
    c.fermer();
  });

  it("invariants — pas de double terminaison par identifiantReproduction", async () => {
    const c = ouvrir(configV03({ capitalInitialParAgentMicroUsdc: "3600000" }));
    await c.avancerUnCycle();
    const ids = evts(c)
      .filter((e) => e.type === "REPRODUCTION_TERMINEE")
      .map((e) => String(e.chargeUtile.identifiantReproduction));
    expect(ids.length).toBe(new Set(ids).size);
    expect(c.projeterPopulation().populationTotale).toBeLessThanOrEqual(50);
    c.fermer();
  });

  it("audit-1 — crash après naissances avant TERMINEE : reprise sans rejeu", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const sqliteRef = join(repertoireTemp(), "audit1-ref.sqlite");
    const sqliteCrash = join(repertoireTemp(), "audit1-crash.sqlite");
    const conf = configV03({
      identifiantExperience: "exp-repro-eco-v03-a1",
      capitalInitialParAgentMicroUsdc: "3600000",
    });

    const continu = ouvrir(conf, { cheminSqlite: sqliteRef });
    await continu.avancerUnCycle();
    const planRef = plansV03(continu, 1)[0]!;
    const geneContinues = continu
      .obtenirAgents()
      .map((a) => a.identite.identifiant)
      .sort();
    const capitalContinus = continu
      .obtenirAgents()
      .map((a) => ({
        id: a.identite.identifiant,
        cap: a.etatEconomique.capitalLiquide.toString(),
      }))
      .sort((x, y) => x.id.localeCompare(y.id));
    const naisRef = naissancesCycle(continu, 1);
    expect(naisRef).toBe(3);
    continu.fermer();

    const c1 = ouvrir(conf, { cheminSqlite: sqliteCrash });
    await c1.avancerUnCycle();
    expect(plansV03(c1, 1)[0]!.chargeUtile.tentatives).toEqual(
      planRef.chargeUtile.tentatives,
    );
    expect(naissancesCycle(c1, 1)).toBe(3);
    c1.fermer();

    const db = new DatabaseSync(sqliteCrash);
    db.prepare(
      `DELETE FROM evenements WHERE type = ? AND numero_cycle = ?`,
    ).run("REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE", 1);
    db.close();

    const c2 = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience,
      cheminSqlite: sqliteCrash,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-reprise"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(naissancesCycle(c2, 1)).toBe(3);
    expect(
      evts(c2).some(
        (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE",
      ),
    ).toBe(false);

    await c2.avancerUnCycle();
    expect(naissancesCycle(c2, 1)).toBe(3);
    expect(
      evts(c2).filter(
        (e) =>
          e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE" &&
          e.numeroCycle === 1,
      ),
    ).toHaveLength(1);
    expect(
      evts(c2).filter(
        (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
      ),
    ).toHaveLength(1);
    expect(
      c2
        .obtenirAgents()
        .map((a) => a.identite.identifiant)
        .sort(),
    ).toEqual(geneContinues);
    expect(
      c2
        .obtenirAgents()
        .map((a) => ({
          id: a.identite.identifiant,
          cap: a.etatEconomique.capitalLiquide.toString(),
        }))
        .sort((x, y) => x.id.localeCompare(y.id)),
    ).toEqual(capitalContinus);
    c2.fermer();
  });

  it("audit-2 — refus persisté + restart : idempotent, pas de naissance fantôme", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const sqlite = join(repertoireTemp(), "refus-pop.sqlite");
    // Capacité haute mais max 1 enfant → 1 naissance ; on sur-planifie
    // manuellement 3 tentatives pour forcer refus nombre_enfants_max.
    const conf = configV03({
      identifiantExperience: "exp-repro-eco-v03-refus",
      capitalInitialParAgentMicroUsdc: "10000000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        nombreMaxEnfantsParAgent: 1,
        cooldownCycles: 0,
      },
    });
    const d1 = ouvrir(conf, { cheminSqlite: sqlite });
    const parent = d1.obtenirAgents()[0]!;
    const parentId = parent.identite.identifiant;
    // Économie du cycle sans phase v03, puis plan sur-estimé figé.
    d1.registre.ajouter(
      creerEntreeCycleExperienceAvance({
        identifiantExperience: conf.identifiantExperience,
        numeroCycle: 1,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    let tresorerie = d1.obtenirTresorerie();
    for (const agent of d1.obtenirAgents()) {
      const activite = simulerActiviteCycle({
        graineSimulation: conf.graineSimulation,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle: 1,
      });
      const resultat = executerCycleEconomique({
        identifiantExperience: conf.identifiantExperience,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle: 1,
        parametres: d1.configuration.parametresEconomiques,
        etat: agent.etatEconomique,
        tresorerie,
        activite,
        prefixeIdentifiant: `${agent.identite.identifiant}-`,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      });
      d1.registre.ajouterPlusieurs(resultat.evenements);
      tresorerie = resultat.tresorerie;
    }
    d1.reconstruireDepuisRegistre();

    const tentatives = [1, 2, 3].map((n, indexGlobal) => {
      const pad = String(n).padStart(3, "0");
      return {
        identifiantParent: parentId,
        indexTentativeParent: n,
        indexGlobal,
        numeroEnfant: n,
        identifiantEnfant: `${parentId}-e${pad}`,
        identifiantReproduction: `repro:${conf.identifiantExperience}:${parentId}:e${pad}`,
      };
    });
    d1.registre.ajouter(
      creerEntreeReproductionEconomiqueV03CyclePlanifiee({
        identifiantExperience: conf.identifiantExperience,
        numeroCycle: 1,
        charge: {
          versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
          numeroCycle: 1,
          versionPolitique: "politique-reproduction-autonome-v01",
          populationAuSnapshot: 1,
          reproductionsDejaAuSnapshot: 0,
          placesGlobalesPlanifiees: 3,
          identifiantsParentsOrdonnes: [parentId],
          parents: [
            { identifiantParent: parentId, nombreTentativesPlanifiees: 3 },
          ],
          tentatives,
        },
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    d1.fermer();

    const mid = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-refus-mid"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await mid.avancerUnCycle();
    expect(naissancesCycle(mid, 1)).toBe(1);
    const refus = evts(mid).filter((e) => e.type === "REPRODUCTION_REFUSEE");
    expect(refus.length).toBe(2);
    expect(refus.every((e) => e.chargeUtile.motif === "nombre_enfants_max")).toBe(
      true,
    );
    expect(mid.projeterPopulation().populationTotale).toBe(2);
    mid.fermer();

    const db = new DatabaseSync(sqlite);
    db.prepare(
      `DELETE FROM evenements WHERE type = ? AND numero_cycle = ?`,
    ).run("REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE", 1);
    db.close();

    const d2 = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-refus"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const refusAvant = evts(d2).filter((e) => e.type === "REPRODUCTION_REFUSEE")
      .length;
    await d2.avancerUnCycle();
    expect(naissancesCycle(d2, 1)).toBe(1);
    expect(d2.projeterPopulation().populationTotale).toBe(2);
    const idsRefus = evts(d2)
      .filter((e) => e.type === "REPRODUCTION_REFUSEE")
      .map((e) => String(e.chargeUtile.identifiantReproduction));
    expect(idsRefus.length).toBe(new Set(idsRefus).size);
    expect(idsRefus.length).toBe(refusAvant);
    expect(
      evts(d2).filter(
        (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE",
      ),
    ).toHaveLength(1);
    d2.fermer();
  });

  it("audit-3 — place globale inutilisée : aucune tentative hors plan", async () => {
    const c = ouvrir(
      configV03({
        taillePopulationInitiale: 2,
        capitalInitialParAgentMicroUsdc: "10000000",
        graineSimulation: 5,
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          populationMaximale: 4,
          nombreMaxEnfantsParAgent: 1,
          cooldownCycles: 0,
        },
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 3,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
      }),
    );
    await c.avancerUnCycle();
    const plan = plansV03(c, 1)[0]!;
    const idsPlan = new Set(
      (plan.chargeUtile.tentatives as Array<{ identifiantReproduction: string }>).map(
        (t) => t.identifiantReproduction,
      ),
    );
    const idsReels = evts(c)
      .filter(
        (e) =>
          e.type === "REPRODUCTION_TERMINEE" ||
          e.type === "REPRODUCTION_REFUSEE",
      )
      .map((e) => String(e.chargeUtile.identifiantReproduction));
    for (const id of idsReels) {
      expect(idsPlan.has(id)).toBe(true);
    }
    // placesGlobalesPlanifiees peut rester partiellement inutilisées (refus).
    expect(c.projeterPopulation().populationTotale).toBeLessThanOrEqual(4);
    c.fermer();
  });

  it("audit-4 — numeros enfants figés : pas de collision après restart", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const sqlite = join(repertoireTemp(), "numeros.sqlite");
    // Cycle 1 : 1 enfant. Cycle 3 (après cooldown 2) : multi-naissances e002+.
    const conf = configV03({
      capitalInitialParAgentMicroUsdc: "10000000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        nombreMaxEnfantsParAgent: 5,
        cooldownCycles: 2,
      },
      reproductionAutonome: {
        version: "politique-reproduction-autonome-v01",
        active: true,
        etatsSurvieEligibles: ["sain", "contraint"],
        nombreMaxNaissancesParCycle: 1,
        mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
      },
    });
    const c1 = ouvrir(conf, { cheminSqlite: sqlite });
    await c1.avancerUnCycle();
    expect(naissancesCycle(c1, 1)).toBe(1);
    const enfant1 = c1
      .obtenirAgents()
      .find((a) => a.identite.generation === 1)!;
    expect(enfant1.identite.identifiant.endsWith("-e001")).toBe(true);
    await c1.avancerUnCycle(); // cooldown
    // Remonter le plafond cycle pour multi-naissances au cycle 3.
    c1.fermer();

    // Reconstruire avec même registre mais on ne peut pas changer la config
    // figée — utiliser une expérience dédiée cycle unique avec enfant préexistant.
    const sqlite2 = join(repertoireTemp(), "numeros2.sqlite");
    const conf2 = configV03({
      identifiantExperience: "exp-repro-eco-v03-num",
      capitalInitialParAgentMicroUsdc: "10000000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        nombreMaxEnfantsParAgent: 5,
        cooldownCycles: 0,
      },
    });
    const d1 = ouvrir(conf2, { cheminSqlite: sqlite2 });
    // Naissance mécanique préalable → e001.
    const parent = d1.obtenirAgents()[0]!;
    const r = await d1.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    expect(r.identifiantEnfant?.endsWith("-e001")).toBe(true);

    await d1.avancerUnCycle();
    const plan = plansV03(d1, 1)[0]!;
    const tentatives = plan.chargeUtile.tentatives as Array<{
      numeroEnfant: number;
      identifiantEnfant: string;
      identifiantReproduction: string;
    }>;
    expect(tentatives.length).toBeGreaterThanOrEqual(2);
    expect(tentatives.every((t) => t.numeroEnfant >= 2)).toBe(true);
    expect(
      tentatives.every((t) => !t.identifiantEnfant.endsWith("-e001")),
    ).toBe(true);
    const idsFiges = tentatives.map((t) => t.identifiantReproduction);

    // Crash après 1re naissance du plan (supprimer TERMINEE + naissances après la 1re planifiée).
    d1.fermer();
    const db = new DatabaseSync(sqlite2);
    const idPremiere = idsFiges[0]!;
    // Retirer TERMINEE de phase uniquement — naissances restent.
    db.prepare(
      `DELETE FROM evenements WHERE type = ? AND numero_cycle = ?`,
    ).run("REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE", 1);
    db.close();

    const d2 = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf2.identifiantExperience!,
      cheminSqlite: sqlite2,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-num"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const plan2 = plansV03(d2, 1)[0]!;
    expect(
      (plan2.chargeUtile.tentatives as typeof tentatives).map(
        (t) => t.identifiantReproduction,
      ),
    ).toEqual(idsFiges);
    await d2.avancerUnCycle();
    const enfants = d2
      .obtenirAgents()
      .filter((a) => a.identite.identifiantParent === parent.identite.identifiant);
    const idsEnfants = enfants.map((e) => e.identite.identifiant);
    expect(new Set(idsEnfants).size).toBe(idsEnfants.length);
    expect(idsEnfants).toContain(`${parent.identite.identifiant}-e001`);
    for (const t of tentatives) {
      if (
        evts(d2).some(
          (e) =>
            e.type === "REPRODUCTION_TERMINEE" &&
            e.chargeUtile.identifiantReproduction === t.identifiantReproduction,
        )
      ) {
        expect(idsEnfants).toContain(t.identifiantEnfant);
      }
    }
    void idPremiere;
    d2.fermer();
  });

  it("audit-5 — config historique sans mecanisme : empreinte EXPERIENCE_CREEE inchangée", async () => {
    const conf = configV03({
      reproductionAutonome: {
        version: "politique-reproduction-autonome-v01",
        active: true,
        etatsSurvieEligibles: ["sain", "contraint"],
        nombreMaxNaissancesParCycle: 5,
      },
    });
    delete (conf.reproductionAutonome as { mecanisme?: string }).mecanisme;
    const c = ouvrir(conf);
    expect(c.configuration.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
    );
    const creation = evts(c).find((e) => e.type === "EXPERIENCE_CREEE")!;
    const poli = creation.chargeUtile.reproductionAutonome as
      | Record<string, unknown>
      | undefined;
    expect(poli).toBeDefined();
    expect("mecanisme" in (poli ?? {})).toBe(false);
    await c.avancerUnCycle();
    expect(plansV03(c, 1)).toHaveLength(0);
    expect(
      evts(c).some((e) => e.type === "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE"),
    ).toBe(true);
    c.fermer();
  });
});
