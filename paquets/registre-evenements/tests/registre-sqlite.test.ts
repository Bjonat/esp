import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { creerRegistreEvenementsSqlite } from "../src/index.js";

describe("RegistreEvenementsSqlite", () => {
  const chemins: string[] = [];

  afterEach(() => {
    for (const chemin of chemins.splice(0)) {
      rmSync(chemin, { recursive: true, force: true });
    }
  });

  it("persiste, attribue la séquence, refuse les doublons et préserve l'ordre", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-sqlite-"));
    chemins.push(repertoire);
    const fichier = join(repertoire, "reg.sqlite");

    const registre = creerRegistreEvenementsSqlite(fichier);
    const e1 = registre.ajouter({
      identifiant: "e1",
      type: "AGENT_CREE",
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 0,
      chargeUtile: { x: 1 },
    });
    const e2 = registre.ajouter({
      identifiant: "e2",
      type: "CYCLE_DEMARRE",
      identifiantExperience: "exp",
      identifiantAgent: "a1",
      numeroCycle: 1,
    });

    expect([e1.sequence, e2.sequence]).toEqual([1, 2]);

    expect(() =>
      registre.ajouter({
        identifiant: "e1",
        type: "AGENT_MORT",
        identifiantExperience: "exp",
        identifiantAgent: "a1",
        numeroCycle: 2,
      }),
    ).toThrow(/déjà présent/);

    expect(registre.lister().map((e) => e.identifiant)).toEqual(["e1", "e2"]);
    expect(registre.listerParCycle("exp", 1).map((e) => e.identifiant)).toEqual([
      "e2",
    ]);
    registre.fermer();

    const rouvert = creerRegistreEvenementsSqlite(fichier);
    expect(rouvert.taille()).toBe(2);
    expect(rouvert.consulterProchaineSequence("exp")).toBe(3);
    const e3 = rouvert.ajouter({
      identifiant: "e3",
      type: "CYCLE_TERMINE",
      identifiantExperience: "exp",
      identifiantAgent: "a2",
      numeroCycle: 1,
    });
    expect(e3.sequence).toBe(3);
    expect(rouvert.lister().map((e) => e.sequence)).toEqual([1, 2, 3]);
    rouvert.fermer();
  });
});
