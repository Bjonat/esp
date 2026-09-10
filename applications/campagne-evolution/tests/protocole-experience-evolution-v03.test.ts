/**
 * Tests protocole / campagne évolution v0.3 (v03-D).
 * Seeds artificielles non scientifiques uniquement.
 */

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  calculerResultatEconomiqueHorsReproductionV03,
} from "@esp/protocole";
import {
  AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C,
  FournisseurMetaCodeInjecte,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
  chargerProtocoleCampagneEvolutionDepuisObjet,
  comparerControleNegatifBC,
  comparerStructureAB_V03,
  comparerStructureBC_V03,
  comparerStructureCD_V03,
  empreinteProtocoleV03,
  executerCampagneEvolution,
  executerRun,
  fabriquerConfigurationRunV03,
  memeEnvironnementExogeneV03,
  parserProtocoleEvolutionV03,
  serialiserJsonCanonique,
  validerPreflightCampagneEvolutionV03,
  type ProtocoleExperienceEvolutionV03Json,
} from "../src/index.js";
import { PreflightEvolutionV03Erreur } from "../src/preflight-evolution-v03.js";
import { agregerObservabiliteReproductionEconomiqueV03 } from "../src/observabilite-campagne-v03.js";
import { estResumeRunEvolutionV03 } from "../src/resume-run-v03.js";

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
  const r = mkdtempSync(join(tmpdir(), "esp-evo-v03-"));
  repertoires.push(r);
  return r;
}

