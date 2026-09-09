import { describe, expect, it } from "vitest";
import {
  MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  VERSION_PARAMETRES_REPRODUCTION,
  VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
  bornerCapaciteTheoriqueVersNombreV03,
  calculerPrioriteReproductionNeutre,
  creerEtatEconomiqueInitial,
  estMotifArretTentativesRestantesV03,
  parserPolitiqueReproductionAutonome,
  planifierReproductionsEconomiquesV03,
  serialiserPolitiqueReproductionAutonome,
  type ParametresReproductionExperience,
  type PolitiqueReproductionAutonome,
} from "../src/index.js";

function parametres(
  surcharges: Partial<ParametresReproductionExperience> = {},
): ParametresReproductionExperience {
  return {
    version: VERSION_PARAMETRES_REPRODUCTION,
    active: true,
    dotationEnfantMicroUsdc: 800_000n,
    coutReproductionMicroUsdc: 200_000n,
    reserveMinimaleParentMicroUsdc: 400_000n,
    populationMaximale: 50,
    nombreMaxReproductionsParCycle: 20,
    nombreMaxEnfantsParAgent: 10,
    cooldownCycles: 1,
    ...surcharges,
  };
}

function politique(
  surcharges: Partial<PolitiqueReproductionAutonome> = {},
): PolitiqueReproductionAutonome {
  return {
    version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
    active: true,
    etatsSurvieEligibles: ["sain", "contraint"],
    nombreMaxNaissancesParCycle: 20,
    mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    ...surcharges,
  };
}

describe("mécanisme reproduction autonome", () => {
  it("défaut historique si mecanisme absent", () => {
    const p = parserPolitiqueReproductionAutonome({
      version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      active: true,
      etatsSurvieEligibles: ["sain"],
      nombreMaxNaissancesParCycle: 1,
    });
    expect(p.mecanisme).toBe(MECANISME_REPRODUCTION_AUTONOME_DEFAUT);
  });

  it("opt-in v03 explicite", () => {
    const p = parserPolitiqueReproductionAutonome({
      version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      active: true,
      etatsSurvieEligibles: ["sain"],
      nombreMaxNaissancesParCycle: 1,
      mecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    });
    expect(p.mecanisme).toBe(MECANISME_REPRODUCTION_ECONOMIQUE_V03);
  });

  it("fail closed sur mecanisme inconnu", () => {
    expect(() =>
      parserPolitiqueReproductionAutonome({
        version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
        active: true,
        etatsSurvieEligibles: ["sain"],
        nombreMaxNaissancesParCycle: 1,
        mecanisme: "fitness-ranking",
      }),
    ).toThrow(/mecanisme/);
  });

  it("sérialisation défaut omet mecanisme (empreinte historique)", () => {
    const p = parserPolitiqueReproductionAutonome({
      version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
      active: true,
      etatsSurvieEligibles: ["sain"],
      nombreMaxNaissancesParCycle: 1,
    });
    const json = serialiserPolitiqueReproductionAutonome(p);
    expect("mecanisme" in json).toBe(false);
    expect(parserPolitiqueReproductionAutonome(json).mecanisme).toBe(
      MECANISME_REPRODUCTION_AUTONOME_DEFAUT,
    );
  });
});

describe("bornerCapaciteTheoriqueVersNombreV03", () => {
  it("borne avant conversion number", () => {
    const grand = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
    expect(bornerCapaciteTheoriqueVersNombreV03(grand, 3)).toBe(3);
    expect(
      bornerCapaciteTheoriqueVersNombreV03(2n, Number.MAX_SAFE_INTEGER),
    ).toBe(2);
  });
});

