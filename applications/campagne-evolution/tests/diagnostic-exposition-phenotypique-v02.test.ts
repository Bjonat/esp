/**
 * Tests déterministes — diagnostic exposition phénotypique v0.2.
 * Seeds artificielles uniquement (jamais 1001–1020).
 */

import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EtatEconomiqueAgent, ObservationOpportunite } from "@esp/protocole";
import {
  classifierBornesCognitives,
} from "../src/diagnostic-bornes-cognitives.js";
import {
  evaluerChoixSec,
  executerContrefactuelUnGene,
  voisinsUnPasGene,
} from "../src/diagnostic-contrefactuel-un-gene.js";
import {
  CRITERES_COUVERTURE_DIAGNOSTIC_V02,
  genererDiagnosticExpositionPhenotypique,
} from "../src/diagnostic-exposition-phenotypique-v02.js";
import {
  FournisseurMetaCodeInjecte,
  executerCampagneEvolution,
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
  const r = mkdtempSync(join(tmpdir(), "esp-diag-expo-"));
  repertoires.push(r);
  return r;
}

const POLITIQUE = {
  identifiant: "politique-budget-cognitif-agent" as const,
  version: "0.1.0",
  seuilEnjeuPourInferenceMicroUsdc: 100_000n,
  partMaxVenParCycleBps: 50,
  plafondCognitifMicroUsdc: 10_000n,
  modeleLogique: "modele_standard",
  comportementSansInference: "agir_si_favorable" as const,
  refuserSiCritiqueOuDormant: true,
};

function etatVen(ven: bigint): EtatEconomiqueAgent {
  return {
    identifiantAgent: "agent-diag",
    capitalLiquide: ven,
    obligationsDues: 0n,
    highWaterMarkProprietaire: ven,
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
  };
}

function observation(options: {
  readonly enjeuGain?: bigint;
  readonly p?: number;
}): ObservationOpportunite {
  return {
    identifiantObservation: "obs-diag",
    identifiantAgent: "agent-diag",
    numeroCycle: 1,
    typeObservation: "opportunite_simulee",
    probabiliteSuccesBps: options.p ?? 8000,
    gainSiSuccesMicroUsdc: options.enjeuGain ?? 125_000n,
    perteSiEchecMicroUsdc: 50_000n,
    fraisActionMicroUsdc: 1_000n,
    description: "obs test",
    actionsAutorisees: ["attendre", "agir"],
  };
}

