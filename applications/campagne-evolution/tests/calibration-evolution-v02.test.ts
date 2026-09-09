/**
 * Tests calibration évolution v0.2 — critères A–G déterministes.
 * Seeds 301–305 uniquement ; jamais 1001–1020.
 */

import { describe, expect, it } from "vitest";
import {
  SEUILS_CALIBRATION_V02,
  descendanceDifferentiellePresente,
  evaluerCandidatCalibrationV02,
  estProtocoleCalibrationV02,
  extraireIdentifiantCandidatCalibration,
  type ResumeDiagnosticExposition,
  type ResumeRunEvolution,
  type ManifesteBatchEvolution,
} from "../src/index.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function fauxResume(
  surcharges: Partial<ResumeRunEvolution> & {
    condition: ResumeRunEvolution["condition"];
    seed: number;
  },
): ResumeRunEvolution {
  return {
    identifiantRun: `${surcharges.condition}-seed-${String(surcharges.seed)}`,
    identifiantBatch: "batch-test",
    empreinteProtocole: "sha256:00",
    empreinteExecutionRun: "sha256:11",
    empreinteResultatScientifique: "sha256:22",
    empreinteRun: "sha256:11",
    versionProtocole: "protocole-experience-evolution-v02",
    metaCode: { gitSha: "x", workingTreeDirty: false, source: "injecte" },
    dateLancement: "2020-01-01T00:00:00.000Z",
    statut: "termine",
    dureeMs: 1,
    cyclesExecutes: 20,
    cyclesMaximum: 20,
    venPopulationFinaleMicroUsdc: "0",
    resultatActiviteBrutCumuleMicroUsdc: "0",
    resultatApresContratCumuleMicroUsdc: "0",
    resultatApresReproductionCumuleMicroUsdc: "0",
    computeCumuleMicroUsdc: "0",
    contributionProprietaireCumuleeMicroUsdc: "0",
    populationVivanteFinale: 3,
    eteinte: false,
    cycleExtinction: null,
    naissancesCumulees: 2,
    generationMaximale: 3,
    ligneesVivantes: 2,
    descendantsCumules: 2,
    mutationsCumulees: surcharges.condition === "D" ? 2 : 0,
    configurationsDistinctesFinales: 2,
    frequencesGenotypiquesFinales: [],
    regretExAnteCumuleNumerateur: "0",
    regretExAnteCumuleDenominateur: "0",
    tauxDecisionsOptimalesExAnteBps: null,
    demandesInference: 0,
    coutCognitionMicroUsdc: "0",
    cyclesPopulationMaximaleAtteinte: 0,
    cyclesPlafondNaissancesAtteint: 0,
    runContraintParGardeFou: false,
    ...surcharges,
  };
}

function resumesValides(): ResumeRunEvolution[] {
  const out: ResumeRunEvolution[] = [];
  for (const seed of SEUILS_CALIBRATION_V02.seedsCalibrationAttendues) {
    for (const condition of ["A", "B", "C", "D"] as const) {
      out.push(
        fauxResume({
          condition,
          seed,
          empreinteResultatScientifique:
            condition === "B" || condition === "C"
              ? `sha256:bc-${String(seed)}`
              : `sha256:${condition}-${String(seed)}`,
        }),
      );
    }
  }
  return out;
}

function manifestePour(resumes: readonly ResumeRunEvolution[]): ManifesteBatchEvolution {
  return {
    version: "manifeste-batch-evolution-v01",
    identifiantBatch: "batch-test",
    identifiantProtocole: "evolution-calibration-v02-e1-01",
    empreinteProtocole: "sha256:00",
    formatsEmpreintes: {
      protocole: "empreinte-protocole-sha256-v01",
      execution: "empreinte-execution-run-sha256-v01",
      resultatScientifique: "empreinte-resultat-scientifique-sha256-v01",
    },
    mode: "calibration",
    dateLancement: "2020-01-01T00:00:00.000Z",
    metaCode: { gitSha: "x", workingTreeDirty: false, source: "injecte" },
    marqueurs: [],
    runs: resumes.map((r) => ({
      identifiantRun: r.identifiantRun,
      condition: r.condition,
      seed: r.seed,
      statut: "termine" as const,
    })),
  };
}

