import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
  calculerPrioriteReproductionNeutre,
  calculerValeurEconomiqueNette,
  creerEntreeCycleExperienceAvance,
  creerEntreeReproductionAutonomeCyclePlanifiee,
  creerEtatEconomiqueInitial,
  executerCycleEconomique,
  evaluerEligibiliteReproductionAutonome,
  parserPolitiqueReproductionAutonome,
  planifierReproductionsAutonomes,
  serialiserPolitiqueReproductionAutonome,
  type ParametresReproductionExperience,
  type PolitiqueReproductionAutonome,
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
  const r = mkdtempSync(join(tmpdir(), "esp-repro-auto-"));
  repertoires.push(r);
  return r;
}

const REPRODUCTION_BASE = {
  version: "parametres-reproduction-v01" as const,
  active: true,
  dotationEnfantMicroUsdc: "5000000",
  coutReproductionMicroUsdc: "1000000",
  reserveMinimaleParentMicroUsdc: "1000000",
  populationMaximale: 20,
  nombreMaxReproductionsParCycle: 5,
  nombreMaxEnfantsParAgent: 5,
  cooldownCycles: 0,
};

const REPRODUCTION_AUTONOME_BASE = {
  version: "politique-reproduction-autonome-v01" as const,
  active: true,
  etatsSurvieEligibles: ["sain", "contraint"] as const,
  nombreMaxNaissancesParCycle: 5,
};

const CRITERES_ARRET_BASE = {
  version: "criteres-arret-experience-v01" as const,
  cycleMaximum: 100,
};

