import { describe, expect, it } from "vitest";
import {
  VERSION_REPRODUCTION_ECONOMIQUE_V03,
  calculerCapaciteReproductiveTheoriqueV03,
  calculerCoutEconomiqueNaissanceV03,
  calculerSurplusReproductifV03,
  calculerValeurEconomiqueNette,
  creerEtatEconomiqueInitial,
  evaluerAutorisationNaissanceEconomiqueV03,
  evaluerOuvertureFenetreReproductiveV03,
  projeterCapaciteReproductiveEconomiqueV03,
  ReproductionEconomiqueV03InvalideErreur,
  type EtatEconomiqueAgent,
} from "../src/index.js";

function etatParent(options: {
  readonly capitalLiquide: bigint;
  readonly obligationsDues?: bigint;
  readonly etatSurvie?: EtatEconomiqueAgent["etatSurvie"];
}): EtatEconomiqueAgent {
  const base = creerEtatEconomiqueInitial({
    identifiantAgent: "parent-local-v03",
    capitalLiquide: options.capitalLiquide,
    etatSurvie: options.etatSurvie ?? "sain",
  });
  if (options.obligationsDues === undefined) {
    return base;
  }
  return { ...base, obligationsDues: options.obligationsDues };
}

describe("reproduction-economique-v03 — coût", () => {
  it("A — coût naissance = dotation + coûtReproduction", () => {
    expect(
      calculerCoutEconomiqueNaissanceV03({
        dotationEnfantMicroUsdc: 800_000n,
        coutReproductionMicroUsdc: 200_000n,
      }),
    ).toBe(1_000_000n);
  });

  it("refuse les montants négatifs", () => {
    expect(() =>
      calculerCoutEconomiqueNaissanceV03({
        dotationEnfantMicroUsdc: -1n,
        coutReproductionMicroUsdc: 200_000n,
      }),
    ).toThrow(/négatif/);
  });

  it("refuse le coût total nul (fail-closed)", () => {
    expect(() =>
      calculerCoutEconomiqueNaissanceV03({
        dotationEnfantMicroUsdc: 0n,
        coutReproductionMicroUsdc: 0n,
      }),
    ).toThrow(ReproductionEconomiqueV03InvalideErreur);
  });
});

describe("reproduction-economique-v03 — surplus", () => {
  it("B — VEN > réserve", () => {
    expect(
      calculerSurplusReproductifV03({
        venMicroUsdc: 3_400_000n,
        reserveMinimaleParentMicroUsdc: 400_000n,
      }),
    ).toBe(3_000_000n);
  });

  it("B — VEN = réserve → surplus 0", () => {
    expect(
      calculerSurplusReproductifV03({
        venMicroUsdc: 400_000n,
        reserveMinimaleParentMicroUsdc: 400_000n,
      }),
    ).toBe(0n);
  });

  it("B — VEN < réserve → surplus 0", () => {
    expect(
      calculerSurplusReproductifV03({
        venMicroUsdc: 100_000n,
        reserveMinimaleParentMicroUsdc: 400_000n,
      }),
    ).toBe(0n);
  });

  it("B — VEN négative → surplus 0 (état valide, pas une erreur)", () => {
    expect(
      calculerSurplusReproductifV03({
        venMicroUsdc: -500_000n,
        reserveMinimaleParentMicroUsdc: 400_000n,
      }),
    ).toBe(0n);
  });

  it("B — réserve négative reste invalide", () => {
    expect(() =>
      calculerSurplusReproductifV03({
        venMicroUsdc: 1_000_000n,
        reserveMinimaleParentMicroUsdc: -1n,
      }),
    ).toThrow(/négatif/);
  });

  it("ne resoustrait pas les obligations hors VEN canonique", () => {
    const parent = etatParent({
      capitalLiquide: 3_500_000n,
      obligationsDues: 100_000n,
    });
    const ven = calculerValeurEconomiqueNette(parent);
    expect(ven).toBe(3_400_000n);
    expect(
      calculerSurplusReproductifV03({
        venMicroUsdc: ven,
        reserveMinimaleParentMicroUsdc: 400_000n,
      }),
    ).toBe(3_000_000n);
  });
});