describe("diagnostic-exposition-phenotypique-v02", () => {
  it("voisins ±1 pas respectent le catalogue", () => {
    const seuils = voisinsUnPasGene("seuilEnjeuPourInferenceMicroUsdc", "100000");
    expect(seuils.map((v) => v.valeur).sort()).toEqual(["150000", "50000"]);
    const parts = voisinsUnPasGene("partMaxVenParCycleBps", 50);
    expect(parts.map((v) => v.valeur).sort()).toEqual([25, 75]);
    const plafonds = voisinsUnPasGene("plafondCognitifMicroUsdc", "10000");
    expect(plafonds.map((v) => v.valeur).sort()).toEqual(["15000", "5000"]);
    const cat = voisinsUnPasGene("comportementSansInference", "agir_si_favorable");
    expect(cat).toHaveLength(1);
    expect(cat[0]!.valeur).toBe("attendre");
  });

  it("réversion un-gène : comportement sans inférence → actions divergentes", () => {
    const obs = observation({ p: 8000, enjeuGain: 125_000n });
    // seuil haut → sans inférence
    const politique = {
      ...POLITIQUE,
      seuilEnjeuPourInferenceMicroUsdc: 200_000n,
    };
    const r = executerContrefactuelUnGene({
      cleGene: "comportementSansInference",
      typeContrefactuel: "reversion",
      valeurContrefactuelle: "attendre",
      politiqueBase: politique,
      parametresReels: {
        seuilEnjeuPourInferenceMicroUsdc: "200000",
        partMaxVenParCycleBps: 50,
        plafondCognitifMicroUsdc: "10000",
        comportementSansInference: "agir_si_favorable",
      },
      etatEconomique: etatVen(8_000_000n),
      observation: obs,
      coutOperationnelMinimalParCycleMicroUsdc: 1_000n,
    });
    expect(r.evenementsEconomiquesEcrits).toBe(0);
    expect(r.expressionComportementale).toBe(true);
    expect(r.choixReel.action).toBe("agir");
    expect(r.choixContrefactuel.action).toBe("attendre");
  });

  it("sensibilité ±1 pas seuil : enjeu entre seuils → utiliserInference diverge", () => {
    const obs = observation({ enjeuGain: 125_000n });
    const r = executerContrefactuelUnGene({
      cleGene: "seuilEnjeuPourInferenceMicroUsdc",
      typeContrefactuel: "sensibilite_locale",
      valeurContrefactuelle: "150000",
      politiqueBase: POLITIQUE,
      parametresReels: {
        seuilEnjeuPourInferenceMicroUsdc: "100000",
        partMaxVenParCycleBps: 50,
        plafondCognitifMicroUsdc: "10000",
        comportementSansInference: "attendre",
      },
      etatEconomique: etatVen(8_000_000n),
      observation: obs,
      coutOperationnelMinimalParCycleMicroUsdc: 1_000n,
    });
    expect(r.expressionCognitive).toBe(true);
    expect(r.choixReel.utiliserInference).toBe(true);
    expect(r.choixContrefactuel.utiliserInference).toBe(false);
    expect(r.evenementsEconomiquesEcrits).toBe(0);
  });

  it("borne part VEN active quand VEN basse", () => {
    const obs = observation({ enjeuGain: 200_000n });
    const classif = classifierBornesCognitives({
      etatEconomique: etatVen(1_000_000n),
      observation: obs,
      configuration: {
        ...POLITIQUE,
        partMaxVenParCycleBps: 50,
        plafondCognitifMicroUsdc: 100_000n,
      },
      plafondXwayMicroUsdc: 50_000n,
    });
    // part = 5000 ; plafond 100000 ; xway 50000 ; ven 1000000 → min = part 5000
    expect(classif.borneDominante).toBe("part_ven");
    expect(classif.limiteFinaleMicroUsdc).toBe("5000");
  });

  it("borne plafond cognitif active quand part × VEN > plafond", () => {
    const obs = observation({ enjeuGain: 200_000n });
    const classif = classifierBornesCognitives({
      etatEconomique: etatVen(8_000_000n),
      observation: obs,
      configuration: {
        ...POLITIQUE,
        partMaxVenParCycleBps: 50,
        plafondCognitifMicroUsdc: 10_000n,
      },
      plafondXwayMicroUsdc: 50_000n,
    });
    // part = 40000 ; plafond 10000 → plafond
    expect(classif.borneDominante).toBe("plafond_cognitif");
  });

  it("égalité de bornes enregistrée explicitement", () => {
    const obs = observation({ enjeuGain: 200_000n });
    // part 50 bps × 2_000_000 = 10_000 = plafond
    const classif = classifierBornesCognitives({
      etatEconomique: etatVen(2_000_000n),
      observation: obs,
      configuration: {
        ...POLITIQUE,
        partMaxVenParCycleBps: 50,
        plafondCognitifMicroUsdc: 10_000n,
      },
    });
    expect(classif.borneDominante).toBe("egalite");
    expect(classif.bornesCoLimitantes).toContain("part_ven");
    expect(classif.bornesCoLimitantes).toContain("plafond_cognitif");
  });

  it("comportement sans inférence : EV positive vs non positive", () => {
    const politique = {
      ...POLITIQUE,
      seuilEnjeuPourInferenceMicroUsdc: 1_000_000n,
    };
    const choixPos = evaluerChoixSec({
      etatEconomique: etatVen(8_000_000n),
      observation: observation({ p: 8000, enjeuGain: 125_000n }),
      politique,
      coutOperationnelMinimalParCycleMicroUsdc: 1_000n,
    });
    expect(choixPos.utiliserInference).toBe(false);
    expect(choixPos.action).toBe("agir");

    const choixNeg = evaluerChoixSec({
      etatEconomique: etatVen(8_000_000n),
      observation: observation({ p: 1000, enjeuGain: 125_000n }),
      politique: {
        ...politique,
        comportementSansInference: "agir_si_favorable",
      },
      coutOperationnelMinimalParCycleMicroUsdc: 1_000n,
    });
    expect(choixNeg.action).toBe("attendre");
  });

  it("dénominateur nul → taux null", () => {
    expect(CRITERES_COUVERTURE_DIAGNOSTIC_V02.seedsSensiblesMinimumParGene).toBe(
      3,
    );
    // tauxOuNull testé via métriques d'un batch vide synthétique
    const repertoire = repertoireTemp();
    const manifeste = {
      version: "manifeste-batch-evolution-v01" as const,
      identifiantBatch: "batch-vide",
      identifiantProtocole: "test",
      empreinteProtocole: "sha256:00",
      formatsEmpreintes: {
        protocole: "empreinte-protocole-sha256-v01" as const,
        execution: "empreinte-execution-run-sha256-v01" as const,
        resultatScientifique: "empreinte-resultat-scientifique-sha256-v01" as const,
      },
      mode: "calibration" as const,
      dateLancement: "2020-01-01T00:00:00.000Z",
      metaCode: {
        gitSha: "x",
        workingTreeDirty: false,
        source: "injecte" as const,
      },
      marqueurs: [],
      runs: [],
    };
    const resume = genererDiagnosticExpositionPhenotypique({
      repertoireBatch: repertoire,
      manifeste,
      resumes: [],
      controleNegatifBcIdentique: true,
    });
    for (const m of resume.metriquesParGene) {
      expect(m.tauxSensibiliteLocale).toBeNull();
      expect(m.tauxExpressionMutants).toBeNull();
    }
  });

  it("critères couverture figés avant exécution", () => {
    expect(CRITERES_COUVERTURE_DIAGNOSTIC_V02).toEqual({
      seedsSensiblesMinimumParGene: 3,
      seedsTotal: 5,
      agentCyclesSensiblesMinimumParGene: 10,
    });
  });

  it("micro-campagne diagnostic courte : B/C identiques + artefacts", async () => {
    const protocoleBrut: ProtocoleExperienceEvolutionV02Json = {
      version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
      identifiantProtocole: "fixture-diag-court-v02",
      mode: "calibration",
      seedsCalibration: [211],
      seedsEvaluation: [],
      cyclesMaximum: 2,
      populationInitiale: 2,
      capitalInitialParAgentMicroUsdc: "8000000",
      tauxMutationConditionDBps: 500,
      conditions: ["A", "B", "C", "D"],
      dateLancementFixe: "2020-01-01T00:00:00.000Z",
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: "0.1.0",
        selecteur: "simule",
      },
      parametresEconomiques: {
        version: "demo-diag-court",
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
    const protocole = parserProtocoleEvolutionV02(protocoleBrut);
    const repertoire = repertoireTemp();
    const campagne = await executerCampagneEvolution({
      protocole,
      repertoireResultats: repertoire,
      concurrence: 1,
      fournisseurMetaCode: new FournisseurMetaCodeInjecte({
        gitSha: "diagexpo01",
        workingTreeDirty: false,
        source: "injecte",
      }),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });

    const resumeB = campagne.resumes.find((r) => r.condition === "B")!;
    const resumeC = campagne.resumes.find((r) => r.condition === "C")!;
    expect(resumeB.empreinteResultatScientifique).toBe(
      resumeC.empreinteResultatScientifique,
    );

    const dirDiag = join(
      campagne.repertoireBatch,
      "diagnostic-exposition",
    );
    expect(existsSync(join(dirDiag, "resume-diagnostic-expression.json"))).toBe(
      true,
    );
    expect(existsSync(join(dirDiag, "rapport-diagnostic-expression.md"))).toBe(
      true,
    );
    expect(
      existsSync(join(dirDiag, "diagnostic-expression-phenotypique.csv")),
    ).toBe(true);

    const resumeDiag = JSON.parse(
      readFileSync(join(dirDiag, "resume-diagnostic-expression.json"), "utf8"),
    ) as { controleNegatifBcIdentique: boolean; runsEchoues: number };
    expect(resumeDiag.controleNegatifBcIdentique).toBe(true);
    expect(resumeDiag.runsEchoues).toBe(0);

    // Seeds d'évaluation non utilisées
    expect(protocole.seedsActives).toEqual([211]);
    expect(protocole.seedsActives.every((s) => s < 1001 || s > 1020)).toBe(
      true,
    );
  }, 60_000);
});