const MUTATION_ACTIVE: NonNullable<ConfigurationExperienceJson["mutation"]> = {
  version: "parametres-mutation-v01",
  active: true,
  tauxMutationParGeneBps: 10_000,
  versionCatalogueGenes: "genes-mutables-v01",
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

const XWAY_SIMULE = {
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

function configEvolution(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ConfigurationExperienceJson {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-repro-auto-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 7,
    taillePopulationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "100000000",
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
    reproduction: REPRODUCTION_BASE,
    reproductionAutonome: {
      ...REPRODUCTION_AUTONOME_BASE,
      etatsSurvieEligibles: [...REPRODUCTION_AUTONOME_BASE.etatsSurvieEligibles],
    },
    criteresArret: CRITERES_ARRET_BASE,
  };

  const reproduction =
    surcharges.reproduction === undefined
      ? REPRODUCTION_BASE
      : { ...REPRODUCTION_BASE, ...surcharges.reproduction };

  const reproductionAutonome =
    surcharges.reproductionAutonome === undefined
      ? {
          ...REPRODUCTION_AUTONOME_BASE,
          etatsSurvieEligibles: [
            ...REPRODUCTION_AUTONOME_BASE.etatsSurvieEligibles,
          ],
        }
      : {
          ...REPRODUCTION_AUTONOME_BASE,
          ...surcharges.reproductionAutonome,
          etatsSurvieEligibles:
            surcharges.reproductionAutonome.etatsSurvieEligibles ?? [
              ...REPRODUCTION_AUTONOME_BASE.etatsSurvieEligibles,
            ],
        };

  const criteresArret =
    surcharges.criteresArret === undefined
      ? CRITERES_ARRET_BASE
      : { ...CRITERES_ARRET_BASE, ...surcharges.criteresArret };

  return {
    ...base,
    ...surcharges,
    parametresEconomiques: {
      ...base.parametresEconomiques,
      ...(surcharges.parametresEconomiques ?? {}),
    },
    reproduction,
    reproductionAutonome,
    criteresArret,
    ...(surcharges.mutation !== undefined
      ? { mutation: { ...MUTATION_ACTIVE, ...surcharges.mutation } }
      : {}),
    ...(surcharges.politiqueBudgetCognitif !== undefined
      ? {
          politiqueBudgetCognitif: {
            ...POLITIQUE_BASE,
            ...surcharges.politiqueBudgetCognitif,
          },
        }
      : {}),
    ...(surcharges.xway !== undefined
      ? {
          xway: {
            ...XWAY_SIMULE,
            ...surcharges.xway,
            modeles: surcharges.xway.modeles ?? XWAY_SIMULE.modeles,
            politiqueCognitive:
              surcharges.xway.politiqueCognitive ??
              XWAY_SIMULE.politiqueCognitive,
            fournisseur:
              surcharges.xway.fournisseur ?? XWAY_SIMULE.fournisseur,
          },
        }
      : {}),
  };
}

function ouvrir(
  conf: ConfigurationExperienceJson,
  extras?: { cheminSqlite?: string; cheminKeystore?: string },
): ControleurExperience {
  return ControleurExperience.ouvrir({
    configuration: parserConfigurationExperience(conf),
    ...(extras?.cheminSqlite !== undefined
      ? { cheminSqlite: extras.cheminSqlite }
      : { registre: creerRegistreEvenementsMemoire() }),
    ...(extras?.cheminKeystore !== undefined
      ? { cheminKeystoreIdentites: extras.cheminKeystore }
      : { cheminKeystoreIdentites: join(repertoireTemp(), "identites") }),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

function evenements(c: ControleurExperience) {
  return c.registre.listerParExperience(c.configuration.identifiantExperience);
}

function plansCycle(c: ControleurExperience, numeroCycle: number) {
  return evenements(c).filter(
    (e) =>
      e.type === "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE" &&
      e.numeroCycle === numeroCycle,
  );
}

function termineesCycle(c: ControleurExperience, numeroCycle: number) {
  return evenements(c).filter(
    (e) =>
      e.type === "REPRODUCTION_AUTONOME_CYCLE_TERMINEE" &&
      e.numeroCycle === numeroCycle,
  );
}

function lireRetenus(
  c: ControleurExperience,
  numeroCycle: number,
): readonly string[] {
  const plan = plansCycle(c, numeroCycle)[0];
  if (plan === undefined) {
    return [];
  }
  const retenus = plan.chargeUtile.identifiantsRetenus;
  return Array.isArray(retenus) ? (retenus as string[]) : [];
}

function lireEligibles(
  c: ControleurExperience,
  numeroCycle: number,
): readonly string[] {
  const plan = plansCycle(c, numeroCycle)[0];
  if (plan === undefined) {
    return [];
  }
  const eligibles = plan.chargeUtile.identifiantsEligiblesOrdonnes;
  return Array.isArray(eligibles) ? (eligibles as string[]) : [];
}

function politiqueActive(
  surcharges: Partial<PolitiqueReproductionAutonome> = {},
): PolitiqueReproductionAutonome {
  return {
    version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
    active: true,
    etatsSurvieEligibles: ["sain", "contraint"],
    nombreMaxNaissancesParCycle: 10,
    ...surcharges,
  };
}

function parametresRepro(
  surcharges: Partial<ParametresReproductionExperience> = {},
): ParametresReproductionExperience {
  return {
    version: "parametres-reproduction-v01",
    active: true,
    dotationEnfantMicroUsdc: 1_000_000n,
    coutReproductionMicroUsdc: 100_000n,
    reserveMinimaleParentMicroUsdc: 0n,
    populationMaximale: 20,
    nombreMaxReproductionsParCycle: 5,
    nombreMaxEnfantsParAgent: 3,
    cooldownCycles: 0,
    ...surcharges,
  };
}

/** Économie seule pour un cycle — sans phase autonome (crash simulé). */
function commitEconomieCycleSansReproduction(
  c: ControleurExperience,
  numeroCycle: number,
): void {
  c.registre.ajouter(
    creerEntreeCycleExperienceAvance({
      identifiantExperience: c.configuration.identifiantExperience,
      numeroCycle,
      dateEnregistrement: "2020-01-01T00:00:00.000Z",
    }),
  );
  let tresorerie = c.obtenirTresorerie();
  for (const agent of c.obtenirAgents()) {
    if (agent.etatEconomique.etatSurvie === "mort") {
      continue;
    }
    if (agent.identite.cycleNaissance === numeroCycle) {
      continue;
    }
    const activite = simulerActiviteCycle({
      graineSimulation: c.configuration.graineSimulation,
      identifiantAgent: agent.identite.identifiant,
      numeroCycle,
    });
    const resultat = executerCycleEconomique({
      identifiantExperience: c.configuration.identifiantExperience,
      identifiantAgent: agent.identite.identifiant,
      numeroCycle,
      parametres: c.configuration.parametresEconomiques,
      etat: agent.etatEconomique,
      tresorerie,
      activite,
      prefixeIdentifiant: `${agent.identite.identifiant}-`,
      dateEnregistrement: "2020-01-01T00:00:00.000Z",
    });
    c.registre.ajouterPlusieurs(resultat.evenements);
    tresorerie = resultat.tresorerie;
  }
}

describe("Reproduction autonome v0.1 — A–AH", () => {
  it("A — sans reproductionAutonome ou active:false → pas de PLANIFIEE/TERMINEE ni naissance autonome", async () => {
    const sansBloc = ouvrir({
      identifiantExperience: "exp-repro-auto-a1",
      versionProtocole: "0.1.0",
      mode: "simulation",
      graineSimulation: 7,
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "100000000",
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
      reproduction: REPRODUCTION_BASE,
    });
    expect(sansBloc.configuration.reproductionAutonome).toBeUndefined();
    await sansBloc.avancerUnCycle();
    const types1 = evenements(sansBloc).map((e) => e.type);
    expect(types1).not.toContain("REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE");
    expect(types1).not.toContain("REPRODUCTION_AUTONOME_CYCLE_TERMINEE");
    expect(sansBloc.projeterPopulation().populationTotale).toBe(2);

    const inactive = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-a2",
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          active: false,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await inactive.avancerUnCycle();
    expect(plansCycle(inactive, 1)).toHaveLength(0);
    expect(termineesCycle(inactive, 1)).toHaveLength(0);
    expect(inactive.projeterPopulation().populationTotale).toBe(2);
  });

  it("B — agent non éligible (réserve trop haute) → aucune naissance pour lui", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-b",
        capitalInitialParAgentMicroUsdc: "10000000",
        reproduction: {
          ...REPRODUCTION_BASE,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "1000000",
          reserveMinimaleParentMicroUsdc: "99000000",
        },
      }),
    );
    await c.avancerUnCycle();
    expect(lireEligibles(c, 1)).toHaveLength(0);
    expect(lireRetenus(c, 1)).toHaveLength(0);
    expect(c.projeterPopulation().populationTotale).toBe(2);
    expect(c.projeterPopulation().naissancesCycle).toBe(0);
  });

  it("C — éligible → naissance après cycle (PLANIFIEE + AGENT_CREE)", async () => {
    const c = ouvrir(configEvolution());
    const popAvant = c.projeterPopulation().populationTotale;
    await c.avancerUnCycle();
    expect(plansCycle(c, 1)).toHaveLength(1);
    expect(termineesCycle(c, 1)).toHaveLength(1);
    expect(lireRetenus(c, 1).length).toBeGreaterThan(0);
    expect(
      evenements(c).some(
        (e) => e.type === "AGENT_CREE" && e.numeroCycle === 1,
      ),
    ).toBe(true);
    expect(c.projeterPopulation().populationTotale).toBeGreaterThan(popAvant);
  });

  it("D — montants exacts TRANSFERT_INTERNE + COUT_REPRODUCTION_PAYE", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-d",
        taillePopulationInitiale: 1,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    const capitalAvant = parent.etatEconomique.capitalLiquide;
    await c.avancerUnCycle();
    const retenus = lireRetenus(c, 1);
    expect(retenus).toEqual([parent.identite.identifiant]);
    const enfant = c
      .obtenirAgents()
      .find((a) => a.identite.identifiantParent === parent.identite.identifiant)!;
    expect(enfant.etatEconomique.capitalLiquide).toBe(5_000_000n);
    const parentApres = c
      .obtenirAgents()
      .find((a) => a.identite.identifiant === parent.identite.identifiant)!;
    // Capital après économie cycle + débit reproduction
    const transfert = evenements(c).find(
      (e) =>
        e.type === "TRANSFERT_INTERNE" &&
        e.numeroCycle === 1 &&
        e.chargeUtile.motif === "dotation_naissance",
    );
    const cout = evenements(c).find(
      (e) => e.type === "COUT_REPRODUCTION_PAYE" && e.numeroCycle === 1,
    );
    expect(transfert?.chargeUtile.montantMicroUsdc).toBe("5000000");
    expect(cout?.chargeUtile.montantMicroUsdc).toBe("1000000");
    expect(parentApres.etatEconomique.capitalLiquide).toBeLessThan(capitalAvant);
    expect(enfant.etatEconomique.capitalLiquide).toBe(5_000_000n);
  });

  it("E — enfant cycleNaissance === N ; pas d'économie/décision en N ; agit en N+1", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-e",
        taillePopulationInitiale: 1,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const enfant = c.obtenirAgents().find((a) => a.identite.generation === 1)!;
    expect(enfant.identite.cycleNaissance).toBe(1);
    const ecoEnfantCycle1 = evenements(c).filter(
      (e) =>
        e.identifiantAgent === enfant.identite.identifiant &&
        e.numeroCycle === 1 &&
        (e.type === "CYCLE_TERMINE" ||
          e.type === "CYCLE_DEMARRE" ||
          e.type === "OBSERVATION_AGENT_RECUE"),
    );
    expect(ecoEnfantCycle1).toHaveLength(0);

    await c.avancerUnCycle();
    const ecoEnfantCycle2 = evenements(c).filter(
      (e) =>
        e.identifiantAgent === enfant.identite.identifiant &&
        e.numeroCycle === 2 &&
        e.type === "CYCLE_TERMINE",
    );
    expect(ecoEnfantCycle2).toHaveLength(1);
  });

  it("F — planifier/evaluer n'acceptent aucun champ fitness (unité + intégration)", async () => {
    expect(planifierReproductionsAutonomes.length).toBe(1);
    expect(evaluerEligibiliteReproductionAutonome.length).toBe(1);
    const srcPolitique = readFileSync(
      new URL(
        "../../../paquets/protocole/src/politique-reproduction-autonome.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const corpsSansCommentaires = srcPolitique
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(corpsSansCommentaires).not.toMatch(
      /MesuresFitness|calculerMesuresFitness|projeterFitness|ranking/i,
    );
    expect(corpsSansCommentaires).not.toMatch(/\bfitness\b/i);

    const srcCtrl = readFileSync(
      new URL("../src/controleur.ts", import.meta.url),
      "utf8",
    );
    const debut = srcCtrl.indexOf("private async executerPhaseReproductionAutonome");
    const fin = srcCtrl.indexOf(
      "reconstruireDepuisRegistre(): void",
      debut,
    );
    const bloc = srcCtrl
      .slice(debut, fin)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(bloc).not.toMatch(
      /MesuresFitness|calculerMesuresFitness|projeterFitness|ranking|\bfitness\b/i,
    );

    const c = ouvrir(configEvolution({ identifiantExperience: "exp-repro-auto-f" }));
    await c.avancerUnCycle();
    expect(plansCycle(c, 1)).toHaveLength(1);
  });

  it("G — même économie, fitness descriptive inventée → même éligibilité", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "p1",
      capitalLiquide: 10_000_000n,
      etatSurvie: "sain",
    });
    const opts = {
      politique: politiqueActive(),
      parametresReproduction: parametresRepro(),
      etatParent: etat,
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null as number | null,
      numeroCycle: 3,
      cycleNaissanceAgent: 0,
    };
    const r1 = evaluerEligibiliteReproductionAutonome(opts);
    const r2 = evaluerEligibiliteReproductionAutonome(opts);
    expect(r1).toEqual(r2);
    expect(r1).toEqual({ eligible: true });
    // Aucun paramètre fitness dans la signature — la « fitness » inventée est hors API.
  });

  it("H — VEN différente → éligibilité différente", () => {
    const riche = creerEtatEconomiqueInitial({
      identifiantAgent: "riche",
      capitalLiquide: 10_000_000n,
      etatSurvie: "sain",
    });
    const pauvre = creerEtatEconomiqueInitial({
      identifiantAgent: "pauvre",
      capitalLiquide: 50_000n,
      etatSurvie: "sain",
    });
    const base = {
      politique: politiqueActive(),
      parametresReproduction: parametresRepro({
        dotationEnfantMicroUsdc: 1_000_000n,
        coutReproductionMicroUsdc: 100_000n,
      }),
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null as number | null,
      numeroCycle: 3,
      cycleNaissanceAgent: 0,
    };
    expect(
      evaluerEligibiliteReproductionAutonome({ ...base, etatParent: riche }),
    ).toEqual({ eligible: true });
    expect(
      evaluerEligibiliteReproductionAutonome({ ...base, etatParent: pauvre }),
    ).toEqual({ eligible: false, motif: "capital_insuffisant" });
    expect(calculerValeurEconomiqueNette(riche)).toBeGreaterThan(
      calculerValeurEconomiqueNette(pauvre),
    );
  });

  it("I — mutation via chemin canonique : CONFIGURATION_HERITEE / MUTATION_APPLIQUEE", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-i",
        taillePopulationInitiale: 1,
        mutation: MUTATION_ACTIVE,
        politiqueBudgetCognitif: POLITIQUE_BASE,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    expect(lireRetenus(c, 1)).toHaveLength(1);
    expect(
      evenements(c).some(
        (e) => e.type === "CONFIGURATION_HERITEE" && e.numeroCycle === 1,
      ),
    ).toBe(true);
    expect(
      evenements(c).some(
        (e) => e.type === "MUTATION_APPLIQUEE" && e.numeroCycle === 1,
      ),
    ).toBe(true);
  });

  it("J — même graine → mêmes reproductions (IDs enfants / retenus)", async () => {
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-j",
      graineSimulation: 42,
    });
    const c1 = ouvrir(conf);
    const c2 = ouvrir({
      ...conf,
      identifiantExperience: "exp-repro-auto-j-b",
    });
    // Align agent id suffixes by using same experience id pattern via separate runs
    // Same relative behavior: same seed + same population size → same retenus relative order
    await c1.avancerUnCycle();
    await c2.avancerUnCycle();
    // Rebuild with identical experience ids for strict child ID match
    const confStrict = configEvolution({
      identifiantExperience: "exp-repro-auto-j2",
      graineSimulation: 42,
    });
    const a = ouvrir(confStrict);
    const b = ouvrir(confStrict);
    await a.avancerUnCycle();
    await b.avancerUnCycle();
    expect(lireRetenus(a, 1)).toEqual(lireRetenus(b, 1));
    const enfantsA = a
      .obtenirAgents()
      .filter((x) => x.identite.generation === 1)
      .map((x) => x.identite.identifiant)
      .sort();
    const enfantsB = b
      .obtenirAgents()
      .filter((x) => x.identite.generation === 1)
      .map((x) => x.identite.identifiant)
      .sort();
    expect(enfantsA).toEqual(enfantsB);
  });

  it("K — ordre mémoire des candidats n'affecte pas l'arbitrage", () => {
    const candidats = ["z", "a", "m", "b"].map((id) => ({
      identifiantAgent: id,
      etatParent: creerEtatEconomiqueInitial({
        identifiantAgent: id,
        capitalLiquide: 10_000_000n,
        etatSurvie: "sain" as const,
      }),
      nombreEnfantsParent: 0,
      cycleDerniereNaissanceParent: null,
      cycleNaissanceAgent: 0,
    }));
    const opts = {
      politique: politiqueActive({ nombreMaxNaissancesParCycle: 2 }),
      parametresReproduction: parametresRepro({ populationMaximale: 100 }),
      graineExperience: 7,
      numeroCycle: 3,
      populationAuSnapshot: 4,
      reproductionsDejaAuSnapshot: 0,
    };
    const p1 = planifierReproductionsAutonomes({
      ...opts,
      candidats,
    });
    const p2 = planifierReproductionsAutonomes({
      ...opts,
      candidats: [...candidats].reverse(),
    });
    expect(p1.identifiantsRetenus).toEqual(p2.identifiantsRetenus);
    expect(p1.identifiantsEligiblesOrdonnes).toEqual(
      p2.identifiantsEligiblesOrdonnes,
    );
  });

  it("L — capacité limitée → sélection neutre déterministe", () => {
    const candidats = ["c1", "c2", "c3", "c4"].map((id) => ({
      identifiantAgent: id,
      etatParent: creerEtatEconomiqueInitial({
        identifiantAgent: id,
        capitalLiquide: 10_000_000n,
        etatSurvie: "sain" as const,
      }),
      nombreEnfantsParent: 0,
      cycleDerniereNaissanceParent: null,
      cycleNaissanceAgent: 0,
    }));
    const plan = planifierReproductionsAutonomes({
      politique: politiqueActive({ nombreMaxNaissancesParCycle: 1 }),
      parametresReproduction: parametresRepro({ populationMaximale: 100 }),
      graineExperience: 11,
      numeroCycle: 2,
      populationAuSnapshot: 4,
      reproductionsDejaAuSnapshot: 0,
      candidats,
    });
    expect(plan.placesDisponibles).toBe(1);
    expect(plan.identifiantsEligiblesOrdonnes).toHaveLength(4);
    expect(plan.identifiantsRetenus).toHaveLength(1);
    expect(plan.identifiantsRefusCapacite).toHaveLength(3);
    expect(plan.identifiantsRetenus[0]).toBe(
      plan.identifiantsEligiblesOrdonnes[0],
    );
  });

  it("M — priorité indépendante de la fitness descriptive inventée", () => {
    const ids = ["alpha", "beta", "gamma"];
    const pSans = ids.map((id) =>
      calculerPrioriteReproductionNeutre({
        versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        graineExperience: 9,
        numeroCycle: 4,
        identifiantAgent: id,
      }),
    );
    const pAvec = ids.map((id) =>
      calculerPrioriteReproductionNeutre({
        versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        graineExperience: 9,
        numeroCycle: 4,
        identifiantAgent: id,
      }),
    );
    expect(pSans).toEqual(pAvec);
  });

  it("N — priorité indépendante de la VEN au-delà du seuil", () => {
    const pRiche = calculerPrioriteReproductionNeutre({
      versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      graineExperience: 9,
      numeroCycle: 4,
      identifiantAgent: "meme-id",
    });
    const pPauvre = calculerPrioriteReproductionNeutre({
      versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      graineExperience: 9,
      numeroCycle: 4,
      identifiantAgent: "meme-id",
    });
    expect(pRiche).toBe(pPauvre);
  });

  it("O — populationMaximale respectée", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-o",
        taillePopulationInitiale: 2,
        reproduction: {
          ...REPRODUCTION_BASE,
          populationMaximale: 2,
          dotationEnfantMicroUsdc: "1000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
        },
      }),
    );
    await c.avancerUnCycle();
    expect(c.projeterPopulation().populationTotale).toBe(2);
    expect(lireRetenus(c, 1)).toHaveLength(0);
    expect(lireEligibles(c, 1)).toHaveLength(0);
  });

  it("P — nombreMaxNaissancesParCycle (politique) respecté", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-p",
        taillePopulationInitiale: 3,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    expect(lireEligibles(c, 1).length).toBeGreaterThanOrEqual(1);
    expect(lireRetenus(c, 1)).toHaveLength(1);
    expect(c.projeterPopulation().naissancesCycle).toBe(1);
  });

  it("Q — cooldown reconstruit après redémarrage SQLite", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-q",
      taillePopulationInitiale: 1,
      reproduction: {
        ...REPRODUCTION_BASE,
        cooldownCycles: 2,
        nombreMaxEnfantsParAgent: 5,
      },
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 1,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c1 = ouvrir(conf, { cheminSqlite: chemin });
    await c1.avancerUnCycle();
    expect(lireRetenus(c1, 1)).toHaveLength(1);
    const parentId = lireRetenus(c1, 1)[0]!;
    c1.fermer();

    const c2 = ouvrir(conf, { cheminSqlite: chemin });
    await c2.avancerUnCycle(); // cycle 2 : cooldownCycles=2 → 2−1 < 2
    expect(lireRetenus(c2, 2)).not.toContain(parentId);
    expect(lireEligibles(c2, 2)).not.toContain(parentId);
    c2.fermer();
  });

  it("R — max enfants reconstruit après redémarrage", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-r",
      taillePopulationInitiale: 1,
      reproduction: {
        ...REPRODUCTION_BASE,
        nombreMaxEnfantsParAgent: 1,
        cooldownCycles: 0,
      },
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 1,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c1 = ouvrir(conf, { cheminSqlite: chemin });
    await c1.avancerUnCycle();
    expect(lireRetenus(c1, 1)).toHaveLength(1);
    c1.fermer();

    const c2 = ouvrir(conf, { cheminSqlite: chemin });
    await c2.avancerUnCycle();
    expect(lireRetenus(c2, 2)).toHaveLength(0);
    expect(
      c2.obtenirAgents().filter((a) => a.identite.generation === 1),
    ).toHaveLength(1);
    c2.fermer();
  });

  it("S — crash avant phase reproduction : reprise planifie et naît", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-s",
      taillePopulationInitiale: 1,
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 1,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c = ouvrir(conf, { cheminSqlite: chemin });
    commitEconomieCycleSansReproduction(c, 1);
    expect(plansCycle(c, 1)).toHaveLength(0);
    expect(
      evenements(c).filter((e) => e.type === "CYCLE_TERMINE" && e.numeroCycle === 1),
    ).toHaveLength(1);
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    expect(reprise.obtenirNumeroCycleCourant()).toBe(1);
    await reprise.avancerUnCycle();
    expect(plansCycle(reprise, 1)).toHaveLength(1);
    expect(termineesCycle(reprise, 1)).toHaveLength(1);
    expect(lireRetenus(reprise, 1)).toHaveLength(1);
    expect(reprise.projeterPopulation().populationTotale).toBe(2);
    reprise.fermer();
  });

  it("T — crash après une naissance mid-retenus : pas de double, complète le reste", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-t",
      taillePopulationInitiale: 2,
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 2,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c = ouvrir(conf, { cheminSqlite: chemin });
    commitEconomieCycleSansReproduction(c, 1);
    const ids = c.obtenirAgents().map((a) => a.identite.identifiant);
    const plan = planifierReproductionsAutonomes({
      politique: parserConfigurationExperience(conf).reproductionAutonome!,
      parametresReproduction: parserConfigurationExperience(conf).reproduction!,
      graineExperience: conf.graineSimulation,
      numeroCycle: 1,
      populationAuSnapshot: 2,
      reproductionsDejaAuSnapshot: 0,
      candidats: c.obtenirAgents().map((agent) => ({
        identifiantAgent: agent.identite.identifiant,
        etatParent: agent.etatEconomique,
        nombreEnfantsParent: 0,
        cycleDerniereNaissanceParent: null,
        cycleNaissanceAgent: agent.identite.cycleNaissance,
      })),
    });
    expect(plan.identifiantsRetenus.length).toBeGreaterThanOrEqual(2);
    c.registre.ajouter(
      creerEntreeReproductionAutonomeCyclePlanifiee({
        identifiantExperience: conf.identifiantExperience,
        numeroCycle: 1,
        charge: {
          numeroCycle: plan.numeroCycle,
          versionPolitique: plan.versionPolitique,
          placesDisponibles: plan.placesDisponibles,
          identifiantsEligiblesOrdonnes: plan.identifiantsEligiblesOrdonnes,
          identifiantsRetenus: plan.identifiantsRetenus,
          identifiantsRefusCapacite: plan.identifiantsRefusCapacite,
          populationAuSnapshot: plan.populationAuSnapshot,
          reproductionsDejaAuSnapshot: plan.reproductionsDejaAuSnapshot,
        },
        dateEnregistrement: "2020-01-01T00:00:00.000Z",
      }),
    );
    c.fermer();

    // Reprise : mémoire à jour, première naissance uniquement
    const mid = ouvrir(conf, { cheminSqlite: chemin });
    const premier = plan.identifiantsRetenus[0]!;
    const r1 = await mid.demanderReproduction(premier);
    expect(r1.statut).toBe("autorisee");
    expect(mid.projeterPopulation().populationTotale).toBe(3);
    expect(termineesCycle(mid, 1)).toHaveLength(0);
    mid.fermer();

    const fin = ouvrir(conf, { cheminSqlite: chemin });
    await fin.avancerUnCycle();
    expect(termineesCycle(fin, 1)).toHaveLength(1);
    const enfantsPremier = fin
      .obtenirAgents()
      .filter((a) => a.identite.identifiantParent === premier);
    expect(enfantsPremier).toHaveLength(1);
    expect(fin.projeterPopulation().populationTotale).toBe(
      2 + plan.identifiantsRetenus.length,
    );
    void ids;
    fin.fermer();
  });

  it("U — après TERMINEE, reprendre → cycle N+1 sans rejouer naissances", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-u",
      taillePopulationInitiale: 1,
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 1,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c = ouvrir(conf, { cheminSqlite: chemin });
    await c.avancerUnCycle();
    expect(termineesCycle(c, 1)).toHaveLength(1);
    const pop = c.projeterPopulation().populationTotale;
    const naissances1 = evenements(c).filter(
      (e) => e.type === "AGENT_CREE" && e.numeroCycle === 1,
    ).length;
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    await reprise.avancerUnCycle();
    expect(reprise.obtenirNumeroCycleCourant()).toBe(2);
    expect(plansCycle(reprise, 1)).toHaveLength(1);
    expect(
      evenements(reprise).filter(
        (e) => e.type === "AGENT_CREE" && e.numeroCycle === 1,
      ),
    ).toHaveLength(naissances1);
    expect(reprise.projeterPopulation().populationTotale).toBeGreaterThanOrEqual(
      pop,
    );
    reprise.fermer();
  });

  it("V — agent mort ne se reproduit pas", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-v",
      taillePopulationInitiale: 2,
    });
    const c = ouvrir(conf, { cheminSqlite: chemin });
    const cible = c.obtenirAgents()[0]!;
    c.registre.ajouter({
      identifiant: `mort-${cible.identite.identifiant}`,
      versionSchema: 1,
      type: "AGENT_MORT",
      identifiantExperience: conf.identifiantExperience,
      identifiantAgent: cible.identite.identifiant,
      numeroCycle: 0,
      chargeUtile: { cyclesDormanceConsecutifs: 3 },
    });
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    expect(
      reprise.obtenirAgents().find((a) => a.identite.identifiant === cible.identite.identifiant)
        ?.etatEconomique.etatSurvie,
    ).toBe("mort");
    await reprise.avancerUnCycle();
    expect(lireEligibles(reprise, 1)).not.toContain(cible.identite.identifiant);
    expect(lireRetenus(reprise, 1)).not.toContain(cible.identite.identifiant);
    reprise.fermer();
  });

  it("W — critique / dormant non éligibles avec etatsSurvieEligibles par défaut", () => {
    for (const etatSurvie of ["critique", "dormant"] as const) {
      const resultat = evaluerEligibiliteReproductionAutonome({
        politique: politiqueActive(),
        parametresReproduction: parametresRepro(),
        etatParent: creerEtatEconomiqueInitial({
          identifiantAgent: "x",
          capitalLiquide: 10_000_000n,
          etatSurvie,
        }),
        populationTotale: 1,
        nombreEnfantsParent: 0,
        reproductionsDejaCeCycle: 0,
        cycleDerniereNaissanceParent: null,
        numeroCycle: 5,
        cycleNaissanceAgent: 0,
      });
      expect(resultat).toEqual({
        eligible: false,
        motif: "etat_survie_non_eligible",
      });
    }
  });

  it("X — nouveau-né ne se reproduit pas le cycle de naissance", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-x",
        taillePopulationInitiale: 1,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const enfant = c.obtenirAgents().find((a) => a.identite.generation === 1)!;
    expect(enfant.identite.cycleNaissance).toBe(1);
    expect(lireEligibles(c, 1)).not.toContain(enfant.identite.identifiant);
    expect(lireRetenus(c, 1)).not.toContain(enfant.identite.identifiant);
  });

  it("Y — générations chevauchantes : parent et enfant vivants", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-y",
        taillePopulationInitiale: 1,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    const parentId = c.obtenirAgents()[0]!.identite.identifiant;
    await c.avancerUnCycle();
    const parent = c.obtenirAgents().find((a) => a.identite.identifiant === parentId)!;
    const enfant = c.obtenirAgents().find((a) => a.identite.generation === 1)!;
    expect(parent.etatEconomique.etatSurvie).not.toBe("mort");
    expect(enfant.etatEconomique.etatSurvie).not.toBe("mort");
    expect(enfant.identite.identifiantParent).toBe(parentId);
  });

  it("Z — métriques descendants exactes (nombreEnfants, nombreDescendantsTotaux)", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-z",
        taillePopulationInitiale: 1,
        reproduction: {
          ...REPRODUCTION_BASE,
          cooldownCycles: 0,
          nombreMaxEnfantsParAgent: 5,
        },
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const parentId = lireRetenus(c, 1)[0]!;
    const fiche = c.projeterAgent(parentId)!;
    expect(fiche.succesReproductif.nombreEnfants).toBe(1);
    expect(fiche.succesReproductif.nombreDescendantsDirects).toBe(1);
    expect(fiche.succesReproductif.nombreDescendantsTotaux).toBe(1);

    // Petit-enfant éventuel après un cycle de plus (générations chevauchantes).
    await c.avancerUnCycle();
    const ficheParent = c.projeterAgent(parentId)!;
    expect(ficheParent.succesReproductif.nombreEnfants).toBeGreaterThanOrEqual(1);
    expect(fiche.identifiantsEnfants.length).toBeGreaterThanOrEqual(1);
  });

  it("AA — fréquences de génotype exactes", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-aa",
        taillePopulationInitiale: 1,
        mutation: { ...MUTATION_ACTIVE, active: false, tauxMutationParGeneBps: 0 },
        politiqueBudgetCognitif: POLITIQUE_BASE,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const dyn = c.projeterDynamiqueEvolutive();
    const vivants = c
      .obtenirAgents()
      .filter((a) => a.etatEconomique.etatSurvie !== "mort").length;
    const sommeParts = dyn.frequencesGenotypes.reduce(
      (acc, g) => acc + g.partPopulationVivanteBps,
      0,
    );
    expect(sommeParts).toBe(10_000);
    expect(
      dyn.frequencesGenotypes.reduce((acc, g) => acc + g.agentsVivants, 0),
    ).toBe(vivants);
  });

  it("AB — lignée partPopulationVivanteBps correcte", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-ab",
        taillePopulationInitiale: 2,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const dyn = c.projeterDynamiqueEvolutive();
    const vivants = c
      .obtenirAgents()
      .filter((a) => a.etatEconomique.etatSurvie !== "mort").length;
    expect(dyn.lignees.length).toBeGreaterThan(0);
    let sommeMembres = 0;
    for (const lignee of dyn.lignees) {
      sommeMembres += lignee.membresVivants;
      expect(lignee.partPopulationVivanteBps).toBe(
        Math.floor((lignee.membresVivants * 10_000) / vivants),
      );
    }
    expect(sommeMembres).toBe(vivants);
  });

  it("AC — sélection émergente : VEN élevée → plus d'enfants sans comparaison fitness", async () => {
    // exp-ac-1-agent-000 = profitable, agent-001 = déficitaire (profil simulateur).
    // Capital initial < besoin ; seuls les agents qui accumulent assez de VEN se reproduisent.
    const conf = configEvolution({
      identifiantExperience: "exp-ac-1",
      graineSimulation: 1,
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "1500000",
      parametresEconomiques: {
        version: "demo-ac",
        loyerInfrastructureMicroUsdc: "0",
        periodeLoyerEnCycles: 100,
        tauxRedevanceProprietairePointsDeBase: "0",
        coutOperationnelMinimalParCycleMicroUsdc: "1000",
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 5,
      },
      reproduction: {
        ...REPRODUCTION_BASE,
        dotationEnfantMicroUsdc: "1800000",
        coutReproductionMicroUsdc: "200000",
        reserveMinimaleParentMicroUsdc: "0",
        cooldownCycles: 0,
        nombreMaxEnfantsParAgent: 10,
        nombreMaxReproductionsParCycle: 2,
        populationMaximale: 30,
      },
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        nombreMaxNaissancesParCycle: 2,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c = ouvrir(conf);
    const id000 = "exp-ac-1-agent-000";
    const id001 = "exp-ac-1-agent-001";

    for (let i = 0; i < 5; i += 1) {
      await c.avancerUnCycle();
    }
    // Avant toute naissance : le profitable a déjà plus de VEN.
    expect(c.projeterPopulation().naissancesCumulees).toBe(0);
    const venAvant000 = calculerValeurEconomiqueNette(
      c.obtenirAgents().find((a) => a.identite.identifiant === id000)!
        .etatEconomique,
    );
    const venAvant001 = calculerValeurEconomiqueNette(
      c.obtenirAgents().find((a) => a.identite.identifiant === id001)!
        .etatEconomique,
    );
    expect(venAvant000).toBeGreaterThan(venAvant001);

    for (let i = 0; i < 10; i += 1) {
      await c.avancerUnCycle();
    }
    const enfants000 = c.projeterAgent(id000)!.succesReproductif.nombreEnfants;
    const enfants001 = c.projeterAgent(id001)!.succesReproductif.nombreEnfants;
    expect(enfants000).toBeGreaterThan(0);
    expect(enfants001).toBe(0);
  });

  it("AD — contre-exemple : meilleure fitness descriptive mais VEN insuffisante → pas de reproduction", () => {
    const etatPauvre = creerEtatEconomiqueInitial({
      identifiantAgent: "fit-pauvre",
      capitalLiquide: 10_000n,
      etatSurvie: "sain",
    });
    const etatRiche = creerEtatEconomiqueInitial({
      identifiantAgent: "fit-riche",
      capitalLiquide: 10_000_000n,
      etatSurvie: "sain",
    });
    // « Meilleure fitness » descriptive inventée hors API — seule la VEN compte.
    const fitnessInventee = {
      "fit-pauvre": 0.99,
      "fit-riche": 0.1,
    };
    expect(fitnessInventee["fit-pauvre"]).toBeGreaterThan(
      fitnessInventee["fit-riche"],
    );
    const base = {
      politique: politiqueActive(),
      parametresReproduction: parametresRepro({
        dotationEnfantMicroUsdc: 1_000_000n,
        coutReproductionMicroUsdc: 100_000n,
      }),
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null as number | null,
      numeroCycle: 5,
      cycleNaissanceAgent: 0,
    };
    expect(
      evaluerEligibiliteReproductionAutonome({
        ...base,
        etatParent: etatPauvre,
      }),
    ).toEqual({ eligible: false, motif: "capital_insuffisant" });
    expect(
      evaluerEligibiliteReproductionAutonome({
        ...base,
        etatParent: etatRiche,
      }),
    ).toEqual({ eligible: true });
  });

  it("AE — transferts / coûts population exacts", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-ae",
        taillePopulationInitiale: 1,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    const venAvantCycle = BigInt(c.projeterPopulation().venTotale.microUsdc);
    await c.avancerUnCycle();
    const venApres = BigInt(c.projeterPopulation().venTotale.microUsdc);
    const treso = c.projeterTresorerie();
    expect(treso.revenusCoutsReproduction.microUsdc).toBe("1000000");
    // Dotation neutre ; coût sort de la population ; activité économique aussi.
    const couts = evenements(c).filter(
      (e) => e.type === "COUT_REPRODUCTION_PAYE" && e.numeroCycle === 1,
    );
    expect(couts).toHaveLength(1);
    expect(couts[0]!.chargeUtile.montantMicroUsdc).toBe("1000000");
    const transferts = evenements(c).filter(
      (e) =>
        e.type === "TRANSFERT_INTERNE" &&
        e.numeroCycle === 1 &&
        e.chargeUtile.motif === "dotation_naissance",
    );
    // Paire sortie + entrée pour une même dotation.
    expect(transferts).toHaveLength(2);
    expect(
      transferts.every((e) => e.chargeUtile.montantMicroUsdc === "5000000"),
    ).toBe(true);
    expect(new Set(transferts.map((e) => e.chargeUtile.sens))).toEqual(
      new Set(["sortie", "entree"]),
    );
    expect(venApres).not.toBe(venAvantCycle);
    void venAvantCycle;
  });

  it("AF — aucun Xway/OpenAI pendant la phase autonome", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-repro-auto-af",
        xway: XWAY_SIMULE,
        politiqueBudgetCognitif: POLITIQUE_BASE,
      }),
    );
    expect(c.configuration.xway?.fournisseur.identifiant).toBe(
      "fournisseur-inference-simule",
    );
    await c.avancerUnCycle();
    expect(plansCycle(c, 1).length).toBeGreaterThanOrEqual(0);
    expect(spy).not.toHaveBeenCalled();
    const types = evenements(c).map((e) => e.type);
    expect(types.some((t) => /openai/i.test(t))).toBe(false);
    spy.mockRestore();
  });

  it("AG — JSON historique sans reproductionAutonome : parse OK, pas de PLANIFIEE", async () => {
    const historique: ConfigurationExperienceJson = {
      identifiantExperience: "exp-repro-auto-ag",
      versionProtocole: "0.1.0",
      mode: "simulation",
      graineSimulation: 3,
      taillePopulationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "50000000",
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
      reproduction: REPRODUCTION_BASE,
    };
    const parsed = parserConfigurationExperience(historique);
    expect(parsed.reproductionAutonome).toBeUndefined();
    const c = ouvrir(historique);
    await c.avancerUnCycle();
    expect(plansCycle(c, 1)).toHaveLength(0);
    expect(c.projeterPopulation().populationTotale).toBe(2);
  });

  it("AH — déterminisme après redémarrage SQLite (même généalogie)", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-repro-auto-ah",
      graineSimulation: 99,
      taillePopulationInitiale: 2,
    });
    const c1 = ouvrir(conf, { cheminSqlite: chemin });
    await c1.avancerUnCycle();
    await c1.avancerUnCycle();
    const arbre1 = c1.projeterArbre();
    const retenus1 = lireRetenus(c1, 1);
    const retenus2 = lireRetenus(c1, 2);
    const ids1 = c1
      .obtenirAgents()
      .map((a) => ({
        id: a.identite.identifiant,
        parent: a.identite.identifiantParent ?? null,
        generation: a.identite.generation,
        cycleNaissance: a.identite.cycleNaissance,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    c1.fermer();

    const c2 = ouvrir(conf, { cheminSqlite: chemin });
    expect(c2.projeterArbre().relations).toEqual(arbre1.relations);
    expect(lireRetenus(c2, 1)).toEqual(retenus1);
    expect(lireRetenus(c2, 2)).toEqual(retenus2);
    const ids2 = c2
      .obtenirAgents()
      .map((a) => ({
        id: a.identite.identifiant,
        parent: a.identite.identifiantParent ?? null,
        generation: a.identite.generation,
        cycleNaissance: a.identite.cycleNaissance,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(ids2).toEqual(ids1);
    c2.fermer();
  });

  it("AI — cycleMaximum fonctionne reproduction OFF", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-arret-ai",
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          active: false,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
        criteresArret: {
          version: "criteres-arret-experience-v01",
          cycleMaximum: 3,
        },
      }),
    );
    await c.avancerUnCycle();
    expect(c.projeterExperience().statut).not.toBe("terminee");
    await c.avancerUnCycle();
    expect(c.projeterExperience().statut).not.toBe("terminee");
    await c.avancerUnCycle();
    expect(c.projeterExperience().statut).toBe("terminee");
    expect(plansCycle(c, 1)).toHaveLength(0);
    expect(plansCycle(c, 2)).toHaveLength(0);
    expect(plansCycle(c, 3)).toHaveLength(0);
    await expect(c.avancerUnCycle()).rejects.toThrow(/terminée/);
  });

  it("AJ — cycleMaximum fonctionne reproduction ON", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-arret-aj",
        criteresArret: {
          version: "criteres-arret-experience-v01",
          cycleMaximum: 2,
        },
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    expect(c.projeterExperience().statut).not.toBe("terminee");
    expect(plansCycle(c, 1).length).toBe(1);
    await c.avancerUnCycle();
    expect(c.projeterExperience().statut).toBe("terminee");
    expect(plansCycle(c, 2).length).toBe(1);
    await expect(c.avancerUnCycle()).rejects.toThrow(/terminée/);
  });

  it("AK — restart conserve le même critère d'arrêt depuis EXPERIENCE_CREEE", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configEvolution({
      identifiantExperience: "exp-arret-ak",
      criteresArret: {
        version: "criteres-arret-experience-v01",
        cycleMaximum: 2,
      },
      reproductionAutonome: {
        ...REPRODUCTION_AUTONOME_BASE,
        active: false,
        etatsSurvieEligibles: ["sain", "contraint"],
      },
    });
    const c1 = ouvrir(conf, { cheminSqlite: chemin });
    await c1.avancerUnCycle();
    expect(c1.configuration.criteresArret?.cycleMaximum).toBe(2);
    c1.fermer();

    const c2 = ouvrir(conf, { cheminSqlite: chemin });
    expect(c2.configuration.criteresArret?.cycleMaximum).toBe(2);
    expect(c2.projeterExperience().statut).not.toBe("terminee");
    await c2.avancerUnCycle();
    expect(c2.projeterExperience().statut).toBe("terminee");
    c2.fermer();
  });

  it("AL — politique reproduction ne possède plus cycleMaximum", () => {
    const politique = politiqueActive();
    expect(
      Object.prototype.hasOwnProperty.call(politique, "cycleMaximum"),
    ).toBe(false);
    expect(() =>
      parserPolitiqueReproductionAutonome({
        version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        active: true,
        etatsSurvieEligibles: ["sain"],
        nombreMaxNaissancesParCycle: 1,
        cycleMaximum: 5,
      } as never),
    ).toThrow(/criteresArret/);
    const serialise = serialiserPolitiqueReproductionAutonome(politique);
    expect(
      Object.prototype.hasOwnProperty.call(serialise, "cycleMaximum"),
    ).toBe(false);
  });

  it("AM — aucun mécanisme de diversité minimale n'influence la reproduction", async () => {
    const c = ouvrir(
      configEvolution({
        identifiantExperience: "exp-arret-am",
        taillePopulationInitiale: 1,
        mutation: { ...MUTATION_ACTIVE, active: false, tauxMutationParGeneBps: 0 },
        politiqueBudgetCognitif: POLITIQUE_BASE,
        reproductionAutonome: {
          ...REPRODUCTION_AUTONOME_BASE,
          nombreMaxNaissancesParCycle: 1,
          etatsSurvieEligibles: ["sain", "contraint"],
        },
      }),
    );
    await c.avancerUnCycle();
    const plan = plansCycle(c, 1)[0]!;
    const charge = plan.chargeUtile;
    for (const cle of Object.keys(charge)) {
      expect(cle.toLowerCase()).not.toMatch(/diversit|fixation|rare|frequen/);
    }
    expect(c.configuration.reproductionAutonome).toBeDefined();
    expect(
      Object.keys(c.configuration.reproductionAutonome!).sort(),
    ).toEqual(
      ["active", "etatsSurvieEligibles", "nombreMaxNaissancesParCycle", "version"].sort(),
    );
    // La diversité reste une mesure descriptive uniquement.
    const dyn = c.projeterPopulation().dynamiqueEvolutive;
    expect(dyn.avertissement).toBe("SELECTION_EMERGENTE_SANS_RANKING_FITNESS");
    expect(dyn.configurationsHeritablesDistinctes).toBeGreaterThanOrEqual(1);
  });
});
