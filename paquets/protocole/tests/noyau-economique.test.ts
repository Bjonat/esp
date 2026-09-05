import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentMortInactifErreur,
  appliquerTransfertSurEtat,
  attribuerCapitalInitial,
  calculerRedevanceProprietaire,
  calculerRunwayEnCycles,
  calculerSoldeNetTresorerie,
  calculerValeurEconomiqueNette,
  creerEtatEconomiqueInitial,
  creerTresorerieProprietaire,
  determinerEtatSurvieDepuisRunway,
  executerCycleEconomique,
  ParametresEconomiquesInvalidesErreur,
  parserMicroUsdc,
  preparerTransfertInterne,
  reconstruireEtatEconomique,
  reglerDette,
  serialiserMicroUsdc,
  transitionnerEtatSurvie,
  TransitionEtatSurvieInvalideErreur,
  usdcVersMicroUsdc,
  type EntreeEvenementEconomique,
  type EtatEconomiqueAgent,
  type ParametresEconomiquesExperience,
  type ResultatActiviteCycle,
} from "../src/index.js";
import {
  creerRegistreEvenementsMemoire,
  creerRegistreEvenementsSqlite,
  type RegistreEvenements,
} from "../../registre-evenements/src/index.js";

const activiteNulle: ResultatActiviteCycle = {
  revenuActivite: 0n,
  perteActivite: 0n,
  depenseCompute: 0n,
  depenseDonnees: 0n,
  fraisExecution: 0n,
};

function contratTest(
  partial: Partial<ParametresEconomiquesExperience> = {},
): ParametresEconomiquesExperience {
  return {
    version: "test-v0.1",
    loyerInfrastructureMicroUsdc: 0n,
    periodeLoyerEnCycles: 1,
    tauxRedevanceProprietairePointsDeBase: 0n,
    coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(1),
    seuilRunwaySainEnCycles: 4,
    seuilRunwayContraintEnCycles: 2,
    cyclesDormanceAvantMort: 2,
    ...partial,
  };
}

function enregistrerTous(
  registre: RegistreEvenements,
  evenements: readonly EntreeEvenementEconomique[],
): void {
  for (const evenement of evenements) {
    registre.ajouter(evenement);
  }
}

describe("monnaie micro-USDC", () => {
  it("convertit et sérialise sans flottant", () => {
    expect(usdcVersMicroUsdc(10)).toBe(10_000_000n);
    expect(usdcVersMicroUsdc(0)).toBe(0n);
    expect(serialiserMicroUsdc(100_000n)).toBe("100000");
    expect(parserMicroUsdc("100000")).toBe(100_000n);
  });

  it("refuse une sérialisation non entière", () => {
    expect(() => parserMicroUsdc("1.5")).toThrow(/invalide/);
    expect(() => usdcVersMicroUsdc(1.5)).toThrow(/non entier/);
  });
});

describe("runway et survie", () => {
  it("calcule le runway à partir de la VEN sans double soustraction des obligations", () => {
    const etat = {
      capitalLiquide: usdcVersMicroUsdc(10),
      obligationsDues: usdcVersMicroUsdc(2),
    };
    // VEN = 8 ; runway = 8/2 = 4 — pas (10-2-2)/2
    expect(calculerValeurEconomiqueNette(etat)).toBe(usdcVersMicroUsdc(8));
    expect(
      calculerRunwayEnCycles(etat, usdcVersMicroUsdc(2)),
    ).toBe(4);
    expect(
      determinerEtatSurvieDepuisRunway(4, {
        seuilRunwaySainEnCycles: 4,
        seuilRunwayContraintEnCycles: 2,
      }),
    ).toBe("sain");
  });
});

describe("redevance high-water mark", () => {
  it("ne taxe que le nouveau profit au-dessus du HWM", () => {
    const etat = {
      capitalLiquide: usdcVersMicroUsdc(120),
      obligationsDues: 0n,
      highWaterMarkProprietaire: usdcVersMicroUsdc(100),
    };
    const calcul = calculerRedevanceProprietaire(etat, 1_000n);
    expect(calcul.profitTaxable).toBe(usdcVersMicroUsdc(20));
    expect(calcul.montantRedevance).toBe(usdcVersMicroUsdc(2));
    expect(calcul.highWaterMarkApres).toBe(usdcVersMicroUsdc(120));
  });
});

