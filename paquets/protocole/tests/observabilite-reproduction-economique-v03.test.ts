import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03,
  EVENEMENTS_INCLUS_RESULTAT_HORS_REPRODUCTION_V03,
  VERSION_PARAMETRES_REPRODUCTION,
  VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
  MECANISME_REPRODUCTION_ECONOMIQUE_V03,
  assertAucuneCleAntiFitnessV03,
  calculerResultatEconomiqueHorsReproductionV03,
  creerEtatEconomiqueInitial,
  empreinteTrajectoireCausaleSansObservabiliteV03,
  planifierReproductionsEconomiquesV03,
  projeterObservabiliteReproductionEconomiqueV03,
  retirerChampsObservabiliteV03,
  type ParametresReproductionExperience,
  type PolitiqueReproductionAutonome,
} from "../src/index.js";

const racineProtocole = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    cooldownCycles: 0,
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

describe("observabilité planification v03-C", () => {
  it("A — capacité brute > 0 mais fenêtre fermée par max enfants", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique(),
      parametresReproduction: parametres({ nombreMaxEnfantsParAgent: 1 }),
      identifiantExperience: "exp-obs-a",
      graineExperience: 1,
      numeroCycle: 2,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "parent-plein",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "parent-plein",
            capitalLiquide: 5_000_000n,
          }),
          nombreEnfantsParent: 1,
          cycleDerniereNaissanceParent: 0,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    expect(plan.tentatives).toHaveLength(0);
    const obs = plan.observabiliteParents![0]!;
    expect(obs.fenetre).toEqual({
      ouverte: false,
      motif: "nombre_enfants_max",
    });
    expect(BigInt(obs.capaciteTheorique)).toBeGreaterThan(0n);
    expect(BigInt(obs.capaciteBorneeParEnfants)).toBe(0n);
    expect(obs.nombreTentativesPlanifiees).toBe(0);
  });

  it("B — capacité brute > tentatives planifiées (plafond global)", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique({ nombreMaxNaissancesParCycle: 1 }),
      parametresReproduction: parametres(),
      identifiantExperience: "exp-obs-b",
      graineExperience: 1,
      numeroCycle: 2,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "parent-riche",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "parent-riche",
            capitalLiquide: 10_000_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    const obs = plan.observabiliteParents![0]!;
    expect(BigInt(obs.capaciteTheorique)).toBeGreaterThan(
      BigInt(plan.tentatives.length),
    );
    expect(plan.tentatives).toHaveLength(1);
    expect(obs.nombreTentativesPlanifiees).toBe(1);
  });

  it("U — aucune clé anti-fitness dans le plan", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique(),
      parametresReproduction: parametres(),
      identifiantExperience: "exp-anti",
      graineExperience: 3,
      numeroCycle: 1,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "p",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "p",
            capitalLiquide: 3_400_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    expect(() => assertAucuneCleAntiFitnessV03(plan)).not.toThrow();
  });

  it("planificateur n'importe pas la projection d'observabilité", () => {
    const source = readFileSync(
      join(racineProtocole, "src/planifier-reproduction-economique-v03.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/observabilite-reproduction-economique-v03/);
    expect(source).not.toMatch(/projeterObservabiliteReproductionEconomiqueV03/);
    expect(source).not.toMatch(/fitnessScore|percentile|meilleurAgent/);
  });
});

