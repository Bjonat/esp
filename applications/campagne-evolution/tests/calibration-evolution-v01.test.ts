/**
 * Tests outillage calibration évolution multi-génération v0.1 (A–K).
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculerSurvieApresCycle, estEtatMort } from "@esp/protocole";
import {
  CalibrationParametreRefuseErreur,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  appliquerSurchargeCalibration,
  assertVueCalibrationSansDC,
  appendreJournalCalibration,
  chargerProtocoleEvolutionDepuisObjet,
  collecterSeedsExecuteesDansResultats,
  compterSeedsEvaluationExecutees,
  construireProtocoleCandidatCalibration,
  empreinteProtocole,
  evaluerCandidatCalibration,
  extraireParametresExperimentauxPartages,
  extraireVueCalibration,
  fabriquerEntreeJournalCalibration,
  fabriquerResumeDepuisTrajectoire,
  identifiantRun,
  protocolesPartagentParametresExperimentaux,
  refuserSeedsEvaluationEnCalibration,
  serialiserEntreeJournalCalibration,
  type PointTrajectoireEvolution,
  type ProtocoleExperienceEvolutionV01Json,
  type ResumeRunEvolution,
  type SurchargeCalibration,
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
  const r = mkdtempSync(join(tmpdir(), "esp-cal-evo-"));
  repertoires.push(r);
  return r;
}

function protocoleBase(
  surcharges: Partial<ProtocoleExperienceEvolutionV01Json> = {},
): ProtocoleExperienceEvolutionV01Json {
  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
    identifiantProtocole: "cal-test-v01",
    mode: "calibration",
    seedsCalibration: [7, 8],
    seedsEvaluation: [1001, 1002],
    cyclesMaximum: 8,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "100000000",
    tauxMutationConditionDBps: 2500,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: "2020-01-01T00:00:00.000Z",
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-test",
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
      dotationEnfantMicroUsdc: "5000000",
      coutReproductionMicroUsdc: "1000000",
      reserveMinimaleParentMicroUsdc: "1000000",
      populationMaximale: 12,
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
      tauxMutationParGeneBps: 2500,
      versionCatalogueGenes: "genes-mutables-v01",
    },
    ...surcharges,
  };
}

function fauxResume(
  partial: Partial<ResumeRunEvolution> &
    Pick<ResumeRunEvolution, "condition" | "seed">,
): ResumeRunEvolution {
  const condition = partial.condition;
  const seed = partial.seed;
  return {
    identifiantRun: identifiantRun(condition, seed),
    identifiantBatch: "cal-t",
    condition,
    seed,
    empreinteProtocole: "sha256:p",
    empreinteExecutionRun: `sha256:exec-${condition}-${String(seed)}`,
    empreinteResultatScientifique: `sha256:sci-${condition}-${String(seed)}`,
    empreinteRun: `sha256:exec-${condition}-${String(seed)}`,
    versionProtocole: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
    metaCode: { gitSha: null, workingTreeDirty: null, source: "injecte" },
    dateLancement: "2020-01-01T00:00:00.000Z",
    statut: "termine",
    dureeMs: 1,
    cyclesExecutes: 8,
    cyclesMaximum: 8,
    venPopulationFinaleMicroUsdc: "1000",
    resultatActiviteBrutCumuleMicroUsdc: "0",
    resultatApresContratCumuleMicroUsdc: "0",
    resultatApresReproductionCumuleMicroUsdc: "0",
    computeCumuleMicroUsdc: "0",
    contributionProprietaireCumuleeMicroUsdc: "0",
    populationVivanteFinale: 2,
    eteinte: false,
    cycleExtinction: null,
    naissancesCumulees: 1,
    generationMaximale: 3,
    ligneesVivantes: 1,
    descendantsCumules: 1,
    mutationsCumulees: condition === "D" ? 2 : 0,
    configurationsDistinctesFinales: 1,
    frequencesGenotypiquesFinales: [],
    regretExAnteCumuleNumerateur: "0",
    regretExAnteCumuleDenominateur: "0",
    tauxDecisionsOptimalesExAnteBps: null,
    demandesInference: 0,
    coutCognitionMicroUsdc: "0",
    cyclesPopulationMaximaleAtteinte: 0,
    cyclesPlafondNaissancesAtteint: 0,
    runContraintParGardeFou: false,
    ...partial,
  };
}

/** Matrice A/B/C/D × 2 seeds — candidate valide par défaut. */
function resumesValides(): ResumeRunEvolution[] {
  const out: ResumeRunEvolution[] = [];
  for (const seed of [7, 8]) {
    for (const condition of ["A", "B", "C", "D"] as const) {
      out.push(
        fauxResume({
          condition,
          seed,
          generationMaximale: condition === "A" ? 0 : 4,
          naissancesCumulees: condition === "A" ? 0 : 2,
          mutationsCumulees: condition === "D" ? 3 : 0,
          eteinte: condition === "B" && seed === 7,
          cycleExtinction: condition === "B" && seed === 7 ? 5 : null,
        }),
      );
    }
  }
  return out;
}

