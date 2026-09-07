import { describe, expect, it } from "vitest";
import {
  ProvenanceDepenseComputeErreur,
  assertDemandesXwayNonDejaAttribuees,
  collecterAttributionsXwayHistoriques,
  construireChargeDepenseCompute,
  lireAttributionsXwayDepuisCharge,
  reconstruireEtatEconomique,
  trouverAttributionsPourDemande,
  type EvenementEconomique,
} from "@esp/protocole";

describe("Provenance DEPENSE_COMPUTE", () => {
  it("H — refuse si somme(attributions) ≠ montant", () => {
    expect(() =>
      construireChargeDepenseCompute({
        montantMicroUsdc: 1000n,
        origine: "xway_inference",
        attributionsXway: [
          { identifiantDemande: "dem-a", montantMicroUsdc: 400n },
          { identifiantDemande: "dem-b", montantMicroUsdc: 500n },
        ],
      }),
    ).toThrow(ProvenanceDepenseComputeErreur);
  });

  it("accepte agrégation multi-demandes dont la somme est exacte", () => {
    const charge = construireChargeDepenseCompute({
      montantMicroUsdc: 1000n,
      origine: "xway_inference",
      attributionsXway: [
        { identifiantDemande: "dem-a", montantMicroUsdc: 400n },
        { identifiantDemande: "dem-b", montantMicroUsdc: 600n },
      ],
    });
    expect(charge.origine).toBe("xway_inference");
    expect(charge.attributionsXway).toHaveLength(2);
    expect(lireAttributionsXwayDepuisCharge(charge)).toEqual([
      { identifiantDemande: "dem-a", montantMicroUsdc: "400" },
      { identifiantDemande: "dem-b", montantMicroUsdc: "600" },
    ]);
  });

  it("refuse attributionsXway hors origine xway_inference", () => {
    expect(() =>
      construireChargeDepenseCompute({
        montantMicroUsdc: 100n,
        origine: "simulation_developpement",
        attributionsXway: [
          { identifiantDemande: "dem-x", montantMicroUsdc: 100n },
        ],
      }),
    ).toThrow(ProvenanceDepenseComputeErreur);
  });

  it("G — reconstruction économique inchangée pour legacy sans attribution", () => {
    const evenements: EvenementEconomique[] = [
      {
        identifiant: "CAPITAL-1",
        versionSchema: 1,
        type: "CAPITAL_INITIAL_ATTRIBUE",
        identifiantExperience: "exp",
        identifiantAgent: "agent-a",
        numeroCycle: 0,
        sequence: 1,
        chargeUtile: { montantMicroUsdc: "10000" },
      },
      {
        identifiant: "DEPENSE-legacy",
        versionSchema: 1,
        type: "DEPENSE_COMPUTE",
        identifiantExperience: "exp",
        identifiantAgent: "agent-a",
        numeroCycle: 1,
        sequence: 2,
        chargeUtile: { montantMicroUsdc: "680" },
      },
    ];
    const etat = reconstruireEtatEconomique(evenements, "agent-a");
    expect(etat.capitalLiquide).toBe(10000n - 680n);
    expect(etat.totalDepensesCompute).toBe(680n);
    expect(trouverAttributionsPourDemande(evenements, "dem-inexistante")).toEqual(
      [],
    );
    expect(collecterAttributionsXwayHistoriques(evenements)).toEqual([]);
  });

  it("C — refuse la réattribution d'un identifiantDemande déjà présent", () => {
    const evenements = [
      {
        identifiant: "DEPENSE-1",
        type: "DEPENSE_COMPUTE",
        numeroCycle: 1,
        chargeUtile: construireChargeDepenseCompute({
          montantMicroUsdc: 100n,
          origine: "xway_inference",
          attributionsXway: [
            { identifiantDemande: "dem-unique", montantMicroUsdc: 100n },
          ],
        }),
      },
    ];
    expect(() =>
      assertDemandesXwayNonDejaAttribuees(evenements, [
        { identifiantDemande: "dem-unique" },
      ]),
    ).toThrow(ProvenanceDepenseComputeErreur);
  });

  it("E — simulation_developpement n'attribue aucune demande Xway", () => {
    const charge = construireChargeDepenseCompute({
      montantMicroUsdc: 25000n,
      origine: "simulation_developpement",
    });
    expect(lireAttributionsXwayDepuisCharge(charge)).toEqual([]);
  });
});
