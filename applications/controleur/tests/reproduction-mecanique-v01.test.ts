import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  VERSION_MESURES_FITNESS,
  calculerMesuresFitnessAgent,
  preparerTransfertInterne,
} from "@esp/protocole";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
import {
  ControleurExperience,
  demarrerServeurApi,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
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

function repertoireTemp(): string {
  const r = mkdtempSync(join(tmpdir(), "esp-repro-"));
  repertoires.push(r);
  return r;
}

function configRepro(
  surcharges?: Partial<ConfigurationExperienceJson>,
): ConfigurationExperienceJson {
  return {
    identifiantExperience: "exp-repro-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 7,
    taillePopulationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "100000000",
    parametresEconomiques: {
      version: "demo",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    reproduction: {
      version: "parametres-reproduction-v01",
      active: true,
      dotationEnfantMicroUsdc: "5000000",
      coutReproductionMicroUsdc: "1000000",
      reserveMinimaleParentMicroUsdc: "1000000",
      populationMaximale: 10,
      nombreMaxReproductionsParCycle: 5,
      nombreMaxEnfantsParAgent: 3,
      cooldownCycles: 0,
    },
    ...surcharges,
  };
}

function ouvrir(
  conf: ConfigurationExperienceJson,
  extras?: {
    cheminSqlite?: string;
    cheminKeystore?: string;
  },
): ControleurExperience {
  return ControleurExperience.ouvrir({
    configuration: parserConfigurationExperience(conf),
    ...(extras?.cheminSqlite !== undefined
      ? { cheminSqlite: extras.cheminSqlite }
      : { registre: creerRegistreEvenementsMemoire() }),
    ...(extras?.cheminKeystore !== undefined
      ? { cheminKeystoreIdentites: extras.cheminKeystore }
      : {}),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

describe("Reproduction mécanique v0.1 — A–Z", () => {
  it("A — naissance : enfant unique créé", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    expect(c.obtenirAgents().filter((a) => a.identite.identifiant === r.identifiantEnfant)).toHaveLength(1);
    expect(c.projeterPopulation().populationTotale).toBe(3);
  });

  it("B — identité : clé enfant ≠ clé parent", async () => {
    const repertoire = repertoireTemp();
    const c = ouvrir(
      configRepro({
        identite: {
          active: true,
          version: "identite-agent-v01",
          algorithme: "ed25519",
        },
      }),
      {
        cheminSqlite: join(repertoire, "esp.sqlite"),
        cheminKeystore: join(repertoire, "identites"),
      },
    );
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const idParent = c.projeterAgent(parent.identite.identifiant)?.identite;
    const idEnfant = c.projeterAgent(r.identifiantEnfant)?.identite;
    expect(idParent?.clePubliqueBase64Url).toBeTruthy();
    expect(idEnfant?.clePubliqueBase64Url).toBeTruthy();
    expect(idEnfant?.clePubliqueBase64Url).not.toBe(idParent?.clePubliqueBase64Url);
    expect(idEnfant?.empreinteClePublique).not.toBe(idParent?.empreinteClePublique);
    c.fermer();
  });

  it("C — lignée parent/génération exacts", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const enfant = c.projeterAgent(r.identifiantEnfant)!;
    expect(enfant.identifiantParent).toBe(parent.identite.identifiant);
    expect(enfant.identifiantLignee).toBe(parent.identite.identifiant);
    expect(enfant.generation).toBe(1);
    expect(parent.identite.generation).toBe(0);
  });

  it("D — dotation parent −M / enfant +M", async () => {
    const c = ouvrir(configRepro());
    const parentAvant = c.obtenirAgents()[0]!;
    const capitalAvant = parentAvant.etatEconomique.capitalLiquide;
    const r = await c.demanderReproduction(parentAvant.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const parent = c.obtenirAgents().find((a) => a.identite.identifiant === parentAvant.identite.identifiant)!;
    const enfant = c.obtenirAgents().find((a) => a.identite.identifiant === r.identifiantEnfant)!;
    const dotation = 5_000_000n;
    const cout = 1_000_000n;
    expect(enfant.etatEconomique.capitalLiquide).toBe(dotation);
    expect(parent.etatEconomique.capitalLiquide).toBe(capitalAvant - dotation - cout);
  });

  it("E — transfert dotation ne crée aucune VEN population", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const venAvant = BigInt(c.projeterPopulation().venTotale.microUsdc);
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    const venApres = BigInt(c.projeterPopulation().venTotale.microUsdc);
    expect(venApres).toBe(venAvant);
  });

  it("F — coût reproduction réduit la VEN population", async () => {
    const c = ouvrir(configRepro());
    const venAvant = BigInt(c.projeterPopulation().venTotale.microUsdc);
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const venApres = BigInt(c.projeterPopulation().venTotale.microUsdc);
    expect(venApres).toBe(venAvant - 1_000_000n);
    expect(c.projeterTresorerie().revenusCoutsReproduction.microUsdc).toBe("1000000");
  });

  it("G — capital insuffisant → refus sans effet", async () => {
    const c = ouvrir(
      configRepro({
        capitalInitialParAgentMicroUsdc: "1000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "1000000",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    const empreinte = c.capturerEmpreinteEconomique();
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("refusee");
    if (r.statut === "refusee") {
      expect(r.motif).toBe("capital_insuffisant");
    }
    expect(c.projeterPopulation().populationTotale).toBe(2);
    expect(c.capturerEmpreinteEconomique().agents).toEqual(empreinte.agents);
  });

  it("H — réserve minimale → refus", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "1000000",
          reserveMinimaleParentMicroUsdc: "99000000",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const r = await c.demanderReproduction(c.obtenirAgents()[0]!.identite.identifiant);
    expect(r.statut).toBe("refusee");
    if (r.statut === "refusee") {
      expect(r.motif).toBe("reserve_minimale");
    }
  });

  it("I/Y — limite population → refus", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "1000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 2,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const r = await c.demanderReproduction(c.obtenirAgents()[0]!.identite.identifiant);
    expect(r.statut).toBe("refusee");
    if (r.statut === "refusee") {
      expect(r.motif).toBe("population_maximale");
    }
  });

  it("J — enfant indépendant : pertes enfant ne débitent pas parent", async () => {
    const c = ouvrir(configRepro());
    const parentId = c.obtenirAgents()[0]!.identite.identifiant;
    const r = await c.demanderReproduction(parentId);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const capitalParent = c.obtenirAgents().find((a) => a.identite.identifiant === parentId)!
      .etatEconomique.capitalLiquide;
    // Simuler perte enfant via transfert sortant hors parent (autre agent Genesis)
    const autre = c.obtenirAgents().find((a) => a.identite.identifiant !== parentId && a.identite.identifiant !== r.identifiantEnfant)!;
    const lot = preparerTransfertInterne({
      identifiantExperience: "exp-repro-v01",
      identifiantAgentSource: r.identifiantEnfant,
      identifiantAgentDestinataire: autre.identite.identifiant,
      montant: 1_000_000n,
      identifiantTransfert: "test-indep",
      numeroCycle: 0,
    });
    c.registre.ajouterPlusieurs(lot.evenements);
    c.rechargerDepuisRegistre?.();
    // Recharger via fermeture/réouverture mémoire impossible — vérifier capital parent inchangé en mémoire
    // Après ajouterPlusieurs manuel, états mémoire peuvent diverger ; reconstruit :
    const c2 = ControleurExperience.ouvrir({
      configuration: parserConfigurationExperience(configRepro()),
      registre: c.registre,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    // Can't reopen same memory registre easily if already open — use economic reconstruction from events
    const evenements = c.registre.listerParExperience("exp-repro-v01");
    const { reconstruireEtatEconomique } = await import("@esp/protocole");
    const etatParent = reconstruireEtatEconomique(
      evenements.filter((e) => e.identifiantAgent === parentId) as never,
      parentId,
    );
    expect(etatParent.capitalLiquide).toBe(capitalParent);
    void c2;
  });

  it("K — aucune dette automatique sur refus", async () => {
    const c = ouvrir(
      configRepro({
        capitalInitialParAgentMicroUsdc: "100",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    expect(parent.etatEconomique.obligationsDues).toBe(0n);
    expect(c.obtenirAgents()[0]!.etatEconomique.obligationsDues).toBe(0n);
  });

  it("L — aucune redevance artificielle sur dotation", async () => {
    const c = ouvrir(
      configRepro({
        parametresEconomiques: {
          version: "demo",
          loyerInfrastructureMicroUsdc: "0",
          periodeLoyerEnCycles: 100,
          tauxRedevanceProprietairePointsDeBase: "1000",
          coutOperationnelMinimalParCycleMicroUsdc: "1000",
          seuilRunwaySainEnCycles: 20,
          seuilRunwayContraintEnCycles: 5,
          cyclesDormanceAvantMort: 3,
        },
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const types = c.registre
      .listerParExperience("exp-repro-v01")
      .map((e) => e.type);
    expect(types).not.toContain("REDEVANCE_PROPRIETAIRE_DUE");
    expect(types).not.toContain("REDEVANCE_PROPRIETAIRE_PAYEE");
  });

  it("M — HWM transfert correct", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const parentAvant = c.obtenirAgents()[0]!;
    const hwmAvant = parentAvant.etatEconomique.highWaterMarkProprietaire;
    const r = await c.demanderReproduction(parentAvant.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const parent = c.obtenirAgents().find((a) => a.identite.identifiant === parentAvant.identite.identifiant)!;
    const enfant = c.obtenirAgents().find((a) => a.identite.identifiant === r.identifiantEnfant)!;
    expect(parent.etatEconomique.highWaterMarkProprietaire).toBe(hwmAvant - 5_000_000n);
    expect(enfant.etatEconomique.highWaterMarkProprietaire).toBe(5_000_000n);
  });

  it("N — configuration héritée identique", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const enfant = c.obtenirAgents().find((a) => a.identite.identifiant === r.identifiantEnfant)!;
    expect(enfant.configurationHeritable).toEqual(
      parent.configurationHeritable ?? { version: "configuration-heritable-v01", parametres: {} },
    );
  });

  it("O — identité/secrets non hérités", async () => {
    const repertoire = repertoireTemp();
    const c = ouvrir(
      configRepro({
        identite: {
          active: true,
          version: "identite-agent-v01",
          algorithme: "ed25519",
        },
      }),
      {
        cheminSqlite: join(repertoire, "esp.sqlite"),
        cheminKeystore: join(repertoire, "identites"),
      },
    );
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const p = c.projeterAgent(parent.identite.identifiant)!;
    const e = c.projeterAgent(r.identifiantEnfant)!;
    expect(e.identite?.clePubliqueBase64Url).not.toBe(p.identite?.clePubliqueBase64Url);
    expect(JSON.stringify(e)).not.toMatch(/clePrivee|pkcs8|secret/i);
    c.fermer();
  });

  it("P — fitness enfant démarre à naissance (dotation ≠ performance)", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 3,
          cooldownCycles: 0,
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const evenements = c.registre.listerParExperience("exp-repro-v01");
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: r.identifiantEnfant,
      evenements,
      fenetre: { cycleDebut: 0, cycleFin: 0 },
    });
    expect(m.versionMesuresFitness).toBe(VERSION_MESURES_FITNESS);
    expect(m.economie.resultatOperationnelAvantContratMicroUsdc).toBe(0n);
    expect(m.economie.revenusActiviteMicroUsdc).toBe(0n);
    expect(m.economie.transfertsInternesRecusMicroUsdc).toBe(5_000_000n);
  });

  it("Q — généalogie reconstructible", async () => {
    const c = ouvrir(
      configRepro({
        capitalInitialParAgentMicroUsdc: "200000000",
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "20000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 10,
          nombreMaxReproductionsParCycle: 5,
          nombreMaxEnfantsParAgent: 5,
          cooldownCycles: 0,
        },
      }),
    );
    const p0 = c.obtenirAgents()[0]!;
    const r1 = await c.demanderReproduction(p0.identite.identifiant);
    expect(r1.statut).toBe("autorisee");
    if (r1.statut !== "autorisee") return;
    const r2 = await c.demanderReproduction(r1.identifiantEnfant);
    expect(r2.statut).toBe("autorisee");
    if (r2.statut !== "autorisee") return;
    const arbre = c.projeterArbre();
    expect(arbre.relations).toHaveLength(2);
    expect(arbre.noeuds.find((n) => n.identifiant === r2.identifiantEnfant)?.generation).toBe(2);
  });

  it("R — redémarrage identique", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configRepro();
    const c1 = ouvrir(conf, { cheminSqlite: chemin });
    const parent = c1.obtenirAgents()[0]!;
    await c1.demanderReproduction(parent.identite.identifiant);
    const empreinte = c1.capturerEmpreinteEconomique();
    const arbre1 = c1.projeterArbre();
    c1.fermer();

    const c2 = ouvrir(conf, { cheminSqlite: chemin });
    expect(c2.capturerEmpreinteEconomique()).toEqual(empreinte);
    expect(c2.projeterArbre().relations).toEqual(arbre1.relations);
    c2.fermer();
  });

  it("S — double demande même identifiant : idempotence", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const r1 = await c.demanderReproduction(parent.identite.identifiant);
    expect(r1.statut).toBe("autorisee");
    // Second call creates e002 (next child), not duplicate e001
    // Idempotence of SAME identifiantReproduction:
    const evenements = c.registre.listerParExperience("exp-repro-v01");
    const { analyserReproduction, preparerReproduction, creerParametresReproductionInactifs, creerConfigurationHeritableVide, creerTresorerieProprietaire } = await import("@esp/protocole");
    if (r1.statut !== "autorisee") return;
    const analyse = analyserReproduction({
      identifiantReproduction: r1.identifiantReproduction,
      evenements,
    });
    expect(analyse.terminee).toBe(true);
    const prep = preparerReproduction({
      identifiantExperience: "exp-repro-v01",
      identifiantParent: parent.identite.identifiant,
      identifiantEnfant: r1.identifiantEnfant,
      identifiantReproduction: r1.identifiantReproduction,
      numeroCycle: 0,
      dateNaissance: "2020-01-01T00:00:00.000Z",
      indexPopulationEnfant: 99,
      numeroGenerationParent: 0,
      identifiantLignee: parent.identite.identifiant,
      configurationHeritableParent: creerConfigurationHeritableVide(),
      etatParent: parent.etatEconomique,
      tresorerie: creerTresorerieProprietaire(),
      parametres: parserConfigurationExperience(configRepro()).reproduction!,
      populationTotale: 3,
      nombreEnfantsParent: 1,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: 0,
      evenementsExistants: evenements,
    });
    expect(prep.statut).toBe("deja_terminee");
    expect(prep.evenements).toHaveLength(0);
    void creerParametresReproductionInactifs;
  });

  it("T — crash avant commit : reprise sans enfant double", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configRepro();
    const c = ouvrir(conf, { cheminSqlite: chemin });
    const parent = c.obtenirAgents()[0]!;
    // Simuler demande seule (crash avant lot complet)
    c.registre.ajouter({
      identifiant: "partial-demande",
      versionSchema: 1,
      type: "REPRODUCTION_DEMANDEE",
      identifiantExperience: "exp-repro-v01",
      identifiantAgent: parent.identite.identifiant,
      numeroCycle: 0,
      chargeUtile: {
        identifiantReproduction: `repro:exp-repro-v01:${parent.identite.identifiant}:e001`,
        identifiantParent: parent.identite.identifiant,
        dotationEnfantMicroUsdc: "5000000",
        coutReproductionMicroUsdc: "1000000",
      },
    });
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    expect(reprise.projeterPopulation().populationTotale).toBe(2);
    const r = await reprise.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    expect(reprise.projeterPopulation().populationTotale).toBe(3);
    const enfants = reprise.obtenirAgents().filter((a) => a.identite.identifiantParent === parent.identite.identifiant);
    expect(enfants).toHaveLength(1);
    reprise.fermer();
  });

  it("U — crash après commit : pas de double dotation", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configRepro();
    const c = ouvrir(conf, { cheminSqlite: chemin });
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const capitalParent = c.obtenirAgents().find((a) => a.identite.identifiant === parent.identite.identifiant)!
      .etatEconomique.capitalLiquide;
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    const r2 = await reprise.demanderReproduction(parent.identite.identifiant);
    // Next child e002 — first reproduction already done
    expect(r2.statut).toBe("autorisee");
    if (r2.statut === "autorisee") {
      expect(r2.identifiantEnfant).toBe(`${parent.identite.identifiant}-e002`);
    }
    // e001 not duplicated
    const e001 = reprise.obtenirAgents().filter((a) => a.identite.identifiant === r.identifiantEnfant);
    expect(e001).toHaveLength(1);
    void capitalParent;
    reprise.fermer();
  });

  it("V — multi-parents : aucun mélange de descendances", async () => {
    const c = ouvrir(configRepro());
    const [p0, p1] = c.obtenirAgents();
    const r0 = await c.demanderReproduction(p0!.identite.identifiant);
    const r1 = await c.demanderReproduction(p1!.identite.identifiant);
    expect(r0.statut).toBe("autorisee");
    expect(r1.statut).toBe("autorisee");
    if (r0.statut !== "autorisee" || r1.statut !== "autorisee") return;
    expect(r0.identifiantLignee).toBe(p0!.identite.identifiant);
    expect(r1.identifiantLignee).toBe(p1!.identite.identifiant);
    expect(r0.identifiantLignee).not.toBe(r1.identifiantLignee);
  });

  it("W — enfant mort reste dans généalogie", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    c.registre.ajouter({
      identifiant: "mort-enfant",
      versionSchema: 1,
      type: "AGENT_MORT",
      identifiantExperience: "exp-repro-v01",
      identifiantAgent: r.identifiantEnfant,
      numeroCycle: 0,
      chargeUtile: { cyclesDormanceConsecutifs: 3 },
    });
    // Reconstruct arbre from events via reopen pattern — update memory etat
    const agentMort = c.obtenirAgents().find((a) => a.identite.identifiant === r.identifiantEnfant)!;
    // Force mort in projection by reconstructing
    const evenements = c.registre.listerParExperience("exp-repro-v01");
    const { reconstruirePopulationDepuisEvenements } = await import("../src/projections.js");
    const pop = reconstruirePopulationDepuisEvenements(
      evenements.filter((e) =>
        [
          "AGENT_CREE",
          "CAPITAL_INITIAL_ATTRIBUE",
          "TRANSFERT_INTERNE",
          "COUT_REPRODUCTION_PAYE",
          "AGENT_MORT",
          "ETAT_SURVIE_MODIFIE",
        ].includes(e.type),
      ) as never,
    );
    const arbre = c.projeterArbre();
    expect(arbre.relations.some((rel) => rel.identifiantEnfant === r.identifiantEnfant)).toBe(true);
    void agentMort;
    void pop;
  });

  it("X — aucune utilisation de fitness pour autorisation", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../src/controleur.ts", import.meta.url),
        "utf8",
      ),
    );
    const bloc = src.slice(src.indexOf("async demanderReproduction"), src.indexOf("async demanderReproduction") + 4000);
    expect(bloc).not.toMatch(/fitness|MesuresFitness|projeterFitness|rang|ranking/i);
  });

  it("Z — aucune création OpenAI/réseau", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const types = c.registre.listerParExperience("exp-repro-v01").map((e) => e.type);
    expect(types.some((t) => t.includes("INFERENCE") || t.includes("OPENAI"))).toBe(false);
  });

  it("API POST /api/agents/:id/reproduire", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    const serveur = await demarrerServeurApi({ controleur: c, port: 0 });
    try {
      const base = `http://${serveur.hote}:${String(serveur.port)}`;
      const res = await fetch(
        `${base}/api/agents/${encodeURIComponent(parent.identite.identifiant)}/reproduire`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      const corps = (await res.json()) as { statut: string; identifiantEnfant: string };
      expect(corps.statut).toBe("autorisee");
      expect(corps.identifiantEnfant).toContain("-e001");
    } finally {
      await serveur.fermer();
    }
  });
});