function diagnosticComplet(
  resumes: readonly ResumeRunEvolution[],
): ResumeDiagnosticExposition {
  const genes = [
    "seuilEnjeuPourInferenceMicroUsdc",
    "partMaxVenParCycleBps",
    "plafondCognitifMicroUsdc",
    "comportementSansInference",
  ] as const;
  return {
    version: "diagnostic-exposition-phenotypique-v02",
    identifiantBatch: "batch-test",
    identifiantProtocole: "evolution-calibration-v02-e1-01",
    runsPrevus: resumes.length,
    runsTermines: resumes.length,
    runsEchoues: 0,
    controleNegatifBcIdentique: true,
    evenementsDecisionnelsParCondition: { A: 10, B: 10, C: 10, D: 10 },
    metriquesParGene: genes.map((cle) => ({
      cleGene: cle,
      mutationsEffectives: 1,
      agentsMutants: 1,
      agentsCyclesMutants: 1,
      contextsTestes: 100,
      contextsSensiblesUnPas: 20,
      expressionsCognitives: 1,
      expressionsComportementales: 1,
      consequencesEconomiquesImmediates: 1,
      tauxSensibiliteLocale: 0.2,
      tauxExpressionMutants: 1,
      seedsAvecSensibilite: [...SEUILS_CALIBRATION_V02.seedsCalibrationAttendues],
    })),
    repartitionBornes: { part_ven: 1 },
    distributionEnjeuxObserves: { "125000": 10 },
    expressionParRun: resumes.map((r) => ({
      condition: r.condition,
      seed: r.seed,
      expressionCognitive: r.condition === "D",
      expressionComportementale: r.condition === "D" && r.seed <= 302,
      consequenceEconomiqueImmediate: r.condition === "D" && r.seed <= 302,
    })),
    criteresCouverture: {
      integriteOk: true,
      sensibiliteParGene: Object.fromEntries(
        genes.map((g) => [
          g,
          { seedsSensibles: 5, agentCyclesSensibles: 20, atteint: true },
        ]),
      ),
      couvertureGlobaleAtteinte: true,
    },
  };
}

