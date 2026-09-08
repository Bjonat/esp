import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculerMesuresFitnessAgent,
  evaluerAutorisationReproduction,
  parserParametresReproduction,
} from "@esp/protocole";
import {
  KeystoreIdentitesLocal,
  genererPaireIdentiteEd25519,
} from "@esp/moteur-agent";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
import {
  ControleurExperience,
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
  const r = mkdtempSync(join(tmpdir(), "esp-repro-hard-"));
  repertoires.push(r);
  return r;
}

function configRepro(
  surcharges?: Partial<ConfigurationExperienceJson>,
): ConfigurationExperienceJson {
  return {
    identifiantExperience: "exp-repro-hard",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 11,
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
      reserveMinimaleParentMicroUsdc: "0",
      populationMaximale: 20,
      nombreMaxReproductionsParCycle: 10,
      nombreMaxEnfantsParAgent: 5,
      cooldownCycles: 0,
    },
    ...surcharges,
  };
}

function ouvrir(
  conf: ConfigurationExperienceJson,
  extras?: { cheminSqlite?: string; cheminKeystore?: string },
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

describe("Hardening reproduction + fitness v0.1 — AA–AL", () => {
  it("AA — coût reproduction séparé dans fitness", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: parent.identite.identifiant,
      evenements: c.registre.listerParExperience("exp-repro-hard"),
    });
    expect(m.economie.coutsReproductionPayesMicroUsdc).toBe(1_000_000n);
    expect(m.economie.resultatActiviteBrutMicroUsdc).toBe(0n);
    expect(m.economie.resultatOperationnelAvantContratMicroUsdc).toBe(0n);
    expect(m.economie.resultatApresContratMicroUsdc).toBe(0n);
    expect(m.economie.resultatEconomiqueApresReproductionMicroUsdc).toBe(
      -1_000_000n,
    );
    expect(m.economie.pertesActiviteMicroUsdc).toBe(0n);
  });

  it("AB — dotation neutralisée, coût reproduction non neutralisé", async () => {
    const c = ouvrir(configRepro());
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: parent.identite.identifiant,
      evenements: c.registre.listerParExperience("exp-repro-hard"),
    });
    expect(m.economie.transfertsInternesEnvoyesMicroUsdc).toBe(5_000_000n);
    expect(m.economie.revenusActiviteMicroUsdc).toBe(0n);
    expect(m.economie.capitalisationExogeneMicroUsdc).toBe(100_000_000n);
    // venDebut=0 (avant capital) → venFin=94M ; neutralisée conserve −cout
    expect(m.economie.variationVenNeutraliseeExogenesMicroUsdc).toBe(
      -1_000_000n,
    );
    expect(m.economie.coutsReproductionPayesMicroUsdc).toBe(1_000_000n);
  });

  it("AC — réconciliation VEN population après naissance", async () => {
    const c = ouvrir(configRepro());
    const venAvant = BigInt(c.projeterPopulation().venTotale.microUsdc);
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const venApres = BigInt(c.projeterPopulation().venTotale.microUsdc);
    expect(venApres).toBe(venAvant - 1_000_000n);
    const enfant = c.obtenirAgents().find(
      (a) => a.identite.identifiant === r.identifiantEnfant,
    )!;
    expect(enfant.etatEconomique.capitalLiquide).toBe(5_000_000n);
    const somme = c
      .obtenirAgents()
      .reduce((s, a) => s + a.etatEconomique.capitalLiquide, 0n);
    expect(somme).toBe(venApres);
  });

  it("AD — fitness enfant démarre au cycle naissance", async () => {
    const c = ouvrir(configRepro());
    await c.avancerUnCycle();
    expect(c.obtenirNumeroCycleCourant()).toBe(1);
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    const enfant = c.projeterAgent(r.identifiantEnfant)!;
    expect(enfant.cycleNaissance).toBe(1);
    const evenementsEnfant = c.registre
      .listerParExperience("exp-repro-hard")
      .filter((e) => e.identifiantAgent === r.identifiantEnfant);
    const creation = evenementsEnfant.find((e) => e.type === "AGENT_CREE");
    expect(creation?.numeroCycle).toBe(1);
    const m = calculerMesuresFitnessAgent({
      identifiantAgent: r.identifiantEnfant,
      evenements: c.registre.listerParExperience("exp-repro-hard"),
      fenetre: { cycleDebut: 0, cycleFin: 1 },
    });
    expect(m.fenetre.cycleDebut).toBe(1);
    expect(m.economie.capitalisationExogeneMicroUsdc).toBe(0n);
    expect(m.economie.transfertsInternesRecusMicroUsdc).toBe(5_000_000n);
    expect(m.economie.revenusActiviteMicroUsdc).toBe(0n);
  });

  it("AE — statistiques demandées/autorisées/refusées/terminées", async () => {
    const c = ouvrir(
      configRepro({
        reproduction: {
          version: "parametres-reproduction-v01",
          active: true,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "0",
          reserveMinimaleParentMicroUsdc: "0",
          populationMaximale: 3,
          nombreMaxReproductionsParCycle: 10,
          nombreMaxEnfantsParAgent: 5,
          cooldownCycles: 0,
        },
      }),
    );
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    // 2e : population max (2 genesis + 1 enfant = 3)
    await c.demanderReproduction(parent.identite.identifiant);
    const fiche = c.projeterAgent(parent.identite.identifiant)!;
    expect(fiche.reproduction?.reproductionsDemandees).toBe(2);
    expect(fiche.reproduction?.reproductionsAutorisees).toBe(1);
    expect(fiche.reproduction?.reproductionsRefusees).toBe(1);
    expect(fiche.reproduction?.reproductionsTerminees).toBe(1);
    expect(fiche.reproduction?.refusParMotif.population_maximale).toBe(1);
    expect(fiche.reproduction?.dotationsCumulees.microUsdc).toBe("5000000");
  });

  it("AF — naissancesCycle exclut Genesis", async () => {
    const c = ouvrir(configRepro());
    expect(c.projeterPopulation().naissancesCycle).toBe(0);
    expect(c.projeterPopulation().naissancesCumulees).toBe(0);
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const pop = c.projeterPopulation();
    expect(pop.naissancesCycle).toBe(1);
    expect(pop.taillePopulationActuelle).toBe(3);
  });

  it("AG — naissancesCumulees exacte", async () => {
    const c = ouvrir(configRepro());
    const p0 = c.obtenirAgents()[0]!;
    const p1 = c.obtenirAgents()[1]!;
    await c.demanderReproduction(p0.identite.identifiant);
    await c.demanderReproduction(p1.identite.identifiant);
    expect(c.projeterPopulation().naissancesCumulees).toBe(2);
  });

  it("AH — lignées vivantes exacte", async () => {
    const c = ouvrir(configRepro());
    // 2 Genesis = 2 lignées vivantes
    expect(c.projeterPopulation().ligneesVivantes).toBe(2);
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    // Enfant même lignée → toujours 2
    expect(c.projeterPopulation().ligneesVivantes).toBe(2);
    expect(c.projeterPopulation().nombreLigneesVivantes).toBe(2);
  });

  it("AI — enfant mort reste dans généalogie après redémarrage SQLite", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configRepro();
    const c = ouvrir(conf, { cheminSqlite: chemin });
    const parent = c.obtenirAgents()[0]!;
    const r = await c.demanderReproduction(parent.identite.identifiant);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    c.registre.ajouter({
      identifiant: `mort-${r.identifiantEnfant}`,
      versionSchema: 1,
      type: "AGENT_MORT",
      identifiantExperience: "exp-repro-hard",
      identifiantAgent: r.identifiantEnfant,
      numeroCycle: 0,
      chargeUtile: { cyclesDormanceConsecutifs: 3 },
    });
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    const arbre = reprise.projeterArbre();
    const noeud = arbre.noeuds.find((n) => n.identifiant === r.identifiantEnfant);
    expect(noeud).toBeDefined();
    expect(noeud?.etatSurvie).toBe("mort");
    expect(noeud?.identifiantParent).toBe(parent.identite.identifiant);
    expect(noeud?.identifiantLignee).toBe(parent.identite.identifiant);
    expect(arbre.relations.some((rel) => rel.identifiantEnfant === r.identifiantEnfant)).toBe(
      true,
    );
    // Lignée : si parent encore vivant, lignée vivante malgré enfant mort
    expect(reprise.projeterPopulation().ligneesVivantes).toBe(2);
    reprise.fermer();
  });

  it("AJ — projections reproductives identiques après restart", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const conf = configRepro();
    const c = ouvrir(conf, { cheminSqlite: chemin });
    const parent = c.obtenirAgents()[0]!;
    await c.demanderReproduction(parent.identite.identifiant);
    const ficheAvant = c.projeterAgent(parent.identite.identifiant)!;
    const popAvant = c.projeterPopulation();
    const arbreAvant = c.projeterArbre();
    const fitParentAvant = c.projeterFitnessAgent(parent.identite.identifiant);
    const enfantId = ficheAvant.identifiantsEnfants[0]!;
    const fitEnfantAvant = c.projeterFitnessAgent(enfantId);
    c.fermer();

    const reprise = ouvrir(conf, { cheminSqlite: chemin });
    const ficheApres = reprise.projeterAgent(parent.identite.identifiant)!;
    expect(ficheApres.reproduction).toEqual(ficheAvant.reproduction);
    expect(reprise.projeterPopulation()).toEqual(popAvant);
    expect(reprise.projeterArbre()).toEqual(arbreAvant);
    expect(reprise.projeterFitnessAgent(parent.identite.identifiant)).toEqual(
      fitParentAvant,
    );
    expect(reprise.projeterFitnessAgent(enfantId)).toEqual(fitEnfantAvant);
    reprise.fermer();
  });

  it("AK — clé orpheline réutilisée pour même enfant logique uniquement", async () => {
    const repertoire = repertoireTemp();
    const chemin = join(repertoire, "esp.sqlite");
    const keystorePath = join(repertoire, "identites");
    const conf = configRepro({
      identite: {
        active: true,
        version: "identite-agent-v01",
        algorithme: "ed25519",
      },
    });
    const parentId = "exp-repro-hard-agent-000";
    const enfantId = `${parentId}-e001`;

    // Pré-écrire clé orpheline pour l'enfant déterministe
    const ks = new KeystoreIdentitesLocal(keystorePath);
    const paire = genererPaireIdentiteEd25519();
    const stockee = ks.enregistrerClePrivee({
      identifiantExperience: "exp-repro-hard",
      identifiantAgent: enfantId,
      clePriveePkcs8Der: paire.clePriveePkcs8Der,
    });

    const c = ouvrir(conf, {
      cheminSqlite: chemin,
      cheminKeystore: keystorePath,
    });
    const r = await c.demanderReproduction(parentId);
    expect(r.statut).toBe("autorisee");
    if (r.statut !== "autorisee") return;
    expect(r.identifiantEnfant).toBe(enfantId);
    const idEnfant = c.projeterAgent(enfantId)?.identite;
    expect(idEnfant?.clePubliqueBase64Url).toBe(stockee.clePubliqueBase64Url);
    // Pas d'écrasement : re-enregistrer échoue
    expect(() =>
      ks.enregistrerClePrivee({
        identifiantExperience: "exp-repro-hard",
        identifiantAgent: enfantId,
        clePriveePkcs8Der: genererPaireIdentiteEd25519().clePriveePkcs8Der,
      }),
    ).toThrow(/pas d'écrasement/);
    c.fermer();
  });

  it("AL — fitness différente n'influence pas autorisation reproduction", () => {
    const parametres = parserParametresReproduction({
      version: "parametres-reproduction-v01",
      active: true,
      dotationEnfantMicroUsdc: "1000000",
      coutReproductionMicroUsdc: "0",
      reserveMinimaleParentMicroUsdc: "0",
      populationMaximale: 10,
      nombreMaxReproductionsParCycle: 5,
      nombreMaxEnfantsParAgent: 3,
      cooldownCycles: 0,
    });
    const etat = {
      identifiantAgent: "a",
      capitalLiquide: 50_000_000n,
      obligationsDues: 0n,
      totalRevenusActivite: 0n,
      totalPertesActivite: 0n,
      totalDepensesCompute: 0n,
      totalDepensesDonnees: 0n,
      totalFraisExecution: 0n,
      totalLoyersPayes: 0n,
      totalRedevancesProprietairePayees: 0n,
      highWaterMarkProprietaire: 50_000_000n,
      etatSurvie: "sain" as const,
      cyclesDormanceConsecutifs: 0,
      dernierNumeroCycle: 1,
    };
    const a = evaluerAutorisationReproduction({
      parametres,
      etatParent: etat,
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 1,
    });
    const etatMauvaisePerf = {
      ...etat,
      totalRevenusActivite: 1n,
      totalPertesActivite: 99_999_999n,
    };
    const b = evaluerAutorisationReproduction({
      parametres,
      etatParent: etatMauvaisePerf,
      populationTotale: 2,
      nombreEnfantsParent: 0,
      reproductionsDejaCeCycle: 0,
      cycleDerniereNaissanceParent: null,
      numeroCycle: 1,
    });
    expect(a).toEqual(b);
    expect(a.autorisee).toBe(true);
  });
});
