import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  creerRegistreEvenementsMemoire,
  creerRegistreEvenementsSqlite,
} from "../src/index.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) {
      rmSync(r, { recursive: true, force: true });
    }
  }
});

describe("Registre — lot atomique ajouterPlusieurs", () => {
  it("mémoire : tout ou rien si doublon dans le lot", () => {
    const registre = creerRegistreEvenementsMemoire();
    registre.ajouter({
      identifiant: "deja",
      versionSchema: 1,
      type: "CYCLE_DEMARRE",
      identifiantExperience: "exp",
      identifiantAgent: "a",
      numeroCycle: 1,
      chargeUtile: {},
    });
    expect(() =>
      registre.ajouterPlusieurs([
        {
          identifiant: "nouveau",
          versionSchema: 1,
          type: "REVENU_ACTIVITE",
          identifiantExperience: "exp",
          identifiantAgent: "a",
          numeroCycle: 1,
          chargeUtile: {},
        },
        {
          identifiant: "deja",
          versionSchema: 1,
          type: "CYCLE_TERMINE",
          identifiantExperience: "exp",
          identifiantAgent: "a",
          numeroCycle: 1,
          chargeUtile: {},
        },
      ]),
    ).toThrow(/déjà présent/);
    expect(registre.lister()).toHaveLength(1);
  });

  it("SQLite : COMMIT atomique puis lisible après réouverture", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-tx-"));
    repertoires.push(repertoire);
    const fichier = join(repertoire, "reg.sqlite");
    const registre = creerRegistreEvenementsSqlite(fichier);
    const lot = registre.ajouterPlusieurs([
      {
        identifiant: "e1",
        versionSchema: 1,
        type: "CYCLE_DEMARRE",
        identifiantExperience: "exp",
        identifiantAgent: "a",
        numeroCycle: 1,
        chargeUtile: { identifiantExecutionEconomique: "ecoexec:exp:a:c1" },
      },
      {
        identifiant: "e2",
        versionSchema: 1,
        type: "CYCLE_TERMINE",
        identifiantExperience: "exp",
        identifiantAgent: "a",
        numeroCycle: 1,
        chargeUtile: { identifiantExecutionEconomique: "ecoexec:exp:a:c1" },
      },
    ]);
    expect(lot.map((e) => e.sequence)).toEqual([1, 2]);
    registre.fermer();

    const relu = creerRegistreEvenementsSqlite(fichier);
    expect(relu.listerParExperience("exp")).toHaveLength(2);
    relu.fermer();
  });

  it("SQLite : échec mid-lot → ROLLBACK, aucun événement partiel", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-tx-"));
    repertoires.push(repertoire);
    const fichier = join(repertoire, "reg.sqlite");
    const registre = creerRegistreEvenementsSqlite(fichier);
    registre.ajouter({
      identifiant: "existant",
      versionSchema: 1,
      type: "AGENT_CREE",
      identifiantExperience: "exp",
      identifiantAgent: "a",
      numeroCycle: 0,
      chargeUtile: {},
    });

    expect(() =>
      registre.ajouterPlusieurs([
        {
          identifiant: "ok-1",
          versionSchema: 1,
          type: "CYCLE_DEMARRE",
          identifiantExperience: "exp",
          identifiantAgent: "a",
          numeroCycle: 1,
          chargeUtile: {},
        },
        {
          identifiant: "existant",
          versionSchema: 1,
          type: "CYCLE_TERMINE",
          identifiantExperience: "exp",
          identifiantAgent: "a",
          numeroCycle: 1,
          chargeUtile: {},
        },
      ]),
    ).toThrow();

    expect(registre.listerParExperience("exp")).toHaveLength(1);
    expect(registre.consulterProchaineSequence("exp")).toBe(2);
    registre.fermer();
  });
});
