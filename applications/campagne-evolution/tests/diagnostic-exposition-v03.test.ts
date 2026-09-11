/**
 * Tests diagnostic d'exposition v03-E (A–V).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configurationHeritableDepuisPolitiqueBase,
  empreinteConfigurationHeritable,
} from "@esp/protocole";
import {
  CANDIDAT_EXPOSITION_E0,
  CANDIDAT_EXPOSITION_E1,
  CANDIDAT_EXPOSITION_E2,
  CRITERES_EXPOSITION_SUFFISANTE_V03,
  GENES_DIAGNOSTIC_EXPOSITION_V03,
  POLITIQUE_FONDATRICE_DIAGNOSTIC_V03,
  SEEDS_DIAGNOSTIC_EXPOSITION_V03,
  SEQUENCE_CANDIDATS_EXPOSITION_V03,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  REFERENCES_INTEGRATION_REPRODUCTION_V03_B,
  AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03,
  appliquerRegleArretPremierSatisfaisantV03,
  assertEntreeSelectionSansPerformanceDC,
  assertPasDeReutilisationSeedsDiagnosticV03,
  assertSeedsDiagnosticExpositionV03Libres,
  estContexteSensibleV03,
  executerControlePositifReproductionV03,
  executerDiagnosticExpositionV03,
  evaluerContexteSensibiliteGeneV03,
  evaluerCriteresExpositionV03,
  evaluerSensibiliteCandidatExpositionV03,
  premierVoisinCanoniqueGeneV03,
  voisinsCanoniquesFondateurV03,
  type EvaluationCriteresExpositionV03,
} from "../src/index.js";
import { parametresDepuisPolitique } from "../src/diagnostic-contrefactuel-un-gene.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) {
      rmSync(r, { recursive: true, force: true });
    }
  }
});

function tempDir(): string {
  const r = mkdtempSync(join(tmpdir(), "esp-diag-v03-"));
  repertoires.push(r);
  return r;
}

function evaluationFactice(
  verdict: EvaluationCriteresExpositionV03["verdict"],
): EvaluationCriteresExpositionV03 {
  return {
    critereA_quatreGenesSensibles: verdict === "exposition_suffisante",
    critereB_seedsCompletes: verdict === "exposition_suffisante",
    critereC_contextesMinimum: verdict === "exposition_suffisante",
    critereD_cognitionOuDecision: verdict === "exposition_suffisante",
    critereE_economiqueObserveParGene: {},
    verdict,
    motifsEchec:
      verdict === "exposition_suffisante" ? [] : ["insuffisant factice"],
  };
}

describe("diagnostic-exposition-v03", () => {
  it("A — même configuration vs elle-même → aucune sensibilité décisionnelle", () => {
    const params = parametresDepuisPolitique(POLITIQUE_FONDATRICE_DIAGNOSTIC_V03);
    const emp = empreinteConfigurationHeritable(
      configurationHeritableDepuisPolitiqueBase({
        seuilEnjeuPourInferenceMicroUsdc: BigInt(
          String(params.seuilEnjeuPourInferenceMicroUsdc),
        ),
        partMaxVenParCycleBps: Number(params.partMaxVenParCycleBps),
        plafondCognitifMicroUsdc: BigInt(String(params.plafondCognitifMicroUsdc)),
        comportementSansInference: params.comportementSansInference as
          | "attendre"
          | "agir_si_favorable",
      }),
    );
    // Même empreinte → pas de divergence génotypique
    expect(emp).toBe(
      empreinteConfigurationHeritable({
        version: "configuration-heritable-v01",
        parametres: params,
      }),
    );
  });

  it("B — un seul gène modifié → aucun autre gène ne change", () => {
    const params = parametresDepuisPolitique(POLITIQUE_FONDATRICE_DIAGNOSTIC_V03);
    const voisins = voisinsCanoniquesFondateurV03();
    for (const cle of GENES_DIAGNOSTIC_EXPOSITION_V03) {
      const cf = { ...params, [cle]: voisins[cle].valeur };
      for (const autre of GENES_DIAGNOSTIC_EXPOSITION_V03) {
        if (autre === cle) continue;
        expect(cf[autre]).toBe(params[autre]);
      }
    }
  });

  it("C — même tuple exogène référence/contrefactuel", () => {
    const voisins = voisinsCanoniquesFondateurV03();
    const c1 = evaluerContexteSensibiliteGeneV03({
      seed: 401,
      numeroCycle: 1,
      cleGene: "seuilEnjeuPourInferenceMicroUsdc",
      voisin: voisins.seuilEnjeuPourInferenceMicroUsdc,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    const c2 = evaluerContexteSensibiliteGeneV03({
      seed: 401,
      numeroCycle: 1,
      cleGene: "seuilEnjeuPourInferenceMicroUsdc",
      voisin: voisins.seuilEnjeuPourInferenceMicroUsdc,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    expect(c1.identifiantObservation).toBe(c2.identifiantObservation);
  });

  it("D — seuilEnjeuPourInferenceMicroUsdc peut être sensible", () => {
    const { parGene } = evaluerSensibiliteCandidatExpositionV03({
      seeds: [401],
      cyclesParSeed: 20,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    const g = parGene.find(
      (x) => x.cleGene === "seuilEnjeuPourInferenceMicroUsdc",
    )!;
    expect(g.contextesSensibles).toBeGreaterThan(0);
    expect(
      g.auMoinsUneDifferenceCognition || g.auMoinsUneDifferenceDecision,
    ).toBe(true);
  });

  it("E — partMaxVenParCycleBps peut être sensible", () => {
    const { parGene } = evaluerSensibiliteCandidatExpositionV03({
      seeds: [401],
      cyclesParSeed: 20,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    const g = parGene.find((x) => x.cleGene === "partMaxVenParCycleBps")!;
    expect(g.contextesSensibles).toBeGreaterThan(0);
    expect(g.auMoinsUneDifferenceCognition || g.auMoinsUneDifferencePolitique).toBe(
      true,
    );
  });

  it("F — plafondCognitifMicroUsdc peut être sensible", () => {
    const { parGene } = evaluerSensibiliteCandidatExpositionV03({
      seeds: [401],
      cyclesParSeed: 20,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    const g = parGene.find((x) => x.cleGene === "plafondCognitifMicroUsdc")!;
    expect(g.contextesSensibles).toBeGreaterThan(0);
  });

  it("G — comportementSansInference peut être sensible", () => {
    const { parGene } = evaluerSensibiliteCandidatExpositionV03({
      seeds: [401],
      cyclesParSeed: 20,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    const g = parGene.find((x) => x.cleGene === "comportementSansInference")!;
    expect(g.contextesSensibles).toBeGreaterThan(0);
    expect(
      g.auMoinsUneDifferenceDecision || g.auMoinsUneDifferenceCognition,
    ).toBe(true);
  });

  it("H — config différente sans effet aval ≠ sensibilité", () => {
    expect(
      estContexteSensibleV03({
        differencePolitique: false,
        differenceCognition: false,
        differenceDecision: false,
        differenceEconomique: false,
      }),
    ).toBe(false);
  });

  it("I — niveaux politique/cognition/économique distingués", () => {
    const voisin = premierVoisinCanoniqueGeneV03(
      "seuilEnjeuPourInferenceMicroUsdc",
      "100000",
    );
    const c = evaluerContexteSensibiliteGeneV03({
      seed: 401,
      numeroCycle: 3,
      cleGene: "seuilEnjeuPourInferenceMicroUsdc",
      voisin,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    expect(typeof c.niveaux.differencePolitique).toBe("boolean");
    expect(typeof c.niveaux.differenceCognition).toBe("boolean");
    expect(typeof c.niveaux.differenceDecision).toBe("boolean");
    expect(typeof c.niveaux.differenceEconomique).toBe("boolean");
  });

  it("J — seeds diagnostic uniquement (401–405)", () => {
    expect(SEEDS_DIAGNOSTIC_EXPOSITION_V03).toEqual([
      401, 402, 403, 404, 405,
    ]);
    expect(() => assertSeedsDiagnosticExpositionV03Libres()).not.toThrow();
  });

  it("K — collision calibration/évaluation rejetée", () => {
    expect(() =>
      assertPasDeReutilisationSeedsDiagnosticV03({
        seedsCalibration: [401, 501],
      }),
    ).toThrow(/calibration refuse seeds diagnostic/);
    expect(() =>
      assertPasDeReutilisationSeedsDiagnosticV03({
        seedsEvaluation: [3001, 405],
      }),
    ).toThrow(/évaluation refuse seeds diagnostic/);
  });

  it("L/M — premier candidat satisfaisant → arrêt ; suivants non exécutés", () => {
    const arret = appliquerRegleArretPremierSatisfaisantV03([
      { identifiantCandidat: "E0", evaluation: evaluationFactice("insuffisante") },
      {
        identifiantCandidat: "E1",
        evaluation: evaluationFactice("exposition_suffisante"),
      },
      {
        identifiantCandidat: "E2",
        evaluation: evaluationFactice("exposition_suffisante"),
      },
    ]);
    expect(arret.candidatRetenu).toBe("E1");
    expect(arret.candidatsEvalues).toEqual(["E0", "E1"]);
    expect(arret.candidatsNonEvalues).toEqual(["E2"]);
  });

  it("N — aucun candidat satisfaisant → diagnostic insuffisant", () => {
    const arret = appliquerRegleArretPremierSatisfaisantV03([
      { identifiantCandidat: "E0", evaluation: evaluationFactice("insuffisante") },
      { identifiantCandidat: "E1", evaluation: evaluationFactice("insuffisante") },
      { identifiantCandidat: "E2", evaluation: evaluationFactice("insuffisante") },
    ]);
    expect(arret.candidatRetenu).toBeNull();
    expect(arret.statut).toBe("diagnostic_exposition_non_satisfaisant");
  });

  it("O — contrôle positif capacité 0 vs 1", () => {
    const r = executerControlePositifReproductionV03();
    expect(r.franchissement0vers1).toBe(true);
    expect(r.points[0]?.capaciteTheorique).toBe("0");
    expect(r.points[1]?.capaciteTheorique).toBe("1");
  });

  it("P — contrôle positif capacité 1 vs 2", () => {
    const r = executerControlePositifReproductionV03();
    expect(r.franchissement1vers2).toBe(true);
    expect(r.points[2]?.capaciteTheorique).toBe("1");
    expect(r.points[3]?.capaciteTheorique).toBe("2");
  });

  it("Q — aucun classement/fitness dans le rapport", () => {
    const rapport = executerDiagnosticExpositionV03({
      seeds: [401],
      cyclesParSeed: 4,
      sequenceCandidats: [CANDIDAT_EXPOSITION_E0],
    });
    const texte = JSON.stringify(rapport);
    expect(texte).not.toMatch(
      /meilleur gène|mutation favorable|score adaptatif|classement|fitness globale|variant gagnant/i,
    );
    expect(rapport.mentionAntiOptimisation).toContain("D-C");
  });

  it("R — B≢C force → diagnostic insuffisant", () => {
    const rapport = executerDiagnosticExpositionV03({
      seeds: [401],
      cyclesParSeed: 8,
      sequenceCandidats: [CANDIDAT_EXPOSITION_E0],
      controleNegatifBcForce: {
        ok: false,
        detail: "divergence injectée",
      },
    });
    expect(rapport.controleNegatifBc.ok).toBe(false);
    expect(rapport.verdictGlobal).toBe("EXPOSITION_INSUFFISANTE");
  });

  it("S — même diagnostic rejoué → même empreinte", () => {
    const opts = {
      seeds: [401, 402] as const,
      cyclesParSeed: 5,
      sequenceCandidats: [CANDIDAT_EXPOSITION_E0],
    };
    const a = executerDiagnosticExpositionV03(opts);
    const b = executerDiagnosticExpositionV03(opts);
    expect(a.empreinteSha256).toBe(b.empreinteSha256);
  });

  it("T — ordre des contextes déterministe (rejeu)", () => {
    const a = evaluerSensibiliteCandidatExpositionV03({
      seeds: [403],
      cyclesParSeed: 3,
      environnementDecision: CANDIDAT_EXPOSITION_E1.environnementDecision,
    });
    const b = evaluerSensibiliteCandidatExpositionV03({
      seeds: [403],
      cyclesParSeed: 3,
      environnementDecision: CANDIDAT_EXPOSITION_E1.environnementDecision,
    });
    expect(a.contextes.map((c) => c.identifiantObservation)).toEqual(
      b.contextes.map((c) => c.identifiantObservation),
    );
  });

  it("U — versions protocole v0.1/v0.2 inchangées", () => {
    expect(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION).toBe(
      "protocole-experience-evolution-v01",
    );
    expect(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02).toBe(
      "protocole-experience-evolution-v02",
    );
  });

  it("V — sélection sans lecture D−C (audit structurel)", () => {
    const { parGene } = evaluerSensibiliteCandidatExpositionV03({
      seeds: [401],
      cyclesParSeed: 2,
      environnementDecision: CANDIDAT_EXPOSITION_E0.environnementDecision,
    });
    expect(() =>
      assertEntreeSelectionSansPerformanceDC({
        identifiantCandidat: "E0",
        agregatsParGene: parGene,
      }),
    ).not.toThrow();

    expect(() =>
      assertEntreeSelectionSansPerformanceDC({
        identifiantCandidat: "E0",
        agregatsParGene: parGene,
        // @ts-expect-error champ interdit pour audit
        deltaDC: "1",
      } as never),
    ).toThrow(/deltaDC|performance/);
  });

  it("règle voisin = premier de voisinsUnPasGene", () => {
    expect(
      premierVoisinCanoniqueGeneV03(
        "seuilEnjeuPourInferenceMicroUsdc",
        "100000",
      ).valeur,
    ).toBe("50000");
    expect(
      premierVoisinCanoniqueGeneV03("partMaxVenParCycleBps", 50).valeur,
    ).toBe(25);
    expect(
      premierVoisinCanoniqueGeneV03("plafondCognitifMicroUsdc", "10000").valeur,
    ).toBe("5000");
    expect(
      premierVoisinCanoniqueGeneV03(
        "comportementSansInference",
        "agir_si_favorable",
      ).valeur,
    ).toBe("attendre");
  });

  it("critères prédéfinis documentés", () => {
    expect(CRITERES_EXPOSITION_SUFFISANTE_V03.seedsSensiblesMinimumParGene).toBe(
      5,
    );
    expect(
      CRITERES_EXPOSITION_SUFFISANTE_V03.contextesSensiblesMinimumParGene,
    ).toBe(10);
    expect(CRITERES_EXPOSITION_SUFFISANTE_V03.effetEconomiqueBloquant).toBe(
      false,
    );
  });

  it("séquence candidats prédéfinie E0→E1→E2", () => {
    expect(SEQUENCE_CANDIDATS_EXPOSITION_V03.map((c) => c.identifiant)).toEqual([
      "E0",
      "E1",
      "E2",
    ]);
    expect(CANDIDAT_EXPOSITION_E2.enjeuxPossiblesMicroUsdc.length).toBeGreaterThan(
      CANDIDAT_EXPOSITION_E0.enjeuxPossiblesMicroUsdc.length,
    );
  });

  it("diagnostic réel court produit artefact", () => {
    const out = tempDir();
    const rapport = executerDiagnosticExpositionV03({
      repertoireSortie: out,
      seeds: SEEDS_DIAGNOSTIC_EXPOSITION_V03,
      cyclesParSeed: CRITERES_EXPOSITION_SUFFISANTE_V03.cyclesParSeed,
    });
    expect(existsSync(join(out, "exposition-evolution-v03.json"))).toBe(true);
    const brut = JSON.parse(
      readFileSync(join(out, "exposition-evolution-v03.json"), "utf8"),
    ) as { empreinteSha256: string; statut: string };
    expect(brut.statut).toBe("diagnostic");
    expect(brut.empreinteSha256).toBe(rapport.empreinteSha256);
    expect(rapport.seedsDiagnostiques).toEqual(SEEDS_DIAGNOSTIC_EXPOSITION_V03);
    // Empreinte SHA-256 format
    expect(rapport.empreinteSha256.startsWith("sha256:")).toBe(true);
    const hex = rapport.empreinteSha256.slice("sha256:".length);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("évaluateur critères distingue insuffisant", () => {
    const faux = evaluerCriteresExpositionV03([
      {
        cleGene: "seuilEnjeuPourInferenceMicroUsdc",
        voisinRetenu: {
          cle: "seuilEnjeuPourInferenceMicroUsdc",
          valeur: "50000",
          direction: "moins",
        },
        seedsTotal: 5,
        seedsSensibles: 1,
        contextesTestes: 10,
        contextesSensibles: 1,
        cyclesSensibles: 1,
        auMoinsUneDifferencePolitique: true,
        auMoinsUneDifferenceCognition: false,
        auMoinsUneDifferenceDecision: false,
        auMoinsUneDifferenceEconomique: false,
        typesEffetsObserves: ["politique"],
      },
    ]);
    expect(faux.verdict).toBe("insuffisante");
  });

  it("audit — provenance E0 = héritage v0.2 E2", () => {
    expect(CANDIDAT_EXPOSITION_E0.enjeuxPossiblesMicroUsdc).toEqual([
      "50000",
      "75000",
      "125000",
      "175000",
      "250000",
    ]);
    expect(CANDIDAT_EXPOSITION_E0.provenance?.origine).toMatch(
      /héritée du diagnostic mécaniste v0\.2/,
    );
    expect(CANDIDAT_EXPOSITION_E0.provenance?.notes.join(" ")).toMatch(/D.C/);
  });

  it("audit — silence économique gènes numériques documenté (motif D)", () => {
    expect(AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03.motifPrincipal).toBe(
      "D",
    );
    expect(AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03.genesConcernes).toContain(
      "partMaxVenParCycleBps",
    );
  });

  it("audit — contrôle positif formule + refs intégration v03-B", () => {
    const r = executerControlePositifReproductionV03();
    expect(r.preuveFormule).toBe("calculerCapaciteReproductiveTheoriqueV03");
    expect(r.preuveIntegrationControleur.referencesTests).toEqual(
      REFERENCES_INTEGRATION_REPRODUCTION_V03_B,
    );
    expect(r.preuveIntegrationControleur.chaine).toMatch(/naissances réelles/);
    // Les fichiers de tests référencés existent.
    for (const ref of REFERENCES_INTEGRATION_REPRODUCTION_V03_B) {
      const chemin = ref.split(" — ")[0]!;
      expect(existsSync(join(process.cwd(), chemin))).toBe(true);
    }
  });

  it("audit — artefact E0 : provenance, non-exec E1/E2, non-freeze, empreinte stable", () => {
    const out = tempDir();
    const a = executerDiagnosticExpositionV03({
      repertoireSortie: out,
      seeds: SEEDS_DIAGNOSTIC_EXPOSITION_V03,
    });
    const b = executerDiagnosticExpositionV03({
      seeds: SEEDS_DIAGNOSTIC_EXPOSITION_V03,
    });
    expect(a.empreinteSha256).toBe(b.empreinteSha256);
    expect(a.candidatRetenu).toBe("E0");
    expect(a.candidatsExecutes).toEqual(["E0"]);
    expect(a.statutCandidatsNonExecutes).toBe("non_executes_apres_succes_e0");
    expect(a.candidatsNonExecutesApresSucces).toEqual(["E1", "E2"]);
    expect(a.statutScientifique).toBe("non_freeze");
    expect(a.provenanceCandidatRetenu).toMatchObject({
      origine: expect.stringMatching(/v0\.2/),
    });
    expect(a.pressionGardeFous.pressionNumerateur).toBe("1");
    expect(a.pressionGardeFous.pressionDenominateur).toBe("5");
    expect(a.pressionGardeFous.definitionSignalDomination).toMatch(
      /grossier de domination/,
    );
    expect(a.sensVerdictExposition).toMatch(/PHENOTYPIQUE_CAUSALE/);
    expect(a.horsPerimetre).toMatch(/v03_F/);
    const eco = a.resultatsCandidats[0]!.niveauxExpositionParGene;
    for (const g of [
      "seuilEnjeuPourInferenceMicroUsdc",
      "partMaxVenParCycleBps",
      "plafondCognitifMicroUsdc",
    ]) {
      const n = eco.find((x) => x.cleGene === g)!;
      expect(n.expositionCognitiveOuDecisionnelle).toBe(true);
      expect(n.expositionEconomiqueObservee).toBe(false);
    }
  });
});