describe("SCÉNARIO A — agent rentable", () => {
  it("gagne, paie coûts/loyer/redevance et conserve le solde exact", () => {
    const registre = creerRegistreEvenementsMemoire();
    const parametres = contratTest({
      loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(10),
      periodeLoyerEnCycles: 1,
      tauxRedevanceProprietairePointsDeBase: 1_000n,
      coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(1),
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });

    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-rentable",
      montant: usdcVersMicroUsdc(100),
    });
    enregistrerTous(registre, naissance.evenements);

    const resultat = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-rentable",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: usdcVersMicroUsdc(30),
        perteActivite: 0n,
        depenseCompute: usdcVersMicroUsdc(5),
        depenseDonnees: usdcVersMicroUsdc(3),
        fraisExecution: usdcVersMicroUsdc(2),
      },
    });
    enregistrerTous(registre, resultat.evenements);

    expect(resultat.etat.capitalLiquide).toBe(usdcVersMicroUsdc(109));
    expect(resultat.etat.totalLoyersPayes).toBe(usdcVersMicroUsdc(10));
    expect(resultat.etat.totalRedevancesProprietairePayees).toBe(
      usdcVersMicroUsdc(1),
    );
    expect(resultat.etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(110));
    expect(resultat.tresorerie.revenusLoyers).toBe(usdcVersMicroUsdc(10));
    expect(resultat.tresorerie.revenusRedevances).toBe(usdcVersMicroUsdc(1));
    expect(calculerSoldeNetTresorerie(resultat.tresorerie)).toBe(
      usdcVersMicroUsdc(11),
    );

    const reconstruit = reconstruireEtatEconomique(
      registre.lister(),
      "agent-rentable",
    );
    expect(reconstruit).toEqual(resultat.etat);
  });
});

describe("SCÉNARIO B — agent déficitaire", () => {
  it("passe sain → contraint → critique → dormant", () => {
    const parametres = contratTest({
      coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(4),
      seuilRunwaySainEnCycles: 4,
      seuilRunwayContraintEnCycles: 2,
      cyclesDormanceAvantMort: 99,
      periodeLoyerEnCycles: 100,
    });

    let etat = attribuerCapitalInitial({
      identifiantExperience: "exp-b",
      identifiantAgent: "agent-deficit",
      montant: usdcVersMicroUsdc(20),
    }).etat;

    const trajectoire: string[] = [etat.etatSurvie];
    let tresorerie = creerTresorerieProprietaire();

    for (let cycle = 1; cycle <= 5; cycle += 1) {
      const resultat = executerCycleEconomique({
        identifiantExperience: "exp-b",
        identifiantAgent: "agent-deficit",
        numeroCycle: cycle,
        parametres,
        etat,
        tresorerie,
        activite: {
          ...activiteNulle,
          perteActivite: usdcVersMicroUsdc(4),
        },
      });
      etat = resultat.etat;
      tresorerie = resultat.tresorerie;
      trajectoire.push(etat.etatSurvie);
    }

    expect(trajectoire).toEqual([
      "sain",
      "sain",
      "contraint",
      "contraint",
      "critique",
      "dormant",
    ]);
  });
});

describe("SCÉNARIO C — mort irréversible", () => {
  it("meurt après dormance prolongée et refuse tout retour au vivant", () => {
    const parametres = contratTest({
      coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(10),
      seuilRunwaySainEnCycles: 4,
      seuilRunwayContraintEnCycles: 2,
      cyclesDormanceAvantMort: 2,
      periodeLoyerEnCycles: 100,
    });

    let etat = attribuerCapitalInitial({
      identifiantExperience: "exp-c",
      identifiantAgent: "agent-mortel",
      montant: 0n,
    }).etat;

    const tresorerie = creerTresorerieProprietaire();

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      const resultat = executerCycleEconomique({
        identifiantExperience: "exp-c",
        identifiantAgent: "agent-mortel",
        numeroCycle: cycle,
        parametres,
        etat,
        tresorerie,
        activite: activiteNulle,
      });
      etat = resultat.etat;
    }

    expect(etat.etatSurvie).toBe("mort");
    expect(() => transitionnerEtatSurvie("mort", "sain")).toThrow(
      TransitionEtatSurvieInvalideErreur,
    );
    expect(() =>
      executerCycleEconomique({
        identifiantExperience: "exp-c",
        identifiantAgent: "agent-mortel",
        numeroCycle: 3,
        parametres,
        etat,
        tresorerie,
        activite: activiteNulle,
      }),
    ).toThrow(AgentMortInactifErreur);
  });
});

