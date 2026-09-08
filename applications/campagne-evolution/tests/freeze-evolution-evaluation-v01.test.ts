/**
 * Tests freeze pré-évaluation évolution ESP v0.1 (A–L).
 * Aucune seed d'évaluation exécutée.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPARAISON_PRIMAIRE_EVALUATION,
  COMPARAISONS_SECONDAIRES_EVALUATION,
  ETAT_FREEZE_GELE_NON_EXECUTE,
  FreezeEvaluationInvalideErreur,
  SEEDS_EVALUATION_FIGEES_V01,
  assertProtocoleEvaluationInchangeDepuisFreeze,
  assertSansRankingFitnessGlobale,
  auditerAucuneSeedEvaluationExecutee,
  autoriserRetryMemeSeedMemeProtocole,
  chargerFreezeEvolutionEvaluationDepuisFichier,
  chargerProtocoleEvolutionDepuisObjet,
  empreinteProtocole,
  estEchecTechnique,
  estResultatExperimental,
  extraireParametresExperimentauxPartages,
  parserFreezeEvolutionEvaluation,
  protocolesPartagentParametresExperimentaux,
  validerFreezeContreProtocoles,
  type ProtocoleExperienceEvolutionV01Json,
} from "../src/index.js";

const RACINE = process.cwd();
const CHEMIN_CALIB = join(
  RACINE,
  "experiences/protocoles/evolution-calibree-v01.json",
);
const CHEMIN_EVAL = join(
  RACINE,
  "experiences/protocoles/evolution-evaluation-v01.json",
);
const CHEMIN_FREEZE = join(
  RACINE,
  "experiences/protocoles/freeze-evolution-evaluation-v01.json",
);

describe("freeze-evolution-evaluation-v01", () => {
  it("A — freeze reprend paramètres calibrés", () => {
    const calib = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(CHEMIN_CALIB, "utf8")),
    );
    const evalp = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")),
    );
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(protocolesPartagentParametresExperimentaux(calib, evalp)).toBe(true);
    validerFreezeContreProtocoles({
      freeze,
      protocoleEvaluation: evalp,
      protocoleCalibration: calib,
    });
    const p = extraireParametresExperimentauxPartages(evalp);
    expect(p.cyclesMaximum).toBe(20);
    expect(p.populationMaximale).toBe(24);
    expect(p.nombreMaxNaissancesParCycle).toBe(4);
    expect(p.dotationEnfantMicroUsdc).toBe("800000");
    expect(p.coutReproductionMicroUsdc).toBe("200000");
    expect(p.reserveMinimaleParentMicroUsdc).toBe("400000");
    expect(p.tauxMutationParGeneBps).toBe(1000);
    expect(p.tauxMutationConditionDBps).toBe(1000);
  });

  it("B — seeds exactes", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    const evalp = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")),
    );
    expect([...freeze.seedsEvaluation]).toEqual([...SEEDS_EVALUATION_FIGEES_V01]);
    expect([...evalp.seedsEvaluation]).toEqual([...SEEDS_EVALUATION_FIGEES_V01]);
    expect([...evalp.seedsActives]).toEqual([...SEEDS_EVALUATION_FIGEES_V01]);
    expect(SEEDS_EVALUATION_FIGEES_V01).toHaveLength(20);
    expect(SEEDS_EVALUATION_FIGEES_V01[0]).toBe(1001);
    expect(SEEDS_EVALUATION_FIGEES_V01[19]).toBe(1020);
  });

  it("C — D-C primaire", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.comparaisonPrimaire).toBe("D-C");
    expect(COMPARAISON_PRIMAIRE_EVALUATION).toBe("D-C");
    expect([...freeze.comparaisonsSecondaires]).toEqual([
      ...COMPARAISONS_SECONDAIRES_EVALUATION,
    ]);
    expect([...freeze.comparaisonsSecondaires]).toEqual(["B-A", "C-B", "D-B"]);
  });

  it("D — extinction jamais exclue", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.regles.extinctionsJamaisExclues).toBe(true);
    const doc = readFileSync(
      join(RACINE, "documentation/PREENREGISTREMENT_EVOLUTION_V01.md"),
      "utf8",
    );
    expect(doc).toMatch(/jamais exclure une extinction/i);
    expect(doc).toMatch(/reste dans l'échantillon/);
  });

  it("E — garde-fou jamais exclu", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.regles.gardeFousJamaisExclus).toBe(true);
    const doc = readFileSync(
      join(RACINE, "documentation/PREENREGISTREMENT_EVOLUTION_V01.md"),
      "utf8",
    );
    expect(doc).toMatch(/jamais exclus/);
    expect(doc).toMatch(/runContraintParGardeFou/);
  });

  it("F — mauvaise performance != échec technique", () => {
    expect(estEchecTechnique("mauvaise_performance_economique")).toBe(false);
    expect(estResultatExperimental("mauvaise_performance_economique")).toBe(
      true,
    );
    expect(estEchecTechnique("ven_faible")).toBe(false);
    expect(estEchecTechnique("extinction")).toBe(false);
    expect(estEchecTechnique("crash_processus")).toBe(true);
    expect(
      autoriserRetryMemeSeedMemeProtocole({
        seedDemandee: 1001,
        seedOriginale: 1001,
        empreinteProtocoleActuelle: "sha256:abc",
        empreinteProtocoleFreeze: "sha256:abc",
        motif: "mauvaise_performance_economique",
      }),
    ).toBe(false);
  });

  it("G — retry même seed / même protocole", () => {
    const emp = "sha256:freeze";
    expect(
      autoriserRetryMemeSeedMemeProtocole({
        seedDemandee: 1001,
        seedOriginale: 1001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "crash_processus",
      }),
    ).toBe(true);
    expect(
      autoriserRetryMemeSeedMemeProtocole({
        seedDemandee: 1002,
        seedOriginale: 1001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "crash_processus",
      }),
    ).toBe(false);
    expect(
      autoriserRetryMemeSeedMemeProtocole({
        seedDemandee: 1001,
        seedOriginale: 1001,
        empreinteProtocoleActuelle: "sha256:autre",
        empreinteProtocoleFreeze: emp,
        motif: "crash_processus",
      }),
    ).toBe(false);
  });

  it("H — B/C bloquant", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.regles.controleNegatifBCBloquant).toBe(true);
    expect(
      autoriserRetryMemeSeedMemeProtocole({
        seedDemandee: 1001,
        seedOriginale: 1001,
        empreinteProtocoleActuelle: freeze.empreinteProtocole,
        empreinteProtocoleFreeze: freeze.empreinteProtocole,
        motif: "controle_negatif_BC_echoue",
      }),
    ).toBe(false);
  });

  it("I — protocole modifié refusé", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    const brut = JSON.parse(
      readFileSync(CHEMIN_EVAL, "utf8"),
    ) as ProtocoleExperienceEvolutionV01Json;
    const modifie: ProtocoleExperienceEvolutionV01Json = {
      ...brut,
      cyclesMaximum: brut.cyclesMaximum + 1,
    };
    const pMod = chargerProtocoleEvolutionDepuisObjet(modifie);
    expect(empreinteProtocole(pMod)).not.toBe(freeze.empreinteProtocole);
    expect(() =>
      assertProtocoleEvaluationInchangeDepuisFreeze(freeze, pMod),
    ).toThrow(FreezeEvaluationInvalideErreur);
    expect(() =>
      assertProtocoleEvaluationInchangeDepuisFreeze(
        freeze,
        chargerProtocoleEvolutionDepuisObjet(brut),
      ),
    ).not.toThrow();
  });

  it("J — aucune seed evaluation exécutée", () => {
    const n = auditerAucuneSeedEvaluationExecutee({
      repertoireResultats: join(RACINE, "experiences/resultats"),
    });
    expect(n).toBe(0);
    // console scientifique attendu pour audit humain
    expect(`nombreSeedsEvaluationExecutees = ${String(n)}`).toBe(
      "nombreSeedsEvaluationExecutees = 0",
    );
  });

  it("K — aucun ranking / fitness globale", () => {
    const freezeTexte = readFileSync(CHEMIN_FREEZE, "utf8");
    const evalTexte = readFileSync(CHEMIN_EVAL, "utf8");
    expect(() => assertSansRankingFitnessGlobale(freezeTexte)).not.toThrow();
    expect(() => assertSansRankingFitnessGlobale(evalTexte)).not.toThrow();
    expect(() =>
      assertSansRankingFitnessGlobale('{"scoreEvolution":1}'),
    ).toThrow(/scoreEvolution/);
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.regles.interdictionScoreRankingFitnessGlobale).toBe(true);
    const doc = readFileSync(
      join(RACINE, "documentation/PREENREGISTREMENT_EVOLUTION_V01.md"),
      "utf8",
    );
    expect(doc).toMatch(/Interdits/i);
    expect(doc).toMatch(/multidimensionnelle/);
  });

  it("L — état gele_non_execute", () => {
    const freeze = chargerFreezeEvolutionEvaluationDepuisFichier(CHEMIN_FREEZE);
    expect(freeze.etat).toBe(ETAT_FREEZE_GELE_NON_EXECUTE);
    expect(freeze.etat).toBe("gele_non_execute");
    expect(() =>
      parserFreezeEvolutionEvaluation({
        ...JSON.parse(readFileSync(CHEMIN_FREEZE, "utf8")),
        etat: "execute",
      }),
    ).toThrow(/gele_non_execute/);
    // Pas de SHA Git auto-référentiel
    const brut = JSON.parse(readFileSync(CHEMIN_FREEZE, "utf8")) as Record<
      string,
      unknown
    >;
    expect(brut).not.toHaveProperty("gitSha");
    expect(brut).not.toHaveProperty("gitShaAuFreeze");
    const evalBrut = JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")) as Record<
      string,
      unknown
    >;
    expect(evalBrut).not.toHaveProperty("gitShaAuFreeze");
    expect(existsSync(CHEMIN_FREEZE)).toBe(true);
  });
});