describe("calibration-evolution-v01", () => {
  it("A — vue exclut toute métrique D-C", () => {
    const vue = extraireVueCalibration({
      resumes: resumesValides(),
      controleNegatifOk: true,
      dureeMsTotale: 42,
    });
    expect(() => assertVueCalibrationSansDC(vue)).not.toThrow();
    const texte = JSON.stringify(vue);
    expect(texte).not.toMatch(/D-C/);
    expect(texte).not.toMatch(/differenceVen/i);
    expect(texte).not.toMatch(/regretDC/i);
    expect(vue).not.toHaveProperty("differenceVen");
    expect(vue.controleNegatifOk).toBe(true);
    expect(vue.nombreRuns).toBe(8);
  });

  it("B — seedsEvaluation refusées comme actives (appliquer / builder)", () => {
    expect(() =>
      refuserSeedsEvaluationEnCalibration({
        mode: "calibration",
        seedsCalibration: [7, 8],
        seedsEvaluation: [1001, 1002],
        seedsActives: [1001, 1002],
      }),
    ).toThrow(CalibrationParametreRefuseErreur);

    const p = construireProtocoleCandidatCalibration(
      protocoleBase(),
      { cyclesMaximum: 10 },
      1,
    );
    expect(p.mode).toBe("calibration");
    expect([...p.seedsActives]).toEqual([7, 8]);
    expect([...p.seedsActives]).not.toEqual([...p.seedsEvaluation]);
    expect(() => refuserSeedsEvaluationEnCalibration(p)).not.toThrow();
  });

  it("C — B/C (contrôle négatif) échoué invalide le candidat", () => {
    const evaluation = evaluerCandidatCalibration({
      resumes: resumesValides(),
      controleNegatifOk: false,
      dureeMsTotale: 10,
    });
    expect(evaluation.decision).toBe("rejete");
    expect(evaluation.motif).toBe("CONTROLE_NEGATIF");
    expect(evaluation.vue.candidatValide).toBe(false);
    expect(evaluation.vue.motifInvalidation).toBe("CONTROLE_NEGATIF");
  });

  it("D — premier candidat satisfaisant peut être retenu", () => {
    const etape1 = evaluerCandidatCalibration({
      resumes: resumesValides(),
      controleNegatifOk: true,
      dureeMsTotale: 50,
      etape: 1,
    });
    expect(etape1.vue.candidatValide).toBe(true);
    expect(etape1.decision).toBe("candidat_suivant");

    const evaluation = evaluerCandidatCalibration({
      resumes: resumesValides(),
      controleNegatifOk: true,
      dureeMsTotale: 99,
      etape: 3,
    });
    expect(evaluation.vue.candidatValide).toBe(true);
    expect(evaluation.decision).toBe("retenu");
    expect(evaluation.vue.generationMaximaleMedianeBCD).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      evaluation.vue.fractionRunsDAvecAuMoinsUneMutation,
    ).toBeGreaterThan(0.5);
  });

  it("E — journal déterministe", () => {
    const entree = {
      identifiantCalibration: "cal-det",
      etape: 1 as const,
      parametresChanges: { cyclesMaximum: 12 } satisfies SurchargeCalibration,
      hypotheseOperationnelle: "augmenter horizon",
      criteresExamines: ["CONTROLE_NEGATIF", "GENERATION_MEDIANE_BCD"],
      resultatCriteres: {
        CONTROLE_NEGATIF: true,
        GENERATION_MEDIANE_BCD: true,
      },
      decision: "retenu" as const,
      dureeMs: 1234,
      empreinteProtocoleCandidat: "sha256:abc",
    };
    const a = serialiserEntreeJournalCalibration(entree);
    const b = serialiserEntreeJournalCalibration(entree);
    expect(a).toBe(b);
    expect(fabriquerEntreeJournalCalibration(entree)).toEqual(
      fabriquerEntreeJournalCalibration(entree),
    );

    const dir = repertoireTemp();
    const chemin = join(dir, "journal-calibration.jsonl");
    appendreJournalCalibration(chemin, entree);
    appendreJournalCalibration(chemin, { ...entree, decision: "rejete" });
    const lignes = readFileSync(chemin, "utf8").trim().split("\n");
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toBe(a);
  });

  it("F — paramètres non autorisés refusés", () => {
    expect(() =>
      appliquerSurchargeCalibration(
        protocoleBase(),
        { tauxMutationConditionDBps: 100 } as SurchargeCalibration,
        1,
      ),
    ).toThrow(/non autorisé/);

    expect(() =>
      appliquerSurchargeCalibration(
        protocoleBase(),
        // @ts-expect-error clé hors whitelist
        { capitalInitialParAgentMicroUsdc: "1" },
        3,
      ),
    ).toThrow(CalibrationParametreRefuseErreur);

    const ok = appliquerSurchargeCalibration(
      protocoleBase(),
      {
        cyclesMaximum: 12,
        populationMaximale: 20,
        nombreMaxNaissancesParCycle: 3,
      },
      1,
    );
    expect(ok.cyclesMaximum).toBe(12);
    expect(ok.reproduction.populationMaximale).toBe(20);
    expect(ok.reproductionAutonome.nombreMaxNaissancesParCycle).toBe(3);
  });

  it("G — empreinte protocole retenu stable (parse deux fois)", () => {
    const json = protocoleBase({ cyclesMaximum: 12 });
    const p1 = construireProtocoleCandidatCalibration(
      json,
      { populationMaximale: 16 },
      1,
    );
    const p2 = construireProtocoleCandidatCalibration(
      JSON.parse(JSON.stringify(json)) as ProtocoleExperienceEvolutionV01Json,
      { populationMaximale: 16 },
      1,
    );
    expect(empreinteProtocole(p1)).toBe(empreinteProtocole(p2));
    expect(empreinteProtocole(p1).startsWith("sha256:")).toBe(true);
  });

  it("H — extinction structurellement atteignable (seuils calibrés)", () => {
    // Paramètres économiques du protocole calibré v0.1 (pas une seed d'évaluation).
    const parametres = {
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
      coutOperationnelMinimalParCycleMicroUsdc: 20_000n,
    };
    const etapes: {
      capital: bigint;
      attendu: "sain" | "contraint" | "critique" | "dormant" | "mort";
    }[] = [
      { capital: 400_000n, attendu: "sain" }, // runway 20
      { capital: 200_000n, attendu: "contraint" }, // runway 10
      { capital: 60_000n, attendu: "critique" }, // runway 3
      { capital: 0n, attendu: "dormant" },
      { capital: 0n, attendu: "dormant" },
      { capital: 0n, attendu: "mort" },
    ];

    let etat = {
      etatSurvie: "sain" as const,
      cyclesDormanceConsecutifs: 0,
      capitalLiquide: 400_000n,
      obligationsDues: 0n,
    };
    const trajectoire: string[] = [etat.etatSurvie];

    for (const etape of etapes) {
      etat = {
        ...etat,
        capitalLiquide: etape.capital,
      };
      const r = calculerSurvieApresCycle(etat, parametres);
      etat = {
        etatSurvie: r.etatSurvie as typeof etat.etatSurvie,
        cyclesDormanceConsecutifs: r.cyclesDormanceConsecutifs,
        capitalLiquide: etat.capitalLiquide,
        obligationsDues: 0n,
      };
      trajectoire.push(r.etatSurvie);
      expect(r.etatSurvie).toBe(etape.attendu);
    }

    expect(trajectoire).toEqual([
      "sain",
      "sain",
      "contraint",
      "critique",
      "dormant",
      "dormant",
      "mort",
    ]);
    expect(estEtatMort("mort")).toBe(true);
  });

  it("I — population totalement morte détectée comme éteinte", () => {
    const vivant = pointTrajectoireMinimal({
      cycle: 1,
      populationVivante: 2,
      eteinte: false,
    });
    const mort = pointTrajectoireMinimal({
      cycle: 2,
      populationVivante: 0,
      eteinte: true,
      deces: 2,
    });
    const resume = fabriquerResumeDepuisTrajectoire({
      identifiantRun: "B-seed-7",
      identifiantBatch: "audit-ext",
      condition: "B",
      seed: 7,
      empreinteProtocole: "sha256:p",
      empreinteExecutionRun: "sha256:e",
      versionProtocole: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
      metaCode: { gitSha: null, workingTreeDirty: null, source: "injecte" },
      dateLancement: "2020-01-01T00:00:00.000Z",
      dureeMs: 1,
      cyclesMaximum: 2,
      points: [vivant, mort],
      cyclesPopulationMaximaleAtteinte: 0,
      cyclesPlafondNaissancesAtteint: 0,
    });
    expect(resume.eteinte).toBe(true);
    expect(resume.cycleExtinction).toBe(2);
    expect(resume.populationVivanteFinale).toBe(0);
  });

  it("J — aucun artefact évaluation dans calibration", () => {
    const seedsEval = [1001, 1002, 1020];
    const dir = repertoireTemp();
    mkdirSync(join(dir, "batch", "runs", "A-seed-101"), { recursive: true });
    mkdirSync(join(dir, "batch", "runs", "D-seed-105"), { recursive: true });
    expect(
      compterSeedsEvaluationExecutees({
        repertoireResultats: dir,
        seedsEvaluation: seedsEval,
      }),
    ).toBe(0);

    mkdirSync(join(dir, "batch", "runs", "A-seed-1001"), { recursive: true });
    expect(
      compterSeedsEvaluationExecutees({
        repertoireResultats: dir,
        seedsEvaluation: seedsEval,
      }),
    ).toBe(1);

    // Artefacts versionnés / résultats locaux de cette calibration.
    const journal = join(
      process.cwd(),
      "experiences/calibration/evolution-v01/journal-calibration.jsonl",
    );
    if (existsSync(journal)) {
      const texte = readFileSync(journal, "utf8");
      for (const s of [1001, 1002, 1010, 1020]) {
        expect(texte.includes(`"seed":${String(s)}`)).toBe(false);
        expect(texte.includes(`seed-${String(s)}`)).toBe(false);
      }
    }
    const resultatsCalib = join(process.cwd(), "experiences/resultats/calibration");
    if (existsSync(resultatsCalib)) {
      expect(
        compterSeedsEvaluationExecutees({
          repertoireResultats: resultatsCalib,
          seedsEvaluation: [
            1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011,
            1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020,
          ],
        }),
      ).toBe(0);
      const seeds = collecterSeedsExecuteesDansResultats(resultatsCalib);
      expect(seeds.every((s) => s >= 101 && s <= 105)).toBe(true);
    }
  });

  it("K — protocole evaluation reprend les paramètres calibrés autorisés", () => {
    const cheminCalib = join(
      process.cwd(),
      "experiences/protocoles/evolution-calibree-v01.json",
    );
    const cheminEval = join(
      process.cwd(),
      "experiences/protocoles/evolution-evaluation-v01.json",
    );
    expect(existsSync(cheminCalib)).toBe(true);
    expect(existsSync(cheminEval)).toBe(true);
    const calib = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(cheminCalib, "utf8")),
    );
    const evalp = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(cheminEval, "utf8")),
    );
    expect(calib.mode).toBe("calibration");
    expect(evalp.mode).toBe("evaluation");
    expect(protocolesPartagentParametresExperimentaux(calib, evalp)).toBe(true);

    const p = extraireParametresExperimentauxPartages(calib);
    expect(p.cyclesMaximum).toBe(20);
    expect(p.populationMaximale).toBe(24);
    expect(p.nombreMaxNaissancesParCycle).toBe(4);
    expect(p.dotationEnfantMicroUsdc).toBe("800000");
    expect(p.coutReproductionMicroUsdc).toBe("200000");
    expect(p.reserveMinimaleParentMicroUsdc).toBe("400000");
    expect(p.tauxMutationConditionDBps).toBe(1000);
    expect(p.tauxMutationParGeneBps).toBe(1000);
    expect([...calib.seedsActives]).toEqual([101, 102, 103, 104, 105]);
    expect([...evalp.seedsActives]).toEqual(evalp.seedsEvaluation);
    expect(evalp.seedsEvaluation).not.toEqual(calib.seedsActives);
  });
});