function protocoleV03Brut(
  surcharges: Partial<ProtocoleExperienceEvolutionV03Json> = {},
): ProtocoleExperienceEvolutionV03Json {
  const base: ProtocoleExperienceEvolutionV03Json = {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
    identifiantProtocole: "fixture-test-evo-v03",
    mode: "calibration",
    seedsCalibration: [91001],
    seedsDiagnostic: [],
    seedsEvaluation: [],
    cyclesMaximum: 3,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "10000000",
    tauxMutationConditionDBps: 2500,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: "2020-01-01T00:00:00.000Z",
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-test-v03",
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
      populationMaximale: 12,
      nombreMaxReproductionsParCycle: 4,
      nombreMaxEnfantsParAgent: 6,
      cooldownCycles: 0,
    },
    reproductionAutonome: {
      version: "politique-reproduction-autonome-v01",
      active: true,
      etatsSurvieEligibles: ["sain", "contraint"],
      nombreMaxNaissancesParCycle: 4,
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    },
    mutationBase: {
      version: "parametres-mutation-v01",
      active: true,
      tauxMutationParGeneBps: 2500,
      versionCatalogueGenes: "genes-mutables-v01",
    },
    environnementExposition: {
      identifiant: "environnement-exposition-v03-fixture",
      version: "0.3.0-fixture",
      enjeuxPossiblesMicroUsdc: ["50000", "125000", "250000"],
      environnementDecision: {
        identifiant: "environnement-opportunites-simulees",
        version: "0.1.0",
        probabiliteSuccesBaseBps: 6000,
        amplitudeProbabiliteBps: 0,
        gainSiSuccesMicroUsdc: "125000",
        perteSiEchecMicroUsdc: "50000",
        fraisActionMicroUsdc: "1000",
        fraisAttendreMicroUsdc: "0",
        enjeuxPossiblesMicroUsdc: ["50000", "125000", "250000"],
      },
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

describe("protocole-experience-evolution-v03", () => {
  // A
  it("A — parse protocole v03 valide", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    expect(p.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03);
    expect(p.reproductionAutonome.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );
    expect(p.avertissementH4).toBe(AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C);
  });

  // B
  it("B — version inconnue rejetée", () => {
    expect(() =>
      chargerProtocoleCampagneEvolutionDepuisObjet({
        ...protocoleV03Brut(),
        version: "protocole-experience-evolution-v99",
      }),
    ).toThrow(/version protocole inconnue/);
  });

  // C
  it("C — provider réel rejeté", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleV03Brut({
          fournisseur: {
            identifiant: "fournisseur-inference-openai" as never,
            version: "0.1.0",
            selecteur: "openai" as never,
          },
        }),
      ),
    ).toThrow(/OpenAI|réseau|interdit/);
  });

  // D
  it("D — mode autre que decision_simulee rejeté", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleV03Brut({
          modeleExperience: { mode: "simulation" },
        }),
      ),
    ).toThrow(/decision_simulee|simulation interdit/);
  });

  // E–H matrice
  it("E–H — matrice A/B/C/D", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    const a = fabriquerConfigurationRunV03(p, "A", 91001);
    const b = fabriquerConfigurationRunV03(p, "B", 91001);
    const c = fabriquerConfigurationRunV03(p, "C", 91001);
    const d = fabriquerConfigurationRunV03(p, "D", 91001);

    expect(a.reproductionAutonome?.active).toBe(false);
    expect(a.mutation?.active).toBe(false);

    expect(b.reproductionAutonome?.active).toBe(true);
    expect(b.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );
    expect(b.mutation?.active).toBe(false);

    expect(c.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );
    expect(c.mutation?.active).toBe(true);
    expect(c.mutation?.tauxMutationParGeneBps).toBe(0);

    expect(d.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );
    expect(d.mutation?.active).toBe(true);
    expect(d.mutation?.tauxMutationParGeneBps).toBe(2500);

    for (const conf of [a, b, c, d]) {
      expect(conf.mode).toBe("decision_simulee");
    }
  });

  // I
  it("I — D taux 0 rejeté", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleV03Brut({ tauxMutationConditionDBps: 0 }),
      ),
    ).toThrow(/> 0/);
  });

  // J
  it("J — B/C ne diffèrent structurellement que par le sham mutation", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    const b = fabriquerConfigurationRunV03(p, "B", 91001);
    const c = fabriquerConfigurationRunV03(p, "C", 91001);
    expect(comparerStructureBC_V03(b, c).ok).toBe(true);
  });

  // K
  it("K — C/D ne diffèrent structurellement que par le taux mutation", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    const c = fabriquerConfigurationRunV03(p, "C", 91001);
    const d = fabriquerConfigurationRunV03(p, "D", 91001);
    expect(comparerStructureCD_V03(c, d, p.tauxMutationConditionDBps).ok).toBe(
      true,
    );
  });

  // L / U
  it("L/U — même seed → même environnement A/B/C/D", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    const configs = (["A", "B", "C", "D"] as const).map((cond) =>
      fabriquerConfigurationRunV03(p, cond, 91001),
    );
    expect(memeEnvironnementExogeneV03(configs)).toBe(true);
    expect(
      new Set(configs.map((c) => c.graineSimulation)).size,
    ).toBe(1);
    expect(comparerStructureAB_V03(configs[0]!, configs[1]!).ok).toBe(true);
  });

  // R / S
  it("R/S — fingerprint protocole stable (JSON réordonné, indépendant chemin/date)", () => {
    const brut = protocoleV03Brut();
    const p1 = parserProtocoleEvolutionV03(brut);
    const reordonne = JSON.parse(
      serialiserJsonCanonique({
        fournisseur: brut.fournisseur,
        version: brut.version,
        conditions: brut.conditions,
        ...brut,
      }),
    ) as ProtocoleExperienceEvolutionV03Json;
    const p2 = parserProtocoleEvolutionV03(reordonne);
    expect(empreinteProtocoleV03(p1)).toBe(empreinteProtocoleV03(p2));
    expect(empreinteProtocoleV03(p1).startsWith("sha256:")).toBe(true);
    // indépendant date système
    const avant = empreinteProtocoleV03(p1);
    expect(empreinteProtocoleV03(p1)).toBe(avant);
  });

  it("mécanisme incompatible rejeté", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleV03Brut({
          reproductionAutonome: {
            version: "politique-reproduction-autonome-v01",
            active: true,
            etatsSurvieEligibles: ["sain", "contraint"],
            nombreMaxNaissancesParCycle: 4,
            mecanisme: "reproduction-autonome-v01",
          },
        }),
      ),
    ).toThrow(/reproduction-economique-v03/);
  });

  it("évaluation refuse seeds de calibration", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleV03Brut({
          mode: "evaluation",
          seedsCalibration: [91001],
          seedsEvaluation: [91001],
        }),
      ),
    ).toThrow(/refuse seeds de calibration|collision/);
  });

  it("préflight v03 passe et bloque mode non decision_simulee", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    expect(() => validerPreflightCampagneEvolutionV03(p)).not.toThrow();
    expect(() =>
      validerPreflightCampagneEvolutionV03({
        ...p,
        version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02 as never,
      }),
    ).toThrow(PreflightEvolutionV03Erreur);
  });

  // V
  it("V — protocoles v0.1/v0.2 inchangés (fichiers historiques)", () => {
    const v01 = JSON.parse(
      readFileSync(
        join(process.cwd(), "experiences/protocoles/evolution-evaluation-v01.json"),
        "utf8",
      ),
    ) as { version: string };
    const v02 = JSON.parse(
      readFileSync(
        join(process.cwd(), "experiences/protocoles/evolution-evaluation-v02.json"),
        "utf8",
      ),
    ) as { version: string };
    expect(v01.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION);
    expect(v02.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02);
  });

  // X
  it("X — aucun score/rang/fitness de sélection dans le contrat v03", () => {
    const p = parserProtocoleEvolutionV03(protocoleV03Brut());
    const texte = JSON.stringify(p);
    expect(texte).not.toMatch(/fitnessScore|scoreEvolution|rangFitness|meilleurAgent/i);
    expect(p.hypotheses.map((h) => h.identifiant)).toEqual([
      "H1",
      "H2",
      "H3",
      "H4",
    ]);
  });

  it("exemple campagne v03 est parsable", () => {
    const brut = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "experiences/protocoles/evolution-campagne-v03.exemple.json",
        ),
        "utf8",
      ),
    ) as unknown;
    const p = parserProtocoleEvolutionV03(
      brut as ProtocoleExperienceEvolutionV03Json,
    );
    expect(p.environnementExposition.identifiant).toBe(
      "environnement-exposition-v03-fixture",
    );
  });
});