describe("SCÉNARIO D — high-water mark", () => {
  it("ne re-taxe jamais un profit déjà soumis à redevance", () => {
    const parametres = contratTest({
      tauxRedevanceProprietairePointsDeBase: 1_000n,
      periodeLoyerEnCycles: 100,
      loyerInfrastructureMicroUsdc: 0n,
      coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(1),
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });

    let etat = attribuerCapitalInitial({
      identifiantExperience: "exp-d",
      identifiantAgent: "agent-hwm",
      montant: usdcVersMicroUsdc(100),
    }).etat;
    let tresorerie = creerTresorerieProprietaire();

    const run = (revenu: bigint, perte: bigint) => {
      const resultat = executerCycleEconomique({
        identifiantExperience: "exp-d",
        identifiantAgent: "agent-hwm",
        numeroCycle: etat.dernierNumeroCycle + 1,
        parametres,
        etat,
        tresorerie,
        activite: {
          ...activiteNulle,
          revenuActivite: revenu,
          perteActivite: perte,
        },
      });
      etat = resultat.etat;
      tresorerie = resultat.tresorerie;
      return resultat;
    };

    run(usdcVersMicroUsdc(20), 0n);
    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(118));
    expect(etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(120));

    run(0n, usdcVersMicroUsdc(8));
    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(110));
    expect(etat.totalRedevancesProprietairePayees).toBe(usdcVersMicroUsdc(2));

    run(usdcVersMicroUsdc(10), 0n);
    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(120));
    expect(etat.totalRedevancesProprietairePayees).toBe(usdcVersMicroUsdc(2));

    run(usdcVersMicroUsdc(5), 0n);
    expect(etat.totalRedevancesProprietairePayees).toBe(
      usdcVersMicroUsdc(2) + 500_000n,
    );
    expect(etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(125));
    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(125) - 500_000n);
  });
});

describe("SCÉNARIO E — absence de création de valeur", () => {
  it("conserve la valeur totale de la population après transfert interne", () => {
    const naissanceA = attribuerCapitalInitial({
      identifiantExperience: "exp-e",
      identifiantAgent: "agent-a",
      montant: usdcVersMicroUsdc(100),
    });
    const naissanceB = attribuerCapitalInitial({
      identifiantExperience: "exp-e",
      identifiantAgent: "agent-b",
      montant: usdcVersMicroUsdc(50),
    });

    let etatA = naissanceA.etat;
    let etatB = naissanceB.etat;
    const totalAvant =
      calculerValeurEconomiqueNette(etatA) +
      calculerValeurEconomiqueNette(etatB);

    const transfert = preparerTransfertInterne({
      identifiantExperience: "exp-e",
      identifiantAgentSource: "agent-a",
      identifiantAgentDestinataire: "agent-b",
      montant: usdcVersMicroUsdc(10),
      identifiantTransfert: "tr-1",
      numeroCycle: 0,
    });

    etatA = appliquerTransfertSurEtat(etatA, transfert.evenements[0]!);
    etatB = appliquerTransfertSurEtat(etatB, transfert.evenements[1]!);

    expect(etatA.capitalLiquide).toBe(usdcVersMicroUsdc(90));
    expect(etatB.capitalLiquide).toBe(usdcVersMicroUsdc(60));
    expect(etatA.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(90));
    expect(etatB.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(60));
    expect(
      calculerValeurEconomiqueNette(etatA) +
        calculerValeurEconomiqueNette(etatB),
    ).toBe(totalAvant);
  });
});

