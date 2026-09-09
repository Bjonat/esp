/**
 * Tests protocole évolution v0.2 — contrat, fabrication decision_simulee, préflight.
 * Seeds artificielles uniquement (jamais 1001–1020 en exécution d'évaluation).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  parserProtocoleEvolution,
  fabriquerConfigurationRun,
} from "../src/index.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  parserProtocoleEvolutionV02,
  type ProtocoleExperienceEvolutionV02Json,
} from "../src/protocole-evolution-v02.js";
import { fabriquerConfigurationRunV02 } from "../src/conditions-v02.js";
import {
  PreflightEvolutionV02Erreur,
  validerPreflightCampagneEvolutionV02,
} from "../src/preflight-evolution-v02.js";
import { chargerProtocoleCampagneEvolutionDepuisObjet } from "../src/protocole-versionne.js";

function protocoleV02Brut(
  surcharges: Partial<ProtocoleExperienceEvolutionV02Json> = {},
): ProtocoleExperienceEvolutionV02Json {
  const base: ProtocoleExperienceEvolutionV02Json = {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: "test-evo-v02",
    mode: "calibration",
    seedsCalibration: [9001, 9002],
    seedsEvaluation: [],
    cyclesMaximum: 3,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "8000000",
    tauxMutationConditionDBps: 1000,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: "2020-01-01T00:00:00.000Z",
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-test-v02",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    reproduction: {
      version: "parametres-reproduction-v01",
      active: true,
      dotationEnfantMicroUsdc: "800000",
      coutReproductionMicroUsdc: "200000",
      reserveMinimaleParentMicroUsdc: "400000",
      populationMaximale: 8,
      nombreMaxReproductionsParCycle: 3,
      nombreMaxEnfantsParAgent: 3,
      cooldownCycles: 0,
    },
    reproductionAutonome: {
      version: "politique-reproduction-autonome-v01",
      active: true,
      etatsSurvieEligibles: ["sain", "contraint"],
      nombreMaxNaissancesParCycle: 2,
    },
    mutationBase: {
      version: "parametres-mutation-v01",
      active: true,
      tauxMutationParGeneBps: 1000,
      versionCatalogueGenes: "genes-mutables-v01",
    },
    environnementDecision: {
      identifiant: "environnement-opportunites-simulees",
      version: "0.1.0",
      probabiliteSuccesBaseBps: 6000,
      amplitudeProbabiliteBps: 0,
      gainSiSuccesMicroUsdc: "125000",
      perteSiEchecMicroUsdc: "50000",
      fraisActionMicroUsdc: "1000",
      fraisAttendreMicroUsdc: "0",
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
  };
  return { ...base, ...surcharges };
}

describe("protocole-experience-evolution-v02", () => {
  it("v01 reste parsable et distinct de v02", () => {
    const v01Path = join(
      process.cwd(),
      "experiences/protocoles/evolution-evaluation-v01.json",
    );
    const brut = JSON.parse(readFileSync(v01Path, "utf8")) as {
      version: string;
    };
    expect(brut.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION);
    const p = parserProtocoleEvolution(
      brut as Parameters<typeof parserProtocoleEvolution>[0],
    );
    expect(p.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION);
    expect(() => parserProtocoleEvolutionV02(brut as never)).toThrow(
      /protocole-experience-evolution-v02/,
    );
  });

  it("v02 exige environnementDecision", () => {
    const { environnementDecision: _, ...sansEnv } = protocoleV02Brut();
    expect(() =>
      parserProtocoleEvolutionV02(
        sansEnv as ProtocoleExperienceEvolutionV02Json,
      ),
    ).toThrow(/environnementDecision/);
  });

  it("v02 refuse environnement décisionnel absent à la fabrication", () => {
    const p = parserProtocoleEvolutionV02(protocoleV02Brut());
    const casse = {
      ...p,
      environnementDecision: undefined as never,
    };
    expect(() => fabriquerConfigurationRunV02(casse, "A", 9001)).toThrow(
      /environnementDecision/,
    );
  });

  it("v02 fabrique mode decision_simulee", () => {
    const p = parserProtocoleEvolutionV02(protocoleV02Brut());
    for (const condition of ["A", "B", "C", "D"] as const) {
      const conf = fabriquerConfigurationRunV02(p, condition, 9001);
      expect(conf.mode).toBe("decision_simulee");
      expect(conf.mode).not.toBe("simulation");
      expect(conf.environnementDecision).toBeDefined();
      expect(conf.politiqueBudgetCognitif).toBeDefined();
      expect(conf.xway?.fournisseur).toMatchObject({
        identifiant: "fournisseur-inference-simule",
      });
      expect(conf.mutation).toBeDefined();
      expect(conf.reproduction).toBeDefined();
      expect(conf.reproductionAutonome).toBeDefined();
      expect(conf.criteresArret).toBeDefined();
    }
  });

  it("v02 refuse fournisseur réel/réseau", () => {
    expect(() =>
      parserProtocoleEvolutionV02(
        protocoleV02Brut({
          fournisseur: {
            identifiant: "fournisseur-inference-openai" as never,
            version: "0.1.0",
            selecteur: "openai" as never,
          },
        }),
      ),
    ).toThrow(/OpenAI|réseau|interdit/);
  });

  it("v02 refuse modeleExperience mode simulation", () => {
    expect(() =>
      parserProtocoleEvolutionV02(
        protocoleV02Brut({
          modeleExperience: { mode: "simulation" },
        }),
      ),
    ).toThrow(/simulation interdit/);
  });

  it("préflight v02 passe sur protocole valide", () => {
    const p = parserProtocoleEvolutionV02(protocoleV02Brut());
    expect(() => validerPreflightCampagneEvolutionV02(p)).not.toThrow();
  });

  it("préflight v02 échoue si mode fabriqué n'est pas decision_simulee", () => {
    const p = parserProtocoleEvolutionV02(protocoleV02Brut());
    // Simule un protocole corrompu après parse (ne doit pas arriver en prod).
    const corrompu = {
      ...p,
      version: "protocole-experience-evolution-v01" as never,
    };
    expect(() => validerPreflightCampagneEvolutionV02(corrompu)).toThrow(
      PreflightEvolutionV02Erreur,
    );
  });

  it("dispatch versionné charge v01 et v02", () => {
    const v02 = chargerProtocoleCampagneEvolutionDepuisObjet(protocoleV02Brut());
    expect(v02.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02);
    const v01Path = join(
      process.cwd(),
      "experiences/protocoles/evolution-pilote-v01.json",
    );
    const brutV01 = JSON.parse(readFileSync(v01Path, "utf8")) as unknown;
    const v01 = chargerProtocoleCampagneEvolutionDepuisObjet(brutV01);
    expect(v01.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION);
  });

  it("matrice A/B/C/D : B mutation inactive, C sham taux 0, D taux > 0", () => {
    const p = parserProtocoleEvolutionV02(protocoleV02Brut());
    const confB = fabriquerConfigurationRunV02(p, "B", 9001);
    const confC = fabriquerConfigurationRunV02(p, "C", 9001);
    const confD = fabriquerConfigurationRunV02(p, "D", 9001);
    expect(confB.reproductionAutonome?.active).toBe(true);
    expect(confB.mutation?.active).toBe(false);
    expect(confC.mutation?.active).toBe(true);
    expect(confC.mutation?.tauxMutationParGeneBps).toBe(0);
    expect(confD.mutation?.active).toBe(true);
    expect(confD.mutation?.tauxMutationParGeneBps).toBe(1000);
  });

  it("v01 fabrique toujours simulation (non régressé)", () => {
    const v01Path = join(
      process.cwd(),
      "experiences/protocoles/evolution-pilote-v01.json",
    );
    const brut = JSON.parse(readFileSync(v01Path, "utf8")) as Parameters<
      typeof parserProtocoleEvolution
    >[0];
    const p = parserProtocoleEvolution(brut);
    const conf = fabriquerConfigurationRun(p, "A", 7);
    expect(conf.mode).toBe("simulation");
  });

  it("exemple couplage v02 est parsable", () => {
    const chemin = join(
      process.cwd(),
      "experiences/protocoles/evolution-couplage-v02.exemple.json",
    );
    const brut = JSON.parse(readFileSync(chemin, "utf8")) as unknown;
    const p = parserProtocoleEvolutionV02(
      brut as ProtocoleExperienceEvolutionV02Json,
    );
    expect(p.environnementDecision).toBeDefined();
    const conf = fabriquerConfigurationRunV02(p, "D", 9001);
    expect(conf.mode).toBe("decision_simulee");
  });
});
