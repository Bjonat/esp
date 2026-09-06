import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculerValeurEconomiqueNette,
  creerEtatEconomiqueInitial,
} from "@esp/protocole";
import {
  creerPasserelleXway,
  creerConfigurationXwayDemonstration,
  reconstruireEtatsDemandesXway,
  type DemandeInference,
  type FournisseurInference,
} from "@esp/xway";
import {
  ControleurExperience,
  calculerLimiteDepenseCognitive,
  parserConfigurationExperience,
  reconstruireEtatsDemandesDepuisRegistre,
  type ConfigurationExperienceJson,
} from "../src/index.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) rmSync(r, { recursive: true, force: true });
  }
});

const fournisseurControle: FournisseurInference = {
  estimerCout(demande) {
    if (demande.identifiantDemande.endsWith("-A")) {
      return {
        jetonsEntreeEstimes: 100,
        jetonsSortieMax: 100,
        coutMaximumEstimeMicroUsdc: 80_000n,
      };
    }
    if (demande.identifiantDemande.endsWith("-B")) {
      return {
        jetonsEntreeEstimes: 50,
        jetonsSortieMax: 50,
        coutMaximumEstimeMicroUsdc: 50_000n,
      };
    }
    return {
      jetonsEntreeEstimes: 10,
      jetonsSortieMax: 10,
      coutMaximumEstimeMicroUsdc: 10_000n,
    };
  },
  inferer(demande) {
    if (demande.identifiantDemande.endsWith("-A")) {
      return {
        texte: "[SIM] A",
        usage: {
          jetonsEntree: 40,
          jetonsSortie: 40,
          coutMicroUsdc: 30_000n,
        },
      };
    }
    return {
      texte: "[SIM] B",
      usage: {
        jetonsEntree: 20,
        jetonsSortie: 20,
        coutMicroUsdc: 20_000n,
      },
    };
  },
};

function demande(
  id: string,
  limite: bigint,
  surcharges: Partial<DemandeInference> = {},
): DemandeInference {
  return {
    identifiantDemande: id,
    identifiantExperience: "exp-hard",
    identifiantAgent: "agent-res",
    numeroCycle: 1,
    modeleDemande: "modele_standard",
    messages: [{ role: "utilisateur", contenu: "test" }],
    nombreMaxJetonsSortie: 128,
    limiteDepenseAutoriseeMicroUsdc: limite,
    ...surcharges,
  };
}

function configXwayJson(): ConfigurationExperienceJson {
  return {
    identifiantExperience: "exp-xway-hard",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 99,
    taillePopulationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-hard",
      loyerInfrastructureMicroUsdc: "100000",
      periodeLoyerEnCycles: 5,
      tauxRedevanceProprietairePointsDeBase: "1000",
      coutOperationnelMinimalParCycleMicroUsdc: "50000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    xway: {
      active: true,
      plafondComputeParCycleMicroUsdc: "50000",
      modeles: [
        {
          identifiant: "modele_economique",
          libelle: "éco",
          coutParMillionJetonsEntreeMicroUsdc: "500000",
          coutParMillionJetonsSortieMicroUsdc: "1500000",
          nombreMaxJetonsSortie: 256,
        },
        {
          identifiant: "modele_standard",
          libelle: "std",
          coutParMillionJetonsEntreeMicroUsdc: "2000000",
          coutParMillionJetonsSortieMicroUsdc: "6000000",
          nombreMaxJetonsSortie: 512,
        },
        {
          identifiant: "modele_premium",
          libelle: "prem",
          coutParMillionJetonsEntreeMicroUsdc: "20000000",
          coutParMillionJetonsSortieMicroUsdc: "60000000",
          nombreMaxJetonsSortie: 1024,
        },
      ],
      politiqueCognitive: {
        identifiant: "politique-cognitive-developpement",
        version: "0.1.0",
      },
      fournisseur: {
        identifiant: "fournisseur-inference-simule",
        version: "0.1.0",
      },
    },
  };
}