describe("planifierReproductionsEconomiquesV03", () => {
  it("round-robin A1,B1,A2,B2 selon ordre neutre", () => {
    const p = parametres({ cooldownCycles: 0 });
    const pol = politique({ nombreMaxNaissancesParCycle: 10 });
    const a = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-a",
      capitalLiquide: 3_400_000n,
    });
    const b = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-b",
      capitalLiquide: 3_400_000n,
    });
    const plan = planifierReproductionsEconomiquesV03({
      politique: pol,
      parametresReproduction: p,
      identifiantExperience: "exp-rr",
      graineExperience: 42,
      numeroCycle: 3,
      populationAuSnapshot: 2,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "agent-a",
          etatParent: a,
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
        {
          identifiantAgent: "agent-b",
          etatParent: b,
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });

    const prioA = calculerPrioriteReproductionNeutre({
      versionPolitique: pol.version,
      graineExperience: 42,
      numeroCycle: 3,
      identifiantAgent: "agent-a",
    });
    const prioB = calculerPrioriteReproductionNeutre({
      versionPolitique: pol.version,
      graineExperience: 42,
      numeroCycle: 3,
      identifiantAgent: "agent-b",
    });
    const premier = prioA <= prioB ? "agent-a" : "agent-b";
    const second = premier === "agent-a" ? "agent-b" : "agent-a";

    expect(plan.identifiantsParentsOrdonnes).toEqual([premier, second]);
    expect(plan.tentatives.map((t) => t.identifiantParent)).toEqual([
      premier,
      second,
      premier,
      second,
      premier,
      second,
    ]);
    expect(plan.tentatives[0]!.indexTentativeParent).toBe(1);
    expect(plan.tentatives[2]!.indexTentativeParent).toBe(2);
  });

  it("n'ordonne pas selon la VEN / capacité", () => {
    const p = parametres({ cooldownCycles: 0 });
    const pol = politique();
    const pauvre = creerEtatEconomiqueInitial({
      identifiantAgent: "riche-id",
      capitalLiquide: 1_400_000n, // capacité 1
    });
    const riche = creerEtatEconomiqueInitial({
      identifiantAgent: "pauvre-id",
      capitalLiquide: 10_000_000n, // capacité élevée
    });
    // Identifiants choisis pour que l'ordre neutre soit indépendant de la richesse.
    const plan = planifierReproductionsEconomiquesV03({
      politique: pol,
      parametresReproduction: p,
      identifiantExperience: "exp-anti",
      graineExperience: 7,
      numeroCycle: 2,
      populationAuSnapshot: 2,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "riche-id",
          etatParent: pauvre,
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
        {
          identifiantAgent: "pauvre-id",
          etatParent: riche,
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    const prioRicheId = calculerPrioriteReproductionNeutre({
      versionPolitique: pol.version,
      graineExperience: 7,
      numeroCycle: 2,
      identifiantAgent: "riche-id",
    });
    const prioPauvreId = calculerPrioriteReproductionNeutre({
      versionPolitique: pol.version,
      graineExperience: 7,
      numeroCycle: 2,
      identifiantAgent: "pauvre-id",
    });
    const attendu =
      prioRicheId <= prioPauvreId
        ? ["riche-id", "pauvre-id"]
        : ["pauvre-id", "riche-id"];
    expect(plan.identifiantsParentsOrdonnes).toEqual(attendu);
  });

  it("identifiants reproduction déterministes et distincts", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique(),
      parametresReproduction: parametres({ cooldownCycles: 0 }),
      identifiantExperience: "exp-ids",
      graineExperience: 1,
      numeroCycle: 4,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "parent-x",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "parent-x",
            capitalLiquide: 3_400_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    expect(plan.tentatives).toHaveLength(3);
    expect(plan.tentatives[0]!.identifiantReproduction).toBe(
      "repro:exp-ids:parent-x:e001",
    );
    expect(plan.tentatives[1]!.identifiantReproduction).toBe(
      "repro:exp-ids:parent-x:e002",
    );
    expect(plan.tentatives[2]!.identifiantEnfant).toBe("parent-x-e003");
  });
});

describe("motifs arrêt tentatives restantes", () => {
  it("reconnaît les motifs monotones", () => {
    expect(estMotifArretTentativesRestantesV03("capital_insuffisant")).toBe(
      true,
    );
    expect(estMotifArretTentativesRestantesV03("cooldown")).toBe(false);
  });
});
