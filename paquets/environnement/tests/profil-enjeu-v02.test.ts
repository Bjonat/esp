/**
 * Profils d'enjeu déterministes v0.2 E2 — environnement opportunités simulées.
 */

import { describe, expect, it } from "vitest";
import {
  creerEnvironnementOpportunitesSimulees,
  parserConfigurationEnvironnementOpportunites,
  redimensionnerMontantsPourEnjeu,
  selectionnerProfilEnjeuV02,
} from "../src/index.js";

const ENJEUX = [50_000n, 75_000n, 125_000n, 175_000n, 250_000n] as const;

const CONF_BASE = parserConfigurationEnvironnementOpportunites({
  identifiant: "environnement-opportunites-simulees",
  version: "0.1.0",
  probabiliteSuccesBaseBps: 6000,
  amplitudeProbabiliteBps: 0,
  gainSiSuccesMicroUsdc: "800000",
  perteSiEchecMicroUsdc: "400000",
  fraisActionMicroUsdc: "20000",
  fraisAttendreMicroUsdc: "0",
  enjeuxPossiblesMicroUsdc: ENJEUX.map((e) => e.toString(10)),
});

describe("profil-enjeu-v02", () => {
  it("même seed + agent + cycle → même profil", () => {
    const a = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-x",
      numeroCycle: 3,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    const b = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-x",
      numeroCycle: 3,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    expect(a).toBe(b);
    expect(ENJEUX).toContain(a);
  });

  it("changement de cycle ou agent peut changer le profil", () => {
    const base = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-x",
      numeroCycle: 1,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    const autreCycle = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-x",
      numeroCycle: 2,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    const autreAgent = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-y",
      numeroCycle: 1,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    // Au moins une divergence attendue sur un échantillon de cycles
    const profils = new Set<string>();
    for (let c = 1; c <= 20; c += 1) {
      profils.add(
        selectionnerProfilEnjeuV02({
          graineSimulation: 201,
          identifiantAgent: "agent-x",
          numeroCycle: c,
          enjeuxPossiblesMicroUsdc: ENJEUX,
        }).toString(10),
      );
    }
    expect(profils.size).toBeGreaterThan(1);
    void base;
    void autreCycle;
    void autreAgent;
  });

  it("redimensionnement : max(gain, perte) = enjeu cible exact", () => {
    for (const cible of ENJEUX) {
      const r = redimensionnerMontantsPourEnjeu({
        gainSiSuccesMicroUsdc: 800_000n,
        perteSiEchecMicroUsdc: 400_000n,
        fraisActionMicroUsdc: 20_000n,
        enjeuCibleMicroUsdc: cible,
      });
      const enjeu =
        r.gainSiSuccesMicroUsdc > r.perteSiEchecMicroUsdc
          ? r.gainSiSuccesMicroUsdc
          : r.perteSiEchecMicroUsdc;
      expect(enjeu).toBe(cible);
      expect(r.enjeuEffectifMicroUsdc).toBe(cible);
      // Structure relative : gain reste >= perte (base gain > perte)
      expect(r.gainSiSuccesMicroUsdc).toBeGreaterThanOrEqual(
        r.perteSiEchecMicroUsdc,
      );
    }
  });

  it("observation produite respecte le profil (enjeu effectif)", () => {
    const env = creerEnvironnementOpportunitesSimulees(CONF_BASE, 201);
    const obs = env.produireObservation({
      identifiantAgent: "agent-x",
      numeroCycle: 5,
    });
    const attendu = selectionnerProfilEnjeuV02({
      graineSimulation: 201,
      identifiantAgent: "agent-x",
      numeroCycle: 5,
      enjeuxPossiblesMicroUsdc: ENJEUX,
    });
    const enjeu =
      obs.gainSiSuccesMicroUsdc > obs.perteSiEchecMicroUsdc
        ? obs.gainSiSuccesMicroUsdc
        : obs.perteSiEchecMicroUsdc;
    expect(enjeu).toBe(attendu);
  });

  it("B et C : mêmes observations à identité causale égale (pas de condition dans le hash)", () => {
    // Deux environnements identiques (même graine) — la condition A/B/C/D
    // n'entre pas dans la sélection du profil.
    const envB = creerEnvironnementOpportunitesSimulees(CONF_BASE, 202);
    const envC = creerEnvironnementOpportunitesSimulees(CONF_BASE, 202);
    const agent = "exp-seed-202-agent-0";
    for (let cycle = 1; cycle <= 5; cycle += 1) {
      const obsB = envB.produireObservation({
        identifiantAgent: agent,
        numeroCycle: cycle,
      });
      const obsC = envC.produireObservation({
        identifiantAgent: agent,
        numeroCycle: cycle,
      });
      expect(obsB.gainSiSuccesMicroUsdc).toBe(obsC.gainSiSuccesMicroUsdc);
      expect(obsB.perteSiEchecMicroUsdc).toBe(obsC.perteSiEchecMicroUsdc);
      expect(obsB.fraisActionMicroUsdc).toBe(obsC.fraisActionMicroUsdc);
      expect(obsB.probabiliteSuccesBps).toBe(obsC.probabiliteSuccesBps);
    }
  });

  it("changement de condition seul ne change pas le profil d'enjeu", () => {
    // La fonction de sélection n'accepte pas de paramètre condition —
    // vérifier stabilité sous même seed/agent/cycle.
    const profils = Array.from({ length: 4 }, () =>
      selectionnerProfilEnjeuV02({
        graineSimulation: 203,
        identifiantAgent: "agent-stable",
        numeroCycle: 7,
        enjeuxPossiblesMicroUsdc: ENJEUX,
      }),
    );
    expect(new Set(profils.map((p) => p.toString(10))).size).toBe(1);
  });

  it("sans enjeuxPossibles : montants de base inchangés (compat E1)", () => {
    const confSans = parserConfigurationEnvironnementOpportunites({
      identifiant: "environnement-opportunites-simulees",
      version: "0.1.0",
      probabiliteSuccesBaseBps: 6000,
      amplitudeProbabiliteBps: 0,
      gainSiSuccesMicroUsdc: "800000",
      perteSiEchecMicroUsdc: "400000",
      fraisActionMicroUsdc: "20000",
    });
    const env = creerEnvironnementOpportunitesSimulees(confSans, 201);
    const obs = env.produireObservation({
      identifiantAgent: "a",
      numeroCycle: 1,
    });
    expect(obs.gainSiSuccesMicroUsdc).toBe(800_000n);
    expect(obs.perteSiEchecMicroUsdc).toBe(400_000n);
  });
});