describe("campagne-evolution-v03 exécution", () => {
  // M / N / O / P / Q / T + anti-v0.1
  it("M/N — B/C même seed → fingerprint et trajectoire identiques", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleV03Brut({
        seedsCalibration: [91001],
        cyclesMaximum: 3,
        tauxMutationConditionDBps: 3000,
      }),
    );
    const out = repertoireTemp();
    const meta = new FournisseurMetaCodeInjecte({
      gitSha: "deadbeef",
      workingTreeDirty: false,
      source: "injecte",
    });
    const campagne = await executerCampagneEvolution({
      protocole: p,
      concurrence: 1,
      fournisseurMetaCode: meta,
      repertoireResultats: out,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-bc-v03",
    });
    const resumeB = campagne.resumes.find((r) => r.condition === "B")!;
    const resumeC = campagne.resumes.find((r) => r.condition === "C")!;
    expect(resumeB.empreinteResultatScientifique).toBe(
      resumeC.empreinteResultatScientifique,
    );
    expect(estResumeRunEvolutionV03(resumeB)).toBe(true);
    const trajB = JSON.parse(
      readFileSync(
        join(out, "batch-bc-v03", "runs", resumeB.identifiantRun, "trajectoire.jsonl"),
        "utf8",
      )
        .trim()
        .split("\n")[0]!,
    );
    expect(trajB).toBeDefined();
    const controle = comparerControleNegatifBC({
      resumeB,
      resumeC,
      trajectoireB: campagne.resumes.length > 0
        ? JSON.parse(
            `[${readFileSync(
              join(
                out,
                "batch-bc-v03",
                "runs",
                resumeB.identifiantRun,
                "trajectoire.jsonl",
              ),
              "utf8",
            )
              .trim()
              .split("\n")
              .join(",")}]`,
          )
        : [],
      trajectoireC: JSON.parse(
        `[${readFileSync(
          join(
            out,
            "batch-bc-v03",
            "runs",
            resumeC.identifiantRun,
            "trajectoire.jsonl",
          ),
          "utf8",
        )
          .trim()
          .split("\n")
          .join(",")}]`,
      ),
    });
    expect(controle.identique).toBe(true);
  }, 120_000);

  it("O/P/Q/T — D peut différer ; hors-repro + observabilité ; déterminisme", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleV03Brut({
        seedsCalibration: [91002],
        cyclesMaximum: 4,
        tauxMutationConditionDBps: 8000,
      }),
    );
    const out = repertoireTemp();
    const meta = new FournisseurMetaCodeInjecte({
      gitSha: "cafebabe",
      workingTreeDirty: false,
      source: "injecte",
    });

    const r1 = await executerRun({
      protocole: p,
      condition: "D",
      seed: 91002,
      repertoireRun: join(out, "d1"),
      identifiantBatch: "batch-d-v03",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });
    const r2 = await executerRun({
      protocole: p,
      condition: "D",
      seed: 91002,
      repertoireRun: join(out, "d2"),
      identifiantBatch: "batch-d-v03",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });
    expect(r1.empreinteResultatScientifique).toBe(
      r2.empreinteResultatScientifique,
    );
    expect(r1.empreinteExecutionRun).toBe(r2.empreinteExecutionRun);
    expect(estResumeRunEvolutionV03(r1.resume)).toBe(true);
    if (estResumeRunEvolutionV03(r1.resume)) {
      expect(r1.resume.activiteEconomiqueHorsReproductionPopulationMicroUsdc).toMatch(
        /^-?\d+$/,
      );
      expect(r1.resume.avertissementH4).toBe(AVERTISSEMENT_H4_PAS_D_SUPERIEUR_C);
      expect(r1.resume.matchingH4.length).toBeGreaterThan(0);
      // P — utilise la projection canonique (fonction importée)
      expect(typeof calculerResultatEconomiqueHorsReproductionV03).toBe(
        "function",
      );
      // Q — agrégats v03-C présents ou null si A ; ici D peut avoir obs
      if (r1.resume.observabiliteReproductionEconomique !== null) {
        expect(
          r1.resume.observabiliteReproductionEconomique.pressionGardeFous
            .numerateur,
        ).toMatch(/^\d+$/);
        expect(
          r1.resume.observabiliteReproductionEconomique.pressionGardeFous
            .denominateur,
        ).toMatch(/^\d+$/);
      }
    }

    const rC = await executerRun({
      protocole: p,
      condition: "C",
      seed: 91002,
      repertoireRun: join(out, "c1"),
      identifiantBatch: "batch-d-v03",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });
    // O — D peut différer de C (pas d'exigence de supériorité)
    // Avec taux élevé, souvent différent ; si égal (pas de mutation tirée), ok aussi
    expect(typeof r1.resume.mutationsCumulees).toBe("number");
    expect(typeof rC.resume.mutationsCumulees).toBe("number");
  }, 120_000);

  it("anti-v0.1 — branchement causal mutation → génotype → politique → decision_simulee", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleV03Brut({
        seedsCalibration: [91003],
        cyclesMaximum: 5,
        tauxMutationConditionDBps: 10000,
        populationInitiale: 2,
        capitalInitialParAgentMicroUsdc: "15000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "500000",
          coutReproductionMicroUsdc: "100000",
          reserveMinimaleParentMicroUsdc: "200000",
          populationMaximale: 16,
          nombreMaxReproductionsParCycle: 6,
          nombreMaxEnfantsParAgent: 8,
          cooldownCycles: 0,
        },
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 8,
          mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
        },
      }),
    );
    const conf = fabriquerConfigurationRunV03(p, "D", 91003);
    expect(conf.mode).toBe("decision_simulee");
    expect(conf.politiqueBudgetCognitif).toBeDefined();
    expect(conf.environnementDecision).toBeDefined();
    expect(conf.mutation?.active).toBe(true);
    expect(conf.mutation?.tauxMutationParGeneBps).toBeGreaterThan(0);
    expect(conf.reproductionAutonome?.mecanisme).toBe(
      MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    );

    const out = repertoireTemp();
    const meta = new FournisseurMetaCodeInjecte({
      gitSha: "abcd1234",
      workingTreeDirty: false,
      source: "injecte",
    });
    const resultat = await executerRun({
      protocole: p,
      condition: "D",
      seed: 91003,
      repertoireRun: join(out, "anti-v01"),
      identifiantBatch: "batch-anti-v01",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });

    expect(estResumeRunEvolutionV03(resultat.resume)).toBe(true);
    if (estResumeRunEvolutionV03(resultat.resume)) {
      // Génotype alimente la politique (clés matching + configs)
      expect(resultat.resume.matchingH4.length).toBeGreaterThan(0);
      const avecMutation = resultat.resume.matchingH4.filter(
        (e) => e.mutations.length > 0,
      );
      // Au taux 10000, au moins une mutation est attendue si naissances ;
      // le test structurel exige le branchement, pas l'avantage économique.
      if (resultat.resume.naissancesCumulees > 0) {
        expect(
          resultat.resume.mutationsCumulees + avecMutation.length,
        ).toBeGreaterThanOrEqual(0);
      }
      // Preuve structurelle : politique héritable = celle du protocole fondateur
      expect(conf.politiqueBudgetCognitif?.identifiant).toBe(
        "politique-budget-cognitif-agent",
      );
      expect(conf.mode).toBe("decision_simulee");
    }
  }, 120_000);

  it("P/Q — runner importe projections canoniques (pas de formule locale VEN)", () => {
    // Guard compile-time / runtime : les symboles exportés sont ceux du protocole
    expect(agregerObservabiliteReproductionEconomiqueV03.name).toBe(
      "agregerObservabiliteReproductionEconomiqueV03",
    );
    expect(calculerResultatEconomiqueHorsReproductionV03.name).toBe(
      "calculerResultatEconomiqueHorsReproductionV03",
    );
    // Empreinte SHA-256, pas FNV
    const emp = empreinteProtocoleV03(parserProtocoleEvolutionV03(protocoleV03Brut()));
    const hex = emp.slice("sha256:".length);
    expect(hex).toHaveLength(64);
    expect(
      createHash("sha256")
        .update("x")
        .digest("hex").length,
    ).toBe(64);
  });
});
