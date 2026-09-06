import { mkdtempSync, rmSync, unlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALGORITHME_IDENTITE_ESP,
  KeystoreIdentitesLocal,
  SignataireAgentLocal,
  genererPaireIdentiteEd25519,
  verifierSignatureEd25519,
} from "@esp/moteur-agent";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
import {
  DOMAINE_SIGNATURE_XWAY_INFERENCE,
  authentifierDemandeInference,
  construireMessageCanoniqueDemandeInference,
  creerPasserelleXway,
  creerConfigurationXwayDemonstration,
  type DemandeInference,
} from "@esp/xway";
import {
  ControleurExperience,
  demarrerServeurApi,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
} from "../src/index.js";
import { chargeUtileIdentiteContientSecret } from "../src/projections-identite.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) rmSync(r, { recursive: true, force: true });
  }
});

function configBase(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ReturnType<typeof parserConfigurationExperience> {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-identite-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 4242,
    taillePopulationInitiale: 3,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-id",
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
    identite: {
      active: true,
      algorithme: "ed25519",
      version: "0.1.0",
    },
  };
  return parserConfigurationExperience({ ...base, ...surcharges });
}

function demandeTest(
  surcharges: Partial<DemandeInference> = {},
): DemandeInference {
  return {
    identifiantDemande: "dem-id-001",
    identifiantExperience: "exp-identite-v01",
    identifiantAgent: "agent-a",
    numeroCycle: 1,
    modeleDemande: "modele_standard",
    messages: [{ role: "utilisateur", contenu: "contenu test signature" }],
    nombreMaxJetonsSortie: 128,
    limiteDepenseAutoriseeMicroUsdc: 1_000_000n,
    ...surcharges,
  };
}