function pointTrajectoireMinimal(
  partial: Partial<PointTrajectoireEvolution> &
    Pick<PointTrajectoireEvolution, "cycle" | "populationVivante" | "eteinte">,
): PointTrajectoireEvolution {
  return {
    cycle: partial.cycle,
    populationTotale: partial.populationVivante,
    populationVivante: partial.populationVivante,
    venPopulationMicroUsdc: "0",
    capitalLiquidePopulationMicroUsdc: "0",
    revenusActiviteMicroUsdc: "0",
    pertesActiviteMicroUsdc: "0",
    computeMicroUsdc: "0",
    donneesMicroUsdc: "0",
    fraisExecutionMicroUsdc: "0",
    loyersMicroUsdc: "0",
    redevancesMicroUsdc: "0",
    coutsReproductionMicroUsdc: "0",
    resultatApresContratMicroUsdc: "0",
    resultatApresReproductionMicroUsdc: "0",
    naissances: 0,
    deces: partial.deces ?? 0,
    generationsPresentes: partial.populationVivante > 0 ? [0] : [],
    ligneesVivantes: partial.populationVivante > 0 ? 1 : 0,
    configurationsHeritablesDistinctes: 0,
    mutationsCumulees: 0,
    mutationsCycle: 0,
    demandesInference: 0,
    coutCognitifMicroUsdc: "0",
    regretExAnteCumuleNumerateur: "0",
    regretExAnteCumuleDenominateur: "0",
    tauxDecisionsOptimalesExAnteBps: null,
    contributionProprietaireMicroUsdc: "0",
    eteinte: partial.eteinte,
    frequencesGenotypes: [],
    lignees: [],
    ...partial,
  };
}
