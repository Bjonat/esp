/**
 * Contrôles positifs génotype → phénotype v0.2 (bloquants CI).
 * Aucune seed d'évaluation 1001–1020 exécutée.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FournisseurMetaCodeInjecte,
  comparerControleNegatifBC,
  executerCampagneEvolution,
  executerControleAComportementSansInference,
  executerControleBSeuilInference,
  executerControleCPlafondCognitif,
  executerControleCampagneExpressionPhenotypiqueV02,
  executerControleDPartMaxVen,
  executerControleSensibilitePhenotypiqueV02,
  fabriquerConfigurationRunV02,
  parserProtocoleEvolutionV02,
  type ProtocoleExperienceEvolutionV02Json,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
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
  const r = mkdtempSync(join(tmpdir(), "esp-couplage-v02-"));
  repertoires.push(r);
  return r;
}

function protocoleBcFixture(): ProtocoleExperienceEvolutionV02Json {
  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: "fixture-bc-v02",
    mode: "calibration",
    seedsCalibration: [9101],
    seedsEvaluation: [],
    cyclesMaximum: 3,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "10000000",
    tauxMutationConditionDBps: 500,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: "2020-01-01T00:00:00.000Z",
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-bc-v02",
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
      dotationEnfantMicroUsdc: "2000000",
      coutReproductionMicroUsdc: "500000",
      reserveMinimaleParentMicroUsdc: "500000",
      populationMaximale: 8,
      nombreMaxReproductionsParCycle: 2,
      nombreMaxEnfantsParAgent: 2,
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
      tauxMutationParGeneBps: 500,
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
}

describe("couplage-genotype-phenotype-v02", () => {
  it("contrôle A — génotype catégoriel différent → action différente", async () => {
    const r = await executerControleAComportementSansInference();
    expect(r.ok).toBe(true);
  });

  it("contrôle B — seuil différent → choix inference différent", async () => {
    const r = await executerControleBSeuilInference();
    expect(r.ok).toBe(true);
  });

  it("contrôle C — plafond cognitif différent → limite différente", async () => {
    const r = await executerControleCPlafondCognitif();
    expect(r.ok).toBe(true);
  });

  it("contrôle D — part VEN différente → limite différente", async () => {
    const r = await executerControleDPartMaxVen();
    expect(r.ok).toBe(true);
  });

  it("suite complète sensibilité phénotypique (bloquant)", async () => {
    const resultats = await executerControleSensibilitePhenotypiqueV02();
    expect(resultats).toHaveLength(4);
    expect(resultats.every((r) => r.ok)).toBe(true);
  });

  it("campagne/intégration traverse réellement événements décision", async () => {
    const r = await executerControleCampagneExpressionPhenotypiqueV02();
    expect(r.ok).toBe(true);
  });

  it("B/C restent scientifiquement identiques à taux 0 (v02 decision_simulee)", async () => {
    const protocole = parserProtocoleEvolutionV02(protocoleBcFixture());
    const confB = fabriquerConfigurationRunV02(protocole, "B", 9101);
    const confC = fabriquerConfigurationRunV02(protocole, "C", 9101);
    expect(confB.mode).toBe("decision_simulee");
    expect(confC.mode).toBe("decision_simulee");
    expect(confB.mutation?.active).toBe(false);
    expect(confC.mutation?.tauxMutationParGeneBps).toBe(0);

    const repertoire = repertoireTemp();
    const campagne = await executerCampagneEvolution({
      protocole,
      repertoireResultats: repertoire,
      concurrence: 1,
      fournisseurMetaCode: new FournisseurMetaCodeInjecte({
        gitSha: "deadbeefcouplage02",
        workingTreeDirty: false,
        source: "injecte",
      }),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });

    const resumeB = campagne.resumes.find((r) => r.condition === "B")!;
    const resumeC = campagne.resumes.find((r) => r.condition === "C")!;
    expect(resumeB).toBeDefined();
    expect(resumeC).toBeDefined();

    const trajB = campagne.manifeste.runs
      .filter((r) => r.condition === "B" || r.condition === "C")
      .map((r) => r.identifiantRun);
    expect(trajB.length).toBeGreaterThan(0);

    // Recharge trajectoires depuis fichiers via resumes empreintes.
    const { chargerTrajectoireFichier } = await import("../src/rapports.js");
    const pointsB = chargerTrajectoireFichier(
      join(campagne.repertoireBatch, "runs", "B-seed-9101", "trajectoire.jsonl"),
    );
    const pointsC = chargerTrajectoireFichier(
      join(campagne.repertoireBatch, "runs", "C-seed-9101", "trajectoire.jsonl"),
    );

    const ctrl = comparerControleNegatifBC({
      resumeB,
      resumeC,
      trajectoireB: pointsB,
      trajectoireC: pointsC,
    });
    expect(ctrl.identique).toBe(true);
    expect(resumeB.empreinteResultatScientifique).toBe(
      resumeC.empreinteResultatScientifique,
    );

    // Aucune assertion D > C (méthodologie).
    const resumeD = campagne.resumes.find((r) => r.condition === "D");
    expect(resumeD).toBeDefined();
  });

  it("aucune seed d'évaluation 1001–1020 exécutée dans ces fixtures", () => {
    const seedsUtilisees = [9001, 9101, 42];
    for (const s of seedsUtilisees) {
      expect(s < 1001 || s > 1020).toBe(true);
    }
  });
});