describe("Identité agent ESP v0.1", () => {
  it("A — N agents → N identités distinctes", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const controleur = ControleurExperience.ouvrir({
      configuration: configBase({ taillePopulationInitiale: 5 }),
      registre: creerRegistreEvenementsMemoire(),
      cheminKeystoreIdentites: join(repertoire, "identites"),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const agents = controleur.obtenirAgents();
    expect(agents).toHaveLength(5);
    const empreintes = new Set(
      agents.map(
        (a) =>
          controleur.projeterIdentiteAgent(a.identite.identifiant)
            .empreinteClePublique,
      ),
    );
    expect(empreintes.size).toBe(5);
    expect([...empreintes].every((e) => e !== null)).toBe(true);
  });

  it("B — signature valide → vérification OK", () => {
    const paire = genererPaireIdentiteEd25519();
    const signataire = SignataireAgentLocal.depuisClePriveeMemoire({
      identifiantAgent: "agent-a",
      clePriveePkcs8Der: paire.clePriveePkcs8Der,
    });
    const demande = demandeTest();
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataire.signer(message);
    expect(
      verifierSignatureEd25519({
        clePubliqueBase64Url: signe.clePubliqueBase64Url,
        message,
        signatureBase64Url: signe.signatureBase64Url,
      }),
    ).toBe(true);
  });

  it("C — message modifié → vérification KO", () => {
    const paire = genererPaireIdentiteEd25519();
    const signataire = SignataireAgentLocal.depuisClePriveeMemoire({
      identifiantAgent: "agent-a",
      clePriveePkcs8Der: paire.clePriveePkcs8Der,
    });
    const demande = demandeTest();
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataire.signer(message);
    const altere = demandeTest({
      modeleDemande: "modele_premium",
    });
    const messageAltere = construireMessageCanoniqueDemandeInference(altere);
    expect(
      verifierSignatureEd25519({
        clePubliqueBase64Url: signe.clePubliqueBase64Url,
        message: messageAltere,
        signatureBase64Url: signe.signatureBase64Url,
      }),
    ).toBe(false);
  });

  it("D — usurpation clé B pour agent A → refus", () => {
    const a = genererPaireIdentiteEd25519();
    const b = genererPaireIdentiteEd25519();
    const signataireB = SignataireAgentLocal.depuisClePriveeMemoire({
      identifiantAgent: "agent-b",
      clePriveePkcs8Der: b.clePriveePkcs8Der,
    });
    const demande = demandeTest({ identifiantAgent: "agent-a" });
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataireB.signer(message);
    const auth = authentifierDemandeInference({
      enveloppe: {
        demande,
        clePubliqueBase64Url: signe.clePubliqueBase64Url,
        signatureBase64Url: signe.signatureBase64Url,
      },
      clePubliqueEnregistreeBase64Url: a.clePubliqueBase64Url,
    });
    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.motif).toBe("cle_publique_usurpation");
    }
  });

  it("E — auth valide → chemin Xway normal", () => {
    const paire = genererPaireIdentiteEd25519();
    const signataire = SignataireAgentLocal.depuisClePriveeMemoire({
      identifiantAgent: "agent-a",
      clePriveePkcs8Der: paire.clePriveePkcs8Der,
    });
    const demande = demandeTest();
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataire.signer(message);
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      authentificationRequise: true,
      clesPubliquesParAgent: new Map([
        ["agent-a", paire.clePubliqueBase64Url],
      ]),
    });
    const resultat = passerelle.executer({
      demande,
      clePubliqueBase64Url: signe.clePubliqueBase64Url,
      signatureBase64Url: signe.signatureBase64Url,
    });
    expect(resultat.statut).toBe("executee");
    expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(1);
  });

  it("F — refus auth : aucune réservation / fournisseur / coût", () => {
    const a = genererPaireIdentiteEd25519();
    const b = genererPaireIdentiteEd25519();
    const signataireB = SignataireAgentLocal.depuisClePriveeMemoire({
      identifiantAgent: "agent-b",
      clePriveePkcs8Der: b.clePriveePkcs8Der,
    });
    const demande = demandeTest({ identifiantAgent: "agent-a" });
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataireB.signer(message);
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      authentificationRequise: true,
      clesPubliquesParAgent: new Map([
        ["agent-a", a.clePubliqueBase64Url],
      ]),
    });
    const resultat = passerelle.executer({
      demande,
      clePubliqueBase64Url: signe.clePubliqueBase64Url,
      signatureBase64Url: signe.signatureBase64Url,
    });
    expect(resultat.statut).toBe("refusee");
    if (resultat.statut === "refusee") {
      expect(resultat.motif).toBe("authentification_invalide");
    }
    expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(0);
    expect(
      passerelle.obtenirCompteReservations().totalReservationsActives({
        identifiantAgent: "agent-a",
        numeroCycle: 1,
      }),
    ).toBe(0n);
  });

  it("G — reprise : clé retrouvée après redémarrage", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const cheminKeystore = join(repertoire, "identites");
    const conf = configBase({ taillePopulationInitiale: 2 });

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const agentId = premier.obtenirAgents()[0]!.identite.identifiant;
    const empAvant = premier.projeterIdentiteAgent(agentId).empreinteClePublique;
    const signe1 = premier.obtenirSignataire(agentId).signer(
      Buffer.from("message-reprise-1"),
    );
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(second.projeterIdentiteAgent(agentId).empreinteClePublique).toBe(
      empAvant,
    );
    expect(second.obtenirSignataire(agentId).statut).toBe("disponible");
    const signe2 = second.obtenirSignataire(agentId).signer(
      Buffer.from("message-reprise-2"),
    );
    expect(signe2.clePubliqueBase64Url).toBe(signe1.clePubliqueBase64Url);
    second.fermer();
  });

  it("H — perte clé : fail closed, aucune régénération", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const cheminKeystore = join(repertoire, "identites");
    const conf = configBase({ taillePopulationInitiale: 2 });

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const agentId = premier.obtenirAgents()[0]!.identite.identifiant;
    const empAvant = premier.projeterIdentiteAgent(agentId).empreinteClePublique!;
    const cheminCle = new KeystoreIdentitesLocal(cheminKeystore).cheminFichier(
      conf.identifiantExperience,
      agentId,
    );
    premier.fermer();
    unlinkSync(cheminCle);

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    expect(second.obtenirAgents().some((a) => a.identite.identifiant === agentId)).toBe(
      true,
    );
    const proj = second.projeterIdentiteAgent(agentId);
    expect(proj.empreinteClePublique).toBe(empAvant);
    expect(proj.statut).toBe("cle_privee_indisponible");
    expect(() =>
      second.obtenirSignataire(agentId).signer(Buffer.from("x")),
    ).toThrow(/indisponible/i);
    // Pas de nouvelle IDENTITE générée
    const idEvents = second.registre
      .listerParExperience(conf.identifiantExperience)
      .filter((e) => e.type === "IDENTITE_AGENT_ENREGISTREE");
    expect(idEvents).toHaveLength(2);
    second.fermer();
  });

  it("I — registre : aucune clé privée dans les événements", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const controleur = ControleurExperience.ouvrir({
      configuration: configBase(),
      registre: creerRegistreEvenementsMemoire(),
      cheminKeystoreIdentites: join(repertoire, "identites"),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (const evenement of controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    )) {
      const json = JSON.stringify(evenement);
      expect(json).not.toMatch(/pkcs8/i);
      expect(json).not.toMatch(/clePrivee/i);
      expect(json).not.toMatch(/privateKey/i);
      if (evenement.type === "IDENTITE_AGENT_ENREGISTREE") {
        expect(chargeUtileIdentiteContientSecret(evenement.chargeUtile)).toBe(
          false,
        );
        expect(evenement.chargeUtile.algorithme).toBe(ALGORITHME_IDENTITE_ESP);
        expect(typeof evenement.chargeUtile.clePubliqueBase64Url).toBe("string");
      }
    }
  });

  it("J — API : aucune clé privée dans les DTO", async () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const controleur = ControleurExperience.ouvrir({
      configuration: configBase({ taillePopulationInitiale: 2 }),
      registre: creerRegistreEvenementsMemoire(),
      cheminKeystoreIdentites: join(repertoire, "identites"),
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const serveur = await demarrerServeurApi({
      controleur,
      hote: "127.0.0.1",
      port: 0,
    });
    try {
      const url = `http://${serveur.hote}:${String(serveur.port)}`;
      const agentId = controleur.obtenirAgents()[0]!.identite.identifiant;
      const agent = await (
        await fetch(`${url}/api/agents/${encodeURIComponent(agentId)}`)
      ).json();
      const texte = JSON.stringify(agent);
      expect(texte).not.toMatch(/pkcs8/i);
      expect(texte).not.toMatch(/clePrivee/i);
      expect(texte).not.toMatch(/privateKey/i);
      expect(agent.identite.statut).toBe("disponible");
      expect(agent.identite.empreinteClePublique).toBeTruthy();
    } finally {
      await serveur.fermer();
    }
  });

  it("K — permissions keystore 0600 / 0700 lorsque la plateforme le permet", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const keystore = new KeystoreIdentitesLocal(join(repertoire, "identites"));
    const paire = genererPaireIdentiteEd25519();
    keystore.enregistrerClePrivee({
      identifiantExperience: "exp-perm",
      identifiantAgent: "agent-perm",
      clePriveePkcs8Der: paire.clePriveePkcs8Der,
    });
    const modeFichier = keystore.lireModeFichier({
      identifiantExperience: "exp-perm",
      identifiantAgent: "agent-perm",
    });
    const modeDir = keystore.lireModeRepertoireExperience("exp-perm");
    if (modeFichier !== null) {
      expect(modeFichier).toBe(0o600);
    }
    if (modeDir !== null) {
      expect(modeDir).toBe(0o700);
    }
    // Force chmod pour vérifier l'API même si umask a interféré
    chmodSync(
      keystore.cheminFichier("exp-perm", "agent-perm"),
      0o600,
    );
    expect(
      keystore.lireModeFichier({
        identifiantExperience: "exp-perm",
        identifiantAgent: "agent-perm",
      }),
    ).toBe(0o600);
  });

  it("L — déterminisme économique : identité n'altère pas le résultat métier", () => {
    const run = (avecIdentite: boolean) => {
      const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
      repertoires.push(repertoire);
      // Même identifiantExperience : la graine de simulation hashe l'id agent.
      const brut: ConfigurationExperienceJson = {
        identifiantExperience: "exp-eco-cmp",
        versionProtocole: "0.1.0",
        mode: "simulation",
        graineSimulation: 777,
        taillePopulationInitiale: 3,
        capitalInitialParAgentMicroUsdc: "10000000",
        parametresEconomiques: {
          version: "demo-eco",
          loyerInfrastructureMicroUsdc: "100000",
          periodeLoyerEnCycles: 5,
          tauxRedevanceProprietairePointsDeBase: "1000",
          coutOperationnelMinimalParCycleMicroUsdc: "50000",
          seuilRunwaySainEnCycles: 20,
          seuilRunwayContraintEnCycles: 5,
          cyclesDormanceAvantMort: 3,
        },
        ...(avecIdentite
          ? {
              identite: {
                active: true,
                algorithme: "ed25519" as const,
                version: "0.1.0",
              },
            }
          : {}),
      };
      const c = ControleurExperience.ouvrir({
        configuration: parserConfigurationExperience(brut),
        registre: creerRegistreEvenementsMemoire(),
        cheminKeystoreIdentites: join(repertoire, "identites"),
        dateCreationFixe: "2020-01-01T00:00:00.000Z",
        datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
      });
      for (let i = 0; i < 10; i += 1) c.avancerUnCycle();
      const emp = c.capturerEmpreinteEconomique();
      return {
        agents: emp.agents.map((a) => ({
          id: a.identifiant,
          etat: a.etat,
        })),
        tresorerie: emp.tresorerie,
      };
    };
    expect(run(true)).toEqual(run(false));
  });

  it("M — séparation domaine ESP-XWAY-INFERENCE-V1", () => {
    const message = construireMessageCanoniqueDemandeInference(demandeTest());
    const texte = message.toString("utf8");
    expect(texte.startsWith(DOMAINE_SIGNATURE_XWAY_INFERENCE)).toBe(true);
    expect(texte).toContain("version=1");
    expect(texte).not.toContain("ESP-PAIEMENT");
  });

  it("N — idempotence : demande signée exécutée puis redémarrage sans 2e conso", () => {
    const repertoire = mkdtempSync(join(tmpdir(), "esp-id-"));
    repertoires.push(repertoire);
    const cheminSqlite = join(repertoire, "esp.sqlite");
    const cheminKeystore = join(repertoire, "identites");
    const conf = configBase({ taillePopulationInitiale: 2 });

    const premier = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      dateCreationFixe: "2020-01-01T00:00:00.000Z",
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    for (let i = 0; i < 8; i += 1) premier.avancerUnCycle();
    const executeesAvant = premier.registre
      .listerParExperience(conf.identifiantExperience)
      .filter((e) => e.type === "INFERENCE_EXECUTEE");
    expect(executeesAvant.length).toBeGreaterThan(0);
    const cible = executeesAvant[0]!;
    const idDemande = String(cible.chargeUtile.identifiantDemande);
    premier.fermer();

    const second = ControleurExperience.ouvrir({
      configuration: conf,
      cheminSqlite,
      cheminKeystoreIdentites: cheminKeystore,
      datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
    });
    const agentId = String(cible.identifiantAgent);
    const signataire = second.obtenirSignataire(agentId);
    const demande = demandeTest({
      identifiantDemande: idDemande,
      identifiantAgent: agentId,
      numeroCycle: cible.numeroCycle,
      identifiantExperience: conf.identifiantExperience,
    });
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = signataire.signer(message);
    // Rejouer via passerelle reconstruite — déjà connue
    const passerelle = creerPasserelleXway({
      configuration: creerConfigurationXwayDemonstration(),
      authentificationRequise: true,
      clesPubliquesParAgent: new Map([
        [
          agentId,
          second.obtenirIdentitesPubliques().get(agentId)!.clePubliqueBase64Url,
        ],
      ]),
      etatsDemandes: new Map([
        [
          idDemande,
          {
            identifiantDemande: idDemande,
            identifiantAgent: agentId,
            numeroCycle: cible.numeroCycle,
            etat: "executee",
            coutFinalMicroUsdc: BigInt(
              String(cible.chargeUtile.coutFinalMicroUsdc),
            ),
          },
        ],
      ]),
    });
    const replay = passerelle.executer({
      demande,
      clePubliqueBase64Url: signe.clePubliqueBase64Url,
      signatureBase64Url: signe.signatureBase64Url,
    });
    expect(replay.statut).toBe("executee");
    if (replay.statut === "executee") {
      expect(replay.dejaConnue).toBe(true);
    }
    expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(0);
    second.fermer();
  });
});
