/**
 * Tests protocole expérimental évolution multi-génération v0.1 (A–AL).
 * Horizons courts, petite population, MetaCode injecté, dates fixes.
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONDITIONS_EVOLUTION_V01,
  FournisseurMetaCodeInjecte,
  calculerComparaisonsAppariees,
  calculerEmpreinteExecutionRun,
  calculerEmpreinteResultatScientifiqueDepuisRun,
  comparerControleNegatifBC,
  differenceBigintExacte,
  empreinteProtocole,
  empreinteSha256Canonique,
  empreinteSha256DepuisTexte,
  executerCampagneEvolution,
  executerRun,
  fabriquerConfigurationRun,
  fabriquerIdentifiantBatch,
  identifiantRun,
  listerRunsPlanifies,
  medianeBigints,
  medianeNombres,
  parserProtocoleEvolution,
  ProtocoleEvolutionInvalideErreur,
  quartile1Nombres,
  quartile3Nombres,
  serialiserJsonCanonique,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  type ProtocoleExperienceEvolutionV01Json,
  type ResumeRunEvolution,
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
  const r = mkdtempSync(join(tmpdir(), "esp-campagne-evo-"));
  repertoires.push(r);
  return r;
}

function protocoleBrut(
  surcharges: Partial<ProtocoleExperienceEvolutionV01Json> = {},
): ProtocoleExperienceEvolutionV01Json {
  const base: ProtocoleExperienceEvolutionV01Json = {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
    identifiantProtocole: "test-evo-v01",
    mode: "calibration",
    seedsCalibration: [7, 8],
    seedsEvaluation: [1001, 1002],
    cyclesMaximum: 3,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "100000000",
    tauxMutationConditionDBps: 5000,
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
      tauxMutationParGeneBps: 5000,
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
    xway: {
      active: true,
      plafondComputeParCycleMicroUsdc: "50000",
      modeles: [
        {
          identifiant: "modele_economique",
          libelle: "éco",
          coutParMillionJetonsEntreeMicroUsdc: "500000",
          coutParMillionJetonsSortieMicroUsdc: "1500000",
          nombreMaxJetonsSortie: 256,
        },
        {
          identifiant: "modele_standard",
          libelle: "std",
          coutParMillionJetonsEntreeMicroUsdc: "2000000",
          coutParMillionJetonsSortieMicroUsdc: "6000000",
          nombreMaxJetonsSortie: 512,
        },
        {
          identifiant: "modele_premium",
          libelle: "prem",
          coutParMillionJetonsEntreeMicroUsdc: "20000000",
          coutParMillionJetonsSortieMicroUsdc: "60000000",
          nombreMaxJetonsSortie: 1024,
        },
      ],
      politiqueCognitive: {
        identifiant: "politique-budget-cognitif-agent",
        version: "0.1.0",
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: "0.1.0",
      },
    },
  };
  return { ...base, ...surcharges };
}

const metaPropre = new FournisseurMetaCodeInjecte({
  gitSha: "abc123deadbeef00",
  workingTreeDirty: false,
  source: "injecte",
});

describe("protocole-experimental-evolution-v01", () => {
  it("A — protocole valide accepté", () => {
    const p = parserProtocoleEvolution(protocoleBrut());
    expect(p.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION);
    expect(p.seedsActives).toEqual([7, 8]);
  });

  it("B — protocole invalide refusé", () => {
    expect(() =>
      parserProtocoleEvolution(protocoleBrut({ cyclesMaximum: 0 })),
    ).toThrow(ProtocoleEvolutionInvalideErreur);
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({ seedsCalibration: [1, 1] }),
      ),
    ).toThrow(/dupliquée/);
  });

  it("C — matrice condition × seed exacte", () => {
    const p = parserProtocoleEvolution(protocoleBrut());
    const runs = listerRunsPlanifies(p);
    expect(runs).toHaveLength(8);
    expect(runs.map((r) => r.identifiantRun).sort()).toEqual(
      [
        "A-seed-7",
        "A-seed-8",
        "B-seed-7",
        "B-seed-8",
        "C-seed-7",
        "C-seed-8",
        "D-seed-7",
        "D-seed-8",
      ].sort(),
    );
  });

  it("D — seeds appariées", () => {
    const p = parserProtocoleEvolution(protocoleBrut());
    for (const seed of p.seedsActives) {
      for (const c of CONDITIONS_EVOLUTION_V01) {
        expect(
          listerRunsPlanifies(p).some(
            (r) => r.seed === seed && r.condition === c,
          ),
        ).toBe(true);
      }
    }
  });

  it("E — IDs runs déterministes", () => {
    expect(identifiantRun("D", 1001)).toBe("D-seed-1001");
    const p = parserProtocoleEvolution(protocoleBrut());
    expect(fabriquerIdentifiantBatch(p)).toContain(p.identifiantProtocole);
    expect(fabriquerIdentifiantBatch(p)).toBe(fabriquerIdentifiantBatch(p));
  });

  it("F/G/H/I/M/S/Y/AK/AH — runs isolés, empreintes, concurrence, B=C", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({
        seedsCalibration: [11],
        cyclesMaximum: 3,
        populationInitiale: 2,
      }),
    );

    const r1 = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: join(racine, "c1"),
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-c1",
    });
    const r2 = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: join(racine, "c2"),
      concurrence: 2,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-c2",
    });

    const emp = (resumes: readonly ResumeRunEvolution[]) =>
      Object.fromEntries(
        resumes.map((x) => [
          x.identifiantRun,
          {
            exec: x.empreinteExecutionRun,
            sci: x.empreinteResultatScientifique,
          },
        ]),
      );

    expect(emp(r1.resumes)).toEqual(emp(r2.resumes));

    // Isolation : sqlite distincts
    expect(
      existsSync(join(r1.repertoireBatch, "runs", "A-seed-11", "esp.sqlite")),
    ).toBe(true);
    expect(
      existsSync(join(r1.repertoireBatch, "runs", "B-seed-11", "esp.sqlite")),
    ).toBe(true);

    // Trajectoire chaque cycle
    const traj = readFileSync(
      join(r1.repertoireBatch, "runs", "A-seed-11", "trajectoire.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n");
    expect(traj).toHaveLength(3);
    expect(JSON.parse(traj[0]!).cycle).toBe(1);
    expect(JSON.parse(traj[2]!).cycle).toBe(3);

    // Contrôle négatif B/C
    expect(r1.manifeste.marqueurs).not.toContain("CONTROLE_NEGATIF_ECHOUE");
    const b = r1.resumes.find((x) => x.identifiantRun === "B-seed-11")!;
    const c = r1.resumes.find((x) => x.identifiantRun === "C-seed-11")!;
    expect(b.empreinteResultatScientifique).toBe(
      c.empreinteResultatScientifique,
    );
    expect(b.empreinteExecutionRun).not.toBe(c.empreinteExecutionRun);
    expect(b.empreinteExecutionRun.startsWith("sha256:")).toBe(true);
    expect(b.empreinteResultatScientifique.startsWith("sha256:")).toBe(true);
    expect(b.venPopulationFinaleMicroUsdc).toBe(c.venPopulationFinaleMicroUsdc);
    expect(b.naissancesCumulees).toBe(c.naissancesCumulees);
    expect(b.mutationsCumulees).toBe(0);
    expect(c.mutationsCumulees).toBe(0);

    // Configurations : mutation OFF vs taux 0
    const confB = fabriquerConfigurationRun(p, "B", 11);
    const confC = fabriquerConfigurationRun(p, "C", 11);
    expect(confB.mutation?.active).toBe(false);
    expect(confC.mutation?.active).toBe(true);
    expect(confC.mutation?.tauxMutationParGeneBps).toBe(0);

    // Résumé
    expect(b.statut).toBe("termine");
    expect(b).not.toHaveProperty("scoreEvolution");

    // OpenAI impossible au parseur
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({
          fournisseur: {
            identifiant: "fournisseur-inference-openai" as "fournisseur-inference-simule",
            version: "0.1.0",
            selecteur: "openai" as "simule",
          },
        }),
      ),
    ).toThrow(/OpenAI|openai|simule/i);
  }, 120_000);

  it("J/K/L — reprise batch, terminé non rejoué, incomplet recommencé", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({
        seedsCalibration: [21],
        cyclesMaximum: 2,
      }),
    );
    const batchId = "batch-reprise";
    const premier = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: batchId,
    });
    const empAvant = premier.resumes.find(
      (r) => r.identifiantRun === "A-seed-21",
    )!.empreinteRun;

    // Simuler run incomplet D
    const runD = join(premier.repertoireBatch, "runs", "D-seed-21");
    writeFileSync(join(runD, "statut.json"), JSON.stringify({ statut: "en_cours" }));
    rmSync(join(runD, "resume.json"), { force: true });

    const second = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: batchId,
    });

    expect(
      second.resumes.find((r) => r.identifiantRun === "A-seed-21")!.empreinteRun,
    ).toBe(empAvant);
    expect(
      second.resumes.find((r) => r.identifiantRun === "D-seed-21")!.statut,
    ).toBe("termine");
    expect(existsSync(join(runD, "resume.json"))).toBe(true);
  }, 120_000);

  it("N/O/AG — extinction conservée, pas de biais survivants", async () => {
    const racine = repertoireTemp();
    // Capital très bas + coûts élevés → extinction probable
    const p = parserProtocoleEvolution(
      protocoleBrut({
        seedsCalibration: [31],
        cyclesMaximum: 4,
        populationInitiale: 1,
        capitalInitialParAgentMicroUsdc: "5000",
        parametresEconomiques: {
          version: "extinction",
          loyerInfrastructureMicroUsdc: "0",
          periodeLoyerEnCycles: 100,
          tauxRedevanceProprietairePointsDeBase: "0",
          coutOperationnelMinimalParCycleMicroUsdc: "5000",
          seuilRunwaySainEnCycles: 2,
          seuilRunwayContraintEnCycles: 1,
          cyclesDormanceAvantMort: 1,
        },
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "1000",
          coutReproductionMicroUsdc: "1000",
          reserveMinimaleParentMicroUsdc: "100000000",
          populationMaximale: 2,
          nombreMaxReproductionsParCycle: 0,
          nombreMaxEnfantsParAgent: 0,
          cooldownCycles: 0,
        },
      }),
    );
    const resultat = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-ext",
    });
    const resumeBatch = JSON.parse(
      readFileSync(join(resultat.repertoireBatch, "resume-batch.json"), "utf8"),
    ) as { resumes: { eteinte: boolean }[] };
    // Tous les runs restent dans le dénominateur
    expect(resumeBatch.resumes).toHaveLength(4);
    const traj = readFileSync(
      join(resultat.repertoireBatch, "runs", "A-seed-31", "trajectoire.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n");
    expect(traj).toHaveLength(4);
  }, 120_000);

  it("P — garde-fou signalé", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({
        seedsCalibration: [41],
        cyclesMaximum: 4,
        populationInitiale: 2,
        capitalInitialParAgentMicroUsdc: "100000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "1000000",
          coutReproductionMicroUsdc: "100000",
          reserveMinimaleParentMicroUsdc: "1000",
          populationMaximale: 3,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 5,
          cooldownCycles: 0,
        },
        reproductionAutonome: {
          version: "politique-reproduction-autonome-v01",
          active: true,
          etatsSurvieEligibles: ["sain", "contraint"],
          nombreMaxNaissancesParCycle: 1,
        },
      }),
    );
    const resultat = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-garde",
    });
    const b = resultat.resumes.find((r) => r.condition === "B");
    expect(b).toBeDefined();
    // Au moins un champ garde-fou présent (peut être 0 si non atteint — structure OK)
    expect(typeof b!.cyclesPopulationMaximaleAtteinte).toBe("number");
    expect(typeof b!.runContraintParGardeFou).toBe("boolean");
  }, 120_000);

  it("Q/R/T — fréquences, lignées, agrégats", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({ seedsCalibration: [51], cyclesMaximum: 3 }),
    );
    const resultat = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-freq",
    });
    const point = JSON.parse(
      readFileSync(
        join(resultat.repertoireBatch, "runs", "D-seed-51", "trajectoire.jsonl"),
        "utf8",
      )
        .trim()
        .split("\n")[0]!,
    ) as {
      frequencesGenotypes: unknown[];
      lignees: unknown[];
    };
    expect(Array.isArray(point.frequencesGenotypes)).toBe(true);
    expect(Array.isArray(point.lignees)).toBe(true);
    expect(
      existsSync(join(resultat.repertoireBatch, "trajectoires-agregees.csv")),
    ).toBe(true);
    expect(
      existsSync(join(resultat.repertoireBatch, "frequences-genotypiques.csv")),
    ).toBe(true);
  }, 120_000);

  it("U/V/W/X — comparaisons appariées, bigint, médiane, quartiles", () => {
    const resumes = [
      fauxResume("D", 1, "100"),
      fauxResume("C", 1, "40"),
      fauxResume("D", 2, "80"),
      fauxResume("C", 2, "80"),
    ];
    const comps = calculerComparaisonsAppariees(resumes);
    const ven = comps.bigint.find(
      (c) => c.paire === "D-C" && c.metrique === "venPopulationFinaleMicroUsdc",
    )!;
    expect(ven.n).toBe(2);
    expect(ven.mediane).toBe("0"); // médiane basse de [0, 60] → indice floor(0.5)=0 → 0
    expect(differenceBigintExacte("100", "40")).toBe(60n);

    // X — convention quartile documentée
    expect(quartile1Nombres([1, 2, 3, 4, 5])).toBe(2);
    expect(medianeNombres([1, 2, 3, 4])).toBe(2.5);
    expect(medianeBigints([1n, 2n, 3n, 4n])).toBe(2n);
    expect(quartile3Nombres([1, 2, 3, 4, 5])).toBe(4);
  });

  it("Z — divergence C-B marque CONTROLE_NEGATIF_ECHOUE", () => {
    const b = fauxResume("B", 1, "100");
    const c = fauxResume("C", 1, "99");
    const r = comparerControleNegatifBC({
      resumeB: b,
      resumeC: c,
      trajectoireB: [],
      trajectoireC: [],
    });
    expect(r.identique).toBe(false);
  });

  it("AA/AB — empreinte protocole SHA-256 stable, ordre JSON indifférent", () => {
    const a = parserProtocoleEvolution(protocoleBrut());
    const b = parserProtocoleEvolution(
      protocoleBrut({
        conditions: ["D", "C", "B", "A"],
      }),
    );
    expect(empreinteProtocole(a)).toBe(empreinteProtocole(b));
    expect(empreinteProtocole(a).startsWith("sha256:")).toBe(true);
    const j1 = serialiserJsonCanonique({ z: 1, a: 2 });
    const j2 = serialiserJsonCanonique({ a: 2, z: 1 });
    expect(j1).toBe(j2);
    expect(empreinteSha256DepuisTexte(j1)).toBe(empreinteSha256DepuisTexte(j2));
  });

  it("AC — manifest restart identique (même batch id)", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({ seedsCalibration: [61], cyclesMaximum: 2 }),
    );
    const o = {
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1 as const,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-ac",
    };
    const r1 = await executerCampagneEvolution(o);
    const r2 = await executerCampagneEvolution(o);
    expect(r1.manifeste.identifiantBatch).toBe(r2.manifeste.identifiantBatch);
    expect(r1.manifeste.empreinteProtocole).toBe(
      r2.manifeste.empreinteProtocole,
    );
  }, 120_000);

  it("AD — dirty code signalé en évaluation", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({
        mode: "evaluation",
        seedsEvaluation: [71],
        cyclesMaximum: 2,
      }),
    );
    const dirty = new FournisseurMetaCodeInjecte({
      gitSha: "dirty01",
      workingTreeDirty: true,
      source: "injecte",
    });
    const r = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: dirty,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-dirty",
    });
    expect(r.manifeste.marqueurs).toContain("NON_CANONIQUE_CODE_MODIFIE");
  }, 120_000);

  it("AE/AF — rapport sans score global ni classement", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({ seedsCalibration: [81], cyclesMaximum: 2 }),
    );
    const r = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: racine,
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-rapport",
    });
    const md = readFileSync(join(r.repertoireBatch, "rapport.md"), "utf8");
    const batch = readFileSync(
      join(r.repertoireBatch, "resume-batch.json"),
      "utf8",
    );
    expect(md).not.toMatch(/scoreEvolution|fitnessGlobale|indiceAdaptation/i);
    expect(batch).not.toMatch(/scoreEvolution|fitnessGlobale/);
    expect(md).toMatch(/aucune métrique synthétique globale/i);
  }, 120_000);

  it("AI/AJ — seeds calibration/évaluation séparées ; évaluation figée", () => {
    const cal = parserProtocoleEvolution(
      protocoleBrut({ mode: "calibration" }),
    );
    expect(cal.seedsActives).toEqual([7, 8]);
    const ev = parserProtocoleEvolution(
      protocoleBrut({ mode: "evaluation" }),
    );
    expect(ev.seedsActives).toEqual([1001, 1002]);
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({ mode: "evaluation", seedsEvaluation: [] }),
      ),
    ).toThrow(/seedsEvaluation/);
  });

  it("AL — résultats générés gitignored", () => {
    const gitignore = readFileSync(
      join(process.cwd(), ".gitignore"),
      "utf8",
    );
    expect(gitignore).toMatch(/experiences\/resultats\//);
  });

  it("refuse OpenAI / Live / Solana / matrice incomplète / pop max", () => {
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({
          fournisseur: {
            identifiant: "fournisseur-inference-simule",
            version: "0.1.0",
          },
          conditions: ["A", "B", "D"],
        } as ProtocoleExperienceEvolutionV01Json),
      ),
    ).toThrow(/C/);
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({
          reproduction: {
            version: "parametres-reproduction-v01",
            active: true,
            dotationEnfantMicroUsdc: "1",
            coutReproductionMicroUsdc: "1",
            reserveMinimaleParentMicroUsdc: "1",
            populationMaximale: 0,
            nombreMaxReproductionsParCycle: 1,
            nombreMaxEnfantsParAgent: 1,
            cooldownCycles: 0,
          },
        }),
      ),
    ).toThrow(/populationMaximale/);
    expect(() =>
      parserProtocoleEvolution(
        protocoleBrut({
          modeleExperience: { mode: "simulation" },
        } as ProtocoleExperienceEvolutionV01Json & {
          modeleExperience: { mode: string; solana?: boolean };
        }),
      ),
    ).not.toThrow();
    // Solana dans payload
    expect(() =>
      parserProtocoleEvolution({
        ...protocoleBrut(),
        parametresEconomiques: {
          ...protocoleBrut().parametresEconomiques,
          version: "solana-hack",
        },
      }),
    ).toThrow(/Solana/);
  });

  it("empreinte exécution exclut identité Ed25519", () => {
    const emp = calculerEmpreinteExecutionRun({
      empreinteProtocole: "sha256:abc",
      condition: "A",
      seed: 1,
      evenements: [
        {
          type: "AGENT_CREE",
          identifiant: "1",
          numeroCycle: 0,
          sequence: 1,
          chargeUtile: { x: 1 },
        },
        {
          type: "IDENTITE_AGENT_ENREGISTREE",
          identifiant: "2",
          numeroCycle: 0,
          sequence: 2,
          chargeUtile: { clePublique: "SECRET", empreinteClePublique: "e" },
        },
      ],
    });
    const empSans = calculerEmpreinteExecutionRun({
      empreinteProtocole: "sha256:abc",
      condition: "A",
      seed: 1,
      evenements: [
        {
          type: "AGENT_CREE",
          identifiant: "1",
          numeroCycle: 0,
          sequence: 1,
          chargeUtile: { x: 1 },
        },
      ],
    });
    expect(emp).toBe(empSans);
    expect(emp.startsWith("sha256:")).toBe(true);
  });

  it("executerRun unitaire répétable", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({ seedsCalibration: [91], cyclesMaximum: 2 }),
    );
    const o = {
      protocole: p,
      condition: "A" as const,
      seed: 91,
      identifiantBatch: "u",
      metaCode: metaPropre.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    };
    const a = await executerRun({
      ...o,
      repertoireRun: join(racine, "a"),
    });
    const b = await executerRun({
      ...o,
      repertoireRun: join(racine, "b"),
    });
    expect(a.empreinteExecutionRun).toBe(b.empreinteExecutionRun);
    expect(a.empreinteResultatScientifique).toBe(
      b.empreinteResultatScientifique,
    );
  }, 60_000);

  it("AM — empreinteProtocole SHA-256 stable", () => {
    const p = parserProtocoleEvolution(protocoleBrut());
    const e1 = empreinteProtocole(p);
    const e2 = empreinteProtocole(p);
    expect(e1).toBe(e2);
    expect(e1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("AN — ordre JSON ne change pas SHA-256", () => {
    expect(empreinteSha256Canonique({ b: 2, a: 1 })).toBe(
      empreinteSha256Canonique({ a: 1, b: 2 }),
    );
  });

  it("AO — modification d'un paramètre change empreinteProtocole", () => {
    const a = parserProtocoleEvolution(protocoleBrut({ cyclesMaximum: 4 }));
    const b = parserProtocoleEvolution(protocoleBrut({ cyclesMaximum: 5 }));
    expect(empreinteProtocole(a)).not.toBe(empreinteProtocole(b));
  });

  it("AP/AQ/AR/AT — résultat scientifique stable ; B/C exécution ≠ ; concurrence", async () => {
    const racine = repertoireTemp();
    const p = parserProtocoleEvolution(
      protocoleBrut({
        seedsCalibration: [111],
        cyclesMaximum: 3,
        populationInitiale: 2,
      }),
    );
    const r1 = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: join(racine, "c1"),
      concurrence: 1,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-sha-1",
    });
    const r2 = await executerCampagneEvolution({
      protocole: p,
      repertoireResultats: join(racine, "c2"),
      concurrence: 3,
      fournisseurMetaCode: metaPropre,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-sha-2",
    });
    const b1 = r1.resumes.find((x) => x.identifiantRun === "B-seed-111")!;
    const c1 = r1.resumes.find((x) => x.identifiantRun === "C-seed-111")!;
    const b2 = r2.resumes.find((x) => x.identifiantRun === "B-seed-111")!;
    expect(b1.empreinteResultatScientifique).toBe(
      c1.empreinteResultatScientifique,
    );
    expect(b1.empreinteExecutionRun).not.toBe(c1.empreinteExecutionRun);
    expect(b1.empreinteResultatScientifique).toBe(
      b2.empreinteResultatScientifique,
    );
    expect(b1.empreinteExecutionRun).toBe(b2.empreinteExecutionRun);
    expect(r1.manifeste.formatsEmpreintes.protocole).toContain("sha256");
  }, 120_000);

  it("AS — identité Ed25519 différente ne change pas empreinte résultat scientifique", () => {
    const charge = {
      empreinteProtocole: "sha256:proto",
      seed: 1,
      points: [
        {
          cycle: 1,
          populationVivante: 2,
          venPopulationMicroUsdc: "100",
          naissances: 0,
          deces: 0,
          mutationsCumulees: 0,
          eteinte: false,
        },
      ],
      resume: {
        seed: 1,
        venPopulationFinaleMicroUsdc: "100",
        populationVivanteFinale: 2,
        eteinte: false,
        cycleExtinction: null,
        naissancesCumulees: 0,
        mutationsCumulees: 0,
      },
    };
    const e1 = calculerEmpreinteResultatScientifiqueDepuisRun(charge);
    const e2 = calculerEmpreinteResultatScientifiqueDepuisRun({
      ...charge,
      resume: {
        ...charge.resume,
        // champs non scientifiques / identité — ignorés
        empreinteExecutionRun: "sha256:autre",
        metaCode: { gitSha: "ffff", workingTreeDirty: true, source: "git" },
        dateLancement: "2099-01-01T00:00:00.000Z",
      },
    });
    expect(e1).toBe(e2);
  });

  it("AU — timestamp mural / durée ne change pas empreinte scientifique", () => {
    const base = {
      empreinteProtocole: "sha256:proto",
      seed: 7,
      points: [
        {
          cycle: 1,
          populationVivante: 1,
          venPopulationMicroUsdc: "50",
          naissances: 0,
          deces: 0,
          mutationsCumulees: 0,
          eteinte: false,
        },
      ],
      resume: {
        seed: 7,
        venPopulationFinaleMicroUsdc: "50",
        populationVivanteFinale: 1,
        eteinte: false,
        dureeMs: 1,
        dateLancement: "2020-01-01T00:00:00.000Z",
      },
    };
    const e1 = calculerEmpreinteResultatScientifiqueDepuisRun(base);
    const e2 = calculerEmpreinteResultatScientifiqueDepuisRun({
      ...base,
      resume: {
        ...base.resume,
        dureeMs: 99999,
        dateLancement: new Date().toISOString(),
      },
    });
    expect(e1).toBe(e2);
  });
});

function fauxResume(
  condition: "A" | "B" | "C" | "D",
  seed: number,
  ven: string,
): ResumeRunEvolution {
  return {
    identifiantRun: identifiantRun(condition, seed),
    identifiantBatch: "t",
    condition,
    seed,
    empreinteProtocole: "sha256:p",
    empreinteExecutionRun: `sha256:exec-${condition}-${String(seed)}`,
    empreinteResultatScientifique: `sha256:sci-${ven}`,
    empreinteRun: `sha256:exec-${condition}-${String(seed)}`,
    versionProtocole: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
    metaCode: { gitSha: null, workingTreeDirty: null, source: "injecte" },
    dateLancement: "2020-01-01T00:00:00.000Z",
    statut: "termine",
    dureeMs: 1,
    cyclesExecutes: 1,
    cyclesMaximum: 1,
    venPopulationFinaleMicroUsdc: ven,
    resultatActiviteBrutCumuleMicroUsdc: "0",
    resultatApresContratCumuleMicroUsdc: "0",
    resultatApresReproductionCumuleMicroUsdc: "0",
    computeCumuleMicroUsdc: "0",
    contributionProprietaireCumuleeMicroUsdc: "0",
    populationVivanteFinale: 1,
    eteinte: false,
    cycleExtinction: null,
    naissancesCumulees: 0,
    generationMaximale: 0,
    ligneesVivantes: 1,
    descendantsCumules: 0,
    mutationsCumulees: 0,
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
  };
}
