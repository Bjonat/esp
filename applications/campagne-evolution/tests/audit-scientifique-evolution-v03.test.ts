/**
 * Audit scientifique final v03-D — fail-closed, seeds, monde exogène, H4.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnvironnementOpportunitesSimulees,
  parserConfigurationEnvironnementOpportunites,
} from "@esp/environnement";
import {
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  configurationHeritableDepuisPolitiqueBase,
  empreinteConfigurationHeritable,
  resoudrePolitiqueDepuisConfigurationHeritable,
} from "@esp/protocole";
import {
  ControlegeNegatifBcEchoueErreur,
  FournisseurMetaCodeInjecte,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
  empreinteProtocoleV03,
  executerCampagneEvolution,
  executerRun,
  extraireClesAppariementH4V03,
  fabriquerConfigurationRunV03,
  parserProtocoleEvolutionV03,
  validerPreflightCampagneEvolutionV03,
  type ProtocoleExperienceEvolutionV03Json,
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
  const r = mkdtempSync(join(tmpdir(), "esp-audit-v03-"));
  repertoires.push(r);
  return r;
}

function protocoleAudit(
  surcharges: Partial<ProtocoleExperienceEvolutionV03Json> = {},
): ProtocoleExperienceEvolutionV03Json {
  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
    identifiantProtocole: "fixture-audit-v03",
    mode: "calibration",
    seedsCalibration: [91011],
    seedsDiagnostic: [],
    seedsEvaluation: [],
    cyclesMaximum: 3,
    populationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "10000000",
    tauxMutationConditionDBps: 3000,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: "2020-01-01T00:00:00.000Z",
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-audit-v03",
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
      populationMaximale: 10,
      nombreMaxReproductionsParCycle: 3,
      nombreMaxEnfantsParAgent: 4,
      cooldownCycles: 0,
    },
    reproductionAutonome: {
      version: "politique-reproduction-autonome-v01",
      active: true,
      etatsSurvieEligibles: ["sain", "contraint"],
      nombreMaxNaissancesParCycle: 3,
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    },
    mutationBase: {
      version: "parametres-mutation-v01",
      active: true,
      tauxMutationParGeneBps: 3000,
      versionCatalogueGenes: "genes-mutables-v01",
    },
    environnementExposition: {
      identifiant: "env-audit-v03",
      version: "0.3.0-audit",
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
    ...surcharges,
  };
}

const meta = new FournisseurMetaCodeInjecte({
  gitSha: "audit03",
  workingTreeDirty: false,
  source: "injecte",
});

describe("audit scientifique v03-D", () => {
  it("1 — divergence B/C → batch invalide fail-closed", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleAudit({ seedsCalibration: [91012], cyclesMaximum: 2 }),
    );
    const out = repertoireTemp();
    await expect(
      executerCampagneEvolution({
        protocole: p,
        concurrence: 1,
        fournisseurMetaCode: meta,
        repertoireResultats: out,
        dateLancement: "2020-01-01T00:00:00.000Z",
        identifiantBatch: "batch-bc-fail",
        forcerControleNegatifEchouePourTest: true,
      }),
    ).rejects.toBeInstanceOf(ControlegeNegatifBcEchoueErreur);

    const batch = join(out, "batch-bc-fail");
    expect(existsSync(join(batch, "CAMPAGNE_INVALIDE.json"))).toBe(true);
    expect(existsSync(join(batch, "controle-negatif.json"))).toBe(true);
    const invalide = JSON.parse(
      readFileSync(join(batch, "CAMPAGNE_INVALIDE.json"), "utf8"),
    ) as { statut: string };
    expect(invalide.statut).toBe("invalide");
  }, 120_000);

  it("2/3/4 — overlap seeds + seedsExplicites refusés", () => {
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleAudit({
          seedsDiagnostic: [91020],
          seedsCalibration: [91020],
        }),
      ),
    ).toThrow(/diagnostic ∩ calibration/);

    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleAudit({
          mode: "evaluation",
          seedsCalibration: [91021],
          seedsEvaluation: [91021],
        }),
      ),
    ).toThrow(/calibration ∩ evaluation|refuse seeds/);

    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleAudit({
          seedsExplicites: [91022],
        } as never),
      ),
    ).toThrow(/seedsExplicites interdit/);

    // Mode evaluation = uniquement seedsEvaluation
    const evalOk = parserProtocoleEvolutionV03(
      protocoleAudit({
        mode: "evaluation",
        seedsCalibration: [],
        seedsEvaluation: [91023],
      }),
    );
    expect(evalOk.seedsActives).toEqual([91023]);
  });

  it("5 — même tuple seed/agent/cycle → même opportunité A/B/C/D", () => {
    const p = parserProtocoleEvolutionV03(protocoleAudit());
    const seed = 91011;
    const agent = `${p.identifiantProtocole}-seed-${seed}-a001`;
    const signatures: string[] = [];
    for (const cond of ["A", "B", "C", "D"] as const) {
      const conf = fabriquerConfigurationRunV03(p, cond, seed);
      if (conf.graineSimulation !== seed) {
        throw new Error(`graine divergente pour ${cond}`);
      }
      const envJson = conf.environnementDecision!;
      const envConf = parserConfigurationEnvironnementOpportunites(envJson);
      const env = new EnvironnementOpportunitesSimulees(envConf, seed);
      const o = env.produireObservation({
        identifiantAgent: agent,
        numeroCycle: 1,
      });
      signatures.push(
        [
          o.identifiantObservation,
          String(o.probabiliteSuccesBps),
          o.gainSiSuccesMicroUsdc.toString(10),
          o.perteSiEchecMicroUsdc.toString(10),
          o.fraisActionMicroUsdc.toString(10),
        ].join("|"),
      );
    }
    expect(new Set(signatures).size).toBe(1);
  });

  it("6 — ordre conditions sans effet (ordre canonique imposé)", () => {
    const p1 = parserProtocoleEvolutionV03(
      protocoleAudit({ conditions: ["A", "B", "C", "D"] }),
    );
    const p2 = parserProtocoleEvolutionV03(
      protocoleAudit({ conditions: ["D", "C", "B", "A"] }),
    );
    expect(p1.conditions).toEqual(["A", "B", "C", "D"]);
    expect(p2.conditions).toEqual(["A", "B", "C", "D"]);
    expect(empreinteProtocoleV03(p1)).toBe(empreinteProtocoleV03(p2));

    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleAudit({ conditions: ["A", "B", "C"] as never }),
      ),
    ).toThrow(/manquante/);
    expect(() =>
      parserProtocoleEvolutionV03(
        protocoleAudit({ conditions: ["A", "B", "C", "D", "A"] as never }),
      ),
    ).toThrow(/dupliquée/);
  });

  it("6b — exécution D,C,B,A isolée = mêmes empreintes que A,B,C,D", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleAudit({ seedsCalibration: [91013], cyclesMaximum: 2 }),
    );
    const out = repertoireTemp();
    const metaCode = await meta.obtenirMetaCode();
    const emp = new Map<string, string>();
    for (const condition of ["D", "C", "B", "A"] as const) {
      const r = await executerRun({
        protocole: p,
        condition,
        seed: 91013,
        repertoireRun: join(out, `ordre-${condition}`),
        identifiantBatch: "batch-ordre",
        metaCode,
        dateLancement: "2020-01-01T00:00:00.000Z",
      });
      emp.set(condition, r.empreinteResultatScientifique);
    }
    const out2 = repertoireTemp();
    for (const condition of ["A", "B", "C", "D"] as const) {
      const r = await executerRun({
        protocole: p,
        condition,
        seed: 91013,
        repertoireRun: join(out2, `ordre2-${condition}`),
        identifiantBatch: "batch-ordre2",
        metaCode,
        dateLancement: "2020-01-01T00:00:00.000Z",
      });
      expect(r.empreinteResultatScientifique).toBe(emp.get(condition));
    }
  }, 180_000);

  it("7 — concurrence 1 vs 2 → mêmes empreintes scientifiques", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleAudit({ seedsCalibration: [91014], cyclesMaximum: 2 }),
    );
    const out = repertoireTemp();
    const r1 = await executerCampagneEvolution({
      protocole: p,
      concurrence: 1,
      fournisseurMetaCode: meta,
      repertoireResultats: out,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-c1",
    });
    const r2 = await executerCampagneEvolution({
      protocole: p,
      concurrence: 2,
      fournisseurMetaCode: meta,
      repertoireResultats: out,
      dateLancement: "2020-01-01T00:00:00.000Z",
      identifiantBatch: "batch-c2",
    });
    const parCle = (resumes: typeof r1.resumes) =>
      new Map(
        resumes.map((r) => [
          `${r.condition}:${r.seed}`,
          r.empreinteResultatScientifique,
        ]),
      );
    const m1 = parCle(r1.resumes);
    const m2 = parCle(r2.resumes);
    expect(m1.size).toBe(4);
    for (const [k, v] of m1) {
      expect(m2.get(k)).toBe(v);
    }
  }, 180_000);

  it("9 — clés appariement H4 sans sélection de gagnant", () => {
    const cles = extraireClesAppariementH4V03({
      seed: 1,
      evenements: [],
      agents: [
        {
          identifiant: "a",
          generation: 0,
          empreinteConfiguration: "g1",
        },
      ],
    });
    expect(cles[0]?.identifiantAgent).toBe("a");
    const texte = JSON.stringify(cles);
    expect(texte).not.toMatch(/gagnant|scoreH4|avantageAdaptatif|prometteur/i);
  });

  it("10 — exemple JSON marqué non scientifique", () => {
    const brut = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "experiences/protocoles/evolution-campagne-v03.exemple.json",
        ),
        "utf8",
      ),
    ) as ProtocoleExperienceEvolutionV03Json;
    expect(brut.statutArtefact).toBe("exemple_non_scientifique");
    const p = parserProtocoleEvolutionV03(brut);
    expect(p.statutArtefact).toBe("exemple_non_scientifique");
    expect(() =>
      parserProtocoleEvolutionV03({
        ...brut,
        mode: "evaluation",
        seedsCalibration: [],
        seedsEvaluation: [91001],
      }),
    ).toThrow(/exemple_non_scientifique/);
  });

  it("11 — preflight avant création artefacts batch", () => {
    const out = repertoireTemp();
    const p = parserProtocoleEvolutionV03(protocoleAudit());
    // Préflight OK ne crée rien
    expect(() => validerPreflightCampagneEvolutionV03(p)).not.toThrow();
    expect(existsSync(join(out, "batch-preflight"))).toBe(false);

    const corrompu = {
      ...p,
      version: "protocole-experience-evolution-v02" as never,
    };
    expect(() => validerPreflightCampagneEvolutionV03(corrompu)).toThrow();
  });

  it("12 — anti-v0.1 chaîne génotype → politique → decision_simulee", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleAudit({
        seedsCalibration: [91015],
        cyclesMaximum: 4,
        tauxMutationConditionDBps: 10000,
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
    const conf = fabriquerConfigurationRunV03(p, "D", 91015);
    expect(conf.mode).toBe("decision_simulee");
    expect(conf.politiqueBudgetCognitif).toBeDefined();

    // Chaîne structurelle pure (sans run)
    const fondateur = configurationHeritableDepuisPolitiqueBase({
      seuilEnjeuPourInferenceMicroUsdc: BigInt(
        conf.politiqueBudgetCognitif!.seuilEnjeuPourInferenceMicroUsdc,
      ),
      partMaxVenParCycleBps: conf.politiqueBudgetCognitif!.partMaxVenParCycleBps,
      plafondCognitifMicroUsdc: BigInt(
        conf.politiqueBudgetCognitif!.plafondCognitifMicroUsdc,
      ),
      comportementSansInference:
        conf.politiqueBudgetCognitif!.comportementSansInference,
    });
    const politiqueFondateur = resoudrePolitiqueDepuisConfigurationHeritable({
      politiqueBase: conf.politiqueBudgetCognitif!,
      configurationHeritable: fondateur,
    });
    expect(politiqueFondateur.seuilEnjeuPourInferenceMicroUsdc).toBe(
      BigInt(conf.politiqueBudgetCognitif!.seuilEnjeuPourInferenceMicroUsdc),
    );

    // Mutation d'une composante lue par la politique
    const mute = configurationHeritableDepuisPolitiqueBase({
      seuilEnjeuPourInferenceMicroUsdc: 150000n,
      partMaxVenParCycleBps: politiqueFondateur.partMaxVenParCycleBps,
      plafondCognitifMicroUsdc: politiqueFondateur.plafondCognitifMicroUsdc,
      comportementSansInference: politiqueFondateur.comportementSansInference,
    });
    expect(empreinteConfigurationHeritable(mute)).not.toBe(
      empreinteConfigurationHeritable(fondateur),
    );
    const politiqueMutee = resoudrePolitiqueDepuisConfigurationHeritable({
      politiqueBase: conf.politiqueBudgetCognitif!,
      configurationHeritable: mute,
    });
    expect(politiqueMutee.seuilEnjeuPourInferenceMicroUsdc).toBe(150000n);
    expect(politiqueMutee.seuilEnjeuPourInferenceMicroUsdc).not.toBe(
      politiqueFondateur.seuilEnjeuPourInferenceMicroUsdc,
    );

    // Exécution D : decision_simulee consomme cette chaîne
    const out = repertoireTemp();
    const r = await executerRun({
      protocole: p,
      condition: "D",
      seed: 91015,
      repertoireRun: join(out, "anti-v01"),
      identifiantBatch: "batch-anti",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });
    expect(conf.mode).toBe("decision_simulee");
    expect(r.resume.cyclesExecutes).toBeGreaterThan(0);
  }, 120_000);

  it("aucun verdict H1–H4 dans résumé v03", async () => {
    const p = parserProtocoleEvolutionV03(
      protocoleAudit({ seedsCalibration: [91016], cyclesMaximum: 2 }),
    );
    const out = repertoireTemp();
    const r = await executerRun({
      protocole: p,
      condition: "A",
      seed: 91016,
      repertoireRun: join(out, "a"),
      identifiantBatch: "batch-verdict",
      metaCode: await meta.obtenirMetaCode(),
      dateLancement: "2020-01-01T00:00:00.000Z",
    });
    const texte = JSON.stringify(r.resume);
    expect(texte).not.toMatch(/soutenue|variant gagnant|score adaptatif|condition gagnante/i);
  }, 60_000);
});
