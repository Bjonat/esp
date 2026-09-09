import { describe, expect, it } from "vitest";
import {
  VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
  VERSION_PARAMETRES_REPRODUCTION,
  MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
  calculerPrioriteReproductionNeutre,
  creerEtatEconomiqueInitial,
  creerPolitiqueReproductionAutonomeInactive,
  evaluerEligibiliteReproductionAutonome,
  ordonnerCandidatsParPrioriteNeutre,
  parserPolitiqueReproductionAutonome,
  planifierReproductionsAutonomes,
  serialiserPolitiqueReproductionAutonome,
  type ParametresReproductionExperience,
  type PolitiqueReproductionAutonome,
} from "../src/index.js";

function parametresReproductionActifs(
  surcharges: Partial<ParametresReproductionExperience> = {},
): ParametresReproductionExperience {
  return {
    version: VERSION_PARAMETRES_REPRODUCTION,
    active: true,
    dotationEnfantMicroUsdc: 1_000_000n,
    coutReproductionMicroUsdc: 100_000n,
    reserveMinimaleParentMicroUsdc: 0n,
    populationMaximale: 10,
    nombreMaxReproductionsParCycle: 5,
    nombreMaxEnfantsParAgent: 3,
    cooldownCycles: 0,
    ...surcharges,
  };
}

function politiqueActive(
  surcharges: Partial<PolitiqueReproductionAutonome> = {},
): PolitiqueReproductionAutonome {
  return {
    version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
    active: true,
    etatsSurvieEligibles: ["sain", "contraint"],
    nombreMaxNaissancesParCycle: 10,
    mecanisme: MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
    ...surcharges,
  };
}

describe("paramètres politique reproduction autonome", () => {
  it("sérialise / parse une politique active", () => {
    const politique = politiqueActive({
      nombreMaxNaissancesParCycle: 2,
    });
    const roundtrip = parserPolitiqueReproductionAutonome(
      serialiserPolitiqueReproductionAutonome(politique),
    );
    expect(roundtrip).toEqual(politique);
  });

  it("autorise etatsSurvieEligibles vide si inactive", () => {
    const politique = parserPolitiqueReproductionAutonome({
      version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      active: false,
      etatsSurvieEligibles: [],
      nombreMaxNaissancesParCycle: 0,
    });
    expect(politique.etatsSurvieEligibles).toEqual([]);
  });

  it("rejette etatsSurvieEligibles vide si active", () => {
    expect(() =>
      parserPolitiqueReproductionAutonome({
        version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        active: true,
        etatsSurvieEligibles: [],
        nombreMaxNaissancesParCycle: 1,
      }),
    ).toThrow(/etatsSurvieEligibles/);
  });

  it("rejette un état de survie invalide", () => {
    expect(() =>
      parserPolitiqueReproductionAutonome({
        version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        active: true,
        etatsSurvieEligibles: ["sain", "zombie"],
        nombreMaxNaissancesParCycle: 1,
      }),
    ).toThrow(/état de survie invalide/);
  });

  it("rejette cycleMaximum (appartient aux critères d'arrêt)", () => {
    expect(() =>
      parserPolitiqueReproductionAutonome({
        version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        active: true,
        etatsSurvieEligibles: ["sain"],
        nombreMaxNaissancesParCycle: 1,
        cycleMaximum: 10,
      } as never),
    ).toThrow(/criteresArret/);
  });

  it("crée une politique inactive par défaut", () => {
    const inactive = creerPolitiqueReproductionAutonomeInactive();
    expect(inactive.active).toBe(false);
    expect(inactive.etatsSurvieEligibles).toEqual(["sain", "contraint"]);
    expect(
      Object.prototype.hasOwnProperty.call(inactive, "cycleMaximum"),
    ).toBe(false);
  });
});

describe("priorité neutre reproduction autonome", () => {
  it("est indépendante de l'ordre d'entrée", () => {
    const contexte = {
      versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      graineExperience: 42,
      numeroCycle: 7,
    };
    const a = ["agent-c", "agent-a", "agent-b"];
    const b = ["agent-b", "agent-c", "agent-a"];
    expect(ordonnerCandidatsParPrioriteNeutre(a, contexte)).toEqual(
      ordonnerCandidatsParPrioriteNeutre(b, contexte),
    );
  });

  it("ne dépend ni de la fitness ni de la VEN (uniquement id + cycle + graine)", () => {
    const base = {
      versionPolitique: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      graineExperience: 99,
      numeroCycle: 3,
      identifiantAgent: "parent-1",
    };
    const p1 = calculerPrioriteReproductionNeutre(base);
    const p2 = calculerPrioriteReproductionNeutre(base);
    expect(p1).toBe(p2);

    // Même agent / cycle / graine → même priorité, indépendamment de tout contexte économique.
    const ordreRiche = ordonnerCandidatsParPrioriteNeutre(
      ["pauvre", "riche"],
      {
        versionPolitique: base.versionPolitique,
        graineExperience: base.graineExperience,
        numeroCycle: base.numeroCycle,
      },
    );
    const ordrePauvre = ordonnerCandidatsParPrioriteNeutre(
      ["riche", "pauvre"],
      {
        versionPolitique: base.versionPolitique,
        graineExperience: base.graineExperience,
        numeroCycle: base.numeroCycle,
      },
    );
    expect(ordreRiche).toEqual(ordrePauvre);
  });
});