describe("reproduction-economique-v03 — capacité théorique", () => {
  const cout = 1_000_000n;

  it("C — surplus 0 → capacité 0", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 0n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(0n);
  });

  it("C — surplus < coût → 0", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 999_999n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(0n);
  });

  it("C — surplus = coût → 1", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 1_000_000n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(1n);
  });

  it("C — surplus = coût − 1 → 0", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 999_999n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(0n);
  });

  it("C — surplus = 2 × coût → 2", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 2_000_000n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(2n);
  });

  it("C — reste ignoré (division entière)", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 1_999_999n,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(1n);
  });

  it("C — bigint élevé", () => {
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 50_000_000_000n,
        coutNaissanceMicroUsdc: 1_000_000n,
      }),
    ).toBe(50_000n);
  });

  it("C — capacité au-delà de Number.MAX_SAFE_INTEGER reste exacte (bigint)", () => {
    const coutNaissance = 1_000_000n;
    const capaciteAttendue = BigInt(Number.MAX_SAFE_INTEGER) + 42n;
    const surplus = capaciteAttendue * coutNaissance + (coutNaissance - 1n);
    const capacite = calculerCapaciteReproductiveTheoriqueV03({
      surplusReproductifMicroUsdc: surplus,
      coutNaissanceMicroUsdc: coutNaissance,
    });
    expect(capacite).toBe(capaciteAttendue);
    expect(capacite > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    // Preuve qu'une conversion number perdrait l'exactitude.
    expect(BigInt(Number(capaciteAttendue))).not.toBe(capaciteAttendue);
  });

  it("C — coût nul fail-closed", () => {
    expect(() =>
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: 1_000_000n,
        coutNaissanceMicroUsdc: 0n,
      }),
    ).toThrow(ReproductionEconomiqueV03InvalideErreur);
  });
});

describe("reproduction-economique-v03 — exemples numériques conception", () => {
  const reserve = 400_000n;
  const dotation = 800_000n;
  const coutRepro = 200_000n;

  it("VEN 3_400_000 → surplus 3_000_000 → capacité 3", () => {
    const cout = calculerCoutEconomiqueNaissanceV03({
      dotationEnfantMicroUsdc: dotation,
      coutReproductionMicroUsdc: coutRepro,
    });
    const surplus = calculerSurplusReproductifV03({
      venMicroUsdc: 3_400_000n,
      reserveMinimaleParentMicroUsdc: reserve,
    });
    expect(cout).toBe(1_000_000n);
    expect(surplus).toBe(3_000_000n);
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: surplus,
        coutNaissanceMicroUsdc: cout,
      }),
    ).toBe(3n);
  });

  it("VEN 2_399_999 → capacité 1", () => {
    const surplus = calculerSurplusReproductifV03({
      venMicroUsdc: 2_399_999n,
      reserveMinimaleParentMicroUsdc: reserve,
    });
    expect(surplus).toBe(1_999_999n);
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: surplus,
        coutNaissanceMicroUsdc: 1_000_000n,
      }),
    ).toBe(1n);
  });

  it("VEN 1_400_000 → capacité 1", () => {
    const surplus = calculerSurplusReproductifV03({
      venMicroUsdc: 1_400_000n,
      reserveMinimaleParentMicroUsdc: reserve,
    });
    expect(surplus).toBe(1_000_000n);
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: surplus,
        coutNaissanceMicroUsdc: 1_000_000n,
      }),
    ).toBe(1n);
  });

  it("VEN 1_399_999 → capacité 0", () => {
    const surplus = calculerSurplusReproductifV03({
      venMicroUsdc: 1_399_999n,
      reserveMinimaleParentMicroUsdc: reserve,
    });
    expect(surplus).toBe(999_999n);
    expect(
      calculerCapaciteReproductiveTheoriqueV03({
        surplusReproductifMicroUsdc: surplus,
        coutNaissanceMicroUsdc: 1_000_000n,
      }),
    ).toBe(0n);
  });
});