describe("calibration-evolution-v02", () => {
  it("seeds calibration distinctes 301–305 ; jamais évaluation", () => {
    expect([...SEUILS_CALIBRATION_V02.seedsCalibrationAttendues]).toEqual([
      301, 302, 303, 304, 305,
    ]);
    for (const s of SEUILS_CALIBRATION_V02.seedsCalibrationAttendues) {
      expect(s < 1001 || s > 1020).toBe(true);
    }
    const protocole = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "experiences/protocoles/evolution-calibration-v02-e1-01.json",
        ),
        "utf8",
      ),
    ) as { seedsCalibration: number[]; seedsEvaluation: number[] };
    expect(protocole.seedsCalibration).toEqual([301, 302, 303, 304, 305]);
    expect(protocole.seedsEvaluation).toEqual([]);
  });

  it("protocole e1-01 conserve enjeux E2", () => {
    const protocole = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "experiences/protocoles/evolution-calibration-v02-e1-01.json",
        ),
        "utf8",
      ),
    ) as {
      environnementDecision: { enjeuxPossiblesMicroUsdc: string[] };
    };
    expect(protocole.environnementDecision.enjeuxPossiblesMicroUsdc).toEqual([
      "50000",
      "75000",
      "125000",
      "175000",
      "250000",
    ]);
  });

  it("descendance différentielle déterministe", () => {
    expect(
      descendanceDifferentiellePresente([
        { membresCumules: 1 },
        { membresCumules: 3 },
      ]),
    ).toBe(true);
    expect(
      descendanceDifferentiellePresente([
        { membresCumules: 2 },
        { membresCumules: 2 },
      ]),
    ).toBe(false);
    expect(descendanceDifferentiellePresente([{ membresCumules: 5 }])).toBe(
      false,
    );
  });

  it("B/C bloquant invalide immédiatement (critère A)", () => {
    const resumes = resumesValides();
    const resume = evaluerCandidatCalibrationV02({
      identifiantCandidat: "e1-01",
      manifeste: manifestePour(resumes),
      resumes,
      repertoireBatch: "/tmp/inexistant-calibration-v02",
      controleNegatifBcIdentique: false,
      diagnostic: diagnosticComplet(resumes),
      trajectoires: new Map(
        resumes.map((r) => [
          r.identifiantRun,
          [
            {
              cycle: 1,
              populationVivante: 3,
              venPopulationMicroUsdc: "0",
              capitalLiquidePopulationMicroUsdc: "0",
              revenusActiviteMicroUsdc: "0",
              pertesActiviteMicroUsdc: "0",
              computeMicroUsdc: "0",
              resultatApresContratMicroUsdc: "0",
              resultatApresReproductionMicroUsdc: "0",
              naissances: 1,
              deces: 0,
              ligneesVivantes: 2,
              generationsPresentes: [0, 1],
              mutationsCumulees: 0,
              mutationsCycle: 0,
              configurationsHeritablesDistinctes: 1,
              demandesInference: 0,
              coutCognitifMicroUsdc: "0",
              regretExAnteCumuleNumerateur: "0",
              regretExAnteCumuleDenominateur: "0",
              tauxDecisionsOptimalesExAnteBps: null,
              contributionProprietaireMicroUsdc: "0",
              eteinte: false,
              frequencesGenotypes: [],
              lignees: [
                {
                  identifiantLignee: "l1",
                  membresVivants: 1,
                  membresCumules: 1,
                  partPopulationVivanteBps: 5000,
                  generationMaximale: 0,
                },
                {
                  identifiantLignee: "l2",
                  membresVivants: 2,
                  membresCumules: 4,
                  partPopulationVivanteBps: 5000,
                  generationMaximale: 2,
                },
              ],
            },
          ],
        ]),
      ),
    });
    const a = resume.criteres.find((c) => c.identifiant === "A_INTEGRITE")!;
    expect(a.atteint).toBe(false);
    expect(resume.candidatValide).toBe(false);
  });

  it("candidat satisfaisant → valide (règle premier candidat)", () => {
    const resumes = resumesValides();
    const traj = new Map(
      resumes.map((r) => [
        r.identifiantRun,
        [
          {
            cycle: 20,
            populationVivante: 5,
            venPopulationMicroUsdc: "0",
            capitalLiquidePopulationMicroUsdc: "0",
            revenusActiviteMicroUsdc: "0",
            pertesActiviteMicroUsdc: "0",
            computeMicroUsdc: "0",
            resultatApresContratMicroUsdc: "0",
            resultatApresReproductionMicroUsdc: "0",
            naissances: 1,
            deces: 0,
            ligneesVivantes: 2,
            generationsPresentes: [0, 1, 2, 3],
            mutationsCumulees: r.mutationsCumulees,
            mutationsCycle: 0,
            configurationsHeritablesDistinctes: 2,
            demandesInference: 0,
            coutCognitifMicroUsdc: "0",
            regretExAnteCumuleNumerateur: "0",
            regretExAnteCumuleDenominateur: "0",
            tauxDecisionsOptimalesExAnteBps: null,
            contributionProprietaireMicroUsdc: "0",
            eteinte: false,
            frequencesGenotypes: [],
            lignees: [
              {
                identifiantLignee: "l1",
                membresVivants: 1,
                membresCumules: 1,
                partPopulationVivanteBps: 2000,
                generationMaximale: 0,
              },
              {
                identifiantLignee: "l2",
                membresVivants: 4,
                membresCumules: 6,
                partPopulationVivanteBps: 8000,
                generationMaximale: 3,
              },
            ],
          },
        ],
      ]),
    );
    const resume = evaluerCandidatCalibrationV02({
      identifiantCandidat: "e1-01",
      manifeste: manifestePour(resumes),
      resumes,
      repertoireBatch: "/tmp/inexistant-calibration-v02",
      controleNegatifBcIdentique: true,
      diagnostic: diagnosticComplet(resumes),
      trajectoires: traj,
    });
    expect(resume.candidatValide).toBe(true);
    expect(resume.motifInvalidation).toBeNull();
    expect(resume.runsDExpressionCognitive).toBe(5);
    expect(resume.runsDExpressionComportementOuEco).toBe(2);
  });

  it("conséquence économique sans signe favorable imposé", () => {
    // G compte les runs avec expression comportementale OU conséquence,
    // indépendamment du signe économique.
    expect(SEUILS_CALIBRATION_V02.runsDExpressionComportementOuEcoMin).toBe(2);
  });

  it("garde-fous et extinction précoce totale", () => {
    const resumes = resumesValides().map((r) =>
      r.condition === "A"
        ? r
        : {
            ...r,
            eteinte: true,
            generationMaximale: 1,
            naissancesCumulees: 0,
            runContraintParGardeFou: true,
            cyclesPopulationMaximaleAtteinte: 18,
          },
    );
    const resume = evaluerCandidatCalibrationV02({
      identifiantCandidat: "e1-01",
      manifeste: manifestePour(resumes),
      resumes,
      repertoireBatch: "/tmp/x",
      controleNegatifBcIdentique: true,
      diagnostic: diagnosticComplet(resumes),
    });
    expect(
      resume.criteres.find((c) => c.identifiant === "EXTINCTION_PRECOCE_TOTALE")!
        .atteint,
    ).toBe(false);
    expect(
      resume.criteres.find((c) => c.identifiant === "GARDE_FOUS")!.atteint,
    ).toBe(false);
  });

  it("identifiant candidat et détection protocole", () => {
    expect(estProtocoleCalibrationV02("evolution-calibration-v02-e1-01")).toBe(
      true,
    );
    expect(extraireIdentifiantCandidatCalibration("evolution-calibration-v02-e1-01")).toBe(
      "e1-01",
    );
    expect(estProtocoleCalibrationV02("evolution-diagnostic-expression-v02-e2")).toBe(
      false,
    );
  });
});