describe("Xway hardening — réservation & reprise", () => {
  it("A — B refusée tant que A n'est pas réglée", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const budget = 100_000n;
    const a = passerelle.autoriser(demande("dem-A", budget));
    expect(a.autorisee).toBe(true);
    const b = passerelle.autoriser(demande("dem-B", budget));
    expect(b.autorisee).toBe(false);
    if (!b.autorisee) {
      expect(b.motif).toBe("capacite_reservee_insuffisante");
    }
  });

  it("B — règlement A libère reservation - coutFinal", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const budget = 100_000n;
    expect(passerelle.autoriser(demande("dem-A", budget)).autorisee).toBe(
      true,
    );
    const exec = passerelle.executer(demande("dem-A", budget));
    expect(exec.statut).toBe("executee");
    if (exec.statut === "executee") {
      expect(exec.coutFinalMicroUsdc).toBe(30_000n);
      expect(exec.reservationLibereeMicroUsdc).toBe(50_000n);
    }
    const b = passerelle.autoriser(demande("dem-B", budget));
    expect(b.autorisee).toBe(true);
  });

  it("C — la réservation seule ne modifie jamais la VEN", () => {
    const etat = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-res",
      capitalLiquide: 5_000_000n,
    });
    const venAvant = calculerValeurEconomiqueNette(etat);
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const limite = calculerLimiteDepenseCognitive({
      etat,
      plafondComputeParCycleMicroUsdc: 100_000n,
    });
    expect(passerelle.autoriser(demande("dem-A", limite)).autorisee).toBe(
      true,
    );
    expect(calculerValeurEconomiqueNette(etat)).toBe(venAvant);
  });

  it("D — DEPENSE_COMPUTE = coûts réellement réglés uniquement", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const budget = 100_000n;
    passerelle.autoriser(demande("dem-A", budget));
    // B refusée : aucun coût
    expect(passerelle.autoriser(demande("dem-B", budget)).autorisee).toBe(
      false,
    );
    const exec = passerelle.executer(demande("dem-A", budget));
    expect(exec.statut).toBe("executee");
    if (exec.statut === "executee") {
      expect(exec.coutFinalMicroUsdc).toBe(30_000n);
    }
    const comptes = passerelle.obtenirCompteReservations();
    expect(
      comptes.totalCoutsRegles({
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      }),
    ).toBe(30_000n);
    expect(
      comptes.totalReservationsActives({
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      }),
    ).toBe(0n);
  });

  it("coutsRegles du cycle N ne réduisent pas le plafond du cycle N+1", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const plafondParCycle = 100_000n;

    // Cycle 1 : A réserve 80k puis règle 30k → coutsRegles cycle 1 = 30k
    expect(
      passerelle.autoriser(demande("c1-A", plafondParCycle, { numeroCycle: 1 }))
        .autorisee,
    ).toBe(true);
    const execC1 = passerelle.executer(
      demande("c1-A", plafondParCycle, { numeroCycle: 1 }),
    );
    expect(execC1.statut).toBe("executee");

    const comptes = passerelle.obtenirCompteReservations();
    expect(
      comptes.totalCoutsRegles({
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      }),
    ).toBe(30_000n);
    // Le cycle suivant part d'un plafond neuf : pas de resoustraction historique.
    expect(
      comptes.totalCoutsRegles({
        identifiantAgent: "agent-res",
        numeroCycle: 2,
      }),
    ).toBe(0n);
    expect(
      comptes.capaciteDisponible(
        { identifiantAgent: "agent-res", numeroCycle: 2 },
        plafondParCycle,
      ),
    ).toBe(plafondParCycle);

    // Cycle 2 : même estimation 80k doit passer (ne serait pas possible si 30k cumulés).
    const autoC2 = passerelle.autoriser(
      demande("c2-A", plafondParCycle, { numeroCycle: 2 }),
    );
    expect(autoC2.autorisee).toBe(true);
  });

  it("idempotence après redémarrage — aucune 2e exécution / 2e coût", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-xway-hard-"));
    repertoires.push(repertoire);
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const conf = parserConfigurationExperience(configXwayJson());

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 10; i += 1) premier.avancerUnCycle();
    const evenements = premier.registre.listerParExperience(
      conf.identifiantExperience,
    );
    const executees = evenements.filter((e) => e.type === "INFERENCE_EXECUTEE");
    expect(executees.length).toBeGreaterThan(0);
    const cible = executees[0]!;
    const idDemande = String(cible.chargeUtile.identifiantDemande);
    const coutFinal = BigInt(String(cible.chargeUtile.coutFinalMicroUsdc));
    const depensesAvant = evenements.filter(
      (e) => e.type === "DEPENSE_COMPUTE",
    ).length;
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const etats = reconstruireEtatsDemandesDepuisRegistre(
      second.registre.listerParExperience(conf.identifiantExperience),
    );
    expect(etats.get(idDemande)?.etat).toBe("executee");

    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      etatsDemandes: etats,
    });
    const replay = passerelle.executer(
      demande(idDemande, 1_000_000n, {
        identifiantAgent: String(cible.identifiantAgent),
        numeroCycle: cible.numeroCycle,
      }),
    );
    expect(replay.statut).toBe("executee");
    if (replay.statut === "executee") {
      expect(replay.dejaConnue).toBe(true);
      expect(replay.coutFinalMicroUsdc).toBe(coutFinal);
    }

    const apres = second.registre.listerParExperience(
      conf.identifiantExperience,
    );
    expect(apres.filter((e) => e.type === "INFERENCE_EXECUTEE").length).toBe(
      executees.length,
    );
    expect(apres.filter((e) => e.type === "DEPENSE_COMPUTE").length).toBe(
      depensesAvant,
    );
    second.fermer();
  });

  it("refus persisté — pas de réévaluation silencieuse", () => {
    const etats = reconstruireEtatsDemandesXway([
      {
        type: "DEMANDE_INFERENCE_RECUE",
        identifiantDemande: "dem-refus",
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      },
      {
        type: "DEMANDE_INFERENCE_REFUSEE",
        identifiantDemande: "dem-refus",
        identifiantAgent: "agent-res",
        numeroCycle: 1,
        motifRefus: "budget_insuffisant",
        detail: "trop cher",
        coutMaximumEstimeMicroUsdc: 80_000n,
      },
    ]);
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
      etatsDemandes: etats,
    });
    const r = passerelle.executer(demande("dem-refus", 100_000n));
    expect(r.statut).toBe("refusee");
    if (r.statut === "refusee") {
      expect(r.motif).toBe("budget_insuffisant");
    }
  });

  it("AUTORISEE reprise sans suite → resultat_indetermine, pas de rappel fournisseur", () => {
    let appelsFournisseur = 0;
    const fournisseurCompte: FournisseurInference = {
      estimerCout: fournisseurControle.estimerCout.bind(fournisseurControle),
      inferer(demande, tarif) {
        appelsFournisseur += 1;
        return fournisseurControle.inferer(demande, tarif);
      },
    };
    const etats = reconstruireEtatsDemandesXway([
      {
        type: "DEMANDE_INFERENCE_AUTORISEE",
        identifiantDemande: "dem-A",
        identifiantAgent: "agent-res",
        numeroCycle: 1,
        coutMaximumEstimeMicroUsdc: 80_000n,
      },
    ]);
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurCompte,
      etatsDemandes: etats,
    });
    const r = passerelle.executer(demande("dem-A", 100_000n));
    expect(r.statut).toBe("resultat_indetermine");
    expect(appelsFournisseur).toBe(0);
    expect(
      passerelle.obtenirCompteReservations().totalReservationsActives({
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      }),
    ).toBe(80_000n);
  });

  it("declarerResultatIndetermine conserve la réservation", () => {
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      fournisseur: fournisseurControle,
    });
    const budget = 100_000n;
    expect(passerelle.autoriser(demande("dem-A", budget)).autorisee).toBe(
      true,
    );
    const r = passerelle.declarerResultatIndetermine(
      demande("dem-A", budget),
      "timeout simulé",
    );
    expect(r.statut).toBe("resultat_indetermine");
    expect(
      passerelle.obtenirCompteReservations().totalReservationsActives({
        identifiantAgent: "agent-res",
        numeroCycle: 1,
      }),
    ).toBe(80_000n);
  });
});