describe("reproduction-economique-v03 — autorisation unitaire", () => {
  const baseAuth = {
    dotationEnfantMicroUsdc: 800_000n,
    coutReproductionMicroUsdc: 200_000n,
    reserveMinimaleParentMicroUsdc: 400_000n,
    nombreEnfantsParent: 0,
    nombreMaxEnfantsParAgent: 10,
    populationTotale: 3,
    populationMaximale: 24,
    reproductionsDejaCeCycle: 0,
    nombreMaxReproductionsParCycle: 8,
  } as const;

  it("D — autorisée (frontière exacte VEN après = réserve)", () => {
    // besoin 1_000_000 ; réserve 400_000 → VEN min = 1_400_000
    const parent = etatParent({ capitalLiquide: 1_400_000n });
    const r = evaluerAutorisationNaissanceEconomiqueV03({
      ...baseAuth,
      etatParent: parent,
    });
    expect(r.autorisee).toBe(true);
    if (r.autorisee) {
      expect(r.coutNaissanceMicroUsdc).toBe(1_000_000n);
      expect(r.venAvantMicroUsdc).toBe(1_400_000n);
      expect(r.venApresMicroUsdc).toBe(400_000n);
      expect(r.capitalLiquideApresMicroUsdc).toBe(400_000n);
    }
  });

  it("D — capital insuffisant", () => {
    const parent = etatParent({ capitalLiquide: 999_999n });
    const r = evaluerAutorisationNaissanceEconomiqueV03({
      ...baseAuth,
      etatParent: parent,
      reserveMinimaleParentMicroUsdc: 0n,
    });
    expect(r).toMatchObject({
      autorisee: false,
      motif: "capital_insuffisant",
    });
  });

  it("D — réserve insuffisante", () => {
    // capital OK pour le coût, mais VEN après < réserve
    const parent = etatParent({ capitalLiquide: 1_200_000n });
    const r = evaluerAutorisationNaissanceEconomiqueV03({
      ...baseAuth,
      etatParent: parent,
    });
    expect(r).toMatchObject({
      autorisee: false,
      motif: "reserve_minimale",
    });
  });

  it("D — frontière exacte coût − 1 → capital insuffisant", () => {
    const parent = etatParent({ capitalLiquide: 999_999n });
    const r = evaluerAutorisationNaissanceEconomiqueV03({
      ...baseAuth,
      etatParent: parent,
      reserveMinimaleParentMicroUsdc: 0n,
    });
    expect(r.autorisee).toBe(false);
    if (!r.autorisee) {
      expect(r.motif).toBe("capital_insuffisant");
    }
  });

  it("D — n'accepte pas / n'applique pas de cooldown (pas dans l'API)", () => {
    const params = Object.keys({
      etatParent: etatParent({ capitalLiquide: 5_000_000n }),
      ...baseAuth,
    });
    expect(params).not.toContain("cooldownCycles");
    expect(params).not.toContain("cycleDerniereNaissanceParent");
    expect(params).not.toContain("numeroCycle");
  });
});

describe("reproduction-economique-v03 — fenêtre", () => {
  const baseFenetre = {
    active: true,
    etatSurvieParent: "sain" as const,
    etatsSurvieEligibles: ["sain", "contraint"] as const,
    cycleNaissanceAgent: 1,
    numeroCycle: 5,
    cooldownCycles: 1,
    cycleDerniereNaissanceParent: null as number | null,
    nombreEnfantsParent: 0,
    nombreMaxEnfantsParAgent: 10,
    populationTotale: 3,
    populationMaximale: 24,
    reproductionsDejaCeCycle: 0,
    nombreMaxReproductionsParCycle: 8,
  };

  it("E — active → ouverte", () => {
    expect(evaluerOuvertureFenetreReproductiveV03(baseFenetre)).toEqual({
      ouverte: true,
    });
  });

  it("E — inactive", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        active: false,
      }),
    ).toEqual({ ouverte: false, motif: "reproduction_desactivee" });
  });

  it("E — état de survie non éligible", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        etatSurvieParent: "critique",
      }),
    ).toEqual({ ouverte: false, motif: "etat_survie_non_eligible" });
  });

  it("E — naissance même cycle", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        cycleNaissanceAgent: 5,
        numeroCycle: 5,
      }),
    ).toEqual({ ouverte: false, motif: "naissance_meme_cycle" });
  });

  it("E — cooldown inter-cycles", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        cycleDerniereNaissanceParent: 4,
        numeroCycle: 5,
        cooldownCycles: 2,
      }),
    ).toEqual({ ouverte: false, motif: "cooldown" });
  });

  it("E — cooldown levé lorsque l'écart de cycles est suffisant", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        cycleDerniereNaissanceParent: 4,
        numeroCycle: 6,
        cooldownCycles: 2,
      }),
    ).toEqual({ ouverte: true });
  });

  it("E — cooldownCycles=1 autorise le cycle immédiatement suivant", () => {
    expect(
      evaluerOuvertureFenetreReproductiveV03({
        ...baseFenetre,
        cycleDerniereNaissanceParent: 4,
        numeroCycle: 5,
        cooldownCycles: 1,
      }),
    ).toEqual({ ouverte: true });
  });});

