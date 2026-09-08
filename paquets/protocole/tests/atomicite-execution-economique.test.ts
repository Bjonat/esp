import { describe, expect, it } from "vitest";
import {
  analyserExecutionEconomique,
  attribuerCapitalInitial,
  creerTresorerieProprietaire,
  executerCycleEconomique,
  fabriquerIdentifiantExecutionEconomique,
  reconstruireEtatEconomique,
  usdcVersMicroUsdc,
  type ParametresEconomiquesExperience,
} from "../src/index.js";

const parametres: ParametresEconomiquesExperience = {
  version: "atomicite-test-v01",
  loyerInfrastructureMicroUsdc: usdcVersMicroUsdc(10),
  periodeLoyerEnCycles: 1,
  tauxRedevanceProprietairePointsDeBase: 1000n,
  coutOperationnelMinimalParCycleMicroUsdc: usdcVersMicroUsdc(1),
  seuilRunwaySainEnCycles: 20,
  seuilRunwayContraintEnCycles: 5,
  cyclesDormanceAvantMort: 3,
};

const activite = {
  revenuActivite: usdcVersMicroUsdc(30),
  perteActivite: 0n,
  depenseCompute: usdcVersMicroUsdc(5),
  depenseDonnees: usdcVersMicroUsdc(3),
  fraisExecution: usdcVersMicroUsdc(2),
};

describe("Atomicité — exécution économique", () => {
  it("fabrique un identifiant causal stable", () => {
    expect(
      fabriquerIdentifiantExecutionEconomique({
        identifiantExperience: "exp",
        identifiantAgent: "agent-a",
        numeroCycle: 3,
      }),
    ).toBe("ecoexec:exp:agent-a:c3");
  });

  it("estampille identifiantExecutionEconomique sur chaque événement", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      montant: usdcVersMicroUsdc(100),
    });
    const resultat = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite,
    });
    expect(resultat.evenements.length).toBeGreaterThan(0);
    for (const evenement of resultat.evenements) {
      expect(evenement.chargeUtile.identifiantExecutionEconomique).toBe(
        "ecoexec:exp-a:agent-a:c1",
      );
    }
  });

  it("idempotence : exécution déjà terminée → aucun nouvel événement", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      montant: usdcVersMicroUsdc(100),
    });
    const premier = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite,
    });
    const second = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: premier.etat,
      tresorerie: premier.tresorerie,
      activite,
      evenementsExecutionExistants: premier.evenements,
    });
    expect(second.dejaTerminee).toBe(true);
    expect(second.evenements).toEqual([]);
    expect(second.etat).toEqual(premier.etat);
  });

  it("reprise partielle : complète uniquement le manquant sans doublon", () => {
    const naissance = attribuerCapitalInitial({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      montant: usdcVersMicroUsdc(100),
    });
    const continu = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: naissance.etat,
      tresorerie: creerTresorerieProprietaire(),
      activite,
    });

    const indexRevenu = continu.evenements.findIndex(
      (e) => e.type === "REVENU_ACTIVITE",
    );
    expect(indexRevenu).toBeGreaterThan(0);
    const prefixe = continu.evenements.slice(0, indexRevenu + 1);

    const historique = [...naissance.evenements, ...prefixe];
    const etatPartiel = reconstruireEtatEconomique(historique, "agent-a");
    expect(etatPartiel).toBeDefined();

    const reprise = executerCycleEconomique({
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
      parametres,
      etat: etatPartiel!,
      tresorerie: creerTresorerieProprietaire(),
      activite,
      evenementsExecutionExistants: prefixe,
    });

    const typesNouveaux = reprise.evenements.map((e) => e.type);
    expect(typesNouveaux).not.toContain("CYCLE_DEMARRE");
    expect(typesNouveaux).not.toContain("REVENU_ACTIVITE");
    expect(typesNouveaux).toContain("CYCLE_TERMINE");

    const final = [...historique, ...reprise.evenements];
    const etatFinal = reconstruireEtatEconomique(final, "agent-a");
    expect(etatFinal).toEqual(continu.etat);

    const analyse = analyserExecutionEconomique({
      evenements: final,
      identifiantExperience: "exp-a",
      identifiantAgent: "agent-a",
      numeroCycle: 1,
    });
    expect(analyse.statut).toBe("terminee");
    const comptes = new Map<string, number>();
    for (const e of analyse.evenements) {
      const cle =
        e.type === "DETTE_CREEE"
          ? `DETTE:${String(e.chargeUtile.motif ?? "")}`
          : e.type;
      comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
    }
    for (const [, n] of comptes) {
      expect(n).toBe(1);
    }
  });

  it("compatibilité legacy : événements sans identifiant restent lisibles", () => {
    const analyse = analyserExecutionEconomique({
      evenements: [
        {
          type: "CYCLE_DEMARRE",
          identifiant: "legacy-1",
          identifiantAgent: "agent-legacy",
          numeroCycle: 2,
          chargeUtile: {},
        },
        {
          type: "CYCLE_TERMINE",
          identifiant: "legacy-2",
          identifiantAgent: "agent-legacy",
          numeroCycle: 2,
          chargeUtile: { runway: 1 },
        },
      ],
      identifiantExperience: "exp-legacy",
      identifiantAgent: "agent-legacy",
      numeroCycle: 2,
    });
    expect(analyse.statut).toBe("terminee");
    expect(analyse.evenements).toHaveLength(2);
  });
});