describe("SCÉNARIO F — persistance SQLite", () => {
  const chemins: string[] = [];

  afterEach(() => {
    for (const chemin of chemins.splice(0)) {
      rmSync(chemin, { recursive: true, force: true });
    }
  });

  it("reconstruit le même état après fermeture et réouverture", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-registre-"));
    chemins.push(repertoire);
    const fichier = join(repertoire, "evenements.sqlite");

    const parametres = contratTest({
      loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(1),
      periodeLoyerEnCycles: 1,
      tauxRedevanceProprietairePointsDeBase: 1_000n,
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });

    let etatAvant: EtatEconomiqueAgent;
    {
      const registre = creerRegistreEvenementsSqlite(fichier);
      const naissance = attribuerCapitalInitial({
        identifiantExperience: "exp-f",
        identifiantAgent: "agent-persist",
        montant: usdcVersMicroUsdc(50),
      });
      enregistrerTous(registre, naissance.evenements);

      const resultat = executerCycleEconomique({
        identifiantExperience: "exp-f",
        identifiantAgent: "agent-persist",
        numeroCycle: 1,
        parametres,
        etat: naissance.etat,
        tresorerie: creerTresorerieProprietaire(),
        activite: {
          revenuActivite: usdcVersMicroUsdc(10),
          perteActivite: 0n,
          depenseCompute: usdcVersMicroUsdc(2),
          depenseDonnees: usdcVersMicroUsdc(1),
          fraisExecution: 0n,
        },
      });
      enregistrerTous(registre, resultat.evenements);
      etatAvant = resultat.etat;
      registre.fermer();
    }

    const registreRouvert = creerRegistreEvenementsSqlite(fichier);
    const reconstruit = reconstruireEtatEconomique(
      registreRouvert.lister(),
      "agent-persist",
    );
    expect(reconstruit).toEqual(etatAvant);
    registreRouvert.fermer();
  });
});

describe("SCÉNARIO G — immutabilité profonde", () => {
  it("empêche une mutation imbriquée de modifier rétroactivement l'événement", () => {
    const registre = creerRegistreEvenementsMemoire();
    const chargeUtile = {
      detail: { montantMicroUsdc: "1000", nested: { flag: true } },
    };

    registre.ajouter({
      identifiant: "evt-nested",
      versionSchema: 1,
      type: "REVENU_ACTIVITE",
      identifiantExperience: "exp-g",
      identifiantAgent: "agent-g",
      numeroCycle: 1,
      chargeUtile,
    });

    chargeUtile.detail.nested.flag = false;
    chargeUtile.detail.montantMicroUsdc = "999999";

    const lu = registre.lister()[0];
    expect(lu?.chargeUtile).toEqual({
      detail: { montantMicroUsdc: "1000", nested: { flag: true } },
    });
  });
});

describe("SCÉNARIO H — attribution unique", () => {
  it("refuse d'enregistrer deux fois la même dépense (même identifiant)", () => {
    const registre = creerRegistreEvenementsMemoire();
    const depense = {
      identifiant: "depense-compute-1",
      versionSchema: 1 as const,
      type: "DEPENSE_COMPUTE" as const,
      identifiantExperience: "exp-h",
      identifiantAgent: "agent-h",
      numeroCycle: 1,
      chargeUtile: { montantMicroUsdc: "1000" },
    };

    registre.ajouter(depense);
    expect(() => registre.ajouter({ ...depense })).toThrow(/déjà présent/);
  });
});

