import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  assertAucuneCleAntiFitnessV03,
  calculerValeurEconomiqueNette,
  creerEntreeCycleExperienceAvance,
  creerEntreeReproductionEconomiqueV03CyclePlanifiee,
  empreinteTrajectoireCausaleSansObservabiliteV03,
  executerCycleEconomique,
  projeterObservabiliteReproductionEconomiqueV03,
  type EvenementEsp,
  type ObservabiliteTentativeReproductionEconomiqueV03,
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
  const r = mkdtempSync(join(tmpdir(), "esp-obs-v03-"));
  repertoires.push(r);
  return r;
}

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
  const {
    reproduction: reproSurcharge,
    reproductionAutonome: autoSurcharge,
    ...reste
  } = surcharges;
  return {
    identifiantExperience: "exp-obs-eco-v03",
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
        ...(autoSurcharge?.etatsSurvieEligibles ??
          AUTO_BASE.etatsSurvieEligibles),
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

function obsTentatives(
  c: ControleurExperience,
  numeroCycle: number,
): ObservabiliteTentativeReproductionEconomiqueV03[] {
  const vus = new Map<string, ObservabiliteTentativeReproductionEconomiqueV03>();
  for (const e of evts(c)) {
    if (e.numeroCycle !== numeroCycle) {
      continue;
    }
    const obs = e.chargeUtile.observabiliteTentativeV03;
    if (
      obs !== undefined &&
      typeof obs === "object" &&
      !Array.isArray(obs) &&
      typeof (obs as ObservabiliteTentativeReproductionEconomiqueV03)
        .identifiantReproduction === "string"
    ) {
      const o = obs as ObservabiliteTentativeReproductionEconomiqueV03;
      vus.set(o.identifiantReproduction, o);
    }
  }
  return [...vus.values()].sort((a, b) => a.indexGlobal - b.indexGlobal);
}

describe("observabilité reproduction économique v03-C — contrôleur", () => {
  it("A — capacité brute observable malgré max enfants", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "5000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          nombreMaxEnfantsParAgent: 0,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg.fenetresOuvertes).toBe(0);
    expect(agg.fermeturesNombreEnfantsMax).toBe(1);
    expect(agg.capaciteEconomiqueTheoriqueTotale).toBeGreaterThan(0n);
    expect(agg.parents[0]!.fenetre).toEqual({
      ouverte: false,
      motif: "nombre_enfants_max",
    });
    c.fermer();
  });

  it("B — capacité brute > tentatives (plafond cycle)", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "10000000",
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 1,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg.tentativesPlanifiees).toBe(1);
    expect(agg.capaciteEconomiqueTheoriqueTotale).toBeGreaterThan(1n);
    expect(agg.capaciteBloqueeParPlafondsGlobaux).toBeGreaterThan(0n);
    c.fermer();
  });

  it("C — VEN/capital avant chaque tentative décroissants", async () => {
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
    const obs = obsTentatives(c, 1).filter(
      (o) => o.resultatFinal === "naissance_realisee",
    );
    expect(obs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < obs.length; i += 1) {
      expect(BigInt(obs[i]!.venAvantMicroUsdc)).toBeLessThan(
        BigInt(obs[i - 1]!.venAvantMicroUsdc),
      );
      expect(BigInt(obs[i]!.capitalLiquideAvantMicroUsdc)).toBeLessThan(
        BigInt(obs[i - 1]!.capitalLiquideAvantMicroUsdc),
      );
    }
    c.fermer();
  });

  it("D — refus reserve_minimale observé (plan sur-estimé)", async () => {
    const sqlite = join(repertoireTemp(), "reserve-obs.sqlite");
    const conf = configV03({
      identifiantExperience: "exp-obs-reserve",
      capitalInitialParAgentMicroUsdc: "2400000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        cooldownCycles: 0,
        reserveMinimaleParentMicroUsdc: "400000",
      },
    });
    const d1 = ouvrir(conf, { cheminSqlite: sqlite });
    const parentId = d1.obtenirAgents()[0]!.identite.identifiant;
    d1.registre.ajouter(
      creerEntreeCycleExperienceAvance({
        identifiantExperience: conf.identifiantExperience!,
        numeroCycle: 1,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    let tresorerie = d1.obtenirTresorerie();
    for (const agent of [...d1.obtenirAgents()]) {
      const activite = simulerActiviteCycle({
        graineSimulation: conf.graineSimulation!,
        numeroCycle: 1,
        identifiantAgent: agent.identite.identifiant,
      });
      const resultat = executerCycleEconomique({
        identifiantExperience: conf.identifiantExperience!,
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
    const tentatives = [1, 2].map((n, indexGlobal) => {
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
        identifiantExperience: conf.identifiantExperience!,
        numeroCycle: 1,
        charge: {
          versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
          numeroCycle: 1,
          versionPolitique: "politique-reproduction-autonome-v01",
          populationAuSnapshot: 1,
          reproductionsDejaAuSnapshot: 0,
          placesGlobalesPlanifiees: 2,
          identifiantsParentsOrdonnes: [parentId],
          parents: [
            { identifiantParent: parentId, nombreTentativesPlanifiees: 2 },
          ],
          tentatives,
        },
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    d1.fermer();

    const mid = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience!,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-reserve"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await mid.avancerUnCycle();
    const refus = obsTentatives(mid, 1).filter(
      (o) =>
        !o.autorisation.autorisee &&
        (o.autorisation.motif === "reserve_minimale" ||
          o.autorisation.motif === "capital_insuffisant"),
    );
    expect(refus.length).toBeGreaterThan(0);
    expect(refus.some((o) => o.modeEvaluation === "evaluee")).toBe(true);
    mid.fermer();
  });

  it("E — refus capital_insuffisant observé (plan sur-estimé)", async () => {
    const sqlite = join(repertoireTemp(), "capital-obs.sqlite");
    const conf = configV03({
      identifiantExperience: "exp-obs-capital",
      capitalInitialParAgentMicroUsdc: "1400000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        cooldownCycles: 0,
        reserveMinimaleParentMicroUsdc: "0",
      },
    });
    const d1 = ouvrir(conf, { cheminSqlite: sqlite });
    const parentId = d1.obtenirAgents()[0]!.identite.identifiant;
    d1.registre.ajouter(
      creerEntreeCycleExperienceAvance({
        identifiantExperience: conf.identifiantExperience!,
        numeroCycle: 1,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    let tresorerie = d1.obtenirTresorerie();
    for (const agent of [...d1.obtenirAgents()]) {
      const activite = simulerActiviteCycle({
        graineSimulation: conf.graineSimulation!,
        numeroCycle: 1,
        identifiantAgent: agent.identite.identifiant,
      });
      const resultat = executerCycleEconomique({
        identifiantExperience: conf.identifiantExperience!,
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
    const tentatives = [1, 2].map((n, indexGlobal) => {
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
        identifiantExperience: conf.identifiantExperience!,
        numeroCycle: 1,
        charge: {
          versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
          numeroCycle: 1,
          versionPolitique: "politique-reproduction-autonome-v01",
          populationAuSnapshot: 1,
          reproductionsDejaAuSnapshot: 0,
          placesGlobalesPlanifiees: 2,
          identifiantsParentsOrdonnes: [parentId],
          parents: [
            { identifiantParent: parentId, nombreTentativesPlanifiees: 2 },
          ],
          tentatives,
        },
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    d1.fermer();

    const mid = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience!,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-capital"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await mid.avancerUnCycle();
    const refus = obsTentatives(mid, 1).filter(
      (o) =>
        !o.autorisation.autorisee &&
        o.autorisation.motif === "capital_insuffisant",
    );
    expect(refus.length).toBeGreaterThan(0);
    expect(refus[0]!.modeEvaluation).toBe("evaluee");
    mid.fermer();
  });

  it("F — refus population_maximale", async () => {
    const c = ouvrir(
      configV03({
        taillePopulationInitiale: 2,
        capitalInitialParAgentMicroUsdc: "3600000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          populationMaximale: 2,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(
      agg.fenetresFermeesParMotif.population_maximale ??
        agg.refusParMotif.population_maximale ??
        0,
    ).toBeGreaterThan(0);
    expect(agg.naissancesRealisees).toBe(0);
    c.fermer();
  });

  it("G — refus / fermeture reproductions_cycle_max", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "3600000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          nombreMaxReproductionsParCycle: 0,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg.fermeturesReproductionsCycleMax).toBeGreaterThan(0);
    expect(agg.naissancesRealisees).toBe(0);
    expect(agg.capaciteEconomiqueTheoriqueTotale).toBeGreaterThan(0n);
    c.fermer();
  });

  it("H — propagation monotone distinguée d'une évaluation", async () => {
    const sqlite = join(repertoireTemp(), "prop-obs.sqlite");
    const conf = configV03({
      identifiantExperience: "exp-obs-prop",
      capitalInitialParAgentMicroUsdc: "10000000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        nombreMaxEnfantsParAgent: 1,
        cooldownCycles: 0,
      },
    });
    const d1 = ouvrir(conf, { cheminSqlite: sqlite });
    const parentId = d1.obtenirAgents()[0]!.identite.identifiant;
    d1.registre.ajouter(
      creerEntreeCycleExperienceAvance({
        identifiantExperience: conf.identifiantExperience!,
        numeroCycle: 1,
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    let tresorerie = d1.obtenirTresorerie();
    for (const agent of [...d1.obtenirAgents()]) {
      const activite = simulerActiviteCycle({
        graineSimulation: conf.graineSimulation!,
        numeroCycle: 1,
        identifiantAgent: agent.identite.identifiant,
      });
      const resultat = executerCycleEconomique({
        identifiantExperience: conf.identifiantExperience!,
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
        identifiantExperience: conf.identifiantExperience!,
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
      identifiantExperience: conf.identifiantExperience!,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id-prop"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    await mid.avancerUnCycle();
    const evalues = obsTentatives(mid, 1).filter(
      (o) =>
        o.modeEvaluation === "evaluee" &&
        !o.autorisation.autorisee &&
        o.autorisation.motif === "nombre_enfants_max",
    );
    const propages = obsTentatives(mid, 1).filter(
      (o) =>
        o.modeEvaluation === "propagation_monotone" &&
        !o.autorisation.autorisee &&
        o.autorisation.motif === "nombre_enfants_max",
    );
    expect(evalues.length).toBe(1);
    expect(propages.length).toBe(1);
    const agg = mid.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg.refusEvaluesParMotif.nombre_enfants_max).toBe(1);
    expect(agg.refusPropagationParMotif.nombre_enfants_max).toBe(1);
    mid.fermer();
  });

  it("I/J — places non utilisées + agrégat cycle", async () => {
    const c = ouvrir(
      configV03({
        capitalInitialParAgentMicroUsdc: "3600000",
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 10,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          cooldownCycles: 0,
        },
      }),
    );
    await c.avancerUnCycle();
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg.placesPlanifieesNonUtilisees).toBe(
      agg.placesGlobalesPlanifiees - agg.naissancesRealisees,
    );
    expect(agg.placesGlobalesNonUtilisees).toBe(agg.placesPlanifieesNonUtilisees);
    expect(agg.placesGlobalesNonUtilisees).toBe(
      agg.placesNonDemandeesParLePlan + agg.tentativesPlanifieesNonRealisees,
    );
    expect(agg.tentativesPlanifiees).toBe(agg.naissancesRealisees);
    expect(agg.version).toBe("observabilite-reproduction-economique-v03");
    expect(() => assertAucuneCleAntiFitnessV03(agg)).not.toThrow();
    c.fermer();
  });

  it("K/L — projection identique après SQLite restart + idempotence", async () => {
    const sqlite = join(repertoireTemp(), "obs-restart.sqlite");
    const conf = configV03({
      capitalInitialParAgentMicroUsdc: "3600000",
      reproduction: {
        version: "parametres-reproduction-v01",
        active: true,
        cooldownCycles: 0,
      },
    });
    const c1 = ouvrir(conf, { cheminSqlite: sqlite });
    await c1.avancerUnCycle();
    const agg1 = c1.projeterObservabiliteReproductionEconomiqueV03(1)!;
    const empreinte1 = empreinteTrajectoireCausaleSansObservabiliteV03(evts(c1));
    const nObs1 = obsTentatives(c1, 1).length;
    c1.fermer();

    const c2 = ControleurExperience.ouvrirDepuisRegistre({
      identifiantExperience: conf.identifiantExperience,
      cheminSqlite: sqlite,
      cheminKeystoreIdentites: join(repertoireTemp(), "id2"),
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const agg2 = c2.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(agg2).toEqual(agg1);
    expect(empreinteTrajectoireCausaleSansObservabiliteV03(evts(c2))).toBe(
      empreinte1,
    );
    await c2.avancerUnCycle();
    expect(obsTentatives(c2, 1)).toHaveLength(nObs1);
    expect(
      evts(c2).filter(
        (e) =>
          e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE" &&
          e.numeroCycle === 1,
      ),
    ).toHaveLength(1);
    c2.fermer();
  });

  it("M/N/O/P — hors reproduction exclut dotation/coût, inclut flux, plage", async () => {
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
    const parent = c.obtenirAgents().find((a) => a.identite.generation === 0)!;
    const hors = c.calculerResultatEconomiqueHorsReproductionV03(
      parent.identite.identifiant,
      { cycleDebut: 1, cycleFin: 1 },
    );
    const revenus = evts(c)
      .filter(
        (e) =>
          e.type === "REVENU_ACTIVITE" &&
          e.identifiantAgent === parent.identite.identifiant &&
          e.numeroCycle === 1,
      )
      .reduce((s, e) => s + BigInt(String(e.chargeUtile.montantMicroUsdc)), 0n);
    const pertes = evts(c)
      .filter(
        (e) =>
          e.type === "PERTE_ACTIVITE" &&
          e.identifiantAgent === parent.identite.identifiant &&
          e.numeroCycle === 1,
      )
      .reduce((s, e) => s + BigInt(String(e.chargeUtile.montantMicroUsdc)), 0n);
    const depenses = (type: string) =>
      evts(c)
        .filter(
          (e) =>
            e.type === type &&
            e.identifiantAgent === parent.identite.identifiant &&
            e.numeroCycle === 1,
        )
        .reduce(
          (s, e) => s + BigInt(String(e.chargeUtile.montantMicroUsdc)),
          0n,
        );
    const attendu =
      revenus -
      pertes -
      depenses("DEPENSE_COMPUTE") -
      depenses("DEPENSE_DONNEES") -
      depenses("FRAIS_EXECUTION") -
      depenses("LOYER_INFRASTRUCTURE_DU") -
      depenses("REDEVANCE_PROPRIETAIRE_DUE");
    expect(hors).toBe(attendu);
    const couts = evts(c).filter(
      (e) =>
        e.type === "COUT_REPRODUCTION_PAYE" &&
        e.identifiantAgent === parent.identite.identifiant,
    );
    expect(couts.length).toBeGreaterThan(0);
    // Hors fenêtre cycle 0 uniquement (capitalisation) → 0 flux activité.
    expect(
      c.calculerResultatEconomiqueHorsReproductionV03(
        parent.identite.identifiant,
        { cycleDebut: 0, cycleFin: 0 },
      ),
    ).toBe(0n);
    c.fermer();
  });

  it("Q/R/S — round-robin, naissances, déterminisme causal (même seed)", async () => {
    const conf = configV03({
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "3600000",
      graineSimulation: 5,
      mutation: {
        version: "parametres-mutation-v01",
        active: true,
        tauxMutationParGeneBps: 0,
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
    });

    const executer = async () => {
      const c = ouvrir(conf);
      await c.avancerUnCycle();
      const plan = evts(c).find(
        (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
      )!;
      const parents = plan.chargeUtile.identifiantsParentsOrdonnes as string[];
      const tentatives = plan.chargeUtile.tentatives as Array<{
        identifiantParent: string;
        identifiantReproduction: string;
        identifiantEnfant: string;
      }>;
      const nais = evts(c).filter((e) => e.type === "REPRODUCTION_TERMINEE");
      const enfants = c
        .obtenirAgents()
        .filter((a) => a.identite.generation === 1)
        .map((a) => ({
          id: a.identite.identifiant,
          parent: a.identite.identifiantParent,
          empreinte: a.configurationHeritable,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const venParents = c
        .obtenirAgents()
        .filter((a) => a.identite.generation === 0)
        .map((a) => ({
          id: a.identite.identifiant,
          ven: calculerValeurEconomiqueNette(a.etatEconomique).toString(10),
          capital: a.etatEconomique.capitalLiquide.toString(10),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const empreinteCausale = empreinteTrajectoireCausaleSansObservabiliteV03(
        evts(c),
      );
      c.fermer();
      return {
        parents,
        ordreRr: tentatives.map((t) => t.identifiantParent).slice(0, 4),
        idsReproduction: tentatives.map((t) => t.identifiantReproduction),
        idsEnfants: tentatives.map((t) => t.identifiantEnfant),
        nais: nais.length,
        enfants,
        venParents,
        empreinteCausale,
      };
    };

    const r1 = await executer();
    expect(r1.ordreRr).toEqual([
      r1.parents[0],
      r1.parents[1],
      r1.parents[0],
      r1.parents[1],
    ]);
    expect(r1.nais).toBeGreaterThan(0);

    const r2 = await executer();
    expect(r2.ordreRr).toEqual(r1.ordreRr);
    expect(r2.idsReproduction).toEqual(r1.idsReproduction);
    expect(r2.idsEnfants).toEqual(r1.idsEnfants);
    expect(r2.nais).toBe(r1.nais);
    expect(r2.enfants).toEqual(r1.enfants);
    expect(r2.venParents).toEqual(r1.venParents);
    expect(r2.empreinteCausale).toBe(r1.empreinteCausale);
  });

  it("T — v0.1/v0.2 sans événements v0.3", async () => {
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
    expect(
      evts(c).some((e) => e.type.startsWith("REPRODUCTION_ECONOMIQUE_V03_")),
    ).toBe(false);
    expect(
      evts(c).some(
        (e) => e.chargeUtile.observabiliteTentativeV03 !== undefined,
      ),
    ).toBe(false);
    expect(
      evts(c).some((e) => e.chargeUtile.observabiliteParents !== undefined),
    ).toBe(false);
    c.fermer();
  });

  it("U — anti-fitness : métriques absentes du planificateur / aucun score", async () => {
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
    const agg = c.projeterObservabiliteReproductionEconomiqueV03(1)!;
    expect(() => assertAucuneCleAntiFitnessV03(agg)).not.toThrow();
    for (const o of obsTentatives(c, 1)) {
      expect(() => assertAucuneCleAntiFitnessV03(o)).not.toThrow();
    }
    const plan = evts(c).find(
      (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
    )!;
    expect(plan.chargeUtile).not.toHaveProperty("fitnessScore");
    expect(JSON.stringify(plan.chargeUtile)).not.toMatch(
      /fitnessScore|"rank"|"rang"|percentile|meilleurAgent/,
    );
    c.fermer();
  });

  it("non-interférence — strip observabilité conserve parents/tentatives/naissances", async () => {
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
    const plan = evts(c).find(
      (e) => e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
    )!;
    expect(plan.chargeUtile.observabiliteParents).toBeDefined();
    const parents = plan.chargeUtile.parents;
    const tentatives = plan.chargeUtile.tentatives;
    const nais = evts(c).filter(
      (e) => e.type === "REPRODUCTION_TERMINEE" && e.numeroCycle === 1,
    ).length;
    const proj = projeterObservabiliteReproductionEconomiqueV03({
      evenements: evts(c),
      numeroCycle: 1,
    })!;
    expect(proj.naissancesRealisees).toBe(nais);
    expect((tentatives as unknown[]).length).toBe(nais);
    expect(parents).toBeDefined();
    // Empreinte causale ne contient plus les clés d'observabilité
    const emp = empreinteTrajectoireCausaleSansObservabiliteV03(evts(c));
    expect(emp).not.toContain("observabiliteParents");
    expect(emp).not.toContain("observabiliteTentativeV03");
    c.fermer();
  });
});
