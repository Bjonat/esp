import { describe, expect, it } from "vitest";
import {
  ETATS_SURVIE,
  ETATS_VIVANTS,
  TransitionEtatSurvieInvalideErreur,
  creerAgent,
  estEtatMort,
  estEtatVivant,
  peutTransitionnerEtatSurvie,
  transitionnerEtatSurvie,
} from "../src/index.js";

describe("états de survie", () => {
  it("expose exactement les cinq états attendus", () => {
    expect([...ETATS_SURVIE]).toEqual([
      "sain",
      "contraint",
      "critique",
      "dormant",
      "mort",
    ]);
  });

  it("considère sain, contraint, critique et dormant comme vivants", () => {
    for (const etat of ETATS_VIVANTS) {
      expect(estEtatVivant(etat)).toBe(true);
      expect(estEtatMort(etat)).toBe(false);
    }
  });

  it("considère mort comme non vivant", () => {
    expect(estEtatVivant("mort")).toBe(false);
    expect(estEtatMort("mort")).toBe(true);
  });
});

describe("transitionnerEtatSurvie", () => {
  it("autorise les transitions entre états vivants", () => {
    expect(transitionnerEtatSurvie("sain", "contraint")).toBe("contraint");
    expect(transitionnerEtatSurvie("contraint", "critique")).toBe("critique");
    expect(transitionnerEtatSurvie("critique", "dormant")).toBe("dormant");
    expect(transitionnerEtatSurvie("dormant", "sain")).toBe("sain");
  });

  it("autorise le passage d'un état vivant à mort", () => {
    for (const etat of ETATS_VIVANTS) {
      expect(peutTransitionnerEtatSurvie(etat, "mort")).toBe(true);
      expect(transitionnerEtatSurvie(etat, "mort")).toBe("mort");
    }
  });

  it("autorise de rester mort", () => {
    expect(peutTransitionnerEtatSurvie("mort", "mort")).toBe(true);
    expect(transitionnerEtatSurvie("mort", "mort")).toBe("mort");
  });

  it("interdit à un agent mort de revenir vers un état vivant", () => {
    for (const etatVivant of ETATS_VIVANTS) {
      expect(peutTransitionnerEtatSurvie("mort", etatVivant)).toBe(false);
      expect(() => transitionnerEtatSurvie("mort", etatVivant)).toThrow(
        TransitionEtatSurvieInvalideErreur,
      );
    }
  });
});

describe("creerAgent", () => {
  it("crée un agent minimal sain par défaut", () => {
    const agent = creerAgent({
      identifiant: "agent-1",
      generation: 0,
      dateNaissance: "2026-09-05T00:00:00.000Z",
    });

    expect(agent).toEqual({
      identifiant: "agent-1",
      generation: 0,
      etatSurvie: "sain",
      dateNaissance: "2026-09-05T00:00:00.000Z",
    });
    expect(agent.identifiantParent).toBeUndefined();
  });

  it("conserve l'identifiant parent lorsqu'il est fourni", () => {
    const agent = creerAgent({
      identifiant: "agent-2",
      generation: 1,
      identifiantParent: "agent-1",
      etatSurvie: "contraint",
      dateNaissance: "2026-09-05T01:00:00.000Z",
    });

    expect(agent.identifiantParent).toBe("agent-1");
    expect(agent.etatSurvie).toBe("contraint");
    expect(agent.generation).toBe(1);
  });
});