describe("HARDENING 1 — HWM et transferts internes", () => {
  it("augmente le HWM du même montant sur transfert entrant", () => {
    let etat = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-in",
      capitalLiquide: usdcVersMicroUsdc(100),
    });
    const transfert = preparerTransfertInterne({
      identifiantExperience: "exp-hwm",
      identifiantAgentSource: "autre",
      identifiantAgentDestinataire: "agent-in",
      montant: usdcVersMicroUsdc(15),
      identifiantTransfert: "tr-in",
      numeroCycle: 0,
    });
    etat = appliquerTransfertSurEtat(etat, transfert.evenements[1]!);
    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(115));
    expect(etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(115));
  });

  it("diminue le HWM du même montant sur transfert sortant (plancher 0)", () => {
    let etat = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-out",
      capitalLiquide: usdcVersMicroUsdc(118),
    });
    // Simule un HWM déjà à 120 (après redevance antérieure).
    etat = {
      ...etat,
      highWaterMarkProprietaire: usdcVersMicroUsdc(120),
    };

    const transfert = preparerTransfertInterne({
      identifiantExperience: "exp-hwm",
      identifiantAgentSource: "agent-out",
      identifiantAgentDestinataire: "autre",
      montant: usdcVersMicroUsdc(10),
      identifiantTransfert: "tr-out",
      numeroCycle: 0,
    });
    etat = appliquerTransfertSurEtat(etat, transfert.evenements[0]!);

    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(108));
    expect(etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(110));

    // HWM ne devient jamais négatif
    const gros = preparerTransfertInterne({
      identifiantExperience: "exp-hwm",
      identifiantAgentSource: "agent-out",
      identifiantAgentDestinataire: "autre",
      montant: usdcVersMicroUsdc(200),
      identifiantTransfert: "tr-gros",
      numeroCycle: 0,
    });
    const etatVide = appliquerTransfertSurEtat(
      {
        ...etat,
        capitalLiquide: usdcVersMicroUsdc(200),
      },
      gros.evenements[0]!,
    );
    expect(etatVide.highWaterMarkProprietaire).toBe(0n);
  });

  it("A → B : pas de redevance artificielle, puis profit taxable correct", () => {
    const parametres = contratTest({
      tauxRedevanceProprietairePointsDeBase: 1_000n,
      periodeLoyerEnCycles: 100,
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });

    let etatA = {
      ...creerEtatEconomiqueInitial({
        identifiantAgent: "agent-a",
        capitalLiquide: usdcVersMicroUsdc(118),
      }),
      highWaterMarkProprietaire: usdcVersMicroUsdc(120),
    };
    let etatB = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-b",
      capitalLiquide: usdcVersMicroUsdc(50),
    });

    const totalAvant =
      calculerValeurEconomiqueNette(etatA) +
      calculerValeurEconomiqueNette(etatB);

    const transfert = preparerTransfertInterne({
      identifiantExperience: "exp-ab",
      identifiantAgentSource: "agent-a",
      identifiantAgentDestinataire: "agent-b",
      montant: usdcVersMicroUsdc(10),
      identifiantTransfert: "tr-ab",
      numeroCycle: 0,
    });
    etatA = appliquerTransfertSurEtat(etatA, transfert.evenements[0]!);
    etatB = appliquerTransfertSurEtat(etatB, transfert.evenements[1]!);

    expect(etatA.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(110));
    expect(etatB.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(60));
    expect(
      calculerValeurEconomiqueNette(etatA) +
        calculerValeurEconomiqueNette(etatB),
    ).toBe(totalAvant);

    // Aucune redevance artificielle juste après transfert (VEN 108 < HWM 110)
    const sansProfit = executerCycleEconomique({
      identifiantExperience: "exp-ab",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: etatA,
      tresorerie: creerTresorerieProprietaire(),
      activite: activiteNulle,
    });
    expect(sansProfit.etat.totalRedevancesProprietairePayees).toBe(0n);
    etatA = sansProfit.etat;

    // Remonte à 123 avant redevance → profit taxable = 13
    const avecProfit = executerCycleEconomique({
      identifiantExperience: "exp-ab",
      identifiantAgent: "agent-a",
      numeroCycle: 2,
      parametres,
      etat: etatA,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        ...activiteNulle,
        revenuActivite: usdcVersMicroUsdc(15),
      },
    });
    // 108+15=123 ; profit 13 ; redevance 1.3 USDC = 1_300_000
    expect(avecProfit.etat.highWaterMarkProprietaire).toBe(usdcVersMicroUsdc(123));
    expect(avecProfit.etat.totalRedevancesProprietairePayees).toBe(1_300_000n);
    expect(avecProfit.etat.capitalLiquide).toBe(
      usdcVersMicroUsdc(123) - 1_300_000n,
    );
  });
});