describe("éligibilité reproduction autonome", () => {
  it("réutilise les garde-fous économiques d'evaluerAutorisationReproduction", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "p1",
      capitalLiquide: 50_000n,
      etatSurvie: "sain",
    });
    const resultat = evaluerEligibiliteReproductionAutonome({
      politique: politiqueActive(),
      parametresReproduction: parametresReproductionActifs({
        dotationEnfantMicroUsdc: 1_000_000n,
        coutReproductionMicroUsdc: 100_000n,
      }),
      etatParent: etat,
      populationTotale: 1,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 5,
      cycleNaissanceAgent: 0,
    });
    expect(resultat).toEqual({
      eligible: false,
      motif: "capital_insuffisant",
    });
  });

  it("refuse l'état critique par défaut", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "p1",
      capitalLiquide: 10_000_000n,
      etatSurvie: "critique",
    });
    const resultat = evaluerEligibiliteReproductionAutonome({
      politique: politiqueActive(),
      parametresReproduction: parametresReproductionActifs(),
      etatParent: etat,
      populationTotale: 1,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 5,
      cycleNaissanceAgent: 0,
    });
    expect(resultat).toEqual({
      eligible: false,
      motif: "etat_survie_non_eligible",
    });
  });

  it("refuse un nouveau-né du même cycle", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "enfant-1",
      capitalLiquide: 10_000_000n,
      etatSurvie: "sain",
    });
    const resultat = evaluerEligibiliteReproductionAutonome({
      politique: politiqueActive(),
      parametresReproduction: parametresReproductionActifs(),
      etatParent: etat,
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 4,
      cycleNaissanceAgent: 4,
    });
    expect(resultat).toEqual({
      eligible: false,
      motif: "naissance_meme_cycle",
    });
  });

  it("accepte un parent sain solvable", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "p1",
      capitalLiquide: 10_000_000n,
      etatSurvie: "sain",
    });
    const resultat = evaluerEligibiliteReproductionAutonome({
      politique: politiqueActive(),
      parametresReproduction: parametresReproductionActifs(),
      etatParent: etat,
      populationTotale: 1,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 5,
      cycleNaissanceAgent: 0,
    });
    expect(resultat).toEqual({ eligible: true });
  });
});

describe("planification reproduction autonome — arbitrage capacité", () => {
  it("retient selon places et place le surplus en refusCapacite", () => {
    const parametres = parametresReproductionActifs({
      populationMaximale: 100,
      nombreMaxReproductionsParCycle: 100,
    });
    const politique = politiqueActive({ nombreMaxNaissancesParCycle: 2 });
    const candidats = ["z", "a", "m", "b"].map((id) => ({
      identifiantAgent: id,
      etatParent: creerEtatEconomiqueInitial({
        identifiantAgent: id,
        capitalLiquide: 10_000_000n,
        etatSurvie: "sain" as const,
      }),
      nombreEnfantsParent: 0,
      cycleDerniereNaissanceParent: null,
      cycleNaissanceAgent: 0,
    }));

    const plan = planifierReproductionsAutonomes({
      politique,
      parametresReproduction: parametres,
      graineExperience: 7,
      numeroCycle: 3,
      populationAuSnapshot: 4,
      reproductionsDejaAuSnapshot: 0,
      candidats,
    });

    expect(plan.placesDisponibles).toBe(2);
    expect(plan.identifiantsEligiblesOrdonnes).toHaveLength(4);
    expect(plan.identifiantsRetenus).toHaveLength(2);
    expect(plan.identifiantsRefusCapacite).toHaveLength(2);
    expect(plan.identifiantsRetenus).toEqual(
      plan.identifiantsEligiblesOrdonnes.slice(0, 2),
    );
    expect(plan.identifiantsRefusCapacite).toEqual(
      plan.identifiantsEligiblesOrdonnes.slice(2),
    );

    // Ordre stable indépendant de l'entrée.
    const planInverse = planifierReproductionsAutonomes({
      politique,
      parametresReproduction: parametres,
      graineExperience: 7,
      numeroCycle: 3,
      populationAuSnapshot: 4,
      reproductionsDejaAuSnapshot: 0,
      candidats: [...candidats].reverse(),
    });
    expect(planInverse.identifiantsEligiblesOrdonnes).toEqual(
      plan.identifiantsEligiblesOrdonnes,
    );
  });

  it("exclut les nouveaux-nés du même cycle avant l'arbitrage", () => {
    const parametres = parametresReproductionActifs({
      populationMaximale: 100,
      nombreMaxReproductionsParCycle: 100,
    });
    const politique = politiqueActive({ nombreMaxNaissancesParCycle: 5 });
    const plan = planifierReproductionsAutonomes({
      politique,
      parametresReproduction: parametres,
      graineExperience: 1,
      numeroCycle: 8,
      populationAuSnapshot: 2,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "ancien",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "ancien",
            capitalLiquide: 10_000_000n,
            etatSurvie: "sain",
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
        {
          identifiantAgent: "nouveau",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "nouveau",
            capitalLiquide: 10_000_000n,
            etatSurvie: "sain",
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 8,
        },
      ],
    });
    expect(plan.identifiantsEligiblesOrdonnes).toEqual(["ancien"]);
    expect(plan.identifiantsRetenus).toEqual(["ancien"]);
    expect(plan.identifiantsRefusCapacite).toEqual([]);
  });
});
