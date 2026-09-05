import { describe, expect, it } from "vitest";
import { creerRegistreEvenementsMemoire } from "../src/index.js";

describe("RegistreEvenementsMemoire", () => {
  it("ajoute des événements en conservant l'ordre d'insertion", () => {
    const registre = creerRegistreEvenementsMemoire();

    registre.ajouter({
      identifiant: "evt-1",
      identifiantAgent: "agent-a",
      type: "naissance",
      horodatage: "2026-09-05T00:00:00.000Z",
    });
    registre.ajouter({
      identifiant: "evt-2",
      identifiantAgent: "agent-b",
      type: "decision",
      horodatage: "2026-09-05T00:01:00.000Z",
      chargeUtile: { action: "observer" },
    });
    registre.ajouter({
      identifiant: "evt-3",
      identifiantAgent: "agent-a",
      type: "deces",
      horodatage: "2026-09-05T00:02:00.000Z",
    });

    const evenements = registre.lister();
    expect(evenements.map((e) => e.identifiant)).toEqual([
      "evt-1",
      "evt-2",
      "evt-3",
    ]);
    expect(registre.taille()).toBe(3);
  });

  it("retrouve les événements d'un agent dans l'ordre", () => {
    const registre = creerRegistreEvenementsMemoire();

    registre.ajouter({
      identifiant: "evt-1",
      identifiantAgent: "agent-a",
      type: "naissance",
      horodatage: "2026-09-05T00:00:00.000Z",
    });
    registre.ajouter({
      identifiant: "evt-2",
      identifiantAgent: "agent-b",
      type: "naissance",
      horodatage: "2026-09-05T00:01:00.000Z",
    });
    registre.ajouter({
      identifiant: "evt-3",
      identifiantAgent: "agent-a",
      type: "decision",
      horodatage: "2026-09-05T00:02:00.000Z",
    });

    const evenementsAgentA = registre.listerParAgent("agent-a");
    expect(evenementsAgentA.map((e) => e.identifiant)).toEqual([
      "evt-1",
      "evt-3",
    ]);
    expect(registre.listerParAgent("agent-inconnu")).toEqual([]);
  });

  it("garantit qu'un événement historique ne peut pas être modifié", () => {
    const registre = creerRegistreEvenementsMemoire();
    const chargeUtile = { score: 1 };

    const evenement = registre.ajouter({
      identifiant: "evt-1",
      identifiantAgent: "agent-a",
      type: "observation",
      horodatage: "2026-09-05T00:00:00.000Z",
      chargeUtile,
    });

    chargeUtile.score = 99;

    expect(() => {
      (evenement as { type: string }).type = "modifie";
    }).toThrow();

    expect(() => {
      (evenement.chargeUtile as { score: number }).score = 42;
    }).toThrow();

    const lu = registre.lister()[0];
    expect(lu?.type).toBe("observation");
    expect(lu?.chargeUtile).toEqual({ score: 1 });
  });

  it("refuse un identifiant d'événement en double", () => {
    const registre = creerRegistreEvenementsMemoire();

    registre.ajouter({
      identifiant: "evt-1",
      identifiantAgent: "agent-a",
      type: "naissance",
      horodatage: "2026-09-05T00:00:00.000Z",
    });

    expect(() =>
      registre.ajouter({
        identifiant: "evt-1",
        identifiantAgent: "agent-a",
        type: "decision",
        horodatage: "2026-09-05T00:01:00.000Z",
      }),
    ).toThrow(/déjà présent/);
  });

  it("isole la liste retournée des mutations externes", () => {
    const registre = creerRegistreEvenementsMemoire();

    registre.ajouter({
      identifiant: "evt-1",
      identifiantAgent: "agent-a",
      type: "naissance",
      horodatage: "2026-09-05T00:00:00.000Z",
    });

    const liste = registre.lister() as EvenementMutable[];
    liste.pop();

    expect(registre.taille()).toBe(1);
    expect(registre.lister()).toHaveLength(1);
  });
});

type EvenementMutable = {
  identifiant: string;
}[];