describe("HARDENING 2 — dettes sans double comptage", () => {
  it("A — loyer dû et immédiatement payé", () => {
    const parametres = contratTest({
      loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(5),
      periodeLoyerEnCycles: 1,
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-dette",
      identifiantAgent: "agent-payeur",
      montant: usdcVersMicroUsdc(20),
    });
    const resultat = executerCycleEconomique({
      identifiantExperience: "exp-dette",
      identifiantAgent: "agent-payeur",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: activiteNulle,
    });
    expect(resultat.etat.obligationsDues).toBe(0n);
    expect(resultat.etat.totalLoyersPayes).toBe(usdcVersMicroUsdc(5));
    expect(resultat.tresorerie.revenusLoyers).toBe(usdcVersMicroUsdc(5));
    expect(
      resultat.evenements.some((e) => e.type === "LOYER_INFRASTRUCTURE_PAYE"),
    ).toBe(true);
  });

  it("B/E — loyer dû non payé → dette, trésorerie à 0", () => {
    const parametres = contratTest({
      loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(10),
      periodeLoyerEnCycles: 1,
      seuilRunwaySainEnCycles: 2,
      seuilRunwayContraintEnCycles: 1,
    });
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-dette",
      identifiantAgent: "agent-pauvre",
      montant: usdcVersMicroUsdc(3),
    });
    const resultat = executerCycleEconomique({
      identifiantExperience: "exp-dette",
      identifiantAgent: "agent-pauvre",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: activiteNulle,
    });
    expect(resultat.etat.capitalLiquide).toBe(usdcVersMicroUsdc(3));
    expect(resultat.etat.obligationsDues).toBe(usdcVersMicroUsdc(10));
    expect(calculerValeurEconomiqueNette(resultat.etat)).toBe(
      usdcVersMicroUsdc(-7),
    );
    expect(resultat.tresorerie.revenusLoyers).toBe(0n);
    expect(resultat.etat.totalLoyersPayes).toBe(0n);
  });

  it("C/D/E — règlement ultérieur : VEN inchangée, encaissement au paiement", () => {
    let etat = {
      ...creerEtatEconomiqueInitial({
        identifiantAgent: "agent-dette",
        capitalLiquide: usdcVersMicroUsdc(10),
      }),
      obligationsDues: usdcVersMicroUsdc(3),
    };
    let tresorerie = creerTresorerieProprietaire();

    const venAvant = calculerValeurEconomiqueNette(etat);
    expect(venAvant).toBe(usdcVersMicroUsdc(7));
    expect(tresorerie.revenusLoyers).toBe(0n);

    const reglement = reglerDette({
      identifiantExperience: "exp-dette",
      identifiantAgent: "agent-dette",
      numeroCycle: 2,
      montant: usdcVersMicroUsdc(3),
      motif: "loyer_infrastructure",
      etat,
      tresorerie,
    });
    etat = reglement.etat;
    tresorerie = reglement.tresorerie;

    expect(etat.capitalLiquide).toBe(usdcVersMicroUsdc(7));
    expect(etat.obligationsDues).toBe(0n);
    expect(calculerValeurEconomiqueNette(etat)).toBe(venAvant);
    expect(etat.totalPertesActivite).toBe(0n);
    expect(tresorerie.revenusLoyers).toBe(usdcVersMicroUsdc(3));
    expect(etat.totalLoyersPayes).toBe(usdcVersMicroUsdc(3));
  });
});