describe("resultatEconomiqueHorsReproductionV03", () => {
  it("M/N/O — inclut compute/revenus/pertes ; exclut dotation et coût repro", () => {
    const evenements = [
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "1000" },
      },
      {
        type: "PERTE_ACTIVITE",
        identifiant: "p1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "100" },
      },
      {
        type: "DEPENSE_COMPUTE",
        identifiant: "c1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 3,
        chargeUtile: { montantMicroUsdc: "50" },
      },
      {
        type: "TRANSFERT_INTERNE",
        identifiant: "t1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 4,
        chargeUtile: {
          montantMicroUsdc: "800000",
          sens: "sortie",
          motif: "dotation_naissance",
        },
      },
      {
        type: "COUT_REPRODUCTION_PAYE",
        identifiant: "cr1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 5,
        chargeUtile: { montantMicroUsdc: "200000" },
      },
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r2",
        identifiantAgent: "a",
        numeroCycle: 2,
        sequence: 6,
        chargeUtile: { montantMicroUsdc: "500" },
      },
    ];
    const total = calculerResultatEconomiqueHorsReproductionV03({
      identifiantAgent: "a",
      evenements,
      fenetre: { cycleDebut: 1, cycleFin: 1 },
    });
    // 1000 - 100 - 50 = 850 ; transferts et coût repro exclus
    expect(total).toBe(850n);
  });

  it("P — plage de cycles inclusive exacte", () => {
    const evenements = [
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r0",
        identifiantAgent: "a",
        numeroCycle: 0,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "10" },
      },
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r1",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "100" },
      },
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r2",
        identifiantAgent: "a",
        numeroCycle: 2,
        sequence: 3,
        chargeUtile: { montantMicroUsdc: "1000" },
      },
      {
        type: "REVENU_ACTIVITE",
        identifiant: "r3",
        identifiantAgent: "a",
        numeroCycle: 3,
        sequence: 4,
        chargeUtile: { montantMicroUsdc: "10000" },
      },
    ];
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements,
        fenetre: { cycleDebut: 1, cycleFin: 2 },
      }),
    ).toBe(1100n);
  });

  it("whitelist documentée non vide", () => {
    expect(EVENEMENTS_INCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "REVENU_ACTIVITE",
    );
    expect(EVENEMENTS_INCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "LOYER_INFRASTRUCTURE_DU",
    );
    expect(EVENEMENTS_INCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "REDEVANCE_PROPRIETAIRE_DUE",
    );
    expect(EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "TRANSFERT_INTERNE",
    );
    expect(EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "COUT_REPRODUCTION_PAYE",
    );
    expect(EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "LOYER_INFRASTRUCTURE_PAYE",
    );
    expect(EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03).toContain(
      "DETTE_REGLEE",
    );
  });

  it("A — loyer dû et payé immédiatement = −loyer (pas −2×)", () => {
    const evenements = [
      {
        type: "LOYER_INFRASTRUCTURE_DU",
        identifiant: "du",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "5000" },
      },
      {
        type: "LOYER_INFRASTRUCTURE_PAYE",
        identifiant: "paye",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "5000" },
      },
    ];
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements,
        fenetre: { cycleDebut: 1, cycleFin: 1 },
      }),
    ).toBe(-5000n);
  });

  it("B — loyer dû converti en dette = −loyer au cycle du DU", () => {
    const evenements = [
      {
        type: "LOYER_INFRASTRUCTURE_DU",
        identifiant: "du",
        identifiantAgent: "a",
        numeroCycle: 2,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "7000" },
      },
      {
        type: "DETTE_CREEE",
        identifiant: "dette",
        identifiantAgent: "a",
        numeroCycle: 2,
        sequence: 2,
        chargeUtile: {
          motif: "loyer_infrastructure",
          montantMicroUsdc: "7000",
        },
      },
    ];
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements,
        fenetre: { cycleDebut: 2, cycleFin: 2 },
      }),
    ).toBe(-7000n);
  });

  it("C — règlement ultérieur de dette de loyer n'ajoute aucune perte", () => {
    const evenements = [
      {
        type: "LOYER_INFRASTRUCTURE_DU",
        identifiant: "du",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "7000" },
      },
      {
        type: "DETTE_CREEE",
        identifiant: "dette",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: {
          motif: "loyer_infrastructure",
          montantMicroUsdc: "7000",
        },
      },
      {
        type: "DETTE_REGLEE",
        identifiant: "reglee",
        identifiantAgent: "a",
        numeroCycle: 3,
        sequence: 3,
        chargeUtile: {
          motif: "loyer_infrastructure",
          montantMicroUsdc: "7000",
        },
      },
    ];
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements,
        fenetre: { cycleDebut: 1, cycleFin: 3 },
      }),
    ).toBe(-7000n);
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements,
        fenetre: { cycleDebut: 3, cycleFin: 3 },
      }),
    ).toBe(0n);
  });

  it("D — même logique pour la redevance propriétaire", () => {
    const payeImmediat = [
      {
        type: "REDEVANCE_PROPRIETAIRE_DUE",
        identifiant: "due",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "1200" },
      },
      {
        type: "REDEVANCE_PROPRIETAIRE_PAYEE",
        identifiant: "payee",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "1200" },
      },
    ];
    const viaDette = [
      {
        type: "REDEVANCE_PROPRIETAIRE_DUE",
        identifiant: "due",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "1200" },
      },
      {
        type: "DETTE_CREEE",
        identifiant: "dette",
        identifiantAgent: "a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: {
          motif: "redevance_proprietaire",
          montantMicroUsdc: "1200",
        },
      },
      {
        type: "DETTE_REGLEE",
        identifiant: "reglee",
        identifiantAgent: "a",
        numeroCycle: 4,
        sequence: 3,
        chargeUtile: {
          motif: "redevance_proprietaire",
          montantMicroUsdc: "1200",
        },
      },
    ];
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements: payeImmediat,
        fenetre: { cycleDebut: 1, cycleFin: 1 },
      }),
    ).toBe(-1200n);
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements: viaDette,
        fenetre: { cycleDebut: 1, cycleFin: 4 },
      }),
    ).toBe(-1200n);
  });

  it("E — fenêtre avant règlement : même coût qu'un paiement immédiat", () => {
    const loyer = "9000";
    const immediat = [
      {
        type: "LOYER_INFRASTRUCTURE_DU",
        identifiant: "du",
        identifiantAgent: "a",
        numeroCycle: 5,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: loyer },
      },
      {
        type: "LOYER_INFRASTRUCTURE_PAYE",
        identifiant: "paye",
        identifiantAgent: "a",
        numeroCycle: 5,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: loyer },
      },
    ];
    const dettePlusTard = [
      {
        type: "LOYER_INFRASTRUCTURE_DU",
        identifiant: "du",
        identifiantAgent: "a",
        numeroCycle: 5,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: loyer },
      },
      {
        type: "DETTE_CREEE",
        identifiant: "dette",
        identifiantAgent: "a",
        numeroCycle: 5,
        sequence: 2,
        chargeUtile: {
          motif: "loyer_infrastructure",
          montantMicroUsdc: loyer,
        },
      },
      {
        type: "DETTE_REGLEE",
        identifiant: "reglee",
        identifiantAgent: "a",
        numeroCycle: 9,
        sequence: 3,
        chargeUtile: {
          motif: "loyer_infrastructure",
          montantMicroUsdc: loyer,
        },
      },
    ];
    const fenetreAvantReglement = { cycleDebut: 5, cycleFin: 5 };
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements: immediat,
        fenetre: fenetreAvantReglement,
      }),
    ).toBe(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements: dettePlusTard,
        fenetre: fenetreAvantReglement,
      }),
    );
    expect(
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent: "a",
        evenements: dettePlusTard,
        fenetre: fenetreAvantReglement,
      }),
    ).toBe(-9000n);
  });
});

