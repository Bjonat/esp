/**
 * Tests freeze pré-évaluation évolution ESP v0.2 (A–P).
 * Aucune seed d'évaluation 2001..2020 exécutée.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2,
  ETAT_FREEZE_GELE_NON_EXECUTE,
  EMPREINTE_RESULTAT_INCLUT_DIAGNOSTIC_EXPRESSION_V02,
  FreezeEvaluationInvalideErreur,
  GIT_REF_FREEZE_CANONIQUE_V02,
  IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2,
  IDENTIFIANT_PROTOCOLE_EVALUATION_V02,
  SEEDS_CALIBRATION_EVOLUTION_V02,
  SEEDS_DIAGNOSTIC_EXPRESSION_V02,
  SEEDS_EVALUATION_FIGEES_V01,
  SEEDS_EVALUATION_FIGEES_V02,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  assertSeedsEvaluationV02SansCollision,
  assertSansRankingFitnessGlobale,
  auditerAucunBatchEvaluationV02,
  auditerAucuneSeedEvaluationV02Executee,
  autoriserRetryMemeSeedMemeProtocoleV02,
  chargerFreezeEvolutionEvaluationDepuisFichier,
  chargerFreezeEvolutionEvaluationV02DepuisFichier,
  chargerProtocoleEvolutionDepuisObjet,
  chargerProtocoleEvolutionV02DepuisObjet,
  deriverProtocoleEvaluationV02DepuisCalibration,
  empreinteProtocoleV02,
  estEchecTechniqueV02,
  estResultatScientifiqueDefavorableV02,
  executerControleAComportementSansInference,
  executerControleBSeuilInference,
  executerControleCPlafondCognitif,
  executerControleDPartMaxVen,
  fabriquerConfigurationRunV02,
  intersectionSeeds,
  parserFreezeEvolutionEvaluationV02,
  protocolesPartagentParametresScientifiquesV02,
  validerFreezeContreProtocolesV02,
  type ProtocoleExperienceEvolutionV02Json,
} from "../src/index.js";

const RACINE = process.cwd();
const CHEMIN_CALIB = join(
  RACINE,
  "experiences/protocoles/evolution-calibration-v02-e1-01.json",
);
const CHEMIN_EVAL = join(
  RACINE,
  "experiences/protocoles/evolution-evaluation-v02.json",
);
const CHEMIN_FREEZE = join(
  RACINE,
  "experiences/protocoles/freeze-evolution-evaluation-v02.json",
);
const CHEMIN_PREENREG = join(
  RACINE,
  "documentation/PREENREGISTREMENT_EVOLUTION_V02.md",
);
const CHEMIN_EVAL_V01 = join(
  RACINE,
  "experiences/protocoles/evolution-evaluation-v01.json",
);
const CHEMIN_FREEZE_V01 = join(
  RACINE,
  "experiences/protocoles/freeze-evolution-evaluation-v01.json",
);
const CHEMIN_RESULTATS = join(RACINE, "experiences/resultats");

function chargerEval(): ReturnType<typeof chargerProtocoleEvolutionV02DepuisObjet> {
  return chargerProtocoleEvolutionV02DepuisObjet(
    JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")),
  );
}

function chargerCalib(): ReturnType<typeof chargerProtocoleEvolutionV02DepuisObjet> {
  return chargerProtocoleEvolutionV02DepuisObjet(
    JSON.parse(readFileSync(CHEMIN_CALIB, "utf8")),
  );
}

describe("freeze-evolution-evaluation-v02", () => {
  it("A — protocole v02 parsable", () => {
    const evalp = chargerEval();
    expect(evalp.version).toBe(VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02);
    expect(evalp.identifiantProtocole).toBe(IDENTIFIANT_PROTOCOLE_EVALUATION_V02);
    expect(evalp.mode).toBe("evaluation");
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.etat).toBe(ETAT_FREEZE_GELE_NON_EXECUTE);
  });

  it("B — exactement 20 seeds evaluation", () => {
    const evalp = chargerEval();
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(SEEDS_EVALUATION_FIGEES_V02).toHaveLength(20);
    expect(evalp.seedsEvaluation).toHaveLength(20);
    expect(freeze.nombreSeedsEvaluation).toBe(20);
    expect(freeze.seedsEvaluation).toHaveLength(20);
  });

  it("C — seeds = 2001..2020", () => {
    const attendues = Array.from({ length: 20 }, (_, i) => 2001 + i);
    expect([...SEEDS_EVALUATION_FIGEES_V02]).toEqual(attendues);
    const evalp = chargerEval();
    expect([...evalp.seedsEvaluation]).toEqual(attendues);
    expect([...evalp.seedsActives]).toEqual(attendues);
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect([...freeze.seedsEvaluation]).toEqual(attendues);
  });

  it("D — aucune collision avec seeds diagnostic/calibration/v01", () => {
    expect(
      intersectionSeeds(SEEDS_DIAGNOSTIC_EXPRESSION_V02, SEEDS_EVALUATION_FIGEES_V02),
    ).toEqual([]);
    expect(
      intersectionSeeds(SEEDS_CALIBRATION_EVOLUTION_V02, SEEDS_EVALUATION_FIGEES_V02),
    ).toEqual([]);
    expect(
      intersectionSeeds(SEEDS_EVALUATION_FIGEES_V01, SEEDS_EVALUATION_FIGEES_V02),
    ).toEqual([]);
    expect(() => assertSeedsEvaluationV02SansCollision()).not.toThrow();
  });

  it("E — environnement E2 exact", () => {
    const evalp = chargerEval();
    expect(evalp.environnementDecision.enjeuxPossiblesMicroUsdc).toEqual([
      ...ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2,
    ]);
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.referenceEnvironnementE2).toBe(
      IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2,
    );
    const calib = chargerCalib();
    expect(evalp.environnementDecision).toEqual(calib.environnementDecision);
  });

  it("F — mode decision_simulee", () => {
    const evalp = chargerEval();
    const conf = fabriquerConfigurationRunV02(evalp, "D", 2001);
    expect(conf.mode).toBe("decision_simulee");
    expect(conf.environnementDecision).toBeDefined();
    expect(conf.politiqueBudgetCognitif).toBeDefined();
  });

  it("G — fournisseur simulé uniquement", () => {
    const evalp = chargerEval();
    expect(evalp.fournisseur.identifiant).toBe("fournisseur-inference-simule");
    expect(evalp.fournisseur.selecteur).toBe("simule");
    expect(evalp.xway.fournisseur?.identifiant).toBe(
      "fournisseur-inference-simule",
    );
    const brut = JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")) as Record<
      string,
      unknown
    >;
    const { _commentaire: _c, ...corps } = brut;
    const texte = JSON.stringify(corps).toLowerCase();
    expect(texte).not.toMatch(/openai/);
    expect(texte).not.toMatch(/solana/);
    expect(texte).not.toMatch(/"live"/);
  });

  it("H — matrice A/B/C/D exacte", () => {
    const evalp = chargerEval();
    expect([...evalp.conditions]).toEqual(["A", "B", "C", "D"]);
    const confA = fabriquerConfigurationRunV02(evalp, "A", 2001);
    const confB = fabriquerConfigurationRunV02(evalp, "B", 2001);
    const confC = fabriquerConfigurationRunV02(evalp, "C", 2001);
    const confD = fabriquerConfigurationRunV02(evalp, "D", 2001);
    expect(confA.reproductionAutonome?.active).toBe(false);
    expect(confA.mutation?.active).toBe(false);
    expect(confB.reproductionAutonome?.active).toBe(true);
    expect(confB.mutation?.active).toBe(false);
    expect(confC.reproductionAutonome?.active).toBe(true);
    expect(confC.mutation?.active).toBe(true);
    expect(confC.mutation?.tauxMutationParGeneBps).toBe(0);
    expect(confD.reproductionAutonome?.active).toBe(true);
    expect(confD.mutation?.active).toBe(true);
    expect(confD.mutation?.tauxMutationParGeneBps).toBe(1000);
  });

  it("I — B/C contrôle négatif configuré", () => {
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.regles.controleNegatifBCBloquant).toBe(true);
    expect(freeze.comparaisonPrimaire).toBe("D-C");
    expect([...freeze.comparaisonsSecondaires]).toEqual(["B-A", "C-B", "D-B"]);
    expect(freeze.regles.runsPrevus).toBe(80);
  });

  it("J — paramètres identiques au candidat calibré", () => {
    const calib = chargerCalib();
    const evalp = chargerEval();
    expect(protocolesPartagentParametresScientifiquesV02(calib, evalp)).toBe(
      true,
    );
    const derive = deriverProtocoleEvaluationV02DepuisCalibration(calib);
    const deriveParse = chargerProtocoleEvolutionV02DepuisObjet(derive);
    expect(
      protocolesPartagentParametresScientifiquesV02(calib, deriveParse),
    ).toBe(true);
    expect(evalp.cyclesMaximum).toBe(20);
    expect(evalp.populationInitiale).toBe(3);
    expect(evalp.reproduction.populationMaximale).toBe(24);
    expect(evalp.reproduction.dotationEnfantMicroUsdc).toBe("800000");
    expect(evalp.reproduction.coutReproductionMicroUsdc).toBe("200000");
    expect(evalp.reproduction.reserveMinimaleParentMicroUsdc).toBe("400000");
    expect(evalp.reproductionAutonome.nombreMaxNaissancesParCycle).toBe(4);
    expect(evalp.mutationBase.tauxMutationParGeneBps).toBe(1000);
    expect(evalp.tauxMutationConditionDBps).toBe(1000);
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    validerFreezeContreProtocolesV02({
      freeze,
      protocoleEvaluation: evalp,
      protocoleCalibration: calib,
    });
  });

  it("K — empreinte protocole déterministe", () => {
    const evalp = chargerEval();
    const emp1 = empreinteProtocoleV02(evalp);
    const emp2 = empreinteProtocoleV02(evalp);
    expect(emp1).toBe(emp2);
    expect(emp1.startsWith("sha256:")).toBe(true);
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.empreinteProtocole).toBe(emp1);
    expect(freeze.empreinteProtocole).toBe(
      "sha256:a141e3893895c5cecc6454b9c5cd92bc85d48a7d0a8bb0e8df7661cb6cad9187",
    );
    const reparse = chargerProtocoleEvolutionV02DepuisObjet(
      JSON.parse(readFileSync(CHEMIN_EVAL, "utf8")),
    );
    expect(empreinteProtocoleV02(reparse)).toBe(emp1);
  });

  it("sémantique Git non canonique (préparation + ref tag)", () => {
    const brut = JSON.parse(readFileSync(CHEMIN_FREEZE, "utf8")) as Record<
      string,
      unknown
    >;
    expect(brut).not.toHaveProperty("gitSha");
    expect(brut).not.toHaveProperty("gitShaCanonique");
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.gitShaPreparation).toMatch(/^[0-9a-f]{40}$/);
    expect(freeze.gitRefFreezeCanonique).toBe(GIT_REF_FREEZE_CANONIQUE_V02);
    expect(freeze.gitRefFreezeCanonique).toBe(
      "esp-evolution-evaluation-v02-freeze",
    );
    expect(() =>
      parserFreezeEvolutionEvaluationV02({
        ...freeze,
        gitSha: freeze.gitShaPreparation,
      }),
    ).toThrow(/gitSha/);
    const doc = readFileSync(CHEMIN_PREENREG, "utf8");
    expect(doc).toMatch(/gitShaPreparation/);
    expect(doc).toMatch(/ne constitue pas/i);
    expect(doc).toMatch(/esp-evolution-evaluation-v02-freeze/);
  });

  it("L — nombreSeedsEvaluationExecutees = 0", () => {
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.nombreSeedsEvaluationExecutees).toBe(0);
    const n = auditerAucuneSeedEvaluationV02Executee({
      repertoireResultats: CHEMIN_RESULTATS,
    });
    expect(n).toBe(0);
  });

  it("M — aucun résultat evaluation-v02 présent", () => {
    expect(() => auditerAucunBatchEvaluationV02(CHEMIN_RESULTATS)).not.toThrow();
    const n = auditerAucuneSeedEvaluationV02Executee({
      repertoireResultats: CHEMIN_RESULTATS,
    });
    expect(n).toBe(0);
    expect(`nombreSeedsEvaluationExecutees = ${String(n)}`).toBe(
      "nombreSeedsEvaluationExecutees = 0",
    );
  });

  it("N — pré-enregistrement présent", () => {
    expect(existsSync(CHEMIN_PREENREG)).toBe(true);
    const doc = readFileSync(CHEMIN_PREENREG, "utf8");
    expect(doc).toMatch(/H1/);
    expect(doc).toMatch(/H2/);
    expect(doc).toMatch(/H3/);
    expect(doc).toMatch(/H4/);
    expect(doc).toMatch(/gele_non_execute/);
    expect(doc).toMatch(/2001/);
    expect(doc).toMatch(/2020/);
    expect(doc).toMatch(/environnement-exposition-v02-e2/);
    expect(doc).toMatch(/empreinteResultatScientifique/);
    expect(doc).toMatch(/ne font pas partie/i);
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    expect(freeze.documentPreenregistrement).toBe(
      "documentation/PREENREGISTREMENT_EVOLUTION_V02.md",
    );
    expect(freeze.hypotheses).toEqual(["H1", "H2", "H3", "H4"]);
    expect(EMPREINTE_RESULTAT_INCLUT_DIAGNOSTIC_EXPRESSION_V02).toBe(false);
  });

  it("O — v0.1 toujours non régressée", () => {
    expect(existsSync(CHEMIN_EVAL_V01)).toBe(true);
    expect(existsSync(CHEMIN_FREEZE_V01)).toBe(true);
    const evalV01 = chargerProtocoleEvolutionDepuisObjet(
      JSON.parse(readFileSync(CHEMIN_EVAL_V01, "utf8")),
    );
    expect(evalV01.identifiantProtocole).toBe("evolution-evaluation-v01");
    expect([...evalV01.seedsEvaluation]).toEqual([...SEEDS_EVALUATION_FIGEES_V01]);
    const freezeV01 = chargerFreezeEvolutionEvaluationDepuisFichier(
      CHEMIN_FREEZE_V01,
    );
    expect(freezeV01.etat).toBe(ETAT_FREEZE_GELE_NON_EXECUTE);
    expect([...freezeV01.seedsEvaluation]).toEqual([...SEEDS_EVALUATION_FIGEES_V01]);
  });

  it(
    "P — contrôles positifs génotype→phénotype toujours verts",
    async () => {
      expect((await executerControleAComportementSansInference()).ok).toBe(true);
      expect((await executerControleBSeuilInference()).ok).toBe(true);
      expect((await executerControleCPlafondCognitif()).ok).toBe(true);
      expect((await executerControleDPartMaxVen()).ok).toBe(true);
    },
    15_000,
  );

  it("retry technique vs performance scientifique", () => {
    expect(estEchecTechniqueV02("exception")).toBe(true);
    expect(estEchecTechniqueV02("sqlite_corrompu")).toBe(true);
    expect(estResultatScientifiqueDefavorableV02("d_inferieur_c")).toBe(true);
    expect(estResultatScientifiqueDefavorableV02("extinction")).toBe(true);
    expect(estEchecTechniqueV02("mauvaise_performance_economique")).toBe(false);
    const emp = "sha256:freeze";
    expect(
      autoriserRetryMemeSeedMemeProtocoleV02({
        seedDemandee: 2001,
        seedOriginale: 2001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "exception",
      }),
    ).toBe(true);
    expect(
      autoriserRetryMemeSeedMemeProtocoleV02({
        seedDemandee: 2001,
        seedOriginale: 2001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "d_inferieur_c",
      }),
    ).toBe(false);
    expect(
      autoriserRetryMemeSeedMemeProtocoleV02({
        seedDemandee: 2002,
        seedOriginale: 2001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "exception",
      }),
    ).toBe(false);
    expect(
      autoriserRetryMemeSeedMemeProtocoleV02({
        seedDemandee: 2001,
        seedOriginale: 2001,
        empreinteProtocoleActuelle: emp,
        empreinteProtocoleFreeze: emp,
        motif: "violation_BC",
      }),
    ).toBe(false);
  });

  it("protocole modifié après freeze refusé", () => {
    const freeze = chargerFreezeEvolutionEvaluationV02DepuisFichier(CHEMIN_FREEZE);
    const brut = JSON.parse(
      readFileSync(CHEMIN_EVAL, "utf8"),
    ) as ProtocoleExperienceEvolutionV02Json;
    const modifie: ProtocoleExperienceEvolutionV02Json = {
      ...brut,
      cyclesMaximum: brut.cyclesMaximum + 1,
    };
    const pMod = chargerProtocoleEvolutionV02DepuisObjet(modifie);
    expect(empreinteProtocoleV02(pMod)).not.toBe(freeze.empreinteProtocole);
    expect(() =>
      parserFreezeEvolutionEvaluationV02({
        ...freeze,
        nombreSeedsEvaluationExecutees: 1,
      }),
    ).toThrow(FreezeEvaluationInvalideErreur);
  });

  it("pas de ranking fitness", () => {
    assertSansRankingFitnessGlobale(readFileSync(CHEMIN_FREEZE, "utf8"));
    assertSansRankingFitnessGlobale(readFileSync(CHEMIN_EVAL, "utf8"));
    const doc = readFileSync(CHEMIN_PREENREG, "utf8");
    expect(doc).toMatch(/Interdits/i);
    expect(doc).toMatch(/multidimensionnelle/);
    expect(doc).toMatch(/scoreEvolution/);
  });
});