describe("HARDENING 3 — séquence attribuée par le registre", () => {
  const chemins: string[] = [];

  afterEach(() => {
    for (const chemin of chemins.splice(0)) {
      rmSync(chemin, { recursive: true, force: true });
    }
  });

  it("attribue des séquences monotones sans doublon (mémoire, multi-agents)", () => {
    const registre = creerRegistreEvenementsMemoire();
    const a = attribuerCapitalInitial({
      identifiantExperience: "exp-seq",
      identifiantAgent: "a",
      montant: 1n,
    });
    const b = attribuerCapitalInitial({
      identifiantExperience: "exp-seq",
      identifiantAgent: "b",
      montant: 1n,
    });
    enregistrerTous(registre, a.evenements);
    enregistrerTous(registre, b.evenements);

    const sequences = registre
      .listerParExperience("exp-seq")
      .map((e) => e.sequence);
    expect(sequences).toEqual([1, 2, 3, 4]);
    expect(new Set(sequences).size).toBe(4);
    expect(registre.consulterProchaineSequence("exp-seq")).toBe(5);
    expect(registre.consulterProchaineSequence("autre-exp")).toBe(1);
  });

  it("poursuit la séquence après fermeture/réouverture SQLite", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-seq-"));
    chemins.push(repertoire);
    const fichier = join(repertoire, "seq.sqlite");

    {
      const registre = creerRegistreEvenementsSqlite(fichier);
      registre.ajouter({
        identifiant: "e1",
        type: "AGENT_CREE",
        identifiantExperience: "exp-seq",
        identifiantAgent: "a",
        numeroCycle: 0,
      });
      registre.ajouter({
        identifiant: "e2",
        type: "CAPITAL_INITIAL_ATTRIBUE",
        identifiantExperience: "exp-seq",
        identifiantAgent: "a",
        numeroCycle: 0,
        chargeUtile: { montantMicroUsdc: "1" },
      });
      expect(registre.consulterProchaineSequence("exp-seq")).toBe(3);
      registre.fermer();
    }

    const rouvert = creerRegistreEvenementsSqlite(fichier);
    expect(rouvert.consulterProchaineSequence("exp-seq")).toBe(3);
    const e3 = rouvert.ajouter({
      identifiant: "e3",
      type: "CYCLE_DEMARRE",
      identifiantExperience: "exp-seq",
      identifiantAgent: "a",
      numeroCycle: 1,
    });
    expect(e3.sequence).toBe(3);
    expect(rouvert.lister().map((e) => e.sequence)).toEqual([1, 2, 3]);
    rouvert.fermer();
  });

  it("reconstruit avec le même ordre de séquence", () => {
    const registre = creerRegistreEvenementsMemoire();
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-ord",
      identifiantAgent: "agent-ord",
      montant: usdcVersMicroUsdc(10),
    });
    enregistrerTous(registre, naissance.evenements);
    const cycle = executerCycleEconomique({
      identifiantExperience: "exp-ord",
      identifiantAgent: "agent-ord",
      numeroCycle: 1,
      parametres: contratTest({
        periodeLoyerEnCycles: 100,
        seuilRunwaySainEnCycles: 2,
        seuilRunwayContraintEnCycles: 1,
      }),
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        ...activiteNulle,
        revenuActivite: usdcVersMicroUsdc(2),
      },
    });
    enregistrerTous(registre, cycle.evenements);

    const sequences = registre.listerParAgent("agent-ord").map((e) => e.sequence);
    for (let i = 1; i < sequences.length; i += 1) {
      expect(sequences[i]!).toBeGreaterThan(sequences[i - 1]!);
    }
    expect(reconstruireEtatEconomique(registre.lister(), "agent-ord")).toEqual(
      cycle.etat,
    );
  });
});

describe("HARDENING 4 — validation obligatoire du contrat", () => {
  it("refuse d'exécuter un cycle avec des paramètres invalides", () => {
    const etat = attribuerCapitalInitial({
      identifiantExperience: "exp-val",
      identifiantAgent: "agent-val",
      montant: usdcVersMicroUsdc(10),
    }).etat;

    const invalides: ParametresEconomiquesExperience[] = [
      contratTest({ version: "   " }),
      contratTest({ loyerInfrastructureMicroUsdc: -1n }),
      contratTest({ periodeLoyerEnCycles: 0 }),
      contratTest({ tauxRedevanceProprietairePointsDeBase: 10_001n }),
      contratTest({ coutOperationnelMinimalParCycleMicroUsdc: 0n }),
      contratTest({
        seuilRunwaySainEnCycles: 2,
        seuilRunwayContraintEnCycles: 2,
      }),
      contratTest({ cyclesDormanceAvantMort: 0 }),
    ];

    for (const parametres of invalides) {
      expect(() =>
        executerCycleEconomique({
          identifiantExperience: "exp-val",
          identifiantAgent: "agent-val",
          numeroCycle: 1,
          parametres,
          etat,
          tresorerie: creerTresorerieProprietaire(),
          activite: activiteNulle,
        }),
      ).toThrow(ParametresEconomiquesInvalidesErreur);
    }
  });
});

describe("invariants complémentaires", () => {
  it("ne crée pas de revenu à la naissance (ESP-ECO-009)", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-i",
      identifiantAgent: "agent-i",
      montant: usdcVersMicroUsdc(42),
    });
    expect(naissance.etat.totalRevenusActivite).toBe(0n);
    expect(naissance.evenements.map((e) => e.type)).toEqual([
      "AGENT_CREE",
      "CAPITAL_INITIAL_ATTRIBUE",
    ]);
  });
});