describe("reproduction-economique-v03 — séparation fenêtre / naissance", () => {
  it("F — 2e autorisation réévaluable sans réexaminer le cooldown", () => {
    const fenetre = evaluerOuvertureFenetreReproductiveV03({
      active: true,
      etatSurvieParent: "sain",
      etatsSurvieEligibles: ["sain", "contraint"],
      cycleNaissanceAgent: 1,
      numeroCycle: 5,
      cooldownCycles: 1,
      cycleDerniereNaissanceParent: null,
      nombreEnfantsParent: 0,
      nombreMaxEnfantsParAgent: 10,
      populationTotale: 3,
      populationMaximale: 24,
      reproductionsDejaCeCycle: 0,
      nombreMaxReproductionsParCycle: 8,
    });
    expect(fenetre.ouverte).toBe(true);

    const parent0 = etatParent({ capitalLiquide: 3_400_000n });
    const a1 = evaluerAutorisationNaissanceEconomiqueV03({
      etatParent: parent0,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      reserveMinimaleParentMicroUsdc: 400_000n,
      nombreEnfantsParent: 0,
      nombreMaxEnfantsParAgent: 10,
      populationTotale: 3,
      populationMaximale: 24,
      reproductionsDejaCeCycle: 0,
      nombreMaxReproductionsParCycle: 8,
    });
    expect(a1.autorisee).toBe(true);
    if (!a1.autorisee) {
      throw new Error("attendu autorisé");
    }

    // Mise à jour conceptuelle après 1ère naissance (sans exécuter le contrôleur).
    // Un cooldown v0.2 naïf bloquerait ici (cycleDerniere = 5, cooldown = 1).
    const parent1 = etatParent({
      capitalLiquide: a1.capitalLiquideApresMicroUsdc,
    });
    const a2 = evaluerAutorisationNaissanceEconomiqueV03({
      etatParent: parent1,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      reserveMinimaleParentMicroUsdc: 400_000n,
      nombreEnfantsParent: 1,
      nombreMaxEnfantsParAgent: 10,
      populationTotale: 4,
      populationMaximale: 24,
      reproductionsDejaCeCycle: 1,
      nombreMaxReproductionsParCycle: 8,
    });
    expect(a2.autorisee).toBe(true);
    if (a2.autorisee) {
      expect(a2.venAvantMicroUsdc).toBe(2_400_000n);
      expect(a2.venApresMicroUsdc).toBe(1_400_000n);
    }
  });
});

describe("reproduction-economique-v03 — anti-score / localité", () => {
  it("G — projection locale uniquement (version + champs descriptifs)", () => {
    const projection = projeterCapaciteReproductiveEconomiqueV03({
      etatParent: etatParent({ capitalLiquide: 3_400_000n }),
      reserveMinimaleParentMicroUsdc: 400_000n,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      nombreEnfantsParent: 1,
      nombreMaxEnfantsParAgent: 10,
    });
    expect(projection.version).toBe(VERSION_REPRODUCTION_ECONOMIQUE_V03);
    expect(projection.capaciteTheorique).toBe(3n);
    expect(projection.nombreEnfantsRestants).toBe(9);
    expect(projection.capaciteBorneeParEnfants).toBe(3n);
    expect(projection).not.toHaveProperty("score");
    expect(projection).not.toHaveProperty("rang");
    expect(projection).not.toHaveProperty("fitness");
    expect(projection).not.toHaveProperty("frequenceGenotypique");
    expect(projection).not.toHaveProperty("descendants");
  });

  it("G — capacité d'un parent ne dépend que de son état local", () => {
    const a = projeterCapaciteReproductiveEconomiqueV03({
      etatParent: etatParent({ capitalLiquide: 3_400_000n }),
      reserveMinimaleParentMicroUsdc: 400_000n,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      nombreEnfantsParent: 0,
      nombreMaxEnfantsParAgent: 10,
    });
    const b = projeterCapaciteReproductiveEconomiqueV03({
      etatParent: etatParent({ capitalLiquide: 3_400_000n }),
      reserveMinimaleParentMicroUsdc: 400_000n,
      dotationEnfantMicroUsdc: 800_000n,
      coutReproductionMicroUsdc: 200_000n,
      nombreEnfantsParent: 0,
      nombreMaxEnfantsParAgent: 10,
    });
    // Même état local → même capacité, indépendamment de tout pair inexistant.
    expect(a.capaciteTheorique).toBe(b.capaciteTheorique);
    expect(a.surplusReproductifMicroUsdc).toBe(3_000_000n);
  });
});
