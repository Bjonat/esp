import { describe, expect, it } from "vitest";
import { creerRegistreEvenementsMemoire } from "../src/index.js";

function entreeBase(
  partial: Partial<{
    identifiant: string;
    identifiantAgent: string;
    type: "AGENT_CREE" | "CYCLE_DEMARRE" | "CAPITAL_INITIAL_ATTRIBUE";
    chargeUtile: Record<string, unknown>;
    identifiantExperience: string;
    numeroCycle: number;
  }> = {},
) {
  return {
    identifiant: partial.identifiant ?? "evt-1",
    versionSchema: 1,
    type: partial.type ?? ("AGENT_CREE" as const),
    identifiantExperience: partial.identifiantExperience ?? "exp-1",
    identifiantAgent: partial.identifiantAgent ?? "agent-a",
    numeroCycle: partial.numeroCycle ?? 0,
    chargeUtile: partial.chargeUtile ?? {},
  };
}

describe("RegistreEvenementsMemoire", () => {
  it("ajoute des événements en conservant l'ordre et attribue la séquence", () => {
    const registre = creerRegistreEvenementsMemoire();

    const e1 = registre.ajouter(
      entreeBase({ identifiant: "evt-1", type: "AGENT_CREE" }),
    );
    const e2 = registre.ajouter(
      entreeBase({
        identifiant: "evt-2",
        identifiantAgent: "agent-b",
        type: "CYCLE_DEMARRE",
      }),
    );
    const e3 = registre.ajouter(
      entreeBase({
        identifiant: "evt-3",
        type: "CAPITAL_INITIAL_ATTRIBUE",
        chargeUtile: { montantMicroUsdc: "1000" },
      }),
    );

    expect([e1.sequence, e2.sequence, e3.sequence]).toEqual([1, 2, 3]);
    expect(registre.lister().map((e) => e.identifiant)).toEqual([
      "evt-1",
      "evt-2",
      "evt-3",
    ]);
    expect(registre.taille()).toBe(3);
  });

  it("retrouve les événements d'un agent dans l'ordre", () => {
    const registre = creerRegistreEvenementsMemoire();

    registre.ajouter(
      entreeBase({ identifiant: "evt-1", type: "AGENT_CREE" }),
    );
    registre.ajouter(
      entreeBase({
        identifiant: "evt-2",
        identifiantAgent: "agent-b",
        type: "AGENT_CREE",
      }),
    );
    registre.ajouter(
      entreeBase({
        identifiant: "evt-3",
        type: "CYCLE_DEMARRE",
      }),
    );

    expect(registre.listerParAgent("agent-a").map((e) => e.identifiant)).toEqual([
      "evt-1",
      "evt-3",
    ]);
  });

  it("filtre par expérience et par cycle avec séquences indépendantes", () => {
    const registre = creerRegistreEvenementsMemoire();
    registre.ajouter({
      ...entreeBase({ identifiant: "e1" }),
      identifiantExperience: "exp-a",
      numeroCycle: 1,
      type: "CYCLE_DEMARRE",
    });
    registre.ajouter({
      ...entreeBase({ identifiant: "e2" }),
      identifiantExperience: "exp-a",
      numeroCycle: 2,
      type: "CYCLE_DEMARRE",
    });
    registre.ajouter({
      ...entreeBase({ identifiant: "e3" }),
      identifiantExperience: "exp-b",
      numeroCycle: 1,
      type: "CYCLE_DEMARRE",
    });

    expect(registre.listerParExperience("exp-a").map((e) => e.sequence)).toEqual([
      1, 2,
    ]);
    expect(registre.listerParExperience("exp-b").map((e) => e.sequence)).toEqual([
      1,
    ]);
    expect(registre.listerParCycle("exp-a", 1).map((e) => e.identifiant)).toEqual([
      "e1",
    ]);
  });

  it("garantit qu'un événement historique ne peut pas être modifié", () => {
    const registre = creerRegistreEvenementsMemoire();
    const chargeUtile = { score: 1 };

    const evenement = registre.ajouter(
      entreeBase({
        identifiant: "evt-1",
        type: "CYCLE_DEMARRE",
        chargeUtile,
      }),
    );

    chargeUtile.score = 99;
    expect(() => {
      (evenement as { type: string }).type = "AGENT_MORT";
    }).toThrow();
    expect(registre.lister()[0]?.chargeUtile).toEqual({ score: 1 });
  });

  it("refuse un identifiant d'événement en double", () => {
    const registre = creerRegistreEvenementsMemoire();
    registre.ajouter(entreeBase({ identifiant: "evt-1" }));
    expect(() =>
      registre.ajouter(
        entreeBase({
          identifiant: "evt-1",
          type: "CYCLE_DEMARRE",
        }),
      ),
    ).toThrow(/déjà présent/);
  });

  it("isole la liste retournée des mutations externes", () => {
    const registre = creerRegistreEvenementsMemoire();
    registre.ajouter(entreeBase({ identifiant: "evt-1" }));
    const liste = registre.lister() as { identifiant: string }[];
    liste.pop();
    expect(registre.taille()).toBe(1);
  });
});