describe("projection agrégée + strip", () => {
  it("J — agrégat cycle : pression garde-fous + places décomposées", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique({ nombreMaxNaissancesParCycle: 2 }),
      parametresReproduction: parametres(),
      identifiantExperience: "exp-agg",
      graineExperience: 1,
      numeroCycle: 5,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "p",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "p",
            capitalLiquide: 10_000_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    const evenements = [
      {
        type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
        identifiant: "plan-5",
        numeroCycle: 5,
        sequence: 1,
        chargeUtile: {
          ...plan,
          parents: [...plan.parents],
          tentatives: [...plan.tentatives],
          identifiantsParentsOrdonnes: [...plan.identifiantsParentsOrdonnes],
          observabiliteParents: plan.observabiliteParents!.map((o) => ({
            ...o,
            fenetre: { ...o.fenetre },
          })),
        },
      },
      {
        type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE",
        identifiant: "fin-5",
        numeroCycle: 5,
        sequence: 2,
        chargeUtile: {
          versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
          numeroCycle: 5,
          naissancesEffectuees: 1,
          tentativesPlanifiees: 2,
          tentativesExecutees: 2,
          placesPlanifieesNonUtilisees: plan.placesGlobalesPlanifiees - 1,
        },
      },
    ];
    const agg = projeterObservabiliteReproductionEconomiqueV03({
      evenements,
      numeroCycle: 5,
    });
    expect(agg).not.toBeNull();
    expect(agg!.tentativesPlanifiees).toBe(2);
    expect(agg!.naissancesRealisees).toBe(1);
    expect(agg!.placesGlobalesNonUtilisees).toBe(
      agg!.placesGlobalesPlanifiees - agg!.naissancesRealisees,
    );
    expect(agg!.placesNonDemandeesParLePlan).toBe(
      Math.max(0, agg!.placesGlobalesPlanifiees - agg!.tentativesPlanifiees),
    );
    expect(agg!.tentativesPlanifieesNonRealisees).toBe(
      agg!.tentativesPlanifiees - agg!.naissancesRealisees,
    );
    expect(agg!.placesGlobalesNonUtilisees).toBe(
      agg!.placesNonDemandeesParLePlan + agg!.tentativesPlanifieesNonRealisees,
    );
    expect(agg!.capaciteEconomiqueTheoriqueEligible).toBeGreaterThan(2n);
    expect(agg!.capaciteBloqueeParPlafondsGlobaux).toBeGreaterThan(0n);
    expect(agg!.opportunitesBloqueesParGardeFous).toBe(
      agg!.capaciteBloqueeParPlafondParent +
        agg!.capaciteBloqueeParPlafondsGlobaux,
    );
    expect(agg!.capaciteBloqueeParPlafondParent).toBeGreaterThanOrEqual(0n);
    expect(agg!.capaciteBloqueeParPlafondsGlobaux).toBeGreaterThanOrEqual(0n);
    expect(() => assertAucuneCleAntiFitnessV03(agg)).not.toThrow();
  });

  it("troncature partielle max-enfants à fenêtre ouverte", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique({ nombreMaxNaissancesParCycle: 20 }),
      parametresReproduction: parametres({
        nombreMaxEnfantsParAgent: 2,
        nombreMaxReproductionsParCycle: 20,
        populationMaximale: 50,
      }),
      identifiantExperience: "exp-parent-cap",
      graineExperience: 1,
      numeroCycle: 2,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "riche",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "riche",
            capitalLiquide: 10_000_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    const obs = plan.observabiliteParents![0]!;
    expect(obs.fenetre.ouverte).toBe(true);
    expect(BigInt(obs.capaciteTheorique)).toBeGreaterThan(
      BigInt(obs.capaciteBorneeParEnfants),
    );
    const agg = projeterObservabiliteReproductionEconomiqueV03({
      evenements: [
        {
          type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
          identifiant: "p",
          numeroCycle: 2,
          sequence: 1,
          chargeUtile: {
            ...plan,
            parents: [...plan.parents],
            tentatives: [...plan.tentatives],
            identifiantsParentsOrdonnes: [...plan.identifiantsParentsOrdonnes],
            observabiliteParents: plan.observabiliteParents!.map((o) => ({
              ...o,
              fenetre: { ...o.fenetre },
            })),
          },
        },
      ],
      numeroCycle: 2,
    })!;
    expect(agg.capaciteBloqueeParPlafondParent).toBe(
      BigInt(obs.capaciteTheorique) - BigInt(obs.capaciteBorneeParEnfants),
    );
    expect(agg.capaciteDisponibleApresPlafondParent).toBe(
      BigInt(obs.capaciteBorneeParEnfants),
    );
    expect(agg.opportunitesBloqueesParGardeFous).toBe(
      agg.capaciteBloqueeParPlafondParent +
        agg.capaciteBloqueeParPlafondsGlobaux,
    );
  });

  it("strip observabilité laisse parents/tentatives intacts", () => {
    const plan = planifierReproductionsEconomiquesV03({
      politique: politique(),
      parametresReproduction: parametres(),
      identifiantExperience: "exp-strip",
      graineExperience: 1,
      numeroCycle: 1,
      populationAuSnapshot: 1,
      reproductionsDejaAuSnapshot: 0,
      candidats: [
        {
          identifiantAgent: "p",
          etatParent: creerEtatEconomiqueInitial({
            identifiantAgent: "p",
            capitalLiquide: 3_400_000n,
          }),
          nombreEnfantsParent: 0,
          cycleDerniereNaissanceParent: null,
          cycleNaissanceAgent: 0,
        },
      ],
    });
    const charge = {
      versionMecanisme: plan.versionMecanisme,
      numeroCycle: plan.numeroCycle,
      versionPolitique: plan.versionPolitique,
      populationAuSnapshot: plan.populationAuSnapshot,
      reproductionsDejaAuSnapshot: plan.reproductionsDejaAuSnapshot,
      placesGlobalesPlanifiees: plan.placesGlobalesPlanifiees,
      identifiantsParentsOrdonnes: [...plan.identifiantsParentsOrdonnes],
      parents: [...plan.parents],
      tentatives: [...plan.tentatives],
      observabiliteParents: plan.observabiliteParents,
    };
    const strip = retirerChampsObservabiliteV03(charge);
    expect(strip.observabiliteParents).toBeUndefined();
    expect(strip.parents).toEqual(plan.parents);
    expect(strip.tentatives).toEqual(plan.tentatives);
    const empreinte = empreinteTrajectoireCausaleSansObservabiliteV03([
      {
        type: "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE",
        identifiant: "x",
        numeroCycle: 1,
        sequence: 1,
        chargeUtile: charge,
      },
    ]);
    expect(empreinte).not.toContain("observabiliteParents");
  });
});
